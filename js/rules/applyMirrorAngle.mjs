import { getAngleValue } from '../utils/mathHelper.mjs';

const FULL_CIRCLE_ANGLE = 360;

const getMirrorAngle = (before, after, anglesAtVertex) => {
    return anglesAtVertex.find(a => 
        (a.sidepoints.includes(before) && a.sidepoints.includes(after))
    );
}

/**
 * Find mirror (vertical) angles at a vertex where two lines intersect.
 * Mirror angles are formed by two intersecting lines and are equal.
 * 
 * Example: Lines [A, B, C] and [D, B, E] intersect at B
 * - ∠ABD and ∠CBE are mirror angles
 * - ∠ABE and ∠CBD are mirror angles
 */
export const applyMirrorAngle = ({ angleMapsByPointId, lines }, log) => {
    let changesMade = false;

    // To have mirror angles we need at least 2 lines
    if (lines.length < 2) {
        return changesMade;
    }
    
    const mirrorAnglePairs = [];
    Object.keys(angleMapsByPointId).forEach(vertex => {
        const anglesAtVertex = angleMapsByPointId[vertex];
        if (anglesAtVertex.length < 2) {
            return;
        }

        // Find all lines that pass through this vertex
        const linesThruVertex = lines.filter(line => line.points.includes(vertex));
        
        // We need at least 2 lines through the vertex to have mirror angles
        if (linesThruVertex.length < 2) {
            return;
        }

        // For each pair of lines through this vertex, find mirror angles
        for (let i = 0; i < linesThruVertex.length; i++) {
            for (let j = i + 1; j < linesThruVertex.length; j++) {
                const line1 = linesThruVertex[i];
                const line2 = linesThruVertex[j];

                // Get the points on each side of the vertex for each line
                const vertexIndex1 = line1.points.indexOf(vertex);
                const vertexIndex2 = line2.points.indexOf(vertex);

                // Points before and after vertex on line1
                const line1Before = line1.points.slice(0, vertexIndex1);
                const line1After = line1.points.slice(vertexIndex1 + 1);
                // Points before and after vertex on line2
                const line2Before = line2.points.slice(0, vertexIndex2);
                const line2After = line2.points.slice(vertexIndex2 + 1);

                // Skip if we don't have points on both sides of either line
                if ((!line1Before.length || !line1After.length) ||
                    (!line2Before.length || !line2After.length)) {
                    continue;
                }

                // Get the closest points to the vertex on each side
                const p1Before = line1Before[line1Before.length - 1]; // Last point before vertex
                const p1After = line1After[0]; // First point after vertex
                const p2Before = line2Before[line2Before.length - 1];
                const p2After = line2After[0];

                // Mirror angle pairs:
                // Pair 1: ∠(p1Before, vertex, p2Before) mirrors ∠(p1After, vertex, p2After)
                // Pair 2: ∠(p1Before, vertex, p2After) mirrors ∠(p1After, vertex, p2Before)

                const mirrorPairs = [
                    { side1: [p1Before, p2Before], side2: [p1After, p2After] },
                    { side1: [p1Before, p2After], side2: [p1After, p2Before] }
                ];

                mirrorPairs.forEach(({ side1, side2 }) => {
                    const angle1 = getMirrorAngle(side1[0], side1[1], anglesAtVertex);
                    const angle2 = getMirrorAngle(side2[0], side2[1], anglesAtVertex);

                    if (angle1 && angle2) {
                        mirrorAnglePairs.push([angle1, angle2]);
                    };
                });
            }
        }
    });
    
    const result = {
        sum: 0,
        unsolved: []
    };

    mirrorAnglePairs.forEach(([angle1, angle2]) => {
        const value1 = getAngleValue(angle1);
        const value2 = getAngleValue(angle2);

        // If one has a value and the other doesn't, copy the value
        if (value1 && !value2) {
            angle2.value = value1;
            log(angle2, `Mirror angle: ${angle2.name} = ${value1}° (mirrors ${angle1.name})`, 'applyMirrorAngle');
            changesMade = true;
            result.sum += value1 * 2; // Both angles are equal
        } else if (value2 && !value1) {
            angle1.value = value2;
            log(angle1, `Mirror angle: ${angle1.name} = ${value2}° (mirrors ${angle2.name})`, 'applyMirrorAngle');
            changesMade = true;
            result.sum += value2 * 2; // Both angles are equal

        } else if (!value1 && !value2) {
            result.unsolved.push(angle1);
            result.unsolved.push(angle2);
            // Both angles are unknown, cannot deduce anything
            return;
        }
    });

    // if only 2 pair left they must be equal to (360 - known angles sum) / 2
    if (result.unsolved.length === 2) {
        const angleValue = (FULL_CIRCLE_ANGLE - result.sum) / 2;
        if (angleValue <= 0) return; // invalid angle value
        result.unsolved.forEach(angle => {
            angle.value = angleValue;
            log(angle, `Mirror angle: ${angle.name} = ${angleValue}° (deduced)`, 'applyMirrorAngle');
        });
        changesMade = true;
    }

    
    return changesMade;
};