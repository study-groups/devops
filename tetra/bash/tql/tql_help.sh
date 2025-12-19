#!/usr/bin/env bash
# tql_help.sh - TQL Help System with Colored Syntax Examples

# Colors for TQL syntax highlighting
_tql_help_colors() {
    if [[ -n "$NO_COLOR" || "$1" == "--no-color" ]]; then
        C_TITLE="" C_SEC="" C_OP="" C_FIELD="" C_VAL="" C_MOD="" C_TIME="" C_GRAY="" C_EX="" C_NC=""
    else
        C_TITLE='\033[1;36m'    # Cyan bold - titles
        C_SEC='\033[1;34m'      # Blue bold - sections
        C_OP='\033[1;35m'       # Magenta bold - operators
        C_FIELD='\033[0;33m'    # Yellow - field names
        C_VAL='\033[0;32m'      # Green - values
        C_MOD='\033[0;36m'      # Cyan - modifiers (sort:, limit:)
        C_TIME='\033[0;35m'     # Magenta - temporal expressions
        C_GRAY='\033[0;90m'     # Gray - comments
        C_EX='\033[0;37m'       # White - example commands
        C_NC='\033[0m'          # Reset
    fi
}

# Syntax-highlighted query example
# Usage: _tql_query "env=tetra sort:uptime limit:5"
_tql_query() {
    local query="$1"
    local result=""

    # Parse and colorize each token
    for token in $query; do
        case "$token" in
            # Temporal: last:7d, since:monday, older:1h
            last:*|since:*|before:*|after:*|older:*|newer:*|between:*)
                result+="${C_TIME}${token}${C_NC} "
                ;;
            # Modifiers: sort:field, limit:N
            sort:*|order:*|limit:*|head:*|tail:*|offset:*)
                local mod="${token%%:*}"
                local val="${token#*:}"
                result+="${C_MOD}${mod}:${C_NC}${C_VAL}${val}${C_NC} "
                ;;
            # Filters with operators
            *=~*|*!~*|*!=*|*">"=*|*"<"=*|*">"*|*"<"*|*=*|*~*)
                # Extract field, op, value
                local field op value
                if [[ "$token" =~ ^([a-z_]+)(=~|!~|!=|>=|<=|>|<|=|~)(.+)$ ]]; then
                    field="${BASH_REMATCH[1]}"
                    op="${BASH_REMATCH[2]}"
                    value="${BASH_REMATCH[3]}"
                    result+="${C_FIELD}${field}${C_NC}${C_OP}${op}${C_NC}${C_VAL}${value}${C_NC} "
                else
                    result+="${token} "
                fi
                ;;
            *)
                result+="${token} "
                ;;
        esac
    done

    echo -e "${result% }"
}

# Main help display
tql_help() {
    local topic="${1:-}"
    _tql_help_colors "$2"

    case "$topic" in
        ""|syntax|query)
            _tql_help_syntax
            ;;
        filters|filter)
            _tql_help_filters
            ;;
        temporal|time)
            _tql_help_temporal
            ;;
        sort|order)
            _tql_help_sort
            ;;
        adapters|adapter)
            _tql_help_adapters
            ;;
        examples)
            _tql_help_examples
            ;;
        all)
            _tql_help_syntax
            echo
            _tql_help_filters
            echo
            _tql_help_temporal
            echo
            _tql_help_sort
            echo
            _tql_help_examples
            ;;
        *)
            echo -e "${C_TITLE}TQL Help Topics:${C_NC}"
            echo "  tql help           Syntax overview"
            echo "  tql help filters   Filter operators"
            echo "  tql help temporal  Time expressions"
            echo "  tql help sort      Sorting and limits"
            echo "  tql help adapters  Module adapters"
            echo "  tql help examples  Query examples"
            echo "  tql help all       Full documentation"
            ;;
    esac
}

_tql_help_syntax() {
    echo -e "${C_TITLE}TQL - Tetra Query Language${C_NC}"
    echo
    echo -e "${C_SEC}SYNTAX${C_NC}"
    echo -e "  ${C_GRAY}# Basic structure${C_NC}"
    echo -e "  $(_tql_query "FILTER FILTER... MODIFIER...")"
    echo
    echo -e "${C_SEC}COMPONENTS${C_NC}"
    echo -e "  ${C_FIELD}field${C_NC}${C_OP}=${C_NC}${C_VAL}value${C_NC}      ${C_GRAY}Filter: exact match${C_NC}"
    echo -e "  ${C_FIELD}field${C_NC}${C_OP}~${C_NC}${C_VAL}text${C_NC}       ${C_GRAY}Filter: contains${C_NC}"
    echo -e "  ${C_FIELD}field${C_NC}${C_OP}>${C_NC}${C_VAL}N${C_NC}          ${C_GRAY}Filter: greater than${C_NC}"
    echo -e "  ${C_MOD}sort:${C_NC}${C_VAL}field${C_NC}      ${C_GRAY}Modifier: sort ascending${C_NC}"
    echo -e "  ${C_MOD}limit:${C_NC}${C_VAL}N${C_NC}         ${C_GRAY}Modifier: first N results${C_NC}"
    echo -e "  ${C_TIME}last:7d${C_NC}         ${C_GRAY}Temporal: last 7 days${C_NC}"
    echo
    echo -e "${C_SEC}QUICK EXAMPLES${C_NC}"
    echo -e "  $(_tql_query "env=tetra")"
    echo -e "  $(_tql_query "port>8000 sort:port")"
    echo -e "  $(_tql_query "name~midi last:1d limit:5")"
}

_tql_help_filters() {
    echo -e "${C_SEC}FILTER OPERATORS${C_NC}"
    echo
    echo -e "  ${C_FIELD}field${C_NC}${C_OP}=${C_NC}${C_VAL}value${C_NC}      Exact match"
    echo -e "  ${C_FIELD}field${C_NC}${C_OP}!=${C_NC}${C_VAL}value${C_NC}     Not equal"
    echo -e "  ${C_FIELD}field${C_NC}${C_OP}~${C_NC}${C_VAL}text${C_NC}       Contains (case-insensitive)"
    echo -e "  ${C_FIELD}field${C_NC}${C_OP}=~${C_NC}${C_VAL}regex${C_NC}     Regex match"
    echo -e "  ${C_FIELD}field${C_NC}${C_OP}!~${C_NC}${C_VAL}regex${C_NC}     Regex not match"
    echo -e "  ${C_FIELD}field${C_NC}${C_OP}>${C_NC}${C_VAL}N${C_NC}          Greater than (numeric)"
    echo -e "  ${C_FIELD}field${C_NC}${C_OP}<${C_NC}${C_VAL}N${C_NC}          Less than (numeric)"
    echo -e "  ${C_FIELD}field${C_NC}${C_OP}>=${C_NC}${C_VAL}N${C_NC}         Greater or equal"
    echo -e "  ${C_FIELD}field${C_NC}${C_OP}<=${C_NC}${C_VAL}N${C_NC}         Less or equal"
    echo
    echo -e "${C_SEC}COMBINING FILTERS${C_NC}"
    echo -e "  ${C_GRAY}# Multiple filters = AND logic${C_NC}"
    echo -e "  $(_tql_query "env=tetra type=tcp")"
    echo -e "  $(_tql_query "port>8000 port<9000")"
}

_tql_help_temporal() {
    echo -e "${C_SEC}TEMPORAL EXPRESSIONS${C_NC}"
    echo
    echo -e "  ${C_TIME}last:7d${C_NC}          Last 7 days"
    echo -e "  ${C_TIME}last:2h${C_NC}          Last 2 hours"
    echo -e "  ${C_TIME}last:30m${C_NC}         Last 30 minutes"
    echo -e "  ${C_TIME}last:2h30m${C_NC}       Compound duration"
    echo
    echo -e "  ${C_TIME}since:monday${C_NC}     Since last Monday"
    echo -e "  ${C_TIME}since:yesterday${C_NC}  Since yesterday"
    echo -e "  ${C_TIME}since:2025-01-01${C_NC} Since specific date"
    echo
    echo -e "  ${C_TIME}before:2025-01${C_NC}   Before January 2025"
    echo -e "  ${C_TIME}older:1d${C_NC}         Older than 1 day"
    echo -e "  ${C_TIME}newer:1h${C_NC}         Newer than 1 hour"
    echo
    echo -e "${C_SEC}DURATION UNITS${C_NC}"
    echo -e "  ${C_VAL}s${C_NC} seconds  ${C_VAL}m${C_NC} minutes  ${C_VAL}h${C_NC} hours"
    echo -e "  ${C_VAL}d${C_NC} days     ${C_VAL}w${C_NC} weeks    ${C_VAL}M${C_NC} months  ${C_VAL}y${C_NC} years"
}

_tql_help_sort() {
    echo -e "${C_SEC}SORTING${C_NC}"
    echo
    echo -e "  ${C_MOD}sort:${C_NC}${C_VAL}field${C_NC}        Ascending order"
    echo -e "  ${C_MOD}sort:${C_NC}${C_VAL}field${C_NC}${C_OP}:${C_NC}${C_VAL}desc${C_NC}   Descending order"
    echo -e "  ${C_MOD}order:${C_NC}${C_VAL}field${C_NC}       Alias for sort"
    echo
    echo -e "${C_SEC}LIMITING${C_NC}"
    echo
    echo -e "  ${C_MOD}limit:${C_NC}${C_VAL}N${C_NC}           First N results"
    echo -e "  ${C_MOD}head:${C_NC}${C_VAL}N${C_NC}            First N (alias)"
    echo -e "  ${C_MOD}tail:${C_NC}${C_VAL}N${C_NC}            Last N results"
    echo -e "  ${C_MOD}offset:${C_NC}${C_VAL}N${C_NC}          Skip first N"
    echo
    echo -e "${C_SEC}EXAMPLES${C_NC}"
    echo -e "  $(_tql_query "sort:uptime")"
    echo -e "  $(_tql_query "sort:port:desc limit:10")"
    echo -e "  $(_tql_query "sort:name offset:5 limit:10")"
}

_tql_help_adapters() {
    echo -e "${C_SEC}TQL ADAPTERS${C_NC}"
    echo
    echo "  Adapters connect TQL to data sources."
    echo
    echo -e "${C_SEC}AVAILABLE ADAPTERS${C_NC}"
    echo -e "  ${C_FIELD}tsm${C_NC}    TSM process manager"
    echo -e "         Fields: id, name, env, pid, port, type, uptime"
    echo
    echo -e "${C_SEC}USAGE${C_NC}"
    echo -e "  ${C_GRAY}# Via TSM${C_NC}"
    echo -e "  ${C_EX}tsm ls -q${C_NC} '$(_tql_query "env=tetra sort:uptime")'"
    echo
    echo -e "  ${C_GRAY}# Direct pipe${C_NC}"
    echo -e "  ${C_EX}echo \"\$data\" | tql_tsm_query${C_NC} '$(_tql_query "port>8000")'"
    echo
    echo -e "${C_SEC}CREATE ADAPTER${C_NC}"
    echo "  Copy: bash/tql/adapters/_template.sh"
    echo "  Define: field mappings, filter logic"
}

_tql_help_examples() {
    echo -e "${C_SEC}TQL EXAMPLES${C_NC}"
    echo
    echo -e "  ${C_GRAY}# Filter by environment${C_NC}"
    echo -e "  $(_tql_query "env=tetra")"
    echo
    echo -e "  ${C_GRAY}# Fuzzy name match${C_NC}"
    echo -e "  $(_tql_query "name~midi")"
    echo
    echo -e "  ${C_GRAY}# Port range${C_NC}"
    echo -e "  $(_tql_query "port>8000 port<9000")"
    echo
    echo -e "  ${C_GRAY}# Type filter with sort${C_NC}"
    echo -e "  $(_tql_query "type=udp sort:name")"
    echo
    echo -e "  ${C_GRAY}# Recent items, sorted${C_NC}"
    echo -e "  $(_tql_query "last:1h sort:uptime:desc")"
    echo
    echo -e "  ${C_GRAY}# Top 5 by port${C_NC}"
    echo -e "  $(_tql_query "sort:port:desc limit:5")"
    echo
    echo -e "  ${C_GRAY}# Complex query${C_NC}"
    echo -e "  $(_tql_query "env=tetra type=tcp port>8000 sort:uptime limit:10")"
}

# Export functions
export -f tql_help
export -f _tql_query

# CLI interface
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    tql_help "$@"
fi
