import type {
    Point,
    Edge,
    Circle,
    Angle,
    Line,
    Triangle,
    Definition,
    SerializedPoint,
    SerializedEdge,
    SerializedCircle,
    SerializedAngle,
    SerializedGeometryData,
    NormalizedGeometryData,
    EnrichedGeometryData,
    ValidationResult
} from '../types';

import {
    buildOverlappingAnglesMap,
    isThisAngle,
    getAngleNameFromPoints,
    getAngleCalculatedInfo,
    getTriangles2,
} from './mathHelper';

import { deepClone } from './objectHelper';

/**
 * Serialize geometry data to JSON-compatible format
 */
export function serializeGeometryData(geometryData: {
    name?: string;
    points?: Point[];
    edges?: Edge[];
    circles?: Circle[];
    angles?: Angle[];
    lines?: Line[];
    definitions?: Definition[];
}): SerializedGeometryData {
    const {
        points = [],
        edges = [],
        circles = [],
        angles = [],
        lines = [],
        definitions = []
    } = geometryData;

    const result: SerializedGeometryData = {
        points: points.map(point => {
            const serialized: SerializedPoint = {
                id: point.id,
                x: Math.round(point.x),
                y: Math.round(point.y)
            };
            if (point.hide) serialized.h = 1;
            return serialized;
        }),
        edges: edges.map(edge => {
            const serialized: SerializedEdge = {
                p: edge.points,
            };
            if (edge.hide) serialized.h = 1;
            return serialized;
        }),
        circles: circles.map(circle => {
            const serialized: SerializedCircle = {
                id: circle.centerPoint,
                r: Math.round(circle.radius)
            };
            if (circle.pointsOnLine && circle.pointsOnLine.length > 0) {
                serialized.p = circle.pointsOnLine;
            }
            if (circle.hide) serialized.h = 1;
            return serialized;
        }),
        angles: angles.map(angle => {
            const serialized: SerializedAngle = {
                id: angle.pointId,
                p: angle.sidepoints,
            };
            if (angle.value != null) serialized.v = angle.value;
            if (angle.label) serialized.l = angle.label;
            if (angle.hide) serialized.h = 1;
            if (angle.target) serialized.t = 1;
            return serialized;
        }),
        lines: lines.map(line => line.points)
    };

    if (geometryData.name) result.name = geometryData.name;

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
 */
export function deserializeGeometryData(jsonData: Partial<SerializedGeometryData>): NormalizedGeometryData {
    const normalized: NormalizedGeometryData = {
        name: jsonData.name,
        points: [],
        edges: [],
        circles: [],
        angles: [],
        lines: [],
        triangles: [],
        definitions: []
    };

    if (jsonData.points && Array.isArray(jsonData.points)) {
        normalized.points = jsonData.points.map((pointData: SerializedPoint & { name?: string }) => ({
            id: pointData.id || pointData.name || '',
            x: Math.round(pointData.x),
            y: Math.round(pointData.y),
            hide: !!pointData.h
        }));
    }

    if (jsonData.edges && Array.isArray(jsonData.edges)) {
        normalized.edges = jsonData.edges.map((edgeData: SerializedEdge) => ({
            id: Math.random().toString(36),
            element: null,
            points: edgeData.p,
            hide: !!edgeData.h
        }));
    }

    if (jsonData.circles && Array.isArray(jsonData.circles)) {
        const pointsMap: Record<string, Point> = {};
        normalized.points.forEach(point => {
            pointsMap[point.id] = point;
        });
        normalized.circles = jsonData.circles.map((circleData: SerializedCircle) => ({
            id: circleData.id,
            element: null,
            centerPoint: circleData.id,
            centerX: Math.round(pointsMap[circleData.id].x),
            centerY: Math.round(pointsMap[circleData.id].y),
            radius: Math.round(circleData.r),
            pointsOnLine: circleData.p || [],
            hide: !!circleData.h
        }));
    }

    if (jsonData.angles && Array.isArray(jsonData.angles)) {
        normalized.angles = jsonData.angles.map((angleData: SerializedAngle) => ({
            id: Math.random().toString(36),
            pointId: angleData.id,
            sidepoints: angleData.p,
            value: angleData.v ? Number(angleData.v) : null,
            label: angleData.l || '',
            hide: !!angleData.h,
            target: !!angleData.t,
            name: getAngleNameFromPoints(angleData.id, angleData.p[0], angleData.p[1]),
            radius: 0,
            startAngle: undefined!,
            endAngle: undefined!,
            groupElement: null,
        }));
    }

    if (jsonData.lines && Array.isArray(jsonData.lines)) {
        normalized.lines = deepClone(jsonData.lines);
    }

    return normalized;
}

/**
 * Validate geometry data structure
 */
export function validateGeometryData(data: Partial<NormalizedGeometryData>): ValidationResult {
    const errors: string[] = [];

    if (!data) {
        errors.push('Data is null or undefined');
        return { isValid: false, errors };
    }

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

export const enrichGeometryData = (data: NormalizedGeometryData, scale: number = 1): EnrichedGeometryData => {
    const adjacentPoints = new Map<string, Set<string>>();
    const angles: Angle[] = [];
    const circles: Circle[] = [];
    const definitions = data.definitions || [];
    const edges: Edge[] = [];
    const lines: Line[] = [];
    const points: Point[] = [];
    const pointsMap = new Map<string, Point>();
    const overlappingAngles = new Map<string, Set<string>>();
    const triangles: Triangle[] = [];

    if (data.points) {
        data.points.forEach(pointData => {
            const point: Point = {
                id: pointData.id,
                x: Math.round(pointData.x),
                y: Math.round(pointData.y)
            };
            if (pointData.hide) point.hide = true;
            points.push(point);
            pointsMap.set(point.id, point);
        });
    }

    const addAdjacentPoint = (pointId: string, adjacentPointId: string): void => {
        if (!adjacentPoints.has(pointId)) {
            adjacentPoints.set(pointId, new Set());
        }
        adjacentPoints.get(pointId)!.add(adjacentPointId);
    };

    data.lines.forEach(linePoints => {
        lines.push({
            id: Math.random().toString(32),
            points: linePoints
        });
    });

    if (data.edges) {
        data.edges.forEach(edgeData => {
            const pointIds = edgeData.points;
            const point1 = pointsMap.get(pointIds[0]);
            const point2 = pointsMap.get(pointIds[1]);

            if (point1 && point2) {
                const edge: Edge = {
                    id: Math.random().toString(36),
                    points: [pointIds[0], pointIds[1]],
                    hide: edgeData.hide,
                    element: null
                };

                edges.push(edge);
                addAdjacentPoint(pointIds[0], pointIds[1]);
                addAdjacentPoint(pointIds[1], pointIds[0]);
            }
        });
    }

    if (data.circles) {
        data.circles.forEach(circleData => {
            const centerPointId = circleData.centerPoint;
            const circlePointsOnLine = circleData.pointsOnLine || [];
            const centerPoint = pointsMap.get(centerPointId);

            const validPointsOnLine = circlePointsOnLine.filter(id => pointsMap.get(id));

            if (centerPoint) {
                const id = Math.random().toString(36).substring(2, 15);
                const circleObj: Circle = {
                    id: id,
                    element: null,
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

    triangles.push(...getTriangles2(angles, adjacentPoints, lines));

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

            const calcInfo = getAngleCalculatedInfo(vertex, point1, point2, scale);
            if (calcInfo) {
                const {
                    angle1,
                    angle2,
                    angleDegrees,
                    radius
                } = calcInfo;

                angle.radius = radius;
                angle.startAngle = angle1;
                angle.endAngle = angle2;
                angle.calculatedValue = angleDegrees;
            }
            angles.push(angle);
        });
    }

    const visibleAngles = angles.filter(angle => !angle.hide);
    buildOverlappingAnglesMap(visibleAngles, lines, overlappingAngles);

    return {
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
    };
};

export const serializeStateForUrl = ({
    name,
    points,
    edges,
    circles,
    angles,
    lines,
    definitions
}: {
    name?: string;
    points: Point[];
    edges: Edge[];
    circles: Circle[];
    angles: Angle[];
    lines: Line[];
    definitions: Definition[];
}): string | undefined => {
    if (angles.length === 0) {
        alert('No angles to solve!');
        return;
    }
    const data = serializeGeometryData({ name, points, edges, circles, angles, lines, definitions });
    data.angles
        .filter(angle => angle.l)
        .forEach(angle => {
            if (angle.l) {
                angle.l = encodeURIComponent(angle.l);
                if (angle.t && typeof angle.v === 'number') {
                    angle.v = encodeNumber(angle.v);
                }
            }
        });
    const encodedData = window.btoa(JSON.stringify(data));
    return encodedData;
};

export const deserializeStateFromUrl = (encodedText: string | null): SerializedGeometryData | null => {
    if (!encodedText) return null;
    try {
        const json = window.atob(encodedText);
        const data = JSON.parse(json) as SerializedGeometryData;
        data.angles
            .filter(angle => angle.l)
            .forEach(angle => {
                if (angle.l) {
                    angle.l = decodeURIComponent(angle.l);
                    if (angle.t && typeof angle.v === 'string') {
                        angle.v = decodeNumber(angle.v);
                    }
                }
            });
        return data;
    } catch (error) {
        console.error('Error loading initial problem:', error);
        return null;
    }
};

const BASE61_CHARS = 'Lk8Wv1PtR0oMjXeGhnSwKZQy3uCU9DFdmA6bfcY7iVg5rp2lNETq4xOsIBJaHz';
const DECIMAL_SEP = 'z';

export function encodeNumber(value: number): string {
    const integerPart = Math.floor(value);
    const decimalPart = Math.round((value - integerPart) * 100);
    
    // Convert integer to base61
    const encodeInt = (num: number): string => {
        if (num === 0) return BASE61_CHARS[0];
        let result = '';
        while (num > 0) {
            result = BASE61_CHARS[num % 61] + result;
            num = Math.floor(num / 61);
        }
        return result;
    };
    
    // If it's a float, include decimal part
    if (decimalPart > 0) {
        return encodeInt(integerPart) + DECIMAL_SEP + encodeInt(decimalPart);
    }
    
    // Integer only
    return encodeInt(integerPart);
}

export function decodeNumber(str: string): number {
    const decodeInt = (s: string): number => {
        let result = 0;
        for (const char of s) {
            result = result * 61 + BASE61_CHARS.indexOf(char);
        }
        return result;
    };
    
    // Check if it's a float (has decimal separator)
    if (str.includes(DECIMAL_SEP)) {
        const [intPart, decPart] = str.split(DECIMAL_SEP);
        return decodeInt(intPart) + decodeInt(decPart) / 100;
    }
    
    // Integer only
    return decodeInt(str);
}