// Geometry Drawing Tool
// Messaging
import { MessagingHub, Messages } from './MessagingHub.mjs';

// Managers
import { HistoryManager } from './HistoryManager.mjs';
import { AngleSolver } from './AngleSolver.mjs';

// Utils
import { 
    getNewPointName, 
    angleToPoint, 
    normalizeAngle, 
    radiansToDegrees, 
    degreesToRadians, 
    distance, 
    calculateAngleDegrees, 
    lineIntersection, 
    clipLineToCanvas,
    pointToSegmentDistance, 
    arePointsCollinear, 
    findOverlappingAngles, 
    dotProduct2D, 
    crossProduct2D, 
    triangleArea, 
    isPointInTriangle, 
    isPointOnCircle, 
    arePointsCollinearByPosition, 
    buildOverlappingAnglesMap,
    isPointInsideAngle,
    getUnusedGreekLetter
} from './utils/mathHelper.mjs';
import { createElement, escapeHtml } from './utils/domHelper.mjs';
import { serializeGeometryData, deserializeGeometryData, validateGeometryData } from './utils/dataSerializer.mjs';

// UI
import { UI } from './UI/index.mjs';
import { initDraggablePanels } from './UI/DraggablePanel.mjs';
import { debugLogger } from './DebugLogger.mjs';


class GeometryTool {
    constructor() {
        // Initialize messaging hub first
        this.messagingHub = new MessagingHub();
        
        this.ui = new UI(this.messagingHub);
        this.points = [];
        this.pointsMap = new Map();
        this.adjacentPoints = new Map();
        this.circles = [];
        this.edges = [];
        this.angles = [];
        this.lines = []; // Track collinear points (points on same edge)
        this.definitions = [];
        this.selectedPoints = [];
        this.currentTool = 'addPoint';
        this.bisectedAngles = new Set(); // Track which angles have been bisected
        this.linkedAngles = new Map(); // Track linked angles from bisections
        this.overlappingAngles = new Map(); // Track groups of overlapping angles (angleId -> Set of overlapping angleIds)
        this.showPointNames = true; // Track point name visibility
        this.triangles = []; // Array of Sets, each Set contains 3 point IDs forming a triangle
        
        // Undo/Redo functionality
        this.history = [];
        this.historyIndex = -1;
        this.maxHistorySize = 50;
        
        // Initialize managers
        this.historyManager = new HistoryManager(this);
        this.angleSolver = new AngleSolver(this.messagingHub);
        
        // Subscribe to messages
        this.setupMessageSubscriptions();
        
        this.initialize();
    }

    setupMessageSubscriptions = () => {
        // Toolbar events
        this.messagingHub.subscribe(Messages.TOOL_SELECTED, (tool) => this.setTool(tool));
        this.messagingHub.subscribe(Messages.TOGGLE_NAMES, () => this.togglePointNames());
        this.messagingHub.subscribe(Messages.SAVE_REQUESTED, () => this.saveToClipboard());
        this.messagingHub.subscribe(Messages.LOAD_REQUESTED, () => {
            // UI will handle showing the dialog
        });
        this.messagingHub.subscribe(Messages.UNDO_REQUESTED, () => this.undo());
        this.messagingHub.subscribe(Messages.REDO_REQUESTED, () => this.redo());
        this.messagingHub.subscribe(Messages.CLEAR_REQUESTED, () => this.clear());

        // Canvas events
        this.messagingHub.subscribe(Messages.CANVAS_CLICKED, (data) => this.handleCanvasClick(data.event));
        this.messagingHub.subscribe(Messages.POINT_CLICKED, (data) => this.handlePointClick(data.point));
        this.messagingHub.subscribe(Messages.ANGLE_CLICKED, (data) => this.handleAngleClick(data.angleData));

        // Point events
        this.messagingHub.subscribe(Messages.POINT_CREATE_REQUESTED, (data) => this.handlePointCreateRequest(data));
        this.messagingHub.subscribe(Messages.POINT_NOTES_UPDATED, (point) => {
            this.updateStatus(`✓ Notes saved for point ${point.id}`);
            this.historyManager.saveState();
            this.updateNotesPanel();
        });

        // Definition events
        this.messagingHub.subscribe(Messages.DEFINITION_ADDED, (text) => this.addDefinition(text));
        this.messagingHub.subscribe(Messages.DEFINITION_EDITED, (data) => this.editDefinition(data.id, data.text));
        this.messagingHub.subscribe(Messages.DEFINITION_DELETED, (id) => this.deleteDefinition(id));
        
        // Angle events
        this.messagingHub.subscribe(Messages.ANGLE_UPDATED, (data) => this.updateAngle(data));
        this.messagingHub.subscribe(Messages.ANGLE_BISECTOR_REQUESTED, (angleData) => this.createAngleBisector(angleData));
        this.messagingHub.subscribe(Messages.ANGLE_DELETE_REQUESTED, (angleData) => this.deleteAngle(angleData));
        
        // Edge events
        this.messagingHub.subscribe(Messages.EDGE_UPDATED, (data) => this.updateEdge(data));
        this.messagingHub.subscribe(Messages.EDGE_DELETE_REQUESTED, (edgeObj) => this.deleteEdge(edgeObj));
        
        // Data loading
        this.messagingHub.subscribe(Messages.DATA_LOAD_REQUESTED, (data) => {
            this.loadData(data);
            this.updateStatus('✅ Data loaded successfully!');
        });
        
        // Status updates (from UI components)
        this.messagingHub.subscribe(Messages.STATUS_UPDATED, (message) => this.updateStatus(message));
        
        // Angle solver events
        this.messagingHub.subscribe(Messages.ANGLE_SOLVE_COMPLETED, (data) => {
            const timeStr = data.executionTimeMs ? ` in ${data.executionTimeMs.toFixed(2)}ms` : '';
            this.updateStatus(`✓ Angle solving complete (${data.iterations} iterations, ${data.changesMade} angles calculated${timeStr})`);
            this.updateNotesPanel();
            this.updateJsonPanel();
            this.saveState();
        });
        
        this.messagingHub.subscribe(Messages.ANGLE_VALUE_CALCULATED, (data) => {
            const angle = this.angles.find(a => a.id === data.angleId);
            if (angle && angle.textElement) {
                angle.textElement.textContent = this.getAngleDisplayText(angle);
                // Redraw the arc in case the value is 90 (should show square corner)
                this.redrawAngleArc(angle);
            }
        });
    }

    addPoint = (point) => {
        this.points.push(point);
        this.pointsMap.set(point.id, point);
        this.checkSolvability();
    }
    
    getAngleDisplayText = (angle) => {
        // Priority: value > label > '?'
        if (angle.value && angle.value !== '?') {
            const isGreekLetter = isNaN(parseFloat(angle.value));
            return isGreekLetter ? angle.value : angle.value + '°';
        }
        if (angle.label && angle.label.trim() !== '') {
            return angle.label;
        }
        return '?';
    }
    
    initialize = () => {
        // create UI
        this.ui.initialize();
        this.svg = this.ui.canvas.svg;

        // Initialize toolbar buttons - use messaging hub
        const { registerButton } = this.ui.toolbar;
        registerButton('pointer', () => this.messagingHub.emit(Messages.TOOL_SELECTED, 'pointer'));
        registerButton('drawPoint', () => this.messagingHub.emit(Messages.TOOL_SELECTED, 'addPoint'));
        registerButton('drawCircle', () => this.messagingHub.emit(Messages.TOOL_SELECTED, 'drawCircle'));
        registerButton('drawEdge', () => this.messagingHub.emit(Messages.TOOL_SELECTED, 'drawEdge'));
        registerButton('extendEdge', () => this.messagingHub.emit(Messages.TOOL_SELECTED, 'extendEdge'));
        registerButton('assignAngle', () => this.messagingHub.emit(Messages.TOOL_SELECTED, 'assignAngle'));
        registerButton('angleBisector', () => this.messagingHub.emit(Messages.TOOL_SELECTED, 'angleBisector'));
        registerButton('toggleNames', () => this.messagingHub.emit(Messages.TOGGLE_NAMES));
        registerButton('solveAngles', () => this.solveAngles());
        registerButton('save', () => this.messagingHub.emit(Messages.SAVE_REQUESTED));
        registerButton('load', () => this.messagingHub.emit(Messages.LOAD_REQUESTED));
        registerButton('undo', () => this.messagingHub.emit(Messages.UNDO_REQUESTED));
        registerButton('redo', () => this.messagingHub.emit(Messages.REDO_REQUESTED));
        registerButton('clear', () => this.messagingHub.emit(Messages.CLEAR_REQUESTED));
                
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey || e.metaKey) {
                if (e.key === 'z' && !e.shiftKey) {
                    e.preventDefault();
                    this.undo();
                } else if (e.key === 'y' || (e.key === 'z' && e.shiftKey)) {
                    e.preventDefault();
                    this.redo();
                }
            }
        });
        
        // Add definition button - use messaging hub
        document.getElementById('addDefinitionBtn').addEventListener('click', () => {
            const input = document.getElementById('definitionInput');
            const text = input.value.trim();
            if (text) {
                this.messagingHub.emit(Messages.DEFINITION_ADDED, text);
                input.value = '';
                input.focus();
            }
        });

        // Add definition on Enter key - use messaging hub
        document.getElementById('definitionInput').addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                const text = e.target.value.trim();
                if (text) {
                    this.messagingHub.emit(Messages.DEFINITION_ADDED, text);
                    e.target.value = '';
                }
            }
        });

        // Event delegation for edit and delete buttons - use messaging hub
        document.getElementById('definitionsList').addEventListener('click', (e) => {
            const editBtn = e.target.closest('.definition-edit-btn');
            const deleteBtn = e.target.closest('.definition-delete-btn');
            
            if (editBtn) {
                const id = parseInt(editBtn.dataset.id);
                const item = editBtn.closest('.definition-item');
                const input = item.querySelector('.definition-edit-input');
                const textDiv = item.querySelector('.definition-text');
                
                if (item.classList.contains('editing')) {
                    // Save the edit - use messaging hub
                    const newText = input.value.trim();
                    this.messagingHub.emit(Messages.DEFINITION_EDITED, { id, text: newText });
                    item.classList.remove('editing');
                } else {
                    // Enter edit mode
                    item.classList.add('editing');
                    input.focus();
                    input.select();
                }
            } else if (deleteBtn) {
                const id = parseInt(deleteBtn.dataset.id);
                if (confirm('Are you sure you want to delete this definition?')) {
                    this.messagingHub.emit(Messages.DEFINITION_DELETED, id);
                }
            }
        });

        // Handle Enter key in edit input - use messaging hub
        document.getElementById('definitionsList').addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && e.target.classList.contains('definition-edit-input')) {
                e.preventDefault();
                const id = parseInt(e.target.dataset.id);
                const item = e.target.closest('.definition-item');
                const newText = e.target.value.trim();
                this.messagingHub.emit(Messages.DEFINITION_EDITED, { id, text: newText });
                item.classList.remove('editing');
            } else if (e.key === 'Escape' && e.target.classList.contains('definition-edit-input')) {
                const item = e.target.closest('.definition-item');
                item.classList.remove('editing');
            }
        });
        
        // Canvas click - emit message instead of direct call
        this.ui.canvas.svg.addEventListener('click', (e) => {
            this.messagingHub.emit(Messages.CANVAS_CLICKED, { event: e });
        });
        
        // Initialize debug logger
        debugLogger.init();
        
        this.updateStatus('Click on canvas to add points');
        
        // Save initial empty state
        this.saveState();
        
        // Update panels
        this.updateDefinitionsPanel();
        this.updateNotesPanel();
        this.updateJsonPanel();
        
        // Initialize draggable panels
        initDraggablePanels();
    }
    
    setTool = (tool) => {
        debugLogger.log('GeometryTool.setTool', { tool });
        this.currentTool = tool;
        this.selectedPoints = [];
        
        // Update button states
        document.querySelectorAll('.tool-btn').forEach(btn => btn.classList.remove('active'));
        
        if (tool === 'pointer') {
            document.getElementById('pointerBtn').classList.add('active');
            this.updateStatus('Click on points, edges, or angles to edit them');
        } else if (tool === 'drawPointBtn') {
            document.getElementById('drawPointBtn').classList.add('active');
            this.updateStatus('Click on canvas to add points');
        } else if (tool === 'drawCircle') {
            document.getElementById('drawCircleBtn').classList.add('active');
            this.updateStatus('Select center point, then radius point to draw a circle');
        } else if (tool === 'drawEdge') {
            document.getElementById('drawEdgeBtn').classList.add('active');
            this.updateStatus('Select 2 points to draw an edge');
        } else if (tool === 'extendEdge') {
            document.getElementById('extendEdgeBtn').classList.add('active');
            this.updateStatus('Select 2 connected points to extend the edge');
        } else if (tool === 'assignAngle') {
            document.getElementById('assignAngleBtn').classList.add('active');
            this.updateStatus('Click on an angle to assign a value');
        } else if (tool === 'angleBisector') {
            document.getElementById('angleBisectorBtn').classList.add('active');
            this.updateStatus('Click inside a triangle to bisect the angle');
        }
        
        this.updatePointSelection();
    }
    
    handleCanvasClick = (e) => {
        debugLogger.log('GeometryTool.handleCanvasClick', { 
            tool: this.currentTool,
            target: e.target.tagName 
        });
        if (e.target === this.svg) {
            if (this.currentTool === 'addPoint') {
                const pt = this.getSVGPoint(e);
                
                // Check if click is near an edge (within 5 pixels)
                const nearbyEdge = this.findNearbyEdge(pt.x, pt.y, 5);
                
                if (nearbyEdge) {
                    // Split the edge and add point at the closest point
                    this.splitEdgeWithPoint(nearbyEdge.edge, nearbyEdge.closestPoint);
                } else {
                    // Add point at click position
                    this.drawNewPoint(pt.x, pt.y);
                }
            } else if (this.currentTool === 'assignAngle') {
                const pt = this.getSVGPoint(e);
                this.findClosestPointAndEdges(pt.x, pt.y);
            } else if (this.currentTool === 'angleBisector') {
                const pt = this.getSVGPoint(e);
                this.findAndBisectAngle(pt.x, pt.y);
            }
        }
    }
    
    getSVGPoint = (e) => {
        const rect = this.ui.canvas.svg.getBoundingClientRect();
        return {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
    }
    
    findClosestPointAndEdges = (clickX, clickY) => {
        const maxDistance = 30; // Maximum 30 pixels
        
        // Find the closest point
        let closestPoint = null;
        let closestDistance = Infinity;
        
        this.points.forEach(point => {
            const dist = distance(point.x, point.y, clickX, clickY);
            
            if (dist < closestDistance && dist <= maxDistance) {
                closestDistance = dist;
                closestPoint = point;
            }
        });
        
        if (!closestPoint) {
            this.updateStatus('No point found nearby (max 30px)');
            return null;
        }
        
        
        // Find all edges connected to this point
        const connectedEdges = [];
        
        this.edges.forEach(edge => {
            if (edge.points.includes(closestPoint.id)) {
                // Get the other point
                const otherPointId = edge.points[0] === closestPoint.id ? edge.points[1] : edge.points[0];
                const otherPoint = this.pointsMap.get(otherPointId);
                
                if (otherPoint) {
                    connectedEdges.push({
                        edge: edge,
                        otherPoint: otherPoint,
                        otherPointId: otherPointId
                    });
                }
            }
        });
        
        if (connectedEdges.length < 2) {
            this.updateStatus(`Point ${closestPoint.id} needs at least 2 edges`);
            return null;
        }
        
        // Get the 2 closest edges (by angle from click point)
        const clickAngle = Math.atan2(clickY - closestPoint.y, clickX - closestPoint.x);
        
        // Calculate angle difference for each edge
        const edgesWithAngles = connectedEdges.map(edgeInfo => {
            const edgeAngle = Math.atan2(
                edgeInfo.otherPoint.y - closestPoint.y,
                edgeInfo.otherPoint.x - closestPoint.x
            );
            
            let angleDiff = Math.abs(edgeAngle - clickAngle);
            // Normalize to [0, π]
            if (angleDiff > Math.PI) angleDiff = 2 * Math.PI - angleDiff;
            
            return {
                ...edgeInfo,
                edgeAngle: edgeAngle,
                angleDiff: angleDiff
            };
        });
        
        // Sort by angle difference and take the 2 closest
        edgesWithAngles.sort((a, b) => a.angleDiff - b.angleDiff);
        const closestTwoEdges = edgesWithAngles.slice(0, 2);
        
        // Check if click is between the two edges (inside the angle)
        const edge1Angle = closestTwoEdges[0].edgeAngle;
        const edge2Angle = closestTwoEdges[1].edgeAngle;
        
        // Calculate the angle between the two edges
        let angleBetweenEdges = edge2Angle - edge1Angle;
        while (angleBetweenEdges < 0) angleBetweenEdges += 2 * Math.PI;
        while (angleBetweenEdges > 2 * Math.PI) angleBetweenEdges -= 2 * Math.PI;
        
        // Normalize click angle relative to edge1
        let relativeClickAngle = clickAngle - edge1Angle;
        while (relativeClickAngle < 0) relativeClickAngle += 2 * Math.PI;
        while (relativeClickAngle > 2 * Math.PI) relativeClickAngle -= 2 * Math.PI;
        
        // Check if click is inside the angle (between the two edges)
        const isInsideAngle = relativeClickAngle <= angleBetweenEdges;
        
        closestTwoEdges.forEach((edgeInfo, index) => {
        });
        
        
        // Check if click forms a triangle with the 3 points
        const point1 = closestPoint;
        const point2 = closestTwoEdges[0].otherPoint;
        const point3 = closestTwoEdges[1].otherPoint;
        
        const isInsideTriangle = isPointInTriangle(clickX, clickY, point1, point2, point3);
        
        
        const validClick = isInsideTriangle && closestDistance <= 30;
        
        if (validClick) {
            // Create the angle if it doesn't already exist
            const point1 = closestTwoEdges[0].otherPoint;
            const point2 = closestTwoEdges[1].otherPoint;
            
            // Check if this angle already exists
            const angleExists = this.angles.some(a => 
                a.point === closestPoint.id &&
                ((a.neighborPoints[0] === point1.id && a.neighborPoints[1] === point2.id) ||
                 (a.neighborPoints[0] === point2.id && a.neighborPoints[1] === point1.id))
            );
            
            if (!angleExists) {
                this.createAngle(closestPoint, point1, point2);
                this.saveState();
                this.updateStatus(`✓ Angle created at ${closestPoint.id} between ${point1.id}-${point2.id}`);
            } else {
                this.updateStatus(`✓ Angle already exists at ${closestPoint.id}`);
            }
        } else {
            this.updateStatus(`Click not in valid angle region (must be inside triangle and within 30px of point)`);
        }
        
        return {
            point: closestPoint,
            edges: closestTwoEdges,
            isInsideAngle: isInsideAngle,
            isInsideTriangle: isInsideTriangle,
            isValid: validClick
        };
    }
    
    drawNewPoint = (x, y) => {
        debugLogger.log('GeometryTool.addPoint', { x, y });
        const pointName = getNewPointName(this.points.length);
        
        const point = {
            id: pointName,
            x: x,
            y: y
        };
        
        this.addPoint(point);
        this.drawPoint(point);
        this.checkPointOnCircles(point);
        this.saveState();
    }
    
    createPoint = (x, y) => {
        debugLogger.log('GeometryTool.createPoint', { x, y });
        const point = {
            id: getNewPointName(this.points.length),
            x: x,
            y: y
        };
        
        this.addPoint(point);
        this.drawPoint(point);
        
        debugLogger.log('GeometryTool.createPoint', { x, y }, point);
        return point;
    }

    drawPoint = (point) => {
        debugLogger.log('GeometryTool.drawPoint', { point });
        const group = createElement('g', {
            class: 'point-group'
        });
        group.dataset.pointId = point.id;
        // SVG doesn't use z-index the same way - use pointer-events instead
        group.style.pointerEvents = 'auto'; // Ensure points are always clickable
        
        const circle = createElement('circle', {
            class: 'point-circle',
            cx: point.x,
            cy: point.y,
            r: 8
        });
        
        const text = createElement('text', {
            class: 'point-label',
            x: point.x,
            y: point.y - 15
        });
        text.textContent = point.id;
        
        group.appendChild(circle);
        group.appendChild(text);
        
        group.addEventListener('click', (e) => {
            e.stopPropagation();
            this.handlePointClick(point);
        });
        
        // Remove any previous references to this point first
        const existingGroup = this.ui.canvas.svg.querySelector(`g[data-point-id="${point.id}"]`);
        if (existingGroup) {
            existingGroup.remove();
        }
        
        // IMPORTANT: Append to the END of SVG (so it appears on top)
        this.ui.canvas.svg.appendChild(group);
    }
    
    findNeighbors = (point) => {
        const neighbors = [];
        
        // Find points connected by edges
        this.edges.forEach(edge => {
            if (edge.points[0] === point.id) {
                const neighbor = this.pointsMap.get(edge.points[1]);
                if (neighbor) neighbors.push(neighbor);
            } else if (edge.points[1] === point.id) {
                const neighbor = this.pointsMap.get(edge.points[0]);
                if (neighbor) neighbors.push(neighbor);
            }
        });
        
        return neighbors;
    }
    
    updatePointSelection = () => {
        document.querySelectorAll('.point-circle').forEach(circle => {
            const pointId = circle.parentElement.dataset.pointId;
            if (this.selectedPoints.includes(pointId)) {
                circle.classList.add('selected');
            } else {
                circle.classList.remove('selected');
            }
        });
    }

    drawCircleFromPoints = () => {
        debugLogger.log('GeometryTool.drawCircleFromPoints', { 
            selectedPoints: this.selectedPoints 
        });
        // First point is center, second point is on the circle
        const centerPoint = this.pointsMap.get(this.selectedPoints[0]);
        const circlePoint = this.pointsMap.get(this.selectedPoints[1]);
        
        if (!centerPoint || !circlePoint) return;
        
        // Calculate radius as distance from center to circle point using utility function
        const radius = distance(centerPoint.x, centerPoint.y, circlePoint.x, circlePoint.y);
        
        // Draw circle
        const circle = createElement('circle', {
            class: 'circle-shape',
            cx: centerPoint.x,
            cy: centerPoint.y,
            r: radius
        });
        
        this.ui.canvas.svg.appendChild(circle);
        
        // Start with the circle point in pointsOnLine
        const pointsOnLine = [circlePoint.id];
        
        // Check all existing points to see if they're on the circle
        const threshold = 5;
        this.points.forEach(point => {
            // Skip if already in pointsOnLine
            if (pointsOnLine.includes(point.id)) {
                return;
            }
            
            // Skip if it's the center point
            if (point.id === centerPoint.id) {
                return;
            }
            
            // Check if point is on or very close to the circle border
            if (isPointOnCircle(point, centerPoint, radius, threshold)) {
                pointsOnLine.push(point.id);
            }
        });
        
        this.circles.push({ 
            centerX: centerPoint.x, 
            centerY: centerPoint.y, 
            radius, 
            centerPoint: centerPoint.id,
            pointsOnLine: pointsOnLine
        });
        
        // Check if edge already exists between center and circle point
        const edgeExists = this.edges.some(edge => 
            (edge.points[0] === centerPoint.id && edge.points[1] === circlePoint.id) ||
            (edge.points[1] === centerPoint.id && edge.points[0] === circlePoint.id)
        );
        
        // Create edge if it doesn't exist
        if (!edgeExists) {
            this.drawEdge(centerPoint, circlePoint);
        }
        
        this.historyManager.saveState();
    }

    // Edge management methods
    drawEdge = (point1, point2) => {
        debugLogger.log('drawEdge', { 
            selectedPoints: this.selectedPoints 
        });

        if (!point1 || !point2) return;
        
        // Check if edge already exists
        const edgeExists = this.edges.some(edge => 
            (edge.points[0] === point1.id && edge.points[1] === point2.id) ||
            (edge.points[0] === point2.id && edge.points[1] === point1.id)
        );
        
        if (edgeExists) {
            this.updateStatus('Edge already exists between these points');
            return;
        }
        
        // Create edge line
        const line = createElement('line', {
            class: 'line',
            x1: point1.x,
            y1: point1.y,
            x2: point2.x,
            y2: point2.y
        });
        
        // Insert behind points
        this.svg.insertBefore(line, this.svg.firstChild);
        
        const edgeObj = {
            points: [point1.id, point2.id],
            element: line,
            notes: ''
        };
        
        this.edges.push(edgeObj);
        
        // Update adjacency map
        this.addAdjacentPoint(point1.id, point2.id);
        this.addAdjacentPoint(point2.id, point1.id);
        
        // Auto-create angles at both endpoints where possible
        this.createAnglesForNewEdge(point1.id, point2.id);
        
        this.updateStatus('Edge created');
        this.checkSolvability();
        this.historyManager.saveState();
        
        return edgeObj;
    }
    
    createAnglesForNewEdge = (pointId1, pointId2) => {
        // For each endpoint of the new edge, check if angles can be formed
        [pointId1, pointId2].forEach(pointId => {
            const neighbors = this.adjacentPoints.get(pointId);
            if (!neighbors || neighbors.size < 2) return;
            
            const neighborArray = Array.from(neighbors);
            const newEdgeNeighbor = pointId === pointId1 ? pointId2 : pointId1;
            
            // First, check if any existing angles are being split by this new edge
            // If so, increase their radius by 10 pixels
            this.angles.forEach(angle => {
                if (angle.point !== pointId) return;
                if (!angle.neighborPoints || angle.neighborPoints.length !== 2) return;
                
                const angleNeighbor1 = angle.neighborPoints[0];
                const angleNeighbor2 = angle.neighborPoints[1];
                
                // Check if the new edge goes through this angle (splits it)
                // This happens when neither of the angle's neighbors is the new edge neighbor,
                // but the new edge neighbor lies within the angle
                if (angleNeighbor1 !== newEdgeNeighbor && angleNeighbor2 !== newEdgeNeighbor) {
                    const vertex = this.pointsMap.get(pointId);
                    const p1 = this.pointsMap.get(angleNeighbor1);
                    const p2 = this.pointsMap.get(angleNeighbor2);
                    const pNew = this.pointsMap.get(newEdgeNeighbor);
                    
                if (vertex && p1 && p2 && pNew && isPointInsideAngle(vertex, p1, p2, pNew)) {
                    // This angle is being split - increase its radius by 10px
                    if (angle.arcElement) {
                        this.increaseAngleRadius(angle.arcElement, 10);
                        angle.radius = (angle.radius || 30) + 10; // Update the angle object's radius
                        
                        // Mark this angle as split
                        angle.isSplit = true;
                    }
                }
                }
            });
            
            // Collect all angle pairs that need to be created
            const anglesToCreate = [];
            
            for (let i = 0; i < neighborArray.length; i++) {
                for (let j = i + 1; j < neighborArray.length; j++) {
                    const neighbor1 = neighborArray[i];
                    const neighbor2 = neighborArray[j];
                    
                    // Check if these 3 points are collinear
                    const areCollinear = arePointsCollinear(neighbor1, pointId, neighbor2, this.lines);
                    
                    if (areCollinear) {
                        continue; // Skip collinear points - no angle to create
                    }
                    
                    // Check if angle already exists
                    const angleExists = this.angles.some(angle => 
                        angle.point === pointId &&
                        angle.neighborPoints &&
                        angle.neighborPoints.length === 2 &&
                        (
                            (angle.neighborPoints[0] === neighbor1 && angle.neighborPoints[1] === neighbor2) ||
                            (angle.neighborPoints[0] === neighbor2 && angle.neighborPoints[1] === neighbor1)
                        )
                    );
                    
                    if (!angleExists) {
                        const vertex = this.pointsMap.get(pointId);
                        const point1 = this.pointsMap.get(neighbor1);
                        const point2 = this.pointsMap.get(neighbor2);
                        
                        if (vertex && point1 && point2) {
                            // Calculate angle size for sorting
                            const angle1 = Math.atan2(point1.y - vertex.y, point1.x - vertex.x);
                            const angle2 = Math.atan2(point2.y - vertex.y, point2.x - vertex.x);
                            let angleDiff = angle2 - angle1;
                            
                            // Normalize to [0, 2π]
                            if (angleDiff < 0) angleDiff += 2 * Math.PI;
                            if (angleDiff > Math.PI) angleDiff = 2 * Math.PI - angleDiff;
                            
                            anglesToCreate.push({
                                vertex,
                                point1,
                                point2,
                                size: angleDiff
                            });
                        }
                    }
                }
            }
            
            // Sort by angle size (largest first, so smallest is created last and appears on top)
            anglesToCreate.sort((a, b) => b.size - a.size);
            
            // Create angles in sorted order (smallest last)
            anglesToCreate.forEach(angleData => {
                this.createAngle(angleData.vertex, angleData.point1, angleData.point2);
            });
        });
    }
    
    // isPointInsideAngle moved to mathHelper.mjs and imported
    // lineIntersection - duplicate removed, use mathHelper.lineIntersection  
    // getUnusedGreekLetter moved to mathHelper.mjs and imported
    // clipLineToCanvas - duplicate removed, use mathHelper.clipLineToCanvas
    
    increaseAngleRadius = (arcElement, increaseBy) => {
        const currentPath = arcElement.getAttribute('d');
        
        // Parse the path to extract radius value(s)
        // Path format for arc: M x y L x1 y1 A radius radius 0 largeArc sweep x2 y2 Z
        // Path format for square: M x y L x1 y1 L x2 y2 L x3 y3 Z
        
        const arcMatch = currentPath.match(/A\s+([\d.]+)\s+([\d.]+)/);
        if (arcMatch) {
            // It's an arc path
            const oldRadius = parseFloat(arcMatch[1]);
            const newRadius = oldRadius + increaseBy;
            
            // Replace the radius in the path
            const newPath = currentPath.replace(
                /A\s+([\d.]+)\s+([\d.]+)/,
                `A ${newRadius} ${newRadius}`
            );
            
            // Need to recalculate the arc endpoints
            // Extract vertex position (first M command)
            const vertexMatch = currentPath.match(/M\s+([\d.]+)\s+([\d.]+)/);
            const lineMatch = currentPath.match(/L\s+([\d.]+)\s+([\d.]+)/);
            
            if (vertexMatch && lineMatch) {
                const vx = parseFloat(vertexMatch[1]);
                const vy = parseFloat(vertexMatch[2]);
                const startX = parseFloat(lineMatch[1]);
                const startY = parseFloat(lineMatch[2]);
                
                // Calculate start angle
                const startAngle = Math.atan2(startY - vy, startX - vx);
                
                // Get the sweep and large arc flags
                const flagsMatch = currentPath.match(/A\s+[\d.]+\s+[\d.]+\s+0\s+(\d)\s+(\d)/);
                const largeArc = flagsMatch ? flagsMatch[1] : '0';
                const sweep = flagsMatch ? flagsMatch[2] : '1';
                
                // Extract end point
                const endMatch = currentPath.match(/A[^Z]+\s+([\d.]+)\s+([\d.]+)\s*Z/);
                if (endMatch) {
                    const endX = parseFloat(endMatch[1]);
                    const endY = parseFloat(endMatch[2]);
                    const endAngle = Math.atan2(endY - vy, endX - vx);
                    
                    // Recalculate with new radius
                    const newStartX = vx + newRadius * Math.cos(startAngle);
                    const newStartY = vy + newRadius * Math.sin(startAngle);
                    const newEndX = vx + newRadius * Math.cos(endAngle);
                    const newEndY = vy + newRadius * Math.sin(endAngle);
                    
                    const updatedPath = `M ${vx} ${vy} L ${newStartX} ${newStartY} A ${newRadius} ${newRadius} 0 ${largeArc} ${sweep} ${newEndX} ${newEndY} Z`;
                    arcElement.setAttribute('d', updatedPath);
                }
            }
        } else {
            // It's a square corner path - increase the square size
            const lines = currentPath.match(/L\s+([\d.]+)\s+([\d.]+)/g);
            if (lines && lines.length >= 3) {
                const vertexMatch = currentPath.match(/M\s+([\d.]+)\s+([\d.]+)/);
                if (vertexMatch) {
                    const vx = parseFloat(vertexMatch[1]);
                    const vy = parseFloat(vertexMatch[2]);
                    
                    // Extract the three L points
                    const coords = lines.map(line => {
                        const match = line.match(/L\s+([\d.]+)\s+([\d.]+)/);
                        return { x: parseFloat(match[1]), y: parseFloat(match[2]) };
                    });
                    
                    // Calculate angles
                    const angle1 = Math.atan2(coords[0].y - vy, coords[0].x - vx);
                    const angle2 = Math.atan2(coords[2].y - vy, coords[2].x - vx);
                    
                    // Current square size
                    const oldSize = Math.sqrt((coords[0].x - vx) ** 2 + (coords[0].y - vy) ** 2);
                    const newSize = oldSize + increaseBy;
                    
                    // Recalculate square corner
                    const newStartX = vx + newSize * Math.cos(angle1);
                    const newStartY = vy + newSize * Math.sin(angle1);
                    const newEndX = vx + newSize * Math.cos(angle2);
                    const newEndY = vy + newSize * Math.sin(angle2);
                    const newCornerX = vx + newSize * Math.cos(angle1) + newSize * Math.cos(angle2);
                    const newCornerY = vy + newSize * Math.sin(angle1) + newSize * Math.sin(angle2);
                    
                    const updatedPath = `M ${vx} ${vy} L ${newStartX} ${newStartY} L ${newCornerX} ${newCornerY} L ${newEndX} ${newEndY} Z`;
                    arcElement.setAttribute('d', updatedPath);
                }
            }
        }
    }

    findNearbyEdge = (x, y, threshold) => {
        debugLogger.log('findNearbyEdge', { x, y, threshold });
        let closestEdge = null;
        let closestDistance = threshold;
        let closestPoint = null;
        
        for (const edge of this.edges) {
            const point1 = this.pointsMap.get(edge.points[0]);
            const point2 = this.pointsMap.get(edge.points[1]);
            
            if (!point1 || !point2) continue;
            
            // Calculate distance from point to line segment
            const result = pointToSegmentDistance(x, y, point1.x, point1.y, point2.x, point2.y);
            
            if (result.distance < closestDistance) {
                closestDistance = result.distance;
                closestEdge = edge;
                closestPoint = result.closestPoint;
            }
        }
        return closestEdge ? { edge: closestEdge, closestPoint, distance: closestDistance } : null;
    }

    splitEdgeWithPoint = (edge, point) => {
        debugLogger.log('splitEdgeWithPoint', { 
            edgePoints: edge.points, 
            point 
        });

        const [id1, id2] = edge.points;
        const point1 = this.pointsMap.get(id1);
        const point2 = this.pointsMap.get(id2);
        
        if (!point1 || !point2) return;
        
        // Create new point at the point on the edge
        const newPoint = this.createPoint(point.x, point.y);
        
        // Keep the old edge in the array but remove its visual element
        edge.element.remove();
        // Note: We don't remove the edge from this.edges array anymore
        
        // Track collinear points: the new point splits the edge into two segments
        // Check if there's already a line containing both point1 and point2
        const existingLine = this.lines.find(line => 
            line.includes(id1) && line.includes(id2)
        );
        
        if (existingLine) {
            // Check if newPoint already exists in the line
            if (!existingLine.includes(newPoint.id)) {
                // insert into the current position based on distance from the first point
                existingLine.push(newPoint.id);
                const firstPoint = this.pointsMap.get(existingLine[0]);
                existingLine.sort((a, b) => {
                    const aPoint = this.pointsMap.get(a);
                    const bPoint = this.pointsMap.get(b);
                    const aPointDistance = distance(firstPoint.x, firstPoint.y, aPoint.x, aPoint.y);
                    const bPointDistance = distance(firstPoint.x, firstPoint.y, bPoint.x, bPoint.y);
                    return aPointDistance - bPointDistance;
                });
            }
        } else {
            // Create a new line array with the three collinear points
            this.lines.push([id1, newPoint.id, id2]);
        }
        
        // Create two new edges: point1 to newPoint and newPoint to point2
        const line1 = createElement('line', {
            class: 'line',
            x1: point1.x,
            y1: point1.y,
            x2: newPoint.x,
            y2: newPoint.y
        });
        this.svg.insertBefore(line1, this.svg.firstChild);
        
        this.edges.push({
            points: [id1, newPoint.id],
            element: line1,
            notes: ''
        });
        
        // Update adjacency map for first edge
        this.addAdjacentPoint(id1, newPoint.id);
        this.addAdjacentPoint(newPoint.id, id1);
        
        const line2 = createElement('line', {
            class: 'line',
            x1: newPoint.x,
            y1: newPoint.y,
            x2: point2.x,
            y2: point2.y
        });
        this.svg.insertBefore(line2, this.svg.firstChild);
        
        this.edges.push({
            points: [newPoint.id, id2],
            element: line2,
            notes: ''
        });
        
        // Update adjacency map for second edge
        this.addAdjacentPoint(newPoint.id, id2);
        this.addAdjacentPoint(id2, newPoint.id);
        
        // Remove old adjacency between point1 and point2 since they're no longer directly connected
        if (this.adjacentPoints.has(id1)) {
            this.adjacentPoints.get(id1).delete(id2);
        }
        if (this.adjacentPoints.has(id2)) {
            this.adjacentPoints.get(id2).delete(id1);
        }
        
        this.updateStatus(`Edge split with new point ${newPoint.id}`);
        this.historyManager.saveState();
        
        // Auto-create angles at the new point with its neighbors
        this.createAnglesForNewEdge(id1, newPoint.id);
        this.createAnglesForNewEdge(newPoint.id, id2);
        
        return newPoint;
    }

    extendEdgeFromPoints = () => {
        debugLogger.log('extendEdgeFromPoints', { 
            selectedPoints: this.selectedPoints 
        });
        const point1 = this.pointsMap.get(this.selectedPoints[0]);
        const point2 = this.pointsMap.get(this.selectedPoints[1]);
        
        if (!point1 || !point2) return;
        
        // Check if the two points have a common edge
        const commonEdge = this.edges.find(edge => 
            (edge.points[0] === point1.id && edge.points[1] === point2.id) ||
            (edge.points[0] === point2.id && edge.points[1] === point1.id)
        );
        
        if (!commonEdge) {
            this.updateStatus('Selected points must be connected by an edge');
            return;
        }
        
        // Calculate direction vector from point1 to point2
        const dx = point2.x - point1.x;
        const dy = point2.y - point1.y;
        const length = Math.sqrt(dx * dx + dy * dy);
        
        // Normalize direction
        const dirX = dx / length;
        const dirY = dy / length;
        
        // Extend from point2 in the same direction
        const maxExtension = 300;
        const endX = point2.x + dirX * maxExtension;
        const endY = point2.y + dirY * maxExtension;
        
        // Find intersection with other edges
        let closestIntersection = null;
        let closestDistance = maxExtension;
        let intersectedEdge = null;
        
        for (const edge of this.edges) {
            // Skip the common edge and edges connected to point2
            if (edge === commonEdge || edge.points[0] === point2.id || edge.points[1] === point2.id) {
                continue;
            }
            
            const edgePoint1 = this.pointsMap.get(edge.points[0]);
            const edgePoint2 = this.pointsMap.get(edge.points[1]);
            
            if (!edgePoint1 || !edgePoint2) continue;
            
            // Check intersection between extension line and this edge
            const intersection = lineIntersection(
                point2.x, point2.y, endX, endY,
                edgePoint1.x, edgePoint1.y, edgePoint2.x, edgePoint2.y
            );
            
            if (intersection) {
                const dist = Math.sqrt(
                    (intersection.x - point2.x) ** 2 + 
                    (intersection.y - point2.y) ** 2
                );
                
                if (dist < closestDistance && dist > 0.1) { // Avoid very small distances
                    closestDistance = dist;
                    closestIntersection = intersection;
                    intersectedEdge = edge;
                }
            }
        }
        
        // Create new point at intersection or at max distance
        let newPoint;
        if (closestIntersection) {
            // Create point at intersection point
            newPoint = this.createPoint(closestIntersection.x, closestIntersection.y);
            this.updateStatus(`Edge extended to intersection (${closestDistance.toFixed(1)}px)`);
        } else {
            // No intersection found, create point at max distance
            newPoint = this.createPoint(
                point2.x + dirX * maxExtension,
                point2.y + dirY * maxExtension
            );
            this.updateStatus(`Edge extended to maximum distance (${maxExtension}px)`);
        }
        
        // Create edge from point2 to new point
        const line = createElement('line', {
            class: 'line',
            x1: point2.x,
            y1: point2.y,
            x2: newPoint.x,
            y2: newPoint.y
        });
        
        this.svg.insertBefore(line, this.svg.firstChild);
        
        this.edges.push({
            points: [point2.id, newPoint.id],
            element: line,
            notes: ''
        });
        
        // Update adjacency map for the new edge
        this.addAdjacentPoint(point2.id, newPoint.id);
        this.addAdjacentPoint(newPoint.id, point2.id);
        
        // Check if point1 and point2 are already on a line (extension is continuing a line)
        const extensionLine = this.lines.find(line => 
            line.includes(point1.id) && line.includes(point2.id)
        );
        
        if (extensionLine) {
            // Check if newPoint already exists in the line
            if (extensionLine.includes(newPoint.id)) {
                // Point already in line, skip
            } else {
                // Check if point2 (the extension point) is at the start or end of the line
                const point2Index = extensionLine.indexOf(point2.id);
                
                if (point2Index === 0) {
                    // point2 is at the start, add newPoint at the beginning
                    extensionLine.unshift(newPoint.id);
                } else if (point2Index === extensionLine.length - 1) {
                    // point2 is at the end, add newPoint at the end
                    extensionLine.push(newPoint.id);
                } else {
                    // point2 is in the middle - this shouldn't happen for edge extension
                    // But if it does, maintain sorted order by distance
                    console.warn(`Warning: Extending from middle point ${point2.id} in line`);
                    extensionLine.push(newPoint.id);
                    const firstPoint = this.pointsMap.get(extensionLine[0]);
                    extensionLine.sort((a, b) => {
                        const aPoint = this.pointsMap.get(a);
                        const bPoint = this.pointsMap.get(b);
                        const aDist = distance(firstPoint.x, firstPoint.y, aPoint.x, aPoint.y);
                        const bDist = distance(firstPoint.x, firstPoint.y, bPoint.x, bPoint.y);
                        return aDist - bDist;
                    });
                }
            }
        } else {
            // Create a new line array with the three collinear points
            // Sort by x-coordinate (or y if vertical) to maintain consistent left-to-right order
            const newLine = [point1.id, point2.id, newPoint.id];
            newLine.sort((a, b) => {
                const aPoint = this.pointsMap.get(a);
                const bPoint = this.pointsMap.get(b);
                // Sort by x-coordinate (handles horizontal lines)
                if (Math.abs(aPoint.x - bPoint.x) > 1) {
                    return aPoint.x - bPoint.x;
                }
                // If x is same (vertical line), sort by y-coordinate
                return aPoint.y - bPoint.y;
            });
            this.lines.push(newLine);
        }
        
        // If there was an intersection, split the intersected edge
        if (closestIntersection && intersectedEdge) {
            const edgePoint1 = this.pointsMap.get(intersectedEdge.points[0]);
            const edgePoint2 = this.pointsMap.get(intersectedEdge.points[1]);
            
            // Keep the old edge in the array but remove its visual element
            intersectedEdge.element.remove();
            // Note: We don't remove the edge from this.edges array anymore
            
            // Track collinear points: the new point splits the edge into two segments
            // Check if there's already a line containing both edgePoint1 and edgePoint2
            const existingLine = this.lines.find(line => 
                line.includes(edgePoint1.id) && line.includes(edgePoint2.id)
            );
            
            if (existingLine) {
                // Check if newPoint already exists in the line
                if (!existingLine.includes(newPoint.id)) {
                    // Insert newPoint between edgePoint1 and edgePoint2 in the existing line
                    const idx1 = existingLine.indexOf(edgePoint1.id);
                    const idx2 = existingLine.indexOf(edgePoint2.id);
                    const insertIdx = Math.min(idx1, idx2) + 1;
                    existingLine.splice(insertIdx, 0, newPoint.id);
                }
            } else {
                // Create a new line array with the three collinear points
                this.lines.push([edgePoint1.id, newPoint.id, edgePoint2.id]);
            }
            
            // Create two new edges: from edgePoint1 to newPoint and from newPoint to edgePoint2
            const line1 = createElement('line', {
                class: 'line',
                x1: edgePoint1.x,
                y1: edgePoint1.y,
                x2: newPoint.x,
                y2: newPoint.y
            });
            this.svg.insertBefore(line1, this.svg.firstChild);
            
            const line2 = createElement('line', {
                class: 'line',
                x1: newPoint.x,
                y1: newPoint.y,
                x2: edgePoint2.x,
                y2: edgePoint2.y
            });
            this.svg.insertBefore(line2, this.svg.firstChild);
            
            this.edges.push({
                points: [edgePoint1.id, newPoint.id],
                element: line1,
                notes: ''
            });
            
            this.edges.push({
                points: [newPoint.id, edgePoint2.id],
                element: line2,
                notes: ''
            });
            
            // Update adjacency map for the split edges
            this.addAdjacentPoint(edgePoint1.id, newPoint.id);
            this.addAdjacentPoint(newPoint.id, edgePoint1.id);
            this.addAdjacentPoint(newPoint.id, edgePoint2.id);
            this.addAdjacentPoint(edgePoint2.id, newPoint.id);
            
            // Remove old adjacency between edgePoint1 and edgePoint2 since they're no longer directly connected
            if (this.adjacentPoints.has(edgePoint1.id)) {
                this.adjacentPoints.get(edgePoint1.id).delete(edgePoint2.id);
            }
            if (this.adjacentPoints.has(edgePoint2.id)) {
                this.adjacentPoints.get(edgePoint2.id).delete(edgePoint1.id);
            }
            
            // Auto-create angles at all affected points
            this.autoCreateAnglesForEdge([point1.id, point2.id, newPoint.id, edgePoint1.id, edgePoint2.id]);
        } else {
            // No intersection - auto-create angles at all points on the line
            this.autoCreateAnglesForEdge([point1.id, point2.id, newPoint.id]);
        }
        
        this.historyManager.saveState();
    }
    
    addAdjacentPoint = (pointId, adjacentPointId) => {
        if (!this.adjacentPoints.has(pointId)) {
            this.adjacentPoints.set(pointId, new Set());
        }
        this.adjacentPoints.get(pointId).add(adjacentPointId);
        
        // After adding the adjacent point, check for new triangles
        // Skip if we're batch updating (e.g., during state restoration)
        if (!this._batchUpdatingTriangles) {
            this.updateTriangles();
        }
    }
    
    updateTriangles = () => {
        // Clear existing triangles
        this.triangles = [];
        
        // Get all points that have adjacency relationships
        const pointIds = Array.from(this.adjacentPoints.keys());
        
        // Check all combinations of 3 points
        for (let i = 0; i < pointIds.length; i++) {
            for (let j = i + 1; j < pointIds.length; j++) {
                for (let k = j + 1; k < pointIds.length; k++) {
                    const p1 = pointIds[i];
                    const p2 = pointIds[j];
                    const p3 = pointIds[k];
                    
                    // Check if these 3 points form a triangle
                    // A triangle exists if each pair of points is connected (adjacent)
                    const p1Adjacent = this.adjacentPoints.get(p1) || new Set();
                    const p2Adjacent = this.adjacentPoints.get(p2) || new Set();
                    const p3Adjacent = this.adjacentPoints.get(p3) || new Set();
                    
                    const hasEdge12 = p1Adjacent.has(p2) || p2Adjacent.has(p1);
                    const hasEdge13 = p1Adjacent.has(p3) || p3Adjacent.has(p1);
                    const hasEdge23 = p2Adjacent.has(p3) || p3Adjacent.has(p2);
                    
                    if (hasEdge12 && hasEdge13 && hasEdge23) {
                        // Check if the three points are collinear - if so, skip (not a valid triangle)
                        const areCollinear = this.lines.some(line => 
                            line.includes(p1) && line.includes(p2) && line.includes(p3)
                        );
                        
                        if (!areCollinear) {
                            // Create a Set with the 3 point IDs (sorted for consistency)
                            const triangle = new Set([p1, p2, p3]);
                            this.triangles.push(triangle);
                        }
                    }
                }
            }
        }
        
        debugLogger.log('GeometryTool.updateTriangles', { 
            triangleCount: this.triangles.length,
            triangles: this.triangles.map(t => Array.from(t).sort())
        });
    }

    handlePointClick = (point) => {
        debugLogger.log('GeometryTool.handlePointClick', { point, tool: this.currentTool });
        if (this.currentTool === 'addPoint') {
            // Show point menu for notes
            this.ui.canvas.showPointMenu(point);
        } else if (this.currentTool === 'drawCircle') {
            if (this.selectedPoints.includes(point.id)) {
                // Deselect
                this.selectedPoints = this.selectedPoints.filter(id => id !== point.id);
            } else {
                this.selectedPoints.push(point.id);
            }
            
            this.updatePointSelection();
            
            if (this.selectedPoints.length === 2) {
                this.drawCircleFromPoints();
                this.selectedPoints = [];
                this.updatePointSelection();
            }
            
            // Update status message to clarify first=center, second=on circle
            if (this.selectedPoints.length === 0) {
                this.updateStatus('Select center point');
            } else if (this.selectedPoints.length === 1) {
                this.updateStatus('Select point on circle');
            }
        } else if (this.currentTool === 'drawEdge') {
            if (this.selectedPoints.includes(point.id)) {
                // Deselect
                this.selectedPoints = this.selectedPoints.filter(id => id !== point.id);
            } else {
                this.selectedPoints.push(point.id);
            }
            
            this.updatePointSelection();
            
            if (this.selectedPoints.length === 2) {
                const point1 = this.pointsMap.get(this.selectedPoints[0]);
                const point2 = this.pointsMap.get(this.selectedPoints[1]);
                this.drawEdge(point1, point2);
                this.selectedPoints = [this.selectedPoints[1]]; // Keep the last selected point for chaining
                this.updatePointSelection();
            }
            
            this.updateStatus(`Selected ${this.selectedPoints.length}/2 points`);
        } else if (this.currentTool === 'extendEdge') {
            if (this.selectedPoints.includes(point.id)) {
                // Deselect
                this.selectedPoints = this.selectedPoints.filter(id => id !== point.id);
            } else {
                this.selectedPoints.push(point.id);
            }
            
            this.updatePointSelection();
            
            if (this.selectedPoints.length === 2) {
                this.extendEdgeFromPoints();
                this.selectedPoints = [];
                this.updatePointSelection();
            }
            
            this.updateStatus(`Selected ${this.selectedPoints.length}/2 points`);
        }
    }
    
    createAngle = (vertex, point1, point2) => {
        // Create a unique key for this specific angle
        const neighborIds = [point1.id, point2.id].sort((a, b) => a - b);
        const angleKey = `${vertex.id}-${neighborIds[0]}-${neighborIds[1]}`;
        
        // Check if this angle already exists
        const existingAngle = this.angles.find(a => 
            a.point === vertex.id &&
            a.neighborPoints &&
            a.neighborPoints.length === 2 &&
            ((a.neighborPoints[0] === point1.id && a.neighborPoints[1] === point2.id) ||
             (a.neighborPoints[0] === point2.id && a.neighborPoints[1] === point1.id))
        );
        
        if (existingAngle) {
            // Angle already exists, don't create duplicate
            return;
        }
        
        // Skip if this angle has been bisected
        if (this.bisectedAngles.has(angleKey)) {
            return;
        }
        
        // NOTE: We no longer skip redundant/overlapping angles here - they are created but hidden in drawAngleArc
        
        // Calculate angle between three points using utility functions
        let angle1 = angleToPoint(vertex.x, vertex.y, point1.x, point1.y);
        let angle2 = angleToPoint(vertex.x, vertex.y, point2.x, point2.y);
        
        let angleDiff = angle2 - angle1;
        
        // Normalize to [0, 2π]
        angleDiff = normalizeAngle(angleDiff);
        
        // Only show if angle < 180°
        if (angleDiff > Math.PI) {
            angleDiff = 2 * Math.PI - angleDiff;
            // Swap angles
            [angle1, angle2] = [angle2, angle1];
        }
        
        
        // Only draw angles that are meaningfully less than 180° (avoid straight lines)
        const angleDegrees = radiansToDegrees(angleDiff);
        if (angleDiff < Math.PI && angleDiff > 0.1 && angleDegrees < 179) {
            this.drawAngleArc(vertex, angle1, angle2, angleDiff, point1, point2);
        } else {
        }
    }
    
    drawAngleArc(vertex, startAngle, endAngle, angleDiff, point1, point2) {
        const angleDegrees = radiansToDegrees(angleDiff);
        
        // Calculate radius based on angle value: 20 + (angle / 5)
        // This makes larger angles have larger arcs for better visibility
        const radius = 20 + (angleDegrees / 5);
        
        
        // Check if this angle is one of the two angles created by bisection
        // If so, don't show it as a square corner even if it's 90 degrees
        const neighborIds = [point1.id, point2.id].sort((a, b) => a - b);
        const angleKey = `${vertex.id}-${neighborIds[0]}-${neighborIds[1]}`;
        const isFromBisection = this.linkedAngles && this.linkedAngles.has(angleKey);
        
        // Check if this is exactly a 90-degree angle (either calculated or manually assigned)
        // But don't use square corner if this angle is from a bisection
        const is90Degree = (Math.abs(angleDegrees - 90) < 0.5) && !isFromBisection;
        
        let pathData;
        
        if (is90Degree) {
            // Draw a square corner for 90-degree angles (only if not from bisection)
            const squareSize = 20;
            
            // Calculate points for the square corner
            const startX = vertex.x + squareSize * Math.cos(startAngle);
            const startY = vertex.y + squareSize * Math.sin(startAngle);
            const endX = vertex.x + squareSize * Math.cos(endAngle);
            const endY = vertex.y + squareSize * Math.sin(endAngle);
            
            // Corner point is at the intersection of the two perpendicular lines
            const cornerX = vertex.x + squareSize * Math.cos(startAngle) + squareSize * Math.cos(endAngle);
            const cornerY = vertex.y + squareSize * Math.sin(startAngle) + squareSize * Math.sin(endAngle);
            
            pathData = `
                M ${vertex.x} ${vertex.y}
                L ${startX} ${startY}
                L ${cornerX} ${cornerY}
                L ${endX} ${endY}
                Z
            `;
        } else {
            // Draw normal arc for non-90-degree angles
            const startX = vertex.x + radius * Math.cos(startAngle);
            const startY = vertex.y + radius * Math.sin(startAngle);
            const endX = vertex.x + radius * Math.cos(endAngle);
            const endY = vertex.y + radius * Math.sin(endAngle);
            
            const largeArc = angleDiff > Math.PI ? 1 : 0;
            
            pathData = `
                M ${vertex.x} ${vertex.y}
                L ${startX} ${startY}
                A ${radius} ${radius} 0 ${largeArc} 1 ${endX} ${endY}
                Z
            `;
        }
        
        const angleId = Date.now() + Math.random();
        const path = createElement('path', {
            class: 'angle-arc',
            d: pathData,
            'data-angle-id': angleId
        });
        
        // Position for text (middle of arc)
        let midAngle = (startAngle + endAngle) / 2;
        
        // Handle angle wrapping - ensure midAngle is between startAngle and endAngle
        if (endAngle < startAngle) {
            midAngle = startAngle + angleDiff / 2;
        }
        
        const textRadius = radius + 20;
        let textX = vertex.x + textRadius * Math.cos(midAngle);
        let textY = vertex.y + textRadius * Math.sin(midAngle);
        
        // Check if there's already text near this position to prevent overlap
        const overlapThreshold = 30; // Distance threshold for considering texts as overlapping
        const offsetDistance = 25; // How much to offset if overlap is detected
        
        let hasTextOverlap = true;
        let attempts = 0;
        const maxAttempts = 8; // Try up to 8 positions around the point
        
        while (hasTextOverlap && attempts < maxAttempts) {
            hasTextOverlap = false;
            
            // Check all existing angle texts at this vertex
            for (const existingAngle of this.angles) {
                if (existingAngle.point === vertex.id && existingAngle.textElement) {
                    const existingX = parseFloat(existingAngle.textElement.getAttribute('x'));
                    const existingY = parseFloat(existingAngle.textElement.getAttribute('y'));
                    
                    const distance = Math.sqrt(
                        Math.pow(textX - existingX, 2) + 
                        Math.pow(textY - existingY, 2)
                    );
                    
                    if (distance < overlapThreshold) {
                        hasTextOverlap = true;
                        // Offset the position radially outward or rotate around
                        if (attempts < 4) {
                            // First 4 attempts: move radially outward
                            const newRadius = textRadius + offsetDistance * (attempts + 1);
                            textX = vertex.x + newRadius * Math.cos(midAngle);
                            textY = vertex.y + newRadius * Math.sin(midAngle);
                        } else {
                            // Next attempts: rotate around the vertex
                            const angleOffset = (Math.PI / 6) * (attempts - 3); // 30 degree increments
                            const adjustedAngle = midAngle + angleOffset;
                            textX = vertex.x + textRadius * Math.cos(adjustedAngle);
                            textY = vertex.y + textRadius * Math.sin(adjustedAngle);
                        }
                        break;
                    }
                }
            }
            
            attempts++;
        }
        
        const text = createElement('text', {
            class: 'angle-text',
            x: textX,
            y: textY,
            dy: '0.3em',
            'data-angle-id': angleId
        });
        text.textContent = '?';
        
        // Generate angle name (e.g., "∠ABC" where B is vertex)
        const angleName = `∠${point1.id}${vertex.id}${point2.id}`;
        
        // Check if this angle overlaps with any existing angle
        const overlappingAngles = findOverlappingAngles(vertex.id, point1.id, point2.id, this.angles, this.lines, this.pointsMap);
        const hasOverlap = overlappingAngles.length > 0;
        
        // Add event handlers
        const clickHandler = (e) => {
            e.stopPropagation();
            this.messagingHub.emit(Messages.ANGLE_CLICKED, { angleData, event: e });
        };
        
        path.addEventListener('click', clickHandler);
        text.addEventListener('click', clickHandler);
        
        // Add universal hover effect: opacity 0.5 by default, 1.0 on hover
        path.style.opacity = '0.5';
        path.style.transition = 'opacity 0.2s';
        
        path.addEventListener('mouseenter', () => {
            path.style.opacity = '1';
        });
        path.addEventListener('mouseleave', () => {
            path.style.opacity = '0.5';
        });
        
        // Store angle data with IDs only - always store elements
        const angleData = {
            id: angleId,
            point: vertex.id,
            neighborPoints: [point1.id, point2.id],
            value: null,
            calculatedValue: angleDegrees,
            name: angleName,
            label: '',
            radius: radius,
            textElement: text,  // Always store text element
            arcElement: path,   // Always store arc element
            isHidden: hasOverlap  // Mark as hidden if overlapping
        };
        
        this.angles.push(angleData);
        
        // If this angle overlaps with existing angles, track the relationship
        if (hasOverlap) {
            const primaryAngle = overlappingAngles[0]; // Use first overlapping angle as primary
            
            // Add to overlappingAngles map (bidirectional)
            if (!this.overlappingAngles.has(primaryAngle.id)) {
                this.overlappingAngles.set(primaryAngle.id, new Set([primaryAngle.id]));
            }
            this.overlappingAngles.get(primaryAngle.id).add(angleId);
            this.overlappingAngles.set(angleId, this.overlappingAngles.get(primaryAngle.id));
            
            // Hide overlapping angles by setting display:none
            path.style.display = 'none';
            text.style.display = 'none';
        }
        
        // Always add DOM elements to SVG (even if hidden)
        // Insert BEFORE points so angles appear behind points
        const firstPointGroup = this.ui.canvas.svg.querySelector('.point-group');
        if (firstPointGroup) {
            this.ui.canvas.svg.insertBefore(path, firstPointGroup);
            this.ui.canvas.svg.insertBefore(text, firstPointGroup);
        } else {
            // No points yet, just append
            this.ui.canvas.svg.appendChild(path);
            this.ui.canvas.svg.appendChild(text);
        }
        
        // After adding the angle, reorder all angles by size (larger first, smaller on top)
        this.reorderAnglesBySize();
    }
    
    reorderAnglesBySize = () => {
        // Sort angles by calculated value (larger angles first)
        const sortedAngles = [...this.angles].sort((a, b) => {
            const aValue = a.calculatedValue || 0;
            const bValue = b.calculatedValue || 0;
            return bValue - aValue; // Descending order (larger first)
        });
        
        // Find the first point group to insert before
        const firstPointGroup = this.ui.canvas.svg.querySelector('.point-group');
        
        // Reinsert angle elements in sorted order (larger angles first, so smaller appear on top)
        sortedAngles.forEach(angle => {
            if (angle.arcElement && angle.textElement) {
                // Remove from current position
                angle.arcElement.remove();
                angle.textElement.remove();
                
                // Reinsert in correct order
                if (firstPointGroup) {
                    this.ui.canvas.svg.insertBefore(angle.arcElement, firstPointGroup);
                    this.ui.canvas.svg.insertBefore(angle.textElement, firstPointGroup);
                } else {
                    this.ui.canvas.svg.appendChild(angle.arcElement);
                    this.ui.canvas.svg.appendChild(angle.textElement);
                }
            }
        });
    }

    handleAngleClick = (angleData) => {
        if (this.currentTool === 'pointer' || this.currentTool === 'assignAngle') {
            this.messagingHub.emit(Messages.ANGLE_EDIT_REQUESTED, angleData);
        } else if (this.currentTool === 'angleBisector') {
            this.messagingHub.emit(Messages.ANGLE_BISECTOR_REQUESTED, angleData);
        } else {
            this.updateStatus('Switch to "Pointer", "Assign Angle", or "Angle Bisector" tool to interact with angles');
        }
    }
    
    redrawAngleArc = (angleData) => {
        // Skip if no DOM elements (shouldn't happen with new logic, but keep for safety)
        if (!angleData.arcElement || !angleData.textElement) {
            console.warn('Angle missing DOM elements:', angleData);
            return;
        }
        
        // Look up the actual point objects from IDs
        const vertex = this.pointsMap.get(angleData.point);
        const point1 = this.pointsMap.get(angleData.neighborPoints[0]);
        const point2 = this.pointsMap.get(angleData.neighborPoints[1]);
        
        if (!vertex || !point1 || !point2) {
            console.error('Could not find points for angle:', angleData);
            return;
        }
        
        const radius = angleData.radius || 30;
        
        // Calculate angles
        let angle1 = Math.atan2(point1.y - vertex.y, point1.x - vertex.x);
        let angle2 = Math.atan2(point2.y - vertex.y, point2.x - vertex.x);
        
        let angleDiff = angle2 - angle1;
        
        // Normalize to [0, 2π]
        while (angleDiff < 0) angleDiff += 2 * Math.PI;
        while (angleDiff > 2 * Math.PI) angleDiff -= 2 * Math.PI;
        
        // Only show if angle < 180°
        if (angleDiff > Math.PI) {
            angleDiff = 2 * Math.PI - angleDiff;
            [angle1, angle2] = [angle2, angle1];
        }
        
        const startAngle = angle1;
        const endAngle = angle2;
        const angleDegrees = angleDiff * 180 / Math.PI;
        
        // Check if it's a 90-degree angle (either calculated or manually assigned)
        const neighborIds = [point1.id, point2.id].sort((a, b) => a - b);
        const angleKey = `${vertex.id}-${neighborIds[0]}-${neighborIds[1]}`;
        const isFromBisection = this.linkedAngles && this.linkedAngles.has(angleKey);
        
        // Check both calculated angle and assigned value
        const hasValue90 = angleData.value === 90 || angleData.value === '90';
        const hasCalculated90 = Math.abs(angleDegrees - 90) < 0.5;
        const is90Degree = (hasValue90 || hasCalculated90) && !isFromBisection;
        
        let pathData;
        
        if (is90Degree) {
            // Draw a square corner for 90-degree angles
            const squareSize = Math.min(radius, 20);
            
            const startX = vertex.x + squareSize * Math.cos(startAngle);
            const startY = vertex.y + squareSize * Math.sin(startAngle);
            const endX = vertex.x + squareSize * Math.cos(endAngle);
            const endY = vertex.y + squareSize * Math.sin(endAngle);
            
            const cornerX = vertex.x + squareSize * Math.cos(startAngle) + squareSize * Math.cos(endAngle);
            const cornerY = vertex.y + squareSize * Math.sin(startAngle) + squareSize * Math.sin(endAngle);
            
            pathData = `
                M ${vertex.x} ${vertex.y}
                L ${startX} ${startY}
                L ${cornerX} ${cornerY}
                L ${endX} ${endY}
                Z
            `;
        } else {
            // Draw normal arc
            const startX = vertex.x + radius * Math.cos(startAngle);
            const startY = vertex.y + radius * Math.sin(startAngle);
            const endX = vertex.x + radius * Math.cos(endAngle);
            const endY = vertex.y + radius * Math.sin(endAngle);
            
            const largeArc = angleDiff > Math.PI ? 1 : 0;
            
            pathData = `
                M ${vertex.x} ${vertex.y}
                L ${startX} ${startY}
                A ${radius} ${radius} 0 ${largeArc} 1 ${endX} ${endY}
                Z
            `;
        }
        
        // Update the arc path
        angleData.arcElement.setAttribute('d', pathData);
        
        // Update text position
        let midAngle = (startAngle + endAngle) / 2;
        if (endAngle < startAngle) {
            midAngle = startAngle + angleDiff / 2;
        }
        
        const textRadius = radius + 20;
        const textX = vertex.x + textRadius * Math.cos(midAngle);
        const textY = vertex.y + textRadius * Math.sin(midAngle);
        
        angleData.textElement.setAttribute('x', textX);
        angleData.textElement.setAttribute('y', textY);
    }
    
    // Auto-create angles when edges are added
    autoCreateAnglesForEdge = (edgePointIds) => {
        debugLogger.log('GeometryTool.autoCreateAnglesForEdge', { edgePointIds });
        
        // For each point in the edge, check if it now has 2+ neighbors
        edgePointIds.forEach(pointId => {
            const point = this.pointsMap.get(pointId);
            if (!point) return;
            
            // Find all neighbors of this point
            const neighbors = this.findNeighbors(point);
            
            if (neighbors.length < 2) return; // Need at least 2 neighbors for an angle
            
            // Collect all angle pairs that need to be created
            const anglesToCreate = [];
            
            // For each pair of neighbors, check if an angle should be created
            for (let i = 0; i < neighbors.length; i++) {
                for (let j = i + 1; j < neighbors.length; j++) {
                    const neighbor1 = neighbors[i];
                    const neighbor2 = neighbors[j];
                    
                    // Check if these 3 points are collinear (all on same line)
                    const areCollinear = arePointsCollinear(point.id, neighbor1.id, neighbor2.id, this.lines);
                    
                    if (areCollinear) {
                        // Skip creating angle if points are on the same line
                        continue;
                    }
                    
                    // Check if angle already exists
                    const angleExists = this.angles.some(a => 
                        a.point === point.id &&
                        ((a.neighborPoints[0] === neighbor1.id && a.neighborPoints[1] === neighbor2.id) ||
                         (a.neighborPoints[0] === neighbor2.id && a.neighborPoints[1] === neighbor1.id))
                    );
                    
                    if (!angleExists) {
                        // Calculate angle size for sorting
                        const angle1 = Math.atan2(neighbor1.y - point.y, neighbor1.x - point.x);
                        const angle2 = Math.atan2(neighbor2.y - point.y, neighbor2.x - point.x);
                        let angleDiff = angle2 - angle1;
                        
                        // Normalize to [0, 2π]
                        if (angleDiff < 0) angleDiff += 2 * Math.PI;
                        if (angleDiff > Math.PI) angleDiff = 2 * Math.PI - angleDiff;
                        
                        anglesToCreate.push({
                            point,
                            neighbor1,
                            neighbor2,
                            size: angleDiff
                        });
                    }
                }
            }
            
            // Sort by angle size (largest first, so smallest is created last and appears on top)
            anglesToCreate.sort((a, b) => b.size - a.size);
            
            // Create angles in sorted order (smallest last)
            anglesToCreate.forEach(angleData => {
                this.createAngle(angleData.point, angleData.neighbor1, angleData.neighbor2);
            });
        });
    }
    
    
    // Trigger angle solving using geometric theorems
    solveAngles = () => {
        debugLogger.log('GeometryTool.solveAngles', {
            totalAngles: this.angles.length,
            unknownAngles: this.angles.filter(a => !a.value || a.value === '?').length
        });
        
        // Send all necessary data to the solver
        this.messagingHub.emit(Messages.ANGLE_SOLVE_REQUESTED, {
            adjacentPoints: this.adjacentPoints,
            circles: this.circles,
            edges: this.edges,
            points: this.points,
            lines: this.lines,
            pointsMap: this.pointsMap,
            angles: this.angles,
            triangles: this.triangles
        });
    }
    
    /**
     * Check if the current geometry problem can be solved
     * Calls AngleSolver.canBeSolved() and displays result in debug panel
     */
    checkSolvability = () => {
        // Skip if no angles exist yet
        if (this.angles.length === 0) {
            return;
        }
        
        // Update solver data
        this.angleSolver.updateData({
            adjacentPoints: this.adjacentPoints,
            circles: this.circles,
            edges: this.edges,
            points: this.points,
            lines: this.lines,
            pointsMap: this.pointsMap,
            angles: this.angles,
            triangles: this.triangles
        });
        
        // Check solvability
        const result = this.angleSolver.canBeSolved();
        
        // Send result to debug panel via messaging hub
        debugLogger.log('Solvability Check', {
            status: result.solvable ? '✓ Solvable' : '✗ Not solvable',
            reason: result.reason,
            progress: `${result.details.solvedAngles}/${result.details.totalAngles} angles`
        });
    }
    
    createAngleBisector = (angleData) => {
        
        // Look up the point object from ID
        const point = this.pointsMap.get(angleData.point);
        if (!point) {
            this.updateStatus('Cannot create bisector: point not found');
            return;
        }
        
        // Store the original angle value (if it exists) to split it in half
        const originalAngleValue = angleData.value;
        const halfAngleValue = originalAngleValue ? (parseFloat(originalAngleValue) / 2).toString() : null;
        
        // Use the specific two neighbor points from the angleData (not all neighbors)
        // This ensures we bisect the correct angle when a point has more than 2 neighbors
        if (!angleData.neighborPoints || angleData.neighborPoints.length !== 2) {
            this.updateStatus('Cannot create bisector: angle data is incomplete');
            return;
        }
        
        // Look up neighbor point objects
        const neighbor1 = this.pointsMap.get(angleData.neighborPoints[0]);
        const neighbor2 = this.pointsMap.get(angleData.neighborPoints[1]);
        
        if (!neighbor1 || !neighbor2) {
            this.updateStatus('Cannot create bisector: neighbor points not found');
            return;
        }
        
        const neighbors = [neighbor1, neighbor2];
        
        // Create a unique key for this specific angle based on point and the two neighbor points
        // Sort the neighbor IDs to ensure consistent key regardless of order
        const neighborIds = [neighbors[0].id, neighbors[1].id].sort((a, b) => a.localeCompare(b));
        const angleKey = `${point.id}-${neighborIds[0]}-${neighborIds[1]}`;
        
        // Check if this specific angle has already been bisected
        if (this.bisectedAngles.has(angleKey)) {
            this.updateStatus('⚠️ This angle has already been bisected');
            return;
        }
        
        // Mark this angle as bisected
        this.bisectedAngles.add(angleKey);
        
        // Ensure the angle has visual elements (create them if they don't exist)
        if (!angleData.arcElement || !angleData.textElement) {
            // Create the angle visualization first
            this.drawAngle(point, neighbor1, neighbor2, angleData.radius || 30);
            
            // Find the newly created angle data (it was just added to this.angles)
            const newAngleData = this.angles[this.angles.length - 1];
            
            // Copy over any existing properties from the old angleData
            if (angleData.value) newAngleData.value = angleData.value;
            if (angleData.name) newAngleData.name = angleData.name;
            
            // Update the reference
            const angleIndex = this.angles.indexOf(angleData);
            if (angleIndex > -1) {
                this.angles[angleIndex] = newAngleData;
            }
            angleData = newAngleData;
        }
        
        // Keep the original angle but make it larger (increase radius)
        const originalRadius = angleData.radius || 30;
        angleData.radius = originalRadius + 20; // Make it 20px larger
        this.redrawAngleArc(angleData);
        
        // Calculate angles to both neighbors
        const angle1 = Math.atan2(neighbors[0].y - point.y, neighbors[0].x - point.x);
        const angle2 = Math.atan2(neighbors[1].y - point.y, neighbors[1].x - point.x);
        
        // Calculate the bisector angle (middle between the two angles)
        let bisectorAngle;
        let angleDiff = angle2 - angle1;
        
        // Normalize angle difference
        while (angleDiff < 0) angleDiff += 2 * Math.PI;
        while (angleDiff > 2 * Math.PI) angleDiff -= 2 * Math.PI;
        
        // Take the smaller angle
        if (angleDiff > Math.PI) {
            angleDiff = 2 * Math.PI - angleDiff;
            bisectorAngle = angle2 + angleDiff / 2;
        } else {
            bisectorAngle = angle1 + angleDiff / 2;
        }
        
        // Create a long line from the point in the bisector direction
        const bisectorLength = 1000; // Long enough to intersect with edges
        const endX = point.x + bisectorLength * Math.cos(bisectorAngle);
        const endY = point.y + bisectorLength * Math.sin(bisectorAngle);
        
        // Find intersection with edges
        let closestIntersection = null;
        let closestDistance = Infinity;
        let intersectedEdge = null;
        
        this.edges.forEach(edge => {
            const point1 = this.pointsMap.get(edge.points[0]);
            const point2 = this.pointsMap.get(edge.points[1]);
            
            if (!point1 || !point2) return;
            
            // Skip edges connected to the point itself
            if (point1.id === point.id || point2.id === point.id) return;
            
            const intersection = lineIntersection(
                point.x, point.y, endX, endY,
                point1.x, point1.y, point2.x, point2.y
            );
            
            if (intersection) {
                const dist = Math.sqrt(
                    Math.pow(intersection.x - point.x, 2) + 
                    Math.pow(intersection.y - point.y, 2)
                );
                
                if (dist < closestDistance && dist > 1) { // Avoid point itself
                    closestDistance = dist;
                    closestIntersection = intersection;
                    intersectedEdge = { edge, point1, point2 };
                }
            }
        });
        
        // Draw the bisector line
        let bisectorEndX = endX;
        let bisectorEndY = endY;
        
        if (closestIntersection && intersectedEdge) {
            bisectorEndX = closestIntersection.x;
            bisectorEndY = closestIntersection.y;
            
            // Create a new point at the intersection
            const pointName = getNewPointName(this.points.length);
            const newPoint = {
                id: pointName,
                x: closestIntersection.x,
                y: closestIntersection.y
            };
            this.addPoint(newPoint);
            this.drawPoint(newPoint);
            
            // Track collinear points in lines array (same as splitEdgeWithPoint)
            const existingLine = this.lines.find(line => 
                line.includes(intersectedEdge.point1.id) && line.includes(intersectedEdge.point2.id)
            );
            
            if (existingLine) {
                // Check if newPoint already exists in the line
                if (!existingLine.includes(newPoint.id)) {
                    // Add new point to existing line and sort by distance from first point
                    existingLine.push(newPoint.id);
                    const firstPoint = this.pointsMap.get(existingLine[0]);
                    existingLine.sort((a, b) => {
                        const aPoint = this.pointsMap.get(a);
                        const bPoint = this.pointsMap.get(b);
                        const aPointDistance = Math.sqrt((aPoint.x - firstPoint.x)**2 + (aPoint.y - firstPoint.y)**2);
                        const bPointDistance = Math.sqrt((bPoint.x - firstPoint.x)**2 + (bPoint.y - firstPoint.y)**2);
                        return aPointDistance - bPointDistance;
                    });
                }
            } else {
                // Create new line with all three collinear points
                this.lines.push([intersectedEdge.point1.id, newPoint.id, intersectedEdge.point2.id]);
            }
            
            // Remove the old edge that was intersected
            const oldEdgeIndex = this.edges.indexOf(intersectedEdge.edge);
            if (oldEdgeIndex > -1) {
                this.edges.splice(oldEdgeIndex, 1);
                // Remove the old edge line element from DOM
                if (intersectedEdge.edge.element) {
                    intersectedEdge.edge.element.remove();
                }
            }
            
            // Create two new edges: from point1 to newPoint and from newPoint to point2
            const edge1Line = createElement('line', {
                class: 'line',
                x1: intersectedEdge.point1.x,
                y1: intersectedEdge.point1.y,
                x2: newPoint.x,
                y2: newPoint.y
            });
            this.ui.canvas.svg.insertBefore(edge1Line, this.ui.canvas.svg.firstChild);
            
            this.edges.push({
                points: [intersectedEdge.point1.id, newPoint.id],
                element: edge1Line,
                notes: ''
            });
            
            // Update adjacency map for edge1
            this.addAdjacentPoint(intersectedEdge.point1.id, newPoint.id);
            this.addAdjacentPoint(newPoint.id, intersectedEdge.point1.id);
            
            const edge2Line = createElement('line', {
                class: 'line',
                x1: newPoint.x,
                y1: newPoint.y,
                x2: intersectedEdge.point2.x,
                y2: intersectedEdge.point2.y
            });
            this.ui.canvas.svg.insertBefore(edge2Line, this.ui.canvas.svg.firstChild);
            
            this.edges.push({
                points: [newPoint.id, intersectedEdge.point2.id],
                element: edge2Line,
                notes: ''
            });
            
            // Update adjacency map for edge2
            this.addAdjacentPoint(newPoint.id, intersectedEdge.point2.id);
            this.addAdjacentPoint(intersectedEdge.point2.id, newPoint.id);
            
            // Do NOT remove old adjacency - the original triangle still exists
            // We now have 3 triangles: 1 large original + 2 smaller new ones
            
            // Create edge from point to new point (the bisector edge)
            const bisectorEdgeLine = createElement('line', {
                class: 'line',
                x1: point.x,
                y1: point.y,
                x2: newPoint.x,
                y2: newPoint.y
            });
            this.ui.canvas.svg.insertBefore(bisectorEdgeLine, this.ui.canvas.svg.firstChild);
            
            this.edges.push({
                points: [point.id, newPoint.id],
                element: bisectorEdgeLine,
                notes: ''
            });
            
            // Update adjacency map for bisector edge
            this.addAdjacentPoint(point.id, newPoint.id);
            this.addAdjacentPoint(newPoint.id, point.id);
            
            // Store the relationship between the two bisected angles at the ORIGINAL POINT
            // These are the two angles created by splitting the original angle at 'point'
            // The bisector divides the angle at 'point' between neighbors[0] and neighbors[1]
            // into two angles: point-neighbors[0]-newPoint and point-neighbors[1]-newPoint
            
            const neighbor1Id = neighbors[0].id;
            const neighbor2Id = neighbors[1].id;
            const newPointId = newPoint.id;
            
            // Create angle keys: point-neighborA-neighborB where neighbors are sorted
            // First angle: point with neighbor1 and newPoint
            const angle1NeighborIds = [neighbor1Id, newPointId].sort((a, b) => a - b);
            const bisectedAngle1Key = `${point.id}-${angle1NeighborIds[0]}-${angle1NeighborIds[1]}`;
            
            // Second angle: point with neighbor2 and newPoint
            const angle2NeighborIds = [neighbor2Id, newPointId].sort((a, b) => a - b);
            const bisectedAngle2Key = `${point.id}-${angle2NeighborIds[0]}-${angle2NeighborIds[1]}`;
            
            
            // Store this as a pair of linked angles (bidirectional)
            if (!this.linkedAngles) {
                this.linkedAngles = new Map();
            }
            this.linkedAngles.set(bisectedAngle1Key, bisectedAngle2Key);
            this.linkedAngles.set(bisectedAngle2Key, bisectedAngle1Key);
            
            // Always create the two new angles at the original point after bisection
            
            // Get an unused Greek letter for the bisected angles
            const unusedGreekLetter = getUnusedGreekLetter(this.angles);
            
            // Create the two new angles at the original point
            // First angle: between neighbor1 and newPoint
            this.createAngle(point, neighbors[0], newPoint);
            
            // Second angle: between neighbor2 and newPoint
            this.createAngle(point, neighbors[1], newPoint);
            
            // Find the two newly created angles and set their labels and values
            const newAngles = this.angles.filter(a => 
                a.point === point.id && (
                    (a.neighborPoints[0] === neighbors[0].id && a.neighborPoints[1] === newPoint.id) ||
                    (a.neighborPoints[0] === newPoint.id && a.neighborPoints[1] === neighbors[0].id) ||
                    (a.neighborPoints[0] === neighbors[1].id && a.neighborPoints[1] === newPoint.id) ||
                    (a.neighborPoints[0] === newPoint.id && a.neighborPoints[1] === neighbors[1].id)
                )
            );
            
            // Set the same Greek letter label for both bisected angles
            newAngles.forEach(angle => {
                angle.label = unusedGreekLetter;
                
                // If the original angle had a value, apply the half value
                if (halfAngleValue) {
                    angle.value = halfAngleValue;
                }
                
                // Update text display (shows label if no value)
                angle.textElement.textContent = this.getAngleDisplayText(angle);
            });
            
            // Create angles at the new intersection point
            // The newPoint now has 3 neighbors: point, intersectedEdge.point1, intersectedEdge.point2
            // Use autoCreateAnglesForEdge to ensure all angles are created correctly
            
            // Create angles for the bisector edge (A-D)
            console.log(`Creating angles for bisector edge: ${point.id}-${newPoint.id}`);
            this.autoCreateAnglesForEdge([point.id, newPoint.id]);
            
            // Create angles for the first segment of split edge (B-D)
            console.log(`Creating angles for split edge segment 1: ${intersectedEdge.point1.id}-${newPoint.id}`);
            this.autoCreateAnglesForEdge([intersectedEdge.point1.id, newPoint.id]);
            
            // Create angles for the second segment of split edge (D-C)
            console.log(`Creating angles for split edge segment 2: ${intersectedEdge.point2.id}-${newPoint.id}`);
            this.autoCreateAnglesForEdge([intersectedEdge.point2.id, newPoint.id]);
            
            // Log all angles at the new point D
            const anglesAtD = this.angles.filter(a => a.point === newPoint.id);
            console.log(`Angles at point ${newPoint.id}:`, anglesAtD.map(a => ({
                name: a.name,
                neighbors: a.neighborPoints,
                isHidden: a.isHidden,
                value: a.calculatedValue
            })));
            
            console.log(`Angle bisector: created angles for all edges meeting at intersection point ${newPoint.id}`);
            
            // Update triangles (will detect the newly created triangles)
            this.updateTriangles();
            
            this.updateStatus(`Bisector created with intersection point ${newPoint.id}, angles created at intersection`);
        } else {
            // No intersection, draw to canvas edge
            const svgRect = this.ui.canvas.svg.getBoundingClientRect();
            const canvasIntersection = clipLineToCanvas(
                point.x, point.y, endX, endY,
                svgRect.width, svgRect.height
            );
            
            if (canvasIntersection) {
                bisectorEndX = canvasIntersection.x;
                bisectorEndY = canvasIntersection.y;
            }
            
            this.updateStatus('Bisector created (no edge intersection)');
        }
        
        // Draw the bisector visual line (dashed orange) only if no intersection
        if (!closestIntersection) {
            const line = createElement('line', {
                class: 'line bisector',
                x1: point.x,
                y1: point.y,
                x2: bisectorEndX,
                y2: bisectorEndY
            });
            this.ui.canvas.svg.insertBefore(line, this.ui.canvas.svg.firstChild);
        }
        
        this.saveState();
    }
    
    // lineIntersection - removed, using mathHelper.lineIntersection
    // getUnusedGreekLetter - removed, using mathHelper.getUnusedGreekLetter
    // clipLineToCanvas - removed, using mathHelper.clipLineToCanvas
    
    saveState = () => {
        return this.historyManager.saveState();
    }
    
    undo = () => {
        return this.historyManager.undo();
    }
    
    redo = () => {
        return this.historyManager.redo();
    }
    
    restoreState = (state) => {
        // Clear current SVG content
        this.ui.canvas.svg.innerHTML = '<defs><marker id="arrowhead" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto"><polygon points="0 0, 10 3, 0 6" fill="#666" /></marker></defs>';
        
        // Restore data
        this.points = JSON.parse(JSON.stringify(state.points));
        this.bisectedAngles = new Set(state.bisectedAngles);
        this.linkedAngles = new Map(state.linkedAngles);
        
        // Rebuild pointsMap for O(1) lookups
        this.pointsMap.clear();
        this.points.forEach(point => {
            this.pointsMap.set(point.id, point);
        });
        
        // Restore point name visibility setting
        if (state.showPointNames !== undefined) {
            this.showPointNames = state.showPointNames;
            const btn = this.ui.toolbar.getButton('toggleNames')?.element;
            if (btn) {
                if (this.showPointNames) {
                    btn.classList.add('active');
                } else {
                    btn.classList.remove('active');
                }
            }
        }
        
        // Redraw points
        this.points.forEach(point => this.drawPoint(point));
        
        // Restore edges
        this.edges = [];
        this.adjacentPoints.clear(); // Clear adjacency map before rebuilding
        this._batchUpdatingTriangles = true; // Prevent triangle updates during batch restore
        state.edges.forEach(edgeData => {
            // Support both old format (point1, point2) and new format (points array)
            const pointIds = edgeData.points || [edgeData.point1, edgeData.point2];
            const point1 = this.pointsMap.get(pointIds[0]);
            const point2 = this.pointsMap.get(pointIds[1]);
            
            if (point1 && point2) {
                const line = createElement('line', {
                    class: 'line',
                    x1: point1.x,
                    y1: point1.y,
                    x2: point2.x,
                    y2: point2.y
                });
                this.ui.canvas.svg.insertBefore(line, this.ui.canvas.svg.firstChild);
                
                const edgeObj = {
                    points: [pointIds[0], pointIds[1]],
                    element: line,
                    notes: edgeData.notes || ''
                };
                
                this.edges.push(edgeObj);
                
                // Rebuild adjacentPoints map
                this.addAdjacentPoint(pointIds[0], pointIds[1]);
                this.addAdjacentPoint(pointIds[1], pointIds[0]);
            }
        });
        
        // Restore circles
        this.circles = [];
        state.circles.forEach(circleData => {
            // Support multiple formats: new (centerPoint/pointsOnLine), points array, or old (point1/point2)
            let centerPointId, pointsOnLine;
            
            if (circleData.centerPoint !== undefined) {
                // New format
                centerPointId = circleData.centerPoint;
                pointsOnLine = circleData.pointsOnLine || [];
            } else if (circleData.points) {
                // Points array format
                centerPointId = circleData.points[0];
                pointsOnLine = [circleData.points[1]];
            } else {
                // Old format
                centerPointId = circleData.point1;
                pointsOnLine = [circleData.point2];
            }
            
            const centerPoint = this.pointsMap.get(centerPointId);
            
            // Validate that all points on line exist
            const validPointsOnLine = pointsOnLine.filter(id => this.pointsMap.get(id));
            
            if (centerPoint) {
                const circle = createElement('circle', {
                    class: 'circle-shape',
                    cx: circleData.centerX,
                    cy: circleData.centerY,
                    r: circleData.radius
                });
                this.ui.canvas.svg.appendChild(circle);
                
                this.circles.push({
                    centerX: circleData.centerX,
                    centerY: circleData.centerY,
                    radius: circleData.radius,
                    centerPoint: centerPointId,
                    pointsOnLine: validPointsOnLine
                });
            }
        });
        
        // Restore angles - manually recreate only the angles that existed in the saved state
        this.angles = [];
        state.angles.forEach(angleData => {
            const vertex = this.pointsMap.get(angleData.pointId);
            const point1 = angleData.sidePoints && angleData.sidePoints[0] ? 
                this.pointsMap.get(angleData.sidePoints[0]) : null;
            const point2 = angleData.sidePoints && angleData.sidePoints[1] ? 
                this.pointsMap.get(angleData.sidePoints[1]) : null;
            
            if (vertex && point1 && point2) {
                // Recreate the angle
                this.createAngle(vertex, point1, point2);
                
                // Find the newly created angle and restore its value and notes
                const angle = this.angles.find(a => {
                    if (a.point !== angleData.pointId) return false;
                    if (!a.neighborPoints || a.neighborPoints.length !== 2) return false;
                    const sidePointsSet = new Set(angleData.sidePoints);
                    return sidePointsSet.has(a.neighborPoints[0]) && sidePointsSet.has(a.neighborPoints[1]);
                });
                
                if (angle) {
                    if (angleData.value) {
                        angle.value = angleData.value;
                        angle.textElement.textContent = angleData.value + '°';
                    }
                    if (angleData.id) {
                        angle.id = angleData.id;
                    }
                    if (angleData.radius) {
                        angle.radius = angleData.radius;
                        // Note: Arc is already drawn with correct radius during angle creation
                    }
                    if (angleData.notes) {
                        angle.notes = angleData.notes;
                    }
                }
            }
        });
        
        this.selectedPoints = [];
        this._batchUpdatingTriangles = false; // Re-enable triangle updates
        this.updateTriangles(); // Update triangles once after all edges are restored
        this.updateUndoRedoButtons();
        this.updateJsonPanel();
    }
    
    updateUndoRedoButtons = () => {
        const undoBtn = this.ui.toolbar.getButton('undo')?.element;
        const redoBtn = this.ui.toolbar.getButton('redo')?.element;
        
        if (undoBtn) {
            if (this.historyIndex > 0) {
                undoBtn.style.opacity = '1';
                undoBtn.disabled = false;
            } else {
                undoBtn.style.opacity = '0.5';
                undoBtn.disabled = true;
            }
        }
        
        if (redoBtn) {
            if (this.historyIndex < this.history.length - 1) {
                redoBtn.style.opacity = '1';
                redoBtn.disabled = false;
            } else {
                redoBtn.style.opacity = '0.5';
                redoBtn.disabled = true;
            }
        }
    }
    
    clear = () => {
        if (confirm('Clear all elements?')) {
            this.ui.canvas.svg.innerHTML = '<defs><marker id="arrowhead" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto"><polygon points="0 0, 10 3, 0 6" fill="#666" /></marker></defs>';
            this.points = [];
            this.circles = [];
            this.edges = [];
            this.angles = [];
            this.selectedPoints = [];
            this.triangles = [];
            this.adjacentPoints.clear();
            this.bisectedAngles.clear();
            this.linkedAngles.clear();
            this.history = [];
            this.historyIndex = -1;
            this.updateStatus('Canvas cleared. Click to add points.');
            this.saveState(); // Save the cleared state
        }
    }

    togglePointNames = () => {
        this.showPointNames = !this.showPointNames;
        
        // Update all point text elements
        this.ui.canvas.svg.querySelectorAll('.point-label').forEach(label => {
            label.style.display = this.showPointNames ? 'block' : 'none';
        });
        
        // Update button state
        const btn = this.ui.toolbar.getButton('toggleNames')?.element;
        if (btn) {
            if (this.showPointNames) {
                btn.classList.add('active');
                this.updateStatus('👁️ point names shown');
            } else {
                btn.classList.remove('active');
                this.updateStatus('👁️ point names hidden');
            }
        }        
        this.saveState();
    }

    updateStatus = (message) => {
        this.messagingHub.emit(Messages.STATUS_UPDATE, message);
    }

    updateNotesPanel = () => {
        this.ui.panels.getPanel('notes').updateNotes(this.points, this.angles);
    }

    // escapeHtml moved to domHelper.mjs and imported

    checkPointOnCircles = (point) => {
        // Check if the point is on any circle's border (within 5 pixels threshold)
        const threshold = 5;
        
        this.circles.forEach(circle => {
            // Skip if the point is already in the pointsOnLine array
            if (circle.pointsOnLine && circle.pointsOnLine.includes(point.id)) {
                return;
            }
            
            // Skip if the point is the center point
            if (circle.centerPoint === point.id) {
                return;
            }
            
            // Calculate distance from point to circle border
            const distanceFromCenter = Math.sqrt(
                Math.pow(point.x - circle.centerX, 2) + 
                Math.pow(point.y - circle.centerY, 2)
            );
            
            const distanceFromBorder = Math.abs(distanceFromCenter - circle.radius);
            
            // If point is on or very close to the circle border
            if (distanceFromBorder <= threshold) {
                if (!circle.pointsOnLine) {
                    circle.pointsOnLine = [];
                }
                circle.pointsOnLine.push(point.id);
            }
        });
    }

    addDefinition = (text) => {
        if (!text || !text.trim()) {
            this.updateStatus('❌ Definition cannot be empty');
            return;
        }

        const definition = {
            id: this.definitions.length,
            text: text.trim(),
            timestamp: new Date().toISOString()
        };

        this.definitions.push(definition);
        this.updateDefinitionsPanel();
        this.updateJsonPanel();
        this.saveState();
        this.updateStatus('✓ Definition added');
    }

    deleteDefinition = (id) => {
        const index = this.definitions.findIndex(d => d.id === id);
        if (index !== -1) {
            this.definitions.splice(index, 1);
            this.updateDefinitionsPanel();
            this.updateJsonPanel();
            this.saveState();
            this.updateStatus('✓ Definition deleted');
        }
    }

    editDefinition = (id, newText) => {
        if (!newText || !newText.trim()) {
            this.updateStatus('❌ Definition cannot be empty');
            return false;
        }

        const definition = this.definitions.find(d => d.id === id);
        if (definition) {
            definition.text = newText.trim();
            this.updateDefinitionsPanel();
            this.updateJsonPanel();
            this.saveState();
            this.updateStatus('✓ Definition updated');
            return true;
        }
        return false;
    }

    updateAngle = (data) => {
        const { angleData, name, label, value, radius } = data;
        let linkedUpdated = false;
        
        // Update name
        if (name !== undefined) {
            angleData.name = name;
        }
        
        // Update label (allow empty string to clear label)
        if (label !== undefined) {
            angleData.label = label;
            // Update text display when label changes
            if (angleData.textElement) {
                angleData.textElement.textContent = this.getAngleDisplayText(angleData);
            }
            
            // Propagate label to overlapping angles (angles that represent the same geometric angle)
            if (this.overlappingAngles && this.overlappingAngles.has(angleData.id)) {
                const overlappingSet = this.overlappingAngles.get(angleData.id);
                overlappingSet.forEach(overlapId => {
                    if (overlapId !== angleData.id) {
                        const overlapAngle = this.angles.find(a => a.id === overlapId);
                        if (overlapAngle) {
                            overlapAngle.label = label;
                            // Update text display for overlapping angle
                            if (overlapAngle.textElement) {
                                overlapAngle.textElement.textContent = this.getAngleDisplayText(overlapAngle);
                            }
                        }
                    }
                });
                linkedUpdated = true;
            }
        }
        
        // Update value
        if (value) {
            angleData.value = value;
            
            // Update text element if it exists (won't exist for hidden overlapping angles)
            if (angleData.textElement) {
                angleData.textElement.textContent = this.getAngleDisplayText(angleData);
            }
            
            // Redraw the arc in case it needs to change from arc to square corner (or vice versa)
            if (angleData.arcElement) {
                this.redrawAngleArc(angleData);
            }
            
            // Check if this angle has overlapping angles
            if (this.overlappingAngles && this.overlappingAngles.has(angleData.id)) {
                const overlappingSet = this.overlappingAngles.get(angleData.id);
                overlappingSet.forEach(overlapId => {
                    if (overlapId !== angleData.id) {
                        const overlapAngle = this.angles.find(a => a.id === overlapId);
                        if (overlapAngle) {
                            overlapAngle.value = value;
                            // Update text/arc only if they exist (for visible angles)
                            if (overlapAngle.textElement) {
                                overlapAngle.textElement.textContent = this.getAngleDisplayText(overlapAngle);
                            }
                            if (overlapAngle.arcElement) {
                                this.redrawAngleArc(overlapAngle);
                            }
                        }
                    }
                });
                linkedUpdated = true;
            }
            
            // Check if this angle has a linked angle (from bisection)
            if (this.linkedAngles && angleData.neighborPoints) {
                const neighborIds = [...angleData.neighborPoints].sort((a, b) => a.localeCompare(b));
                const angleKey = `${angleData.point}-${neighborIds[0]}-${neighborIds[1]}`;
                
                const linkedAngleKey = this.linkedAngles.get(angleKey);
                
                if (linkedAngleKey) {
                    const linkedAngle = this.angles.find(a => {
                        if (a.neighborPoints) {
                            const linkedNeighborIds = [...a.neighborPoints].sort((a, b) => a.localeCompare(b));
                            const key = `${a.point}-${linkedNeighborIds[0]}-${linkedNeighborIds[1]}`;
                            return key === linkedAngleKey;
                        }
                        return false;
                    });
                    
                    if (linkedAngle) {
                        linkedAngle.value = value;
                        if (linkedAngle.textElement) {
                            linkedAngle.textElement.textContent = this.getAngleDisplayText(linkedAngle);
                        }
                        // Also redraw the linked angle
                        if (linkedAngle.arcElement) {
                            this.redrawAngleArc(linkedAngle);
                        }
                        linkedUpdated = true;
                    }
                }
            }
        } else {
            angleData.value = null;
            if (angleData.textElement) {
                angleData.textElement.textContent = this.getAngleDisplayText(angleData);
            }
            // Redraw in case it was a 90-degree angle that should no longer be a square
            if (angleData.arcElement) {
                this.redrawAngleArc(angleData);
            }
            
            // Clear value for overlapping angles too
            if (this.overlappingAngles && this.overlappingAngles.has(angleData.id)) {
                const overlappingSet = this.overlappingAngles.get(angleData.id);
                overlappingSet.forEach(overlapId => {
                    if (overlapId !== angleData.id) {
                        const overlapAngle = this.angles.find(a => a.id === overlapId);
                        if (overlapAngle) {
                            overlapAngle.value = null;
                            if (overlapAngle.textElement) {
                                overlapAngle.textElement.textContent = this.getAngleDisplayText(overlapAngle);
                            }
                            if (overlapAngle.arcElement) {
                                this.redrawAngleArc(overlapAngle);
                            }
                        }
                    }
                });
            }
        }
        
        // Update radius if changed
        if (!isNaN(radius) && radius >= 10 && radius <= 100) {
            angleData.radius = radius;
            this.redrawAngleArc(angleData);
        }
        
        if (linkedUpdated) {
            this.updateStatus('Angle values updated (both bisected angles)');
        } else {
            this.updateStatus('Angle value updated');
        }
        
        this.checkSolvability();
        this.saveState();
    }

    updateDefinitionsPanel = () => {
        this.ui.panels.getPanel('definitions').updateDefinitions(this.definitions);
    }

    updateJsonPanel = () => {
        const jsonData = document.getElementById('jsonData');
        
        // Create serializable data (without DOM elements)
        const data = {
            points: this.points.map(point => ({
                id: point.id,
                x: point.x,
                y: point.y,
                notes: point.notes || ''
            })),
            edges: this.edges.map(edge => ({
                points: edge.points || [],
                notes: edge.notes || ''
            })),
            angles: this.angles.map(angle => ({
                name: angle.name || '',
                pointId: angle.point,
                sidepoints: angle.neighborPoints || [],
                value: angle.value,
                calculatedValue: angle.calculatedValue,
                label: angle.label || '',
                radius: angle.radius || 30,
                notes: angle.notes || ''
            })),
            circles: this.circles.map(circle => ({
                name: circle.id,
                centerPoint: circle.centerPoint,
                centerX: circle.centerX,
                centerY: circle.centerY,
                radius: circle.radius,
                pointsOnLine: circle.pointsOnLine || []
            })),
            triangles: this.triangles.map(triangle => Array.from(triangle).sort()),
            lines: this.lines,
            definitions: this.definitions,
        };
        
        jsonData.textContent = JSON.stringify(data, null, 2);
    }
    
    saveToClipboard = () => {
        // Serialize geometry data to JSON format
        const data = serializeGeometryData({
            points: this.points,
            edges: this.edges,
            circles: this.circles,
            angles: this.angles,
            lines: this.lines,
            triangles: this.triangles,
            definitions: this.definitions
        });
        
        const jsonString = JSON.stringify(data, null, 2);
        
        // Copy to clipboard
        navigator.clipboard.writeText(jsonString).then(() => {
            this.updateStatus('✅ Saved to clipboard!');
            setTimeout(() => {
                this.updateStatus('Data copied to clipboard');
            }, 2000);
        }).catch(err => {
            console.error('Failed to copy to clipboard:', err);
            this.updateStatus('❌ Failed to copy to clipboard');
            // Fallback: show the JSON in an alert
            alert('Copy this JSON:\n\n' + jsonString);
        });
    }
    
    loadData = (rawData) => {
        // Deserialize and normalize the data
        const data = deserializeGeometryData(rawData);
        
        // Validate the data
        const validation = validateGeometryData(data);
        if (!validation.isValid) {
            console.error('Data validation failed:', validation.errors);
            this.updateStatus('❌ Invalid data format');
            return;
        }
        
        // Clear current state
        this.ui.canvas.svg.innerHTML = '<defs><marker id="arrowhead" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto"><polygon points="0 0, 10 3, 0 6" fill="#666" /></marker></defs>';
        this.points = [];
        this.circles = [];
        this.edges = [];
        this.angles = [];
        this.lines = [];
        this.selectedPoints = [];
        this.bisectedAngles.clear();
        this.linkedAngles.clear();
        this.overlappingAngles.clear();
   
        // Restore points
        if (data.points) {
            data.points.forEach(pointData => {
                const point = {
                    id: pointData.id,
                    x: pointData.x,
                    y: pointData.y,
                    notes: pointData.notes || ''
                };
                this.addPoint(point);
                this.drawPoint(point);
            });
        }
        
        // Restore edges
        this.adjacentPoints.clear(); // Clear adjacency map before rebuilding
        if (data.edges) {
            data.edges.forEach(edgeData => {
                const pointIds = edgeData.points;
                const point1 = this.pointsMap.get(pointIds[0]);
                const point2 = this.pointsMap.get(pointIds[1]);
                
                if (point1 && point2) {
                    const line = createElement('line', {
                        class: 'line',
                        x1: point1.x,
                        y1: point1.y,
                        x2: point2.x,
                        y2: point2.y
                    });
                    this.ui.canvas.svg.insertBefore(line, this.ui.canvas.svg.firstChild);
                    
                    this.edges.push({
                        points: [pointIds[0], pointIds[1]],
                        element: line,
                        notes: edgeData.notes || ''
                    });
                    
                    // Rebuild adjacentPoints map
                    this.addAdjacentPoint(pointIds[0], pointIds[1]);
                    this.addAdjacentPoint(pointIds[1], pointIds[0]);
                }
            });
        }
        
        console.log('✅ Built adjacency map with', this.adjacentPoints.size, 'points');
        
        // Restore circles
        if (data.circles) {
            data.circles.forEach(circleData => {
                const centerPointId = circleData.centerPoint;
                const pointsOnLine = circleData.pointsOnLine || [];
                const centerPoint = this.pointsMap.get(centerPointId);
                
                // Validate that all points on line exist
                const validPointsOnLine = pointsOnLine.filter(id => this.pointsMap.get(id));
                
                if (centerPoint) {
                    // Draw circle
                    const circle = createElement('circle', {
                        class: 'circle-shape',
                        cx: circleData.centerX,
                        cy: circleData.centerY,
                        r: circleData.radius
                    });
                    this.ui.canvas.svg.appendChild(circle);
                    
                    this.circles.push({
                        name: circleData.id || `Circle_${centerPoint.id}`,
                        centerPoint: centerPointId,
                        centerX: circleData.centerX,
                        centerY: circleData.centerY,
                        radius: circleData.radius,
                        pointsOnLine: validPointsOnLine
                    });
                }
            });
        }
        
        // Restore angles - manually recreate only the angles that existed in the saved data
        this.angles = [];
        if (data.angles) {
            data.angles.forEach(angleData => {
                const vertexId = angleData.pointId;
                const vertex = this.pointsMap.get(vertexId);
                const point1 = this.pointsMap.get(angleData.sidepoints[0]);
                const point2 = this.pointsMap.get(angleData.sidepoints[1]);
                
                if (vertex && point1 && point2) {
                    // Recreate the angle
                    this.createAngle(vertex, point1, point2);
                    
                    // Find the newly created angle and restore its value
                    const angle = this.angles.find(a => {
                        if (a.point !== vertexId) return false;
                        if (!a.neighborPoints || a.neighborPoints.length !== 2) return false;
                        const point1Id = point1.id;
                        const point2Id = point2.id;
                        return (a.neighborPoints[0] === point1Id && a.neighborPoints[1] === point2Id) ||
                               (a.neighborPoints[0] === point2Id && a.neighborPoints[1] === point1Id);
                    });
                    
                if (angle) {
                    if (angleData.value) {
                        angle.value = angleData.value;
                    }
                    if (angleData.id) {
                        angle.id = angleData.id;
                    }
                    if (angleData.label !== undefined) {
                        angle.label = angleData.label;
                    }
                    // Update text display after all properties are set
                    angle.textElement.textContent = this.getAngleDisplayText(angle);
                        if (angleData.radius) {
                            angle.radius = angleData.radius;
                            // Note: Arc is already drawn with correct radius during angle creation
                        }
                        if (angleData.notes) {
                            angle.notes = angleData.notes;
                        }
                    }
                }
            });
        }

        // Restore lines
        if (data.lines) {
            this.lines = JSON.parse(JSON.stringify(data.lines));
        }
        
        // Restore or rebuild triangles
        if (data.triangles && Array.isArray(data.triangles)) {
            // Load triangles from saved data
            this.triangles = data.triangles.map(triangleArray => new Set(triangleArray));
            console.log('✅ Loaded triangles from saved data:', this.triangles.length);
        } else {
            // No triangles in saved data, rebuild them
            console.log('⚠️ No triangles in saved data, rebuilding...');
            this.triangles = [];
            this.updateTriangles();
            console.log('✅ Built triangles:', this.triangles.length);
        }
        
        // Auto-create any missing angles at vertices with multiple edges
        console.log('🔍 Checking for missing angles...');
        let anglesCreated = 0;
        this.points.forEach(point => {
            const neighbors = this.findNeighbors(point);
            if (neighbors.length >= 2) {
                // Check all pairs of neighbors
                for (let i = 0; i < neighbors.length; i++) {
                    for (let j = i + 1; j < neighbors.length; j++) {
                        const neighbor1 = neighbors[i];
                        const neighbor2 = neighbors[j];
                        
                        // Check if angle already exists
                        const angleExists = this.angles.some(a => 
                            a.point === point.id &&
                            a.neighborPoints &&
                            ((a.neighborPoints[0] === neighbor1.id && a.neighborPoints[1] === neighbor2.id) ||
                             (a.neighborPoints[0] === neighbor2.id && a.neighborPoints[1] === neighbor1.id))
                        );
                        
                        if (!angleExists) {
                            // Check if collinear (would be 180°, skip)
                            const areCollinear = arePointsCollinear(point.id, neighbor1.id, neighbor2.id, this.lines);
                            if (!areCollinear) {
                                this.createAngle(point, neighbor1, neighbor2);
                                anglesCreated++;
                            }
                        }
                    }
                }
            }
        });
        console.log(`✅ Created ${anglesCreated} missing angles`);

        // Rebuild overlappingAngles map
        console.log('🔍 Rebuilding overlapping angles map...');
        
        // Build overlapping angles map using the utility function
        // Filter out hidden angles before processing
        const visibleAngles = this.angles.filter(angle => !angle.isHidden);
        this.overlappingAngles = buildOverlappingAnglesMap(visibleAngles, this.lines, this.pointsMap);
        
        console.log(`✅ Rebuilt overlapping angles map with ${this.overlappingAngles.size} angle references`);

        // Restore definitions
        this.definitions = [];
        if (data.definitions) {
            this.definitions = data.definitions.map(defData => ({
                id: defData.id,
                text: defData.text,
                timestamp: defData.timestamp
            }));
        }
        
        
        // Reset history and save the loaded state
        this.history = [];
        this.historyIndex = -1;
        this.saveState();
        
        // Update panels
        this.updateDefinitionsPanel();
        this.updateNotesPanel();
        this.updateJsonPanel();
    }

    editEdge = (edgeObj) => {
        // Attach point objects to edgeObj for Canvas use
        const point1 = this.pointsMap.get(edgeObj.points[0]);
        const point2 = this.pointsMap.get(edgeObj.points[1]);
        edgeObj.point1 = point1;
        edgeObj.point2 = point2;
        this.messagingHub.emit(Messages.EDGE_EDIT_REQUESTED, edgeObj);
    }
    
    handlePointCreateRequest = (data) => {
        const { fromPoint, distance, angle, newX, newY } = data;
        
        // Create the new point
        const pointName = getNewPointName(this.points.length);
        const newPoint = {
            id: pointName,
            x: newX,
            y: newY
        };
        this.addPoint(newPoint);
        this.drawPoint(newPoint);
        
        // Create edge between points
        const line = createElement('line', {
            class: 'line',
            x1: fromPoint.x,
            y1: fromPoint.y,
            x2: newPoint.x,
            y2: newPoint.y
        });
        this.svg.insertBefore(line, this.svg.firstChild);
        
        this.edges.push({
            points: [fromPoint.id, newPoint.id],
            element: line
        });
        
        // Update adjacency map for the new edge
        this.addAdjacentPoint(fromPoint.id, newPoint.id);
        this.addAdjacentPoint(newPoint.id, fromPoint.id);
        
        // Check if the new point should be added to an existing line (collinear points)
        // Find if fromPoint is in any existing line
        const existingLine = this.lines.find(line => line.includes(fromPoint.id));
        
        if (existingLine) {
            // Check if newPoint already exists in the line
            if (!existingLine.includes(newPoint.id)) {
                // Determine where to insert the new point based on direction
                const fromPointIndex = existingLine.indexOf(fromPoint.id);
                
                // Calculate direction from fromPoint to newPoint
                const newDx = newPoint.x - fromPoint.x;
                const newDy = newPoint.y - fromPoint.y;
                
                // Check if fromPoint is at the start or end of the line
                if (fromPointIndex === 0) {
                    // fromPoint is at the start - check direction to next point
                    const nextPointId = existingLine[1];
                    const nextPoint = this.pointsMap.get(nextPointId);
                    const nextDx = nextPoint.x - fromPoint.x;
                    const nextDy = nextPoint.y - fromPoint.y;
                    
                    // Calculate dot product to check if same direction
                    const dotProduct = dotProduct2D(newDx, newDy, nextDx, nextDy);
                    
                    if (dotProduct < 0) {
                        // Opposite direction - insert newPoint BEFORE fromPoint
                        existingLine.unshift(newPoint.id);
                        console.log(`Inserted ${newPoint.id} at START (before ${fromPoint.id})`);
                    } else {
                        // Same direction - add after fromPoint and sort
                        existingLine.push(newPoint.id);
                        existingLine.sort((a, b) => {
                            const aPoint = this.pointsMap.get(a);
                            const bPoint = this.pointsMap.get(b);
                            // Sort by x-coordinate (or y if vertical)
                            if (Math.abs(aPoint.x - bPoint.x) > 1) {
                                return aPoint.x - bPoint.x;
                            }
                            return aPoint.y - bPoint.y;
                        });
                        console.log(`Added ${newPoint.id} and sorted by position`);
                    }
                } else if (fromPointIndex === existingLine.length - 1) {
                    // fromPoint is at the end - check direction to previous point
                    const prevPointId = existingLine[fromPointIndex - 1];
                    const prevPoint = this.pointsMap.get(prevPointId);
                    const prevDx = prevPoint.x - fromPoint.x;
                    const prevDy = prevPoint.y - fromPoint.y;
                    
                    // Calculate dot product to check if same direction
                    const dotProduct = dotProduct2D(newDx, newDy, prevDx, prevDy);
                    
                    if (dotProduct < 0) {
                        // Opposite direction - add newPoint AFTER fromPoint
                        existingLine.push(newPoint.id);
                        console.log(`Added ${newPoint.id} at END (after ${fromPoint.id})`);
                    } else {
                        // Same direction as previous - add and sort
                        existingLine.push(newPoint.id);
                        existingLine.sort((a, b) => {
                            const aPoint = this.pointsMap.get(a);
                            const bPoint = this.pointsMap.get(b);
                            // Sort by x-coordinate (or y if vertical)
                            if (Math.abs(aPoint.x - bPoint.x) > 1) {
                                return aPoint.x - bPoint.x;
                            }
                            return aPoint.y - bPoint.y;
                        });
                        console.log(`Added ${newPoint.id} and sorted by position`);
                    }
                } else {
                    // fromPoint is in the middle - just add and sort
                    existingLine.push(newPoint.id);
                    existingLine.sort((a, b) => {
                        const aPoint = this.pointsMap.get(a);
                        const bPoint = this.pointsMap.get(b);
                        // Sort by x-coordinate (or y if vertical)
                        if (Math.abs(aPoint.x - bPoint.x) > 1) {
                            return aPoint.x - bPoint.x;
                        }
                        return aPoint.y - bPoint.y;
                    });
                    console.log(`Added ${newPoint.id} (middle) and sorted by position`);
                }
            }
        } else {
            // Check if fromPoint has other neighbors that might form a line
            const neighbors = this.findNeighbors(fromPoint);
            if (neighbors.length >= 2) {
                // Check if any neighbor forms a straight line with fromPoint and newPoint
                for (const neighbor of neighbors) {
                    if (neighbor.id === newPoint.id) continue;
                    
                    // Check if these 3 points are collinear
                    if (arePointsCollinearByPosition(fromPoint, neighbor, newPoint, 1)) {
                        // Create new line with these three collinear points
                        this.lines.push([neighbor.id, fromPoint.id, newPoint.id]);
                        break;
                    }
                }
            }
        }
        
        // Check if the new point is on any circles
        const threshold = 5;
        this.circles.forEach(circle => {
            // Skip if the point is already tracked on this circle
            if (circle.pointsOnLine && circle.pointsOnLine.includes(newPoint.id)) {
                return;
            }
            
            // Skip if the point is the center point
            if (circle.centerPoint === newPoint.id) {
                return;
            }
            
            // Calculate distance from point to circle border
            const distanceFromCenter = Math.sqrt(
                Math.pow(newPoint.x - circle.centerX, 2) + 
                Math.pow(newPoint.y - circle.centerY, 2)
            );
            
            const distanceFromBorder = Math.abs(distanceFromCenter - circle.radius);
            
            // If point is on or very close to the circle border
            if (distanceFromBorder <= threshold) {
                if (!circle.pointsOnLine) {
                    circle.pointsOnLine = [];
                }
                circle.pointsOnLine.push(newPoint.id);
            }
        });
        
        // Auto-create angles at both endpoints
        this.autoCreateAnglesForEdge([fromPoint.id, newPoint.id]);
        
        this.updateStatus(`✓ Point ${newPoint.id} created at ${distance}px, ${angle}° from ${fromPoint.id}`);
        this.saveState();
    }
    
    deleteAngle = (angleData) => {
        if (angleData.arcElement) {
            angleData.arcElement.remove();
        }
        if (angleData.textElement) {
            angleData.textElement.remove();
        }
        
        const angleIndex = this.angles.indexOf(angleData);
        if (angleIndex > -1) {
            this.angles.splice(angleIndex, 1);
        }
        
        this.updateStatus('Angle deleted');
        this.saveState();
    }
    
    updateEdge = (data) => {
        const { edgeObj, notes } = data;
        edgeObj.notes = notes;
        this.updateStatus('Edge notes saved');
        this.saveState();
    }
    
    deleteEdge = (edgeObj) => {
        if (edgeObj.element) {
            edgeObj.element.remove();
        }
        
        const edgeIndex = this.edges.indexOf(edgeObj);
        if (edgeIndex > -1) {
            this.edges.splice(edgeIndex, 1);
        }
        
        this.updateStatus('Edge deleted');
        this.saveState();
    }
}

// Initialize the tool
document.addEventListener('DOMContentLoaded', () => {
    new GeometryTool();
});
