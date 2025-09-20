#!/usr/bin/env node

/**
 * React imports check - Detects forbidden React usage in vanilla JS project
 */

export const reactImportsCheck = {
    name: 'Forbidden React Imports',
    description: 'Finds imports from React, which is not used in this vanilla JS project.',
    pattern: /import .* from ['"](react|react-dom|react-redux)['"];/g,
    suggestion: "Remove React imports and replace with vanilla JS equivalents.",
    severity: 'critical'
};