tetra_ssh_init(){
  eval "$(ssh-agent)"
   ssh-add $TETRA_SSH_KEY 
}

tetra_ssh_add(){
   ssh-add $1
}

