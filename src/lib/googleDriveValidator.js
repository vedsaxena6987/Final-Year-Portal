// lib/googleDriveValidator.js
// Utilities for validating and working with Google Drive links

/**
 * Validate if a URL is a valid Google Drive link
 * 
 * @param {string} url - The URL to validate
 * @returns {Object} {valid: boolean, error: string|null, fileId: string|null}
 */
export function validateGoogleDriveLink(url) {
  if (!url || typeof url !== 'string') {
    return { 
      valid: false, 
      error: 'URL is required',
      fileId: null 
    };
  }
  
  // Trim whitespace
  url = url.trim();
  
  // Check if URL starts with https
  if (!url.startsWith('https://')) {
    return { 
      valid: false, 
      error: 'URL must start with https://',
      fileId: null 
    };
  }
  
  // Google Drive URL patterns
  const patterns = [
    // Standard file view: https://drive.google.com/file/d/FILE_ID/view
    /^https:\/\/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/,
    
    // Open with ID: https://drive.google.com/open?id=FILE_ID
    /^https:\/\/drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/,
    
    // Google Docs/Sheets/Slides: https://docs.google.com/document/d/FILE_ID
    /^https:\/\/docs\.google\.com\/(document|spreadsheets|presentation)\/d\/([a-zA-Z0-9_-]+)/,
    
    // Drive folder: https://drive.google.com/drive/folders/FOLDER_ID
    /^https:\/\/drive\.google\.com\/drive\/folders\/([a-zA-Z0-9_-]+)/,
  ];
  
  let fileId = null;
  let isValid = false;
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      // For docs.google.com, fileId is in match[2], otherwise match[1]
      fileId = match[2] || match[1];
      isValid = true;
      break;
    }
  }
  
  if (!isValid) {
    return { 
      valid: false, 
      error: 'Invalid Google Drive link format. Please provide a valid share link.',
      fileId: null 
    };
  }
  
  // Additional validation: file ID should be at least 25 characters (typical Google Drive ID length)
  if (fileId && fileId.length < 25) {
    return { 
      valid: false, 
      error: 'Invalid Google Drive file ID. Please check your link.',
      fileId: null 
    };
  }
  
  return { 
    valid: true, 
    error: null,
    fileId 
  };
}

/**
 * Extract file ID from Google Drive URL
 * 
 * @param {string} url - Google Drive URL
 * @returns {string|null} File ID or null if not found
 */
export function extractDriveFileId(url) {
  const validation = validateGoogleDriveLink(url);
  return validation.fileId;
}

/**
 * Generate embeddable preview URL from Google Drive link
 * Useful for displaying files in iframe
 * 
 * @param {string} url - Original Google Drive URL
 * @returns {string|null} Embeddable URL or null if invalid
 */
export function generateDriveEmbedUrl(url) {
  const fileId = extractDriveFileId(url);
  if (!fileId) return null;
  
  return `https://drive.google.com/file/d/${fileId}/preview`;
}

/**
 * Generate direct download URL from Google Drive link
 * 
 * @param {string} url - Original Google Drive URL
 * @returns {string|null} Download URL or null if invalid
 */
export function generateDriveDownloadUrl(url) {
  const fileId = extractDriveFileId(url);
  if (!fileId) return null;
  
  return `https://drive.google.com/uc?export=download&id=${fileId}`;
}

/**
 * Check if Google Drive link is publicly accessible
 * Note: This is a basic check, actual accessibility depends on sharing settings
 * 
 * @param {string} url - Google Drive URL
 * @returns {Promise<Object>} {accessible: boolean, error: string|null}
 */
export async function checkDriveLinkAccessibility(url) {
  const validation = validateGoogleDriveLink(url);
  
  if (!validation.valid) {
    return {
      accessible: false,
      error: validation.error
    };
  }
  
  try {
    // Try to fetch the preview page
    const previewUrl = generateDriveEmbedUrl(url);
    const response = await fetch(previewUrl, { 
      method: 'HEAD',
      mode: 'no-cors' // Avoid CORS issues
    });
    
    // If we get here without error, assume accessible
    // Note: With no-cors, we can't check actual status code
    return {
      accessible: true,
      error: null
    };
  } catch (error) {
    return {
      accessible: false,
      error: 'Unable to verify link accessibility. Please ensure sharing is enabled.'
    };
  }
}

/**
 * Validate file type from Google Drive link
 * Note: This extracts from URL parameters if available
 * 
 * @param {string} url - Google Drive URL
 * @param {Array<string>} allowedTypes - Allowed file extensions (e.g., ['pdf', 'ppt', 'doc'])
 * @returns {Object} {valid: boolean, error: string|null}
 */
export function validateDriveFileType(url, allowedTypes = []) {
  if (allowedTypes.length === 0) {
    return { valid: true, error: null };
  }
  
  // Try to extract file type from URL or filename
  const urlLower = url.toLowerCase();
  
  const hasAllowedType = allowedTypes.some(type => 
    urlLower.includes(`.${type}`) || 
    urlLower.includes(`/${type}/`) ||
    urlLower.includes(`type=${type}`)
  );
  
  if (!hasAllowedType) {
    return {
      valid: false,
      error: `File must be one of these types: ${allowedTypes.join(', ')}`
    };
  }
  
  return { valid: true, error: null };
}

/**
 * Batch validate multiple Google Drive links
 * 
 * @param {Array<string>} urls - Array of Google Drive URLs
 * @returns {Object} {allValid: boolean, results: Array<Object>}
 */
export function validateMultipleDriveLinks(urls) {
  const results = urls.map((url, index) => ({
    index,
    url,
    ...validateGoogleDriveLink(url)
  }));
  
  const allValid = results.every(result => result.valid);
  
  return {
    allValid,
    results
  };
}

/**
 * Format Google Drive link for display (shortened)
 * 
 * @param {string} url - Google Drive URL
 * @param {number} maxLength - Maximum display length
 * @returns {string} Formatted display text
 */
export function formatDriveLinkForDisplay(url, maxLength = 50) {
  const fileId = extractDriveFileId(url);
  if (!fileId) return url;
  
  const displayText = `drive.google.com/...${fileId.slice(-8)}`;
  
  if (displayText.length > maxLength) {
    return displayText.slice(0, maxLength - 3) + '...';
  }
  
  return displayText;
}

/**
 * Helper to create a shareable Google Drive link message
 * 
 * @returns {string} Instructions for creating shareable links
 */
export function getDriveSharingInstructions() {
  return `
To create a shareable Google Drive link:
1. Right-click on your file in Google Drive
2. Click "Get link" or "Share"
3. Change access to "Anyone with the link"
4. Click "Copy link"
5. Paste the link here

Supported formats:
• drive.google.com/file/d/...
• drive.google.com/open?id=...
• docs.google.com/document/d/...
  `.trim();
}

/**
 * Extract filename from Google Drive URL if available
 * 
 * @param {string} url - Google Drive URL
 * @returns {string|null} Filename or null
 */
export function extractFilenameFromDriveUrl(url) {
  // Try to extract filename from URL parameters
  try {
    const urlObj = new URL(url);
    const filename = urlObj.searchParams.get('filename') || 
                    urlObj.searchParams.get('name');
    return filename;
  } catch {
    return null;
  }
}
