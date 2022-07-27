# Dotool 
## Summary
[dotool](https://github.com/study-groups/devops-study-group/blob/main/dotool.sh)
is a wrapper around Digital Ocean's doctl commandline 
application. It is used to create virtual private servers, manipulate
cloud storage and define virtual private networks.  It generates
variables used by Tetra.


## Man page
```txt
man(8)                         dotools man page                         man(8)

NAME
       dotool is a set of shell functions for securely provisioning virtual
       private machines and networks at Digital Ocean. It relies on doctl.

SYNOPSIS
       dotool-[OPTIONS]

DESCRIPTION
       dotool uses doctl and assumes you have a Digital Ocean API key.  It  is
       run  by  sourcing  dotool.sh  into your shell. Type dotool-<tab> to see
       possible commands. Type 'type dotool-option' to see the code  for  that
       option.

OPTIONS
       info   shows local configuration info

       list   list all droplets

       keys   show publlic SSH keys uploaded at Digital Ocean

       create create droplet, returns IP address of new instance

EXAMPLES
       Pick public key ID of local computer running dotools:
              dotool-keys

       Creates machine at IP = $name:
              dotool-create keyId name type

       Shows newly created machineName:
              dotool-list

       Execute ps on remote machine:
              ssh  root@$machineName 'ps  -eo pid,cmd,%mem,%cpu --sort=-%mem |
              head'

       Show various droplets to clone from:
              dotool-possibilites

```
## Examples
```bash
$> source dotool.sh
$> dotool-<tab>
dotool-create              dotool-id-to-ip            dotool-ls-long
dotool-create-server-list  dotool-info                dotool-name-to-ip
dotool-delete              dotool-keys                dotool-possibilites
dotool-floating            dotool-list                dotool-status
dotool-floating-assign     dotool-login               dotool-upgrade
dotool-help                dotool-loop-image
```
