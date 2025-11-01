# Tetra: command line linux tools.

Source `~/tetra/tetra.sh`. Your shell now has 178 functions
to make running your own server with open source software.

## What is the jist of Tetra?

Tetra eliminates the need for Docker and instead helps 
orchestrate the "CRUD" of long running applications.

Tetra creates, replaces, updates and deletes 
long running processes that span machines in their own
process-namespace.

## Can it do Linux admin?

Yes. A lot of it. In general, when you have your 
Tetra hat on you should not have to remember a single
linux command. You type `tetra-` followed by `<tab>` 
and you will see functions starting with:

```
tetra-tmux
tetra-ssh
tetra-ufw
tetra-nvm
tetra-pyenv
tetra-fail2ban
tetra-user
tetra-sync
tetra-sudo
tetra-systemd
tetra-nginx
```

`tetra-<tab>` is how you do most things. Save your brain for other things.

## Where does Tetra store its data?
Tetra stores its data in `$TETRA_DIR/data` which is typicallay `$HOME/tetra/data`.


## Where does Tetra store its processing environements?
Tetra stores its data in `$TETRA_DIR/bin` which is typicallay `$HOME/tetra/bin`.
Currently python and node are supported. This means you want to install python 
and node using `tetra-{pyenv,nvm}` so that Tetra can start shells with 
environments configured by pyenv and nvm.

typically `$HOME/tetra/data`