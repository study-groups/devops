ADMIN="$1";  

# updates os
apt-get update
apt-get -y upgrade

# installs required dependencies
apt -y install nginx
apt -y install snapd
snap install node --classic --channel=14
node -v
apt-get remove certbot
snap install --classic certbot
apt -y install postgresql postgresql-contrib

# adds admin with name provided from user 
adduser --disabled-password \
  --ingroup sudo \
  --gecos "" \
  $ADMIN

# copies ssh key from root and provides to admin
# gives admin remote access to children nodes
mkdir /home/$ADMIN/.ssh
cp /root/.ssh/authorized_keys /home/$ADMIN/.ssh/authorized_keys
chown -R $ADMIN:admin /home/$ADMIN/.ssh
chmod 0700 /home/$ADMIN/.ssh
chmod 0600 /home/$ADMIN/.ssh/authorized_keys

# provides auto-sourcing of admin functionality when logged in
echo -e "\nif [ -f ~/.nh-admin.sh ]; then\n\t. ~/.nh-admin\nfi" >> \
  /home/$ADMIN/.bashrc

# removes password requirement when admin uses sudo  
echo "%sudo   ALL=(ALL:ALL)  NOPASSWD: ALL" >> /etc/sudoers

# allows for HTTP and HTTPS 
ufw allow 'Nginx Full'
systemctl status nginx

echo "
  remote configuration file v 001
  -------------------------------
  Mother node successfully configured.
  user:$ADMIN still requires admin functionality.
  Work from a distance or log in with user:$ADMIN
"
