# TetraScript Type Signatures Enable Functional Pattern Matching in Bash Command Interfaces

## Abstract
TetraScript introduces a type system for bash commands that enables compile-time validation, runtime pattern matching, and automatic argument consumption. By treating module verbs as typed functions and command-line arguments as token streams, we achieve functional programming semantics within the bash ecosystem while maintaining full compatibility with existing shell conventions.

## 1. Introduction
Traditional bash commands lack type safety and argument validation, leading to runtime errors and inconsistent interfaces. TetraScript addresses this by:
- **Type signatures**: Every module verb declares its expected argument types
- **Pattern matching**: Runtime dispatcher matches arguments to type patterns
- **Token consumption**: Left-to-right functional pipeline processing
- **Error reporting**: Compile-time type checking with helpful error messages

The core innovation is treating bash commands as typed functions in a functional programming language while preserving shell ergonomics.

## 2. Type Signature Syntax
TetraScript uses Haskell-inspired type signatures with bash-friendly syntax:

```bash
# Basic type signature format
module/verb :: param_type [optional_type] -> @output_channel:tag

# Concrete examples
ping/test :: host:string $timeout:seconds -> @out:latency
deploy/rollback :: version:semver [target:env] -> @file:backup
monitor/scale :: service:string replicas:number -> @pipe:metrics
```

### Primitive Types
| Type | Description | Example Values |
|------|-------------|----------------|
| `string` | Any text | `"hello"`, `localhost` |
| `number` | Integer or float | `42`, `3.14` |
| `boolean` | True/false values | `true`, `false`, `1`, `0` |
| `path` | Filesystem path | `/usr/bin`, `./config` |
| `host` | Hostname or IP | `example.com`, `192.168.1.1` |
| `port` | Network port | `8080`, `443` |
| `semver` | Semantic version | `v1.2.3`, `2.0.0-beta` |
| `seconds` | Time duration | `30`, `5.5` |
| `env` | Environment name | `prod`, `staging`, `dev` |

### Composite Types
```bash
# Optional parameters with []
deploy/start :: version:semver [replicas:number] -> @file:deployment

# Union types with |
connect/database :: host:string port:number|string -> @out:connection

# Enum types with {}
log/level :: level:{debug,info,warn,error} -> @file:config

# Array types with []
backup/files :: paths:[path] -> @file:archive
```

## 3. Module Type Declaration
Modules declare their available verbs with type signatures:

```bash
# In bash/ping/types.sh
declare -A PING_TYPES=(
  [test]="host:string [timeout:seconds] -> @out:latency"
  [trace]="host:string [hops:number] -> @out:route"
  [flood]="host:string count:number [interval:milliseconds] -> @err:results"
  [sweep]="network:cidr [ports:[port]] -> @file:scan"
)

# In bash/deploy/types.sh
declare -A DEPLOY_TYPES=(
  [start]="version:semver [replicas:number] -> @file:deployment"
  [stop]="service:string [graceful:boolean] -> @out:status"
  [rollback]="[steps:number] -> @file:backup"
  [status]="[verbose:boolean] -> @out:info"
  [blue_green]="version:semver target:env -> @file:deployment"
)
```

## 4. Runtime Pattern Matching
The TetraScript runtime matches command arguments against type signatures:

### Argument Consumption Algorithm
```bash
# Example command: tetra ping/test example.com 5
# Type signature: ping/test :: host:string [timeout:seconds] -> @out:latency

match_arguments() {
  local signature="$1"
  local args=("${@:2}")

  # Parse signature: host:string [timeout:seconds]
  required_params=(host:string)
  optional_params=(timeout:seconds)

  # Match arguments left-to-right
  for param in "${required_params[@]}"; do
    if [[ ${#args[@]} -eq 0 ]]; then
      error "Missing required parameter: $param"
    fi

    validate_type "${args[0]}" "$param"
    consume_argument
  done

  # Match optional parameters
  while [[ ${#args[@]} -gt 0 ]]; do
    if match_optional_param "${args[0]}"; then
      consume_argument
    else
      error "Unexpected argument: ${args[0]}"
    fi
  done
}
```

### Type Validation Examples
```bash
# Valid invocations
tetra ping/test example.com              # host:string matched
tetra ping/test example.com 5            # host:string timeout:seconds matched
tetra deploy/start v1.2.3                # version:semver matched
tetra deploy/start v1.2.3 3              # version:semver replicas:number matched

# Type errors with helpful messages
$ tetra ping/test not-a-host-format 5.7.invalid
✗ Type error in ping/test:
  Parameter 'host': "not-a-host-format" is not a valid host:string
  Parameter 'timeout': "5.7.invalid" is not a valid seconds (expected number)

  Expected: ping/test :: host:string [timeout:seconds] -> @out:latency

  Valid examples:
    tetra ping/test example.com
    tetra ping/test 192.168.1.1 30
    tetra ping/test localhost 5
```

## 5. Functional Pipeline Processing
TetraScript supports functional composition through token streaming:

### Left-to-Right Processing
```bash
# Pipeline: input | function1 | function2 | output
echo "v1.2.3" | tetra deploy/validate | tetra staging/deploy | tetra monitor/health

# Expanded with types:
string -> (deploy/validate :: version:semver -> @out:valid)
       -> (staging/deploy :: valid:deployment -> @file:state)
       -> (monitor/health :: state:deployment -> @out:status)
```

### Monadic Composition
```bash
# Each operation threads context and state
tetra_chain() {
  local context="$1"
  shift

  for operation in "$@"; do
    result=$(execute_with_context "$operation" "$context")
    context=$(update_context "$context" "$result")
  done

  echo "$context"
}

# Usage: thread context through operations
tetra_chain "prod:deploy" \
  "deploy/backup current" \
  "deploy/start v1.2.3" \
  "monitor/health 60"
```

## 6. Advanced Type Features

### Dependent Types
```bash
# Output type depends on input parameters
backup/create :: target:env -> @file:backup_$(target)_$(date)
log/rotate :: service:string level:{debug,info} -> @file:logs/$(service)/$(level)
```

### Parametric Polymorphism
```bash
# Generic container operations
cache/get :: key:string -> @out:value|@err:not_found
cache/set :: key:string value:* -> @out:success
cache/delete :: key:string -> @out:boolean
```

### Type Constraints
```bash
# Constrained numeric types
monitor/scale :: service:string replicas:number[1..100] -> @pipe:metrics
network/port :: service:string port:number[1024..65535] -> @file:config
timer/wait :: duration:seconds[0.1..3600] -> @out:completed
```

## 7. Type System Integration Table

| Feature | Traditional Bash | TetraScript | Benefit |
|---------|------------------|-------------|---------|
| Argument validation | Manual `if` checks | Automatic type checking | Reduced boilerplate |
| Error messages | Generic "invalid option" | Specific type mismatches | Better debugging |
| Documentation | Separate man pages | Self-documenting signatures | Inline help |
| Auto-completion | Static completions | Type-aware suggestions | Dynamic completions |
| Testing | Manual test cases | Property-based type tests | Comprehensive validation |
| Refactoring | Error-prone | Type-safe transformations | Confident changes |

## 8. Implementation Patterns

### Discovery and Help
```bash
# Type-aware discovery
$ tetra discover ping
ping/test     :: host:string [timeout:seconds] -> @out:latency
ping/trace    :: host:string [hops:number] -> @out:route
ping/flood    :: host:string count:number -> @err:results

# Intelligent help system
$ tetra help ping/test
ping/test :: host:string [timeout:seconds] -> @out:latency

Parameters:
  host     (string)  - Target hostname or IP address
  timeout  (seconds) - Optional timeout in seconds (default: 5)

Output:
  @out:latency - Ping latency measurements in milliseconds

Examples:
  tetra ping/test google.com
  tetra ping/test 8.8.8.8 10
  tetra ping/test example.com 2.5
```

### Type-Driven Testing
```bash
# Automatic property-based testing
test_ping_properties() {
  # Generate random valid inputs based on types
  for i in {1..100}; do
    host=$(generate_valid_host)
    timeout=$(generate_valid_seconds)

    result=$(tetra ping/test "$host" "$timeout")
    assert_output_type "$result" "@out:latency"
  done
}
```

### IDE Integration
```bash
# Language server protocol support
tetra_lsp_complete() {
  local current_token="$1"
  local context="$2"

  case "$context" in
    "module/verb")
      suggest_verbs_matching "$current_token"
      ;;
    "parameter")
      suggest_typed_values "$current_token"
      ;;
    "output")
      suggest_output_channels "$current_token"
      ;;
  esac
}
```

## 9. Error Handling and Recovery

### Type Error Categories
```bash
# Missing required parameter
$ tetra deploy/start
✗ Missing required parameter: version:semver
  Usage: tetra deploy/start version:semver [replicas:number]

# Wrong type
$ tetra ping/test not-a-host abc
✗ Type errors:
  Parameter 1: "not-a-host" is not a valid host:string
  Parameter 2: "abc" is not a valid seconds

  Did you mean: tetra ping/test localhost 5?

# Too many arguments
$ tetra ping/test example.com 5 extra args
✗ Too many arguments. Expected 1-2, got 4.
  Usage: tetra ping/test host:string [timeout:seconds]
```

### Automatic Correction Suggestions
```bash
# Fuzzy matching for typos
$ tetra ping/tset example.com
✗ Unknown verb: ping/tset
  Did you mean: ping/test?

# Type coercion suggestions
$ tetra monitor/scale webapp "5"
✗ Type mismatch: replicas expects number, got string "5"
  Suggestion: tetra monitor/scale webapp 5
```

## Conclusion
TetraScript's type system transforms bash from a stringly-typed shell into a statically-verified functional programming environment. By combining Haskell-inspired type signatures with bash ergonomics, we achieve the safety and expressiveness of functional languages while maintaining the operational familiarity of shell scripting. This foundation enables confident infrastructure automation with compile-time guarantees and runtime safety.