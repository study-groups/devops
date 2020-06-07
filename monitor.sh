
monitor-help(){
  echo "\
Monitor is a set of shell functions for monitoring unix servers."
}

monitor-all(){
  local user="mricos"
  local host="ux305-2.local"
  ssh $user@$host landscape-sysinfo
}
