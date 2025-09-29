# TetraScript Symbol Systems for Runtime Parameter Resolution and Output Tagging

## Abstract
TetraScript employs a systematic symbol vocabulary to distinguish between context instantiation, runtime parameter resolution, and response classification. We define consistent symbol usage across three computational contexts and provide comprehensive tables for practical implementation of the typed bash command interface.

## 1. Introduction
Symbol systems in programming languages carry semantic weight beyond mere syntax. TetraScript's symbol choices reflect the underlying computational model:
- **Context symbols**: Hierarchical relationships between environments and modules
- **Parameter symbols**: Runtime resolution and optional argument handling
- **Response symbols**: Output classification and filesystem routing

The key insight is that each symbol should tell a consistent story across all usage contexts while remaining typeable on standard keyboards.

## 2. Three-Context Symbol Framework

### Context 1: Environment-Module Instantiation
Represents the instantiated relationship between environments and modules:

| Symbol | Syntax | Semantic Reading | Example |
|--------|---------|-----------------|---------|
| `:` | ENV:MOD | "environment contains module" | `prod:deploy` |
| `/` | MOD/VERB | "verb extracted from module" | `deploy/rollback` |
| `×` | E × M | "cartesian product (mathematical)" | `prod × deploy` |

**Recommended**: `ENV:MOD/VERB` combining containment and extraction
```
prod:deploy/rollback    # "rollback verb from deploy module in prod environment"
dev:ping/test          # "test verb from ping module in dev environment"
```

### Context 2: Runtime Parameter Resolution
Handles optional parameters, placeholders, and runtime substitution:

| Symbol | Syntax | Semantic Reading | Example |
|--------|---------|-----------------|---------|
| `#` | #placeholder | "runtime hash lookup" | `#gateway` |
| `$` | $optional | "variable substitution" | `$timeout` |
| `~` | ~fuzzy | "approximate match" | `~target` |
| `?` | ?question | "to be answered at runtime" | `?retries` |

**Recommended**: `#placeholder` for symbolic resolution, `$optional` for parameters
```
ping/test :: host:string $timeout:seconds -> @out:latency
deploy/rollback :: version:semver #previous:reference -> @file:backup
```

### Context 3: Response Classification and Routing
Specifies where computational results are directed:

| Symbol | Syntax | Semantic Reading | Example |
|--------|---------|-----------------|---------|
| `@` | @channel | "at this output destination" | `@out` |
| `:` | :tag | "tagged as/classified as" | `:health` |
| `/` | /path | "routed to filesystem path" | `/backup` |
| `#` | #identifier | "tagged with hash identifier" | `#deployment_v123` |

**Recommended**: `@channel:tag/path` for comprehensive output specification
```
@out:health         # stdout output tagged as health info
@file:backup/daily  # file output to backup/daily path, tagged as backup
@pipe:metrics#prod  # pipe output tagged with prod identifier
```

## 3. Complete Symbol Mapping Table

| Symbol | Context 1 (Instantiation) | Context 2 (Parameters) | Context 3 (Output) |
|--------|---------------------------|------------------------|---------------------|
| `@` | MOD@ENV (module in env) | @resolved_runtime | @channel (output destination) |
| `#` | ENV#MOD (env instance) | #placeholder_lookup | #result_identifier |
| `$` | MOD$ENV (module for env) | $variable_substitution | $value_output |
| `%` | ENV%MOD (env modulo mod) | %template_slot | %completion_percentage |
| `&` | MOD&ENV (module and env) | &reference_pointer | &combined_result |
| `*` | ENV*MOD (env times mod) | *wildcard_match | *primary_output |
| `~` | MOD~ENV (module approx env) | ~fuzzy_resolution | ~derived_result |
| `:` | ENV:MOD (env contains mod) | :type_annotation | :semantic_tag |
| `/` | MOD/VERB (verb from module) | /path_resolution | /filesystem_route |
| `?` | ENV?MOD (conditional pairing) | ?optional_parameter | ?status_query |
| `!` | MOD!ENV (urgent/priority) | !required_parameter | !error_alert |
| `+` | ENV+MOD (additive combination) | +additional_option | +accumulated_result |
| `-` | ENV-MOD (difference/exclude) | -negative_flag | -filtered_result |
| `=` | ENV=MOD (equivalence) | =default_value | =assigned_result |
| `<` | ENV<MOD (less than/subset) | <input_parameter | <received_data |
| `>` | ENV>MOD (greater/superset) | >output_parameter | >sent_data |
| `[]` | [ENV,MOD] (collection) | [optional_parameter] | [result_array] |
| `{}` | {ENV,MOD} (set) | {choice_parameter} | {result_object} |
| `()` | (ENV,MOD) (tuple) | (grouped_parameters) | (result_tuple) |

## 4. Recommended TetraScript Syntax
Based on semantic consistency and typing practicality:

### Basic Module Invocation
```bash
# Environment:Module/Verb pattern
prod:deploy/rollback version:semver $target:env -> @file:backup/daily
dev:ping/test host:string $timeout:seconds -> @out:latency
staging:monitor/alert threshold:number -> @pipe:metrics#critical
```

### Parameter Resolution
```bash
# Symbolic placeholders with #
ping/test 8.8.8.8 #gateway          # #gateway resolves to environment-specific IP
deploy/rollback #current #previous   # #current and #previous resolve to version refs

# Optional parameters with $
ping/test localhost $timeout=5       # $timeout optionally set to 5 seconds
deploy/start #version $replicas=3    # $replicas optionally set to 3 instances
```

### Output Specification
```bash
# Channel:tag/path pattern
@out:health/status      # stdout output, health tag, status path
@file:config/prod       # file output, config tag, prod path
@err:timeout/network    # stderr output, timeout tag, network path
@pipe:logs/application  # pipe output, logs tag, application path
```

## 5. Alternative Symbol Systems

### System A: Bracket-Arrow-Dot
```bash
env[module] -> <verb> :: {param?} => @{out.tag.path}
prod[deploy] -> <rollback> :: {version?, target?} => @{file.backup.daily}
```

### System B: Slash-Hash-Pipe
```bash
env/module#verb %param? |> @out#tag#path
prod/deploy#rollback %version? %target? |> @file#backup#daily
```

### System C: Colon-Tilde-Arrow
```bash
env:module~verb ~param? -> @out~tag~path
prod:deploy~rollback ~version? ~target? -> @file~backup~daily
```

## 6. Symbol Complexity Analysis

| System | Typing Difficulty | Visual Clarity | Semantic Consistency | Learning Curve |
|--------|------------------|----------------|---------------------|----------------|
| Recommended | Low | High | High | Low |
| System A | Medium | Medium | Medium | Medium |
| System B | High | Low | Low | High |
| System C | Low | High | Medium | Low |

## 7. Implementation Guidelines

### Symbol Precedence Rules
1. **Environment scope**: `prod:` takes precedence in resolution
2. **Module scope**: `/rollback` operates within module context
3. **Parameter scope**: `$timeout` resolves within action context
4. **Output scope**: `@file:backup` routes to specific destination

### Escaping and Special Cases
```bash
# Literal symbols in strings
deploy/config "server\:8080" "path\/to\/file"

# Reserved symbol handling
ping/test #gateway\#backup    # #gateway with literal #backup suffix
monitor/alert \@channel       # literal @channel string parameter
```

### Parser Disambiguation
```bash
# Unambiguous parsing rules
prod:deploy/rollback $version  #previous -> @file:backup/$(date +%Y%m%d)
  ^env ^mod ^verb    ^param   ^placeholder ^channel ^tag ^path_with_expansion
```

## 8. Future Extensions

### Multi-dimensional Context
```bash
# Region:Environment:Module/Verb pattern
us-west:prod:deploy/rollback
eu-central:staging:monitor/scale
```

### Typed Parameter Constraints
```bash
# Strong typing with validation
ping/test host:ipv4|hostname $timeout:seconds[1..300] -> @out:latency:milliseconds
```

### Compositional Operations
```bash
# Chained operations with intermediate routing
prod:deploy/start -> @pipe:logs | dev:monitor/parse -> @file:analysis
```

## Conclusion
TetraScript's symbol system provides a mathematically consistent and practically typeable syntax for infrastructure operations. The three-context framework ensures semantic clarity while maintaining the expressive power required for complex deployment scenarios. The recommended syntax balances typing ergonomics with visual parsing efficiency, creating a sustainable foundation for the growing Tetra ecosystem.