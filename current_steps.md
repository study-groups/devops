<style>
body{
  background-color:#ccc;
  margin-left:2rem;
}
.markdown-body h2{
  border:0px solid black;
}
</style>
# How to create a node

## Assumptions
- logged in as admin@mother (mother means it has nh-remote commands)
- assume DigitalOcean API key is set up. See `dotool-info`
- source nodeholder/nh-remote.sh
- source dotool.sh (You can add these to the .bashrc of admin@mother)

#### Find the key you'd like to use
DigitalOcean is a Platform as a Service. You must upload at least
one public SSH key prior to this step. To see a list of keys that 
have been uploaded to your profile:

- `dotool-keys`

#### Create the node
`> dotool-create` `name` `key` `[image]` (image: defaults to ubuntu 18.04)
- server.list is created and sourced into current shell
- automatically updates node reference(s)
- A node reference is a key:value pair named after your node,   
e.g. `echo $your_node`

#### Choose image configuration
- go to ./ubuntu

#### Send config file to configure your new node
`> nh-remote-config-init` `$ip` `config_file`
- where `$ip` is the node reference dereferenced in the shell

#### Send admin file to install nhadmin role on your new node
`> nh-remote-install-admin` `$ip` `admin_file`

#### Create a role with which to manage your application
`> nh-remote-admin-create-role` `$ip` `role`

#### To get public ssh key for use in repo
`> nh-remote-get-key-from-role` `$ip` `role`
- retrieves public ssh key from a role (linux user) which can be manually added to a user account on a repo cloud service in order to clone private repositories

#### Clone app under specific role
`> nh-remote-create-app` `$ip` `role` `repo_url` `[branch]` `[app]`
- `branch` defaults to `master` if not provided
- `app` defaults to name of application from repo service

#### Installs dependencies/Builds application
`> nh-remote-app-build` `$ip` `role` `app`

#### If required, adds environment variables to the application's environment
`> nh-remote-add-env-var` `$ip` `role` `app` `var_name` `value`

#### Starts application
`> nh-remote-app-start` `$ip` `role` `app` 

#### Stops application
`> nh-remote-app-stop` `$ip` `role` `app`

#### Checks application status
`> nh-remote-app-status` `$ip` `role` `app`

#### Checks application log
`> nh-remote-app-log` `$ip` `role` `app`

#### Checks application errors
`> nh-remote-app-err` `$ip` `role` `app`


# Other options

## Delete the nodeholder
`> dotool-delete` `node_name`


# Todo
- nodeholder-stop or similar needs to be written
  - would call doX-stopAllNodes on all apps/nodes
    - doX-stopAllApps calls

# Dev Notes
## Relationship of Nodeholder's apps and roles to Unix commands and processes
- app is to role and command is to process
- example: ls is a command that runs in a process
