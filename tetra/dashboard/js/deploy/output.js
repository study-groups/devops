/**
 * Deploy Panel - Output Handling
 * Uses TetraUI.TerminalOutput for ANSI color support
 */

window.DeployOutput = (function() {
    'use strict';

    /**
     * Strip ANSI codes
     */
    function stripAnsi(str) {
        if (window.TetraUI && TetraUI.TerminalOutput) {
            return TetraUI.TerminalOutput.strip(str);
        }
        return str.replace(/\x1b\[[0-9;]*m/g, '');
    }

    /**
     * Escape HTML
     */
    function escapeHtml(str) {
        return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    /**
     * Format output with syntax highlighting
     */
    function formatOutput(raw) {
        const useAnsi = window.TetraUI && TetraUI.TerminalOutput;
        const lines = raw.split('\n');

        return lines.map(line => {
            const formatted = useAnsi
                ? TetraUI.TerminalOutput.parseAnsi(line)
                : escapeHtml(stripAnsi(line));
            const clean = stripAnsi(line);

            // Section headers
            if (/^\[.*:.*\]/.test(clean.trim())) {
                return '<span class="out-header">' + formatted + '</span>';
            }
            // DRY RUN banner
            if (/\[DRY RUN\]/.test(clean)) {
                return '<span class="out-dryrun">' + formatted + '</span>';
            }
            // Step names
            if (/^\s+\[[\w:.-]+\]/.test(clean)) {
                return '<span class="out-step">' + formatted + '</span>';
            }
            // Horizontal rules
            if (/^[─]{4,}/.test(clean.trim())) {
                return '<span class="out-rule">' + formatted + '</span>';
            }
            // Done line
            if (/^Done\s/.test(clean.trim())) {
                return '<span class="out-done">' + formatted + '</span>';
            }
            // Command lines
            if (/^\s{2,}\S/.test(clean)) {
                return '<span class="out-cmd">' + formatted + '</span>';
            }

            return formatted;
        }).join('\n');
    }

    /**
     * Show streaming output in container
     */
    function showStreamingOutput(text, label, targetName, isStreaming) {
        DeployState.setOutput(targetName, { text, label, streaming: isStreaming });

        const container = document.getElementById('output-' + targetName);
        if (container) {
            renderOutput(container, text, label, targetName, isStreaming);
        }
    }

    /**
     * Render output in container
     */
    function renderOutput(container, text, label, targetName, isStreaming) {
        const closeId = 'close-output-' + targetName;
        const streamingClass = isStreaming ? ' streaming' : '';
        const streamingIndicator = isStreaming ? '<span class="streaming-indicator"></span>' : '';

        container.innerHTML = '<div class="output-header' + streamingClass + '">' +
            streamingIndicator +
            '<span class="output-label">' + (label || '') + '</span>' +
            '<span class="output-close" id="' + closeId + '">\u00D7</span></div>' +
            '<pre class="output-pre' + streamingClass + '">' + formatOutput(text) + '</pre>';
        container.style.display = 'block';

        // Auto-scroll while streaming
        if (isStreaming) {
            const pre = container.querySelector('.output-pre');
            if (pre) pre.scrollTop = pre.scrollHeight;
        }

        // Close handler
        const closeBtn = document.getElementById(closeId);
        if (closeBtn) {
            closeBtn.addEventListener('click', e => {
                e.stopPropagation();
                container.style.display = 'none';
                container.innerHTML = '';
                DeployState.clearOutput(targetName);
            });
        }
    }

    /**
     * Restore outputs after re-render
     */
    function restoreOutputs() {
        const outputs = DeployState.getAllOutputs();
        Object.keys(outputs).forEach(name => {
            const container = document.getElementById('output-' + name);
            if (container) {
                const o = outputs[name];
                renderOutput(container, o.text, o.label, name, o.streaming);
            }
        });
    }

    return {
        stripAnsi,
        escapeHtml,
        formatOutput,
        showStreamingOutput,
        renderOutput,
        restoreOutputs
    };
})();
