# Helper function to find the TYPE in the message
find_type() {
    local message="$1"
    declare -A known_types=(
        ["ERROR"]="ERR"
        ["WARNING"]="WARN"
        ["INFO"]="INFO"
        ["DEBUG"]="DBG"
        ["PING"]="PING"
        ["PONG"]="PONG"
    )

    # Split the message into an array
    local parts=($message)
    parts=("${parts[@]:0:3}")

    # Search for the TYPE in the array
    for part in "${parts[@]}"; do
        if [[ -n "${known_types[$part]}" ]]; then
            echo "${known_types[$part]}"
            return
        fi
    done

    # If TYPE is not found, default to 'MSG'
    echo "MSG"
    return
}

# Adapter function to format output
format_output() {
    while IFS= read -r line; do
        local timestamp=$(date +%s)
        echo "$timestamp $TETRA_SRC MSG $line"
    done
}

_tetra_pico_object_is_valid() {
    local line="$1"
    if [[ "$line" =~ ^[0-9]{10,} ]]; then
        echo "GOTTT SUCCESS" > /dev/stderr
        return 0  # Success, valid
    else
        echo "GOTTT FAILURE" > /dev/stderr
        return 1  # Failure, not valid
    fi
}

_create_pico_object() {
    local line="$1"
    local timestamp=$(date +%s)
    echo "$timestamp MSG $line"
}

_tetra_pico_object_set() {
    local line="$1"
    # Split the line into an array
    local parts=($line)
    local potential_type=$(find_type "$line")
    TETRA_TYPE="${potential_type:-MSG}"

    # Determine the position of the TYPE in the parts array
    local type_index=-1
    for i in "${!parts[@]}"; do
        if [[ "${parts[i]}" == "$TETRA_TYPE" ]]; then
            type_index=$i
            break
        fi
    done

    # Set source, destination, and message based on the position of the TYPE
    if [[ $type_index -eq -1 ]]; then
        TETRA_AGENT_SRC="na"
        TETRA_AGENT_DEST="na"
        TETRA_MSG="${parts[@]}"  # Assuming the message starts after the ID
    elif [[ $type_index -eq 1 ]]; then
        TETRA_AGENT_SRC="${parts[0]}"
        TETRA_AGENT_DEST="na"
        TETRA_MSG="${parts[@]:2}"
    elif [[ $type_index -eq 2 ]]; then
        TETRA_AGENT_SRC="${parts[0]}"
        TETRA_AGENT_DEST="${parts[1]}"
        TETRA_MSG="${parts[@]:3}"
    else
        # Default case if type is found at an unexpected position
        TETRA_AGENT_SRC="${parts[0]}"
        TETRA_AGENT_DEST="na"
        TETRA_MSG="${parts[@]:1}"
    fi
}

tetra_pico_object_get_type() {
    local pico_object="$1"

    # Split the pico_object into an array
    local parts=($pico_object)

    # Check if the pico_object has at least 4 parts
    if [[ ${#parts[@]} -ge 4 ]]; then
        echo "${parts[3]}"
    else
        echo "Unknown"
    fi
}

tetra_pico_object_create ()
{
    local line="$@";
    local timestamp=$(date +%s%N);
    _tetra_pico_object_set "$line";
    echo "$timestamp $TETRA_AGENT_SRC $TETRA_AGENT_DEST $TETRA_TYPE $TETRA_MSG"
}

# Function to parse a Pico Object
_tetra_pico_object_parse() {
    local pico_object="$?"
    read -r timestamp source destination messageType message <<< "$pico_object"

    echo "Timestamp: $timestamp"
    [[ "$source" != "na" ]] && echo "Source: $source"
    [[ "$destination" != "na" ]] && echo "Destination: $destination"
    echo "Type: $messageType"
    echo "Message: $message"
}
show_tetra_object_variables() {
    echo "TETRA_TYPE: $TETRA_TYPE"
    echo "TETRA_AGENT_SRC: $TETRA_AGENT_SRC"
    echo "TETRA_AGENT_DEST: $TETRA_AGENT_DEST"
    echo "TETRA_MSG: $TETRA_MSG"
}

