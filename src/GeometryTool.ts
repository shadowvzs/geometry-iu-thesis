// Geometry Drawing Tool - Creator Mode
import { MessagingHub, Messages } from './MessagingHub';

import { 
    arePointsCollinear, 
    arePointsCollinearByPosition, 
    calculateAngleDegrees,
    clipLineToCanvas,
    distance,
    findPointNeighbors,
    getAngleValue,
    getAngleCalculatedInfo,
    getAngleDisplayText,
    getAngleNameFromPoints,
    getHighlightableElements,
    getNewPointName,
    getSameAngleNames,
    getUnusedGreekLetter,
    getTriangles2,
    increaseAngleRadius,
    insertPointBetweenEdgePointsInLine,
    isEdgeOnThisLine,
    isPointInsideAngle,
    isPointInTriangle, 
    isPointOnCircle,
    isPointsOnSameLine,
    isThisAngle,
    lineIntersection, 
    normalizeAngle,
    pointToSegmentDistance,
    sortLinePoints,
} from './utils/mathHelper';
import { createElement } from './utils/domHelper';
import {
    CREATOR_ONLY_CLASS,
    getSvgElementData,
    renderCircle,
    renderEdge,
    renderPointGroup,
} from './utils/elementHelper';
import {
    deserializeGeometryData,
    enrichGeometryData,
    validateGeometryData,
} from './utils/dataSerializer';
import { deepClone } from './utils/objectHelper';
import { UI } from './UI/index';
import { initDraggablePanels } from './UI/DraggablePanel';

import type {
    Point,
    Edge,
    Circle,
    Angle,
    Line,
    Definition,
    Triangle,
    HistoryState,
    SvgGroups,
    EdgeWithAngle,
    ToolName,
    AngleToCreate,
    EdgeIntersection,
    SerializedGeometryData,
    ValidationResult,
    Position,
    SavedEdge,
    SavedPoint,
    SavedCircle,
    SavedAngle,
    PointCreateRequestData,
    PointDraggingData,
    UpdateAngleData,
    AngleToCreate2
} from './types';

export class GeometryTool {
    // Class properties with types
    public messagingHub!: MessagingHub;
    public ui!: UI;
    public points: Point[] = [];
    public pointsMap: Map<string, Point> = new Map();
    public adjacentPoints: Map<string, Set<string>> = new Map();
    public circles: Circle[] = [];
    public definitions: Definition[] = [];
    public edges: Edge[] = [];
    public angles: Angle[] = [];
    public lines: Line[] = [];
    public selectedPoints: string[] = [];
    public currentTool: ToolName = 'none';
    public bisectedAngles: Set<string> = new Set();
    public linkedAngles: Map<string, string> = new Map();
    public overlappingAngles: Map<string, Set<string>> = new Map();
    public showPointNames: boolean = true;
    public triangles: Triangle[] = [];
    public history: HistoryState[] = [];
    public historyIndex: number = -1;
    public maxHistorySize: number = 50;
    public svg!: HTMLElement;
    public svgGroup!: SvgGroups;
    public scale: number = 1;
    _batchUpdatingTriangles: boolean = false;

    constructor(private mode: 'creator' | 'solver') {
        // Bind all methods to this instance
        this.setupMessageSubscriptions = this.setupMessageSubscriptions.bind(this);
        this.handleAngleValueCalculated = this.handleAngleValueCalculated.bind(this);
        this.handlePointDragging = this.handlePointDragging.bind(this);
        this.handlePointMoved = this.handlePointMoved.bind(this);
        this.addLine = this.addLine.bind(this);
        this.addEdge = this.addEdge.bind(this);
        this.createCircle = this.createCircle.bind(this);
        this.createEdge = this.createEdge.bind(this);
        this.createPoint = this.createPoint.bind(this);
        this.addPoint = this.addPoint.bind(this);
        this.drawPoint = this.drawPoint.bind(this);
        this.checkPointIntersections = this.checkPointIntersections.bind(this);
        this.fixPointPositionOnEdges = this.fixPointPositionOnEdges.bind(this);
        this.initialize = this.initialize.bind(this);
        this.registerToolbarButtons = this.registerToolbarButtons.bind(this);
        this.registerPanels = this.registerPanels.bind(this);
        this.mouseMoveOnSvg = this.mouseMoveOnSvg.bind(this);
        this.setTool = this.setTool.bind(this);
        this.handleCanvasClick = this.handleCanvasClick.bind(this);
        this.getSVGPoint = this.getSVGPoint.bind(this);
        this.findClosestPointAndEdges = this.findClosestPointAndEdges.bind(this);
        this.checkPointOnLines = this.checkPointOnLines.bind(this);
        this.updatePointSelection = this.updatePointSelection.bind(this);
        this.drawCircleFromPoints = this.drawCircleFromPoints.bind(this);
        this.drawEdge = this.drawEdge.bind(this);
        this.createAnglesForNewEdge = this.createAnglesForNewEdge.bind(this);
        this.splitEdgeWithPoint = this.splitEdgeWithPoint.bind(this);
        this.addAdjacentPoint = this.addAdjacentPoint.bind(this);
        this.updateTriangles = this.updateTriangles.bind(this);
        this.handlePointClick = this.handlePointClick.bind(this);
        this.recreateAllAngles = this.recreateAllAngles.bind(this);
        this.createAngle = this.createAngle.bind(this);
        this.createAngleText = this.createAngleText.bind(this);
        this.handleAngleClick = this.handleAngleClick.bind(this);
        this.redrawAngleArc = this.redrawAngleArc.bind(this);
        this.autoCreateAnglesForEdge = this.autoCreateAnglesForEdge.bind(this);
        this.createAngleBisector = this.createAngleBisector.bind(this);
        this.saveState = this.saveState.bind(this);
        this.undo = this.undo.bind(this);
        this.redo = this.redo.bind(this);
        this.restoreState = this.restoreState.bind(this);
        this.updateUndoRedoButtons = this.updateUndoRedoButtons.bind(this);
        this.updateStatus = this.updateStatus.bind(this);
        this.updateAngle = this.updateAngle.bind(this);
        this.loadData = this.loadData.bind(this);
        this.handlePointCreateRequest = this.handlePointCreateRequest.bind(this);
        // this.initialize();
        // this.saveState();
    }

    public initialize() {
        // Initialize messaging hub first
        this.messagingHub = new MessagingHub();
        this.ui = new UI(this.messagingHub);

        // Subscribe to messages
        this.setupMessageSubscriptions();

        // create UI
        this.ui.initialize();
        this.svg = this.ui.canvas.svg;
        this.svgGroup = this.ui.canvas.svgGroup;
    
        this.registerToolbarButtons();
        this.registerPanels();

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
 
        // Canvas click - emit message instead of direct call
        this.ui.canvas.svg.addEventListener('click', (e) => {
            this.messagingHub.emit(Messages.CANVAS_CLICKED, { event: e });
        });
        
        this.updateStatus('Click on canvas to add points');

        // Initialize draggable panels
        initDraggablePanels();

        // select initial point
        this.setTool('addPoint');
    }

    public setupMessageSubscriptions() {
        throw new Error('Not implemented, please overwrite it');
    }

    public handleAngleValueCalculated(angle: Angle) {
        if (angle && angle.groupElement) {
            const textElement = angle.groupElement.querySelector('text');
            if (textElement) {
                textElement.textContent = getAngleDisplayText(angle);
            }
            // Redraw the arc in case the value is 90 (should show square corner)
            this.redrawAngleArc(angle);
        }
    }

    public handlePointDragging(data: PointDraggingData) {
        const { point } = data;
        
        // Update all edges connected to this point
        this.edges.forEach(edge => {
            if (edge.points.includes(point.id)) {
                const p1 = this.pointsMap.get(edge.points[0]);
                const p2 = this.pointsMap.get(edge.points[1]);
                if (p1 && p2 && edge.element) {
                    edge.element.setAttribute('x1', p1.x.toString());
                    edge.element.setAttribute('y1', p1.y.toString());
                    edge.element.setAttribute('x2', p2.x.toString());
                    edge.element.setAttribute('y2', p2.y.toString());
                }
            }
        });
        
        // Update angles display for affected angles
        this.angles.forEach(angle => {
            if (angle.sidepoints.includes(point.id)) {
                // Recalculate angle value
                const vertex = this.pointsMap.get(angle.pointId);
                const p1 = this.pointsMap.get(angle.sidepoints[0]);
                const p2 = this.pointsMap.get(angle.sidepoints[1]);
                if (vertex && p1 && p2) {
                    angle.calculatedValue = calculateAngleDegrees(vertex, p1, p2);
                }
                // Update visual
                if (angle.groupElement) {
                    this.redrawAngleArc(angle);
                    const textElement = angle.groupElement.querySelector('text');
                    if (textElement) {
                        textElement.textContent = getAngleDisplayText(angle);
                    }
                }
            }
        });
    }

    public handlePointMoved(data: PointDraggingData) {
        const { point } = data;
        const threshold = 5;
        
        // Check if the moved point is now on any circle's border
        this.circles.forEach(circle => {
            // Skip if the point is the center
            if (circle.centerPoint === point.id) return;
            
            const centerPoint = this.pointsMap.get(circle.centerPoint);
            if (!centerPoint) return;
            
            const distanceFromCenter = Math.sqrt(
                Math.pow(point.x - centerPoint.x, 2) + 
                Math.pow(point.y - centerPoint.y, 2)
            );
            
            const distanceFromBorder = Math.abs(distanceFromCenter - circle.radius);
            const wasOnCircle = circle.pointsOnLine && circle.pointsOnLine.includes(point.id);
            const isOnCircle = distanceFromBorder <= threshold;
            
            if (isOnCircle && !wasOnCircle) {
                // Point moved onto circle
                if (!circle.pointsOnLine) circle.pointsOnLine = [];
                circle.pointsOnLine.push(point.id);
            } else if (!isOnCircle && wasOnCircle) {
                // Point moved off circle
                circle.pointsOnLine = circle.pointsOnLine.filter(id => id !== point.id);
            }
        });

        // TODO replace this too with a proper line-point association check
        
        // Check if the moved point is now on any edge (for collinearity)
        // Update existing lines that contain this point
        this.lines.forEach(line => {
            if (line.points.includes(point.id)) {
                // Verify the point is still collinear with its neighbors in the line
                const pointIndex = line.points.indexOf(point.id);
                const prevPoint = pointIndex > 0 ? this.pointsMap.get(line.points[pointIndex - 1]) : null;
                const nextPoint = pointIndex < line.points.length - 1 ? this.pointsMap.get(line.points[pointIndex + 1]) : null;
                
                if (prevPoint && nextPoint) {
                    arePointsCollinearByPosition(prevPoint, point, nextPoint, threshold);
                }
            }
        });
        
        // Save state after move
        this.saveState();
    }

    public addLine(linePoints: string[] | Line) {
        // it was called after the serialization
        if (Array.isArray(linePoints)) {
            this.lines.push({
                id: Math.random().toString(36),
                points: linePoints
            });
        } else {
            this.lines.push(linePoints);
        }
    }

    public addEdge(edge: Edge) {
        this.edges.push(edge);
    }

    public createCircle(circle: Circle) {
        circle.element = renderCircle(circle);
        this.svgGroup.circle.appendChild(circle.element);
        this.circles.push(circle);
        return circle;
    }

    public createEdge(point1Id: string, point2Id: string, hide = false) {
        // Create edge between points
        const fromPoint = this.pointsMap.get(point1Id);
        const toPoint = this.pointsMap.get(point2Id);
        if (!fromPoint || !toPoint) {
            throw new Error(`Points not found ${point1Id} or ${point2Id}`);
        }
        const line = renderEdge(fromPoint, toPoint, hide);
        this.svgGroup.edge.appendChild(line);
        const newEdge: Edge = {
            id: Math.random().toString(36),
            points: [fromPoint.id, toPoint.id],
            element: line,
            hide
        };
        this.addEdge(newEdge);
        
        // Update adjacency map for the new edge
        this.addAdjacentPoint(fromPoint.id, toPoint.id);
        this.addAdjacentPoint(toPoint.id, fromPoint.id);
        return newEdge;
    }

    public createPoint(x: number, y: number) {
        const point = {
            id: getNewPointName(this.points.length),
            x: Math.round(x),
            y: Math.round(y)
        };
        
        this.addPoint(point);
        this.drawPoint(point);
        this.checkPointIntersections(point, { fixPointPosition: true });
        this.recreateAllAngles();
        this.saveState();
        return point;
    }

    public addPoint(point: Point) {
        this.points.push(point);
        this.pointsMap.set(point.id, point);
    }

    public drawPoint(point: Point) {
        const classes = ['point-group'];
        if (point.hide) classes.push('hide');
        const group = renderPointGroup(point, this.mode, this.scale);
        
        // Remove any previous references to this point first
        const existingGroup = this.svgGroup.point.querySelector(`g[data-point-id="${point.id}"]`);
        if (existingGroup) {
            existingGroup.remove();
        }
        
        this.svgGroup.point.appendChild(group);
    }

    public checkPointIntersections(point: Point, { fixPointPosition }: { fixPointPosition?: boolean } = {}) {
        const result = getHighlightableElements({
            lines: this.lines,
            edges: this.edges,
            circles: this.circles,
            pointsMap: this.pointsMap
        }, point);

        if (result.circles.length > 0) {
            const circles = this.circles.filter(c => result.circles.includes(c.id));
            circles.forEach(circle => {
                if (!circle.pointsOnLine) { circle.pointsOnLine = []; }
                if (!circle.pointsOnLine.includes(point.id)) {
                    circle.pointsOnLine.push(point.id);
                }
            });
        }

        // we used only the lines which have the point on them
        let lines = this.lines.filter(l => result.lines.includes(l.id));
        // we use only edges which have the point on them
        let edges = this.edges.filter(e => result.edges.includes(e.id) && !result.intersectedEdges.includes(e.id));
        const intersectedEdges = this.edges.filter(e => result.intersectedEdges.includes(e.id));

        if (intersectedEdges.length > 0) {
            if (fixPointPosition) {
                this.fixPointPositionOnEdges(point, intersectedEdges);
            }
            // here we process the intersected edges, so we remove from the edge list
            // TODO: maybe we not need to filter
            // edges = edges.filter(e => result.intersectedEdges.includes(e.id));
            intersectedEdges.forEach(edge => {
                // (line, pairPointIds, pointId)
                const existingLine = lines.find(l => isEdgeOnThisLine(edge, l));
                if (existingLine) {
                    lines = lines.filter(l => l.id !== existingLine.id);
                    insertPointBetweenEdgePointsInLine(existingLine, edge.points, point.id);
                } else {
                    this.addLine([edge.points[0], point.id, edge.points[1]]);
                }

                // Remove the old edge that was intersected
                const oldEdgeIndex = this.edges.findIndex(e => edge.id === e.id);
                if (oldEdgeIndex > -1) {
                    this.edges.splice(oldEdgeIndex, 1);
                    // Remove the old edge line element from DOM
                    if (edge.element) {
                        edge.element.remove();
                    }
                }
                
                // Create two new edges: from point1 to newPoint and from newPoint to point2
                this.createEdge(edge.points[0], point.id);
                this.createEdge(point.id, edge.points[1]);
            });
        }

        if (lines.length > 0) {
            lines.forEach(line => {
                const uniquePoints = [...new Set([...line.points, point.id])];
                const points = sortLinePoints(uniquePoints, this.pointsMap);
                line.points = points;
                // TODO: maybe we not need to filter
                // edges = edges.filter(e => !isEdgeOnThisLine(e, line));
            });
        }

        // edges being collinear with new point but the point is not in between edge points
        if (edges.length > 0) {

            edges.forEach(edge => {
                const existingLine = this.lines.find(l => isEdgeOnThisLine(edge, l));
                if (existingLine) {
                    lines = lines.filter(l => l.id !== existingLine.id);
                    const uniquePoints = [...new Set([...existingLine.points, point.id])];
                    const points = sortLinePoints(uniquePoints, this.pointsMap);
                    existingLine.points = points;
                } else {
                    const uniquePoints = [...new Set([...edge.points, point.id])];
                    const points = sortLinePoints(uniquePoints, this.pointsMap);
                    this.addLine(points);
                }
            });
        }
    }

    public fixPointPositionOnEdges(point: Point, intersectedEdges: Edge[]) {
        const avgPosition = intersectedEdges.reduce((acc, edge) => {
            const [edgePoint1, edgePoint2] = edge.points.map(pid => this.pointsMap.get(pid)) as [Point, Point];
            const { closestPoint } = pointToSegmentDistance(
                point.x, point.y,
                edgePoint1.x, edgePoint1.y,
                edgePoint2.x, edgePoint2.y
            );

            acc.x += closestPoint.x;
            acc.y += closestPoint.y;
            return acc;
        }, { x: 0, y: 0 });

        avgPosition.x = Math.round(avgPosition.x / intersectedEdges.length);
        avgPosition.y = Math.round(avgPosition.y / intersectedEdges.length);
        
        // Update point position to be exactly on the edge
        point.x = Math.round(avgPosition.x);
        point.y = Math.round(avgPosition.y);

        // Update the visual position of the point
        const pointGroup = this.svgGroup.point.querySelector(`.point-group[data-point-id="${point.id}"]`);
        if (pointGroup) {
            const circleElement = pointGroup.querySelector('.point-circle');
            const labelElement = pointGroup.querySelector('.point-label');
            if (circleElement) {
                circleElement.setAttribute('cx', point.x.toString());
                circleElement.setAttribute('cy', point.y.toString());
            }
            if (labelElement) {
                labelElement.setAttribute('x', point.x.toString());
                labelElement.setAttribute('y', (point.y - 15).toString());
            }
        }
    }
    
    public registerToolbarButtons() {
        throw new Error('Not implemented, please overwrite it');
    }

    public registerPanels() {
        throw new Error('Not implemented, please overwrite it');
    }

    public mouseMoveOnSvg(ev: MouseEvent) {
        // external data
        const pt = this.getSVGPoint(ev);
        const result = getHighlightableElements({
            lines: this.lines,
            edges: this.edges,
            circles: this.circles,
            pointsMap: this.pointsMap
        }, pt);

        this.edges.forEach(edge => {
            if (!edge.element) { return console.error('edge.element not found', edge); }
            if (result.edges.includes(edge.id)) {
                edge.element.classList.add('mouse-on-this-element');
            } else {
                edge.element.classList.remove('mouse-on-this-element');
            }
        });

        this.circles.forEach(circle => {
            if (!circle.element) { return console.error('circle.element not found', circle); }
            if (result.circles.includes(circle.id)) {
                circle.element.classList.add('mouse-on-this-element');
            } else {
                circle.element.classList.remove('mouse-on-this-element');
            }
        });
    }

    public setTool(tool: ToolName) {
        if (tool === this.currentTool) { return; }
        if (this.currentTool === 'addPoint') {
            this.svg.removeEventListener('mousemove', this.mouseMoveOnSvg);
        }
        this.currentTool = tool;
        document.body.setAttribute('tool', tool);
        this.selectedPoints = [];

        // Update point selection visuals (removes selected class from all points)
        this.updatePointSelection();
        
        // Update button states
        document.querySelectorAll('.tool-btn.active').forEach(btn => btn.classList.remove('active'));
        
        if (tool === 'pointer') {
            document.getElementById('pointerBtn')!.classList.add('active');
            this.updateStatus('Click on points, edges, or angles to edit them');
        } else if (tool === 'addPoint') {
            this.svg.addEventListener('mousemove', this.mouseMoveOnSvg)
            document.getElementById('drawPointBtn')!.classList.add('active');
            this.updateStatus('Click on canvas to add points');
        } else if (tool === 'drawCircle') {
            document.getElementById('drawCircleBtn')!.classList.add('active');
            this.updateStatus('Select center point, then radius point to draw a circle');
        } else if (tool === 'drawEdge') {
            document.getElementById('drawEdgeBtn')!.classList.add('active');
            this.updateStatus('Select 2 points to draw an edge');
        } else if (tool === 'assignAngle') {
            document.getElementById('assignAngleBtn')!.classList.add('active');
            this.updateStatus('Click on an angle to assign a value');
        } else if (tool === 'angleBisector') {
            document.getElementById('angleBisectorBtn')!.classList.add('active');
            this.updateStatus('Click to an existing angle in a triangle');
        } else if (tool === 'hideElement') {
            document.getElementById('hideElementBtn')!.classList.add('active');
            this.updateStatus('Click on an element to hide it');
        }
        
        this.updatePointSelection();
    }
    
    public handleCanvasClick(e: MouseEvent) {
        const target = e.target as HTMLElement;

        const { elementName, data } = getSvgElementData(target);
        if (target === this.svg) {
            if (this.currentTool === 'addPoint') {
                const pt = this.getSVGPoint(e);
                this.createPoint(pt.x, pt.y);
            } else if (this.currentTool === 'assignAngle') {
                const pt = this.getSVGPoint(e);
                this.findClosestPointAndEdges(pt.x, pt.y);
            }
        // we create for the line and circles too
        } else if (this.currentTool === 'hideElement') {
            if (!elementName) { return; }
            if (elementName === 'edge') {
                const [p1, p2] = data as [string, string];
                const edge = this.edges.find(edge => edge.points.includes(p1) && edge.points.includes(p2));
                if (!edge || !edge.element) { return console.error('edge not found', p1, p2); }
                edge.element.classList.toggle(CREATOR_ONLY_CLASS);
                edge.hide = !edge.hide;
            } else if (elementName === 'point') {
                const point = this.pointsMap.get(data as string);
                if (!point) { return console.error('point not found', data); }
                point.hide = !point.hide;
                const element = document.querySelector(`.point-group[data-pointId="${data}"]`);
                if (!element) { return console.error('element not found', data); }
                element.classList.toggle(CREATOR_ONLY_CLASS);
            } else if (elementName === 'circle') {
                const circle = this.circles.find(circle => circle.id === data);
                if (!circle) { return console.error('circle not found', data); }
                circle.hide = !circle.hide;
                const element = document.querySelector<HTMLElement>(`.circle-shape[data-circle-id="${data}"]`);
                if (!element) { return console.error('element not found', data); }
                element.classList.toggle(CREATOR_ONLY_CLASS);
            } else if (elementName === 'angle') {
                const angle = this.angles.find(angle => angle.id === data);
                if (!angle) { return console.error('angle not found', data); }
                angle.hide = !angle.hide;
                const element = document.querySelector<HTMLElement>(`.angle-group[data-angle-id="${data}"]`);
                if (!element) { return console.error('element not found', data); }
                element.classList.toggle(CREATOR_ONLY_CLASS);
            }
        } else if (elementName === 'point') {
            const point = this.pointsMap.get(data as string);
            if (!point) { return console.error('point not found', data); }
            this.handlePointClick(point);
        } else if (this.currentTool === 'assignAngle' && elementName === 'angle') {
            const angle = this.angles.find(angle => angle.id === data);
            this.messagingHub.emit(Messages.ANGLE_CLICKED, { angleData: angle, event: e });
        } else if (this.currentTool === 'addPoint') {
            if (['edge', 'circle'].includes(elementName)) {
                const pt = this.getSVGPoint(e);
                this.createPoint(pt.x, pt.y)
            }
        } else if (this.currentTool === 'angleBisector' && elementName === 'angle') {
            const angleData = this.angles.find(angle => angle.id === data);
            this.messagingHub.emit(Messages.ANGLE_BISECTOR_REQUESTED, angleData)
        }
    }

    public getSVGPoint(e: MouseEvent) {
        const rect = this.svg.getBoundingClientRect();
        return {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top,
            height: rect.height,
            width: rect.width
        };
    }
    
    public findClosestPointAndEdges(clickX: number, clickY: number) {
        const maxDistance = 30; // Maximum 30 pixels
        
        // Find the closest point
        let closestPoint!: Point;
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
        const connectedEdges: EdgeWithAngle[] = [];
        
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
            const angleExists = this.angles.some(a => isThisAngle(a, closestPoint.id, point1.id, point2.id));
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
    
    // Adds a point to any existing collinear lines and creates new lines from edges.
    // Iterates through all lines, adding the point if collinear with any line's points.
    // Re-sorts line arrays by position after insertion.
    // Also checks all edges: if the point is collinear with an edge not yet in a line,
    // creates a new line containing the edge endpoints and the point.
    public checkPointOnLines(point: Point) {
        // Track which edges we've already processed (to avoid duplicate lines)
        const processedEdgePairs = new Set<string>();
        
        // First, check each existing line to see if this point is collinear with it
        for (const line of this.lines) {
            // Skip if point is already in this line
            if (line.points.includes(point.id)) continue;
            
            // Need at least 2 points in the line to check collinearity
            if (line.points.length < 2) continue;
            
            // Get two points from the line to check collinearity
            const point1 = this.pointsMap.get(line.points[0]);
            const point2 = this.pointsMap.get(line.points[1]);
            
            if (!point1 || !point2) continue;
            
            // Check if the new point is collinear with the line
            if (arePointsCollinearByPosition(point1, point2, point, 5)) {
                // Point is collinear - add it to the line
                line.points.push(point.id);
                line.points = sortLinePoints(line.points, this.pointsMap);
                                
                // Mark this edge pair as processed
                const edgeKey = [line.points[0], line.points[line.points.length - 1]].sort().join('-');
                processedEdgePairs.add(edgeKey);
            }
        }
        
        // Second, check edges to see if this point is collinear with any edge
        // and should create a NEW line
        for (const edge of this.edges) {
            const point1Id = edge.points[0];
            const point2Id = edge.points[1];
            
            // Skip if point is already part of this edge
            if (point1Id === point.id || point2Id === point.id) continue;
            
            // Skip if we already processed this edge pair
            const edgeKey = [point1Id, point2Id].sort().join('-');
            if (processedEdgePairs.has(edgeKey)) continue;
            
            // Check if there's already a line containing both edge points
            const existingLine = this.lines.find(line => isPointsOnSameLine(line, point1Id, point2Id));
            if (existingLine) continue; // Already handled by existing line check above
            
            const edgePoint1 = this.pointsMap.get(point1Id);
            const edgePoint2 = this.pointsMap.get(point2Id);
            
            if (!edgePoint1 || !edgePoint2) continue;
            
            // Check if the new point is collinear with this edge
            if (arePointsCollinearByPosition(edgePoint1, edgePoint2, point, 5)) {
                // Create a new line with these three points
                const newLinePoints = sortLinePoints([edgePoint1.id, edgePoint2.id, point.id], this.pointsMap);
                this.addLine(newLinePoints);
                
                // Mark as processed
                processedEdgePairs.add(edgeKey);
            }
        }
    }
   
    public updatePointSelection() {
        this.svgGroup.point.querySelectorAll('.point-circle')
            .forEach(pointElement => {
                const pointGroupElement = pointElement.parentElement;
                if (!pointGroupElement) {
                    throw new Error('pointId not found');
                }
                const pointId = pointGroupElement.getAttribute('data-pointId');
                if (!pointId) {
                    throw new Error('pointId not found');
                }

                if (this.selectedPoints.includes(pointId)) {
                    pointElement.classList.add('selected');
                } else {
                    pointElement.classList.remove('selected');
                }
            });
    }

    public drawCircleFromPoints() {
        // First point is center, second point is on the circle
        const centerPoint = this.pointsMap.get(this.selectedPoints[0]);
        const circlePoint = this.pointsMap.get(this.selectedPoints[1]);
        
        if (!centerPoint || !circlePoint) return;
        if (this.circles.some(circle => circle.centerPoint === centerPoint.id && circle.pointsOnLine.includes(circlePoint.id))) {
            alert('Circle already exists');
            return;
        }
        
        // Calculate radius as distance from center to circle point using utility function
        const radius = Math.round(distance(centerPoint.x, centerPoint.y, circlePoint.x, circlePoint.y));
        
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
        
        this.createCircle({
            id: Math.random().toString(32),
            centerX: Math.round(centerPoint.x), 
            centerY: Math.round(centerPoint.y), 
            radius, 
            centerPoint: centerPoint.id,
            pointsOnLine: pointsOnLine
        } as Circle);

        // Check if edge already exists between center and circle point
        const edgeExists = this.edges.some(edge => 
            (edge.points[0] === centerPoint.id && edge.points[1] === circlePoint.id) ||
            (edge.points[1] === centerPoint.id && edge.points[0] === circlePoint.id)
        );
        
        // Create edge if it doesn't exist (but don't save yet - create edge silently)
        if (!edgeExists) {
            // Create edge line
            this.createEdge(centerPoint.id, circlePoint.id);
            
            // Auto-create angles at both endpoints
            this.createAnglesForNewEdge(centerPoint.id, circlePoint.id);
        }
        
        // Save state ONCE for the entire circle creation (including edge)
        this.saveState();
    }

    // Creates a visual edge (line) between two points on the canvas.
    // Checks for duplicate edges, creates an SVG line element, updates the adjacency map,
    // and auto-creates angles at both endpoints where 2+ edges meet.
    // Returns the created edge object or undefined if edge already exists.
    public drawEdge(point1: Point, point2: Point) {
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
        this.createEdge(point1.id, point2.id);
        
        // Auto-create angles at both endpoints where possible
        this.createAnglesForNewEdge(point1.id, point2.id);
        
        this.updateStatus('Edge created');
        this.saveState();
    }
    
    public createAnglesForNewEdge(pointId1: string, pointId2: string) {
        // For each endpoint of the new edge, check if angles can be formed
        [pointId1, pointId2].forEach(pointId => {
            const neighbors = this.adjacentPoints.get(pointId);
            if (!neighbors || neighbors.size < 2) return;
            
            const neighborArray = Array.from(neighbors);
            const newEdgeNeighbor = pointId === pointId1 ? pointId2 : pointId1;
            
            // First, check if any existing angles are being split by this new edge
            // If so, increase their radius by 10 pixels
            this.angles.forEach(angle => {
                if (angle.pointId !== pointId) return;
                if (!angle.sidepoints || angle.sidepoints.length !== 2) return;
                
                const angleNeighbor1 = angle.sidepoints[0];
                const angleNeighbor2 = angle.sidepoints[1];
                
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
                        if (angle.groupElement) {
                            const arcElement = angle.groupElement.querySelector('path');
                            if (arcElement) {
                                const currentPath = arcElement.getAttribute('d') as string;
                                const updatedPath = increaseAngleRadius(currentPath, 10);
                                if (updatedPath) { 
                                    arcElement.setAttribute('d', updatedPath); 
                                }
                                angle.radius = (angle.radius || 30) + 10; // Update the angle object's radius
                            }
                        }
                    }
                }
            });
            
            // Collect all angle pairs that need to be created
            const anglesToCreate: AngleToCreate[] = [];
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
                    const angleExists = this.angles.some(angle => isThisAngle(angle, pointId, neighbor1, neighbor2));
                    
                    if (!angleExists) {
                        const vertex = this.pointsMap.get(pointId);
                        const point1 = this.pointsMap.get(neighbor1);
                        const point2 = this.pointsMap.get(neighbor2);
                        
                        if (!vertex || !point1 || !point2) { return; }
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
                            size: angleDiff,
                            angleDegrees: angleDiff
                        });
                    }
                }
            }
            
            // Sort by angle size (largest first, so smallest is created last and appears on top)
            anglesToCreate.sort((a, b) => b.size! - a.size!);
            
            // Create angles in sorted order (smallest last)
            anglesToCreate.forEach(angleData => {
                this.createAngle(angleData.vertex, angleData.point1, angleData.point2);
            });
        });
    }    

    public splitEdgeWithPoint(edge: Edge, newPoint: Point) {
        const [id1, id2] = edge.points;
        const point1 = this.pointsMap.get(id1);
        const point2 = this.pointsMap.get(id2);
        
        if (!point1 || !point2) return;
        
        // Keep the old edge in the array but remove its visual element
        edge.element?.remove();
        // Note: We don't remove the edge from this.edges array anymore
        
        // Track collinear points: the new point splits the edge into two segments
        // Check if there's already a line containing both point1 and point2
        const existingLine = this.lines.find(line => isPointsOnSameLine(line, id1, id2));
        if (existingLine) {
            // Check if newPoint already exists in the line
            if (!existingLine.points.includes(newPoint.id)) {
                // insert into the current position based on distance from the first point
                existingLine.points.push(newPoint.id);
                existingLine.points = sortLinePoints(existingLine.points, this.pointsMap);
                const firstPoint = this.pointsMap.get(existingLine.points[0]);
                if (!firstPoint) {
                    throw new Error('firstPoint not found');
                }
                existingLine.points.sort((a, b) => {
                    const aPoint = this.pointsMap.get(a);
                    const bPoint = this.pointsMap.get(b);
                    if (!aPoint || !bPoint) {
                        throw new Error(`aPoint or bPoint not found ${a} or ${b}`);
                    }
                    const aPointDistance = distance(firstPoint.x, firstPoint.y, aPoint.x, aPoint.y);
                    const bPointDistance = distance(firstPoint.x, firstPoint.y, bPoint.x, bPoint.y);
                    return aPointDistance - bPointDistance;
                });
            }
        } else {
            // Create a new line array with the three collinear points
            this.addLine([id1, newPoint.id, id2]);
        }
        
        // Create two new edges: point1 to newPoint and newPoint to point2
        this.createEdge(id1, newPoint.id);
        this.createEdge(newPoint.id, id2);
        
        // Remove old adjacency between point1 and point2 since they're no longer directly connected
        const adjacentPoints1 = this.adjacentPoints.get(id1);
        if (adjacentPoints1) {
            adjacentPoints1.delete(id2);
        }

        const adjacentPoints2 = this.adjacentPoints.get(id2);
        if (adjacentPoints2) {
            adjacentPoints2.delete(id1);
        }
        
        this.updateStatus(`Edge split with new point ${newPoint.id}`);
        this.saveState();
        this.recreateAllAngles();
        return newPoint;
    }

    public addAdjacentPoint(pointId: string, adjacentPointId: string) {
        if (!this.adjacentPoints.has(pointId)) {
            this.adjacentPoints.set(pointId, new Set());
        }
        const adjacentPoints = this.adjacentPoints.get(pointId);
        if (!adjacentPoints) {
            throw new Error('adjacentPoints not found');
        }
        adjacentPoints.add(adjacentPointId);
        
        // After adding the adjacent point, check for new triangles
        // Skip if we're batch updating (e.g., during state restoration)
        if (!this._batchUpdatingTriangles) {
            this.updateTriangles();
        }
    }
    
    public updateTriangles() {
        // Clear existing triangles
        this.triangles = getTriangles2(this.angles, this.adjacentPoints, this.lines);
    }

    public handlePointClick(point: Point) {
        if (this.currentTool === 'addPoint') {
            // When addPoint tool is active and user clicks on existing point,
            // show the point menu dialog to create a new point from this one
            this.messagingHub.emit(Messages.POINT_MENU_REQUESTED, point);
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
            // Check if clicking the same point twice consecutively
            if (this.selectedPoints.length === 1 && this.selectedPoints[0] === point.id) {
                // Clicking same point twice - deselect
                this.selectedPoints = [];
                this.updatePointSelection();
                this.updateStatus('Select 2 points to draw an edge');
                return;
            }
            
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
                if (!point1 || !point2) {
                    throw new Error(`point1 or point2 not found ${this.selectedPoints[0]} or ${this.selectedPoints[1]}`);
                }
                this.drawEdge(point1, point2);
                this.selectedPoints = [this.selectedPoints[1]]; // Keep the last selected point for chaining
                this.updatePointSelection();
            }
            
            this.updateStatus(`Selected ${this.selectedPoints.length}/2 points`);
        }
    }

    /**
     * Recreate all possible angles based on current geometry.
     * For each point with 2+ adjacent points, creates angles for all pairs.
     * This is used after creating intersection points or restoring state.
     */
    public recreateAllAngles() {
        const angleData: AngleToCreate[] = [];
        this.points.forEach((point: Point) => {
            const adjacentPoints = this.adjacentPoints.get(point.id);
            if (!adjacentPoints || adjacentPoints.size < 2) return;
            
            const adjArray = Array.from(adjacentPoints);
            
            // Create angles at this vertex for all pairs of adjacent points
            for (let i = 0; i < adjArray.length; i++) {
                for (let j = i + 1; j < adjArray.length; j++) {
                    const adjPoint1 = this.pointsMap.get(adjArray[i]);
                    const adjPoint2 = this.pointsMap.get(adjArray[j]);
                    if (adjPoint1 && adjPoint2) {
                        // createAngle will skip if the 3 points are collinear
                        if (this.lines.some(line => (
                            line.points.includes(point.id) &&
                            line.points.includes(adjPoint1.id) &&
                            line.points.includes(adjPoint2.id)
                        ))) {
                            continue; // Skip if point is collinear with either adjacent point
                        }
                        // { angleDegrees }
                        const calculatedValues = getAngleCalculatedInfo(point, adjPoint1, adjPoint2, this.scale);
                        if (!calculatedValues) continue;
                        angleData.push({
                            vertex: point,
                            point1: adjPoint1,
                            point2: adjPoint2,
                            angleDegrees: calculatedValues.angleDegrees
                        });
                        // this.createAngle(point, adjPoint1, adjPoint2);
                    }
                }
            }
        });

        angleData.sort((a, b) => b.angleDegrees - a.angleDegrees);

        angleData.forEach(data => {
            this.createAngle(data.vertex, data.point1, data.point2);
        });
    }
    
    public createAngle(vertex: Point, point1: Point, point2: Point) {
        // Create a unique key for this specific angle
        if (this.angles.some(a => isThisAngle(a, vertex.id, point1.id, point2.id))) {
            return;
        }
        const neighborIds = [point1.id, point2.id].sort((a: string, b: string) => a.localeCompare(b));
        const angleKey = `${vertex.id}-${neighborIds[0]}-${neighborIds[1]}`;
        
        // Check if this angle already exists
        const existingAngle = this.angles.find(a => isThisAngle(a, vertex.id, point1.id, point2.id));
        
        if (existingAngle) {
            // Angle already exists, don't create duplicate
            return;
        }
        
        // Skip if this angle has been bisected
        if (this.bisectedAngles.has(angleKey)) {
            return;
        }
        
        // Note: Redundant/overlapping angles are still created but marked as hidden in drawAngleArc.
        
        // Calculate angle between three points using utility functions
        const calculatedValues = getAngleCalculatedInfo(vertex, point1, point2, this.scale);
        if (!calculatedValues) { return; }
        let {
            angle1,
            angle2,
            angleDegrees,
            radius
        } = calculatedValues;

        // Normalize to [0, 2π]
        let angleDiff = normalizeAngle(angle2 - angle1);
        
        // Only show if angle < 180°
        if (angleDiff > Math.PI) {
            angleDiff = 2 * Math.PI - angleDiff;
            // Swap angles
            [angle1, angle2] = [angle2, angle1];
        }
        
        if ((angleDiff < Math.PI && angleDiff > 0.1 && angleDegrees < 179) === false) {
            return;
        }

        // Generate angle name (e.g., "∠ABC" where B is vertex)
        const angleName = getAngleNameFromPoints(vertex.id, point1.id, point2.id);
        const shouldHide = false ;//(!isAngleInTriangle && !isSupplementaryAngle);

        // Create angle data object (pure data, no DOM references)
        const angleData: Angle = {
            id: angleName,
            pointId: vertex.id,
            sidepoints: [point1.id, point2.id],
            value: null,
            calculatedValue: angleDegrees,
            name: angleName,
            label: '',
            radius: radius,
            startAngle: angle1,
            endAngle: angle2,
            groupElement: null,
            hide: shouldHide,
        };
        
        this.angles.push(angleData);
        // return angleData;

        this.renderAngleArc(angleData);
    }
    
    /**
     * Renders angle arc UI elements for an angle data object.
     * Creates SVG group with path and text, adds event handlers, inserts into DOM.
     * @param {Object} angleData - Angle data object from createAngleData
     */

    // Helper method to calculate angle text position with overlap detection
    // Used by both renderAngleArc and redrawAngleArc to ensure consistent text positioning
    // @param {Object} angleData - Angle data object
    // @param {SVGElement} textElement - Optional existing text element (skips in overlap check)
    // @param {number} initialX - Optional initial X position (uses pre-calculated value, skips recalculation)
    // @param {number} initialY - Optional initial Y position (uses pre-calculated value, skips recalculation)
    // @returns {Object} { x: textX, y: textY } or null if vertex not found
    public createAngleText(angleData: Angle, textElement: SVGTextElement | null = null, initialX: number | null = null, initialY: number | null = null) {
        const vertex = this.pointsMap.get(angleData.pointId);
        if (!vertex) return null;
        
        const { startAngle, endAngle, radius, calculatedValue: angleDegrees } = angleData;
        if (
            typeof startAngle !== 'number' ||
            typeof endAngle !== 'number' ||
            typeof radius !== 'number' ||
            typeof angleDegrees !== 'number'
        ) {
            return console.error('startAngle, endAngle, or radius not found', angleData);
        }

        let angleDiff = endAngle - startAngle;
        
        // Normalize angleDiff to [0, 2π]
        while (angleDiff < 0) angleDiff += 2 * Math.PI;
        while (angleDiff > 2 * Math.PI) angleDiff -= 2 * Math.PI;
        
        // If initial position is provided, use it exactly without recalculation
        if (initialX !== null && initialY !== null) {
            return { x: initialX, y: initialY };
        }
        
        // Calculate midAngle correctly
        let midAngle;
        if (angleDiff > Math.PI) {
            // Large angle - use the smaller arc's midpoint instead
            angleDiff = 2 * Math.PI - angleDiff;
            midAngle = endAngle + angleDiff / 2;
        } else {
            // Normal case: midpoint between start and end
            midAngle = startAngle + angleDiff / 2;
        }
        
        const baseTextOffset = angleDegrees < 30 ? 8 : (angleDegrees > 90 ? 12 : 10);
        const textRadius = radius + baseTextOffset;
        
        // Calculate initial position from scratch
        let textX = vertex.x + textRadius * Math.cos(midAngle);
        let textY = vertex.y + textRadius * Math.sin(midAngle);
        
        // Overlap detection and adjustment
        const overlapThreshold = 20;
        // Use proportional offset distance based on angle size (half the additional distance for small angles)
        const offsetDistance = angleDegrees < 30 ? 7.5 : (angleDegrees > 90 ? 15 : 10);
        
        let hasTextOverlap = true;
        let attempts = 0;
        const maxAttempts = 16;
        
        while (hasTextOverlap && attempts < maxAttempts) {
            hasTextOverlap = false;
            
            // Query DOM directly for text elements at THIS vertex only
            const anglesAtVertex = this.svgGroup.angle.querySelectorAll(
                `[data-angle-vertex-id="${angleData.pointId}"] text`
            );
            
            for (const existingTextElement of anglesAtVertex) {
                // Skip if this is the element we're updating
                if (textElement && existingTextElement === textElement) {
                    continue;
                }
                
                const existingX = parseFloat(existingTextElement.getAttribute('x')!);
                const existingY = parseFloat(existingTextElement.getAttribute('y')!);
                
                const distance = Math.sqrt(
                    Math.pow(textX - existingX, 2) + 
                    Math.pow(textY - existingY, 2)
                );
                
                if (distance < overlapThreshold) {
                    hasTextOverlap = true;
                    if (attempts < 6) {
                        // First 6 attempts: move radially outward
                        const newRadius = textRadius + offsetDistance * (attempts / 2);
                        textX = vertex.x + newRadius * Math.cos(midAngle);
                        textY = vertex.y + newRadius * Math.sin(midAngle);
                    } else {
                        // Next 10 attempts: rotate around vertex
                        const rotationAttempt = attempts - 6;
                        const angleOffset = (Math.PI / 8) * rotationAttempt;
                        const radiusMultiplier = 1 + Math.floor(rotationAttempt / 5) * 0.3;
                        const adjustedAngle = midAngle + angleOffset;
                        textX = vertex.x + textRadius * radiusMultiplier * Math.cos(adjustedAngle);
                        textY = vertex.y + textRadius * radiusMultiplier * Math.sin(adjustedAngle);
                    }
                    break;
                }
            }
            
            attempts++;
        }
        
        return { x: textX, y: textY };
    }

    public renderAngleArc(angleData: Angle) {
        const vertex = this.pointsMap.get(angleData.pointId);
        const point1 = this.pointsMap.get(angleData.sidepoints[0]);
        const point2 = this.pointsMap.get(angleData.sidepoints[1]);
        if (!vertex || !point1 || !point2) {
            console.error('Could not find points for angle:', angleData);
            return;
        }
        
        const { startAngle, endAngle, radius } = angleData;
        const angleDiff = endAngle - startAngle;
        const sameAngleNames = getSameAngleNames(angleData, this.angles, this.lines);
        if (sameAngleNames.length > 0) {
            const sameAnglesSelector = sameAngleNames.map(name => `[data-angle-name="${name}"]`).join(',');
            const isAngleExistAlready = this.svgGroup.angle.querySelector(sameAnglesSelector);
            if (isAngleExistAlready) {
                return;
            }
        }
        // Check if this angle is one of the two angles created by bisection
        // If so, don't show it as a square corner even if it's 90 degrees
        // const neighborIds = [point1.id, point2.id].sort((a, b) => a - b);
        // const angleKey = `${vertex.id}-${neighborIds[0]}-${neighborIds[1]}`;

        // Check if this is exactly a 90-degree angle (either calculated or manually assigned)
        // But don't use square corner if this angle is from a bisection
        const is90Degree = getAngleValue(angleData) === 90;
        
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
        
        // Create a group element to wrap both arc and text
        // This allows hover on either element to affect both

        const group = createElement('g', {
            class: 'angle-group',
            'data-angle-id': angleData.id,
            'data-angle-name': angleData.name,
            'data-angle-vertex-id': angleData.pointId,
            'data-angle-radius': angleData.radius
        });

        if (angleData.target) {
            group.classList.add('target-angle');
        }

        const path = createElement('path', {
            class: 'angle-arc',
            d: pathData,
            'data-angle-id': angleData.id
        });
        
        // Let createAngleText calculate the text position (without initial values)
        // This ensures fresh calculation based on current angle geometry
        const textPosition = this.createAngleText(angleData, null);
        if (!textPosition) { return console.error('textPosition not found', angleData); }

        const text = createElement('text', {
            class: 'angle-text',
            x: textPosition.x,
            y: textPosition.y,
            dy: '0.3em',
            'data-angle-id': angleData.id
        });
        text.textContent = getAngleDisplayText(
            this.mode === 'solver' ? {...angleData, value: undefined } : angleData
        );
        
        // Add path and text to the group
        group.appendChild(path);
        group.appendChild(text);
        
        // Store the group element reference
        angleData.groupElement = group as HTMLElement;
      
        // Add creator-only class if it is hidden
        if (angleData.hide) {
            group.classList.add('creator-only');
        }
        
        const angleElements = Array.from(this.svgGroup.angle.querySelectorAll('.angle-group'));
        // push our new element to the array
        angleElements.push(group);

        // create fragment and rearrange inside the fragment the angles then insert the fragment to the DOM
        const fragment = document.createDocumentFragment();
        // sort in descending order
        const sortedAngleElements = Array.from(angleElements).sort((a, b) => {
            const radiusA = parseFloat(a.getAttribute('data-angle-radius')!);
            const radiusB = parseFloat(b.getAttribute('data-angle-radius')!);
            return radiusB - radiusA;
        });

        sortedAngleElements.forEach(angleElement => fragment.appendChild(angleElement));
        
        this.svgGroup.angle.innerHTML = '';
        this.svgGroup.angle.appendChild(fragment);

    }

    public handleAngleClick(angleData: Angle) {
        if (this.currentTool === 'pointer' || this.currentTool === 'assignAngle') {
            const angles = this.angles.filter(angle => angle.pointId === angleData.pointId);
            this.messagingHub.emit(Messages.ANGLE_EDIT_REQUESTED, { angle: angleData, angles });
        } else if (this.currentTool === 'angleBisector') {
            this.messagingHub.emit(Messages.ANGLE_BISECTOR_REQUESTED, angleData);
        } else {
            this.updateStatus('Switch to "Pointer", "Assign Angle", or "Angle Bisector" tool to interact with angles');
        }
    }
    
    public redrawAngleArc(angleData: Angle) {
        // Skip if no DOM elements (shouldn't happen with new logic, but keep for safety)
        if (!angleData.groupElement) {
            console.warn('Angle missing group element:', angleData);
            return;
        }
        
        // Get the path and text from the group
        const arcElement = angleData.groupElement.querySelector('path');
        const textElement = angleData.groupElement.querySelector('text');
        
        if (!arcElement || !textElement) {
            console.warn('Angle group missing path or text:', angleData);
            return;
        }
        
        // Look up the actual point objects from IDs
        const vertex = this.pointsMap.get(angleData.pointId);
        const point1 = this.pointsMap.get(angleData.sidepoints[0]);
        const point2 = this.pointsMap.get(angleData.sidepoints[1]);
        
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
        
        // Check if it's a 90-degree angle (either calculated or manually assigned)
        const neighborIds = [point1.id, point2.id].sort((a: string, b: string) => a.localeCompare(b));
        const angleKey = `${vertex.id}-${neighborIds[0]}-${neighborIds[1]}`;
        const isFromBisection = this.linkedAngles && this.linkedAngles.has(angleKey);
        
        // Check both calculated angle and assigned value
        const angleValue = getAngleValue(angleData);
        const hasValue90 = angleValue === 90;
        const is90Degree = hasValue90 && !isFromBisection;
        
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
        arcElement.setAttribute('d', pathData);
        const textPosition = this.createAngleText(angleData, textElement);
        if (!textPosition) { return console.error('textPosition not found', angleData); }

        textElement.setAttribute('x', textPosition.x.toString());
        textElement.setAttribute('y', textPosition.y.toString());
    }
    
    // Creates angles at each endpoint of an edge where the endpoint has 2+ neighbors.
    // For each pair of neighbors, checks if they're collinear (skips if so) and if angle exists.
    // Sorts angle pairs by size (largest first) so smaller angles render on top.
    // Creates all valid angles using createAngle().
    public autoCreateAnglesForEdge(edgePointIds: string[]) {
        // For each point in the edge, check if it now has 2+ neighbors
        edgePointIds.forEach(pointId => {
            const point = this.pointsMap.get(pointId);
            if (!point) return;
            
            // Find all neighbors of this point
            const neighbors = findPointNeighbors(point, this.edges, this.pointsMap);
            
            if (neighbors.length < 2) return; // Need at least 2 neighbors for an angle
            
            // Collect all angle pairs that need to be created
            const anglesToCreate: AngleToCreate2[] = [];
            
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
                    const angleExists = this.angles.some(a => isThisAngle(a, point.id, neighbor1.id, neighbor2.id));
                    
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

    public createAngleBisector(angleData: Angle) {
        
        // Look up the point object from ID
        const point = this.pointsMap.get(angleData.pointId);
        if (!point) {
            this.updateStatus('Cannot create bisector: point not found');
            return;
        }
        
        // Store the original angle value (if it exists) to split it in half
        const originalAngleValue = getAngleValue(angleData);
        const halfAngleValue = originalAngleValue ? (originalAngleValue / 2) : null;
        
        // Use the specific two neighbor points from the angleData (not all neighbors)
        // This ensures we bisect the correct angle when a point has more than 2 neighbors
        if (!angleData.sidepoints || angleData.sidepoints.length !== 2) {
            this.updateStatus('Cannot create bisector: angle data is incomplete');
            return;
        }
        
        // Look up neighbor point objects
        const neighbor1 = this.pointsMap.get(angleData.sidepoints[0]);
        const neighbor2 = this.pointsMap.get(angleData.sidepoints[1]);
        
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
        if (!angleData.groupElement) {
            // Create the angle visualization first
            this.createAngle(point, neighbor1, neighbor2)
            
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
        let closestDistance = Infinity;
        let closestIntersection: Position | undefined;
        let intersectedEdge: EdgeIntersection | undefined;
        
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
                    intersectedEdge = { edge, point1, point2 } as EdgeIntersection;
                }
            }
        });
        
        // Draw the bisector line
        let bisectorEndX: number = endX;
        let bisectorEndY: number = endY;
        
        if (closestIntersection && intersectedEdge) {
            bisectorEndX = closestIntersection.x;
            bisectorEndY = closestIntersection.y;
            const newPoint = this.createPoint(closestIntersection.x, closestIntersection.y);

            // Create edge from point to new point (the bisector edge)
            this.createEdge(point.id, newPoint.id);

            const neighbor1Id = neighbors[0].id;
            const neighbor2Id = neighbors[1].id;
            const newPointId = newPoint.id;
            
            // Create angle keys: point-neighborA-neighborB where neighbors are sorted
            // First angle: point with neighbor1 and newPoint
            const angle1NeighborIds = [neighbor1Id, newPointId].sort((a: string, b: string) => a.localeCompare(b));
            const bisectedAngle1Key = `${point.id}-${angle1NeighborIds[0]}-${angle1NeighborIds[1]}`;
            
            // Second angle: point with neighbor2 and newPoint
            const angle2NeighborIds = [neighbor2Id, newPointId].sort((a: string, b: string) => a.localeCompare(b));
            const bisectedAngle2Key = `${point.id}-${angle2NeighborIds[0]}-${angle2NeighborIds[1]}`;
            
            
            // Store this as a pair of linked angles (bidirectional)
            if (!this.linkedAngles) {
                this.linkedAngles = new Map<string, string>();
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
                a.pointId === point.id && (
                    (a.sidepoints[0] === neighbors[0].id && a.sidepoints[1] === newPoint.id) ||
                    (a.sidepoints[0] === newPoint.id && a.sidepoints[1] === neighbors[0].id) ||
                    (a.sidepoints[0] === neighbors[1].id && a.sidepoints[1] === newPoint.id) ||
                    (a.sidepoints[0] === newPoint.id && a.sidepoints[1] === neighbors[1].id)
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
                if (angle.groupElement) {
                    const textEl = angle.groupElement.querySelector('text');
                    if (textEl) {
                        textEl.textContent = getAngleDisplayText(angle);
                    }
                }
            });
            
            // Create angles at the new intersection point
            // The newPoint now has 3 neighbors: point, intersectedEdge.point1, intersectedEdge.point2
            // Use autoCreateAnglesForEdge to ensure all angles are created correctly
            
            // Create angles for the bisector edge (A-D)
            this.autoCreateAnglesForEdge([point.id, newPoint.id]);
            
            // Create angles for the first segment of split edge (B-D)
            const { point1, point2 } = intersectedEdge;
            this.autoCreateAnglesForEdge([point1.id, newPoint.id]);
            
            // Create angles for the second segment of split edge (D-C)
            this.autoCreateAnglesForEdge([point2.id, newPoint.id]);
            
            // Update triangles (will detect the newly created triangles)
            this.updateTriangles();
            
            this.updateStatus(`Bisector created with intersection point ${newPoint.id}, angles created at intersection`);
        } else {
            // No intersection, draw to canvas edge
            const svgRect = this.svg.getBoundingClientRect();
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
            alert('No intersection found');
        }
        
        this.saveState();
    }
    
    // Note: lineIntersection, getUnusedGreekLetter, and clipLineToCanvas
    // have been moved to mathHelper.mjs and are imported from there.

    public saveState() {
        const state: HistoryState = {
            points: this.points.map(p => {
                const point: SavedPoint = { id: p.id, x: p.x, y: p.y };
                if (p.hide) point.hide = true;
                return point;
            }),
            edges: this.edges.map(e => {
                const edge: SavedEdge = { points: [...e.points] };
                if (e.hide) edge.hide = true;
                return edge;
            }),
            circles: this.circles.map(c => {
                const circle: SavedCircle = {
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
            angles: this.angles.map(a => {
                const angle: SavedAngle = {
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
            bisectedAngles: Array.from(this.bisectedAngles),
            linkedAngles: Array.from(this.linkedAngles.entries()),
            lines: deepClone(this.lines),
            definitions: deepClone(this.definitions),
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
    
    public undo() {
        if (this.historyIndex > 0) {
            this.historyIndex--;
            const state = this.history[this.historyIndex];
            this.restoreState(state);
            this.updateStatus('↶ Undo');
        } else {
            this.updateStatus('Nothing to undo');
        }
    }
    
    public redo() {
        if (this.historyIndex < this.history.length - 1) {
            this.historyIndex++;
            this.restoreState(this.history[this.historyIndex]);
            this.updateStatus('↷ Redo');
        } else {
            this.updateStatus('Nothing to redo');
        }
    }
    
    public restoreState(state: HistoryState) {
        // Clear current SVG content
        this.ui.canvas.clearContent();
        
        // Restore data - round coordinates to prevent decimal values
        this.points = state.points.map(p => ({
            ...p,
            x: Math.round(p.x),
            y: Math.round(p.y)
        }));
        // Don't restore bisectedAngles yet - wait until after angles are created
        this.linkedAngles = new Map(state.linkedAngles);
        
        // Rebuild pointsMap for O(1) lookups
        this.pointsMap.clear();
        this.points.forEach(point => {
            this.pointsMap.set(point.id, point);
        });
        
        // Restore point name visibility setting
        if (state.showPointNames !== undefined) {
            this.showPointNames = state.showPointNames;
            const btn = this.ui.toolbar.getButton('toggleNames');
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
            const pointIds = edgeData.points;
            const point1 = this.pointsMap.get(pointIds[0]);
            const point2 = this.pointsMap.get(pointIds[1]);
            
            if (point1 && point2) {
                this.createEdge(point1.id, point2.id, edgeData.hide);
            }
        });
        
        // Restore circles
        this.circles = [];
        state.circles.forEach(circleData => {
            // Support multiple formats for backward compatibility
            const { centerPoint: centerPointId, pointsOnLine } = circleData;
            const centerPoint = this.pointsMap.get(centerPointId);
            
            // Validate that all points on line exist
            const validPointsOnLine = pointsOnLine.filter(id => this.pointsMap.get(id));
            
            if (centerPoint) {
                this.createCircle({
                    id: Math.random().toString(36).substring(2, 15),
                    ...circleData,
                    pointsOnLine: validPointsOnLine,
                    element: null // Will be set after rendering
                });
            }
        });
        
        // Restore angles
        // First, remove all existing angle DOM elements
        this.angles.forEach(angle => {
            if (angle.groupElement) {
                angle.groupElement.remove();
            }
        });
        
        // Clear bisectedAngles temporarily to allow all angles to be recreated
        this.bisectedAngles = new Set();
        this.angles = [];
        
        // Recreate ALL possible angles based on current geometry
        // This ensures all angles are created, not just those in the saved state
        this.recreateAllAngles();
        
        // Now apply saved angle properties (value, label, radius, hide) to the recreated angles
        state.angles.forEach(angleData => {
            const angle = this.angles.find(a => 
                isThisAngle(a, angleData.pointId, angleData.sidepoints[0], angleData.sidepoints[1])
            );
            
            if (angle) {
                if (angleData.value) {
                    angle.value = angleData.value;
                    if (angle.groupElement) {
                        const textEl = angle.groupElement.querySelector('text');
                        if (textEl) {
                            textEl.textContent = angleData.value + '°';
                        }
                    }
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
                    this.redrawAngleArc(angle);
                }
                // Handle hide property
                if (angleData.hide) {
                    angle.hide = true;
                    if (angle.groupElement) {
                        angle.groupElement.classList.add('hide');
                    }
                }
            }
        });
        
        // Now restore bisectedAngles after all angles are created
        this.bisectedAngles = new Set(state.bisectedAngles);

        // Restore lines
        this.lines = state.lines ? deepClone(state.lines) : [];

        // Restore definitions
        this.definitions = state.definitions ? deepClone(state.definitions) : [];
        
        this.selectedPoints = [];
        this._batchUpdatingTriangles = false; // Re-enable triangle updates
        this.updateTriangles(); // Update triangles once after all edges are restored
        this.updateUndoRedoButtons();
    }
    
    public updateUndoRedoButtons() {
        const undoBtn = this.ui.toolbar.getButton('undo');
        const redoBtn = this.ui.toolbar.getButton('redo');

        if (!undoBtn || !redoBtn) {
            throw new Error('undoBtn or redoBtn not found');
        }

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

    public updateStatus(message: string) {
        this.messagingHub.emit(Messages.STATUS_UPDATE, message);
    }

    public updateAngle(data: UpdateAngleData) {
        const { angle, name, label, value, radius } = data;
        let linkedUpdated = false;
        
        // Update name
        if (name !== undefined) {
            angle.name = name;
        }
        
        // Update label (allow empty string to clear label)
        if (label !== undefined) {
            angle.label = label;
            // Update text display when label changes
            if (angle.groupElement) {
                const textEl = angle.groupElement.querySelector('text');
                if (textEl) {
                    textEl.textContent = getAngleDisplayText(angle);
                }
            }
            
            // Propagate label to overlapping angles (angles that represent the same geometric angle)
            if (this.overlappingAngles && this.overlappingAngles.has(angle.id)) {
                const overlappingSet = this.overlappingAngles.get(angle.id) || [];
                overlappingSet.forEach(overlapId => {
                    if (overlapId !== angle.id) {
                        const overlapAngle = this.angles.find(a => a.id === overlapId);
                        if (overlapAngle) {
                            overlapAngle.label = label;
                            // Update text display for overlapping angle
                            if (overlapAngle.groupElement) {
                                const textEl = overlapAngle.groupElement.querySelector('text');
                                if (textEl) {
                                    textEl.textContent = getAngleDisplayText(overlapAngle);
                                }
                            }
                        }
                    }
                });
                linkedUpdated = true;
            }
        }
        
        // Update value
        if (value) {
            angle.value = value;
            
            // Update text element if it exists (won't exist for hidden overlapping angles)
            if (angle.groupElement) {
                const textEl = angle.groupElement.querySelector('text');
                if (textEl) {
                    textEl.textContent = getAngleDisplayText(angle);
                }
                // Redraw the arc in case it needs to change from arc to square corner (or vice versa)
                this.redrawAngleArc(angle);
            }
            
            // Check if this angle has overlapping angles
            if (this.overlappingAngles && this.overlappingAngles.has(angle.id)) {
                const overlappingSet = this.overlappingAngles.get(angle.id) || [];
                overlappingSet.forEach(overlapId => {
                    if (overlapId !== angle.id) {
                        const overlapAngle = this.angles.find(a => a.id === overlapId);
                        if (overlapAngle) {
                            overlapAngle.value = value;
                            // Update text/arc only if they exist (for visible angles)
                            if (overlapAngle.groupElement) {
                                const textEl = overlapAngle.groupElement.querySelector('text');
                                if (textEl) {
                                    textEl.textContent = getAngleDisplayText(overlapAngle);
                                }
                                this.redrawAngleArc(overlapAngle);
                            }
                        }
                    }
                });
                linkedUpdated = true;
            }
            
            // Check if this angle has a linked angle (from bisection)
            if (this.linkedAngles && angle.sidepoints) {
                const neighborIds = [...angle.sidepoints].sort((a, b) => a.localeCompare(b));
                const angleKey = `${angle.pointId}-${neighborIds[0]}-${neighborIds[1]}`;
                
                const linkedAngleKey = this.linkedAngles.get(angleKey);
                
                if (linkedAngleKey) {
                    const linkedAngle = this.angles.find(a => {
                        if (a.sidepoints) {
                            const linkedNeighborIds = [...a.sidepoints].sort((a, b) => a.localeCompare(b));
                            const key = `${a.pointId}-${linkedNeighborIds[0]}-${linkedNeighborIds[1]}`;
                            return key === linkedAngleKey;
                        }
                        return false;
                    });
                    
                    if (linkedAngle) {
                        linkedAngle.value = value;
                        if (linkedAngle.groupElement) {
                            const textEl = linkedAngle.groupElement.querySelector('text');
                            if (textEl) {
                                textEl.textContent = getAngleDisplayText(linkedAngle);
                            }
                            // Also redraw the linked angle
                            this.redrawAngleArc(linkedAngle);
                        }
                        linkedUpdated = true;
                    }
                }
            }
        } else {
            angle.value = null;
            if (angle.groupElement) {
                const textEl = angle.groupElement.querySelector('text');
                if (textEl) {
                    textEl.textContent = getAngleDisplayText(angle);
                }
                // Redraw in case it was a 90-degree angle that should no longer be a square
                this.redrawAngleArc(angle);
            }
            
            // Clear value for overlapping angles too
            if (this.overlappingAngles && this.overlappingAngles.has(angle.id)) {
                const overlappingSet = this.overlappingAngles.get(angle.id) || [];
                overlappingSet.forEach(overlapId => {
                    if (overlapId !== angle.id) {
                        const overlapAngle = this.angles.find(a => a.id === overlapId);
                        if (overlapAngle) {
                            overlapAngle.value = null;
                            if (overlapAngle.groupElement) {
                                const textEl = overlapAngle.groupElement.querySelector('text');
                                if (textEl) {
                                    textEl.textContent = getAngleDisplayText(overlapAngle);
                                }
                                this.redrawAngleArc(overlapAngle);
                            }
                        }
                    }
                });
            }
        }
        
        // Update radius if changed
        if (!isNaN(radius) && radius >= 10 && radius <= 100) {
            angle.radius = radius;
            this.redrawAngleArc(angle);
        }
        
        if (linkedUpdated) {
            this.updateStatus('Angle values updated (both bisected angles)');
        } else {
            this.updateStatus('Angle value updated');
        }
        
        this.saveState();
    }
   
    public loadData(rawData: SerializedGeometryData) {
        // Deserialize and normalize the data
        const data = deserializeGeometryData(rawData);
        
        // Validate the data
        const validation: ValidationResult = validateGeometryData(data);
        if (!validation.isValid) {
            console.error('Data validation failed:', validation.errors);
            this.updateStatus('❌ Invalid data format');
            return;
        }
        
        // Clear current state
        this.ui.canvas.clearContent();
        const {
            adjacentPoints,
            angles,
            circles,
            definitions,
            edges,
            lines,
            points,
            pointsMap,
            overlappingAngles,
            triangles
        } = enrichGeometryData(data, this.scale);


        this.definitions = definitions;
        this.adjacentPoints = adjacentPoints;
        this.points = points;
        this.circles = [];
        this.edges = [];
        this.angles = [];
        this.lines = [];
        this.selectedPoints = [];
        this.bisectedAngles.clear();
        this.linkedAngles.clear();
        this.overlappingAngles = overlappingAngles;
        this.triangles = triangles;
        this.overlappingAngles = overlappingAngles;
        this.pointsMap = pointsMap;
        // add lines
        lines.forEach(linePoints => {
            this.addLine(linePoints);
        });

        // Draw points
        const circleCenterPoints = (data.circles || []).map(circle => circle.centerPoint);
        this.points.forEach(point => {
            if (!circleCenterPoints.includes(point.id) && this.mode === 'solver') {
                point.hide = true;
            }
            this.drawPoint(point);
        });
        
        // draw edges
        edges.forEach(edge => {
            this.createEdge(edge.points[0], edge.points[1], edge.hide);
        });
        
        // Restore circles
        circles.forEach(circle => {
            this.createCircle(circle);
        });
     
        // Restore angles - manually recreate only the angles that existed in the saved data
        const orderedAngles = angles.slice().sort((a: Angle, b: Angle) => b.calculatedValue! - a.calculatedValue!);
        orderedAngles.forEach(angleData => {
            this.angles.push(angleData);
            this.renderAngleArc(angleData);
        });
        
        // Reset history and save the loaded state
        this.history = [];
        this.historyIndex = -1;
        this.saveState();
    }

    public handlePointCreateRequest(data: PointCreateRequestData) {
        const { fromPoint, distance: distanceValue, angle: angleValue, newX, newY } = data;
        
        // Validate fromPoint
        if (!fromPoint || !fromPoint.id) {
            console.error('handlePointCreateRequest: fromPoint is undefined or missing id', data);
            this.updateStatus('❌ Error: Invalid source point');
            return;
        }
        
        // Create the new point
        const newPoint = this.createPoint(newX, newY);
        
        // Create edge between points
        this.createEdge(fromPoint.id, newPoint.id);
        
        // Check if the new point should be added to ANY existing lines (based on position)
        // This handles multiple lines through the same point (e.g., vertical + horizontal)
        this.checkPointOnLines(newPoint);
        
        // Check if we should CREATE a new line with adjacent points
        // Find if fromPoint is in any existing line
        const existingLine = this.lines.find(line => line.points.includes(fromPoint.id));
        
        // Only try to create new lines if newPoint wasn't added to fromPoint's line
        let addedToExistingLine = existingLine && existingLine.points.includes(newPoint.id);
        
        // If not added to existing line, check if we should CREATE a new line
        // This handles the case where fromPoint is in one line (e.g., vertical)
        // but newPoint forms a different line (e.g., horizontal) with other adjacent points
        if (!addedToExistingLine) {
            const adjacentPointsSet = this.adjacentPoints.get(fromPoint.id) || new Set();
            const adjacentPoints = Array.from(adjacentPointsSet);
            
            for (const adjacentId of adjacentPoints) {
                if (adjacentId === newPoint.id) continue; // Skip the edge we just created
                
                // Skip if this adjacent point is already in a line with fromPoint and newPoint
                const alreadyInLine = this.lines.some(line => isPointsOnSameLine(line, fromPoint.id, adjacentId, newPoint.id));
                if (alreadyInLine) continue;
                
                const adjacentPoint = this.pointsMap.get(adjacentId);
                if (!adjacentPoint) continue;
                
                // Check if fromPoint, newPoint, and adjacentPoint are collinear using existing helper
                if (arePointsCollinearByPosition(fromPoint, newPoint, adjacentPoint, 1)) {
                    const newLinePoints = sortLinePoints([fromPoint.id, newPoint.id, adjacentPoint.id], this.pointsMap);
                    this.addLine(newLinePoints);
                    break; // Only create one line per new point
                }
            }
        }
        
        // Check if the new point should be added to any circles
        // NOTE: This geometric check requires distance calculation (not angle calculation)
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
            
            // Calculate distance from circle center to new point
            const centerPoint = this.pointsMap.get(circle.centerPoint);
            if (!centerPoint) {
                return;
            }
            
            const distanceFromCenter = Math.sqrt(
                Math.pow(newPoint.x - centerPoint.x, 2) + 
                Math.pow(newPoint.y - centerPoint.y, 2)
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
        
        // Recreate all angles to ensure angles at other vertices are also created
        // This handles cases where the new point intersects existing lines
        this.recreateAllAngles();
        
        this.updateStatus(`✓ Point ${newPoint.id} created at ${distanceValue}px, ${angleValue}° from ${fromPoint.id}`);
        this.saveState();
    }
}

