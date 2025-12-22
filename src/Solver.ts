// Geometry Drawing Tool - Solver Mode
import { Messages } from './MessagingHub';
import { solve } from './utils/solve';
import { 
    findNearbyEdges,
} from './utils/mathHelper';
import {
    deserializeStateFromUrl,
} from './utils/dataSerializer';
import { deepClone } from './utils/objectHelper';
import { ResultPanel } from './UI/panels/ResultPanel';
import type {
    Point,
    Edge,
    Angle,
    Line,
    HistoryState,
    ToolName,
    CanvasClickData,
    PointClickData,
    PointCreateRequestData,
    PointDraggingData,
    SerializedGeometryData,
    ExportImageType,
    ExportImageData,
} from './types';
import { GeometryTool } from './GeometryTool';
import { getSvgElementData } from './utils/elementHelper';
import { makeResponsiveToScreenSize } from './utils/scaling';

export class Solver extends GeometryTool {
    // Solver-specific properties
    public initialProblem: string | null;
    public initialData: any = null;
    public scale: number = 1;

    constructor(initialProblem: string | null = null) {
        super('solver');
        this.initialProblem = initialProblem;
        this.initialize();
    }

    initialize = () => {
        super.initialize();
        
        // Save initial empty state
        this.saveState();

        // Load initial problem if provided
        this.initProblem();
    }

    registerToolbarButtons = () => {
        // Initialize toolbar buttons - use messaging hub
        const { registerButton, registerFeedback } = this.ui.toolbar;
        registerFeedback();
        registerButton('toggleResultPanel', () => this.ui.panels.togglePanel('result'));
        registerButton('drawPoint', () => this.messagingHub.emit(Messages.TOOL_SELECTED, 'addPoint'));
        registerButton('drawCircle', () => this.messagingHub.emit(Messages.TOOL_SELECTED, 'drawCircle'));
        registerButton('drawEdge', () => this.messagingHub.emit(Messages.TOOL_SELECTED, 'drawEdge'));
        registerButton('exportImage', this.exportImage);

        registerButton('undo', () => this.messagingHub.emit(Messages.UNDO_REQUESTED));
        registerButton('redo', () => this.messagingHub.emit(Messages.REDO_REQUESTED));
    }

    exportImage = (_ev: Event, type?: string) => {
        if (!type) { return console.error('export image type not found', type); }
        this.messagingHub.emit<ExportImageData>(
            Messages.EXPORT_SVG,
            {
                name: this.problemName,
                type: type as ExportImageType
            }
        );
    }

    registerPanels = () => {
        const { registerPanel } = this.ui.panels;
        registerPanel('result', ResultPanel);
    }

    setupMessageSubscriptions = () => {
        // Toolbar events
        this.messagingHub.subscribe(Messages.TOOL_SELECTED, (tool: ToolName) => this.setTool(tool));

        this.messagingHub.subscribe(Messages.UNDO_REQUESTED, () => this.undo());
        this.messagingHub.subscribe(Messages.REDO_REQUESTED, () => this.redo());

        // Canvas events
        this.messagingHub.subscribe(Messages.CANVAS_CLICKED, (data: CanvasClickData) => this.handleCanvasClick(data.event));
        this.messagingHub.subscribe(Messages.POINT_CLICKED, (data: PointClickData) => this.handlePointClick(data.point));

        // Point events
        this.messagingHub.subscribe(Messages.POINT_CREATE_REQUESTED, (data: PointCreateRequestData) => this.handlePointCreateRequest(data));
        
        // Point dragging - update connected edges and angles in real-time
        this.messagingHub.subscribe(Messages.POINT_DRAGGING, this.handlePointDragging);
        
        // Point moved - check if point is on edge or circle (after drag completes)
        this.messagingHub.subscribe(Messages.POINT_MOVED, this.handlePointMoved);

        // Status updates (from UI components)
        this.messagingHub.subscribe(Messages.STATUS_UPDATED, (message: string) => this.updateStatus(message));
    }

    // --- start inherited methods ---
    // Proxy methods to maintain arrow function syntax for this class

    handlePointDragging = (data: PointDraggingData) => {
        return super.handlePointDragging(data);
    }

    handlePointMoved = (data: PointDraggingData) => {
        return super.handlePointMoved(data);
    }

    addLine = (points: string[] | Line) => {
        return super.addLine(points);
    }

    addPoint = (point: Point) => {
        return super.addPoint(point);
    }

    checkPointIntersections = (point: Point, config: { fixPointPosition?: boolean } = {}) => {
        return super.checkPointIntersections(point, config);
    }

    fixPointPositionOnEdges = (point: Point, intersectedEdges: Edge[]) => {
        return super.fixPointPositionOnEdges(point, intersectedEdges);
    }

    createEdge = (point1Id: string, point2Id: string, hide = false) => {
        return super.createEdge(point1Id, point2Id, hide);
    }

    createPoint = (x: number, y: number) => {
        return super.createPoint(x, y);
    }

    drawPoint = (point: Point) => {
        return super.drawPoint(point);
    }

    setTool = (tool: ToolName) => {
        return super.setTool(tool);
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

    redrawAngleArc = (angleData: Angle) => {
        return super.redrawAngleArc(angleData);
    }

    autoCreateAnglesForEdge = (edgePointIds: string[]) => {
        return super.autoCreateAnglesForEdge(edgePointIds);
    }

    saveState = () => {
        return super.saveState();
    }

    undo = () => {
        return super.undo();
    }

    redo = () => {
        return super.redo();
    }

    restoreState = (state: HistoryState) => {
        return super.restoreState(state);
    }

    updateUndoRedoButtons = () => {
        return super.updateUndoRedoButtons();
    }

    updateStatus = (message: string) => {
        return super.updateStatus(message);
    }

    loadData = (rawData: SerializedGeometryData) => {
        // hide or non given or non target angles
        super.loadData(rawData);
    }

    handlePointCreateRequest = (data: PointCreateRequestData) => {
        return super.handlePointCreateRequest(data);
    }

    // --- end inherited methods ---

    // --- Solver-specific methods ---
    initProblem = () => {
        const data = deserializeStateFromUrl(this.initialProblem);
        if (data) {
            // hide all angle without value or if it is not a target
            const scaleData = makeResponsiveToScreenSize(data);
            this.scale = scaleData.scale;
            this.svg.style.minHeight = `${scaleData.canvasHeight}px`;
            data.angles
                .forEach(angle => {
                    if (angle.t || angle.l || angle.v) return;
                    angle.h = 1;
                });

            // make it responsive to the screen size

            this.loadData(data);
        }

        const targetAngle = this.angles.find(a => a.target);
        if (!targetAngle) { return; }
        const clonedData = deepClone({
            angles: this.angles,
            lines: this.lines,
            points: this.points,
            triangles: this.triangles.map(tri => Array.from(tri)),
            circles: this.circles,
            adjacentPoints: this.adjacentPoints
        });

        const { solved, score } = solve(clonedData, {
            setAngle: () => { },
            maxIterations: 100
        });

        console.info('solve', { solved, score });

        this.ui.toolbar.updateFeedback(score || 1);
        if (!solved) { alert('Warning: Problem could not be fully solved with the given data.'); return; }

        const solvedAngle = clonedData.angles.find(a => a.name === targetAngle.name);
        this.ui.panels.getPanel<ResultPanel>('result')?.updatePanel(
            targetAngle,
            solvedAngle!
        );
    }

    // Override handleCanvasClick for Solver-specific behavior (using findNearbyEdges)
    handleCanvasClick = (e: MouseEvent) => {
        const target = e.target as HTMLElement;
        const { elementName, data } = getSvgElementData(target);
        
        if (target === this.svg) {
            if (this.currentTool === 'addPoint') {
                const pt = this.getSVGPoint(e);
                
                // Check if click is near an edge (within 5 pixels)
                const nearbyEdges = findNearbyEdges(pt.x, pt.y, this.edges, this.pointsMap);
                if (nearbyEdges.length > 0) {
                    // Split the edge and add point at the closest point
                    const { x, y } = nearbyEdges[0].closestPoint;
                    const newPoint = this.createPoint(x, y);
                    nearbyEdges.forEach(nearbyEdge => {
                        this.splitEdgeWithPoint(nearbyEdge.edge, newPoint);
                    });
                } else {
                    // Add point at click position
                    this.drawNewPoint(pt.x, pt.y);
                }
            } else if (this.currentTool === 'assignAngle') {
                const pt = this.getSVGPoint(e);
                this.findClosestPointAndEdges(pt.x, pt.y);
            } else if (this.currentTool === 'angleBisector') {
                console.error('handle canvas click for angle bisector')
            }
        } else if ((this.currentTool === 'drawCircle' || this.currentTool === 'drawEdge') && elementName === 'point') {
            // Handle point clicks for circle/edge drawing
            const point = this.pointsMap.get(data as string);
            if (!point) { return console.error('point not found', data); }
            this.handlePointClick(point);
        }
    }

    // Solver-specific drawNewPoint (simpler than Creator's createPoint)
    drawNewPoint = (x: number, y: number) => {
        const point = this.createPoint(x, y);
        return point;
    }

    // Solver-specific togglePointNames
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
}
