import { SolveData, SolveOptions, SolverResults } from "@/types";
import { solveWithTheorems } from "./theorems";
import { solveWithEquations } from "./equations";

// shallow clone for the solve data
const shallowClone = (data: SolveData): SolveData => {
    return {
        angles: data.angles.map(a => ({ ...a })),
        points: data.points.map(p => ({ ...p })),
        edges: data.edges.map(e => ({ ...e })),
        lines: data.lines.map(l => ({ ...l })),
        triangles: data.triangles.map(t => Array.from(t)),
        circles: data.circles.map(c => ({ ...c })),
    }
};

export const solve = (data: SolveData, options: SolveOptions): SolverResults => {
    // if no target angles, return early
    if (data.angles.filter(a => a.target).length === 0) {
        return {
            theorems: {
                solved: false,
                allSolved: false,
                score: 0,
                executionTime: 0,
                iterations: 0,
                solvedAngles: {},
            },
            equationHybrid: {
                solved: false,
                allSolved: false,
                score: 0,
                executionTime: 0,
                solution: {},
            },
            equationRref: {
                solved: false,
                allSolved: false,
                score: 0,
                executionTime: 0,
                solution: {},
            },
            solved: false,
            score: 0,
            executionTime: 0,
        };
    }

    const clonedData1 = shallowClone(data);
    const clonedData2 = shallowClone(data);
    const solvedWithTheorems = solveWithTheorems(clonedData2, options);
    const { hybrid, rref, solvedAngles: solvedAnglesWithEquations } = solveWithEquations(clonedData1, options);
    
    const results = {
        theorems: solvedWithTheorems,
        equationHybrid: hybrid,
        equationRref: rref,
        solvedAnglesWithEquations,
        solvedAnglesWithTheorems: solvedWithTheorems.solvedAngles,
        solved: solvedWithTheorems.solved || hybrid.solved || rref.solved,
        executionTime: solvedWithTheorems.executionTime + hybrid.executionTime + rref.executionTime,
        score: solvedWithTheorems.score || hybrid.score || rref.score,
    };
    
    console.log('solver results', results);
    return results;
};