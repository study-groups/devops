# Create an alias for the 'date' command based on the operating system
if [[ "$(uname)" == "Darwin" ]]; then
    # macOS uses a different syntax for 'date'
    alias date='gdate'
else
    # Linux and other Unix-like systems
    echo Standard Linux
    alias date=date
    alias pbcopy='xclip -selection clipboard'
    alias pbpaste='xclip -selection clipboard -o'
fi
