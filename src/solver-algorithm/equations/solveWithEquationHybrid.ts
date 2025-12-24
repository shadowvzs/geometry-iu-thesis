// =====================================================
// Hybrid Linear Equation Solver (AUTO VARIABLE DETECTION)
// SIMPLIFIED: NO TARGETED SOLVING
//
// Features:
// - Auto-detect variables (unicode, greek, multi-char)
// - Hybrid solving: symbolic substitution + RREF
// - Correct constant handling: sum(coeff_i * x_i) = constant
// - Floating-point cleanup (snap near-integers)
// =====================================================

import { SolvedEquation } from "@/types";
import { parseEquationSide, isValidVariableName } from "./parseEquationHelper";
import { GREEK_LETTERS } from '@/data/constants';

type LinearExpr = {
  coeffs: Map<string, number>;
  constant: number; // RHS
};

// Unified number formatting function (combines both approaches)
function formatNumber(x: number, eps = 1e-9): number {
  if (Math.abs(x) < 1e-12) return 0;
  const rounded = Math.abs(x - Math.round(x)) < eps ? Math.round(x) : x;
  return Math.round(rounded * 1e7) / 1e7;
}

// ---------- Extract variables automatically ----------
// Pattern: Greek letters, normal letters (a-z), or letters + numbers (e.g., a0, b4, α0)
function extractVariables(equations: string[]): string[] {
  const varSet = new Set<string>();
  // Match: letter (Greek or Latin) optionally followed by digits
  const greekLetters = GREEK_LETTERS.map(g => g.letter).join('');
  const variableRegex = new RegExp(`[${greekLetters}a-z]\\d*`, 'gi');

  for (const eq of equations) {
    const matches = eq.match(variableRegex);
    if (!matches) continue;
    for (const token of matches) {
      // Validate that it's a valid variable name (not just a number)
      if (isValidVariableName(token)) {
        varSet.add(token);
      }
    }
  }

  // longest-first avoids partial matching (alpha before a)
  return Array.from(varSet).sort((a, b) => b.length - a.length);
}

// ---------- Parse equation ----------
// Produces: sum(coeffs) = constant
function parseEquation(eq: string, variables: string[]): LinearExpr {
  const clean = eq.replace(/\s+/g, "");
  const [lhs, rhs] = clean.split("=");
  if (!lhs || !rhs) throw new Error("Invalid equation: " + eq);

  const expr: LinearExpr = { coeffs: new Map(), constant: 0 };
  const varSet = new Set(variables); // For O(1) lookup
  
  // Create validator function
  const validator = (varName: string) => varSet.has(varName);
  
  // Parse LHS (positive) and RHS (negative)
  const lhsTerms = parseEquationSide(lhs, 1, validator);
  const rhsTerms = parseEquationSide(rhs, -1, validator);
  
  // Combine all terms
  [...lhsTerms, ...rhsTerms].forEach(term => {
    if (term.isConstant) {
      expr.constant += term.coefficient;
    } else if (term.variable) {
      const current = expr.coeffs.get(term.variable) || 0;
      expr.coeffs.set(term.variable, current + term.coefficient);
    }
  });

  // normalize to sum(coeffs) = constant
  expr.constant *= -1;
  return expr;
}

// ---------- Symbolic substitution ----------
// Repeatedly applies equations of the form: x = constant
function substitute(equations: LinearExpr[]) {
  const solution: Record<string, number> = {};
  let steps = 0;
  let changed = true;

  while (changed) {
    changed = false;

    for (let i = 0; i < equations.length; i++) {
      const eq = equations[i];

      if (eq.coeffs.size === 1) {
        const [[v, c]] = eq.coeffs.entries();
        if (c !== 1) continue;

        const value = eq.constant;
        solution[v] = value;
        equations.splice(i, 1);
        steps++;
        changed = true;

        for (const other of equations) {
          if (other.coeffs.has(v)) {
            const k = other.coeffs.get(v)!;
            other.constant -= k * value;
            other.coeffs.delete(v);
          }
        }
        break;
      }
    }
  }

  return { reduced: equations, solution, steps };
}

// ---------- Build augmented matrix ----------
function buildMatrix(equations: LinearExpr[]) {
  const vars = new Set<string>();
  equations.forEach((e) => e.coeffs.forEach((_, v) => vars.add(v)));

  const variables = Array.from(vars).sort();
  const index: Record<string, number> = {};
  variables.forEach((v, i) => (index[v] = i));

  const matrix = equations.map((e) => {
    const row = new Array(variables.length + 1).fill(0);
    e.coeffs.forEach((c, v) => (row[index[v]] = c));
    row[row.length - 1] = e.constant;
    return row;
  });

  return { matrix, variables };
}

// ---------- RREF (Gauss–Jordan) ----------
function rref(matrix: number[][], eps = 1e-10) {
  const A = matrix.map((r) => r.slice());
  let steps = 0;
  let lead = 0;

  for (let r = 0; r < A.length; r++) {
    if (lead >= A[0].length - 1) break;

    let i = r;
    while (Math.abs(A[i][lead]) < eps) {
      i++;
      if (i === A.length) {
        i = r;
        lead++;
        if (lead >= A[0].length - 1) return { rref: A, steps };
      }
    }

    // swap
    [A[i], A[r]] = [A[r], A[i]];
    steps++;

    // normalize
    const lv = A[r][lead];
    for (let j = 0; j < A[0].length; j++) A[r][j] /= lv;
    steps++;

    // eliminate
    for (let i2 = 0; i2 < A.length; i2++) {
      if (i2 !== r) {
        const lv2 = A[i2][lead];
        if (Math.abs(lv2) > eps) {
          for (let j = 0; j < A[0].length; j++) {
            A[i2][j] -= lv2 * A[r][j];
          }
          steps++;
        }
      }
    }

    lead++;
  }

  return { rref: A, steps };
}

// ---------- Phase 3: Final evaluation ----------
// If an equation has exactly one unknown left, compute it.
function finalEvaluate(equations: LinearExpr[], known: Record<string, number>) {
  let progress = true;
  while (progress) {
    progress = false;
    for (const eq of equations) {
      const unknowns = Array.from(eq.coeffs.keys()).filter(
        (v) => known[v] === undefined
      );
      if (unknowns.length === 1) {
        const v = unknowns[0];
        const coeff = eq.coeffs.get(v);
        if (!coeff || Math.abs(coeff) < 1e-10) continue; // Skip if coefficient is zero
        let rhs = eq.constant;
        for (const [name, c] of eq.coeffs.entries()) {
          if (name !== v) {
            const value = known[name];
            if (value !== undefined && !isNaN(value)) {
              rhs -= c * value;
            }
          }
        }
        const result = rhs / coeff;
        if (!isNaN(result) && isFinite(result)) {
          known[v] = result;
          progress = true;
        }
      }
    }
  }
}

// ---------- Hybrid Solve (FINAL API) ----------
export function solveWithEquationHybrid(equations: string[], targets: string[]) {
  const startTime = performance.now();
  const variables = extractVariables(equations);
  const parsed = equations.map((eq) => parseEquation(eq, variables));

  const sub = substitute(parsed);
  const { matrix, variables: reducedVars } = buildMatrix(sub.reduced);

  const known: Record<string, number> = { ...sub.solution };

  // If anything remains, use RREF
  if (matrix.length > 0 && reducedVars.length > 0) {
    const numeric = rref(matrix);

    // extract solved variables from RREF rows
    for (const row of numeric.rref) {
      for (let i = 0; i < reducedVars.length; i++) {
        if (
          Math.abs(row[i] - 1) < 1e-9 &&
          row
            .slice(0, reducedVars.length)
            .every((v, j) => j === i || Math.abs(v) < 1e-9)
        ) {
          known[reducedVars[i]] = row[row.length - 1];
        }
      }
    }
  }

  // Phase 3 (useful when system collapses after substitution or partial RREF)
  finalEvaluate(sub.reduced, known);

  // cleanup near-integers
  for (const k of Object.keys(known)) {
    known[k] = formatNumber(known[k]);
  }

  // const numSolved = Object.keys(known).length;
  const totalVars = variables.length;
  const score = totalVars;
  const solved = targets.every(target => known[target] !== undefined);
  const allSolved = Object.values(known).length === variables.length;

  const result: SolvedEquation = {
    solved,
    allSolved,
    score,
    executionTime: performance.now() - startTime,
    solution: known,
  };

  return result;
}
