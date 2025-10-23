import fs from 'fs/promises';

// Colors for different node types in visualization
const COLORS = {
    BEFORE: '#a8e6cf',       // Soft mint green for parent context
    TARGET: '#ffaaa5',       // Soft pink for the target node
    TARGET_CHILDREN: '#ffd3b6' // Soft peach for children
};

// Collect debug logs (written to stderr)
let debugLogs = [];

// Debug function that writes to stderr
function debug(...args) {
    debugLogs.push(args.join(' '));
    console.error(...args);
}

/**
 * Recursively builds the result tree, including 'beforeDepth' levels of parents 
 * and 'childrenDepth' levels of children, defaulting to Infinity when 0 is specified.
 */
function findNodes(node, selector, beforeDepth = Infinity, childrenDepth = Infinity, currentPath = []) {
    debug(`Checking ${node.tag} at path depth ${currentPath.length}`);
    debug(`Classes: ${node.classes ? node.classes.join(', ') : 'none'}`);

    // Determine if the selector is for a class or an ID
    const isClassSelector = selector.startsWith('.');
    const isIdSelector = selector.startsWith('#');
    const selectorValue = selector.replace(/^[.#]/, '').trim();

    // Check if the node matches the selector
    let matchesSelector = false;
    if (isClassSelector) {
        matchesSelector = (node.classes || []).includes(selectorValue);
        if (matchesSelector) {
            debug(`Found class "${selectorValue}" at path depth ${currentPath.length}`);
        }
    } else if (isIdSelector) {
        matchesSelector = node.id === selectorValue;
        if (matchesSelector) {
            debug(`Found id "${selectorValue}" at path depth ${currentPath.length}`);
        }
    }

    // If we found a match, build the structure
    if (matchesSelector) {
        // Build up the "before" context from the current path
        const contextPath = [...currentPath, node];
        const startIndex = Math.max(0, contextPath.length - beforeDepth);
        const relevantPath = contextPath.slice(startIndex);

        debug(`Creating context with beforeDepth=${beforeDepth}, childrenDepth=${childrenDepth}`);

        // Build the final structure by traversing the relevant parent path
        const treeWithParents = relevantPath.reduceRight((child, parent, index) => {
            if (index === relevantPath.length - 1) {
                // The matched node is the last element in the path array
                return copyNode(parent, 'TARGET', childrenDepth);
            }
            // This is a parent node in the path
            return {
                ...copyMinimalNode(parent, 'BEFORE'),
                // The parent's only "child" in context is the child from the deeper level
                children: [child]
            };
        }, null);

        return treeWithParents;
    }

    // If we didn't match this node, check children
    if (node.children && node.children.length > 0) {
        for (const child of node.children) {
            const result = findNodes(child, selector, beforeDepth, childrenDepth, [...currentPath, node]);
            if (result) {
                return result;
            }
        }
    }

    return null;
}

/**
 * Copies the node fully but marks the nodeType for coloring, also recurses to copy children up to 'depth' levels.
 * nodeType should be one of: BEFORE, TARGET, TARGET_CHILDREN
 */
function copyNode(node, nodeType, depth) {
    // If depth is 0 or negative, we don't copy children (except if it's 0 meaning Infinity per the spec)
    // By user request, a "0" means "infinity" so we interpret it as Infinity stored earlier.
    if (depth <= 0) {
        return copyMinimalNode(node, nodeType);
    }

    // Clone the essential fields
    const cloned = copyMinimalNode(node, nodeType);

    // Recursively clone children
    if (node.children) {
        cloned.children = node.children.map(child => 
            copyNode(child, nodeType === 'TARGET' ? 'TARGET_CHILDREN' : nodeType, depth - 1)
        );
    }
    return cloned;
}

/**
 * Copies minimal fields from the parent node, but adds a marker to color it (nodeType).
 */
function copyMinimalNode(node, nodeType) {
    return {
        tag: node.tag,
        id: node.id,
        classes: node.classes,
        attributes: node.attributes,
        nodeType, // Mark for coloring
        children: []
    };
}

/**
 * Convert a node to HTML representation with collapsible tree structure. 
 * Colors nodes based on node.nodeType to show BEFORE, TARGET, or TARGET_CHILDREN.
 */
function nodeToHTML(node) {
    if (!node) return ''; // Handle null or undefined nodes gracefully

    const backgroundColor = node.nodeType ? COLORS[node.nodeType] : 'transparent';
    const classes = node.classes ? node.classes.join(' ') : '';
    return `
    <details open>
        <summary style="background-color: ${backgroundColor}; padding: 5px; margin: 2px; border-radius: 4px;">
            ${node.tag} ${classes ? `class="${classes}"` : ''} 
            ${node.id ? `id="${node.id}"` : ''}
        </summary>
        ${node.children ? node.children.map(child => nodeToHTML(child)).join('\n') : ''}
    </details>
    `;
}

/**
 * Create HTML document with debug info and visualization
 */
function createHTMLOutput(result, debugLogs) {
    return `
    <!DOCTYPE html>
    <html>
    <head>
        <title>DOM Tree Visualization</title>
        <style>
            body { font-family: monospace; margin: 20px; }
            .debug-log { 
                background: #f0f0f0; 
                padding: 10px; 
                margin: 10px 0; 
                max-height: 300px; 
                overflow-y: auto; 
            }
            details { margin-left: 20px; }
            summary { cursor: pointer; }
            .legend {
                display: flex;
                gap: 20px;
                margin: 10px 0;
            }
            .legend-item {
                display: flex;
                align-items: center;
                gap: 5px;
            }
            .color-box {
                width: 20px;
                height: 20px;
                border-radius: 4px;
            }
            .container {
                display: flex;
                justify-content: space-between;
            }
            .left-pane, .right-pane {
                width: 48%;
            }
            .form-section {
                margin-bottom: 20px;
            }
            .form-row {
                margin-bottom: 10px;
            }
        </style>
    </head>
    <body>
        <h1>DOM Tree Visualization</h1>
        
        <div class="legend">
            <div class="legend-item">
                <div class="color-box" style="background: ${COLORS.BEFORE}"></div>
                <span>Parent Context</span>
            </div>
            <div class="legend-item">
                <div class="color-box" style="background: ${COLORS.TARGET}"></div>
                <span>Target Node</span>
            </div>
            <div class="legend-item">
                <div class="color-box" style="background: ${COLORS.TARGET_CHILDREN}"></div>
                <span>Children</span>
            </div>
        </div>

        <div class="container">
            <!-- Left Pane with Tree View and Debug Log -->
            <div class="left-pane">
                <div class="form-section">
                    <div class="form-row">
                        <label for="selector">Selector:</label>
                        <input id="selector" value=".game-container" />
                    </div>
                    <div class="form-row">
                        <label for="parentDepth">Parent Depth:</label>
                        <input id="parentDepth" value="2" />
                    </div>
                    <div class="form-row">
                        <label for="childDepth">Child Depth:</label>
                        <input id="childDepth" value="0" />
                    </div>
                    <div class="form-row">
                        <label for="analysisSelect">Quick Targets:</label>
                        <select id="analysisSelect">
                            <option value="game-container">game-container</option>
                            <option value="game-iframe">game-iframe</option>
                            <option value="body">body</option>
                        </select>
                    </div>
                    <div class="form-row">
                        <button onclick="doSearch()">Enter</button>
                    </div>
                </div>

                <details>
                    <summary>Debug Log</summary>
                    <pre class="debug-log">${debugLogs.join('\n')}</pre>
                </details>

                <h3>Tree View</h3>
                ${result ? nodeToHTML(result) : '<p>No result</p>'}
            </div>

            <!-- Right Pane with iFrame -->
            <div class="right-pane">
                <div class="form-section">
                    <label>iFrame src:</label>
                    <input id="iframeSrc" oninput="updateIframeSrc()" placeholder="https://example.com" style="width: 100%;" />
                </div>
                <iframe id="previewFrame" src="" style="width:100%; height:600px; border:1px solid #999;"></iframe>
            </div>
        </div>

        <script>
            function doSearch() {
                const selector = document.getElementById('selector').value.trim();
                const parentDepth = document.getElementById('parentDepth').value.trim();
                const childDepth = document.getElementById('childDepth').value.trim();
                const quickTarget = document.getElementById('analysisSelect').value;

                // Example: forming a JSON body to POST to an API
                const body = {
                    analysisId: "my-analysis",
                    selector: selector || '.game-container',
                    parentDepth: parseInt(parentDepth, 10) || 0,
                    childDepth: parseInt(childDepth, 10) || 0
                };

                // Optional usage of the quick target just as a demonstration
                console.log("Quick target chosen:", quickTarget);

                // Example fetch call
                // This won't work unless you have a server listening on localhost:2650
                fetch('http://localhost:2650/api/search', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-api-key': 'gridranger'
                    },
                    body: JSON.stringify(body)
                })
                .then(r => r.json())
                .then(resp => {
                    console.log("Response from server:", resp);
                    alert("Simulated POST completed. Check console for response.");
                })
                .catch(err => {
                    console.error("Error during fetch:", err);
                });
            }

            function updateIframeSrc() {
                const val = document.getElementById('iframeSrc').value;
                const frame = document.getElementById('previewFrame');
                frame.src = val;
            }
        </script>

    </body>
    </html>
    `;
}

/**
 * Main CLI handler.
 */
async function main() {
    const [,, filePath, selector, beforeDepthStr = '0', childrenDepthStr = '0', outputPath] = process.argv;

    // Interpret '0' as Infinity per user request
    const beforeDepth = beforeDepthStr === '0' ? Infinity : parseInt(beforeDepthStr, 10);
    const childrenDepth = childrenDepthStr === '0' ? Infinity : parseInt(childrenDepthStr, 10);

    // Clear logs each run
    debugLogs = [];

    try {
        const data = await fs.readFile(filePath, 'utf8');
        const jsonData = JSON.parse(data);

        debug(`Starting search with selector="${selector}", beforeDepth=${beforeDepth}, childrenDepth=${childrenDepth}`);
        const result = findNodes(jsonData.data, selector, beforeDepth, childrenDepth);

        // Output JSON to stdout
        console.log(JSON.stringify(result, null, 2));

        // If outputPath is provided, generate an HTML file
        if (outputPath) {
            const html = createHTMLOutput(result, debugLogs);
            await fs.writeFile(outputPath, html);
            debug(`HTML visualization written to ${outputPath}`);
        }
    } catch (err) {
        debug('Error:', err);
        process.exit(1);
    }
}

// Directly call main() to execute when the script is run
main();

/* ----------------------------------------
   Exports for testing or further composition
   ---------------------------------------- */
export { 
    findNodes, 
    main, 
    createHTMLOutput, 
    debugLogs 
};
