/**
 * config.js - Default configuration for gdoc-addr
 *
 * Structure detection rules for identifying chapters, sections, etc.
 * Override or extend these when parsing documents with different conventions.
 */

(function(global) {
  'use strict';

  const GDocAddrConfig = {
    // Structure detection rules
    // Each type has an array of matchers - first match wins
    structure: {
      chapter: [
        // Google Docs heading styles
        { namedStyleType: 'HEADING_1' },
        // Text patterns
        { pattern: '^Chapter\\s+\\d+' },
        { pattern: '^CHAPTER\\s+\\d+' },
        { pattern: '^Part\\s+\\d+' },
        { pattern: '^PART\\s+\\d+' },
        // Roman numerals
        { pattern: '^(I|II|III|IV|V|VI|VII|VIII|IX|X)\\.\\s+' }
      ],

      section: [
        { namedStyleType: 'HEADING_2' },
        { pattern: '^\\d+\\.\\d+\\s+' },
        { pattern: '^Section\\s+\\d+' },
        { pattern: '^[A-Z]\\.\\s+' }  // A. B. C. style
      ],

      subsection: [
        { namedStyleType: 'HEADING_3' },
        { namedStyleType: 'HEADING_4' },
        { pattern: '^\\d+\\.\\d+\\.\\d+\\s+' },
        { pattern: '^[a-z]\\)\\s+' },  // a) b) c) style
        { pattern: '^\\(\\d+\\)\\s+' } // (1) (2) style
      ]
    },

    // Paragraph detection options
    paragraphs: {
      minLength: 1,        // Minimum chars to be considered a paragraph
      ignoreEmpty: true    // Skip empty paragraphs
    },

    // Sentence splitting options
    sentences: {
      // Additional abbreviations beyond the built-in list
      additionalAbbreviations: []
    },

    // Cache settings
    cache: {
      enabled: true,
      ttl: 3600000,        // 1 hour in milliseconds
      maxSize: 100
    }
  };

  // Preset configurations for common document types

  GDocAddrConfig.presets = {
    // Academic paper style
    academic: {
      structure: {
        chapter: [
          { namedStyleType: 'HEADING_1' },
          { pattern: '^Abstract$' },
          { pattern: '^Introduction$' },
          { pattern: '^Methods$' },
          { pattern: '^Results$' },
          { pattern: '^Discussion$' },
          { pattern: '^Conclusion$' },
          { pattern: '^References$' },
          { pattern: '^\\d+\\.\\s+[A-Z]' }
        ],
        section: [
          { namedStyleType: 'HEADING_2' },
          { pattern: '^\\d+\\.\\d+\\s+' }
        ],
        subsection: [
          { namedStyleType: 'HEADING_3' },
          { pattern: '^\\d+\\.\\d+\\.\\d+\\s+' }
        ]
      }
    },

    // Book-style chapters
    book: {
      structure: {
        chapter: [
          { namedStyleType: 'HEADING_1' },
          { pattern: '^Chapter\\s+\\d+' },
          { pattern: '^CHAPTER\\s+\\d+' },
          { pattern: '^Prologue$' },
          { pattern: '^Epilogue$' }
        ],
        section: [
          { namedStyleType: 'HEADING_2' },
          { pattern: '^\\*\\*\\*$' }  // Scene break
        ],
        subsection: [
          { namedStyleType: 'HEADING_3' }
        ]
      }
    },

    // Technical documentation
    technical: {
      structure: {
        chapter: [
          { namedStyleType: 'HEADING_1' },
          { pattern: '^\\d+\\.\\s+[A-Z]' }
        ],
        section: [
          { namedStyleType: 'HEADING_2' },
          { pattern: '^\\d+\\.\\d+\\s+' }
        ],
        subsection: [
          { namedStyleType: 'HEADING_3' },
          { namedStyleType: 'HEADING_4' },
          { pattern: '^\\d+\\.\\d+\\.\\d+\\s+' }
        ]
      }
    },

    // Flat - no heading detection, just paragraphs
    flat: {
      structure: {
        chapter: [],
        section: [],
        subsection: []
      }
    }
  };

  // Merge configs helper
  GDocAddrConfig.merge = function(base, override) {
    const result = JSON.parse(JSON.stringify(base));
    for (const key of Object.keys(override)) {
      if (typeof override[key] === 'object' && !Array.isArray(override[key])) {
        result[key] = GDocAddrConfig.merge(result[key] || {}, override[key]);
      } else {
        result[key] = override[key];
      }
    }
    return result;
  };

  // Get preset by name
  GDocAddrConfig.getPreset = function(name) {
    return GDocAddrConfig.presets[name] || GDocAddrConfig;
  };

  // Export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = GDocAddrConfig;
  } else {
    global.GDocAddrConfig = GDocAddrConfig;
  }

})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this);
