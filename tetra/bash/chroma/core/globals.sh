#!/usr/bin/env bash
# Chroma - Global declarations and state variables
# Part of the chroma modular markdown renderer

# Current theme name
declare -g CHROMA_THEME="default"

# State for multi-line parsing
declare -g _CHROMA_IN_CODE=0
declare -g _CHROMA_CODE_LANG=""
declare -g _CHROMA_RESULT=""

# Table state
declare -g _CHROMA_IN_TABLE=0
declare -ga _CHROMA_TABLE_ROWS=()
declare -ga _CHROMA_TABLE_ALIGNS=()
declare -ga _CHROMA_TABLE_WIDTHS=()

# Token mapping: element type → TDS token
declare -gA CHROMA_TOKENS=(
    [heading.1]="content.heading.h1"
    [heading.2]="content.heading.h2"
    [heading.3]="content.heading.h3"
    [heading.4]="content.heading.h4"
    [code.block]="content.code.block"
    [code.inline]="content.code.inline"
    [code.fence]="content.code.fence"
    [list.bullet]="content.list"
    [list.number]="content.list"
    [quote]="content.quote"
    [bold]="content.emphasis.strong"
    [italic]="content.emphasis.em"
    [link]="content.link"
    [hr]="ui.border"
    [text]="text.primary"
    [table.border]="ui.border"
    [table.header]="content.heading.h3"
    [table.cell]="text.primary"
    # Pattern tokens for structured list items
    [pattern.number]="pattern.number"
    [pattern.topic]="pattern.topic"
    [pattern.dash]="pattern.dash"
    [pattern.desc]="pattern.desc"
    [pattern.key]="pattern.key"
    [pattern.value]="pattern.value"
    [pattern.time]="pattern.time"
)

# Pattern detection enabled by default
declare -g CHROMA_PATTERNS_ENABLED=1

# Truncate mode: when 1, pattern lists show only header line
# When 0 (default), show header + full wrapped content
declare -g CHROMA_TRUNCATE=0
