<style>
@import url('https://fonts.googleapis.com/css?family=Ubuntu');
@import url('https://fonts.googleapis.com/css?family=Ubuntu+Mono'); 
body {  
  background-color: #bbb;
  font-family: Ubuntu;
} 
#container {  
  display: flex;  
  justify-content: center;  
  align-items: center;  
  height: 100vh;
} 
#terminal {  
  width: 70vw;  
  height: 20vh;  
  box-shadow: 2px 4px 10px rgba(0,0,0,0.5);
} 
#terminal__bar {  
  display: flex;  
  width: 100%;  
  height: 30px;  
  align-items: center;  
  padding: 0 8px;  
  box-sizing: border-box;  
  border-top-left-radius: 5px;  
  border-top-right-radius: 5px;  
  background: linear-gradient(#504b45 0%,#3c3b37 100%);
} 
#bar__buttons {  
  display: flex;  
  align-items: center;
} 
.bar__button {  
  display: flex;  
  justify-content: center;  
  align-items: center;  
  padding: 0;  
  margin-right: 5px;  
  font-size: 8px;  
  height: 12px;  
  width: 12px;  
  box-sizing: border-box;  
  border: none;  
  border-radius: 100%;  
  background: linear-gradient(#7d7871 0%, #595953 100%);  
  text-shadow: 0px 1px 0px rgba(255,255,255,0.2);  
  box-shadow: 0px 0px 1px 0px #41403A, 0px 1px 1px 0px #474642;
}
.bar__button:hover {  
  cursor: pointer;
}
.bar__button:focus {  
  outline: none;
}
#bar__button--exit {  
  background: linear-gradient(#f37458 0%, #de4c12 100%);    
  background-clip: padding-box;
} 
#bar__user {   
  color: #d5d0ce;  
  margin-left: 6px;  
  font-size: 14px;  
  line-height: 15px;
} 
#terminal__body {  
  background: rgba(56, 4, 40, 0.9);  
  font-family: 'Ubuntu Mono';  
  height: calc(100% - 30px);  
  padding-top: 2px;  
  margin-top: -1px;
} 
#terminal__prompt {  
  display: flex;
}
#terminal__prompt--user {  
  color: #7eda28;
}
#terminal__prompt--location { 
  color: #4878c0;
}
#terminal__prompt--bling {  
  color: #dddddd;
}
#terminal__prompt--cursor {  
  display: block;  
  height: 17px;  
  width: 8px;  
  margin-left: 9px;  
  animation: blink 1200ms linear infinite;
} 
@keyframes blink {  
  0% {    
    background: #ffffff;  
  }  
  49% {    
    background: #ffffff;  
  }  
  60% {    
    background: transparent;  
  }  
  99% {    
    background: transparent;  
  }  100% {    
    background: #ffffff;  
  }
} 
@media (max-width: 600px) {  
  #terminal {    
    max-height: 90%;    
    width: 90%;  
  }
}

</style>


  <div id="terminal">
    <!-- Terminal Bar -->       
    <section id="terminal__bar">          
      <div id="bar__buttons">            
        <button class="bar__button" id="bar__button--exit">&#10005;</button>            
        <button class="bar__button">&#9472;</button>                
        <button class="bar__button">&#9723;</button>          
      </div>          
      <p id="bar__user">user@ubuntu: ~</p>        
    </section>        
    <!-- Terminal Body -->        
    <section id="terminal__body">          
      <div id="terminal__prompt">            
        <span id="terminal__prompt--user">user@ubuntu:</span>            
        <span id="terminal__prompt--location">~</span>            
        <span id="terminal__prompt--bling">$ nh-remote-</span>         
      </div>        
    </section>      
  </div>    


# How to create a node

## Assumptions
- logged in as admin@mother (mother means it has nh-remote commands)
- DigitalOcean API key is set up. See `dotool-info` or   
https://www.digitalocean.com/docs/droplets/how-to/add-ssh-keys/to-account/
- `source dotool.sh` (You can add this to the .bashrc of admin@mother)
- `source nh-remote.sh` (You can add this to the .bashrc of admin@mother)

#### See available commands 
- `nh-remote-` followed by `<tab>`
- Running any function without an argument will display help.

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
- DigitalOcean is a Platform as a Service. You must upload at least
one public SSH key prior to this step.  
- To see the list of keys that has been uploaded to your profile use `dotool-keys`
<div class="terminal">bash> dotool-keys
ID          Name            FingerPrint
22222222    abc@do99         aa:aa:aa:aa:aa:aa:aa:aa:aa:aa:aa:aa:aa:aa:aa:aa 
33333333    admin@do88       bb:aa:aa:aa:aa:aa:aa:aa:aa:aa:aa:aa:aa:aa:aa:aa 
</div>

#### Create the node
`> dotool-create name <fingerprint|id> [image]` 
- `image` defaults to `ubuntu 20.04`
- `~/server.list` is created in the home directory of current user and sourced into current shell.
- Automatically updates node reference(s) as shell variables.
- A node reference is a key:value pair named after your node, i.e. node_name=ip
- Keep in mind: If you use a hyphen (`node-name`) as a name for a node, it will be converted to an underscore (`node_name`) in the shell, because the shell doesn't interpret hyphens as part of variables. 

#### Choose image configuration
- Go to ./ubuntu

#### Send config file to configure your new node
`> nh-remote-install-config $ip config_file`
- Where `$ip` is the node reference dereferenced in the shell
- Configuring requires installing packages; currently takes 1.5 minutes
for Ubuntu node. 
<div class="terminal">bash> nh-remote-install-config $ip root.sh
</div>

#### Choose admin tools
- In ./ubuntu

#### Send admin file to bestow nodeholder functionality to admin
`> nh-remote-install-admin $ip admin_file`
<div class="terminal">bash> nh-remote-install-admin $ip admin.sh
</div>

#### Create a role with which to manage your application
`> nh-remote-admin-create-role $ip role`
<div class="terminal">bash> nh-remote-create-role $ip webdev
</div>

#### (Optional) Get public ssh key from role
`> nh-remote-get-key-from-role $ip role`
- Retrieves public ssh key from a role (linux user) which can be manually added to a user account on a repo cloud service in order to clone private repositories.

<div class="terminal">bash> nh-remote-get-key-from-role $ip webdev
ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQCFsCNkXajxfM/it8BQds2p4yx+zY9JkO3IGcymPqqV<br/>HIHRTuliEK3Rc0Kl7M7PbzIQQkeIMSWnbhIqVtXwAKL8hJBeAaDd301NVLtum4gJAM2TesYxGun<br/>snDr7OLjlml71hu60rkZh2MYVQY6IJLwY4y+NS/DLnOqFWH1YPgSepv8phhKFrGs6RqGXL/OaNf<br/>63NaNFV96YacNepXG3Org+fJOGXaKLnIuIXR1jizNUszEvm75jkGaJe44NIHpqkOi/Jf5utfTpf<br/>kOsM+t6/IcFlFtFl5DzFAHtf3s/+h/YpM6GMX128r2X1fMvBiCPqKsfWR90ZV6pIGFGaj8eiN7H 
</div>

#### Clone app under specific role
`> nh-remote-create-app $ip role repo_url [app_name] [branch]`
- `app_name` defaults to name of application from repo service.
- `branch` defaults to `master` if not provided.
<div class="terminal">bash> nh-remote-create-app $ip webdev https://gitlab.com/user/app.git myApp development-branch
</div>

#### Install dependencies
`> nh-remote-app-install-deps $ip role app`
<div class="terminal">bash> nh-remote-app-install-deps $ip webdev myApp
</div>

#### Build application
`> nh-remote-app-build $ip role app`
<div class="terminal">bash> nh-remote-app-build $ip webdev myApp
</div>

#### If required, add environment variables to the application's environment
`> nh-remote-add-env-var $ip role app var_name value`
<div class="terminal">bash> nh-remote-add-env-var $ip webdev myApp DEV_ENV development 
</div>

#### Start application
`> nh-remote-app-start $ip role app` 
<div class="terminal">bash> nh-remote-app-start $ip webdev myApp
</div>

#### Stop application
`> nh-remote-app-stop $ip role app`
<div class="terminal">bash> nh-remote-app-stop $ip webdev myApp
</div>

#### Check application status
`> nh-remote-app-status $ip role app`
<div class="terminal">bash> nh-remote-app-status $ip webdev myApp
</div>

#### Check application log
`> nh-remote-app-log $ip role app`
<div class="terminal">bash> nh-remote-app-log $ip webdev myApp
</div>

#### Check application errors
`> nh-remote-app-err $ip role app`
<div class="terminal">bash> nh-remote-app-err $ip webdev myApp
</div>

## Other options

#### Delete node
`> dotool-delete <node_name|id>`

# Todo
- nodeholder-stop or similar needs to be written
  - would call doX-stopAllNodes on all apps/nodes
    - doX-stopAllApps calls
