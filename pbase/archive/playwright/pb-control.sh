#!/bin/bash

case "$1" in
    start)
        pb start entrypoints/playwright.sh
        ;;
    stop)
        pb stop playwright
        ;;
    restart)
        pb restart playwright
        ;;
    status)
        pb status playwright
        ;;
    logs)
        pb logs playwright
        ;;
    *)
        echo "Usage: $0 {start|stop|restart|status|logs}"
        exit 1
        ;;
esac 
