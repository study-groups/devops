<style>
body{
  background-color:#ccc;
  margin-left:2rem;
}
.markdown-body h2{
  border:0px solid black;
}

.terminal{
  background-color:#111;
  font-family: courier;
  color:#ccc;
  width:80%;
  margin:auto;
  padding-left:1em;
  font-size:small;
  width:80em;
  white-space:pre;
}
</style>
# How to create a node

## Assumptions
- logged in as admin@mother (mother means it has nh-remote commands)
- assume DigitalOcean API key is set up. See `dotool-info` or   
https://www.digitalocean.com/docs/droplets/how-to/add-ssh-keys/to-account/
- source dotool.sh (You can add these to the .bashrc of admin@mother)
- source nh-remote.sh (You can add these to the .bashrc of admin@mother)

#### To see available commands 
- `nh-remote-` followed by `<tab>`
- Running the function without an arguement will display help.

<div class="terminal">
bash> nh-remote-
nh-remote-add-env-var        nh-remote-config-init
nh-remote-admin-create-role  nh-remote-create-app
nh-remote-app-build          nh-remote-delete-app
nh-remote-app-err            nh-remote-get-key-from-role
nh-remote-app-log            nh-remote-install-admin
nh-remote-app-start          nh-remote-refresh-admin
nh-remote-app-status         nh-remote-remove-role
nh-remote-app-stop           
</div>


#### Find the key you'd like to use
DigitalOcean is a Platform as a Service. You must upload at least
one public SSH key prior to this step.  
To see the list of keys that has been uploaded to your profile use:
`> dotool-keys`
<div class="terminal">bash> dotool-keys
ID          Name            FingerPrint
22222222    abc@do99         aa:aa:aa:aa:aa:aa:aa:aa:aa:aa:aa:aa:aa:aa:aa:aa 
33333333    admin@do88       bb:aa:aa:aa:aa:aa:aa:aa:aa:aa:aa:aa:aa:aa:aa:aa 
</div>

#### Create the node
`> dotool-create name <fingerprint|id> [image]` 
- `image` defaults to `ubuntu 20.04`
- `server.list` is created in the home directory of current user `~/server.list` and sourced into current shell.
- Automatically updates node reference(s) as shell variables.
- A node reference is a key:value pair named after your node, i.e. node_name=ip
- Keep in mind: If you use a hyphen (`node-name`) as a name for a node, it will be converted to an underscore (`node_name`) in the shell, because the shell doesn't interpret hyphens as part of variables. 

#### Choose image configuration

- go to ./ubuntu


#### Send config file to configure your new node
`> nh-remote-install-config $ip config_file`
- where `$ip` is the node reference dereferenced in the shell
- Configuing requires installing packages, currently takes 1.5 minutes
for unbuntu node. 


#### Send admin file to install nhadmin role on your new node
`> nh-remote-install-admin $ip admin_file`


#### Create a role with which to manage your application
`> nh-remote-admin-create-role $ip role`

<div class="terminal">bash> nh-remote-create-role $ip webdev
</div>

#### Get public ssh key from role
`> nh-remote-get-key-from-role $ip role`
- retrieves public ssh key from a role (linux user) which can be manually added to a user account on a repo cloud service in order to clone private repositories

<div class="terminal">bash> nh-remote-get-key-from-role $ip webdev
ssh key here
</div>

#### Clone app under specific role
`> nh-remote-create-app $ip role repo_url [branch] [app]`
- `branch` defaults to `master` if not provided
- `app` defaults to name of application from repo service

#### Installs dependencies/Builds application
`> nh-remote-app-build $ip role app`

#### If required, adds environment variables to the application's environment
`> nh-remote-add-env-var $ip role app var_name value`

#### Starts application
`> nh-remote-app-start $ip role app` 

#### Stops application
`> nh-remote-app-stop $ip role app`

#### Checks application status
`> nh-remote-app-status $ip role app`

#### Checks application log
`> nh-remote-app-log $ip role app`

#### Checks application errors
`> nh-remote-app-err $ip role app`


## Other options

#### Delete node
`> dotool-delete (node_name|id)`


# Todo
- nodeholder-stop or similar needs to be written
  - would call doX-stopAllNodes on all apps/nodes
    - doX-stopAllApps calls

# Dev Notes
## Relationship of Nodeholder's apps and roles to Unix commands and processes
- app is to role and command is to process
- example: ls is a command that runs in a process
