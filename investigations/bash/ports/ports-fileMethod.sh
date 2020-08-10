#requres available_ports and enabled_ports files in home dir
admin-create-port-fileMethod(){
  # get top of file
  local dir="./available_ports"
  local available_ports=($(cat ./available_ports))
  local new_port=${available_ports[0]}; 
  echo $new_port
  # write all but the first (pop the port from list)
  printf "%s\n" "${available_ports[@]:1}" > ./available_ports
}
################################################
# Bash Introspection via internal arrays
#  BASH_LINENO[@]  
#  BASH_SOURCE[@]
#  FUNCNAME[@]     # call-stack
#
#  admin-do-something
#    admin-log some message
#
# Inside admin-log:
#  admin-log           <- FUNCNAME[0]
#   admin-do-something <- FUNCNAME[1]
################################################
function admin-log-info() {
  echo "len of BASH_LINENO: ${#BASH_LINENO[@]}"
  echo "len of BASH_SOURCE: ${#BASH_SOURCE[@]}"
  echo "len of FUNCNAME: ${#FUNCNAME[@]}"
  echo "LINENO: ${LINENO}"
  echo "FUNCNAME[0]: ${FUNCNAME[0]}"
  echo "FUNCNAME[1]: ${FUNCNAME[1]}"
  echo "BASH_LINENO[0] : ${BASH_LINENO[0]}"
  echo "BASH_LINENO[1] : ${BASH_LINENO[1]}"
  echo "BASH_SOURCE[0] : ${BASH_SOURCE[0]}"
  echo "BASH_SOURCE[1] : ${BASH_SOURCE[1]}"

  # print Bash function stack
  for f in "${FUNCNAME[@]}"
  do
    echo "$f"
  done
}

admin-log(){
  local funcname=${FUNCNAME[1]} # get function that called this
  echo $(date +%s) $funcname $@ >> ./log
}


#https://stackoverflow.com/questions/3685970/\
#check-if-a-bash-array-contains-a-value
admin-delete-port(){

  [ -z $1 ] && admin-log "no port entered" && return -1
  local port=$1
  local dir=/home/admin/ports
  local ports=( $(ls $dir) )

  if printf '%s\n' ${ports[@]} | grep -q -w "$1"; then  #quiet, word
    echo "true"
  else
    echo "false"
  fi

  [[ " ${ports[@]} " =~ " ${port} " ]] \
    && admin-log "rm -rf $dir/$port" && rm -rf $dir/$port \
    || echo "false"
}
