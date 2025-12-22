#!/usr/bin/env bash

# Games CRUD Module
# Direct manifest manipulation - games.json is the source of truth
#
# Usage:
#   games get <slug> [field]           # Read game or field
#   games set <slug> <field> <value>   # Set field value
#   games add <slug> [--name "..."]    # Add new game
#   games rm <slug>                    # Remove game
#   games import <dir>                 # Import from game.toml

# =============================================================================
# CONFIG
# =============================================================================

_games_manifest_path() {
    echo "${PJA_GAMES_DIR:-${TETRA_DIR}/orgs/pixeljam-arcade/games}/games.json"
}

_games_ensure_manifest() {
    local manifest=$(_games_manifest_path)
    if [[ ! -f "$manifest" ]]; then
        echo "Creating empty manifest: $manifest"
        mkdir -p "$(dirname "$manifest")"
        cat > "$manifest" << 'EOF'
{
  "_config": {
    "generated_at": "",
    "storage": {
      "s3_bucket": "pja-games",
      "s3_endpoint": "https://sfo3.digitaloceanspaces.com"
    }
  },
  "games": {}
}
EOF
    fi
    echo "$manifest"
}

_games_update_timestamp() {
    local manifest="$1"
    local tmp=$(mktemp)
    jq --arg ts "$(date -Iseconds)" '._config.generated_at = $ts' "$manifest" > "$tmp" && mv "$tmp" "$manifest"
}

# =============================================================================
# GET - Read from manifest
# =============================================================================

games_get() {
    local slug="$1"
    local field="${2:-}"
    local manifest=$(_games_manifest_path)

    if [[ ! -f "$manifest" ]]; then
        echo "Manifest not found: $manifest" >&2
        return 1
    fi

    if [[ -z "$slug" ]]; then
        echo "Usage: games get <slug> [field]" >&2
        return 1
    fi

    # Check game exists
    if ! jq -e ".games[\"$slug\"]" "$manifest" >/dev/null 2>&1; then
        echo "Game not found: $slug" >&2
        return 1
    fi

    if [[ -z "$field" ]]; then
        # Return entire game object
        jq ".games[\"$slug\"]" "$manifest"
    else
        # Return specific field (supports nested: access_control.min_role)
        jq -r ".games[\"$slug\"].$field // empty" "$manifest"
    fi
}

# =============================================================================
# SET - Write to manifest
# =============================================================================

games_set() {
    local slug="$1"
    local field="$2"
    local value="$3"
    local manifest=$(_games_ensure_manifest)

    if [[ -z "$slug" || -z "$field" ]]; then
        echo "Usage: games set <slug> <field> <value>" >&2
        return 1
    fi

    # Check game exists
    if ! jq -e ".games[\"$slug\"]" "$manifest" >/dev/null 2>&1; then
        echo "Game not found: $slug (use 'games add' first)" >&2
        return 1
    fi

    # Determine value type and set
    local tmp=$(mktemp)

    # Handle nested fields (e.g., access_control.min_role)
    if [[ "$field" == *"."* ]]; then
        # Nested field
        if [[ "$value" =~ ^(true|false)$ ]]; then
            jq ".games[\"$slug\"].$field = $value" "$manifest" > "$tmp"
        elif [[ "$value" =~ ^[0-9]+$ ]]; then
            jq ".games[\"$slug\"].$field = $value" "$manifest" > "$tmp"
        elif [[ "$value" == "["* ]]; then
            jq ".games[\"$slug\"].$field = $value" "$manifest" > "$tmp"
        else
            jq ".games[\"$slug\"].$field = \"$value\"" "$manifest" > "$tmp"
        fi
    else
        # Top-level field
        if [[ "$value" =~ ^(true|false)$ ]]; then
            jq ".games[\"$slug\"].$field = $value" "$manifest" > "$tmp"
        elif [[ "$value" =~ ^[0-9]+$ ]]; then
            jq ".games[\"$slug\"].$field = $value" "$manifest" > "$tmp"
        elif [[ "$value" == "["* ]]; then
            jq ".games[\"$slug\"].$field = $value" "$manifest" > "$tmp"
        else
            jq ".games[\"$slug\"].$field = \"$value\"" "$manifest" > "$tmp"
        fi
    fi

    mv "$tmp" "$manifest"
    _games_update_timestamp "$manifest"
    echo "Set $slug.$field = $value"
}

# =============================================================================
# ADD - Create new game entry
# =============================================================================

games_add() {
    local slug=""
    local name=""
    local summary=""
    local version="1.0.0"
    local show=true
    local requires_auth=false
    local min_role="guest"
    local min_subscription="free"

    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --name) name="$2"; shift 2 ;;
            --summary) summary="$2"; shift 2 ;;
            --version) version="$2"; shift 2 ;;
            --hide) show=false; shift ;;
            --auth) requires_auth=true; shift ;;
            --role) min_role="$2"; shift 2 ;;
            --subscription) min_subscription="$2"; shift 2 ;;
            -*) echo "Unknown option: $1" >&2; return 1 ;;
            *) slug="$1"; shift ;;
        esac
    done

    if [[ -z "$slug" ]]; then
        cat << 'EOF' >&2
Usage: games add <slug> [options]

Options:
  --name "Game Name"       Display name (default: slug)
  --summary "Description"  Short description
  --version "1.0.0"        Version string
  --hide                   Set show=false
  --auth                   Require authentication
  --role <role>            Minimum role (guest|user|premium|dev|admin)
  --subscription <tier>    Minimum subscription (free|basic|pro|enterprise)

Example:
  games add my-game --name "My Game" --summary "A fun game" --role user
EOF
        return 1
    fi

    local manifest=$(_games_ensure_manifest)

    # Check if already exists
    if jq -e ".games[\"$slug\"]" "$manifest" >/dev/null 2>&1; then
        echo "Game already exists: $slug" >&2
        echo "Use 'games set' to modify or 'games rm' first" >&2
        return 1
    fi

    # Default name to slug if not provided
    [[ -z "$name" ]] && name="$slug"

    # Build game object
    local game_json
    game_json=$(jq -n \
        --arg slug "$slug" \
        --arg name "$name" \
        --arg summary "$summary" \
        --arg src "/api/game-files/${slug}/index.html" \
        --arg url_path "${slug}/index.html" \
        --arg thumbnail "${slug}/thumbnail.jpg" \
        --argjson requires_auth "$requires_auth" \
        --arg min_role "$min_role" \
        --arg min_subscription "$min_subscription" \
        --argjson show "$show" \
        --arg version "$version" \
        '{
            slug: $slug,
            name: $name,
            summary: $summary,
            src: $src,
            url_path: $url_path,
            thumbnail: $thumbnail,
            access_control: {
                requires_auth: $requires_auth,
                min_role: $min_role,
                min_subscription: $min_subscription
            },
            tags: [],
            show: $show,
            version: $version
        }')

    # Add to manifest
    local tmp=$(mktemp)
    jq --arg slug "$slug" --argjson game "$game_json" '.games[$slug] = $game' "$manifest" > "$tmp"
    mv "$tmp" "$manifest"
    _games_update_timestamp "$manifest"

    echo "Added game: $slug"
    games_get "$slug"
}

# =============================================================================
# RM - Remove game from manifest
# =============================================================================

games_rm() {
    local slug="$1"
    local force="${2:-}"
    local manifest=$(_games_manifest_path)

    if [[ -z "$slug" ]]; then
        echo "Usage: games rm <slug> [--force]" >&2
        return 1
    fi

    if [[ ! -f "$manifest" ]]; then
        echo "Manifest not found: $manifest" >&2
        return 1
    fi

    # Check game exists
    if ! jq -e ".games[\"$slug\"]" "$manifest" >/dev/null 2>&1; then
        echo "Game not found: $slug" >&2
        return 1
    fi

    # Confirm unless --force
    if [[ "$force" != "--force" && "$force" != "-f" ]]; then
        read -p "Remove '$slug' from manifest? [y/N] " confirm
        [[ "$confirm" != [yY]* ]] && { echo "Cancelled"; return 0; }
    fi

    # Remove from manifest
    local tmp=$(mktemp)
    jq "del(.games[\"$slug\"])" "$manifest" > "$tmp"
    mv "$tmp" "$manifest"
    _games_update_timestamp "$manifest"

    echo "Removed: $slug"
}

# =============================================================================
# IMPORT - Process game.toml into manifest
# =============================================================================

games_import() {
    local source="$1"
    local manifest=$(_games_ensure_manifest)

    if [[ -z "$source" ]]; then
        echo "Usage: games import <directory|game.toml>" >&2
        return 1
    fi

    # Find game.toml
    local toml_file
    if [[ -f "$source" && "$source" == *.toml ]]; then
        toml_file="$source"
    elif [[ -d "$source" ]]; then
        toml_file="${source}/game.toml"
    else
        echo "Not found: $source" >&2
        return 1
    fi

    if [[ ! -f "$toml_file" ]]; then
        echo "No game.toml found in: $source" >&2
        return 1
    fi

    # Require toml_parser
    if ! declare -f toml_parse &>/dev/null; then
        if [[ -f "$TETRA_SRC/bash/utils/toml_parser.sh" ]]; then
            source "$TETRA_SRC/bash/utils/toml_parser.sh"
        else
            echo "Error: toml_parser.sh not found" >&2
            return 1
        fi
    fi

    # Parse game.toml
    local game_dir=$(dirname "$toml_file")
    local slug=$(basename "$game_dir")

    echo "Importing: $slug from $toml_file"

    # Clear previous parse
    for var in $(compgen -v | grep "^GAME_"); do unset "$var"; done
    toml_parse "$toml_file" "GAME"

    # Extract values
    local name="${GAME_game[name]:-$slug}"
    local summary="${GAME_game[summary]:-}"
    local version="${GAME_game[version]:-1.0.0}"
    local show="${GAME_game[show]:-true}"
    local tags="${GAME_game[tags]:-}"

    local path_latest="${GAME_paths[latest]:-index.html}"
    local path_demo="${GAME_paths[demo]:-}"
    local path_dev="${GAME_paths[dev]:-}"

    local requires_auth="${GAME_access[requires_auth]:-false}"
    local min_role="${GAME_access[min_role]:-guest}"
    local min_subscription="${GAME_access[min_subscription]:-free}"

    local thumbnail="${GAME_display[thumbnail]:-${slug}/thumbnail.jpg}"

    # Convert tags
    local tags_json="[]"
    if [[ -n "$tags" ]]; then
        tags_json="[${tags}]"
    fi

    # Build optional paths
    local demo_arg="" dev_arg=""
    [[ -n "$path_demo" ]] && demo_arg="${slug}/${path_demo}"
    [[ -n "$path_dev" ]] && dev_arg="${slug}/${path_dev}"

    # Build game JSON
    local game_json
    game_json=$(jq -n \
        --arg slug "$slug" \
        --arg name "$name" \
        --arg summary "$summary" \
        --arg src "/api/game-files/${slug}/${path_latest}" \
        --arg url_path "${slug}/${path_latest}" \
        --arg url_path_demo "$demo_arg" \
        --arg url_path_dev "$dev_arg" \
        --arg thumbnail "$thumbnail" \
        --argjson requires_auth "$requires_auth" \
        --arg min_role "$min_role" \
        --arg min_subscription "$min_subscription" \
        --argjson tags "$tags_json" \
        --argjson show "$show" \
        --arg version "$version" \
        '{
            slug: $slug,
            name: $name,
            summary: $summary,
            src: $src,
            url_path: $url_path,
            thumbnail: $thumbnail,
            access_control: {
                requires_auth: $requires_auth,
                min_role: $min_role,
                min_subscription: $min_subscription
            },
            tags: $tags,
            show: $show,
            version: $version
        }
        | if $url_path_demo != "" then . + {url_path_demo: $url_path_demo} else . end
        | if $url_path_dev != "" then . + {url_path_dev: $url_path_dev} else . end
        ')

    # Add/update in manifest
    local tmp=$(mktemp)
    jq --arg slug "$slug" --argjson game "$game_json" '.games[$slug] = $game' "$manifest" > "$tmp"
    mv "$tmp" "$manifest"
    _games_update_timestamp "$manifest"

    echo "Imported: $slug"
    games_get "$slug"
}

# =============================================================================
# ACCESS - Shorthand for access control
# =============================================================================

games_access() {
    local slug="$1"
    shift

    if [[ -z "$slug" ]]; then
        cat << 'EOF' >&2
Usage: games access <slug> [options]

Options:
  --auth              Require authentication (sets requires_auth=true)
  --no-auth           No authentication required
  --role <role>       Set minimum role (guest|user|premium|dev|admin)
  --subscription <t>  Set minimum subscription (free|basic|pro|enterprise)

Examples:
  games access my-game --auth --role user
  games access my-game --role premium --subscription pro
  games access my-game --no-auth --role guest
EOF
        return 1
    fi

    local manifest=$(_games_manifest_path)
    if ! jq -e ".games[\"$slug\"]" "$manifest" >/dev/null 2>&1; then
        echo "Game not found: $slug" >&2
        return 1
    fi

    # No options = show current
    if [[ $# -eq 0 ]]; then
        echo "Access control for $slug:"
        jq ".games[\"$slug\"].access_control" "$manifest"
        return 0
    fi

    # Parse and apply options
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --auth)
                games_set "$slug" "access_control.requires_auth" "true"
                shift
                ;;
            --no-auth)
                games_set "$slug" "access_control.requires_auth" "false"
                shift
                ;;
            --role)
                games_set "$slug" "access_control.min_role" "$2"
                shift 2
                ;;
            --subscription)
                games_set "$slug" "access_control.min_subscription" "$2"
                shift 2
                ;;
            *)
                echo "Unknown option: $1" >&2
                return 1
                ;;
        esac
    done

    echo ""
    echo "Updated access control:"
    jq ".games[\"$slug\"].access_control" "$manifest"
}

# =============================================================================
# EXPORTS
# =============================================================================

export -f games_get
export -f games_set
export -f games_add
export -f games_rm
export -f games_import
export -f games_access
export -f _games_manifest_path
export -f _games_ensure_manifest
export -f _games_update_timestamp
