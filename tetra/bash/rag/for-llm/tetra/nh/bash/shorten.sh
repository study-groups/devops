nh_make_short_vars() {
    local prefix="$1"
    
    if [[ -z "$prefix" ]]; then
        echo "Error: Prefix required (e.g., pxjam)" >&2
        return 1
    fi
    
    declare -A used_vars
    
    while IFS='=' read -r varname value; do
        # Strip off "export " prefix from varname
        varname=${varname#export }
        
        [[ $varname =~ ^$prefix ]] || continue
        
        # Generate short variable name by stripping the _private or _floating suffix first
        local base_name="${varname%_private}"
        base_name="${base_name%_floating}"
        
        # Generate abbreviation from base name
        newvar=""
        IFS='_' read -ra parts <<< "$base_name"
        for part in "${parts[@]}"; do
            newvar+="${part:0:1}"
        done
        
        # Add single suffix based on original name
        if [[ "$varname" == *_private ]]; then
            newvar+="p"
        elif [[ "$varname" == *_floating ]]; then
            newvar+="f"
        fi
        
        # Strip comment from value and trim whitespace
        value=${value%%#*}
        value=${value%% }
        
        # Ensure uniqueness
        count=1
        original_newvar="$newvar"
        while [[ -n "${used_vars[$newvar]}" ]]; do
            newvar="${original_newvar}_${count}"
            ((count++))
        done
        used_vars[$newvar]=1
        
        printf "export %s=%s # %s\n" "$newvar" "$value" "$varname"
    done < <(nh_show_env_vars)
}
