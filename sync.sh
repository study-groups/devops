#!/bin/env bash
#mode=dryrun # anything but live will be a dryrun.

TO="/mnt/volume_sfo2_02"

sync-help(){
  echo "
  sync- is a collection shell functions that use rsync:

  https://linux.die.net/man/1/rsync

  It works like rcp (remote copy) which works like cp.

  It currently does not implement in-memory synchronization.
  See man sync for that.

  ip addr show dev eth0
"
}

sync-from() {
  local from=$1
  local to="$TO/$from"
  local params="-rva"
  mkdir -p "$to"
  #echo "dryrun: rsync $params $from $to/$from"
  rsync $params "$from/" "$to"
}
