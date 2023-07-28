#miscellaneous functions to be placed in proper file later
tetra-df(){
  df -h | grep -v snap # filter out snap mounts
}

tetra-df-snap(){
  df -h
}

# must be in reports dir
tetra-encrypt-report(){
   tar ca audit.txt summary.html | \
   tetra-encrypt-stdio  > \
   report_$(date +%s).tar.enc
}

tetra-decrypt-report(){
   cat $1 | tetra-decrypt-stdio |tar xv
}

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

tetra-parse-nginx(){
crossplane parse /etc/nginx/sites-enabled/*nodeholder*
}

