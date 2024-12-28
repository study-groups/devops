tetra_python_create_venv() {
    local venv_path="$TETRA_VENV_DIR"
    local python_version="$(python --version)"
    echo "Creating Python environment at $venv_path"
    echo "with Python $python_version at $(which python)"
    # Temporarily use the specified Python version
    pyenv shell "$python_version"
    python -m venv "$venv_path"
    echo "Python environment created at $venv_path"
}

# Activate the virtual environment
tetra_python_activate_venv() {
    if [ -d "$TETRA_VENV_DIR" ]; then
        echo "Activating Python venv environment at $TETRA_VENV_DIR"
        source "$TETRA_VENV_DIR/bin/activate"
    else
        echo "Python environment not found at $TETRA_VENV_DIR."
    fi
}
