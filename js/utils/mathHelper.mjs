// Math helper functions for geometry calculations
export function getNewPointName(index) {
    return String.fromCharCode(65 + (index % 26));
}

export function distance(x1, y1, x2, y2) {
    // Calculate Euclidean distance between two points
    return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
}

export function lineIntersection(x1, y1, x2, y2, x3, y3, x4, y4) {
    // Calculate intersection point between two line segments
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

export function pointToSegmentDistance(px, py, x1, y1, x2, y2) {
        // Calculate the distance from point (px, py) to line segment (x1,y1)-(x2,y2)
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

export function clipLineToCanvas(x1, y1, x2, y2, width, height) {
    // Find where the line intersects with canvas boundaries
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

export function calculateAngleDegrees(vertex, point1, point2) {
    // Calculate angle at vertex between two rays: vertex->point1 and vertex->point2
    const dx1 = point1.x - vertex.x;
    const dy1 = point1.y - vertex.y;
    const dx2 = point2.x - vertex.x;
    const dy2 = point2.y - vertex.y;
    
    const angle1 = Math.atan2(dy1, dx1);
    const angle2 = Math.atan2(dy2, dx2);
    
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
export function angleToPoint(x1, y1, x2, y2) {
    return Math.atan2(y2 - y1, x2 - x1);
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
        if (existingAngle.point !== vertexId) return false;
        
        // Find shared neighbors
        const sharedNeighbors = existingAngle.neighborPoints.filter(
            n => n === neighbor1Id || n === neighbor2Id
        );
        
        // Must share exactly one neighbor
        if (sharedNeighbors.length !== 1) return false;
        
        // Find the non-shared neighbors
        const existingOtherNeighbor = existingAngle.neighborPoints.find(
            n => n !== sharedNeighbors[0]
        );
        const newOtherNeighbor = (neighbor1Id === sharedNeighbors[0]) ? neighbor2Id : neighbor1Id;
        
        // Check if the two non-shared neighbors are collinear with the vertex
        const areCollinear = arePointsCollinear(vertexId, existingOtherNeighbor, newOtherNeighbor, lines);
        
        if (!areCollinear) return false;
        
        // CRITICAL: Use dot product to check if the two non-shared neighbors are on OPPOSITE SIDES
        // Get the vertex and neighbor points
        const vertex = pointsMap.get(vertexId);
        const existingPoint = pointsMap.get(existingOtherNeighbor);
        const newPoint = pointsMap.get(newOtherNeighbor);
        
        if (!vertex || !existingPoint || !newPoint) {
            return false;
        }
        
        // Calculate direction vectors from vertex to each non-shared neighbor
        const toExisting = {
            x: existingPoint.x - vertex.x,
            y: existingPoint.y - vertex.y
        };
        const toNew = {
            x: newPoint.x - vertex.x,
            y: newPoint.y - vertex.y
        };
        
        // Calculate dot product
        const dotProduct = dotProduct2D(toExisting.x, toExisting.y, toNew.x, toNew.y);
        
        console.log(`    Direction vectors: existing=(${toExisting.x}, ${toExisting.y}), new=(${toNew.x}, ${toNew.y})`);
        console.log(`    Dot product: ${dotProduct}`);
        
        if (dotProduct < 0) {
            // Opposite directions = supplementary angles
            console.log(`    → SUPPLEMENTARY (opposite directions) - NOT overlapping`);
            return false;
        } else {
            // Same direction = overlapping angles
            console.log(`    → TRUE OVERLAP (same direction)`);
            return true;
        }
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
export function truncateString(str, maxLen = 35, suffix = '...') {
    return str.length > maxLen ? str.substring(0, maxLen) + suffix : str;
}

/**
 * Check if angle values match a pattern
 * Pattern: 'K' = known (not null), 'U' = unknown (null)
 * Example: hasValuePattern([v1, v2, v3], 'KKU') checks if first two are known, third is unknown
 * @param {Array} values - Array of values to check
 * @param {string} pattern - Pattern string with 'K' for known, 'U' for unknown
 * @returns {boolean} True if values match the pattern
 */
export function hasValuePattern(values, pattern) {
    if (values.length !== pattern.length) return false;
    const checks = {
        'K': v => v !== null,
        'U': v => v === null
    };
    return pattern.split('').every((p, i) => checks[p] && checks[p](values[i]));
}

/**
 * Check if two angles share exactly one edge (common neighbor)
 * @param {Object} angle1 - First angle object with point/pointId and neighborPoints/sidepoints
 * @param {Object} angle2 - Second angle object with point/pointId and neighborPoints/sidepoints
 * @returns {boolean} True if angles share exactly one edge
 */
export function doAnglesShareEdge(angle1, angle2) {
    const point1 = angle1.point || angle1.pointId;
    const point2 = angle2.point || angle2.pointId;
    
    if (point1 !== point2) return false;
    
    const neighbors1 = angle1.neighborPoints || angle1.sidepoints || [];
    const neighbors2 = angle2.neighborPoints || angle2.sidepoints || [];
    
    // Count common neighbors without creating Sets
    let commonCount = 0;
    for (const n1 of neighbors1) {
        if (neighbors2.includes(n1)) commonCount++;
    }
    
    return commonCount === 1;
}

/**
 * Get numeric value from an angle object
 * @param {Object} angle - Angle object with value property
 * @returns {number|null} Parsed numeric value or null if not available
 */
export function getAngleValue(angle) {
    if (!angle.value || angle.value === '?') return null;
    const parsed = parseFloat(angle.value);
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
    const angle1 = angleToPoint(vertex.x, vertex.y, p1.x, p1.y);
    const angle2 = angleToPoint(vertex.x, vertex.y, p2.x, p2.y);
    const angleTest = angleToPoint(vertex.x, vertex.y, pTest.x, pTest.y);
    
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

/**
 * Build overlapping angles map
 * Identifies angles that share a vertex, one common ray, and have collinear non-common rays on the same side
 * @param {Array} angles - Array of angle objects with id, point (vertex), neighborPoints properties
 * @param {Array<Array<string>>} lines - Array of collinear point arrays
 * @param {Map<string, Object>} pointsMap - Map of point IDs to point objects with x, y coordinates
 * @returns {Map<string, Set<string>>} Map where keys are angle IDs and values are Sets of overlapping angle IDs
 */
export function buildOverlappingAnglesMap(angles, lines, pointsMap) {
    const overlappingAngles = new Map();
    
    // For each angle, check if it overlaps with subsequently processed angles
    angles.forEach((angle, index) => {
        // Skip angles that don't have the required properties
        if (!angle.point || !angle.neighborPoints || angle.neighborPoints.length !== 2) {
            return;
        }
        
        // Check all angles that come after this one
        for (let i = index + 1; i < angles.length; i++) {
            const otherAngle = angles[i];
            
            // Skip angles that don't have the required properties
            if (!otherAngle.point || !otherAngle.neighborPoints || otherAngle.neighborPoints.length !== 2) {
                continue;
            }
            
            // Check if they have the same vertex
            if (angle.point !== otherAngle.point) {
                continue;
            }
            
            // Check if they share exactly one neighbor
            const sharedNeighbors = angle.neighborPoints.filter(
                n => otherAngle.neighborPoints.includes(n)
            );
            
            if (sharedNeighbors.length !== 1) {
                continue;
            }
            
            // Find the non-shared neighbors
            const angleOtherNeighbor = angle.neighborPoints.find(n => n !== sharedNeighbors[0]);
            const otherAngleOtherNeighbor = otherAngle.neighborPoints.find(n => n !== sharedNeighbors[0]);
            
            // Check if the two non-shared neighbors are collinear with the vertex
            if (!arePointsCollinear(angle.point, angleOtherNeighbor, otherAngleOtherNeighbor, lines)) {
                continue;
            }
            
            // Check if they're on the same side (overlapping) or opposite sides (supplementary)
            const vertex = pointsMap.get(angle.point);
            const point1 = pointsMap.get(angleOtherNeighbor);
            const point2 = pointsMap.get(otherAngleOtherNeighbor);
            
            if (!vertex || !point1 || !point2) {
                continue;
            }
            
            // Calculate direction vectors from vertex to each non-shared neighbor
            const toPoint1 = {
                x: point1.x - vertex.x,
                y: point1.y - vertex.y
            };
            const toPoint2 = {
                x: point2.x - vertex.x,
                y: point2.y - vertex.y
            };
            
            // Calculate dot product
            const dotProduct = dotProduct2D(toPoint1.x, toPoint1.y, toPoint2.x, toPoint2.y);
            
            // Only mark as overlapping if they're on the SAME side (positive dot product)
            if (dotProduct >= 0) {
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