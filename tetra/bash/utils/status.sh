tetra_status(){
echo "  TETRA_SRC: $TETRA_SRC"
echo "  TETRA_DIR: $TETRA_DIR"
echo "  tetra_remote: ${TETRA_REMOTE_USER:-}@${TETRA_REMOTE:-}:${TETRA_REMOTE_DIR:-}"
}

tetra_status_long(){
echo "  Tetra detected $OSTYPE." > /dev/stderr
echo "  BASH_VERSION: $BASH_VERSION" > /dev/stderr
echo "  PATH: $PATH" > /dev/stderr
echo ""
echo "All TETRA_ environment variables"
tetra_env
}
