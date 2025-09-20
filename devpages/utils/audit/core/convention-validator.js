#!/usr/bin/env node

/**
 * convention-validator.js - Validates coding conventions with configurable rules
 */

import path from 'path';

export class ConventionValidator {
    constructor(conventions = []) {
        this.conventions = conventions;
    }

    validate(content, filePath) {
        const violations = [];
        const fileExt = path.extname(filePath);

        for (const convention of this.conventions) {
            // Skip if file type doesn't match
            if (convention.fileTypes && !convention.fileTypes.includes(fileExt)) {
                continue;
            }

            const matches = content.matchAll(convention.pattern);
            for (const match of matches) {
                violations.push({
                    file: filePath,
                    line: content.substring(0, match.index).split('\n').length,
                    convention: convention.name,
                    type: convention.name,
                    severity: convention.severity || 'medium',
                    suggestion: convention.suggestion,
                    match: match[0],
                    context: this.getContext(content, match.index)
                });
            }
        }

        return violations;
    }

    getContext(content, matchIndex) {
        const lines = content.substring(0, matchIndex).split('\n');
        const currentLine = lines[lines.length - 1];
        const remainingLine = content.substring(matchIndex).split('\n')[0];
        return (currentLine + remainingLine).trim();
    }

    addConvention(convention) {
        this.conventions.push(convention);
    }

    getApplicableConventions(filePath) {
        const fileExt = path.extname(filePath);
        return this.conventions.filter(conv =>
            !conv.fileTypes || conv.fileTypes.includes(fileExt)
        );
    }
}