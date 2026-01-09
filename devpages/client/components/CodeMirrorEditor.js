/**
 * CodeMirrorEditor.js - CodeMirror 6 based code editor
 * Provides syntax highlighting, line numbers, and proper code editing
 */

import { EditorState } from '@codemirror/state';
import { EditorView, keymap, lineNumbers, highlightActiveLineGutter, highlightSpecialChars, drawSelection, dropCursor, rectangularSelection, crosshairCursor, highlightActiveLine } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search';
import { autocompletion, completionKeymap, closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete';
import { javascript } from '@codemirror/lang-javascript';
import { markdown } from '@codemirror/lang-markdown';
import { json } from '@codemirror/lang-json';
import { html } from '@codemirror/lang-html';
import { css } from '@codemirror/lang-css';
import { syntaxHighlighting, defaultHighlightStyle, indentOnInput, bracketMatching, foldGutter, foldKeymap, HighlightStyle } from '@codemirror/language';
import { tags } from '@lezer/highlight';

// Dark theme styling
const darkTheme = EditorView.theme({
    '&': {
        backgroundColor: 'var(--bg-primary, #1e1e1e)',
        color: 'var(--text-primary, #d4d4d4)',
        height: '100%'
    },
    '.cm-content': {
        fontFamily: '"SF Mono", Monaco, "Cascadia Code", "Roboto Mono", Consolas, monospace',
        fontSize: '13px',
        lineHeight: '1.5',
        padding: '8px 0'
    },
    '.cm-gutters': {
        backgroundColor: 'var(--bg-secondary, #252526)',
        color: 'var(--text-muted, #858585)',
        border: 'none',
        borderRight: '1px solid var(--border-color, #333)'
    },
    '.cm-activeLineGutter': {
        backgroundColor: 'var(--bg-tertiary, #2a2d2e)'
    },
    '.cm-activeLine': {
        backgroundColor: 'rgba(255, 255, 255, 0.03)'
    },
    '.cm-selectionBackground': {
        backgroundColor: 'rgba(38, 79, 120, 0.5) !important'
    },
    '&.cm-focused .cm-selectionBackground': {
        backgroundColor: 'rgba(38, 79, 120, 0.7) !important'
    },
    '.cm-cursor': {
        borderLeftColor: 'var(--text-primary, #d4d4d4)',
        borderLeftWidth: '2px'
    },
    '.cm-matchingBracket': {
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        outline: '1px solid rgba(255, 255, 255, 0.3)'
    },
    '.cm-searchMatch': {
        backgroundColor: 'rgba(255, 200, 0, 0.3)'
    },
    '.cm-searchMatch.cm-searchMatch-selected': {
        backgroundColor: 'rgba(255, 200, 0, 0.5)'
    },
    '.cm-foldGutter': {
        width: '12px'
    },
    '.cm-foldPlaceholder': {
        backgroundColor: 'var(--bg-tertiary, #3c3c3c)',
        border: 'none',
        color: 'var(--text-muted, #888)'
    },
    '.cm-tooltip': {
        backgroundColor: 'var(--bg-secondary, #252526)',
        border: '1px solid var(--border-color, #454545)',
        color: 'var(--text-primary, #d4d4d4)'
    },
    '.cm-tooltip-autocomplete': {
        '& > ul > li': {
            padding: '4px 8px'
        },
        '& > ul > li[aria-selected]': {
            backgroundColor: 'var(--color-primary, #0078d4)',
            color: '#fff'
        }
    }
}, { dark: true });

// Syntax highlighting colors (VS Code-like dark theme)
const darkHighlightStyle = HighlightStyle.define([
    { tag: tags.keyword, color: '#569cd6' },
    { tag: tags.operator, color: '#d4d4d4' },
    { tag: tags.special(tags.variableName), color: '#9cdcfe' },
    { tag: tags.typeName, color: '#4ec9b0' },
    { tag: tags.atom, color: '#569cd6' },
    { tag: tags.number, color: '#b5cea8' },
    { tag: tags.definition(tags.variableName), color: '#9cdcfe' },
    { tag: tags.string, color: '#ce9178' },
    { tag: tags.special(tags.string), color: '#d7ba7d' },
    { tag: tags.comment, color: '#6a9955', fontStyle: 'italic' },
    { tag: tags.variableName, color: '#9cdcfe' },
    { tag: tags.tagName, color: '#569cd6' },
    { tag: tags.bracket, color: '#d4d4d4' },
    { tag: tags.attributeName, color: '#9cdcfe' },
    { tag: tags.attributeValue, color: '#ce9178' },
    { tag: tags.content, color: '#d4d4d4' },
    { tag: tags.heading, color: '#569cd6', fontWeight: 'bold' },
    { tag: tags.heading1, color: '#569cd6', fontWeight: 'bold', fontSize: '1.4em' },
    { tag: tags.heading2, color: '#569cd6', fontWeight: 'bold', fontSize: '1.2em' },
    { tag: tags.link, color: '#3794ff', textDecoration: 'underline' },
    { tag: tags.emphasis, fontStyle: 'italic' },
    { tag: tags.strong, fontWeight: 'bold' },
    { tag: tags.function(tags.variableName), color: '#dcdcaa' },
    { tag: tags.function(tags.propertyName), color: '#dcdcaa' },
    { tag: tags.className, color: '#4ec9b0' },
    { tag: tags.propertyName, color: '#9cdcfe' },
    { tag: tags.bool, color: '#569cd6' },
    { tag: tags.null, color: '#569cd6' },
    { tag: tags.regexp, color: '#d16969' },
    { tag: tags.escape, color: '#d7ba7d' },
    { tag: tags.meta, color: '#c586c0' },
]);

/**
 * Get language extension based on file type
 */
function getLanguageExtension(filePath) {
    if (!filePath) return [];

    const ext = filePath.split('.').pop()?.toLowerCase();

    switch (ext) {
        case 'js':
        case 'mjs':
        case 'jsx':
            return [javascript({ jsx: true })];
        case 'ts':
        case 'tsx':
            return [javascript({ jsx: true, typescript: true })];
        case 'json':
            return [json()];
        case 'html':
        case 'htm':
            return [html()];
        case 'css':
            return [css()];
        case 'md':
        case 'markdown':
            return [markdown()];
        default:
            return [];
    }
}

/**
 * CodeMirror Editor class
 */
export class CodeMirrorEditor {
    constructor(options = {}) {
        this.container = null;
        this.view = null;
        this.onChangeCallback = options.onChange || null;
        this.filePath = options.filePath || '';
    }

    /**
     * Mount the editor to a container
     */
    mount(container, content = '', filePath = '') {
        this.container = container;
        this.filePath = filePath;

        // Clear container
        container.innerHTML = '';

        // Create editor state with extensions
        const state = EditorState.create({
            doc: content,
            extensions: [
                // Line numbers and gutter
                lineNumbers(),
                highlightActiveLineGutter(),
                foldGutter(),

                // Basic editing
                history(),
                drawSelection(),
                dropCursor(),
                EditorState.allowMultipleSelections.of(true),
                indentOnInput(),
                bracketMatching(),
                closeBrackets(),
                autocompletion(),
                rectangularSelection(),
                crosshairCursor(),
                highlightActiveLine(),
                highlightSelectionMatches(),
                highlightSpecialChars(),

                // Keymaps
                keymap.of([
                    ...closeBracketsKeymap,
                    ...defaultKeymap,
                    ...searchKeymap,
                    ...historyKeymap,
                    ...foldKeymap,
                    ...completionKeymap,
                    indentWithTab
                ]),

                // Theme
                darkTheme,
                syntaxHighlighting(darkHighlightStyle),

                // Language
                ...getLanguageExtension(filePath),

                // Change listener
                EditorView.updateListener.of((update) => {
                    if (update.docChanged && this.onChangeCallback) {
                        this.onChangeCallback(update.state.doc.toString());
                    }
                })
            ]
        });

        // Create editor view
        this.view = new EditorView({
            state,
            parent: container
        });

        return this;
    }

    /**
     * Get current content
     */
    getContent() {
        return this.view?.state.doc.toString() || '';
    }

    /**
     * Set content
     */
    setContent(content) {
        if (!this.view) return;

        this.view.dispatch({
            changes: {
                from: 0,
                to: this.view.state.doc.length,
                insert: content
            }
        });
    }

    /**
     * Update file path (changes syntax highlighting)
     */
    setFilePath(filePath) {
        if (this.filePath === filePath) return;
        this.filePath = filePath;

        // Remount with new language
        if (this.container && this.view) {
            const content = this.getContent();
            this.destroy();
            this.mount(this.container, content, filePath);
        }
    }

    /**
     * Focus the editor
     */
    focus() {
        this.view?.focus();
    }

    /**
     * Go to a specific line
     */
    gotoLine(lineNumber) {
        if (!this.view) return;

        const line = this.view.state.doc.line(Math.min(lineNumber, this.view.state.doc.lines));
        this.view.dispatch({
            selection: { anchor: line.from },
            scrollIntoView: true
        });
        this.focus();
    }

    /**
     * Get cursor position info
     */
    getCursorPosition() {
        if (!this.view) return { line: 1, column: 1 };

        const pos = this.view.state.selection.main.head;
        const line = this.view.state.doc.lineAt(pos);

        return {
            line: line.number,
            column: pos - line.from + 1,
            offset: pos
        };
    }

    /**
     * Destroy the editor
     */
    destroy() {
        if (this.view) {
            this.view.destroy();
            this.view = null;
        }
    }
}

export default CodeMirrorEditor;
