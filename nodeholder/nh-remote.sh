# nodeholder  - 
# collection of shell functions to specify the configuration and use of a node.
#
#    Stage        Function 
# 
# PROVISION       Done previously via dotool
# CONFIGURATION   nh-remote-install-config $node_ip nh-config.sh
# ROLE CREATION
# APP CREATION
# PORT MAPPINGS
# MANAGEMENT
# MONITORING
# BACKUP
##################################################################

# Used to get key so we can clone private repo.
nh-remote-get-key-from-role() {
  local ip="$1";
  local role="$2";

  ssh "$role"@"$ip" 'source nh.sh && nh-get-key'
}

# Configure turns root@vps to admin@node
# Any local apps must be coped now from local mother to child node
# Copy config.sh to admin@$IP and call ssh root@$IP config-init
# Child ode now ready for ssh admin@$IP:admin-commands
nh-remote-install-config(){
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
      source "'$config_file'" && nh-config-init
      echo "##########################################################"
      echo "#  Deploy \"from a distance\" application with admin.sh  #"
      echo "#  --or--                                                #"
      echo "#  Log in to remote host                                 #"
      echo "#  local> dotool-login <droplet>                         #"
      echo "##########################################################"
  '
  
  # instruct user on next steps
  echo "
  Setup application with admin- from local machine to remote host
  --or--
  Log in to remote host with 'dotool-login <droplet>'
  "
}

# installs admin on nodeholder 
# Should be: nodeholder-remote-install-admin() {
nh-remote-install-admin() {
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
nh-remote-refresh-admin() {
  local ip="$1"
  local admin_file="$2"

  scp "$admin_file" admin@"$ip":~/admin.sh
}

# creates new user/node on nodeholder
nh-remote-create-role() {

  local ip="$1";
  local role="$2";

  ssh admin@"$ip" 'source admin.sh && nh-admin-create-role "'$role'"'
  [ $? == 0 ] && scp ./nh.sh "$role"@"$ip":~/nh.sh || echo "Error: role failed to be created."
}

# removes user on nodeholder
nh-remote-remove-role() {
  local ip="$1";
  local role="$2";

  ssh admin@"$ip" 'source admin.sh && admin-remove-role "'$role'"'
}

# clones application into specific role
nh-remote-create-app() {


  local ip="$1";
  local role="$2";
  local repo_url="$3";
  local branch=${4:-"master"};
  local app="$5";

  [ -z "$ip" ] && echo "Please provide ip address" && return 1
  [ -z "$role" ] && echo "Please provide role" \
	  && return 1
  [ -z "$repo_url" ] && echo "Please provide the repo from which to clone" \
	  && return 1
  
  ssh admin@"$ip" \
	  'source admin.sh && admin-create-app "'$role'" "'$repo_url'" "'$branch'" "'$app'"'
}

nh-remote-delete-app() {
  local ip="$1";
  local role="$2";
  local app="$3";

  [ -z "$ip" ] && echo "Please provide ip address" && return 1
  [ -z "$role" ] && echo "Please provide role" && return 1
  [ -z "$app" ] && echo "Please provide the name of the app to delete" && 
    return 1

  ssh admin@"$ip" 'source admin.sh && admin-delete-app "'$role'" "'$app'"'
}

nh-remote-app-build() {
  local ip="$1";
  local role="$2";
  local app="$3";

  [ -z "$ip" ] && echo "Please provide ip address" && return 1
  [ -z "$role" ] && echo "Please provide role" && return 1
  [ -z "$app" ] && echo "Please provide the name of the app to build" && 
    return 1
  
  ssh "$role"@"$ip" 'source nh.sh && nh-app-build'
}

nh-remote-app-status() {
  local ip="$1";
  local role="$2";
  local app="$3";
  [ -z "$ip" ] && echo "Please provide ip address" && return 1
  [ -z "$role" ] && echo "Please provide role" && return 1
  [ -z "$app" ] && echo "Please provide the name of the app" && return 1
  ssh "$role"@"$ip" 'source nh.sh && nh-app-status "'"$app"'"'
}

nh-remote-app-log() {
  local ip="$1";
  local role="$2";
  local app="$3";
  [ -z "$ip" ] && echo "Please provide ip address" && return 1
  [ -z "$role" ] && echo "Please provide role" && return 1
  [ -z "$app" ] && echo "Please provide the name of the app" && return 1
  ssh "$role"@"$ip" 'source nh.sh && nh-app-log "'"$app"'"'
}

nh-remote-app-err() {
  local ip="$1";
  local role="$2";
  local app="$3";
  [ -z "$ip" ] && echo "Please provide ip address" && return 1
  [ -z "$role" ] && echo "Please provide role" && return 1
  [ -z "$app" ] && echo "Please provide the name of the app" && return 1
  ssh "$role"@"$ip" 'source nh.sh && nh-app-err "'"$app"'"'
}

nh-remote-add-env-var() {
  local ip="$1";
  local role="$2";
  local app="$3";
  local env_var="$4";
  local value="$5";

  [ -z "$ip" ] && echo "Please provide ip address" && return 1
  [ -z "$role" ] && 
    echo "Please provide role" && return 1
  [ -z "$app" ] && 
    echo "Please provide the name of the app" && return 1
  [ -z "$env_var" ] && 
    echo "Please provide environment variable to add." && return 1
  ssh "$role"@"$ip" 'source nh.sh $$ nh-add-env-var "'"$env_var"'" "'"$value"'" "'"$app"'"'
}

nh-remote-app-start() {
  local ip="$1";
  local role="$2";
  local app="$3";

  [ -z "$ip" ] && echo "Please provide ip address" && return 1
  [ -z "$role" ] && echo "Please provide role" && return 1
  [ -z "$app" ] && 
    echo "Please provide the name of the app to start" && return 1

  ssh "$role"@"$app" 'source nh.sh && nh-app-start "'"$app"'"'
}

nh-remote-app-stop() {
  local ip="$1";
  local role="$2";
  local app="$3";
  
  [ -z "$ip" ] && echo "Please provide ip address" && return 1
  [ -z "$role" ] && echo "Please provide the name of the node to use" && 
    return 1
  [ -z "$app" ] && 
    echo "Please provide the name of the app to stop" && return 1
  
  ssh "$role"@"$app" 'source nh.sh && nh-app-stop "'"$app"'"'
}

nh-remote-app-status() {
  local ip="$1";
  local role="$2";
  local app="$3";
  
  [ -z "$ip" ] && echo "Please provide ip address" && return 1
  [ -z "$role" ] && 
    echo "Please provide role" && return 1
  [ -z "$app" ] && 
    echo "Please provide the name of the app to check status" && return 1
  
  ssh "$role"@"$ip" 'source nh.sh && nh-app-status "'"$app"'"'
}

nh-remote-list-roles() {
  local ip="$1";
  ssh admin@"$ip" 'source admin.sh && nh-admin-list-roles'
}
