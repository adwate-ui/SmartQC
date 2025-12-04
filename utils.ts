
/**
 * Checks if a URL string represents a video data URI.
 */
export const isVideo = (url: string | null | undefined): boolean => {
  return !!url?.startsWith('data:video');
};

/**
 * Ensures a URL is absolute (adds https:// if missing).
 */
export const safeLink = (url?: string): string | undefined => {
  if (!url) return undefined;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return `https://${url}`;
};

/**
 * Compresses an image file to a smaller JPEG Base64 string.
 * Resizes to max 800px dimension and 0.6 quality to ensure high speed and small payload.
 */
export const compressImage = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.src = url;
    
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;
      const MAX_SIZE = 800; // Aggressively reduced to ensure stability and speed

      if (width > height) {
        if (width > MAX_SIZE) {
          height *= MAX_SIZE / width;
          width = MAX_SIZE;
        }
      } else {
        if (height > MAX_SIZE) {
          width *= MAX_SIZE / height;
          height = MAX_SIZE;
        }
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error("Failed to get canvas context"));
        return;
      }
      
      ctx.drawImage(img, 0, 0, width, height);
      // Compress to JPEG 0.6 quality to drastically reduce payload size
      const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
      resolve(dataUrl);
    };
    
    img.onerror = (e) => {
      URL.revokeObjectURL(url);
      reject(e);
    };
  });
};

/**
 * Helper to convert File to Base64 string for storage/display.
 * Applies compression for images to avoid Payload Too Large errors.
 */
export const fileToBase64 = async (file: File): Promise<string> => {
  if (file.type.startsWith('image/')) {
    try {
      return await compressImage(file);
    } catch (e) {
      console.warn("Image compression failed, falling back to raw base64", e);
    }
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
  });
};

/**
 * Attempts to extract the Open Graph image from a URL via a public CORS proxy.
 * This is robust for most e-commerce sites (Shopify, Amazon, Luxury Brands).
 */
export const extractOgImage = async (url: string): Promise<string | null> => {
  try {
    const encodedUrl = encodeURIComponent(url);
    // Using allorigins.win as a public CORS proxy to fetch the HTML
    const response = await fetch(`https://api.allorigins.win/get?url=${encodedUrl}`);
    const data = await response.json();
    
    if (!data.contents) return null;
    const html = data.contents;

    // 1. Try og:image
    const ogImageMatch = html.match(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i);
    if (ogImageMatch && ogImageMatch[1]) {
      return resolveRelativeUrl(ogImageMatch[1], url);
    }

    // 2. Try twitter:image
    const twitterImageMatch = html.match(/<meta\s+name=["']twitter:image["']\s+content=["']([^"']+)["']/i);
    if (twitterImageMatch && twitterImageMatch[1]) {
      return resolveRelativeUrl(twitterImageMatch[1], url);
    }

    // 3. Try link rel="image_src"
    const linkImageMatch = html.match(/<link\s+rel=["']image_src["']\s+href=["']([^"']+)["']/i);
    if (linkImageMatch && linkImageMatch[1]) {
      return resolveRelativeUrl(linkImageMatch[1], url);
    }

    return null;
  } catch (e) {
    console.warn("OG Scraping failed:", e);
    return null;
  }
};

const resolveRelativeUrl = (path: string, baseUrl: string): string => {
  if (path.startsWith('http')) return path;
  if (path.startsWith('//')) return `https:${path}`;
  try {
    return new URL(path, baseUrl).href;
  } catch {
    return path;
  }
};
