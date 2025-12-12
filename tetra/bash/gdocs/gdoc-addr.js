/**
 * gdoc-addr.js - Google Docs Semantic Addressing Library
 *
 * Navigate Google Docs using semantic addresses like c3s2p1s4
 * (chapter 3, section 2, paragraph 1, sentence 4)
 *
 * Browser and Node.js compatible, no dependencies.
 */

(function(global) {
  'use strict';

  // ============================================
  // DocumentNode - Tree node for document structure
  // ============================================

  class DocumentNode {
    constructor(type, content = '', startIndex = 0, endIndex = 0) {
      this.type = type;           // 'document', 'chapter', 'section', 'subsection', 'paragraph', 'sentence'
      this.content = content;     // Text content
      this.title = '';            // For chapters/sections, the heading text
      this.startIndex = startIndex;
      this.endIndex = endIndex;
      this.children = [];
      this.parent = null;
      this.index = 0;             // 1-based position among siblings of same type
    }

    addChild(node) {
      node.parent = this;
      // Calculate index among siblings of same type
      const sameType = this.children.filter(c => c.type === node.type);
      node.index = sameType.length + 1;
      this.children.push(node);
      return node;
    }

    getChildrenOfType(type) {
      return this.children.filter(c => c.type === type);
    }

    getAllDescendants(type = null) {
      const results = [];
      const walk = (node) => {
        for (const child of node.children) {
          if (!type || child.type === type) {
            results.push(child);
          }
          walk(child);
        }
      };
      walk(this);
      return results;
    }

    getPath() {
      const path = [];
      let node = this;
      while (node && node.type !== 'document') {
        path.unshift(node);
        node = node.parent;
      }
      return path;
    }

    getAddress(format = 'short') {
      const path = this.getPath();
      if (format === 'short') {
        return path.map(n => {
          const prefix = { chapter: 'c', section: 's', subsection: 'ss', paragraph: 'p', sentence: 'sent' }[n.type] || n.type[0];
          return prefix + n.index;
        }).join('');
      } else {
        return path.map(n => `${n.type}:${n.index}`).join('/');
      }
    }

    getText() {
      if (this.children.length === 0) {
        return this.content;
      }
      return this.children.map(c => c.getText()).join(' ');
    }
  }

  // ============================================
  // DocumentTree - Full document structure
  // ============================================

  class DocumentTree {
    constructor(title = '', documentId = '') {
      this.title = title;
      this.documentId = documentId;
      this.root = new DocumentNode('document');
      this.flatParagraphs = [];
      this.flatSentences = [];
      this.metadata = {};
    }

    getByAddress(addressStr) {
      const segments = parseAddress(addressStr);
      return resolveAddress(this.root, segments);
    }

    toc() {
      const items = [];
      const walk = (node, depth = 0) => {
        if (['chapter', 'section', 'subsection'].includes(node.type)) {
          items.push({
            type: node.type,
            title: node.title || node.content.substring(0, 50),
            address: node.getAddress(),
            depth
          });
        }
        for (const child of node.children) {
          walk(child, depth + (['chapter', 'section', 'subsection'].includes(node.type) ? 1 : 0));
        }
      };
      walk(this.root);
      return items;
    }

    find(query) {
      const results = [];
      const regex = new RegExp(query, 'gi');
      const walk = (node) => {
        if (node.content && regex.test(node.content)) {
          results.push({
            node,
            address: node.getAddress(),
            content: node.content,
            type: node.type
          });
        }
        for (const child of node.children) {
          walk(child);
        }
      };
      walk(this.root);
      return results;
    }

    walk(callback) {
      const walkNode = (node, depth = 0) => {
        callback(node, depth);
        for (const child of node.children) {
          walkNode(child, depth + 1);
        }
      };
      walkNode(this.root);
    }
  }

  // ============================================
  // Sentence Splitting
  // ============================================

  const ABBREVIATIONS = [
    'mr', 'mrs', 'ms', 'dr', 'prof', 'sr', 'jr',
    'etc', 'vs', 'al', 'inc', 'ltd', 'co',
    'fig', 'vol', 'no', 'pp', 'ed', 'eds'
  ];

  function splitIntoSentences(text) {
    if (!text || !text.trim()) return [];

    // Protect abbreviations by replacing periods with placeholder
    let processed = text;
    for (const abbr of ABBREVIATIONS) {
      const regex = new RegExp(`\\b(${abbr})\\.`, 'gi');
      processed = processed.replace(regex, '$1\x00');
    }

    // Protect decimal numbers
    processed = processed.replace(/(\d)\.(\d)/g, '$1\x00$2');

    // Protect ellipsis
    processed = processed.replace(/\.{3}/g, '\x01\x01\x01');

    // Split on sentence boundaries: .!? followed by space and capital or end
    const parts = processed.split(/([.!?]+)\s+(?=[A-Z"])|([.!?]+)$/);

    const sentences = [];
    let current = '';

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (part === undefined) continue;

      if (/^[.!?]+$/.test(part)) {
        current += part;
        const restored = current.replace(/\x00/g, '.').replace(/\x01/g, '.').trim();
        if (restored) sentences.push(restored);
        current = '';
      } else {
        current += part;
      }
    }

    // Handle remaining text
    if (current.trim()) {
      const restored = current.replace(/\x00/g, '.').replace(/\x01/g, '.').trim();
      if (restored) sentences.push(restored);
    }

    return sentences;
  }

  // ============================================
  // Address Parsing
  // ============================================

  const TYPE_MAP = {
    'c': 'chapter',
    'ch': 'chapter',
    'chapter': 'chapter',
    's': 'section',
    'sec': 'section',
    'section': 'section',
    'ss': 'subsection',
    'subsec': 'subsection',
    'subsection': 'subsection',
    'p': 'paragraph',
    'para': 'paragraph',
    'paragraph': 'paragraph',
    'sent': 'sentence',
    'sentence': 'sentence'
  };

  function parseAddress(addressStr) {
    if (!addressStr) return [];

    const segments = [];

    // Try verbose form first: chapter:3/section:2
    if (addressStr.includes(':')) {
      const parts = addressStr.split('/');
      for (const part of parts) {
        const [typeStr, indexStr] = part.split(':');
        const type = TYPE_MAP[typeStr.toLowerCase()];
        if (type) {
          segments.push(parseSegment(type, indexStr));
        }
      }
      return segments;
    }

    // Short form: c3s2p1sent4
    // Match patterns like c3, s2, ss1, p4, sent5
    const shortPattern = /(c|ch|s|ss|sec|p|para|sent)(\d+|\*|\d+-\d+)/gi;
    let match;
    while ((match = shortPattern.exec(addressStr)) !== null) {
      const type = TYPE_MAP[match[1].toLowerCase()];
      if (type) {
        segments.push(parseSegment(type, match[2]));
      }
    }

    return segments;
  }

  function parseSegment(type, indexStr) {
    if (indexStr === '*') {
      return { type, wildcard: true };
    }
    if (indexStr.includes('-')) {
      const [start, end] = indexStr.split('-').map(Number);
      return { type, range: [start, end] };
    }
    return { type, index: parseInt(indexStr, 10) };
  }

  function resolveAddress(root, segments) {
    let nodes = [root];

    for (const segment of segments) {
      const nextNodes = [];

      for (const node of nodes) {
        const children = node.getChildrenOfType(segment.type);

        if (segment.wildcard) {
          nextNodes.push(...children);
        } else if (segment.range) {
          const [start, end] = segment.range;
          nextNodes.push(...children.slice(start - 1, end));
        } else {
          const child = children[segment.index - 1];
          if (child) nextNodes.push(child);
        }
      }

      nodes = nextNodes;
      if (nodes.length === 0) break;
    }

    return nodes.length === 1 ? nodes[0] : nodes;
  }

  // ============================================
  // Document Parser
  // ============================================

  function parseDocument(docJson, config = {}) {
    const tree = new DocumentTree(
      docJson.title || '',
      docJson.documentId || ''
    );

    tree.metadata = {
      title: docJson.title,
      documentId: docJson.documentId,
      revisionId: docJson.revisionId
    };

    const rules = Object.assign({}, DEFAULT_CONFIG, config);
    const content = docJson.body?.content || [];

    let currentChapter = null;
    let currentSection = null;
    let currentSubsection = null;

    for (const element of content) {
      if (element.paragraph) {
        const para = element.paragraph;
        const text = extractParagraphText(para);
        const startIndex = element.startIndex || 0;
        const endIndex = element.endIndex || 0;

        if (!text.trim()) continue;

        const paraType = detectParagraphType(para, text, rules);

        switch (paraType) {
          case 'chapter':
            currentChapter = new DocumentNode('chapter', text, startIndex, endIndex);
            currentChapter.title = text;
            tree.root.addChild(currentChapter);
            currentSection = null;
            currentSubsection = null;
            break;

          case 'section':
            currentSection = new DocumentNode('section', text, startIndex, endIndex);
            currentSection.title = text;
            (currentChapter || tree.root).addChild(currentSection);
            currentSubsection = null;
            break;

          case 'subsection':
            currentSubsection = new DocumentNode('subsection', text, startIndex, endIndex);
            currentSubsection.title = text;
            (currentSection || currentChapter || tree.root).addChild(currentSubsection);
            break;

          default:
            const paraNode = new DocumentNode('paragraph', text, startIndex, endIndex);
            tree.flatParagraphs.push(paraNode);

            // Split into sentences
            const sentences = splitIntoSentences(text);
            for (const sentText of sentences) {
              const sentNode = new DocumentNode('sentence', sentText);
              paraNode.addChild(sentNode);
              tree.flatSentences.push(sentNode);
            }

            // Add to current container
            const container = currentSubsection || currentSection || currentChapter || tree.root;
            container.addChild(paraNode);
        }
      }
    }

    return tree;
  }

  function extractParagraphText(para) {
    if (!para.elements) return '';
    return para.elements
      .map(el => el.textRun?.content || '')
      .join('')
      .trim();
  }

  function detectParagraphType(para, text, rules) {
    const namedStyle = para.paragraphStyle?.namedStyleType;

    // Check heading styles
    if (namedStyle) {
      for (const [type, matchers] of Object.entries(rules.structure)) {
        for (const matcher of matchers) {
          if (matcher.namedStyleType === namedStyle) {
            return type;
          }
        }
      }
    }

    // Check patterns
    for (const [type, matchers] of Object.entries(rules.structure)) {
      for (const matcher of matchers) {
        if (matcher.pattern) {
          const regex = new RegExp(matcher.pattern, 'i');
          if (regex.test(text)) {
            return type;
          }
        }
      }
    }

    return 'paragraph';
  }

  // ============================================
  // Default Configuration
  // ============================================

  const DEFAULT_CONFIG = {
    structure: {
      chapter: [
        { namedStyleType: 'HEADING_1' },
        { pattern: '^Chapter\\s+\\d+' },
        { pattern: '^CHAPTER\\s+\\d+' }
      ],
      section: [
        { namedStyleType: 'HEADING_2' },
        { pattern: '^\\d+\\.\\d+\\s+' },
        { pattern: '^Section\\s+\\d+' }
      ],
      subsection: [
        { namedStyleType: 'HEADING_3' },
        { namedStyleType: 'HEADING_4' },
        { pattern: '^\\d+\\.\\d+\\.\\d+\\s+' }
      ]
    }
  };

  // ============================================
  // Cache
  // ============================================

  class DocumentCache {
    constructor(options = {}) {
      this.cache = new Map();
      this.ttl = options.ttl || 3600000; // 1 hour default
      this.maxSize = options.maxSize || 100;
    }

    get(documentId) {
      const entry = this.cache.get(documentId);
      if (!entry) return null;
      if (Date.now() > entry.expires) {
        this.cache.delete(documentId);
        return null;
      }
      return entry.tree;
    }

    set(documentId, tree) {
      // Evict oldest if at capacity
      if (this.cache.size >= this.maxSize) {
        const oldest = this.cache.keys().next().value;
        this.cache.delete(oldest);
      }
      this.cache.set(documentId, {
        tree,
        expires: Date.now() + this.ttl
      });
    }

    invalidate(documentId) {
      this.cache.delete(documentId);
    }

    clear() {
      this.cache.clear();
    }
  }

  // ============================================
  // Public API
  // ============================================

  const cache = new DocumentCache();

  const GDocAddr = {
    // Classes for advanced usage
    DocumentNode,
    DocumentTree,
    DocumentCache,

    // Parse document JSON into tree
    parse: parseDocument,

    // Parse address string
    parseAddress,

    // Resolve address against tree
    resolve: resolveAddress,

    // Split text into sentences
    splitSentences: splitIntoSentences,

    // Get content at address from a tree
    get(tree, addressStr) {
      const result = tree.getByAddress(addressStr);
      if (Array.isArray(result)) {
        return result.map(n => ({
          address: n.getAddress(),
          type: n.type,
          content: n.getText(),
          title: n.title
        }));
      }
      if (result) {
        return {
          address: result.getAddress(),
          type: result.type,
          content: result.getText(),
          title: result.title
        };
      }
      return null;
    },

    // Get table of contents
    toc(tree) {
      return tree.toc();
    },

    // Find text in document
    find(tree, query) {
      return tree.find(query);
    },

    // Cache management
    cache: {
      get: (docId) => cache.get(docId),
      set: (docId, tree) => cache.set(docId, tree),
      invalidate: (docId) => cache.invalidate(docId),
      clear: () => cache.clear()
    },

    // Default config
    DEFAULT_CONFIG,

    // Version
    VERSION: '1.0.0'
  };

  // Export for different environments
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = GDocAddr;
  } else {
    global.GDocAddr = GDocAddr;
  }

})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this);
