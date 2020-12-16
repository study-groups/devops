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

  if [ $# -lt 2 ]; then
    echo "Command requires the ip and role"
    echo "nh-remote-get-key-from-role ip role"
    return 1
  fi

  local ip="$1";
  local role="$2";

  ssh "$role"@"$ip" 'source nh.sh && nh-get-key'
}

# Configure turns root@vps to admin@node
# Any local apps must be coped now from local mother to child node
# Copy config.sh to admin@$IP and call ssh root@$IP config-init
# Child ode now ready for ssh admin@$IP:admin-commands
nh-remote-install-root(){

  if [ $# -lt 2 ]; then
    echo "Command requires the ip and configuration file"
    echo "nh-remote-install-config ip file"
    return 1
  fi

  local ip="$1";
  local config_file="${2:-'root.sh'}";

  # copy root.sh to the remote machine
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
      echo "#                                                        #"
      echo "#       --or--                                           #"
      echo "#                                                        #"
      echo "#  Log in to remote host local> ssh admin@$droplet       #"
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

  if [ $# -lt 2 ]; then
    echo "Command requires the ip and admin file"
    echo "nh-remote-install-admin ip file"
    return 1
  fi

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
  # copy .gitlab-ci.yml template to admin
  scp ./.gitlab-ci.yml admin@"$ip":~/
}

# refreshes admin functions on nodeholder
nh-remote-refresh-admin() {

  if [ $# -lt 2 ]; then
    echo "Command requires the ip and admin file"
    echo "nh-remote-refresh-admin ip file"
    return 1
  fi

  local ip="$1"
  local admin_file="$2"

  scp "$admin_file" admin@"$ip":~/admin.sh
}

# creates new user/node on nodeholder
nh-remote-create-role() {
  
  if [ $# -lt 2 ]; then
    echo "Command requires the ip and role"
    echo "nh-remote-create-role ip role"
    return 1
  fi

  local ip="$1";
  local role="$2";
  local nh_path=/home/admin/src/devops-study-group/nodeholder/ubuntu/nh.sh

  ssh admin@"$ip" 'source admin.sh && nh-admin-create-role "'$role'"'
  [ $? == 0 ] && 
    scp $nh_path "$role"@"$ip":~/nh.sh || 
    echo "Error: role failed to be created."
}

# removes user on nodeholder
nh-remote-remove-role() {

  if [ $# -lt 2 ]; then
    echo "Command requires the ip and role"
    echo "nh-remote-remove-role ip role"
    return 1
  fi

  local ip="$1";
  local role="$2";

  ssh admin@"$ip" 'source admin.sh && nh-admin-remove-role "'$role'"'
}

# clones application into specific role
nh-remote-create-app() {

  if [ $# -lt 3 ]; then
    echo "Command requires the ip, role, and repo url"
    echo "nh-remote-create-app ip role repo_url [app_name] [branch]"
    return 1
  fi

  local ip="$1";
  local role="$2";
  local repo_url="$3";
  local app="$4";
  local branch=${5:-"master"};
  
  ssh admin@"$ip" \
	  'source admin.sh && nh-admin-create-app "'$role'" "'$repo_url'" "'$branch'" "'$app'"'
}

nh-remote-delete-app() {

  if [ $# -lt 3 ]; then
    echo "Command requires the ip, role, and app name"
    echo "nh-remote-delete-app ip role app"
    return 1
  fi

  local ip="$1";
  local role="$2";
  local app="$3";

  ssh admin@"$ip" 'source admin.sh && nh-admin-delete-app "'$role'" "'$app'"'
}

nh-remote-app-install-deps() {

  if [ $# -lt 3 ]; then
    echo "Command requires the ip, role, and app name"
    echo "nh-remote-app-install-deps ip role app"
    return 1
  fi

  local ip="$1";
  local role="$2";
  local app="$3";

  ssh "$role"@"$ip" 'source nh.sh && nh-app-install-deps "'"$app"'"'
}

nh-remote-app-build() {

 if [ $# -lt 3 ]; then
    echo "Command requires the ip, role, and app name"
    echo "nh-remote-app-build ip role app"
    return 1
  fi

  local ip="$1";
  local role="$2";
  local app="$3";

  ssh "$role"@"$ip" 'source nh.sh && nh-app-build "'"$app"'"'
}

nh-remote-app-status() {

  if [ $# -lt 3 ]; then
    echo "Command requires the ip, role, and app name"
    echo "nh-remote-app-status ip role app"
    return 1
  fi

  local ip="$1";
  local role="$2";
  local app="$3";

  ssh "$role"@"$ip" 'source nh.sh && nh-app-status "'"$app"'"'
}

nh-remote-app-log() {
  
  if [ $# -lt 3 ]; then
    echo "Command requires the ip, role, and app name"
    echo "nh-remote-app-log ip role app"
    return 1
  fi

  local ip="$1";
  local role="$2";
  local app="$3";

  ssh "$role"@"$ip" 'source nh.sh && nh-app-log "'"$app"'"'
}

nh-remote-app-err() {

  if [ $# -lt 3 ]; then
    echo "Command requires the ip, role, and app name"
    echo "nh-remote-app-err ip role app"
    return 1
  fi

  local ip="$1";
  local role="$2";
  local app="$3";

  ssh "$role"@"$ip" 'source nh.sh && nh-app-err "'"$app"'"'
}

nh-remote-add-env-var() {

  if [ $# -lt 4 ]; then
    echo "Command requires the ip, role, app name, and name of environment variable"
    echo "nh-remote-add-env-var ip role app env_var [value]"
    return 1
  fi

  local ip="$1";
  local role="$2";
  local app="$3";
  local env_var="$4";
  local value="$5";

  ssh "$role"@"$ip" 'source nh.sh $$ nh-add-env-var "'"$env_var"'" "'"$value"'" "'"$app"'"'
}

nh-remote-app-start() {

  if [ $# -lt 3 ]; then
    echo "Command requires the ip, role, and app name"
    echo "nh-remote-app-start ip role app"
    return 1
  fi

  local ip="$1";
  local role="$2";
  local app="$3";

  ssh "$role"@"$ip" 'source nh.sh && nh-app-start "'"$app"'"'
}

nh-remote-app-stop() {

  if [ $# -lt 3 ]; then
    echo "Command requires the ip, role, and app name"
    echo "nh-remote-app-stop ip role app"
    return 1
  fi

  local ip="$1";
  local role="$2";
  local app="$3";
  
  ssh "$role"@"$ip" 'source nh.sh && nh-app-stop "'"$app"'"'
}

nh-remote-app-status() {

  if [ $# -lt 3 ]; then
    echo "Command requires the ip, role, and app name"
    echo "nh-remote-app-status ip role app"
    return 1
  fi

  local ip="$1";
  local role="$2";
  local app="$3";
  
  ssh "$role"@"$ip" 'source nh.sh && nh-app-status "'"$app"'"'
}

nh-remote-list-roles() {

  if [ $# -lt 1 ]; then
    echo "Command requires the ip"
    echo "nh-remote-list-roles ip"
    return 1
  fi

  local ip="$1";
  ssh admin@"$ip" 'source admin.sh && nh-admin-list-roles'
}
