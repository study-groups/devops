doX-create-app() {
  ssh admin@$doX "sudo adduser --disabled-password --gecos '' $1"
}
doX-delete-app() {
ssh admin@$doX "sudo mv /home/$1 /tmp/$1.$(date +%s);  sudo deluser $1"
}
