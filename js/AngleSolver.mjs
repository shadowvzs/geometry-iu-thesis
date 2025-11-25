import { debugLogger } from './DebugLogger.mjs';
import { 
    arePointsCollinear, 
    truncateString, 
    hasValuePattern, 
    doAnglesShareEdge, 
    getAngleValue 
} from './utils/mathHelper.mjs';

/**
 * AngleSolver - Calculates unknown angles using geometric theorems
 * Uses only topology (edges, adjacency, circles) and known angle values
 * NO coordinate-based calculations
 */
export class AngleSolver {
    // Constants for geometric calculations
    static CONSTANTS = {
        MAX_ANGLE: 360,
        STRAIGHT_ANGLE: 180,
        RIGHT_ANGLE: 90,
        TOLERANCE: 0.5,
        MAX_SOLVER_ITERATIONS: 100,
        REASON_MAX_LENGTH: 35
    };
    
    static VERSION = '2.9.0-NEW-THEOREMS';
    
    constructor(messagingHub) {
        this.messagingHub = messagingHub;
        this.adjacentPoints = null;
        this.circles = null;
        this.edges = null;
        this.points = null;
        this.lines = null;
        this.pointsMap = null;
        this.angles = null;
        this.triangles = null;
        this.solvingHistory = [];
        
        // Performance indices (built in updateData)
        this.anglesByPoint = new Map();
        this.triangleIndex = new Map();
        
        // Subscribe to solve request
        this.messagingHub.subscribe('angle:solveRequested', (data) => {
            this.updateData(data);
            this.solveAngles();
        });
    }
    
    updateData = (data) => {
        this.adjacentPoints = data.adjacentPoints;
        this.circles = data.circles;
        this.edges = data.edges;
        this.points = data.points;
        this.lines = data.lines;
        this.pointsMap = data.pointsMap;
        this.angles = data.angles;
        this.triangles = data.triangles;
        
        // Mark angles with explicit constraints (user-defined values that should not be overwritten)
        this.angles.forEach(angle => {
            if (angle.value && angle.value !== '?' && angle.value !== null) {
                const numValue = parseFloat(angle.value);
                if (!isNaN(numValue)) {
                    angle.constraintValue = numValue;
                    console.log(`🔒 Locked constraint: ${angle.name} = ${numValue}°`);
                }
            }
        });
        
        // Build performance indices
        this.buildAngleIndex();
        this.buildTriangleIndex();
    }
    
    /**
     * Main solving method - applies all geometric theorems iteratively
     */
    solveAngles = () => {
        try {
            // Start performance benchmark
            const startTime = performance.now();
            
            // Clear solving history for new solving session
            this.solvingHistory = [];
            
            debugLogger.log('AngleSolver.solveAngles', { 
                version: AngleSolver.VERSION,
                totalAngles: this.angles.length,
                unknownAngles: this.angles.filter(a => !a.value || a.value === '?').length
            });
            
            let changesMade = true;
            let iterations = 0;
            
            while (changesMade && iterations < AngleSolver.CONSTANTS.MAX_SOLVER_ITERATIONS) {
                changesMade = false;
                iterations++;
                
                // Check if all angles are solved
                const unsolvedAngles = this.angles.filter(a => !a.value || a.value === '?').length;
                if (unsolvedAngles === 0) {
                    console.log(`✅ All angles solved after ${iterations} iterations`);
                    break;
                }
                
                // Check if all triangles are valid (sum = 180°)
                if (this.areAllTrianglesValid()) {
                    console.log(`✅ All triangles valid (sum=180°) after ${iterations} iterations`);
                    break;
                }
                
                // Apply each theorem in priority order
                // High priority: direct relationships
                changesMade = this.applyAngleSubdivision() || changesMade;
                changesMade = this.applySameLabelAngles() || changesMade;
                changesMade = this.applySupplementaryAngles() || changesMade;
                changesMade = this.applyLinearPairs() || changesMade;
                changesMade = this.applyLinearAngleDivision() || changesMade;
                changesMade = this.applyVerticalAngles() || changesMade;
                changesMade = this.applyComplementaryAngles() || changesMade;
                
                // Medium priority: basic geometric theorems
                changesMade = this.applyTriangleAngleSum() || changesMade;
                changesMade = this.applyAngleAddition() || changesMade;
                
                // Lower priority: more complex theorems that might conflict
                changesMade = this.applyIsoscelesTriangles() || changesMade;
                changesMade = this.applyIsoscelesAngleBisectorPerpendicular() || changesMade;
                changesMade = this.applyRightAngleBisector() || changesMade;
                changesMade = this.applyEquilateralTriangle() || changesMade;
                changesMade = this.applyInscribedAngle() || changesMade;
                changesMade = this.applyCircleRadiusAngles() || changesMade;
                changesMade = this.applyCollinearPointAngles() || changesMade;
            }
            
            // Final validation
            if (iterations >= AngleSolver.CONSTANTS.MAX_SOLVER_ITERATIONS) {
                console.warn(`⚠️  Reached max iterations (${iterations}). Solver may be in infinite loop.`);
            }
            this.validateAllTriangles();
            
            const solved = this.angles.filter(a => a.value && a.value !== '?').length;
            
            // End performance benchmark
            const endTime = performance.now();
            const executionTime = endTime - startTime;
            
            // Log summary to debug panel
            debugLogger.log('AngleSolver.solve', { 
                iterations,
                angles: `${solved}/${this.angles.length}`,
                calculations: this.solvingHistory.length,
                time: `${executionTime.toFixed(2)}ms`
            });
            
            // Log each angle calculation to debug panel
            this.solvingHistory.forEach((entry, index) => {
                debugLogger.log(`  └─ ${entry.theorem}`, {
                    angle: entry.angleName,
                    value: entry.value,
                    reason: truncateString(entry.reason, AngleSolver.CONSTANTS.REASON_MAX_LENGTH)
                });
            });
            
            // Emit results with solving history and performance data
            this.messagingHub.emit('angle:solveCompleted', {
                iterations,
                changesMade: solved,
                solvingHistory: this.solvingHistory,
                executionTimeMs: executionTime
            });
        } catch (error) {
            debugLogger.log('AngleSolver.error', {
                message: error.message,
                stack: error.stack
            });
            this.messagingHub.emit('angle:solveFailed', { error: error.message });
        }
    }
    
    /**
     * Validates if the current geometry problem can be solved
     * Returns true/false without modifying the original data
     * This method creates a copy of angles and attempts to solve them
     */
    canBeSolved = () => {
        try {
            // Create a deep copy of angles to avoid modifying originals
            const originalAngles = this.angles;
            this.angles = originalAngles.map(angle => ({...angle}));
            
            // Store original solving history
            const originalHistory = this.solvingHistory;
            this.solvingHistory = [];
            
            let changesMade = true;
            let iterations = 0;
            
            // Run solver silently
            while (changesMade && iterations < AngleSolver.CONSTANTS.MAX_SOLVER_ITERATIONS) {
                changesMade = false;
                iterations++;
                
                // Check if all angles are solved
                const unsolvedAngles = this.angles.filter(a => !a.value || a.value === '?').length;
                if (unsolvedAngles === 0) {
                    break;
                }
                
                // Check if all triangles are valid
                if (this.areAllTrianglesValid()) {
                    break;
                }
                
                // Apply theorems
                changesMade = this.applyAngleSubdivision() || changesMade;
                changesMade = this.applySameLabelAngles() || changesMade;
                changesMade = this.applySupplementaryAngles() || changesMade;
                changesMade = this.applyLinearPairs() || changesMade;
                changesMade = this.applyLinearAngleDivision() || changesMade;
                changesMade = this.applyVerticalAngles() || changesMade;
                changesMade = this.applyComplementaryAngles() || changesMade;
                changesMade = this.applyTriangleAngleSum() || changesMade;
                changesMade = this.applyAngleAddition() || changesMade;
                changesMade = this.applyIsoscelesTriangles() || changesMade;
                changesMade = this.applyCircleRadiusAngles() || changesMade;
                changesMade = this.applyCollinearPointAngles() || changesMade;
            }
            
            // Count results
            const solvedAngles = this.angles.filter(a => a.value && a.value !== '?').length;
            const totalAngles = this.angles.length;
            const allSolved = solvedAngles === totalAngles;
            
            // Check for contradictions in triangles
            let hasContradictions = false;
            let contradictionDetails = [];
            
            for (const triangle of this.triangles || []) {
                const angle1 = this.findAngleInTriangle(triangle[0], triangle[1], triangle[2]);
                const angle2 = this.findAngleInTriangle(triangle[1], triangle[0], triangle[2]);
                const angle3 = this.findAngleInTriangle(triangle[2], triangle[0], triangle[1]);
                
                if (angle1 && angle2 && angle3) {
                    const value1 = getAngleValue(angle1);
                    const value2 = getAngleValue(angle2);
                    const value3 = getAngleValue(angle3);
                    
                    if (value1 !== null && value2 !== null && value3 !== null) {
                        const sum = value1 + value2 + value3;
                        const diff = Math.abs(sum - 180);
                        
                        if (diff > AngleSolver.CONSTANTS.TOLERANCE) {
                            hasContradictions = true;
                            contradictionDetails.push(
                                `△${triangle.join('')}: ${sum.toFixed(1)}° ≠ 180°`
                            );
                        }
                    }
                }
            }
            
            // Restore original state
            this.angles = originalAngles;
            this.solvingHistory = originalHistory;
            
            // Determine result
            const solvable = allSolved && !hasContradictions;
            
            let reason = '';
            if (hasContradictions) {
                reason = 'Contradictions found: ' + contradictionDetails.join('; ');
            } else if (!allSolved) {
                reason = `${totalAngles - solvedAngles} unsolved angle(s)`;
            } else {
                reason = 'All angles solved, no contradictions';
            }
            
            return {
                solvable,
                reason,
                details: {
                    iterations,
                    solvedAngles,
                    totalAngles,
                    hasContradictions,
                    contradictions: contradictionDetails
                }
            };
            
        } catch (error) {
            // Restore original state on error
            return {
                solvable: false,
                reason: `Error during validation: ${error.message}`,
                details: { error: error.message }
            };
        }
    }
    
    /**
     * Theorem: Angles with the same label have the same value
     * Used for bisected angles or any manually labeled angles
     */
    applySameLabelAngles = () => {
        let changesMade = false;
        
        // Group angles by their label
        const anglesByLabel = new Map();
        
        this.angles.forEach(angle => {
            if (angle.label && angle.label.trim() !== '') {
                const label = angle.label.trim();
                if (!anglesByLabel.has(label)) {
                    anglesByLabel.set(label, []);
                }
                anglesByLabel.get(label).push(angle);
            }
        });
        
        // For each group of angles with the same label
        anglesByLabel.forEach((angles, label) => {
            if (angles.length < 2) return; // Need at least 2 angles with same label
            
            // Find if any angle in this group has a value
            // Priority: angles with constraintValue > angles with regular values
            const constrainedAngle = angles.find(a => a.constraintValue !== undefined && a.constraintValue !== null);
            const knownAngle = constrainedAngle || angles.find(a => getAngleValue(a) !== null);
            
            if (knownAngle) {
                const knownValue = getAngleValue(knownAngle);
                
                // ENFORCE: Set ALL angles with this label to the same value
                // This includes both unknown angles AND angles with different values
                angles.forEach(angle => {
                    const currentValue = getAngleValue(angle);
                    
                    // Skip if it's the source angle
                    if (angle === knownAngle) return;
                    
                    // If angle has no value OR has a different value, update it
                    if (currentValue === null || Math.abs(currentValue - knownValue) > AngleSolver.CONSTANTS.TOLERANCE) {
                        this.setAngleValue(
                            angle,
                            knownValue,
                            `Same label '${label}' as ${knownAngle.name || knownAngle.id}`,
                            'Same Label'
                        );
                        changesMade = true;
                    }
                });
            }
        });
        
        return changesMade;
    }
    
    /**
     * Theorem: Angle Subdivision (Unified)
     * Handles two cases:
     * 1. Pure subdivision: All sub-angles have the same label → divide total evenly
     * 2. Mixed subdivision: Some sub-angles labeled, some known → subtract known, divide remainder
     */
    applyAngleSubdivision = () => {
        let changesMade = false;
        
        // For each vertex, find groups of adjacent angles
        this.adjacentPoints.forEach((neighbors, vertex) => {
            const anglesAtVertex = this.getAnglesAtPoint(vertex);
            if (anglesAtVertex.length < 2) return;
            
            // Look for a large angle that encompasses multiple sub-angles
            for (const largeAngle of anglesAtVertex) {
                const largeValue = getAngleValue(largeAngle);
                if (largeValue === null || !largeAngle.neighborPoints || largeAngle.neighborPoints.length !== 2) continue;
                
                const [ray1, ray2] = largeAngle.neighborPoints;
                
                // Find all angles that fit within this large angle
                const subAnglesInside = [];
                
                // Helper to check if a ray is between two extreme rays using line order
                const isRayBetween = (ray, extremeRay1, extremeRay2) => {
                    if (ray === extremeRay1 || ray === extremeRay2) return false;
                    
                    // Check all lines
                    for (const line of this.lines) {
                        if (!line.includes(extremeRay1) || !line.includes(extremeRay2) || !line.includes(ray)) continue;
                        
                        const e1Idx = line.indexOf(extremeRay1);
                        const e2Idx = line.indexOf(extremeRay2);
                        const rIdx = line.indexOf(ray);
                        
                        // The ray must be between the two extreme rays on the line
                        const min = Math.min(e1Idx, e2Idx);
                        const max = Math.max(e1Idx, e2Idx);
                        return rIdx > min && rIdx < max;
                    }
                    return false;
                };
                
                for (const angle of anglesAtVertex) {
                    if (angle === largeAngle) continue;
                    if (!angle.neighborPoints || angle.neighborPoints.length !== 2) continue;
                    
                    const [a1, a2] = angle.neighborPoints;
                    const hasRay1 = a1 === ray1 || a2 === ray1;
                    const hasRay2 = a1 === ray2 || a2 === ray2;
                    
                    // Case 1: Boundary angle (shares one extreme ray)
                    if (hasRay1 || hasRay2) {
                        const sharedRay = hasRay1 ? ray1 : ray2;
                        const otherExtreme = hasRay1 ? ray2 : ray1;
                        const otherRay = hasRay1 ? (a1 === ray1 ? a2 : a1) : (a1 === ray2 ? a2 : a1);
                        
                        if (otherRay !== ray1 && otherRay !== ray2) {
                            // Check if all three are on a collinear line
                            let onCollinearLine = false;
                            let isInside = true;
                            
                            for (const line of this.lines) {
                                if (line.includes(sharedRay) && line.includes(otherExtreme) && line.includes(otherRay)) {
                                    onCollinearLine = true;
                                    const sharedIdx = line.indexOf(sharedRay);
                                    const extremeIdx = line.indexOf(otherExtreme);
                                    const otherIdx = line.indexOf(otherRay);
                                    
                                    // For otherRay to be "inside", it must be between sharedRay and otherExtreme on the line
                                    // Check if otherIdx is strictly between sharedIdx and extremeIdx (exclusive)
                                    const minIdx = Math.min(sharedIdx, extremeIdx);
                                    const maxIdx = Math.max(sharedIdx, extremeIdx);
                                    
                                    // otherIdx must be strictly between min and max (not equal to either)
                                    if (otherIdx > minIdx && otherIdx < maxIdx) {
                                        isInside = true;
                                    } else {
                                        isInside = false;
                                    }
                                    break;
                                }
                            }
                            
                            // Add if NOT on a collinear line OR if on line and inside
                            if (!onCollinearLine || isInside) {
                                subAnglesInside.push(angle);
                            }
                        }
                    }
                    // Case 2: Internal angle (both rays between extremes)
                    else if (isRayBetween(a1, ray1, ray2) && isRayBetween(a2, ray1, ray2)) {
                        subAnglesInside.push(angle);
                    }
                }
                
                if (subAnglesInside.length === 0) continue;
                
                console.log(`  🔍 Found ${subAnglesInside.length} sub-angles inside ${largeAngle.name}:`, subAnglesInside.map(a => `${a.name} (label="${a.label}", value=${getAngleValue(a)})`));
                
                // Categorize sub-angles: labeled (unknown) vs known
                const labeledAngles = subAnglesInside.filter(a => a.label && a.label.trim() !== '' && getAngleValue(a) === null);
                const knownAngles = subAnglesInside.filter(a => getAngleValue(a) !== null && (!a.label || a.label.trim() === ''));
                
                console.log(`  📋 Categorized: ${labeledAngles.length} labeled (unknown), ${knownAngles.length} known (no label)`);
                
                if (labeledAngles.length === 0) continue; // No labeled angles to solve
                
                // Check if all labeled angles have the same label
                const labels = labeledAngles.map(a => a.label.trim());
                const allSameLabel = labels.every(l => l === labels[0]);
                if (!allSameLabel) continue; // Mixed labels not supported
                
                const label = labels[0];
                
                // Calculate how much angle to distribute
                const knownSum = knownAngles.reduce((sum, a) => sum + getAngleValue(a), 0);
                const remainingAngle = largeValue - knownSum;
                
                if (remainingAngle <= 0) continue;
                
                // Distribute evenly among labeled angles
                const labeledAngleValue = remainingAngle / labeledAngles.length;
                
                if (labeledAngleValue > 0 && labeledAngleValue < AngleSolver.CONSTANTS.STRAIGHT_ANGLE) {
                    if (knownAngles.length === 0) {
                        // Pure subdivision case
                        console.log(`  📊 Pure subdivision: ${largeAngle.name} (${largeValue}°) / ${labeledAngles.length} angles with label '${label}' = ${labeledAngleValue}° each`);
                    } else {
                        // Mixed subdivision case
                        console.log(`  🎯 Mixed subdivision: ${largeAngle.name} (${largeValue}°) - known (${knownSum}°) = ${remainingAngle}° / ${labeledAngles.length} angles with label '${label}' = ${labeledAngleValue}° each`);
                    }
                    
                    labeledAngles.forEach(angle => {
                        const reason = knownAngles.length === 0 
                            ? `Subdivision: ${largeValue}° / ${labeledAngles.length} = ${labeledAngleValue}°`
                            : `Mixed subdivision: (${largeValue}° - ${knownSum}°) / ${labeledAngles.length} = ${labeledAngleValue}°`;
                        
                        this.setAngleValue(angle, labeledAngleValue, reason, 'Angle Subdivision');
                        angle.isSubdivisionResult = true;
                        changesMade = true;
                    });
                }
            }
        });
        
        return changesMade;
    }
    
    /**
     * Theorem: Supplementary angles sum to 180°
     */
    applySupplementaryAngles = () => {
        let changesMade = false;
        
        for (let i = 0; i < this.angles.length; i++) {
            const angle1 = this.angles[i];
            
            // Skip if no neighbors
            if (!angle1.neighborPoints || angle1.neighborPoints.length !== 2) continue;
            
            for (let j = i + 1; j < this.angles.length; j++) {
                const angle2 = this.angles[j];
                
                // Quick check: must have same vertex
                if (angle1.point !== angle2.point) continue;
                if (!angle2.neighborPoints || angle2.neighborPoints.length !== 2) continue;
                
                // First check if they're overlapping angles (should be equal, not supplementary)
                if (this.areAnglesOverlapping(angle1, angle2)) {
                    const value1 = getAngleValue(angle1);
                    const value2 = getAngleValue(angle2);
                    
                    // Make them equal
                    if (value1 !== null && value2 === null) {
                        this.setAngleValue(angle2, value1, `Overlapping with ${angle1.name || 'angle'} (collinear points)`, 'Overlapping Angles');
                        changesMade = true;
                    } else if (value2 !== null && value1 === null) {
                        this.setAngleValue(angle1, value2, `Overlapping with ${angle2.name || 'angle'} (collinear points)`, 'Overlapping Angles');
                        changesMade = true;
                    }
                    continue; // Skip supplementary check
                }
                
                // Check if they form a linear pair (supplementary)
                if (!this.areAnglesLinearPair(angle1, angle2)) continue;
                
                const value1 = getAngleValue(angle1);
                const value2 = getAngleValue(angle2);
                
                // If one is known and other is unknown
                if (value1 !== null && value2 === null) {
                    const newValue = AngleSolver.CONSTANTS.STRAIGHT_ANGLE - value1;
                    this.setAngleValue(angle2, newValue, `Supplementary to ${angle1.name || 'angle'}`, 'Supplementary Angles');
                    changesMade = true;
                } else if (value2 !== null && value1 === null) {
                    const newValue = AngleSolver.CONSTANTS.STRAIGHT_ANGLE - value2;
                    this.setAngleValue(angle1, newValue, `Supplementary to ${angle2.name || 'angle'}`, 'Supplementary Angles');
                    changesMade = true;
                } else if (value1 !== null && value2 !== null) {
                    // Both known - validate and correct if needed
                    const sum = value1 + value2;
                    if (Math.abs(sum - AngleSolver.CONSTANTS.STRAIGHT_ANGLE) > AngleSolver.CONSTANTS.TOLERANCE) {
                        // They should be supplementary but aren't - correct it
                        const correctedValue2 = AngleSolver.CONSTANTS.STRAIGHT_ANGLE - value1;
                        this.setAngleValue(angle2, correctedValue2, `Corrected to be supplementary to ${angle1.name || angle1.id} (was ${value2}°)`, 'Supplementary Angles');
                        changesMade = true;
                    }
                }
            }
        }
        
        return changesMade;
    }
    
    /**
     * Theorem: Complementary angles sum to 90°
     */
    applyComplementaryAngles = () => {
        let changesMade = false;
        
        for (let i = 0; i < this.angles.length; i++) {
            for (let j = i + 1; j < this.angles.length; j++) {
                const angle1 = this.angles[i];
                const angle2 = this.angles[j];
                
                // Check if they share a vertex and edge (adjacent)
                if (!doAnglesShareEdge(angle1, angle2)) continue;
                
                const value1 = getAngleValue(angle1);
                const value2 = getAngleValue(angle2);
                
                // If both are known and sum to 90, they're complementary (validation)
                // No action needed, just validation
            }
        }
        
        return changesMade;
    }
    
    /**
     * Theorem: Triangle angle sum = 180°
     */
    applyTriangleAngleSum = () => {
        let changesMade = false;
        
        this.triangles.forEach(triangle => {
            const pointIds = Array.from(triangle);
            
            // Find all angles at each vertex of the triangle
            const triangleAngles = [];
            
            pointIds.forEach(pointId => {
                // Find angle at this vertex that uses the other two points
                const otherPoints = pointIds.filter(p => p !== pointId);
                
                const angle = this.angles.find(a => 
                    a.point === pointId &&
                    a.neighborPoints &&
                    a.neighborPoints.includes(otherPoints[0]) &&
                    a.neighborPoints.includes(otherPoints[1])
                );
                
                if (angle) {
                    triangleAngles.push(angle);
                }
            });
            
            if (triangleAngles.length !== 3) {
                return; // Need all 3 angles
            }
            
            const values = triangleAngles.map(a => getAngleValue(a));
            const knownCount = values.filter(v => v !== null).length;
            
            if (knownCount === 2) {
                // Find the unknown angle
                const unknownIndex = values.findIndex(v => v === null);
                const knownSum = values.reduce((sum, v) => sum + (v || 0), 0);
                const unknownValue = AngleSolver.CONSTANTS.STRAIGHT_ANGLE - knownSum;
                
                if (unknownValue > 0 && unknownValue < AngleSolver.CONSTANTS.STRAIGHT_ANGLE) {
                    this.setAngleValue(
                        triangleAngles[unknownIndex], 
                        unknownValue,
                        `Triangle angle sum (${AngleSolver.CONSTANTS.STRAIGHT_ANGLE}° - ${knownSum}°)`,
                        'Triangle Angle Sum'
                    );
                    changesMade = true;
                }
            }
        });
        
        return changesMade;
    }
    
    /**
     * Theorem: Linear pairs (angles on a straight line) sum to 180°
     */
    applyLinearPairs = () => {
        let changesMade = false;
        
        // Find all points that lie on a straight line
        this.lines.forEach(line => {
            if (line.length < 3) return; // Need at least 3 points for a linear pair
            
            // Check middle points (not endpoints)
            for (let i = 1; i < line.length - 1; i++) {
                const middlePoint = line[i];
                
                // Find all angles at this middle point (using index for O(1) lookup)
                const anglesAtPoint = this.getAnglesAtPoint(middlePoint);
                
                // Check pairs of angles that form linear pairs
                for (let j = 0; j < anglesAtPoint.length; j++) {
                    for (let k = j + 1; k < anglesAtPoint.length; k++) {
                        const angle1 = anglesAtPoint[j];
                        const angle2 = anglesAtPoint[k];
                        
                        if (this.areAnglesLinearPair(angle1, angle2)) {
                            const value1 = getAngleValue(angle1);
                            const value2 = getAngleValue(angle2);
                            
                            if (value1 !== null && value2 === null) {
                                this.setAngleValue(angle2, AngleSolver.CONSTANTS.STRAIGHT_ANGLE - value1, `Linear pair with ${angle1.name || 'angle'}`, 'Linear Pair');
                                changesMade = true;
                            } else if (value2 !== null && value1 === null) {
                                this.setAngleValue(angle1, AngleSolver.CONSTANTS.STRAIGHT_ANGLE - value2, `Linear pair with ${angle2.name || 'angle'}`, 'Linear Pair');
                                changesMade = true;
                            }
                        }
                    }
                }
            }
        });
        
        return changesMade;
    }
    
    /**
     * Theorem: Linear Angle Division with Labels
     * When multiple edges intersect a line at a point, angles on one side sum to 180°
     * If angles share labels, they must be equal and can be calculated by division
     */
    applyLinearAngleDivision = () => {
        let changesMade = false;
        
        // For each line, check each point on the line
        this.lines.forEach(line => {
            if (line.length < 2) return;
            
            line.forEach(pointId => {
                // Find all angles at this point (using index for O(1) lookup)
                const anglesAtPoint = this.getAnglesAtPoint(pointId);
                if (anglesAtPoint.length < 2) return;
                
                // Find neighbors on the line
                const neighborsOnLine = this.adjacentPoints.get(pointId);
                if (!neighborsOnLine) return;
                
                const lineNeighbors = [...neighborsOnLine].filter(n => line.includes(n));
                if (lineNeighbors.length < 2) return;
                
                // For each consecutive pair of line neighbors, find angles between them
                for (let i = 0; i < lineNeighbors.length - 1; i++) {
                    const lineNeighbor1 = lineNeighbors[i];
                    const lineNeighbor2 = lineNeighbors[i + 1];
                    
                    // Find all angles that span between these two line neighbors
                    // These angles should sum to 180°
                    const anglesBetween = this.findAnglesInSector(
                        anglesAtPoint,
                        pointId,
                        lineNeighbor1,
                        lineNeighbor2
                    );
                    
                    if (anglesBetween.length >= 2) {
                        // Get values and labels
                        const angleData = anglesBetween.map(a => ({
                            angle: a,
                            value: getAngleValue(a),
                            label: (a.label && a.label.trim()) || null
                        }));
                        
                        const knownAngles = angleData.filter(d => d.value !== null);
                        const unknownAngles = angleData.filter(d => d.value === null);
                        
                        if (unknownAngles.length === 0) return; // All known, nothing to solve
                        
                        const knownSum = knownAngles.reduce((sum, d) => sum + d.value, 0);
                        const remainingDegrees = AngleSolver.CONSTANTS.STRAIGHT_ANGLE - knownSum;
                        
                        if (remainingDegrees < 0 || remainingDegrees > AngleSolver.CONSTANTS.STRAIGHT_ANGLE) return; // Invalid
                        
                        // Group unknown angles by label
                        const labelGroups = new Map();
                        unknownAngles.forEach(d => {
                            if (d.label) {
                                if (!labelGroups.has(d.label)) {
                                    labelGroups.set(d.label, []);
                                }
                                labelGroups.get(d.label).push(d);
                            }
                        });
                        
                        // Case 0: Multiple angles with same label (assume they partition the straight angle)
                        // If we have 3+ angles with the same label, assume ONLY those divide the 180°
                        // This handles cases where some angles are labeled and others aren't
                        // NOTE: This is experimental and may not work for all geometries with composite angles
                        for (const [label, labeledAngles] of labelGroups) {
                            if (labeledAngles.length >= 3 && knownSum === 0) {
                                // Assume these N labeled angles partition the 180° equally
                                const angleValue = AngleSolver.CONSTANTS.STRAIGHT_ANGLE / labeledAngles.length;
                                
                                labeledAngles.forEach(d => {
                                    this.setAngleValue(
                                        d.angle,
                                        angleValue,
                                        `${labeledAngles.length} equal angles with label '${label}' sum to 180°`,
                                        'Linear Angle Division'
                                    );
                                    changesMade = true;
                                });
                                
                                // Propagate to all other angles with the same label globally
                                this.angles.forEach(a => {
                                    if (a.label === label && getAngleValue(a) === null) {
                                        this.setAngleValue(
                                            a,
                                            angleValue,
                                            `Same label '${label}'`,
                                            'Same Label'
                                        );
                                        changesMade = true;
                                    }
                                });
                                
                                return; // Done with this sector
                            }
                        }
                        
                        // Case 1: All unknowns have the same label
                        if (unknownAngles.length > 0 && unknownAngles.every(d => d.label && d.label === unknownAngles[0].label)) {
                            const label = unknownAngles[0].label;
                            const angleValue = remainingDegrees / unknownAngles.length;
                            
                            if (angleValue > 0 && angleValue < AngleSolver.CONSTANTS.STRAIGHT_ANGLE) {
                                // Set all unknown angles with this label at this location
                                unknownAngles.forEach(d => {
                                    this.setAngleValue(
                                        d.angle,
                                        angleValue,
                                        `Linear division: (180° - ${knownSum.toFixed(1)}°) / ${unknownAngles.length} angles labeled '${label}'`,
                                        'Linear Angle Division'
                                    );
                                    changesMade = true;
                                });
                                
                                // Propagate to all other angles with the same label globally
                                this.angles.forEach(a => {
                                    if (a.label === label && getAngleValue(a) === null && !unknownAngles.find(d => d.angle.id === a.id)) {
                                        this.setAngleValue(
                                            a,
                                            angleValue,
                                            `Same label '${label}' as angles on line`,
                                            'Same Label'
                                        );
                                        changesMade = true;
                                    }
                                });
                            }
                        }
                        // Case 2: Single label group (might have multiple instances)
                        else if (labelGroups.size === 1 && unknownAngles.every(d => d.label)) {
                            const label = [...labelGroups.keys()][0];
                            const count = labelGroups.get(label).length;
                            const angleValue = remainingDegrees / count;
                            
                            if (angleValue > 0 && angleValue < AngleSolver.CONSTANTS.STRAIGHT_ANGLE) {
                                labelGroups.get(label).forEach(d => {
                                    this.setAngleValue(
                                        d.angle,
                                        angleValue,
                                        `(180° - ${knownSum.toFixed(1)}°) / ${count} angles with label '${label}'`,
                                        'Linear Angle Division'
                                    );
                                    changesMade = true;
                                });
                                
                                // Propagate globally
                                this.angles.forEach(a => {
                                    if (a.label === label && getAngleValue(a) === null) {
                                        if (!labelGroups.get(label).find(d => d.angle.id === a.id)) {
                                            this.setAngleValue(
                                                a,
                                                angleValue,
                                                `Same label '${label}'`,
                                                'Same Label'
                                            );
                                            changesMade = true;
                                        }
                                    }
                                });
                            }
                        }
                    }
                }
            });
        });
        
        return changesMade;
    }
    
    /**
     * Theorem: Angle Addition - If a ray splits an angle into two parts, the sum equals the whole
     * If angles ∠ABC and ∠CBD exist, then ∠ABD = ∠ABC + ∠CBD
     */
    applyAngleAddition = () => {
        let changesMade = false;
        
        // For each point, find sets of 3 angles that could form an angle addition relationship
        this.adjacentPoints.forEach((neighbors, pointId) => {
            if (neighbors.size < 3) return; // Need at least 3 neighbors for angle addition
            
            const anglesAtVertex = this.getAnglesAtPoint(pointId);
            if (anglesAtVertex.length < 2) return;
            
            // Check all pairs of angles to see if they're adjacent and form a larger angle
            for (let i = 0; i < anglesAtVertex.length; i++) {
                for (let j = i + 1; j < anglesAtVertex.length; j++) {
                    const angle1 = anglesAtVertex[i];
                    const angle2 = anglesAtVertex[j];
                    
                    if (!angle1.neighborPoints || !angle2.neighborPoints) continue;
                    if (angle1.neighborPoints.length !== 2 || angle2.neighborPoints.length !== 2) continue;
                    
                    // Check if angles share exactly one neighbor (the middle ray)
                    const neighbors1 = new Set(angle1.neighborPoints);
                    const neighbors2 = new Set(angle2.neighborPoints);
                    const commonNeighbors = [...neighbors1].filter(n => neighbors2.has(n));
                    
                    if (commonNeighbors.length !== 1) continue;
                    
                    const middleRay = commonNeighbors[0];
                    const outerRay1 = [...neighbors1].find(n => n !== middleRay);
                    const outerRay2 = [...neighbors2].find(n => n !== middleRay);
                    
                    if (!outerRay1 || !outerRay2) continue;
                    
                    // Find the larger angle that spans from outerRay1 to outerRay2
                    const largeAngle = anglesAtVertex.find(a => 
                        a.neighborPoints &&
                        a.neighborPoints.length === 2 &&
                        ((a.neighborPoints[0] === outerRay1 && a.neighborPoints[1] === outerRay2) ||
                         (a.neighborPoints[0] === outerRay2 && a.neighborPoints[1] === outerRay1))
                    );
                    
                    if (!largeAngle) continue;
                    
                    // Now we have three angles: angle1, angle2, and largeAngle
                    // largeAngle = angle1 + angle2
                    const value1 = getAngleValue(angle1);
                    const value2 = getAngleValue(angle2);
                    const valueLarge = getAngleValue(largeAngle);
                    
                    // Case 1: Both small angles known, large angle unknown or incorrect
                    if (value1 !== null && value2 !== null) {
                        // Skip if large angle is a subdivision result (don't overwrite it)
                        if (largeAngle.isSubdivisionResult) {
                            continue;
                        }
                        
                        const sum = value1 + value2;
                        if (sum < AngleSolver.CONSTANTS.MAX_ANGLE) {
                            if (valueLarge === null) {
                                this.setAngleValue(largeAngle, sum, `Angle addition (${value1}° + ${value2}°)`, 'Angle Addition');
                                changesMade = true;
                            } else if (Math.abs(valueLarge - sum) > AngleSolver.CONSTANTS.TOLERANCE) {
                                // Large angle has wrong value - correct it
                                this.setAngleValue(largeAngle, sum, `Angle addition corrected (${value1}° + ${value2}°)`, 'Angle Addition');
                                changesMade = true;
                            }
                        }
                    }
                    // Case 2: Large angle and one small angle known, other small angle unknown
                    else if (valueLarge !== null && value1 !== null && value2 === null) {
                        // Skip if angle2 is a subdivision result (don't overwrite it)
                        if (angle2.isSubdivisionResult) {
                            continue;
                        }
                        
                        const diff = valueLarge - value1;
                        if (diff > 0 && diff < AngleSolver.CONSTANTS.MAX_ANGLE) {
                            this.setAngleValue(angle2, diff, `Angle addition (${valueLarge}° - ${value1}°)`, 'Angle Addition');
                            changesMade = true;
                        }
                    }
                    else if (valueLarge !== null && value2 !== null && value1 === null) {
                        // Skip if angle1 is a subdivision result (don't overwrite it)
                        if (angle1.isSubdivisionResult) {
                            continue;
                        }
                        
                        const diff = valueLarge - value2;
                        if (diff > 0 && diff < AngleSolver.CONSTANTS.MAX_ANGLE) {
                            this.setAngleValue(angle1, diff, `Angle addition (${valueLarge}° - ${value2}°)`, 'Angle Addition');
                            changesMade = true;
                        }
                    }
                }
            }
        });
        
        return changesMade;
    }
    
    /**
     * Theorem: Isosceles triangle - two sides equal means two angles equal
     * Uses circles to detect equal-length sides (radii are equal)
     */
    applyIsoscelesTriangles = () => {
        let changesMade = false;
        
        this.circles.forEach((circle, circleIdx) => {
            const centerPointId = circle.centerPoint || circle.centerPointId;
            const circlePoints = circle.pointsOnLine || circle.points || [];
            
            console.log(`  Circle at ${centerPointId} with points [${circlePoints.join(', ')}]`);
            
            if (circlePoints.length < 2) {
                return;
            }
            
            // All radii from center to circle points are equal
            // So any triangle formed by center + 2 circle points is isosceles
            
            for (let i = 0; i < circlePoints.length; i++) {
                for (let j = i + 1; j < circlePoints.length; j++) {
                    const point1 = circlePoints[i];
                    const point2 = circlePoints[j];
                    
                    console.log(`  Checking triangle: ${centerPointId}-${point1}-${point2}`);
                    
                    // Check if these 3 points form a triangle (using index for O(1) lookup)
                    let triangle = this.getTriangle(centerPointId, point1, point2);
                    
                    if (!triangle) {
                        // Triangle not in explicit list, but check if all edges exist
                        const hasEdge1 = this.adjacentPoints.get(centerPointId)?.has(point1);
                        const hasEdge2 = this.adjacentPoints.get(centerPointId)?.has(point2);
                        const hasEdge3 = this.adjacentPoints.get(point1)?.has(point2);
                        
                        if (hasEdge1 && hasEdge2 && hasEdge3) {
                            console.log(`    ✅ Triangle detected from edges (not in explicit list)`);
                            triangle = new Set([centerPointId, point1, point2]);
                        } else {
                            console.log(`    ❌ Not a complete triangle (missing edges)`);
                            continue;
                        }
                    } else {
                        console.log(`    ✅ Triangle found in explicit list`);
                    }
                    
                    // This is an isosceles triangle with center as apex
                    // The two base angles (at point1 and point2) are equal
                    
                    const angleAtPoint1 = this.findAngleInTriangle(point1, centerPointId, point2);
                    const angleAtPoint2 = this.findAngleInTriangle(point2, centerPointId, point1);
                    
                    // Debug: Show ALL angles at vertex A
                    const allAnglesAtA = this.getAnglesAtPoint(centerPointId);
                    console.log(`    All angles at ${centerPointId}:`, allAnglesAtA.map(a => `${a.name}=${a.value}`).join(', '));
                    
                    console.log(`    Base angle 1 (${point1}):`, angleAtPoint1 ? angleAtPoint1.name : 'NOT FOUND');
                    console.log(`    Base angle 2 (${point2}):`, angleAtPoint2 ? angleAtPoint2.name : 'NOT FOUND');
                    
                    if (!angleAtPoint1 || !angleAtPoint2) {
                        console.log(`    ❌ Base angles not found`);
                        continue;
                    }
                    
                    const value1 = getAngleValue(angleAtPoint1);
                    const value2 = getAngleValue(angleAtPoint2);
                    
                    console.log(`    Base angle values: ${value1}, ${value2}`);
                    
                    // Get apex angle at center
                    const apexAngle = this.findAngleInTriangle(centerPointId, point1, point2);
                    const apexValue = apexAngle ? getAngleValue(apexAngle) : null;
                    
                    if (apexAngle) {
                        console.log(`    Apex angle (${centerPointId}): ${apexAngle.name} = ${apexValue}°`);
                        console.log(`    Apex angle ID: ${apexAngle.id}, Label: '${apexAngle.label}', Value: ${apexAngle.value}`);
                    } else {
                        console.log(`    Apex angle (${centerPointId}): NOT FOUND`);
                    }
                    
                    // Case 1: Apex angle is known, base angles are unknown - calculate them!
                    if (apexValue !== null && value1 === null && value2 === null) {
                        const baseAngleValue = (AngleSolver.CONSTANTS.STRAIGHT_ANGLE - apexValue) / 2;
                        console.log(`    ✅ CALCULATING base angles: (180° - ${apexValue}°) / 2 = ${baseAngleValue}°`);
                        if (baseAngleValue > 0 && baseAngleValue < AngleSolver.CONSTANTS.STRAIGHT_ANGLE) {
                            this.setAngleValue(angleAtPoint1, baseAngleValue, `Isosceles triangle base angle (${AngleSolver.CONSTANTS.STRAIGHT_ANGLE}° - ${apexValue}°) / 2`, 'Isosceles Triangle');
                            this.setAngleValue(angleAtPoint2, baseAngleValue, `Isosceles triangle base angle (${AngleSolver.CONSTANTS.STRAIGHT_ANGLE}° - ${apexValue}°) / 2`, 'Isosceles Triangle');
                            changesMade = true;
                        }
                    }
                    // Case 2: One base angle is known, copy to the other
                    else if (value1 !== null && value2 === null) {
                        console.log(`    ✅ Copying base angle: ${value1}° from ${point1} to ${point2}`);
                        this.setAngleValue(angleAtPoint2, value1, `Isosceles triangle base angle (equal to ${angleAtPoint1.name || angleAtPoint1.id})`, 'Isosceles Triangle');
                        changesMade = true;
                    } else if (value2 !== null && value1 === null) {
                        console.log(`    ✅ Copying base angle: ${value2}° from ${point2} to ${point1}`);
                        this.setAngleValue(angleAtPoint1, value2, `Isosceles triangle base angle (equal to ${angleAtPoint2.name || angleAtPoint2.id})`, 'Isosceles Triangle');
                        changesMade = true;
                    }
                    // Case 3: Both base angles have values but they're different - correct it
                    else if (value1 !== null && value2 !== null && Math.abs(value1 - value2) > AngleSolver.CONSTANTS.TOLERANCE) {
                        console.log(`    ⚠️  Correcting base angles: ${value1}° vs ${value2}°`);
                        this.setAngleValue(angleAtPoint2, value1, `Isosceles triangle base angle corrected (must equal ${angleAtPoint1.name || angleAtPoint1.id})`, 'Isosceles Triangle');
                        changesMade = true;
                    }
                    else {
                        console.log(`    ⏭️  No action: apex=${apexValue}, base1=${value1}, base2=${value2}`);
                    }
                    
                    // Calculate or correct apex angle if base angles are known
                    if (apexAngle) {
                        const baseValue1 = getAngleValue(angleAtPoint1);
                        const baseValue2 = getAngleValue(angleAtPoint2);
                        
                        if (baseValue1 !== null && baseValue2 !== null) {
                            const apexValue = AngleSolver.CONSTANTS.STRAIGHT_ANGLE - baseValue1 - baseValue2;
                            const currentApexValue = getAngleValue(apexAngle);
                            
                            // Set or correct the apex angle based on the base angles
                            if (currentApexValue === null) {
                                this.setAngleValue(apexAngle, parseFloat(apexValue.toFixed(1)), `Isosceles triangle apex (${AngleSolver.CONSTANTS.STRAIGHT_ANGLE}° - ${baseValue1}° - ${baseValue2}°)`, 'Isosceles Triangle');
                                changesMade = true;
                            } else if (Math.abs(currentApexValue - apexValue) > AngleSolver.CONSTANTS.TOLERANCE) {
                                // Apex angle has wrong value - correct it based on base angles
                                this.setAngleValue(apexAngle, parseFloat(apexValue.toFixed(1)), `Isosceles triangle apex corrected (${AngleSolver.CONSTANTS.STRAIGHT_ANGLE}° - ${baseValue1}° - ${baseValue2}°)`, 'Isosceles Triangle');
                                changesMade = true;
                            }
                        }
                    }
                }
            }
        });
        
        return changesMade;
    }
    
    /**
     * Theorem: Isosceles Triangle Angle Bisector Perpendicular
     * In an isosceles triangle, if the vertex angle (at apex/circle center) is bisected
     * into two equal sub-angles (same label or same value), then the bisector is perpendicular
     * to the base, creating two 90° angles at the intersection point.
     */
    applyIsoscelesAngleBisectorPerpendicular = () => {
        let changesMade = false;
        
        console.log('🔺 Checking Isosceles Angle Bisector Perpendicular...');
        
        this.circles.forEach(circle => {
            const centerPointId = circle.centerPoint || circle.centerPointId;
            const circlePoints = circle.pointsOnLine || circle.points || [];
            
            if (circlePoints.length < 2) return;
            
            // Check all pairs of circle points (base of isosceles triangles)
            for (let i = 0; i < circlePoints.length; i++) {
                for (let j = i + 1; j < circlePoints.length; j++) {
                    const basePoint1 = circlePoints[i];
                    const basePoint2 = circlePoints[j];
                    
                    // Get the apex angle at center
                    const apexAngle = this.findAngleInTriangle(centerPointId, basePoint1, basePoint2);
                    if (!apexAngle) continue;
                    
                    // Find all angles at the center point
                    const anglesAtCenter = this.getAnglesAtPoint(centerPointId);
                    
                    // Find sub-angles of the apex angle (angles between centerPointId and the two base points)
                    // that have edges from center to some intermediate point
                    const subAngles = [];
                    
                    anglesAtCenter.forEach(angle => {
                        if (angle.id === apexAngle.id) return; // Skip the apex angle itself
                        
                        // Check if this angle shares one neighbor with apex and has another neighbor
                        // that could be between the base points
                        const sharedNeighbors = angle.neighborPoints.filter(n => 
                            apexAngle.neighborPoints.includes(n)
                        );
                        
                        if (sharedNeighbors.length === 1) {
                            // This angle shares exactly one neighbor with apex angle
                            // Check if the other neighbor is between the two base points
                            const otherNeighbor = angle.neighborPoints.find(n => !apexAngle.neighborPoints.includes(n));
                            
                            // Check if this forms a subdivision (otherNeighbor is between base points)
                            // by checking if edges exist: basePoint1-otherNeighbor and basePoint2-otherNeighbor
                            if (otherNeighbor) {
                                const hasEdge1 = this.adjacentPoints.get(basePoint1)?.has(otherNeighbor);
                                const hasEdge2 = this.adjacentPoints.get(basePoint2)?.has(otherNeighbor);
                                
                                if (hasEdge1 || hasEdge2) {
                                    subAngles.push({
                                        angle: angle,
                                        intermediatePoint: otherNeighbor,
                                        basePoint: sharedNeighbors[0]
                                    });
                                }
                            }
                        }
                    });
                    
                    // Check if we have exactly 2 sub-angles with the same label or same value
                    if (subAngles.length === 2) {
                        const angle1 = subAngles[0].angle;
                        const angle2 = subAngles[1].angle;
                        
                        const value1 = getAngleValue(angle1);
                        const value2 = getAngleValue(angle2);
                        const label1 = angle1.label || '';
                        const label2 = angle2.label || '';
                        
                        // Check if they're equal (same label OR same value)
                        const sameLabel = label1 && label2 && label1 === label2;
                        const sameValue = value1 !== null && value2 !== null && 
                                         Math.abs(value1 - value2) < AngleSolver.CONSTANTS.TOLERANCE;
                        
                        if (sameLabel || sameValue) {
                            // These two angles bisect the apex angle!
                            // The intermediate points should be the same (point on base)
                            const point1 = subAngles[0].intermediatePoint;
                            const point2 = subAngles[1].intermediatePoint;
                            
                            if (point1 === point2) {
                                const bisectorPoint = point1;
                                
                                console.log(`  ✓ Found bisected apex angle at ${centerPointId} with bisector point ${bisectorPoint}`);
                                console.log(`    Sub-angles: ${angle1.name} (${value1}°) and ${angle2.name} (${value2}°)`);
                                console.log(`    Labels: '${label1}' and '${label2}'`);
                                
                                // IMPORTANT: If both angles have the same label, they MUST be equal
                                // Enforce this before setting perpendicular angles
                                if (sameLabel && value1 !== null && value2 !== null && 
                                    Math.abs(value1 - value2) > AngleSolver.CONSTANTS.TOLERANCE) {
                                    // Values are different but labels are the same - enforce equality
                                    // Use the one that has an explicit constraint or the smaller one
                                    const targetValue = angle1.constraintValue !== undefined ? value1 : 
                                                       angle2.constraintValue !== undefined ? value2 : 
                                                       Math.min(value1, value2);
                                    
                                    console.log(`    ⚠️  Enforcing equality for label '${label1}': setting both to ${targetValue}°`);
                                    
                                    if (Math.abs(value1 - targetValue) > AngleSolver.CONSTANTS.TOLERANCE) {
                                        this.setAngleValue(angle1, targetValue, `Same label '${label1}'`, 'Same Label');
                                        changesMade = true;
                                    }
                                    if (Math.abs(value2 - targetValue) > AngleSolver.CONSTANTS.TOLERANCE) {
                                        this.setAngleValue(angle2, targetValue, `Same label '${label2}'`, 'Same Label');
                                        changesMade = true;
                                    }
                                    
                                    // Recalculate the apex angle since we changed the sub-angles
                                    const newApexValue = targetValue * 2;
                                    const currentApexValue = getAngleValue(apexAngle);
                                    if (currentApexValue !== null && Math.abs(currentApexValue - newApexValue) > AngleSolver.CONSTANTS.TOLERANCE) {
                                        console.log(`    ⚠️  Recalculating apex angle: ${currentApexValue}° → ${newApexValue}° (sum of equal sub-angles)`);
                                        this.setAngleValue(apexAngle, newApexValue, `Sum of bisected angles (${targetValue}° × 2)`, 'Angle Addition');
                                        changesMade = true;
                                        
                                        // Also recalculate the isosceles base angles
                                        const baseAngle1 = this.findAngleInTriangle(basePoint1, centerPointId, basePoint2);
                                        const baseAngle2 = this.findAngleInTriangle(basePoint2, centerPointId, basePoint1);
                                        
                                        const newBaseValue = (AngleSolver.CONSTANTS.STRAIGHT_ANGLE - newApexValue) / 2;
                                        
                                        if (baseAngle1) {
                                            const currentBase1 = getAngleValue(baseAngle1);
                                            if (currentBase1 !== null && Math.abs(currentBase1 - newBaseValue) > AngleSolver.CONSTANTS.TOLERANCE) {
                                                console.log(`    ⚠️  Recalculating base angle: ${currentBase1}° → ${newBaseValue}° (isosceles triangle)`);
                                                this.setAngleValue(baseAngle1, newBaseValue, `Isosceles: (180° - ${newApexValue}°) / 2`, 'Isosceles Triangle');
                                                changesMade = true;
                                            }
                                        }
                                        
                                        if (baseAngle2) {
                                            const currentBase2 = getAngleValue(baseAngle2);
                                            if (currentBase2 !== null && Math.abs(currentBase2 - newBaseValue) > AngleSolver.CONSTANTS.TOLERANCE) {
                                                console.log(`    ⚠️  Recalculating base angle: ${currentBase2}° → ${newBaseValue}° (isosceles triangle)`);
                                                this.setAngleValue(baseAngle2, newBaseValue, `Isosceles: (180° - ${newApexValue}°) / 2`, 'Isosceles Triangle');
                                                changesMade = true;
                                            }
                                        }
                                    }
                                }
                                
                                // Find angles at the bisector point connecting to the base points
                                // ∠(basePoint1, bisectorPoint, centerPointId) should be 90°
                                // ∠(basePoint2, bisectorPoint, centerPointId) should be 90°
                                
                                const angle_at_D_1 = this.findAngleInTriangle(bisectorPoint, basePoint1, centerPointId);
                                const angle_at_D_2 = this.findAngleInTriangle(bisectorPoint, basePoint2, centerPointId);
                                
                                if (angle_at_D_1) {
                                    const currentValue = getAngleValue(angle_at_D_1);
                                    if (currentValue === null || Math.abs(currentValue - AngleSolver.CONSTANTS.RIGHT_ANGLE) > AngleSolver.CONSTANTS.TOLERANCE) {
                                        console.log(`    ✅ Setting ${angle_at_D_1.name} = 90° (perpendicular)`);
                                        this.setAngleValue(
                                            angle_at_D_1, 
                                            AngleSolver.CONSTANTS.RIGHT_ANGLE, 
                                            `Isosceles angle bisector perpendicular`, 
                                            'Isosceles Bisector ⊥'
                                        );
                                        changesMade = true;
                                    }
                                }
                                
                                if (angle_at_D_2) {
                                    const currentValue = getAngleValue(angle_at_D_2);
                                    if (currentValue === null || Math.abs(currentValue - AngleSolver.CONSTANTS.RIGHT_ANGLE) > AngleSolver.CONSTANTS.TOLERANCE) {
                                        console.log(`    ✅ Setting ${angle_at_D_2.name} = 90° (perpendicular)`);
                                        this.setAngleValue(
                                            angle_at_D_2, 
                                            AngleSolver.CONSTANTS.RIGHT_ANGLE, 
                                            `Isosceles angle bisector perpendicular`, 
                                            'Isosceles Bisector ⊥'
                                        );
                                        changesMade = true;
                                    }
                                }
                            }
                        }
                    }
                }
            }
        });
        
        return changesMade;
    }
    
    /**
     * Theorem: Right Angle Bisector
     * If a 90° angle is bisected into two equal sub-angles, each is 45°
     */
    applyRightAngleBisector = () => {
        let changesMade = false;
        
        console.log('📐 Checking Right Angle Bisectors (90° → 45° + 45°)...');
        
        this.angles.forEach(angle => {
            const angleValue = getAngleValue(angle);
            
            // Check if this is a 90° angle
            if (angleValue !== null && Math.abs(angleValue - AngleSolver.CONSTANTS.RIGHT_ANGLE) < AngleSolver.CONSTANTS.TOLERANCE) {
                // Find sub-angles
                const subAngles = [];
                
                this.angles.forEach(otherAngle => {
                    if (otherAngle.id === angle.id) return;
                    if (otherAngle.point !== angle.point) return;
                    
                    // Check if this angle shares exactly one neighbor
                    const sharedNeighbors = otherAngle.neighborPoints.filter(n => 
                        angle.neighborPoints.includes(n)
                    );
                    
                    if (sharedNeighbors.length === 1) {
                        const otherNeighbor = otherAngle.neighborPoints.find(n => !angle.neighborPoints.includes(n));
                        if (otherNeighbor) {
                            subAngles.push(otherAngle);
                        }
                    }
                });
                
                // If we have exactly 2 sub-angles, they should both be 45°
                if (subAngles.length === 2) {
                    const value1 = getAngleValue(subAngles[0]);
                    const value2 = getAngleValue(subAngles[1]);
                    const label1 = subAngles[0].label || '';
                    const label2 = subAngles[1].label || '';
                    
                    // Check if they're meant to be equal (same label OR both unknown)
                    const sameLabel = label1 && label2 && label1 === label2;
                    const bothUnknown = value1 === null && value2 === null && !label1 && !label2;
                    
                    if (sameLabel || bothUnknown) {
                        console.log(`  ✓ Found 90° angle ${angle.name} bisected into 2 equal parts`);
                        
                        if (value1 === null || Math.abs(value1 - 45) > AngleSolver.CONSTANTS.TOLERANCE) {
                            console.log(`    ✅ Setting ${subAngles[0].name} = 45°`);
                            this.setAngleValue(subAngles[0], 45, `Right angle bisector (90° ÷ 2)`, 'Right Angle Bisector');
                            changesMade = true;
                        }
                        
                        if (value2 === null || Math.abs(value2 - 45) > AngleSolver.CONSTANTS.TOLERANCE) {
                            console.log(`    ✅ Setting ${subAngles[1].name} = 45°`);
                            this.setAngleValue(subAngles[1], 45, `Right angle bisector (90° ÷ 2)`, 'Right Angle Bisector');
                            changesMade = true;
                        }
                    }
                }
            }
        });
        
        return changesMade;
    }
    
    
    /**
     * Theorem: Inscribed Angle
     * An inscribed angle is half the central angle that subtends the same arc
     */
    applyInscribedAngle = () => {
        let changesMade = false;
        
        console.log('🔵 Checking Inscribed Angles (Circle)...');
        
        this.circles.forEach(circle => {
            const centerPointId = circle.centerPoint || circle.centerPointId;
            const circlePoints = circle.pointsOnLine || circle.points || [];
            
            if (circlePoints.length < 2) return;
            
            // For each pair of points on the circle
            for (let i = 0; i < circlePoints.length; i++) {
                for (let j = i + 1; j < circlePoints.length; j++) {
                    const arcPoint1 = circlePoints[i];
                    const arcPoint2 = circlePoints[j];
                    
                    // Find central angle (at center)
                    const centralAngle = this.findAngleInTriangle(centerPointId, arcPoint1, arcPoint2);
                    const centralValue = centralAngle ? getAngleValue(centralAngle) : null;
                    
                    // Find all inscribed angles (at other points on circle)
                    circlePoints.forEach(inscribedVertex => {
                        if (inscribedVertex === arcPoint1 || inscribedVertex === arcPoint2) return;
                        
                        const inscribedAngle = this.findAngleInTriangle(inscribedVertex, arcPoint1, arcPoint2);
                        const inscribedValue = inscribedAngle ? getAngleValue(inscribedAngle) : null;
                        
                        if (centralAngle && inscribedAngle) {
                            // Case 1: Central angle known, inscribed angle unknown
                            if (centralValue !== null && inscribedValue === null) {
                                const halfCentral = centralValue / 2;
                                console.log(`  ✅ Inscribed angle ${inscribedAngle.name} = ${centralValue}° ÷ 2 = ${halfCentral}°`);
                                this.setAngleValue(inscribedAngle, halfCentral, `Inscribed angle (½ central angle)`, 'Inscribed Angle');
                                changesMade = true;
                            }
                            // Case 2: Inscribed angle known, central angle unknown
                            else if (inscribedValue !== null && centralValue === null) {
                                const doubleinscribed = inscribedValue * 2;
                                console.log(`  ✅ Central angle ${centralAngle.name} = ${inscribedValue}° × 2 = ${doubleinscribed}°`);
                                this.setAngleValue(centralAngle, doubleinscribed, `Central angle (2 × inscribed angle)`, 'Inscribed Angle');
                                changesMade = true;
                            }
                        }
                    });
                }
            }
        });
        
        return changesMade;
    }
    
    /**
     * Theorem: Equilateral Triangle
     * If all three sides of a triangle are equal, all angles are 60°
     */
    applyEquilateralTriangle = () => {
        let changesMade = false;
        
        console.log('🔺 Checking Equilateral Triangles (60° angles)...');
        
        this.triangles.forEach(triangle => {
            const trianglePoints = Array.from(triangle);
            if (trianglePoints.length !== 3) return;
            
            const [p1, p2, p3] = trianglePoints;
            
            // Check if all three edges have equal length
            // We can detect this if all three points are on the same circle AND
            // they all form equal angles at some center point
            
            // Alternative: Check if there exists a circle where all 3 points are equidistant from some center
            let isEquilateral = false;
            
            // Method: If there's a circle where p1, p2, p3 are all on it,
            // and the central angles are all equal (120° each at center), then it's equilateral
            this.circles.forEach(circle => {
                const centerPointId = circle.centerPoint || circle.centerPointId;
                const circlePoints = circle.pointsOnLine || circle.points || [];
                
                // Check if all three triangle points are on this circle
                if (circlePoints.includes(p1) && circlePoints.includes(p2) && circlePoints.includes(p3)) {
                    // All three points on same circle - could be equilateral
                    // Check if they form equal angles at center
                    const angle1 = this.findAngleInTriangle(centerPointId, p1, p2);
                    const angle2 = this.findAngleInTriangle(centerPointId, p2, p3);
                    const angle3 = this.findAngleInTriangle(centerPointId, p3, p1);
                    
                    if (angle1 && angle2 && angle3) {
                        const val1 = getAngleValue(angle1);
                        const val2 = getAngleValue(angle2);
                        const val3 = getAngleValue(angle3);
                        
                        // If all three central angles are equal (or all 120°), it's equilateral
                        if (val1 !== null && val2 !== null && val3 !== null) {
                            if (Math.abs(val1 - val2) < AngleSolver.CONSTANTS.TOLERANCE && 
                                Math.abs(val2 - val3) < AngleSolver.CONSTANTS.TOLERANCE &&
                                Math.abs(val1 - 120) < AngleSolver.CONSTANTS.TOLERANCE) {
                                isEquilateral = true;
                            }
                        }
                    }
                }
            });
            
            if (isEquilateral) {
                console.log(`  ✓ Found equilateral triangle ${trianglePoints.join('-')}`);
                
                // Set all three angles to 60°
                const triangleAngle1 = this.findAngleInTriangle(p1, p2, p3);
                const triangleAngle2 = this.findAngleInTriangle(p2, p1, p3);
                const triangleAngle3 = this.findAngleInTriangle(p3, p1, p2);
                
                if (triangleAngle1) {
                    const currentVal = getAngleValue(triangleAngle1);
                    if (currentVal === null || Math.abs(currentVal - 60) > AngleSolver.CONSTANTS.TOLERANCE) {
                        console.log(`    ✅ Setting ${triangleAngle1.name} = 60°`);
                        this.setAngleValue(triangleAngle1, 60, `Equilateral triangle angle`, 'Equilateral Triangle');
                        changesMade = true;
                    }
                }
                
                if (triangleAngle2) {
                    const currentVal = getAngleValue(triangleAngle2);
                    if (currentVal === null || Math.abs(currentVal - 60) > AngleSolver.CONSTANTS.TOLERANCE) {
                        console.log(`    ✅ Setting ${triangleAngle2.name} = 60°`);
                        this.setAngleValue(triangleAngle2, 60, `Equilateral triangle angle`, 'Equilateral Triangle');
                        changesMade = true;
                    }
                }
                
                if (triangleAngle3) {
                    const currentVal = getAngleValue(triangleAngle3);
                    if (currentVal === null || Math.abs(currentVal - 60) > AngleSolver.CONSTANTS.TOLERANCE) {
                        console.log(`    ✅ Setting ${triangleAngle3.name} = 60°`);
                        this.setAngleValue(triangleAngle3, 60, `Equilateral triangle angle`, 'Equilateral Triangle');
                        changesMade = true;
                    }
                }
            }
        });
        
        return changesMade;
    }
    
    /**
     * Theorem: Circle radius angles
     * If center point has adjacent points on circle, the angles formed are equal
     */
    applyCircleRadiusAngles = () => {
        let changesMade = false;
        
        this.circles.forEach(circle => {
            const centerPointId = circle.centerPoint || circle.centerPointId;
            const circlePoints = circle.pointsOnLine || circle.points || [];
            
            // Get all adjacent points to center that are on the circle
            const adjacentOnCircle = [];
            const centerAdjacent = this.adjacentPoints.get(centerPointId);
            
            if (!centerAdjacent) return;
            
            centerAdjacent.forEach(adjPointId => {
                if (circlePoints.includes(adjPointId)) {
                    adjacentOnCircle.push(adjPointId);
                }
            });
            
            if (adjacentOnCircle.length < 2) return;
            
            // All angles from center to adjacent circle points have equal base angles
            // Find all such angles and set them equal
            const anglesFromCenter = [];
            
            adjacentOnCircle.forEach(circlePointId => {
                // Find angle at center with this circle point
                const angle = this.angles.find(a => 
                    a.point === centerPointId &&
                    a.neighborPoints &&
                    a.neighborPoints.includes(circlePointId)
                );
                
                if (angle) {
                    anglesFromCenter.push(angle);
                }
            });
            
            // If we have multiple angles and one is known, set others to same value
            const knownAngle = anglesFromCenter.find(a => getAngleValue(a) !== null);
            
            if (knownAngle) {
                const knownValue = getAngleValue(knownAngle);
                
                anglesFromCenter.forEach(angle => {
                    if (getAngleValue(angle) === null) {
                        this.setAngleValue(
                            angle, 
                            knownValue, 
                            `Equal radius angle to ${knownAngle.name || 'angle'}`,
                            'Circle Radius'
                        );
                        changesMade = true;
                    }
                });
            }
        });
        
        return changesMade;
    }
    
    /**
     * Theorem: Vertical angles are equal
     */
    applyVerticalAngles = () => {
        let changesMade = false;
        
        // Find all points that are intersections (have 4+ adjacent points)
        this.adjacentPoints.forEach((adjacent, pointId) => {
            if (adjacent.size < 4) return; // Need at least 4 connected edges for vertical angles
            
            const anglesAtPoint = this.getAnglesAtPoint(pointId);
            
            // Check pairs of opposite angles
            for (let i = 0; i < anglesAtPoint.length; i++) {
                for (let j = i + 1; j < anglesAtPoint.length; j++) {
                    const angle1 = anglesAtPoint[i];
                    const angle2 = anglesAtPoint[j];
                    
                    // Vertical angles have NO common neighbor points
                    const neighbors1 = new Set(angle1.neighborPoints);
                    const neighbors2 = new Set(angle2.neighborPoints);
                    const commonNeighbors = [...neighbors1].filter(n => neighbors2.has(n));
                    
                    if (commonNeighbors.length === 0) {
                        // These are vertical angles - they should be equal
                        const value1 = getAngleValue(angle1);
                        const value2 = getAngleValue(angle2);
                        
                        if (value1 !== null && value2 === null) {
                            this.setAngleValue(angle2, value1, `Vertical angle to ${angle1.name || 'angle'}`, 'Vertical Angles');
                            changesMade = true;
                        } else if (value2 !== null && value1 === null) {
                            this.setAngleValue(angle1, value2, `Vertical angle to ${angle2.name || 'angle'}`, 'Vertical Angles');
                            changesMade = true;
                        }
                    }
                }
            }
        });
        
        return changesMade;
    }
    
    /**
     * Theorem: Angles to collinear points from the same vertex are equal
     * If points A, B, C are collinear (on same line) and we have angles from vertex V to these points,
     * then ∠(V-A-B) = ∠(V-A-C) = ∠(V-B-C) when they're in the same direction
     */
    applyCollinearPointAngles = () => {
        let changesMade = false;
        
        // Check each line that has 3+ points
        this.lines.forEach(line => {
            if (line.length < 3) return;
            
            // For each point not on this line (potential vertex)
            this.points.forEach(vertexPoint => {
                const pointId = vertexPoint.id;
                
                // Skip if vertex is on the line
                if (line.includes(pointId)) return;
                
                // Find all angles from this vertex to points on the line
                const anglesFromVertex = [];
                
                for (let i = 0; i < line.length - 1; i++) {
                    for (let j = i + 1; j < line.length; j++) {
                        const linePoint1 = line[i];
                        const linePoint2 = line[j];
                        
                        // Find angle at vertex between these two line points
                        const angle = this.findAngleInTriangle(pointId, linePoint1, linePoint2);
                        
                        if (angle) {
                            anglesFromVertex.push({
                                angle: angle,
                                point1: linePoint1,
                                point2: linePoint2,
                                distance: j - i // Distance along the line
                            });
                        }
                    }
                }
                
                if (anglesFromVertex.length < 2) return;
                
                // All these angles should be equal (same direction from vertex to the line)
                // Find a known angle value
                const knownAngle = anglesFromVertex.find(a => getAngleValue(a.angle) !== null);
                
                if (knownAngle) {
                    const knownValue = getAngleValue(knownAngle.angle);
                    
                    // Set all unknown angles to the same value
                    anglesFromVertex.forEach(angleInfo => {
                        if (getAngleValue(angleInfo.angle) === null) {
                            this.setAngleValue(
                                angleInfo.angle,
                                knownValue,
                                `Collinear points angle (equal to ${knownAngle.angle.name || knownAngle.angle.id})`,
                                'Collinear Points'
                            );
                            changesMade = true;
                        }
                    });
                }
            });
        });
        
        // Additional check: If vertex is ON the line, angles from external point to different points on line should be equal
        // e.g., if C, D, E, B are collinear and A is external, then ∠ACB = ∠ACD = ∠ACE
        this.lines.forEach(line => {
            if (line.length < 2) return;
            
            // For each point on the line (as potential vertex)
            line.forEach(pointId => {
                // Find external points (points not on this line)
                this.points.forEach(externalPoint => {
                    const externalId = externalPoint.id;
                    
                    // Skip if external point is on the line
                    if (line.includes(externalId)) return;
                    
                    // Find all angles at pointId that involve the external point
                    // and another point from the line
                    const relevantAngles = [];
                    
                    line.forEach(linePointId => {
                        if (linePointId === pointId) return; // Skip self
                        
                        // Find angle at pointId between externalPoint and linePointId
                        const angle = this.findAngleInTriangle(pointId, externalId, linePointId);
                        
                        if (angle) {
                            relevantAngles.push({
                                angle: angle,
                                externalPoint: externalId,
                                linePoint: linePointId
                            });
                        }
                    });
                    
                    if (relevantAngles.length < 2) return;
                    
                    // All these angles should be equal (same external point, different line points)
                    const knownAngle = relevantAngles.find(a => getAngleValue(a.angle) !== null);
                    
                    if (knownAngle) {
                        const knownValue = getAngleValue(knownAngle.angle);
                        
                        // Set all unknown angles to the same value
                        relevantAngles.forEach(angleInfo => {
                            if (getAngleValue(angleInfo.angle) === null) {
                                this.setAngleValue(
                                    angleInfo.angle,
                                    knownValue,
                                    `Angle to collinear line (equal to ${knownAngle.angle.name || knownAngle.angle.id})`,
                                    'Collinear Points'
                                );
                                changesMade = true;
                            }
                        });
                    }
                });
            });
        });
        
        return changesMade;
    }
    
    /**
     * Check if all triangles are geometrically valid (angles sum to 180°)
     * Returns true if all triangles with known angle values sum to 180° (within tolerance)
     */
    areAllTrianglesValid = () => {
        // If no triangles, can't validate - continue solving
        if (!this.triangles || this.triangles.length === 0) {
            return false;
        }
        
        let hasAtLeastOneValidTriangle = false;
        
        for (const triangle of this.triangles) {
            const angle1 = this.findAngleInTriangle(triangle[0], triangle[1], triangle[2]);
            const angle2 = this.findAngleInTriangle(triangle[1], triangle[0], triangle[2]);
            const angle3 = this.findAngleInTriangle(triangle[2], triangle[0], triangle[1]);
            
            if (!angle1 || !angle2 || !angle3) continue;
            
            const value1 = getAngleValue(angle1);
            const value2 = getAngleValue(angle2);
            const value3 = getAngleValue(angle3);
            
            // If any angle is unknown, this triangle isn't solved yet - continue solving
            if (value1 === null || value2 === null || value3 === null) {
                return false;
            }
            
            // All angles are known - check if they sum to 180°
            const sum = value1 + value2 + value3;
            const diff = Math.abs(sum - 180);
            
            if (diff > AngleSolver.CONSTANTS.TOLERANCE) {
                console.log(`❌ Triangle ${triangle.join('-')}: ${value1}° + ${value2}° + ${value3}° = ${sum}° (should be 180°)`);
                return false;
            }
            
            hasAtLeastOneValidTriangle = true;
        }
        
        // Only return true if we found at least one complete, valid triangle
        return hasAtLeastOneValidTriangle;
    }
    
    /**
     * Validate all triangles and report errors
     */
    validateAllTriangles = () => {
        console.log('\n📊 Triangle Validation:');
        
        let validCount = 0;
        let invalidCount = 0;
        let incompleteCount = 0;
        
        for (const triangle of this.triangles) {
            const angle1 = this.findAngleInTriangle(triangle[0], triangle[1], triangle[2]);
            const angle2 = this.findAngleInTriangle(triangle[1], triangle[0], triangle[2]);
            const angle3 = this.findAngleInTriangle(triangle[2], triangle[0], triangle[1]);
            
            if (!angle1 || !angle2 || !angle3) {
                incompleteCount++;
                continue;
            }
            
            const value1 = getAngleValue(angle1);
            const value2 = getAngleValue(angle2);
            const value3 = getAngleValue(angle3);
            
            if (value1 === null || value2 === null || value3 === null) {
                console.log(`⚠️  Triangle ${triangle.join('-')}: incomplete (${value1 || '?'}°, ${value2 || '?'}°, ${value3 || '?'}°)`);
                incompleteCount++;
            } else {
                const sum = value1 + value2 + value3;
                const diff = Math.abs(sum - 180);
                
                if (diff < AngleSolver.CONSTANTS.TOLERANCE) {
                    console.log(`✅ Triangle ${triangle.join('-')}: ${value1}° + ${value2}° + ${value3}° = ${sum}°`);
                    validCount++;
                } else {
                    console.log(`❌ Triangle ${triangle.join('-')}: ${value1}° + ${value2}° + ${value3}° = ${sum}° (ERROR: should be 180°)`);
                    invalidCount++;
                }
            }
        }
        
        console.log(`\n📈 Summary: ${validCount} valid, ${invalidCount} invalid, ${incompleteCount} incomplete`);
        
        return invalidCount === 0;
    }
    
    // Helper methods
    
    // getAngleValue moved to mathHelper.mjs and imported
    
    setAngleValue = (angle, value, reason, theorem = 'Unknown') => {
        const numericValue = parseFloat(value);
        
        // Check if angle has an explicit constraint (marked with a flag or original value)
        // If the angle has 'constraintValue' property, it's user-defined and should not be overwritten
        if (angle.constraintValue !== undefined) {
            console.log(`⚠️  Skipping ${angle.name}: has explicit constraint (${angle.constraintValue}°)`);
            return;
        }
        
        // Check if angle already has a value
        if (angle.value && angle.value !== '?') {
            const existingValue = parseFloat(angle.value);
            const difference = Math.abs(existingValue - numericValue);
            
            // If values are very close (within tolerance), consider them the same
            if (difference < AngleSolver.CONSTANTS.TOLERANCE) {
                return;
            }
            
            // Log when we're changing an existing value
            console.log(`⚠️  Changing ${angle.name}: ${existingValue}° → ${numericValue}° (${theorem})`);
        }
        
        const newValue = numericValue.toFixed(1);
        angle.value = newValue;
        
        // Record in solving history (minimal data)
        this.solvingHistory.push({
            angleId: angle.id,
            angleName: angle.name || angle.id,
            value: newValue,
            theorem: theorem,
            reason: reason
        });
        
        // Don't directly update DOM - emit message instead to prevent duplicate text elements
        this.messagingHub.emit('angle:valueCalculated', {
            angleId: angle.id,
            value: newValue,
            reason: reason
        });
    }
    
    // doAnglesShareEdge moved to mathHelper.mjs and imported
    
    /**
     * Check if two angles overlap (are the same angle)
     * This happens when they share a vertex and one edge, and the other edges
     * point to collinear points on the SAME side of the vertex or common neighbor
     */
    areAnglesOverlapping = (angle1, angle2) => {
        const point1 = angle1.point || angle1.pointId;
        const point2 = angle2.point || angle2.pointId;
        
        if (point1 !== point2) return false;
        
        const vertex = point1;
        const neighbors1 = angle1.neighborPoints || angle1.sidepoints || [];
        const neighbors2 = angle2.neighborPoints || angle2.sidepoints || [];
        
        // Find common neighbor (shared edge)
        let commonNeighbor = null;
        for (const n of neighbors1) {
            if (neighbors2.includes(n)) {
                if (commonNeighbor !== null) return false;
                commonNeighbor = n;
            }
        }
        
        if (commonNeighbor === null) return false;
        
        // Find non-common neighbors
        const nonCommon1 = neighbors1.find(n => n !== commonNeighbor);
        const nonCommon2 = neighbors2.find(n => n !== commonNeighbor);
        
        if (!nonCommon1 || !nonCommon2) return false;
        
        // Check if the points are collinear
        for (const line of this.lines) {
            // CASE 1: Vertex is on the line with both non-common neighbors
            if (line.includes(vertex) && line.includes(nonCommon1) && line.includes(nonCommon2)) {
                const vertexIndex = line.indexOf(vertex);
                const index1 = line.indexOf(nonCommon1);
                const index2 = line.indexOf(nonCommon2);
                
                // For overlapping angles, both non-common neighbors must be on the SAME side
                const onSameSide = (index1 < vertexIndex && index2 < vertexIndex) || 
                                  (index1 > vertexIndex && index2 > vertexIndex);
                
                return onSameSide;
            }
            
            // CASE 2: Vertex is NOT on the line, but common neighbor and both non-common neighbors ARE
            // This handles angle containment (e.g., ∠BCE contained in ∠BCA when C-E-A are collinear)
            if (!line.includes(vertex) && line.includes(commonNeighbor) && 
                line.includes(nonCommon1) && line.includes(nonCommon2)) {
                
                const commonIndex = line.indexOf(commonNeighbor);
                const index1 = line.indexOf(nonCommon1);
                const index2 = line.indexOf(nonCommon2);
                
                // Both non-common neighbors must be on the SAME side of the common neighbor
                // This creates overlapping angles (one contains the other)
                const onSameSide = (index1 < commonIndex && index2 < commonIndex) || 
                                  (index1 > commonIndex && index2 > commonIndex);
                
                return onSameSide;
            }
        }
        return false;
    }
    
    areAnglesLinearPair = (angle1, angle2) => {
        const point1 = angle1.point || angle1.pointId;
        const point2 = angle2.point || angle2.pointId;
        
        if (point1 !== point2) return false;
        
        const vertex = point1;
        const neighbors1 = angle1.neighborPoints || angle1.sidepoints || [];
        const neighbors2 = angle2.neighborPoints || angle2.sidepoints || [];
        
        // Find common neighbor (shared edge)
        let commonNeighbor = null;
        for (const n of neighbors1) {
            if (neighbors2.includes(n)) {
                if (commonNeighbor !== null) return false; // More than one common neighbor
                commonNeighbor = n;
            }
        }
        
        if (commonNeighbor === null) return false;
        
        // Find non-common neighbors
        const nonCommon1 = neighbors1.find(n => n !== commonNeighbor);
        const nonCommon2 = neighbors2.find(n => n !== commonNeighbor);
        
        if (!nonCommon1 || !nonCommon2) return false;
        
        // Check if the three points are collinear
        for (const line of this.lines) {
            if (line.includes(vertex) && line.includes(nonCommon1) && line.includes(nonCommon2)) {
                // They're collinear - now check if they're on OPPOSITE sides of the vertex
                const vertexIndex = line.indexOf(vertex);
                const index1 = line.indexOf(nonCommon1);
                const index2 = line.indexOf(nonCommon2);
                
                // For a linear pair, the two non-common neighbors must be on opposite sides
                // i.e., one before vertex, one after vertex in the line array
                const onOppositeSides = (index1 < vertexIndex && index2 > vertexIndex) || 
                                       (index1 > vertexIndex && index2 < vertexIndex);
                
                return onOppositeSides;
            }
        }
        return false;
    }
    
    findAngleInTriangle = (pointId, neighbor1Id, neighbor2Id) => {
        const angle = this.angles.find(a => {
            const point = a.point || a.pointId;
            const neighbors = a.neighborPoints || a.sidepoints;
            
            return point === pointId &&
                neighbors &&
                neighbors.length === 2 &&
                ((neighbors[0] === neighbor1Id && neighbors[1] === neighbor2Id) ||
                 (neighbors[0] === neighbor2Id && neighbors[1] === neighbor1Id));
        });

        return angle;
    }
    
    /**
     * Helper: Find all angles in a sector between two line neighbors
     * Returns angles that are "between" neighbor1 and neighbor2 around the vertex
     */
    findAnglesInSector = (anglesAtPoint, vertexId, lineNeighbor1, lineNeighbor2) => {
        const result = [];
        
        // Find all angles that connect into this sector
        // An angle is in the sector if it has at least one neighbor that's one of the line neighbors
        // but doesn't span the entire sector (which would be 180°)
        anglesAtPoint.forEach(angle => {
            if (!angle.neighborPoints || angle.neighborPoints.length !== 2) return;
            
            const n1 = angle.neighborPoints[0];
            const n2 = angle.neighborPoints[1];
            
            // Check if this angle connects lineNeighbor1 to lineNeighbor2 directly
            if ((n1 === lineNeighbor1 && n2 === lineNeighbor2) ||
                (n1 === lineNeighbor2 && n2 === lineNeighbor1)) {
                // This angle spans the entire sector (should be 180°) - don't include it
                return;
            }
            
            // Include if at least one neighbor is one of the line neighbors
            const hasLineNeighbor = (n1 === lineNeighbor1 || n1 === lineNeighbor2 ||
                                       n2 === lineNeighbor1 || n2 === lineNeighbor2);
            
            if (hasLineNeighbor) {
                result.push(angle);
            }
        });
        
        // IMPORTANT: Also find interior angles (both rays to non-line points)
        // These are angles completely "inside" the sector between lineNeighbor1 and lineNeighbor2
        // An interior angle should connect two points that both appear in boundary angles
        
        const interiorPoints = new Set();
        result.forEach(boundaryAngle => {
            boundaryAngle.neighborPoints.forEach(n => {
                if (n !== lineNeighbor1 && n !== lineNeighbor2) {
                    interiorPoints.add(n);
                }
            });
        });
        
        // Find angles connecting any two interior points
        anglesAtPoint.forEach(angle => {
            if (result.includes(angle)) return; // Already included as boundary angle
            if (!angle.neighborPoints || angle.neighborPoints.length !== 2) return;
            
            const n1 = angle.neighborPoints[0];
            const n2 = angle.neighborPoints[1];
            
            // Include if both neighbors are interior points (connected by boundary angles)
            if (interiorPoints.has(n1) && interiorPoints.has(n2)) {
                result.push(angle);
            }
        });
        
        return result;
    }
    
    // Performance optimization methods
    
    /**
     * Build index of angles by point for faster lookups
     */
    buildAngleIndex = () => {
        this.anglesByPoint = new Map();
        this.angles.forEach(angle => {
            const pointId = angle.point;
            if (!this.anglesByPoint.has(pointId)) {
                this.anglesByPoint.set(pointId, []);
            }
            this.anglesByPoint.get(pointId).push(angle);
        });
    }
    
    /**
     * Build index of triangles for O(1) lookup
     */
    buildTriangleIndex = () => {
        this.triangleIndex = new Map();
        this.triangles.forEach(triangle => {
            const sorted = Array.from(triangle).sort().join('-');
            this.triangleIndex.set(sorted, triangle);
        });
    }
    
    /**
     * Get triangle from three points (O(1) lookup)
     */
    getTriangle = (p1, p2, p3) => {
        const key = [p1, p2, p3].sort().join('-');
        return this.triangleIndex.get(key);
    }
    
    /**
     * Get angles at a specific point (O(1) lookup)
     */
    getAnglesAtPoint = (pointId) => {
        return this.anglesByPoint.get(pointId) || [];
    }
    
    // Utility methods
    
    /**
     * Truncate a string to max length with suffix
     */
    // truncate, hasValuePattern moved to mathHelper.mjs and imported
    
    /**
     * Get values from multiple angles
     */
    getAngleValues = (...angles) => {
        return angles.map(a => getAngleValue(a));
    }
}
