import {
    getAngleValue,
    isSameRay,
    areSameAngle,
    findSameAnglesGroups,
} from '../utils/mathHelper.mjs';

export const applySameAngles = ({ angleMapsByPointId, lines }, log) => {
    let changesMade = false;

    Object.keys(angleMapsByPointId).forEach(vertex => {
        const anglesWithThisVertex = angleMapsByPointId[vertex];
        if (anglesWithThisVertex.length < 2) {
            return;
        }

        const sameAnglesGroups = findSameAnglesGroups(anglesWithThisVertex, lines);
        if (!sameAnglesGroups.length) {
            return;
        }
        
        sameAnglesGroups.forEach(sameAngles => {
            const knownAngle = sameAngles.find(angle => getAngleValue(angle));
            // no known angle, so we can't solve this group
            if (!knownAngle) { return; }
            sameAngles.forEach(angle => {
                if (getAngleValue(angle)) {
                    return;
                }
                angle.value = knownAngle.value;
                log(angle, `same angle ${angle.name} has value ${knownAngle.value}° by same angles group`, 'applySameAngles');
                changesMade = true;
            });
        });
    });
    
    return changesMade;
};