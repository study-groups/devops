# File starts below.
####################################################################
# Source these functions as admin. 
admin-help(){
  echo "\
   Admin is a collection of scripts to configure runtime operations.

   Securely copy the admin.sh file to your new remote machine: 
    1) scp admin.sh ssh admin@host:admin.sh

   Source admin.sh on remote using ssh and call admin-init function:
   2) ssh admin@host: \"source admin.sh && admin-init\"

  Requires:
    - running as admin

  Configures a Unix server and account for process 'containers'
  addresseble by system defined TCP sockets. 
"
}

admin-create-aliases() {
  local array=($(cat ./node.list | awk -F"export " '{print $2}' | awk -F"=*" '{print $1}'))
  
  echo "" > ./my-aliases.sh

  for node in "${array[@]}"; do
    local ip="${!node}"
    printf "alias $node-install-admin=\"scp ./admin.sh admin@$ip:~/admin.sh && ssh admin@$ip 'echo "NODEHOLDER_ROLE=child" >> ~/admin.sh' && scp -r ./buildpak admin@$ip:~/\"\n" >> ./my-aliases.sh
    printf "alias $node-admin-init=\"\"\n" >> ./my-aliases.sh
    printf "alias $node-admin-build=\"\"\n" >> ./my-aliases.sh
    printf "alias $node-app-start=\"\"\n" >> ./my-aliases.sh
    printf "alias $node-app-status=\"\"\n" >> ./my-aliases.sh
    printf "alias $node-app-stop=\"\"\n" >> ./my-aliases.sh
  done
  cat ./my-aliases.sh
}

# belongs to mother
nodeholder-copy-file() {
  #local ip_addr=$(dotool-name-to-ip "$1");
  local ip_addr=$1;
  local admin_file="$2";
  scp "$admin_file" admin@"$ip_addr":"$admin_file"
}


admin-create-paths() {

  # make room for repos and app deployment.
  mkdir /home/admin/src/   # where apps are developed
  #mkdir /home/admin/apps/  # where apps are deployed to production
  #echo "development and production setup finished"

}

clone-app() {
  # enters development directory
  cd /home/admin/src/

  local repo_url=$1;
  local basename=$(basename $repo_url); # myapp.git
  local app_name=${basename%.*}; # myapp  (removes .git)
  git clone $repo_url

  #local app_dir_path="/home/admin/src/$app_name/";

  # path to use when serving application
  # production_path=$2; # e.g. bin or index.js
  # echo "production path is: $production_path"
 
  # copy development to production 
  #cp -r /home/admin/src/$app_name $app_dir_path

  # set pwd to home for next function call
  #cd /home/admin

}

admin-daemonize-app() {

  # current working directory
  local cwd=$1;

  # command to run program
  local cmd=$2;

  # path to file
  local args=$3;
  
  echo "cwd: $cwd\n cmd: $cmd\n args: $args"
  
  # daemonize application running as admin
  daemonize \
	  -E PORT=4444 \
	  -c $cwd \
	  -p $cwd/app.pid \
	  -e $cwd/app.err \
	  -o $cwd/app.log \
	  "$cmd" "$args"
}

admin-init() {
  #local app_name="node-hello-world"
  #local app_repo="https://github.com/zoverlvx/$app_name.git"
  admin-create-paths  # creates /home/admin/{src,apps}
  #admin-clone-app $app_repo
}

# This is a developer function
# i.e. not for any particular use by user
admin-install-sae(){
  # presume src directory exists
  cd /home/admin/src/

  local app_name=sentiment-analysis-engine
  local repo_url="https://gitlab.com/zoverlvx/$app_name.git";
  git clone $repo_url

  # presumes repo contains a directory called app that can be
  # served from this system.
  local app_dir="/home/admin/apps/$app_name"    # production app
  mkdir $app_dir
  cp -r /home/admin/src/$app_name/bin $app_dir  # change to match repo

  # set pwd to home for next function call
  cd /home/admin
}

userdir="/home/admin"
pidfile="$userdir/src/node-hello-world/nodeholder/development/app.pid"
stopfile="$userdir/src/node-hello-world/nodeholder/development/stop"
startfile="$userdir/src/node-hello-world/nodeholder/development/start"
statusfile="$userdir/src/node-hello-world/nodeholder/development/status"

admin-undo-init(){
  if [[ $NODEHOLDER_ROLE == "child" ]]
  then
    app-stop
    rm -rf $userdir/src
    rm -rf $userdir/buildpak
    rm $userdir/admin.sh
    return 0 
  fi

  echo "Aborting undo. NODEHOLDER_ROLE not child."

}


admin-get-pid(){
  local pid=$(cat $pidfile);
  echo $pid 
}

admin-app-status(){
  echo using PID file:  $pidfile
  echo Using status file:  $statusfile
}
# File starts below.
####################################################################
# This should be defined in an env file.
APP_DIR="/home/admin/src/node-hello-world"
SRC_DIR="$APP_DIR/src"
NODE_DIR="$APP_DIR/nodeholder"

app-status(){
   $statusfile
}

app-stop(){
   $stopfile
}

app-start(){
   $startfile
}

# Inject PORT NUMBER HERE
app-build(){
  cp -r $SRC_DIR/www.js $NODE_DIR/development/www.js
  cp  ~/buildpak/* $NODE_DIR/development/
  echo "node-hello-world" > $NODE_DIR/development/app.name
}
