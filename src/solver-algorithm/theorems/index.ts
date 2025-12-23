import type { SolveData, SolveOptions, TheoremSolverResult, SolveDataWithMaps } from '@/types';
import { 
    areAllTrianglesValid,
    getAngleMapsByPointId,
    getAnglesNeedToBeSolved,
    getAnglesAlreadySolved,
    isSolvedAngle,
} from '@/utils/mathHelper';

import { applySameLabelAngles } from './applySameLabelAngles';
import { applyTriangleAngleSum } from './applyTriangleAngleSum';
import { applySupplementaryAngles } from './applySupplementaryAngles';
import { applySameAngles } from './applySameAngles';
import { applyComposedAngles } from './applyComposedAngles';
import { applyMirrorAngle } from './applyMirrorAngle';
import { applyFullAngleSum } from './applyFullAngleSum';

type SolverMethod = (data: SolveDataWithMaps, log: SolveOptions['setAngle']) => boolean;

const scores: Record<string, number> = {
    [applySameLabelAngles.name]: 1,
    [applySupplementaryAngles.name]: 2,
    [applyTriangleAngleSum.name]: 3,
    [applyComposedAngles.name]: 2,
    [applyMirrorAngle.name]: 1,
    [applySameAngles.name]: 0,
    [applyFullAngleSum.name]: 3,
};

export const solveWithTheorems = (
    { angles, points, lines, triangles, circles, adjacentPoints }: SolveData, 
    { setAngle, maxIterations = 100 }: SolveOptions
): TheoremSolverResult => {
    const startTime = performance.now();

    const data: SolveDataWithMaps = {
        adjacentPoints,
        angles,
        angleMapsByPointId: getAngleMapsByPointId(angles),
        circles,
        lines,
        points,
        triangles,
    };

    const anglesNeedToBeSolved = getAnglesNeedToBeSolved(angles);
    let changesMade = true;
    let iterations = 0;
    let score = 0;

    const angleSolverMethods: SolverMethod[] = [
        applySameLabelAngles,
        applySameAngles,
        applySupplementaryAngles,
        applyFullAngleSum,
        applyTriangleAngleSum,
        applyComposedAngles,
        applyMirrorAngle,
    ];

    while (changesMade && iterations < maxIterations) {
        changesMade = false;
        iterations++;
        
        const unsolvedAngles = angles.filter(a => !a.value).length;
        if (unsolvedAngles === 0) {
            break;
        }
        
        // Check if all target angles are solved - if so, we can potentially stop early
        const unsolvedTargets = anglesNeedToBeSolved.filter(a => !a.value);
        const triangleArrays = triangles.map(t => 
            t instanceof Set ? Array.from(t) : t
        ) as string[][];
        
        // Only break early if ALL triangles are valid AND all targets are solved
        if (areAllTrianglesValid(triangleArrays, angles) && unsolvedTargets.length === 0) {
            break;
        }

        for (const solverMethod of angleSolverMethods) {
            if (solverMethod(data, setAngle)) {
                changesMade = true;
                score += scores[solverMethod.name] || 0;
            }
        }
    }
    
    if (iterations >= maxIterations) {
        console.warn(`⚠️  Reached max iterations (${iterations}). Solver may be in infinite loop.`);
    }

    const solved = anglesNeedToBeSolved.length > 0 && anglesNeedToBeSolved.every(a => isSolvedAngle(a));
    const allSolved = angles.length > 0 && getAnglesAlreadySolved(angles).length === angles.length;
    
    const endTime = performance.now();
    const executionTime = endTime - startTime;

    return {
        executionTime,
        iterations,
        solved,
        allSolved,
        score,
    };
};

