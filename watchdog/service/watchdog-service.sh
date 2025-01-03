#!/bin/bash

WATCHDOG_SERVICE="/etc/systemd/system/watchdog.service"
WATCHDOG_DIR="/tmp/watchdog"

start_service() {
    if [ ! -f "$WATCHDOG_SERVICE" ]; then
        echo "Error: $WATCHDOG_SERVICE does not exist. Ensure the service file is correctly installed."
        exit 1
    fi

    systemctl daemon-reload
    systemctl enable watchdog.service
    systemctl start watchdog.service
    systemctl status watchdog.service
}

stop_service() {
    systemctl stop watchdog.service
}

remove_service() {
    systemctl stop watchdog.service
    systemctl disable watchdog.service
    rm -f "$WATCHDOG_SERVICE"
    rm -rf "$WATCHDOG_DIR"
    systemctl daemon-reload
}

install_service() {
    if [ ! -f ./watchdog ]; then
        echo "Error: watchdog binary not found. Ensure it exists in the current directory."
        exit 1
    fi

    mkdir -p "$WATCHDOG_DIR"
    cp ./watchdog "$WATCHDOG_DIR/watchdog"

    if [ ! -f "$WATCHDOG_SERVICE" ]; then
        echo "Error: watchdog.service file must be written manually. Refer to documentation for format."
        exit 1
    fi

    systemctl daemon-reload
    systemctl enable watchdog.service
}

case "$1" in
    install-service)
        echo "Installing service..."
        install_service
        ;;
    start-service)
        echo "Starting service..."
        start_service
        ;;
    stop-service)
        echo "Stopping service..."
        stop_service
        ;;
    remove-service)
        echo "Removing service..."
        remove_service
        ;;
    *)
        echo "Usage: $0 {install-service|start-service|stop-service|remove-service}"
        ;;
esac

