getcode() {
    local index="${1:-1}"
    local count=0
    local collecting=false
    local block=""

    while IFS= read -r line || [[ -n "$line" ]]; do
        if [[ "$line" =~ ^\`\`\` ]]; then
            if [[ "$collecting" == true ]]; then
                # End of code block
                ((count++))
                if [[ "$index" == "all" ]]; then
                    printf '%s\n' "$block"
                elif [[ "$count" -eq "$index" ]]; then
                    printf '%s\n' "$block"
                    return 0
                fi
                block=""
                collecting=false
            else
                collecting=true
                block=""
            fi
        elif [[ "$collecting" == true ]]; then
            block+="$line"$'\n'
        fi
    done

    if [[ "$index" != "all" && "$count" -lt "$index" ]]; then
        echo "Code block #$index not found." >&2
        return 1
    fi
}
