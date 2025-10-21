#!/usr/bin/env bash
# cdp_paths.sh - Path management for CDP module (TCS 3.0 compliant)

# Module source (strong global)
: "${CDP_SRC:=$TETRA_SRC/bash/rag/cdp}"

# Module runtime directory
: "${CDP_DIR:=$TETRA_DIR/cdp}"

# Database directory
cdp_get_db_dir() {
    echo "$CDP_DIR/db"
}

# Config directory
cdp_get_config_dir() {
    echo "$CDP_DIR/config"
}

# Logs directory
cdp_get_logs_dir() {
    echo "$CDP_DIR/logs"
}

# Cache directory (for screenshots, traces, etc.)
cdp_get_cache_dir() {
    echo "$CDP_DIR/cache"
}

# Timestamp generation (1-second resolution)
cdp_generate_timestamp() {
    date +%s
}

# Timestamped path construction for database files
cdp_get_db_path() {
    local timestamp="$1"
    local extension="$2"
    echo "$(cdp_get_db_dir)/${timestamp}.${extension}"
}

# Get CDP screenshot path
cdp_get_db_screenshot_path() {
    local timestamp="$1"
    echo "$(cdp_get_db_dir)/${timestamp}.cdp.screenshot.png"
}

# Get CDP trace path
cdp_get_db_trace_path() {
    local timestamp="$1"
    echo "$(cdp_get_db_dir)/${timestamp}.cdp.trace.json"
}

# Get CDP action log path
cdp_get_db_action_path() {
    local timestamp="$1"
    echo "$(cdp_get_db_dir)/${timestamp}.cdp.action.json"
}

# Get CDP page HTML path
cdp_get_db_html_path() {
    local timestamp="$1"
    echo "$(cdp_get_db_dir)/${timestamp}.cdp.page.html"
}

# Get CDP metadata path
cdp_get_db_meta_path() {
    local timestamp="$1"
    echo "$(cdp_get_db_dir)/${timestamp}.cdp.meta.json"
}

# Get CDP session state path
cdp_get_session_state() {
    echo "$(cdp_get_config_dir)/session.state"
}

# Get CDP session log path
cdp_get_db_session_path() {
    local timestamp="$1"
    echo "$(cdp_get_db_dir)/${timestamp}.session.json"
}

# Get profiles directory
cdp_get_profiles_dir() {
    echo "$CDP_SRC/profiles"
}

# Get user profiles directory
cdp_get_user_profiles_dir() {
    echo "$CDP_DIR/profiles"
}

# Initialize CDP directories
cdp_init_dirs() {
    mkdir -p "$(cdp_get_db_dir)"
    mkdir -p "$(cdp_get_config_dir)"
    mkdir -p "$(cdp_get_logs_dir)"
    mkdir -p "$(cdp_get_cache_dir)"
    mkdir -p "$(cdp_get_user_profiles_dir)"
}

# Export functions
export -f cdp_get_db_dir
export -f cdp_get_config_dir
export -f cdp_get_logs_dir
export -f cdp_get_cache_dir
export -f cdp_generate_timestamp
export -f cdp_get_db_path
export -f cdp_get_db_screenshot_path
export -f cdp_get_db_trace_path
export -f cdp_get_db_action_path
export -f cdp_get_db_html_path
export -f cdp_get_db_meta_path
export -f cdp_get_session_state
export -f cdp_get_db_session_path
export -f cdp_get_profiles_dir
export -f cdp_get_user_profiles_dir
export -f cdp_init_dirs
