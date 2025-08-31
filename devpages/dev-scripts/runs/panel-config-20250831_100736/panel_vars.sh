#!/bin/bash
# Panel Configuration Variables
# Generated: Sun Aug 31 10:07:36 PDT 2025
# Source: Scanned panel files

# Panel Arrays
declare -a PANEL_FILES=(
    "client/panels/dev/FileBrowserPanel.js"
    "client/panels/pdata/components/PDataAuthPanel.js"
    "client/panels/BasePanel.js"
    "client/panels/settings/ThemePanel.js"
    "client/panels/UIInspectorPanel.js"
    "client/panels/publish/PublishPanel.js"
    "client/panels/DiagnosticPanel.js"
)

declare -A PANEL_CLASSES=(
    ["FileBrowserPanel"]="FileBrowserPanel"
    ["PDataAuthPanel"]="PDataAuthPanel"
    ["BasePanel"]="for"
    ["ThemePanel"]="ThemePanel"
    ["UIInspectorPanel"]="UIInspectorPanel"
    ["PublishPanel"]="PublishPanel"
    ["DiagnosticPanel"]="DiagnosticPanel"
)

declare -A PANEL_TITLES=(
    ["FileBrowserPanel"]="FileBrowserPanel"
    ["PDataAuthPanel"]="PDataAuthPanel"
    ["BasePanel"]="for"
    ["ThemePanel"]="ThemePanel"
    ["UIInspectorPanel"]="UIInspectorPanel"
    ["PublishPanel"]="PublishPanel"
    ["DiagnosticPanel"]="DiagnosticPanel"
)

declare -A PANEL_TYPES=(
    ["FileBrowserPanel"]="development"
    ["PDataAuthPanel"]="data"
    ["BasePanel"]="core"
    ["ThemePanel"]="settings"
    ["UIInspectorPanel"]="core"
    ["PublishPanel"]="publish"
    ["DiagnosticPanel"]="core"
)

# Helper functions
get_panel_class() {
    local panel_name="$1"
    echo "${PANEL_CLASSES[$panel_name]}"
}

get_panel_title() {
    local panel_name="$1"
    echo "${PANEL_TITLES[$panel_name]}"
}

get_panel_type() {
    local panel_name="$1"
    echo "${PANEL_TYPES[$panel_name]}"
}

list_panels() {
    printf "%-25s | %-20s | %-25s | %s\n" "NAME" "CLASS" "TITLE" "TYPE"
    printf "%-25s-+-%-20s-+-%-25s-+-%s\n" "-------------------------" "--------------------" "-------------------------" "---------------"
    for panel_file in "${PANEL_FILES[@]}"; do
        panel_name=$(basename "$panel_file" .js)
        printf "%-25s | %-20s | %-25s | %s\n" "$panel_name" "${PANEL_CLASSES[$panel_name]}" "${PANEL_TITLES[$panel_name]}" "${PANEL_TYPES[$panel_name]}"
    done
}

list_panels_by_type() {
    local type="$1"
    echo "Panels of type: $type"
    for panel_file in "${PANEL_FILES[@]}"; do
        panel_name=$(basename "$panel_file" .js)
        if [ "${PANEL_TYPES[$panel_name]}" = "$type" ]; then
            echo "  $panel_name - ${PANEL_TITLES[$panel_name]}"
        fi
    done
}

# Usage examples:
# list_panels
# list_panels_by_type "settings"
# get_panel_title "BasePanel"
# get_panel_class "ThemePanel"
