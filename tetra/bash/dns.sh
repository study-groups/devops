tetra_dns_whatsmyip(){
  public_ip=$(curl -s https://api.ipify.org)

  # Check if the curl command was successful
  if [ $? -eq 0 ]; then
    echo "Your public IP address is: $public_ip"
  else
    echo "Failed to retrieve public IP address."
  fi

}
