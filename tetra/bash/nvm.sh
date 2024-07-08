TETRA_NVM="${TETRA_NVM:-$TETRA_DIR/nvm}"
tetra_nvm_help(){
  cat <<EOF

  Bash helper functions for developing javascript components.
  tertra_nvm_start: starts nvm for current node LTS version

EOF
}


tetra_nvm_install_help(){
  cat << EOF

  curl returns script with default
  export TETRA_NVM="$HOME/.nvm"
  That is overiddent to be
  $TETRA_DIR/nvm

EOF

}

tetra_nvm_activate(){
  if [ -z "$js_ps1_orig" ]; then  # grab original first time and use it
    js_ps1_orig="$PS1"
  fi

  ver=${1:-"node"}
  export TETRA_NVM="$TETRA_DIR/nvm"
  [ -s "$TETRA_NVM/nvm.sh" ] && source "$TETRA_NVM/nvm.sh"  # This loads nvm
  [ -s "$TETRA_NVM/bash_completion" ] && source "$TETRA_NVM/bash_completion"
  nvm use $ver
  PS1="n:$js_ps1_orig"           # use original so multiple calls only one n
}

tetra_nvm_install() {
    local ver=${1:-"v0.39.1"}
    echo "Using nvm version: $ver"
    export NVM_DIR="$TETRA_NVM"
    mkdir -p "$NVM_DIR"
    echo "Installing nvm in $NVM_DIR"
    curl -o- "https://raw.githubusercontent.com/nvm-sh/nvm/$ver/install.sh" | bash
    . "$NVM_DIR/nvm.sh"
    . "$NVM_DIR/bash_completion"
    nvm install 'lts/*'
    nvm --version
}


tetra_nvm_install_old(){
  ver=${1:-"v0.39.1"}
  echo "Using nvm: $ver"
  mkdir -p $TETRA_NVM
  echo "Installing nvm in $TETRA_NVM"
  echo "Find latest here  https://github.com/nvm-sh/nvm/releases"
  curl "https://raw.githubusercontent.com/nvm-sh/nvm/$ver/install.sh"  | bash
  nvm install 'lts/*'
}
