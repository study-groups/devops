// Helper for logging within this module
function logFrontmatterParser(message, level = 'debug') {
    const prefix = '[FrontmatterParser]';
    if (typeof window.logMessage === 'function') {
        // Assuming a global logMessage function might exist
        window.logMessage(`${prefix} ${message}`, level, 'FRONTMATTER_PARSER');
    } else {
        const logFunc = level === 'error' ? console.error : (level === 'warn' ? console.warn : console.log);
        logFunc(`${prefix} ${message}`);
    }
}

/**
 * Parse frontmatter from markdown
 * @param {string} markdownContent - Raw markdown content
 * @returns {{frontMatter: object, body: string}}
 */
export function parseFrontmatter(markdownContent) {
    logFrontmatterParser('Attempting to parse frontmatter (v5 - array focus)...', 'debug');
    const fmRegex = /^---\s*([\s\S]*?)\s*---\s*/;
    const match = markdownContent.match(fmRegex);

    let frontMatterData = {};
    let markdownBody = markdownContent;

    if (match && match[1]) {
        const yamlContent = match[1];
        markdownBody = markdownContent.substring(match[0].length);
        logFrontmatterParser(`Found frontmatter block. Length: ${yamlContent.length}`, 'debug');

        try {
            const lines = yamlContent.split('\n');
            let currentKey = null;
            let currentValue = []; // Used for block scalars
            let baseIndent = -1;
            let isParsingArray = false;
            let arrayKey = null;
            let arrayValues = []; 

            lines.forEach(line => {
                const trimmedLine = line.trim();
                const currentIndent = line.search(/\S/);

                if (!trimmedLine || trimmedLine.startsWith('#')) return;

                if (isParsingArray && trimmedLine.startsWith('-')) {
                    const itemValue = trimmedLine.substring(1).trim();
                    const finalItem = (itemValue.startsWith('"') && itemValue.endsWith('"')) || (itemValue.startsWith("'") && itemValue.endsWith("'")) 
                                        ? itemValue.substring(1, itemValue.length - 1) 
                                        : itemValue;
                    arrayValues.push(finalItem);
                    return; 
                }

                if (currentKey && !isParsingArray && currentIndent >= baseIndent) { 
                    if (baseIndent === -1) { baseIndent = currentIndent; }
                    currentValue.push(line.substring(baseIndent)); 
                    return; 
                }
                
                let finalizePrevious = false;
                if (isParsingArray && (!trimmedLine.startsWith('-') || currentIndent < baseIndent)) {
                   finalizePrevious = true;
                } else if (currentKey && currentIndent < baseIndent) { 
                   finalizePrevious = true;
                } else if (!isParsingArray && !currentKey && line.includes(':')) { 
                   finalizePrevious = true; 
                }
                
                if(finalizePrevious){
                    if (isParsingArray && arrayKey) {
                        frontMatterData[arrayKey] = arrayValues; 
                        logFrontmatterParser(`Finished array for key: ${arrayKey}: ${JSON.stringify(arrayValues)}`, 'debug');
                    } else if (currentKey) { 
                        frontMatterData[currentKey] = currentValue.join('\n').trim();
                        logFrontmatterParser(`Finished block scalar for key: ${currentKey}`, 'debug');
                    }
                    isParsingArray = false;
                    arrayKey = null;
                    arrayValues = [];
                    currentKey = null;
                    currentValue = [];
                    baseIndent = -1;
                }

                const separatorIndex = line.indexOf(':');
                if (separatorIndex > 0 && !isParsingArray && !currentKey) { 
                    const key = line.substring(0, separatorIndex).trim();
                    let valueStr = line.substring(separatorIndex + 1).trim();

                    if ((key === 'js_includes' || key === 'css_includes') && valueStr === '') {
                        isParsingArray = true;
                        arrayKey = key;
                        arrayValues = []; 
                        baseIndent = currentIndent + 1; 
                        logFrontmatterParser(`Starting array for key: ${key}`, 'debug');
                    } else if ((key === 'css' || key === 'script') && (valueStr === '|' || valueStr === '>')) {
                        currentKey = key;
                        currentValue = [];
                        baseIndent = -1; 
                        logFrontmatterParser(`Starting block scalar for key: ${key}`, 'debug');
                    } else {
                        let parsedValue = valueStr;
                        if ((valueStr.startsWith('"') && valueStr.endsWith('"')) || (valueStr.startsWith("'") && valueStr.endsWith("'"))) {
                             parsedValue = valueStr.substring(1, valueStr.length - 1);
                        } else if (valueStr === 'true') { parsedValue = true; }
                        else if (valueStr === 'false') { parsedValue = false; }
                        else if (!isNaN(valueStr) && valueStr.trim() !== '') {
                             const num = Number(valueStr);
                             if (!isNaN(num)) { parsedValue = num; }
                        }
                        frontMatterData[key] = parsedValue;
                    }
                } else if (!isParsingArray && !currentKey) {
                    logFrontmatterParser(`Skipping line (no colon or mid-array/block): ${line}`, 'warn');
                }
            });

            if (isParsingArray && arrayKey) {
                frontMatterData[arrayKey] = arrayValues;
                logFrontmatterParser(`Finished array for key (end of block): ${arrayKey}: ${JSON.stringify(arrayValues)}`, 'debug');
            } else if (currentKey) {
                frontMatterData[currentKey] = currentValue.join('\n').trim();
                logFrontmatterParser(`Finished block scalar for key (end of block): ${currentKey}`, 'debug');
            }

        } catch (error) {
            logFrontmatterParser(`Error parsing frontmatter: ${error}`, 'error');
            frontMatterData = {}; 
            markdownBody = markdownContent; 
        }
    } else {
         logFrontmatterParser('No frontmatter block found.', 'debug');
    }

    logFrontmatterParser(`FINAL Parsed Data: ${JSON.stringify(frontMatterData)}`, 'debug');
    return { frontMatter: frontMatterData, body: markdownBody };
} 