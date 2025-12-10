import type { SolveDataWithMaps } from '@/utils/solve';
import type { Angle } from '../types';
import {
    getAngleValue,
    findSameAnglesGroups,
} from '../utils/mathHelper';

type LogFn = (angle: Angle, reason: string, ruleName: string) => void;

export const applySameAngles = ({ angleMapsByPointId, lines }: SolveDataWithMaps, log: LogFn): boolean => {
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
            const label = sameAngles.find(angle => angle.label);

            if (label) {
                sameAngles
                    .filter(angle => !angle.label)
                    .forEach(angle => {
                        angle.label = label.label;
                        changesMade = true;
                    });
            }
            if (knownAngle) {
                sameAngles.forEach(angle => {
                    if (getAngleValue(angle)) {
                        return;
                    }
                    angle.value = knownAngle.value;
                    log(angle, `same angle ${angle.name} has value ${knownAngle.value}° by same angles group`, 'applySameAngles');
                    changesMade = true;
                });
            }

        });
    });
    
    return changesMade;
};

