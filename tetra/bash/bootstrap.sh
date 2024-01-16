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

for f in $(ls $TETRA_SRC/*.sh | grep -v bootstrap.sh);
  do source $f;
done;


for d in $TETRA_DIR/*/; do
    if [ -e "$d/tetra.sh" ]; then
        source "$d/tetra.sh"
    fi
done

echo "  TETRA_SRC: $TETRA_SRC"
echo "  TETRA_DIR: $TETRA_DIR"
echo "  Tetra Bootstraping complete, tetra-logs to see more."
