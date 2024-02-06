tetra-github-2fa-enc(){
  echo "Paste your clear codes followed by ctrl-d"
  local github2fa="$TETRA_DIR/github-recovery-codes.txt"
  tetra-encrypt-stdio | $github2fa.enc
  echo "Wrote to $github2fa.enc"
}
