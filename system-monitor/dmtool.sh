dm-create-app(){
  echo
  echo " This will create a directory called dmtool Requires Node.js"
  echo " Return to continue.."
  read # read from stdin, looks for newline
  echo
  npm create svelte@latest dmtool
}
