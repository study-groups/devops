source bash/nh.sh

ip=$doZ
remoteAdmin="ssh admin@$ip source admin.sh &&"
remoteSae="ssh sae@$ip source nh.sh && "
remoteLta="ssh lta@$ip source nh.sh && "
remoteNc="ssh nc@$ip source nh.sh && "

user_file=./bash/nh-app.sh
$remoteAdmin nh-admin-create-role nc 
scp $user_file nc@$ip:~/nh.sh

nh-remote-create-role $ip lta
scp $user_file lta@$ip:~/nh.sh
#$remoteAdmin nh-admin-create-role sae

#web
