# TetraScript: Provisional Configuration Language Specification

## Abstract
TetraScript is the foundational configuration language for Tetra, providing a typed syntax for infrastructure automation and change management. This document codifies the provisional specification for TetraScript's core syntax, semantics, and operational model using the `@type[value]` notation and the fundamental transformation pattern `@input → @output`.

## 1. Core Syntax

### 1.1 Basic Equation Structure
```
ENV × Module / verb × @type[value] → @type[result]
```

**Components:**
- **ENV**: Environment context (DEMO, PROD, STAGING, etc.)
- **Module**: Module/mode context (LEARN, DEPLOY, TEST, etc.)
- **verb**: Operation to perform (analyze, configure, restart, etc.)
- **@type[value]**: Typed input specification
- **@type[result]**: Typed output specification

### 1.2 Data Type Syntax
The `@type[value]` syntax provides strong typing for all TetraScript operations:

```bash
@var[name]           # Variables and state
@env[ENV_VAR]        # Environment variables
@file[path/file]     # File system resources
@pipe[stream]        # Data streams and pipes
@cmd[command]        # Shell commands
@service[name]       # System services
@k8s[resource]       # Kubernetes resources
@stdout[content]     # Standard output
@stderr[error]       # Standard error
@stdin[input]        # Standard input
```

### 1.3 Tetra Variables
Special syntax for internal Tetra state variables:
```bash
@var[::stateName]    # Internal Tetra variable
@var[${ENV_VAR}]     # Environment variable resolution
@var[::${computed}]  # Computed Tetra variable
```

## 2. Transformation Semantics

### 2.1 Input → Output Pattern
Every TetraScript operation follows the transformation pattern:
```
@input_type[source] → @output_type[destination]
```

This represents:
- **Source binding**: What data/resource is consumed
- **Destination binding**: What data/resource is produced
- **Type preservation**: Input and output types ensure operation safety
- **Side effect clarity**: All mutations are explicit in the output type

### 2.2 Type Compatibility Matrix
Valid transformations between data types:

| Input Type | Valid Output Types | Semantics |
|------------|-------------------|-----------|
| `@var[x]` | `@file`, `@env`, `@stdout`, `@pipe` | Variable expansion and export |
| `@file[x]` | `@var`, `@env`, `@stdout`, `@pipe` | File content processing |
| `@env[x]` | `@var`, `@file`, `@stdout` | Environment variable operations |
| `@cmd[x]` | `@stdout`, `@stderr`, `@file`, `@var` | Command execution results |
| `@service[x]` | `@stdout`, `@stderr`, `@var` | Service status and control |
| `@pipe[x]` | `@file`, `@stdout`, `@var` | Stream processing |

### 2.3 Binding Resolution
TetraScript resolves bindings at execution time:

```bash
# Literal binding
DEMO × LEARN / show × @var[demo] → @stdout[display]

# Environment variable binding
PROD × DEPLOY / restart × @service[${APP_NAME}] → @stdout[status]

# Tetra variable binding
TUI × TEST / validate × @var[::currentState] → @file[test-results.json]

# Computed binding
MODULES × DEBUG / analyze × @file[${LOG_DIR}/error.log] → @var[::errorCount]
```

## 3. Operational Examples

### 3.1 Configuration Management
```bash
# Load configuration from file to environment
PROD × DEPLOY / load × @file[config.toml] → @env[DATABASE_URL]

# Backup current config to Tetra state
PROD × DEPLOY / backup × @env[DATABASE_URL] → @var[::configBackup]

# Restore from backup
PROD × DEPLOY / restore × @var[::configBackup] → @env[DATABASE_URL]
```

### 3.2 Service Management
```bash
# Start service and capture status
PROD × DEPLOY / start × @service[webapp] → @stdout[startup-log]

# Scale service based on Tetra variable
PROD × MONITOR / scale × @var[::targetReplicas] → @k8s[deployment/webapp]

# Health check with error handling
PROD × MONITOR / healthcheck × @service[webapp] → @stderr[health-status]
```

### 3.3 Data Processing
```bash
# Process log file through pipeline
MODULES × DEBUG / parse × @file[app.log] → @pipe[errorStream]

# Filter and store results
MODULES × DEBUG / filter × @pipe[errorStream] → @file[critical-errors.log]

# Update metrics based on analysis
MODULES × MONITOR / aggregate × @file[critical-errors.log] → @var[::errorRate]
```

### 3.4 Development Workflow
```bash
# Build application and capture output
TUI × BUILD / compile × @cmd[make build] → @stdout[build-log]

# Run tests with results capture
TUI × TEST / execute × @cmd[npm test] → @file[test-results.xml]

# Deploy if tests pass
TUI × DEPLOY / conditional × @var[::testsPassed] → @service[staging-app]
```

## 4. Advanced Features

### 4.1 Pipeline Composition
Chain multiple operations using intermediate Tetra variables:
```bash
# Step 1: Load and validate config
PROD × DEPLOY / validate × @file[config.toml] → @var[::validConfig]

# Step 2: Apply validated config
PROD × DEPLOY / apply × @var[::validConfig] → @env[RUNTIME_CONFIG]

# Step 3: Restart with new config
PROD × DEPLOY / restart × @service[webapp] → @stdout[restart-status]
```

### 4.2 Conditional Execution
Use Tetra variables for conditional logic:
```bash
# Check deployment status
PROD × MONITOR / status × @service[webapp] → @var[::serviceHealth]

# Conditional rollback based on health
PROD × DEPLOY / rollback × @var[::serviceHealth] → @file[rollback.log]
  if: @var[::serviceHealth] == "unhealthy"
```

### 4.3 Error Handling
Explicit error handling through type system:
```bash
# Operation with error capture
PROD × DEPLOY / migrate × @file[migration.sql] → @stderr[migration-errors]

# Error processing and notification
PROD × NOTIFY / alert × @stderr[migration-errors] → @service[slack-webhook]
  when: @stderr[migration-errors] != ""
```

## 5. Implementation Considerations

### 5.1 Type Safety
- All `@type[value]` expressions must resolve to valid resources
- Type mismatches generate compile-time errors
- Runtime type checking ensures operation safety

### 5.2 Resource Management
- File paths in `@file[path]` are validated for existence and permissions
- Environment variables in `@env[name]` are checked for definition
- Services in `@service[name]` are validated for availability

### 5.3 State Management
- Tetra variables `@var[::name]` persist across operations
- State changes are atomic and reversible
- All state mutations are logged for audit and rollback

### 5.4 Security Model
- Resource access is constrained by execution context
- Sensitive data in Tetra variables is encrypted at rest
- All operations are logged with full audit trail

## 6. Grammar Specification

### 6.1 EBNF Grammar
```ebnf
TetraScript := Context "/" Operation "→" Output

Context := Environment "×" Module
Environment := IDENTIFIER
Module := IDENTIFIER

Operation := Verb "×" Input
Verb := IDENTIFIER
Input := TypedValue

Output := TypedValue

TypedValue := "@" Type "[" Value "]"
Type := "var" | "env" | "file" | "pipe" | "cmd" | "service" | "k8s" |
        "stdout" | "stderr" | "stdin"

Value := IDENTIFIER | EnvVar | TetraVar | Path
EnvVar := "${" IDENTIFIER "}"
TetraVar := "::" IDENTIFIER
Path := ["/"] IDENTIFIER ("/" IDENTIFIER)*

IDENTIFIER := [a-zA-Z_][a-zA-Z0-9_-]*
```

### 6.2 Token Definitions
- **Environment/Module names**: Uppercase identifiers (PROD, DEMO, LEARN)
- **Verb names**: Lowercase identifiers (deploy, analyze, configure)
- **Type names**: Lowercase identifiers matching supported types
- **Variable names**: Standard identifier rules with special prefixes

## 7. Future Extensions

### 7.1 Planned Features
- **Pattern matching**: Complex input pattern matching for conditional operations
- **Parallel execution**: Concurrent operation specification
- **Resource pools**: Managed resource allocation and cleanup
- **Dependency graphs**: Automatic dependency resolution and ordering

### 7.2 Syntax Evolution
- **Namespace support**: `@namespace:type[value]` for multi-tenant operations
- **Version constraints**: `@type[value@version]` for versioned resources
- **Metadata annotations**: `@type[value]{metadata}` for operation hints

## Conclusion
TetraScript provides a foundation for type-safe infrastructure automation with clear semantics and explicit resource management. The `@type[value] → @type[result]` pattern ensures operational clarity while maintaining the flexibility needed for complex infrastructure workflows.

This provisional specification establishes the core language constructs while allowing for future evolution based on practical implementation experience and user feedback.