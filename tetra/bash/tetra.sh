#miscellaneous functions to be placed in proper file later

tetra-status(){
   TETRA_SRC=$HOME/src/devops-study-group; 
   (cd $TETRA_SRC; git pull)
   source $TETRA_SRC/bash/bootstrap.sh
   clear
   tetra-df
}

tetra-df(){
  df -h | grep -v -e snap \
                  -e tmp  \
                  -e udev \
                  -e cgmfs \
                  -e boot 
}

tetra-df-snap(){
  df -h
}

# must be in reports dir
tetra-encrypt-report(){
   tar ca audit.txt summary.html | \
   tetra_encrypt_stdio  > \
   report_$(date +%s).tar.enc
}

tetra-decrypt-report(){
   cat $1 | tetra-decrypt-stdio |tar xv
}

####                          ###
####  Move below to nginx.sh  ###
####                          ###
tetra-list-sites()
{
  cat /etc/nginx/sites-enabled/* \
	 | grep " server_name "  \
	 | grep -v "*." \
	 | sort \
	 | uniq 
}

tetra-install-crossplane(){
  # must have python enabled via tetra-python-activate
  pip install crossplane
}

tetra_parse_nginx(){
  crossplane parse /etc/nginx/sites-enabled/*nodeholder*
}

