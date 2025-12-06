#!/usr/bin/env bash
# nh_keys.sh - DO-registered SSH key helpers
#
# Helps find bootstrap keys for initial server access.
# DigitalOcean stores public key fingerprints; this matches them to local keys.
#
# Usage:
#   nh keys                  List DO-registered keys
#   nh keys match            Find local keys matching DO fingerprints
#   nh keys bootstrap        Suggest best bootstrap key for tkm deploy

# =============================================================================
# LIST DO KEYS
# =============================================================================

# Get SSHKeys from digocean.json
_nh_keys_get_do_keys() {
    local ctx="${DIGITALOCEAN_CONTEXT:-}"
    [[ -z "$ctx" ]] && return 1

    local json="$NH_DIR/$ctx/digocean.json"
    [[ ! -f "$json" ]] && return 1

    jq -c '.[] | select(.SSHKeys) | .SSHKeys[]' "$json" 2>/dev/null
}

# List DO-registered keys
nh_keys_list() {
    local ctx="${DIGITALOCEAN_CONTEXT:-}"
    [[ -z "$ctx" ]] && { echo "No context. Run: nh switch <context>"; return 1; }

    local json="$NH_DIR/$ctx/digocean.json"
    if [[ ! -f "$json" ]]; then
        echo "No data. Run: nh fetch"
        return 1
    fi

    # Check if SSHKeys section exists
    local has_keys=$(jq '.[] | select(.SSHKeys) | .SSHKeys | length' "$json" 2>/dev/null)
    if [[ -z "$has_keys" || "$has_keys" == "0" ]]; then
        echo "No SSH keys in digocean.json"
        echo ""
        echo "Fetch with: NH_FETCH_RESOURCES=\"\$NH_FETCH_RESOURCES,SSHKeys\" nh fetch"
        echo "Or: nh fetch  (SSHKeys now in default)"
        return 1
    fi

    echo "DO-Registered SSH Keys ($ctx)"
    echo "=============================="
    echo ""
    printf "%-8s %-25s %s\n" "ID" "Name" "Fingerprint"
    printf "%s\n" "--------------------------------------------------------------"

    while IFS= read -r key; do
        [[ -z "$key" ]] && continue
        local id=$(echo "$key" | jq -r '.id')
        local name=$(echo "$key" | jq -r '.name')
        local fp=$(echo "$key" | jq -r '.fingerprint')
        printf "%-8s %-25s %s\n" "$id" "$name" "$fp"
    done < <(_nh_keys_get_do_keys)
}

# =============================================================================
# MATCH LOCAL KEYS
# =============================================================================

# Get fingerprint of a local key (handles both private and public key files)
_nh_keys_local_fingerprint() {
    local keyfile="$1"

    # If private key, use .pub
    if [[ ! "$keyfile" == *.pub && -f "${keyfile}.pub" ]]; then
        keyfile="${keyfile}.pub"
    fi

    [[ ! -f "$keyfile" ]] && return 1

    # ssh-keygen -l outputs: bits fingerprint comment (type)
    # DigitalOcean uses MD5 format: xx:xx:xx:...
    ssh-keygen -l -E md5 -f "$keyfile" 2>/dev/null | awk '{print $2}' | sed 's/^MD5://'
}

# Find local keys that match DO-registered fingerprints
nh_keys_match() {
    local ctx="${DIGITALOCEAN_CONTEXT:-}"
    [[ -z "$ctx" ]] && { echo "No context. Run: nh switch <context>"; return 1; }

    echo "Matching DO keys to local files..."
    echo ""

    # Collect DO fingerprints
    declare -A do_keys  # fingerprint -> name
    while IFS= read -r key; do
        [[ -z "$key" ]] && continue
        local name=$(echo "$key" | jq -r '.name')
        local fp=$(echo "$key" | jq -r '.fingerprint')
        do_keys["$fp"]="$name"
    done < <(_nh_keys_get_do_keys)

    if [[ ${#do_keys[@]} -eq 0 ]]; then
        echo "No DO keys found. Run: nh fetch"
        return 1
    fi

    # Search common key locations
    local search_paths=(
        "$HOME/.ssh/id_ed25519"
        "$HOME/.ssh/id_rsa"
        "$HOME/.ssh/id_ecdsa"
    )

    # Add any keys in ~/.ssh/ that look like private keys
    for f in "$HOME"/.ssh/*; do
        [[ -f "$f" && ! "$f" == *.pub && ! "$f" == *config* && ! "$f" == *known_hosts* ]] || continue
        # Check if it's a key file (has corresponding .pub or looks like a key)
        if [[ -f "${f}.pub" ]] || head -1 "$f" 2>/dev/null | grep -q "PRIVATE KEY"; then
            search_paths+=("$f")
        fi
    done

    # Remove duplicates
    local -A seen
    local unique_paths=()
    for p in "${search_paths[@]}"; do
        [[ -z "${seen[$p]}" ]] && { seen[$p]=1; unique_paths+=("$p"); }
    done

    local found=0
    printf "%-40s %-20s %s\n" "Local Key" "DO Name" "Status"
    printf "%s\n" "------------------------------------------------------------------------"

    for keyfile in "${unique_paths[@]}"; do
        [[ -f "$keyfile" ]] || continue

        local local_fp=$(_nh_keys_local_fingerprint "$keyfile")
        [[ -z "$local_fp" ]] && continue

        local display_path="${keyfile/#$HOME/~}"

        if [[ -n "${do_keys[$local_fp]}" ]]; then
            printf "%-40s %-20s %s\n" "$display_path" "${do_keys[$local_fp]}" "MATCH"
            ((found++))
        fi
    done

    echo ""
    if [[ $found -eq 0 ]]; then
        echo "No matches found."
        echo ""
        echo "Your local keys don't match any DO-registered keys."
        echo "Either:"
        echo "  1. Register a local key: doctl compute ssh-key create <name> --public-key-file ~/.ssh/id_ed25519.pub"
        echo "  2. Import an existing DO key to local machine"
    else
        echo "Found $found matching key(s)"
    fi
}

# =============================================================================
# BOOTSTRAP KEY DETECTION
# =============================================================================

# Find the best bootstrap key for tkm deploy
# Returns the path to a local key that matches a DO-registered key
nh_keys_bootstrap() {
    local verbose="${1:-}"
    local ctx="${DIGITALOCEAN_CONTEXT:-}"
    [[ -z "$ctx" ]] && { echo "No context. Run: nh switch <context>"; return 1; }

    # Collect DO fingerprints
    declare -A do_keys
    while IFS= read -r key; do
        [[ -z "$key" ]] && continue
        local fp=$(echo "$key" | jq -r '.fingerprint')
        local name=$(echo "$key" | jq -r '.name')
        do_keys["$fp"]="$name"
    done < <(_nh_keys_get_do_keys)

    if [[ ${#do_keys[@]} -eq 0 ]]; then
        [[ -n "$verbose" ]] && echo "No DO keys in digocean.json. Run: nh fetch"
        return 1
    fi

    # Preferred order: ed25519, then rsa, then others
    local candidates=(
        "$HOME/.ssh/id_ed25519"
        "$HOME/.ssh/id_rsa"
        "$HOME/.ssh/id_ecdsa"
    )

    # Also check any other keys in ~/.ssh
    for f in "$HOME"/.ssh/*; do
        [[ -f "$f" && -f "${f}.pub" && ! "$f" == *.pub ]] || continue
        local already=0
        for c in "${candidates[@]}"; do [[ "$f" == "$c" ]] && already=1; done
        [[ $already -eq 0 ]] && candidates+=("$f")
    done

    for keyfile in "${candidates[@]}"; do
        [[ -f "$keyfile" ]] || continue

        local local_fp=$(_nh_keys_local_fingerprint "$keyfile")
        [[ -z "$local_fp" ]] && continue

        if [[ -n "${do_keys[$local_fp]}" ]]; then
            if [[ "$verbose" == "-v" || "$verbose" == "--verbose" ]]; then
                echo "Bootstrap key found!"
                echo "  Local:  $keyfile"
                echo "  DO key: ${do_keys[$local_fp]}"
                echo ""
                echo "Use with tkm:"
                echo "  tkm deploy all --key $keyfile"
            else
                # Just output the path (for scripting)
                echo "$keyfile"
            fi
            return 0
        fi
    done

    if [[ "$verbose" == "-v" || "$verbose" == "--verbose" ]]; then
        echo "No bootstrap key found"
        echo ""
        echo "Your local SSH keys don't match any keys registered with DigitalOcean."
        echo "Droplets were likely created with a different key."
        echo ""
        echo "Options:"
        echo "  1. Add your key to DO: doctl compute ssh-key create mykey --public-key-file ~/.ssh/id_ed25519.pub"
        echo "  2. If you have the original key, ensure it's in ~/.ssh/"
        echo "  3. Manual bootstrap: tkm deploy all --key /path/to/original/key"
    fi
    return 1
}

# =============================================================================
# SCENARIOS - Common recovery and operational cases
# =============================================================================

nh_keys_scenarios() {
    local scenario="${1:-}"

    case "$scenario" in
        lost-laptop|lost)
            _nh_scenario_lost_laptop
            ;;
        new-dev|onboard)
            _nh_scenario_new_dev
            ;;
        rotate|rotation)
            _nh_scenario_rotate
            ;;
        compromised|breach)
            _nh_scenario_compromised
            ;;
        locked-out|lockout)
            _nh_scenario_locked_out
            ;;
        new-server|new-droplet)
            _nh_scenario_new_server
            ;;
        ""|list)
            _nh_scenario_list
            ;;
        *)
            echo "Unknown scenario: $scenario"
            echo "Run: nh keys scenarios"
            return 1
            ;;
    esac
}

_nh_scenario_list() {
    cat << 'EOF'
nh keys scenarios - Common SSH key situations and solutions

SCENARIOS
    lost-laptop     Lost/stolen laptop, need to regain access
    new-dev         Onboarding a new developer
    rotate          Routine key rotation
    compromised     Key may be compromised, emergency response
    locked-out      Can't SSH to server at all
    new-server      Adding a new droplet to existing org

Run: nh keys scenarios <name>
EOF
}

_nh_scenario_lost_laptop() {
    cat << 'EOF'
SCENARIO: Lost/Stolen Laptop - Regain Access
═════════════════════════════════════════════

SITUATION
    Your laptop is gone. You have a new machine.
    Old keys: compromised (assume attacker has them)
    Servers: still have old keys in authorized_keys

THREAT LEVEL: HIGH - Act quickly

SIMPLE SOLUTION (DigitalOcean Console)
──────────────────────────────────────
If you still have DO account access (web/mobile):

    1. Generate new key on new laptop:
       ssh-keygen -t ed25519 -f ~/.ssh/id_ed25519

    2. Add to DigitalOcean account:
       - Web: Settings → Security → SSH Keys → Add
       - Or: doctl compute ssh-key create newlaptop --public-key-file ~/.ssh/id_ed25519.pub

    3. Use DO Console to access servers:
       - DigitalOcean Web → Droplet → Access → Launch Recovery Console
       - This gives you root shell without SSH

    4. In console, replace authorized_keys:
       # Remove ALL old keys (they're compromised)
       echo "ssh-ed25519 AAAA... your-new-key" > /root/.ssh/authorized_keys

    5. Repeat for each server (dev, staging, prod)

    6. Now SSH works from new laptop:
       ssh root@<ip>

NEXT STEPS (after regaining access)
───────────────────────────────────
    # Re-setup nh/tetra on new laptop
    nh switch <context>
    nh fetch
    org switch <org>

    # Regenerate ALL tkm keys (old ones are compromised)
    tkm init
    tkm revoke all      # Archives old keys locally
    tkm gen all         # Generate fresh keys
    tkm deploy all      # Push to servers (you have root now)

    # Remove old tkm keys from servers too
    # tkm deploy only ADDS keys, doesn't remove old ones
    # Manual cleanup or use: tkm remote clean <env> root "tkm_"

PREVENTION
──────────
    - Enable 2FA on DigitalOcean account
    - Consider passphrase on SSH keys
    - Document recovery procedure before you need it
EOF
}

_nh_scenario_new_dev() {
    cat << 'EOF'
SCENARIO: Onboarding New Developer
══════════════════════════════════

SITUATION
    New team member needs access to servers.
    You have working access. They have nothing.

SIMPLE SOLUTION (Shared tkm keys)
─────────────────────────────────
Most small teams share the same tkm keys:

    1. New dev clones your key setup:
       # On your machine, export keys
       tar czf tkm-keys.tar.gz ~/.ssh/<org>/
       # Secure transfer to new dev (not email!)

    2. New dev imports:
       tar xzf tkm-keys.tar.gz -C ~/
       chmod 700 ~/.ssh/<org>
       chmod 600 ~/.ssh/<org>/*

    3. New dev adds SSH config (or copy yours):
       # Add Match blocks for each host
       tkm config gen

    4. Test:
       ssh dev@$dev

BETTER SOLUTION (Per-dev keys, future tkm feature)
──────────────────────────────────────────────────
    # Not implemented yet, but the pattern would be:
    tkm gen dev --user alice
    tkm deploy dev --user alice
    # Creates: dev_dev_alice key
    # On offboard: tkm revoke dev --user alice

CURRENT WORKAROUND (Per-dev via DO keys)
────────────────────────────────────────
    1. New dev generates their key:
       ssh-keygen -t ed25519

    2. You add their pubkey to servers:
       # Get their pubkey
       cat ~/.ssh/id_ed25519.pub  # they send this to you

       # You add it to app user on each server
       ssh dev@$dev "echo 'ssh-ed25519 AAAA... alice' >> ~/.ssh/authorized_keys"

    3. For root access (if needed):
       ssh root@$dev "echo 'ssh-ed25519 AAAA... alice' >> ~/.ssh/authorized_keys"

OFFBOARDING
───────────
    # Remove their key from all servers
    ssh root@$dev "sed -i '/alice/d' /root/.ssh/authorized_keys"
    ssh root@$dev "sed -i '/alice/d' /home/dev/.ssh/authorized_keys"
    # Repeat for staging, prod

    # Or rotate shared keys if they had access:
    tkm rotate all
EOF
}

_nh_scenario_rotate() {
    cat << 'EOF'
SCENARIO: Routine Key Rotation
══════════════════════════════

SITUATION
    Security policy requires periodic rotation.
    Or: team member left, rotating as precaution.

SIMPLE SOLUTION (tkm rotate)
────────────────────────────
    # Rotate one environment
    tkm rotate dev
    # This does: revoke (archive old) → gen (new keys) → deploy (push to server)

    # Rotate all environments
    for env in dev staging prod; do
        tkm rotate $env
    done

WHAT HAPPENS
────────────
    1. Old keys archived: ~/.ssh/<org>/dev_root.revoked.20241127_143022
    2. New keys generated: ~/.ssh/<org>/dev_root (fresh)
    3. New pubkeys ADDED to server authorized_keys

    ⚠️  NOTE: Old keys still work until removed from server!

COMPLETE ROTATION (remove old keys too)
───────────────────────────────────────
    # After tkm rotate, clean up old keys on server
    tkm remote clean dev root "revoked"
    tkm remote clean dev dev "revoked"

    # Or manually:
    ssh root@$dev
    # Edit /root/.ssh/authorized_keys - remove old tkm_ entries
    # Edit /home/dev/.ssh/authorized_keys - remove old tkm_ entries

SCHEDULE
────────
    - Quarterly rotation: reasonable for most teams
    - After any offboarding: mandatory
    - After any security incident: immediate
EOF
}

_nh_scenario_compromised() {
    cat << 'EOF'
SCENARIO: Key Compromise / Security Breach
══════════════════════════════════════════

SITUATION
    You suspect or know a key is compromised.
    Attacker may have access RIGHT NOW.

THREAT LEVEL: CRITICAL - Act immediately

IMMEDIATE ACTIONS (do this first)
─────────────────────────────────
    1. Identify which key(s) compromised:
       - Your DO bootstrap key? → All servers at risk
       - Just dev_root? → Only dev server root at risk
       - Shared tkm keys? → Assume all servers at risk

    2. Emergency lockdown via DO Console:
       - DigitalOcean Web → Droplet → Access → Launch Recovery Console
       - Faster than trying to SSH race the attacker

    3. In console, nuke authorized_keys:
       # Remove ALL keys, add only your known-good key
       echo "ssh-ed25519 AAAA... emergency-key" > /root/.ssh/authorized_keys
       echo "ssh-ed25519 AAAA... emergency-key" > /home/dev/.ssh/authorized_keys

    4. Repeat for ALL servers (assume lateral movement)

AFTER LOCKDOWN
──────────────
    # Generate completely fresh keys
    rm -rf ~/.ssh/<org>/           # Delete all old keys
    tkm init
    tkm gen all
    tkm deploy all

    # If DO key was compromised:
    # - Remove old key from DO account (web UI)
    # - Generate new key, add to DO
    ssh-keygen -t ed25519 -f ~/.ssh/id_ed25519  # overwrites old
    doctl compute ssh-key create emergency --public-key-file ~/.ssh/id_ed25519.pub

FORENSICS (after immediate threat contained)
────────────────────────────────────────────
    # Check auth logs
    ssh root@$dev "grep 'Accepted' /var/log/auth.log | tail -50"

    # Check for unauthorized access
    ssh root@$dev "last -20"

    # Check for persistence (cron, authorized_keys elsewhere)
    ssh root@$dev "crontab -l"
    ssh root@$dev "find /home -name authorized_keys"
EOF
}

_nh_scenario_locked_out() {
    cat << 'EOF'
SCENARIO: Completely Locked Out
═══════════════════════════════

SITUATION
    No SSH key works. Can't access server at all.
    - Key mismatch
    - authorized_keys corrupted
    - SSH daemon misconfigured

SOLUTION 1: DigitalOcean Recovery Console (fastest)
───────────────────────────────────────────────────
    1. DigitalOcean Web → Droplets → Select droplet
    2. Access tab → Launch Recovery Console
    3. Login as root (may need to reset root password first)
    4. Fix authorized_keys:
       echo "ssh-ed25519 AAAA... your-key" > /root/.ssh/authorized_keys
       chmod 600 /root/.ssh/authorized_keys

SOLUTION 2: DO Droplet Recovery Mode
────────────────────────────────────
    1. Power off droplet (DO web UI)
    2. Boot into recovery mode
    3. Mount filesystem, fix authorized_keys
    4. Reboot normally

SOLUTION 3: Snapshot + New Droplet (nuclear option)
───────────────────────────────────────────────────
    If SSH daemon is broken:
    1. Create snapshot of broken droplet
    2. Create new droplet from snapshot
    3. Select your SSH key during creation
    4. New droplet has your key injected fresh
    5. Fix any SSH config issues
    6. Delete broken droplet

PREVENTION
──────────
    - Always have DO Console access (2FA on account)
    - Keep at least one backup key registered with DO
    - Test SSH access after any sshd_config changes
    - Never remove all keys from authorized_keys remotely
EOF
}

_nh_scenario_new_server() {
    cat << 'EOF'
SCENARIO: Adding New Server to Existing Org
═══════════════════════════════════════════

SITUATION
    You're adding a new droplet (e.g., new 'qa' environment).
    Existing org setup works fine.

STEPS
─────
    1. Create droplet with your DO key:
       doctl compute droplet create myorg-qa01 \
         --image ubuntu-22-04-x64 \
         --size s-1vcpu-1gb \
         --region nyc1 \
         --ssh-keys $(doctl compute ssh-key list --format ID --no-header | head -1)

    2. Refresh infrastructure data:
       nh fetch
       nh load

    3. Update tetra.toml with new environment:
       org edit
       # Add [environments.qa] section with new IP

    4. Generate keys for new environment:
       tkm gen qa
       # Creates: ~/.ssh/<org>/qa_root, qa_qa

    5. Deploy keys to new server:
       tkm deploy qa --key $(nh keys bootstrap)

    6. Test:
       ssh root@$qa
       ssh qa@$qa

ALTERNATIVE: Re-import from nh
──────────────────────────────
    # If droplet naming follows convention (has 'qa' in name):
    org import nh ~/nh/<context>/digocean.json <org>
    # Will detect new environment automatically

    org build <org>
    tkm gen qa
    tkm deploy qa
EOF
}

# =============================================================================
# HELP
# =============================================================================

nh_keys_help() {
    cat << 'EOF'
nh keys - DO-registered SSH key helpers

Helps find bootstrap keys for initial server access with tkm.

USAGE: nh keys [command]

COMMANDS
    list            List SSH keys registered with DigitalOcean
    match           Find local keys matching DO fingerprints
    bootstrap [-v]  Find best bootstrap key for tkm deploy
    scenarios       Common situations and recovery procedures

WORKFLOW
    When you create droplets, DO injects registered public keys.
    To deploy new tkm-managed keys, you need a "bootstrap" key:

    1. nh fetch                    # Gets SSHKeys from DO
    2. nh keys match               # Shows which local keys match
    3. KEY=$(nh keys bootstrap)    # Get bootstrap key path
    4. tkm deploy all --key $KEY   # Deploy tkm keys using bootstrap

EXAMPLES
    nh keys                        # List DO-registered keys
    nh keys match                  # Find matching local keys
    nh keys bootstrap -v           # Verbose: explain bootstrap key
    tkm deploy all --key $(nh keys bootstrap)  # One-liner deploy

ADDING A KEY TO DO
    doctl compute ssh-key create mykey --public-key-file ~/.ssh/id_ed25519.pub
EOF
}

# =============================================================================
# MAIN DISPATCHER
# =============================================================================

nh_keys() {
    local cmd="${1:-list}"
    shift 2>/dev/null || true

    case "$cmd" in
        list|ls)        nh_keys_list ;;
        match|m)        nh_keys_match ;;
        bootstrap|boot) nh_keys_bootstrap "$@" ;;
        scenarios|sc)   nh_keys_scenarios "$@" ;;
        help|h|--help)  nh_keys_help ;;
        *)
            echo "Unknown: $cmd"
            echo "Try: nh keys help"
            return 1
            ;;
    esac
}

# Export functions
export -f nh_keys nh_keys_list nh_keys_match nh_keys_bootstrap nh_keys_help
export -f nh_keys_scenarios _nh_scenario_list
export -f _nh_scenario_lost_laptop _nh_scenario_new_dev _nh_scenario_rotate
export -f _nh_scenario_compromised _nh_scenario_locked_out _nh_scenario_new_server
export -f _nh_keys_get_do_keys _nh_keys_local_fingerprint
