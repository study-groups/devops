# Set TETRA_PYENV only if it is not already set
TETRA_PYENV=${TETRA_PYENV:-$TETRA_DIR/pyenv}

tetra_python_activate(){
  source $TETRA_PYENV/bin/activate
}

tetra_python_activate_dsenv(){
  source $TETRA_PYENV/bin/activate
  echo "Data Science environment activated" 2>&1
}

tetra_python_create_pyenv(){
  echo "Python environment will be created at $TETRA_PYENV" 2>&1
  echo "tetra_python_activate to active" 2>&1
  echo "Return to continue, ctrl-c to cancel.." 2>&1
  read
  python3 -m venv $TETRA_PYENV # creates a Python3 virtualenv
}

tetra_python_run(){
  tetra_python_activate
  python ${@}
}

tetra_python_install_prereq(){
  #sudo apt-get install python3-dev # needed for compiling
  sudo apt install python3.10-venv
}

tetra_python_http_serve(){
  python -m http.server $1
}
