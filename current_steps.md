# How to create a nodeholder

## assumptions
sourced devops.sh, nodeholder/index.sh

## Find the key you'd like to use
dotool-keys

## Create the nodeholder
dotool-create name key (image: defaults to ubuntu 18.04)

## Automatically updates nodeholder reference(s)
- name=ip key,value added to current shell env 
- server.list is created and sourced into current shell

## Choose image configuration
- go to ./ubuntu

## Send config file to your new nodeholder
### *where ip can now be $node_name because of the env
nodeholder-configure ip configFile

## Send admin file to your new nodeholder
nodeholder-admin-install ip adminFile

## Create node in which to hold application
nodeholder-create-node ip nodeName

## To get public ssh key for use in repo
nodeholder-get-key-from-node ip nodeName
- Retrieves public ssh key which can be manually added to
a user account in order to clone private repositories.

## Clone app to node
nodeholder-clone-app ip nodeName repoUrl **branch** **appName**
branch defaults to master if not provided
appName defaults to name of application from repo service
**optional**

## Installs dependencies/Builds application
nodeholder-app-build ip nodeName appName

## If required, adds environment variables to the application's environment
nodeholder-add-env-var ip nodeName appName varName varValue

## Starts application
nodeholder-app-start ip nodeName appName

## Checks application status
nodeholder-app-status ip nodeName appName

## Stops application
nodeholder-app-stop ip nodeName appName


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
