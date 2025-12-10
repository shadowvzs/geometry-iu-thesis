import type { Angle, Point, Line, Triangle, Circle } from '../types';
import { 
    areAllTrianglesValid,
    getAngleMapsByPointId,
    getAnglesNeedToBeSolved,
    getAnglesAlreadySolved,
    validateAllTriangles,
    isSolvedAngle,
} from './mathHelper';

import { applySameLabelAngles } from '../rules/applySameLabelAngles';
import { applyTriangleAngleSum } from '../rules/applyTriangleAngleSum';
import { applySupplementaryAngles } from '../rules/applySupplementaryAngles';
import { applySameAngles } from '../rules/applySameAngles';
import { applyComposedAngles } from '../rules/applyComposedAngles';
import { applyMirrorAngle } from '../rules/applyMirrorAngle';
import { applyFullAngleSum } from '../rules/applyFullAngleSum';

export interface SolveData {
    angles: Angle[];
    points: Point[];
    lines: Line[];
    triangles: Triangle[] | string[][];
    circles: Circle[];
    adjacentPoints: Map<string, Set<string>>;
}

export interface SolveOptions {
    setAngle: (angle: Angle, reason: string, ruleName: string) => void;
    maxIterations?: number;
}

export interface SolveResult {
    isValid: boolean;
    executionTime: number;
    iterations: number;
    solved: boolean;
    allSolved: boolean;
    score: number | string;
}

type SolverMethod = (data: SolveDataWithMaps, log: SolveOptions['setAngle']) => boolean;

export interface SolveDataWithMaps extends SolveData {
    angleMapsByPointId: Record<string, Angle[]>;
}

const scores: Record<string, number> = {
    applySameLabelAngles: 1,
    applySupplementaryAngles: 2,
    applyTriangleAngleSum: 3,
    applyComposedAngles: 2,
    applyMirrorAngle: 1,
    applySameAngles: 0,
    applyFullAngleSum: 3,
};

export const solve = (
    { angles, points, lines, triangles, circles, adjacentPoints }: SolveData, 
    { setAngle, maxIterations = 100 }: SolveOptions
): SolveResult => {
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
    
    const triangleArrays = triangles.map(t => 
        t instanceof Set ? Array.from(t) : t
    ) as string[][];
    
    const isValid = validateAllTriangles(triangleArrays, angles);
    const solved = anglesNeedToBeSolved.length > 0 && anglesNeedToBeSolved.every(a => isSolvedAngle(a));
    const allSolved = angles.length > 0 && getAnglesAlreadySolved(angles).length === angles.length;
    
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
};

