import { AugmentedMatrixResult, SolvedEquation } from "@/types";

// Unified number formatting function (same as hybrid solver)
function formatNumber(x: number, eps = 1e-9): number {
    if (Math.abs(x) < 1e-12) return 0;
    const rounded = Math.abs(x - Math.round(x)) < eps ? Math.round(x) : x;
    return Math.round(rounded * 1e7) / 1e7;
}

export function rref(matrix: number[][]) {
    const m = matrix.length;
    const n = matrix[0].length;
    let A = matrix.map(row => row.slice());
    let lead = 0;
    for (let r = 0; r < m; r++) {
        if (lead >= n)
            return A;
        let i = r;
        while (Math.abs(A[i][lead]) < 1e-12) {
            i++;
            if (i === m) {
                i = r;
                lead++;
                if (lead === n)
                    return A;
            }
        }
        let tmp = A[i];
        A[i] = A[r];
        A[r] = tmp;
        let val = A[r][lead];
        for (let j = 0; j < n; j++)
            A[r][j] /= val;
        for (let i = 0; i < m; i++) {
            if (i !== r) {
                let fac = A[i][lead];
                for (let j = 0; j < n; j++) {
                    A[i][j] -= fac * A[r][j];
                }
            }
        }
        lead++;
    }
    for (let i = 0; i < m; i++)
        for (let j = 0; j < n; j++)
            if (Math.abs(A[i][j]) < 1e-12) A[i][j] = 0;
    return A;
}

export function extractPartialSolution(rrefMatrix: number[][], variableNames: string[]) {
    const eps = 1e-10;
    const m = rrefMatrix.length;
    const n = rrefMatrix[0].length;
    const numVars = n - 1;
    let pivotRows = Array(m).fill(-1); // pivot col for each row
    let pivotCols = [];
    let usedRows = Array(m).fill(false);
    let inconsistent = false;
    for (let i = 0; i < m; i++) {
        let onlyZero = true;
        for (let j = 0; j < numVars; j++)
            if (Math.abs(rrefMatrix[i][j]) > eps) onlyZero = false;
        if (onlyZero && Math.abs(rrefMatrix[i][numVars]) > eps)
            inconsistent = true;
    }
    if (inconsistent) {
        return {
            type: "none",
            uniqueVars: {},
            freeVars: [],
            info: "No solution: inconsistent system"
        };
    }
    for (let i = 0; i < m; i++) {
        for (let j = 0; j < numVars; j++) {
            if (!usedRows[i] && Math.abs(rrefMatrix[i][j] - 1) < eps) {
                let onlyOne = true;
                for (let k = 0; k < m; k++)
                    if (k !== i && Math.abs(rrefMatrix[k][j]) > eps) onlyOne = false;
                if (onlyOne && pivotCols.indexOf(j) === -1) {
                    pivotCols.push(j);
                    pivotRows[i] = j;
                    usedRows[i] = true;
                    break;
                }
            }
        }
    }
    let freeVars = [];
    for (let i = 0; i < numVars; i++) {
        if (pivotCols.indexOf(i) === -1)
            freeVars.push(variableNames[i] || ("x"+(i+1)));
    }
    let uniqueVars: Record<string, number> = {};
    for (let r = 0; r < m; r++) {
        let pivotCol = pivotRows[r];
        if (pivotCol >= 0) {
            const key = variableNames[pivotCol] || ("x"+(pivotCol+1));
            uniqueVars[key] = formatNumber(rrefMatrix[r][numVars]);
        }
    }
    if (freeVars.length === 0 && pivotCols.length === numVars) {
        return {
            type: "unique",
            uniqueVars: uniqueVars,
            freeVars: [],
            info: "Unique solution"
        };
    } else {
        let msg = "Infinite solutions.<br>";
        if (Object.keys(uniqueVars).length > 0)
            msg += "Unique variables:<br>&nbsp;&nbsp;" + Object.entries(uniqueVars).map(([v,vv]) => v + " = " + vv).join("; ") + "<br>";
        if (freeVars.length > 0)
            msg += "Free variables:<br>&nbsp;&nbsp;" + freeVars.join(", ");
        return {
            type: "infinite",
            uniqueVars: uniqueVars,
            freeVars: freeVars,
            info: msg
        };
    }
}

export function solveWithEquationsRREF(augmentedMatrix: AugmentedMatrixResult, targets: string[]): SolvedEquation {
    const startTime = performance.now();
    const rrefMatrix = rref(augmentedMatrix.augmentedMatrix);
    const partialSolution = extractPartialSolution(rrefMatrix, augmentedMatrix.variables);
    
    // Convert to unified format
    const solution: Record<string, number> = {};
    if (partialSolution.type === "unique" || partialSolution.type === "infinite") {
        Object.assign(solution, partialSolution.uniqueVars);
    }
    
    // const numSolved = Object.keys(solution).length;
    const totalVars = augmentedMatrix.variables.length;
    const solved = targets.every(target => solution[target] !== undefined);
    const allSolved = Object.values(solution).every(value => value !== undefined);
    const score = totalVars;
    
    return {
        solved,
        allSolved,
        score,
        executionTime: performance.now() - startTime,
        solution,
    };
}