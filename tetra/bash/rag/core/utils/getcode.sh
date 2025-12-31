#!/usr/bin/env bash
# getcode.sh - Extract code blocks from markdown
#
# Usage:
#   echo "$markdown" | getcode [OPTIONS] [LANG] [INDEX]
#
# Options:
#   --list, -l    List available code blocks with languages
#   --raw         Don't strip language from opening fence
#
# Arguments:
#   LANG   Language filter (bash, python, go, etc). Case insensitive.
#          Aliases: sh->bash
#   INDEX  Block number (1-based). Default: 1. Use "all" for all blocks.
#
# Examples:
#   getcode              # First code block (any language)
#   getcode 2            # Second code block
#   getcode all          # All code blocks
#   getcode bash         # First bash/sh block
#   getcode bash 2       # Second bash block
#   getcode --list       # Show: "1:bash 2:python 3:"
#   getcode -l           # Same as --list

getcode() {
    local list_mode=false
    local raw_mode=false
    local lang_filter=""
    local index=1

    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --list|-l)
                list_mode=true
                shift
                ;;
            --raw)
                raw_mode=true
                shift
                ;;
            all)
                index="all"
                shift
                ;;
            [0-9]*)
                index="$1"
                shift
                ;;
            *)
                # Treat as language filter
                lang_filter="${1,,}"  # lowercase
                shift
                ;;
        esac
    done

    # Normalize language aliases
    case "$lang_filter" in
        sh) lang_filter="bash" ;;
        js) lang_filter="javascript" ;;
        ts) lang_filter="typescript" ;;
        py) lang_filter="python" ;;
    esac

    local count=0
    local match_count=0
    local collecting=false
    local block=""
    local current_lang=""
    local blocks=()
    local langs=()

    while IFS= read -r line || [[ -n "$line" ]]; do
        if [[ "$line" =~ ^\`\`\`([a-zA-Z0-9_-]*) ]]; then
            if [[ "$collecting" == true ]]; then
                # End of code block
                ((count++))
                blocks+=("$block")
                langs+=("$current_lang")
                block=""
                collecting=false
                current_lang=""
            else
                # Start of code block
                collecting=true
                current_lang="${BASH_REMATCH[1],,}"  # lowercase
                block=""

                # Normalize captured language
                case "$current_lang" in
                    sh) current_lang="bash" ;;
                    js) current_lang="javascript" ;;
                    ts) current_lang="typescript" ;;
                    py) current_lang="python" ;;
                esac
            fi
        elif [[ "$collecting" == true ]]; then
            block+="$line"$'\n'
        fi
    done

    # Handle unclosed block at end of input
    if [[ "$collecting" == true && -n "$block" ]]; then
        ((count++))
        blocks+=("$block")
        langs+=("$current_lang")
    fi

    # List mode
    if [[ "$list_mode" == true ]]; then
        for i in "${!blocks[@]}"; do
            local num=$((i + 1))
            local lang="${langs[$i]}"
            [[ -z "$lang" ]] && lang="(none)"
            echo "$num:$lang"
        done
        return 0
    fi

    # Filter and output
    for i in "${!blocks[@]}"; do
        local num=$((i + 1))
        local lang="${langs[$i]}"
        local block_content="${blocks[$i]}"

        # Apply language filter
        if [[ -n "$lang_filter" && "$lang" != "$lang_filter" ]]; then
            continue
        fi

        ((match_count++))

        if [[ "$index" == "all" ]]; then
            printf '%s' "$block_content"
        elif [[ "$match_count" -eq "$index" ]]; then
            printf '%s' "$block_content"
            return 0
        fi
    done

    if [[ "$index" != "all" && "$match_count" -lt "$index" ]]; then
        if [[ -n "$lang_filter" ]]; then
            echo "Code block #$index with language '$lang_filter' not found (found $match_count)" >&2
        else
            echo "Code block #$index not found (found $match_count)" >&2
        fi
        return 1
    fi

    return 0
}
