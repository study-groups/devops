tetra-setup-dependencies(){
if [ "$(uname)" = "Darwin" ]; then
    # macOS
    brew install jq
else
    # Linux and other Unix-like systems
    echo Standard Linux needs xclip, jq
    apt install xclip
    apt install jq
fi

echo tetra-setup-dependencies using $(uname) for OS.
}
