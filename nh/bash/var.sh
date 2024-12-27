nh_make_short_vars() {
    local count
    local newvar
    local varname
    local varvalue

    # Debug flag (set to "true" to enable debugging)
    local dbg=false

    # Ignore list
    local ignorelist=("ignorelist" "IFS" "_"
          "count" "newvar" "varname" "varvalue"
          "_comp_dequote__regex_safe_word"
          "_comp_backup_glob"
          "_backup_glob")

    # Function to check if a variable should be ignored
    shouldignore() {
        local name="$1"
        local value="$2"
        [[ -z "$name" || -z "$value" ]] && return 0
        [[ "$name" =~ ^[A-Z] ]] && return 0
        for ignore_item in "${ignorelist[@]}"; do
            [[ "$name" == "$ignore_item" ]] && return 0
        done
        return 1
    }

    # Function to log debug messages
    debug() {
        [[ "$dbg" == "true" ]] && echo "$@" >&2
    }

    debug "Starting nh_make_short_vars"

    # Process all variables declared in the environment
    declare -p | grep 'declare --' | while IFS= read -r line; do
        varname=$(echo "$line" | cut -d= -f1 | awk '{print $3}')
        varvalue=$(echo "$line" | cut -d= -f2-)

        # Preserve quotes and escape special characters
        varvalue=$(eval echo "$varvalue")

        debug "Processing: $varname=$varvalue"

        # Ignore variables based on checks
        if shouldignore "$varname" "$varvalue"; then
            debug "Ignored: $varname"
            continue
        fi

        # Process variables with underscores
        if [[ "$varname" == *_* ]]; then
            debug "Processing with underscore: $varname"

            # Generate a shortened variable name
            newvar=$(echo "$varname" | awk -F'_' '{for (i=1; i<=NF; i++) printf("%s", substr($i, 1, 1))}')
            debug "Generated new variable name: $newvar"

            count=1
            while declare -p "$newvar" &>/dev/null; do
                newvar="${newvar}_${count}"
                count=$((count + 1))
                debug "Duplicate found, new variable name: $newvar"
            done

            # Output the shortened variable safely
            echo "${newvar}=$(printf "%q" "$varvalue") # ${varname}"
        fi
    done

    debug "Completed nh_make_short_vars"
}
