import type { Angle, Line, Point, Triangle, Circle } from '../types';
import {
    getAngleValue,
    findSameAnglesGroups,
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

export const applySameAngles = ({ angleMapsByPointId, lines }: SolveData, log: LogFn): boolean => {
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

