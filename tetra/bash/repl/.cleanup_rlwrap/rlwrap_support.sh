#!/usr/bin/env bash
# REPL rlwrap Support - UNIFIED APPROACH
# Universal rlwrap wrapper for all Tetra takeover-mode REPLs
#
# WHY: bind -x doesn't work with read -e because read creates its own
# readline instance that doesn't inherit parent shell bindings.
# rlwrap solves this by wrapping the entire process.
#
# This is the ONLY rlwrap support file - consolidates all approaches

# Check if rlwrap is available
repl_has_rlwrap() {
    command -v rlwrap >/dev/null 2>&1
}

# Generate completion wordlist for current module
# Modules should register their completions via:
#   repl_set_completion_generator callback_function
repl_generate_completion_words() {
    local module="${1:-$REPL_MODULE_NAME}"
    local output_file="${2:-$TETRA_DIR/repl/${module}_completion_words}"

    # Ensure directory exists
    mkdir -p "$(dirname "$output_file")"

    # Start fresh
    > "$output_file"

    # Call module's completion generator
    local generator="_${module}_generate_completions"
    if command -v "$generator" >/dev/null 2>&1; then
        "$generator" >> "$output_file" 2>/dev/null
    fi

    # Fallback: basic commands if generator failed
    if [[ ! -s "$output_file" ]]; then
        cat >> "$output_file" <<EOF
help
h
exit
quit
q
EOF
    fi

    # Remove duplicates and sort
    sort -u "$output_file" -o "$output_file"

    echo "$output_file"
}

# Set a custom completion generator function
# Usage: repl_set_completion_generator my_completion_function
repl_set_completion_generator() {
    REPL_COMPLETION_GENERATOR="$1"
}

# Launch REPL with rlwrap for tab completion
# Usage: repl_with_rlwrap <module_name> <repl_command>
#
# Examples:
#   repl_with_rlwrap "org" "org repl"
#   repl_with_rlwrap "tdocs" "tdocs repl"
#
repl_with_rlwrap() {
    local module="$1"
    local repl_command="${2:-${module} repl}"

    # Check if rlwrap is available
    if ! repl_has_rlwrap; then
        echo "Note: rlwrap not installed (tab completion disabled)"
        echo "      Install: brew install rlwrap (macOS) or apt install rlwrap (Linux)"
        echo ""
        echo "Running basic REPL without tab completion..."
        eval "$repl_command"
        return $?
    fi

    # Setup paths
    local wordlist="$TETRA_DIR/repl/${module}_completion_words"
    local history="$TETRA_DIR/repl/${module}_history.rlwrap"

    mkdir -p "$(dirname "$wordlist")"
    mkdir -p "$(dirname "$history")"

    # Generate completions
    repl_generate_completion_words "$module" "$wordlist" >/dev/null

    # Set flag so REPL knows rlwrap is active
    export REPL_RLWRAP_ACTIVE=1

    # Create a wrapper script that rlwrap can execute
    # This ensures proper environment and colored prompt support
    local wrapper="$TETRA_DIR/repl/.${module}_rlwrap_launcher.sh"
    cat > "$wrapper" <<WRAPPER_EOF
#!/usr/bin/env bash
export REPL_RLWRAP_ACTIVE=1
source ~/tetra/tetra.sh 2>/dev/null
tmod load $module 2>/dev/null
exec $repl_command
WRAPPER_EOF
    chmod +x "$wrapper"

    # Launch with rlwrap using exec to preserve stdin/stdout/stderr properly
    # Key flags for proper colored prompt support:
    # -a: Use ANSI escape codes (CRITICAL for colored prompts)
    # -A: Enable bracketed paste mode
    # -n: Suppress warnings
    # -b '(){}[],+=&^%$#@"";|\': Break chars (KEEP colon OUT so view:orgs completes as one word)
    # -f: Completion wordlist file
    # -H: History file
    # -N: Don't eat prompt (CRITICAL for custom colored prompts)
    # -D 2: History deduplication
    # -o: Only display completion if unambiguous (NO MULTI-COLUMN LIST!)
    exec rlwrap \
        -a \
        -A \
        -n \
        -b '(){}[],+=&^%$#@"";|\' \
        -o \
        -f "$wordlist" \
        -H "$history" \
        -N \
        -D 2 \
        "$wrapper"
}

# Show installation hint if rlwrap not available
repl_show_rlwrap_hint() {
    cat <<'EOF'

╭─────────────────────────────────────────────────────────╮
│ ℹ️  Tab Completion Not Available                        │
├─────────────────────────────────────────────────────────┤
│ For full tab completion support, install rlwrap:       │
│                                                         │
│   macOS:  brew install rlwrap                          │
│   Linux:  apt install rlwrap                           │
│                                                         │
│ Type 'help' or '?' to see available commands           │
╰─────────────────────────────────────────────────────────╯

EOF
}

# Global state
declare -g REPL_COMPLETION_GENERATOR="" # Custom generator function
declare -g REPL_MODULE_NAME=""          # Current module name

# Export functions
export -f repl_has_rlwrap
export -f repl_generate_completion_words
export -f repl_set_completion_generator
export -f repl_with_rlwrap
export -f repl_show_rlwrap_hint
