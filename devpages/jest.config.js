module.exports = {
    testEnvironment: 'jest-environment-jsdom',
    transform: {
        '^.+\\.js$': 'babel-jest',
    },
    moduleNameMapper: {
        '\\.(js)$': '<rootDir>/node_modules/babel-jest',
    },
};
