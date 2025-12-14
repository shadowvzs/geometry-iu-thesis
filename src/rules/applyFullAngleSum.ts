import type { SolveDataWithMaps } from '@/utils/solve';
import type { Angle, Point } from '../types';
import {
    pointToAngle,
    getUnsolvedAngles,
    sumOfSolvedAnglesValue,
    getAngleValue,
} from '../utils/mathHelper';
import { validateAngleValue } from '../utils/angleValidation';

type LogFn = (angle: Angle, reason: string, ruleName: string) => void;

interface FullCircleGroup {
    angles: Angle[];
    vertex: string;
    sumTo: number; // Usually 360, but can be partial (e.g., 360 - known angles)
}

/**
 * Rule: All angles around a point with 3+ edges sum to 360°
 * 
 * This is more general than just intersection points.
 * Works with ANY point where angles form a complete circle.
 * 
 * Handles:
 * 1. Single unknown: 360 - sum of known
 * 2. All unknowns with same label: 360 / count (or (360 - knownSum) / count)
 * 3. Partial combinations of consecutive angles
 * 4. Vertical angles (opposite angles at 4-way intersection are equal)
 */
export const applyFullAngleSum = (
    data: SolveDataWithMaps,
    log: LogFn
): boolean => {
    const { angleMapsByPointId, points, angles, triangles } = data;
    let changesMade = false;

    // Process all vertices that have at least 3 angles
    Object.keys(angleMapsByPointId).forEach(vertex => {
        const anglesAtVertex = angleMapsByPointId[vertex];

        if (!anglesAtVertex || anglesAtVertex.length < 3) {
            // Need at least 3 angles to use this rule meaningfully
            return;
        }

        const vertexPoint = points.find(p => p.id === vertex);
        if (!vertexPoint) return;

        // Get all angles around this vertex sorted by angular position
        const sortedAngles = getSortedAnglesAroundVertex(
            anglesAtVertex,
            points,
            vertexPoint
        );

        if (sortedAngles.length < 3) {
            return;
        }

        // Check if we have a complete circle of angles
        const allRays = new Set<string>();
        sortedAngles.forEach(a => a.sidepoints.forEach(sp => allRays.add(sp)));

        if (sortedAngles.length !== allRays.size) {
            // Not a complete circle
            return;
        }

        // Validate geometrically - calculated values should sum to ~360°
        const calculatedSum = sortedAngles.reduce((sum, a) => 
            sum + (a.calculatedValue ?? 0), 0
        );

        if (Math.abs(calculatedSum - 360) > 30) {
            // Calculated values don't match expected 360°, skip
            return;
        }

        // ============================================
        // Case 1: Handle the full circle (sum = 360)
        // ============================================
        changesMade = tryToSolve({
            angles: sortedAngles,
            vertex,
            sumTo: 360
        }, log, { angles, points, triangles }) || changesMade;

        // ============================================
        // Case 2: Generate all consecutive subsets
        // Similar to applyComposedAngles approach
        // ============================================
        const n = sortedAngles.length;
        
        // Generate all consecutive subsets (wrapping around for a circle)
        for (let start = 0; start < n; start++) {
            for (let len = 2; len < n; len++) {
                const subset: Angle[] = [];
                const complement: Angle[] = [];
                
                for (let i = 0; i < n; i++) {
                    const idx = (start + i) % n;
                    if (i < len) {
                        subset.push(sortedAngles[idx]);
                    } else {
                        complement.push(sortedAngles[idx]);
                    }
                }
                
                // If complement is fully known, we can deduce subset sums
                const unknownComplement = getUnsolvedAngles(complement);
                if (unknownComplement.length === 0 && complement.length > 0) {
                    const complementSum = sumOfSolvedAnglesValue(complement);
                    const subsetSumTo = 360 - complementSum;
                    
                    if (subsetSumTo > 0 && subsetSumTo < 360) {
                        changesMade = tryToSolve({
                            angles: subset,
                            vertex,
                            sumTo: subsetSumTo
                        }, log, { angles, points, triangles }) || changesMade;
                    }
                }
            }
        }

        // ============================================
        // Case 3: Vertical angles (for 4-angle intersections)
        // Opposite angles are equal
        // ============================================
        if (sortedAngles.length === 4) {
            const pairs = [
                [sortedAngles[0], sortedAngles[2]],
                [sortedAngles[1], sortedAngles[3]]
            ];

            pairs.forEach(([a1, a2]) => {
                const v1 = getAngleValue(a1);
                const v2 = getAngleValue(a2);
                
                if (v1 !== null && v2 === null) {
                    // Validate before setting
                    const validation = validateAngleValue(a2, v1, { angles, points, triangles });
                    if (!validation.valid) return;
                    
                    a2.value = v1;
                    log(a2, `Vertical angles: ${a2.name} = ${a1.name} = ${v1}°`, 'applyFullAngleSum');
                    changesMade = true;
                } else if (v2 !== null && v1 === null) {
                    // Validate before setting
                    const validation = validateAngleValue(a1, v2, { angles, points, triangles });
                    if (!validation.valid) return;
                    
                    a1.value = v2;
                    log(a1, `Vertical angles: ${a1.name} = ${a2.name} = ${v2}°`, 'applyFullAngleSum');
                    changesMade = true;
                }
            });

            // Also: if 2 adjacent angles are known, opposite pair sums to 360 - known pair
            for (let i = 0; i < 4; i++) {
                const a1 = sortedAngles[i];
                const a2 = sortedAngles[(i + 1) % 4];
                const a3 = sortedAngles[(i + 2) % 4];
                const a4 = sortedAngles[(i + 3) % 4];

                const v1 = getAngleValue(a1);
                const v2 = getAngleValue(a2);
                const v3 = getAngleValue(a3);
                const v4 = getAngleValue(a4);

                // If adjacent pair is known, opposite pair sums to 360 - their sum
                if (v1 !== null && v2 !== null && v3 === null && v4 === null) {
                    const knownSum = v1 + v2;
                    const remainingSum = 360 - knownSum;
                    
                    // a3 and a4 are vertical, so they're equal
                    // Each = remainingSum / 2
                    if (a3.label && a3.label === a4.label) {
                        const value = remainingSum / 2;
                        if (value > 0 && value < 180) {
                            // Validate both
                            const v3Valid = validateAngleValue(a3, value, { angles, points, triangles });
                            const v4Valid = validateAngleValue(a4, value, { angles, points, triangles });
                            if (!v3Valid.valid || !v4Valid.valid) continue;
                            
                            a3.value = value;
                            a4.value = value;
                            log(a3, `360° - (${a1.name} + ${a2.name}) = ${remainingSum}°, same label, each = ${value}°`, 'applyFullAngleSum');
                            log(a4, `Same as ${a3.name} = ${value}°`, 'applyFullAngleSum');
                            changesMade = true;
                        }
                    }
                }
            }
        }

        // ============================================
        // Case 4: n angles, all with same label
        // Each angle = 360 / n
        // ============================================
        if (sortedAngles.length >= 3) {
            const firstLabel = sortedAngles[0]?.label;
            if (firstLabel && sortedAngles.every(a => a.label === firstLabel && getAngleValue(a) === null)) {
                const value = 360 / sortedAngles.length;
                if (value > 0 && value < 180) {
                    // Validate all
                    const allValid = sortedAngles.every(a => {
                        const validation = validateAngleValue(a, value, { angles, points, triangles });
                        return validation.valid;
                    });
                    if (!allValid) return;
                    
                    sortedAngles.forEach(a => {
                        a.value = value;
                        log(a, `${sortedAngles.length} same-label angles around vertex sum to 360°, each = ${value}°`, 'applyFullAngleSum');
                        changesMade = true;
                    });
                }
            }
        }
    });

    return changesMade;
};

/**
 * Try to solve a group of angles that sum to a specific value
 */
function tryToSolve(
    group: FullCircleGroup, 
    log: LogFn,
    validationData: { angles: Angle[]; points: Point[]; triangles: any[] }
): boolean {
    const { angles, vertex, sumTo } = group;
    let changesMade = false;
    
    const unknownAngles = getUnsolvedAngles(angles);
    const knownSum = sumOfSolvedAnglesValue(angles);
    const remaining = sumTo - knownSum;
    
    if (unknownAngles.length === 0) {
        return false; // All solved
    }

    // Case A: Single unknown
    if (unknownAngles.length === 1) {
        if (remaining > 0 && remaining < 360) {
            // Validate against all constraints
            const validation = validateAngleValue(unknownAngles[0], remaining, validationData);
            if (!validation.valid) return false;
            
            unknownAngles[0].value = remaining;
            log(
                unknownAngles[0],
                `Angles at ${vertex} sum to ${sumTo}°: ${unknownAngles[0].name} = ${remaining}°`,
                'applyFullAngleSum'
            );
            return true;
        }
    }

    // Case B: Multiple unknowns with same label
    const firstLabel = unknownAngles[0]?.label;
    if (firstLabel) {
        const sameLabelAngles = unknownAngles.filter(a => a.label === firstLabel);
        
        // All unknowns have the same label
        if (sameLabelAngles.length === unknownAngles.length) {
            const value = remaining / sameLabelAngles.length;
            
            if (value > 0 && value < 360) {
                // Validate against all constraints
                const constraintValid = sameLabelAngles.every(a => {
                    const validation = validateAngleValue(a, value, validationData);
                    return validation.valid;
                });
                
                if (constraintValid) {
                    sameLabelAngles.forEach(a => {
                        a.value = value;
                        log(
                            a,
                            `Angles at ${vertex} sum to ${sumTo}°, ${sameLabelAngles.length} same-label unknowns: ${a.name} = ${value}°`,
                            'applyFullAngleSum'
                        );
                        changesMade = true;
                    });
                }
            }
        }
        // Some unknowns have same label, others don't but might be calculable
        else if (sameLabelAngles.length > 0) {
            const otherUnknowns = unknownAngles.filter(a => a.label !== firstLabel);
            
            // If other unknowns all have their calculatedValue and it's reliable
            const otherKnownCalc = otherUnknowns.filter(a => a.calculatedValue !== undefined);
            if (otherKnownCalc.length === otherUnknowns.length && otherUnknowns.length > 0) {
                const otherSum = otherUnknowns.reduce((sum, a) => sum + (a.calculatedValue ?? 0), 0);
                const sameLabelSum = remaining - otherSum;
                const value = sameLabelSum / sameLabelAngles.length;
                
                if (value > 0 && value < 180) {
                    // Validate against constraints
                    const constraintValid = sameLabelAngles.every(a => {
                        const validation = validateAngleValue(a, value, validationData);
                        return validation.valid;
                    });
                    if (!constraintValid) return changesMade;
                    
                    sameLabelAngles.forEach(a => {
                        a.value = value;
                        log(
                            a,
                            `Deduced from 360° rule with calculated other angles: ${a.name} = ${value}°`,
                            'applyFullAngleSum'
                        );
                        changesMade = true;
                    });
                }
            }
        }
    }

    // Case C: Check for pairs of equal angles (by label)
    // If we have 2 unknowns with label X and the rest known
    const labelGroups = new Map<string, Angle[]>();
    unknownAngles.forEach(a => {
        if (a.label) {
            const labelGroup = labelGroups.get(a.label) || [];
            labelGroup.push(a);
            labelGroups.set(a.label, labelGroup);
        }
    });

    labelGroups.forEach((groupAngles, label) => {
        if (groupAngles.length >= 2) {
            // Check if other unknowns can be solved first
            const othersWithoutThisLabel = unknownAngles.filter(a => a.label !== label);
            const othersSolved = othersWithoutThisLabel.every(a => getAngleValue(a) !== null);
            
            if (othersSolved || othersWithoutThisLabel.length === 0) {
                const othersSum = othersWithoutThisLabel.reduce((sum, a) => sum + (getAngleValue(a) ?? 0), 0);
                const remainingForGroup = remaining - othersSum;
                const value = remainingForGroup / groupAngles.length;
                
                if (value > 0 && value < 180) {
                    // Validate against constraints
                    const constraintValid = groupAngles.every(a => {
                        if (getAngleValue(a) !== null) return true;
                        const validation = validateAngleValue(a, value, validationData);
                        return validation.valid;
                    });
                    if (!constraintValid) return;
                    
                    groupAngles.forEach(a => {
                        if (getAngleValue(a) === null) {
                            a.value = value;
                            log(
                                a,
                                `${groupAngles.length} angles with label ${label}, sum = ${remainingForGroup}°: ${a.name} = ${value}°`,
                                'applyFullAngleSum'
                            );
                            changesMade = true;
                        }
                    });
                }
            }
        }
    });

    return changesMade;
}

/**
 * Get all angles around a vertex sorted by their angular position
 */
function getSortedAnglesAroundVertex(
    anglesAtVertex: Angle[],
    points: Point[],
    vertexPoint: Point
): Angle[] {
    // Get all rays (sidepoints) emanating from this vertex
    const allRays = new Set<string>();
    anglesAtVertex.forEach(angle => {
        angle.sidepoints.forEach(sp => allRays.add(sp));
    });

    const rays = Array.from(allRays);
    
    if (rays.length < 3) {
        return [];
    }

    // Sort rays by angle from vertex (counterclockwise from positive x-axis)
    const sortedRays = rays
        .map(id => {
            const p = points.find(pt => pt.id === id);
            if (!p) return null;
            return { id, angle: pointToAngle(p, vertexPoint) };
        })
        .filter((r): r is { id: string; angle: number } => r !== null)
        .sort((a, b) => a.angle - b.angle)
        .map(r => r.id);

    // Build list of consecutive angles
    const result: Angle[] = [];
    
    for (let i = 0; i < sortedRays.length; i++) {
        const ray1 = sortedRays[i];
        const ray2 = sortedRays[(i + 1) % sortedRays.length];
        
        // Find angle with these two sidepoints
        const angle = anglesAtVertex.find(a =>
            a.sidepoints.includes(ray1) && a.sidepoints.includes(ray2)
        );
        
        if (angle) {
            result.push(angle);
        }
    }

    return result;
}

export default applyFullAngleSum;
