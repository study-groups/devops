// Updated communityLink.js to use the correct endpoint
// Only export the required function with minimal dependencies

// Import globalFetch for proper authentication
import { globalFetch } from '../globalFetch.js';

/**
 * Check if a file is linked to Community_Files
 * @param {string} filename - The filename to check
 * @param {string} directory - The directory containing the file
 * @returns {Promise<boolean>} - Whether the file is linked
 */
export async function checkLinkStatus(filename, directory) {
  try {
    console.log('[COMMUNITY] Checking link status for:', filename, 'in directory:', directory);
    
    // Use the community-link endpoint with action=check
    const url = `/api/community/link`;
    
    const response = await globalFetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        filename: filename,
        directory: directory,
        action: 'check'
      })
    });
    
    if (!response.ok) {
      throw new Error('Server returned ' + response.status);
    }
    
    const result = await response.json();
    console.log('[COMMUNITY] Link status result:', result);
    
    return result.linked;
  } catch (error) {
    console.log('[COMMUNITY] Error checking link status:', error.message);
    // Try alternative endpoint if first one fails
    try {
      const response = await globalFetch('/api/community/link', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          filename: filename,
          directory: directory,
          action: 'check'
        })
      });
      
      if (!response.ok) {
        throw new Error('Server returned ' + response.status);
      }
      
      const result = await response.json();
      console.log('[COMMUNITY] Alternative link status result:', result);
      
      return result.linked;
    } catch (altError) {
      console.log('[COMMUNITY] Alternative error checking link status:', altError.message);
      return false;
    }
  }
}

/**
 * Update the link button state based on current file and directory
 * @param {string} filename - The current filename
 * @param {string} directory - The current directory
 */
export async function updateLinkButtonState(filename, directory) {
  try {
    if (!filename) {
      console.log('[COMMUNITY] No file selected, cannot update link button state');
      return;
    }
    
    const linkButton = document.getElementById('community-link-btn');
    if (!linkButton) {
      console.log('[COMMUNITY] Community link button not found');
      return;
    }
    
    // If we're in Community_Files, always show "Remove Link"
    if (directory === 'Community_Files') {
      linkButton.classList.add('linked');
      linkButton.title = 'Remove from Community Files';
      linkButton.innerHTML = '<i class="fas fa-unlink"></i> Remove Link';
      return;
    }
    
    // Otherwise, check if the file is linked
    const isLinked = await checkLinkStatus(filename, directory);
    
    if (isLinked) {
      linkButton.classList.add('linked');
      linkButton.title = 'Remove from Community Files';
      linkButton.innerHTML = '<i class="fas fa-unlink"></i> Remove Link';
    } else {
      linkButton.classList.remove('linked');
      linkButton.title = 'Add to Community Files';
      linkButton.innerHTML = '<i class="fas fa-link"></i> Add Link';
    }
    
    console.log('[COMMUNITY] Updated link button state:', isLinked ? 'linked' : 'not linked');
  } catch (error) {
    console.log('[COMMUNITY] Error updating link button state:', error.message);
  }
}

/**
 * Initialize the community link component
 * This is the only exported function
 */
export function initCommunityLink() {
  try {
    console.log('[COMMUNITY] Initializing community link component');
    
    // Get the button element
    const linkButton = document.getElementById('community-link-btn');
    if (!linkButton) {
      console.log('[COMMUNITY] Community link button not found');
      return;
    }
    
    console.log('[COMMUNITY] Found community link button');
    
    // Add click event listener
    linkButton.addEventListener('click', function(event) {
      if (event) {
        event.preventDefault();
        event.stopPropagation();
      }
      
      console.log('[COMMUNITY] Link button clicked');
      
      // Get current file info from the UI
      const fileSelect = document.getElementById('file-select');
      const dirSelect = document.getElementById('dir-select');
      
      const filename = fileSelect ? fileSelect.value : '';
      const directory = dirSelect ? dirSelect.value : '';
      
      console.log('[COMMUNITY] Current file:', filename);
      console.log('[COMMUNITY] Current directory:', directory);
      
      if (!filename) {
        console.log('[COMMUNITY] No file selected');
        return;
      }
      
      // Determine the action based on button appearance or current directory
      // If we're in Community_Files, always remove
      const action = directory === 'Community_Files' || linkButton.classList.contains('linked') ? 'remove' : 'create';
      
      console.log('[COMMUNITY] Action:', action);
      
      // Try the original endpoint format with query parameters
      const url = `/api/community/link`;
      console.log('[COMMUNITY] Request URL:', url);
      
      // Use globalFetch which should handle authentication properly
      globalFetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          filename: filename,
          directory: directory,
          action: action
        })
      })
      .then(function(response) {
        console.log('[COMMUNITY] Response status:', response.status);
        
        if (!response.ok) {
          throw new Error('Server returned ' + response.status);
        }
        
        return response.json();
      })
      .then(function(result) {
        console.log('[COMMUNITY] API response:', result);
        
        // Update button appearance
        if (result.linked) {
          linkButton.classList.add('linked');
          linkButton.title = 'Remove from Community Files';
          linkButton.innerHTML = '<i class="fas fa-unlink"></i> Remove Link';
        } else {
          linkButton.classList.remove('linked');
          linkButton.title = 'Add to Community Files';
          linkButton.innerHTML = '<i class="fas fa-link"></i> Add Link';
        }
        
        console.log('[COMMUNITY] Link status updated:', result.linked);
      })
      .catch(function(error) {
        console.log('[COMMUNITY] API request error:', error.message);
        
        // If the first attempt fails, try the alternative endpoint
        console.log('[COMMUNITY] Trying alternative endpoint...');
        
        // Try the alternative endpoint format with JSON body
        globalFetch('/api/community/link', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            filename: filename,
            directory: directory,
            action: action
          })
        })
        .then(function(response) {
          console.log('[COMMUNITY] Alternative response status:', response.status);
          
          if (!response.ok) {
            throw new Error('Server returned ' + response.status);
          }
          
          return response.json();
        })
        .then(function(result) {
          console.log('[COMMUNITY] Alternative API response:', result);
          
          // Update button appearance
          if (result.linked) {
            linkButton.classList.add('linked');
            linkButton.title = 'Remove from Community Files';
            linkButton.innerHTML = '<i class="fas fa-unlink"></i> Remove Link';
          } else {
            linkButton.classList.remove('linked');
            linkButton.title = 'Add to Community Files';
            linkButton.innerHTML = '<i class="fas fa-link"></i> Add Link';
          }
          
          console.log('[COMMUNITY] Link status updated:', result.linked);
        })
        .catch(function(error) {
          console.log('[COMMUNITY] Alternative API request error:', error.message);
        });
      });
    });
    
    console.log('[COMMUNITY] Added click event listener to community link button');
  } catch (error) {
    console.log('[COMMUNITY] Error in initCommunityLink:', error.message);
  }
}

// Export for compatibility
export default { initCommunityLink };

/**
 * Compatibility module that re-exports from the main communityLink.js
 */
export { initCommunityLink, default } from '../communityLink.js'; 