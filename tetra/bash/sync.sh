#!/bin/env bash
mode=notlive # anything but live will be a dryrun.
SYNC="/home/admin/src/study-groups/devops-study-group/sync.sh"
TO_MNT="/mnt/volume_sfo2_02"
TO_USER="mricos"
TO_HOST="ux305-2.local"
TO_DIR="/home/mricos/backups"
FROM_DIR=/home/mricos/files/

tetra_sync_help(){
  echo "
    Sync is a collection shell functions for continual backup of unix servers.
    Output is string that can be verified before wrapping in \$() to execute.
"
}
tetra_sync_space(){
 du -hsx * | sort -rh | head -4 2> /tmp/err
}

tetra_sync_tetra_to(){
  local exclude="--exclude={'.git','*.zip','*.gz'}"
  local params="-avzP" # archive,verbose,compress,Partial
  echo rsync $params $exclude  "$HOME/tetra/" "$TETRA_USER@$1:~/tetra"
}

tetra_sync_tetra_from(){
  local exclude="--exclude={'.git','*.zip','*.gz'}"
  local params="-avzP" # archive,verbose,compress,Partial
  echo rsync $params $exclude  "$USER@$1:~/tetra/" "$HOME/tetra"
}
export tetra_sync_tetra_from

tetra_sync_from(){
  local exclude="--exclude={'.git','*.zip','*.gz'}"
  local params="-avzP" # archive,verbose,compress,Partial
  local host=$1
  local from=${2-"/mnt/volume_sfo2_02"}
  local local=${3-"."}
  local user=${4-"$USER"}
  cmd=$(echo rsync $params $exclude  "$user@$host:$from" "$local")
  echo "Copy and paste to execute (for safety):" 
  echo $cmd
}

tetra_sync_to_old() {
  local params="-avzP" # archive,verbose,compress,Partial
  local exclude="--exclude={'.git','*.zip','*.gz'}"
  local from=$1
  local to_user=$2
  local to_host=$3
  local to_path=$4
  cmd=$(echo rsync $params $exclude  $from $to_user@$to_host:$to_path )
  echo "$cmd"
}

tetra_sync_to() { 
    local params="-avzP"
    local excludes=("--exclude='.git'" "--exclude='*.zip'" "--exclude='*.gz'")
    local from="$1"
    local to_user="$2"
    local to_host="$3"
    local to_path="$4"
    local cmd="rsync $params"
    
    for exclude in "${excludes[@]}"; do
        cmd+=" $exclude"
    done
    
    cmd+=" '$from' ${to_user}@${to_host}:'$to_path'"
    
    echo "$cmd"
    #eval "$cmd"
}


tetra-sync-find-since(){
  local since=${1:-"1 hour ago"}
  #find / -newermt $(date +%Y-%m-%d -d "1 min ago") -type f -print
  find / -newermt $(date +%Y-%m-%d -d "$since") -type f -print
}

tetra-sync-notes(){
  echo "
sync- relies on the master rsync:

  https://linux.die.net/man/1/rsync

It works like rcp which works like cp.

It currently does not implement in-memory synchronization.
See man sync for that.

ip addr show dev eth0
"
}
