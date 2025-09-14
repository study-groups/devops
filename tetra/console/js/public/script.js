document.addEventListener('DOMContentLoaded', function () {
    const term = new Terminal({
        cursorBlink: true,
        theme: {
            background: '#1e1e1e',
            foreground: '#d4d4d4',
        }
    });
    const fitAddon = new FitAddon.FitAddon();
    term.loadAddon(fitAddon);
    term.open(document.getElementById('terminal'));
    fitAddon.fit();
    
    const socket = io();

    // --- State Machine ---
    const states = {
        IDLE: { next: 'MERGING', button: 'btn-merge' },
        MERGING: { next: 'READY_TO_BUILD', button: 'btn-prep' },
        READY_TO_BUILD: { next: 'BUILT', button: 'btn-build' },
        BUILT: { next: 'RUNNING', button: 'btn-restart' },
        RUNNING: { next: 'STOPPED', button: 'btn-stop' },
        STOPPED: { next: 'IDLE', button: 'btn-merge' }, // Can restart the cycle
    };
    let currentState = 'IDLE';

    // --- DOM Elements ---
    const stateDisplay = document.getElementById('current-state');
    const buttons = {
        merge: document.getElementById('btn-merge'),
        prep: document.getElementById('btn-prep'),
        build: document.getElementById('btn-build'),
        restart: document.getElementById('btn-restart'),
        stop: document.getElementById('btn-stop'),
    };

    // --- Functions ---
    function updateUI() {
        stateDisplay.textContent = currentState.replace('_', '-');
        // Disable all buttons first
        Object.values(buttons).forEach(btn => btn.disabled = true);
        
        // Enable the correct button for the current state
        if (currentState === 'RUNNING') {
            buttons.stop.disabled = false;
        } else if (currentState === 'STOPPED') {
            buttons.merge.disabled = false; // Allow restarting the flow
        } else if (states[currentState]) {
            const nextAction = states[currentState].button;
            const buttonElement = document.getElementById(nextAction);
            if(buttonElement) buttonElement.disabled = false;
        }
    }

    function getContext() {
        return {
            privateKey: document.getElementById('ssh-private-key').value,
            passphrase: document.getElementById('ssh-passphrase').value,
            // Hardcoding username and host for now. These would typically be derived or configured.
            username: 'dev-user',
            host: 'dev.server.com',
            REPO_DIR: document.getElementById('repo-dir').value,
            PROJECT_DIR: document.getElementById('project-dir').value,
            MERGE_BRANCH: document.getElementById('merge-branch').value
        };
    }

    function runAction(action, scriptName) {
        if (states[currentState]?.button !== `btn-${action}`) {
            term.writeln(`\r\n\x1b[31mError: Cannot run '${action}' from state '${currentState}'.\x1b[0m`);
            return;
        }

        const context = getContext();
        
        // Instead of executing a script, we will send an auth message if an SSH key is present
        if (context.privateKey) {
            socket.emit('message', JSON.stringify({
                type: 'auth',
                host: context.host,
                username: context.username,
                privateKey: context.privateKey,
                passphrase: context.passphrase || undefined,
                port: 22 // Default SSH port
            }));
            // Do not proceed with script execution for SSH auth
            console.log("SSH authentication message sent.");
            return;
        }

        // Original logic for running actions
        const envExports = Object.entries(context)
            .map(([key, value]) => `export ${key}='${value}';`)
            .join(' ');
        
        const command = `${envExports} ./scripts/${scriptName}\n`;
        
        currentState = states[currentState].next;
        updateUI();
        
        socket.emit('input', command);
    }

    // --- Socket & Terminal Event Listeners ---
    socket.on('connect', () => {
        term.writeln('\r\n\x1b[32m✅ WebSocket Connection Established\x1b[0m');
        term.writeln('Welcome to Tetra Console!');
        // No longer setting PS1 here, as it might interfere with SSH shell
        updateUI();
    });
    
    socket.on('output', (data) => {
        term.write(data);
    });
    
    term.onData((data) => {
        socket.emit('input', data);
    });
    
    window.addEventListener('resize', () => fitAddon.fit());

    // --- Button Event Listeners ---
    buttons.merge.addEventListener('click', () => runAction('merge', 'merge.sh'));
    buttons.prep.addEventListener('click', () => runAction('prep', 'prep.sh'));
    buttons.build.addEventListener('click', () => runAction('build', 'build.sh'));
    buttons.restart.addEventListener('click', () => runAction('restart', 'restart.sh'));
    buttons.stop.addEventListener('click', () => runAction('stop', 'stop.sh'));
});

