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

if command -v colima &>/dev/null && [[ $OSTYPE == 'darwin'* ]]; then
  # colima allows docker commands without Docker Desktop for mac 
  # change false to true to activate
  false && colima delete
  false && colima start --arch x86_64
fi

echo "  TETRA_SRC: $TETRA_SRC" > /dev/stderr
echo "  TETRA_DIR: $TETRA_DIR" > /dev/stderr
echo "  Tetra Bootstraping complete with $OSTYPE." > /dev/stderr


