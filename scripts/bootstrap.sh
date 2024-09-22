devops_help(){
  cat << EOF

Source this file to bring devops_ functions into your shell.
The devops_ functions are primarily used to create a custom
user file callded devops.sh which will initiate environment
variables used by tetra.

See tetra/bash/bootstrap.sh for more.

EOF
}

devops_init(){

  ( echo "[user]"
    echo "name = Devops McGee"
    echo "email = devops@$HOSTNAME"
    ) >> $HOME/.gitconfg

  TETRA_DIR=$HOME/tetra
  TETRA_SRC=$HOME/src/devops/tetra/bash/
  echo "Start tetra with"
  echo "TETRA_DIR: $TETRA_DIR"
  echo "TETRA_SRC: $TETRA_SRC"
  echo ctrl-c the quit, return to continue
  read
  source $TETRA_SRC/bootstrap.sh
}
