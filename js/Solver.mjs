// Geometry Drawing Tool
// Messaging
import { MessagingHub, Messages } from './MessagingHub.mjs';

import { solve } from './utils/solve.mjs';

// Utils
import { 
    arePointsCollinear, 
    arePointsCollinearByPosition, 
    isAngleInTriangleByEdges,
    calculateAngleDegrees,
    distance,
    findPointNeighbors,
    findNearbyEdges,
    getAngleValue,
    getHighlightableElements,
    getNewPointName,
    getTriangles,
    increaseAngleRadius,
    insertPointBetweenEdgePointsInLine,
    isEdgeOnThisLine,
    isPointInsideAngle,
    isPointInTriangle, 
    isPointOnCircle,
    isPointsOnSameLine,
    isThisAngle,
    normalizeAngle,
    pointToSegmentDistance,
    getAngleCalculatedInfo,
    getAngleDisplayText,
    getAngleNameFromPoints,
    getSameAngleNames,
    sortLinePoints,
} from './utils/mathHelper.mjs';
import {
    createElement,
} from './utils/domHelper.mjs';
import {
    CREATOR_ONLY_CLASS,
    renderCircle,
    renderEdge,
    renderPointGroup,
} from './utils/elementHelper.mjs';
import {
    enrichGeometryData,
    deserializeGeometryData,
    deserializeStateFromUrl,
    validateGeometryData,
} from './utils/dataSerializer.mjs';
import { deepClone } from './utils/objectHelper.mjs';

// UI
import { UI } from './UI/index.mjs';
import { initDraggablePanels } from './UI/DraggablePanel.mjs';
import { ResultPanel } from './UI/panels/ResultPanel.mjs';

export class Solver {
    constructor(initialProblem = null) {
        this.initialProblem = initialProblem;
        this.initialData = null;

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
        
        // Subscribe to messages
        this.setupMessageSubscriptions();
        
        this.initialize();
    }

    setupMessageSubscriptions = () => {
        // Toolbar events
        this.messagingHub.subscribe(Messages.TOOL_SELECTED, (tool) => this.setTool(tool));
        this.messagingHub.subscribe(Messages.TOGGLE_NAMES, () => this.togglePointNames());

        this.messagingHub.subscribe(Messages.UNDO_REQUESTED, () => this.undo());
        this.messagingHub.subscribe(Messages.REDO_REQUESTED, () => this.redo());
        this.messagingHub.subscribe(Messages.CLEAR_REQUESTED, () => this.clear());

        // Canvas events
        this.messagingHub.subscribe(Messages.CANVAS_CLICKED, (data) => this.handleCanvasClick(data.event));
        this.messagingHub.subscribe(Messages.POINT_CLICKED, (data) => this.handlePointClick(data.point));
        this.messagingHub.subscribe(Messages.ANGLE_CLICKED, (data) => this.handleAngleClick(data.angleData));

        // Point events
        this.messagingHub.subscribe(Messages.POINT_CREATE_REQUESTED, (data) => this.handlePointCreateRequest(data));
        
        // Point dragging - update connected edges and angles in real-time
        this.messagingHub.subscribe(Messages.POINT_DRAGGING, this.handlePointDragging);
        
        // Point moved - check if point is on edge or circle (after drag completes)
        this.messagingHub.subscribe(Messages.POINT_MOVED, this.handlePointMoved);

        // Edge events
        this.messagingHub.subscribe(Messages.EDGE_UPDATED, (data) => this.updateEdge(data));
        this.messagingHub.subscribe(Messages.EDGE_DELETE_REQUESTED, (edgeObj) => this.deleteEdge(edgeObj));

        // Status updates (from UI components)
        this.messagingHub.subscribe(Messages.STATUS_UPDATED, (message) => this.updateStatus(message));
        
    }

    handlePointDragging = (data) => {
        const { point } = data;
        
        // Update all edges connected to this point
        this.edges.forEach(edge => {
            if (edge.points.includes(point.id)) {
                const p1 = this.pointsMap.get(edge.points[0]);
                const p2 = this.pointsMap.get(edge.points[1]);
                if (p1 && p2 && edge.element) {
                    edge.element.setAttribute('x1', p1.x);
                    edge.element.setAttribute('y1', p1.y);
                    edge.element.setAttribute('x2', p2.x);
                    edge.element.setAttribute('y2', p2.y);
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
    };

    handlePointMoved = (data) => {
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
    };

    addPoint = (point) => {
        this.points.push(point);
        this.pointsMap.set(point.id, point);
    }

    addLine = (linePoints) => {
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

    checkPointIntersections = (point, { fixPointPosition } = {}) => {
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
            edges = edges.filter(e => result.intersectedEdges.includes(e.id));
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
                const points = sortLinePoints([...line.points, point.id], this.pointsMap);
                line.points = points;
                edges = edges.filter(e => !isEdgeOnThisLine(e, line));
            });
        }
        // edges being collinear with new point but the point is not in between edge points
        if (edges.length > 0) {
            edges.forEach(edge => {
                const existingLine = this.lines.find(l => isEdgeOnThisLine(edge, l));
                if (existingLine) {
                    lines = lines.filter(l => l.id !== existingLine.id);
                    const points = sortLinePoints([...existingLine.points, point.id], this.pointsMap);
                    existingLine.points = points;
                } else {
                    const points = sortLinePoints([...edge.points, point.id], this.pointsMap);
                    this.addLine(points);
                }
            });
        }
    }

    fixPointPositionOnEdges = (point, intersectedEdges) => {
        const avgPosition = intersectedEdges.reduce((acc, edge) => {
            const [edgePoint1, edgePoint2] = edge.points.map(pid => this.pointsMap.get(pid));
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
            const circle = pointGroup.querySelector('circle');
            const text = pointGroup.querySelector('text');
            if (circle) {
                circle.setAttribute('cx', point.x);
                circle.setAttribute('cy', point.y);
            }
            if (text) {
                text.setAttribute('x', point.x);
                text.setAttribute('y', point.y - 12);
            }
        }
    }

    createEdge = (point1Id, point2Id) => {
        // Create edge between points
        const fromPoint = this.pointsMap.get(point1Id);
        const toPoint = this.pointsMap.get(point2Id);
        const line = renderEdge(fromPoint, toPoint);
        this.svgGroup.edge.appendChild(line);
        const newEdge = {
            id: Math.random().toString(36),
            points: [fromPoint.id, toPoint.id],
            element: line
        };
        this.edges.push(newEdge);
        
        // Update adjacency map for the new edge
        this.addAdjacentPoint(fromPoint.id, toPoint.id);
        this.addAdjacentPoint(toPoint.id, fromPoint.id);
        return newEdge;
    }

    updateStatus = (message) => {
        this.messagingHub.emit(Messages.STATUS_UPDATE, message);
    }

    initialize = () => {
        // create UI
        this.ui.initialize();
        this.svg = this.ui.canvas.svg;
        this.svgGroup = this.ui.canvas.svgGroup;

        // Initialize toolbar buttons - use messaging hub
        const { registerButton, registerFeedback } = this.ui.toolbar;
        registerFeedback();
        registerButton('drawPoint', () => this.messagingHub.emit(Messages.TOOL_SELECTED, 'addPoint'));
        registerButton('drawCircle', () => this.messagingHub.emit(Messages.TOOL_SELECTED, 'drawCircle'));
        registerButton('drawEdge', () => this.messagingHub.emit(Messages.TOOL_SELECTED, 'drawEdge'));

        registerButton('undo', () => this.messagingHub.emit(Messages.UNDO_REQUESTED));
        registerButton('redo', () => this.messagingHub.emit(Messages.REDO_REQUESTED));

        const { registerPanel } = this.ui.panels;
        registerPanel('result', ResultPanel);
                
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
        
        // Save initial empty state
        this.saveState();
        
        // Initialize draggable panels
        initDraggablePanels();

        this.initProblem();
    }

    initProblem = () => {
        const data = deserializeStateFromUrl(this.initialProblem);
        if (data) {
            this.loadData(data);
        }

        const targetAngle = this.angles.find(a => a.target);
        if (!targetAngle) { return; }
        const clonedData = deepClone({
            angles: this.angles,
            lines: this.lines,
            points: this.points,
            triangles: this.triangles.map(tri => Array.from(tri)),
            circles: this.circles
        });

        const { solved, score } = solve(clonedData, {
            setAngle: () => { },
            maxIterations: 100
        });

        this.ui.toolbar.updateFeedback(score || '-');
        if (!solved) { alert('Warning: Problem could not be fully solved with the given data.'); return; }

        const solvedAngle = clonedData.angles.find(a => a.name === targetAngle.name);
        this.ui.panels.getPanel('result').updatePanel(
            targetAngle,
            solvedAngle
        );
    }
    

    setTool = (tool) => {
        this.currentTool = tool;
        this.selectedPoints = [];
        
        // Update point selection visuals (removes selected class from all points)
        this.updatePointSelection();
        
        // Update button states
        document.querySelectorAll('.tool-btn').forEach(btn => btn.classList.remove('active'));
        
        if (tool === 'pointer') {
            document.getElementById('pointerBtn').classList.add('active');
            this.updateStatus('Click on points, edges, or angles to edit them');
        } else if (tool === 'addPoint') {
            document.getElementById('drawPointBtn').classList.add('active');
            this.updateStatus('Click on canvas to add points');
        } else if (tool === 'drawCircle') {
            document.getElementById('drawCircleBtn').classList.add('active');
            this.updateStatus('Select center point, then radius point to draw a circle');
        } else if (tool === 'drawEdge') {
            document.getElementById('drawEdgeBtn').classList.add('active');
            this.updateStatus('Select 2 points to draw an edge');
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
        if (e.target === this.svg) {
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
                // do we need this or overkill?
                // const pt = this.getSVGPoint(e);
                // this.findAndBisectAngle(pt.x, pt.y);
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
    checkPointOnLines = (point) => {
        // Track which edges we've already processed (to avoid duplicate lines)
        const processedEdgePairs = new Set();
        
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
            const existingLine = this.lines.find(line => 
                isPointsOnSameLine(line, point1Id, point2Id)
            );
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
    
    drawNewPoint = (x, y) => {
        const pointName = getNewPointName(this.points.length);
        
        const point = {
            id: pointName,
            x: Math.round(x),
            y: Math.round(y)
        };
        
        this.addPoint(point);
        this.drawPoint(point);
        this.checkPointIntersections(point, { fixPointPosition: true });
        this.saveState();
    }
    
    createPoint = (x, y) => {
        const point = {
            id: getNewPointName(this.points.length),
            x: Math.round(x),
            y: Math.round(y)
        };
        
        this.addPoint(point);
        this.drawPoint(point);
        this.checkPointIntersections(point, { fixPointPosition: true });
        this.saveState();
        
        return point;
    }

    drawPoint = (point) => {
        const classes = ['point-group'];
        if (point.hide) classes.push('hide');
        const group = renderPointGroup(point);        
        group.addEventListener('click', (e) => {
            e.stopPropagation();
            this.handlePointClick(point);
        });
        
        // Remove any previous references to this point first
        const existingGroup = this.svgGroup.point.querySelector(`g[data-point-id="${point.id}"]`);
        if (existingGroup) {
            existingGroup.remove();
        }
        
        this.svgGroup.point.appendChild(group);
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
        // First point is center, second point is on the circle
        const centerPoint = this.pointsMap.get(this.selectedPoints[0]);
        const circlePoint = this.pointsMap.get(this.selectedPoints[1]);
        
        if (!centerPoint || !circlePoint) return;
        
        // Calculate radius as distance from center to circle point using utility function
        const radius = Math.round(distance(centerPoint.x, centerPoint.y, circlePoint.x, circlePoint.y));
        
        // Draw circle
        const circle = createElement('circle', {
            class: 'circle-shape',
            cx: Math.round(centerPoint.x),
            cy: Math.round(centerPoint.y),
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
            centerX: Math.round(centerPoint.x), 
            centerY: Math.round(centerPoint.y), 
            radius, 
            centerPoint: centerPoint.id,
            pointsOnLine: pointsOnLine
        });
        
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
    drawEdge = (point1, point2) => {
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
        const line = renderEdge(point1, point2);
       
        // Insert behind points
        this.svg.insertBefore(line, this.svg.firstChild);
        
        const edgeObj = {
            points: [point1.id, point2.id],
            element: line
        };
        
        this.edges.push(edgeObj);
        
        // Update adjacency map
        this.addAdjacentPoint(point1.id, point2.id);
        this.addAdjacentPoint(point2.id, point1.id);
        
        // Auto-create angles at both endpoints where possible
        this.createAnglesForNewEdge(point1.id, point2.id);
        
        this.updateStatus('Edge created');
        this.saveState();
        
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
                            const currentPath = arcElement.getAttribute('d');
                            const updatedPath = increaseAngleRadius(currentPath, 10);
                            if (updatedPath) {
                                arcElement.setAttribute('d', updatedPath);
                                angle.radius = (angle.radius || 30) + 10; // Update the angle object's radius
                            
                                // Mark this angle as split
                                angle.isSplit = true;
                            }
                        }
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
                    const angleExists = this.angles.some(angle => isThisAngle(angle, pointId, neighbor1, neighbor2));
                    
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

    splitEdgeWithPoint = (edge, newPoint) => {
        const [id1, id2] = edge.points;
        const point1 = this.pointsMap.get(id1);
        const point2 = this.pointsMap.get(id2);
        
        if (!point1 || !point2) return;
        
        // Keep the old edge in the array but remove its visual element
        edge.element.remove();
        // Note: We don't remove the edge from this.edges array anymore
        
        // Track collinear points: the new point splits the edge into two segments
        // Check if there's already a line containing both point1 and point2
        const existingLine = this.lines.find(line => 
            line.points.includes(id1) && line.points.includes(id2)
        );
        
        if (existingLine) {
            // Check if newPoint already exists in the line
            if (!existingLine.points.includes(newPoint.id)) {
                // insert into the current position based on distance from the first point
                existingLine.points.push(newPoint.id);
                const firstPoint = this.pointsMap.get(existingLine.points[0]);
                existingLine.points.sort((a, b) => {
                    const aPoint = this.pointsMap.get(a);
                    const bPoint = this.pointsMap.get(b);
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
        const line1 = renderEdge(point1, newPoint);
        this.svg.insertBefore(line1, this.svg.firstChild);
        
        this.edges.push({
            points: [id1, newPoint.id],
            element: line1
        });
        
        // Update adjacency map for first edge
        this.addAdjacentPoint(id1, newPoint.id);
        this.addAdjacentPoint(newPoint.id, id1);
        
        const line2 = renderEdge(newPoint, point2);
        this.svg.insertBefore(line2, this.svg.firstChild);
        
        this.edges.push({
            points: [newPoint.id, id2],
            element: line2
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
        this.saveState();
        
        // Recreate all angles to ensure angles at all vertices are properly created
        this.recreateAllAngles();
        
        return newPoint;
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
        this.triangles = getTriangles(this.angles, this.adjacentPoints, this.lines);
    }

    handlePointClick = (point) => {
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
    recreateAllAngles = () => {
        const angleData = [];
        this.points.forEach(point => {
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
                        const calculatedValues = getAngleCalculatedInfo(point, adjPoint1, adjPoint2);
                        if (!calculatedValues) { continue; }
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
    
    createAngle = (vertex, point1, point2) => {
        // Create a unique key for this specific angle
        if (this.angles.some(a => isThisAngle(a, vertex.id, point1.id, point2.id))) {
            return;
        }
        const neighborIds = [point1.id, point2.id].sort((a, b) => a - b);
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
        const calculatedValues = getAngleCalculatedInfo(vertex, point1, point2);
        if (!calculatedValues) { return; }
        const {
            angle1,
            angle2,
            angleDegrees,
            radius
        } = calculatedValues;

        // Normalize to [0, 2π]
        const angleDiff = normalizeAngle(angle2 - angle1);
        
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
        // Show angle if: (in triangle OR supplementary) AND not overlapping
        const shouldHide = false ;//(!isAngleInTriangle && !isSupplementaryAngle);

        // Create angle data object (pure data, no DOM references)
        const angleData = {
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
    createAngleText = (angleData, textElement = null, initialX = null, initialY = null) => {
        const vertex = this.pointsMap.get(angleData.pointId);
        if (!vertex) return null;
        
        const { startAngle, endAngle, radius } = angleData;
        const angleDegrees = angleData.calculatedValue;
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
                
                const existingX = parseFloat(existingTextElement.getAttribute('x'));
                const existingY = parseFloat(existingTextElement.getAttribute('y'));
                
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

    renderAngleArc(angleData) {
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
        
        const text = createElement('text', {
            class: 'angle-text',
            x: textPosition.x,
            y: textPosition.y,
            dy: '0.3em',
            'data-angle-id': angleData.id
        });
        text.textContent = getAngleDisplayText(angleData);
        
        // Add path and text to the group
        group.appendChild(path);
        group.appendChild(text);
        
        // Store the group element reference
        angleData.groupElement = group;

        // we not mount if it is not visible
        if (angleData.hide) {
            return;
        }
        
        // Insert into angle group, sorted by radius (larger first so smaller appears on top)
        const angleElements = this.svgGroup.angle.querySelectorAll('.angle-group');
    
        // Find first element with attribute value < newValue
        let insertAfter = null;
        for (const angleElement of angleElements) {
            const childValue = parseFloat(angleElement.getAttribute('data-angle-radius'));
            if (childValue < angleData.radius) {
                insertAfter = angleElement;
                break;
            }
        }

        if (insertAfter) {
            this.svgGroup.angle.insertBefore(group, insertAfter.nextSibling);
        } else {
            this.svgGroup.angle.appendChild(group);
        }
    }

    redrawAngleArc = (angleData) => {
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
        arcElement.setAttribute('d', pathData);
        
        // ✅ REFACTORED: Use the helper method to get updated text position
        const textPosition = this.createAngleText(angleData, textElement);
        
        textElement.setAttribute('x', textPosition.x);
        textElement.setAttribute('y', textPosition.y);
    }
    
    // Creates angles at each endpoint of an edge where the endpoint has 2+ neighbors.
    // For each pair of neighbors, checks if they're collinear (skips if so) and if angle exists.
    // Sorts angle pairs by size (largest first) so smaller angles render on top.
    // Creates all valid angles using createAngle().
    autoCreateAnglesForEdge = (edgePointIds) => {

        // For each point in the edge, check if it now has 2+ neighbors
        edgePointIds.forEach(pointId => {
            const point = this.pointsMap.get(pointId);
            if (!point) return;
            
            // Find all neighbors of this point
            const neighbors = findPointNeighbors(point, this.edges, this.pointsMap);
            
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
   
    // Delegates to historyManager to save the current state for undo/redo.
    saveState = () => {
        const state = {
            points: this.points.map(p => {
                const point = { id: p.id, x: p.x, y: p.y };
                if (p.hide) point.hide = true;
                return point;
            }),
            edges: this.edges.map(e => {
                const edge = { points: [...e.points] };
                if (e.hide) edge.hide = true;
                return edge;
            }),
            circles: this.circles.map(c => {
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
            angles: this.angles.map(a => {
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
                if (a.target) angle.target = true;
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
    
    undo = () => {
        if (this.historyIndex > 0) {
            this.historyIndex--;
            const state = this.history[this.historyIndex];
            this.restoreState(state);
            this.updateStatus('↶ Undo');
        } else {
            this.updateStatus('Nothing to undo');
        }
    }
    
    redo = () => {
        if (this.historyIndex < this.history.length - 1) {
            this.historyIndex++;
            this.restoreState(this.history[this.historyIndex]);
            this.updateStatus('↷ Redo');
        } else {
            this.updateStatus('Nothing to redo');
        }
    }
    
    restoreState = (state) => {
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
                const line = renderEdge(point1, point2, edgeData.hide ? [CREATOR_ONLY_CLASS] : []);
                this.svg.insertBefore(line, this.svg.firstChild);
                
                const edgeObj = {
                    hide: edgeData.hide, 
                    points: [pointIds[0], pointIds[1]],
                    element: line
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
            // Support multiple formats for backward compatibility
            let centerPointId, pointsOnLine;
            
            if (circleData.centerPoint !== undefined) {
                // New format
                centerPointId = circleData.centerPoint;
                pointsOnLine = circleData.pointsOnLine || [];
            }
            
            // Also include old 'points' array if it exists
            if (circleData.points && Array.isArray(circleData.points)) {
                pointsOnLine = [...new Set([...pointsOnLine, ...circleData.points])];
            }
            
            const centerPoint = this.pointsMap.get(centerPointId);
            
            // Validate that all points on line exist
            const validPointsOnLine = pointsOnLine.filter(id => this.pointsMap.get(id));
            
            if (centerPoint) {
                const circleObj = {
                    ...circleData,
                    pointsOnLine: validPointsOnLine,
                    element: null // Will be set after rendering
                };
                if (!circleObj.hide) {
                    circleObj.element = renderCircle(circleObj);
                    this.svg.appendChild(circleObj.element);
                }
                
                this.circles.push(circleObj);
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
        
        // Now apply saved angle properties (value, label, radius, hide, target) to the recreated angles
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
                // Handle target property
                if (angleData.target) {
                    angle.target = true;
                    if (angle.groupElement) {
                        angle.groupElement.classList.add('target-angle');
                    }
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
        this.svgGroup.point.querySelectorAll('.point-label').forEach(label => {
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
        } = enrichGeometryData(data);


        this.definitions = definitions;
        this.adjacentPoints = adjacentPoints;
        this.points = points;
        this.circles = circles;
        this.edges = edges;
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
        this.points.forEach(point => {
            this.drawPoint(point);
        });
        
        // draw edges
        this.edges.forEach(edge => {
            const pointIds = edge.points;
            const point1 = this.pointsMap.get(pointIds[0]);
            const point2 = this.pointsMap.get(pointIds[1]);
            // Rebuild adjacentPoints map
            const line = renderEdge(point1, point2, edge.hide ? ['hide'] : []);
            this.ui.canvas.svg.insertBefore(line, this.ui.canvas.svg.firstChild);
            edge.element = line;
        });
        
        // Restore circles
        this.circles.forEach(circle => {
            if (!circle.hide) {
                circle.element = renderCircle(circle);
                this.ui.canvas.svg.appendChild(circle.element);
            }
        });
     
        // Restore angles - manually recreate only the angles that existed in the saved data
        const orderedAngles = angles.slice().sort((a, b) => b.calculatedValue - a.calculatedValue);
        orderedAngles.forEach(angleData => {
            this.angles.push(angleData);
            this.renderAngleArc(angleData);
        });
        
        // Reset history and save the loaded state
        this.history = [];
        this.historyIndex = -1;
        this.saveState(); 
    }

    handlePointCreateRequest = (data) => {
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
                    const newLinePoints = sortLinePoints([fromPoint, newPoint, adjacentPoint], this.pointsMap);
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
    
    updateEdge = (data) => {
        const { edgeObj } = data;
        this.updateStatus('Edge updated');
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

