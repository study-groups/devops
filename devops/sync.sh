#!/bin/env bash
mode=live # anything but live will be a dryrun.
SYNC="/home/mricos/src/study-groups/devops-study-group/sync.sh"

TO_MNT="/mnt/volume_sfo2_02"
TO_USER="mricos"
TO_HOST="ux305-2.local"
TO_DIR="/home/mricos/backups"
FROM=/home/mricos/files/

sync-help(){
  echo "\
Sync is a collection shell functions for continual backup of unix servers."
}
sync-space(){
 du -hsx * | sort -rh | head -4 2> /tmp/err
}

sync-from-to() {
  local from_dir=$1 # full path
  local to_user="$2"
  local to_host="$3"
  local to_dir="$4"
  local from_hostname=$HOSTNAME
  local to_path="$to_dir/$from_hostname/$from_dir"
  local mkdircmd="ssh $to_user@$to_host mkdir -p $to_path"
  local to_total="$to_user"@"$to_host":"$to_path"
  local params="-avzP" # archive,verbose,compress,Partial
  cmd=$(echo rsync $params "$from_dir" "$to_total")
  echo "$mkdircmd; $cmd" # copy and paste to execute
  #[ $mode = "not-live" ] && exec $cmd    # not live
}

sync-from() {
  sync-from-to $1 $TO_USER $TO_HOST $TO_PATH
}

sync-to() {
  local to_user=$1
  local to_host=$2
  local to_path=$3
  sync-from-to $FROM $to_user $to_host $to_path
}

sync-all() {
  local from="$FROM"
  sync-from-to $FROM $TO_USER $TO_HOST $TO_DIR
}

sync-notes(){
  echo "
sync- relies on the master rsync:

  https://linux.die.net/man/1/rsync

It works like rcp which works like cp.

It currently does not implement in-memory synchronization.
See man sync for that.

ip addr show dev eth0
"
}
