import imageCompression from 'browser-image-compression';

const handleImageUpload = async (file) => {
  // Check file size before attempting upload
  const MAX_FILE_SIZE = 8 * 1024 * 1024; // 8MB
  
  if (file.size > MAX_FILE_SIZE) {
    // If image is too large, compress it before uploading
    try {
      const compressedFile = await compressImage(file, {
        maxSizeMB: 4,
        maxWidthOrHeight: 1920,
        useWebWorker: true
      });
      
      // Continue with upload using the compressed file
      uploadImageToServer(compressedFile);
    } catch (error) {
      console.error("Image compression failed:", error);
      showNotification("Image is too large. Please use a smaller image (max 8MB).", "error");
    }
  } else {
    // Image is within size limits, upload directly
    uploadImageToServer(file);
  }
};

const compressImage = async (file, options) => {
  return await imageCompression(file, options);
};

const uploadImageToServer = async (file) => {
  try {
    const formData = new FormData();
    formData.append('image', file);
    
    const response = await fetch('/api/images/upload', {
      method: 'POST',
      body: formData,
    });
    
    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`Upload failed: ${response.status} - ${errorData}`);
    }
    
    const data = await response.json();
    // Handle successful upload
    // ...
  } catch (error) {
    console.error("Upload error:", error);
    showNotification(`Upload failed: ${error.message}`, "error");
  }
}; 