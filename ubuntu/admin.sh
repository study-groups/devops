USER=admin      # config starts with Root, created this admin previously

admin-help(){
  echo "\
Admin is a collection of scripts to configure runtime operations. 
  -------------------------------
  Run this remotely via local machine via:
   1) scp admin.sh ssh admin@host:admin.sh
   2) ssh admin@host: \"source admin.sh && admin-init\"

  Requires:
    - running as admin

  Configures a Unix server and account for process 'containers'
  addresseble by system defined TCP sockets. 
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

config-start-apps(){
  su $NEWUSER
  cd /home/$NEWUSER/apps/scrapy
  scrapy check
}

# This local functions will be called. Comment out as needed.
config-init(){
  config-update-os
  config-add-user
  config-copy-keys
  config-install-apps
  config-start-apps
  config-security
}
