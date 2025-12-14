import type { Angle, Point, Triangle } from '../types';
import { getAngleValue, getTriangleAngles } from './mathHelper';

export interface ValidationResult {
    valid: boolean;
    violation?: string;
}

export interface ComposedRelationship {
    parent: Angle;
    children: Angle[];
}

/**
 * Find all composed angle relationships at a vertex.
 * Returns relationships where parent = sum of consecutive children.
 * 
 * IMPORTANT: Only returns relationships where the parent's calculatedValue
 * approximately equals the sum of children's calculatedValues. This distinguishes
 * true composed angles from circle angles (which sum to 360°, not to a parent).
 */
export function findComposedRelationships(
    angles: Angle[],
    points: Point[]
): ComposedRelationship[] {
    const relationships: ComposedRelationship[] = [];
    
    // Group angles by vertex
    const anglesByVertex: Record<string, Angle[]> = {};
    angles.forEach(angle => {
        if (!anglesByVertex[angle.pointId]) anglesByVertex[angle.pointId] = [];
        anglesByVertex[angle.pointId].push(angle);
    });
    
    Object.entries(anglesByVertex).forEach(([vertexId, vertexAngles]) => {
        if (vertexAngles.length < 3) return;
        
        const vertex = points.find(p => p.id === vertexId);
        if (!vertex) return;
        
        // Get all rays and sort by angle
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
        
        // Find all parent-children relationships
        for (let i = 0; i < sortedRays.length; i++) {
            for (let j = i + 2; j < sortedRays.length; j++) {
                const parent = findAngle(sortedRays[i], sortedRays[j]);
                if (!parent) continue;
                
                // Find consecutive children
                const children: Angle[] = [];
                let valid = true;
                for (let k = i; k < j; k++) {
                    const child = findAngle(sortedRays[k], sortedRays[k + 1]);
                    if (!child) { valid = false; break; }
                    children.push(child);
                }
                
                if (valid && children.length >= 2) {
                    // Validate geometrically: parent's calculatedValue should match
                    // the sum of children's calculatedValues (within tolerance)
                    // This distinguishes composed angles from circle angles
                    const parentCalc = parent.calculatedValue ?? 0;
                    const childrenCalcSum = children.reduce(
                        (sum, c) => sum + (c.calculatedValue ?? 0), 0
                    );
                    
                    // Only treat as composed if the geometry confirms it
                    // (parent ≈ sum of children, not part of 360° circle)
                    if (Math.abs(parentCalc - childrenCalcSum) <= 15) {
                        relationships.push({ parent, children });
                    }
                }
            }
        }
    });
    
    return relationships;
}

/**
 * Check if setting an angle to a proposed value would violate composed angle constraints.
 */
export function wouldViolateComposedConstraint(
    angle: Angle,
    proposedValue: number,
    angles: Angle[],
    points: Point[],
    tolerance: number = 0.5
): ValidationResult {
    const relationships = findComposedRelationships(angles, points);
    
    for (const { parent, children } of relationships) {
        // Case 1: The angle is the parent
        if (parent.id === angle.id) {
            // Check if all children have values
            const childValues = children.map(c => getAngleValue(c));
            if (childValues.every(v => v !== null)) {
                const childSum = childValues.reduce((a, b) => a! + b!, 0)!;
                if (Math.abs(proposedValue - childSum) > tolerance) {
                    return {
                        valid: false,
                        violation: `Composed constraint: ${parent.name}=${proposedValue} but children sum to ${childSum}`
                    };
                }
            }
        }
        
        // Case 2: The angle is one of the children
        const childIndex = children.findIndex(c => c.id === angle.id);
        if (childIndex !== -1) {
            const parentValue = getAngleValue(parent);
            if (parentValue !== null) {
                // Check if other children have values
                const otherChildValues = children
                    .filter((_, i) => i !== childIndex)
                    .map(c => getAngleValue(c));
                
                if (otherChildValues.every(v => v !== null)) {
                    const otherSum = otherChildValues.reduce((a, b) => a! + b!, 0)!;
                    const expectedValue = parentValue - otherSum;
                    if (Math.abs(proposedValue - expectedValue) > tolerance) {
                        return {
                            valid: false,
                            violation: `Composed constraint: ${angle.name} should be ${expectedValue} (${parent.name}=${parentValue} - others=${otherSum}), not ${proposedValue}`
                        };
                    }
                }
            }
        }
    }
    
    return { valid: true };
}

/**
 * Check if setting an angle to a proposed value would violate triangle sum constraint (180°).
 */
export function wouldViolateTriangleConstraint(
    angle: Angle,
    proposedValue: number,
    triangles: (Triangle | string[])[],
    angles: Angle[],
    tolerance: number = 0.5
): ValidationResult {
    for (const triangleData of triangles) {
        const triangle: Triangle = triangleData instanceof Set 
            ? triangleData 
            : new Set(triangleData);
        
        const triangleAngles = getTriangleAngles(triangle, angles);
        if (triangleAngles.length !== 3) continue;
        
        // Check if this angle is in the triangle
        const angleInTriangle = triangleAngles.find(a => a.id === angle.id);
        if (!angleInTriangle) continue;
        
        // Get values of other angles in triangle
        const otherAngles = triangleAngles.filter(a => a.id !== angle.id);
        const otherValues = otherAngles.map(a => getAngleValue(a));
        
        if (otherValues.every(v => v !== null)) {
            const otherSum = otherValues.reduce((a, b) => a! + b!, 0)!;
            const expectedValue = 180 - otherSum;
            if (Math.abs(proposedValue - expectedValue) > tolerance) {
                return {
                    valid: false,
                    violation: `Triangle constraint: ${angle.name} should be ${expectedValue} (180 - ${otherSum}), not ${proposedValue}`
                };
            }
        }
    }
    
    return { valid: true };
}

/**
 * Check if setting an angle to a proposed value would violate full circle constraint (360°).
 */
export function wouldViolateFullCircleConstraint(
    angle: Angle,
    proposedValue: number,
    angles: Angle[],
    points: Point[],
    tolerance: number = 0.5
): ValidationResult {
    // Group angles by vertex
    const anglesByVertex: Record<string, Angle[]> = {};
    angles.forEach(a => {
        if (!anglesByVertex[a.pointId]) anglesByVertex[a.pointId] = [];
        anglesByVertex[a.pointId].push(a);
    });
    
    const vertexAngles = anglesByVertex[angle.pointId];
    if (!vertexAngles || vertexAngles.length < 3) {
        return { valid: true };
    }
    
    const vertex = points.find(p => p.id === angle.pointId);
    if (!vertex) return { valid: true };
    
    // Get sorted rays
    const allRays = new Set<string>();
    vertexAngles.forEach(a => a.sidepoints.forEach(sp => allRays.add(sp)));
    
    const sortedRays = Array.from(allRays)
        .map(id => {
            const p = points.find(pt => pt.id === id);
            if (!p) return null;
            return { id, angle: Math.atan2(p.y - vertex.y, p.x - vertex.x) };
        })
        .filter((r): r is { id: string; angle: number } => r !== null)
        .sort((a, b) => a.angle - b.angle)
        .map(r => r.id);
    
    // Build consecutive angles
    const circleAngles: Angle[] = [];
    for (let i = 0; i < sortedRays.length; i++) {
        const ray1 = sortedRays[i];
        const ray2 = sortedRays[(i + 1) % sortedRays.length];
        const a = vertexAngles.find(ang =>
            ang.sidepoints.includes(ray1) && ang.sidepoints.includes(ray2)
        );
        if (a) circleAngles.push(a);
    }
    
    // Not a complete circle
    if (circleAngles.length !== allRays.size) {
        return { valid: true };
    }
    
    // Check if calculated values form a 360° circle
    const calcSum = circleAngles.reduce((s, a) => s + (a.calculatedValue ?? 0), 0);
    if (Math.abs(calcSum - 360) > 30) {
        return { valid: true }; // Not a valid 360° configuration
    }
    
    // Check if this angle is in the circle
    const angleInCircle = circleAngles.find(a => a.id === angle.id);
    if (!angleInCircle) return { valid: true };
    
    // Get values of other angles
    const otherAngles = circleAngles.filter(a => a.id !== angle.id);
    const otherValues = otherAngles.map(a => getAngleValue(a));
    
    if (otherValues.every(v => v !== null)) {
        const otherSum = otherValues.reduce((a, b) => a! + b!, 0)!;
        const expectedValue = 360 - otherSum;
        if (Math.abs(proposedValue - expectedValue) > tolerance) {
            return {
                valid: false,
                violation: `Full circle constraint: ${angle.name} should be ${expectedValue} (360 - ${otherSum}), not ${proposedValue}`
            };
        }
    }
    
    return { valid: true };
}

/**
 * Check if setting an angle to a proposed value would violate supplementary constraint (180°).
 */
export function wouldViolateSupplementaryConstraint(
    angle: Angle,
    proposedValue: number,
    supplementaryGroups: { angles: Angle[]; sumTo: number }[],
    tolerance: number = 0.5
): ValidationResult {
    for (const group of supplementaryGroups) {
        const angleInGroup = group.angles.find(a => a.id === angle.id);
        if (!angleInGroup) continue;
        
        const otherAngles = group.angles.filter(a => a.id !== angle.id);
        const otherValues = otherAngles.map(a => getAngleValue(a));
        
        if (otherValues.every(v => v !== null)) {
            const otherSum = otherValues.reduce((a, b) => a! + b!, 0)!;
            const expectedValue = group.sumTo - otherSum;
            if (Math.abs(proposedValue - expectedValue) > tolerance) {
                return {
                    valid: false,
                    violation: `Supplementary constraint: ${angle.name} should be ${expectedValue} (${group.sumTo} - ${otherSum}), not ${proposedValue}`
                };
            }
        }
    }
    
    return { valid: true };
}

/**
 * Comprehensive validation: check all constraints.
 */
export function validateAngleValue(
    angle: Angle,
    proposedValue: number,
    data: {
        angles: Angle[];
        points: Point[];
        triangles: (Triangle | string[])[];
        supplementaryGroups?: { angles: Angle[]; sumTo: number }[];
    }
): ValidationResult {
    // Check composed angle constraint
    const composedResult = wouldViolateComposedConstraint(
        angle, proposedValue, data.angles, data.points
    );
    if (!composedResult.valid) return composedResult;
    
    // Check triangle constraint
    const triangleResult = wouldViolateTriangleConstraint(
        angle, proposedValue, data.triangles, data.angles
    );
    if (!triangleResult.valid) return triangleResult;
    
    // Check full circle constraint
    const fullCircleResult = wouldViolateFullCircleConstraint(
        angle, proposedValue, data.angles, data.points
    );
    if (!fullCircleResult.valid) return fullCircleResult;
    
    // Check supplementary constraint if provided
    if (data.supplementaryGroups) {
        const suppResult = wouldViolateSupplementaryConstraint(
            angle, proposedValue, data.supplementaryGroups
        );
        if (!suppResult.valid) return suppResult;
    }
    
    return { valid: true };
}

