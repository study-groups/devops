# TSM Help Documentation

This file contains all help content for TSM, used by both `tsm help` and `tsm repl` `/help` commands.

Section markers:
- `## COMMAND:<name>` - Help for a specific command
- `## TOPIC:<name>` - Help for a conceptual topic
- `## REFERENCE:<name>` - Detailed reference material

---

## TOPIC:node-versions

### Node.js Version Resolution in TSM

TSM intelligently manages Node.js versions by respecting your current shell's environment while providing fallback to its own nvm installation.

#### How TSM Resolves Node Versions

When you run `tsm start node test.js`, TSM follows this resolution order:

1. **Inheritance Check**: If `NVM_DIR` is set in your current shell
   - TSM inherits your current node version
   - Pre-hook activation is SKIPPED
   - Example: After `nvm use v18`, tsm will use v18

2. **TSM Activation**: If `NVM_DIR` is NOT set
   - TSM activates its own nvm from `$TETRA_DIR/nvm`
   - Uses the default node version configured in TSM's nvm
   - Pre-hook runs to source nvm and activate node

**Key Insight**: The pre-hook only runs if needed! It checks:
```bash
if [[ -z "$NVM_DIR" ]]; then
    # Activate TSM's nvm
fi
```

#### Verification Methods

Before starting a process, verify which node version TSM will use:

```bash
# Method 1: Check your current shell's node
nvm current          # Shows active nvm version
which node           # Shows node binary path
node --version       # Shows node version

# Method 2: Query TSM directly
tsm runtime info node               # Shows TSM's view of node runtime
tsm start --dry-run node test.js    # Shows what would execute
```

After `tsm start`, check the running process:
```bash
tsm info <process-name>   # Shows interpreter path used
tsm env <process-name>    # Shows NVM_DIR and PATH
```

#### Override Mechanisms

You have multiple ways to control which node version TSM uses:

**Method 1: Set node version before starting TSM**
```bash
nvm use v20
tsm start node test.js    # Will use v20 (inherited)
```

**Method 2: Use --pre-hook flag**
```bash
# Force a specific version
tsm start --pre-hook "nvm use v18" node test.js

# Use specific nvm installation
tsm start --pre-hook "export NVM_DIR=/custom/nvm; source \$NVM_DIR/nvm.sh; nvm use v16" node app.js
```

**Method 3: Force TSM's nvm (ignore shell's node)**
```bash
# Unset NVM_DIR to force TSM activation
env -u NVM_DIR tsm start node test.js
```

**Method 4: Service definition pre-hook**
```bash
# In a .tsm.sh service file:
TSM_PRE_COMMAND="nvm use v20"
TSM_COMMAND="node server.js"
```

#### Common Scenarios

**Scenario 1: Fresh shell, no nvm activated**
```bash
# Shell state: NVM_DIR not set
tsm start node test.js
# Result: TSM activates $TETRA_DIR/nvm, uses default node
```

**Scenario 2: After activating specific version**
```bash
nvm use v18
tsm start node test.js
# Result: TSM inherits v18 from shell
```

**Scenario 3: Multiple node versions in one session**
```bash
# Start first service with v18
nvm use v18
tsm start node api.js api-service

# Start second service with v20
nvm use v20
tsm start node worker.js worker-service

# Result: Each service runs with the version active when started
```

**Scenario 4: Switching versions for existing service**
```bash
# Stop the service
tsm stop api-service

# Change node version
nvm use v20

# Restart with new version
tsm start node api.js api-service
# Result: Now runs with v20
```

#### Troubleshooting

**Problem: Wrong node version is being used**

Diagnosis:
```bash
# Check what TSM sees
tsm runtime info node

# Check your shell
nvm current
which node
```

Solutions:
- Use `nvm use <version>` before `tsm start`
- Use `--pre-hook` to force specific version
- Check `tsm env <process>` to see actual NVM_DIR

**Problem: nvm: command not found**

Diagnosis:
```bash
# Check if nvm is installed
ls -la $TETRA_DIR/nvm
echo $NVM_DIR
```

Solutions:
- Install nvm in TSM: Follow TETRA nvm setup guide
- Use system node: TSM will fall back to `which node`
- Specify explicit node path with --pre-hook

**Problem: Service uses system node instead of nvm**

Cause: NVM_DIR was not set when starting

Solutions:
```bash
# Activate nvm first
source $TETRA_DIR/nvm/nvm.sh
nvm use node

# Then start service
tsm start node test.js
```

---

## TOPIC:runtimes

### Runtime Environment Management

TSM automatically detects and manages runtime environments for multiple languages.

#### Supported Runtimes

**Node.js**
- Auto-detection: Commands starting with `node` or `*.js` files
- Environment: nvm (Node Version Manager)
- Location: `$TETRA_DIR/nvm` or inherited from shell
- Pre-hook: Activates nvm if `NVM_DIR` not set
- See: `tsm help node-versions` for detailed behavior

**Python**
- Auto-detection: Commands starting with `python` or `*.py` files
- Environment: pyenv (Python Version Manager)
- Location: `$PYENV_ROOT` or system python
- Pre-hook: Activates pyenv if available

**Bash**
- Auto-detection: Commands starting with `bash` or `*.sh` files
- Interpreter: Platform-specific (Homebrew bash on macOS, /bin/bash on Linux)
- No special environment activation needed

**Others**
- Lua: Planned support for `$TETRA_DIR/lua`
- Go: Planned support for `$TETRA_DIR/go`

#### How Runtime Detection Works

1. **Process Type Detection** (`tsm_detect_type`)
   - Analyzes command string
   - Extracts first word or file extension
   - Returns: python, node, bash, lua, go, or "command"

2. **Interpreter Resolution** (`tsm_resolve_interpreter`)
   - Based on detected type, finds interpreter path
   - Checks TETRA_DIR installations first
   - Falls back to system PATH
   - Returns: full path to interpreter

3. **Pre-Hook Construction** (`tsm_build_prehook`)
   - Priority: --pre-hook flag > service definition > auto-detected
   - Builds environment activation commands
   - For node: checks NVM_DIR before activating
   - For python: activates pyenv if available

4. **Command Rewriting**
   - Replaces generic interpreter name with resolved path
   - Example: `node app.js` → `/Users/user/tetra/nvm/.../bin/node app.js`

#### Query Runtime Information

```bash
# Show info for specific runtime
tsm runtime info node
tsm runtime info python

# Check all runtimes with doctor
tsm doctor runtime

# Dry-run to see what would execute
tsm start --dry-run node test.js
tsm start --dry-run python server.py
```

#### Override Runtime Behavior

**Use --pre-hook flag:**
```bash
# Custom Python activation
tsm start --pre-hook "pyenv local 3.11" python app.py

# Custom Node activation
tsm start --pre-hook "nvm use v20" node server.js

# Multiple setup commands
tsm start --pre-hook "source venv/bin/activate && export DEBUG=1" python app.py
```

**Register custom pre-hooks:**
```bash
# In your service .tsm.sh file or shell init
tsm_register_prehook "mynode" "export NVM_DIR=/custom/nvm; source \$NVM_DIR/nvm.sh; nvm use lts"

# Then use it
tsm start --pre-hook mynode node app.js
```

#### Best Practices

1. **Verify before starting**: Use `tsm runtime info <type>` to check interpreter
2. **Pin versions**: Use `nvm use` or `pyenv local` before starting long-running services
3. **Document in services**: Add `TSM_PRE_COMMAND` to service definitions for reproducibility
4. **Test with --dry-run**: Preview what will execute before starting
5. **Check logs on failure**: Pre-hook errors are logged to `wrapper.err`

---

## COMMAND:runtime

### tsm runtime - Runtime Environment Information

Query and inspect runtime environment configuration.

#### Subcommands

**tsm runtime info [TYPE]**

Show detailed information about a runtime environment.

Arguments:
- `TYPE`: Runtime type (node, python, bash, lua, go)

Output includes:
- Interpreter path and version
- Environment source (inherited vs TSM-activated)
- Pre-hook command that would execute
- Environment variables (NVM_DIR, PYENV_ROOT, etc.)

Examples:
```bash
# Check Node.js runtime
tsm runtime info node

# Check Python runtime
tsm runtime info python

# Check all (when no type specified)
tsm runtime info
```

Sample output:
```
Node.js Runtime Info:
  Interpreter: /Users/user/tetra/nvm/versions/node/v20.10.0/bin/node
  Version: v20.10.0
  Source: Inherited from parent shell (NVM_DIR set)
  NVM_DIR: /Users/user/tetra/nvm
  Pre-hook: SKIPPED (NVM_DIR already set)

  To use a different version:
    nvm use v18 && tsm start node test.js
    tsm start --pre-hook "nvm use v18" node test.js
```

**tsm runtime list**

List all available runtimes and their status.

Output:
```
Available Runtimes:
  ✓ node     v20.10.0  /Users/user/tetra/nvm/.../bin/node
  ✓ python   3.11.5    /Users/user/.pyenv/shims/python
  ✓ bash     5.2.15    /opt/homebrew/bin/bash
  ✗ lua      not found
  ✗ go       not found
```

#### Related Commands

- `tsm doctor runtime` - Diagnose runtime environment issues
- `tsm start --dry-run CMD` - Preview runtime resolution for a command
- `tsm help runtimes` - Conceptual guide to runtime management
- `tsm help node-versions` - Detailed Node.js version resolution guide

---

## COMMAND:start

### tsm start - Start a Process or Service

Start a new TSM-managed process.

#### Usage

```bash
# Start a service by name
tsm start <service-name>

# Start a command
tsm start [OPTIONS] <command> [process-name]
```

#### Options

**Environment:**
- `--env FILE` - Source environment file before starting (e.g., env/dev.env)

**Naming:**
- Last argument becomes process name if not a flag or command argument
- Auto-generated if not provided: `<dir>-<script>-<port|timestamp>`

**Port:**
- `--port PORT` - Explicitly set port number (overrides auto-detection)

**Runtime:**
- `--pre-hook CMD` - Run command before starting process
  - Used for runtime version control: `--pre-hook "nvm use v18"`
  - Can be a function name, registered pre-hook, or shell command

**Debugging:**
- `--dry-run` - Show what would execute without starting process
  - Displays: resolved interpreter, pre-hook, final command
  - Shows environment variables that would be set
  - Useful for debugging runtime resolution

#### Examples

**Basic usage:**
```bash
# Start saved service
tsm start devpages

# Start with environment file
tsm start --env dev node server.js

# Start with explicit name
tsm start node api.js my-api-service
```

**Runtime control:**
```bash
# Use specific Node.js version
nvm use v18
tsm start node server.js

# Or with --pre-hook
tsm start --pre-hook "nvm use v18" node server.js

# Preview what would run
tsm start --dry-run node server.js
```

**Port control:**
```bash
# Explicit port (overrides auto-detection)
tsm start --port 4000 node server.js

# Auto-detection from command
tsm start python -m http.server 8080  # Detects 8080
```

**Combined options:**
```bash
tsm start --env production --port 3000 --pre-hook "nvm use v20" node api.js production-api
```

#### Environment File Workflow

1. Create environment from template:
   ```bash
   tsm init dev  # Creates env/dev.env from template
   ```

2. Edit environment file:
   ```bash
   vim env/dev.env  # Add API keys, secrets, config
   ```

3. Start with environment:
   ```bash
   tsm start --env dev server.js
   ```

Auto-detection: TSM looks for `env/dev.env` or `env/local.env` if no `--env` specified.

#### Runtime Auto-Detection

TSM automatically detects runtime and activates appropriate environment:

- **Node.js**: Activates nvm (if needed) for `node` commands and `.js` files
- **Python**: Activates pyenv for `python` commands and `.py` files
- **Bash**: Uses platform-appropriate bash for `bash` commands and `.sh` files

See: `tsm help runtimes` for details on runtime management.

#### Troubleshooting

**Process dies immediately:**
```bash
# Check logs
tsm logs <process-name>

# Look for pre-hook errors
cat $TSM_PROCESSES_DIR/<process-name>/wrapper.err

# Try dry-run to verify setup
tsm start --dry-run <command>
```

**Wrong runtime version:**
```bash
# Check what TSM will use
tsm runtime info node

# Override with pre-hook
tsm start --pre-hook "nvm use v20" node app.js
```

**Port already in use:**
```bash
# Find conflicting process
tsm doctor port <port>

# Use different port
tsm start --port 3001 node app.js
```

#### Related Commands

- `tsm stop` - Stop running process
- `tsm restart` - Restart process
- `tsm save` - Save command as service definition
- `tsm runtime info` - Check runtime configuration
- `tsm doctor` - Diagnose issues

---

## COMMAND:doctor

### tsm doctor - Diagnostics and Health Checks

Diagnose TSM environment and process issues.

#### Subcommands

**tsm doctor** (no args)
**tsm doctor healthcheck**

Run comprehensive health check:
- Validate TSM directory structure
- Check required tools (lsof, ps, jq)
- Verify process metadata integrity
- Check for orphaned processes
- Validate port registry

**tsm doctor runtime [TYPE]**

Check runtime environment configuration:
- Verify interpreters are available
- Check version managers (nvm, pyenv)
- Validate paths and environment variables
- Show which runtime would be used for each type
- Suggest fixes for common issues

Arguments:
- `TYPE`: Optional runtime type (node, python, bash)
- If omitted, checks all runtimes

Examples:
```bash
# Check all runtimes
tsm doctor runtime

# Check specific runtime
tsm doctor runtime node
```

Sample output:
```
Runtime Environment Diagnostics:

Node.js:
  ✓ Interpreter found: /Users/user/tetra/nvm/.../bin/node
  ✓ Version: v20.10.0
  ✓ NVM available: /Users/user/tetra/nvm
  ⚠ NVM_DIR set in shell (will be inherited)

Python:
  ✓ Interpreter found: /usr/bin/python3
  ✗ pyenv not found in $PYENV_ROOT
  ℹ Recommendation: Install pyenv for Python version management

Bash:
  ✓ Interpreter found: /opt/homebrew/bin/bash
  ✓ Version: 5.2.15
```

**tsm doctor port [PORT]**

Check port usage and conflicts:
- Show process using specified port
- Display TSM process if managed by TSM
- Show command and PID
- Suggest resolution options

**tsm doctor scan**

Scan for issues:
- Port conflicts
- Orphaned processes
- Stale PID files
- Invalid metadata

**tsm doctor env [PROCESS]**

Check environment for a process:
- Show environment file source
- Validate environment variables
- Check for missing or placeholder values

**tsm doctor kill [PORT]**

Kill process on specified port (use with caution).

#### Exit Codes

- `0` - All checks passed
- `1` - Issues found (see output)
- `64` - Usage error

#### Related Commands

- `tsm runtime info` - Detailed runtime information
- `tsm start --dry-run` - Preview process start
- `tsm scan-ports` - List all open ports
- `tsm info` - Process information

---

## TOPIC:pre-hooks

### Pre-Hooks: Runtime Environment Setup

Pre-hooks are commands that run before starting a process to set up the runtime environment.

#### What are Pre-Hooks?

Pre-hooks allow you to:
- Activate language version managers (nvm, pyenv, rbenv)
- Source environment files
- Set environment variables
- Run custom setup commands

#### How Pre-Hooks Work

When you start a process, TSM builds a wrapper script:
```bash
bash -c "
    # Pre-hook runs first
    <pre-hook-commands>

    # Then your command
    <your-command> &
"
```

#### Pre-Hook Priority

TSM uses the first available pre-hook from this priority list:

1. **Explicit --pre-hook flag**
   ```bash
   tsm start --pre-hook "nvm use v18" node app.js
   ```

2. **Service definition TSM_PRE_COMMAND**
   ```bash
   # In service.tsm.sh
   TSM_PRE_COMMAND="nvm use v20"
   ```

3. **Auto-detected from process type**
   - Node.js → activates nvm (if needed)
   - Python → activates pyenv (if available)

#### Auto-Detected Pre-Hooks

**Node.js** (only runs if `NVM_DIR` not already set):
```bash
if [[ -z "$NVM_DIR" ]]; then
    export NVM_DIR="$TETRA_DIR/nvm"
    [ -s "$NVM_DIR/nvm.sh" ] && source "$NVM_DIR/nvm.sh"
    nvm use node >/dev/null 2>&1 || true
fi
```

**Python** (activates pyenv if available):
```bash
export PATH="$PYENV_ROOT/bin:$PYENV_ROOT/shims:$PATH"
eval "$(pyenv init --path 2>/dev/null || true)"
eval "$(pyenv virtualenv-init - 2>/dev/null || true)"
```

#### Examples

**Simple pre-hook:**
```bash
# Activate specific Node version
tsm start --pre-hook "nvm use v18" node server.js

# Activate Python virtual environment
tsm start --pre-hook "source venv/bin/activate" python app.py
```

**Multiple commands:**
```bash
# Chain multiple setup commands
tsm start --pre-hook "nvm use v20 && export DEBUG=1" node app.js
```

**Custom pre-hook function:**
```bash
# Define function in your shell
my_setup() {
    export API_KEY="secret"
    nvm use lts
}

# Use function as pre-hook
tsm start --pre-hook "my_setup" node app.js
```

**Registered pre-hooks:**
```bash
# Register a named pre-hook
tsm_register_prehook "prod-node" "nvm use v20 && export NODE_ENV=production"

# Use it
tsm start --pre-hook prod-node node server.js
```

#### Service Definition Pre-Hooks

Save pre-hooks in service definitions for consistency:

```bash
# In services-available/my-api.tsm.sh
TSM_PRE_COMMAND="nvm use v20"
TSM_COMMAND="node api/server.js"
TSM_PORT="3000"
TSM_NAME="my-api"

# Start service (pre-hook runs automatically)
tsm start my-api
```

#### Debugging Pre-Hooks

**Check what pre-hook will run:**
```bash
tsm start --dry-run node test.js
```

**View pre-hook errors:**
```bash
# Pre-hook errors are logged to wrapper.err
cat $TSM_PROCESSES_DIR/<process-name>/wrapper.err
```

**List registered pre-hooks:**
```bash
tsm_list_prehooks
```

#### Common Pre-Hook Patterns

**Python virtual environment:**
```bash
tsm start --pre-hook "source venv/bin/activate" python app.py
```

**Specific Python version:**
```bash
tsm start --pre-hook "pyenv local 3.11" python app.py
```

**Node.js with environment:**
```bash
tsm start --pre-hook "nvm use v20 && export NODE_ENV=production" node app.js
```

**Custom PATH:**
```bash
tsm start --pre-hook "export PATH=/custom/bin:\$PATH" ./my-script.sh
```

#### When Pre-Hooks Don't Run

**Node.js pre-hook skips if:**
- `NVM_DIR` is already set in your shell
- You activated nvm before running `tsm start`
- Result: TSM inherits your current node version

**Python pre-hook skips if:**
- `PYENV_ROOT` not found
- pyenv not installed
- Result: Uses system python

#### Related Topics

- `tsm help node-versions` - Node.js version resolution details
- `tsm help runtimes` - Runtime environment overview
- `tsm help environments` - Environment file management
- `tsm runtime info` - Check runtime configuration
