import {
    
    arePointsCollinear,
    buildOverlappingAnglesMap,
    isThisAngle,
    findPointNeighbors,
    getTriangles,
    getAngleDisplayText,
    getAngleNameFromPoints,
    getAngleCalculatedInfo,
} from '../utils/mathHelper.mjs';

/**
 * Data Serialization and Deserialization utilities
 * Handles conversion between internal geometry data structures and JSON format
 */

import { deepClone } from './objectHelper.mjs';

/**
 * Serialize geometry data to JSON-compatible format
 * @param {Object} geometryData - The geometry data from main.mjs instance
 * @param {Array} geometryData.points - Array of point objects
 * @param {Array} geometryData.edges - Array of edge objects
 * @param {Array} geometryData.circles - Array of circle objects
 * @param {Array} geometryData.angles - Array of angle objects
 * @param {Array} geometryData.lines - Array of collinear point arrays
 * @param {Array} geometryData.triangles - Array of triangle Sets
 * @param {Array} geometryData.definitions - Array of definition objects
 * @returns {Object} JSON-compatible data structure
 */
export function serializeGeometryData(geometryData) {
    const {
        points = [],
        edges = [],
        circles = [],
        angles = [],
        lines = [],
        definitions = []
    } = geometryData;

    const result = {
        points: points.map(point => {
            const serialized = {
                id: point.id,
                x: Math.round(point.x),
                y: Math.round(point.y)
            };
            if (point.hide) serialized.h = 1;
            return serialized;
        }),
        edges: edges.map(edge => {
            const serialized = {
                p: edge.points || [],
            };
            if (edge.hide) serialized.h = 1;
            return serialized;
        }),
        circles: circles.map(circle => {
            const serialized = {
                id: circle.centerPoint,
                x: Math.round(circle.centerX),
                y: Math.round(circle.centerY),
                r: Math.round(circle.radius)
            };
            if (circle.pointsOnLine && circle.pointsOnLine.length > 0) {
                serialized.p = circle.pointsOnLine;
            }
            if (circle.hide) serialized.h = 1;
            return serialized;
        }),
        angles: angles.map(angle => {
            const serialized = {
                id: angle.pointId,
                p: angle.sidepoints || [],
            };
            if (angle.value != null) serialized.v = angle.value;
            if (angle.label) serialized.l = angle.label;
            if (angle.hide) serialized.h = 1;
            if (angle.target) serialized.t = 1;
            return serialized;
        }),
        lines: lines.map(line => line.points)
        // triangles removed - they are rebuilt from edges/lines by updateTriangles()
    };
    
    // Only include definitions if not empty
    if (definitions && definitions.length > 0) {
        result.definitions = definitions.map(def => ({
            id: def.id,
            text: def.text,
            timestamp: def.timestamp
        }));
    }
    
    return result;
}

/**
 * Deserialize JSON data to normalized format for loading
 * Handles backward compatibility with multiple formats
 * @param {Object} jsonData - Raw JSON data from file/clipboard
 * @returns {Object} Normalized data structure ready for loading
 */
export function deserializeGeometryData(jsonData) {
    const normalized = {
        points: [],
        edges: [],
        circles: [],
        angles: [],
        lines: [],
        triangles: [],
        definitions: []
    };

    // Normalize points
    if (jsonData.points && Array.isArray(jsonData.points)) {
        normalized.points = jsonData.points.map(pointData => {
            const point = {
                id: pointData.id || pointData.name, // Support both id and name
                x: Math.round(pointData.x),
                y: Math.round(pointData.y),
                hide: !!pointData.h
            };
            return point;
        });
    }

    // Normalize edges
    if (jsonData.edges && Array.isArray(jsonData.edges)) {
        normalized.edges = jsonData.edges.map(edgeData => {
            const edge = {
                points: edgeData.p,
                hide: !!edgeData.h
            };
            return edge;
        });
    }

    // Normalize circles
    if (jsonData.circles && Array.isArray(jsonData.circles)) {
        normalized.circles = jsonData.circles.map(circleData => {
            const circle = {
                id: circleData.id,
                centerPoint: circleData.id,
                centerX: Math.round(circleData.x),
                centerY: Math.round(circleData.y),
                radius: Math.round(circleData.r),
                pointsOnLine: circleData.p || [],
                hide: !!circleData.h
            };
            return circle;
        });
    }

    // Normalize angles
    if (jsonData.angles && Array.isArray(jsonData.angles)) {
        normalized.angles = jsonData.angles.map(angleData => {
            // Support multiple formats: new short (id, p, v, l) and old formats
            const angle = {
                id: Math.random().toString(36),
                pointId: angleData.id,
                sidepoints: angleData.p,
                value: angleData.v || null,
                label: angleData.l || '',
                hide: !!angleData.h,
                target: !!angleData.t,
                name: getAngleNameFromPoints(angleData.id, angleData.p[0], angleData.p[1]),
                // ui related and will be populated later
                radius: null,
                calculatedValue: null,
                startAngle: null,
                endAngle: null,
                groupElement: null

            };
            return angle;
        });
    }

    // Normalize lines
    if (jsonData.lines && Array.isArray(jsonData.lines)) {
        normalized.lines = deepClone(jsonData.lines); // Deep copy
    }

    // Normalize triangles
    if (jsonData.triangles && Array.isArray(jsonData.triangles)) {
        normalized.triangles = jsonData.triangles.map(triangle => {
            if (triangle instanceof Set) {
                return Array.from(triangle);
            } else if (Array.isArray(triangle)) {
                return triangle;
            } else {
                return [];
            }
        });
    }

    // Normalize definitions
    if (jsonData.definitions && Array.isArray(jsonData.definitions)) {
        normalized.definitions = jsonData.definitions.map(def => ({
            id: def.id,
            text: def.text,
            timestamp: def.timestamp
        }));
    }

    return normalized;
}

/**
 * Validate geometry data structure
 * @param {Object} data - Data to validate
 * @returns {Object} Validation result with isValid flag and errors array
 */
export function validateGeometryData(data) {
    const errors = [];

    // Check required fields
    if (!data) {
        errors.push('Data is null or undefined');
        return { isValid: false, errors };
    }

    // Validate points
    if (data.points) {
        if (!Array.isArray(data.points)) {
            errors.push('points must be an array');
        } else {
            data.points.forEach((point, index) => {
                if (!point.id) errors.push(`Point at index ${index} missing id`);
                if (typeof point.x !== 'number') errors.push(`Point ${point.id} has invalid x coordinate`);
                if (typeof point.y !== 'number') errors.push(`Point ${point.id} has invalid y coordinate`);
            });
        }
    }

    // Validate edges
    if (data.edges) {
        if (!Array.isArray(data.edges)) {
            errors.push('edges must be an array');
        } else {
            data.edges.forEach((edge, index) => {
                if (!edge.points || !Array.isArray(edge.points) || edge.points.length !== 2) {
                    errors.push(`Edge at index ${index} has invalid points array`);
                }
            });
        }
    }

    // Validate circles
    if (data.circles) {
        if (!Array.isArray(data.circles)) {
            errors.push('circles must be an array');
        } else {
            data.circles.forEach((circle, index) => {
                if (!circle.centerPoint) errors.push(`Circle at index ${index} missing centerPoint`);
                if (typeof circle.radius !== 'number') errors.push(`Circle at index ${index} has invalid radius`);
            });
        }
    }

    // Validate angles
    if (data.angles) {
        if (!Array.isArray(data.angles)) {
            errors.push('angles must be an array');
        } else {
            data.angles.forEach((angle, index) => {
                if (!angle.pointId) errors.push(`Angle at index ${index} missing pointId`);
                if (!angle.sidepoints || !Array.isArray(angle.sidepoints) || angle.sidepoints.length !== 2) {
                    errors.push(`Angle at index ${index} has invalid sidepoints`);
                }
            });
        }
    }

    return {
        isValid: errors.length === 0,
        errors
    };
}

export const enrichGeometryData = (data) => {
    // Clear current state
    const adjacentPoints = new Map(); // helper where the key is point id and the value is a Set of adjacent point ids
    const angles = [];
    const anglesToCreate = [];
    const circles = [];
    const definitions = data.definitions || [];
    const edges = [];
    const lines = [];
    const points = [];
    const pointsMap = new Map(); // helper where the key is the point id and the value is the point object
    const overlappingAngles = new Map();
    const triangles = [];
        
    // normalize points
    if (data.points) {
        data.points.forEach(pointData => {
            const point = {
                id: pointData.id,
                x: Math.round(pointData.x),
                y: Math.round(pointData.y)
            };
            if (pointData.hide) point.hide = true;
            points.push(point);
            pointsMap.set(point.id, point);
        });
    }

    const addAdjacentPoint = (pointId, adjacentPointId) => {
        if (!adjacentPoints.has(pointId)) {
            adjacentPoints.set(pointId, new Set());
        }
        adjacentPoints.get(pointId).add(adjacentPointId);
    };

    data.lines.forEach(linePoints => {
        // Rebuild lines
        lines.push({
            id: Math.random().toString(32),
            points: linePoints
        });
    });

    // Restore edges
    if (data.edges) {
        data.edges.forEach(edgeData => {
            const pointIds = edgeData.points;
            const point1 = pointsMap.get(pointIds[0]);
            const point2 = pointsMap.get(pointIds[1]);
            
            if (point1 && point2) {
                const edge = {
                    points: [pointIds[0], pointIds[1]],
                    hide: edgeData.hide,
                    element: null // to be set after drawing
                };

                edges.push(edge);
                
                // Rebuild adjacentPoints map
                addAdjacentPoint(pointIds[0], pointIds[1]);
                addAdjacentPoint(pointIds[1], pointIds[0]);
            }
        });
    }
    
    // Restore circles
    if (data.circles) {
        data.circles.forEach(circleData => {
            const centerPointId = circleData.centerPoint;
            const pointsOnLine = circleData.pointsOnLine || [];
            const centerPoint = pointsMap.get(centerPointId);
            
            // Validate that all points on line exist
            const validPointsOnLine = pointsOnLine.filter(id => pointsMap.get(id));
            
            if (centerPoint) {
                // Draw circle
                const id = Math.random().toString(36).substring(2, 15);
                const circleObj = {
                    id: id,
                    name: circleData.id || `Circle_${centerPoint.id}`,
                    centerPoint: centerPointId,
                    centerX: Math.round(circleData.centerX),
                    centerY: Math.round(circleData.centerY),
                    radius: Math.round(circleData.radius),
                    pointsOnLine: validPointsOnLine,
                    hide: circleData.hide
                };
                circles.push(circleObj);
            }
        });
    }
            
    // Rebuild triangles BEFORE angles (needed for isAngleInTriangle check)
    triangles.push(...getTriangles(angles, adjacentPoints, lines));
    
    // Restore angles - manually recreate only the angles that existed in the saved data
    if (data.angles) {
        data.angles.forEach(angleData => {
            const vertexId = angleData.pointId;
            const vertex = pointsMap.get(vertexId);
            const point1 = pointsMap.get(angleData.sidepoints[0]);
            const point2 = pointsMap.get(angleData.sidepoints[1]);
            
            if (!vertex || !point1 || !point2) { return; }
            const angle = data.angles.find(a => 
                isThisAngle(a, vertexId, point1.id, point2.id)
            );
            if (!angle) { return; }

            const {
                angle1,
                angle2,
                angleDegrees,
                radius
            } = getAngleCalculatedInfo(vertex, point1, point2);

            angle.radius = radius;
            angle.startAngle = angle1;
            angle.endAngle = angle2;
            angle.calculatedValue = angleDegrees;
            angles.push(angle);
        });
    }

    // Rebuild overlappingAngles map
    // Filter out hidden angles before processing
    const visibleAngles = angles.filter(angle => !angle.hide);
    buildOverlappingAnglesMap(visibleAngles, lines, overlappingAngles);

    // Restore definitions
    if (data.definitions) {
        data.definitions.forEach(defData => definitions.push({
            id: defData.id,
            text: defData.text,
            timestamp: defData.timestamp
        }));
    }
    
    const result = {
        adjacentPoints,
        angles,
        anglesToCreate,
        circles,
        definitions,
        edges,
        lines,
        points,
        pointsMap,
        overlappingAngles,
        triangles
    };

    return result;
}

export const serializeStateForUrl = ({
    points,
    edges,
    circles,
    angles,
    lines,
    triangles,
    definitions
}) => {
    if (angles === 0) {
        alert('No angles to solve!');
        return;
    }
    const data = serializeGeometryData({ points, edges, circles, angles, lines, triangles, definitions });
    data.angles
        .filter(angle => angle.l)
        .forEach(angle =>angle.l = encodeURIComponent(angle.l));
    const encodedData = window.btoa(JSON.stringify(data));
    return encodedData;
}

export const deserializeStateFromUrl = (encodedText) => {
    try {
        const json = window.atob(encodedText);
        const data = JSON.parse(json);
        data.angles
            .filter(angle => angle.l)
            .forEach(angle =>angle.l = decodeURIComponent(angle.l));
        return data;
    } catch (error) {
        console.error('Error loading initial problem:', error);
        return null;
    }
}