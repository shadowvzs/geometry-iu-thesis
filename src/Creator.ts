// Geometry Drawing Tool - Creator Mode
import { Messages } from './MessagingHub';
import { DefinitionsPanel } from './UI/panels/DefinitionsPanel';
import { JsonPanel } from './UI/panels/JsonPanel';
import { DebugPanel } from './UI/panels/DebugPanel';
import { solve, SolveResult } from './utils/solve';
import { 
    getAngleMapsByPointId,
    isPointsOnSameLine,
    isUnsolvedAngle,
    sortLinePoints,
} from './utils/mathHelper';
import {
    serializeGeometryData,
    serializeStateForUrl,
} from './utils/dataSerializer';
import { deepClone } from './utils/objectHelper';
import { debugLogger } from './DebugLogger';

import type {
    Point,
    Edge,
    Circle,
    Angle,
    Line,
    Definition,
    HistoryState,
    ToolName,
    SerializedGeometryData,
    SolverHistoryItem,
    PointCreateRequestData,
    CanvasClickData,
    PointClickData,
    AngleClickData,
    PointDraggingData,
    UpdateAngleData
} from './types';
import { GeometryTool } from './GeometryTool';
import { testdata } from './testdata';
import { extractEquationsWithWolfram } from './rules/extractEquations';

export class Creator extends GeometryTool {
    constructor() {
        super();
        this.initialize();
    }

    initialize = () => {
        super.initialize();

        // Initialize debug logger
        debugLogger.init();

        // Update panels
        this.addDefinitionPanel();

        // Save initial empty state
        this.saveState();

        // for testing purpose
        if (location.href.includes('localhost')) {
            this.loadData(testdata as unknown as SerializedGeometryData);
        }
    }

    registerToolbarButtons = () => {
        // Initialize toolbar buttons - use messaging hub
        const { registerButton, registerFeedback } = this.ui.toolbar;
        registerFeedback();
        registerButton('pointer', () => this.messagingHub.emit(Messages.TOOL_SELECTED, 'pointer'));
        registerButton('drawPoint', () => this.messagingHub.emit(Messages.TOOL_SELECTED, 'addPoint'));
        registerButton('drawCircle', () => this.messagingHub.emit(Messages.TOOL_SELECTED, 'drawCircle'));
        registerButton('drawEdge', () => this.messagingHub.emit(Messages.TOOL_SELECTED, 'drawEdge'));
        registerButton('assignAngle', () => this.messagingHub.emit(Messages.TOOL_SELECTED, 'assignAngle'));
        registerButton('angleBisector', () => this.messagingHub.emit(Messages.TOOL_SELECTED, 'angleBisector'));
        registerButton('toggleNames', () => this.messagingHub.emit(Messages.TOGGLE_NAMES));
        registerButton('extractEquations', () => this.extractEquations());
        registerButton('solveAngles', () => this.solveAngles());
        registerButton('hideElement', () => this.messagingHub.emit(Messages.TOOL_SELECTED, 'hideElement'));
        registerButton('save', () => this.messagingHub.emit(Messages.SAVE_REQUESTED));
        registerButton('load', () => this.messagingHub.emit(Messages.LOAD_REQUESTED));
        registerButton('undo', () => this.messagingHub.emit(Messages.UNDO_REQUESTED));
        registerButton('redo', () => this.messagingHub.emit(Messages.REDO_REQUESTED));
        registerButton('clear', () => this.messagingHub.emit(Messages.CLEAR_REQUESTED));
        registerButton('toSolvedMode', () => this.solveInNewTab());
    }

    registerPanels = () => {
        // Update panels
        const { registerPanel } = this.ui.panels;
        registerPanel('definitions', DefinitionsPanel);
        registerPanel('json', JsonPanel);
        registerPanel('debug', DebugPanel);
    }

    setupMessageSubscriptions = () => {
        // Toolbar events
        this.messagingHub.subscribe(Messages.TOOL_SELECTED, (tool: ToolName) => this.setTool(tool));
        this.messagingHub.subscribe(Messages.TOGGLE_NAMES, () => this.togglePointNames());
        this.messagingHub.subscribe(Messages.SAVE_REQUESTED, () => this.saveToClipboard());
        this.messagingHub.subscribe(Messages.LOAD_REQUESTED, () => {
            // UI will handle showing the dialog
        });
        this.messagingHub.subscribe(Messages.UNDO_REQUESTED, () => this.undo());
        this.messagingHub.subscribe(Messages.REDO_REQUESTED, () => this.redo());
        this.messagingHub.subscribe(Messages.CLEAR_REQUESTED, () => this.clear());

        // Canvas events
        this.messagingHub.subscribe(Messages.CANVAS_CLICKED, (data: CanvasClickData) => this.handleCanvasClick(data.event));
        this.messagingHub.subscribe(Messages.POINT_CLICKED, (data: PointClickData) => this.handlePointClick(data.point));
        this.messagingHub.subscribe(Messages.ANGLE_CLICKED, (data: AngleClickData) => this.handleAngleClick(data.angleData));

        // Point events
        this.messagingHub.subscribe(Messages.POINT_CREATE_REQUESTED, (data: PointCreateRequestData) => this.handlePointCreateRequest(data));
        
        // Point dragging - update connected edges and angles in real-time
        this.messagingHub.subscribe(Messages.POINT_DRAGGING, this.handlePointDragging);
        
        // Point moved - check if point is on edge or circle (after drag completes)
        this.messagingHub.subscribe(Messages.POINT_MOVED, this.handlePointMoved);

        // Definition events
        this.messagingHub.subscribe(Messages.DEFINITION_ADDED, (text: string) => this.addDefinition(text));
        this.messagingHub.subscribe(Messages.DEFINITION_EDITED, (data: Definition) => this.editDefinition(data.id, data.text));
        this.messagingHub.subscribe(Messages.DEFINITION_DELETED, (id: string) => this.deleteDefinition(id));
        
        // Angle events
        this.messagingHub.subscribe(Messages.ANGLE_UPDATED, (data: UpdateAngleData) => this.updateAngle(data));
        this.messagingHub.subscribe(Messages.ANGLE_BISECTOR_REQUESTED, (angleData: Angle) => this.createAngleBisector(angleData));
        this.messagingHub.subscribe(Messages.ANGLE_DELETE_REQUESTED, (angleData: Angle) => this.deleteAngle(angleData));


        // Data loading
        this.messagingHub.subscribe(Messages.DATA_LOAD_REQUESTED, (data: SerializedGeometryData) => {
            this.loadData(data);
            this.updateStatus('✅ Data loaded successfully!');
        });
        
        // Status updates (from UI components)
        this.messagingHub.subscribe(Messages.STATUS_UPDATED, (message: string) => this.updateStatus(message));
        
        // Angle solver events
        this.messagingHub.subscribe(Messages.ANGLE_SOLVE_COMPLETED, this.handleAngleSolveCompleted);
        
        this.messagingHub.subscribe(Messages.ANGLE_VALUE_CALCULATED, this.handleAngleValueCalculated);
    }

    // --- start inherited methods ---
    // I added because to have a better picture which method is called in this class

    handleAngleValueCalculated = (angle: Angle) => {
        return super.handleAngleValueCalculated(angle);
    }

    handlePointDragging = (data: PointDraggingData) => {
        return super.handlePointDragging(data);
    }

    handlePointMoved = (data: PointDraggingData) => {
        return super.handlePointMoved(data);
    }

    addLine = (points: string[] | Line) => {
        return super.addLine(points);
    }
    
    addEdge = (edge: Edge) => {
        return super.addEdge(edge);
    }

    createCircle = (circle: Circle) => {
        return super.createCircle(circle);
    }

    createEdge = (point1Id: string, point2Id: string, hide = false) =>{
        return super.createEdge(point1Id, point2Id, hide);
    }

    createPoint = (x: number, y: number) => {
        return super.createPoint(x, y);
    }

    addPoint = (point: Point) => {
        return super.addPoint(point);
    }

    drawPoint = (point: Point) => {
        return super.drawPoint(point);
    }

    checkPointIntersections = (point: Point, config: { fixPointPosition?: boolean } = {}) => {
        return super.checkPointIntersections(point, config);
    }

    fixPointPositionOnEdges = (point: Point, intersectedEdges: Edge[]) => {
        return super.fixPointPositionOnEdges(point, intersectedEdges);
    }

    mouseMoveOnSvg = (ev: MouseEvent) => {
        return super.mouseMoveOnSvg(ev);
    }

    setTool = (tool: ToolName) => {
        return super.setTool(tool);
    }

    handleCanvasClick = (e: MouseEvent) => {
        return super.handleCanvasClick(e);
    }

    getSVGPoint = (ev: MouseEvent) => {
        return super.getSVGPoint(ev);
    }

    findClosestPointAndEdges = (clickX: number, clickY: number) => {
        return super.findClosestPointAndEdges(clickX, clickY);
    }

    checkPointOnLines = (point: Point) => {
        return super.checkPointOnLines(point);
    }

    updatePointSelection = () => {
        return super.updatePointSelection();
    }

    drawCircleFromPoints = () => {
        return super.drawCircleFromPoints();
    }

    drawEdge = (point1: Point, point2: Point) => {
        return super.drawEdge(point1, point2);
    }

    createAnglesForNewEdge = (pointId1: string, pointId2: string) => {
        return super.createAnglesForNewEdge(pointId1, pointId2);
    }

    splitEdgeWithPoint = (edge: Edge, newPoint: Point) => {
        return super.splitEdgeWithPoint(edge, newPoint);
    }

    addAdjacentPoint = (pointId: string, adjacentPointId: string) => {
        return super.addAdjacentPoint(pointId, adjacentPointId);
    }

    updateTriangles = () => {
        return super.updateTriangles();
    }

    handlePointClick = (point: Point) => {
        return super.handlePointClick(point);
    }

    recreateAllAngles = () => {
        return super.recreateAllAngles();
    }

    createAngle = (vertex: Point, point1: Point, point2: Point) => {
        return super.createAngle(vertex, point1, point2);
    }
    
    createAngleText = (angleData: Angle, textElement: SVGTextElement | null = null, initialX: number | null = null, initialY: number | null = null) => {
        return super.createAngleText(angleData, textElement, initialX, initialY);
    }

    renderAngleArc = (angleData: Angle) => {
        return super.renderAngleArc(angleData);
    }

    handleAngleClick = (angleData: Angle) => {
        return super.handleAngleClick(angleData);
    }

    redrawAngleArc = (angleData: Angle) => {
        return super.redrawAngleArc(angleData);
    }

    autoCreateAnglesForEdge = (edgePointIds: string[]) => {
        return super.autoCreateAnglesForEdge(edgePointIds);
    }

    createAngleBisector = (angleData: Angle) => {
        return super.createAngleBisector(angleData);
    }

    saveState = () => {
        super.saveState();
        this.checkSolvability();
        this.updateJsonPanel();
    }

    undo = () => {
        return super.undo();
    }

    redo = () => {
        return super.redo();
    }

    restoreState = (state: HistoryState) => {
        super.restoreState(state);
        this.checkSolvability();
        this.updateJsonPanel();
    }

    updateUndoRedoButtons = () => {
        return super.updateUndoRedoButtons();
    }

    updateStatus = (message: string) => {
        return super.updateStatus(message);
    }

    updateAngle = (data: UpdateAngleData) => {
        return super.updateAngle(data);
    }

    loadData = (rawData: SerializedGeometryData) => {
        super.loadData(rawData);
        this.updateDefinitionsPanel();
    }

    handlePointCreateRequest = (data: PointCreateRequestData) => {
        return super.handlePointCreateRequest(data);
    }

    // --- end inherited methods ---

    handleAngleSolveCompleted = (data: SolveResult) => {
        const timeStr = data.executionTime ? ` in ${data.executionTime.toFixed(2)}ms` : '';
        console.info('Creator.handleAngleSolveCompleted', timeStr, data);
        this.updateStatus(`✓ Angle solving complete (${data.iterations} iterations, ${data.score} scores)`);
        this.saveState();
    };

    addDefinitionPanel = () => {
        // Add definition button - use messaging hub
        const addDefinitionBtn = document.getElementById('addDefinitionBtn');
        if (!addDefinitionBtn) {
            throw new Error('addDefinitionBtn not found');
        }
        addDefinitionBtn.addEventListener('click', () => {
            const input = document.getElementById('definitionInput') as HTMLInputElement;
            if (!input) {
                throw new Error('input not found');
            }
            const text = input.value.trim();
            const addLineRegex = /\[\s*([A-Z](?:\s*,\s*[A-Z])*)\s*\]\s*\+\s*([A-Z])/;
            const removeLineRegex = /\[\s*([A-Z](?:\s*,\s*[A-Z])*)\s*\]\s*-\s*([A-Z])/;
            const addLine = text.match(addLineRegex);
            const removeLine = text.match(removeLineRegex);
            if (addLine) {
                const [, pointListStr, newPointId] = addLine;
                const [point1, point2] = pointListStr.split(',').map(s => s.trim());
                const line = this.lines.find(line => isPointsOnSameLine(line, point1, point2));
                if (!line) {
                    const edge = this.edges.find(e => e.points.includes(point1) && e.points.includes(point2));
                    if (edge) {
                        const newLinePoints = sortLinePoints([...edge.points, newPointId], this.pointsMap);
                        this.addLine(newLinePoints);
                        this.saveState();
                        alert(`A new line was created and point added [${newLinePoints.join(', ')}]`);
                        return;
                    }
                    // const linePoints = line.map(id => this.pointsMap.get(id)).filter(p => p);
                    return alert(`No exist line with ${point1} and ${point2}`);
                }
                if (!this.pointsMap.get(newPointId)) { return alert(`No exist point with ID ${newPointId}`); }
                if (line.points.includes(newPointId)) { return alert(`Point ${newPointId} is already on the line`); }
                line.points.push(newPointId);
                alert('Point added to line');
            } else if (removeLine) {
                const [, pointListStr, newPointId] = removeLine;
                const [point1, point2] = pointListStr.split(',').map(s => s.trim());
                const line = this.lines.find(line => isPointsOnSameLine(line, point1, point2));
                if (!line) { return alert('No exist line with those points'); }
                line.points.splice(line.points.indexOf(newPointId), 1);
                this.saveState();
                alert('Point removed from line');
            }
        });

        // Add definition on Enter key - use messaging hub
        const definitionInput = document.getElementById('definitionInput') as HTMLInputElement;
        if (!definitionInput) {
            throw new Error('definitionInput not found');
        }
        definitionInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                const target = e.target as HTMLInputElement;
                const text = target.value.trim();
                if (text) {
                    this.messagingHub.emit(Messages.DEFINITION_ADDED, text);
                    target.value = '';
                }
            }
        });

        // Event delegation for edit and delete buttons - use messaging hub
        const definitionsList = document.getElementById('definitionsList');
        if (!definitionsList) {
            throw new Error('definitionsList not found');
        }
        definitionsList.addEventListener('click', (e) => {
            const target = e.target as HTMLElement;
            const editBtn = target.closest<HTMLElement>('.definition-edit-btn');
            const deleteBtn = target.closest<HTMLElement>('.definition-delete-btn');
            
            if (editBtn) {
                if (!editBtn.dataset.id) {
                    throw new Error('editBtn.dataset.id not found');
                }
                const id = parseInt(editBtn.dataset.id);
                const item = editBtn.closest<HTMLElement>('.definition-item');
                if (!item) { throw new Error('item not found'); }
                const input = item.querySelector<HTMLInputElement>('.definition-edit-input');
                if (!input) { throw new Error('input not found'); }
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
                if (!deleteBtn.dataset.id) {
                    throw new Error('deleteBtn.dataset.id not found');
                }
                const id = parseInt(deleteBtn.dataset.id);
                if (confirm('Are you sure you want to delete this definition?')) {
                    this.messagingHub.emit(Messages.DEFINITION_DELETED, id);
                }
            }
        });

        // Handle Enter key in edit input - use messaging hub
        const definitionsListElement = document.getElementById('definitionsList');
        if (!definitionsListElement) {
            throw new Error('definitionsListElement not found');
        }
        definitionsListElement.addEventListener('keydown', (e) => {
            const target = e.target as HTMLInputElement;
            if (e.key === 'Enter' && target.classList.contains('definition-edit-input')) {
                e.preventDefault();
                if (!target.dataset.id) {
                    throw new Error('target.dataset.id not found');
                }
                const id = parseInt(target.dataset.id);
                const item = target.closest<HTMLElement>('.definition-item');
                const newText = target.value.trim();
                this.messagingHub.emit(Messages.DEFINITION_EDITED, { id, text: newText });
                item!.classList.remove('editing');
            } else if (e.key === 'Escape' && target.classList.contains('definition-edit-input')) {
                const item = target.closest<HTMLElement>('.definition-item');
                item!.classList.remove('editing');
            }
        });

        this.updateDefinitionsPanel();
    }

    updateDefinitionsPanel = () => {
        const definitionsPanel = this.ui.panels.getPanel<DefinitionsPanel>('definitions');
        if (!definitionsPanel) {
            throw new Error('definitionsPanel not found');
        }
        definitionsPanel.updateDefinitions(this.definitions);
    }

    solveInNewTab = () => {
        const targetAngle = this.angles.find(angle => angle.target);
        if (!targetAngle) {
            alert('No target angle found.');
            return;
        }
        const encodedData = serializeStateForUrl({
            points: this.points,
            edges: this.edges,
            circles: this.circles,
            angles: this.angles,
            definitions: this.definitions,
            lines: this.lines,
        });
        const url = `${window.location.origin}${window.location.pathname}?mode=solver&problem=${encodedData}`;
        window.open(url, '_blank');
    }

    extractEquations = () => {
        const angleMapsByPointId = getAngleMapsByPointId(this.angles);
        if (this.angles.length === 0) {
            return  alert('No angles to extract equations from.');
        }
        const data = deepClone({
            angles: this.angles,
            lines: this.lines,
            points: this.points,
            triangles: this.triangles.map(tri => Array.from(tri)),
            circles: this.circles,
            adjacentPoints: this.adjacentPoints,
            angleMapsByPointId,
        });
        
        const { simplified, wolframUrl, reverseMapping } = extractEquationsWithWolfram(data);
        
        // Log to console
        console.log('📊 Equations:', simplified.length);
        console.log(simplified.join('\n'));
        console.log('\n📝 Variable mapping:');
        reverseMapping.forEach((names, char) => {
            console.log(`  ${char} = ${names.join(' = ')}`);
        });
        console.log('\n🔗 Wolfram Alpha URL:', wolframUrl);
        
        // Open in new window
        window.open(wolframUrl, '_blank');
        
        this.updateStatus(`📊 Extracted ${simplified.length} equations → Wolfram Alpha`);
    }
    
    // Runs the angle solver to calculate unknown angle values using geometric theorems.
    // Uses triangle sum (180°), supplementary angles, and inscribed angle theorems.
    // Updates angle displays and logs results to console and debug panel.
    // Emits ANGLE_SOLVE_COMPLETED event when finished.
    solveAngles = () => {
        debugLogger.log('Creator.solveAngles', {
            totalAngles: this.angles.length,
            unknownAngles: this.angles.filter(a => isUnsolvedAngle(a)).length
        });
        
        try {
            const { angles } = this;

            debugLogger.log('Creator.solveAngles', { 
                totalAngles: angles.length,
                unknownAngles: angles.filter(a => isUnsolvedAngle(a)).length
            });

            const history: SolverHistoryItem[] = [];
            const setAngleCallback = (angle: Angle, message: string, method: string) => {
                history.push({ angle, message, method });
                this.handleAngleValueCalculated(angle);
            }

            const { allSolved, executionTime, iterations, solved } = solve({
                angles: this.angles,
                lines: this.lines,
                points: this.points,
                triangles: this.triangles,
                circles: this.circles,
                adjacentPoints: this.adjacentPoints
            }, {
                setAngle: setAngleCallback,
                maxIterations: 100
            });

            if (solved) {
                const tableData = history.map((data) => ({ 
                    angle: data.angle.name,
                    value: data.angle.value,
                    method: data.method,
                    message: data.message
                }));
                console.table(tableData);
            }
            
            // Log summary to debug panel
            debugLogger.log('Creator.solveAngles', { 
                iterations,
                angles: `${solved}/${angles.length}`,
                time: `${executionTime.toFixed(2)}ms`
            });
            
            console.info('angle:solveCompleted', {
                iterations,
                allSolved,
                solved,
                executionTimeMs: executionTime
            });
        } catch (error) {
            console.info('angle:solveFailed', { error });
        }
    }

    checkSolvability = () => {
        // Skip if no angles exist yet
        if (this.angles.length === 0) {
            return;
        }

        // Create deep copies of data to avoid the solver modifying originals
        const data = deepClone({
            angles: this.angles,
            lines: this.lines,
            points: this.points,
            triangles: this.triangles.map(tri => Array.from(tri)),
            circles: this.circles,
            adjacentPoints: this.adjacentPoints
        });
        const { executionTime, solved } = solve(data, {
            setAngle: () => { },
            maxIterations: 100
        });

        this.ui.toolbar.updateFeedback(solved ? '✔' : '✖');
        console.info(`Can be solved: ${solved} (${executionTime.toFixed(2)}ms)`);
    }

    clear = () => {
        if (confirm('Clear all elements?')) {
            this.ui.canvas.clearContent();
            this.points = [];
            this.circles = [];
            this.edges = [];
            this.angles = [];
            this.lines = [];
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
        this.svgGroup.point.querySelectorAll<HTMLElement>('.point-label').forEach((label: HTMLElement) => {
            label.style.display = this.showPointNames ? 'block' : 'none';
        });
        
        // Update button state
        const btn = this.ui.toolbar.getButton('toggleNames');
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

    addDefinition = (text: string) => {
        if (!text || !text.trim()) {
            this.updateStatus('❌ Definition cannot be empty');
            return;
        }

        const definition: Definition = {
            id: this.definitions.length.toString(),
            text: text.trim(),
            timestamp: Date.now()
        };

        this.definitions.push(definition);
        this.updateDefinitionsPanel();
        this.saveState();
        this.updateStatus('✓ Definition added');
    }

    deleteDefinition = (id: string) => {
        const index = this.definitions.findIndex(d => d.id === id);
        if (index !== -1) {
            this.definitions.splice(index, 1);
            this.updateDefinitionsPanel();
            this.saveState();
            this.updateStatus('✓ Definition deleted');
        }
    }

    editDefinition = (id: string, newText: string) => {
        if (!newText || !newText.trim()) {
            this.updateStatus('❌ Definition cannot be empty');
            return false;
        }

        const definition = this.definitions.find(d => d.id === id);
        if (definition) {
            definition.text = newText.trim();
            this.updateDefinitionsPanel();
            this.saveState();
            this.updateStatus('✓ Definition updated');
            return true;
        }
        return false;
    }

    updateJsonPanel = () => {
        const jsonData = document.getElementById('jsonData');
        if (!jsonData) {
            throw new Error('jsonData not found');
        }
        
        // Create serializable data (without DOM elements)
        const data = {
            points: this.points.map(point => {
                return `${point.id} (${point.x}, ${point.y})${point.hide ? ' - hide' : ''}`;
            }),
            edges: this.edges.map(edge => {
                return `${edge.points.join(',')}${edge.hide ? ' - hide' : ''}`;
            }),
            angles: this.angles.map(angle => {
                const a = {
                    name: `${angle.name}${angle.label ? ` - ${angle.label}` : ''}`,
                    pointId: `${angle.pointId}${angle.hide ? ' - hide' : ''}`,
                    sidepoints: `${angle.sidepoints.join(',')}`,
                    radius: angle.radius || 30
                };
                if (angle.value) {
                    Reflect.set(a, 'value', angle.value + '°');
                }
                return a;
            }),
            circles: this.circles.map(circle => {
                const c = {
                    name: `${circle.centerPoint} (${circle.centerX}, ${circle.centerY})${circle.hide ? ' - hide' : ''}`,
                    radius: Math.round(circle.radius),
                    pointsOnLine: `${circle.pointsOnLine.join(',')}`,
                };
                return c;
            }),
            triangles: this.triangles.map(triangle => '<'+Array.from(triangle).sort().join(',')+'>'),
            lines: this.lines.map(line => '['+line.points.slice().join(',')+']'),
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

    deleteAngle = (angleData: Angle) => {
        if (angleData.groupElement) {
            angleData.groupElement.remove();
        }
        
        const angleIndex = this.angles.indexOf(angleData);
        if (angleIndex > -1) {
            this.angles.splice(angleIndex, 1);
        }
        
        this.updateStatus('Angle deleted');
        this.saveState();
    }
}

