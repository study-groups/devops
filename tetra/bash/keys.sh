# generate an RSA key of size 2048 bits
# -C Comment
org=tetra
user=devops
keydir=~/tetra/keys
remote=$TETRA_REMOTE # do4-n2
sshkey=$keydir/$user
pemfile=$keydir/$user.pem
now="$(date +%Y-%m-%d)"

tetra-keys-make-ssh(){
cat<<EOF
Creating ssh keys and PEM for $user at $remote, file at
sshkey: $sshkey
pemfile: $pemfile
EOF
  ssh-keygen -t rsa -b 2048 -m pem -f $sshkey -C "$user@$org-$now"
}

# copy key to federation and add to authorized_keys

tetra-keys-make-pem(){
  # convert private key to PEM format
  openssl rsa -in $sshkey -outform PEM -out $pemfile
  chmod 600 $pemfile
}

tetra-keys-ssh-agent(){
cat <<EOF

Starting ssh-agent, learn more:
https://www.ssh.com/academy/ssh/agent

EOF
 killall ssh-agent
 eval "$(ssh-agent -s)"
}


tetra-keys-add(){
  #tetra-keys-ssh-agent # kills and restarts
  ssh-add $1
}

# test key
tetra-keys-login-federated(){
  ssh -i $pemfile $user@$remote -p 22
}

# add a passphrase
tetra-keys-passphrase-check(){
  ssh-keygen -p -f $pemfile
}

# does it have a passphrase
tetra-keys-passphrase-add(){
  ssh-keygen -y -f $pemfile
}
