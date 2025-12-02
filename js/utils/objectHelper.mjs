/**
 * Object utility functions
 * Provides helper functions for object manipulation
 */

/**
 * Creates a deep clone of an object or array using JSON serialization
 * Note: Does not preserve functions, undefined, symbols, Date, Set, Map, or other special objects
 * @param {*} obj - The object to clone
 * @returns {*} A deep copy of the object
 */
export function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
}

