sae-create(){
  local repo="git@gitlab.com:zoverlvx/sentiment-analysis-engine"
  ssh admin@$doX ". admin.sh && admin-create-app sae $repo sae-app"
}
sae-port(){
  ssh sae@$doX cat sae-app/nh/port
}
sae-start(){
  ssh sae@$doX sae-app/nh/start
}
sae-stop(){
  ssh sae@$doX sae-app/nh/stop
}
sae-install(){
  ssh sae@$doX sae-app/nh/install
}
sae-delete(){
  ssh admin@$doX '. admin.sh && admin-delete-app sae sae-app'
}
sae-curl(){
  local port=$(sae-port)
  echo "Trying with port $port"
  curl -d '{"review": "'"$1"'"}' -H "Content-Type: application/json" \
	-X POST "$doX:$port/api/nlp/s-analyzer"
  echo ""
}

