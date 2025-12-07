import type { Angle, Line, Point, Triangle, Circle } from '../types';
import {
    pointToAngle,
    getUnsolvedAngles,
    sumOfSolvedAnglesValue
} from '../utils/mathHelper';

interface SolveData {
    angles: Angle[];
    points: Point[];
    lines: Line[];
    triangles: Triangle[] | string[][];
    circles: Circle[];
    angleMapsByPointId: Record<string, Angle[]>;
}

type LogFn = (angle: Angle, reason: string, ruleName: string) => void;

interface GetAdjacentAnglesParams {
    angles: Angle[];
    points: Point[];
    lines: Line[];
}

const getAdjacentAngles = ({ angles, points, lines }: GetAdjacentAnglesParams, vertex: string): (Angle | null)[] => {
    const v = points.find(p => p.id === vertex);
    if (!v) return [];

    const rays = [...new Set(angles.filter(a => a.pointId === vertex).flatMap(a => a.sidepoints))]
        .map(id => points.find(p => p.id === id))
        .filter((p): p is Point => !!p)
        .sort((a, b) => pointToAngle(a, v) - pointToAngle(b, v))
        .map(p => p.id);

    const isOnLine = (p1: string, p2: string): boolean => lines.some(line =>
        line.points.includes(vertex) && line.points.includes(p1) && line.points.includes(p2)
    );

    return rays.map((curr, i) => {
        const next = rays[(i + 1) % rays.length];
        if (isOnLine(curr, next)) return null;

        return angles.find(a =>
            a.pointId === vertex &&
            a.sidepoints.includes(curr) &&
            a.sidepoints.includes(next)
        ) || null;
    }).filter(Boolean);
};

export const applySupplementaryAngles = ({ angleMapsByPointId, lines, points }: SolveData, log: LogFn): boolean => {
    let changesMade = false;

    const supplementaryAngleGroups: Angle[][] = [];
    
    Object.keys(angleMapsByPointId).forEach(vertex => {
        const anglesWithThisVertex = angleMapsByPointId[vertex];
        if (anglesWithThisVertex.length < 2) {
            return;
        }

        lines.forEach(line => {
            const vertexPointIndex = line.points.indexOf(vertex);
            if (vertexPointIndex < 1 || vertexPointIndex === line.points.length - 1) {
                return;
            }

            const pointsBeforeThisVertex = line.points.slice(0, vertexPointIndex);
            const pointsAfterThisVertex = line.points.slice(vertexPointIndex + 1);
            const hasAtleastOnePointBefore = anglesWithThisVertex.some(angle => 
                pointsBeforeThisVertex.includes(angle.sidepoints[0]) || pointsBeforeThisVertex.includes(angle.sidepoints[1])
            );
            const hasAtleastOnePointAfter = anglesWithThisVertex.some(angle => 
                pointsAfterThisVertex.includes(angle.sidepoints[0]) || pointsAfterThisVertex.includes(angle.sidepoints[1])
            );
            
            if (!hasAtleastOnePointBefore || !hasAtleastOnePointAfter) {
                return;
            }
            
            const adjacentAngles = getAdjacentAngles({
                angles: anglesWithThisVertex,
                lines: [line],
                points
            }, vertex).filter((a): a is Angle => a !== null);

            if (adjacentAngles.length === 0 || getUnsolvedAngles(adjacentAngles).length === 0) {
                return;
            }
            supplementaryAngleGroups.push(adjacentAngles);
        });
    });

    if (supplementaryAngleGroups.length === 0) {
        return false;
    }

    supplementaryAngleGroups.forEach(supplementaryAngles => {
        const unknownAngles = getUnsolvedAngles(supplementaryAngles);
        const sumOfKnownAnglesVal = sumOfSolvedAnglesValue(supplementaryAngles);

        if (unknownAngles.length === 1) {
            const value = 180 - sumOfKnownAnglesVal;
            if (value <= 0) return;
            unknownAngles[0].value = value;
            log(
                unknownAngles[0],
                `Supplementary angle was given, now we get the ${unknownAngles[0].name} (${180 - sumOfKnownAnglesVal}°) by supplementary angle sum`,
                'applySupplementaryAngles'
            );
            changesMade = true;
            return;
        }

        const label = unknownAngles[0]?.label;
        const sameLabelAngles = unknownAngles.filter(angle => label && angle.label === label);

        if (sameLabelAngles.length === unknownAngles.length && sameLabelAngles.length > 0) {
            const angleValue = (180 - sumOfKnownAnglesVal) / sameLabelAngles.length;
            if (angleValue <= 0) return;
            sameLabelAngles.forEach(angle => {
                angle.value = angleValue;
                log(
                    angle,
                    `Supplementary angle was given, now we get the ${angle.name} (${angleValue}°) by supplementary angle sum`,
                    'applySupplementaryAngles'
                );
                changesMade = true;
            });
            return;
        }
    });

    return changesMade;
};

