    // jest.config.js
    /** @type {import('jest').Config} */
    export default {
        // Indicates that the code coverage information should be collected while executing the test
        collectCoverage: true,
  
        // The directory where Jest should output its coverage files
        // coverageDirectory: "coverage",
  
        // An array of glob patterns indicating a set of files for which coverage information should be collected
        collectCoverageFrom: [
            "**/*.js",
            "!**/node_modules/**",
            "!**/tests/**",
            "!jest.config.js"
        ],
  
        // By default, Jest uses Babel to transform files.
        // If your project is pure ES Modules and doesn't need transpilation
        // (e.g., not using TypeScript or JSX that needs conversion),
        // you can disable the default transformation.
        transform: {
            // If you find you DO need Babel for some advanced JS features not in your Node version
            // or for transforming problematic CJS dependencies:
            // "^.+\\.js$": "babel-jest",
        },
  
        // If you are using Node's experimental VM modules,
        // Jest should work correctly with ES modules.
        // You might not need further ESM-specific config here if the
        // --experimental-vm-modules flag is used in your npm script.
  
        // The test environment that will be used for testing
        testEnvironment: "node",
        roots: ["<rootDir>/tests"],
        moduleFileExtensions: ["js", "json", "node"],
        testMatch: [
            "**/tests/**/*.test.js",
            "**/?(*.)+(spec|test).js"
        ],
        verbose: true,
        // setupFilesAfterEnv: ['./tests/setupFile.js'], // if you have a setup file
        // Ensure modules are properly resolved
        moduleDirectories: ["node_modules", "<rootDir>"]
    };
