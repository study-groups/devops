root-install-services(){
  dnf -y install nginx php-cli php-fpm 
  dnf -y install ufw
}

root-install-docker(){
  dnf -y install dnf-plugins-core
  dnf config-manager \
    --add-repo \
    https://download.docker.com/linux/fedora/docker-ce.repo

  dnf install docker-ce docker-ce-cli containerd.io docker-compose-plugin
}

root-mount-volumes(){
  # this comes from Digital Ocean Volumes control panel
  mountpt="/mnt/volume_nyc1_02"
  volume="/dev/disk/by-id/scsi-0DO_Volume_volume-nyc1-02"

  [ ! -z $mountpt ] && mkdir -p $mountpt

  mount -o discard,defaults,noatime $volume $mountpt; 

  cat <<EOF
  Add this to /etc/fstab to set each reboot:
  $volume $mountpt ext4 defaults,nofail,discard 0 0 
EOF
}

root-create-group-devops(){
  groupadd devops
}

root-create-user-devops(){
  root-create-user devops #/home/devops
}


root-delete-user(){
  userdel -r $1
  cat<<EOF

User $1 removed. Use visudo to edit sudoer file.

root ALL=(ALL) ALL           # keep this
mynewuser ALL=(ALL) ALL      # delete this

EOF
}


root-create-user(){
    # --gecos "" # removes prompt for fingerprint
    local user=$1
    local homedir="/home/$user"

    useradd  \
      --home $homedir \
      $user 

    sudo -u $user mkdir $homedir/.ssh
    sudo -u $user touch $homedir/.ssh/authorized_keys

    # recursively set ownership of everything in .ssh 
    # to devops user and devops group
    chown -R $user:$user $homedir/.ssh

    chmod 0700 $homedir/.ssh
    chmod 0600 $homedir/.ssh/authorized_keys

    # -m creates in RSA format suitable for PEM
    sudo -u $user ssh-keygen \
    -N "" -q  
    -m PEM \
    -f  $homedir/.ssh/id_rsa \
    -C  "$user-$(date +%Y-%m-%d)"

cat<<EOF

Run visudo to add sudo powers 

root ALL=(ALL) ALL       # should already be there
%devops ALL=(ALL) ALL    # if devops group is available
mynewuser ALL=(ALL) ALL  # add this 

EOF
}

