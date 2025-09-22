New TSM Tests Created

  1. test_start_restart_services.sh - Comprehensive Service Lifecycle Tests

  - Service startup with environment file loading
  - Environment variable parsing and injection (PORT, NODE_ENV, etc.)
  - Service restart functionality with PID verification
  - Stop and restart from stopped state
  - Multiple rapid restarts stress testing
  - Enable/disable service lifecycle integration
  - Error handling and recovery scenarios

  2. test_service_conventions.sh - Service Definition Standards Tests

  - Standard format validation (TSM_NAME, TSM_COMMAND, TSM_CWD, TSM_ENV_FILE)
  - Environment file conventions (env/local.env, env/production.env patterns)
  - Service naming conventions (kebab-case validation)
  - Command structure testing (Node.js, Python, shell scripts)
  - Working directory semantics (TSM_CWD as project root)
  - Enable/disable structure (symlink validation)
  - Documentation standards (headers, comments, metadata)
  - Common patterns (Node.js web apps, Python APIs, worker scripts)

  3. Updated run_all_tests.sh

  Added the new tests to the master test runner with proper sequencing and
  reporting.

  Key TSM Conventions Validated

  - TSM_CWD: Semantic name for service start directory (project root)
  - TSM_ENV_FILE: Relative path from TSM_CWD (e.g., "env/local.env")
  - Environment Loading: Automatic PORT extraction and variable injection
  - Service Definitions: Standard format with required/optional variables
  - Enable/Disable: Nginx-style symlinks in services/enabled/

  Testing Coverage

  The tests validate:
  ✅ Service definition creation and parsing✅ Environment file loading and variable
   injection✅ Start/restart lifecycle with PID management✅ Working directory and
  path resolution✅ Service enable/disable functionality✅ Error handling and edge
  cases✅ Multiple service patterns and conventions

  You can run these tests with:
  cd /Users/mricos/src/devops/tetra/bash/tsm/tests
  ./run_all_tests.sh

  Or run individual tests:
  ./test_start_restart_services.sh
  ./test_service_conventions.sh
