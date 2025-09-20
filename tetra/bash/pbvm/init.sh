# Detect TETRA_SRC if not set
if [[ -z "$TETRA_SRC" ]]; then
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    export TETRA_SRC="$(dirname "$(dirname "$SCRIPT_DIR")")"
fi

export PBVM_ROOT=${PBVM_ROOT:-"$HOME/.pbvm"}
export PBVM_SRC=${PBVM_SRC:-"$TETRA_SRC/bash/pbvm/pbvm.sh"}
source "$PBVM_SRC"
pbvm status
pbvm use latest
