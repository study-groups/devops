#!/usr/bin/env bash

# Test MSC library standalone

# Source tetra environment
source ~/tetra/tetra.sh

# Source MSC
source "$TETRA_SRC/bash/msc/includes.sh"

echo "Testing MSC Library..."
echo ""

# Initialize with test entities
msc_init "User" "REPL" "UserSystem" "Validator" "Database" "API" "Server"

# Simulate user creation flow
msc_message "User" "REPL" "user new mike"
msc_message "REPL" "UserSystem" "game_user_new(mike)"
msc_message "UserSystem" "Validator" "validate_username(mike)"
msc_message "Validator" "UserSystem" "OK"
msc_message "UserSystem" "Database" "write_user_record()"
msc_note "Database" "Writing TOML to disk"
msc_message "Database" "UserSystem" "OK (ID: 1760230000)"
msc_message "UserSystem" "API" "POST /api/users/create"
msc_message "API" "Server" "HTTP POST"
msc_message "Server" "API" "200 OK + user_data"
msc_message "API" "UserSystem" "user_data"
msc_message "UserSystem" "REPL" "success (ID: 1760230000)"
msc_message "REPL" "User" "✓ Account created"

# Render
msc_render

echo ""
echo "✓ MSC test complete"
echo ""
