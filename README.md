# devops-study-group
The DevOps Study Group meets to discuss provisioning, securing and
maintaing cloud based resorces starting with Virtual Private Servers
hosted at Digital Ocean.  The [devops.sh](./devops.sh) file is a
collection of Bash functions which collects various tools neceassry to
orchestrate secure operations.

## Digital Ocean

## Docker 
- Marketing from docker.com: [Why Docker?](https://www.docker.com/why-docker) 
- [One click install vi digitalocean.com](https://www.digitalocean.com/docs/one-clicks/docker/)
- [What is a container at docker.com](https://www.docker.com/resources/what-container)
- [Get started](https://docs.docker.com/get-started/) at docker.com
- Dockerfile: [Dockerfile at Docker](https://docs.docker.com/glossary/?term=Dockerfile)
- [Layers definition](https://docs.docker.com/glossary/?term=layer)
- Dont use Links. Instead use [overlay network driver](https://docs.docker.com/glossary/?term=overlay%20network%20driver)
- [Docs on Volumes](https://docs.docker.com/storage/volumes/) the preferred mechanism for data persistence
- [Doc on services](https://docs.docker.com/get-started/part3/#about-services) Services are really just “containers in production.”
- [Compose files](https://docs.docker.com/compose/compose-file/): Run, and scale services with the Docker platform via [docker-compose.yml](https://docs.docker.com/get-started/part3/#your-first-docker-composeyml-file)
- Overlay networks: The [overlay network driver](https://docs.docker.com/network/overlay/) creates a distributed network among multiple Docker daemon hosts. Not needed until scale.
- Networking: [Docker container networking](https://docs.docker.com/v17.09/engine/userguide/networking/#default-networks)
- Network drivers: bridge, host, overlay, 3rd-party [network drivers](https://docs.docker.com/network/#network-drivers)
- There are four major areas to consider when reviewing [Docker ecurity](https://docs.docker.com/engine/security/security/).

# Traefik
Traefik handles reverse-proxy and SSL certificates. A reverse-proxy maps an HTTP/S url with a domainanme, to a new domainame and port number.
- [Traefik on Github](https://github.com/containous/traefik)
- [Traefik basics](https://docs.traefik.io/basics/#concepts) describing backend, frontend, entry points, and servers.
- [Traefik example with Node.js server and Docker](https://github.com/Pungyeon/docker-traefik-example)

# References
- [Docker Engine Faq](https://docs.docker.com/engine/faq/): Docker frequently asked questions, 9 min read.
- [Docker Crib Sheet](https://github.com/wsargent/docker-cheat-sheet)
 - [ICANN - Internet Corporation for Assigned Names and Numbers](https://www.icann.org/resources/pages/beginners-guides-2012-03-06-en) This is where domain names come from.
