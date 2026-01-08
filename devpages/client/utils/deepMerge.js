/**
 * Deep merge utility for state rehydration
 *
 * Recursively merges source object into target, preserving nested defaults
 * when source has missing properties.
 *
 * @param {object} target - Default/initial state with all expected properties
 * @param {object} source - Persisted state that may have missing nested properties
 * @returns {object} Merged state with all defaults preserved
 */
export function deepMerge(target, source) {
    // Handle null/undefined
    if (source === null || source === undefined) {
        return target;
    }
    if (target === null || target === undefined) {
        return source;
    }

    // If either is not an object, source wins
    if (typeof target !== 'object' || typeof source !== 'object') {
        return source;
    }

    // Arrays are not deep merged - source replaces target
    if (Array.isArray(source)) {
        return source;
    }

    const result = { ...target };

    for (const key of Object.keys(source)) {
        const sourceVal = source[key];
        const targetVal = target[key];

        if (
            sourceVal !== null &&
            typeof sourceVal === 'object' &&
            !Array.isArray(sourceVal) &&
            targetVal !== null &&
            typeof targetVal === 'object' &&
            !Array.isArray(targetVal)
        ) {
            // Both are objects - recurse
            result[key] = deepMerge(targetVal, sourceVal);
        } else {
            // Source wins for primitives, arrays, or when target isn't an object
            result[key] = sourceVal;
        }
    }

    return result;
}
