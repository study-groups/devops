nh-get-key() {
  cat .ssh/id_rsa.pub
}

nh-app-build() {

  if [ $# -lt 1 ]; then
    echo "Local command requires the app"
    echo "nh-app-build app"
    return 1
  fi

  local app="$1";

  ./$app/nh/build
}

nh-app-status() {

  if [ $# -lt 1 ]; then
    echo "Local command requires the app"
    echo "nh-app-status app"
    return 1
  fi

  local app="$1";

  cat ./$app/nh/status
}

nh-app-log() {

  if [ $# -lt 1 ]; then
    echo "Local command requires the app"
    echo "nh-app-log app"
    return 1
  fi

  local app="$1";

  cat ./$app/nh/log
}

nh-app-err() {

  if [ $# -lt 1 ]; then
    echo "Local command requires the app"
    echo "nh-app-err app"
    return 1
  fi

  local app="$1";

  cat ./$app/nh/err
}

nh-add-env-var() {

  if [ $# -lt 2 ]; then
    echo "Local command requires the app and environment variable name"
    echo "nh-add-env-var app env_var [value]"
    return 1
  fi

  local app="$1";
  local env_var="$2";
  local value="$3";

  echo "export $env_var=$value" >> ./$app/nh/env
}

nh-app-start() {

  if [ $# -lt 1 ]; then
    echo "Local command requires the app"
    echo "nh-app-start app"
    return 1
  fi

  local app="$1";

  ./$app/nh/start
}

nh-app-stop() {

  if [ $# -lt 1 ]; then
    echo "Local command requires the app"
    echo "nh-app-stop app"
    return 1
  fi

  local app="$1";

  ./$app/nh/stop
}
