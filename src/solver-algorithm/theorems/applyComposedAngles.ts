import type { Angle, Point, SolveDataWithMaps } from '@/types';
import { getAngleValue } from '@/utils/mathHelper';
import { validateAngleValue } from '@/utils/angleValidation';

type LogFn = (angle: Angle, reason: string, ruleName: string) => void;

interface CompositeGroup {
    parent: Angle;
    children: Angle[];
    vertexId: string;
}

// Validate that a composite relationship is geometrically valid
// The children's calculated values should sum to approximately the parent's calculated value
const isValidComposite = (parent: Angle, children: Angle[], tolerance: number = 15): boolean => {
    if (!parent.calculatedValue) return true; // Can't validate without calculated value
    
    const childrenSum = children.reduce((acc, child) => {
        return acc + (child.calculatedValue ?? 0);
    }, 0);
    
    // The children should sum to approximately the parent's geometric value
    return Math.abs(childrenSum - parent.calculatedValue) <= tolerance;
};

const findCompositeAngles = (angles: Angle[], points: Point[]): CompositeGroup[] => {
    const compositeGroups: CompositeGroup[] = [];
    
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
        
        // Helper: find all ways to decompose the range [start, end] into valid angles
        const findDecompositions = (start: number, end: number): Angle[][] => {
            if (start === end) return [[]]; // base case: empty decomposition
            
            const results: Angle[][] = [];
            // Try each possible "next" ray as the end of the first child angle
            for (let mid = start + 1; mid <= end; mid++) {
                const angle = findAngle(sortedRays[start], sortedRays[mid]);
                if (angle) {
                    // Recursively decompose the rest
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
                const startRay = sortedRays[i];
                const endRay = sortedRays[j];
                
                const parentAngle = findAngle(startRay, endRay);
                if (!parentAngle) continue;
                
                // Find ALL valid decompositions of this parent
                const decompositions = findDecompositions(i, j);
                
                // Add each decomposition with 2+ children (skip single-child which would be parent = child)
                for (const children of decompositions) {
                    if (children.length >= 2 && isValidComposite(parentAngle, children)) {
                        compositeGroups.push({
                            parent: parentAngle,
                            children: children,
                            vertexId: vertexId
                        });
                    }
                }
            }
        }
    });
    
    return compositeGroups;
};

export const applyComposedAngles = (data: SolveDataWithMaps, log: LogFn): boolean => {
    const { angles, points, triangles, lines } = data;
    let changesMade = false;
    const composites = findCompositeAngles(angles, points);
    
    composites.forEach(({ parent, children }) => {
        const parentValue = getAngleValue(parent);
        const childValues = children.map(c => getAngleValue(c));
        const knownChildren = childValues.filter((v): v is number => v !== null);
        const unknownChildren = children.filter(c => !getAngleValue(c));
        const unknownChildrenWithLabel = unknownChildren.filter(c => c.label);
        const childrenLabel = unknownChildrenWithLabel.length > 0 ? unknownChildrenWithLabel[0]?.label : null;
        const sameLabelChildren = unknownChildrenWithLabel.filter(c => childrenLabel && c.label === childrenLabel);

        if (parentValue) {
            const knownSum = knownChildren.reduce((a, b) => a + b, 0);
            if (unknownChildren.length === 1) {
                const unknownAngleValue = parentValue - knownSum;
                // Validate result is in valid range
                if (unknownAngleValue <= 0 || unknownAngleValue > 180) return;
                
                // Validate against all constraints
                const validation = validateAngleValue(unknownChildren[0], unknownAngleValue, {
                    angles, points, triangles, lines
                });
                if (!validation.valid) {
                    // Skip this value - it would violate constraints
                    return;
                }
                
                unknownChildren[0].value = unknownAngleValue;
                log(unknownChildren[0], `Composed angle: ${parent.name} - known children = ${unknownAngleValue}°`, 'applyComposedAngles');
                changesMade = true;
            } else if (childrenLabel && (knownChildren.length + sameLabelChildren.length) === children.length) {
                const unknownAngleValue = (parentValue - knownSum) / sameLabelChildren.length;
                // Validate result is in valid range
                if (unknownAngleValue <= 0 || unknownAngleValue > 180) return;
                
                // Validate all same-label children against constraints
                const allValid = sameLabelChildren.every(c => {
                    const validation = validateAngleValue(c, unknownAngleValue, {
                        angles, points, triangles, lines
                    });
                    return validation.valid;
                });
                if (!allValid) return;
                
                sameLabelChildren.forEach(c => {
                    c.value = unknownAngleValue;
                    log(c, `Composed angle: ${c.name} = ${unknownAngleValue}°`, 'applyComposedAngles');
                    changesMade = true;
                });
            } else if (childrenLabel && children.length - sameLabelChildren.length === 1) {
                // Unfinished case - kept for future implementation
            }
        }
        
        if (!parentValue && unknownChildren.length === 0) {
            const sum = knownChildren.reduce((a, b) => a + b, 0);
            // Validate result is in valid range
            if (sum <= 0 || sum > 180) return;
            
            // Validate against all constraints
            const validation = validateAngleValue(parent, sum, {
                angles, points, triangles, lines
            });
            if (!validation.valid) {
                // Skip this value - it would violate constraints
                return;
            }
            
            parent.value = sum;
            log(parent, `Composed angle: sum of children = ${sum}°`, 'applyComposedAngles');
            changesMade = true;
        }
    });
    
    return changesMade;
};
