output_prefix=${1:-"out"}
file_counter=1
inside_code_block=false
output_file=""

# Read each line from stdin
while IFS= read -r line; do
    # Check for the start of a code block
    if [[ "$line" =~ ^\`\`\` ]]; then
        if $inside_code_block; then
            # End current code block
            inside_code_block=false
            output_file=""
        else
            # Start new code block
            inside_code_block=true
            output_file="${output_prefix}${file_counter}"
            file_counter=$((file_counter+1))
            touch "$output_file" # create the file
        fi
    elif $inside_code_block; then
        # If inside code block, write the line to the file
        echo "$line" >> "$output_file"
    fi
done
