tetra_status(){
echo "  TETRA_SRC: $TETRA_SRC" > /dev/stderr
echo "  TETRA_DIR: $TETRA_DIR" > /dev/stderr
echo "  TETRA_REMOTE: $TETRA_REMOTE_USER@$TETRA_REMOTE:$TETRA_REMOTE_DIR" \
     > /dev/stderr
}

tetra_status_long(){
echo "  Tetra detected $OSTYPE." > /dev/stderr
echo "  BASH_VERSION: $BASH_VERSION" > /dev/stderr
echo "  PATH: $PATH" > /dev/stderr
echo ""
echo "All TETRA_ environment variables"
tetra_env
}
