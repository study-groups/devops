nh_make_short_vars() {
    local count
    local newvar
    local varname
    local varvalue

    # Define the debug flag (set to "true" to enable debugging, "false" to disable)
    local dbg=false

    # Define an ignore list
    local ignorelist=("ignorelist" "IFS" "_")

    # Function to check if a variable should be ignored
    shouldignore() {
        local name="$1"
        local value="$2"
        
        # Skip empty lines and lines without an equal sign
        if [[ -z "$name" ]] || [[ -z "$value" ]]; then
            return 0
        fi
        
        # Ignore variables that start with a capital letter or are in the ignore list
        if [[ "$name" =~ ^[A-Z] ]]; then
            return 0
        fi
        for ignore_item in "${ignorelist[@]}"; do
            if [[ "$name" == "$ignore_item" ]]; then
                return 0
            fi
        done
        return 1
    }

    # Function to log debug messages
    debug() {
        if [[ "$dbg" == "true" ]]; then
            echo "$@" >&2
        fi
    }

    # Get all variables and filter out functions
    declare -p | grep 'declare --' | while IFS= read -r line; do
        varname=$(echo "$line" | cut -d= -f1 | awk '{print $3}')
        varvalue=$(echo "$line" | cut -d= -f2-)

        # Remove leading and trailing quotes from the value
        varvalue="${varvalue#\"}"
        varvalue="${varvalue%\"}"

        debug "Processing: $varname=$varvalue"

        # Ignore variables based on the combined checks
        if shouldignore "$varname" "$varvalue"; then
            debug "Ignored: $varname"
            continue
        fi

        # Check if the variable name contains at least one underscore
        if [[ "$varname" == *_* ]]; then
            debug "Processing with underscore: $varname"

            # Create a shorter variable name by taking the first letter of each segment
            newvar=$(echo "$varname" | awk -F'_' '{for (i=1; i<=NF; i++) printf("%s", substr($i, 1, 1))}')
            debug "Generated new variable name: $newvar"

            # Initialize counter
            count=1

            # Check for duplication and append number if needed
            while declare -p "$newvar" &>/dev/null; do
                newvar="${newvar}_${count}"
                count=$((count + 1))
                debug "Duplicate found, new variable name: $newvar"
            done

            # Echo the new variable assignment with the original name as a comment
            echo "${newvar}='${varvalue}' # ${varname}"
        fi
    done
}

