[ -z "$NH_SRC" ] && { echo "NH_SRC not set"; return 1; }
[ ! -z "$NH_INIT_DONE" ] && { echo "NH_INIT_DONE already set"; return 0; }
NH_INIT_DONE=1
source "$NH_SRC/bash/bootstrap.sh"
