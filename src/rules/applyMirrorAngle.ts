import type { Angle, Line, Point, Triangle, Circle } from '../types';
import { getAngleValue } from '../utils/mathHelper';

interface SolveData {
    angles: Angle[];
    points: Point[];
    lines: Line[];
    triangles: Triangle[] | string[][];
    circles: Circle[];
    angleMapsByPointId: Record<string, Angle[]>;
}

type LogFn = (angle: Angle, reason: string, ruleName: string) => void;

const FULL_CIRCLE_ANGLE = 360;

const getMirrorAngle = (before: string, after: string, anglesAtVertex: Angle[]): Angle | undefined => {
    return anglesAtVertex.find(a => 
        (a.sidepoints.includes(before) && a.sidepoints.includes(after))
    );
};

export const applyMirrorAngle = ({ angleMapsByPointId, lines, equations }: SolveData, log: LogFn): boolean => {
    let changesMade = false;

    if (lines.length < 2) {
        return changesMade;
    }
    
    const mirrorAnglePairs: [Angle, Angle][] = [];
    
    Object.keys(angleMapsByPointId).forEach(vertex => {
        const anglesAtVertex = angleMapsByPointId[vertex];
        if (anglesAtVertex.length < 2) {
            return;
        }

        const linesThruVertex = lines.filter(line => line.points.includes(vertex));
        
        if (linesThruVertex.length < 2) {
            return;
        }

        for (let i = 0; i < linesThruVertex.length; i++) {
            for (let j = i + 1; j < linesThruVertex.length; j++) {
                const line1 = linesThruVertex[i];
                const line2 = linesThruVertex[j];

                const vertexIndex1 = line1.points.indexOf(vertex);
                const vertexIndex2 = line2.points.indexOf(vertex);

                const line1Before = line1.points.slice(0, vertexIndex1);
                const line1After = line1.points.slice(vertexIndex1 + 1);
                const line2Before = line2.points.slice(0, vertexIndex2);
                const line2After = line2.points.slice(vertexIndex2 + 1);

                if ((!line1Before.length || !line1After.length) ||
                    (!line2Before.length || !line2After.length)) {
                    continue;
                }

                const p1Before = line1Before[line1Before.length - 1];
                const p1After = line1After[0];
                const p2Before = line2Before[line2Before.length - 1];
                const p2After = line2After[0];

                const mirrorPairs = [
                    { side1: [p1Before, p2Before], side2: [p1After, p2After] },
                    { side1: [p1Before, p2After], side2: [p1After, p2Before] }
                ];

                mirrorPairs.forEach(({ side1, side2 }) => {
                    const angle1 = getMirrorAngle(side1[0], side1[1], anglesAtVertex);
                    const angle2 = getMirrorAngle(side2[0], side2[1], anglesAtVertex);

                    if (angle1 && angle2) {
                        mirrorAnglePairs.push([angle1, angle2]);
                    }
                });
            }
        }
    });
    
    const result = {
        sum: 0,
        unsolved: [] as Angle[]
    };

    mirrorAnglePairs.forEach(([angle1, angle2]) => {
        const value1 = getAngleValue(angle1);
        const value2 = getAngleValue(angle2);

        if (value1 && !value2) {
            angle2.value = value1;
            log(angle2, `Mirror angle: ${angle2.name} = ${value1}° (mirrors ${angle1.name})`, 'applyMirrorAngle');
            changesMade = true;
            result.sum += value1 * 2;
        } else if (value2 && !value1) {
            angle1.value = value2;
            log(angle1, `Mirror angle: ${angle1.name} = ${value2}° (mirrors ${angle2.name})`, 'applyMirrorAngle');
            changesMade = true;
            result.sum += value2 * 2;
        } else if (!value1 && !value2) {
            result.unsolved.push(angle1);
            result.unsolved.push(angle2);
            return;
        }
    });

    if (result.unsolved.length === 2) {
        const angleValue = (FULL_CIRCLE_ANGLE - result.sum) / 2;
        if (angleValue <= 0) return changesMade;
        result.unsolved.forEach(angle => {
            angle.value = angleValue;
            log(angle, `Mirror angle: ${angle.name} = ${angleValue}° (deduced)`, 'applyMirrorAngle');
        });
        changesMade = true;
    }
    
    return changesMade;
};

