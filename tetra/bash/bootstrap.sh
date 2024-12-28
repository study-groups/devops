# Set TETRA_DIR if not already set
if [ -z "$TETRA_DIR" ]; then
    TETRA_DIR="${1:-$HOME/tetra}"
fi

# Set TETRA_SRC if not already set
[ -z "$TETRA_SRC" ] && TETRA_SRC="$HOME/src/devops/tetra"

# Define the list of directories to search for scripts
DIRS=(
    "$TETRA_SRC/bash"
    "$TETRA_SRC/bash/utils"
    "$TETRA_SRC/bash/nvm"
    "$TETRA_SRC/bash/python"
    "$TETRA_SRC/bash/sync"
)

# Source .sh files from each directory, excluding bootstrap.sh
for dir in "${DIRS[@]}"; do
  [ -d "$dir" ] || { echo "Directory $dir does not exist"; continue; }
  for f in "$dir"/*.sh; do
    [ -f "$f" ] || { echo "No .sh files in $dir"; continue; }
    [[ "$f" == *bootstrap.sh ]] && { continue; }
    source "$f"
  done
done

tetra_prompt
tetra_status

