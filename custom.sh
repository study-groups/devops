# 
# Encrypt this file before committing to project directory
# Given custon.sh.enc example's passphrase is devops4real

# Decrypt:
# gpg --output custom.sh --decrypt custom.sh.enc 

# Encrpyt:
# gpg --output custom.sh.enc 
#     --symmetric --cipher-algo AES256 custom.sh

dir="/home/admin/src/devops-study-group"
source $dir/dotool.sh 
source $dir/sync.sh 
source ~/server.list
source $dir/nodeholder/bash/nh-remote.sh

#   tmux new -s devops
#   tmux attach -t devops
export RC_APIKEY=XXXXXXXXXXXXXXXXXXXXXXXXXXX
export RC_USERID=YYYYYYY

PS1="admin@do4> "
nginxAccess="/var/log/nginx/access.log"
nginxError="/var/log/nginx/error.log"
syslog="/var/log/syslog"

agit(){
  git config --global user.email "userA@gmail.com"
  git config --global user.name "Developer A"
}

bgit(){
  git config --global user.email "userB@hotmail.com"
  git config --global user.name "Developer B"
}

sed-whitespace(){
  sed 's/[ \t]*$//' "$1"
}
sed-whitespace-inplace(){
  sed -i 's/[ \t]*$//' "$1"
}

ip=$do1
remoteAdmin="ssh admin@$ip source admin.sh &&"
remoteSae="ssh sae@$ip source nh.sh && "
remoteLta="ssh lta@$ip source nh.sh && "
remoteNc="ssh nc@$ip source nh.sh && "
