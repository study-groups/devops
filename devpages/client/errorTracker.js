// Create a basic script that will help us find where editor.initializeEditor is being called
(function() {
    console.log("Error tracker loaded");
    
    // Create a basic placeholder
    window.editor = window.editor || {};
    
    // Replace initializeEditor with a function that logs the call stack
    Object.defineProperty(window.editor, 'initializeEditor', {
        configurable: true,
        enumerable: true,
        get: function() {
            console.log("FOUND IT! editor.initializeEditor was accessed here:");
            console.trace("Call stack for editor.initializeEditor access");
            
            // Return a working function
            return function() {
                console.log("Placeholder initializeEditor called");
                return Promise.resolve(true);
            };
        }
    });
    
    console.log("Error tracker: editor object setup complete");
})(); 