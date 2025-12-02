import { getAngleValue } from '../utils/mathHelper.mjs';

/**
 * Theorem: Angles with the same label have the same value
 * Used for bisected angles or any manually labeled angles
 */
export const applySameLabelAngles = ({ angles }, log) => {
    // Group angles by their label
    const { labelValueMap, unsolvedAngles } = angles.reduce(({ labelValueMap, unsolvedAngles }, a) => {
        if (a.label) {
            const value = getAngleValue(a);
            if (value) {
                labelValueMap.set(a.label, value);
            } else {
                unsolvedAngles.push(a);
            }
        }
        return { labelValueMap, unsolvedAngles };
    }, { labelValueMap: new Map(), unsolvedAngles: [] });

    // set the value of the unsolved angles
    unsolvedAngles.forEach(a => {
        a.value = labelValueMap.get(a.label);
        log(a, `this label (${a.label}) was already defined ${a.value}°`,'applySameLabelAngles');
    });

    const wasUpdated = unsolvedAngles.length > 0;
    return wasUpdated;
}