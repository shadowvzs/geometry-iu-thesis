import { SolveData, SolveOptions, SolverResults } from "@/types";
import { solveWithTheorems } from "./theorems";
import { solveWithEquations } from "./equations";

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

    const solvedWithTheorems = solveWithTheorems(data, options);
    const { hybrid, rref } = solveWithEquations(data, options);
    
    const results = {
        theorems: solvedWithTheorems,
        equationHybrid: hybrid,
        equationRref: rref,
        solved: solvedWithTheorems.solved || hybrid.solved || rref.solved,
        executionTime: solvedWithTheorems.executionTime + hybrid.executionTime + rref.executionTime,
        score: solvedWithTheorems.score || hybrid.score || rref.score,
    };

    console.log('solver results', results);
    return results;
};