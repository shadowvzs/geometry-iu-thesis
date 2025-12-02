import {
    pointToAngle,
    getUnsolvedAngles,
    sumOfSolvedAnglesValue
} from '../utils/mathHelper.mjs';

/**
 * Theorem: Supplementary angles sum to 180°
 */

const getAdjacentAngles = ({
    angles,
    points,
    lines
}, vertex) => {
    const v = points.find(p => p.id === vertex);

    const rays = [...new Set(angles.filter(a => a.pointId === vertex).flatMap(a => a.sidepoints))]
        .map(id => points.find(p => p.id === id))
        .sort((a, b) => pointToAngle(a, v) - pointToAngle(b, v))
        .map(p => p.id);

    // Check if two points are on opposite sides of vertex (on a line)
    const isOnLine = (p1, p2) => lines.some(line =>
        line.includes(vertex) && line.includes(p1) && line.includes(p2)
    );

    return rays.map((curr, i) => {
        const next = rays[(i + 1) % rays.length];
        if (isOnLine(curr, next)) return null; // skip 180° angles

        return angles.find(a =>
            a.pointId === vertex &&
            a.sidepoints.includes(curr) &&
            a.sidepoints.includes(next)
        );
    }).filter(Boolean);
};

export const applySupplementaryAngles = ({
    angleMapsByPointId,
    lines,
    points
}, log) => {
    let changesMade = false;

    // push here the lines with supplementary angles
    // we create this only to avoid the deeply nested loops
    const supplementaryAngleGroups = [];
    Object.keys(angleMapsByPointId).forEach(vertex => {
        const anglesWithThisVertex = angleMapsByPointId[vertex];
        // cannot be supplementary if less than 2 angles, or all angles are unknown, or more than 1 angle is unknown
        if (anglesWithThisVertex.length < 2) {
            return;
        }

        lines.forEach(line => {
            const vertexPointIndex = line.indexOf(vertex);
            // if position -1 (not exist) or 0 (first element) or last element then return false
            if (vertexPointIndex < 1 || vertexPointIndex === line.length - 1) {
                return;
            }

            const pointsBeforeThisVertex = line.slice(0, vertexPointIndex);
            const pointsAfterThisVertex = line.slice(vertexPointIndex + 1);
            const hasAtleastOnePointBefore = anglesWithThisVertex.some(angle => pointsBeforeThisVertex.includes(angle.sidepoints[0]) || pointsBeforeThisVertex.includes(angle.sidepoints[1]));
            const hasAtleastOnePointAfter = anglesWithThisVertex.some(angle => pointsAfterThisVertex.includes(angle.sidepoints[0]) || pointsAfterThisVertex.includes(angle.sidepoints[1]));
            if (!hasAtleastOnePointBefore || !hasAtleastOnePointAfter) {
                return;
            }
            const adjacentAngles = getAdjacentAngles({
                angles: anglesWithThisVertex,
                lines: [line],
                points
            }, vertex);

            // cannot be supplementary if no adjacent angles or if there are no unsolved angles
            if (adjacentAngles.length === 0 || getUnsolvedAngles(adjacentAngles).length === 0) {
                return;
            }
            supplementaryAngleGroups.push(adjacentAngles);
        });
    });

    if (supplementaryAngleGroups.length === 0) {
        return false;
    }

    // now go over each supplementary angle and find its supplementary angle if that possible
    supplementaryAngleGroups.forEach(supplementaryAngles => {
        const unknownAngles = getUnsolvedAngles(supplementaryAngles);
        const sumOfKnownAngles = sumOfSolvedAnglesValue(supplementaryAngles);

        // simple case if there is only one unknown angle then we can solve it directly
        if (unknownAngles.length === 1) {
            const value = 180 - sumOfKnownAngles;
            if (value <= 0) return; // invalid angle value
            unknownAngles[0].value = value;
            log(
                unknownAngles[0],
                `Supplementary angle was given, now we get the ${unknownAngles[0].name} (${180 - sumOfKnownAngles}°) by supplementary angle sum`,
                'applySupplementaryAngles'
            );
            changesMade = true;
            return;
        }

        // if there more angle with the same label then we can solve it directly
        const label = unknownAngles[0].label;
        const sameLabelAngles = unknownAngles.filter(angle => label && angle.label === label);

        // if all the angles have the same label then we can solve it directly
        if (sameLabelAngles.length === unknownAngles.length) {
            const angleValue = (180 - sumOfKnownAngles) / sameLabelAngles.length;
            if (angleValue <= 0) return; // invalid angle value
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
}
