import type { Angle, Line, Point, Triangle, Circle } from '../types';
import {
    searchVertexAngleInIsoscelesTriangle,
    getTriangleAngles,
    getUnsolvedAngles,
    getAngleValue,
    sumOfKnownAngles,
    haveSameLabels,
    isEquilateralTriangleByLabel,
    isEquilateralTriangleByCircles,
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

const TriangleAngleSum = 180;

export const applyTriangleAngleSum = ({ triangles, circles, angles, equations }: SolveData, log: LogFn): boolean => {
    let changesMade = false;

    triangles.forEach(triangleData => {
        const triangle: Triangle = triangleData instanceof Set 
            ? triangleData 
            : new Set(triangleData);
        const triangleArray = Array.from(triangle);
        
        const triangleAngles = getTriangleAngles(triangle, angles);
        if (triangleAngles.length !== 3) {
            console.warn(`Triangle does not have exactly 3 angles (${triangleArray.toString()})`, triangleAngles);
            return;
        }
        
        const remainingAngles = getUnsolvedAngles(triangleAngles);
        if (remainingAngles.length === 0) {
            return;
        } else if (remainingAngles.length === 1) {
            remainingAngles[0].value = TriangleAngleSum - sumOfKnownAngles(triangleAngles);
            log(
                remainingAngles[0],
                `only 1 angle was unknown in triangle (${triangleArray.toString()}) so ${remainingAngles[0].name}) can be calculated as ${remainingAngles[0].value}°`,
                'applyTriangleAngleSum'
            );
            changesMade = true;
            return;
        }

        if (isEquilateralTriangleByLabel(triangleAngles) || isEquilateralTriangleByCircles(triangle, circles)) {
            const baseAngleValue = TriangleAngleSum / 3;
            remainingAngles.forEach(a => {
                a.value = baseAngleValue;
                log(
                    a,
                    `Equilateral triangle base angle calculated as 180° / 3`,
                    'applyTriangleAngleSum'
                );
            });
            changesMade = true;
            return;
        } else if (remainingAngles.length === 2 && haveSameLabels(remainingAngles)) {
            const calculatedValue = (TriangleAngleSum - sumOfKnownAngles(triangleAngles)) / 2;
            if (calculatedValue <= 0) return;
            remainingAngles.forEach(a => {
                a.value = calculatedValue;
                log(
                    a,
                    `Isoceles triangle base angles calculated`,
                    'applyTriangleAngleSum'
                );
            });
            changesMade = true;
            return;
        }

        for (const circle of circles) {
            const vertexAngle = searchVertexAngleInIsoscelesTriangle(triangleAngles, circle);
            if (!vertexAngle) continue;
            
            const vertexValue = getAngleValue(vertexAngle);
            if (vertexValue) {
                const baseAngleValue = (TriangleAngleSum - vertexValue) / 2;
                if (baseAngleValue <= 0) return;
                remainingAngles.forEach(a => {
                    a.value = baseAngleValue;
                    log(
                        a,
                        `Isosceles triangle base angle calculated as (180° - ${vertexValue}°) / 2`,
                        'applyTriangleAngleSum'
                    );
                });
                changesMade = true;
                break;
            } else if (remainingAngles.length === 2) {
                const knownBaseAngle = triangleAngles.find(a => a.pointId !== vertexAngle.pointId && getAngleValue(a) !== null);
                if (!knownBaseAngle) continue;
                
                const knownValue = getAngleValue(knownBaseAngle);
                if (!knownValue) continue;
                
                remainingAngles.forEach(a => {
                    const angleValue = a.pointId === vertexAngle.pointId 
                        ? (TriangleAngleSum - knownValue * 2)
                        : knownBaseAngle.value;
                    if (!angleValue || (typeof angleValue === 'number' && angleValue <= 0)) return;
                    a.value = angleValue;
                    log(
                        a,
                        `Isosceles triangle base angle was given, now we get the ${a.name} by triangle angle sum`,
                        'applyTriangleAngleSum'
                    );
                });
                changesMade = true;
                break;
            }
        }
    });
    
    return changesMade;
};

