// CLI Handler

const CLI = {
    history: [],
    maxHistory: 10,
    maxDisplayLogs: 4,
    historyIndex: -1, // To keep track of the current position in the history

    commands: {
        load: function(cliString) {
            const [_, ...args] = cliString.split(' ');
            const gamePath = args.join(' ');
            if (!gamePath) {
                return 'Game path is empty';
            }
            return this.createAndAppendIframe('game-iframe', `/games/${gamePath}`);
        },

        observe: function(cliString) {
            const [_, ...args] = cliString.split(' ');
            if (args.length === 0) {
                return 'No URL provided to observe';
            }
            const url = args.join(' ');
            console.log(`Observing URL: ${url}`);
            return `Observing URL: ${url}`;
        },

        echo: function(cliString) {
            const [_, ...args] = cliString.split(' ');
            return args.join(' ');
        },

        date: function() {
            return new Date().toString();
        },

        help: function() {
            return 'Available commands: ' + Object.keys(this.commands).join(', ');
        },

        set: function(cliString) {
            // Remove the 'set ' prefix if it exists
            const setString = cliString.startsWith('set ') ? cliString.substring(4) : cliString;
            
            // Split the string at the first '=' character
            const [variable, value] = setString.split(/=(.+)/);
            
            if (!variable || value === undefined) {
                return 'Invalid set command syntax. Use: element.property=value';
            }
            
            return this.setVariable(variable.trim(), value.trim());
        },

        inspectIframe: function() {
            const iframe = document.getElementById('game-iframe');
            if (!iframe) {
                return "No iframe found with id 'game-iframe'";
            }

            const summary = {
                src: iframe.src,
                width: iframe.width,
                height: iframe.height,
                contentWindow: {
                    location: iframe.contentWindow.location.href,
                    documentReady: iframe.contentDocument.readyState,
                },
                style: {
                    display: iframe.style.display,
                    position: iframe.style.position,
                    zIndex: iframe.style.zIndex,
                },
                attributes: {
                    allowFullscreen: iframe.allowFullscreen,
                    sandbox: iframe.sandbox,
                },
                webRoot: window.location.origin // Add this line to include the web root
            };

            createInfoPopup(JSON.stringify(summary, null, 2), {}, { modal: false });

            return 'Iframe inspection complete. Check the popup for details.';
        },

        inspectHeaders: function() {
            const iframe = document.getElementById('game-iframe');
            if (!iframe) {
                return "No iframe found with id 'game-iframe'";
            }

            return new Promise(resolve => {
                fetch(iframe.src)
                    .then(response => response.headers)
                    .then(headers => {
                        const headersObj = {};
                        for (let [key, value] of headers) {
                            headersObj[key] = value;
                        }
                        resolve(JSON.stringify(headersObj, null, 2));
                    })
                    .catch(error => resolve(`Error fetching headers: ${error.message}`));
            });
        },

        show: function(cliString) {
            const [_, target] = cliString.split(' ');
            if (!target) {
                return 'Invalid show command. Use: show divId.style.propertyName';
            }

            const [elementId, ...propertyPath] = target.split('.');
            const element = document.getElementById(elementId);

            if (!element) {
                return `Element with id '${elementId}' not found`;
            }

            if (propertyPath[0] === 'style' && propertyPath.length > 1) {
                const styleProperty = propertyPath[1];
                const computedStyle = window.getComputedStyle(element);
                const styleValue = element.style[styleProperty] || computedStyle[styleProperty];
                return `${target} = ${styleValue}`;
            } else {
                return `Invalid property path. Use: divId.style.propertyName`;
            }
        }
    },

    processCommand: function(cliString) {
        // Check for var=val pattern
        if (cliString.includes('=')) {
            return this.commands.set.call(this, `set ${cliString}`);
        }

        const [command] = cliString.split(' ');
        if (this.commands.hasOwnProperty(command)) {
            return this.commands[command].call(this, cliString);
        } else {
            return `Unknown command: ${command}`;
        }
    },

    execute: function(cliString) {
        const output = this.processCommand(cliString);
        this.addToHistory({
            timestamp: new Date().toISOString(),
            command: cliString,
            output: output
        });
        this.updateLogWindow();
        this.updateStatus(`Executed: ${cliString}`);
        this.historyIndex = -1;
    },

    setVariable: function(variable, value) {
        // Split the variable into ID and property path
        const [elementId, ...propertyPathParts] = variable.split('.');
        const propertyPath = propertyPathParts.join('.').replace(/-/g, '.'); // Replace dashes with dots in the property path
        const element = document.getElementById(elementId);
        if (element) {
            let target = element;
            const properties = propertyPath.split('.');
            
            // Handle style property separately
            if (properties[0] === 'style') {
                const styleProperty = properties[1];
                element.style[styleProperty] = value;
                
                // Apply the style to all child elements if the target is the footer
                if (elementId === 'footer' && (styleProperty === 'fontSize' || styleProperty === 'fontFamily' || styleProperty === 'color')) {
                    const children = element.querySelectorAll('*');
                    children.forEach(child => {
                        child.style[styleProperty] = value;
                    });
                }
            } else {
                // For non-style properties
                for (let i = 0; i < properties.length - 1; i++) {
                    target = target[properties[i]];
                    if (!target) {
                        return `Property path not found: ${properties.slice(0, i + 1).join('.')}`;
                    }
                }
                target[properties[properties.length - 1]] = value;
            }
            
            // Update debug div if iframe exists
            const iframe = document.getElementById('game-iframe');
            if (iframe) {
                this.updateDebugDiv(iframe);
            }
            return `Updated ${variable} to ${value}`;
        } else {
            return `Element with id ${elementId} not found`;
        }
    },

    loadCommand: function(cliString) {
        // Further processing of the CLI string
        console.log(`Processing command: ${cliString}`);

        // Ensure cliString is not empty
        if (!cliString) {
            console.error('CLI string is empty');
            return `CLI string is empty`;

        }

        // Parse the first token (load) and the remaining part of the command
        const [command, ...args] = cliString.split(' ');
        if (command !== 'load') {
            console.error(`Unexpected command: ${command}`);
            return `Unexpected command: ${command}`;

        }

        const gamePath = args.join(' ');
        if (!gamePath) {
            console.error('Game path is empty');
            return 'Game path is empty';
        }

        // Call the function to create and append the iframe with id and src
        return this.createAndAppendIframe('game-iframe', `/games/${gamePath}`);
    },

    createAndAppendIframe: function(id, src) {
        console.log(`Creating iframe with id: ${id} and src: ${src}`);

        // Ensure the src is not the same as the current page URL to avoid recursion
        if (window.location.pathname === src) {
            console.error('Iframe src cannot be the same as the current page URL');
            return 'Iframe src cannot be the same as the current page URL';
        }

        // Create the iframe element
        const iframe = document.createElement('iframe');
        iframe.id = id; // Set the id of the iframe
        iframe.src = src; // Set the src of the iframe
        iframe.style.width = '100%';
        iframe.style.height = '100%';
        iframe.style.border = 'none';
        iframe.style.display = 'block'; // Ensure the iframe is a block element
        iframe.style.margin = '0 auto'; // Center the iframe horizontally

        // Log the iframe src to ensure it's correct
        console.log(`Iframe src set to: ${iframe.src}`);

        // Find the main element and replace its content with the iframe
        const mainElement = document.querySelector('main');
        if (mainElement) {
            console.log('Main element found, appending iframe');
            mainElement.innerHTML = ''; // Clear existing content
            mainElement.appendChild(iframe);
            console.log('Iframe appended successfully');
            return 'Iframe loaded';
        } else {
            console.error('Main element not found');
            return 'Main element not found';
        }
    },

    updateDebugDiv: function(iframe) {
        // Display iframe size and width in a debug div
        const debugDiv = document.getElementById('debug-client');
        if (debugDiv && iframe && iframe.style) {
            debugDiv.innerHTML = `Iframe size: ${iframe.style.width} x ${iframe.style.height}, Width: ${iframe.style.width}`;
            return 'Debug div updated';
        } else {
            console.error('Debug div or iframe not found, or iframe has no style');
            return 'Debug div or iframe not found, or iframe has no style';
        }
    },

    addToHistory: function(entry) {
        this.history.unshift(entry);
        if (this.history.length > this.maxHistory) {
            this.history.pop();
        }
    },

    updateLogWindow: function() {
        const logWindow = document.getElementById('log-window');
        const lastTwoCommands = this.history.slice(0, 2).reverse();
        
        logWindow.innerHTML = lastTwoCommands.map(entry => 
            `<div>${entry.timestamp} - ${entry.command}: ${entry.output}</div>`
        ).join('');
    },

    updateStatus: function(message) {
        // You can modify this to update a status element if you have one
        console.log('Status:', message);
    },

    handleKeyDown: function(event) {
        const input = document.getElementById('cli-input');
        if (event.key === 'ArrowUp') {
            // Navigate up in history
            if (this.historyIndex < this.history.length - 1) {
                this.historyIndex++;
                input.value = this.history[this.historyIndex].command;
            }
            event.preventDefault();
        } else if (event.key === 'ArrowDown') {
            // Navigate down in history
            if (this.historyIndex > 0) {
                this.historyIndex--;
                input.value = this.history[this.historyIndex].command;
            } else {
                this.historyIndex = -1;
                input.value = '';
            }
            event.preventDefault();
        }
    }
};