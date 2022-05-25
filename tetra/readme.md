# Tetra

Tetra is installed by the dotool bootstrap process. Part

## The Nodeholder Process
1. Obtain an Digital Ocean API Key
2. Install doctl on your local machine
3. Clone [devops-study-group](https://study-groups/devops-study-group)
  - cloning into `~/src/devops-study-group` makes things easiest
4. source `~/src/devops-study-group/dotool.sh`
5. `dotool-create name`
  - will create an LTS node with hostname name. 
  - add IP info into the ~/server.list file

6. ssh root@$name
  - Clone [devops-study-group](https://study-groups/devops-study-group)
    into /root/src/devops-study-group
  - source ~/src/devops-study-group/nh

Recall: dotool-create:
1. provisions an LTS Ubuntu VPS with a Hypervisor Steward Key

2. 

 after creating a virtual
private server on a hypervisor system like Digital Ocean.

Tetra provides:

- a collection of Bash functions for Linux OS
- a system for managaging network data
- a simple SSH key manager
- a mesh network builder based on systemctl
- a turnk-key virtual private cloud
- a Jump Server (aka bastion server) for audited access
- a tool for monitoring disk usage
- hot backup via rsync 
- cold backup via gzip to volumes
- deep backup via mounted S3 storage

Tetra does not use:
- docker
- custom logging software

 instead relies on TCP/IP traffic secured with SSH (not SSL).

## Setup

- Clone [devops-study-group]()

## Explore
- `tetra-` `tab` will show you all commands.
- 
## Theory




