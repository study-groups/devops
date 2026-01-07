class LogDetails {
    constructor(logService) {
        this.logService = logService;
        this.codeViewer = null; // To hold the DevWatchCodeViewer instance
    }

    render(log) {
        const originalLog = log._original || log;
        const from = `${originalLog.module || 'unknown'}.${originalLog.action || 'unknown'}`;
        
        // The stack is now consistently in details.stack
        const stack = originalLog.details ? originalLog.details.stack : undefined;
        
        // Filter out stack and other metadata from the main data view
        const detailsData = { ...(originalLog.details || {}) };
        delete detailsData.stack;
        delete detailsData.level;
        delete detailsData.userAgent;
        delete detailsData.timestamp;
        delete detailsData.currentPage;

        const dataString = Object.keys(detailsData).length > 0 
            ? JSON.stringify(detailsData, null, 2) 
            : 'No additional details.';

        const stackTraceHtml = stack && Array.isArray(stack)
            ? this.formatStackWithLinks(stack) 
            : 'No stack trace available.';

        return `
            <div class="log-details-header">
                <span class="log-details-label">From:</span> ${this.escapeHtml(from)}
            </div>
            <div class="log-details-body">
                <div class="log-details-column log-stack-trace">
                    <h4>Stack Trace</h4>
                    <div class="stack-container">${stackTraceHtml}</div>
                </div>
                <div class="log-details-column log-data-details">
                    <div class="log-details-column-header">
                        <h4>Details</h4>
                        <button class="btn-copy-log-data devwatch-btn devwatch-btn-ghost" data-log-data="${this.escapeHtml(dataString)}">
                            Copy
                        </button>
                    </div>
                    <pre>${this.escapeHtml(dataString)}</pre>
                </div>
            </div>
            <div class="log-file-preview-container">
                <!-- DevWatchCodeViewer will be instantiated here -->
            </div>
        `;
    }

    formatStackWithLinks(stack) {
        return stack.map((frame) => {
            if (typeof frame === 'object' && frame !== null && frame.file && frame.file !== 'unknown') {
                const { function: funcName, file, line } = frame;
                const displayFunc = funcName || 'anonymous';
                const displayFile = `${file}:${line}`;
                
                return `
                    <div class="stack-frame">
                        <span class="stack-function">at ${this.escapeHtml(displayFunc)}</span>
                        <a href="#" class="stack-trace-link" data-file="${this.escapeHtml(file)}" data-line="${line}">
                            (${this.escapeHtml(displayFile)})
                        </a>
                    </div>
                `;
            } else if (frame.raw) {
                // Handle raw string frames if they exist
                return `<div class="stack-frame-raw">${this.escapeHtml(frame.raw)}</div>`;
            }
            return '';
        }).join('');
    }

    async openFileInEditor(filePath, lineNumber, detailsContainer) {
        const previewContainer = detailsContainer.querySelector('.log-file-preview-container');
        const detailsBody = detailsContainer.querySelector('.log-details-body');

        if (!previewContainer || !detailsBody) {
            console.error('Could not find required containers for file preview.');
            return;
        }

        // Hide details, show preview
        detailsBody.style.display = 'none';
        previewContainer.style.display = 'block';

        // Define actions for the code viewer header
        const actions = [
            {
                id: 'ast',
                label: 'View AST',
                callback: (extraContainer) => this.handleAstView(filePath, lineNumber, extraContainer)
            },
            {
                id: 'cot',
                label: 'View CoT',
                callback: (extraContainer) => this.handleCotView(filePath, lineNumber, extraContainer)
            }
        ];

        // Instantiate the code viewer with title and actions
        this.codeViewer = new DevWatchCodeViewer({ 
            container: previewContainer,
            title: filePath,
            actions: actions,
            highlightLine: lineNumber,
            onClose: () => {
                // Hide preview, show details
                previewContainer.style.display = 'none';
                previewContainer.innerHTML = ''; // Clear content
                detailsBody.style.display = ''; // Restore default display
                this.codeViewer = null;
            }
        });

        this.codeViewer.showLoading(); // This will be replaced by the render call below

        try {
            const content = await this.logService.fetchFileContent(filePath);
            this.codeViewer.render(content, lineNumber);
        } catch (error) {
            console.error('Failed to open file in editor:', error);
            this.codeViewer.showError(`Failed to load file: ${error.message}`);
        }
    }

    // This is now an instance method that gets called by an event listener
    // that is attached in the LogViewer class, which has access to the LogDetails instance.
    handleStackTraceClick(event) {
        const link = event.target.closest('.stack-trace-link');
        if (link) {
            event.preventDefault();
            const filePath = link.dataset.file;
            const line = link.dataset.line;
            const detailsContainer = link.closest('.log-details-container'); // Assumes this class is on the top-level container
            if (filePath && line && detailsContainer) {
                this.openFileInEditor(filePath, line, detailsContainer);
            }
        }
    }

    async handleAstView(filePath, lineNumber, container) {
        container.innerHTML = '<div class="loading">Loading AST...</div>';
        try {
            const astData = await this.logService.fetchAst(filePath, lineNumber);
            // Assuming you have an AstViewer component available
            const astViewer = new AstViewer(container, filePath, lineNumber, astData);
            await astViewer.render();
        } catch (error) {
            container.innerHTML = `<div class="error">Error loading AST: ${error.message}</div>`;
        }
    }

    async handleCotView(filePath, lineNumber, container) {
        container.innerHTML = '<div class="loading">Analyzing TYPE.MODULE.ACTION...</div>';
        try {
            const astData = await this.logService.fetchAst(filePath, lineNumber);
            this.generateChainOfThought(filePath, lineNumber, astData, container);
        } catch (error) {
            container.innerHTML = `<div class="error">Error loading analysis: ${error.message}</div>`;
        }
    }

    // This function and its helpers are adapted from the old ColumnView to provide a richer CoT display.
    generateChainOfThought(filePath, lineNum, astData, container) {
        const relativePath = filePath.startsWith('server/') ? filePath : `server/${filePath}`;
        const parts = relativePath.replace(/\\/g, '/').split('/');
        
        let type, module, action;
        let typeSource, moduleSource, actionSource;

        const explicitMeta = astData?.explicitMeta || {};

        // Determine TYPE
        if (explicitMeta.TYPE) {
            type = explicitMeta.TYPE;
            typeSource = 'explicit @pja.meta';
        } else if (astData.sourceContext?.type) {
            type = astData.sourceContext.type.value;
            typeSource = astData.sourceContext.type.source;
        } else {
            type = parts[1]?.toUpperCase() || 'UNKNOWN';
            typeSource = 'heuristic from file path';
        }

        // Determine MODULE
        if (explicitMeta.MODULE) {
            module = explicitMeta.MODULE;
            moduleSource = 'explicit @pja.meta';
        } else if (astData.sourceContext?.module) {
            const moduleAnalysis = astData.sourceContext.module;
            module = moduleAnalysis.value;
            moduleSource = moduleAnalysis.source;
        } else {
            module = (parts.slice(2, -1).join('.') || parts[parts.length - 1]?.replace('.js', ''))?.toUpperCase() || 'UNKNOWN';
            moduleSource = 'fallback heuristic from file path';
        }

        let actionStepHtml = '';
        if (astData && astData.success) {
            if (explicitMeta.ACTION) {
                action = explicitMeta.ACTION;
                actionSource = 'explicit @pja.meta';
                actionStepHtml = `
                    <p>AST analysis complete.</p>
                    <p>Explicit action found: <strong>${this.escapeHtml(action)}</strong> <em>(via ${actionSource})</em></p>
                    <div class="cot-result">ACTION = <span class="cot-value">${this.escapeHtml(action.toUpperCase())}</span></div>`;
            } else if (astData.sourceContext?.action) {
                const actionAnalysis = astData.sourceContext.action;
                action = actionAnalysis.value;
                actionSource = actionAnalysis.source;
                actionStepHtml = `
                    <p>Advanced action analysis complete.</p>
                    <p>Action found: <strong>${this.escapeHtml(action)}</strong></p>
                    <p>Source: <strong>${actionSource}</strong></p>
                    <p>Confidence: <strong>${actionAnalysis.confidence}</strong></p>
                    ${actionAnalysis.details ? `
                        <p>Scope: lines ${actionAnalysis.details.startLine}-${actionAnalysis.details.endLine}</p>
                        <p>Kind: <em>${actionAnalysis.details.kind}</em></p>
                    ` : ''}
                    <div class="cot-result">ACTION = <span class="cot-value">${this.escapeHtml(action.toUpperCase())}</span></div>`;
            } else {
                action = this._getFunctionNameFromAst(astData.astObject);
                actionSource = 'fallback AST heuristic';
                actionStepHtml = `
                    <p>Basic AST analysis complete.</p>
                    <p>Function identified: <strong>${this.escapeHtml(action)}</strong> <em>(via ${actionSource})</em></p>
                    <div class="cot-result">ACTION = <span class="cot-value">${this.escapeHtml(action.toUpperCase())}</span></div>`;
            }
        } else {
            action = 'ERROR';
            actionSource = 'analysis failed';
            actionStepHtml = `
                <p>Line ${lineNum} analysis: <em>AST parsing failed.</em></p>
                <p>${astData ? this.escapeHtml(astData.error) : 'Could not fetch AST.'}</p>
                <div class="cot-result">ACTION = <span class="cot-value cot-error">ERROR</span></div>`;
        }

        this._logCotAnalysis({
            filePath: relativePath,
            lineNum,
            type,
            module,
            action
        });

        const cotHtml = `
            <div class="cot-container">
                <div class="cot-thought collapsible-section">
                    <h5 class="collapsible-header">
                        <span class="collapsible-toggle"></span>
                        Identify TYPE.MODULE.ACTION from ${relativePath}:${lineNum}
                    </h5>
                    <div class="collapsible-content">
                        <div class="cot-subtask collapsible-section">
                            <h6 class="collapsible-header">
                                <span class="collapsible-toggle"></span>
                                1. Determine TYPE
                            </h6>
                            <div class="collapsible-content">
                                <p>From file path: <code>${relativePath}</code></p>
                                <p>Source: <strong>${typeSource}</strong></p>
                                <div class="cot-result">TYPE = <span class="cot-value">${this.escapeHtml(type)}</span></div>
                            </div>
                        </div>
                        
                        <div class="cot-subtask collapsible-section collapsed">
                            <h6 class="collapsible-header">
                                <span class="collapsible-toggle"></span>
                                2. Extract MODULE
                            </h6>
                            <div class="collapsible-content">
                                <p>Path segments: <code>${parts.join(' → ')}</code></p>
                                <p>Source: <strong>${moduleSource}</strong></p>
                                ${astData.moduleAnalysis ? `
                                    <p>Confidence: <strong>${astData.moduleAnalysis.confidence}</strong></p>
                                    <p>Reasoning: ${this.escapeHtml(astData.moduleAnalysis.reasoning)}</p>
                                    ${astData.moduleAnalysis.filteredCount > 0 ? `<p class="cot-filtered">Filtered out ${astData.moduleAnalysis.filteredCount} non-semantic segments</p>` : ''}
                                    ${astData.moduleAnalysis.segments.length > 0 ? `<p>Meaningful segments: <code>${astData.moduleAnalysis.segments.join(' → ')}</code></p>` : ''}
                                ` : ''}
                                <div class="cot-result">MODULE = <span class="cot-value">${this.escapeHtml(module)}</span></div>
                            </div>
                        </div>
                        
                        <div class="cot-subtask collapsible-section collapsed">
                            <h6 class="collapsible-header">
                                <span class="collapsible-toggle"></span>
                                3. Find ACTION (function name)
                            </h6>
                            <div class="collapsible-content">
                                ${actionStepHtml}
                            </div>
                        </div>
                        
                        <div class="cot-final">
                            <h6>Final Result</h6>
                            <div class="cot-source-format">
                                <strong>${this.escapeHtml(type)}.${this.escapeHtml(module)}.${this.escapeHtml(action.toUpperCase())}</strong>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        container.innerHTML = cotHtml;
        this.attachCollapsibleHandlers(container);
    }

    _getFunctionNameFromAst(astNode) {
        if (!astNode) return 'UNKNOWN';
        if (astNode.id && astNode.id.type === 'Identifier') return astNode.id.name;
        if (astNode.key && astNode.key.type === 'Identifier') return astNode.key.name;
        if (['FunctionExpression', 'ArrowFunctionExpression'].includes(astNode.type)) return 'anonymous';
        return 'UNKNOWN';
    }

    _logCotAnalysis(analysisData) {
        // This is a fire-and-forget call to a system logging endpoint.
        // It's not critical for the UI, so we don't await it or handle errors.
        this.logService.logSystemEvent('COT_ANALYSIS', 'frontend.cot_generator', 
            `CoT generated for ${analysisData.filePath}:${analysisData.lineNum}`, 
            analysisData
        );
    }

    attachCollapsibleHandlers(container) {
        container.addEventListener('click', e => {
            const header = e.target.closest('.collapsible-header');
            if (header) {
                const section = header.parentElement;
                section.classList.toggle('collapsed');
            }
        });
    }

    escapeHtml(text) {
        if (text === null || text === undefined) {
            return '';
        }
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}
