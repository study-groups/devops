tetra_xargs_map () {
    local func="$1"  # Function to apply
    local input="$2" # Newline-separated input

    export -f "$func"  # Export the function to make it available in the subshell
    echo "$input" | xargs -I{} bash -c "$func \"{}\""
}
