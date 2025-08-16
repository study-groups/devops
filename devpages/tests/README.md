# Authentication Test Suite

This directory contains comprehensive tests for the authentication system to verify that login, session management, token generation, and API access work correctly.

## Test Files Overview

### 1. `test-auth.js` - Simple Test Runner
- **Purpose**: Quick verification of authentication flow
- **Usage**: `node test-auth.js`
- **Features**: Complete authentication flow with detailed logging
- **Best for**: Immediate verification after server changes

### 2. `tests/quick-auth-test.js` - Quick Test Suite
- **Purpose**: Detailed step-by-step authentication testing
- **Usage**: `node tests/quick-auth-test.js`
- **Features**: Enhanced logging, error scenario testing, performance metrics
- **Best for**: Debugging specific authentication issues

### 3. `tests/auth-integration.test.js` - Full Integration Tests
- **Purpose**: Comprehensive authentication system validation
- **Usage**: `node tests/auth-integration.test.js`
- **Features**: Complete test coverage, modular test classes, detailed reporting
- **Best for**: Full system validation and regression testing

### 4. `run-tests.js` - Master Test Runner
- **Purpose**: Run all test suites with comprehensive reporting
- **Usage**: 
  - `node run-tests.js` (run all tests)
  - `node run-tests.js quick` (quick tests only)
  - `node run-tests.js full` (full integration tests only)
- **Features**: Combined reporting, duration tracking, exit codes
- **Best for**: CI/CD integration and comprehensive testing

## Test Coverage

### Authentication Flow Tests
- ✅ **User Validation**: Valid and invalid user credential testing
- ✅ **Login Process**: Session establishment and cookie handling
- ✅ **User Status**: Authentication state verification
- ✅ **Token Generation**: PData token creation and validation
- ✅ **API Access**: Protected endpoint access with tokens
- ✅ **File Operations**: File listing, reading, and system operations
- ✅ **Session Management**: Session persistence and logout
- ✅ **Error Handling**: Invalid credentials, tokens, and unauthorized access

### Error Scenario Tests
- ❌ **Invalid Credentials**: Wrong username/password combinations
- ❌ **Invalid Tokens**: Malformed or expired token handling
- ❌ **Unauthenticated Access**: Requests without authentication
- ❌ **Network Errors**: Connection and timeout handling

## How to Run Tests

### Quick Start (Recommended)
```bash
# Run the simple test runner
node test-auth.js

# Or run the comprehensive test suite
node run-tests.js
```

### Individual Test Suites
```bash
# Quick tests with detailed logging
node tests/quick-auth-test.js

# Full integration tests
node tests/auth-integration.test.js

# Master test runner
node run-tests.js
```

### Specific Test Types
```bash
# Run only quick tests
node run-tests.js quick

# Run only full integration tests
node run-tests.js full
```

## Expected Results

### Successful Test Run
```
🎉 All tests passed! Authentication system is working correctly.
✅ Login, session, token generation, and API access are working correctly.
```

### Failed Test Run
```
💥 Some tests failed. Please review the authentication system.
🔧 Check the server logs and ensure all authentication endpoints are working.
```

## Test Configuration

All tests use the following configuration:
- **Base URL**: `https://devpages.qa.pixeljamarcade.com`
- **Test User**: `mike` / `nigelt`
- **Timeout**: Default fetch timeout
- **Credentials**: `include` for session cookies

## Troubleshooting

### Common Issues

1. **401 Unauthorized Errors**
   - Check if the server is running
   - Verify authentication endpoints are working
   - Ensure PData user validation is functioning

2. **Network Errors**
   - Check server connectivity
   - Verify base URL is correct
   - Ensure no firewall blocking requests

3. **Session Issues**
   - Check cookie handling
   - Verify session middleware is working
   - Ensure proper logout functionality

### Debug Steps

1. **Run Quick Tests First**
   ```bash
   node tests/quick-auth-test.js
   ```

2. **Check Server Logs**
   - Look for authentication-related errors
   - Verify endpoint responses

3. **Test Individual Endpoints**
   ```bash
   # Test login endpoint
   curl -X POST https://devpages.qa.pixeljamarcade.com/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"username":"mike","password":"nigelt"}' \
     -c cookies.txt
   ```

4. **Verify Token Generation**
   ```bash
   # Test token generation (requires session cookie)
   curl -X POST https://devpages.qa.pixeljamarcade.com/api/auth/token/generate \
     -H "Content-Type: application/json" \
     -b cookies.txt \
     -d '{"expiryHours":24,"description":"Test"}'
   ```

## Integration with CI/CD

The test suite is designed to work with CI/CD pipelines:

```yaml
# Example GitHub Actions workflow
- name: Run Authentication Tests
  run: |
    node run-tests.js
  env:
    NODE_ENV: test
```

### Exit Codes
- `0`: All tests passed
- `1`: One or more tests failed

## Test Maintenance

### Adding New Tests
1. Add test methods to appropriate test classes
2. Update the main test runner to include new tests
3. Update this README with new test descriptions

### Updating Test Configuration
1. Modify `TEST_CONFIG` in test files
2. Update user credentials if needed
3. Adjust timeouts for slower environments

### Test Data Management
- Tests use a dedicated test user account
- No test data is created or modified
- All tests clean up after themselves

## Performance Considerations

- Tests run sequentially to avoid conflicts
- Each test includes timing information
- Network requests are optimized with proper headers
- Error handling prevents hanging tests

## Security Notes

- Test credentials are for testing only
- No sensitive data is logged or stored
- Tests use HTTPS for all requests
- Session cookies are properly handled and cleaned up
