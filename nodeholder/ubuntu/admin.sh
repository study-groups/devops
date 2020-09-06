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

admin-log(){
  local funcname=${FUNCNAME[1]} # get function that called this
  echo $(date +%s) $funcname $@ >> /home/admin/log
}

admin-create-node() {
  local node_name="$1";

  sudo adduser --disabled-password --gecos "" $node_name
  
  # copy admin key from root to user, so that admin may have access
  sudo mkdir /home/$node_name/.ssh
  sudo cp /home/admin/.ssh/authorized_keys \
	  /home/$node_name/.ssh/authorized_keys

  # create ownership and groups
  sudo chown -R $node_name:$node_name /home/$node_name/.ssh
  sudo chmod 0700 /home/$node_name/.ssh
  sudo chmod 0600 /home/$node_name/.ssh/authorized_keys
  sudo -u $node_name ssh-keygen -N "" -q -f /home/$node_name/.ssh/id_rsa \
	  -C "$node_name-$(date +%Y-%m-%d)"
}

admin-remove-node() {
  local node_name="$1";

  sudo pkill -9 -u "$node_name"
  sudo deluser --remove-home "$node_name" ## --backup --backup-to
}

# Directory creation time is self timestamped.
admin-create-port(){
  # get top of file
  local dir=/home/admin/ports
  [ ! -d "$dir" ] && mkdir /home/admin/ports
  local ports=($(ls $dir))
  local port=1025 # default first port

  # if no ports, length of ports array is 0
  # if one or more ports, add one to largest
  # [ true ] && true case 
  [  ${#ports} -ne 0 ] && port=$[ ${ports[-1]} + 1 ] 
  mkdir $dir/$port
  echo $port
  #echo "Made port entry $dir/$port"
}

#https://stackoverflow.com/questions/3685970/\
#check-if-a-bash-array-contains-a-value
admin-delete-port(){
  admin-log $@
  [ -z $1 ] && admin-log "no port entered" && return -1
  local port=$1
  local dir=/home/admin/ports
  local ports=( $(ls $dir) )

  if printf '%s\n' ${ports[@]} | grep -q -w "$port"; then  #quiet, word
    echo "true"
  else
    echo "false"
  fi

  [[ " ${ports[@]} " =~ " ${port} " ]] \
    && admin-log "rm -rf $dir/$port" && rm -rf $dir/$port \
    || echo "false"
}

admin-create-key(){
  admin-log $@
  ssh-keygen -C $1 -f /home/admin/.ssh/$1
}

#  $1 - full path to priv key in same dir as key.pub
#  This adds the priv/pub key pair to the admin's key ring
#  Not sure we want or need this.
admin-add-key() {
  eval `ssh-agent`
  ssh-add $1
}

admin-create-app(){
  admin-log $@
  local nodename=$1
  local repo_url=$2
  local basename=$(basename $repo_url); # myapp.git
  basename=${basename%.*}; # myapp  (removes .git)
  local app_name=${3:-$basename};
  [ -d "/home/$nodename/$app_name" ] && \
	  echo "app dir exists, exiting" && return -1
  
  local port=$(admin-create-port)
  admin-log port=$port

  sudo -u $nodename ssh -T -o StrictHostKeyChecking=no git@gitlab.com
  sudo -u $nodename mkdir /home/$nodename/$app_name 
  sudo -u $nodename git clone $repo_url /home/$nodename/$app_name

  # if it didn't clone correctly, remove the directory
  [ $? -ne 0 ] && sudo -u $nodename rmdir /home/$nodename/$app_name \
	  && echo "Application was unable to clone." \
	  && return 0

  # if nh dir does not exist, copy dummy 
  # user should modify nh/start and check nh dir in.
  [ ! -d "/home/$nodename/$app_name/nh" ] \
    && sudo -u $nodename \
        cp -r /home/admin/buildpak \
              /home/$nodename/$app_name/nh

  sudo -u $nodename bash -c "echo $port > /home/$nodename/$app_name/nh/port"
  admin-log created /home/$nodename/$app_name
}

admin-delete-app(){
  admin-log $@
  local nodename=$1
  local app_name=$2
  local port=$(cat /home/$nodename/$app_name/nh/port)
  sudo -u $nodename rm -rf /home/$nodename/$app_name
  echo "PORT: $port"
  admin-delete-port $port
}

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

admin-monitor(){
  watch -n .5 '
    echo "/etc/passwd:"
    tail -5 /etc/passwd
    echo "/etc/group:"
    tail -5 /etc/group
    echo "ls /tmp:"
    ls -l /tmp
    echo "ls /home:"
    ls -l /home
  '
}

# sysadmin
sysadmin-help() {
  echo "
Commands for system administration (to be orchestrated later)
passwd -l username   # locks but does not disable so SSH works
passwd --status username # shows status of password authentication for user
deluser --remove-all-files username --backup --backup-to DIRNAME
# deluer is procelin to userdel"
}
