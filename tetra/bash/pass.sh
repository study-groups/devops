tetra_pass_get(){
  ssh "$TETRA_USER@$TETRA_PASS" \
  cat "/home/$TETRA_USER/files/txt/account_info.txt"
}
