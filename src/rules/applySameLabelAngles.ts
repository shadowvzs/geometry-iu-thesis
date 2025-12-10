import type { SolveDataWithMaps } from '@/utils/solve';
import type { Angle } from '../types';
import { getAngleValue } from '../utils/mathHelper';


type LogFn = (angle: Angle, reason: string, ruleName: string) => void;

/**
 * Theorem: Angles with the same label have the same value
 * Used for bisected angles or any manually labeled angles
 */
export const applySameLabelAngles = ({ angles }: SolveDataWithMaps, log: LogFn): boolean => {
    const labelValueMap = new Map<string, number>();
    const unsolvedAngles: Angle[] = [];
    
    angles.forEach(a => {
        if (a.label) {
            const value = getAngleValue(a);
            if (value) {
                labelValueMap.set(a.label, value);
            } else {
                unsolvedAngles.push(a);
            }
        }
    });

    unsolvedAngles.forEach(a => {
        if (a.label) {
            const value = labelValueMap.get(a.label);
            if (value) {
                a.value = value;
                log(a, `this label (${a.label}) was already defined ${a.value}°`, 'applySameLabelAngles');
            }
        }
    });

    const wasUpdated = unsolvedAngles.filter(a => a.value).length > 0;
    return wasUpdated;
};

