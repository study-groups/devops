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
# tetra relies on user supplied PEM keys and env configuration files

tetra_status(){
echo "  TETRA_SRC: $TETRA_SRC" > /dev/stderr
echo "  TETRA_DIR: $TETRA_DIR" > /dev/stderr
echo "  TETRA_USER: $TETRA_USER" > /dev/stderr
echo "  TETRA_ORG: $TETRA_ORG" > /dev/stderr
echo "  TETRA_REMOTE: $TETRA_REMOTE" > /dev/stderr
echo "  Tetra Bootstraping complete with $OSTYPE." > /dev/stderr
}
