// History management for undo/redo functionality
import { deepClone } from './utils/objectHelper.mjs';

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
            points: this.tool.points.map(p => {
                const point = { id: p.id, x: p.x, y: p.y };
                if (p.hide) point.hide = true;
                return point;
            }),
            edges: this.tool.edges.map(e => {
                const edge = { points: [...e.points] };
                if (e.hide) edge.hide = true;
                return edge;
            }),
            circles: this.tool.circles.map(c => {
                const circle = {
                    name: c.name,
                    centerPoint: c.centerPoint,
                    centerX: c.centerX,
                    centerY: c.centerY,
                    radius: c.radius,
                    pointsOnLine: c.pointsOnLine ? [...c.pointsOnLine] : []
                };
                if (c.hide) circle.hide = true;
                return circle;
            }),
            angles: this.tool.angles.map(a => {
                const angle = {
                    pointId: a.pointId,
                    sidepoints: a.sidepoints || [],
                    value: a.value,
                    calculatedValue: a.calculatedValue,
                    name: a.name || '',
                    label: a.label || '',
                    id: a.id,
                    radius: a.radius || 30
                };
                if (a.hide) angle.hide = true;
                return angle;
            }),
            bisectedAngles: Array.from(this.tool.bisectedAngles),
            linkedAngles: Array.from(this.tool.linkedAngles.entries()),
            lines: deepClone(this.tool.lines),
            definitions: deepClone(this.tool.definitions),
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
    }

    undo = () => {
        if (this.historyIndex > 0) {
            this.historyIndex--;
            const state = this.history[this.historyIndex];
            this.restoreState(state);
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
        // Delegate the actual state restoration to Creator
        this.tool.restoreState(state);
        
        // Update history-related UI
        this.updateUndoRedoButtons();
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
