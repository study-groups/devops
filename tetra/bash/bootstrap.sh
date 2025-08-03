# Set TETRA_DIR if not already set
if [ -z "$TETRA_DIR" ]; then
    TETRA_DIR="${1:-$HOME/tetra}"
fi

[ -z "$TETRA_SRC" ] && TETRA_SRC="$HOME/src/devops/tetra"
for f in $(ls $TETRA_SRC/*.sh | grep -v bootstrap.sh | grep -v init.sh);
  do source $f;
done;

# Define the list of directories to search for scripts
DIRS=(
    "$TETRA_SRC/bash"
    "$TETRA_SRC/bash/utils"
    "$TETRA_SRC/bash/pb"
    "$TETRA_SRC/bash/prompt"
    "$TETRA_SRC/bash/nvm"
    "$TETRA_SRC/bash/python"
    "$TETRA_SRC/bash/sync"
    "$TETRA_SRC/bash/ssh"
    "$TETRA_SRC/bash/node"
    "$TETRA_SRC/bash/enc"
    "$TETRA_SRC/bash/deploy"
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

for var in $(compgen -v | grep '^TETRA_'); do
   export "$var=${!var}"
done
PROMPT_COMMAND="tetra_prompt"  # Bash uses this automatic
ttr=$TETRA_REMOTE_USER@$TETRA_REMOTE:$TETRA_REMOTE_DIR
tetra_status
