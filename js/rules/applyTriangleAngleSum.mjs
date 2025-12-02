import {
    searchVertexAngleInIsoscelesTriangle,
    getTriangleAngles,
    unsolvedAngles,
    getAngleValue,
    sumOfKnownAngles,
    isEquilateralTriangle,
    haveSameLabels,
} from '../utils/mathHelper.mjs';

/**
 * Theorem: Triangle angle sum = 180°
 */
const TriangleAngleSum = 180;
export const applyTriangleAngleSum = ({ triangles, circles, angles }, log) => {
    let changesMade = false;
    

    triangles.forEach(triangle => {
        triangle = Array.from(triangle);
        // Find all angles at each vertex of the triangle
        const triangleAngles = getTriangleAngles(triangle, angles);
        if (triangleAngles.length !== 3) {
            console.warn(`Triangle does not have exactly 3 angles (${triangle.toString()})`, triangleAngles);
            return; // Need all 3 angles
        }
        
        const remainingAngles = unsolvedAngles(triangleAngles);
        if (remainingAngles.length === 0) {
            return; // All angles already known, jump to the next one
        } else if (remainingAngles.length === 1) {
            remainingAngles[0].value = TriangleAngleSum - sumOfKnownAngles(triangleAngles);
            log(
                remainingAngles[0],
                `only 1 angle was unknown in triangle (${triangle.toString()}) so ${remainingAngles[0].name}) can be calculated as ${remainingAngles[0].value}°`,
                'applyTriangleAngleSum'
            );
            changesMade = true;
            return; // Only one angle unknown, we can solve it directly
        }

        if (isEquilateralTriangle(triangleAngles)) {
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
            if (calculatedValue <= 0) return; // invalid angle value
            remainingAngles.forEach(a => {
                a.value = calculatedValue;
                log(
                    a,
                    `Equilateral triangle base angle calculated as 180° / 3`,
                    'applyTriangleAngleSum'
                );
            });
            return;
        }

        // special cases: the triangle is an isosceles triangle where two angles are the same, we know only the vertex angle
        // so we can calculate the base angles, but only if we have a circle centered at the vertex point and has already a value assigned
        for (const circle of circles) {
            const vertexAngle = searchVertexAngleInIsoscelesTriangle(triangleAngles, circle);
            // const remainingAngles = triangleAngles.filter(a => a !== vertexAngle?.point);
            // we found the vertex angle but it must have value assigned
            if (!vertexAngle) continue;
            const vertexValue = getAngleValue(vertexAngle);
            if (vertexValue) {
                const baseAngleValue = (TriangleAngleSum - vertexValue) / 2;
                if (baseAngleValue <= 0) return; // invalid angle value
                remainingAngles.forEach(a => {
                    a.value = baseAngleValue;
                    log(
                        a,
                        `Isosceles triangle base angle calculated as (180° - ${vertexValue}°) / 2`,
                        'applyTriangleAngleSum'
                    );
                });
                break;
            // if the triangle is equilateral (have the same label) then we can solve it as well
            } else if (remainingAngles.length === 2) {
                const knownBaseAngle = triangleAngles.find(a => a.pointId !== vertexAngle.pointId && getAngleValue(a) !== null);
                if (!knownBaseAngle) { throw new Error('Expected to find a known base angle, because 2 remaining angle and 1 must be the vertex angle'); }
                remainingAngles.forEach(a => {
                    const angleValue = a.pointId === vertexAngle.pointId 
                        ? (TriangleAngleSum - getAngleValue(knownBaseAngle) * 2)
                        : knownBaseAngle.value;
                    if (angleValue <= 0) return; // invalid angle value
                    a.value = angleValue;
                    log(
                        a,
                        `Isosceles triangle base angle was given, now we get the ${a.name} (${getAngleValue(vertexAngle)}°) by triangle angle sum`,
                        'applyTriangleAngleSum'
                    );
                });
                changesMade = true;
                break;
            }
        }
    });
    
    return changesMade;
}