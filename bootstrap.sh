KEY="~/.ssh/do_spring_rsa"
alias tetra="~/src/devops-study-group/tetra/tetra"

# must run as root
tetra-bootstrap(){
#ssh-keygen
#dnf install git # fedora
#apt install git # ubuntu
#eval "$(ssh-agent)"
#ssh-add ~/.ssh/$KEY
  [ -d "~/src" ] && mkdir src
#cd src
#git clone git@github.com:study-groups/devops-study-group.git
#cd devops-study-group
#envsubst < ./custom.env > ~/custom.sh
}

nh-root-help(){
cat <<EOF

 Nodeholder bootstrap procedure:
  0) set env variables used in custom.env
  1) Make sure public key is in GitHub user account (any in group). 
  2) This file needs to be manually copied from the repo.
  3) Edit the root.sh copy on new host as necessary.
  4) Sourced into a bash shell on the new host.
  5) nh-root-install

 Next steps:
  1) source /root/custom.sh
  2) 
 
EOF
}
