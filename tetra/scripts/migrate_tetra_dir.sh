#!/usr/bin/env bash

# Tetra Directory Migration Script
# Migrates old TETRA_DIR structure to new organized system

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Migration configuration
BACKUP_SUFFIX=".pre-migration-$(date +%Y%m%d-%H%M%S)"
DRY_RUN=${DRY_RUN:-false}

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if we're in dry run mode
if [[ "$DRY_RUN" == "true" ]]; then
    log_info "Running in DRY RUN mode - no changes will be made"
    MKDIR_CMD="echo [DRY-RUN] mkdir -p"
    MV_CMD="echo [DRY-RUN] mv"
    LN_CMD="echo [DRY-RUN] ln -sf"
    RM_CMD="echo [DRY-RUN] rm"
else
    MKDIR_CMD="mkdir -p"
    MV_CMD="mv"
    LN_CMD="ln -sf"
    RM_CMD="rm"
fi

# Validate TETRA_DIR
if [[ -z "${TETRA_DIR:-}" ]]; then
    log_error "TETRA_DIR not set. Please source tetra.sh first."
    exit 1
fi

if [[ ! -d "$TETRA_DIR" ]]; then
    log_error "TETRA_DIR does not exist: $TETRA_DIR"
    exit 1
fi

log_info "Migrating TETRA_DIR: $TETRA_DIR"

# Check if already migrated
if [[ -d "$TETRA_DIR/modules" && -d "$TETRA_DIR/config" && -f "$TETRA_DIR/tetra.sh" ]]; then
    log_warning "Directory appears to already be migrated"
    if [[ "$(find "$TETRA_DIR" -maxdepth 1 -type f | wc -l)" -eq 1 ]]; then
        log_success "Migration appears complete - only tetra.sh at root"
        exit 0
    fi
fi

echo
log_info "🔍 Analyzing current structure..."

# Define what should be moved where
declare -A MODULE_DIRS=(
    ["bash"]="modules"
    ["rag"]="modules"
    ["tsm"]="modules"
    ["tkm"]="modules"
    ["tmod"]="modules"
    ["utils"]="modules"
    ["prompt"]="modules"
    ["qa"]="modules"
    ["nvm"]="modules"
    ["pyenv"]="modules"
    ["hotrod"]="modules"
    ["pbvm"]="modules"
    ["claude"]="modules"
    ["tpm"]="modules"
    ["pb"]="modules"
)

declare -A CONFIG_DIRS=(
    ["config"]="config"
    ["tetra"]="config/tetra"
)

declare -A KEEP_DIRS=(
    ["services"]="services"
    ["env"]="env"
    ["data"]="data"
    ["deploy"]="deploy"
    ["public"]="public"
)

declare -A ROOT_FILES=(
    ["tetra.sh"]="keep"
    ["local.sh"]="backup"
    ["aliases.sh"]="backup"
)

# Create backup
log_info "📦 Creating backup..."
backup_dir="${TETRA_DIR}${BACKUP_SUFFIX}"
if [[ "$DRY_RUN" != "true" ]]; then
    cp -r "$TETRA_DIR" "$backup_dir"
    log_success "Backup created: $backup_dir"
else
    echo "[DRY-RUN] cp -r $TETRA_DIR $backup_dir"
fi

echo
log_info "🏗️  Creating new directory structure..."

# Create new directories
$MKDIR_CMD "$TETRA_DIR/modules"
$MKDIR_CMD "$TETRA_DIR/config"
$MKDIR_CMD "$TETRA_DIR/orgs"

echo
log_info "📁 Moving module directories..."

# Move module directories
for dir in "${!MODULE_DIRS[@]}"; do
    if [[ -d "$TETRA_DIR/$dir" ]]; then
        target_dir="${MODULE_DIRS[$dir]}"
        log_info "Moving $dir → $target_dir/"
        $MV_CMD "$TETRA_DIR/$dir" "$TETRA_DIR/$target_dir/"
    fi
done

echo
log_info "⚙️  Moving configuration directories..."

# Move config directories
for dir in "${!CONFIG_DIRS[@]}"; do
    if [[ -d "$TETRA_DIR/$dir" ]]; then
        target_dir="${CONFIG_DIRS[$dir]}"
        log_info "Moving $dir → $target_dir"
        if [[ "$target_dir" == "config/tetra" ]]; then
            $MKDIR_CMD "$TETRA_DIR/config"
            $MV_CMD "$TETRA_DIR/$dir" "$TETRA_DIR/$target_dir"
        else
            $MV_CMD "$TETRA_DIR/$dir" "$TETRA_DIR/$target_dir"
        fi
    fi
done

echo
log_info "📄 Handling root files..."

# Handle root files
for file in "${!ROOT_FILES[@]}"; do
    if [[ -f "$TETRA_DIR/$file" ]]; then
        action="${ROOT_FILES[$file]}"
        if [[ "$action" == "backup" ]]; then
            log_info "Backing up $file → $file$BACKUP_SUFFIX"
            if [[ "$DRY_RUN" != "true" ]]; then
                mv "$TETRA_DIR/$file" "$TETRA_DIR/$file$BACKUP_SUFFIX"
            else
                echo "[DRY-RUN] mv $TETRA_DIR/$file $TETRA_DIR/$file$BACKUP_SUFFIX"
            fi
        else
            log_info "Keeping $file at root"
        fi
    fi
done

echo
log_info "🏢 Setting up organization structure..."

# Look for existing TOML files to convert to organizations
toml_files=($(find "$TETRA_DIR" -maxdepth 1 -name "*.toml" -type f 2>/dev/null || true))

if [[ ${#toml_files[@]} -gt 0 ]]; then
    for toml_file in "${toml_files[@]}"; do
        filename=$(basename "$toml_file")
        org_name="${filename%.toml}"

        log_info "Converting $filename to organization: $org_name"

        # Create organization directory
        $MKDIR_CMD "$TETRA_DIR/orgs/$org_name"

        # Move TOML file to organization
        $MV_CMD "$toml_file" "$TETRA_DIR/orgs/$org_name/${org_name}.toml"

        # Create active organization symlink (use first found)
        if [[ ! -L "$TETRA_DIR/config/tetra.toml" ]]; then
            log_info "Setting $org_name as active organization"
            $LN_CMD "$TETRA_DIR/orgs/$org_name/${org_name}.toml" "$TETRA_DIR/config/tetra.toml"
        fi
    done
else
    log_warning "No TOML files found - you may need to create an organization manually"
fi

echo
log_info "📋 Migration Summary"
echo "=================="

if [[ "$DRY_RUN" != "true" ]]; then
    log_success "✅ Backup created: $backup_dir"
    log_success "✅ New structure created in: $TETRA_DIR"

    echo
    log_info "📁 Final structure:"
    echo "├── tetra.sh"
    echo "├── config/"
    [[ -d "$TETRA_DIR/config/tetra" ]] && echo "│   ├── tetra/"
    [[ -f "$TETRA_DIR/config/tetra.toml" ]] && echo "│   └── tetra.toml → $(readlink "$TETRA_DIR/config/tetra.toml" 2>/dev/null || echo "active org")"
    echo "├── modules/"
    for dir in "$TETRA_DIR/modules"/*; do
        [[ -d "$dir" ]] && echo "│   ├── $(basename "$dir")/"
    done
    echo "├── orgs/"
    for dir in "$TETRA_DIR/orgs"/*; do
        [[ -d "$dir" ]] && echo "│   ├── $(basename "$dir")/"
    done
    echo "└── services/"

    echo
    log_info "🧪 Testing migrated system..."

    # Test basic loading
    if source "$TETRA_DIR/tetra.sh" 2>/dev/null; then
        log_success "✅ Tetra system loads correctly"
    else
        log_error "❌ Tetra system failed to load"
    fi

    echo
    log_success "🎉 Migration completed successfully!"
    echo
    log_info "Next steps:"
    echo "1. Test your tetra installation: source ~/tetra/tetra.sh"
    echo "2. Load modules: tmod load org tdash"
    echo "3. Check organizations: tetra org list"
    echo "4. Launch dashboard: tdash"
    echo
    log_info "If everything works, you can remove the backup:"
    echo "rm -rf $backup_dir"

else
    echo
    log_info "🔍 DRY RUN Summary:"
    echo "- Would create backup: $backup_dir"
    echo "- Would reorganize directories into modules/, config/, orgs/"
    echo "- Would preserve tetra.sh at root"
    echo "- Would convert TOML files to organizations"
    echo
    log_info "To execute migration, run: DRY_RUN=false $0"
fi