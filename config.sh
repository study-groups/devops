USER=root      # config starts with Root
NEWUSER=devops # ends by handing over to this user
GIT_USER="Mike Ricos"
GIT_EMAIL="mike.ricos@gmail.com"

config-help(){
  echo "
  remote configuration file v 001
  -------------------------------
  Run this remotely via local machine via:
   1) scp config.sh ssh root@host:config.sh
   2) ssh root@host: \"source config.sh && config-init\"
"
}

config-devtools(){
 apt-get install build-essential autoconf linux-headers-$(uname -r)

if test -x ./autogen.sh; then ./autogen.sh; else ./configure; fi && make && sudo make install || echo "Build Failed"

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

config-mount-image-help(){
  echo "
The loop device is a block device that maps its data blocks not to a
physical device such as a hard disk or optical disk drive, but
to the blocks of a regular file in a filesystem or to another
block device. - from man loop.

This function grabs the next free loop device (map to a file),
creates a directory in /mnt and mounts the /dev/loopXp1 where
/dev/loopX is the disk image and /dev/loopXp1 is the first 
partition of the image.
"

}

config-mount-image() {
  # $1 is the file name that will be mapped to /mnt/filename_p1
  sentence=$(udisksctl loop-setup -f $1)  # returns /dev/loopX
  words=($sentence)
  devpath=${words[-1]} #last word with . at end. eg: /dev/loop4.
  devpath=${devpath::-1}  #removes last char
  devpath="${devpath}p1"  #add partition
  mkdir /mnt/$1
  echo $devpath
  mount "$devpath" /mnt/$1
}

config-unmount(){
  unmount $1 # typically $1 = /mnt/imagename
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
  config-update-os
  config-add-user
  config-copy-keys
  config-install-apps
  config-start-apps
  config-security
}
