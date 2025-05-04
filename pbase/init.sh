[ -z "$TETRA_DIR" ] && echo TETRA_DIR not set
[ -z "$PBASE_DIR" ] && echo PBASE_DIR not set
[ -z "$PBASE_SRC" ] && echo PBASE_SRC not set && return -1
PBVM_ROOT=$TETRA_DIR/pbvm
source $PBASE_SRC/bash/bootstrap.sh
source $PBASE_SRC/pbvm/pbvm.sh
