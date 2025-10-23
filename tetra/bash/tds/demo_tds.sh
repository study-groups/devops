#!/usr/bin/env bash

# TDS Demo Script
# Demonstrates all TDS capabilities

# Load TDS
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/tds.sh"

clear

# Header
tds_panel_section_header "TDS - Tetra Design System Demo" "Version $TDS_VERSION"
tds_vspace md

# Status indicators
echo "Status Indicators:"
tds_hspace md
tds_status "success" "Operation completed successfully"
echo
tds_hspace md
tds_status "error" "Connection failed"
echo
tds_hspace md
tds_status "warning" "Disk space low"
echo
tds_hspace md
tds_status "info" "New update available"
echo
tds_hspace md
tds_status "pending" "Processing request..."
echo
tds_vspace md

# Environment and mode badges
echo "Environment & Mode Badges:"
tds_hspace md
echo -n "Environments: "
tds_env_badge "local"
echo -n " "
tds_env_badge "dev"
echo -n " "
tds_env_badge "staging"
echo -n " "
tds_env_badge "prod"
echo -n " "
tds_env_badge "qa"
echo
tds_hspace md
echo -n "Modes: "
tds_mode_badge "config"
echo -n " "
tds_mode_badge "service"
echo -n " "
tds_mode_badge "deploy"
echo -n " "
tds_mode_badge "keys"
echo
tds_vspace md

# Success panel
tds_panel_success "Deployment Successful" "Build #1234 deployed to staging"
tds_vspace sm

# Error panel
tds_panel_error "Connection Failed" "Timeout after 30s"
tds_vspace sm

# Info panel
tds_panel_info "System Information" \
    "  Hostname: tetra-prod-01" \
    "  Uptime: 42 days" \
    "  Load: 0.45, 0.52, 0.48"
tds_vspace sm

# Dashboard panel
tds_panel_dashboard "prod" "service" \
    "$(tds_status "success" "nginx: active")" \
    "$(tds_status "success" "postgresql: active")" \
    "$(tds_status "error" "redis: inactive")" \
    "$(tds_status "warning" "disk: 85% used")"
tds_vspace sm

# Code block panel
tds_panel_code "Recent Logs" \
    "2025-01-21 20:15:32 INFO  Application started" \
    "2025-01-21 20:15:33 INFO  Database connected" \
    "2025-01-21 20:15:34 WARN  Cache miss rate: 15%" \
    "2025-01-21 20:15:35 ERROR Connection timeout"
tds_vspace md

# Borders demonstration
echo "Border Styles:"
tds_vspace sm
tds_panel_header "Double Border (Formal)" 40 "double"
tds_vspace sm
tds_panel_header "Simple Border (Casual)" 40 "simple"
tds_vspace md

# Horizontal rules
echo "Horizontal Rules:"
tds_hr 60 "─"
tds_hr 60 "="
tds_hr 60 "━"
tds_vspace md

# Text alignment
echo "Text Alignment (ANSI-aware):"
colored_text=$(tds_color "primary" "Colored Text")
tds_border_top 50 "simple"
tds_border_line "$colored_text" 50 "left" "simple"
tds_border_line "$colored_text" 50 "center" "simple"
tds_border_line "$colored_text" 50 "right" "simple"
tds_border_bottom 50 "simple"
tds_vspace md

# Color showcase
echo "Full Color Token Showcase:"
tds_show_semantic_colors

# Footer
tds_vspace lg
tds_hr 70 "═"
echo "TDS Demo Complete - All features demonstrated"
tds_hr 70 "═"
