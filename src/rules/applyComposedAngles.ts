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

interface CompositeGroup {
    parent: Angle;
    children: Angle[];
    vertexId: string;
}

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
                    if (children.length >= 2) {
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

export const applyComposedAngles = ({ angles, points, equations }: SolveData, log: LogFn): boolean => {
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
                if (unknownAngleValue <= 0) return;
                unknownChildren[0].value = unknownAngleValue;
                log(unknownChildren[0], `Composed angle: ${parent.name} - known children = ${unknownAngleValue}°`, 'applyComposedAngles');
                changesMade = true;
            } else if (childrenLabel && (knownChildren.length + sameLabelChildren.length) === children.length) {
                const unknownAngleValue = (parentValue - knownSum) / sameLabelChildren.length;
                if (unknownAngleValue <= 0) return;
                sameLabelChildren.forEach(c => {
                    c.value = unknownAngleValue;
                    log(c, `Composed angle: ${c.name} = ${unknownAngleValue}°`, 'applyComposedAngles');
                    changesMade = true;
                });
            } else if (childrenLabel && children.length - sameLabelChildren.length === 1) {

            }
        }
        
        if (!parentValue && unknownChildren.length === 0) {
            const sum = knownChildren.reduce((a, b) => a + b, 0);
            parent.value = sum;
            log(parent, `Composed angle: sum of children = ${sum}°`, 'applyComposedAngles');
            changesMade = true;
        }
    });
    
    return changesMade;
};

