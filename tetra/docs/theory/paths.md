# TetraScript Path Builder Syntax Provides Structured Filesystem Access with Environment Variable Expansion

## Abstract
TetraScript's path builder system enables dynamic filesystem operations with environment-aware path construction, template expansion, and security-conscious broad privileges. By combining environment variables, shell expansion, and module-specific path templates, we achieve flexible file system access while maintaining organizational structure and audit trails.

## 1. Introduction
Infrastructure automation requires systematic file system access across different environments with varying path structures. TetraScript's path builder addresses this through:
- **Template-based paths**: Environment variable expansion with fallback defaults
- **Dynamic construction**: Shell command substitution and variable interpolation
- **Structured organization**: Consistent directory hierarchies across environments
- **Audit trails**: All file operations tracked with context metadata

The philosophy is **structured freedom** - broad filesystem privileges within organized, templated patterns that maintain security and traceability.

## 2. Environment Path Templates
TetraScript defines standard environment variables for consistent path organization:

```bash
# Standard Tetra environment variables
$TETRA_DIR/files      -> /opt/tetra/files      # General file storage
$TETRA_DIR/logs       -> /opt/tetra/logs       # Log file storage
$TETRA_DIR/config     -> /opt/tetra/config     # Configuration files
$TETRA_DIR/tmp        -> /opt/tetra/tmp        # Temporary files
$TETRA_DIR/backups    -> /opt/tetra/backups    # Backup storage
$TETRA_DIR/cache      -> /opt/tetra/cache      # Cache storage
$TETRA_DIR/state      -> /opt/tetra/state      # Persistent state
$TETRA_DIR/metrics    -> /opt/tetra/metrics    # Metrics and monitoring
```

### Environment-Specific Variations
```bash
# Development environment
$TETRA_DIR -> /home/user/.tetra

# Staging environment
$TETRA_DIR -> /var/lib/tetra-staging

# Production environment
$TETRA_DIR -> /opt/tetra-prod
```

## 3. Path Builder Pattern Syntax

### Basic Patterns
| Pattern | Resolves To | Example Output |
|---------|-------------|----------------|
| `@files[]` | `$TETRA_DIR/files/$(date +%s)` | `/opt/tetra/files/1703123456` |
| `@files[schema]` | `$TETRA_DIR/files/schema` | `/opt/tetra/files/schema` |
| `@files/my/data` | `$TETRA_DIR/files/my/data` | `/opt/tetra/files/my/data` |
| `@logs/deploy` | `$TETRA_DIR/logs/deploy` | `/opt/tetra/logs/deploy` |

### Dynamic Path Construction
```bash
# Date-based organization
@logs/deploy/$(date +%Y/%m/%d)        -> /opt/tetra/logs/deploy/2024/03/15
@backups/$(date +%Y%m%d)/hourly       -> /opt/tetra/backups/20240315/hourly

# Environment-aware paths
@config/$ENV/services                 -> /opt/tetra/config/prod/services
@state/$ENV/$MODULE                   -> /opt/tetra/state/prod/deploy

# Host-specific paths
@metrics/$(hostname)/$(date +%H)      -> /opt/tetra/metrics/server01/14
@cache/$(whoami)/temp                 -> /opt/tetra/cache/tetra-user/temp

# Git integration
@backups/before-$(git rev-parse --short HEAD) -> /opt/tetra/backups/before-abc123f
@logs/deploy/$(git branch --show-current)     -> /opt/tetra/logs/deploy/feature-auth
```

## 4. Module Path Specifications
Modules define their filesystem access patterns in type signatures:

```bash
# In bash/deploy/types.sh
declare -A DEPLOY_PATHS=(
  [backup]="@backups/deploy/$(date +%s)/state"
  [logs]="@logs/$ENV/$(service)/$(date +%Y%m%d).log"
  [config]="@config/$ENV/deployment.toml"
  [rollback]="@state/rollback/$(version)/snapshot.tar.gz"
)

# In bash/monitor/types.sh
declare -A MONITOR_PATHS=(
  [metrics]="@metrics/$(hostname)/$(date +%Y%m%d)/data.json"
  [alerts]="@logs/alerts/$(date +%H)/events.log"
  [dashboards]="@files[]/dashboards/$(service)/config.json"
  [reports]="@files/reports/$(date +%Y)/$(date +%m)/summary.html"
)
```

## 5. TetraScript Path Integration

### Type Signatures with Path Builders
```bash
# Modules declare their filesystem intentions
deploy/backup :: service:string -> @backups/$(service)/$(date +%s)/state
deploy/logs :: service:string level:{debug,info,error} -> @logs/$ENV/$(service)/$(level).log
config/update :: key:string value:string -> @config/$ENV/$(key).toml
monitor/dump :: service:string -> @metrics/$(hostname)/$(service)/$(date +%H).json
```

### Runtime Path Resolution
```bash
# Command execution with path resolution
$ tetra deploy/backup webapp
# Resolves to: /opt/tetra/backups/webapp/1703123456/state

$ tetra monitor/dump database
# Resolves to: /opt/tetra/metrics/prod-db-01/database/14.json

$ tetra config/update redis "redis://localhost:6379"
# Resolves to: /opt/tetra/config/prod/redis.toml
```

## 6. Advanced Path Features

### Conditional Path Construction
```bash
# Environment-based path selection
@files/$([ "$ENV" = "prod" ] && echo "secure" || echo "open")/data
# prod: /opt/tetra/files/secure/data
# dev:  /opt/tetra/files/open/data

# Service-specific paths with fallbacks
@config/$(service_config_dir "${SERVICE:-default}")/app.toml

# Permission-aware paths
@logs/$([ -w "/var/log" ] && echo "/var/log/tetra" || echo "$HOME/.tetra/logs")/app.log
```

### Template Parameter Expansion
```bash
# Multi-variable templates
@backups/$ENV/$MODULE/$(date +%Y%m%d)/$(git rev-parse --short HEAD)/snapshot

# Function-based path generation
@files/$(generate_unique_id)/$(calculate_shard_id "$SERVICE")/data.db

# Nested template expansion
@logs/$(resolve_log_dir "$ENV" "$SERVICE")/$(format_timestamp)/events.json
```

### Path Validation and Safety
```bash
# Automatic directory creation with permissions
ensure_path_exists() {
  local path="$1"
  local mode="${2:-755}"

  if [[ ! -d "$(dirname "$path")" ]]; then
    mkdir -p "$(dirname "$path")"
    chmod "$mode" "$(dirname "$path")"
  fi
}

# Path sanitization for security
sanitize_path_component() {
  local component="$1"
  # Remove dangerous characters, preserve alphanumeric and common safe chars
  echo "$component" | sed 's/[^a-zA-Z0-9._-]/_/g'
}
```

## 7. Complete Examples

### Deployment Backup System
```bash
# Type signature
deploy/backup :: service:string version:semver -> @backups/deploy/$SERVICE/$(date +%s)/v$VERSION

# Usage
$ tetra deploy/backup webapp v1.2.3
# Creates: /opt/tetra/backups/deploy/webapp/1703123456/v1.2.3/
#   - metadata.json     (deployment context)
#   - state.tar.gz      (application state)
#   - config/           (configuration backup)
#   - database.sql      (database backup)
```

### Log Aggregation System
```bash
# Type signature
log/collect :: service:string level:{debug,info,warn,error} duration:seconds
            -> @logs/collected/$SERVICE/$(date +%Y%m%d)/$LEVEL.jsonl

# Usage
$ tetra log/collect webapp error 3600
# Creates: /opt/tetra/logs/collected/webapp/20240315/error.jsonl
# Contains: One hour of error logs in JSON Lines format
```

### Metrics Dashboard Generation
```bash
# Type signature
metrics/dashboard :: service:string timerange:duration
                  -> @files/dashboards/$SERVICE/$(date +%Y%m%d)/dashboard.html

# Usage
$ tetra metrics/dashboard database 24h
# Creates: /opt/tetra/files/dashboards/database/20240315/dashboard.html
# Contains: 24-hour metrics dashboard with charts and graphs
```

## 8. Path Resolution Algorithm

### Resolution Pipeline
```bash
resolve_tetra_path() {
  local path_template="$1"
  local context="$2"

  # Step 1: Extract path pattern
  local pattern="${path_template#@}"  # Remove @ prefix
  local base_dir="${pattern%%/*}"     # Extract base directory name
  local sub_path="${pattern#*/}"      # Extract sub-path

  # Step 2: Resolve base directory
  local resolved_base="$TETRA_DIR/$base_dir"

  # Step 3: Handle default values in brackets
  if [[ "$sub_path" =~ ^\[([^]]*)\] ]]; then
    local default_value="${BASH_REMATCH[1]}"
    if [[ -z "$default_value" ]]; then
      sub_path="$(date +%s)"  # Use timestamp as ultimate default
    else
      sub_path="$default_value"
    fi
  fi

  # Step 4: Perform shell expansion
  local resolved_path="$resolved_base/$sub_path"
  resolved_path=$(eval echo "$resolved_path")  # Variable and command substitution

  # Step 5: Sanitize and validate
  resolved_path=$(sanitize_path "$resolved_path")
  validate_path_safety "$resolved_path"

  echo "$resolved_path"
}
```

## 9. Security and Permissions

### Broad Privilege Philosophy
TetraScript intentionally grants broad filesystem privileges because infrastructure automation requires:
- **Dynamic directory creation**: New projects, services, environments
- **Cross-environment operations**: Copying configs, syncing state
- **Timestamped organization**: Logs, backups, metrics with time-based paths
- **Git integration**: Deployment tracking with commit information

### Security Boundaries
```bash
# Allowed operations within TETRA_DIR hierarchy
✓ $TETRA_DIR/files/anything/goes/here
✓ $TETRA_DIR/logs/$(arbitrary)/$(shell)/$(expansion)
✓ $TETRA_DIR/config/$ENV/$(service)/settings.toml

# Prevented operations outside TETRA_DIR
✗ /etc/passwd                    # System files protected
✗ /home/other-user/             # User directories protected
✗ ../../../sensitive/data       # Directory traversal blocked
```

### Audit and Compliance
```bash
# Every path operation logged
log_path_access() {
  local operation="$1"  # create, read, write, delete
  local path="$2"
  local context="$3"

  echo "$(date -Iseconds) $USER $operation $path $context" >> $TETRA_DIR/audit.log
}

# Example audit log entries
# 2024-03-15T14:30:00Z tetra-user write /opt/tetra/files/webapp/backup.tar.gz deploy/backup:webapp:v1.2.3
# 2024-03-15T14:31:00Z tetra-user read /opt/tetra/logs/prod/database/error.log monitor/collect:database:error
```

## Conclusion
TetraScript's path builder system provides the structured freedom required for infrastructure automation. By combining environment variable templating, shell expansion capabilities, and security-conscious broad privileges, we achieve flexible filesystem access within organized patterns. The audit trail and path validation ensure that while operations have broad capabilities, they remain traceable and secure within the intended organizational structure.