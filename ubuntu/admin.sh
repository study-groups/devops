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


### Zach's interpretation ###

admin-create-paths() {

  # make room for repos and app deployment.
  mkdir /home/admin/src/   # where apps are developed
  #mkdir /home/admin/apps/  # where apps are deployed to production
  #echo "development and production setup finished"

}

admin-install-app() {
  # enters development directory
  cd /home/admin/src/

  local repo_url=$1;
  local basename=$(basename $repo_url); # myapp.git
  local app_name=${basename%.*}; # myapp  (removes .git)
  echo "Here is the app's name: $app_name"
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
  
  # src vs apps
  echo "cwd: $cwd\n cmd: $cmd\n args: $args"
  
  # daemonize application running as admin
  daemonize \
	  -c $cwd \
	  -p $cwd/app.pid \
	  -e $cwd/app.err \
	  -o $cwd/app.log \
	  "$cmd" "$args"
}

zach-admin-init() {
  local app_name="node-hello-world"
  local app_url="https://github.com/zoverlvx/$app_name.git"
  admin-create-paths  # creates /home/admin/{src,apps}
  admin-install-app $app_url 

  # configure and daemonize PRODUCTION
  #local cmd="/usr/bin/node"
  #local cwd="/home/admin/src/node-hello-world/production/"
  #local app_path="$cwd/in/www.js"

  # configure and daemonize DEVELOPMENT
  local cmd="/usr/bin/node"
  local cwd="/home/admin/src/node-hello-world/dev"
  local app_entry="bin/www.js"
  local args="$cwd/$app_entry"
  admin-daemonize-app $cwd $cmd $args    # imperative  
  #admin-daemonize-app $cwd $cmd $app_entry   # declarative
}

####End of Zach's interpretation #####

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


admin-install-apps(){

  # make room for repos and app deployment.
  mkdir /home/admin/src/   # where apps are developed
  mkdir /home/admin/apps/  # where apps are deployed to production 

  admin-install-sae
}

admin-start-apps(){
# Start node servers (ports are currently defined by user, later system)

    # Future: loop over directories in  /home/admin/apps and call init.sh

    node /home/admin/apps/sentiment-analysis-engine/bin/www.js
}

# This local functions will be called. Comment out as needed.
admin-init(){
  admin-install-apps
  admin-start-apps
}
