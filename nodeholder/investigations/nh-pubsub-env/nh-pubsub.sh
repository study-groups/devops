#!/usr/bin/env bash

    #
    # Save the path to this script's directory in a global env variable
    #
    DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

    #
    # Array that will contain all registered events
    #
    EVENTS=()

    #
    # @desc   :: Registers an event
    # @param  :: string $1 - The name of the event. Basically an alias for a function name
    # @param  :: string $2 - The name of the function to be called
    # @param  :: string $3 - Full path to script that includes the function being called
    #
    function subscribe() {
        EVENTS+=("${1};${2};${3}")
    }

    #
    # @desc   :: Public an event
    # @param  :: string $1 - The name of the event being published
    #
    function publish() {
        for event in ${EVENTS[@]}; do
            local IFS=";"
            read -r -a event <<< "$event"
            if [[  "${event[0]}" ==  "${1}" ]]; then
                ${event[1]} "${@:2}" # eat the event label
            fi
        done
    }

subscribe "help" "nh-help"
subscribe "get-key" "nh-get-key"
subscribe "build" "nh-app-build"
subscribe "start" "nh-app-start"
subscribe "stop" "nh-app-stop"
subscribe "status" "nh-app-status"
subscribe "log" "nh-app-log"
subscribe "errors" "nh-app-err"
subscribe "add-env-var" "nh-add-env-var"

# publisher
nh() {
  # publishes first arg 
  # and passes args starting from the second to the function invoked
  publish "$1" "${@:2}"
}

nh-remote() {
  local role="$1";
  local ip="$2";
  # passes the rest of the args starting from the 3rd arg
  local rest="${@:3}"
  
  ssh "$role"@"$ip" "source nh.sh && nh $rest"
}

nh-help() {
  echo "Here is the helper function"
}

nh-get-key() {
  cat .ssh/id_rsa.pub
}

nh-app-build() {
  local app="$1";

  ./$app/nh/build
}

nh-app-status() {
  local app="$1";
  cat ./$app/nh/status
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
  local env_var="$1";
  local value="$2";
  local app="$3";

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

nh-app-status() {
  local app="$1";

  ./$app/nh/status
}
