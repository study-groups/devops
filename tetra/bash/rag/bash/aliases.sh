# RAG Tools Porcelain Functions
# These functions provide friendly wrappers around the core RAG tools
# IMPORTANT: All scripts are called in a way that prevents exit from killing the terminal

# Use tetra convention paths
RAG_CORE_DIR="$RAG_SRC/core"

# Multicat (mc) - concatenate files into MULTICAT format
mc() { "$RAG_CORE_DIR/multicat/multicat.sh" "$@"; }

# Multisplit (ms) - split MULTICAT files back to individual files
ms() { "$RAG_CORE_DIR/multicat/multisplit.sh" "$@"; }

# MULTICAT info (mi) - show info about MULTICAT files
mi() { "$RAG_CORE_DIR/multicat/mcinfo.sh" "$@"; }

# Multifind (mf) - advanced file search with ranking
mf() { "$RAG_CORE_DIR/search/multifind.sh" "$@"; }

# Replace - file content replacement
replace() { "$RAG_CORE_DIR/utils/replace.sh" "$@"; }

# Get code utility
getcode() {
    source "$RAG_CORE_DIR/utils/getcode.sh"
    (getcode "$@" )
}

# Quick patch tool
qpatch() { "$RAG_CORE_DIR/patch/qpatch.sh" "$@"; }

# Interactive fuzzy grep
fzgrep() {
    "$RAG_CORE_DIR/search/fzfgrep.sh" "$@"
}

# Initialize evidence variables ($e1, $e2, etc.) from active flow
# Call this when flow changes or evidence is added/removed
init_evidence_vars() {
    local flow_dir=""

    # Get active flow directory (strip ANSI codes)
    if type get_active_flow_dir &>/dev/null 2>&1; then
        flow_dir="$(get_active_flow_dir 2>/dev/null | sed 's/\x1b\[[0-9;]*m//g')"
    else
        # Fallback: check for active symlink
        local rag_dir="${TETRA_DIR:-$HOME/.tetra}/rag"
        if [[ -L "$rag_dir/flows/active" ]]; then
            flow_dir="$(readlink -f "$rag_dir/flows/active" 2>/dev/null || readlink "$rag_dir/flows/active")"
        fi
    fi

    # Clear old evidence variables (e1, e2, e3, etc.)
    local old_vars=$(compgen -v | grep '^e[0-9]\+$')
    if [[ -n "$old_vars" ]]; then
        while IFS= read -r var; do
            unset "$var"
        done <<< "$old_vars"
    fi
    unset e_count

    # Exit early if no flow
    [[ -z "$flow_dir" ]] || [[ ! -d "$flow_dir" ]] && return 0

    local evidence_dir="$flow_dir/ctx/evidence"
    [[ ! -d "$evidence_dir" ]] && return 0

    # Set new evidence variables
    local index=1
    while IFS= read -r file; do
        # Export as global variable
        declare -g "e$index=$file"
        export "e$index"
        index=$((index + 1))
    done < <(ls -1 "$evidence_dir"/*.evidence.md 2>/dev/null | sort)

    # Export count
    declare -g e_count=$((index - 1))
    export e_count

    return 0
}

# List evidence files with their $e variables
evidence_list() {
    # Ensure variables are initialized
    init_evidence_vars

    if [[ ${e_count:-0} -eq 0 ]]; then
        echo "No evidence files in active flow"
        return 0
    fi

    echo "Evidence files in active flow:"
    echo ""

    for ((i=1; i<=e_count; i++)); do
        local var="e$i"
        local file="${!var}"
        [[ -z "$file" ]] && continue

        local basename=$(basename "$file")
        local first_line=$(head -n 1 "$file" 2>/dev/null)

        printf "  \$%-3s %s\n" "$var" "$basename"

        # Extract source path from metadata
        if [[ "$first_line" =~ ^##[[:space:]]*Evidence:[[:space:]]*(.+)$ ]]; then
            printf "        %s\n" "${BASH_REMATCH[1]}"
        fi
    done

    echo ""
    echo "Total: $e_count evidence file(s)"
    echo ""
    echo "Usage: cat \$e1, grep pattern \$e2, diff \$e1 \$e3"
}

# Rebase/groom evidence files - renumber and reorder
evidence_rebase() {
    local flow_dir=""

    if type get_active_flow_dir &>/dev/null 2>&1; then
        flow_dir="$(get_active_flow_dir 2>/dev/null | sed 's/\x1b\[[0-9;]*m//g')"
    fi

    if [[ -z "$flow_dir" ]] || [[ ! -d "$flow_dir" ]]; then
        echo "Error: No active flow" >&2
        return 1
    fi

    local evidence_dir="$flow_dir/ctx/evidence"
    if [[ ! -d "$evidence_dir" ]]; then
        echo "No evidence directory" >&2
        return 0
    fi

    # Get current files
    local files=()
    while IFS= read -r file; do
        files+=("$file")
    done < <(ls -1 "$evidence_dir"/*.evidence.md 2>/dev/null | sort)

    if [[ ${#files[@]} -eq 0 ]]; then
        echo "No evidence files to rebase"
        return 0
    fi

    echo "Current evidence files:"
    echo ""
    for i in "${!files[@]}"; do
        local idx=$((i + 1))
        local basename=$(basename "${files[$i]}")
        printf "  %2d. %s\n" "$idx" "$basename"
    done
    echo ""
    echo "Rebasing will renumber files as: 100, 110, 120, ..."
    read -p "Continue? (y/N) " -n 1 -r
    echo
    [[ ! $REPLY =~ ^[Yy]$ ]] && return 0

    # Rename files with new numbering
    local temp_dir=$(mktemp -d)
    local rank=100

    for file in "${files[@]}"; do
        local basename=$(basename "$file")
        # Extract the name part (everything after the first _)
        local name_part="${basename#*_}"
        local new_name="${rank}_${name_part}"

        cp "$file" "$temp_dir/$new_name"
        echo "  $basename → $new_name"

        rank=$((rank + 10))
    done

    # Replace old files with new ones
    rm -f "$evidence_dir"/*.evidence.md
    mv "$temp_dir"/*.evidence.md "$evidence_dir/"
    rmdir "$temp_dir"

    echo ""
    echo "✓ Evidence files rebased"

    # Refresh variables
    init_evidence_vars
    echo "✓ Variables refreshed: \$e1 through \$e$e_count"
}
