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

dotool-ls(){
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
  id=$(dotool-ls | grep "$1 " | awk '{print $1}');
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
node-config(){
  local ip_addr=$1;
  local config=${2:-config.sh};

  # copy config.sh to the remote machine
  scp "$config" root@"$ip_addr":"$config"
  
  # copy daemonize to the remote machine
  scp /home/admin/src/daemonize/daemonize root@"$ip_addr":daemonize

  ssh root@"$ip_addr" '
      source "'$config'" && config-init
      echo "Deploy \"from a distance\" application with admin.sh"
      echo "--or--"
      echo "Log in to remote host"
      echo "local> dotool-login <droplet>"
'
}

##########################################################################
# screen-
#   methods for shell based communication. 
##########################################################################
screen-start(){
  screen -S devops  # create devops channel
}
screen-connect(){
  screen -x devops 
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
