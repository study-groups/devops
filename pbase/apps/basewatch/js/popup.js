function createInfoPopup(content, controls = {}, options = { modal: true }) {
    const popup = document.createElement('div');
    popup.className = 'popup fixed inset-0 flex items-center justify-center z-50 bg-black bg-opacity-50';
    
    let controlsHtml = '';
    for (const [key, control] of Object.entries(controls)) {
        if (control.type === 'checkbox' && key !== 'anotherCheckbox') { // Exclude "Another Checkbox"
            controlsHtml += `
                <div class="mb-4">
                    <label class="flex items-center">
                        <input type="checkbox" id="${key}" class="form-checkbox h-5 w-5 text-blue-600" ${control.checked ? 'checked' : ''}>
                        <span class="ml-2 text-gray-300">${control.label}</span>
                    </label>
                </div>
            `;
        } else if (control.type === 'slider') {
            controlsHtml += `
                <div class="mb-4">
                    <label class="block text-gray-300 mb-2">${control.label}</label>
                    <input type="range" id="${key}" min="${control.min}" max="${control.max}" step="${control.step}" value="${control.value}" class="w-full">
                    <span id="${key}-value" class="text-gray-300 mt-1 block">${control.value}</span>
                </div>
            `;
        }
    }


    popup.innerHTML = `
        <div class="bg-paper-light text-three p-8 rounded-lg shadow-xl max-w-3xl max-h-[80vh] overflow-auto">
            <div class="mb-6 text-lg" style="white-space: pre;">${content}</div>
            ${controlsHtml}
            <button id="closePopup" class="mt-6 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">Close</button>
        </div>
    `;

    document.body.appendChild(popup);

    // Set up event listeners for controls
    for (const [key, control] of Object.entries(controls)) {
        const element = document.getElementById(key);
        if (element) {
            if (control.type === 'checkbox') {
                element.addEventListener('change', (e) => control.onChange(e.target.checked));
            } else if (control.type === 'slider') {
                element.addEventListener('input', (e) => {
                    const value = parseFloat(e.target.value);
                    document.getElementById(`${key}-value`).textContent = value;
                    control.onChange(value);
                });
            }
        } else {
            console.warn(`Control element with id '${key}' not found in the DOM`);
        }
    }



    // Close popup when clicking outside or on close button if modal
    if (options.modal) {
        popup.addEventListener('click', (e) => {
            if (e.target === popup || e.target.id === 'closePopup') {
                document.body.removeChild(popup);
            }
        });
    } else {
        document.getElementById('closePopup').addEventListener('click', () => {
            document.body.removeChild(popup);
        });
    }

    
    // Set initial font style based on local storage
    applyMonospaceFont(localStorage.getItem('monospaceFont') === 'true');
}

// Function to apply monospace font to popup and footer
function applyMonospaceFont(isMonospace) {
    const elements = [
        document.querySelector('.popup'),
        document.querySelector('footer')
    ];
    
    elements.forEach(element => {
        if (element) {
            element.style.fontFamily = isMonospace ? 'monospace' : 'inherit';
        }
    });
}