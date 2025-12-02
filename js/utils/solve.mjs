import { 
    areAllTrianglesValid,
    getAngleMapsByPointId,
    validateAllTriangles,
} from './mathHelper.mjs';

import { applySameLabelAngles } from '../rules/applySameLabelAngles.mjs';
import { applyTriangleAngleSum } from '../rules/applyTriangleAngleSum.mjs';
import { applySupplementaryAngles } from '../rules/applySupplementaryAngles.mjs';
import { applySameAngles } from '../rules/applySameAngles.mjs';
import { applyComposedAngles } from '../rules/applyComposedAngles.mjs';
import { applyMirrorAngle } from '../rules/applyMirrorAngle.mjs';

export const solve = ({ angles, points, lines, triangles, circles }, { setAngle, maxIterations = 100 }) => {
    // Start performance benchmark
    const startTime = performance.now();

    const data = {
        angles,
        // helper method, logic was moved here to better performance
        angleMapsByPointId: getAngleMapsByPointId(angles),
        points,
        lines,
        triangles,
        circles,
    };
    let changesMade = true;
    let iterations = 0;

    const angleSolverMethods = [
        applySameLabelAngles,
        applySupplementaryAngles,
        applyTriangleAngleSum,
        applyComposedAngles,
        applyMirrorAngle,
        applySameAngles,
    ];

    while (changesMade && iterations < maxIterations) {
        changesMade = false;
        iterations++;
        
        // Check if all angles are solved
        const unsolvedAngles = angles.filter(a => !a.value || a.value === '?').length;
        if (unsolvedAngles === 0) {
            break;
        }
        
        // Check if all triangles are valid (sum = 180°)
        if (areAllTrianglesValid(triangles, angles)) {
            break;
        }

        for (const solverMethod of angleSolverMethods) {
            if (solverMethod(data, setAngle)) {
                changesMade = true;
            }
        }
    }
    
    // Final validation
    if (iterations >= maxIterations) {
        console.warn(`⚠️  Reached max iterations (${iterations}). Solver may be in infinite loop.`);
    }
    
    const isValid = validateAllTriangles(triangles, angles);

    const solved = angles.filter(a => a.value && a.value !== '?').length === angles.length;

    // End performance benchmark
    const endTime = performance.now();
    const executionTime = endTime - startTime;
    
    return {
        isValid,
        executionTime,
        iterations,
        solved,
    };
}
