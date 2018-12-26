doapp-help() {
  echo "
  doapp is a collection of Bash scripts for Docker container CRUD.
  A container is an app.
"
}

doapp-build(){
  source $DOAPPDIR/build.sh
}

doapp-config(){
  source $DOAPPDIR/config.sh
}

doapp-run(){
  source $DOAPPDIR/run.sh
}

doapp-kill(){
  # $1 = app name
  docker container stop $1
  docker container rm $1
}
