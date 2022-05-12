mkdoc-install(){
cat <<EOF
python -m ensurepip --upgrade
pip install mkdocs
mkdocs new devops-notes
EOF
}

# if SSH is a power tool, socat is a socket wrench.
# Here is is used to honor the default mkdoc server 
# which listens on localhost:8000
# This command exposes 8001 for open public connection
# and forwards the packet to the local connection running
# mkdoc serve which should reside in a tmux session 
# called mkdocs started by devops user
mkdoc-socat(){
 socat tcp-listen:8001,reuseaddr,fork tcp:localhost:8000
}


