#!/usr/bin/env bash
# TDOCS Review - Interactive document review and archival
# Manages work-in-progress documents and lifecycle transitions

# Ensure dependencies
: "${TDOCS_SRC:?TDOCS_SRC must be set}"
: "${TDOCS_DIR:?TDOCS_DIR must be set}"

# Archive directory structure
TDOC_ARCHIVE_ROOT="${TETRA_SRC}/bash/archive/docs"

# Pattern mapping for legacy WIP docs → tdocs types
declare -gA TDOC_LEGACY_PATTERNS=(
    [COMPLETE]="summary"
    [SUMMARY]="summary"
    [STATUS]="summary"
    [FIX]="bug-fix"
    [FIXES]="bug-fix"
    [REFACTOR]="refactor"
    [REFACTORING]="refactor"
    [PLAN]="plan"
    [PROPOSAL]="proposal"
    [MIGRATION]="refactor"
    [CHANGES]="changelog"
    [IMPLEMENTATION]="summary"
    [INTEGRATION]="summary"
)

# Review actions
declare -ga TDOC_REVIEW_ACTIONS=(
    "archive"    # Move to archive (lifecycle = X)
    "formalize"  # Convert to proper tdoc with metadata
    "move"       # Move to different location
    "keep"       # Keep as-is
    "delete"     # Remove completely
)

# ============================================================================
# DISCOVERY FUNCTIONS
# ============================================================================

# Find all legacy WIP docs in the repo
# Returns: Array of file paths
tdocs_find_legacy_wip() {
    local pattern="${1:-(PLAN|STATUS|REFACTOR|FIX|MIGRATION|PROPOSAL|DESIGN|COMPLETE|SUMMARY|CHANGES|IMPLEMENTATION|INTEGRATION)}"
    local search_path="${2:-bash}"

    # Find all .md files, then filter by pattern
    find "$TETRA_SRC/$search_path" -type f -name "*.md" \
        ! -path "*/node_modules/*" \
        ! -path "*/archive/*" \
        ! -path "*/.tdoc/*" \
        2>/dev/null | while read -r filepath; do
        local basename=$(basename "$filepath")
        if [[ "$basename" =~ $pattern ]]; then
            echo "$filepath"
        fi
    done | sort -u
}

# Detect likely tdocs type from filename
# Usage: tdocs_detect_type_from_filename "REPL_FIXES_COMPLETE.md"
# Returns: tdocs type (e.g., "bug-fix", "summary", "plan")
tdocs_detect_type_from_filename() {
    local filename="$1"
    local basename=$(basename "$filename" .md)

    # Check each pattern
    for pattern in "${!TDOC_LEGACY_PATTERNS[@]}"; do
        if [[ "$basename" =~ $pattern ]]; then
            echo "${TDOC_LEGACY_PATTERNS[$pattern]}"
            return 0
        fi
    done

    # Default to summary if we can't determine
    echo "summary"
}

# Extract module name from path
# Usage: tdocs_extract_module "bash/midi/REPL_FIXES.md"
# Returns: module name (e.g., "midi")
tdocs_extract_module() {
    local filepath="$1"

    # Normalize path: remove /./ patterns and resolve ../ if needed
    filepath="${filepath//\/.\//\/}"

    # Also handle cases where path might start with ./
    filepath="${filepath#./}"

    local relpath="${filepath#$TETRA_SRC/bash/}"

    # If relpath is unchanged, the path wasn't in bash/ - try without TETRA_SRC
    if [[ "$relpath" == "$filepath" ]]; then
        # Try relative path from current dir
        relpath="${filepath#bash/}"
    fi

    # If relpath doesn't contain a slash, file is directly in bash/
    if [[ "$relpath" != */* ]]; then
        echo "bash"  # Top-level bash/ file, no specific module
        return
    fi

    local module="${relpath%%/*}"
    echo "$module"
}

# Generate suggested archive path
# Usage: tdocs_suggest_archive_path "bash/midi/REPL_FIXES_COMPLETE.md"
# Returns: archive path
tdocs_suggest_archive_path() {
    local filepath="$1"
    local module=$(tdocs_extract_module "$filepath")
    local basename=$(basename "$filepath")
    local date=$(date +%Y-%m)

    echo "$TDOC_ARCHIVE_ROOT/$date/$module/$basename"
}

# ============================================================================
# INTERACTIVE REVIEW
# ============================================================================

# Interactive review session
# Walks through each WIP doc and prompts for action
tdocs_review_interactive() {
    local mode="${1:-wip}"  # "wip" or "all"
    local search_path="${2:-bash}"

    # Get terminal dimensions
    local term_lines=${LINES:-$(tput lines 2>/dev/null || echo 24)}
    local term_cols=${COLUMNS:-$(tput cols 2>/dev/null || echo 80)}

    # Set up Ctrl-C handler
    local review_interrupted=0
    _review_sigint_handler() {
        review_interrupted=1
    }
    trap '_review_sigint_handler' INT

    echo "=== TDOCS Interactive Review ==="
    echo ""

    # Interactive filter prompt
    echo "Filter by path (default: all of tetra)"
    echo ""
    echo "Examples:"
    echo "  bash/midi      - Only bash/midi files"
    echo "  docs           - Only docs/ directory"
    echo "  bash/*/docs    - All bash module docs/"
    echo "  <enter>        - All files in tetra"
    echo ""
    read -p "Path filter: " -r path_filter

    # Apply filter - default to root if empty or "."
    if [[ -z "$path_filter" ]] || [[ "$path_filter" == "." ]]; then
        search_path="."
    else
        # Clean up the path (remove trailing slash)
        search_path="${path_filter%/}"
    fi

    echo ""

    # Find documents based on mode
    local -a docs=()
    local full_search_path="$TETRA_SRC/$search_path"

    if [[ "$mode" == "all" ]]; then
        echo "Mode:  All markdown files"
        echo "Path:  $full_search_path"
        echo ""

        # Find ALL markdown files
        while IFS= read -r filepath; do
            docs+=("$filepath")
        done < <(find "$full_search_path" -type f -name "*.md" \
            ! -path "*/node_modules/*" \
            ! -path "*/archive/*" \
            ! -path "*/.tdoc/*" \
            2>/dev/null | sort)
    else
        local pattern="(PLAN|STATUS|REFACTOR|FIX|MIGRATION|PROPOSAL|DESIGN|COMPLETE|SUMMARY|CHANGES|IMPLEMENTATION|INTEGRATION)"
        echo "Mode:  WIP documents only"
        echo "Path:  $full_search_path"
        echo ""
        echo "Pattern:"
        echo "  PLAN, STATUS, REFACTOR, FIX, MIGRATION, PROPOSAL,"
        echo "  DESIGN, COMPLETE, SUMMARY, CHANGES, IMPLEMENTATION, INTEGRATION"
        echo ""

        # Find WIP docs in filtered path
        while IFS= read -r filepath; do
            docs+=("$filepath")
        done < <(find "$full_search_path" -type f -name "*.md" \
            ! -path "*/node_modules/*" \
            ! -path "*/archive/*" \
            ! -path "*/.tdoc/*" \
            2>/dev/null | while read -r f; do
                local bn=$(basename "$f")
                if [[ "$bn" =~ $pattern ]]; then
                    echo "$f"
                fi
            done | sort)
    fi

    local total=${#docs[@]}

    if [[ $total -eq 0 ]]; then
        echo "No documents found!"
        trap - INT  # Remove trap
        return 0
    fi

    echo "Found $total documents"
    echo ""
    read -p "Press Enter to start review (Ctrl-C to cancel)..."
    echo ""

    # Check if interrupted during initial prompt
    if [[ $review_interrupted -eq 1 ]]; then
        echo ""
        echo "Cancelled"
        trap - INT
        return 0
    fi

    # Process each document
    local count=0
    while [[ $count -lt $total ]]; do
        # Check for Ctrl-C
        if [[ $review_interrupted -eq 1 ]]; then
            echo ""
            echo "=== Review Interrupted ==="
            echo "Processed $count of $total documents"
            trap - INT
            return 0
        fi

        ((count++))
        local filepath="${docs[$((count - 1))]}"
        _tdocs_review_prompt_action "$filepath" "$count" "$total" "$term_lines" "$term_cols"

        # Check for quit, previous, or Ctrl-C
        local retval=$?
        if [[ $retval -eq 99 ]] || [[ $review_interrupted -eq 1 ]]; then
            echo ""
            echo "=== Review Interrupted ==="
            echo "Processed $((count - 1)) of $total documents"
            trap - INT
            return 0
        elif [[ $retval -eq 98 ]]; then
            # Previous - go back one (but not before start)
            if [[ $count -gt 1 ]]; then
                ((count -= 2))  # Will be incremented again at top of loop
                echo " → Going back"
                sleep 0.3
            else
                echo " → Already at first document"
                ((count--))  # Stay on current document
                sleep 0.5
            fi
        fi
    done

    echo ""
    clear
    echo "=== Review Complete ==="
    echo "Processed $count of $total documents"
    trap - INT  # Remove trap
}

# Prompt for action on a single document
_tdocs_review_prompt_action() {
    local filepath="$1"
    local current="$2"
    local total="$3"
    local term_lines="$4"
    local term_cols="$5"

    local basename=$(basename "$filepath")
    local module=$(tdocs_extract_module "$filepath")
    local detected_type=$(tdocs_detect_type_from_filename "$filepath")
    local suggested_archive=$(tdocs_suggest_archive_path "$filepath")

    # Clear screen and move to top
    clear

    # Add some space at top to prevent first line from being cut off
    echo ""
    echo ""
    echo ""

    # Calculate preview lines - be VERY conservative
    # Header: 6 lines (3 blank at top, title, metadata, path)
    # Actions: 6 lines (blank, Actions:, 3 action lines, blank, prompt)
    # Safety buffer: 10 lines (to prevent scrolling)
    # Total overhead: 22 lines
    local preview_lines=$((term_lines - 22))
    [[ $preview_lines -lt 5 ]] && preview_lines=5

    # Cap at 15 lines max to prevent scrolling
    [[ $preview_lines -gt 15 ]] && preview_lines=15

    # Set margins (8 chars on each side for preview)
    local left_margin=8
    local right_margin=8
    # TDS needs the full available width for its content
    # We subtract margins to get the actual text width TDS should use
    local content_width=$((term_cols - left_margin - right_margin))
    # Ensure minimum width
    [[ $content_width -lt 40 ]] && content_width=40

    # Get TDS colors if available - always fetch fresh
    local color_reset=""
    local color_title=""
    local color_type=""
    local color_lifecycle=""
    local color_module=""
    local color_dim=""
    local color_path=""

    if command -v tds_token >/dev/null 2>&1; then
        color_reset=$(tds_token reset 2>/dev/null || echo -e "\033[0m")
        color_title=$(tds_token heading.h1 2>/dev/null || echo -e "\033[1m")
        color_type=$(tds_token badge.info 2>/dev/null || echo "")
        color_lifecycle=$(tds_token badge.success 2>/dev/null || echo "")
        color_module=$(tds_token badge.warning 2>/dev/null || echo "")
        color_dim=$(tds_token text.dim 2>/dev/null || echo -e "\033[2m")
        color_path=$(tds_token text.muted 2>/dev/null || echo -e "\033[2m")
    else
        # Fallback to basic ANSI codes
        color_reset="\033[0m"
        color_title="\033[1m"
        color_dim="\033[2m"
    fi

    # Title - left aligned with 1 column indent, colorized
    echo -e " ${color_title}[$current/$total] $basename${color_reset}"

    # Calculate file age (use canonical _tdoc_file_mtime from utils.sh)
    local file_mtime=$(_tdoc_file_mtime "$filepath")
    local current_time=$(date +%s)
    local age_seconds=$((current_time - file_mtime))
    local age_days=$((age_seconds / 86400))
    local file_date=$(date -r "$file_mtime" +%Y-%m-%d 2>/dev/null || date -d "@$file_mtime" +%Y-%m-%d 2>/dev/null)

    # Format age string
    local age_str=""
    if [[ $age_days -eq 0 ]]; then
        age_str="today"
    elif [[ $age_days -eq 1 ]]; then
        age_str="1 day ago"
    elif [[ $age_days -lt 30 ]]; then
        age_str="$age_days days ago"
    elif [[ $age_days -lt 365 ]]; then
        local age_months=$((age_days / 30))
        if [[ $age_months -eq 1 ]]; then
            age_str="1 mo ago"
        else
            age_str="$age_months mo ago"
        fi
    else
        local age_years=$((age_days / 365))
        if [[ $age_years -eq 1 ]]; then
            age_str="1 yr ago"
        else
            age_str="$age_years yr ago"
        fi
    fi

    # Metadata - aligned with title (1 col indent), colorized VALUES not labels
    echo -ne " "
    echo -ne "${color_dim}type:${color_reset}${color_type}$detected_type${color_reset}  "
    echo -ne "${color_dim}lifecycle:${color_reset}${color_lifecycle}W${color_reset}  "
    echo -ne "${color_dim}module:${color_reset}${color_module}$module${color_reset}  "
    echo -ne "${color_dim}date:${color_reset}${color_dim}$file_date${color_reset} ${color_dim}($age_str)${color_reset}"
    echo ""

    # Full path from root on next line, gray/dimmed
    echo -e " ${color_dim}Path:${color_reset} ${color_path}$filepath${color_reset}"

    echo ""  # Blank line before preview

    # Create temp file with preview content, skipping frontmatter if present
    local preview_file=$(mktemp)

    # Check if file starts with frontmatter
    if head -1 "$filepath" | grep -q "^---$"; then
        # Skip frontmatter (from first --- to second ---)
        awk 'BEGIN {in_fm=0; past_fm=0}
             /^---$/ {
                 if (!past_fm) {
                     in_fm = !in_fm;
                     if (!in_fm) past_fm=1;
                     next
                 }
             }
             past_fm {print}' "$filepath" | head -n "$preview_lines" > "$preview_file"
    else
        # No frontmatter, just get lines
        head -n "$preview_lines" "$filepath" > "$preview_file"
    fi

    # Render preview with TDS and manual margins
    if command -v tds_render_markdown >/dev/null 2>&1; then
        # Render to temp variable, then add margins
        local rendered_output=$(mktemp)
        # Set width for TDS rendering - must override both TDS_MARKDOWN_WIDTH and COLUMNS
        # Save original COLUMNS if it exists
        local saved_columns="${COLUMNS:-}"
        export TDS_MARKDOWN_WIDTH="$content_width"
        export COLUMNS="$content_width"
        tds_render_markdown "$preview_file" > "$rendered_output" 2>/dev/null
        # Restore original values
        unset TDS_MARKDOWN_WIDTH
        if [[ -n "$saved_columns" ]]; then
            export COLUMNS="$saved_columns"
        else
            unset COLUMNS
        fi

        # Add left margin to each line
        while IFS= read -r line; do
            printf "%${left_margin}s%s\n" "" "$line"
        done < "$rendered_output"
        rm -f "$rendered_output"
    else
        # Fallback: simple display with margins
        while IFS= read -r line; do
            printf "%${left_margin}s" ""
            # Truncate line to content width
            echo "${line:0:$content_width}"
        done < "$preview_file"
    fi
    rm -f "$preview_file"

    # Suggest common move locations
    local suggested_docs="$TETRA_SRC/bash/$module/docs/$basename"

    # Get action colors - always fetch fresh
    local color_action_label=""
    local color_action_key=""
    local color_prompt=""

    if command -v tds_token >/dev/null 2>&1; then
        color_action_label=$(tds_token text.dim 2>/dev/null || echo -e "\033[2m")
        color_action_key=$(tds_token emphasis.strong 2>/dev/null || echo -e "\033[1m")
        color_prompt=$(tds_token text.normal 2>/dev/null || echo "")
    else
        # Fallback to basic ANSI codes
        color_action_label="\033[2m"
        color_action_key="\033[1m"
    fi

    # Actions section (fixed at bottom)
    echo ""
    echo -e " ${color_action_label}Actions:${color_reset}"
    echo -e "   ${color_action_key}[a]${color_reset} Archive    ${color_action_key}[f]${color_reset} Formalize  ${color_action_key}[m]${color_reset} Move"
    echo -e "   ${color_action_key}[k]${color_reset} Keep       ${color_action_key}[d]${color_reset} Delete     ${color_action_key}[n]${color_reset} Next"
    echo -e "   ${color_action_key}[v]${color_reset} View       ${color_action_key}[p]${color_reset} Prev       ${color_action_key}[q]${color_reset} Quit"
    echo ""
    echo -ne " ${color_prompt}Action:${color_reset} "
    read -n 1 -r action
    echo ""

    case "$action" in
        v|V)
            # View full document in pager, then return to same document
            if command -v tds_render_markdown >/dev/null 2>&1; then
                # Render with TDS and pipe to less
                local tmpfile=$(mktemp)

                # Add header with full path
                local color_path_label=""
                local color_path_value=""
                if command -v tds_token >/dev/null 2>&1; then
                    color_path_label=$(tds_token text.dim)
                    color_path_value=$(tds_token text.muted)
                fi

                echo "${color_path_label}Path:${color_reset} ${color_path_value}$filepath${color_reset}" > "$tmpfile"
                echo "" >> "$tmpfile"

                # Render markdown content
                tds_render_markdown "$filepath" >> "$tmpfile" 2>/dev/null

                less -R "$tmpfile"
                rm -f "$tmpfile"
            else
                # Fallback to plain less with path header
                local tmpfile=$(mktemp)
                echo "Path: $filepath" > "$tmpfile"
                echo "" >> "$tmpfile"
                cat "$filepath" >> "$tmpfile"
                less "$tmpfile"
                rm -f "$tmpfile"
            fi
            # Re-display the same document after exiting pager
            _tdocs_review_prompt_action "$filepath" "$current" "$total" "$term_lines" "$term_cols"
            return $?  # Propagate return code (e.g., quit signal)
            ;;
        a|A)
            # Show archive destination and confirm
            local archive_short="${suggested_archive#$TETRA_SRC/}"
            echo " Archive to: $archive_short"
            echo -n " Confirm? [y/N]: "
            read -n 1 -r confirm
            echo ""
            if [[ "$confirm" =~ ^[Yy]$ ]]; then
                _tdocs_review_archive "$filepath" "$suggested_archive"
            else
                echo " → Cancelled"
                sleep 0.5
            fi
            ;;
        f|F)
            _tdocs_review_formalize "$filepath" "$module" "$detected_type"
            ;;
        m|M)
            _tdocs_review_move "$filepath" "$module" "$basename" "$suggested_docs"
            ;;
        k|K)
            echo " → Keeping as-is"
            sleep 0.5
            ;;
        d|D)
            echo -n " Really delete $basename? [y/N]: "
            read -n 1 -r confirm
            echo ""
            if [[ "$confirm" =~ ^[Yy]$ ]]; then
                rm "$filepath"
                echo " → Deleted"
                sleep 0.5
            else
                echo " → Cancelled"
                sleep 0.5
            fi
            ;;
        n|N)
            echo " → Next"
            sleep 0.3
            ;;
        p|P)
            return 98  # Special return code for previous
            ;;
        q|Q)
            return 99  # Special return code for quit
            ;;
        *)
            echo " → Invalid action, skipping"
            sleep 1
            ;;
    esac
}

# Archive a document
_tdocs_review_archive() {
    local filepath="$1"
    local archive_path="$2"

    # Create archive directory
    local archive_dir=$(dirname "$archive_path")
    mkdir -p "$archive_dir"

    # Move file
    mv "$filepath" "$archive_path"
    echo " → Archived to:"
    echo "   ${archive_path#$TETRA_SRC/}"
    sleep 0.8
}

# Formalize a document (add tdocs metadata)
_tdocs_review_formalize() {
    local filepath="$1"
    local module="$2"
    local type="$3"

    # Check if already has frontmatter
    if head -1 "$filepath" | grep -q "^---$"; then
        echo " → Already has frontmatter, skipping"
        sleep 0.8
        return 1
    fi

    # Generate metadata
    local created=$(date -r "$filepath" +%Y-%m-%d 2>/dev/null || stat -f %Sm -t %Y-%m-%d "$filepath" 2>/dev/null || date +%Y-%m-%d)
    local updated=$(date +%Y-%m-%d)

    # Create temp file with frontmatter
    local tmpfile=$(mktemp)
    cat > "$tmpfile" <<EOF
---
type: $type
lifecycle: W
module: $module
created: $created
updated: $updated
tags: []
---

EOF

    # Append original content
    cat "$filepath" >> "$tmpfile"

    # Replace original
    mv "$tmpfile" "$filepath"

    echo " → Formalized as tdoc:"
    echo "   type=$type, module=$module, lifecycle=W"
    sleep 0.8
}

# Move a document to a new location
_tdocs_review_move() {
    local filepath="$1"
    local module="$2"
    local basename="$3"
    local suggested="$4"

    echo "  Move options:"
    echo "    [1] $suggested (module docs/)"
    echo "    [2] bash/$module/$basename (module root)"
    echo "    [3] docs/$basename (global docs/)"
    echo "    [4] Custom path"
    echo ""

    read -p "  Choose destination [1/2/3/4]: " -n 1 -r choice
    echo ""

    local destination=""
    case "$choice" in
        1)
            destination="$suggested"
            ;;
        2)
            destination="$TETRA_SRC/bash/$module/$basename"
            ;;
        3)
            destination="$TETRA_SRC/docs/$basename"
            ;;
        4)
            read -p "  Enter full path: " destination
            # Expand relative paths
            if [[ ! "$destination" =~ ^/ ]]; then
                destination="$TETRA_SRC/$destination"
            fi
            ;;
        *)
            echo "  → Invalid choice, cancelled"
            return 1
            ;;
    esac

    # Ensure directory exists
    local dest_dir=$(dirname "$destination")
    if [[ ! -d "$dest_dir" ]]; then
        read -p "  Directory $dest_dir doesn't exist. Create? [y/N]: " -n 1 -r confirm
        echo ""
        if [[ "$confirm" =~ ^[Yy]$ ]]; then
            mkdir -p "$dest_dir"
        else
            echo "  → Cancelled"
            return 1
        fi
    fi

    # Check if destination already exists
    if [[ -f "$destination" ]]; then
        echo "  → Error: Destination already exists: $destination"
        return 1
    fi

    # Move the file
    mv "$filepath" "$destination"
    echo "  → Moved to $destination"
}

# ============================================================================
# BATCH OPERATIONS
# ============================================================================

# Batch archive all WIP docs matching pattern
tdocs_review_batch_archive() {
    local pattern="${1:-(COMPLETE|SUMMARY)}"
    local search_path="${2:-bash}"

    echo "=== Batch Archive ==="
    echo "Pattern: $pattern"
    echo ""

    local count=0
    while IFS= read -r filepath; do
        local suggested_archive=$(tdocs_suggest_archive_path "$filepath")
        local archive_dir=$(dirname "$suggested_archive")

        mkdir -p "$archive_dir"
        mv "$filepath" "$suggested_archive"

        echo "Archived: $(basename "$filepath") → $suggested_archive"
        ((count++))
    done < <(tdocs_find_legacy_wip "$pattern" "$search_path")

    echo ""
    echo "Archived $count documents"
}

# Batch formalize all WIP docs matching pattern
tdocs_review_batch_formalize() {
    local pattern="${1:-.*}"
    local search_path="${2:-bash}"

    echo "=== Batch Formalize ==="
    echo "Pattern: $pattern"
    echo ""

    local count=0
    while IFS= read -r filepath; do
        local module=$(tdocs_extract_module "$filepath")
        local type=$(tdocs_detect_type_from_filename "$filepath")

        _tdocs_review_formalize "$filepath" "$module" "$type"
        echo "Formalized: $(basename "$filepath") (type=$type)"
        ((count++))
    done < <(tdocs_find_legacy_wip "$pattern" "$search_path")

    echo ""
    echo "Formalized $count documents"
}

# List all WIP docs with stats
tdocs_review_list() {
    local pattern="${1:-(PLAN|STATUS|REFACTOR|FIX|MIGRATION|PROPOSAL|DESIGN|COMPLETE|SUMMARY|CHANGES|IMPLEMENTATION|INTEGRATION)}"
    local search_path="${2:-bash}"

    echo "=== WIP Documents ==="
    echo ""

    declare -A type_counts
    declare -A module_counts
    local total=0

    while IFS= read -r filepath; do
        local module=$(tdocs_extract_module "$filepath")
        local type=$(tdocs_detect_type_from_filename "$filepath")
        local basename=$(basename "$filepath")

        # Update counts
        ((type_counts[$type]++))
        ((module_counts[$module]++))
        ((total++))

        # Display
        printf "%-20s %-15s %-10s %s\n" "$module" "$type" "$(basename "$filepath" .md | cut -c1-50)" "$filepath"
    done < <(tdocs_find_legacy_wip "$pattern" "$search_path")

    echo ""
    echo "=== Summary ==="
    echo "Total: $total documents"
    echo ""
    echo "By type:"
    for type in "${!type_counts[@]}"; do
        printf "  %-15s %3d\n" "$type" "${type_counts[$type]}"
    done | sort
    echo ""
    echo "By module:"
    for module in "${!module_counts[@]}"; do
        printf "  %-15s %3d\n" "$module" "${module_counts[$module]}"
    done | sort -k2 -rn
}

# Export functions
export -f tdocs_find_legacy_wip
export -f tdocs_detect_type_from_filename
export -f tdocs_extract_module
export -f tdocs_suggest_archive_path
export -f tdocs_review_interactive
export -f tdocs_review_batch_archive
export -f tdocs_review_batch_formalize
export -f tdocs_review_list
