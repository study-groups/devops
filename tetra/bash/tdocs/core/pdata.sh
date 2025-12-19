#!/usr/bin/env bash
# tdocs/core/pdata.sh - PData directory management
#
# PData is the organizational backbone for project data:
#   $TETRA_DIR/orgs/{org}/pd/
#   ├── data/
#   │   └── projects/
#   │       └── {project}/
#   │           └── {subject}/
#   │               ├── 001.md
#   │               └── 002.md
#   ├── config/
#   └── cache/

# =============================================================================
# ENVIRONMENT VARIABLES
# =============================================================================

# These are set when context is active
# PD_ORG      - Active organization name
# PD_PROJECT  - Active project name
# PD_SUBJECT  - Active subject/task name
# PD_DIR      - PData root: $TETRA_DIR/orgs/$PD_ORG/pd
# PD_DATA_DIR - Semantic alias: $PD_DIR/data

# =============================================================================
# DIRECTORY MANAGEMENT
# =============================================================================

# Initialize PData structure for an org
# Usage: pdata_init_org <org_name>
pdata_init_org() {
    local org="$1"

    if [[ -z "$org" ]]; then
        echo "Usage: pdata_init_org <org_name>" >&2
        return 1
    fi

    local org_dir="$TETRA_DIR/orgs/$org"
    if [[ ! -d "$org_dir" ]]; then
        echo "Error: Org directory not found: $org_dir" >&2
        return 1
    fi

    local pd_dir="$org_dir/pd"

    # Create structure
    mkdir -p "$pd_dir/data/projects"
    mkdir -p "$pd_dir/config"
    mkdir -p "$pd_dir/cache"

    echo "Initialized PData at $pd_dir"
}

# Ensure PData exists for org (create if missing, silent)
# Usage: pdata_ensure_org <org_name>
pdata_ensure_org() {
    local org="$1"
    local pd_dir="$TETRA_DIR/orgs/$org/pd"

    if [[ ! -d "$pd_dir/data/projects" ]]; then
        mkdir -p "$pd_dir/data/projects"
        mkdir -p "$pd_dir/config"
        mkdir -p "$pd_dir/cache"
    fi
}

# Create project directory
# Usage: pdata_create_project <org> <project>
pdata_create_project() {
    local org="$1"
    local project="$2"

    pdata_ensure_org "$org"

    local project_dir="$TETRA_DIR/orgs/$org/pd/data/projects/$project"
    mkdir -p "$project_dir"
    echo "$project_dir"
}

# Create subject directory
# Usage: pdata_create_subject <org> <project> <subject>
pdata_create_subject() {
    local org="$1"
    local project="$2"
    local subject="$3"

    pdata_ensure_org "$org"

    local subject_dir="$TETRA_DIR/orgs/$org/pd/data/projects/$project/$subject"
    mkdir -p "$subject_dir"
    echo "$subject_dir"
}

# Get next document number in a subject directory
# Returns: next number (e.g., "003")
pdata_next_doc_number() {
    local dir="$1"

    if [[ ! -d "$dir" ]]; then
        echo "001"
        return
    fi

    # Find highest numbered .md file
    local highest=0
    local num
    for f in "$dir"/[0-9][0-9][0-9].md; do
        [[ -f "$f" ]] || continue
        num="${f##*/}"
        num="${num%.md}"
        num=$((10#$num))  # Remove leading zeros
        (( num > highest )) && highest=$num
    done

    printf "%03d" $((highest + 1))
}

# =============================================================================
# CONTEXT MANAGEMENT
# =============================================================================

# Set PData environment variables
# Usage: pdata_set_env <org> [project] [subject]
pdata_set_env() {
    local org="$1"
    local project="${2:-}"
    local subject="${3:-}"

    export PD_ORG="$org"
    export PD_PROJECT="$project"
    export PD_SUBJECT="$subject"
    export PD_DIR="$TETRA_DIR/orgs/$org/pd"
    export PD_DATA_DIR="$PD_DIR/data"
}

# Clear PData environment variables
pdata_clear_env() {
    unset PD_ORG PD_PROJECT PD_SUBJECT PD_DIR PD_DATA_DIR
}

# Get current PData path (based on set context)
# Returns: path to current subject/project/org pd dir
pdata_get_cwd() {
    if [[ -n "$PD_ORG" ]]; then
        if [[ -n "$PD_PROJECT" && -n "$PD_SUBJECT" ]]; then
            echo "$PD_DATA_DIR/projects/$PD_PROJECT/$PD_SUBJECT"
        elif [[ -n "$PD_PROJECT" ]]; then
            echo "$PD_DATA_DIR/projects/$PD_PROJECT"
        else
            echo "$PD_DIR"
        fi
    fi
}

# =============================================================================
# LISTING / DISCOVERY
# =============================================================================

# List all orgs with PData
pdata_list_orgs() {
    local org_dir pd_dir
    for org_dir in "$TETRA_DIR/orgs"/*/; do
        [[ -d "$org_dir" ]] || continue
        pd_dir="${org_dir}pd"
        if [[ -d "$pd_dir" ]]; then
            echo "$(basename "${org_dir%/}")"
        fi
    done
}

# List projects in an org
pdata_list_projects() {
    local org="$1"
    local projects_dir="$TETRA_DIR/orgs/$org/pd/data/projects"

    [[ ! -d "$projects_dir" ]] && return

    local project_dir
    for project_dir in "$projects_dir"/*/; do
        [[ -d "$project_dir" ]] || continue
        echo "$(basename "${project_dir%/}")"
    done
}

# List subjects in a project
pdata_list_subjects() {
    local org="$1"
    local project="$2"
    local subjects_dir="$TETRA_DIR/orgs/$org/pd/data/projects/$project"

    [[ ! -d "$subjects_dir" ]] && return

    local subject_dir
    for subject_dir in "$subjects_dir"/*/; do
        [[ -d "$subject_dir" ]] || continue
        echo "$(basename "${subject_dir%/}")"
    done
}

# =============================================================================
# STATUS
# =============================================================================

# Show PData status
pdata_status() {
    echo "PData Status"
    echo "============"
    echo ""
    echo "Environment:"
    echo "  PD_ORG:      ${PD_ORG:-(not set)}"
    echo "  PD_PROJECT:  ${PD_PROJECT:-(not set)}"
    echo "  PD_SUBJECT:  ${PD_SUBJECT:-(not set)}"
    echo "  PD_DIR:      ${PD_DIR:-(not set)}"
    echo ""

    if [[ -n "$PD_ORG" ]]; then
        local cwd
        cwd=$(pdata_get_cwd)
        echo "  CWD:         $cwd"
        [[ -d "$cwd" ]] && echo "  Status:      exists" || echo "  Status:      (not created)"
    fi

    echo ""
    echo "Orgs with PData:"
    local org
    for org in $(pdata_list_orgs); do
        echo "  - $org"
    done
}

# =============================================================================
# EXPORTS
# =============================================================================

export -f pdata_init_org pdata_ensure_org
export -f pdata_create_project pdata_create_subject
export -f pdata_next_doc_number
export -f pdata_set_env pdata_clear_env pdata_get_cwd
export -f pdata_list_orgs pdata_list_projects pdata_list_subjects
export -f pdata_status
