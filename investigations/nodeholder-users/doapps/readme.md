# Distributed Application

Dockerfiles are used to build images. Images are run as
containers. Containers are applications. Multiple applications
can run on a single server (droplet). Data is found in Linux 
user space. Docker runs apps under root control. Coupling between
Unix userspace and root-docker is done through docker volume
mounting.

- build.sh - calls Dockerfile to build custom **image**.
- Dockerfile - tells how to build the **image** that supports to app
- config.sh - builds the **container** 
- dotenv.sh - example .env file
- key.sh  -  key management to talk ssh upstream (back to parent)  
- kill.sh - docker command to remove app **container**
- run.sh  - relies on .env to map users and directories to outside world
