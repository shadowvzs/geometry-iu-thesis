// Math helper functions for geometry calculations
const TOLERANCE = 10;

// Generates a point name from an index (A, B, C, ..., Z, then wraps back to A).
export function getNewPointName(index) {
    return String.fromCharCode(65 + (index % 26));
}

export const getAngleNameFromPoints = (vertexId, point1Id, point2Id) => {
    return `∠${point1Id}${vertexId}${point2Id}`;
}

// Calculates Euclidean distance between two points (x1, y1) and (x2, y2).
export function distance(x1, y1, x2, y2) {
    return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
}

// Finds intersection point between two line segments (x1,y1)-(x2,y2) and (x3,y3)-(x4,y4).
// Returns {x, y} if segments intersect, null if parallel or no intersection within segments.
export function lineIntersection(x1, y1, x2, y2, x3, y3, x4, y4) {
    const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
    
    if (Math.abs(denom) < 0.0001) return null; // Lines are parallel
    
    const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;
    const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denom;
    
    // Check if intersection is within both line segments
    if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
        return {
            x: x1 + t * (x2 - x1),
            y: y1 + t * (y2 - y1)
        };
    }
    
    return null;
}

// Returns array of numeric angle values, using 0 for unsolved angles.
export const getSolvedAngleValue = (angles) => {
    return angles.map(angle => (getAngleValue(angle) ?? 0));
}

// Sums the numeric values of all angles, treating unsolved as 0.
export const sumOfSolvedAnglesValue = (angles) => {
    return getSolvedAngleValue(angles).reduce((sum, angle) => sum + angle, 0);
}

// Filters and returns only angles that have no solved numeric value.
export const getUnsolvedAngles = (angles) => {
    return angles.filter(angle => !getAngleValue(angle));
}

// Alias for compatibility
export const unsolvedAngles = getUnsolvedAngles;

// Calculates the shortest distance from point (px, py) to line segment (x1,y1)-(x2,y2).
// Returns {distance, closestPoint} where closestPoint is the nearest point on the segment.
export function pointToSegmentDistance(px, py, x1, y1, x2, y2) {
        const dx = x2 - x1;
        const dy = y2 - y1;
        const lengthSquared = dx * dx + dy * dy;
        
        if (lengthSquared === 0) {
            // The segment is a point
            const dist = Math.sqrt((px - x1) ** 2 + (py - y1) ** 2);
            return { distance: dist, closestPoint: { x: x1, y: y1 } };
        }
        
        // Calculate projection of point onto line (parameterized by t)
        let t = ((px - x1) * dx + (py - y1) * dy) / lengthSquared;
        
        // Clamp t to [0, 1] to stay within the segment
        t = Math.max(0, Math.min(1, t));
        
        // Find the closest point on the segment
        const closestX = x1 + t * dx;
        const closestY = y1 + t * dy;
        
        // Calculate distance
        const distance = Math.sqrt((px - closestX) ** 2 + (py - closestY) ** 2);
        
        return { distance, closestPoint: { x: closestX, y: closestY } };
}

// Clips a line to canvas boundaries and returns the closest intersection point.
// Checks all four canvas edges (top, bottom, left, right) and returns nearest hit.
export function clipLineToCanvas(x1, y1, x2, y2, width, height) {
    const intersections = [];
    
    // Check intersection with each edge of canvas
    // Top edge (y = 0)
    const topIntersect = lineIntersection(x1, y1, x2, y2, 0, 0, width, 0);
    if (topIntersect) intersections.push(topIntersect);
    
    // Bottom edge (y = height)
    const bottomIntersect = lineIntersection(x1, y1, x2, y2, 0, height, width, height);
    if (bottomIntersect) intersections.push(bottomIntersect);
    
    // Left edge (x = 0)
    const leftIntersect = lineIntersection(x1, y1, x2, y2, 0, 0, 0, height);
    if (leftIntersect) intersections.push(leftIntersect);
    
    // Right edge (x = width)
    const rightIntersect = lineIntersection(x1, y1, x2, y2, width, 0, width, height);
    if (rightIntersect) intersections.push(rightIntersect);
    
    // Return the closest intersection
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
// Always returns the smaller angle (0-180°).
export function calculateAngleDegrees(vertex, point1, point2) {
    const angle1 = pointToAngle(vertex, point1);
    const angle2 = pointToAngle(vertex, point2);
    
    let angleDiff = angle2 - angle1;
    
    // Normalize to [0, 2π]
    if (angleDiff < 0) angleDiff += 2 * Math.PI;
    if (angleDiff > 2 * Math.PI) angleDiff -= 2 * Math.PI;
    
    // Convert to degrees
    let degrees = (angleDiff * 180) / Math.PI;
    
    // Always return the smaller angle (0-180°)
    if (degrees > 180) degrees = 360 - degrees;
    
    return degrees;
}

/**
 * Calculate angle in radians from one point to another
 * @param {number} x1 - X coordinate of origin point
 * @param {number} y1 - Y coordinate of origin point
 * @param {number} x2 - X coordinate of target point
 * @param {number} y2 - Y coordinate of target point
 * @returns {number} Angle in radians (-π to π)
 */
export function coordinatesToAngle(x1, y1, x2, y2) {
    return Math.atan2(y2 - y1, x2 - x1);
}

// Calculates angle in radians from point1 to point2 using their x, y properties.
export function pointToAngle(point1, point2) {
    return coordinatesToAngle(point1.x, point1.y, point2.x, point2.y);
}

/**
 * Normalize angle to [0, 2π] range
 * @param {number} angle - Angle in radians
 * @returns {number} Normalized angle in [0, 2π]
 */
export function normalizeAngle(angle) {
    while (angle < 0) angle += 2 * Math.PI;
    while (angle >= 2 * Math.PI) angle -= 2 * Math.PI;
    return angle;
}

/**
 * Convert radians to degrees
 * @param {number} radians - Angle in radians
 * @returns {number} Angle in degrees
 */
export function radiansToDegrees(radians) {
    return (radians * 180) / Math.PI;
}

/**
 * Convert degrees to radians
 * @param {number} degrees - Angle in degrees
 * @returns {number} Angle in radians
 */
export function degreesToRadians(degrees) {
    return (degrees * Math.PI) / 180;
}

/**
 * Check if 3 points are collinear (lie on the same line)
 * @param {string} pointId1 - ID of first point
 * @param {string} pointId2 - ID of second point
 * @param {string} pointId3 - ID of third point
 * @param {Array<Array<string>>} lines - Array of line arrays, each containing point IDs
 * @returns {boolean} True if all 3 points are on the same line
 */
export function arePointsCollinear(pointId1, pointId2, pointId3, lines) {
    // Check if all 3 points exist in any line array
    return lines.some(line => 
        line.includes(pointId1) && 
        line.includes(pointId2) && 
        line.includes(pointId3)
    );
}

/**
 * Find all angles that overlap with the given angle
 * Overlapping angles have: same vertex, share one neighbor, third neighbors are collinear on same side
 * @param {string} vertexId - ID of the vertex point
 * @param {string} neighbor1Id - ID of first neighbor point
 * @param {string} neighbor2Id - ID of second neighbor point
 * @param {Array} angles - Array of all angle objects
 * @param {Array<Array<string>>} lines - Array of line arrays for collinearity check
 * @param {Map<string, Object>} pointsMap - Map of point IDs to point objects with x, y coordinates
 * @returns {Array} Array of overlapping angle objects
 */
export function findOverlappingAngles(vertexId, neighbor1Id, neighbor2Id, angles, lines, pointsMap) {
    return angles.filter(existingAngle => {
        // Must have same vertex
        if (existingAngle.pointId !== vertexId) return false;
        
        // Find shared neighbors
        const sharedNeighbors = existingAngle.sidepoints.filter(
            n => n === neighbor1Id || n === neighbor2Id
        );
        
        // Must share exactly one neighbor
        if (sharedNeighbors.length !== 1) return false;
        
        // Find the non-shared neighbors
        const existingOtherNeighbor = existingAngle.sidepoints.find(
            n => n !== sharedNeighbors[0]
        );
        const newOtherNeighbor = (neighbor1Id === sharedNeighbors[0]) ? neighbor2Id : neighbor1Id;
        
        // Check if the two non-shared neighbors are collinear with the vertex
        const areCollinear = arePointsCollinear(vertexId, existingOtherNeighbor, newOtherNeighbor, lines);
        
        if (!areCollinear) return false;
        
        // Use LINE ARRAY ORDERING ONLY - NO COORDINATES!
        // Find the line containing vertex and both non-shared neighbors
        let onSameSide = false;
        for (const line of lines) {
            if (line.includes(vertexId) && line.includes(existingOtherNeighbor) && line.includes(newOtherNeighbor)) {
                const vertexIndex = line.indexOf(vertexId);
                const existingIndex = line.indexOf(existingOtherNeighbor);
                const newIndex = line.indexOf(newOtherNeighbor);
                
                // Same side: both points on same side of vertex in line array
                const bothBefore = (existingIndex < vertexIndex && newIndex < vertexIndex);
                const bothAfter = (existingIndex > vertexIndex && newIndex > vertexIndex);
                
                onSameSide = bothBefore || bothAfter;
                break;
            }
        }
        
        // Only return true if on SAME side (overlapping)
        // If on opposite sides, they're supplementary, not overlapping
        return onSameSide;
    });
}

/**
 * Calculate the dot product of two 2D vectors
 * @param {number} v1x - X component of first vector
 * @param {number} v1y - Y component of first vector
 * @param {number} v2x - X component of second vector
 * @param {number} v2y - Y component of second vector
 * @returns {number} Dot product (positive = same direction, negative = opposite, 0 = perpendicular)
 */
export function dotProduct2D(v1x, v1y, v2x, v2y) {
    return v1x * v2x + v1y * v2y;
}

/**
 * Calculate the 2D cross product (returns scalar z-component)
 * Used for determining orientation and collinearity
 * @param {number} v1x - X component of first vector
 * @param {number} v1y - Y component of first vector
 * @param {number} v2x - X component of second vector
 * @param {number} v2y - Y component of second vector
 * @returns {number} Cross product (positive = counter-clockwise, negative = clockwise, 0 = collinear)
 */
export function crossProduct2D(v1x, v1y, v2x, v2y) {
    return v1x * v2y - v1y * v2x;
}

/**
 * Calculate the area of a triangle given three points
 * @param {Object} p1 - First point with x, y properties
 * @param {Object} p2 - Second point with x, y properties
 * @param {Object} p3 - Third point with x, y properties
 * @returns {number} Area of the triangle
 */
export function triangleArea(p1, p2, p3) {
    return Math.abs(
        (p2.x - p1.x) * (p3.y - p1.y) - 
        (p3.x - p1.x) * (p2.y - p1.y)
    ) / 2;
}

/**
 * Check if a point is inside a triangle using barycentric coordinates
 * @param {number} px - X coordinate of test point
 * @param {number} py - Y coordinate of test point
 * @param {Object} p1 - First triangle vertex with x, y properties
 * @param {Object} p2 - Second triangle vertex with x, y properties
 * @param {Object} p3 - Third triangle vertex with x, y properties
 * @param {number} tolerance - Tolerance for floating point comparison (default 1)
 * @returns {boolean} True if point is inside the triangle
 */
export function isPointInTriangle(px, py, p1, p2, p3, tolerance = 1) {
    const triangleArea1 = triangleArea(p1, p2, p3);
    
    const subArea1 = Math.abs(
        (p2.x - px) * (p3.y - py) - 
        (p3.x - px) * (p2.y - py)
    ) / 2;
    
    const subArea2 = Math.abs(
        (p1.x - px) * (p3.y - py) - 
        (p3.x - px) * (p1.y - py)
    ) / 2;
    
    const subArea3 = Math.abs(
        (p1.x - px) * (p2.y - py) - 
        (p2.x - px) * (p1.y - py)
    ) / 2;
    
    const totalSubArea = subArea1 + subArea2 + subArea3;
    return Math.abs(totalSubArea - triangleArea1) < tolerance;
}

/**
 * Check if a point is on a circle's border (within a threshold)
 * @param {Object} point - Point to test with x, y properties
 * @param {Object} centerPoint - Center of circle with x, y properties
 * @param {number} radius - Radius of the circle
 * @param {number} threshold - Distance tolerance for "on border" check
 * @returns {boolean} True if point is on the circle border
 */
export function isPointOnCircle(point, centerPoint, radius, threshold = 5) {
    const distanceFromCenter = Math.sqrt(
        Math.pow(point.x - centerPoint.x, 2) + 
        Math.pow(point.y - centerPoint.y, 2)
    );
    
    const distanceFromBorder = Math.abs(distanceFromCenter - radius);
    return distanceFromBorder <= threshold;
}

/**
 * Check if three points are collinear using cross product
 * (Alternative to line-based collinearity check, uses geometric calculation)
 * @param {Object} p1 - First point with x, y properties
 * @param {Object} p2 - Second point with x, y properties
 * @param {Object} p3 - Third point with x, y properties
 * @param {number} threshold - Threshold for collinearity (default 1)
 * @returns {boolean} True if points are collinear
 */
export function arePointsCollinearByPosition(p1, p2, p3, threshold = 1) {
    const dx1 = p3.x - p1.x;
    const dy1 = p3.y - p1.y;
    const dx2 = p2.x - p1.x;
    const dy2 = p2.y - p1.y;
    
    // Cross product - if close to 0, points are collinear
    const cross = Math.abs(crossProduct2D(dx1, dy1, dx2, dy2));
    return cross < threshold;
}

/**
 * Truncate a string to a maximum length
 * @param {string} str - String to truncate
 * @param {number} maxLen - Maximum length
 * @param {string} suffix - Suffix to append if truncated (default '...')
 * @returns {string} Truncated string
 */
// Finds the vertex angle of an isosceles triangle formed by a circle's center
// and two points on the circle (the equal sides are the radii).
export const searchVertexAngleInIsoscelesTriangle = (angles, circle) => {
    const isVertexPoint = angles.find(a => (
        a.pointId === circle.centerPoint &&
        a.sidepoints &&
        a.sidepoints.every(np => circle.pointsOnLine.includes(np))
    ));
    return isVertexPoint;
}

// Checks if two angles overlap (represent the same geometric angle).
// True when: same vertex, one shared edge, non-shared edges point to collinear
// points on the SAME side of the vertex (Case 1) or common neighbor (Case 2).
export const areAnglesOverlapping = (angle1, angle2, lines) => {
        const point1 = angle1.point || angle1.pointId;
        const point2 = angle2.point || angle2.pointId;
        
        if (point1 !== point2) return false;
        
        const vertex = point1;
        const neighbors1 = angle1.sidepoints || [];
        const neighbors2 = angle2.sidepoints || [];
        
        // Find common neighbor (shared edge)
        let commonNeighbor = null;
        for (const n of neighbors1) {
            if (neighbors2.includes(n)) {
                if (commonNeighbor !== null) return false;
                commonNeighbor = n;
            }
        }
        
        if (commonNeighbor === null) return false;
        
        // Find non-common neighbors
        const nonCommon1 = neighbors1.find(n => n !== commonNeighbor);
        const nonCommon2 = neighbors2.find(n => n !== commonNeighbor);
        
        if (!nonCommon1 || !nonCommon2) return false;
        
        // Check if the points are collinear
        for (const line of lines) {
            // CASE 1: Vertex is on the line with both non-common neighbors
            if (line.includes(vertex) && line.includes(nonCommon1) && line.includes(nonCommon2)) {
                const vertexIndex = line.indexOf(vertex);
                const index1 = line.indexOf(nonCommon1);
                const index2 = line.indexOf(nonCommon2);
                
                // For overlapping angles, both non-common neighbors must be on the SAME side
                const onSameSide = (index1 < vertexIndex && index2 < vertexIndex) || 
                                  (index1 > vertexIndex && index2 > vertexIndex);
                
                return onSameSide;
            }
            
            // CASE 2: Vertex is NOT on the line, but common neighbor and both non-common neighbors ARE
            // This handles angle containment (e.g., ∠BCE contained in ∠BCA when C-E-A are collinear)
            if (!line.includes(vertex) && line.includes(commonNeighbor) && 
                line.includes(nonCommon1) && line.includes(nonCommon2)) {
                
                const commonIndex = line.indexOf(commonNeighbor);
                const index1 = line.indexOf(nonCommon1);
                const index2 = line.indexOf(nonCommon2);
                
                // Both non-common neighbors must be on the SAME side of the common neighbor
                // This creates overlapping angles (one contains the other)
                const onSameSide = (index1 < commonIndex && index2 < commonIndex) || 
                                  (index1 > commonIndex && index2 > commonIndex);
                
                return onSameSide;
            }
        }
        return false;
    };

// Checks if two angles form a linear pair (supplementary angles on a straight line).
// True when: same vertex, one shared edge, non-shared edges are on OPPOSITE sides.
export const areAnglesLinearPair = (angle1, angle2, lines) => {
        const point1 = angle1.point || angle1.pointId;
        const point2 = angle2.point || angle2.pointId;
        
        if (point1 !== point2) return false;
        
        const vertex = point1;
        const neighbors1 = angle1.sidepoints || [];
        const neighbors2 = angle2.sidepoints || [];
        
        // Find common neighbor (shared edge)
        let commonNeighbor = null;
        for (const n of neighbors1) {
            if (neighbors2.includes(n)) {
                if (commonNeighbor !== null) return false; // More than one common neighbor
                commonNeighbor = n;
            }
        }
        
        if (commonNeighbor === null) return false;
        
        // Find non-common neighbors
        const nonCommon1 = neighbors1.find(n => n !== commonNeighbor);
        const nonCommon2 = neighbors2.find(n => n !== commonNeighbor);
        
        if (!nonCommon1 || !nonCommon2) return false;
        
        // Check if the three points are collinear
        for (const line of lines) {
            if (line.includes(vertex) && line.includes(nonCommon1) && line.includes(nonCommon2)) {
                // They're collinear - now check if they're on OPPOSITE sides of the vertex
                const vertexIndex = line.indexOf(vertex);
                const index1 = line.indexOf(nonCommon1);
                const index2 = line.indexOf(nonCommon2);
                
                // For a linear pair, the two non-common neighbors must be on opposite sides
                // i.e., one before vertex, one after vertex in the line array
                const onOppositeSides = (index1 < vertexIndex && index2 > vertexIndex) || 
                                       (index1 > vertexIndex && index2 < vertexIndex);
                
                return onOppositeSides;
            }
        }
        return false;
    };

export const getAngleDisplayText = (angle) => {
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

// Checks if a triangle is equilateral by verifying all 3 angles have the same label.
export const isEquilateralTriangle = (triangleAngles) => {
    if (triangleAngles.length !== 3) return false;
    const label = triangleAngles[0].label;
    return triangleAngles.every(angle => angle.label && angle.label === label);
} 

// Checks if all angles in the array have the same non-empty label.
export const haveSameLabels = (angles) => {
    const firstLabel = angles[0]?.label;
    return firstLabel && angles.every(a => a.label === firstLabel);
}

// Sums only the angles that have known numeric values, ignoring unsolved ones.
export const sumOfKnownAngles = (angles) => {
    return angles
        .map(a => getAngleValue(a))
        .filter(v => v !== null)
        .reduce((sum, v) => sum + v, 0);
}

export const findPointNeighbors = (point, edges, pointsMap) => {
    const neighbors = [];
    
    // Find points connected by edges
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
}
    

export const isThisAngle = (andgle, vertexId, point1, point2) => {
    return andgle.pointId === vertexId &&
        andgle.sidepoints &&
        andgle.sidepoints.includes(point1) &&
        andgle.sidepoints.includes(point2);
}

// Retrieves the three angle objects for a triangle from the angles array.
// For each vertex, finds the angle using the other two vertices as sidepoints.
export const getTriangleAngles = (triangle, angles) => {
    const triangleAngles = [];
    const pointsInTriangle = Array.from(triangle);
    pointsInTriangle.forEach(pointId => {
        // Find angle at this vertex that uses the other two points
        const otherPoints = pointsInTriangle.filter(p => p !== pointId);
        const angle = angles.find(a => a.pointId === pointId && 
            a.sidepoints && a.sidepoints.length === 2 &&
            a.sidepoints.includes(otherPoints[0]) && a.sidepoints.includes(otherPoints[1]));
        if (angle) triangleAngles.push(angle);
    });
    return triangleAngles;
}

// Finds an angle at pointId with sidepoints neighbor1Id and neighbor2Id.
// Returns the angle object or undefined if not found.
export const findAngleInTriangle = (angles, pointId, neighbor1Id, neighbor2Id) => {
    const angle = angles.find(a => {
        
        return a.pointId === pointId &&
            a.sidepoints &&
            a.sidepoints.length === 2 &&
            ((a.sidepoints[0] === neighbor1Id && a.sidepoints[1] === neighbor2Id) ||
             (a.sidepoints[0] === neighbor2Id && a.sidepoints[1] === neighbor1Id));
    });

    return angle;
}

// Groups angles by their vertex pointId for O(1) lookup by vertex.
// Returns an object where keys are pointIds and values are arrays of angles.
export const getAngleMapsByPointId = (angles) => {
    const anglePointIdMap = angles.reduce((obj, angle) => {
        const {
            pointId
        } = angle;
        if (!obj[pointId]) {
            obj[pointId] = [];
        }
        obj[pointId].push(angle);
        return obj;
    }, {});

    return anglePointIdMap;
}

// Validates all triangles by checking if their angles sum to 180°.
// Returns true only if all triangles are complete (no unknown angles).
export const validateAllTriangles = (triangles, angles) => {
    let validCount = 0;
    let invalidCount = 0;
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
        } else {
            const sum = value1 + value2 + value3;
            const diff = Math.abs(sum - 180);
            
            if (diff < TOLERANCE) {
                validCount++;
            } else {
                invalidCount++;
            }
        }
    }
    
    return incompleteCount === 0;
}

// Checks if all triangles have valid angle sums (180° within tolerance).
// Returns false if any triangle has unknown angles or invalid sum.
export const areAllTrianglesValid = (triangles, angles) => {
    // If no triangles, can't validate - continue solving
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
        
        // If any angle is unknown, this triangle isn't solved yet - continue solving
        if (value1 === null || value2 === null || value3 === null) {
            return false;
        }
        
        // All angles are known - check if they sum to 180°
        const sum = value1 + value2 + value3;
        const diff = Math.abs(sum - 180);
        
        if (diff > TOLERANCE) {
            return false;
        }
        
        hasAtLeastOneValidTriangle = true;
    }
    
    // Only return true if we found at least one complete, valid triangle
    return hasAtLeastOneValidTriangle;
}

/**
 * Check if angle values match a pattern
 * Pattern: 'K' = known (not null), 'U' = unknown (null)
 * Example: hasValuePattern([v1, v2, v3], 'KKU') checks if first two are known, third is unknown
 * @param {Array} values - Array of values to check
 * @param {string} pattern - Pattern string with 'K' for known, 'U' for unknown
 * @returns {boolean} True if values match the pattern
 */

/**
 * Get numeric value from an angle object
 * @param {Object} angle - Angle object with value property
 * @returns {number|null} Parsed numeric value or null if not available
 */
export function getAngleValue(angle) {
    if (!angle.value || angle.value === '?') return null;
    const parsed = parseFloat(angle.value);
    if (isNaN(parsed)) return null;
    return parsed || null;
}

/**
 * Get an unused Greek letter for angle labeling
 * @param {Array} angles - Array of angle objects with label property
 * @returns {string} An unused Greek letter
 */
export function getUnusedGreekLetter(angles) {
    // List of Greek letters to use
    const greekLetters = ['α', 'β', 'γ', 'δ', 'ε', 'ζ', 'η', 'θ', 'ι', 'κ', 'λ', 'μ', 'ν', 'ξ', 'ο', 'π', 'ρ', 'σ', 'τ', 'υ', 'φ', 'χ', 'ψ', 'ω'];
    
    // Get all currently used labels
    const usedLabels = new Set(angles.map(a => a.label).filter(l => l));
    
    // Find first unused letter
    for (const letter of greekLetters) {
        if (!usedLabels.has(letter)) {
            return letter;
        }
    }
    
    // If all letters are used, return the first one (fallback)
    return greekLetters[0];
}

const EDGE_DETECTION_THRESHOLD = 5;
export const findNearbyEdges = (x, y, edges, pointsMap) => {
    const closestEdges = [];
    let closestDistance = EDGE_DETECTION_THRESHOLD;
    
    for (const edge of edges) {
        const point1 = pointsMap.get(edge.points[0]);
        const point2 = pointsMap.get(edge.points[1]);
        
        if (!point1 || !point2) continue;
        
        // Calculate distance from point to line segment
        const { distance, closestPoint } = pointToSegmentDistance(x, y, point1.x, point1.y, point2.x, point2.y);
        
        if (distance < closestDistance) {
            closestEdges.push({ edge, distance, closestPoint });
        }
    }

    closestEdges.sort((a, b) => a.distance - b.distance);
    return closestEdges;
}

/**
 * Check if a test point is inside an angle formed by vertex and two other points
 * @param {Object} vertex - Vertex point with x, y coordinates
 * @param {Object} p1 - First point of angle with x, y coordinates
 * @param {Object} p2 - Second point of angle with x, y coordinates
 * @param {Object} pTest - Test point with x, y coordinates
 * @returns {boolean} True if test point is inside the angle
 */
export function isPointInsideAngle(vertex, p1, p2, pTest) {
    // Calculate angles from vertex to each point
    const angle1 = pointToAngle(vertex, p1);
    const angle2 = pointToAngle(vertex, p2);
    const angleTest = pointToAngle(vertex, pTest);
    
    // Normalize angles to [0, 2π]
    let a1 = normalizeAngle(angle1);
    let a2 = normalizeAngle(angle2);
    let aTest = normalizeAngle(angleTest);
    
    // Calculate the angle span
    let angleDiff = a2 - a1;
    if (angleDiff < 0) angleDiff += 2 * Math.PI;
    
    // We want the smaller angle (< 180°)
    if (angleDiff > Math.PI) {
        [a1, a2] = [a2, a1];
        angleDiff = 2 * Math.PI - angleDiff;
    }
    
    // Check if aTest is between a1 and a2 (going counterclockwise)
    let testDiff = aTest - a1;
    if (testDiff < 0) testDiff += 2 * Math.PI;
    
    return testDiff > 0 && testDiff < angleDiff;
}

export const isAngleInTriangleByEdges = (vertexId, point1Id, point2Id, adjacentPoints) => {
    // Check if there's an edge between point1 and point2
    const vertexNeighbors = adjacentPoints.get(vertexId);
    const point1Neighbors = adjacentPoints.get(point1Id);
    if (!point1Neighbors) return false;
    
    return point1Neighbors.has(point2Id) && vertexNeighbors.has(point1Id) && vertexNeighbors.has(point2Id);
}

export const getTriangles = (angles, adjacentPoints, lines, pointsMap) => {
    // Clear existing triangles
    const triangles = [];
    
    // Get all points that have adjacency relationships
    const pointIds = Array.from(adjacentPoints.keys());
    
    // Part 1: Explicit triangles (all 3 edges exist)
    for (let i = 0; i < pointIds.length; i++) {
        for (let j = i + 1; j < pointIds.length; j++) {
            for (let k = j + 1; k < pointIds.length; k++) {
                const p1 = pointIds[i];
                const p2 = pointIds[j];
                const p3 = pointIds[k];
                
                // Check if these 3 points form a triangle
                // A triangle exists if each pair of points is connected (adjacent)
                const p1Adjacent = adjacentPoints.get(p1) || new Set();
                const p2Adjacent = adjacentPoints.get(p2) || new Set();
                const p3Adjacent = adjacentPoints.get(p3) || new Set();
                
                const hasEdge12 = p1Adjacent.has(p2) || p2Adjacent.has(p1);
                const hasEdge13 = p1Adjacent.has(p3) || p3Adjacent.has(p1);
                const hasEdge23 = p2Adjacent.has(p3) || p3Adjacent.has(p2);
                
                if (hasEdge12 && hasEdge13 && hasEdge23) {
                    // Check if the three points are collinear - if so, skip (not a valid triangle)
                    const areCollinear = lines.some(line => 
                        line.includes(p1) && line.includes(p2) && line.includes(p3)
                    );
                    
                    if (!areCollinear) {
                        // Create a Set with the 3 point IDs (sorted for consistency)
                        const triangle = new Set([p1, p2, p3]);
                        triangles.push(triangle);
                    }
                }
            }
        }
    }
    
    // Part 2: Implicit triangles (apex + 2 points on collinear line)
    // When points are collinear, they're implicitly connected
    // So: apex point (not on line) + any 2 points from line = valid triangle
    lines.forEach(line => {
        if (line.length < 2) return; // Need at least 2 points on the line
        
        // Find all points NOT on this line (potential apex points)
        const apexPoints = pointIds.filter(pointId => !line.includes(pointId));
        
        // For each apex point
        apexPoints.forEach(apex => {
            const apexAdjacent = adjacentPoints.get(apex) || new Set();
            
            // For each pair of points on the collinear line
            for (let i = 0; i < line.length; i++) {
                for (let j = i + 1; j < line.length; j++) {
                    const linePoint1 = line[i];
                    const linePoint2 = line[j];
                    
                    // Check if apex has edges to both points on the line
                    const hasEdgeToP1 = apexAdjacent.has(linePoint1);
                    const hasEdgeToP2 = apexAdjacent.has(linePoint2);
                    
                    if (hasEdgeToP1 && hasEdgeToP2) {
                        // Valid implicit triangle!
                        const triangleKey = [apex, linePoint1, linePoint2].sort().join(',');
                        
                        // Check if this triangle already exists (from explicit detection)
                        const alreadyExists = triangles.some(tri => {
                            const triKey = Array.from(tri).sort().join(',');
                            return triKey === triangleKey;
                        });
                        
                        if (!alreadyExists) {
                            const triangle = new Set([apex, linePoint1, linePoint2]);
                            triangles.push(triangle);
                        }
                    }
                }
            }
        });
    });
      
    // Un-hide angles that should now be visible (in triangle OR supplementary, and not overlapping)
    angles.forEach(angle => {
        if (angle.hide && angle.groupElement) {
            const isAngleInTriangle = triangles.some(triangle => 
                triangle.has(angle.pointId) && 
                triangle.has(angle.sidepoints[0]) && 
                triangle.has(angle.sidepoints[1])
            );
            
            // Check if vertex is on a line (supplementary angle)
            const isSupplementaryAngle = lines.some(line => line.includes(angle.pointId));
            
            // Check if it should still be hidden due to overlap
            const overlappingAngles = findOverlappingAngles(
                angle.pointId, 
                angle.sidepoints[0], 
                angle.sidepoints[1], 
                angles.filter(a => a.id !== angle.id), 
                lines, 
                pointsMap
            );
            const hasOverlap = overlappingAngles.length > 0;
            
            // Un-hide if (in triangle OR supplementary) and not overlapping
            if ((isAngleInTriangle || isSupplementaryAngle) && !hasOverlap) {
                angle.hide = false;
                angle.groupElement.style.display = '';
            }
        }
    });

    return triangles;
}

/**
 * Build overlapping angles map
 * Identifies angles that share a vertex, one common ray, and have collinear non-common rays on the same side
 * @param {Array} angles - Array of angle objects with id, point (vertex), sidepoints properties
 * @param {Array<Array<string>>} lines - Array of collinear point arrays
 * @param {Map<string, Object>} pointsMap - Map of point IDs to point objects with x, y coordinates
 * @returns {Map<string, Set<string>>} Map where keys are angle IDs and values are Sets of overlapping angle IDs
 */
export function buildOverlappingAnglesMap(angles, lines, overlappingAngles) {
   
    // For each angle, check if it overlaps with subsequently processed angles
    angles.forEach((angle, index) => {
        // Skip angles that don't have the required properties
        if (!angle.pointId || !angle.sidepoints || angle.sidepoints.length !== 2) {
            return;
        }
        
        // Check all angles that come after this one
        for (let i = index + 1; i < angles.length; i++) {
            const otherAngle = angles[i];
            
            // Skip angles that don't have the required properties
            if (!otherAngle.pointId || !otherAngle.sidepoints || otherAngle.sidepoints.length !== 2) {
                continue;
            }
            
            // Check if they have the same vertex
            if (angle.pointId !== otherAngle.pointId) {
                continue;
            }
            
            // Check if they share exactly one neighbor
            const sharedNeighbors = angle.sidepoints.filter(
                n => otherAngle.sidepoints.includes(n)
            );
            
            if (sharedNeighbors.length !== 1) {
                continue;
            }
            
            // Find the non-shared neighbors
            const angleOtherNeighbor = angle.sidepoints.find(n => n !== sharedNeighbors[0]);
            const otherAngleOtherNeighbor = otherAngle.sidepoints.find(n => n !== sharedNeighbors[0]);
            
            // Check if the two non-shared neighbors are collinear with the vertex
            if (!arePointsCollinear(angle.pointId, angleOtherNeighbor, otherAngleOtherNeighbor, lines)) {
                continue;
            }
            
            // Check if they're on the same side (overlapping) or opposite sides (supplementary)
            let onSameSide = false;
            for (const line of lines) {
                if (line.includes(angle.pointId) && line.includes(angleOtherNeighbor) && line.includes(otherAngleOtherNeighbor)) {
                    const vertexIndex = line.indexOf(angle.pointId);
                    const index1 = line.indexOf(angleOtherNeighbor);
                    const index2 = line.indexOf(otherAngleOtherNeighbor);
                    
                    // Same side: both points on same side of vertex in line array
                    // Both before vertex OR both after vertex
                    const bothBefore = (index1 < vertexIndex && index2 < vertexIndex);
                    const bothAfter = (index1 > vertexIndex && index2 > vertexIndex);
                    
                    onSameSide = bothBefore || bothAfter;
                    break;
                }
            }
            
            // Only mark as overlapping if they're on the SAME side
            if (onSameSide) {
                // They overlap! Add to the map
                // If angle doesn't have a group yet, create one
                if (!overlappingAngles.has(angle.id)) {
                    overlappingAngles.set(angle.id, new Set([angle.id]));
                }
                
                // Add otherAngle to angle's group
                overlappingAngles.get(angle.id).add(otherAngle.id);
                
                // Make otherAngle point to the same Set (same group)
                overlappingAngles.set(otherAngle.id, overlappingAngles.get(angle.id));
            }
        }
    });
    
    return overlappingAngles;
}

export const getSameAngleNames = (angleData, angles, lines) => {
    const sameAngles = getSameAngles(angleData, angles, lines);
    if (!sameAngles || !Array.isArray(sameAngles)) return [];
    return sameAngles.map(angle => angle.name);
}

export const getSameAngles = (angleData, angles, lines) => {
    const anglesWithThisVertex = angles.filter(a => a.pointId === angleData.pointId);
    
    // Group angles that represent the same geometric angle
    const sameAngles = [];
    for (const angle of anglesWithThisVertex) {
        if (areSameAngle(angleData, angle, lines)) {
            sameAngles.push(angle);
        }
    }
    
    return sameAngles.length > 0 ? sameAngles : [angleData];
}

// Check if two angles are the same geometric angle (considering collinear rays)
export const areSameAngle = (a1, a2, lines) => {
    if (a1.pointId !== a2.pointId) return false;
    if (a1.id === a2.id) return true;
    
    const v = a1.pointId;
    const [p1, p2] = a1.sidepoints;
    const [q1, q2] = a2.sidepoints;
    
    // Check if rays match in same or opposite order
    const sameOrder = isSameRay(p1, q1, v, lines) && isSameRay(p2, q2, v, lines);
    const oppositeOrder = isSameRay(p1, q2, v, lines) && isSameRay(p2, q1, v, lines);
    
    return sameOrder || oppositeOrder;
};

// Check if two points define the same ray from vertex (using only lines)
export const isSameRay = (p1, p2, vertex, lines) => {
    if (p1 === p2) return true;
    
    // Same ray = both points on same side of vertex in a line
    for (const line of lines) {
        if (!line.includes(vertex) || !line.includes(p1) || !line.includes(p2)) continue;
        
        const vi = line.indexOf(vertex);
        const i1 = line.indexOf(p1);
        const i2 = line.indexOf(p2);
        
        // Both before OR both after vertex = same ray
        if ((i1 < vi && i2 < vi) || (i1 > vi && i2 > vi)) {
            return true;
        }
    }
    return false;
};

export const getAngleCalculatedInfo = (vertex, point1, point2) => {
    let angle1 = pointToAngle(vertex, point1);
    let angle2 = pointToAngle(vertex, point2);
    
    let angleDiff = angle2 - angle1;
    
    // Normalize to [0, 2π]
    angleDiff = normalizeAngle(angleDiff);
    
    // Only show if angle < 180°
    if (angleDiff > Math.PI) {
        angleDiff = 2 * Math.PI - angleDiff;
        // Swap angles
        [angle1, angle2] = [angle2, angle1];
    }
    
    const angleDegrees = Math.round(radiansToDegrees(angleDiff));
    if ((angleDiff < Math.PI && angleDiff > 0.1 && angleDegrees < 179) === false) {
        return;
    }
    
    // Calculate radius based on angle value: 20 + (angle / 5)
    // This makes larger angles have larger arcs for better visibility
    const radius = Math.round(20 + (angleDegrees / 5));
    return {
        radius,
        angleDegrees,
        angle1,
        angle2
    };
}

// Find groups of angles that are geometrically the same
export const findSameAnglesGroups = (angles, lines) => {
    const angleGroups = [];
    for (let i = 0; i < angles.length; i++) {
        const sameAngles = [];
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

export const increaseAngleRadius = (currentPath, increaseBy) => {
    const arcMatch = currentPath.match(/A\s+([\d.]+)\s+([\d.]+)/);
    if (arcMatch) {
        // It's an arc path
        const oldRadius = parseFloat(arcMatch[1]);
        const newRadius = oldRadius + increaseBy;
        
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
                return updatedPath;
            }
        }
    } else {
        // It's a square corner path - increase the square size
        const lines = currentPath.match(/L\s+([\d.]+)\s+([\d.]+)/g);
        if (!lines || lines.length < 3) {
            return;
        }
        const vertexMatch = currentPath.match(/M\s+([\d.]+)\s+([\d.]+)/);
        if (!vertexMatch) { return; }
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
        return updatedPath;          
    }
};