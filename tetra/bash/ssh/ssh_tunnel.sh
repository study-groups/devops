tetra_ssh_tunnel(){
  local key_path=${1:-./username.pem}
  local local_port=${2:-9090}
  local user=${3:-username}
  local service=${4:-service}
  local host=${5:-nodeholder.com}
  local remote_port=${6:-3306}
  local user_host="$user@$host"
  local remote_host="$service.$username.$host"

  echo  ssh -i $key_path $user_host \
  -L $local_port:$remote_host:$remote_port
}

