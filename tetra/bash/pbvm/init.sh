export PBVM_ROOT=${PBVM_ROOT:-"$HOME/pj/pbvm"}
export PBVM_SRC=${PBVM_SRC:-"$HOME/src/devops/tetra/bash/pbvm/pbvm.sh"}
source $PBVM_SRC
pbvm status
pbvm use latest
