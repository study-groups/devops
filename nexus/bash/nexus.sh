nexus_parse_pico_object(){
    local pico_object="$1"
    local id type subtype to from msg

    # Extract timestamp
    id=$(echo "$pico_object" | awk '{print $1}')

    # Extract type and subtype
    type=$(echo "$pico_object" | awk '{print $2}' | grep -oE '^[A-Z]+' | head -n 1)
    subtype=$(echo "$pico_object" | awk '{print $2}' | grep -oE '\.[a-z]+$' | sed 's/^\.//')

    # Extract 'to' and 'from' if they exist
    if [[ "$pico_object" =~ to:\[([^\]]+)\] ]]; then
        to="${BASH_REMATCH[1]}"
    else
        to=""
    fi
    if [[ "$pico_object" =~ from:([^ ]+) ]]; then
        from="${BASH_REMATCH[1]}"
    else
        from=""
    fi

    # Extract message
    msg=$(echo "$pico_object" | sed -E 's/^[0-9]+ [A-Z]+(\.[a-z]+)?( to:\[[^]]+\])?( from:[^ ]+)? //')

    # Print parsed components in canonical form
    echo "id:wq=$id"
    echo "type=$type"
    echo "subtype=$subtype"
    echo "to=$to"
    echo "from=$from"
    echo "msg=$msg"
}

write_canonical_form(){
    nexus_parse_pico_object "$1"
}
