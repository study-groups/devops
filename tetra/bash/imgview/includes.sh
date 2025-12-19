#!/usr/bin/env bash
# imgview module - Image viewer with reorder, rename, delete
# Requires: python3

MOD_SRC="${TETRA_SRC}/bash/imgview"

imgview() {
    local port="${1:-0}"
    local dir="${2:-.}"
    python3 "$MOD_SRC/server.py" "$port" "$dir"
}

imgview_help() {
    cat <<EOF
imgview - PNG Image Viewer Server

Usage:
  imgview [PORT] [DIRECTORY]

Arguments:
  PORT       Port or range start (default: auto 5000-5099)
             0     = auto 5000+
             3000  = auto 3000+ (node range)
             4000  = auto 4000+ (tetra range)
             8000  = auto 8000+ (python/http range)
             8080  = exact port 8080
  DIRECTORY  Directory to serve images from (default: .)

Port Ranges:
  3000-3099  Node services
  4000-4099  Tetra services
  5000-5099  Default/misc
  8000-8099  Python http.server / HTTP

Features:
  - Carousel view sorted by creation date
  - Rename: click filename
  - Delete: moves to tmp/ directory
  - Reorder: drag and drop in sidebar
  - Empty Trash: permanently delete tmp/ files

Keyboard:
  Left/Right  Navigate images
  f           Toggle fullscreen
  Delete      Move current image to trash

Example:
  imgview              # Auto 5000+, current dir
  imgview 8000         # Auto 8000+, current dir
  imgview 8080 ~/pics  # Exact port, specific dir
EOF
}
