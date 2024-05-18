tetra_nvm_help(){
  cat <<EOF

  Bash helper functions for developing javascript components.
  tertra_nvm_start: starts nvm for current node LTS version

EOF
}


tetra_nvm_install_help(){
  cat << EOF

  curl returns script with default
  export NVM_DIR="$HOME/.nvm"
  That is overiddent to be
  $TETRA_DIR/nvm

EOF

}

tetra_nvm_activate(){
  if [ -z "$js_ps1_orig" ]; then  # grab original first time and use it
    js_ps1_orig="$PS1"
  fi
  
  ver=${1:-"node"}
  export NVM_DIR="$TETRA_DIR/nvm"
  [ -s "$NVM_DIR/nvm.sh" ] && source "$NVM_DIR/nvm.sh"  # This loads nvm
  [ -s "$NVM_DIR/bash_completion" ] && source "$NVM_DIR/bash_completion"
  nvm use $ver
  PS1="n:$js_ps1_orig"           # use original so multiple calls only one n 
}

tetra_nvm_install(){
  ver=${1:-"v0.39.1"}
  echo "Using nvm: $ver"
  export NVM_DIR="$TETRA_DIR/nvm"
  mkdir -p $NVM_DIR
  echo "Installing nvm in $NVM_IDR"
  echo "Find latest here  https://github.com/nvm-sh/nvm/releases"
  curl "https://raw.githubusercontent.com/nvm-sh/nvm/$ver/install.sh"  | bash
  nvm install 'lts/*'
}
