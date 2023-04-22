tetra-login-help(){
  echo "Works with ~/tetra/server.list, provides default policy for each server"
}

tetra-logins(){
  echo "The tetra-login- functions should be generated programatically."
}

tetra-login-do4_n2(){
  source $TETRA_DIR/server.list
  ssh root@$do4_n2
}
