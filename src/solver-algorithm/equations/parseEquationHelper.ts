/**
 * Shared helper functions for parsing linear equations
 * Used by both hybrid solver and RREF solver
 */

import { GREEK_LETTERS } from '@/data/constants';

export interface ParsedTerm {
  coefficient: number;
  variable: string | null; // null if it's a constant
  isConstant: boolean;
}

/**
 * Valid variable name pattern: Greek letters, normal letters (a-z), or letters + numbers (e.g., a0, b4, α0)
 */
const VALID_VARIABLE_PATTERN = new RegExp(
  `^[${GREEK_LETTERS.map(g => g.letter).join('')}a-z]\\d*$`,
  'i'
);

/**
 * Check if a string is a valid variable name
 */
export function isValidVariableName(varName: string): boolean {
  return VALID_VARIABLE_PATTERN.test(varName);
}

/**
 * Parse a single term from an equation side
 * Examples: 
 *   "5" -> { coefficient: 5, variable: null, isConstant: true }
 *   "2a" -> { coefficient: 2, variable: "a", isConstant: false }
 *   "-b" -> { coefficient: -1, variable: "b", isConstant: false }
 *   "α" -> { coefficient: 1, variable: "α", isConstant: false }
 *   "-3x" -> { coefficient: -3, variable: "x", isConstant: false }
 *   "a0" -> { coefficient: 1, variable: "a0", isConstant: false }
 *   "2b4" -> { coefficient: 2, variable: "b4", isConstant: false }
 */
export function parseTerm(
  term: string,
  variableValidator?: (varName: string) => boolean
): ParsedTerm {
  // Check if it's a numeric constant
  if (/^-?\d+(\.\d+)?$/.test(term)) {
    return {
      coefficient: Number(term),
      variable: null,
      isConstant: true,
    };
  }

  // Parse coefficient + variable
  // Match: optional sign/number, then variable name (Greek letter, normal letter, or letter+number)
  const match = term.match(/^(-?\d*)(.+)$/);
  if (!match) {
    throw new Error(`Invalid term: ${term}`);
  }

  const [, coeffStr, varName] = match;
  
  // Validate variable if validator provided (validator takes precedence)
  if (variableValidator) {
    if (!variableValidator(varName)) {
      throw new Error(`Unknown variable "${varName}"`);
    }
  } else {
    // Only validate pattern if no validator is provided
    // This ensures we enforce the pattern during variable extraction
    if (!isValidVariableName(varName)) {
      throw new Error(`Invalid variable name "${varName}". Must be a Greek letter, normal letter (a-z), or letter+number (e.g., a0, b4)`);
    }
  }

  // Parse coefficient
  let coefficient: number;
  if (coeffStr === "" || coeffStr === "+") {
    coefficient = 1;
  } else if (coeffStr === "-") {
    coefficient = -1;
  } else {
    coefficient = Number(coeffStr);
  }

  return {
    coefficient,
    variable: varName,
    isConstant: false,
  };
}

/**
 * Parse a side of an equation (LHS or RHS) into terms
 * @param side - The equation side to parse (e.g., "2a+3b-5" or "180")
 * @param sign - Sign multiplier (1 for LHS, -1 for RHS)
 * @param variableValidator - Optional function to validate variable names
 * @returns Array of parsed terms with coefficients already multiplied by sign
 */
export function parseEquationSide(
  side: string,
  sign: number,
  variableValidator?: (varName: string) => boolean
): ParsedTerm[] {
  return side
    .replace(/-/g, "+-")
    .split("+")
    .filter(Boolean)
    .map(term => {
      const parsed = parseTerm(term, variableValidator);
      // Apply sign to coefficient
      return {
        ...parsed,
        coefficient: parsed.coefficient * sign,
      };
    });
}

