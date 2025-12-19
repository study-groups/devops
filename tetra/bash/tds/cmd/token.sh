#!/usr/bin/env bash
# TDS Token Commands

# Set token mapping (in-memory only)
_tds_cmd_set_token() {
    local token="$1"
    local ref="$2"

    if [[ -z "$token" || -z "$ref" ]]; then
        echo "Usage: tds token set <name> <reference>"
        echo "Example: tds token set status.ok env:2"
        echo "Reference format: palette:index (e.g., env:0, mode:3)"
        return 1
    fi

    if [[ ! "$ref" =~ ^(env|mode|verbs|nouns):[0-9]+$ && ! "$ref" =~ ^#[0-9a-fA-F]{6}$ ]]; then
        echo "Invalid reference: $ref"
        echo "Expected: palette:index (e.g., env:0) or #RRGGBB"
        return 1
    fi

    local old_value="${TDS_COLOR_TOKENS[$token]:-}"
    TDS_COLOR_TOKENS[$token]="$ref"

    if [[ -n "$old_value" ]]; then
        echo "Set $token: $old_value -> $ref"
    else
        echo "Created $token: $ref"
    fi
    echo "(in-memory only, reset on theme switch)"
}

_tds_cmd_get_token() {
    local token="$1"

    if [[ -z "$token" ]]; then
        echo "Usage: tds token get <name>"
        echo "Example: tds token get content.heading.h1"
        return 1
    fi

    if [[ -n "${TDS_COLOR_TOKENS[$token]}" ]]; then
        local ref="${TDS_COLOR_TOKENS[$token]}"
        local hex=$(tds_resolve_color "$token")
        echo
        echo "Token:   $token"
        echo "Maps to: $ref"
        echo -n "Hex:     "
        if [[ -n "$hex" ]]; then
            if declare -f text_color >/dev/null 2>&1; then
                text_color "$hex"
                bg_only "$hex"
                printf "   "
                reset_color
            fi
            echo " $hex"
        else
            echo "(unresolved)"
        fi
        echo
    else
        echo "Token not found: $token"
        echo "Use 'tds token list' to list available tokens"
        return 1
    fi
}

_tds_cmd_list_tokens() {
    echo
    echo "=== Color Tokens ==="
    echo

    if [[ ${#TDS_COLOR_TOKENS[@]} -eq 0 ]]; then
        echo "(no tokens defined)"
        return
    fi

    local -A seen_cats=()
    for token in "${!TDS_COLOR_TOKENS[@]}"; do
        seen_cats["${token%%.*}"]=1
    done

    local categories
    mapfile -t categories < <(printf '%s\n' "${!seen_cats[@]}" | sort)

    for category in "${categories[@]}"; do
        echo "-- $category --"
        local tokens
        mapfile -t tokens < <(printf '%s\n' "${!TDS_COLOR_TOKENS[@]}" | grep "^${category}\." | sort)
        for token in "${tokens[@]}"; do
            local ref="${TDS_COLOR_TOKENS[$token]}"
            local hex=""
            hex=$(tds_resolve_color "$token" 2>/dev/null)
            if [[ -n "$hex" && "$hex" =~ ^[0-9a-fA-F]{6}$ ]]; then
                local swatch=$(tds_color_swatch "$hex")
                printf "  %s %-30s -> %s\n" "$swatch" "$token" "$ref"
            else
                printf "     %-30s -> %s\n" "$token" "$ref"
            fi
        done
        echo
    done
}

_tds_cmd_validate_tokens() {
    echo
    echo "=== Token Validation ==="
    echo

    if declare -f tds_show_token_validation >/dev/null; then
        tds_show_token_validation
    else
        local errors=0
        for token in "${!TDS_COLOR_TOKENS[@]}"; do
            local hex=$(tds_resolve_color "$token" 2>/dev/null)
            if [[ -z "$hex" ]]; then
                echo "x $token -> (unresolved)"
                ((errors++))
            fi
        done
        if [[ $errors -eq 0 ]]; then
            echo "ok All ${#TDS_COLOR_TOKENS[@]} tokens valid"
        else
            echo
            echo "Found $errors invalid tokens"
            return 1
        fi
    fi
}

# Resource handler
_tds_token() {
    local action="${1:-}"
    shift 2>/dev/null || true

    case "$action" in
        list|ls)     _tds_cmd_list_tokens ;;
        get)         _tds_cmd_get_token "$@" ;;
        set)         _tds_cmd_set_token "$@" ;;
        validate)    _tds_cmd_validate_tokens ;;
        help|--help|-h|"")
            _tds_token_help
            ;;
        *)
            echo "Unknown action: token $action"
            _tds_token_help
            return 1
            ;;
    esac
}

_tds_token_help() {
    echo
    echo "tds token - Manage semantic color tokens"
    echo
    echo "  list              List all token mappings"
    echo "  get <name>        Resolve token to hex"
    echo "  set <name> <ref>  Remap token (palette:index)"
    echo "  validate          Check all tokens resolve"
    echo
    echo "Categories: status, action, text, env, structural, interactive, content, marker"
    echo
}

export -f _tds_token _tds_token_help _tds_cmd_set_token _tds_cmd_get_token
export -f _tds_cmd_list_tokens _tds_cmd_validate_tokens
