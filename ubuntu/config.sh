USER=root      # config starts with Root
NEWUSER=admin # ends by handing over to this user

config-help(){
  echo "
  remote configuration file v 001
  -------------------------------
  Run this remotely via local machine via:
   1) scp config.sh ssh root@host:config.sh
   2) ssh root@host: \"source config.sh && config-init\"

  Requires:
    - running as root
    - new user name, usually admin as it will be added to sudo group.

  Configures a server for api hosting and data federated  processing.
"
}

config-update-os(){
  apt-get update
  apt-get -y upgrade
}

# Adding a sudo user is the main point of config.sh
##config-add-user(){
##  useradd -m -s /bin/bash $NEWUSER
##  usermod -a -G sudo $NEWUSER
##}

config-add-user(){
    adduser --disabled-password \
	    --ingroup sudo \
	    --gecos "" \
	    $NEWUSER
}

config-security(){
  echo "%sudo   ALL=(ALL:ALL)  NOPASSWD: ALL" >> /etc/sudoers
}

config-copy-keys(){
  mkdir /home/$NEWUSER/.ssh
  cp /root/.ssh/authorized_keys /home/$NEWUSER/.ssh/authorized_keys
  chown -R $NEWUSER:$NEWUSER /home/$NEWUSER/.ssh
  chmod 0700 /home/$NEWUSER/.ssh
  chmod 0600 /home/$NEWUSER/.ssh/authorized_keys
}

# Much tighter. Moves most stuff to admin phase.
config-init(){
  config-update-os
  config-add-user
  config-copy-keys
  config-security
}
