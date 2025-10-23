#!/bin/bash
cd $HOME/src/pixeljam/pbase/playwright
export NODE_PATH=./node_modules
http-server reports/html
