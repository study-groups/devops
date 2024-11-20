# tetra relies on user supplied PEM keys and env configuration files

# TETRA_DIR is a global path containing organizational directories
# to keep track of keys and env setups specific to an organization
# and the sub systsems within.

# if TETRA_DIR is set via $1, skip. Default to ~/tetra
if [ -z "$TETRA_DIR" ]; then
    if [ -n "$1" ]; then
        TETRA_DIR="$1"
    else
        TETRA_DIR="$HOME/tetra"
    fi
fi

for f in $(ls $TETRA_SRC/bash/*.sh | grep -v bootstrap.sh | grep -v init.sh);
  do source $f;
done;


PS1='\[\e[0;38;5;228m\]\u\[\e[0m\]@\[\e[0m\]\h\[\e[0m\]:\[\e[0;38;5;45m\][\[\e[0;38;5;45m\]\W\[\e[0;38;5;45m\]]\[\e[0;37m\](\[\e[0;37m\]$(git branch 2>/dev/null | grep '"'"'^*'"'"' | colrm 1 2)\[\e[0;37m\])\[\e[0m\]: \[\e[0m\]'
tetra_status
