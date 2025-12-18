#!/usr/bin/env bash

# Games Migration Script
# Migrates games from old ./available/ structure to new $TETRA_DIR/orgs/<org>/games/<category>/ structure
#
# Usage:
#   ./migrate_games.sh [--dry-run]
#   ./migrate_games.sh --org pixeljam-arcade --category pja-games [--dry-run]

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Defaults
DRY_RUN=false
TARGET_ORG=""
TARGET_CATEGORY=""

# Parse arguments
while [[ $# -gt 0 ]]; do
    case "$1" in
        --dry-run|-n)
            DRY_RUN=true
            shift
            ;;
        --org)
            TARGET_ORG="$2"
            shift 2
            ;;
        --category)
            TARGET_CATEGORY="$2"
            shift 2
            ;;
        --help|-h)
            cat << EOF
Games Migration Script
======================

Migrates games from old ./available/ structure to new location:
  \$TETRA_DIR/orgs/<org>/games/<category>/

USAGE:
    ./migrate_games.sh [options]

OPTIONS:
    --dry-run, -n       Show what would be done without making changes
    --org <name>        Target organization (default: tetra)
    --category <name>   Target category (default: games)
    --help, -h          Show this help

EXAMPLES:
    # Preview migration
    ./migrate_games.sh --dry-run

    # Migrate to tetra org
    ./migrate_games.sh --org tetra --category games

    # Migrate to pixeljam-arcade
    ./migrate_games.sh --org pixeljam-arcade --category pja-games

MIGRATION:
    Source: $SCRIPT_DIR/available/
    Target: \$TETRA_DIR/orgs/<org>/games/<category>/
EOF
            exit 0
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}" >&2
            exit 1
            ;;
    esac
done

# Check TETRA_DIR
if [[ -z "${TETRA_DIR:-}" ]]; then
    echo -e "${RED}Error: TETRA_DIR must be set${NC}" >&2
    echo "Set with: export TETRA_DIR=\$HOME/.tetra" >&2
    exit 1
fi

# Source directory
SOURCE_DIR="$SCRIPT_DIR/available"

if [[ ! -d "$SOURCE_DIR" ]]; then
    echo -e "${YELLOW}No games to migrate (available/ directory not found)${NC}"
    exit 0
fi

# Count games
GAME_COUNT=$(find "$SOURCE_DIR" -maxdepth 1 -type d ! -name "available" | wc -l | tr -d ' ')

if [[ "$GAME_COUNT" -eq 0 ]]; then
    echo -e "${YELLOW}No games to migrate (available/ is empty)${NC}"
    exit 0
fi

echo -e "${BLUE}Games Migration${NC}"
echo "==============="
echo ""
echo "Source: $SOURCE_DIR"
echo "Games:  $GAME_COUNT"
echo ""

if [[ "$DRY_RUN" == "true" ]]; then
    echo -e "${YELLOW}DRY RUN - No changes will be made${NC}"
    echo ""
fi

# Process each game
for game_dir in "$SOURCE_DIR"/*/; do
    [[ -d "$game_dir" ]] || continue

    game_name=$(basename "$game_dir")

    # Determine org and category from game.toml if present
    org="$TARGET_ORG"
    category="$TARGET_CATEGORY"

    if [[ -f "${game_dir}/game.toml" ]]; then
        # Parse game.toml for org
        toml_org=$(grep '^org' "${game_dir}/game.toml" 2>/dev/null | head -1 | cut -d'=' -f2 | tr -d ' "' || true)
        if [[ -n "$toml_org" && -z "$TARGET_ORG" ]]; then
            org="$toml_org"
        fi
    fi

    # Defaults if not set
    org="${org:-tetra}"
    category="${category:-games}"

    target_dir="$TETRA_DIR/orgs/$org/games/$category/$game_name"

    echo -e "${GREEN}Game:${NC} $game_name"
    echo "  Org:      $org"
    echo "  Category: $category"
    echo "  Source:   $game_dir"
    echo "  Target:   $target_dir"

    if [[ "$DRY_RUN" == "true" ]]; then
        echo "  Action:   [DRY RUN] Would move"
    else
        # Create target directory structure
        mkdir -p "$(dirname "$target_dir")"

        # Move game
        if [[ -d "$target_dir" ]]; then
            echo -e "  ${YELLOW}Warning: Target exists, skipping${NC}"
        else
            mv "$game_dir" "$target_dir"
            echo -e "  ${GREEN}Moved${NC}"
        fi
    fi
    echo ""
done

# Cleanup
if [[ "$DRY_RUN" == "false" ]]; then
    # Remove enabled/ symlinks
    if [[ -d "$SCRIPT_DIR/enabled" ]]; then
        echo "Removing enabled/ directory..."
        rm -rf "$SCRIPT_DIR/enabled"
    fi

    # Remove available/ if empty
    if [[ -d "$SOURCE_DIR" ]]; then
        remaining=$(find "$SOURCE_DIR" -maxdepth 1 -type d ! -name "available" | wc -l | tr -d ' ')
        if [[ "$remaining" -eq 0 ]]; then
            echo "Removing empty available/ directory..."
            rmdir "$SOURCE_DIR" 2>/dev/null || true
        else
            echo -e "${YELLOW}Some games remain in available/${NC}"
        fi
    fi
fi

echo ""
echo -e "${GREEN}Migration complete${NC}"

if [[ "$DRY_RUN" == "true" ]]; then
    echo ""
    echo "Run without --dry-run to apply changes"
fi
