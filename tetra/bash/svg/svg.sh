tetra_clip_to_file() {
    if [ -z "$1" ]; then
        echo "Usage: tetra_clip_to_file <filename>"
        return 1
    fi

    xclip -selection clipboard -o > "$1"
}
