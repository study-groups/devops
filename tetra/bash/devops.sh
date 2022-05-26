tetra-devops-help(){
cat<<EOF
user@local> ssh root@$host
root@host> root-create-devops

add this to /etc/sudoers.d/99-tetra:
devops ALL=(ALL) NOPASSWD:ALL
EOF
}
