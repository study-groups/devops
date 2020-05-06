#!/bin/env bash
mode=live # anything but live will be a dryrun.

TO="/mnt/volume_sfo2_02"
TO_HOST="mricos@ux305-2.local"
TO_DIR="/home/mricos/backups"
FROM=/home/mricos/files/

sync-help(){
  echo "\
Sync is a collection shell functions for continual backup of unix servers."
}
sync-from-to() {
  local from=$1 # full path
  local to="$2"
  to="$to/$HOSTNAME/$from"
  local params="-avzP" # archive,verbose,compress,Partial
  cmd=$(echo rsync $params "$from" "$to")
  echo $cmd
  [ $mode = "xlive" ] && exec $cmd
}

sync-from() {
  local from=$1
  local to="$TO"
  sync-from-to $from $to
}

sync-to() {
  local to=$1
  local from="$FROM"
  sync-from-to $from $to
}
sync-all() {
  local from="$FROM"
  sync-from-to $FROM "$TO_HOST:/$TO_DIR"
}
sync-notes(){
  echo "
Rsync is an important part of the interent:

  https://linux.die.net/man/1/rsync

It works like rcp (remote copy) which works like cp.

It currently does not implement in-memory synchronization.
See man sync for that.

ip addr show dev eth0
"
}
