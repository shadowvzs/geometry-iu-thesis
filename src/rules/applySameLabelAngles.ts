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

/**
 * Theorem: Angles with the same label have the same value
 * Used for bisected angles or any manually labeled angles
 */
export const applySameLabelAngles = ({ angles, equations }: SolveData, log: LogFn): boolean => {
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

