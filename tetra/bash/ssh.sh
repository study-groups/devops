TETRA_SSH_KEY="/root/.ssh/tetra"
tetra-ssh-init(){
  eval "$(ssh-agent)"
   ssh-add $TETRA_SSH_KEY 
}

tetra-ssh-add(){
   ssh-add $1
}

