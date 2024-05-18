source ./nexus.env
source bash/bootstrap.sh
echo "Nexus initialzed nexus_help for more"

nexus_help_init(){
  cat <<EOF

Nexus relies on NEXUS_DIR for data storage and NEXUS_BASH
to bootstrap the environment.

EOF
}
