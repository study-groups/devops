#!/usr/bin/env bash
# Chroma - Line classification/parsing
# Part of the chroma modular markdown renderer

# Classify a single line - sets _CHROMA_RESULT to "type:level:content"
# Uses global state for code blocks (can't use subshell)
_chroma_classify() {
    local line="$1"

    # Code fence start/end
    if [[ "$line" =~ ^\`\`\`(.*)$ ]]; then
        local lang="${BASH_REMATCH[1]}"
        if (( _CHROMA_IN_CODE )); then
            _CHROMA_IN_CODE=0
            _CHROMA_RESULT="code.end::"
        else
            _CHROMA_IN_CODE=1
            _CHROMA_CODE_LANG="$lang"
            _CHROMA_RESULT="code.start:$lang:"
        fi
        return
    fi

    # Inside code block
    if (( _CHROMA_IN_CODE )); then
        _CHROMA_RESULT="code.line::$line"
        return
    fi

    # Empty line
    if [[ -z "$line" ]]; then
        _CHROMA_RESULT="blank::"
        return
    fi

    # Heading (ATX style: # ## ### etc)
    if [[ "$line" =~ ^(#{1,6})\ +(.*)$ ]]; then
        local level=${#BASH_REMATCH[1]}
        local content="${BASH_REMATCH[2]}"
        _CHROMA_RESULT="heading:$level:$content"
        return
    fi

    # Horizontal rule (but not table separator)
    if [[ "$line" =~ ^[-*_]{3,}\ *$ ]] && [[ ! "$line" =~ ^\| ]]; then
        _CHROMA_RESULT="hr::"
        return
    fi

    # Table row (starts with |)
    if [[ "$line" =~ ^\|.*\|$ ]]; then
        # Check if it's a separator row - only contains |, -, :, and spaces
        local stripped="${line//[|:[:space:]-]/}"
        if [[ -z "$stripped" ]]; then
            _CHROMA_RESULT="table.sep::$line"
        else
            _CHROMA_RESULT="table.row::$line"
        fi
        return
    fi

    # Blockquote
    if [[ "$line" =~ ^\>\ ?(.*)$ ]]; then
        _CHROMA_RESULT="quote::${BASH_REMATCH[1]}"
        return
    fi

    # Bullet list (- or * or +)
    if [[ "$line" =~ ^[\ ]*[-*+]\ +(.*)$ ]]; then
        _CHROMA_RESULT="list.bullet::${BASH_REMATCH[1]}"
        return
    fi

    # Numbered list - preserve the number
    if [[ "$line" =~ ^[\ ]*([0-9]+)\.\ +(.*)$ ]]; then
        local num="${BASH_REMATCH[1]}"
        local content="${BASH_REMATCH[2]}"
        _CHROMA_RESULT="list.number:$num:$content"
        return
    fi

    # Regular paragraph text
    _CHROMA_RESULT="text::$line"
}
