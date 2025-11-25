/**
 * ImageEmbedder - Handles image embedding as base64 for published pages
 */

const log = window.APP?.services?.log?.createLogger('ImageEmbedder') || console;

export class ImageEmbedder {
  /**
   * Embed all images in HTML content as base64
   * @param {string} htmlContent - HTML string with image tags
   * @returns {Promise<string>} HTML with embedded base64 images
   */
  async embedImagesAsBase64(htmlContent) {
    if (!htmlContent) return '';

    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlContent, 'text/html');
    const images = Array.from(doc.querySelectorAll('img'));

    if (images.length === 0) {
      log.info?.('EMBED', 'NO_IMAGES', 'No images to embed');
      return htmlContent;
    }

    log.info?.('EMBED', 'START', `Embedding ${images.length} images`);

    const imagePromises = images.map(async (img) => {
      const src = img.getAttribute('src');
      if (!src || src.startsWith('data:')) {
        return; // Skip data URIs or empty src
      }

      try {
        const response = await window.APP.services.globalFetch(src, { credentials: 'omit' });
        if (!response.ok) {
          log.warn?.('EMBED', 'FETCH_FAIL', `Failed to fetch image: ${src} (Status: ${response.status})`);
          return;
        }

        const blob = await response.blob();
        const mimeType = blob.type;
        const base64String = await this.blobToBase64(blob);

        img.src = `data:${mimeType};base64,${base64String}`;
        log.info?.('EMBED', 'IMAGE_EMBEDDED', `Embedded: ${src}`);
      } catch (error) {
        log.error?.('EMBED', 'IMAGE_ERROR', `Error embedding image ${src}: ${error.message}`, error);
      }
    });

    await Promise.all(imagePromises);

    log.info?.('EMBED', 'COMPLETE', `Finished embedding ${images.length} images`);
    return doc.body.innerHTML;
  }

  /**
   * Convert blob to base64 string
   * @param {Blob} blob - Blob to convert
   * @returns {Promise<string>} Base64 encoded string
   */
  blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        // result contains the data as a data URL. We only want the base64 part.
        resolve(reader.result.split(',')[1]);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }
}

export const imageEmbedder = new ImageEmbedder();
