#!/usr/bin/env bash
# Wrapper to run org repl with rlwrap and tab completion

# Ensure tetra is loaded
if [[ -z "$TETRA_SRC" ]]; then
    source ~/tetra/tetra.sh
fi

# Check if rlwrap is available
if ! command -v rlwrap >/dev/null 2>&1; then
    echo "Error: rlwrap not found" >&2
    echo "Install with: brew install rlwrap (macOS) or apt install rlwrap (Linux)" >&2
    echo "" >&2
    echo "Running without tab completion..." >&2
    source "$TETRA_SRC/bash/org/includes.sh"
    org repl
    exit $?
fi

# Generate completion wordlist
WORDLIST="$TETRA_DIR/repl/org_completion_words"
mkdir -p "$(dirname "$WORDLIST")"

echo "Generating completion wordlist..." >&2
if [[ -f "$TETRA_SRC/bash/org/generate_completions.sh" ]]; then
    bash "$TETRA_SRC/bash/org/generate_completions.sh" > "$WORDLIST"
else
    # Fallback: minimal wordlist
    echo "env mode action next list status help exit quit" | tr ' ' '\n' > "$WORDLIST"
fi
echo "$(wc -l < "$WORDLIST" | tr -d ' ') completion words generated" >&2
echo "" >&2

# Create a launcher script that rlwrap can execute
LAUNCHER="$TETRA_DIR/repl/org_repl_launcher.sh"
cat > "$LAUNCHER" <<'LAUNCHER_EOF'
#!/usr/bin/env bash
source ~/tetra/tetra.sh 2>/dev/null
source "$TETRA_SRC/bash/org/includes.sh"
org repl "$@"
LAUNCHER_EOF
chmod +x "$LAUNCHER"

# Run org repl with rlwrap
REPL_RLWRAP_ACTIVE=1 exec rlwrap \
    -a \
    -A \
    -c \
    -f "$WORDLIST" \
    -H "$TETRA_DIR/repl/org_history.rlwrap" \
    -N \
    -D 2 \
    "$LAUNCHER" "$@"
