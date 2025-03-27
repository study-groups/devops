/**
 * Module Fixing Script
 * Ensures essential modules are available globally
 */

// Create community link module if missing
if (typeof window.communityLink === 'undefined') {
  window.communityLink = {
    initCommunityLink: function() {
      console.log('[MODULES] Using fallback community link initialization');
      
      const communityLinkBtn = document.getElementById('community-link-btn');
      if (!communityLinkBtn) return;
      
      if (!communityLinkBtn.hasEventListener) {
        // Implementation copied from index.html fallback
        communityLinkBtn.addEventListener('click', function() {
          // Get auth state
          const authStateStr = localStorage.getItem('authState');
          if (!authStateStr) {
            alert('Please log in to add files to Community Files');
            return;
          }
          
          try {
            const authState = JSON.parse(authStateStr);
            if (!authState.isLoggedIn) {
              alert('Please log in to add files to Community Files');
              return;
            }
            
            // Get current file and directory
            const fileSelect = document.getElementById('file-select');
            const dirSelect = document.getElementById('dir-select');
            
            if (!fileSelect || !dirSelect || !fileSelect.value) {
              alert('Please select a file to add to Community Files');
              return;
            }
            
            const currentFile = fileSelect.value;
            
            // Get current content
            const editor = document.querySelector('#md-editor textarea');
            if (!editor) {
              alert('Editor not found');
              return;
            }
            
            const content = editor.value;
            
            // Confirmation
            if (confirm(`Add "${currentFile}" to Community Files?`)) {
              // Create authentication headers
              const headers = {
                'Authorization': `Basic ${btoa(`${authState.username}:${authState.hashedPassword}`)}`,
                'Content-Type': 'application/json'
              };
              
              // Save to Community Files
              fetch('/api/files/save', {
                method: 'POST',
                headers,
                body: JSON.stringify({
                  name: currentFile,
                  dir: 'Community_Files',
                  content: content
                })
              })
              .then(response => {
                if (response.ok) {
                  alert(`Successfully added ${currentFile} to Community Files!`);
                } else {
                  alert(`Error adding file to Community Files: ${response.status}`);
                }
              })
              .catch(error => {
                alert(`Error adding file to Community Files: ${error.message}`);
              });
            }
          } catch (error) {
            alert(`Error: ${error.message}`);
          }
        });
        
        communityLinkBtn.hasEventListener = true;
        console.log('[MODULES] Added event listener to community link button');
      }
    }
  };
}

// Add script to head
document.addEventListener('DOMContentLoaded', function() {
  console.log('[MODULES] FixModules script loaded and executed');
  
  // Initialize community link if possible
  if (window.communityLink && typeof window.communityLink.initCommunityLink === 'function') {
    window.communityLink.initCommunityLink();
  }
}); 