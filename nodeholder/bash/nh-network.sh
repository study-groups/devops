nh-network-ip(){
  echo "Add function using ip that gives summary of network interface modules."
  echo "(the objects shown by ifconfig)"
  echo "Note that when docker is running, it starts its own network interfaces."
  echo ""
  ip -br addr
}
