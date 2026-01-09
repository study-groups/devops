#!/usr/bin/env bash
# tsm/build.sh - DevPages Build System
#
# Simple file transforms: concat, copy, template
# Config: tsm/build.toml
#
# Usage:
#   ./tsm/build.sh           Build current directory
#   ./tsm/build.sh -n        Dry run
#
# Or source and call: source tsm/build.sh && build

BUILD_VERSION="1.0.0"

# =============================================================================
# TOML PARSER
# =============================================================================

# Parse tetra-build.toml into associative arrays
# Usage: _build_parse_toml <file>
# Sets: BUILD_META[], BUILD_BUNDLES_CSS[], BUILD_COPY[], BUILD_VARS[]
_build_parse_toml() {
    local file="$1"
    local current_section=""
    local current_subsection=""
    local in_array=false
    local array_key=""
    local -a array_values=()

    while IFS= read -r line || [[ -n "$line" ]]; do
        # Skip empty lines and comments
        [[ -z "$line" || "$line" =~ ^[[:space:]]*# ]] && continue

        # Trim whitespace
        line="${line#"${line%%[![:space:]]*}"}"
        line="${line%"${line##*[![:space:]]}"}"

        # Section header: [section] or [section.subsection]
        if [[ "$line" =~ ^\[([a-zA-Z_][a-zA-Z0-9_.-]*)\]$ ]]; then
            # Flush any pending array
            if [[ "$in_array" == "true" && -n "$array_key" ]]; then
                _build_flush_array "$current_section" "$current_subsection" "$array_key" "${array_values[@]}"
                array_values=()
                in_array=false
            fi

            local full_section="${BASH_REMATCH[1]}"
            if [[ "$full_section" == *.* ]]; then
                current_section="${full_section%%.*}"
                current_subsection="${full_section#*.}"
            else
                current_section="$full_section"
                current_subsection=""
            fi
            continue
        fi

        # Array continuation: "item" or "item",
        if [[ "$in_array" == "true" && "$line" =~ ^\"([^\"]+)\"[[:space:]]*,?[[:space:]]*$ ]]; then
            array_values+=("${BASH_REMATCH[1]}")
            continue
        fi

        # Array end: ]
        if [[ "$in_array" == "true" && "$line" == "]" ]]; then
            _build_flush_array "$current_section" "$current_subsection" "$array_key" "${array_values[@]}"
            array_values=()
            in_array=false
            array_key=""
            continue
        fi

        # Key = value or key = [
        if [[ "$line" =~ ^([a-zA-Z_][a-zA-Z0-9_]*)[[:space:]]*=[[:space:]]*(.*)$ ]]; then
            local key="${BASH_REMATCH[1]}"
            local val="${BASH_REMATCH[2]}"

            # Array start
            if [[ "$val" == "[" ]]; then
                in_array=true
                array_key="$key"
                array_values=()
                continue
            fi

            # Inline array: key = ["a", "b"]
            if [[ "$val" =~ ^\[(.+)\]$ ]]; then
                local items="${BASH_REMATCH[1]}"
                # Parse comma-separated quoted strings
                local -a parsed=()
                while [[ "$items" =~ \"([^\"]+)\" ]]; do
                    parsed+=("${BASH_REMATCH[1]}")
                    items="${items#*\"${BASH_REMATCH[1]}\"}"
                done
                _build_flush_array "$current_section" "$current_subsection" "$key" "${parsed[@]}"
                continue
            fi

            # Strip quotes from simple value
            val="${val#\"}" ; val="${val%\"}"
            val="${val#\'}" ; val="${val%\'}"

            # Store based on section
            case "$current_section" in
                build)
                    BUILD_META["$key"]="$val"
                    ;;
                copy)
                    BUILD_COPY["$key"]="$val"
                    ;;
                vars)
                    BUILD_VARS["$key"]="$val"
                    ;;
            esac
        fi
    done < "$file"

    # Flush final array if file ends mid-array
    if [[ "$in_array" == "true" && -n "$array_key" ]]; then
        _build_flush_array "$current_section" "$current_subsection" "$array_key" "${array_values[@]}"
    fi
}

# Store array values
_build_flush_array() {
    local section="$1"
    local subsection="$2"
    local key="$3"
    shift 3
    local -a values=("$@")

    case "$section" in
        bundles)
            case "$subsection" in
                css)
                    # Store as space-separated string
                    BUILD_BUNDLES_CSS["$key"]="${values[*]}"
                    ;;
            esac
            ;;
    esac
}

# =============================================================================
# TRANSFORMS
# =============================================================================

# Concatenate CSS files into a bundle
# Usage: _build_concat_css <bundle_name> <output_dir> <file1> [file2...]
_build_concat_css() {
    local bundle_name="$1"
    local output_dir="$2"
    shift 2
    local -a files=("$@")

    local output_file="$output_dir/${bundle_name}.bundle.css"
    local date_str=$(date '+%Y-%m-%d %H:%M:%S')

    # Header
    {
        echo "/* Bundle: $bundle_name */"
        echo "/* Generated: $date_str */"
        echo "/* Files: ${#files[@]} */"
        echo ""
    } > "$output_file"

    # Concatenate each file
    local count=0
    for f in "${files[@]}"; do
        if [[ -f "$f" ]]; then
            echo "" >> "$output_file"
            echo "/* === ${f##*/} === */" >> "$output_file"
            cat "$f" >> "$output_file"
            ((count++))
        else
            echo "  Warning: File not found: $f" >&2
        fi
    done

    echo "  $bundle_name.bundle.css ($count files)"
}

# Copy files with glob support
# Usage: _build_copy <pattern> <dest>
_build_copy() {
    local pattern="$1"
    local dest="$2"

    # Ensure dest directory exists
    mkdir -p "$(dirname "$dest")"

    # Copy files
    local count=0
    for f in $pattern; do
        if [[ -f "$f" ]]; then
            cp "$f" "$dest"
            ((count++))
        fi
    done

    echo "  Copied $count files to $dest"
}

# Template substitution
# Usage: _build_template <input> <output>
_build_template() {
    local input="$1"
    local output="$2"

    if [[ ! -f "$input" ]]; then
        echo "  Warning: Template not found: $input" >&2
        return 1
    fi

    local content
    content=$(<"$input")

    # Built-in vars
    local git_tag git_branch date_str
    git_tag=$(git describe --tags 2>/dev/null || echo "v0.0.0")
    git_branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "main")
    date_str=$(date '+%Y-%m-%d')

    # Expand built-ins
    content="${content//\{\{date\}\}/$date_str}"
    content="${content//\{\{git_tag\}\}/$git_tag}"
    content="${content//\{\{git_branch\}\}/$git_branch}"

    # Expand custom vars
    for key in "${!BUILD_VARS[@]}"; do
        local val="${BUILD_VARS[$key]}"
        # Expand var references in value
        [[ "$val" == "{{date}}" ]] && val="$date_str"
        [[ "$val" == "{{git_tag}}" ]] && val="$git_tag"
        [[ "$val" == "{{git_branch}}" ]] && val="$git_branch"
        content="${content//\{\{$key\}\}/$val}"
    done

    mkdir -p "$(dirname "$output")"
    echo "$content" > "$output"
    echo "  Template: $input -> $output"
}

# =============================================================================
# MAIN BUILD
# =============================================================================

# Find build.toml
_build_find_config() {
    local search_dir="${1:-.}"

    # Check tsm/ first (recommended location)
    if [[ -f "$search_dir/tsm/build.toml" ]]; then
        echo "$search_dir/tsm/build.toml"
        return 0
    fi

    # Fallback to root
    if [[ -f "$search_dir/build.toml" ]]; then
        echo "$search_dir/build.toml"
        return 0
    fi

    return 1
}

# Main build function
# Usage: tetra_build [options]
tetra_build() {
    local dry_run=false
    local remote_env=""
    local project_dir="."

    # Parse args
    while [[ $# -gt 0 ]]; do
        case "$1" in
            -n|--dry-run)
                dry_run=true
                shift
                ;;
            --remote)
                remote_env="$2"
                shift 2
                ;;
            -h|--help)
                _build_help
                return 0
                ;;
            *)
                if [[ -d "$1" ]]; then
                    project_dir="$1"
                fi
                shift
                ;;
        esac
    done

    # Find config
    local config
    config=$(_build_find_config "$project_dir")
    if [[ -z "$config" ]]; then
        echo "Error: No build.toml found" >&2
        echo "Searched: $project_dir/tsm/build.toml, $project_dir/build.toml" >&2
        return 1
    fi

    local config_dir=$(dirname "$config")
    local project_root=$(dirname "$config_dir")
    [[ "$config_dir" == "." ]] && project_root="."

    echo "Build: $config"
    echo "Project: $project_root"
    [[ "$dry_run" == "true" ]] && echo "[DRY RUN]"
    echo ""

    # Initialize arrays
    declare -gA BUILD_META=()
    declare -gA BUILD_BUNDLES_CSS=()
    declare -gA BUILD_COPY=()
    declare -gA BUILD_VARS=()

    # Parse config
    _build_parse_toml "$config"

    local name="${BUILD_META[name]:-unnamed}"
    echo "Building: $name"
    echo ""

    # Process CSS bundles
    if [[ ${#BUILD_BUNDLES_CSS[@]} -gt 0 ]]; then
        local css_output="${BUILD_META[output]:-client/css/bundles}"
        # Make output relative to project root
        [[ "$css_output" != /* ]] && css_output="$project_root/$css_output"

        echo "CSS Bundles -> $css_output"
        mkdir -p "$css_output"

        for bundle in "${!BUILD_BUNDLES_CSS[@]}"; do
            local files="${BUILD_BUNDLES_CSS[$bundle]}"
            # Convert space-separated to array, prepend project root
            local -a file_array=()
            for f in $files; do
                [[ "$f" != /* ]] && f="$project_root/$f"
                file_array+=("$f")
            done

            if [[ "$dry_run" == "true" ]]; then
                echo "  Would create: ${bundle}.bundle.css (${#file_array[@]} files)"
            else
                _build_concat_css "$bundle" "$css_output" "${file_array[@]}"
            fi
        done
        echo ""
    fi

    # Process copy operations
    if [[ ${#BUILD_COPY[@]} -gt 0 ]]; then
        echo "Copy Operations"
        for key in "${!BUILD_COPY[@]}"; do
            local spec="${BUILD_COPY[$key]}"
            # Parse "src -> dest" format
            if [[ "$spec" == *" -> "* ]]; then
                local src="${spec%% -> *}"
                local dest="${spec#* -> }"
                [[ "$src" != /* ]] && src="$project_root/$src"
                [[ "$dest" != /* ]] && dest="$project_root/$dest"

                if [[ "$dry_run" == "true" ]]; then
                    echo "  Would copy: $src -> $dest"
                else
                    _build_copy "$src" "$dest"
                fi
            fi
        done
        echo ""
    fi

    echo "Done"
}

_build_help() {
    echo "build - Simple file transforms"
    echo ""
    echo "Usage:"
    echo "  ./tsm/build.sh           Build current directory"
    echo "  ./tsm/build.sh <dir>     Build specified directory"
    echo "  ./tsm/build.sh -n        Dry run (show what would happen)"
    echo ""
    echo "Config: tsm/build.toml"
    echo ""
    echo "Example build.toml:"
    echo "  [build]"
    echo "  name = \"myapp\""
    echo "  output = \"dist/css\""
    echo ""
    echo "  [bundles.css]"
    echo "  core = [\"styles/reset.css\", \"styles/main.css\"]"
}

# If sourced, export functions. If executed directly, run build.
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    # Script is being executed directly
    cd "$(dirname "${BASH_SOURCE[0]}")/.." || exit 1
    tetra_build "$@"
else
    # Script is being sourced - export functions
    build() { tetra_build "$@"; }
    export -f tetra_build build
    export -f _build_parse_toml _build_flush_array _build_find_config
    export -f _build_concat_css _build_copy _build_template _build_help
fi
