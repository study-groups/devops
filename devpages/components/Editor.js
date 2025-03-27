import React, { useEffect } from 'react';

const Editor = () => {
  const handlePaste = (e) => {
    const items = e.clipboardData?.items;
    
    if (!items) return;
    
    let imageFile = null;
    
    // Check for image in clipboard data
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        imageFile = items[i].getAsFile();
        break;
      }
    }
    
    if (imageFile) {
      e.preventDefault(); // Prevent default paste behavior
      
      // Show upload indicator
      showNotification("Uploading image...", "info");
      
      // Use the same upload handler from above
      handleImageUpload(imageFile);
    }
  };

  // Add the paste event listener
  useEffect(() => {
    const editorElement = document.getElementById('editor');
    if (editorElement) {
      editorElement.addEventListener('paste', handlePaste);
      
      return () => {
        editorElement.removeEventListener('paste', handlePaste);
      };
    }
  }, []);

  return (
    // Rest of the component code
  );
};

export default Editor; 