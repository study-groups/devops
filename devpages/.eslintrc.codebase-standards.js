/**
 * ESLint rules for maintaining codebase standards from systematic review
 * Add to your main .eslintrc.js: "extends": ["./.eslintrc.codebase-standards.js"]
 */
module.exports = {
  rules: {
    // Prevent relative imports (maintain absolute import paths)
    'import/no-relative-parent-imports': 'error',
    
    // Prevent direct console usage (use logging service)
    'no-console': ['warn', { 
      allow: ['warn', 'error'] // Allow warnings/errors but discourage console.log
    }],
    
    // Discourage commented code (cleanup artifacts)
    'no-warning-comments': ['warn', { 
      terms: ['TODO', 'FIXME', 'import'], 
      location: 'anywhere' 
    }],
  },
  
  overrides: [
    {
      // Authentication files - enforce single source of truth
      files: [
        'client/auth.js',
        'client/store/slices/authSlice.js'
      ],
      rules: {
        'max-lines': ['error', { max: 300, skipComments: true }],
        'complexity': ['error', { max: 10 }]
      }
    },
    
    {
      // Prevent service access inconsistencies
      files: ['client/**/*.js'],
      rules: {
        'no-restricted-globals': [
          'error',
          {
            name: 'fetch',
            message: 'Use window.APP.services.globalFetch instead of direct fetch'
          }
        ]
      }
    }
  ]
};