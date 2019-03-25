DOAPPSDIR=/root/devops/doapps
doapp-help() {
  echo "
  doapp is a collection of Bash scripts for Docker container CRUD.
  A container is an app.
"
}

doapp-build(){
  source $DOAPPSDIR/$1/build.sh
}

doapp-config(){
  source $DOAPPSDIR/$1/config.sh
}

doapp-run(){
  cat $DOAPPSDIR/$1/.env
  source $DOAPPSDIR/$1/.env
  source $DOAPPSDIR/$1/run.sh
}

doapp-kill(){
  # $1 = app name
  docker container stop $1
  docker container rm $1
}

doapp-ls(){
  docker container ls
}

doapp-info() {
  echo "
  App: $app
  Image: $image
"

}
