## Find the key you'd like to use
dotool-keys

## Create the node
dotool-create name key

## Node references are added to env and aliases.sh is created

## Go to /ubuntu

## Send config file to your new node
### *where ip can now be $node_name because of the env
nodeholder-config ip configFile

## Send admin file to your new node
nodeholder-admin-install ip adminFile


# Other options

## Delete the node
dotool-delete name
