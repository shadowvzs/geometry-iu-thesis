import type { SolveDataWithMaps } from '@/utils/solve';
import type { Angle, Point, Triangle } from '../types';
import {
    pointToAngle,
    getTriangleAngles,
    findSameAnglesGroups,
    searchVertexAngleInIsoscelesTriangle,
    getAngleValue,
} from '../utils/mathHelper';

/**
 * Extract all geometric relationships as string equations without solving.
 * Format examples:
 * - "∠ABC+∠BCA+∠CAB=180" (triangle sum)
 * - "∠ABC=∠DEF" (equal angles)
 * - "∠ABC=∠ABD+∠DBC" (composed)
 * - "∠ABC=45" (known value)
 */
export const extractEquations = (data: SolveDataWithMaps): string[] => {
    const equations: string[] = [];
    
    // 1. Triangle angle sum equations
    extractTriangleEquations(data, equations);
    
    // 2. Supplementary angle equations (angles on a line)
    extractSupplementaryEquations(data, equations);
    
    // 3. Composed angle equations (parent = sum of children)
    extractComposedEquations(data, equations);
    
    // 4. Same angles equations (vertical angles, etc.)
    extractSameAnglesEquations(data, equations);
    
    // 5. Same label equations
    extractSameLabelEquations(data, equations);
    
    // 6. Isosceles triangle equations
    extractIsoscelesEquations(data, equations);
    
    // 7. Mirror (vertical) angles equations
    extractMirrorAnglesEquations(data, equations);
    
    // 8. Full circle (360°) equations for vertices with 3+ angles
    extractFullCircleEquations(data, equations);
    
    // 9. Known values
    extractKnownValues(data, equations);
    
    // 10. Label assignments (∠ADE=α)
    extractLabelAssignments(data, equations);
    
    // Deduplicate equations
    return [...new Set(equations)];
};

/**
 * Triangle: sum of angles = 180°
 */
const extractTriangleEquations = (
    { triangles, angles }: SolveDataWithMaps,
    equations: string[]
): void => {
    triangles.forEach(triangleData => {
        const triangle: Triangle = triangleData instanceof Set 
            ? triangleData 
            : new Set(triangleData);
        
        const triangleAngles = getTriangleAngles(triangle, angles);
        if (triangleAngles.length !== 3) return;
        
        // ∠A+∠B+∠C=180
        equations.push(`${triangleAngles.map(a => a.name).join('+')}=180`);
    });
};

/**
 * Supplementary angles: angles on a line sum to 180°
 */
const extractSupplementaryEquations = (
    { angleMapsByPointId, lines, points }: SolveDataWithMaps,
    equations: string[]
): void => {
    Object.keys(angleMapsByPointId).forEach(vertex => {
        const anglesWithThisVertex = angleMapsByPointId[vertex];
        if (anglesWithThisVertex.length < 2) return;

        const vertexPoint = points.find(p => p.id === vertex);
        if (!vertexPoint) return;

        lines.forEach(line => {
            const vertexPointIndex = line.points.indexOf(vertex);
            if (vertexPointIndex < 1 || vertexPointIndex === line.points.length - 1) return;

            const pointsBefore = line.points.slice(0, vertexPointIndex);
            const pointsAfter = line.points.slice(vertexPointIndex + 1);
            
            const allRays = [...new Set(anglesWithThisVertex.flatMap(a => a.sidepoints))]
                .map(id => points.find(p => p.id === id))
                .filter((p): p is Point => !!p)
                .map(p => ({ id: p.id, angle: pointToAngle(p, vertexPoint) }))
                .sort((a, b) => a.angle - b.angle)
                .map(r => r.id);
            
            const beforeRays = allRays.filter(r => pointsBefore.includes(r));
            const afterRays = allRays.filter(r => pointsAfter.includes(r));
            
            if (beforeRays.length === 0 || afterRays.length === 0) return;
            
            const spanningCombinations = findSpanningPaths(
                beforeRays, 
                afterRays, 
                pointsBefore, 
                anglesWithThisVertex
            );
            
            spanningCombinations.forEach(combination => {
                // Validate geometrically
                const sum = combination.reduce((acc, a) => acc + (a.calculatedValue ?? 0), 0);
                if (Math.abs(sum - 180) > 15) return;
                
                // ∠X+∠Y+∠Z=180
                equations.push(`${combination.map(a => a.name).join('+')}=180`);
                
                // Also generate derived sums when some angles are known
                // e.g., if ∠A+∠B+∠C=180 and ∠A=20, then ∠B+∠C=160
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
                            
                            // If all complement angles have known values
                            const complementKnown = complement.every(a => getAngleValue(a) !== null);
                            if (complementKnown && complement.length > 0) {
                                const complementSum = complement.reduce((acc, a) => acc + (getAngleValue(a) ?? 0), 0);
                                const subsetSumTo = 180 - complementSum;
                                if (subsetSumTo > 0 && subsetSumTo <= 180) {
                                    // ∠X+∠Y=160
                                    equations.push(`${subset.map(a => a.name).join('+')}=${subsetSumTo}`);
                                }
                            }
                        }
                    }
                }
            });
        });
    });
};

/**
 * Composed angles: parent = sum of children
 */
const extractComposedEquations = (
    { angles, points }: SolveDataWithMaps,
    equations: string[]
): void => {
    const anglesByVertex: Record<string, Angle[]> = angles.reduce((map, angle) => {
        if (!map[angle.pointId]) map[angle.pointId] = [];
        map[angle.pointId].push(angle);
        return map;
    }, {} as Record<string, Angle[]>);
    
    Object.entries(anglesByVertex).forEach(([vertexId, vertexAngles]) => {
        if (vertexAngles.length < 2) return;
        
        const vertex = points.find(p => p.id === vertexId);
        if (!vertex) return;
        
        const rayPoints = [...new Set(vertexAngles.flatMap(a => a.sidepoints))];
        const sortedRays = rayPoints
            .map(id => {
                const pt = points.find(p => p.id === id);
                return pt ? { id, angle: Math.atan2(pt.y - vertex.y, pt.x - vertex.x) } : null;
            })
            .filter((r): r is { id: string; angle: number } => r !== null)
            .sort((a, b) => a.angle - b.angle)
            .map(r => r.id);
        
        const findAngle = (ray1: string, ray2: string): Angle | undefined => {
            return vertexAngles.find(a => 
                a.sidepoints.includes(ray1) && a.sidepoints.includes(ray2)
            );
        };
        
        const findDecompositions = (start: number, end: number): Angle[][] => {
            if (start === end) return [[]];
            const results: Angle[][] = [];
            for (let mid = start + 1; mid <= end; mid++) {
                const angle = findAngle(sortedRays[start], sortedRays[mid]);
                if (angle) {
                    const subDecomps = findDecompositions(mid, end);
                    for (const subDecomp of subDecomps) {
                        results.push([angle, ...subDecomp]);
                    }
                }
            }
            return results;
        };

        for (let i = 0; i < sortedRays.length; i++) {
            for (let j = i + 2; j < sortedRays.length; j++) {
                const parentAngle = findAngle(sortedRays[i], sortedRays[j]);
                if (!parentAngle) continue;
                
                const decompositions = findDecompositions(i, j);
                
                for (const children of decompositions) {
                    if (children.length < 2) continue;
                    
                    // Validate geometrically
                    const childrenSum = children.reduce((acc, c) => acc + (c.calculatedValue ?? 0), 0);
                    const parentCalc = parentAngle.calculatedValue ?? 0;
                    if (Math.abs(childrenSum - parentCalc) > 15) continue;
                    
                    // ∠Parent=∠Child1+∠Child2
                    equations.push(`${parentAngle.name}=${children.map(c => c.name).join('+')}`);
                    
                    // Also add derived equations when parent or children have values
                    const parentValue = getAngleValue(parentAngle);
                    const knownChildValues = children
                        .map(c => getAngleValue(c))
                        .filter((v): v is number => v !== null);
                    const unknownChildren = children.filter(c => getAngleValue(c) === null);
                    
                    if (parentValue && knownChildValues.length > 0 && unknownChildren.length === 1) {
                        // Format: ∠Parent=parentValue-knownChild1-knownChild2 (matches solver format)
                        equations.push(`${parentAngle.name}=${parentValue}-${knownChildValues.join('-')}`);
                    }
                }
            }
        }
    });
};

/**
 * Same angles: vertical angles, etc.
 */
const extractSameAnglesEquations = (
    { angleMapsByPointId, lines }: SolveDataWithMaps,
    equations: string[]
): void => {
    Object.keys(angleMapsByPointId).forEach(vertex => {
        const anglesWithThisVertex = angleMapsByPointId[vertex];
        if (anglesWithThisVertex.length < 2) return;

        const sameAnglesGroups = findSameAnglesGroups(anglesWithThisVertex, lines);
        
        sameAnglesGroups.forEach(sameAngles => {
            if (sameAngles.length < 2) return;
            
            // ∠X=∠Y for each pair
            for (let i = 1; i < sameAngles.length; i++) {
                equations.push(`${sameAngles[0].name}=${sameAngles[i].name}`);
            }
        });
    });
};

/**
 * Same label: angles with same label are equal
 */
const extractSameLabelEquations = (
    { angles }: SolveDataWithMaps,
    equations: string[]
): void => {
    const anglesByLabel: Record<string, Angle[]> = {};
    
    angles.forEach(angle => {
        if (angle.label) {
            if (!anglesByLabel[angle.label]) {
                anglesByLabel[angle.label] = [];
            }
            anglesByLabel[angle.label].push(angle);
        }
    });
    
    Object.entries(anglesByLabel).forEach(([_label, labelAngles]) => {
        if (labelAngles.length < 2) return;
        
        // ∠X=∠Y for each pair with same label
        for (let i = 1; i < labelAngles.length; i++) {
            equations.push(`${labelAngles[0].name}=${labelAngles[i].name}`);
        }
    });
};

/**
 * Isosceles triangles: base angles are equal
 * Equilateral triangles: all angles = 60°
 */
const extractIsoscelesEquations = (
    { triangles, circles, angles }: SolveDataWithMaps,
    equations: string[]
): void => {
    triangles.forEach(triangleData => {
        const triangle: Triangle = triangleData instanceof Set 
            ? triangleData 
            : new Set(triangleData);
        
        const triangleAngles = getTriangleAngles(triangle, angles);
        if (triangleAngles.length !== 3) return;
        
        // Check for equilateral triangle (all same label)
        const labels = triangleAngles.map(a => a.label).filter(Boolean);
        const uniqueLabels = [...new Set(labels)];
        const isEquilateralByLabel = labels.length === 3 && uniqueLabels.length === 1;
        
        // Check if equilateral by circles: 
        // Triangle must have exactly 2 circles where:
        // - Each circle's center is a triangle vertex
        // - The other 2 vertices are on each circle
        // - Both circles have the same radius (implicit from geometry)
        const trianglePoints = Array.from(triangle);
        let isEquilateralByCircles = false;
        
        if (circles.length >= 2) {
            // Find circles whose center is a triangle vertex
            const relevantCircles = circles.filter(c => trianglePoints.includes(c.centerPoint));
            
            if (relevantCircles.length >= 2) {
                // Check if the other 2 points of each circle-centered vertex are on the other circle
                const centersAreVertices = relevantCircles.every(c => {
                    const otherPoints = trianglePoints.filter(p => p !== c.centerPoint);
                    return otherPoints.every(p => c.pointsOnLine.includes(p));
                });
                
                // All 3 vertices must be covered (2 as centers, 1 as intersection)
                const allVerticesCovered = trianglePoints.every(p => 
                    relevantCircles.some(c => c.centerPoint === p) || 
                    relevantCircles.every(c => c.pointsOnLine.includes(p))
                );
                
                isEquilateralByCircles = centersAreVertices && allVerticesCovered && relevantCircles.length === 2;
            }
        }
        
        if (isEquilateralByLabel || isEquilateralByCircles) {
            // All angles equal: ∠A=∠B, ∠B=∠C, and each = 60
            equations.push(`${triangleAngles[0].name}=${triangleAngles[1].name}`);
            equations.push(`${triangleAngles[1].name}=${triangleAngles[2].name}`);
            equations.push(`${triangleAngles[0].name}=60`);
            return;
        }
        
        // Check for isosceles by circle
        for (const circle of circles) {
            const vertexAngle = searchVertexAngleInIsoscelesTriangle(triangleAngles, circle);
            if (!vertexAngle) continue;
            
            const baseAngles = triangleAngles.filter(a => a.pointId !== vertexAngle.pointId);
            if (baseAngles.length !== 2) continue;
            
            // Base angles are equal: ∠Base1=∠Base2
            equations.push(`${baseAngles[0].name}=${baseAngles[1].name}`);
            
            // Vertex angle: ∠Vertex=180-∠Base1-∠Base2 (or 180-2*∠Base)
            equations.push(`${vertexAngle.name}=180-${baseAngles[0].name}-${baseAngles[1].name}`);
            
            break;
        }
        
        // Check for isosceles by same label on 2 angles
        const labelCounts: Record<string, Angle[]> = {};
        triangleAngles.forEach(a => {
            if (a.label) {
                if (!labelCounts[a.label]) labelCounts[a.label] = [];
                labelCounts[a.label].push(a);
            }
        });
        
        Object.values(labelCounts).forEach(sameLabel => {
            if (sameLabel.length === 2) {
                // Two angles with same label = isosceles base angles
                equations.push(`${sameLabel[0].name}=${sameLabel[1].name}`);
            }
        });
    });
};

/**
 * Mirror (vertical) angles: opposite angles when two lines intersect are equal
 * Also: 4 angles at intersection sum to 360°
 */
const extractMirrorAnglesEquations = (
    { angleMapsByPointId, lines }: SolveDataWithMaps,
    equations: string[]
): void => {
    if (lines.length < 2) return;
    
    const getMirrorAngle = (before: string, after: string, anglesAtVertex: Angle[]): Angle | undefined => {
        return anglesAtVertex.find(a => 
            a.sidepoints.includes(before) && a.sidepoints.includes(after)
        );
    };
    
    Object.keys(angleMapsByPointId).forEach(vertex => {
        const anglesAtVertex = angleMapsByPointId[vertex];
        if (anglesAtVertex.length < 2) return;

        const linesThruVertex = lines.filter(line => line.points.includes(vertex));
        if (linesThruVertex.length < 2) return;

        for (let i = 0; i < linesThruVertex.length; i++) {
            for (let j = i + 1; j < linesThruVertex.length; j++) {
                const line1 = linesThruVertex[i];
                const line2 = linesThruVertex[j];

                const vertexIndex1 = line1.points.indexOf(vertex);
                const vertexIndex2 = line2.points.indexOf(vertex);

                const line1Before = line1.points.slice(0, vertexIndex1);
                const line1After = line1.points.slice(vertexIndex1 + 1);
                const line2Before = line2.points.slice(0, vertexIndex2);
                const line2After = line2.points.slice(vertexIndex2 + 1);

                if ((!line1Before.length || !line1After.length) ||
                    (!line2Before.length || !line2After.length)) {
                    continue;
                }

                const p1Before = line1Before[line1Before.length - 1];
                const p1After = line1After[0];
                const p2Before = line2Before[line2Before.length - 1];
                const p2After = line2After[0];

                const mirrorPairs = [
                    { side1: [p1Before, p2Before], side2: [p1After, p2After] },
                    { side1: [p1Before, p2After], side2: [p1After, p2Before] }
                ];

                const allFourAngles: Angle[] = [];
                
                mirrorPairs.forEach(({ side1, side2 }) => {
                    const angle1 = getMirrorAngle(side1[0], side1[1], anglesAtVertex);
                    const angle2 = getMirrorAngle(side2[0], side2[1], anglesAtVertex);

                    if (angle1 && angle2) {
                        // ∠X=∠Y (vertical angles)
                        equations.push(`${angle1.name}=${angle2.name}`);
                        allFourAngles.push(angle1, angle2);
                    }
                });
                
                // If we have all 4 angles at the intersection, add the 360° sum rule
                // Also add: ∠1+∠2=180 (adjacent angles are supplementary)
                if (allFourAngles.length === 4) {
                    // All 4 sum to 360
                    equations.push(`${allFourAngles.map(a => a.name).join('+')}=360`);
                    
                    // Adjacent pairs sum to 180 (already covered by supplementary, but explicit)
                    const angle1 = getMirrorAngle(p1Before, p2Before, anglesAtVertex);
                    const angle2 = getMirrorAngle(p1Before, p2After, anglesAtVertex);
                    if (angle1 && angle2) {
                        equations.push(`${angle1.name}+${angle2.name}=180`);
                    }
                }
            }
        }
    });
};

/**
 * Full circle: angles around a point with 3+ edges sum to 360°
 * This is more general than line intersections - works with any vertex where
 * angles form a complete circle.
 * 
 * Now extracts ALL valid partitions (including composed angles), not just elementary angles.
 */
const extractFullCircleEquations = (
    { angleMapsByPointId, points }: SolveDataWithMaps,
    equations: string[]
): void => {
    Object.keys(angleMapsByPointId).forEach(vertex => {
        const anglesAtVertex = angleMapsByPointId[vertex];
        
        if (anglesAtVertex.length < 3) return;

        const vertexPoint = points.find(p => p.id === vertex);
        if (!vertexPoint) return;

        // Get all rays (sidepoints) emanating from this vertex
        const allRays = new Set<string>();
        anglesAtVertex.forEach(angle => {
            angle.sidepoints.forEach(sp => allRays.add(sp));
        });

        const rays = Array.from(allRays);
        if (rays.length < 3) return;

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

        // Helper to find angle between two rays
        const findAngle = (ray1: string, ray2: string): Angle | undefined => {
            return anglesAtVertex.find(a =>
                a.sidepoints.includes(ray1) && a.sidepoints.includes(ray2)
            );
        };

        // Build list of consecutive (elementary) angles around the vertex
        const circleAngles: Angle[] = [];
        for (let i = 0; i < sortedRays.length; i++) {
            const ray1 = sortedRays[i];
            const ray2 = sortedRays[(i + 1) % sortedRays.length];
            
            const angle = findAngle(ray1, ray2);
            if (angle) {
                circleAngles.push(angle);
            }
        }

        // Check if we have a complete circle (number of angles equals number of rays)
        if (circleAngles.length !== allRays.size) return;

        // Validate geometrically - calculated values should sum to ~360°
        const calculatedSum = circleAngles.reduce((sum, a) => 
            sum + (a.calculatedValue ?? 0), 0
        );
        if (Math.abs(calculatedSum - 360) > 30) return;

        // Add the elementary full circle equation: ∠A+∠B+∠C+...=360
        equations.push(`${circleAngles.map(a => a.name).join('+')}=360`);

        // Find ALL valid partitions of the full circle (including composed angles)
        const allPartitions = findAllCirclePartitions(anglesAtVertex, sortedRays, findAngle);
        
        // Add equations for each unique partition
        const seenEquations = new Set<string>();
        seenEquations.add(circleAngles.map(a => a.name).sort().join('+'));
        
        for (const partition of allPartitions) {
            // Validate geometrically
            const partitionCalcSum = partition.reduce((sum, a) => sum + (a.calculatedValue ?? 0), 0);
            if (Math.abs(partitionCalcSum - 360) > 30) continue;
            
            const eqKey = partition.map(a => a.name).sort().join('+');
            if (!seenEquations.has(eqKey)) {
                seenEquations.add(eqKey);
                equations.push(`${partition.map(a => a.name).join('+')}=360`);
            }
        }
    });
};

/**
 * Find all valid partitions of angles around a full circle.
 * Similar to findDecompositions in applyComposedAngles, but for circular arrangement.
 */
const findAllCirclePartitions = (
    anglesAtVertex: Angle[],
    sortedRays: string[],
    findAngle: (ray1: string, ray2: string) => Angle | undefined
): Angle[][] => {
    const n = sortedRays.length;
    if (n < 3) return [];
    
    const results: Angle[][] = [];
    
    // Helper: find all ways to partition from startIdx to endIdx (non-circular)
    const findPartitions = (startIdx: number, endIdx: number): Angle[][] => {
        if (startIdx === endIdx) return [[]];
        
        const partitions: Angle[][] = [];
        for (let midIdx = startIdx + 1; midIdx <= endIdx; midIdx++) {
            const angle = findAngle(sortedRays[startIdx], sortedRays[midIdx]);
            if (angle) {
                const subPartitions = findPartitions(midIdx, endIdx);
                for (const subPartition of subPartitions) {
                    partitions.push([angle, ...subPartition]);
                }
            }
        }
        return partitions;
    };
    
    // For a full circle, start at ray 0 and wrap back to ray 0
    for (let lastStart = 1; lastStart < n; lastStart++) {
        const firstPartitions = findPartitions(0, lastStart);
        const wrapAngle = findAngle(sortedRays[lastStart], sortedRays[0]);
        
        if (wrapAngle && firstPartitions.length > 0) {
            for (const partition of firstPartitions) {
                const fullPartition = [...partition, wrapAngle];
                if (fullPartition.length >= 3) {
                    results.push(fullPartition);
                }
            }
        }
    }
    
    // Deduplicate partitions
    const uniquePartitions: Angle[][] = [];
    const seen = new Set<string>();
    
    for (const partition of results) {
        const key = partition.map(a => a.id).sort().join(',');
        if (!seen.has(key)) {
            seen.add(key);
            uniquePartitions.push(partition);
        }
    }
    
    return uniquePartitions;
};

/**
 * Known values: angles that already have a value
 */
const extractKnownValues = (
    { angles }: SolveDataWithMaps,
    equations: string[]
): void => {
    angles.forEach(angle => {
        const value = getAngleValue(angle);
        if (value !== null) {
            // ∠ABC=45
            equations.push(`${angle.name}=${value}`);
        }
    });
};

/**
 * Label assignments: angles with labels (∠ADE=α)
 */
const extractLabelAssignments = (
    { angles }: SolveDataWithMaps,
    equations: string[]
): void => {
    angles.forEach(angle => {
        if (angle.label) {
            // ∠ADE=α
            equations.push(`${angle.name}=${angle.label}`);
        }
    });
};

/**
 * Simplify equations by replacing angle names with short unique characters.
 * Same angles (vertical angles, same label, etc.) get the same character.
 * 
 * @returns Object with simplified equations and the mapping used
 */
export const simplifyEquations = (
    equations: string[],
    data: SolveDataWithMaps
): { equations: string[]; mapping: Map<string, string>; reverseMapping: Map<string, string[]> } => {
    const { angles, lines, angleMapsByPointId } = data;
    
    // Build groups of angles that are "the same"
    const sameAngleGroups: Set<string>[] = [];
    const angleToGroup = new Map<string, Set<string>>();
    
    // Helper to merge or create groups
    const addToSameGroup = (name1: string, name2: string) => {
        const group1 = angleToGroup.get(name1);
        const group2 = angleToGroup.get(name2);
        
        if (group1 && group2) {
            if (group1 !== group2) {
                // Merge groups
                group2.forEach(name => {
                    group1.add(name);
                    angleToGroup.set(name, group1);
                });
                const idx = sameAngleGroups.indexOf(group2);
                if (idx !== -1) sameAngleGroups.splice(idx, 1);
            }
        } else if (group1) {
            group1.add(name2);
            angleToGroup.set(name2, group1);
        } else if (group2) {
            group2.add(name1);
            angleToGroup.set(name1, group2);
        } else {
            const newGroup = new Set([name1, name2]);
            sameAngleGroups.push(newGroup);
            angleToGroup.set(name1, newGroup);
            angleToGroup.set(name2, newGroup);
        }
    };
    
    // 1. Group by same angles (vertical angles, etc.)
    Object.keys(angleMapsByPointId).forEach(vertex => {
        const anglesAtVertex = angleMapsByPointId[vertex];
        if (anglesAtVertex.length < 2) return;
        
        const groups = findSameAnglesGroups(anglesAtVertex, lines);
        groups.forEach(group => {
            for (let i = 1; i < group.length; i++) {
                addToSameGroup(group[0].name, group[i].name);
            }
        });
    });
    
    // 2. Group by same label
    const labelGroups: Record<string, string[]> = {};
    angles.forEach(angle => {
        if (angle.label) {
            if (!labelGroups[angle.label]) labelGroups[angle.label] = [];
            labelGroups[angle.label].push(angle.name);
        }
    });
    Object.values(labelGroups).forEach(names => {
        for (let i = 1; i < names.length; i++) {
            addToSameGroup(names[0], names[i]);
        }
    });
    
    // 3. Group mirror angles (vertical angles from line intersections)
    if (lines.length >= 2) {
        Object.keys(angleMapsByPointId).forEach(vertex => {
            const anglesAtVertex = angleMapsByPointId[vertex];
            const linesThruVertex = lines.filter(line => line.points.includes(vertex));
            if (linesThruVertex.length < 2) return;
            
            for (let i = 0; i < linesThruVertex.length; i++) {
                for (let j = i + 1; j < linesThruVertex.length; j++) {
                    const line1 = linesThruVertex[i];
                    const line2 = linesThruVertex[j];
                    const vi1 = line1.points.indexOf(vertex);
                    const vi2 = line2.points.indexOf(vertex);
                    
                    const l1Before = line1.points.slice(0, vi1);
                    const l1After = line1.points.slice(vi1 + 1);
                    const l2Before = line2.points.slice(0, vi2);
                    const l2After = line2.points.slice(vi2 + 1);
                    
                    if (!l1Before.length || !l1After.length || !l2Before.length || !l2After.length) continue;
                    
                    const pairs = [
                        [[l1Before[l1Before.length-1], l2Before[l2Before.length-1]], [l1After[0], l2After[0]]],
                        [[l1Before[l1Before.length-1], l2After[0]], [l1After[0], l2Before[l2Before.length-1]]]
                    ];
                    
                    pairs.forEach(([side1, side2]) => {
                        const a1 = anglesAtVertex.find(a => a.sidepoints.includes(side1[0]) && a.sidepoints.includes(side1[1]));
                        const a2 = anglesAtVertex.find(a => a.sidepoints.includes(side2[0]) && a.sidepoints.includes(side2[1]));
                        if (a1 && a2) addToSameGroup(a1.name, a2.name);
                    });
                }
            }
        });
    }
    
    // Generate unique characters for each group/angle
    const mapping = new Map<string, string>();
    const reverseMapping = new Map<string, string[]>();
    let charIndex = 0;
    
    const getNextChar = (): string => {
        if (charIndex < 26) {
            return String.fromCharCode(97 + charIndex++); // a-z
        }
        const base = Math.floor((charIndex - 26) / 10);
        const num = (charIndex - 26) % 10;
        charIndex++;
        return String.fromCharCode(97 + (base % 26)) + num; // a0-a9, b0-b9, etc.
    };
    
    // Assign characters to grouped angles first
    sameAngleGroups.forEach(group => {
        const char = getNextChar();
        const names = Array.from(group);
        names.forEach(name => mapping.set(name, char));
        reverseMapping.set(char, names);
    });
    
    // Assign characters to remaining angles
    angles.forEach(angle => {
        if (!mapping.has(angle.name)) {
            const char = getNextChar();
            mapping.set(angle.name, char);
            reverseMapping.set(char, [angle.name]);
        }
    });
    
    // Replace angle names in equations
    // Sort by name length descending to avoid partial replacements
    const sortedNames = Array.from(mapping.keys()).sort((a, b) => b.length - a.length);
    
    const simplifiedEquations = equations.map(eq => {
        let simplified = eq;
        sortedNames.forEach(name => {
            const char = mapping.get(name)!;
            // Use regex to replace exact matches
            simplified = simplified.split(name).join(char);
        });
        return simplified;
    });
    
    return {
        equations: [...new Set(simplifiedEquations)], // Deduplicate
        mapping,
        reverseMapping
    };
};

/**
 * Helper: Find all paths from before-rays to after-rays
 */
const findSpanningPaths = (
    beforeRays: string[],
    afterRays: string[],
    pointsBefore: string[],
    anglesWithThisVertex: Angle[]
): Angle[][] => {
    const combinations: Angle[][] = [];
    
    const findPaths = (currentRay: string, path: Angle[], visited: Set<string>) => {
        if (afterRays.includes(currentRay)) {
            if (path.length > 0) {
                combinations.push([...path]);
            }
            return;
        }
        
        for (const angle of anglesWithThisVertex) {
            if (!angle.sidepoints.includes(currentRay)) continue;
            
            const otherRay = angle.sidepoints[0] === currentRay 
                ? angle.sidepoints[1] 
                : angle.sidepoints[0];
            
            if (pointsBefore.includes(otherRay) || visited.has(angle.id)) continue;
            
            visited.add(angle.id);
            path.push(angle);
            findPaths(otherRay, path, visited);
            path.pop();
            visited.delete(angle.id);
        }
    };
    
    for (const startRay of beforeRays) {
        findPaths(startRay, [], new Set());
    }
    
    return combinations;
};

/**
 * Clean equations for Wolfram Alpha:
 * - Replace Greek letters with words
 * - Remove identity equations (a=a)
 * - Remove label-only assignments (c=alpha)
 */
export const cleanEquationsForWolfram = (equations: string[]): string[] => {
    return equations
        .map(eq => eq
            .replace(/α/g, 'alpha')
            .replace(/β/g, 'beta')
            .replace(/γ/g, 'gamma')
            .replace(/δ/g, 'delta')
            .replace(/ε/g, 'epsilon')
            .replace(/θ/g, 'theta')
        )
        .filter(eq => {
            const parts = eq.split('=');
            // Remove identity equations like "a=a"
            if (parts.length === 2 && parts[0] === parts[1]) return false;
            // Remove label assignments like "c=alpha"
            if (/=[a-z]+$/.test(eq) && !eq.includes('+') && !eq.includes('-') && !eq.includes('(')) {
                const rhs = parts[1];
                if (['alpha', 'beta', 'gamma', 'delta', 'epsilon', 'theta'].includes(rhs)) return false;
            }
            return true;
        });
};

/**
 * Generate a Wolfram Alpha URL from equations
 */
export const generateWolframUrl = (equations: string[], targets: string[]): string => {
    const cleanedEquations = cleanEquationsForWolfram(equations);
    const text = targets.length > 0 ? 'solve for ' + targets.join(', ')+':' : 'solve';
    const wolframQuery = `${text} {` + cleanedEquations.join(', ')+'}';
    const encodedQuery = encodeURIComponent(wolframQuery);
    return `https://www.wolframalpha.com/input?i=${encodedQuery}`;
};

/**
 * Result type for equation extraction with Wolfram support
 */
export interface EquationExtractionResult {
    equations: string[];
    simplified: string[];
    wolframUrl: string;
    mapping: Map<string, string>;
    reverseMapping: Map<string, string[]>;
}

/**
 * Extract equations and generate Wolfram Alpha URL in one call
 */
export const extractEquationsWithWolfram = (data: SolveDataWithMaps): EquationExtractionResult => {
    const equations = extractEquations(data);
    const { equations: simplified, mapping, reverseMapping } = simplifyEquations(equations, data);
    const targets: string[] = data.angles.filter(angle => angle.target).map(angle => mapping.get(angle.name)).filter(name => name !== undefined);
    const wolframUrl = generateWolframUrl(simplified, targets);
    
    return {
        equations,
        simplified: cleanEquationsForWolfram(simplified),
        wolframUrl,
        mapping,
        reverseMapping
    };
};
