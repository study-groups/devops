import { logMessage } from '../utils.js';

// Simple dropdown list container
export class ListContainer {
    constructor(options = {}) {
        this.options = {
            onSelect: null,
            ...options
        };
        this.items = [];
        
        // Ensure the select element exists
        const fileSelect = document.getElementById('file-select');
        if (!fileSelect) {
            console.error('[LIST] File select element not found');
            return;
        }

        // Set up file select change handler
        fileSelect.addEventListener('change', () => {
            const selectedItem = this.items.find(item => item.name === fileSelect.value);
            if (selectedItem && this.options.onSelect) {
                this.options.onSelect(selectedItem);
            }
        });
    }
    
    setItems(items) {
        this.items = items;
        const fileSelect = document.getElementById('file-select');
        if (!fileSelect) {
            console.error('[LIST] File select element not found');
            return;
        }
        
        // Clear and populate the select
        fileSelect.innerHTML = '<option value="">Select File</option>';
        items.forEach(item => {
            const option = document.createElement('option');
            option.value = item.name;
            // Add rank and index if available
            const displayText = item.index ? `${item.index}. ${item.name}` : item.name;
            option.textContent = displayText;
            if (item.rank) {
                option.dataset.rank = item.rank;
            }
            fileSelect.appendChild(option);
        });

        // Make the select visible
        fileSelect.style.display = 'block';
        logMessage(`[LIST] Loaded ${items.length} items`);
    }
} 