# view:env Semantic Refactor

## Problem Statement

Currently `view:env` is a generic TES endpoint preview that doesn't actually show environment-specific content. The semantics are unclear:

- What does it mean to "view the env" on Local vs Dev vs Staging vs Prod?
- The TES resolution shows SSH commands but doesn't show what we're viewing
- The `sudo -u` is incorrect (we SSH as root, no sudo needed)
- The action doesn't show the actual tetra.toml content

## Semantic Clarification

### What "view:env" Should Mean

`view:env` should show **the tetra.toml environment configuration** for the current environment:

#### Local Environment
- **Source**: `$TETRA_DIR/orgs/<active-org>/tetra.toml`
- **Shows**: The `[environments.local]` section
- **TES**: No SSH needed (local file)
- **Purpose**: View local development configuration

#### Dev/Staging/Production Environments
- **Source**: Remote `tetra.toml` at the target host
- **Shows**: The `[environments.dev|staging|prod]` section from remote file
- **TES**: SSH command to fetch remote file
- **Purpose**: View remote environment configuration and verify TES resolution

### TES (Tetra Endpoint Specification)
The endpoint resolution shows HOW to reach the target:

```
Symbol:     @dev
Type:       remote
Auth User:  root (user we SSH as)
Work User:  dev (user context for operations)
SSH:        ssh -i ~/.ssh/id_rsa root@137.184.226.163 -t "sudo -u dev bash"
```

**Important**: The two-user model allows root authentication with work in user-specific directories:
- `ssh_auth_user`: User for SSH authentication (typically `root`)
- `ssh_work_user`: User context for operations (e.g., `dev`, `staging`, `prod`)
- When they differ, we use `sudo -u` to switch context
- This lets root operate in `/home/{dev,staging,prod}/` directories

### TTS (Tetra Transaction Spec)
When an action is EXECUTED, it creates a transaction log:
```
TTS Format:
  Timestamp:  2025-11-13T14:32:15Z
  User:       mricos
  Org:        pixeljam-arcade
  Action:     view:env
  Env:        Dev
  Mode:       Inspect
  TES:        @dev -> root@137.184.226.163
  Status:     success
  Duration:   0.342s
```

### Transaction Logging
Transactions are logged to: `$TETRA_DIR/org/txns/<org>/<date>.log`

Example log entry:
```
2025-11-13 14:32:15 | pixeljam-arcade | view:env | Dev | Inspect | @dev | success | 0.342s
```

## Implementation Plan

### 1. SSH Command Generation Logic (org_tes_viewer.sh:263-274)

**Implementation**:
```bash
# SSH connection logic:
# - auth_user: user we authenticate as (typically root)
# - work_user: user context for operations (dev/staging/prod)
# If they differ, use sudo to switch to work_user context
if [[ "$ssh_auth_user" == "$ssh_work_user" ]]; then
    # Same user - direct SSH
    echo "ssh -i $ssh_key $ssh_work_user@$ssh_host"
else
    # Different users - SSH as auth_user, sudo to work_user
    # This allows root to operate in /home/{dev,staging,prod} context
    echo "ssh -i $ssh_key $ssh_auth_user@$ssh_host -t \"sudo -u $ssh_work_user bash\""
fi
```

**Rationale**:
- We SSH as `auth_user` (typically root for authentication)
- We `sudo -u work_user` to operate in the correct user context
- This allows root to work in `/home/dev/`, `/home/staging/`, `/home/prod/`
- Example from tetra.toml:
  ```toml
  [environments.dev]
  ssh_auth_user = "root"      # SSH as root
  ssh_work_user = "dev"       # Work in dev's context
  # Result: ssh root@host -t "sudo -u dev bash"
  ```

### 2. Refactor org_action_view_env (actions.sh:239)

**Current (STUB)**:
```bash
org_action_view_env() {
    local env="$1"
    echo "Viewing environment: $env"
    echo "Organization: $(org_active)"
}
```

**Refactored**:
```bash
org_action_view_env() {
    local env="$1"
    local active_org=$(org_active)
    local toml_path="$TETRA_DIR/orgs/$active_org/tetra.toml"

    echo ""
    echo "╭─ Environment: $env @ $active_org ───────────────"
    echo "│"

    # Show TES resolution
    echo "│ TES Resolution:"
    local symbol="@${env,,}"

    if [[ "$env" == "Local" ]]; then
        echo "│   Symbol:     $symbol"
        echo "│   Type:       local"
        echo "│   Source:     $toml_path"
        echo "│"

        # Show local environment section from tetra.toml
        if [[ -f "$toml_path" ]]; then
            echo "│ Configuration [environments.local]:"
            echo "│"
            # Extract and display [environments.local] section
            awk '/^\[environments\.local\]$/,/^\[/ {
                if (/^\[environments\.local\]$/) next
                if (/^\[/ && !/^\[environments\.local\]/) exit
                if (NF > 0) print "│   " $0
            }' "$toml_path"
        else
            echo "│   ERROR: tetra.toml not found"
        fi
    else
        # Remote environment
        local ssh_cmd=$(org_tes_ssh_command "$symbol" "$toml_path" 2>/dev/null)

        echo "│   Symbol:     $symbol"
        echo "│   Type:       remote"
        echo "│   SSH:        $ssh_cmd"
        echo "│"

        # Try to fetch remote tetra.toml section
        if [[ -n "$ssh_cmd" && "$ssh_cmd" != "bash" ]]; then
            echo "│ Remote Configuration [environments.${env,,}]:"
            echo "│"

            # Execute SSH command to view remote tetra.toml
            local remote_toml="/home/${env,,}/tetra/orgs/$active_org/tetra.toml"
            local section_content

            section_content=$($ssh_cmd "cat $remote_toml 2>/dev/null" | \
                awk -v env="${env,,}" '
                    BEGIN { in_section=0 }
                    $0 ~ "^\\[environments\\." env "\\]$" { in_section=1; next }
                    /^\[/ && in_section { exit }
                    in_section && NF > 0 { print "│   " $0 }
                ')

            if [[ -n "$section_content" ]]; then
                echo "$section_content"
            else
                echo "│   ERROR: Could not fetch remote configuration"
            fi
        else
            echo "│   ERROR: Cannot resolve TES endpoint"
        fi
    fi

    echo "│"
    echo "╰────────────────────────────────────────────────"
    echo ""
}
```

### 3. Update TES Preview Display

Remove sudo from display in `org_resolve_tes_preview` (org_tes_viewer.sh:353):

**Current**: Shows generic "remote" type with sudo command
**Fixed**: Show actual SSH command without sudo, indicate work_user as metadata

### 4. Add Transaction Logging

Create new file: `org_transaction_log.sh`

```bash
#!/usr/bin/env bash
# org_transaction_log.sh - TTS (Tetra Transaction Spec) logging

ORG_TXN_LOG_DIR="${TETRA_DIR}/org/txns"

org_txn_log() {
    local org="$1"
    local action="$2"
    local env="$3"
    local mode="$4"
    local tes_symbol="$5"
    local status="$6"
    local duration="$7"

    local log_file="$ORG_TXN_LOG_DIR/$org/$(date +%Y-%m-%d).log"
    mkdir -p "$(dirname "$log_file")"

    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    local user="${USER:-unknown}"

    printf "%s | %s | %s | %s | %s | %s | %s | %s | %s\n" \
        "$timestamp" "$user" "$org" "$action" "$env" "$mode" \
        "$tes_symbol" "$status" "$duration" >> "$log_file"
}

org_txn_view() {
    local org="${1:-$(org_active)}"
    local date="${2:-$(date +%Y-%m-%d)}"

    local log_file="$ORG_TXN_LOG_DIR/$org/$date.log"

    if [[ -f "$log_file" ]]; then
        cat "$log_file"
    else
        echo "No transactions for $org on $date"
    fi
}

export -f org_txn_log org_txn_view
```

## Testing Plan

1. **Local view:env**
   ```
   [pixeljam-arcade] Local × Inspect → view:env ▶ <Enter>
   ```
   Should show `[environments.local]` section from local tetra.toml

2. **Dev view:env**
   ```
   [pixeljam-arcade] Dev × Inspect → view:env ▶ <Enter>
   ```
   Should show:
   - TES: `ssh -i ~/.ssh/id_rsa root@137.184.226.163`
   - Remote `[environments.dev]` section

3. **Transaction Log**
   ```
   cat $TETRA_DIR/org/txns/pixeljam-arcade/2025-11-13.log
   ```
   Should show all executed actions with timing

## Questions Resolved

1. **What does view:env mean?**
   View the tetra.toml environment configuration for the specified environment

2. **Why sudo?**
   KEPT (corrected understanding) - We SSH as root but need to sudo to work_user context to operate in their home directories. The two-user model:
   - `ssh_auth_user`: User for authentication (root)
   - `ssh_work_user`: User context for operations (dev/staging/prod)
   - When different: `ssh root@host -t "sudo -u dev bash"`
   - This lets root work in `/home/dev/`, `/home/staging/`, `/home/prod/`

3. **Where is it logged?**
   `$TETRA_DIR/org/txns/<org>/<date>.log`

4. **What is TTS?**
   Tetra Transaction Spec - the log format for tracking action execution

5. **What is TES?**
   Tetra Endpoint Specification - defines HOW to reach a target (symbol → SSH command → user context)
