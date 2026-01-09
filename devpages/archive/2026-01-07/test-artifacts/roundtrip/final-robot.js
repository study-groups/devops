#!/usr/bin/env node
/**
 * final-robot.js - Automated UI testing robot
 * Monkey clicks UI elements with delays to test save functionality
 */

console.log("🤖 Final Robot - Automated UI Testing");

class FinalRobot {
    constructor() {
        this.delays = {
            short: 100,
            medium: 500,
            long: 1000
        };
    }

    wait(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    log(message, type = 'info') {
        const emoji = type === 'error' ? '❌' : type === 'success' ? '✅' : '🤖';
        console.log(`${emoji} [Robot] ${message}`);
    }

    // Find element with multiple selectors
    findElement(selectors) {
        for (const selector of selectors) {
            const el = document.querySelector(selector);
            if (el) {
                this.log(`Found element: ${selector}`);
                return el;
            }
        }
        this.log(`Element not found. Tried: ${selectors.join(', ')}`, 'error');
        return null;
    }

    // Click with visual feedback
    async clickElement(element, description) {
        if (!element) {
            this.log(`Cannot click ${description} - element not found`, 'error');
            return false;
        }

        this.log(`Clicking ${description}...`);
        
        // Visual feedback
        const originalStyle = element.style.cssText;
        element.style.cssText = originalStyle + '; border: 3px solid red !important; background: yellow !important;';
        
        await this.wait(this.delays.short);
        
        // Perform click
        element.click();
        
        await this.wait(this.delays.medium);
        
        // Restore style
        element.style.cssText = originalStyle;
        
        this.log(`Clicked ${description}`, 'success');
        return true;
    }

    // Type text into element
    async typeText(element, text, description) {
        if (!element) {
            this.log(`Cannot type into ${description} - element not found`, 'error');
            return false;
        }

        this.log(`Typing into ${description}: "${text}"`);
        
        element.focus();
        await this.wait(this.delays.short);
        
        // Clear existing content
        element.value = '';
        element.textContent = '';
        
        // Type character by character
        for (let i = 0; i < text.length; i++) {
            const char = text[i];
            element.value += char;
            if (element.textContent !== undefined) {
                element.textContent += char;
            }
            
            // Trigger input events
            element.dispatchEvent(new Event('input', { bubbles: true }));
            element.dispatchEvent(new Event('change', { bubbles: true }));
            
            await this.wait(50); // Type speed
        }
        
        await this.wait(this.delays.short);
        this.log(`Typed into ${description}`, 'success');
        return true;
    }

    // Get current state
    getCurrentState() {
        if (!window.appStore) {
            this.log('No appStore found', 'error');
            return null;
        }

        const state = window.appStore.getState();
        return {
            path: state.path?.currentPathname,
            isDirectorySelected: state.path?.isDirectorySelected,
            editorModified: state.editor?.isModified,
            editorContent: state.editor?.content?.substring(0, 100),
            fileStatus: state.file?.status,
            authStatus: state.auth?.isAuthenticated
        };
    }

    // Log current state
    logState(prefix = '') {
        const state = this.getCurrentState();
        if (state) {
            this.log(`${prefix}Current State: ${JSON.stringify(state, null, 2)}`);
        }
    }

    // Test save button sequence
    async testSaveButton() {
        this.log("=== TESTING SAVE BUTTON SEQUENCE ===");
        
        // 1. Log initial state
        this.logState("Initial ");
        
        // 2. Find and check save button
        const saveButton = this.findElement([
            '#save-btn',
            'button[data-action="saveFile"]',
            'button:contains("Save")'
        ]);
        
        if (!saveButton) {
            this.log("Save button not found - cannot proceed", 'error');
            return false;
        }
        
        this.log(`Save button found: disabled=${saveButton.disabled}, text="${saveButton.textContent.trim()}"`);
        
        // 3. Check if we need to select a file first
        const state = this.getCurrentState();
        if (!state || !state.path || state.isDirectorySelected) {
            this.log("No file selected - trying to select a file first");
            await this.selectFile();
            await this.wait(this.delays.long);
        }
        
        // 4. Check if we need to modify content first
        const currentState = this.getCurrentState();
        if (!currentState || !currentState.editorModified) {
            this.log("No modifications detected - making test modification");
            await this.makeTestModification();
            await this.wait(this.delays.long);
        }
        
        // 5. Log state before save
        this.logState("Pre-save ");
        
        // 6. Click save button
        const clicked = await this.clickElement(saveButton, "save button");
        if (!clicked) {
            return false;
        }
        
        // 7. Wait for save operation
        await this.wait(this.delays.long * 2);
        
        // 8. Log final state
        this.logState("Post-save ");
        
        // 9. Check if save worked
        const finalState = this.getCurrentState();
        if (finalState && finalState.fileStatus === 'succeeded') {
            this.log("Save appears successful!", 'success');
            return true;
        } else {
            this.log(`Save may have failed. File status: ${finalState?.fileStatus}`, 'error');
            return false;
        }
    }

    // Try to select a file
    async selectFile() {
        this.log("Attempting to select a file...");
        
        // Try to find file selector
        const selectors = [
            '#context-primary-select',
            '#file-select',
            'select[name*="file"]',
            '.file-selector'
        ];
        
        const selector = this.findElement(selectors);
        if (selector && selector.options && selector.options.length > 1) {
            selector.selectedIndex = 1; // Select first file
            selector.dispatchEvent(new Event('change', { bubbles: true }));
            this.log("File selected from dropdown", 'success');
            return true;
        }
        
        // Try to find file list items
        const fileItems = document.querySelectorAll('[data-pathname], .file-item, .context-item');
        if (fileItems.length > 0) {
            await this.clickElement(fileItems[0], "first file item");
            return true;
        }
        
        this.log("Could not find any files to select", 'error');
        return false;
    }

    // Make test modification to content
    async makeTestModification() {
        this.log("Making test modification to trigger save state...");
        
        // Find editor elements
        const editorSelectors = [
            '#editor-textarea',
            '.editor-content',
            'textarea[name*="content"]',
            '[contenteditable="true"]'
        ];
        
        const editor = this.findElement(editorSelectors);
        if (editor) {
            const testText = `\n\n<!-- Robot test modification ${Date.now()} -->`;
            await this.typeText(editor, (editor.value || editor.textContent || '') + testText, "editor");
            return true;
        }
        
        this.log("Could not find editor element to modify", 'error');
        return false;
    }

    // Full robot test sequence
    async runFullTest() {
        this.log("🚀 Starting full robot test sequence...");
        
        try {
            // Wait for page to be ready
            await this.wait(this.delays.long);
            
            // Test save button
            const success = await this.testSaveButton();
            
            if (success) {
                this.log("🎉 Full test completed successfully!", 'success');
            } else {
                this.log("❌ Full test failed", 'error');
            }
            
            return success;
        } catch (error) {
            this.log(`Test failed with error: ${error.message}`, 'error');
            console.error(error);
            return false;
        }
    }

    // Extract cookies for curl usage
    extractCookiesForCurl() {
        this.log("Extracting cookies for curl usage...");
        
        const cookies = document.cookie.split(';');
        const cookieHeader = cookies
            .map(cookie => cookie.trim())
            .filter(cookie => cookie.length > 0)
            .join('; ');
        
        this.log(`Cookie header: ${cookieHeader}`);
        
        // Also try to get session cookie specifically
        const sessionCookie = cookies
            .find(cookie => cookie.includes('devpages.sid'));
        
        if (sessionCookie) {
            this.log(`Session cookie found: ${sessionCookie.trim()}`);
        }
        
        return {
            full: cookieHeader,
            session: sessionCookie?.trim(),
            curlCommand: `curl -H "Cookie: ${cookieHeader}" -X POST /api/files/save`
        };
    }
}

// Export for browser use
if (typeof window !== 'undefined') {
    window.finalRobot = new FinalRobot();
    
    // Add convenient global functions
    window.runRobotTest = () => window.finalRobot.runFullTest();
    window.testSave = () => window.finalRobot.testSaveButton();
    window.getCookies = () => window.finalRobot.extractCookiesForCurl();
    
    console.log(`
🤖 Final Robot loaded! Available commands:
  - runRobotTest() - Full automated test
  - testSave() - Test save button only  
  - getCookies() - Extract cookies for curl
  - finalRobot.logState() - Show current state
    `);
} else {
    console.log("Run this in the browser console with the devpages app loaded");
}

export { FinalRobot };