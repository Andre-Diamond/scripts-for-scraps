/**
 * Recursively removes empty values (empty strings, empty arrays) from an object
 * @param obj The object to clean
 * @returns A new object with empty values removed
 */
export function removeEmptyValues<T>(obj: T): T {
    // Return non-objects as is
    if (obj === null || typeof obj !== 'object') {
        return obj;
    }

    // Handle arrays - recursively clean each item and filter out empty ones
    if (Array.isArray(obj)) {
        // First clean each array item
        const cleanedArray = obj.map(item => removeEmptyValues(item));
        // Then filter out empty items (null, undefined, empty strings, empty arrays, empty objects)
        return cleanedArray.filter(item => {
            if (item === null || item === undefined || item === '') {
                return false;
            }
            if (Array.isArray(item) && item.length === 0) {
                return false;
            }
            if (typeof item === 'object' && Object.keys(item).length === 0) {
                return false;
            }
            return true;
        }) as unknown as T;
    }

    // Handle regular objects
    const result = {} as Record<string, unknown>;

    // Process each key in the object
    for (const key of Object.keys(obj)) {
        const value = (obj as Record<string, unknown>)[key];

        // Skip empty strings
        if (value === '') {
            continue;
        }

        // Skip empty arrays
        if (Array.isArray(value) && value.length === 0) {
            continue;
        }

        // For non-empty arrays and objects, clean them recursively
        const cleanedValue = removeEmptyValues(value);

        // Only include non-empty values
        if (cleanedValue === null || cleanedValue === undefined) {
            continue;
        }

        // Skip empty objects
        if (typeof cleanedValue === 'object' && !Array.isArray(cleanedValue) && Object.keys(cleanedValue).length === 0) {
            continue;
        }

        // Add the cleaned value to the result
        result[key] = cleanedValue;
    }

    return result as unknown as T;
} 