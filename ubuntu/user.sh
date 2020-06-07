USER=admin      # config starts with Root
NEWUSER=nectar # ends by handing over to this user
GIT_USER="mlenan" # Not necessary, belongs in user config
GIT_EMAIL="mlenan@study-groups.org"

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

  Configures a python-centric server for data gathering and 
  cleaning. App specific stuff should be taken out and made into
  user-nectar-collector.sh.
"
}

config-install-apps(){
  mkdir /home/$NEWUSER/src/
  mkdir /home/$NEWUSER/apps/
  chown $NEWUSER:$NEWUSER  /home/$NEWUSER/src
  chown $NEWUSER:$NEWUSER  /home/$NEWUSER/apps
  cd /home/$NEWUSER/src/
  git clone https://github.com/study-groups/dataops-study-group.git
  chown $NEWUSER:$NEWUSER /home/$NEWUSER/src
  cp -r /home/$NEWUSER/src/dataops-study-group\
/scraping/scrapy /home/$NEWUSER/apps
  chown $NEWUSER:$NEWUER /home/$NEWUSER/apps
  cd ~
}

config-git() {
  git config --global  user.name $GIT_USER 
  git config --global user.email $GIT_EMAIL 
}

config-start-apps(){
  su $NEWUSER
  cd /home/$NEWUSER/apps/scrapy
  scrapy check
}

# This local functions will be called. Comment out as needed.
config-init(){
  config-add-user
  config-copy-keys
  config-install-apps
  config-start-apps
}
