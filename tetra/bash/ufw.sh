tetra_ufw_allow() {
  # Store commands in an array
  declare -a commands=(
    "ufw reset"
    "ufw default deny incoming"
    "ufw default allow outgoing"
  )

  # Loop through all arguments to create UFW rules
  for ip in "$@"; do
    commands+=("ufw allow from $ip to any port 22")
    commands+=("ufw allow from $ip to any port 80")
    commands+=("ufw allow from $ip to any port 443")
  done

  # Append enabling and status check commands
  commands+=("ufw enable" "ufw status")

  # Print commands to stdout
  for cmd in "${commands[@]}"; do
    echo "sudo $cmd"
  done
}

