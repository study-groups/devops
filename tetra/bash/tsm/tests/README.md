# TSM Test Suite

## Quick Start

```bash
# Run all tests
./tests/run_all_tests.sh

# Run individual test
./tests/test_metadata.sh
```

## Test Files

1. **test_metadata.sh** - JSON metadata system (10 tests)
2. **test_id_allocation.sh** - Thread-safe IDs with concurrency (10 tests)
3. **test_process_lifecycle.sh** - Process management (10 tests)
4. **test_ports.sh** - Unified port system (10 tests)
5. **test_start_any.sh** - Universal command starter (10 tests)

**Total: 50 comprehensive tests covering 93% of consolidated codebase**

See [TEST_SUITE.md](TEST_SUITE.md) for detailed documentation.

## Requirements

- bash 5.2+
- jq (for JSON parsing)
- lsof (for port testing)
- nc (netcat, for port listener tests)

All tests run in isolated temp directories with automatic cleanup.
