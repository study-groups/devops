### Functions specific to the configuration and use of a nodeholder

##################################################################
# nodeholder- collection of shell functions for remote
# DEPLOYMENT
# CONFIGURATION
# PORTMAPPINGS
# MANAGEMENT
# MONITORING
# BACKUP
##################################################################

nodeholder-test(){
  echo $(dirname $BASH_SOURCE)
}

nodeholder-get-key-from-node() {
  local ip="$1";
  local node="$2";

  ssh "$node"@"$ip" 'cat .ssh/id_rsa.pub'
}

# configures nodeholder server
nodeholder-configure(){
  
  local ip="$1";
  local config_file="$2";

  # copy config.sh to the remote machine
  scp "$config_file" root@"$ip":"$config_file"
 
  # location where daemonize is on mother node
  local dpath_local="/home/admin/src/daemonize/daemonize";
  
  # location for daemonize on child node
  local dpath_remote="/bin/daemonize";

  # copy daemonize to the remote machine
  scp "$dpath_local" root@"$ip":"$dpath_remote"

  # source configuration and configure machine
  ssh root@"$ip" '
      source "'$config_file'" && config-init
      echo "Deploy \"from a distance\" application with admin.sh"
      echo "--or--"
      echo "Log in to remote host"
      echo "local> dotool-login <droplet>"
  '
  
  # instruct user on next steps
  echo "
  Setup application with admin- from local machine to remote host
  --or--
  Log in to remote host with 'dotool-login <droplet>'
  "
}

# installs admin on nodeholder 
nodeholder-install-admin() {
  # ip of node to send file to
  local ip="$1";
  
  # Adds admin.sh to .bashrc
  local statement="\nif [ -f ~/admin.sh ]; then\n  . ~/admin.sh\nfi";

  # file to send to node
  local admin_file="$2";
  
  # send admin file
  scp "$admin_file" admin@"$ip":~/admin.sh
  # specify the role of the node in the admin.sh file
  # and set up .bashrc to source admin.sh on boot/use
  ssh admin@"$ip" \
    'echo "NODEHOLDER_ROLE=child" >> ~/admin.sh && echo -e "'$statement'" >> ~/.bashrc'
  # copy buildpak to node
  scp -r ./buildpak admin@"$ip":~/
}

# refreshes admin functions on nodeholder
nodeholder-refresh-admin() {
  local ip="$1"
  local admin_file=/home/admin/src/devops-study-group/nodeholder/ubuntu/admin.sh
  scp "$admin_file" admin@"$ip":~/admin.sh
}

# creates new user/node on nodeholder
nodeholder-create-node() {

  local ip="$1";
  local node_name="$2";

  ssh admin@"$ip" 'source admin.sh && admin-create-node "'$node_name'"'
}

# removes user/node on nodeholder
nodeholder-remove-node() {
  local ip="$1";
  local node_name="$2";

  ssh admin@"$ip" 'source admin.sh && admin-remove-node "'$node_name'"'
}

# clones application onto specific node
nodeholder-clone-app() {

  local ip="$1";
  local node_name="$2";
  local repo_url="$3";
  local app_name="$4";

  [ -z "$ip" ] && echo "Please provide ip address" && return 1
  [ -z "$node_name" ] && echo "Please provide the name of the node to use" \
	  && return 1
  [ -z "$repo_url" ] && echo "Please provide the repo from which to clone" \
	  && return 1
  
  ssh admin@"$ip" \
	  'source admin.sh && admin-create-app "'$node_name'" "'$repo_url'" "'$app_name'"'

}

nodeholder-delete-app() {
  local ip="$1";
  local node_name="$2";
  local app_name="$3";

  [ -z "$ip" ] && echo "Please provide ip address" && return 1
  [ -z "$node_name" ] && echo "Please provide the name of the node to use" \
	  && return 1
  [ -z "$app_name" ] && echo "Please provide the name of the app to delete" \
	  && return 1

  ssh admin@"$ip" 'source admin.sh && admin-delete-app "'$node_name'" "'$app_name'"'
}

nodeholder-app-install-deps() {
  local ip="$1";
  local node_name="$2";
  local app_name="$3";

  [ -z "$ip" ] && echo "Please provide ip address." && return 1
  [ -z "$node_name" ] && echo "Please provide the name of the node to use." \
	  && return 1
  [ -z "$app_name" ] && echo "Please provide the name of the app to install dependencies for." \
	  && return 1

  ssh "$node_name"@"$ip" './"'$app_name'"/nh/install'
}

nodeholder-app-build() {
  local ip="$1";
  local node_name="$2";
  local app_name="$3";

  [ -z "$ip" ] && echo "Please provide ip address" && return 1
  [ -z "$node_name" ] && echo "Please provide the name of the node to use" \
	  && return 1
  [ -z "$app_name" ] && echo "Please provide the name of the app to build" \
	  && return 1

  ssh "$node_name"@"$ip" './"'$app_name'"/nh/build'
}

nodeholder-app-start() {
  local ip="$1";
  local node_name="$2";
  local app_name="$3";

  [ -z "$ip" ] && echo "Please provide ip address" && return 1
  [ -z "$node_name" ] && echo "Please provide the name of the node to use" \
	  && return 1
  [ -z "$app_name" ] && echo "Please provide the name of the app to start" \
	  && return 1

  ssh "$node_name"@"$ip" './"'$app_name'"/nh/start'
}

nodeholder-app-stop() {
  local ip="$1";
  local node_name="$2";
  local app_name="$3";
  
  [ -z "$ip" ] && echo "Please provide ip address" && return 1
  [ -z "$node_name" ] && echo "Please provide the name of the node to use" \
	  && return 1
  [ -z "$app_name" ] && echo "Please provide the name of the app to stop" \
	  && return 1
  
  ssh "$node_name"@"$ip" './"'$app_name'"/nh/stop'
}

nodeholder-app-status() {
  local ip="$1";
  local node_name="$2";
  local app_name="$3";
  
  [ -z "$ip" ] && echo "Please provide ip address" && return 1
  [ -z "$node_name" ] && echo "Please provide the name of the node to use" \
	  && return 1
  [ -z "$app_name" ] && echo "Please provide the name of the app to check status" \
	  && return 1
  
  ssh "$node_name"@"$ip" './"'$app_name'"/nh/status'
}
