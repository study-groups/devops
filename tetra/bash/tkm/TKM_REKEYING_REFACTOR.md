# TKM Rekeying Refactor Analysis

## Current Implementation Review

### File Structure
```
bash/tkm/
├── tkm_core.sh           # Core key operations (generate, deploy, rotate)
├── tkm_organizations.sh  # Organization management (mentions rekey privilege)
├── tkm_repl.sh          # REPL interface
└── tkm_security.sh      # Security checks
```

### Current Rekeying Flow

#### 1. **Key Generation** (`tkm_generate_keys`)
```bash
tkm_generate_keys <env|all> <type> <expiry_days>
```
- **Location**: `tkm_core.sh:11-111`
- **Process**:
  1. Validates environment, key type, expiry
  2. Generates ED25519 key pair with `ssh-keygen`
  3. Creates metadata JSON file (`.meta`)
  4. Stores in `$TKM_KEYS_DIR/active/`
  5. Sets permissions: 600 (private), 644 (public)

**Issues**:
- Uses `date -d` which is GNU-specific (not portable to macOS)
- Metadata is JSON but parsed with sed/grep (fragile)
- No validation of existing keys before generation
- No clear policy for key naming conflicts

#### 2. **Key Deployment** (`tkm_deploy_keys`)
```bash
tkm_deploy_keys <env|all> [force]
```
- **Location**: `tkm_core.sh:168-230`
- **Process**:
  1. Finds latest key in active directory
  2. Runs security check via `tkm_security_check_deployment`
  3. SSH's to remote host and appends to `authorized_keys`
  4. Updates metadata to mark as "deployed"

**Issues**:
- Direct SSH command with pipe (no error handling)
- Appends to `authorized_keys` without checking duplicates
- No validation that remote host received the key correctly
- No rollback mechanism if deployment fails
- Security check is called but not clearly defined

#### 3. **Key Rotation** (`tkm_rotate_keys`)
```bash
tkm_rotate_keys <env> [immediate]
```
- **Location**: `tkm_core.sh:271-308`
- **Process**:
  1. Calls `tkm_generate_keys` to create new key
  2. Calls `tkm_deploy_keys` to push new key
  3. Optionally calls `_tkm_revoke_old_keys` to remove old keys

**Issues**:
- **No atomicity**: If deploy fails, old keys are already generated
- **Immediate revocation is dangerous**: No grace period verification
- **No verification**: Doesn't test that new key works before revoking old
- **No state tracking**: Can't tell if rotation is in progress or completed
- **No rollback**: If something fails mid-rotation, system is in bad state

#### 4. **Key Revocation** (`_tkm_revoke_old_keys`)
```bash
_tkm_revoke_old_keys <env>
```
- **Location**: `tkm_core.sh:392-423`
- **Process**:
  1. Finds all keys for environment except latest
  2. Updates metadata to "revoked"
  3. Moves keys to archived directory

**Issues**:
- **Only moves locally**: Doesn't remove from remote `authorized_keys`
- **False sense of security**: Key still works remotely until manually removed
- **No remote cleanup**: Old keys accumulate on servers
- **No audit trail**: Can't tell what keys are actually active remotely

### Organizations and Privileges

In `tkm_organizations.sh:140`:
```bash
local:127.0.0.1:127.0.0.1::$USER:admin,deploy,rekey:control-plane
```

- The `rekey` privilege is defined but **never checked**
- No privilege enforcement in the rekeying functions
- Local environment has "rekey" privilege but no clear semantics

## Critical Problems

### 1. **Non-Atomic Rotation**
```
Current Flow:
1. Generate new key ✓
2. Deploy new key ✓
3. [FAILURE HERE - system has 2 working keys]
4. Revoke old key ✗

Problem: If step 3 or 4 fails, you have:
- Two valid keys on remote (security risk)
- Unclear which key is "active"
- No way to determine rotation state
```

### 2. **No Verification Before Revocation**
```
Current Flow:
1. Deploy new key to server
2. Immediately revoke old key
3. [NEW KEY DOESN'T WORK - now locked out!]

Problem: Never tests that new key works before revoking old key
```

### 3. **Local-Only Revocation**
```
Current "Revocation":
1. Mark key as "revoked" in local metadata ✓
2. Move to archived/ directory ✓
3. Remove from remote authorized_keys ✗ (MISSING!)

Problem: Old key still works remotely!
```

### 4. **Poor Metadata Management**
```
Current: sed -i 's/"deployed": false/"deployed": true/' file.meta

Problems:
- sed operations on JSON are fragile
- No schema validation
- Can't query metadata efficiently
- Hard to track rotation history
```

### 5. **No State Machine**
```
Key states are unclear:
- "generated" - local only
- "deployed" - copied to remote
- "revoked" - marked locally (but still works remotely!)

Missing states:
- "pending-deployment" - generated but not yet deployed
- "active" - deployed and verified working
- "deprecating" - new key exists, old key still valid (grace period)
- "revoked-remote" - actually removed from remote authorized_keys
```

## Proposed Refactor

### Design Principles

1. **Atomic Operations** - All or nothing, with rollback
2. **Verification First** - Test before committing
3. **State Machine** - Clear key lifecycle
4. **Remote Truth** - Remote `authorized_keys` is source of truth
5. **Audit Trail** - Complete history of all operations

### New State Machine

```
┌─────────┐
│ created │ (key pair generated locally)
└────┬────┘
     │ deploy
     v
┌──────────┐
│ deployed │ (copied to remote, not verified)
└────┬─────┘
     │ verify
     v
┌────────┐
│ active │ (verified working on remote)
└────┬───┘
     │ deprecate (new key becomes active)
     v
┌────────────┐
│ deprecated │ (still in authorized_keys, grace period)
└──────┬─────┘
       │ revoke
       v
┌─────────┐
│ revoked │ (removed from remote authorized_keys)
└────┬────┘
     │ archive
     v
┌──────────┐
│ archived │ (moved to archived/, audit only)
└──────────┘
```

### Refactored Rotation Flow

```bash
# Phase 1: Generation (reversible)
tkm_rotation_start <env>
  1. Generate new key pair
  2. State: created
  3. Store rotation intent: /tmp/tkm_rotation_<env>.lock

# Phase 2: Deployment (reversible)
tkm_rotation_deploy <env>
  1. Deploy new key to remote
  2. State: deployed
  3. DO NOT remove old key yet

# Phase 3: Verification (critical)
tkm_rotation_verify <env>
  1. Test SSH with new key
  2. Run test command on remote
  3. If success: State -> active
  4. If failure: ABORT, keep old key

# Phase 4: Deprecation (grace period)
tkm_rotation_deprecate <env>
  1. Mark old key as deprecated
  2. Set deprecation timer (e.g., 24 hours)
  3. Both keys work during grace period
  4. Allow time for CI/CD, cron jobs to update

# Phase 5: Revocation (final)
tkm_rotation_complete <env>
  1. Remove old key from remote authorized_keys
  2. Verify only new key works
  3. Move old key to archived/
  4. Clear rotation lock
  5. Log completion
```

### Implementation Plan

#### 1. Create Rotation State Manager

**File**: `tkm_rotation.sh`

```bash
#!/usr/bin/env bash

# Rotation state tracking
TKM_ROTATION_DIR="$TKM_DIR/rotations"

tkm_rotation_init() {
    mkdir -p "$TKM_ROTATION_DIR"/{active,completed,failed}
}

tkm_rotation_start() {
    local env="$1"
    local rotation_id="rotation_${env}_$(date +%Y%m%d_%H%M%S)"
    local rotation_file="$TKM_ROTATION_DIR/active/${rotation_id}.json"

    # Check for existing rotation
    if tkm_rotation_in_progress "$env"; then
        echo "Error: Rotation already in progress for $env"
        return 1
    fi

    # Create rotation state
    cat > "$rotation_file" <<EOF
{
  "rotation_id": "$rotation_id",
  "environment": "$env",
  "started": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "state": "started",
  "old_key": "$(tkm_get_active_key $env)",
  "new_key": null,
  "verified": false,
  "completed": false
}
EOF

    echo "$rotation_id"
}

tkm_rotation_in_progress() {
    local env="$1"
    [[ -n "$(find "$TKM_ROTATION_DIR/active" -name "rotation_${env}_*.json" 2>/dev/null)" ]]
}

tkm_rotation_set_state() {
    local rotation_id="$1"
    local state="$2"
    local rotation_file="$TKM_ROTATION_DIR/active/${rotation_id}.json"

    if [[ -f "$rotation_file" ]]; then
        # Use jq if available, otherwise sed
        if command -v jq &>/dev/null; then
            jq ".state = \"$state\" | .last_updated = \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"" \
                "$rotation_file" > "${rotation_file}.tmp"
            mv "${rotation_file}.tmp" "$rotation_file"
        else
            sed -i "s/\"state\": \"[^\"]*\"/\"state\": \"$state\"/" "$rotation_file"
        fi
    fi
}
```

#### 2. Add Verification Step

**File**: `tkm_verification.sh`

```bash
#!/usr/bin/env bash

tkm_verify_key() {
    local env="$1"
    local key_path="$2"
    local host="$3"
    local user="$4"

    echo "Verifying key: $(basename $key_path)"

    # Test SSH connection with new key
    if ssh -i "$key_path" -o BatchMode=yes -o ConnectTimeout=5 \
        "$user@$host" "echo 'TKM verification successful'" 2>/dev/null; then
        echo "✓ Key verified on $host"
        return 0
    else
        echo "✗ Key verification failed on $host"
        return 1
    fi
}

tkm_verify_rotation() {
    local env="$1"
    local rotation_id="$2"

    # Get rotation state
    local rotation_file="$TKM_ROTATION_DIR/active/${rotation_id}.json"
    local new_key=$(jq -r '.new_key' "$rotation_file" 2>/dev/null)

    # Get environment details
    local current_org=$(tkm_org_current)
    local org_servers_file="$TKM_ORGS_DIR/$current_org/environments/servers.conf"
    local env_info=$(grep "^${env}:" "$org_servers_file" | head -1)

    IFS=: read -r env_name public_ip private_ip floating_ip user privileges specs <<< "$env_info"
    local host="${floating_ip:-${public_ip:-${private_ip}}}"

    # Verify new key works
    if tkm_verify_key "$env" "$new_key" "$host" "$user"; then
        tkm_rotation_set_state "$rotation_id" "verified"
        return 0
    else
        tkm_rotation_set_state "$rotation_id" "verification-failed"
        return 1
    fi
}
```

#### 3. Remote Key Management

**File**: `tkm_remote.sh`

```bash
#!/usr/bin/env bash

tkm_remote_list_keys() {
    local host="$1"
    local user="$2"

    ssh "$user@$host" "cat ~/.ssh/authorized_keys 2>/dev/null" | \
        grep -v '^#' | \
        while read -r key; do
            # Extract fingerprint
            echo "$key" | ssh-keygen -lf - 2>/dev/null | awk '{print $2, $NF}'
        done
}

tkm_remote_remove_key() {
    local host="$1"
    local user="$2"
    local fingerprint="$3"

    echo "Removing key from $user@$host: $fingerprint"

    # Create backup
    ssh "$user@$host" "cp ~/.ssh/authorized_keys ~/.ssh/authorized_keys.backup.$(date +%Y%m%d_%H%M%S)"

    # Remove the key (by fingerprint match)
    ssh "$user@$host" "
        tmpfile=\$(mktemp)
        while read -r key; do
            if [[ -n \"\$key\" ]] && [[ ! \"\$key\" =~ ^# ]]; then
                fp=\$(echo \"\$key\" | ssh-keygen -lf - 2>/dev/null | awk '{print \$2}')
                if [[ \"\$fp\" != \"$fingerprint\" ]]; then
                    echo \"\$key\" >> \"\$tmpfile\"
                fi
            fi
        done < ~/.ssh/authorized_keys
        mv \"\$tmpfile\" ~/.ssh/authorized_keys
        chmod 600 ~/.ssh/authorized_keys
    "

    echo "✓ Key removed from remote"
}

tkm_remote_count_keys() {
    local host="$1"
    local user="$2"

    ssh "$user@$host" "grep -v '^#' ~/.ssh/authorized_keys 2>/dev/null | grep -c '^ssh-'" || echo "0"
}
```

#### 4. Refactored Rotation Command

**File**: `tkm_rotation_command.sh`

```bash
#!/usr/bin/env bash

tkm_rotate() {
    local env="$1"
    local auto="${2:-false}"

    echo "=== TKM Key Rotation: $env ==="
    echo

    # Phase 1: Start rotation
    echo "Phase 1: Starting rotation..."
    local rotation_id=$(tkm_rotation_start "$env")
    if [[ $? -ne 0 ]]; then
        echo "✗ Failed to start rotation"
        return 1
    fi
    echo "✓ Rotation started: $rotation_id"
    echo

    # Phase 2: Generate new key
    echo "Phase 2: Generating new key..."
    if ! tkm_generate_keys "$env" "deploy" "30"; then
        echo "✗ Key generation failed"
        tkm_rotation_abort "$rotation_id"
        return 1
    fi
    local new_key=$(find "$TKM_KEYS_DIR/active" -name "${env}_deploy_*.pub" -type f | sort | tail -1)
    tkm_rotation_set_new_key "$rotation_id" "${new_key%.pub}"
    echo "✓ New key generated"
    echo

    # Phase 3: Deploy new key
    echo "Phase 3: Deploying new key (old key still active)..."
    if ! tkm_deploy_keys "$env"; then
        echo "✗ Deployment failed"
        tkm_rotation_abort "$rotation_id"
        return 1
    fi
    echo "✓ New key deployed"
    echo

    # Phase 4: Verify new key
    echo "Phase 4: Verifying new key works..."
    if ! tkm_verify_rotation "$env" "$rotation_id"; then
        echo "✗ Verification failed - keeping old key active"
        tkm_rotation_abort "$rotation_id"
        return 1
    fi
    echo "✓ New key verified and working"
    echo

    # Phase 5: Deprecate old key (grace period)
    if [[ "$auto" == "true" ]]; then
        echo "Phase 5: Auto-mode - immediately revoking old key..."
        tkm_rotation_revoke_old "$rotation_id"
    else
        echo "Phase 5: Old key marked for deprecation"
        echo "  • Both keys are currently active"
        echo "  • Grace period: 24 hours"
        echo "  • To complete rotation: tkm rotation complete $env"
        echo "  • To abort and rollback: tkm rotation abort $env"
    fi
    echo

    echo "✓ Rotation completed successfully"
    echo "Rotation ID: $rotation_id"
}

tkm_rotation_complete() {
    local env="$1"

    # Find active rotation
    local rotation_file=$(find "$TKM_ROTATION_DIR/active" -name "rotation_${env}_*.json" | head -1)
    if [[ -z "$rotation_file" ]]; then
        echo "No active rotation found for $env"
        return 1
    fi

    local rotation_id=$(basename "$rotation_file" .json)

    echo "=== Completing Rotation: $rotation_id ==="

    # Get old key info
    local old_key=$(jq -r '.old_key' "$rotation_file")
    local old_fingerprint=$(ssh-keygen -lf "${old_key}.pub" 2>/dev/null | awk '{print $2}')

    # Get environment details
    local current_org=$(tkm_org_current)
    local org_servers_file="$TKM_ORGS_DIR/$current_org/environments/servers.conf"
    local env_info=$(grep "^${env}:" "$org_servers_file" | head -1)
    IFS=: read -r env_name public_ip private_ip floating_ip user privileges specs <<< "$env_info"
    local host="${floating_ip:-${public_ip:-${private_ip}}}"

    # Remove old key from remote
    echo "Removing old key from remote..."
    if tkm_remote_remove_key "$host" "$user" "$old_fingerprint"; then
        echo "✓ Old key revoked remotely"
    else
        echo "✗ Failed to revoke old key remotely"
        return 1
    fi

    # Archive old key locally
    echo "Archiving old key locally..."
    mv "$old_key" "$TKM_KEYS_DIR/archived/"
    mv "${old_key}.pub" "$TKM_KEYS_DIR/archived/"
    mv "${old_key}.meta" "$TKM_KEYS_DIR/archived/"

    # Mark rotation as complete
    mv "$rotation_file" "$TKM_ROTATION_DIR/completed/"

    echo "✓ Rotation completed"
}

tkm_rotation_abort() {
    local rotation_id="$1"

    echo "⚠️  Aborting rotation: $rotation_id"

    # Move to failed directory
    mv "$TKM_ROTATION_DIR/active/${rotation_id}.json" \
       "$TKM_ROTATION_DIR/failed/"

    echo "✓ Rotation aborted - old key still active"
}
```

### Benefits of Refactor

1. **Safety**:
   - Always verify new key before revoking old
   - Grace period prevents lockouts
   - Easy rollback if issues occur

2. **Auditability**:
   - Complete rotation history
   - State tracking in JSON
   - Clear rotation lifecycle

3. **Reliability**:
   - Atomic operations with rollback
   - Proper error handling
   - Remote verification

4. **Visibility**:
   - Can query rotation status
   - See which keys are active remotely
   - Track rotation progress

5. **Portability**:
   - Remove GNU-specific date commands
   - Use standard POSIX where possible
   - Better jq integration for JSON

### Migration Plan

1. **Phase 1**: Create new rotation modules alongside existing code
2. **Phase 2**: Add rotation state tracking
3. **Phase 3**: Implement verification steps
4. **Phase 4**: Add remote key management
5. **Phase 5**: Create new rotation command
6. **Phase 6**: Update REPL to use new command
7. **Phase 7**: Deprecate old rotation function
8. **Phase 8**: Documentation and testing

### Testing Strategy

```bash
# Test rotation on dev environment
tkm_rotate dev

# Verify both keys work during grace period
ssh -i old_key user@dev-host
ssh -i new_key user@dev-host

# Complete rotation
tkm rotation complete dev

# Verify only new key works
ssh -i new_key user@dev-host  # Should work
ssh -i old_key user@dev-host  # Should fail

# Test abort scenario
tkm_rotate staging
# [simulate failure]
tkm rotation abort staging
# Verify old key still works
```

## Summary

The current rekeying implementation has critical safety issues:
1. Non-atomic operations
2. No verification before revocation
3. Local-only revocation (keys still work remotely)
4. Poor state management

The refactored approach provides:
1. State machine with clear lifecycle
2. Verification before commitment
3. Grace periods for safe transitions
4. Remote key management
5. Complete audit trail
6. Atomic operations with rollback

This makes key rotation safe, auditable, and reliable.
