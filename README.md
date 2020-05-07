# devops-study-group
The DevOps Study Group meets to discuss provisioning, securing and
maintaing cloud based resources at Digital Ocean and Google. 
The [12 Factors App](https://12factor.net/) by the Heroku team is a 
guiding philosophy.
The [devops.sh](./devops.sh) file is a
collection of Bash functions which collects various tools neceassry to
orchestrate secure operations. "Orchestration at a distance" describes
the provisioning, configuring, running and securing of remote
virtual environments. 

## Virtual Environments
Two methods of virtualization:

1. [hypervisor](https://en.wikipedia.org/wiki/Hypervisor)
2. [container](https://en.wikipedia.org/wiki/OS-level_virtualization)

. | Hypervisor | Container
--- | --- | ---
**Google** | [KVM](https://cloud.google.com/blog/products/gcp/7-ways-we-harden-our-kvm-hypervisor-at-google-cloud-security-in-plaintext) | [Containers](https://cloud.google.com/containers/)
**DigitalOcean** | [Droplets](https://www.digitalocean.com/docs/) | [cloud computing](https://en.m.wikipedia.org/wiki/Cloud_computing)

## Google Cloud Platform v. Digital Ocean

GCP | Digtal Ocean
--- | ---
[Devops Philosophy](https://cloud.google.com/devops/) | [CI/CD](https://www.digitalocean.com/community/tags/ci-cd) 
compute | droplet
bucket | [spaces](https://www.digitalocean.com/products/spaces/)
images |  [images](https://www.digitalocean.com/docs/images/)
volumes | [block storage](https://www.digitalocean.com/products/block-storage/)
[snapshots](https://cloud.google.com/compute/docs/disks/create-snapshots) | [snapshots](https://www.digitalocean.com/docs/images/snapshots/)
[network](https://cloud.google.com/blog/products/networking/google-cloud-networking-in-depth-how-andromeda-2-2-enables-high-throughput-vms) | [virtual-network](https://www.digitalocean.com/products/networking/)
availability | [availability](https://www.digitalocean.com/docs/platform/availability-matrix/)

## HashiCorp

Hashicorp was founded by Mitchell Hashimoto, the creator of [Vagrant](https://www.youtube.com/watch?v=UTQQggVx4sI) which 
shows basic usage with Puppet in 2012. Now HashiCorp's products do the automation and Puppet, Chef and Ansible are not necessary:

1. [Terraform](https://www.hashicorp.com/products/terraform): Infrastructure as code for provisioning, compliance, and management of any cloud, infrastructure, and service.
2. [Vault](https://www.hashicorp.com/products/vault/): Secure, store and tightly control access to tokens, passwords, certificates, encryption keys for protecting secrets and other sensitive data using a UI, CLI, or HTTP API.
3. [Consul](https://www.hashicorp.com/products/consul/): A multi-cloud service networking platform to connect and secure services across any runtime platform and public or private cloud.
4. [Nomad](https://www.hashicorp.com/products/nomad/): Deploy and Manage Any Containerized, Legacy, or Batch Application.
Nomad is an easy-to-use, flexible, and performant workload orchestrator that enables organizations to deploy applications on any infrastructure at scale.

Hashicorp | devops.sh
--- | ---
terraform | devops-create-vm-{digocean,google}
vault | devops-keys-add-{digocean,google}
consul | devops-{start,stop,update}
nomad | devops-run

## Git 
- [git](https://git-scm.com/): Git is version control for software development, written by Linus Torvalds.
- [Git From the Bits Up](https://www.youtube.com/watch?v=MYP56QJpDr4): Join GitHub trainer and evangelist Tim Berglund for a look at Git, from the bits up. This talk is not for the Git beginner, but a more advanced look at "weird internals stuff" and obscure commands that will reveal a sort of internal API that is there for you to use and help expose you to certain intrinsic software design insights that can be had from looking at Git at this level.

- [Git Tutorial for Beginners: Command-Line Fundamentals](https://www.youtube.com/watch?v=HVsySz-h9r4&list=PL-osiE80TeTuRUfjRe54Eea17-YfnOOAx): Videos by Corey Schafer. We'll go over the basics of what git is and how to use it within the command-line. There are several GUI tools out there to help you get started with git, but it can be extremely beneficial to learn git from the command-line as early as possible.

## Traefik
Traefik handles reverse-proxy and SSL certificates. A reverse-proxy maps an HTTP/S url with a domainanme, to a new domainame and port number.
- [Traefik on Github](https://github.com/containous/traefik)
- [Traefik basics](https://docs.traefik.io/basics/#concepts) describing backend, frontend, entry points, and servers.
- [Traefik example with Node.js server and Docker](https://github.com/Pungyeon/docker-traefik-example)

## Docker
- Marketing from docker.com: [Why Docker?](https://www.docker.com/why-docker) 
- [One click install vi digitalocean.com](https://www.digitalocean.com/docs/one-clicks/docker/)
- [What is a container at docker.com](https://www.docker.com/resources/what-container)
- [Get started](https://docs.docker.com/get-started/) at docker.com
- Dockerfile: [Dockerfile at Docker](https://docs.docker.com/glossary/?term=Dockerfile) and [best practices](https://docs.docker.com/develop/develop-images/dockerfile_best-practices/)
- [Layers definition](https://docs.docker.com/glossary/?term=layer)
- Dont use Links. Instead use [overlay network driver](https://docs.docker.com/glossary/?term=overlay%20network%20driver)
- [Docs on Volumes](https://docs.docker.com/storage/volumes/) the preferred mechanism for data persistence
- [Doc on services](https://docs.docker.com/get-started/part3/#about-services) Services are really just “containers in production.”
- [Compose files](https://docs.docker.com/compose/compose-file/): Run, and scale services with the Docker platform via [docker-compose.yml](https://docs.docker.com/get-started/part3/#your-first-docker-composeyml-file)
- Overlay networks: The [overlay network driver](https://docs.docker.com/network/overlay/) creates a distributed network among multiple Docker daemon hosts. Not needed until scale.
- Networking: [Docker container networking](https://docs.docker.com/v17.09/engine/userguide/networking/#default-networks)
- Network drivers: bridge, host, overlay, 3rd-party [network drivers](https://docs.docker.com/network/#network-drivers)
- There are four major areas to consider when reviewing [Docker security](https://docs.docker.com/engine/security/security/).

## References
- [Docker Engine Faq](https://docs.docker.com/engine/faq/): Docker frequently asked questions, 9 min read.
- [Docker Crib Sheet](https://github.com/wsargent/docker-cheat-sheet)
 - [ICANN - Internet Corporation for Assigned Names and Numbers](https://www.icann.org/resources/pages/beginners-guides-2012-03-06-en) This is where domain names come from.
