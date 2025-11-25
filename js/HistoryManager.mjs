// History management for undo/redo functionality
import { createElement } from './utils/domHelper.mjs';

export class HistoryManager {
    constructor(geometryTool) {
        this.tool = geometryTool;
        this.history = [];
        this.historyIndex = -1;
        this.maxHistorySize = 50;
    }

    saveState = () => {
        // Create a snapshot of the current state
        const state = {
            points: JSON.parse(JSON.stringify(this.tool.points)),
            edges: this.tool.edges.map(e => ({ points: [...e.points], notes: e.notes || '' })),
            circles: JSON.parse(JSON.stringify(this.tool.circles)),
            angles: this.tool.angles.map(a => ({
                pointId: a.point,
                sidepoints: a.neighborPoints || [],
                value: a.value,
                calculatedValue: a.calculatedValue,
                name: a.name || '',
                label: a.label || '',
                id: a.id,
                radius: a.radius || 30,
                notes: a.notes || ''
            })),
            bisectedAngles: Array.from(this.tool.bisectedAngles),
            linkedAngles: Array.from(this.tool.linkedAngles.entries()),
            lines: JSON.parse(JSON.stringify(this.tool.lines)),
            definitions: JSON.parse(JSON.stringify(this.tool.definitions)),
        };
        
        // Remove any redo history when a new action is performed
        if (this.historyIndex < this.history.length - 1) {
            this.history = this.history.slice(0, this.historyIndex + 1);
        }
        
        // Add new state to history
        this.history.push(state);
        
        // Limit history size
        if (this.history.length > this.maxHistorySize) {
            this.history.shift();
        } else {
            this.historyIndex++;
        }
        
        this.updateUndoRedoButtons();
        this.tool.updateJsonPanel();
    }

    undo = () => {
        if (this.historyIndex > 0) {
            this.historyIndex--;
            this.restoreState(this.history[this.historyIndex]);
            this.tool.updateStatus('↶ Undo');
        } else {
            this.tool.updateStatus('Nothing to undo');
        }
    }

    redo = () => {
        if (this.historyIndex < this.history.length - 1) {
            this.historyIndex++;
            this.restoreState(this.history[this.historyIndex]);
            this.tool.updateStatus('↷ Redo');
        } else {
            this.tool.updateStatus('Nothing to redo');
        }
    }

    restoreState = (state) => {
        // Clear current SVG content
        this.tool.svg.innerHTML = '<defs><marker id="arrowhead" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto"><polygon points="0 0, 10 3, 0 6" fill="#666" /></marker></defs>';
        
        // Restore data
        this.tool.points = JSON.parse(JSON.stringify(state.points));
        // Don't restore bisectedAngles yet - wait until after angles are created
        // this.tool.bisectedAngles = new Set(state.bisectedAngles);
        this.tool.linkedAngles = new Map(state.linkedAngles);
        
        // Rebuild pointsMap for O(1) lookups
        this.tool.pointsMap.clear();
        this.tool.points.forEach(point => {
            this.tool.pointsMap.set(point.id, point);
        });
        
        // Redraw points
        this.tool.points.forEach(point => this.tool.drawPoint(point));
        
        // Restore edges
        this.tool.edges = [];
        this.tool.adjacentPoints.clear(); // Clear adjacency map before rebuilding
        this.tool._batchUpdatingTriangles = true; // Prevent triangle updates during batch restore
        state.edges.forEach(edgeData => {
            // Support both old format (point1, point2) and new format (points array)
            const pointIds = edgeData.points || [edgeData.point1, edgeData.point2];
            const point1 = this.tool.pointsMap.get(pointIds[0]);
            const point2 = this.tool.pointsMap.get(pointIds[1]);
            
            if (point1 && point2) {
                const line = createElement('line', {
                    class: 'line',
                    x1: point1.x,
                    y1: point1.y,
                    x2: point2.x,
                    y2: point2.y
                });
                this.tool.svg.insertBefore(line, this.tool.svg.firstChild);
                
                this.tool.edges.push({
                    points: [pointIds[0], pointIds[1]],
                    element: line,
                    notes: edgeData.notes || ''
                });
                
                // Rebuild adjacentPoints map
                this.tool.addAdjacentPoint(pointIds[0], pointIds[1]);
                this.tool.addAdjacentPoint(pointIds[1], pointIds[0]);
            }
        });
        
        // Restore circles
        this.tool.circles = [];
        state.circles.forEach(circleData => {
            // Support multiple formats for backward compatibility
            let centerPointId, pointsOnLine;
            
            if (circleData.centerPoint !== undefined) {
                // New format
                centerPointId = circleData.centerPoint;
                pointsOnLine = circleData.pointsOnLine || [];
            } else if (circleData.centerPointId) {
                // Old format with centerPointId/radiusPointId
                centerPointId = circleData.centerPointId;
                pointsOnLine = circleData.radiusPointId ? [circleData.radiusPointId] : [];
            } else if (circleData.point1) {
                // Very old format with point1/point2
                centerPointId = circleData.point1;
                pointsOnLine = circleData.point2 ? [circleData.point2] : [];
            }
            
            // Also include old 'points' array if it exists
            if (circleData.points && Array.isArray(circleData.points)) {
                pointsOnLine = [...new Set([...pointsOnLine, ...circleData.points])];
            }
            
            const centerPoint = this.tool.pointsMap.get(centerPointId);
            
            // Validate that all points on line exist
            const validPointsOnLine = pointsOnLine.filter(id => this.tool.pointsMap.get(id));
            
            if (centerPoint) {
                const circle = createElement('circle', {
                    class: 'circle-shape',
                    cx: circleData.centerX,
                    cy: circleData.centerY,
                    r: circleData.radius
                });
                this.tool.svg.appendChild(circle);
                
                this.tool.circles.push({
                    name: circleData.name || `Circle_${centerPoint.id}`,
                    centerPoint: centerPointId,
                    centerX: circleData.centerX,
                    centerY: circleData.centerY,
                    radius: circleData.radius,
                    pointsOnLine: validPointsOnLine
                });
            }
        });
        
        // Restore angles - manually recreate only the angles that existed in the saved state
        // First, remove all existing angle DOM elements
        this.tool.angles.forEach(angle => {
            if (angle.arcElement) {
                angle.arcElement.remove();
            }
            if (angle.textElement) {
                angle.textElement.remove();
            }
        });
        
        // Clear bisectedAngles temporarily to allow all angles to be recreated
        this.tool.bisectedAngles = new Set();
        
        this.tool.angles = [];
        state.angles.forEach(angleData => {
            const vertex = this.tool.pointsMap.get(angleData.pointId);
            const point1 = angleData.sidepoints && angleData.sidepoints[0] ? 
                this.tool.pointsMap.get(angleData.sidepoints[0]) : null;
            const point2 = angleData.sidepoints && angleData.sidepoints[1] ? 
                this.tool.pointsMap.get(angleData.sidepoints[1]) : null;
            
            if (vertex && point1 && point2) {
                // Recreate the angle
                this.tool.createAngle(vertex, point1, point2);
                
                // Find the newly created angle and restore its value and notes
                const angle = this.tool.angles.find(a => {
                    if (a.point !== angleData.pointId) return false;
                    if (!a.neighborPoints || a.neighborPoints.length !== 2) return false;
                    const sidePointsSet = new Set(angleData.sidepoints);
                    return sidePointsSet.has(a.neighborPoints[0]) && sidePointsSet.has(a.neighborPoints[1]);
                });
                
                if (angle) {
                    if (angleData.value) {
                        angle.value = angleData.value;
                        angle.textElement.textContent = angleData.value + '°';
                    }
                    if (angleData.name) {
                        angle.name = angleData.name;
                    }
                    if (angleData.label !== undefined) {
                        angle.label = angleData.label;
                    }
                    if (angleData.radius) {
                        angle.radius = angleData.radius;
                        // Redraw the arc with the new radius
                        this.tool.redrawAngleArc(angle);
                    }
                    if (angleData.notes) {
                        angle.notes = angleData.notes;
                    }
                }
            }
        });
        
        // Now restore bisectedAngles after all angles are created
        this.tool.bisectedAngles = new Set(state.bisectedAngles);

        // Restore lines
        this.tool.lines = state.lines ? JSON.parse(JSON.stringify(state.lines)) : [];

        // Restore definitions
        this.tool.definitions = state.definitions ? JSON.parse(JSON.stringify(state.definitions)) : [];
        
        this.tool.selectedPoints = [];
        this.tool._batchUpdatingTriangles = false; // Re-enable triangle updates
        this.tool.updateTriangles(); // Update triangles once after all edges are restored
        this.updateUndoRedoButtons();
        this.tool.updateDefinitionsPanel();
        this.tool.updateNotesPanel();
        this.tool.updateJsonPanel();
    }

    updateUndoRedoButtons = () => {
        const undoBtn = this.tool.ui.toolbar.getButton('undo');
        const redoBtn = this.tool.ui.toolbar.getButton('redo');
        
        if (this.historyIndex > 0) {
            undoBtn.style.opacity = '1';
            undoBtn.disabled = false;
        } else {
            undoBtn.style.opacity = '0.5';
            undoBtn.disabled = true;
        }
        
        if (this.historyIndex < this.history.length - 1) {
            redoBtn.style.opacity = '1';
            redoBtn.disabled = false;
        } else {
            redoBtn.style.opacity = '0.5';
            redoBtn.disabled = true;
        }
    }
}
