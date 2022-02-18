
# updates os
nh-root-update-os() {
  apt-get update
  apt-get -y upgrade
}

# installs required dependencies
nh-root-install-deps() {
  apt -y install nginx
  apt -y install snapd
  snap install node --classic --channel=14
  node -v
  apt-get remove certbot
  snap install --classic certbot
  # set up user in here too
  apt -y install postgresql postgresql-contrib
}


# admin in child has less access to root privileges
nh-root-create-admin() {
  
  local admin="$1";

  adduser --disabled-password \
  --ingroup admin \
  --gecos "" \
  $admin
}


# copies ssh key from root and provides to admin
# gives admin remote access to children nodes
nh-root-provide-key() {
  
  local admin="$1";

  mkdir /home/$admin/.ssh
  cp /root/.ssh/authorized_keys /home/$admin/.ssh/authorized_keys
  chown -R $admin:admin /home/$admin/.ssh
  chmod 0700 /home/$admin/.ssh
  chmod 0600 /home/$admin/.ssh/authorized_keys
}

nh-root-secure() {
  # allows for HTTP and HTTPS
  ufw allow 'Nginx Full'
  systemctl status nginx
}

nh-root-config-init() {
  
  local admin="$1";
  
  nh-root-update-os
  nh-root-install-deps 
  nh-root-create-admin "$admin"
  nh-root-provide-key "$admin"
  nh-root-secure

  echo "
  Remote Child Configuration File v 001
  -------------------------------
  Child node successfully configured.
  First admin role as: $admin
  " 
}


