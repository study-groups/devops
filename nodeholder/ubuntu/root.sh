nh-config-help(){
  echo "
  remote configuration file v 001
  -------------------------------
  Run this remotely via local machine via:
   1) scp config.sh ssh root@host:config.sh
   2) ssh root@host: \"source nodeholder-config.sh && nh-config-init\"

  Requires:
    - running as root
    - new user name, usually admin as it will be added to sudo group.

  Configures a server for api hosting and data federated  processing.
  "
}

# updates os
nh-config-update-os(){
  apt-get update
  apt-get -y upgrade
}

# install required dependencies
nh-config-install-deps() {
  apt -y install nginx
  apt -y install snapd
  snap install node --classic --channel=14
  node -v
  apt-get remove certbot
  snap install --classic certbot
}

nh-config-install-postgres() {
  # set up user in here too
  apt -y install postgresql postgresql-contrib
}

nh-config-add-admin(){
    adduser --disabled-password \
	    --ingroup sudo \
	    --gecos "" \
	    admin
}

nh-config-security(){
  echo "%sudo   ALL=(ALL:ALL)  NOPASSWD: ALL" >> /etc/sudoers
  ufw allow 'Nginx Full'
  systemctl status nginx
}

nh-config-init-ssh(){
# Requires first argument to be publc key.
  mkdir ~/.ssh
  chmod 0700 ~/.ssh
  touch ~/.ssh/authorized_keys
  echo $1 > ~/.ssh/authorized_keys
  chmod 0600 ~/.ssh/authorized_keys
}

nh-config-copy-keys(){
  mkdir /home/admin/.ssh
  cp /root/.ssh/authorized_keys /home/admin/.ssh/authorized_keys
  chown -R admin:admin /home/admin/.ssh
  chmod 0700 /home/admin/.ssh
  chmod 0600 /home/admin/.ssh/authorized_keys
}

# Much tighter. Moves most stuff to admin phase.
nh-config-init(){
  nh-config-update-os
  nh-config-install-deps
  nh-config-add-admin
  nh-config-copy-keys
  nh-config-security
}
