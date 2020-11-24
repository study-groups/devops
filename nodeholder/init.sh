source <(cat bash/nh-*)

echo "All the  nh- commands."

return 1 # comment out to install.

echo "Installing apps."
# Option one using prefix
user_file=./bash/nh-app.sh
$remoteAdmin nh-admin-create-role nc 
scp $user_file nc@$ip:~/nh.sh

# Option 2 passing parameter to new function 
nh-remote-create-role $ip lta
scp $user_file lta@$ip:~/nh.sh
