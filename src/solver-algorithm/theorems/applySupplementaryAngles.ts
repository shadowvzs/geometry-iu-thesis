import type { Angle, Point, SolveDataWithMaps } from '@/types';
import {
    pointToAngle,
    getUnsolvedAngles,
    sumOfSolvedAnglesValue,
} from '@/utils/mathHelper';
import { validateAngleValue } from '@/utils/angleValidation';

type LogFn = (angle: Angle, reason: string, ruleName: string) => void;

interface SupplementaryGroup {
    angles: Angle[];
    vertex: string;
    sumTo: number;
}

// Validate that a path of angles is geometrically valid (sums to ~180°)
const isValidSupplementaryPath = (angles: Angle[], tolerance: number = 10): boolean => {
    // Sum up the calculated geometric values of all angles in the path
    const sum = angles.reduce((acc, angle) => {
        // Use calculatedValue (the geometric angle) not value (solved value)
        return acc + (angle.calculatedValue ?? 0);
    }, 0);
    
    // Valid supplementary paths should sum to approximately 180°
    return Math.abs(sum - 180) <= tolerance;
};

export const applySupplementaryAngles = (data: SolveDataWithMaps, log: LogFn): boolean => {
    const { angleMapsByPointId, lines, points, angles, triangles } = data;
    let changesMade = false;

    const allSupplementaryGroups: SupplementaryGroup[] = [];
    
    Object.keys(angleMapsByPointId).forEach(vertex => {
        const anglesWithThisVertex = angleMapsByPointId[vertex];
        if (anglesWithThisVertex.length < 2) {
            return;
        }

        const vertexPoint = points.find(p => p.id === vertex);
        if (!vertexPoint) return;

        lines.forEach(line => {
            const vertexPointIndex = line.points.indexOf(vertex);
            if (vertexPointIndex < 1 || vertexPointIndex === line.points.length - 1) {
                return;
            }

            const pointsBefore = line.points.slice(0, vertexPointIndex);
            const pointsAfter = line.points.slice(vertexPointIndex + 1);
            
            // Get all rays at this vertex, sorted by angle
            const allRays = [...new Set(anglesWithThisVertex.flatMap(a => a.sidepoints))]
                .map(id => points.find(p => p.id === id))
                .filter((p): p is Point => !!p)
                .map(p => ({ id: p.id, angle: pointToAngle(p, vertexPoint) }))
                .sort((a, b) => a.angle - b.angle)
                .map(r => r.id);
            
            // Separate rays into "before" side and "after" side of the line
            const beforeRays = allRays.filter(r => pointsBefore.includes(r));
            const afterRays = allRays.filter(r => pointsAfter.includes(r));
            
            if (beforeRays.length === 0 || afterRays.length === 0) {
                return;
            }
            
            // Generate all valid combinations using recursion
            // Each combination is a set of angles that together span from before side to after side
            const generateSpanningCombinations = (): Angle[][] => {
                const combinations: Angle[][] = [];
                
                // Use recursive approach to find all paths from "before" to "after"
                const findPaths = (currentRay: string, path: Angle[], visited: Set<string>) => {
                    // If current ray is on "after" side, we found a valid path
                    if (pointsAfter.includes(currentRay)) {
                        // Only add if the path is geometrically valid (sums to ~180°)
                        if (path.length > 0 && isValidSupplementaryPath(path)) {
                            combinations.push([...path]);
                        }
                        return;
                    }
                    
                    // Try all angles from current ray
                    for (const angle of anglesWithThisVertex) {
                        if (!angle.sidepoints.includes(currentRay)) continue;
                        
                        const otherRay = angle.sidepoints[0] === currentRay 
                            ? angle.sidepoints[1] 
                            : angle.sidepoints[0];
                        
                        // Don't go back to "before" side or revisit
                        if (pointsBefore.includes(otherRay) || visited.has(angle.id)) continue;
                        
                        visited.add(angle.id);
                        path.push(angle);
                        findPaths(otherRay, path, visited);
                        path.pop();
                        visited.delete(angle.id);
                    }
                };
                
                // Start from each "before" ray
                for (const startRay of beforeRays) {
                    findPaths(startRay, [], new Set());
                }
                
                return combinations;
            };
            
            const spanningCombinations = generateSpanningCombinations();
            
            // Each spanning combination sums to 180°
            spanningCombinations.forEach(combination => {
                // Add the full combination
                allSupplementaryGroups.push({
                    angles: combination,
                    vertex,
                    sumTo: 180
                });
                
                // Also generate sub-groups where some angles are known
                if (combination.length > 1) {
                    for (let start = 0; start < combination.length; start++) {
                        for (let len = 1; len < combination.length; len++) {
                            const end = start + len;
                            if (end > combination.length) break;
                            
                            const subset = combination.slice(start, end);
                            const complement = [
                                ...combination.slice(0, start),
                                ...combination.slice(end)
                            ];
                            
                            const unknownComplement = getUnsolvedAngles(complement);
                            if (unknownComplement.length === 0 && complement.length > 0) {
                                const complementSum = sumOfSolvedAnglesValue(complement);
                                const subsetSumTo = 180 - complementSum;
                                // Only add if sumTo is in valid range
                                if (subsetSumTo > 0 && subsetSumTo <= 180) {
                                    allSupplementaryGroups.push({
                                        angles: subset,
                                        vertex,
                                        sumTo: subsetSumTo
                                    });
                                }
                            }
                        }
                    }
                }
            });
        });
    });

    if (allSupplementaryGroups.length === 0) {
        return false;
    }

    // Deduplicate groups by angle IDs and sumTo
    const seenGroups = new Set<string>();
    const uniqueGroups = allSupplementaryGroups.filter(group => {
        const key = group.angles.map(a => a.id).sort().join(',') + ':' + group.sumTo;
        if (seenGroups.has(key)) return false;
        seenGroups.add(key);
        return true;
    });

    uniqueGroups.forEach(({ angles: supplementaryAngles, sumTo }) => {
        const unknownAngles = getUnsolvedAngles(supplementaryAngles);
        const sumOfKnownAnglesVal = sumOfSolvedAnglesValue(supplementaryAngles);

        if (unknownAngles.length === 1) {
            const value = sumTo - sumOfKnownAnglesVal;
            // Validate the result is in a reasonable range
            if (value <= 0 || value > 180) return;
            
            // Validate against all constraints
            const validation = validateAngleValue(unknownAngles[0], value, {
                angles, points, triangles, lines
            });
            if (!validation.valid) return;
            
            unknownAngles[0].value = value;
            log(
                unknownAngles[0],
                `Supplementary angles sum to ${sumTo}°, so ${unknownAngles[0].name} = ${value}°`,
                'applySupplementaryAngles'
            );
            changesMade = true;
            return;
        }

        const label = unknownAngles[0]?.label;
        const sameLabelAngles = unknownAngles.filter(angle => label && angle.label === label);

        if (sameLabelAngles.length === unknownAngles.length && sameLabelAngles.length > 0) {
            const angleValue = (sumTo - sumOfKnownAnglesVal) / sameLabelAngles.length;
            // Validate the result is in a reasonable range
            if (angleValue <= 0 || angleValue > 180) return;
            
            // Validate all angles against constraints
            const allValid = sameLabelAngles.every(angle => {
                const validation = validateAngleValue(angle, angleValue, {
                    angles, points, triangles, lines
                });
                return validation.valid;
            });
            if (!allValid) return;
            
            sameLabelAngles.forEach(angle => {
                angle.value = angleValue;
                log(
                    angle,
                    `Supplementary angles sum to ${sumTo}°, so ${angle.name} = ${angleValue}°`,
                    'applySupplementaryAngles'
                );
                changesMade = true;
            });
        }
    });

    return changesMade;
};
