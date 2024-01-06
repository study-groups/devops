# must be in reports dir

tetra-reload(){
  local dir="$TETRA_DIR"
  local src="$TETRA_SRC"
  [ -z "$TETRA_DIR" ] && echo "TETRA_DIR not set, exiting" && return 1
  [ -z "$TETRA_SRC" ] && echo "TETRA_SRC not set, exiting" && return 1
  tetra-env-clear
  TETRA_DIR="${dir}" 
  TETRA_SRC="${src}" 
  echo "sourcing $TETRA_DIR/tetra.sh"
  source $TETRA_DIR/tetra.sh
  tetra-env -a 
}

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

