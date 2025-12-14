import type { 
    Point, 
    Edge, 
    Circle, 
    Angle, 
    Line, 
    Triangle,
    AngleCalculatedInfo,
    NearbyEdge,
    HighlightableElements,
    Position
} from '../types';

// Math helper functions for geometry calculations
const TOLERANCE = 10;
const DETECTION_THRESHOLD = 3;

// Generates a point name from an index (A, B, C, ..., Z, then wraps back to A).
export function getNewPointName(index: number): string {
    return String.fromCharCode(65 + (index % 26));
}

export const getAngleNameFromPoints = (vertexId: string, point1Id: string, point2Id: string): string => {
    return `∠${point1Id}${vertexId}${point2Id}`;
};

interface ExtendedLine {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
}

export const extendLine = (p1: Point, p2: Point, maxWidth: number, maxHeight: number): ExtendedLine => {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    const ux = dx / len;
    const uy = dy / len;
    const ext = Math.sqrt(maxWidth ** 2 + maxHeight ** 2);

    return {
        x1: p1.x - ux * ext,
        y1: p1.y - uy * ext,
        x2: p2.x + ux * ext,
        y2: p2.y + uy * ext,
    };
};

export const isPointOnLineDistance = (
    x1: number, y1: number, 
    x2: number, y2: number, 
    px: number, py: number, 
    threshold: number = DETECTION_THRESHOLD
): boolean => {
    const numerator = Math.abs((y2 - y1) * px - (x2 - x1) * py + x2 * y1 - y2 * x1);
    const denominator = Math.sqrt((y2 - y1) ** 2 + (x2 - x1) ** 2);
    const distance = numerator / denominator;
    return distance <= threshold;
};

// Calculates Euclidean distance between two points (x1, y1) and (x2, y2).
export function distance(x1: number, y1: number, x2: number, y2: number): number {
    return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
}

// Finds intersection point between two line segments
export function lineIntersection(
    x1: number, y1: number, x2: number, y2: number,
    x3: number, y3: number, x4: number, y4: number
): Position | null {
    const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
    
    if (Math.abs(denom) < 0.0001) return null; // Lines are parallel
    
    const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;
    const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denom;
    
    if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
        return {
            x: x1 + t * (x2 - x1),
            y: y1 + t * (y2 - y1)
        };
    }
    
    return null;
}

// Returns array of numeric angle values, using 0 for unsolved angles.
export const getSolvedAngleValue = (angles: Angle[]): number[] => {
    return angles.map(angle => (getAngleValue(angle) ?? 0));
};

// Sums the numeric values of all angles, treating unsolved as 0.
export const sumOfSolvedAnglesValue = (angles: Angle[]): number => {
    return getSolvedAngleValue(angles).reduce((sum, angle) => sum + angle, 0);
};

// Filters and returns only angles that have no solved numeric value.
export const getUnsolvedAngles = (angles: Angle[]): Angle[] => {
    return angles.filter(angle => {
        const v = getAngleValue(angle);
        return v === null || v === undefined;
    });
};

interface SegmentDistanceResult {
    distance: number;
    closestPoint: { x: number; y: number };
}

// Calculates the shortest distance from point (px, py) to line segment (x1,y1)-(x2,y2).
export function pointToSegmentDistance(
    px: number, py: number, 
    x1: number, y1: number, 
    x2: number, y2: number
): SegmentDistanceResult {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const lengthSquared = dx * dx + dy * dy;
    
    if (lengthSquared === 0) {
        const dist = Math.sqrt((px - x1) ** 2 + (py - y1) ** 2);
        return { distance: dist, closestPoint: { x: x1, y: y1 } };
    }
    
    let t = ((px - x1) * dx + (py - y1) * dy) / lengthSquared;
    t = Math.max(0, Math.min(1, t));
    
    const closestX = x1 + t * dx;
    const closestY = y1 + t * dy;
    const distanceVal = Math.sqrt((px - closestX) ** 2 + (py - closestY) ** 2);
    
    return { distance: distanceVal, closestPoint: { x: closestX, y: closestY } };
}

// Clips a line to canvas boundaries and returns the closest intersection point.
export function clipLineToCanvas(
    x1: number, y1: number, 
    x2: number, y2: number, 
    width: number, height: number
): Position | null {
    const intersections: Position[] = [];
    
    const topIntersect = lineIntersection(x1, y1, x2, y2, 0, 0, width, 0);
    if (topIntersect) intersections.push(topIntersect);
    
    const bottomIntersect = lineIntersection(x1, y1, x2, y2, 0, height, width, height);
    if (bottomIntersect) intersections.push(bottomIntersect);
    
    const leftIntersect = lineIntersection(x1, y1, x2, y2, 0, 0, 0, height);
    if (leftIntersect) intersections.push(leftIntersect);
    
    const rightIntersect = lineIntersection(x1, y1, x2, y2, width, 0, width, height);
    if (rightIntersect) intersections.push(rightIntersect);
    
    if (intersections.length > 0) {
        return intersections.reduce((closest, point) => {
            const dist = Math.sqrt(Math.pow(point.x - x1, 2) + Math.pow(point.y - y1, 2));
            const closestDist = Math.sqrt(Math.pow(closest.x - x1, 2) + Math.pow(closest.y - y1, 2));
            return dist < closestDist ? point : closest;
        });
    }
    
    return null;
}

// Calculates the angle in degrees at vertex formed by rays to point1 and point2.
export function calculateAngleDegrees(vertex: Point, point1: Point, point2: Point): number {
    const angle1 = pointToAngle(vertex, point1);
    const angle2 = pointToAngle(vertex, point2);
    
    let angleDiff = angle2 - angle1;
    
    if (angleDiff < 0) angleDiff += 2 * Math.PI;
    if (angleDiff > 2 * Math.PI) angleDiff -= 2 * Math.PI;
    
    let degrees = (angleDiff * 180) / Math.PI;
    
    if (degrees > 180) degrees = 360 - degrees;
    
    return degrees;
}

export function coordinatesToAngle(x1: number, y1: number, x2: number, y2: number): number {
    return Math.atan2(y2 - y1, x2 - x1);
}

export function pointToAngle(point1: Point, point2: Point): number {
    return coordinatesToAngle(point1.x, point1.y, point2.x, point2.y);
}

export function normalizeAngle(angle: number): number {
    while (angle < 0) angle += 2 * Math.PI;
    while (angle >= 2 * Math.PI) angle -= 2 * Math.PI;
    return angle;
}

export function radiansToDegrees(radians: number): number {
    return (radians * 180) / Math.PI;
}

export function degreesToRadians(degrees: number): number {
    return (degrees * Math.PI) / 180;
}

export function arePointsCollinear(pointId1: string, pointId2: string, pointId3: string, lines: Line[]): boolean {
    return lines.some(line => 
        line.points.includes(pointId1) && 
        line.points.includes(pointId2) && 
        line.points.includes(pointId3)
    );
}

export function findOverlappingAngles(
    vertexId: string, 
    neighbor1Id: string, 
    neighbor2Id: string, 
    angles: Angle[], 
    lines: Line[]
): Angle[] {
    return angles.filter(existingAngle => {
        if (existingAngle.pointId !== vertexId) return false;
        
        const sharedNeighbors = existingAngle.sidepoints.filter(
            n => n === neighbor1Id || n === neighbor2Id
        );
        
        if (sharedNeighbors.length !== 1) return false;
        
        const existingOtherNeighbor = existingAngle.sidepoints.find(
            n => n !== sharedNeighbors[0]
        );
        const newOtherNeighbor = (neighbor1Id === sharedNeighbors[0]) ? neighbor2Id : neighbor1Id;
        
        if (!existingOtherNeighbor) return false;
        
        const areCollinear = arePointsCollinear(vertexId, existingOtherNeighbor, newOtherNeighbor, lines);
        
        if (!areCollinear) return false;
        
        let onSameSide = false;
        for (const line of lines) {
            if (line.points.includes(vertexId) && line.points.includes(existingOtherNeighbor) && line.points.includes(newOtherNeighbor)) {
                const vertexIndex = line.points.indexOf(vertexId);
                const existingIndex = line.points.indexOf(existingOtherNeighbor);
                const newIndex = line.points.indexOf(newOtherNeighbor);
                
                const bothBefore = (existingIndex < vertexIndex && newIndex < vertexIndex);
                const bothAfter = (existingIndex > vertexIndex && newIndex > vertexIndex);
                
                onSameSide = bothBefore || bothAfter;
                break;
            }
        }
        
        return onSameSide;
    });
}

export function crossProduct2D(v1x: number, v1y: number, v2x: number, v2y: number): number {
    return v1x * v2y - v1y * v2x;
}

export function triangleArea(p1: Point, p2: Point, p3: Point): number {
    return Math.abs(
        (p2.x - p1.x) * (p3.y - p1.y) - 
        (p3.x - p1.x) * (p2.y - p1.y)
    ) / 2;
}

export function isPointInTriangle(
    px: number, py: number, 
    p1: Point, p2: Point, p3: Point, 
    tolerance: number = 1
): boolean {
    const triangleArea1 = triangleArea(p1, p2, p3);
    
    const subArea1 = Math.abs((p2.x - px) * (p3.y - py) - (p3.x - px) * (p2.y - py)) / 2;
    const subArea2 = Math.abs((p1.x - px) * (p3.y - py) - (p3.x - px) * (p1.y - py)) / 2;
    const subArea3 = Math.abs((p1.x - px) * (p2.y - py) - (p2.x - px) * (p1.y - py)) / 2;
    
    const totalSubArea = subArea1 + subArea2 + subArea3;
    return Math.abs(totalSubArea - triangleArea1) < tolerance;
}

export function isPointOnCircle(point: Position, centerPoint: Position, radius: number, threshold: number = 5): boolean {
    const distanceFromCenter = Math.sqrt(
        Math.pow(point.x - centerPoint.x, 2) + 
        Math.pow(point.y - centerPoint.y, 2)
    );
    
    const distanceFromBorder = Math.abs(distanceFromCenter - radius);
    return distanceFromBorder <= threshold;
}

export function isPointBetweenEdgePoints(
    point: Position, 
    edgePoint1: Position, 
    edgePoint2: Position, 
    threshold: number = DETECTION_THRESHOLD
): boolean {
    const { distance: distToSegment } = pointToSegmentDistance(
        point.x, point.y, 
        edgePoint1.x, edgePoint1.y, 
        edgePoint2.x, edgePoint2.y
    );
    
    if (distToSegment > threshold) {
        return false;
    }
    
    const distToP1 = distance(point.x, point.y, edgePoint1.x, edgePoint1.y);
    const distToP2 = distance(point.x, point.y, edgePoint2.x, edgePoint2.y);
    
    return distToP1 > threshold && distToP2 > threshold;
}

export const isPointsOnSameLine = (line: Line, ...points: string[]): boolean => {
    return points.every(pointId => line.points.includes(pointId));
};

export const isEdgeOnThisLine = (edge: Edge, line: Line): boolean => {
    return isPointsOnSameLine(line, edge.points[0], edge.points[1]);
};

export function insertPointBetweenEdgePointsInLine(
    line: Line, 
    edgePoints: [string, string], 
    pointId: string
): boolean {
    if (!line || !line.points || !Array.isArray(edgePoints) || edgePoints.length !== 2) {
        return false;
    }
    
    const [pairId1, pairId2] = edgePoints;
    
    if (line.points.includes(pointId)) {
        return false;
    }
    
    const index1 = line.points.indexOf(pairId1);
    const index2 = line.points.indexOf(pairId2);
    
    if (index1 === -1 || index2 === -1) {
        return false;
    }
    
    if (Math.abs(index1 - index2) !== 1) {
        return false;
    }
    
    const insertIndex = Math.min(index1, index2) + 1;
    line.points.splice(insertIndex, 0, pointId);
    
    return true;
}

interface GetHighlightableElementsParams {
    lines: Line[];
    edges: Edge[];
    circles: Circle[];
    pointsMap: Map<string, Point>;
}

export const getHighlightableElements = (
    { lines, edges, circles, pointsMap }: GetHighlightableElementsParams,
    point: Position
): HighlightableElements => {
    const result: HighlightableElements = {
        edges: [],
        circles: [],
        lines: [],
        intersectedEdges: []
    };

    const edgesGroupByName = new Map<string, Edge[]>();
    const pointPairs = new Map<string, { point1: Point; point2: Point; lineId?: string }>();

    const createKey = (p1: string, p2: string): string => [p1, p2].sort().join('-');
    
    edges.forEach(edge => {
        const lineWithThisEdge = lines.find(line => isEdgeOnThisLine(edge, line));
        let point1Id: string, point2Id: string;
        if (lineWithThisEdge) {
            point1Id = lineWithThisEdge.points[0];
            point2Id = lineWithThisEdge.points[lineWithThisEdge.points.length - 1];
        } else {
            point1Id = edge.points[0];
            point2Id = edge.points[1];
        }
        const key = createKey(edge.points[0], edge.points[1]);

        if (!edgesGroupByName.has(key)) { 
            edgesGroupByName.set(key, []);
        }
        edgesGroupByName.get(key)!.push(edge);

        if (!pointPairs.has(key)) {
            const p1 = pointsMap.get(point1Id);
            const p2 = pointsMap.get(point2Id);
            if (p1 && p2) {
                pointPairs.set(key, {
                    point1: p1,
                    point2: p2,
                    lineId: lineWithThisEdge?.id
                });
            }
        }

        const [edgePoint1, edgePoint2] = edge.points.map(p => pointsMap.get(p));
        if (edgePoint1 && edgePoint2 && isPointBetweenEdgePoints(point, edgePoint1, edgePoint2)) {
            if (edge.id) {
                result.intersectedEdges.push(edge.id);
            }
        }
    });

    pointPairs.forEach(({ point1, point2, lineId }, key) => {
        const { x1, y1, x2, y2 } = extendLine(point1, point2, 1920, 1080);
        const mouseAtThisLine = isPointOnLineDistance(x1, y1, x2, y2, point.x, point.y);
        const edgesForThisLine = edgesGroupByName.get(key);
        if (edgesForThisLine) {
            edgesForThisLine.forEach(edge => {
                if (mouseAtThisLine && edge.id) {
                    result.edges.push(edge.id);
                    if (lineId && !result.lines.includes(lineId)) {
                        result.lines.push(lineId);
                    }
                }
            });
        }
    });

    circles.forEach(circle => {
        const centerPoint = pointsMap.get(circle.centerPoint);
        if (centerPoint) {
            const onCircle = isPointOnCircle(point, centerPoint, circle.radius, 3);
            if (onCircle) {
                result.circles.push(circle.id);
            }
        }
    });

    return result;
};

export function arePointsCollinearByPosition(p1: Point, p2: Point, p3: Point, threshold: number = 1): boolean {
    const dx1 = p3.x - p1.x;
    const dy1 = p3.y - p1.y;
    const dx2 = p2.x - p1.x;
    const dy2 = p2.y - p1.y;
    
    const cross = Math.abs(crossProduct2D(dx1, dy1, dx2, dy2));
    return cross < threshold;
}

// Helper: check if two points have a direct edge
export const hasDirectEdge = (p1: string, p2: string, adjacentPoints: Map<string, Set<string>>): boolean => {
    const p1Adjacent = adjacentPoints.get(p1) || new Set();
    const p2Adjacent = adjacentPoints.get(p2) || new Set();
    return p1Adjacent.has(p2) || p2Adjacent.has(p1);
};


// Helper: check if two points are connected via a line (all intermediate edges exist)
export const areConnectedViaLine = (p1: string, p2: string, lines: Line[], adjacentPoints: Map<string, Set<string>>): boolean => {
    for (const line of lines) {
        const idx1 = line.points.indexOf(p1);
        const idx2 = line.points.indexOf(p2);
        
        if (idx1 === -1 || idx2 === -1) continue;
        
        // Check all consecutive edges between p1 and p2 on this line
        const start = Math.min(idx1, idx2);
        const end = Math.max(idx1, idx2);
        
        let allEdgesExist = true;
        for (let i = start; i < end; i++) {
            if (!hasDirectEdge(line.points[i], line.points[i + 1], adjacentPoints)) {
                allEdgesExist = false;
                break;
            }
        }
        
        if (allEdgesExist) return true;
    }
    return false;
};

// Helper: check if two points are connected (direct edge OR via line)
const areConnected = (p1: string, p2: string, adjacentPoints: Map<string, Set<string>>, lines: Line[]): boolean => {
    return hasDirectEdge(p1, p2, adjacentPoints) || areConnectedViaLine(p1, p2, lines, adjacentPoints);
};

// compared with getTriangles, this function will get the triangles where need to travel on multiple edges to build the triangle
export const getTriangles2 = (
    angles: Angle[], 
    adjacentPoints: Map<string, Set<string>>, 
    lines: Line[]
): Triangle[] => {
    const triangles: Triangle[] = [];
    const pointIds = Array.from(adjacentPoints.keys());
    
    for (let i = 0; i < pointIds.length; i++) {
        for (let j = i + 1; j < pointIds.length; j++) {
            for (let k = j + 1; k < pointIds.length; k++) {
                const p1 = pointIds[i];
                const p2 = pointIds[j];
                const p3 = pointIds[k];
                
                const hasEdge12 = areConnected(p1, p2, adjacentPoints, lines);
                const hasEdge13 = areConnected(p1, p3, adjacentPoints, lines);
                const hasEdge23 = areConnected(p2, p3, adjacentPoints, lines);
                
                if (hasEdge12 && hasEdge13 && hasEdge23) {
                    const areCollinear = lines.some(line => 
                        line.points.includes(p1) && line.points.includes(p2) && line.points.includes(p3)
                    );
                    
                    if (!areCollinear) {
                        const triangle: Triangle = new Set([p1, p2, p3]);
                        triangles.push(triangle);
                    }
                }
            }
        }
    }
    
    lines.forEach(line => {
        if (line.points.length < 2) return;
        
        const apexPoints = pointIds.filter(pointId => !line.points.includes(pointId));
        
        apexPoints.forEach(apex => {
            const apexAdjacent = adjacentPoints.get(apex) || new Set();
            
            for (let i = 0; i < line.points.length; i++) {
                for (let j = i + 1; j < line.points.length; j++) {
                    const linePoint1 = line.points[i];
                    const linePoint2 = line.points[j];
                    
                    // Check if apex is connected to both line points (direct or via another line)
                    const hasEdgeToP1 = apexAdjacent.has(linePoint1) || areConnectedViaLine(apex, linePoint1, lines, adjacentPoints);
                    const hasEdgeToP2 = apexAdjacent.has(linePoint2) || areConnectedViaLine(apex, linePoint2, lines, adjacentPoints);
                    
                    if (hasEdgeToP1 && hasEdgeToP2) {
                        const triangleKey = [apex, linePoint1, linePoint2].sort().join(',');
                        
                        const alreadyExists = triangles.some(tri => {
                            const triKey = Array.from(tri).sort().join(',');
                            return triKey === triangleKey;
                        });
                        
                        if (!alreadyExists) {
                            const triangle: Triangle = new Set([apex, linePoint1, linePoint2]);
                            triangles.push(triangle);
                        }
                    }
                }
            }
        });
    });
    
    angles.forEach(angle => {
        if (angle.hide && angle.groupElement) {
            const isAngleInTriangle = triangles.some(triangle => 
                triangle.has(angle.pointId) && 
                triangle.has(angle.sidepoints[0]) && 
                triangle.has(angle.sidepoints[1])
            );
            
            const isSupplementaryAngle = lines.some(line => line.points.includes(angle.pointId));
            
            const overlappingAngles = findOverlappingAngles(
                angle.pointId, 
                angle.sidepoints[0], 
                angle.sidepoints[1], 
                angles.filter(a => a.id !== angle.id), 
                lines
            );
            const hasOverlap = overlappingAngles.length > 0;
            
            if ((isAngleInTriangle || isSupplementaryAngle) && !hasOverlap) {
                angle.hide = false;
                angle.groupElement.style.display = '';
            }
        }
    });

    return triangles;
};

export const searchVertexAngleInIsoscelesTriangle = (angles: Angle[], circle: Circle): Angle | undefined => {
    // 
    const isVertexPoint = angles.find(a => (
        a.pointId === circle.centerPoint &&
        a.sidepoints &&
        a.sidepoints.every(np => circle.pointsOnLine?.includes(np))
    ));
    return isVertexPoint;
};

export const isTargetAngle = (angle: Angle): boolean => !!angle.target;

export const getAngleDisplayText = (angle: Angle): string => {
    if (angle.value) {
        const isGreekLetter = isNaN(parseFloat(String(angle.value)));
        return isGreekLetter ? String(angle.value) : angle.value + '°';
    }
    if (angle.label && angle.label.trim() !== '') {
        return angle.label;
    }
    return '?';
};

export const isEquilateralTriangleByCircles = (triangle: Triangle, circles: Circle[]): boolean => {
    if (circles.length < 2) return false;
   
    return circles.some(c1 => {
        // one of the triangle point must be center of the first circle
        if (!triangle.has(c1.centerPoint)) return false;
        // one of the triangle point must be center of the second circle
        const c2 = circles.find(c => c.centerPoint !== c1.centerPoint && triangle.has(c.centerPoint));
        if (!c2) return false;
        // the intersection point must be a point which both circle have on their line
        const intersectionPoint = Array.from(triangle).filter(p => p !== c1.centerPoint && p !== c2.centerPoint).pop();
        // something wrong with the triangle points, there is only 2 points
        if (!intersectionPoint) return false;

        return c1.pointsOnLine.includes(intersectionPoint) && c2.pointsOnLine.includes(intersectionPoint);
    });

};

export const isEquilateralTriangleByLabel = (triangleAngles: Angle[]): boolean => {
    if (triangleAngles.length !== 3) return false;
    const label = triangleAngles[0].label;
    return triangleAngles.every(angle => angle.label && angle.label === label);
};

export const haveSameLabels = (angles: Angle[]): boolean => {
    const firstLabel = angles[0]?.label;
    return !!firstLabel && angles.every(a => a.label === firstLabel);
};

export const sumOfKnownAngles = (angles: Angle[]): number => {
    return angles
        .map(a => getAngleValue(a))
        .filter((v): v is number => v !== null)
        .reduce((sum, v) => sum + v, 0);
};

export const findPointNeighbors = (point: Point, edges: Edge[], pointsMap: Map<string, Point>): Point[] => {
    const neighbors: Point[] = [];
    
    edges.forEach(edge => {
        if (edge.points[0] === point.id) {
            const neighbor = pointsMap.get(edge.points[1]);
            if (neighbor) neighbors.push(neighbor);
        } else if (edge.points[1] === point.id) {
            const neighbor = pointsMap.get(edge.points[0]);
            if (neighbor) neighbors.push(neighbor);
        }
    });
    
    return neighbors;
};

export const isThisAngle = (angle: Angle, vertexId: string, point1: string, point2: string): boolean => {
    return angle.pointId === vertexId &&
        angle.sidepoints &&
        angle.sidepoints.includes(point1) &&
        angle.sidepoints.includes(point2);
};

export const getTriangleAngles = (triangle: Triangle, angles: Angle[]): Angle[] => {
    const triangleAngles: Angle[] = [];
    const pointsInTriangle = Array.from(triangle);
    pointsInTriangle.forEach(pointId => {
        const otherPoints = pointsInTriangle.filter(p => p !== pointId);
        const angle = angles.find(a => a.pointId === pointId && 
            a.sidepoints && a.sidepoints.length === 2 &&
            a.sidepoints.includes(otherPoints[0]) && a.sidepoints.includes(otherPoints[1]));
        if (angle) triangleAngles.push(angle);
    });
    return triangleAngles;
};

export const findAngleInTriangle = (
    angles: Angle[], 
    pointId: string, 
    neighbor1Id: string, 
    neighbor2Id: string
): Angle | undefined => {
    return angles.find(a => {
        return a.pointId === pointId &&
            a.sidepoints &&
            a.sidepoints.length === 2 &&
            ((a.sidepoints[0] === neighbor1Id && a.sidepoints[1] === neighbor2Id) ||
             (a.sidepoints[0] === neighbor2Id && a.sidepoints[1] === neighbor1Id));
    });
};

export const getAngleMapsByPointId = (angles: Angle[]): Record<string, Angle[]> => {
    return angles.reduce((obj: Record<string, Angle[]>, angle) => {
        const { pointId } = angle;
        if (!obj[pointId]) {
            obj[pointId] = [];
        }
        obj[pointId].push(angle);
        return obj;
    }, {});
};

export const validateAllTriangles = (triangles: string[][], angles: Angle[]): boolean => {
    let incompleteCount = 0;
    
    for (const triangle of triangles) {
        const angle1 = findAngleInTriangle(angles, triangle[0], triangle[1], triangle[2]);
        const angle2 = findAngleInTriangle(angles, triangle[1], triangle[0], triangle[2]);
        const angle3 = findAngleInTriangle(angles, triangle[2], triangle[0], triangle[1]);
        
        if (!angle1 || !angle2 || !angle3) {
            incompleteCount++;
            continue;
        }
        
        const value1 = getAngleValue(angle1);
        const value2 = getAngleValue(angle2);
        const value3 = getAngleValue(angle3);
        
        if (value1 === null || value2 === null || value3 === null) {
            incompleteCount++;
        }
    }
    
    return incompleteCount === 0;
};

export const areAllTrianglesValid = (triangles: string[][], angles: Angle[]): boolean => {
    if (!triangles || triangles.length === 0) {
        return false;
    }
    
    let hasAtLeastOneValidTriangle = false;
    
    for (const triangle of triangles) {
        const angle1 = findAngleInTriangle(angles, triangle[0], triangle[1], triangle[2]);
        const angle2 = findAngleInTriangle(angles, triangle[1], triangle[0], triangle[2]);
        const angle3 = findAngleInTriangle(angles, triangle[2], triangle[0], triangle[1]);
        
        if (!angle1 || !angle2 || !angle3) continue;
        
        const value1 = getAngleValue(angle1);
        const value2 = getAngleValue(angle2);
        const value3 = getAngleValue(angle3);
        
        if (value1 === null || value2 === null || value3 === null) {
            return false;
        }
        
        const sum = value1 + value2 + value3;
        const diff = Math.abs(sum - 180);
        
        if (diff > TOLERANCE) {
            return false;
        }
        
        hasAtLeastOneValidTriangle = true;
    }
    
    return hasAtLeastOneValidTriangle;
};

export function getAngleValue(angle: Pick<Angle, 'value'>): number | null {
    if (!angle.value) return null;
    const parsed = parseFloat(String(angle.value));
    if (isNaN(parsed)) return null;
    return parsed || null;
}

export function getUnusedGreekLetter(angles: Angle[]): string {
    const greekLetters = ['α', 'β', 'γ', 'δ', 'ε', 'ζ', 'η', 'θ', 'ι', 'κ', 'λ', 'μ', 'ν', 'ξ', 'ο', 'π', 'ρ', 'σ', 'τ', 'υ', 'φ', 'χ', 'ψ', 'ω'];
    const usedLabels = new Set(angles.map(a => a.label).filter(l => l));
    
    for (const letter of greekLetters) {
        if (!usedLabels.has(letter)) {
            return letter;
        }
    }
    
    return greekLetters[0];
}

const EDGE_DETECTION_THRESHOLD = 5;

export const findNearbyEdges = (
    x: number, 
    y: number, 
    edges: Edge[], 
    pointsMap: Map<string, Point>
): NearbyEdge[] => {
    const closestEdges: NearbyEdge[] = [];
    const closestDistance = EDGE_DETECTION_THRESHOLD;
    
    for (const edge of edges) {
        const point1 = pointsMap.get(edge.points[0]);
        const point2 = pointsMap.get(edge.points[1]);
        
        if (!point1 || !point2) continue;
        
        const { distance: dist, closestPoint } = pointToSegmentDistance(x, y, point1.x, point1.y, point2.x, point2.y);
        
        if (dist < closestDistance) {
            closestEdges.push({ edge, distance: dist, closestPoint });
        }
    }

    closestEdges.sort((a, b) => a.distance - b.distance);
    return closestEdges;
};

export function isPointInsideAngle(vertex: Point, p1: Point, p2: Point, pTest: Point): boolean {
    const angle1 = pointToAngle(vertex, p1);
    const angle2 = pointToAngle(vertex, p2);
    const angleTest = pointToAngle(vertex, pTest);
    
    let a1 = normalizeAngle(angle1);
    let a2 = normalizeAngle(angle2);
    let aTest = normalizeAngle(angleTest);
    
    let angleDiff = a2 - a1;
    if (angleDiff < 0) angleDiff += 2 * Math.PI;
    
    if (angleDiff > Math.PI) {
        [a1, a2] = [a2, a1];
        angleDiff = 2 * Math.PI - angleDiff;
    }
    
    let testDiff = aTest - a1;
    if (testDiff < 0) testDiff += 2 * Math.PI;
    
    return testDiff > 0 && testDiff < angleDiff;
}

// Let's not delete this function, it's used in the old triangle detection, maybe we can use it in the future.
// the difference is that this function will get the triangles where can be built with direct edges only.
export const getTriangles = (
    angles: Angle[], 
    adjacentPoints: Map<string, Set<string>>, 
    lines: Line[]
): Triangle[] => {
    const triangles: Triangle[] = [];
    const pointIds = Array.from(adjacentPoints.keys());
    
    for (let i = 0; i < pointIds.length; i++) {
        for (let j = i + 1; j < pointIds.length; j++) {
            for (let k = j + 1; k < pointIds.length; k++) {
                const p1 = pointIds[i];
                const p2 = pointIds[j];
                const p3 = pointIds[k];
                
                const p1Adjacent = adjacentPoints.get(p1) || new Set();
                const p2Adjacent = adjacentPoints.get(p2) || new Set();
                const p3Adjacent = adjacentPoints.get(p3) || new Set();
                
                const hasEdge12 = p1Adjacent.has(p2) || p2Adjacent.has(p1);
                const hasEdge13 = p1Adjacent.has(p3) || p3Adjacent.has(p1);
                const hasEdge23 = p2Adjacent.has(p3) || p3Adjacent.has(p2);
                
                if (hasEdge12 && hasEdge13 && hasEdge23) {
                    const areCollinear = lines.some(line => 
                        line.points.includes(p1) && line.points.includes(p2) && line.points.includes(p3)
                    );
                    
                    if (!areCollinear) {
                        const triangle: Triangle = new Set([p1, p2, p3]);
                        triangles.push(triangle);
                    }
                }
            }
        }
    }
    
    lines.forEach(line => {
        if (line.points.length < 2) return;
        
        const apexPoints = pointIds.filter(pointId => !line.points.includes(pointId));
        
        apexPoints.forEach(apex => {
            const apexAdjacent = adjacentPoints.get(apex) || new Set();
            
            for (let i = 0; i < line.points.length; i++) {
                for (let j = i + 1; j < line.points.length; j++) {
                    const linePoint1 = line.points[i];
                    const linePoint2 = line.points[j];
                    
                    const hasEdgeToP1 = apexAdjacent.has(linePoint1);
                    const hasEdgeToP2 = apexAdjacent.has(linePoint2);
                    
                    if (hasEdgeToP1 && hasEdgeToP2) {
                        const triangleKey = [apex, linePoint1, linePoint2].sort().join(',');
                        
                        const alreadyExists = triangles.some(tri => {
                            const triKey = Array.from(tri).sort().join(',');
                            return triKey === triangleKey;
                        });
                        
                        if (!alreadyExists) {
                            const triangle: Triangle = new Set([apex, linePoint1, linePoint2]);
                            triangles.push(triangle);
                        }
                    }
                }
            }
        });
    });
    
    angles.forEach(angle => {
        if (angle.hide && angle.groupElement) {
            const isAngleInTriangle = triangles.some(triangle => 
                triangle.has(angle.pointId) && 
                triangle.has(angle.sidepoints[0]) && 
                triangle.has(angle.sidepoints[1])
            );
            
            const isSupplementaryAngle = lines.some(line => line.points.includes(angle.pointId));
            
            const overlappingAngles = findOverlappingAngles(
                angle.pointId, 
                angle.sidepoints[0], 
                angle.sidepoints[1], 
                angles.filter(a => a.id !== angle.id), 
                lines
            );
            const hasOverlap = overlappingAngles.length > 0;
            
            if ((isAngleInTriangle || isSupplementaryAngle) && !hasOverlap) {
                angle.hide = false;
                angle.groupElement.style.display = '';
            }
        }
    });

    return triangles;
};

export function buildOverlappingAnglesMap(
    angles: Angle[], 
    lines: Line[], 
    overlappingAngles: Map<string, Set<string>>
): Map<string, Set<string>> {
    angles.forEach((angle, index) => {
        if (!angle.pointId || !angle.sidepoints || angle.sidepoints.length !== 2) {
            return;
        }
        
        for (let i = index + 1; i < angles.length; i++) {
            const otherAngle = angles[i];
            
            if (!otherAngle.pointId || !otherAngle.sidepoints || otherAngle.sidepoints.length !== 2) {
                continue;
            }
            
            if (angle.pointId !== otherAngle.pointId) {
                continue;
            }
            
            const sharedNeighbors = angle.sidepoints.filter(
                n => otherAngle.sidepoints.includes(n)
            );
            
            if (sharedNeighbors.length !== 1) {
                continue;
            }
            
            const angleOtherNeighbor = angle.sidepoints.find(n => n !== sharedNeighbors[0]);
            const otherAngleOtherNeighbor = otherAngle.sidepoints.find(n => n !== sharedNeighbors[0]);
            
            if (!angleOtherNeighbor || !otherAngleOtherNeighbor) continue;
            
            if (!arePointsCollinear(angle.pointId, angleOtherNeighbor, otherAngleOtherNeighbor, lines)) {
                continue;
            }
            
            let onSameSide = false;
            for (const line of lines) {
                if (line.points.includes(angle.pointId) && line.points.includes(angleOtherNeighbor) && line.points.includes(otherAngleOtherNeighbor)) {
                    const vertexIndex = line.points.indexOf(angle.pointId);
                    const index1 = line.points.indexOf(angleOtherNeighbor);
                    const index2 = line.points.indexOf(otherAngleOtherNeighbor);
                    
                    const bothBefore = (index1 < vertexIndex && index2 < vertexIndex);
                    const bothAfter = (index1 > vertexIndex && index2 > vertexIndex);
                    
                    onSameSide = bothBefore || bothAfter;
                    break;
                }
            }
            
            if (onSameSide) {
                if (!overlappingAngles.has(angle.id)) {
                    overlappingAngles.set(angle.id, new Set([angle.id]));
                }
                
                overlappingAngles.get(angle.id)!.add(otherAngle.id);
                overlappingAngles.set(otherAngle.id, overlappingAngles.get(angle.id)!);
            }
        }
    });
    
    return overlappingAngles;
}

export const getSameAngleNames = (angleData: Angle, angles: Angle[], lines: Line[]): string[] => {
    const sameAngles = getSameAngles(angleData, angles, lines);
    if (!sameAngles || !Array.isArray(sameAngles)) return [];
    return sameAngles.map(angle => angle.name);
};

export const getSameAngles = (angleData: Angle, angles: Angle[], lines: Line[]): Angle[] => {
    const anglesWithThisVertex = angles.filter(a => a.pointId === angleData.pointId);
    
    const sameAngles: Angle[] = [];
    for (const angle of anglesWithThisVertex) {
        if (areSameAngle(angleData, angle, lines)) {
            sameAngles.push(angle);
        }
    }
    
    return sameAngles.length > 0 ? sameAngles : [angleData];
};

export const areSameAngle = (a1: Angle, a2: Angle, lines: Line[]): boolean => {
    if (a1.pointId !== a2.pointId) return false;
    if (a1.id === a2.id) return true;
    
    const v = a1.pointId;
    const [p1, p2] = a1.sidepoints;
    const [q1, q2] = a2.sidepoints;
    
    const sameOrder = isSameRay(p1, q1, v, lines) && isSameRay(p2, q2, v, lines);
    const oppositeOrder = isSameRay(p1, q2, v, lines) && isSameRay(p2, q1, v, lines);
    
    return sameOrder || oppositeOrder;
};

export const isSameRay = (p1: string, p2: string, vertex: string, lines: Line[]): boolean => {
    if (p1 === p2) return true;
    
    for (const line of lines) {
        if (!line.points.includes(vertex) || !line.points.includes(p1) || !line.points.includes(p2)) continue;
        
        const vi = line.points.indexOf(vertex);
        const i1 = line.points.indexOf(p1);
        const i2 = line.points.indexOf(p2);
        
        if ((i1 < vi && i2 < vi) || (i1 > vi && i2 > vi)) {
            return true;
        }
    }
    return false;
};

export const getAngleCalculatedInfo = (vertex: Point, point1: Point, point2: Point, scale: number = 1): AngleCalculatedInfo | undefined => {
    let angle1 = pointToAngle(vertex, point1);
    let angle2 = pointToAngle(vertex, point2);
    
    let angleDiff = angle2 - angle1;
    angleDiff = normalizeAngle(angleDiff);
    
    if (angleDiff > Math.PI) {
        angleDiff = 2 * Math.PI - angleDiff;
        [angle1, angle2] = [angle2, angle1];
    }
    
    const angleDegrees = Math.round(radiansToDegrees(angleDiff));
    if ((angleDiff < Math.PI && angleDiff > 0.1 && angleDegrees < 179) === false) {
        return;
    }
    
    const radius = Math.round((25 + (angleDegrees / 10)) * scale);
    return {
        radius,
        angleDegrees,
        angle1,
        angle2
    };
};

export const findSameAnglesGroups = (angles: Angle[], lines: Line[]): Angle[][] => {
    const angleGroups: Angle[][] = [];
    for (let i = 0; i < angles.length; i++) {
        const sameAngles: Angle[] = [];
        const currentAngle = angles[i];
        for (let j = i + 1; j < angles.length; j++) {
            if (areSameAngle(currentAngle, angles[j], lines)) {
                if (sameAngles.length === 0) {
                    sameAngles.push(currentAngle);
                }
                sameAngles.push(angles[j]);
            }
        }
        if (sameAngles.length > 0) {
            angleGroups.push(sameAngles);
        }
    }
    return angleGroups;
};

export const isSolvedAngle = (angle: Angle): boolean => !!angle.value;
export const isUnsolvedAngle = (angle: Angle): boolean => !isSolvedAngle(angle);

export const getAnglesNeedToBeSolved = (angles: Angle[]): Angle[] => {
    return angles.filter(angle => isTargetAngle(angle));
};

export const getAnglesAlreadySolved = (angles: Angle[]): Angle[] => {
    return angles.filter(a => isSolvedAngle(a));
};

export const sortLinePoints = (line: string[], pointsMap: Map<string, Point>): string[] => {
    const linePoints = line.map(id => pointsMap.get(id)).filter((p): p is Point => !!p);                
    linePoints.sort((a, b) => {
        if (Math.abs(a.x - b.x) > 1) {
            return a.x - b.x;
        } else {
            return a.y - b.y;
        }
    });

    return linePoints.map(x => x.id);
};

export const increaseAngleRadius = (currentPath: string, increaseBy: number): string | undefined => {
    const arcMatch = currentPath.match(/A\s+([\d.]+)\s+([\d.]+)/);
    if (arcMatch) {
        const oldRadius = parseFloat(arcMatch[1]);
        const newRadius = oldRadius + increaseBy;
        
        const vertexMatch = currentPath.match(/M\s+([\d.]+)\s+([\d.]+)/);
        const lineMatch = currentPath.match(/L\s+([\d.]+)\s+([\d.]+)/);
        
        if (vertexMatch && lineMatch) {
            const vx = parseFloat(vertexMatch[1]);
            const vy = parseFloat(vertexMatch[2]);
            const startX = parseFloat(lineMatch[1]);
            const startY = parseFloat(lineMatch[2]);
            
            const startAngle = Math.atan2(startY - vy, startX - vx);
            
            const flagsMatch = currentPath.match(/A\s+[\d.]+\s+[\d.]+\s+0\s+(\d)\s+(\d)/);
            const largeArc = flagsMatch ? flagsMatch[1] : '0';
            const sweep = flagsMatch ? flagsMatch[2] : '1';
            
            const endMatch = currentPath.match(/A[^Z]+\s+([\d.]+)\s+([\d.]+)\s*Z/);
            if (endMatch) {
                const endX = parseFloat(endMatch[1]);
                const endY = parseFloat(endMatch[2]);
                const endAngle = Math.atan2(endY - vy, endX - vx);
                
                const newStartX = vx + newRadius * Math.cos(startAngle);
                const newStartY = vy + newRadius * Math.sin(startAngle);
                const newEndX = vx + newRadius * Math.cos(endAngle);
                const newEndY = vy + newRadius * Math.sin(endAngle);
                
                return `M ${vx} ${vy} L ${newStartX} ${newStartY} A ${newRadius} ${newRadius} 0 ${largeArc} ${sweep} ${newEndX} ${newEndY} Z`;
            }
        }
    } else {
        const lines = currentPath.match(/L\s+([\d.]+)\s+([\d.]+)/g);
        if (!lines || lines.length < 3) {
            return;
        }
        const vertexMatch = currentPath.match(/M\s+([\d.]+)\s+([\d.]+)/);
        if (!vertexMatch) { return; }
        const vx = parseFloat(vertexMatch[1]);
        const vy = parseFloat(vertexMatch[2]);
        
        const coords = lines.map(line => {
            const match = line.match(/L\s+([\d.]+)\s+([\d.]+)/);
            return match ? { x: parseFloat(match[1]), y: parseFloat(match[2]) } : { x: 0, y: 0 };
        });
        
        const angle1 = Math.atan2(coords[0].y - vy, coords[0].x - vx);
        const angle2 = Math.atan2(coords[2].y - vy, coords[2].x - vx);
        
        const oldSize = Math.sqrt((coords[0].x - vx) ** 2 + (coords[0].y - vy) ** 2);
        const newSize = oldSize + increaseBy;
        
        const newStartX = vx + newSize * Math.cos(angle1);
        const newStartY = vy + newSize * Math.sin(angle1);
        const newEndX = vx + newSize * Math.cos(angle2);
        const newEndY = vy + newSize * Math.sin(angle2);
        const newCornerX = vx + newSize * Math.cos(angle1) + newSize * Math.cos(angle2);
        const newCornerY = vy + newSize * Math.sin(angle1) + newSize * Math.sin(angle2);
        
        return `M ${vx} ${vy} L ${newStartX} ${newStartY} L ${newCornerX} ${newCornerY} L ${newEndX} ${newEndY} Z`;          
    }
};

