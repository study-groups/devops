source ./*.sh
ip=$doZ
remoteAdmin="ssh admin@$ip source admin.sh &&"
remoteSae="ssh sae@$ip source nh.sh && "
remoteLta="ssh lta@$ip source nh.sh && "
remoteNc="ssh nc@$ip source nh.sh && "
