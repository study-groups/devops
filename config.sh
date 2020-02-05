USER=root
NEWUSER=devops

config-help(){
  echo "
  remote configuration file v 001
  -------------------------------
  Run this remotely via local machine via:
   1) scp config.sh ssh user@host:config.sh
   2) ssh user@host: "source config.sh && config-init"
  Or by:
    dotool-config
"
}

config-update-os(){
  apt-get update
  apt-get -y upgrade
  apt-get -y purge python3.6
  apt-get -y purge python
  apt-get -y install python3.6
  apt-get -y install python3-pip
  #pip3  install scrapy
  #pip3 install SQLAlchemy
}

config-add-user(){
  useradd -m -s /bin/bash $NEWUSER
  usermod -a -G sudo $NEWUSER
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

##################################################
## DESKTOP
##################################################
config-desktop-help() {
  echo """
Script functions for configuring UNIX desktop.
"""
}

config-desktop-xfce4-terminal() {
  local outfile=~/.config/xfce4/terminal/terminalrc
  touch "$outfile"
  echo """
[Configuration]
ColorForeground=#b7b7b7
ColorBackground=#131926
ColorCursor=#0f4999
ColorSelection=#163b59
ColorSelectionUseDefault=FALSE
ColorBold=#ffffff
ColorBoldUseDefault=FALSE
ColorPalette=#000000;#aa0000;#44aa44;#aa5500;#0039aa;#aa22aa;#1a92aa;#aaaaaa;#777777;#ff8787;#4ce64c;#ded82c;#295fcc;#cc58cc;#4ccce6;#ffffff
FontName=DejaVu Sans Mono 17
MiscAlwaysShowTabs=FALSE
MiscBell=FALSE
MiscBellUrgent=FALSE
MiscBordersDefault=TRUE
MiscCursorBlinks=FALSE
MiscCursorShape=TERMINAL_CURSOR_SHAPE_BLOCK
MiscDefaultGeometry=80x24
MiscInheritGeometry=FALSE
MiscMenubarDefault=FALSE
MiscMouseAutohide=FALSE
MiscMouseWheelZoom=TRUE
MiscToolbarDefault=FALSE
MiscConfirmClose=TRUE
MiscCycleTabs=TRUE
MiscTabCloseButtons=TRUE
MiscTabCloseMiddleClick=TRUE
MiscTabPosition=GTK_POS_TOP
MiscHighlightUrls=TRUE
MiscMiddleClickOpensUri=FALSE
MiscCopyOnSelect=FALSE
MiscShowRelaunchDialog=TRUE
MiscRewrapOnResize=TRUE
MiscUseShiftArrowsToScroll=FALSE
MiscSlimTabs=FALSE
MiscNewTabAdjacent=FALSE
TabActivityColor=#0f4999
""" > $outfile


}

config-desktop-chrome() {
wget https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb \
     -P /tmp

sudo dpkg -i /tmp/google-chrome-stable_current_amd64.deb

}


config-desktop-all() {
  confg-desktop-chrome
}
