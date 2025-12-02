import { getAngleValue } from '../utils/mathHelper.mjs';

/**
 * Find composite angle relationships at each vertex
 * Returns groups where a parent angle = sum of child angles
 * 
 * Example output:
 * [{
 *   parent: angleADC,
 *   children: [angleADB, angleBDC]
 * }, ...]
 */
const findCompositeAngles = (angles, points) => {
    const compositeGroups = [];
    
    // Group angles by vertex
    const anglesByVertex = angles.reduce((map, angle) => {
        if (!map[angle.pointId]) map[angle.pointId] = [];
        map[angle.pointId].push(angle);
        return map;
    }, {});
    
    Object.entries(anglesByVertex).forEach(([vertexId, vertexAngles]) => {
        if (vertexAngles.length < 2) return;
        
        const vertex = points.find(p => p.id === vertexId);
        if (!vertex) return;
        
        // Get all ray endpoints from angles at this vertex
        const rayPoints = [...new Set(vertexAngles.flatMap(a => a.sidepoints))];
        
        // Sort rays by angle (counterclockwise order)
        const sortedRays = rayPoints
            .map(id => {
                const pt = points.find(p => p.id === id);
                return pt ? { id, angle: Math.atan2(pt.y - vertex.y, pt.x - vertex.x) } : null;
            })
            .filter(Boolean)
            .sort((a, b) => a.angle - b.angle)
            .map(r => r.id);
        
        // Find angle object for a pair of rays
        const findAngle = (ray1, ray2) => {
            return vertexAngles.find(a => 
                a.sidepoints.includes(ray1) && a.sidepoints.includes(ray2)
            );
        };
        
        // For each pair of non-adjacent rays, find if there's a composite relationship
        for (let i = 0; i < sortedRays.length; i++) {
            for (let j = i + 2; j < sortedRays.length; j++) {
                const startRay = sortedRays[i];
                const endRay = sortedRays[j];
                
                // Find the parent angle (if exists)
                const parentAngle = findAngle(startRay, endRay);
                if (!parentAngle) continue;
                
                // Find all child angles between startRay and endRay
                const children = [];
                for (let k = i; k < j; k++) {
                    const childAngle = findAngle(sortedRays[k], sortedRays[k + 1]);
                    if (childAngle) {
                        children.push(childAngle);
                    }
                }
                
                // Only valid if we have all consecutive children
                if (children.length === j - i) {
                    compositeGroups.push({
                        parent: parentAngle,
                        children: children,
                        vertexId: vertexId
                    });
                }
            }
        }
    });
    
    return compositeGroups;
};

export const applyComposedAngles = ({ angles, points }, log) => {
    let changesMade = false;
    const composites = findCompositeAngles(angles, points);
    
    composites.forEach(({ parent, children }) => {
        const parentValue = getAngleValue(parent);
        const childValues = children.map(c => getAngleValue(c));
        const knownChildren = childValues.filter(v => v);
        const unknownChildren = children.filter(c => !getAngleValue(c));
        const unknownChildrenWithLabel = unknownChildren.filter(c => c.label);
        const childrenLabel = unknownChildrenWithLabel.length > 0 ? unknownChildrenWithLabel[0]?.label : null;
        const sameLabelChildren = unknownChildrenWithLabel.filter(c => childrenLabel && c.label === childrenLabel);

        // If parent known and all but one child known, solve the unknown child
        if (parentValue) {
            // most simple case if there is only one unknown child then we can solve it directly
            const knownSum = knownChildren.reduce((a, b) => a + b, 0);
            if (unknownChildren.length === 1) {
                const unknownAngleValue = parentValue - knownSum;
                if (unknownAngleValue <= 0) return; // invalid angle value
                unknownChildren[0].value = unknownAngleValue;
                log(unknownChildren[0], `Composed angle: ${parent.name} - known children = ${unknownAngleValue}°`, 'applyComposedAngles');
                changesMade = true;
            // can be calculated directly if all the unknown children have the same label
            } else if (childrenLabel && (knownChildren.length + sameLabelChildren.length) === children.length) {
                const unknownAngleValue = (parentValue - knownSum) / sameLabelChildren.length;
                if (unknownAngleValue <= 0) return; // invalid angle value
                sameLabelChildren.forEach(c => {
                    c.value = unknownAngleValue;
                    log(c, `Composed angle: ${c.name} = ${unknownAngleValue}°`, 'applyComposedAngles');
                    changesMade = true;
                });
            }
        }
        
        // If all children known but parent unknown, solve parent
        if (!parentValue && unknownChildren.length === 0) {
            const sum = childValues.reduce((a, b) => a + b, 0);
            parent.value = sum;
            log(parent, `Composed angle: sum of children = ${sum}°`, 'applyComposedAngles');
            changesMade = true;
        }
    });
    
    return changesMade;
};