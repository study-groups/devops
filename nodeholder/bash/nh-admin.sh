# Source these functions as admin. 

# Explains use of admin
nh-admin-help(){
  echo "\
  Admin is a collection of scripts to configure runtime operations.

  Configures a Unix server and account for process 'containers'
  addresseble by system defined TCP sockets. 
  "
}

# logs commands used as admin
nh-admin-log(){
  local funcname=${FUNCNAME[1]} # get function that called this
  echo $(date +%s) $funcname $@ >> /home/admin/log
}

# creates role(user) on local machine
nh-admin-create-role() {
  local role="$1";

  sudo adduser --disabled-password --gecos "" $role
  
  # copy admin key from root to user, so that admin may have access
  sudo mkdir /home/$role/.ssh
  sudo cp /home/admin/.ssh/authorized_keys \
	  /home/$role/.ssh/authorized_keys

  # create ownership and groups
  sudo chown -R $role:$role /home/$role/.ssh
  sudo chmod 0700 /home/$role/.ssh
  sudo chmod 0600 /home/$role/.ssh/authorized_keys
  # creates new ssh-key
  sudo -u $role ssh-keygen -N "" -q -f /home/$role/.ssh/id_rsa \
	  -C "$role-$(date +%Y-%m-%d)"
}

# removes role and 
# kills all current processes working under that role
nh-admin-remove-role() {
  local role="$1";

  sudo pkill -9 -u "$role"
  sudo deluser --remove-home "$role" ## --backup --backup-to
}

# Directory creation time is self timestamped.
nh-admin-create-port(){
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

# deletes port file
nh-admin-delete-port(){
  nh-admin-log $@
  [ -z $1 ] && nh-admin-log "no port entered" && return -1
  local port=$1
  local dir=/home/admin/ports
  local ports=( $(ls $dir) )

  if printf '%s\n' ${ports[@]} | grep -q -w "$port"; then  #quiet, word
    echo "true"
  else
    echo "false"
  fi

  [[ " ${ports[@]} " =~ " ${port} " ]] \
    && nh-admin-log "rm -rf $dir/$port" && rm -rf $dir/$port \
    || echo "false"
}


nh-admin-create-key(){
  nh-admin-log $@
  ssh-keygen -C $1 -f /home/admin/.ssh/$1
}

#  $1 - full path to priv key in same dir as key.pub
#  This adds the priv/pub key pair to the admin's key ring
#  Not sure we want or need this.
nh-admin-add-key() {
  eval `ssh-agent`
  ssh-add $1
}

# clones app from repo onto local machine
# provides permissions to specified role
nh-admin-create-app(){
  nh-admin-log $@
  local role="$1";
  local repo_url="$2";
  local branch=${3:-"master"};
  local basename=$(basename $repo_url); # myapp.git
  basename=${basename%.*}; # myapp  (removes .git)
  local app=${4:-$basename};

  [ -z "$role" ] && 
    echo "Please provide name of role to use" && 
    return 1

  [ -z "$repo_url" ] && 
    echo "Please provide the repo from which to clone" && 
    return 1

  [ -d "/home/$role/$app" ] && 
	  echo "app dir exists, exiting" && return 1
  
  local port=$(nh-admin-create-port)
  nh-admin-log port=$port

  # signals to gitlab that it is authorized to clone from repo
  sudo -u $role ssh -T -o StrictHostKeyChecking=no git@gitlab.com
  # creates directory for application
  sudo -u $role mkdir /home/$role/$app 
  # clones application from specified branch into specified directory
  sudo -u $role git clone \
	  --single-branch \
	  --branch $branch \
	  $repo_url /home/$role/$app

  # if it didn't clone correctly, remove the directory
  [ $? -ne 0 ] && sudo -u $role rmdir /home/$role/$app && 
    echo "Application was unable to clone." && 
    return 1

  # if nh dir does not exist, copy dummy 
  # user should modify nh/start and check nh dir in.
  [ ! -d "/home/$role/$app/nh" ] && 
    sudo -u $role \
    cp -r ./app \
      /home/$role/$app/nh

  # need generic .gitlab-ci.yml

  sudo -u $role bash -c "echo $port > /home/$role/$app/nh/port"
  nh-admin-log created /home/$role/$app
}

# deletes application on local machine
nh-admin-delete-app(){
  nh-admin-log $@
  local role=$1
  local app=$2
  local port=$(cat /home/$role/$app/nh/port)
  sudo -u $role rm -rf /home/$role/$app
  echo "PORT: $port"
  nh-admin-delete-port $port
}

nh-admin-list-roles() {
  ls /home
}

nh-admin-monitor(){
  watch -n .5 '
    echo "/etc/group:"
    tail -5 /etc/group
    echo "ls /tmp:"
    ls -l /tmp
    echo "ls /home:"
    ls -l /home
  '
}

# sysadmin
nh-admin-unix-help() {
  echo "
Commands for system administration (to be orchestrated later)
passwd -l username   # locks but does not disable so SSH works
passwd --status username # shows status of password authentication for user
deluser --remove-all-files username --backup --backup-to DIRNAME
# deluer is procelin to userdel"
}
