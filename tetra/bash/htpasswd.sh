tetra_htpasswd_set(){
   # used by nginx for basic security
   # typically development web is protected 
   # using a shared devops password.
   echo htpasswd -c ~$USER/htpasswd ${1:-$USER}
}


