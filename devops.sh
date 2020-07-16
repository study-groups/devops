#!/bin/bash
##################################################################
# devops.sh is a collection of dash-apps* which provide:
#
#       Stage          Tool             Description
#  1. PROVISIONING    dotool        creates node, copies to remote:config.sh
#  2. CONFIGURATION   config,node   node-config calls remote:config-init
#  3. PORTMAPPINGS    node          creates Nginx remote:config files (consul)
#  4. DEPLOYMENT      admin         sets up remote:apps from repos (nomad)
#  5. MANAGEMENT      node          start, stop and configure apps (nomad)
#  5. MONITORING      node          monitors all known remote:nodes (consul)
#  6. LOGGING         nodelog       maintains logfile rotation,etc (consul)
#  7. BACKUP          nodesync      rsync wrapper with conventions (consul)
#
#  *A dash-app is a madeup term that referes to a collection of
#   shell functions starting with "appname-".
##################################################################

##################################################################
# dotool- is a collection of bash-like shell functions for 
# PROVISIONING which provide a wrapper around Digital Ocean's
# doctl commandline program.
##################################################################
dotool-help(){
  echo "
  dotool version 18.12

  dotool is as collection os Bash functions making 
  Digital Ocean's command line doctl tool easier to use.

  Digital Ocean API key goes here:
       ~/snap/doctl/current/.config/doctl/config.yml

  See Digital Ocean's doctl documentation here:

  https://www.digitalocean.com/community/tutorials/
  how-to-use-doctl-the-official-digitalocean-command-line-client

  https://www.digitalocean.com/docs/platform/availability-matrix/
  "
}

dotool-info(){
  echo "API key stored in .config/doctl/config.yaml"
  ## Gets account information.
  doctl account get \
      --format "Email,DropletLimit,EmailVerified,UUID,Status" \
      | awk ' { print $1 } '
  ## would like to get each of these on a newline
  ## so far haven't been successful with awk, et al.
}

dotool-keys(){
  ## shows the users that have access to the hypervisor???
  doctl compute ssh-key list
}

dotool-list(){
  ## shows the list of virtual servers we have up
  doctl compute droplet list \
      --format "ID,Name,PublicIPv4,Region,Volumes" | cut -c -80
}
dotool-ls-long(){
  ## shows the verbose list of virtual servers that we have up
  doctl compute droplet list \
      --format "ID,Name,Memory,Disk,Region,Features,Volumes"
}

#--image ubuntu-18-04-x64 \
#38835928
dotool-create(){
  imgtype=${3:-ubuntu-18-04-x64}; ## default image is ubuntu v18.04
  echo "Using $imgtype"
  doctl compute droplet create "$1" \
        --size 1gb  \
        --image "$imgtype" \
        --region sfo2 \
        --ssh-keys "$2" ## ssh key or fingerprint
  
  local new_ip=""
  local counter=0
  echo "Creating new node..."
  while [ "$new_ip" == "" ]; do
    new_ip=$(dotool-name-to-ip "$1")
    echo "$counter"
    counter=$(expr "$counter" + 1)
  done
  echo "New node $1 created at IP: $new_ip"
  echo "Node IP as variable '$1' has been added to your environment."
  # global ip for nodeholder to work on vs many ips in environment with aliases
  #echo "Nodeholder is prompted for '$1' at IP $new_ip" 

  #dotool-list | awk 'NR>1 {print $2"="$3}' | env -i 
  dotool-list | awk 'NR>1 {print "export "$2"="$3}' > node.list
  source ./node.list
}

dotool-delete(){
  doctl compute droplet delete "$1"
}

dotool-id-to-ip(){
  local id=$1
  doctl compute droplet get "$id" \
      --no-header \
      --format "Public IPv4"
}

dotool-name-to-ip(){
  local id
  id=$(dotool-list | grep "$1 " | awk '{print $1}');
  dotool-id-to-ip "$id"
}

dotool-login(){
  ## log in to the droplet via name of droplet
  ssh root@"$(dotool-name-to-ip "$1")"
}

dotool-status(){
  ssh root@"$(dotool-name-to-ip "$1")" '
  echo ""
  echo "vmstat -s"
  echo "----------"
  vmstat -s
  echo ""
  df
'
}

dotool-upgrade(){
  ssh root@"$(dotool-name-to-ip "$1")" "
      apt -y update
      apt -y upgrade
"
}

dotool-loop-image(){
  udisksctl loop-setup -f  "$1"
  #mkdir /mnt/$1
  echo "replace X: mount /dev/loopXp1 /mnt/$1" 
}
dotool-possibilites(){
  echo ""
  echo "All private and public images available to clone"
  echo "------------------------------------------------"
  doctl compute image list --public --format "ID,Name"
  echo ""
  echo "All available locations"
  echo "-----------------------"
  doctl compute region list
}

##################################################################
# node- collection of shell functions for remote
# DEPLOYMENT
# CONFIGURATION
# PORTMAPPINGS
# MANAGEMENT
# MONITORING
# BACKUP
##################################################################

nodeholder-test() {

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

  #local args=($@);
  #local pointer=0;
  #while [ ! $# -eq 0 ]
  #  do
  #    echo "${args[pointer]}"
  #    pointer=$(expr $pointer + 1);
  #    shift
  #  done
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

node-config(){
  local ip_addr=$(dotool-name-to-ip "$1");
  local config_file=$2;
  #local admin_file=$3;

  # copy config.sh to the remote machine
  scp "$config_file" root@"$ip_addr":"$config_file"
 
  # location where daemonize is on mother node
  local dpath_local="/home/admin/src/daemonize/daemonize";
  
  # location for daemonize on child node
  local dpath_remote="/bin/daemonize";

  # copy daemonize to the remote machine
  scp "$dpath_local" root@"$ip_addr":"$dpath_remote"

  # source configuration and configure machine
  ssh root@"$ip_addr" '
      source "'$config_file'" && config-init
      echo "Deploy \"from a distance\" application with admin.sh"
      echo "--or--"
      echo "Log in to remote host"
      echo "local> dotool-login <droplet>"
'
  # copy and source admin functionality
  # scp "$admin_file" admin@"$ip_addr":"$admin_file"
  
  # instruct user on next steps
  echo "
  Setup application with admin- from local machine to remote host
  --or--
  Log in to remote host with 'dotool-login <droplet>'
  "
}

node-remote-admin-init() {
  local ip_addr=$(dotool-name-to-ip $1);
  ssh admin@"$ip_addr" 'source admin.sh && zach-admin-init'
}

##########################################################################
# screen-
#   methods for shell based communication. 
#
##########################################################################

# https://serverfault.com/questions/104668/create-screen-and-run-command-without-attaching

screen-list(){
  screen -list 
}
screen-detach(){
  echo "Type ctrl-a d" 
}
screen-start-devops(){
  screen -dmS devops    # create detached devops channel
}
screen-start-dev(){
  screen -dmS dev  
}
screen-start-production(){
  screen -dmS production
}

screen-stop-all(){
   screen -X devops 
   screen -X production 
   screen -X dev 
}
screen-connect-devops(){
  screen -x devops
}

screen-connect-dev(){
  screen -x dev
}

screen-connect-production(){
  screen -x production
}

zgit(){
  git config --global user.email "zoverhulser@gmail.com"
  git config --global user.name "Zach Overhulser"
}

mgit(){
  git config --global user.email "mike.ricos@gmail.com"
  git config --global user.name "Mike Ricos"
}

##########################################################################
# enctool-
#  encryption tool for managing TLS certs, etc.
##########################################################################
enctool-cert()
{
    certbot certonly --manual \
        --preferred-challenges=dns-01 \
        --agree-tos -d ./*."$1" # pass domainname.com

}

##########################################################################
# rctool-
#   reseller club api for mananging domain names from a distance. 
##########################################################################
rctool-help() {
    echo "rctool is  collection of Bash scripts which makes interfacing
to Reseller Club's Domain Name Management API easier. More API info:

https://manage.resellerclub.com/kb/node/1106

You are using RC_APIKEY = $RC_APIKEY
"
}

rctool-init(){
    RCTOOL_ENV="./resellerclub/env.sh" # must be set prior to calling
    # shellcheck source=/dev/null    
    [ -f "$RCTOOL_ENV" ] &&  source "$RCTOOL_ENV"
}

rctool-list-a() {
    # https://manage.resellerclub.com/kb/node/1106
    http "https://test.httpapi.com/api/dns/manage/search-records.json?auth-userid=$RC_USERID&api-key=$RC_APIKEY&domain-name=$1&type=A&no-of-records=50&page-no=1"
}

rctool-list-txt() {
    http "https://test.httpapi.com/api/dns/manage/search-records.json?auth-userid=$RC_USERID&api-key=$RC_APIKEY&domain-name=$1&type=TXT&no-of-records=50&page-no=1"
}

rctool-add-txt() {
    http "https://test.httpapi.com/api/dns/manage/add-txt-record.json?auth-userid=$RC_USERID&api-key=$RC_APIKEY&host=$RC_HOST&domain-name=$1&value=$2"
}

rctool-update-txt() {
    http "https://test.httpapi.com/api/dns/manage/update-txt-record.json?auth-userid=$RC_USERID&api-key=$RC_APIKEY&host=$RC_HOST&domain-name=$1&value=$2"
}


rctool-delete-txt() {
    http "https://test.httpapi.com/api/dns/manage/delete-txt-record.json?auth-userid=$RC_USERID&api-key=$RC_APIKEY&host=$RC_HOST&domain-name=$1&value=$2"
}
