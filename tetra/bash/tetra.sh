#miscellaneous functions to be placed in proper file later

# modern ubuntu uses snap,
# lets hope the trouble is worth it..

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

tetra-sites-list()
{
  cat /etc/nginx/sites-enabled/* \
	 | grep " server_name "  \
	 | grep -v "*." \
	 | sort \
	 | uniq 

}
