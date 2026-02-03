#!/usr/bin/env bash
# deploy_validate.sh - Validate deploy TOML configuration files
#
# Usage:
#   deploy validate <target>              # Validate specific target
#   deploy validate --all                 # Validate all targets
#   deploy validate <path/to/file.toml>   # Validate specific file

# =============================================================================
# VALIDATION FUNCTIONS
# =============================================================================

deploy_validate() {
    local target="$1"
    local errors=0
    local warnings=0

    # Handle --all flag
    if [[ "$target" == "--all" || "$target" == "-a" ]]; then
        _deploy_validate_all
        return $?
    fi

    # Handle direct file path
    if [[ -f "$target" ]]; then
        _deploy_validate_file "$target"
        return $?
    fi

    # Resolve target to TOML file
    local toml_path
    toml_path=$(_deploy_find_toml "$target")

    if [[ -z "$toml_path" || ! -f "$toml_path" ]]; then
        echo "Error: Cannot find TOML for target: $target" >&2
        return 1
    fi

    _deploy_validate_file "$toml_path"
}

_deploy_validate_all() {
    local orgs_dir="${TETRA_DIR}/orgs"
    local total=0
    local passed=0
    local failed=0

    echo "Validating all deploy targets..."
    echo ""

    for toml in "$orgs_dir"/*/targets/*/tetra-deploy.toml; do
        [[ -f "$toml" ]] || continue
        ((total++))

        local rel_path="${toml#$orgs_dir/}"
        printf "  %-50s " "$rel_path"

        if _deploy_validate_file "$toml" --quiet; then
            echo -e "\033[32mOK\033[0m"
            ((passed++))
        else
            echo -e "\033[31mFAIL\033[0m"
            ((failed++))
        fi
    done

    echo ""
    echo "Results: $passed/$total passed"
    [[ $failed -gt 0 ]] && return 1
    return 0
}

_deploy_validate_file() {
    local toml="$1"
    local quiet="${2:-}"
    local errors=0
    local warnings=0

    [[ "$quiet" != "--quiet" ]] && echo "Validating: $toml"
    [[ "$quiet" != "--quiet" ]] && echo ""

    # Check file exists and is readable
    if [[ ! -r "$toml" ]]; then
        _val_error "File not readable: $toml"
        return 1
    fi

    # Parse file and validate structure
    local section=""
    local has_target=0
    local has_name=0
    local has_pipeline=0
    local pipelines=()
    local build_cmds=()
    local remote_cmds=()
    local post_cmds=()
    local envs=()

    while IFS= read -r line || [[ -n "$line" ]]; do
        # Skip empty lines and comments
        [[ -z "$line" || "$line" =~ ^[[:space:]]*# ]] && continue

        # Detect section headers
        if [[ "$line" =~ ^\[([a-zA-Z0-9_.]+)\] ]]; then
            section="${BASH_REMATCH[1]}"

            case "$section" in
                target) has_target=1 ;;
                pipeline) has_pipeline=1 ;;
                env.*) envs+=("${section#env.}") ;;
            esac
            continue
        fi

        # Parse key = value
        if [[ "$line" =~ ^([a-zA-Z_][a-zA-Z0-9_]*)[[:space:]]*= ]]; then
            local key="${BASH_REMATCH[1]}"

            case "$section" in
                target)
                    [[ "$key" == "name" ]] && has_name=1
                    ;;
                pipeline)
                    pipelines+=("$key")
                    ;;
                build)
                    build_cmds+=("$key")
                    ;;
                remote)
                    remote_cmds+=("$key")
                    ;;
                post)
                    post_cmds+=("$key")
                    ;;
            esac
        fi
    done < "$toml"

    # === Required sections ===
    if [[ $has_target -eq 0 ]]; then
        _val_error "[target] section is required" "$quiet"
        ((errors++))
    fi

    if [[ $has_name -eq 0 ]]; then
        _val_error "[target] must have 'name' field" "$quiet"
        ((errors++))
    fi

    if [[ $has_pipeline -eq 0 ]]; then
        _val_error "[pipeline] section is required" "$quiet"
        ((errors++))
    fi

    # === Check for 'full' pipeline ===
    local has_full=0
    for p in "${pipelines[@]}"; do
        [[ "$p" == "full" ]] && has_full=1
    done
    if [[ $has_full -eq 0 ]]; then
        _val_warn "No 'full' pipeline defined (recommended)" "$quiet"
        ((warnings++))
    fi

    # === Validate pipeline step references ===
    # Re-parse to check pipeline step references
    section=""
    while IFS= read -r line || [[ -n "$line" ]]; do
        [[ -z "$line" || "$line" =~ ^[[:space:]]*# ]] && continue

        if [[ "$line" =~ ^\[([a-zA-Z0-9_.]+)\] ]]; then
            section="${BASH_REMATCH[1]}"
            continue
        fi

        if [[ "$section" == "pipeline" && "$line" =~ = ]]; then
            local pname="${line%%=*}"
            pname="${pname//[[:space:]]/}"
            local steps="${line#*=}"

            # Extract step references from array
            while [[ "$steps" =~ \"([^\"]+)\" ]]; do
                local step="${BASH_REMATCH[1]}"
                steps="${steps#*\"${step}\"}"

                # Validate step format: type:name
                if [[ "$step" =~ ^(build|remote|post|push|hooks):(.+)$ ]]; then
                    local stype="${BASH_REMATCH[1]}"
                    local sname="${BASH_REMATCH[2]}"

                    # Inline commands have spaces (e.g. "remote:systemctl restart foo")
                    # Only validate references (no spaces in sname)
                    if [[ "$sname" == *" "* ]]; then
                        # Inline command - no validation needed
                        continue
                    fi

                    # Check if referenced command exists
                    case "$stype" in
                        build)
                            if [[ ! " ${build_cmds[*]} " =~ " ${sname} " ]]; then
                                _val_error "Pipeline '$pname' references undefined build:$sname" "$quiet"
                                ((errors++))
                            fi
                            ;;
                        remote)
                            if [[ ! " ${remote_cmds[*]} " =~ " ${sname} " ]]; then
                                _val_error "Pipeline '$pname' references undefined remote:$sname" "$quiet"
                                ((errors++))
                            fi
                            ;;
                        post)
                            if [[ ! " ${post_cmds[*]} " =~ " ${sname} " ]]; then
                                _val_error "Pipeline '$pname' references undefined post:$sname" "$quiet"
                                ((errors++))
                            fi
                            ;;
                    esac
                elif [[ "$step" != "push" ]]; then
                    _val_warn "Pipeline '$pname' has step '$step' - expected format type:name" "$quiet"
                    ((warnings++))
                fi
            done
        fi
    done < "$toml"

    # === Check for at least one environment ===
    if [[ ${#envs[@]} -eq 0 ]]; then
        _val_warn "No [env.*] sections defined" "$quiet"
        ((warnings++))
    fi

    # === Summary ===
    if [[ "$quiet" != "--quiet" ]]; then
        echo ""
        if [[ $errors -eq 0 && $warnings -eq 0 ]]; then
            echo -e "\033[32mValidation passed\033[0m"
        elif [[ $errors -eq 0 ]]; then
            echo -e "\033[33mValidation passed with $warnings warning(s)\033[0m"
        else
            echo -e "\033[31mValidation failed: $errors error(s), $warnings warning(s)\033[0m"
        fi
    fi

    return $errors
}

_val_error() {
    local msg="$1"
    local quiet="$2"
    [[ "$quiet" != "--quiet" ]] && echo -e "  \033[31mERROR:\033[0m $msg"
}

_val_warn() {
    local msg="$1"
    local quiet="$2"
    [[ "$quiet" != "--quiet" ]] && echo -e "  \033[33mWARN:\033[0m $msg"
}

_deploy_find_toml() {
    local target="$1"
    local orgs_dir="${TETRA_DIR}/orgs"

    # Try current org first
    local org="${DEPLOY_CTX_ORG:-tetra}"

    # Check direct path
    local path="$orgs_dir/$org/targets/$target/tetra-deploy.toml"
    [[ -f "$path" ]] && echo "$path" && return

    # Search all orgs
    for toml in "$orgs_dir"/*/targets/"$target"/tetra-deploy.toml; do
        [[ -f "$toml" ]] && echo "$toml" && return
    done
}
