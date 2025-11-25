/**
 * Data Serialization and Deserialization utilities
 * Handles conversion between internal geometry data structures and JSON format
 */

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
        triangles = [],
        definitions = []
    } = geometryData;

    return {
        points: points.map(point => ({
            id: point.id,
            x: point.x,
            y: point.y,
            notes: point.notes || ''
        })),
        edges: edges.map(edge => ({
            points: edge.points || [],
            notes: edge.notes || ''
        })),
        circles: circles.map(circle => ({
            name: circle.id || circle.name,
            centerPoint: circle.centerPoint,
            centerX: circle.centerX,
            centerY: circle.centerY,
            radius: circle.radius,
            pointsOnLine: circle.pointsOnLine || []
        })),
        angles: angles.map(angle => ({
            pointId: angle.point,
            sidepoints: angle.neighborPoints || [],
            value: angle.value,
            calculatedValue: angle.calculatedValue,
            label: angle.label || '',
            notes: angle.notes || ''
        })),
        lines: lines,
        triangles: triangles.map(triangle => Array.from(triangle).sort()),
        definitions: definitions.map(def => ({
            id: def.id,
            text: def.text,
            timestamp: def.timestamp
        }))
    };
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
        normalized.points = jsonData.points.map(pointData => ({
            id: pointData.id || pointData.name, // Support both id and name
            x: pointData.x,
            y: pointData.y,
            notes: pointData.notes || ''
        }));
    }

    // Normalize edges
    if (jsonData.edges && Array.isArray(jsonData.edges)) {
        normalized.edges = jsonData.edges.map(edgeData => {
            // Support multiple formats: points array, point1/point2, or direct array
            let points;
            if (edgeData.points && Array.isArray(edgeData.points)) {
                points = edgeData.points;
            } else if (edgeData.point1 && edgeData.point2) {
                points = [edgeData.point1, edgeData.point2];
            } else if (Array.isArray(edgeData) && edgeData.length === 2) {
                points = edgeData;
            } else {
                points = [];
            }

            return {
                points,
                notes: edgeData.notes || ''
            };
        });
    }

    // Normalize circles
    if (jsonData.circles && Array.isArray(jsonData.circles)) {
        normalized.circles = jsonData.circles.map(circleData => {
            // Support multiple formats for backward compatibility
            let centerPoint, pointsOnLine = [];

            if (circleData.centerPoint !== undefined) {
                // New format
                centerPoint = circleData.centerPoint;
                pointsOnLine = circleData.pointsOnLine || [];
            } else if (circleData.centerPointId) {
                // Old format with centerPointId/radiusPointId
                centerPoint = circleData.centerPointId;
                pointsOnLine = circleData.radiusPointId ? [circleData.radiusPointId] : [];
            } else if (circleData.point1) {
                // Very old format with point1/point2
                centerPoint = circleData.point1;
                pointsOnLine = circleData.point2 ? [circleData.point2] : [];
            }

            // Also include old 'points' array if it exists
            if (circleData.points && Array.isArray(circleData.points)) {
                pointsOnLine = [...new Set([...pointsOnLine, ...circleData.points])];
            }

            return {
                id: circleData.id || circleData.name,
                centerPoint,
                centerX: circleData.centerX,
                centerY: circleData.centerY,
                radius: circleData.radius,
                pointsOnLine
            };
        });
    }

    // Normalize angles
    if (jsonData.angles && Array.isArray(jsonData.angles)) {
        normalized.angles = jsonData.angles.map(angleData => {
            // Support both old format (vertexId, point1Id, point2Id) and new format (pointId, sidepoints)
            let pointId, sidepoints;

            if (angleData.pointId) {
                pointId = angleData.pointId;
            } else if (angleData.vertexId) {
                pointId = angleData.vertexId;
            }

            // Support multiple sidepoint formats
            if (angleData.sidepoints && angleData.sidepoints.length === 2) {
                sidepoints = angleData.sidepoints;
            } else if (angleData.sidePoints && angleData.sidePoints.length === 2) {
                sidepoints = angleData.sidePoints;
            } else if (angleData.point1Id && angleData.point2Id) {
                sidepoints = [angleData.point1Id, angleData.point2Id];
            } else {
                sidepoints = [];
            }

            return {
                pointId,
                sidepoints,
                value: angleData.value,
                calculatedValue: angleData.calculatedValue,
                label: angleData.label !== undefined ? angleData.label : '',
                notes: angleData.notes || '',
                id: angleData.id,
                radius: angleData.radius
            };
        });
    }

    // Normalize lines
    if (jsonData.lines && Array.isArray(jsonData.lines)) {
        normalized.lines = JSON.parse(JSON.stringify(jsonData.lines)); // Deep copy
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
 * Build internal geometry data structures from normalized JSON
 * Creates adjacency maps, points map, and properly formatted angles for AngleSolver
 * @param {Object} jsonData - Normalized JSON data from deserializeGeometryData
 * @returns {Object} Complete internal data structure ready for AngleSolver
 */
export function buildInternalGeometryData(jsonData) {
    // Build adjacency map
    const adjacentPoints = new Map();
    jsonData.points.forEach(point => {
        adjacentPoints.set(point.id, new Set());
    });
    
    jsonData.edges.forEach(edge => {
        const [p1, p2] = edge.points;
        adjacentPoints.get(p1).add(p2);
        adjacentPoints.get(p2).add(p1);
    });
    
    // Build points map
    const pointsMap = new Map();
    jsonData.points.forEach(point => {
        pointsMap.set(point.id, point);
    });
    
    // Process angles - convert from JSON format to internal format
    const angles = jsonData.angles.map((angleData, index) => {
        const vertexId = angleData.pointId || angleData.vertexId;
        const neighborPoints = angleData.sidepoints || angleData.sidePoints || [angleData.point1Id, angleData.point2Id];
        
        return {
            id: angleData.id || `angle-${index}`,
            point: vertexId,
            pointId: vertexId,
            neighborPoints: neighborPoints,
            sidepoints: neighborPoints,
            value: angleData.value,
            label: angleData.label || '',
            name: `∠${vertexId}(${neighborPoints.join(',')})`,
            notes: angleData.notes || '',
            radius: angleData.radius
        };
    });
    
    // Process triangles
    const triangles = (jsonData.triangles || []).map(t => new Set(t));
    
    // Process circles
    const circles = (jsonData.circles || []).map(circleData => ({
        name: circleData.name || circleData.id,
        centerPoint: circleData.centerPoint,
        centerX: circleData.centerX,
        centerY: circleData.centerY,
        radius: circleData.radius,
        pointsOnLine: circleData.pointsOnLine || []
    }));
    
    return {
        adjacentPoints,
        circles,
        edges: jsonData.edges || [],
        points: jsonData.points || [],
        lines: jsonData.lines || [],
        pointsMap,
        angles,
        triangles
    };
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

