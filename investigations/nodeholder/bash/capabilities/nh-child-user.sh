nh-get-key() {
  cat .ssh/id_rsa.pub
}

nh-app-install-deps() {
  local app="$1";
  ./$app/nh/install
}

nh-app-build() {
  local app="$1";
  ./$app/nh/build
}

nh-app-status() {
  local app="$1";
  ./$app/nh/status
}

nh-app-log() {
  local app="$1";
  cat ./$app/nh/log
}

nh-app-err() {
  local app="$1";
  cat ./$app/nh/err
}

nh-add-env-var() {
  local app="$1";
  local env_var="$2";
  local value="$3";
  echo "export $env_var=$value" >> ./$app/nh/env
}

nh-app-start() {
  local app="$1";
  ./$app/nh/start
}

nh-app-stop() {
  local app="$1";
  ./$app/nh/stop
}
