# tmod Module Tests

## Overview
This directory contains test scripts for the `tmod` module management system.

## Running Tests
To run all tests:
```bash
./run_tests.sh
```

## Test Scripts
- `test_module_loading.sh`: Tests module loading functionality
  - Loading existing modules
  - Loading non-existent modules
  - Loading modules with dev flag

## Test Helpers
`test_helpers.sh` provides assertion functions for testing:
- `assert_success`: Check command succeeds
- `assert_failure`: Check command fails
- `assert_contains`: Check output contains string
- `assert_true`: Check bash condition

## Test Output
Tests provide colored output:
- Green ✓ for passed tests
- Red ✗ for failed tests

A summary is printed at the end showing total, passed, and failed tests.
