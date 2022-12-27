#  Init code for bootstrapping tetra into a users' Bash shell.

# [ -f tetra.env ] && source tetra.env
remoteEast="ssh admin@$do1"
remoteWest="ssh admin@$do2"
TETRA_PRIMARY_IP="$do4_n2"
