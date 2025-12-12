/**
 * gdoc-cst.js - Google Docs Concrete Syntax Tree Builder
 *
 * Builds a navigable tree from Google Doc JSON with exact character indices
 * for safe, precise editing via the Google Docs API.
 */

(function(global) {
  'use strict';

  class DocNode {
    constructor(type, text, startIndex, endIndex) {
      this.type = type;
      this.text = text;
      this.startIndex = startIndex;
      this.endIndex = endIndex;
      this.children = [];
      this.parent = null;
      this.index = 0; // 1-based position among siblings
    }

    addChild(node) {
      node.parent = this;
      node.index = this.children.filter(c => c.type === node.type).length + 1;
      this.children.push(node);
      return node;
    }

    // Get address like "s7" or "s7p2"
    getAddress() {
      const parts = [];
      let node = this;
      while (node && node.type !== 'document') {
        const prefix = {
          'heading1': 's',
          'heading2': 'h2',
          'heading3': 'h3',
          'paragraph': 'p',
          'table': 't',
          'list': 'l'
        }[node.type] || node.type[0];
        parts.unshift(`${prefix}${node.index}`);
        node = node.parent;
      }
      return parts.join('');
    }

    // Find by address
    find(address) {
      const match = address.match(/^([a-z]+\d*)(.*)$/i);
      if (!match) return null;

      const [, segment, rest] = match;
      const typeMatch = segment.match(/^([a-z]+)(\d+)?$/i);
      if (!typeMatch) return null;

      const [, typePrefix, indexStr] = typeMatch;
      const targetIndex = indexStr ? parseInt(indexStr) : 1;

      const typeMap = {
        's': 'heading1',
        'h2': 'heading2',
        'h3': 'heading3',
        'p': 'paragraph',
        't': 'table',
        'l': 'list'
      };

      const targetType = typeMap[typePrefix.toLowerCase()] || typePrefix;
      const matches = this.children.filter(c => c.type === targetType);
      const child = matches[targetIndex - 1];

      if (!child) return null;
      if (!rest) return child;
      return child.find(rest);
    }
  }

  function buildCST(docJson) {
    const root = new DocNode('document', docJson.title, 0, 0);
    root.documentId = docJson.documentId;
    root.title = docJson.title;

    const content = docJson.body?.content || [];
    let currentSection = null;
    let currentH2 = null;
    let sectionCount = 0;

    for (const element of content) {
      if (element.paragraph) {
        const para = element.paragraph;
        const text = extractText(para);
        const startIndex = element.startIndex || 0;
        const endIndex = element.endIndex || 0;
        const namedStyle = para.paragraphStyle?.namedStyleType;

        if (!text.trim()) continue;

        if (namedStyle === 'HEADING_1' || namedStyle === 'TITLE') {
          sectionCount++;
          currentSection = new DocNode('heading1', text.trim(), startIndex, endIndex);
          root.addChild(currentSection);
          currentH2 = null;
        } else if (namedStyle === 'HEADING_2') {
          currentH2 = new DocNode('heading2', text.trim(), startIndex, endIndex);
          (currentSection || root).addChild(currentH2);
        } else if (namedStyle === 'HEADING_3' || namedStyle === 'HEADING_4') {
          const h3 = new DocNode('heading3', text.trim(), startIndex, endIndex);
          (currentH2 || currentSection || root).addChild(h3);
        } else {
          const p = new DocNode('paragraph', text.trim(), startIndex, endIndex);
          (currentH2 || currentSection || root).addChild(p);
        }
      } else if (element.table) {
        const t = new DocNode('table', '[TABLE]', element.startIndex, element.endIndex);
        t.rows = element.table.rows;
        t.columns = element.table.columns;
        (currentH2 || currentSection || root).addChild(t);
      }
    }

    return root;
  }

  function extractText(para) {
    if (!para.elements) return '';
    return para.elements
      .map(el => el.textRun?.content || '')
      .join('');
  }

  // Print tree structure with indices
  function printTree(node, depth = 0) {
    const indent = '  '.repeat(depth);
    const addr = node.getAddress() || 'root';
    const preview = node.text ? node.text.substring(0, 50) : '';
    const indices = `[${node.startIndex}-${node.endIndex}]`;

    console.log(`${indent}${addr} ${indices} ${node.type}: ${preview}`);

    for (const child of node.children) {
      printTree(child, depth + 1);
    }
  }

  // Generate edit instructions
  function getEditInfo(node) {
    return {
      address: node.getAddress(),
      type: node.type,
      text: node.text,
      startIndex: node.startIndex,
      endIndex: node.endIndex,
      length: node.endIndex - node.startIndex,
      replaceWith: (newText) => ({
        deleteRange: { startIndex: node.startIndex, endIndex: node.endIndex - 1 }, // -1 to preserve newline
        insertText: { index: node.startIndex, text: newText }
      })
    };
  }

  // Find all nodes matching a text pattern
  function findByText(node, pattern, results = []) {
    const regex = pattern instanceof RegExp ? pattern : new RegExp(pattern, 'i');
    if (node.text && regex.test(node.text)) {
      results.push(node);
    }
    for (const child of node.children) {
      findByText(child, pattern, results);
    }
    return results;
  }

  const GDocCST = {
    DocNode,
    build: buildCST,
    print: printTree,
    getEditInfo,
    findByText
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = GDocCST;
  } else {
    global.GDocCST = GDocCST;
  }

})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this);
