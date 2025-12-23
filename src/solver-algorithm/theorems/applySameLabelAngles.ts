import type { SolveDataWithMaps } from '@/types';
import type { Angle } from '@/types';
import { getAngleValue } from '@/utils/mathHelper';
import { validateAngleValue } from '@/utils/angleValidation';

type LogFn = (angle: Angle, reason: string, ruleName: string) => void;

/**
 * Theorem: Angles with the same label have the same value
 * Used for bisected angles or any manually labeled angles
 * 
 * Note: This rule respects composed angle constraints. If an angle with the same label
 * is part of a composed relationship (e.g., children of a parent angle), the assignment
 * will be skipped to allow applyComposedAngles to handle it correctly.
 */
export const applySameLabelAngles = (data: SolveDataWithMaps, log: LogFn): boolean => {
    const { angles, points, triangles, lines } = data;
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

    let changesMade = false;
    unsolvedAngles.forEach(a => {
        if (a.label) {
            const value = labelValueMap.get(a.label);
            if (value) {
                // Validate against all constraints, especially composed angles
                // This prevents assigning values that would violate composed relationships
                // (e.g., if ACD and BCD are children of ACB=68°, they shouldn't both get 68°)
                const validation = validateAngleValue(a, value, {
                    angles,
                    points,
                    triangles,
                    lines
                });
                
                if (validation.valid) {
                    a.value = value;
                    log(a, `this label (${a.label}) was already defined ${a.value}°`, 'applySameLabelAngles');
                    changesMade = true;
                } else {
                    // Skip this assignment - it would violate constraints (e.g., composed angles)
                    // The applyComposedAngles rule will handle it correctly
                    console.log(`Skipping label assignment for ${a.name}: ${validation.violation}`);
                }
            }
        }
    });

    return changesMade;
};

