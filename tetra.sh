source tetra.env

tetra-get-env(){
  scp admin@$do4:~/server.list ./tetra.env # dotool to tetra
}

remoteEastAdmin="ssh admin@$do1 source admin.sh &&"
remoteWestAdmin="ssh admin@$do2 source admin.sh &&"
remoteEast="ssh admin@$do1"
remoteWest="ssh admin@$do2"
