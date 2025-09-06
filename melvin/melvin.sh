melvin_mc(){
  mc -r MELVIN.txt melvin.sh go.mod main.go static/ | pbcopy
}

melvin_build(){
  : "${MELVIN_DIR:?MELVIN_DIR not set}"
  mkdir -p "$MELVIN_DIR"/{data,transcripts,prefs,tags,modules}
  go build -o melvin main.go
}

