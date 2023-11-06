#miscellaneous functions to be placed in proper file later
tetra_df(){
  df -h | grep -v snap # filter out snap mounts
}

tetra_df_snap(){
  df -h
}

# must be in reports dir
tetra_encrypt_report(){
   tar ca audit.txt summary.html | \
   tetra_encrypt_stdio  > \
   report_$(date +%s).tar.enc
}

tetra_decrypt_report(){
   cat $1 | tetra_decrypt_stdio |tar xv
}

tetra_list_sites()
{
  cat /etc/nginx/sites-enabled/* \
	 | grep " server_name "  \
	 | grep -v "*." \
	 | sort \
	 | uniq 
}

tetra_install_crossplane(){
# must have python enabled via tetra-python-activate
pip install crossplane
}

tetra_parse_nginx(){
crossplane parse /etc/nginx/sites-enabled/*nodeholder*
}

