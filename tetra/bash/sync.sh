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
  local exclude="--exclude={'.git','*.zip','*.gz','.DS_Store','ds-env'}"
  local params="-avzP" # archive,verbose,compress,Partial
  echo rsync $params $exclude  "$TETRA_DIR/" \
  "$TETRA_REMOTE_USER@$TETRA_REMOTE:$TETRA_REMOTE_DIR"
}

tetra_sync_tetra_from () { 
    local exclude="--exclude='.git' --exclude='*.zip' --exclude='*.gz' \
                   --exclude='/nvm' --exclude='/ds-env'";
    local params="-avzP";
    echo rsync $params $exclude \
    "$TETRA_REMOTE_USER@$TETRA_REMOTE:${TETRA_REMOTE_DIR}/" "$TETRA_DIR"
}


tetra_sync_tetra_from_BROKEN(){
  local exclude="--exclude={'.git','*.zip','*.gz','nvm','ds-env'}"
  local params="-avzP" # archive,verbose,compress,Partial
  echo rsync $params $exclude \
    "$TETRA_REMOTE_USER@$TETRA_REMOTE:${TETRA_REMOTE_DIR}/" "$TETRA_DIR"
}

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

tetra_sync_find_since(){
  local since=${1:-"1 hour ago"}
  #find / -newermt $(date +%Y-%m-%d -d "1 min ago") -type f -print
  find / -newermt $(date +%Y-%m-%d -d "$since") -type f -print
}

tetra_sync_notes(){
  echo "

  sync- relies on rsync:
    https://linux.die.net/man/1/rsync

  It currently does not implement in-memory synchronization.
  See man sync for that.

"
}

