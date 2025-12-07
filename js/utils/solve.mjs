import { 
    areAllTrianglesValid,
    getAngleMapsByPointId,
    getAnglesNeedToBeSolved,
    getAnglesAlreadySolved,
    validateAllTriangles,
    isSolvedAngle,
} from './mathHelper.mjs';

import { applySameLabelAngles } from '../rules/applySameLabelAngles.mjs';
import { applyTriangleAngleSum } from '../rules/applyTriangleAngleSum.mjs';
import { applySupplementaryAngles } from '../rules/applySupplementaryAngles.mjs';
import { applySameAngles } from '../rules/applySameAngles.mjs';
import { applyComposedAngles } from '../rules/applyComposedAngles.mjs';
import { applyMirrorAngle } from '../rules/applyMirrorAngle.mjs';

const scores = {
    applySameLabelAngles: 1,
    applySupplementaryAngles: 2,
    applyTriangleAngleSum: 3,
    applyComposedAngles: 2,
    applyMirrorAngle: 1,
    applySameAngles: 0,
}

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

    const anglesNeedToBeSolved = getAnglesNeedToBeSolved(angles);
    let changesMade = true;
    let iterations = 0;
    let score = 0;

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
        const unsolvedAngles = angles.filter(a => !a.value).length;
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
                score += scores[solverMethod.name];
            }
        }
    }
    
    // Final validation
    if (iterations >= maxIterations) {
        console.warn(`⚠️  Reached max iterations (${iterations}). Solver may be in infinite loop.`);
    }
    
    const isValid = validateAllTriangles(triangles, angles);

    const solved = anglesNeedToBeSolved.length > 0 && anglesNeedToBeSolved.every(a => isSolvedAngle(a));
    const allSolved = angles.length > 0 && getAnglesAlreadySolved(angles).length === angles.length;
    
    // End performance benchmark
    const endTime = performance.now();
    const executionTime = endTime - startTime;
    
    return {
        isValid,
        executionTime,
        iterations,
        solved,
        allSolved,
        score,
    };
}
