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

# belongs to mother
nodeholder-copy-file() {
  #local ip_addr=$(dotool-name-to-ip "$1");
  local ip_addr=$1;
  local admin_file="$2";
  scp "$admin_file" admin@"$ip_addr":"$admin_file"
}


### Zach's interpretation ###
admin-create-node() {
  local node_name="$1";

  sudo adduser --disabled-password --gecos "" $node_name
  
  # copy admin key from root to user, so that admin may have access
  sudo mkdir /home/$node_name/.ssh
  sudo cp /admin/.ssh/authorized_keys /home/$node_name/.ssh/authorized_keys

  # create ownership and groups
  sudo chown -R $node_name:$node_name /home/$node_name/.ssh
  sudo chmod 0700 /home/$node_name/.ssh
  sudo chmod 0600 /home/$node_name/.ssh/authorized_keys
}

admin-remove-node() {
  local node_name="$1";
  sudo deluser --remove-home "$node_name" ## --backup --backup-to
}

# Directory creation time is self timestamped.
admin-create-port(){
  # get top of file
  local dir=/home/admin/ports
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


admin-log(){
  local funcname=${FUNCNAME[1]} # get function that called this
  echo $(date +%s) $funcname $@ >> /home/admin/log
}


#https://stackoverflow.com/questions/3685970/\
#check-if-a-bash-array-contains-a-value
admin-delete-port(){
  admin-log $@
  [ -z $1 ] && admin-log "no port entered" && return -1
  local port=$1
  local dir=/home/admin/ports
  local ports=( $(ls $dir) )

  if printf '%s\n' ${ports[@]} | grep -q -w "$1"; then  #quiet, word
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
  ls ~/.ssh/
}
admin-create-app(){
  admin-log $@
  local nodename=$1
  local repo=$2
  local port=$(admin-create-port)
  admin-log port=$port 
  local repo_dir=/home/$nodename 
  # git clone $repo $repo_dir
  sudo -u $nodename mkdir /home/$nodename/$repo # placeholder for repo clone
  sudo -u $nodename cp -r /home/admin/buildpak /home/$nodename/$repo/nh
  sudo -u $nodename bash -c "echo $port > /home/$nodename/$repo/nh/port"
  admin-log created /home/$nodename/$repo
}

admin-delete-app(){
  admin-log $@
  local nodename=$1
  local repo=$2
  local port=$(cat /home/$nodename/$repo/nh/port)
  sudo -u $nodename rm -r /home/$nodename/$repo
  echo "PORT: $port"
  admin-delete-port $port
}

## needs work
admin-clone-repo() {

  local repo_url=$1;
  local basename=$(basename $repo_url); # myapp.git
  local app_name=${basename%.*}; # myapp  (removes .git)
  
  # must clone as user
  git clone $repo_url .

}

admin-daemonize-app() {

  # current working directory
  local cwd=$1;

  # command to run program
  local cmd=$2;

  # path to file
  local args=$3;
  
  echo "cwd: $cwd\n cmd: $cmd\n args: $args"
  
  # daemonize application running as admin
  daemonize \
	  -E PORT=4444 \
	  -c $cwd \
	  -p $cwd/pid \
	  -e $cwd/err \
	  -o $cwd/log \
	  "$cmd" "$args"
}

zach-admin-init() {
  local app_name="node-hello-world"
  local app_repo="https://github.com/zoverlvx/$app_name.git"
  #admin-create-paths  # creates /home/admin/{src,apps}
  mkdir /home/admin/src/   # where apps are developed
  admin-clone-app $app_repo
  app-build
  app-start
}

####End of Zach's interpretation #####

admin-install-sae(){
  # presume src directory exists
  cd /home/admin/src/

  local app_name=sentiment-analysis-engine
  local repo_url="https://gitlab.com/zoverlvx/$app_name.git";
  git clone $repo_url

  # presumes repo contains a directory called app that can be
  # served from this system.
  local app_dir="/home/admin/apps/$app_name"    # production app
  mkdir $app_dir
  cp -r /home/admin/src/$app_name/bin $app_dir  # change to match repo

  # set pwd to home for next function call
  cd /home/admin
}


admin-install-apps(){

  # make room for repos and app deployment.
  mkdir /home/admin/src/   # where apps are developed
  mkdir /home/admin/apps/  # where apps are deployed to production 

  admin-install-sae
}

admin-start-apps(){
# Start node servers (ports are currently defined by user, later system)

    # Future: loop over directories in  /home/admin/apps and call init.sh

    node /home/admin/apps/sentiment-analysis-engine/bin/www.js
}

# This local functions will be called. Comment out as needed.
admin-init(){
  zach-admin-init
  #admin-install-apps
  #admin-start-apps
}

userdir="/home/admin"
pidfile="$userdir/src/node-hello-world/nodeholder/development/app.pid"
stopfile="$userdir/src/node-hello-world/nodeholder/development/stop"
startfile="$userdir/src/node-hello-world/nodeholder/development/start"
statusfile="$userdir/src/node-hello-world/nodeholder/development/status"

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


admin-get-pid(){
  local pid=$(cat $pidfile);
  echo $pid 
}

admin-app-status(){
  echo using PID file:  $pidfile
  echo Using status file:  $statusfile
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

# File starts below.
####################################################################
# This should be defined in an env file.
APP_DIR="/home/admin/src/node-hello-world"
SRC_DIR="$APP_DIR/src"
NODE_DIR="$APP_DIR/nodeholder"

app-status(){
   $statusfile
}
app-stop(){
   $stopfile
}
app-start(){
   $startfile
}
# Inject PORT NUMBER HERE
app-build(){
  cp -r $SRC_DIR/www.js $NODE_DIR/development/www.js
  cp  ~/buildpak/* $NODE_DIR/development/
  echo "node-hello-world" > $NODE_DIR/development/app.name
}
