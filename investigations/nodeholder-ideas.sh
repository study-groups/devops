### EXPERIMENTAL ###
### Everything below this line is experimental ###

nodeholder() {

## cannot parse combined flags like -lk, must be separated -l -k
## nodeholder-test -C doX key -l breaks

  while [ ! $# -eq 0 ]
    do
      case "$1" in
	      --help|-h) echo "help menu" ;;
	      --list|-l) dotool-list ;;
	      --keys|-k) dotool-keys ;;
	      --delete|-D) dotool-delete "$2" ;;
	      --create|-C) dotool-create "$2" "$3" "$4" ;;
      esac
      shift
    done

  local args=($@);
  local pointer=0;
  while [ ! $# -eq 0 ]
    do
      echo "${args[pointer]}"
      pointer=$(expr $pointer + 1);
      shift
    done
}

nodeholder() {

  REMOTE_USER="root";
  REMOTE_NODE="";

## POSITIVES
## can parse combined flags like -lk

## ISSUES
## flags fire at the same time. -C -c can't be used at the same time
## issue when a third arg isn't provided to -C and a second flag is used


  for arg in "$@"; do
    shift
    case "$arg" in
	    "--keys") set -- "$@" "-k" ;;
	    "--test") set -- "$@" "-t" ;;
	    "--list-nodes"|"--list") set -- "$@" "-l" ;;
	    "--create") set -- "$@" "-C" ;;
	    "--set-remote-node") set -- "$@" "-n" ;;
	    "--login") set "$@" "-L" ;;
	    "--help") set -- "$@" "-h" ;;
	    "--config-with") set -- "$@" "-c" ;;
	    "--set-admin-with") set -- "$@" "-a" ;;
	    "--delete") set -- "$@" "-D" ;;
	    *) set -- "$@" "$arg" ;;
    esac
  done

  OPTIND=1
  while getopts "hlkt:C:n:D:c:a:L:" option; do
    case $option in
	"t")
	  shift 
	  local test_args=($@);
	  local cmd="${test_args[0]}";
	  local should_be="${test_args[1]}";
	  echo "cmd: $cmd, shouldbe: $should_be"
	  ;;
  	"k") dotool-keys ;;
	"l") dotool-list ;;
	"n") 
	  local node_name="$OPTARG";
          REMOTE_NODE=$(dotool-name-to-ip "$node_name");
	  echo "nodeholder is set to communicate with $node_name($REMOTE_NODE)"
	  ;;
  	"c") 
	  local config_file="$OPTARG";
          scp "$config_file" root@"$REMOTE_NODE":"$config_file"
	  echo "Sending $config_file to root@$REMOTE_NODE"
	  
	  # location where daemonize is on mother node
          local dpath_local="/home/admin/src/daemonize/daemonize";
	  
	  # location for daemonize on child node
	  local dpath_remote="/bin/daemonize";
	  
	  # copy daemonize to the remote machine
	  scp "$dpath_local" root@"$REMOTE_NODE":"$dpath_remote"

	  ssh root@"$REMOTE_NODE" '
	      source "'$config_file'" && config-init
	      echo "Deploy \"from a distance\" application with admin.sh"
	      echo "--or--"
	      echo "Log in to remote host"
	      echo "local> dotool-login <droplet>"
	  '
          ;;
        "a") 
	  echo "Sending $OPTARG to $node_name ($ip_addr)"
	  ;;
        "D") dotool-delete "$OPTARG" ;;
	"C")
	  shift
	  set -f
	  IFS=" "
	  local creation_args=($@);
          local host="${creation_args[0]}";
	  local key="${creation_args[1]}";
	  local image_arg="${creation_args[2]}";
	  local image=${image_arg:-ubuntu-18-04-x64};

	  echo "host:$host, key:$key, image:$image"

  	  dotool-create $host $key $image

	  ## need to check that server is up before continuing forward
	  ## host won't be found because the server won't be ready
	  ## by the time this runs
	  REMOTE_NODE=$(dotool-name-to-ip "$host");
	  echo "$host has been created at ip: $REMOTE_NODE"
          echo "nodeholder is set to communicate with $host($REMOTE_NODE)"
	  ;;
  	"L") echo "This is for login" ;;
	"h") echo "Help menu" ;;
  	"?") echo "Incorrect option $arg" ;;
    esac
  done
  shift $(expr $OPTIND - 1) # remove options from positional parameters
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
  local servers=($(cat ~/server.list | awk -F= '{print $1}'));

  ################################
  #	Ready for a template	 #
  #				 #
  ################################

  for server in "${servers[@]}"; do
    [ ! -d ~/servers/$server ] \
    && mkdir ~/servers/$server 2> /dev/null \
    && echo "${!server}" > ~/servers/$server/ip \
    && touch ~/servers/$server/server-functions.sh \
    && echo "Creating directory for server: $server"
  done
    echo "Server directory generation complete."
    echo "Listing ~/servers"
    ls ~/servers
}

nodeholder-generate-node-dirs-for-server() {
  local server_name="$1" # don't use ip

  ################################
  #	Ready for a template	 #
  #				 #
  ################################

  # error handler if server_name is not provided
  [ -z "$server_name" ] && \
	  echo "Please supply the name of the server." && return 1
  
  # list all the nodes associated with the server *except for admin
  local nodes=($(ssh admin@"${!server_name}" 'ls /home -I admin'));

  # if node directory doesn't already exist in the $server_name directory
  for node in "${nodes[@]}"; do
    [ ! -d "~/servers/$server_name/$node" ] \
    && mkdir ~/servers/$server_name/$node 2> /dev/null \
    && touch ~/servers/$server_name/$node/functions.sh \
    && echo "Created ~/servers/$server_name/$node"
  done

  echo "Listing directory ~/servers/$server_name"
  ls ~/servers/$server_name
}

nodeholder-generate-app-dirs-for-node() {
  local server_name="$1"; # don't use the ip
  local node_name="$2";

  ################################
  #	Ready for a template	 #
  #				 #
  ################################

  # error handlers if server_name or node_name are not provided
  [ -z "$server_name" ] \
  && echo "Please provide the name of the server and the name of the node." \
  && return 1 \
  || [ -z "$node_name" ] && echo "Please provide the name of the node." \
	  && return 1

  # list all the applications associated with the node *except for buildpak
  local apps=($(ssh "$node_name"@"${!server_name}" 'ls -d */'));

  # if app directory doesn't exist in $node_name directory
  for app in "${apps[@]}"; do
    [ ! -d "~/servers/$server_name/$node_name/$app" ] \
    && [ "$app" != "buildpak/" ] \
    && mkdir ~/servers/$server_name/$node_name/$app 2> /dev/null \
    && touch ~/servers/$server_name/$node_name/$app/functions.sh \
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
