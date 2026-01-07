/*
    pja-components.js
    This file contains the JavaScript controllers for shared UI components.
*/

/**
 * Initializes all collapsible sections on the page.
 * This function finds all elements with the class '.devwatch-collapsible-header'
 * and attaches a click event listener to toggle the 'is-open' class on the parent
 * '.devwatch-collapsible-section' element.
 * 
 * It also sets the initial state based on the 'data-initial-state' attribute.
 * If 'data-initial-state' is 'open', the section will be open by default.
 */
function initializeCollapsibleSections() {
    document.querySelectorAll('.devwatch-collapsible-section').forEach(section => {
        const header = section.querySelector('.devwatch-collapsible-header');
        const content = section.querySelector('.devwatch-collapsible-content');
        
        if (!header || !content) return;

        // Set initial state
        if (section.dataset.initialState === 'open') {
            section.classList.add('is-open');
        }

        header.addEventListener('click', (event) => {
            // Stop propagation if the click is on a button or link within the header
            if (event.target.closest('button, a')) {
                return;
            }
            section.classList.toggle('is-open');
        });
    });
}

// Initialize the components when the DOM is fully loaded.
document.addEventListener('DOMContentLoaded', () => {
    initializeCollapsibleSections();
});
