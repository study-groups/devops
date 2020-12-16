# Configuration at a Distance

Configuration at a Distance: how to provision, configure and maintain a virtual, private, Linux server from the shell.

## week 0: Unix Fundamentals and it's history
## week 1: Provison, login and serve webpage from VPN

### Provision
- Create private SSH key via ssh-keygen
  - accept defaults, copy key from ~/.ssh/id_rsa.pub (will be used later)
- [Log into Digital Ocean](https://cloud.digitalocean.com/login)
- Upload public SSH key to Digital Ocean Security](https://cloud.digitalocean.com/account/security)
  - this allows Digital Ocean to create a drop with /root/.ssh/authorized_keys with you key in it so that you can login via SSH without a password
- Create $5/mo droplet
  - copy the IP address

### Login
This introduces the notion of [envirornment variables in Bash](https://www.gnu.org/software/bash/manual/html_node/Bash-Variables.html) (zsh is similar).

- From commandline (bash or zsh): `DROPLET_IP=the-droplet-ip'
- From your local terminal, `ssh root@$DROPLET_IP'

## week 2: SSH keys Part 2, networking, shell scripting
## week 3: Deployment, backup, teardown, repeat.
## week 4: Advanced UNIX Fundamentals
## week 5: TLS, SSL and security concerns
## week 6: Deploy federated CloudApi service on two servers
