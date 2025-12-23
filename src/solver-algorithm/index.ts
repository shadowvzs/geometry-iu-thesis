import { SolveData, SolveOptions, SolverResults } from "@/types";
import { solveWithTheorems } from "./theorems";
import { solveWithEquations } from "./equations";

export const solve = (data: SolveData, options: SolveOptions): SolverResults => {
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

    return results;
};