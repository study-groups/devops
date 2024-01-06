# Sub-function to create the picoui.js file
_tetra_pico_make_js() {
  [ -z $TETRA_PICO ] && echo "TETRA_PICO not set." && return -1;
  echo "using TETRA_PICO=$TETRA_PICO"
  local js_file="${TETRA_PICO}/picoui.js"
  cat << EOF > "${js_file}"
// PicoModel
class PicoModel {
    constructor(initialState) {
        this.state = initialState;
        this.subscribers = [];
    }

    updateState(newState) {
        this.state = {...this.state, ...newState};
        this.notifySubscribers();
    }

    subscribe(callback) {
        this.subscribers.push(callback);
    }

    notifySubscribers() {
        this.subscribers.forEach(callback => callback(this.state));
    }
}

// PicoController
class PicoController {
    constructor(model) {
        this.model = model;
    }

    incrementCounter() {
        const currentCount = this.model.state.count;
        this.model.updateState({ count: currentCount + 1 });
    }

    saveState() {
        fetch('saveState.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(this.model.state)
        });
    }

    loadState() {
        fetch('loadState.php')
            .then(response => response.json())
            .then(data => this.model.updateState(data));
    }
}

// Initialize PicoUI
document.addEventListener('DOMContentLoaded', () => {
    const model = new PicoModel({ count: 0 });
    const controller = new PicoController(model);

    model.subscribe(state => {
        document.getElementById('count-display').innerText = state.count;
    });

    document.getElementById('increment-button').addEventListener('click', () => controller.incrementCounter());
    document.getElementById('save-button').addEventListener('click', () => controller.saveState());
    document.getElementById('load-button').addEventListener('click', () => controller.loadState());
});
EOF
  echo "JavaScript file picoui.js created in ${TETRA_DOCKER_PHP}"
}

