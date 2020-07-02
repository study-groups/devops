
monitor-help(){
  echo "\
Monitor is a set of shell functions for monitoring unix servers."
}

monitor-all(){
  local user="admin"
  local host="$doX"
  ssh $user@$host landscape-sysinfo
}
