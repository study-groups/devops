#!/usr/bin/env bash
# spaces_tree.sh - Help tree for Spaces REPL
# Provides hierarchical command structure for completion and help

# Ensure tree system is available
if [[ -f "$TETRA_SRC/bash/tree/core.sh" ]]; then
    source "$TETRA_SRC/bash/tree/core.sh"
else
    echo "Warning: tree system not available" >&2
    return 1
fi

# Initialize spaces help tree
spaces_tree_init() {
    # Root
    tree_node "help.spaces" "group" "Spaces REPL commands"

    # Navigation commands
    tree_node "help.spaces.use" "command" "Set current bucket/path context"
    tree_attr "help.spaces.use" "completion_fn" "spaces_completion_buckets"
    tree_attr "help.spaces.use" "usage" "use <bucket> [path]"
    tree_attr "help.spaces.use" "examples" "use pja-games|use pja-games games/"

    tree_node "help.spaces.cd" "command" "Change path within bucket"
    tree_attr "help.spaces.cd" "usage" "cd <path>"
    tree_attr "help.spaces.cd" "examples" "cd games/|cd ..|cd ."

    # File operations
    tree_node "help.spaces.ls" "command" "List files in bucket/path"
    tree_attr "help.spaces.ls" "usage" "ls [path]"
    tree_attr "help.spaces.ls" "examples" "ls|ls games/|ls pja-games:docs/"

    tree_node "help.spaces.get" "command" "Download file from bucket"
    tree_attr "help.spaces.get" "usage" "get <path> [dest]"
    tree_attr "help.spaces.get" "examples" "get manifest.json|get games.json -|get config.json ./local.json"

    tree_node "help.spaces.put" "command" "Upload file to bucket"
    tree_attr "help.spaces.put" "usage" "put <file> [path] [options]"
    tree_attr "help.spaces.put" "examples" "put index.html|put app.js games/app.js --acl public-read"

    tree_node "help.spaces.rm" "command" "Delete file from bucket"
    tree_attr "help.spaces.rm" "usage" "rm <path>"
    tree_attr "help.spaces.rm" "examples" "rm old-file.json|rm games/obsolete.js"

    tree_node "help.spaces.sync" "command" "Sync directory with bucket"
    tree_attr "help.spaces.sync" "usage" "sync <source> <dest> [options]"
    tree_attr "help.spaces.sync" "examples" "sync ./dist games/|sync games/ ./backup --delete"

    tree_node "help.spaces.url" "command" "Get public URL for file"
    tree_attr "help.spaces.url" "usage" "url <path>"
    tree_attr "help.spaces.url" "examples" "url manifest.json|url games/index.html"

    # Utilities
    tree_node "help.spaces.status" "command" "Show session status"
    tree_attr "help.spaces.status" "usage" "status"

    tree_node "help.spaces.help" "command" "Show help"
    tree_attr "help.spaces.help" "usage" "help"

    tree_node "help.spaces.exit" "command" "Exit REPL"
    tree_attr "help.spaces.exit" "usage" "exit"

    # Aliases
    tree_node "help.spaces.list" "alias" "Alias for ls"
    tree_attr "help.spaces.list" "target" "help.spaces.ls"

    tree_node "help.spaces.download" "alias" "Alias for get"
    tree_attr "help.spaces.download" "target" "help.spaces.get"

    tree_node "help.spaces.upload" "alias" "Alias for put"
    tree_attr "help.spaces.upload" "target" "help.spaces.put"

    tree_node "help.spaces.delete" "alias" "Alias for rm"
    tree_attr "help.spaces.delete" "target" "help.spaces.rm"

    tree_node "help.spaces.link" "alias" "Alias for url"
    tree_attr "help.spaces.link" "target" "help.spaces.url"

    tree_node "help.spaces.quit" "alias" "Alias for exit"
    tree_attr "help.spaces.quit" "target" "help.spaces.exit"

    tree_node "help.spaces.q" "alias" "Alias for exit"
    tree_attr "help.spaces.q" "target" "help.spaces.exit"
}

# Export
export -f spaces_tree_init
