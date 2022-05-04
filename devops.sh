devops-help(){
  cat <<EOF
devops.sh is a catch-all for first-run work before
implementing in tetra or nodeholder.
EOF
}

devops-new-mkdocs-project(){
  # need to be in a pyenv env.
  # pip install mkdocs
  # https://www.mkdocs.org/getting-started/
  mkdocs new $1 
}
