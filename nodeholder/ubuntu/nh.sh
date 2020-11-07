nh-get-key() {
  cat .ssh/id_rsa.pub
}

nh-app-build() {
  local app="$1";

  ./$app/nh/build
}

nh-app-show() {
  local app="$1";
  local file="$2";

  cat ./$app/nh/$file
}

nh-add-env-var() {
  local env_var="$1";
  local value="$2";
  local app="$3";

  echo "export '$env_var'"="'$value'" >> ./$app/nh/env
}

nh-app-start() {
  local app="$1";

  ./$app/nh/start
}

nh-app-stop() {
  local app="$1";

  ./$app/nh/stop
}

nh-app-status() {
  local app="$1";

  ./$app/nh/status
}
