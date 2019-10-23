NODEUSERS_DIR="/root/devops/dousers/"
nodeuser-help() {
  echo "
  nodeuser is a collection of Bash functions for syncing up 
  Unix accounts on different machines.
"
}

nodeuser-ls(){
  ls -d $NODEUSERSDIR */
}

nodeuser-add(){
  mkdir $NODEUSERSDIR/$1
  adduser --disabled-password \
	  --shell /bin/bash \
          $1
}

nodeuser-sync() {
  douser-info
  # trailing / on source means 'get the content of dir'
  # no trailing / means 'get directory name and its contents'
  rsync -avz  root@$remote:/home/$remoteuser/ /home/$localuser
  chown -R $localuser:$localuser /home/$localuser 
}

nodeuser-set() {
  source  $DOUSERS_DIR/$1/.env
}

nodeuser-info() {
  echo "
  Local user: $localuser
  Remote user: $remoteuser
  Remote server: $remote 
"
}

nodeuser-keygen() {
  # Create a key stored in ~$localuser/.ssh/id_rsa 
  sudo -u $localuser ssh-keygen 

  # Copy key to root on upsteam. Assumes $remote has been defined
  ssh-copy-id $remoteuser@$remote 

}
