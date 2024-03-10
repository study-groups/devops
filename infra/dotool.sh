#!/bin/bash
##################################################################
# devops.sh is a collection of Bash functions which provide
#
#       Stage          Tool               Description
#  1. PROVISIONING    dotool       - creates vpn, droplets with tetra key
#
#  2. CONFIGURATION   tetra_ssl    - calls remote:nh-config-init
#
#  3. PORTMAPPINGS    tetra_       - creates Nginx config files (consul)
#                     {ufw,nginx,ssl,service}
#
#  4. DEPLOYMENT      tetra_       -sets up remote:apps from repos (nomad)
#                     {nginx,redis,postgres}
#
#  5. MANAGEMENT      tetra_service  start, stop and configure apps (nomad)
#
#  6. MONITORING      watchdog        monitors all known remote:nodes (consul)
#
#  7. LOGGING         nectar       maintains logfile rotation,etc (consul)
#
#  8. BACKUP          tetra_sync     rsync wrapper with conventions (consul)
#
##################################################################

##################################################################
# dotool- is a collection of bash-like shell functions for 
# PROVISIONING which provide a wrapper around Digital Ocean's
# doctl commandline program.
##################################################################
dotool-help(){
  echo "
  dotool version 20.11

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
  #doctl compute droplet list \
  #    --format "ID,Name,PublicIPv4,Region,Volumes" | cut -c -80
  doctl compute droplet list \
      --format "ID,Name,PublicIPv4,Region,Volumes"
}

dotool-ls-long(){
  ## shows the verbose list of virtual servers that we have up
  doctl compute droplet list \
      --format "ID,Name,Memory,Disk,Region,Features,Volumes"
}

#--image ubuntu-18-04-x64 \
#38835928
dotool-create(){
  if [ $# -lt 2 ]; then
    echo "Command requires at least name and fingerprint (or id)"
    echo "dotool-create name <fingerprint|id> [image]"
    return 1
  fi

  #imgtype=${3:-ubuntu-18-04-x64}; ## default image is ubuntu v18.04
  #dotool-ossibilities lists this; 72067660    20.04 (LTS) x64 
  imgtype=${3:-ubuntu-22-04-x64}; ## default image is ubuntu v20.04
  echo "Using $imgtype"
  ## $2 is an ssh key or fingerprint
  doctl compute droplet create "$1" \
        --size 1gb  \
        --image "$imgtype" \
        --region sfo2 \
        --ssh-keys "$2" > /dev/null 

  local new_ip=""
  local counter=0
  echo "Creating new node..."
  
  # while the server is being created
  while [ "$new_ip" == "" ]; do
    # ping the server till you get a response
    new_ip=$(dotool-name-to-ip "$1")
    echo "$counter"
    # count up till remote server is created
    counter=$(expr "$counter" + 1)
  done
  echo "New node $1 created at IP: $new_ip"
  
  # creates/renews server.list
  dotool-create-server-list
}

dotool-delete(){

  if [ $# -lt 1 ]; then
    echo "Command requires the name or id of the droplet"
    echo "dotool-delete <name|id>"
    return 1
  fi

  # delete ip
  doctl compute droplet delete "$1"
    
  local ip=$(dotool-name-to-ip "$1");

  # while the server is still pingable
  while [ "$?" -eq 0 ]; do
    echo "Deleting..."
    # ping for the server till it no longer exists
    dotool-name-to-ip "$1" > /dev/null 2>&1
  done

  # server is deleted
  echo "Deleted $1 IP:$ip"

  # unsets deleted node variable by finding the ip and corresponding node name
  unset "$(cat ~/server.list | grep "$ip" | awk -F"=" '{ print $1 }')" 
 
  # renews server list
  dotool-create-server-list
}

dotool-id-to-ip(){

  if [ $# -lt 1 ]; then
    echo "Command requires the id of the droplet"
    echo "dotool-id-to-ip id"
    return 1
  fi

  local id="$1";
  echo "dotool-id-to-ip thinks the id is $1"
  doctl compute droplet get "$id" \
      --no-header \
      --format "Public IPv4"
}

## this will accept the id and return the correct ip as well
dotool-name-to-ip(){

  if [ $# -lt 1 ]; then
    echo "Command requires the name of the droplet"
    echo "dotool-name-to-ip name"
    return 1
  fi

  local id
  id=$(dotool-list | grep "$1 " | awk '{print $1}');
  dotool-id-to-ip "$id"
}

dotool-status(){

  if [ $# -lt 1 ]; then
    echo "Command requires the name of the droplet"
    echo "dotool-status name"
    return 1
  fi

  ssh root@"$(dotool-name-to-ip "$1")" '
  echo ""
  echo "vmstat -s"
  echo "----------"
  vmstat -s
  vmstat -s
  echo ""
  echo ""
  df
'
}

dotool-upgrade(){

  if [ $# -lt 1 ]; then
    echo "Command requires the name of the droplet"
    echo "dotool-upgrade name"
    return 1
  fi

  ssh root@"$(dotool-name-to-ip "$1")" "
      apt -y update
      apt -y upgrade
"
}

dotool-loop-image(){

  if [ $# -lt 1 ]; then
    echo "Command requires the name of the file"
    echo "dotool-loop-image name"
    return 1
  fi

  udisksctl loop-setup -f  "$1"
  #mkdir /mnt/$1
  echo "replace X: mount /dev/loopXp1 /mnt/$1" 
}

dotool-floating(){
  doctl compute floating-ip list
}

dotool-floating-assign(){
  local fip="$1"
  local droplet="$2"
  doctl -v compute floating-ip-action assign "$fip" "$droplet"
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

dotool-create-server-list() {
  # list all servers
  # skip the title info (NR>1)
  # define variables {print $2"="$3}
  # replace any named servers that have "-" in the name with "_"
  # write to server.list
  dotool-list | awk 'NR>1 {print $2"="$3}' \
              | tr '-' '_' \
              > \
	  /tmp/server.list

  dotool-floating | awk '$2~"nyc" {print "floatingEast=" $1} \
                         $2~"sfo"{print "floatingWest=" $1}' >> \
	  /tmp/server.list


  source /tmp/server.list
  if [ -z $TETRA_DIR ];
    then
       cat /tmp/server.list
       rm /tmp/server.list
    else
      echo "Writing $TETRA_DIR/server.list"
      cat /tmp/server.list > $TETRA_DIR/server.list
      rm /tmp/server.list
    fi
} 

