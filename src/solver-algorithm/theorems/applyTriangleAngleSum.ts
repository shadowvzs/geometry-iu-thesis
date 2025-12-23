import type { Angle, Triangle, SolveDataWithMaps } from '@/types';
import {
    searchVertexAngleInIsoscelesTriangle,
    getTriangleAngles,
    getUnsolvedAngles,
    getAngleValue,
    sumOfKnownAngles,
    haveSameLabels,
    isEquilateralTriangleByLabel,
    isEquilateralTriangleByCircles,
} from '@/utils/mathHelper';
import { validateAngleValue } from '@/utils/angleValidation';

type LogFn = (angle: Angle, reason: string, ruleName: string) => void;

const TriangleAngleSum = 180;

export const applyTriangleAngleSum = (data: SolveDataWithMaps, log: LogFn): boolean => {
    const { triangles, circles, angles, points, lines } = data;
    let changesMade = false;
    triangles.forEach(triangleData => {
        const triangle: Triangle = triangleData instanceof Set 
            ? triangleData 
            : new Set(triangleData);
        const triangleArray = Array.from(triangle) as [string, string, string];
        const triangleAngles = getTriangleAngles(triangle, angles, lines);

        if (triangleAngles.length !== 3) {
            console.warn(`Triangle does not have exactly 3 angles (${triangleArray.toString()})`, triangleAngles);
            return;
        }
        
        const remainingAngles = getUnsolvedAngles(triangleAngles);
        if (remainingAngles.length === 0) {
            return;
        } else if (remainingAngles.length === 1) {
            const proposedValue = TriangleAngleSum - sumOfKnownAngles(triangleAngles);
            
            // Validate against all constraints
            const validation = validateAngleValue(remainingAngles[0], proposedValue, {
                angles, points, triangles, lines
            });
            if (!validation.valid) {
                return; // Skip - would violate constraints
            }
            
            remainingAngles[0].value = proposedValue;
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
            
            // Validate all angles
            const allValid = remainingAngles.every(a => {
                const validation = validateAngleValue(a, baseAngleValue, {
                    angles, points, triangles, lines
                });
                return validation.valid;
            });
            if (!allValid) return;
            
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
            
            // Validate all angles
            const allValid = remainingAngles.every(a => {
                const validation = validateAngleValue(a, calculatedValue, {
                    angles, points, triangles, lines
                });
                return validation.valid;
            });
            if (!allValid) return;
            
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
            const vertexAngle = searchVertexAngleInIsoscelesTriangle(triangleAngles, circle, lines, triangleArray);
            if (!vertexAngle) continue;

            const vertexValue = getAngleValue(vertexAngle);
            if (vertexValue) {
                const baseAngleValue = (TriangleAngleSum - vertexValue) / 2;
                if (baseAngleValue <= 0) return;
                
                // Validate all angles
                const allValid = remainingAngles.every(a => {
                    const validation = validateAngleValue(a, baseAngleValue, {
                        angles, points, triangles, lines
                    });
                    return validation.valid;
                });
                if (!allValid) continue;
                
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
                
                // Validate each angle individually
                let allValid = true;
                const proposedValues: { angle: Angle; value: number }[] = [];
                
                remainingAngles.forEach(a => {
                    const angleValue = a.pointId === vertexAngle.pointId 
                        ? (TriangleAngleSum - knownValue * 2)
                        : knownBaseAngle.value;
                    if (!angleValue || (typeof angleValue === 'number' && angleValue <= 0)) {
                        allValid = false;
                        return;
                    }
                    
                    const validation = validateAngleValue(a, angleValue, {
                        angles, points, triangles, lines
                    });
                    if (!validation.valid) {
                        allValid = false;
                        return;
                    }
                    
                    proposedValues.push({ angle: a, value: angleValue });
                });
                
                if (!allValid) continue;
                
                proposedValues.forEach(({ angle, value }) => {
                    angle.value = value;
                    log(
                        angle,
                        `Isosceles triangle base angle was given, now we get the ${angle.name} by triangle angle sum`,
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
