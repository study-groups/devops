#!/usr/bin/env bash

# TUI Component System - Game-like Architecture
# Phase 2: Component lifecycle management with render optimization

# Component registry
declare -A COMPONENTS=()
declare -A COMPONENT_STATE=()
declare -A COMPONENT_PROPS=()

# Component lifecycle states
declare -r COMPONENT_UNMOUNTED="unmounted"
declare -r COMPONENT_MOUNTED="mounted"
declare -r COMPONENT_UPDATING="updating"
declare -r COMPONENT_ERROR="error"

# Base component interface
component_mount() {
    local component_id="$1"
    local component_type="$2"

    COMPONENTS[$component_id]="$component_type"
    COMPONENT_STATE[$component_id]="$COMPONENT_MOUNTED"

    # Call component-specific mount function
    local mount_func="${component_type}_mount"
    if declare -F "$mount_func" >/dev/null; then
        "$mount_func" "$component_id"
    fi

    mark_component_dirty "$component_id"
    log_action "Component: $component_id ($component_type) mounted"
}

component_update() {
    local component_id="$1"
    shift
    local props=("$@")

    # Skip if not mounted
    if [[ "${COMPONENT_STATE[$component_id]}" != "$COMPONENT_MOUNTED" ]]; then
        return 0
    fi

    COMPONENT_STATE[$component_id]="$COMPONENT_UPDATING"
    COMPONENT_PROPS[$component_id]="${props[*]}"

    # Call component-specific update function
    local component_type="${COMPONENTS[$component_id]}"
    local update_func="${component_type}_update"
    if declare -F "$update_func" >/dev/null; then
        "$update_func" "$component_id" "${props[@]}"
    fi

    COMPONENT_STATE[$component_id]="$COMPONENT_MOUNTED"
    mark_component_dirty "$component_id"
    log_action "Component: $component_id updated"
}

component_render() {
    local component_id="$1"

    # Skip if not mounted or already clean
    if [[ "${COMPONENT_STATE[$component_id]}" != "$COMPONENT_MOUNTED" ]]; then
        return 0
    fi

    if [[ "${COMPONENT_DIRTY[$component_id]}" != "true" ]]; then
        return 0
    fi

    # Call component-specific render function
    local component_type="${COMPONENTS[$component_id]}"
    local render_func="${component_type}_render"
    if declare -F "$render_func" >/dev/null; then
        "$render_func" "$component_id"
    fi

    log_action "Component: $component_id rendered"
}

component_unmount() {
    local component_id="$1"

    if [[ -z "${COMPONENTS[$component_id]}" ]]; then
        return 0
    fi

    # Call component-specific unmount function
    local component_type="${COMPONENTS[$component_id]}"
    local unmount_func="${component_type}_unmount"
    if declare -F "$unmount_func" >/dev/null; then
        "$unmount_func" "$component_id"
    fi

    # Clean up component data
    unset COMPONENTS[$component_id]
    unset COMPONENT_STATE[$component_id]
    unset COMPONENT_PROPS[$component_id]
    unset COMPONENT_DIRTY[$component_id]

    log_action "Component: $component_id unmounted"
}

# Header Component Implementation
HeaderComponent_mount() {
    local component_id="$1"
    log_action "HeaderComponent: Mounted $component_id"
}

HeaderComponent_update() {
    local component_id="$1"
    local env_index="$2"
    local mode_index="$3"
    local action_index="$4"

    # Store props for render
    COMPONENT_PROPS[$component_id]="$env_index $mode_index $action_index"
}

HeaderComponent_render() {
    local component_id="$1"
    local props=(${COMPONENT_PROPS[$component_id]})
    local env_index="${props[0]}"
    local mode_index="${props[1]}"
    local action_index="${props[2]}"

    # Save current state
    local old_env_index=$ENV_INDEX
    local old_mode_index=$MODE_INDEX
    local old_action_index=$ACTION_INDEX

    # Set state for rendering
    ENV_INDEX=$env_index
    MODE_INDEX=$mode_index
    ACTION_INDEX=$action_index

    # Build header in back buffer
    build_header_component

    # Restore state
    ENV_INDEX=$old_env_index
    MODE_INDEX=$old_mode_index
    ACTION_INDEX=$old_action_index
}

HeaderComponent_unmount() {
    local component_id="$1"
    log_action "HeaderComponent: Unmounted $component_id"
}

# Content Component Implementation
ContentComponent_mount() {
    local component_id="$1"
    log_action "ContentComponent: Mounted $component_id"
}

ContentComponent_update() {
    local component_id="$1"
    local content="$2"
    local view_mode="$3"

    COMPONENT_PROPS[$component_id]="$view_mode"
    # Store content separately to handle multiline
    eval "CONTENT_${component_id}=\$content"
}

ContentComponent_render() {
    local component_id="$1"
    local view_mode="${COMPONENT_PROPS[$component_id]}"

    # Get stored content
    local content_var="CONTENT_${component_id}"
    local content="${!content_var}"

    # Save current state
    local old_content="$CONTENT"
    local old_content_mode="$CONTENT_MODE"

    # Set state for rendering
    CONTENT="$content"
    CONTENT_MODE="$view_mode"

    # Build content in back buffer
    build_content_component

    # Restore state
    CONTENT="$old_content"
    CONTENT_MODE="$old_content_mode"
}

ContentComponent_unmount() {
    local component_id="$1"
    # Clean up stored content
    unset "CONTENT_${component_id}"
    log_action "ContentComponent: Unmounted $component_id"
}

# Footer Component Implementation
FooterComponent_mount() {
    local component_id="$1"
    log_action "FooterComponent: Mounted $component_id"
}

FooterComponent_update() {
    local component_id="$1"
    local footer_content="$2"

    # Store footer content separately
    eval "FOOTER_${component_id}=\$footer_content"
}

FooterComponent_render() {
    local component_id="$1"

    # Get stored footer content
    local footer_var="FOOTER_${component_id}"
    local footer_content="${!footer_var}"

    # Save current state
    local old_footer_content="$FOOTER_CONTENT"

    # Set state for rendering
    FOOTER_CONTENT="$footer_content"

    # Build footer in back buffer
    build_footer_component

    # Restore state
    FOOTER_CONTENT="$old_footer_content"
}

FooterComponent_unmount() {
    local component_id="$1"
    # Clean up stored footer content
    unset "FOOTER_${component_id}"
    log_action "FooterComponent: Unmounted $component_id"
}

# REPL Component Implementation
ReplComponent_mount() {
    local component_id="$1"
    log_action "ReplComponent: Mounted $component_id"
}

ReplComponent_update() {
    local component_id="$1"
    local input="$2"
    local cursor_pos="$3"
    local mode="$4"

    COMPONENT_PROPS[$component_id]="$input $cursor_pos $mode"
}

ReplComponent_render() {
    local component_id="$1"
    local props=(${COMPONENT_PROPS[$component_id]})
    local input="${props[0]}"
    local cursor_pos="${props[1]}"
    local mode="${props[2]}"

    # Save current state
    local old_input="$REPL_INPUT"
    local old_cursor_pos="$REPL_CURSOR_POS"
    local old_mode="$CURRENT_INPUT_MODE"

    # Set state for rendering
    REPL_INPUT="$input"
    REPL_CURSOR_POS="$cursor_pos"
    CURRENT_INPUT_MODE="$mode"

    # Build REPL in back buffer
    build_repl_component

    # Restore state
    REPL_INPUT="$old_input"
    REPL_CURSOR_POS="$old_cursor_pos"
    CURRENT_INPUT_MODE="$old_mode"
}

ReplComponent_unmount() {
    local component_id="$1"
    log_action "ReplComponent: Unmounted $component_id"
}

# High-level component management functions
mount_default_components() {
    component_mount "header" "HeaderComponent"
    component_mount "content" "ContentComponent"
    component_mount "footer" "FooterComponent"

    # REPL component is mounted/unmounted dynamically
}

update_all_components() {
    # Update header with current navigation state
    component_update "header" "$ENV_INDEX" "$MODE_INDEX" "$ACTION_INDEX"

    # Update content with current content and mode
    component_update "content" "$CONTENT" "$CONTENT_MODE"

    # Update footer with current footer content
    component_update "footer" "$FOOTER_CONTENT"

    # Update REPL if mounted
    if [[ -n "${COMPONENTS[repl]}" && "$CURRENT_INPUT_MODE" == "$INPUT_MODE_REPL" ]]; then
        component_update "repl" "$REPL_INPUT" "$REPL_CURSOR_POS" "$CURRENT_INPUT_MODE"
    fi
}

render_all_components() {
    # Render in dependency order
    component_render "header"
    component_render "content"
    component_render "footer"
    component_render "repl"
}

# Mount REPL component when entering REPL mode
mount_repl_component() {
    if [[ -z "${COMPONENTS[repl]}" ]]; then
        component_mount "repl" "ReplComponent"
    fi
}

# Unmount REPL component when leaving REPL mode
unmount_repl_component() {
    if [[ -n "${COMPONENTS[repl]}" ]]; then
        component_unmount "repl"
    fi
}

# Component system debug
show_component_status() {
    echo "Mounted Components:"
    for component_id in "${!COMPONENTS[@]}"; do
        local component_type="${COMPONENTS[$component_id]}"
        local state="${COMPONENT_STATE[$component_id]}"
        local dirty="${COMPONENT_DIRTY[$component_id]:-false}"
        echo "  $component_id ($component_type): $state, dirty=$dirty"
    done
}