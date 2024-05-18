tetra_reload_CHECK(){
  local dir="$TETRA_DIR"
  local src="$TETRA_SRC"
  [ -z "$TETRA_DIR" ] && echo "TETRA_DIR not set, exiting" && return 1
  [ -z "$TETRA_SRC" ] && echo "TETRA_SRC not set, exiting" && return 1
  tetra_env_clear
  TETRA_DIR="${dir}" 
  TETRA_SRC="${src}" 
  echo "sourcing $TETRA_DIR/tetra.sh"
  source $TETRA_DIR/tetra.sh
  tetra_env -a 
}
