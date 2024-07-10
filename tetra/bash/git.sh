tetra_git_mr(){
  git config --global user.email "mike.ricos@gmail.com"
  git config --global user.name "Mike Ricos"
  git config --global credential.helper cache
}

tetra_git_ml(){
  git config --global user.email "mike@lenan.net"
  git config --global user.name "Mike Lenan"
}

tetra_git_graph(){
  git log --oneline --graph --decorate --all
}
