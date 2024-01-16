#!/bin/bash

# Function to aggressively unset all non-essential bash variables
bash-init() {
    # Save the current PATH
    local original_path=$PATH

    # List of essential system variables to preserve
    local preserve_vars="BASH|EUID|HOSTTYPE|\
MACHTYPE|OSTYPE|PWD|SHLVL|UID|_|PPID|SHELLOPTS"

    # List of additional Bash managed variables to preserve
    # put on multiple lines for readability
    # (note that BASH_VERSION is not included in this list)
    # (note that BASH_* are not included in this list)
    # 
    local bash_managed_vars="BASH_ARGC|BASH_ARGV|BASH_LINENO|BASH_SOURCE|BASH_VERSINFO"

    # Unset all non-essential variables

    for var in $(compgen -v); do
        # Skip essential and Bash managed variables
        if [[ "$preserve_vars" =~ $var ]] || [[ "$bash_managed_vars" =~ $var ]]; then
            continue
        fi

        # Unset variables that are not readonly and not in the preserve list
        if declare -p $var 2> /dev/null | grep -qv 'declare -[a-zA-Z]*r'; then
            unset $var
        fi
    done

    # Restore the original PATH
    PATH=$original_path
}

# Define other nh- functions here
