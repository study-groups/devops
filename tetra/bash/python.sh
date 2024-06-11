TETRA_PYENV=$TETRA_ENV/ds-env
tetra_python_activate(){
  source $TETRA_PYENV/bin/activate
}

tetra_python_activate_dsenv(){
  source $TETRA_PYENV/bin/activate
  echo "Data Science environment activated" 2>&1
}

tetra_python_create_dsenv(){
  python3 -m venv $TETRA_PYENV # creates a Python3 virtualenv
  echo "Data Science environment created at $TETRA_PYENV" 2>&1
  echo "tetra_python_active_dsenv to active"
}

tetra_python_run(){
  tetra_python_activate
  python ${@} 
}

tetra_python_install_prereq(){
  sudo apt-get install python3-dev # needed for compiling
}

tetra_python_http_serve(){
  python -m http.server $1
}
