#!/bin/env bash
mode=notlive # anything but live will be a dryrun.
SYNC="/home/admin/src/study-groups/devops-study-group/sync.sh"
TO_MNT="/mnt/volume_sfo2_02"
TO_USER="mricos"
TO_HOST="ux305-2.local"
TO_DIR="/home/mricos/backups"
FROM_DIR=/home/mricos/files/

sync-help(){
  echo "\
Sync is a collection shell functions for continual backup of unix servers."
}
sync-space(){
 du -hsx * | sort -rh | head -4 2> /tmp/err
}

sync-from(){
  local exclude="--exclude={'.git','*.zip','*.gz'}"
  local params="-avzP" # archive,verbose,compress,Partial
  local host=$1
  local from=${2-"/mnt/volume_sfo2_02"}
  local local=${3-"."}
  cmd=$(echo rsync $params $exclude  "root@$host:$from" "$local")
  echo "Copy and paste to execute (for safety):" 
  echo $cmd
}


sync-to() {
  local to_user=$1
  local to_host=$2
  local to_path=$3
  sync-from-to $FROM $to_user $to_host $to_path
}

sync-find-since(){
  local since=${1:-"1 hour ago"}
  #find / -newermt $(date +%Y-%m-%d -d "1 min ago") -type f -print
  find / -newermt $(date +%Y-%m-%d -d "$since") -type f -print
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
