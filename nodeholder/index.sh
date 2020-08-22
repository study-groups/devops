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

nodeholder-config(){
  
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
  scp -r ./api/buildpak admin@"$ip":~/
}

nodeholder-test(){
  echo $(dirname $BASH_SOURCE)
}

nodeholder-generate-aliases() {

  # source variables into environment
  source /home/admin/server.list

  # create or refresh the aliases file
  echo "" > /home/admin/nodeholder-aliases.sh
  
  # collect the names of the servers
  local node_names=($(awk -F"=" '{print $1}' < /home/admin/server.list))

  for name in "${node_names[@]}"; do
	
	# dereference the name of the env var to get the ip
	local ip="${!name}"

	# ready the template
  	local template=$(cat \
	        /home/admin/src/devops-study-group/nodeholder/templates/aliases.template)
	# inject the name of the server into the template
	template=${template//NAME/"$name"}
	# inject the server's ip into the template
	template=${template//IP/"$ip"}
	# place that template into the aliases file
	echo "$template" >> /home/admin/nodeholder-aliases.sh
  done

  source /home/admin/nodeholder-aliases.sh
}

nodeholder-generate-server-dirs() {
  local directories=($(cat ~/server.list | awk -F= '{print $1}'));

  for directory in "${directories[@]}"; do
    [ ! -d "$directory" ] \
    && mkdir ~/servers/$directory 2> /dev/null \
    && echo "${!directory}" > ~/servers/$directory/ip \
    && echo "Creating directory for server: $directory"
  done
    echo "Server directory generation complete."
    echo "Listing ~/servers"
    ls ~/servers
}

nodeholder-generate-node-dirs-for-server() {
  local server_name="$1" # don't use ip
  if [ -z "$server_name" ]; then
    echo "Please supply the name of the server."
    return 1
  fi
  
  # list all the nodes associated with the server *except for admin
  local nodes=($(ssh admin@"${!server_name}" 'ls /home -I admin'));

  # if node directory doesn't already exist in the $server_name directory
  for node in "${nodes[@]}"; do
    [ ! -d "~/servers/$server_name/$node" ] \
    && mkdir ~/servers/$server_name/$node 2> /dev/null \
    && echo "Created ~/servers/$server_name/$node"
  done

  echo "Listing directory ~/servers/$server_name"
  ls ~/servers/$server_name
}

nodeholder-generate-app-dirs-for-node() {
  local server_name="$1"; # don't use the ip
  local node_name="$2";
  if [ -z "$server_name" ] || [ -z "$node_name" ]; then
    echo "Please supply the name of the server and the name of the node."
    return 1
  fi

  # list all the applications associated with the node *except for buildpak
  local apps=($(ssh "$node_name"@"${!server_name}" 'ls -d */'));

  # if app directory doesn't exist in $node_name directory
  for app in "${apps[@]}"; do
    [ ! -d "~/servers/$server_name/$node_name/$app" ] \
    && [ "$app" != "buildpak/" ] \
    && mkdir ~/servers/$server_name/$node_name/$app 2> /dev/null \
    && echo "Created ~/servers/$server_name/$node_name/$app"
  done

  echo "Listing directory ~/servers/$server_name/$node_name"
  ls ~/servers/$server_name/$node_name
}

# needs work
nodeholder-refresh-servers-dir() {
  #######################################################
  # These are commented out for security purposes
  # rm -rf ~/servers/*          
  # nodeholder-generate-server-dirs > /dev/null
  #######################################################
  local servers=$(ls ~/servers);

  for server in "${servers[@]}"; do
    nodeholder-generate-node-dirs-for-server "$server" > /dev/null
  done
  
  printf "\nRefreshed server directories and node directories.\n"
  printf "Listing full ~/servers directory:\n\n"
  ls -R ~/servers

}


nodeholder-refresh-admin() {
  local ip="$1"
  local admin_file=/home/admin/src/devops-study-group/nodeholder/ubuntu/admin.sh
  scp "$admin_file" admin@"$ip":~/admin.sh
}

nodeholder-remove-node() {
  local ip="$1";
  local node_name="$2";

  ssh admin@"$ip" 'source admin.sh && admin-remove-node "'$node_name'"'
}

nodeholder-create-node() {

  local ip="$1";
  local node_name="$2";

  ssh admin@"$ip" 'source admin.sh && admin-create-node "'$node_name'"'
}
