# How to create a nodeholder

## assumptions
sourced devops.sh, nodeholder/index.sh

## Find the key you'd like to use
dotool-keys

## Create the nodeholder
dotool-create name key (image: defaults to ubuntu 18.04)

## Automatically updates nodeholder reference(s)
- name=ip key,value added to current shell env 
- aliases.sh is created and sourced into current shell

## Choose image configuration
- go to ./ubuntu

## Send config file to your new nodeholder
### *where ip can now be $node_name because of the env
nodeholder-config ip configFile

## Send admin file to your new nodeholder
nodeholder-admin-install ip adminFile

## Aliases would be the next steps from here



# Other options

## Delete the nodeholder
dotool-delete name

# Todo
- nodeholder-stop or similar needs to be written
  - would call doX-stopAllNodes on all apps/nodes
    - doX-stopAllApps calls

# Dev Notes
## Relationship of Nodeholder's apps,nodes to Unix commands and processes
- app is to node and command is to process
- example: ls is a command that runs in a process
