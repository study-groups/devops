# Helper to check for Python availability
tetra_prompt_check_python() {
    if command -v python >/dev/null 2>&1; then
        echo "p"
    fi
}

# Helper to check for Node.js availability
tetra_prompt_check_node() {
    if command -v node >/dev/null 2>&1; then
        echo "n"
    fi
}

# Generate the prefix based on available commands
tetra_prompt_string() {
    local prefix=""
    if [[ $(tetra_prompt_check_python) ]]; then
        prefix+="p"
    fi
    if [[ $(tetra_prompt_check_node) ]]; then
        prefix+="n"
    fi
    [[ -n $prefix ]] && echo "($prefix) "
}

# Helper to generate the Git branch string
tetra_prompt_git_branch() {
    git branch 2>/dev/null | grep "^\*" | colrm 1 2
}

# Main prompt function
tetra_prompt() {
    PS1='\
$(tetra_prompt_string)\
\[\e[0;38;5;228m\]\u\[\e[0m\]@\
\[\e[0m\]\h\
\[\e[0m\]:\
\[\e[0;38;5;45m\][\
\[\e[0;38;5;45m\]\W\
\[\e[0;38;5;45m\]]\
\[\e[0;37m\](\
\[\e[0;37m\]$(tetra_prompt_git_branch)\
\[\e[0;37m\])\
\[\e[0m\]: \
\[\e[0m\]'
}

# Activate the custom prompt dynamically
PROMPT_COMMAND="tetra_prompt"
