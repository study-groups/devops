#!/usr/bin/env bash

# Games Help System - TDS-themed contextual help
# Uses Tetra Design System color tokens for consistent styling

# =============================================================================
# COLOR SYSTEM
# =============================================================================

# Load colors - prefer TDS theme, fallback to tetra colors
_games_help_init_colors() {
    # Check for TDS palettes first
    if [[ -n "${VERBS_PRIMARY[0]:-}" ]]; then
        # TDS theme available - use semantic colors
        GAMES_C_TITLE="${VERBS_PRIMARY[4]:-00ACC1}"      # cyan - titles
        GAMES_C_SECTION="${VERBS_PRIMARY[5]:-1E88E5}"    # blue - sections
        GAMES_C_CMD="${VERBS_PRIMARY[4]:-00ACC1}"        # cyan - commands
        GAMES_C_FLAG="${VERBS_PRIMARY[1]:-FB8C00}"       # orange - flags
        GAMES_C_DESC="${NOUNS_PRIMARY[4]:-9E9E9E}"       # gray - descriptions
        GAMES_C_COMMENT="${NOUNS_PRIMARY[3]:-757575}"    # dark gray - comments
        GAMES_C_EXAMPLE="${VERBS_PRIMARY[3]:-43A047}"    # green - examples
        GAMES_C_ORG="${ENV_PRIMARY[0]:-7C4DFF}"          # purple - org context
        GAMES_C_GAME="${MODE_PRIMARY[2]:-66BB6A}"        # green - game names
        GAMES_C_ERROR="${VERBS_PRIMARY[0]:-E53935}"      # red - errors
        GAMES_C_WARN="${VERBS_PRIMARY[1]:-FB8C00}"       # orange - warnings
    elif [[ -f "$TETRA_SRC/bash/color/color.sh" ]]; then
        source "$TETRA_SRC/bash/color/color.sh" 2>/dev/null
        GAMES_C_TITLE="00ACC1"
        GAMES_C_SECTION="1E88E5"
        GAMES_C_CMD="00ACC1"
        GAMES_C_FLAG="FB8C00"
        GAMES_C_DESC="9E9E9E"
        GAMES_C_COMMENT="757575"
        GAMES_C_EXAMPLE="43A047"
        GAMES_C_ORG="7C4DFF"
        GAMES_C_GAME="66BB6A"
        GAMES_C_ERROR="E53935"
        GAMES_C_WARN="FB8C00"
    else
        # Fallback ANSI colors
        GAMES_C_TITLE="36"      # cyan
        GAMES_C_SECTION="34"    # blue
        GAMES_C_CMD="36"        # cyan
        GAMES_C_FLAG="33"       # yellow
        GAMES_C_DESC="90"       # gray
        GAMES_C_COMMENT="90"    # gray
        GAMES_C_EXAMPLE="32"    # green
        GAMES_C_ORG="35"        # purple
        GAMES_C_GAME="32"       # green
        GAMES_C_ERROR="31"      # red
        GAMES_C_WARN="33"       # yellow
        GAMES_USE_ANSI=true
    fi
}

# Initialize colors on load
_games_help_init_colors

# =============================================================================
# OUTPUT HELPERS
# =============================================================================

# Print with hex color (TDS style)
_games_c() {
    local color="$1" text="$2"
    if [[ "${GAMES_USE_ANSI:-}" == "true" ]]; then
        printf '\033[0;%sm%s\033[0m' "$color" "$text"
    elif declare -f text_color >/dev/null 2>&1; then
        text_color "$color"
        printf '%s' "$text"
        reset_color
    else
        printf '%s' "$text"
    fi
}

_games_cln() {
    _games_c "$1" "$2"
    echo
}

# Semantic helpers
_games_title() { _games_cln "$GAMES_C_TITLE" "$1"; }
_games_section() { _games_cln "$GAMES_C_SECTION" "$1"; }
_games_cmd() { _games_c "$GAMES_C_CMD" "$1"; }
_games_flag() { _games_c "$GAMES_C_FLAG" "$1"; }
_games_desc() { _games_c "$GAMES_C_DESC" "$1"; }
_games_org() { _games_c "$GAMES_C_ORG" "$1"; }
_games_game() { _games_c "$GAMES_C_GAME" "$1"; }

# Command line with description
_games_help_cmd() {
    local cmd="$1" desc="$2"
    printf "  "
    _games_cmd "$cmd"
    printf "  "
    _games_cln "$GAMES_C_DESC" "$desc"
}

# Flag with description
_games_help_flag() {
    local flag="$1" desc="$2"
    printf "  "
    _games_flag "$flag"
    printf "  "
    _games_cln "$GAMES_C_DESC" "$desc"
}

# Example with comment
_games_help_example() {
    local comment="$1" cmd="$2"
    printf "  "
    _games_c "$GAMES_C_COMMENT" "# $comment"
    echo
    printf "  "
    _games_cln "$GAMES_C_EXAMPLE" "$cmd"
}

# =============================================================================
# MAIN HELP
# =============================================================================

games_help_main() {
    local no_color=false
    [[ "$1" == "--no-color" || -n "${NO_COLOR:-}" ]] && no_color=true

    if [[ "$no_color" == "true" ]]; then
        GAMES_USE_ANSI=true
        GAMES_C_TITLE="" GAMES_C_SECTION="" GAMES_C_CMD=""
        GAMES_C_FLAG="" GAMES_C_DESC="" GAMES_C_COMMENT=""
        GAMES_C_EXAMPLE="" GAMES_C_ORG="" GAMES_C_GAME=""
        _games_c() { printf '%s' "$2"; }
        _games_cln() { printf '%s\n' "$2"; }
    fi

    _games_title "GAMES - Tetra Game Management"
    echo

    _games_section "USAGE"
    printf "  "
    _games_cmd "games"
    printf " "
    _games_flag "<command>"
    printf " "
    _games_cln "$GAMES_C_DESC" "[options]"
    echo

    _games_section "COMMANDS"
    _games_help_cmd "list                  " "List installed games"
    _games_help_cmd "play <game>           " "Play a game"
    _games_help_cmd "info <game>           " "Show game details"
    echo
    _games_section "MANIFEST CRUD"
    _games_help_cmd "get <slug> [field]    " "Read game from manifest"
    _games_help_cmd "set <slug> <f> <v>    " "Set field value"
    _games_help_cmd "add <slug> [opts]     " "Add new game"
    _games_help_cmd "rm <slug>             " "Remove game"
    _games_help_cmd "access <slug> [opts]  " "Set access control"
    echo
    _games_section "UPLOAD & DEPLOY"
    _games_help_cmd "upload <zip>          " "Upload and extract game"
    _games_help_cmd "url <slug>            " "Test game URL"
    _games_help_cmd "deploy <slug> <host>  " "Deploy via SSH"
    echo
    _games_section "ORGANIZATION"
    _games_help_cmd "org [name]            " "Show or set active org"
    _games_help_cmd "orgs                  " "List all orgs with games"
    _games_help_cmd "search <query>        " "Search games across orgs"
    echo
    _games_section "BACKUP & SYNC"
    _games_help_cmd "pak <game>            " "Create backup archive"
    _games_help_cmd "unpak <file>          " "Restore from archive"
    _games_help_cmd "manifest rebuild      " "Rebuild from game.toml"
    _games_help_cmd "doctor                " "Diagnose environment"
    echo

    _games_section "DIRECTORIES"
    printf "  "
    _games_desc "Games:   "
    _games_cln "$GAMES_C_ORG" "\$TETRA_DIR/orgs/<org>/games/<game>/"
    printf "  "
    _games_desc "Runtime: "
    _games_cln "$GAMES_C_GAME" "\$TETRA_DIR/games/<game>/"
    echo

    _games_section "EXAMPLES"
    _games_help_example "Add game to manifest" "games add my-game --name \"My Game\" --role user"
    _games_help_example "Set access control" "games access my-game --auth --role premium"
    _games_help_example "Upload game ZIP" "games upload my-game_ver-1.0.0.zip --s3"
    _games_help_example "Deploy to server" "games deploy my-game user@arcade.example.com"
    echo

    _games_section "HELP TOPICS"
    printf "  "
    _games_cmd "games help crud"
    printf "      "
    _games_cln "$GAMES_C_DESC" "Manifest CRUD operations"
    printf "  "
    _games_cmd "games help upload"
    printf "    "
    _games_cln "$GAMES_C_DESC" "Upload & URL testing"
    printf "  "
    _games_cmd "games help deploy"
    printf "    "
    _games_cln "$GAMES_C_DESC" "SSH deployment"
    printf "  "
    _games_cmd "games help all"
    printf "       "
    _games_cln "$GAMES_C_DESC" "Full command reference"
    echo
}

# =============================================================================
# TOPIC: PLAY
# =============================================================================

games_help_play() {
    _games_title "GAMES PLAY - Launch Games"
    echo

    _games_section "USAGE"
    printf "  "
    _games_cmd "games play"
    printf " "
    _games_flag "<game>"
    printf " "
    _games_cln "$GAMES_C_DESC" "[args...]"
    echo

    _games_section "DESCRIPTION"
    _games_cln "$GAMES_C_DESC" "  Launch a game by name. Games are discovered in the active org's"
    _games_cln "$GAMES_C_DESC" "  games directory and launched via their entry point."
    echo

    _games_section "ENTRY POINT DISCOVERY"
    _games_help_cmd "1. game.toml repl=    " "Explicit REPL script path"
    _games_help_cmd "2. game.toml entry=   " "Explicit entry script path"
    _games_help_cmd "3. core/<game>_repl.sh" "Convention-based REPL"
    _games_help_cmd "4. <game>.sh          " "Simple script fallback"
    echo

    _games_section "ENTRY FUNCTIONS"
    _games_cln "$GAMES_C_DESC" "  After sourcing the entry script, calls in order:"
    _games_help_cmd "game_run()            " "Standard entry function"
    _games_help_cmd "<game>_run()          " "Game-specific entry"
    _games_help_cmd "main()                " "Generic main function"
    echo

    _games_section "EXAMPLES"
    _games_help_example "Play estoface" "games play estoface"
    _games_help_example "Play from specific org" "GAMES_ORG=pixeljam games play cheapgolf"
    _games_help_example "Pass args to game" "games play trax --players 2"
    echo

    _games_section "SEE ALSO"
    printf "  games help orgs, games help new\n"
    echo
}

# =============================================================================
# TOPIC: ORGS
# =============================================================================

games_help_orgs() {
    _games_title "GAMES ORGS - Organization Structure"
    echo

    _games_section "OVERVIEW"
    _games_cln "$GAMES_C_DESC" "  Games are organized under orgs (organizations). Each org has its"
    _games_cln "$GAMES_C_DESC" "  own games directory with independent game installations."
    echo

    _games_section "DIRECTORY STRUCTURE"
    printf "  "
    _games_cln "$GAMES_C_ORG" "\$TETRA_DIR/orgs/"
    printf "    "
    _games_org "tetra"
    printf "/games/\n"
    printf "      "
    _games_game "estoface"
    printf "/\n"
    printf "      "
    _games_game "quadrapole"
    printf "/\n"
    printf "    "
    _games_org "pixeljam"
    printf "/games/\n"
    printf "      "
    _games_game "cheapgolf"
    printf "/\n"
    printf "      "
    _games_game "glorkz"
    printf "/\n"
    echo

    _games_section "ORG COMMANDS"
    _games_help_cmd "games org             " "Show current org (default: tetra)"
    _games_help_cmd "games org <name>      " "Set active org"
    _games_help_cmd "games orgs            " "List all orgs with games"
    echo

    _games_section "ORG CONTEXT"
    _games_cln "$GAMES_C_DESC" "  The active org is determined by (in order):"
    _games_help_flag "GAMES_ORG             " "Environment variable"
    _games_help_flag "GAMES_CTX_ORG         " "Context system variable"
    _games_help_flag "(default: tetra)      " "Fallback"
    echo

    _games_section "EXAMPLES"
    _games_help_example "List orgs with game counts" "games orgs"
    _games_help_example "Switch to pixeljam org" "games org pixeljam"
    _games_help_example "Temporary org switch" "GAMES_ORG=pixeljam games list"
    echo
}

# =============================================================================
# TOPIC: PAK
# =============================================================================

games_help_pak() {
    _games_title "GAMES PAK - Backup and Restore"
    echo

    _games_section "USAGE"
    printf "  "
    _games_cmd "games pak"
    printf " "
    _games_flag "<game>"
    printf " "
    _games_cln "$GAMES_C_DESC" "[output.tar.gz]"
    printf "  "
    _games_cmd "games unpak"
    printf " "
    _games_flag "<file.tar.gz>"
    echo
    echo

    _games_section "DESCRIPTION"
    _games_cln "$GAMES_C_DESC" "  Create portable game archives (gamepaks) for backup, sharing,"
    _games_cln "$GAMES_C_DESC" "  or deployment. Includes manifest.toml with metadata."
    echo

    _games_section "GAMEPAK FORMAT"
    printf "  "
    _games_game "<game>.gamepak.tar.gz"
    printf "\n"
    _games_cln "$GAMES_C_DESC" "    manifest.toml    Package metadata (auto-generated)"
    _games_cln "$GAMES_C_DESC" "    game.toml        Game configuration"
    _games_cln "$GAMES_C_DESC" "    ...              Game files"
    echo

    _games_section "MANIFEST.TOML"
    _games_cln "$GAMES_C_COMMENT" "  [gamepak]"
    _games_cln "$GAMES_C_DESC" "  name = \"estoface\""
    _games_cln "$GAMES_C_DESC" "  version = \"1.0.0\""
    _games_cln "$GAMES_C_DESC" "  description = \"Audio-Visual Synthesis Engine\""
    _games_cln "$GAMES_C_DESC" "  created = \"2024-12-16T10:30:00-08:00\""
    echo

    _games_section "EXAMPLES"
    _games_help_example "Create backup" "games pak estoface"
    _games_help_example "Custom output name" "games pak estoface estoface-v1.2.tar.gz"
    _games_help_example "Restore from backup" "games unpak estoface.gamepak.tar.gz"
    echo
}

# =============================================================================
# TOPIC: CRUD
# =============================================================================

games_help_crud() {
    _games_title "GAMES CRUD - Manifest Operations"
    echo

    _games_section "OVERVIEW"
    _games_cln "$GAMES_C_DESC" "  Direct manipulation of games.json manifest. The manifest is the"
    _games_cln "$GAMES_C_DESC" "  single source of truth - same data the admin UI edits."
    echo

    _games_section "COMMANDS"
    _games_help_cmd "get <slug> [field]    " "Read game or specific field"
    _games_help_cmd "set <slug> <f> <val>  " "Set field value"
    _games_help_cmd "add <slug> [options]  " "Add new game entry"
    _games_help_cmd "rm <slug>             " "Remove game from manifest"
    _games_help_cmd "import <dir>          " "Import game.toml into manifest"
    _games_help_cmd "access <slug> [opts]  " "Set access control"
    echo

    _games_section "ADD OPTIONS"
    _games_help_flag "--name \"Name\"         " "Display name"
    _games_help_flag "--summary \"Desc\"      " "Short description"
    _games_help_flag "--version \"1.0.0\"     " "Version string"
    _games_help_flag "--hide                " "Set show=false"
    _games_help_flag "--auth                " "Require authentication"
    _games_help_flag "--role <role>         " "guest|user|premium|dev|admin"
    _games_help_flag "--subscription <tier> " "free|basic|pro|enterprise"
    echo

    _games_section "ACCESS OPTIONS"
    _games_help_flag "--auth                " "Enable requires_auth"
    _games_help_flag "--no-auth             " "Disable requires_auth"
    _games_help_flag "--role <role>         " "Set minimum role"
    _games_help_flag "--subscription <tier> " "Set minimum subscription"
    echo

    _games_section "EXAMPLES"
    _games_help_example "Add game with options" "games add my-game --name \"My Game\" --role user"
    _games_help_example "Get game JSON" "games get my-game"
    _games_help_example "Get specific field" "games get my-game version"
    _games_help_example "Set version" "games set my-game version \"2.0.0\""
    _games_help_example "Set nested field" "games set my-game access_control.min_role premium"
    _games_help_example "Configure access" "games access my-game --auth --role premium"
    _games_help_example "Import from game.toml" "games import /path/to/game/"
    echo
}

# =============================================================================
# TOPIC: UPLOAD
# =============================================================================

games_help_upload() {
    _games_title "GAMES UPLOAD - ZIP Upload & URL Testing"
    echo

    _games_section "UPLOAD USAGE"
    printf "  "
    _games_cmd "games upload"
    printf " "
    _games_flag "<file.zip>"
    printf " "
    _games_cln "$GAMES_C_DESC" "[options]"
    echo

    _games_section "FILENAME FORMAT"
    _games_cln "$GAMES_C_DESC" "  Filenames should include slug and version:"
    _games_cln "$GAMES_C_EXAMPLE" "  game-name_ver-1.0.0.zip    (underscore separator)"
    _games_cln "$GAMES_C_EXAMPLE" "  game-name-ver-1.0.0.zip    (hyphen separator)"
    echo

    _games_section "UPLOAD OPTIONS"
    _games_help_flag "--s3, --sync          " "Also upload to S3 after local"
    _games_help_flag "--dry-run, -n         " "Parse filename only"
    _games_help_flag "--force, -f           " "Overwrite without prompt"
    echo

    _games_section "URL TESTING"
    printf "  "
    _games_cmd "games url"
    printf " "
    _games_flag "<slug>"
    printf " "
    _games_cln "$GAMES_C_DESC" "[variant]"
    echo
    _games_cln "$GAMES_C_DESC" "  Variants: default, demo, dev"
    echo

    _games_section "EXAMPLES"
    _games_help_example "Upload game" "games upload dillo_ver-2.0.0.zip"
    _games_help_example "Upload with S3 sync" "games upload my-game_ver-1.0.0.zip --s3"
    _games_help_example "Dry run (parse only)" "games upload game-ver-1.0.0.zip --dry-run"
    _games_help_example "Test URL" "games url my-game"
    _games_help_example "Test demo variant" "games url my-game demo"
    echo
}

# =============================================================================
# TOPIC: DEPLOY
# =============================================================================

games_help_deploy() {
    _games_title "GAMES DEPLOY - SSH Deployment"
    echo

    _games_section "USAGE"
    printf "  "
    _games_cmd "games deploy"
    printf " "
    _games_flag "<slug> <host>"
    printf " "
    _games_cln "$GAMES_C_DESC" "[options]"
    printf "  "
    _games_cmd "games deploy"
    printf " "
    _games_flag "--manifest <host>"
    printf " "
    _games_cln "$GAMES_C_DESC" "[options]"
    echo

    _games_section "OPTIONS"
    _games_help_flag "--key, -i <path>      " "SSH private key file"
    _games_help_flag "--user, -u <user>     " "SSH username"
    _games_help_flag "--dest, -d <path>     " "Remote destination (default: /var/www/games)"
    _games_help_flag "--s3                  " "Deploy from S3 instead of local"
    _games_help_flag "--manifest            " "Deploy games.json only"
    _games_help_flag "--dry-run, -n         " "Show commands without executing"
    echo

    _games_section "RELATED COMMANDS"
    _games_help_cmd "deploy-all <host>     " "Deploy all games"
    _games_help_cmd "deploy-status <host>  " "Check deployment status"
    echo

    _games_section "EXAMPLES"
    _games_help_example "Deploy single game" "games deploy my-game arcade.example.com"
    _games_help_example "With SSH key" "games deploy my-game user@host --key ~/.ssh/deploy"
    _games_help_example "Deploy manifest only" "games deploy --manifest arcade.example.com"
    _games_help_example "Custom destination" "games deploy my-game host --dest /opt/pja/games"
    _games_help_example "Dry run" "games deploy my-game host --dry-run"
    _games_help_example "Deploy all games" "games deploy-all arcade.example.com"
    _games_help_example "Check status" "games deploy-status arcade.example.com"
    echo
}

# =============================================================================
# FULL COMMAND REFERENCE
# =============================================================================

games_help_all() {
    local no_color=false
    [[ "$1" == "--no-color" || -n "${NO_COLOR:-}" ]] && no_color=true

    if [[ "$no_color" == "true" ]]; then
        GAMES_USE_ANSI=true
        _games_c() { printf '%s' "$2"; }
        _games_cln() { printf '%s\n' "$2"; }
    fi

    _games_title "GAMES - Full Command Reference"
    echo
    printf "  "
    _games_desc "Usage: "
    _games_cmd "games"
    printf " "
    _games_flag "<command>"
    printf " "
    _games_cln "$GAMES_C_DESC" "[args]"
    echo

    _games_section "GAME MANAGEMENT"
    _games_help_cmd "list                  " "List installed games in current org"
    _games_help_cmd "play <game> [args]    " "Launch a game"
    _games_help_cmd "info <game>           " "Show game metadata and paths"
    echo

    _games_section "MANIFEST CRUD (games.json is source of truth)"
    _games_help_cmd "get <slug> [field]    " "Read game or field from manifest"
    _games_help_cmd "set <slug> <f> <val>  " "Set field value"
    _games_help_cmd "add <slug> [options]  " "Add new game entry"
    _games_help_cmd "rm <slug>             " "Remove game from manifest"
    _games_help_cmd "import <dir>          " "Import game.toml into manifest"
    _games_help_cmd "access <slug> [opts]  " "Set access control"
    echo

    _games_section "UPLOAD & DEPLOY"
    _games_help_cmd "upload <zip> [opts]   " "Upload and extract game ZIP"
    _games_help_cmd "url <slug> [variant]  " "Test game URL resolution"
    _games_help_cmd "deploy <slug> <host>  " "Deploy game via SSH"
    _games_help_cmd "deploy-all <host>     " "Deploy all games"
    _games_help_cmd "deploy-status <host>  " "Check deployment status"
    echo

    _games_section "ORGANIZATION"
    _games_help_cmd "org                   " "Show current org"
    _games_help_cmd "org <name>            " "Set active org"
    _games_help_cmd "orgs                  " "List orgs with game counts"
    _games_help_cmd "search <query>        " "Search games across all orgs"
    echo

    _games_section "BACKUP & SYNC"
    _games_help_cmd "pak <game> [file]     " "Create gamepak archive"
    _games_help_cmd "unpak <file>          " "Extract gamepak to games dir"
    _games_help_cmd "manifest rebuild      " "Rebuild manifest from game.toml"
    _games_help_cmd "manifest list         " "Show games in manifest"
    _games_help_cmd "doctor                " "Diagnose games environment"
    echo

    _games_section "CONTEXT VARIABLES"
    _games_help_flag "GAMES_ORG             " "Override active org"
    _games_help_flag "PJA_GAMES_DIR         " "Manifest location"
    _games_help_flag "TETRA_SRC             " "Tetra source (no /bash)"
    echo

    _games_section "MANIFEST LOCATION"
    _games_cln "$GAMES_C_DESC" "  \$PJA_GAMES_DIR/games.json"
    _games_cln "$GAMES_C_DESC" "  Default: \$TETRA_DIR/orgs/pixeljam-arcade/games/games.json"
    echo
}

# =============================================================================
# HELP ROUTER
# =============================================================================

games_help_topic() {
    local topic="$1"
    shift || true

    case "$topic" in
        play|run|launch)
            games_help_play "$@"
            ;;
        orgs|org|organization)
            games_help_orgs "$@"
            ;;
        pak|pack|backup|restore|unpak)
            games_help_pak "$@"
            ;;
        crud|get|set|add|rm|access|import)
            games_help_crud "$@"
            ;;
        upload|url)
            games_help_upload "$@"
            ;;
        deploy|deploy-all|deploy-status)
            games_help_deploy "$@"
            ;;
        manifest)
            games_help_crud "$@"
            ;;
        all|full|reference)
            games_help_all "$@"
            ;;
        ""|help)
            games_help_main "$@"
            ;;
        *)
            _games_cln "$GAMES_C_ERROR" "Unknown help topic: $topic"
            echo "Topics: crud, upload, deploy, play, orgs, pak, all"
            return 1
            ;;
    esac
}

# =============================================================================
# EXPORTS
# =============================================================================

export -f games_help_main
export -f games_help_play
export -f games_help_orgs
export -f games_help_pak
export -f games_help_crud
export -f games_help_upload
export -f games_help_deploy
export -f games_help_all
export -f games_help_topic
