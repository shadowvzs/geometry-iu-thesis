import type { SolveDataWithMaps } from '@/utils/solve';
import type { Angle, Point, Line } from '../types';
import {
    pointToAngle,
    getUnsolvedAngles,
    sumOfSolvedAnglesValue,
} from '../utils/mathHelper';

type LogFn = (angle: Angle, reason: string, ruleName: string) => void;

/**
 * Rule: All angles around an intersection point sum to 360°
 * 
 * When a point is in the middle of 2 or more lines (not at endpoints),
 * all angles around that point must sum to 360°.
 * 
 * Example: Point E an intersection between multiple lines [A,E,B] and [C,E,D]
 * Then: ∠AEC + ∠CEB + ∠BED + ∠DEA = 360°
 */
export const applyFullAngleSum = (
    { angleMapsByPointId, lines, points }: SolveDataWithMaps,
    log: LogFn
): boolean => {
    let changesMade = false;

    // Find intersection points: points that are in the MIDDLE of 2+ lines
    const intersectionPoints = findIntersectionPoints(lines);

    if (intersectionPoints.length === 0) {
        return false;
    }

    intersectionPoints.forEach(vertex => {
        const anglesAtVertex = angleMapsByPointId[vertex];
        
        if (!anglesAtVertex || anglesAtVertex.length < 3) {
            // Need at least 3 angles to use this rule meaningfully
            return;
        }

        const vertexPoint = points.find(p => p.id === vertex);
        if (!vertexPoint) return;

        // Get all angles around this vertex that form a complete circle
        const allAnglesAroundVertex = getAllAnglesAroundVertex(
            anglesAtVertex,
            points,
            vertexPoint
        );

        if (allAnglesAroundVertex.length < 3) {
            // Need at least 3 angles to form meaningful equations
            return;
        }

        // Check if we have a complete set of angles (they should cover 360°)
        if (!isCompleteAngleSet(allAnglesAroundVertex, vertex, lines)) {
            return;
        }

        // Validate geometrically - calculated values should sum to ~360°
        const calculatedSum = allAnglesAroundVertex.reduce((sum, a) => 
            sum + (a.calculatedValue ?? 0), 0
        );
        if (Math.abs(calculatedSum - 360) > 20) {
            // Calculated values don't match expected 360°, skip
            return;
        }

        const unsolvedAngles = getUnsolvedAngles(allAnglesAroundVertex);
        
        if (unsolvedAngles.length === 0) {
            // All angles already solved
            return;
        }

        // Calculate sum of known angles
        const knownSum = sumOfSolvedAnglesValue(allAnglesAroundVertex);
        const solvedCount = allAnglesAroundVertex.length - unsolvedAngles.length;

        // If only one angle is unknown, we can solve it directly
        if (unsolvedAngles.length === 1 && solvedCount >= 2) {
            const remaining = 360 - knownSum;
            
            if (remaining > 0 && remaining < 360) {
                unsolvedAngles[0].value = remaining;
                
                const solvedAngleNames = allAnglesAroundVertex
                    .filter(a => a.value !== null && a.value !== undefined)
                    .map(a => `${a.name}=${a.value}°`)
                    .join(', ');
                
                log(
                    unsolvedAngles[0],
                    `Full angle sum at intersection ${vertex}: 360° - (${solvedAngleNames}) = 360° - ${knownSum}° = ${remaining}°`,
                    'applyFullAngleSum'
                );
                changesMade = true;
            }
        }

        // If two angles with same label are unknown, and we know the rest
        if (unsolvedAngles.length === 2 && solvedCount >= 1) {
            const [angle1, angle2] = unsolvedAngles;
            
            // Check if they have the same label
            if (angle1.label && angle1.label === angle2.label) {
                const remaining = 360 - knownSum;
                
                if (remaining > 0) {
                    const value = remaining / 2;
                    angle1.value = value;
                    angle2.value = value;
                    
                    log(
                        angle1,
                        `Full angle sum at intersection ${vertex}: same label angles, (360° - ${knownSum}°) / 2 = ${value}°`,
                        'applyFullAngleSum'
                    );
                    log(
                        angle2,
                        `Same label as ${angle1.name} = ${value}°`,
                        'applyFullAngleSum'
                    );
                    changesMade = true;
                }
            }
        }

        // Handle vertical angles (opposite angles at intersection are equal)
        // If we have 4 rays forming 2 lines, opposite angles are equal
        if (allAnglesAroundVertex.length === 4) {
            // Angles at index 0 and 2 are vertical (opposite)
            // Angles at index 1 and 3 are vertical (opposite)
            const pairs = [
                [allAnglesAroundVertex[0], allAnglesAroundVertex[2]],
                [allAnglesAroundVertex[1], allAnglesAroundVertex[3]]
            ];

            pairs.forEach(([a1, a2]) => {
                if (a1.value !== null && a1.value !== undefined && 
                    (a2.value === null || a2.value === undefined)) {
                    a2.value = a1.value;
                    log(
                        a2,
                        `Vertical angles at intersection ${vertex}: ${a2.name} = ${a1.name} = ${a2.value}°`,
                        'applyFullAngleSum'
                    );
                    changesMade = true;
                } else if (a2.value !== null && a2.value !== undefined && 
                           (a1.value === null || a1.value === undefined)) {
                    a1.value = a2.value;
                    log(
                        a1,
                        `Vertical angles at intersection ${vertex}: ${a1.name} = ${a2.name} = ${a1.value}°`,
                        'applyFullAngleSum'
                    );
                    changesMade = true;
                }
            });
        }
    });

    return changesMade;
};

/**
 * Find points that are in the middle of 2 or more lines
 */
function findIntersectionPoints(lines: Line[]): string[] {
    const pointLineCount = new Map<string, number>();

    lines.forEach(line => {
        // Only count points in the MIDDLE of the line (not first or last)
        for (let i = 1; i < line.points.length - 1; i++) {
            const pointId = line.points[i];
            pointLineCount.set(pointId, (pointLineCount.get(pointId) ?? 0) + 1);
        }
    });

    // Return points that are in the middle of at least 2 lines
    // (1 line = supplementary 180°, 2+ lines = full 360°)
    return Array.from(pointLineCount.entries())
        .filter(([_, count]) => count >= 2)
        .map(([pointId]) => pointId);
}

/**
 * Get all angles around a vertex point, sorted by their angular position
 */
function getAllAnglesAroundVertex(
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

/**
 * Check if the angles form a complete set around the vertex
 * (number of angles equals number of rays, forming a full circle)
 */
function isCompleteAngleSet(
    angles: Angle[],
    vertex: string,
    lines: Line[]
): boolean {
    // Get all rays that should exist at this vertex based on lines
    const expectedRays = new Set<string>();
    
    lines.forEach(line => {
        const vertexIndex = line.points.indexOf(vertex);
        if (vertexIndex === -1) return;
        
        // Add points immediately before and after vertex on this line
        if (vertexIndex > 0) {
            expectedRays.add(line.points[vertexIndex - 1]);
        }
        if (vertexIndex < line.points.length - 1) {
            expectedRays.add(line.points[vertexIndex + 1]);
        }
    });

    // Get all rays from the angles
    const actualRays = new Set<string>();
    angles.forEach(angle => {
        angle.sidepoints.forEach(sp => actualRays.add(sp));
    });

    // Check if we have all expected rays
    for (const ray of expectedRays) {
        if (!actualRays.has(ray)) {
            return false;
        }
    }

    // Check if number of angles equals number of rays (complete circle)
    return angles.length === actualRays.size;
}

export default applyFullAngleSum;
