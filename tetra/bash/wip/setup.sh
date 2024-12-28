tetra_setup_dependencies(){

  if [ "$(uname)" = "Darwin" ]; then
    # macOS
    brew install jq
  else
    # Linux and other Unix-like systems
    echo Standard Linux needs xclip, jq
    apt install xclip
    apt install jq
  fi

  echo tetra_setup_dependencies using $(uname) for OS.
}
