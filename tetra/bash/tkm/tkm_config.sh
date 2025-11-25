#!/usr/bin/env bash
# tkm_config.sh - SSH config management
#
# View and manage ~/.ssh/config entries for current org

tkm_config() {
    local subcmd="${1:-show}"
    shift 2>/dev/null || true

    case "$subcmd" in
        show|"")    _tkm_config_show ;;
        gen)        _tkm_config_gen ;;
        edit)       _tkm_config_edit ;;
        *)
            echo "Usage: tkm config [show|gen|edit]"
            return 1
            ;;
    esac
}

_tkm_config_show() {
    local org=$(tkm_org_name 2>/dev/null)

    if [[ -z "$org" ]]; then
        echo "No active org"
        return 1
    fi

    echo "SSH Config for: $org"
    echo "===================="
    echo ""

    if [[ ! -f ~/.ssh/config ]]; then
        echo "(no ~/.ssh/config)"
        return 0
    fi

    # Show entries marked with this org
    local in_block=false
    local found=false

    while IFS= read -r line; do
        if [[ "$line" =~ ^#\ tkm:\ $org ]]; then
            in_block=true
            found=true
            echo "$line"
            continue
        fi

        if [[ "$line" =~ ^Host\  ]] && [[ "$in_block" == true ]]; then
            echo "$line"
            continue
        fi

        if [[ "$line" =~ ^Host\  ]] && [[ "$in_block" == false ]]; then
            continue
        fi

        if [[ "$line" =~ ^#\  ]] && [[ "$in_block" == true ]]; then
            in_block=false
            continue
        fi

        if [[ "$in_block" == true ]]; then
            echo "$line"
        fi
    done < ~/.ssh/config

    if [[ "$found" == false ]]; then
        echo "(no entries for $org)"
        echo ""
        echo "Generate with: tkm config gen"
    fi
}

_tkm_config_gen() {
    local org=$(tkm_org_name) || { echo "No active org"; return 1; }
    local envs=$(org_env_names 2>/dev/null)

    [[ -z "$envs" ]] && { echo "No environments"; return 1; }

    echo "Generating SSH config for: $org"
    echo ""

    for env in $envs; do
        [[ "$env" == "local" ]] && continue

        local host=$(_tkm_get_host "$env")
        if [[ -z "$host" ]]; then
            echo "  $env: [!] no host"
            continue
        fi

        _tkm_add_ssh_host_config "$env" "$host"
        echo "  $env: $host"
    done

    echo ""
    echo "Done"
}

_tkm_config_edit() {
    ${EDITOR:-vim} ~/.ssh/config
}

export -f tkm_config _tkm_config_show _tkm_config_gen _tkm_config_edit
