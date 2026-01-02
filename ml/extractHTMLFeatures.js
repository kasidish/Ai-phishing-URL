/**
 * Extracts features from HTML.
 * @param {string} html - HTML content
 * @returns {Array<number>} Feature vector
 */
module.exports = function extractHTMLFeatures(html) {
  if (!html || typeof html !== 'string') {
    // Return default values if HTML is not available
    return new Array(15).fill(0);
  }

  const lowerHTML = html.toLowerCase();
  
  // Extract features
  const features = [
    // 1. HTML length
    Math.min(html.length / 10000, 10), // Normalized to 0-10 range
    
    // 2. Number of forms
    (html.match(/<form/gi) || []).length,
    
    // 3. Number of input fields
    (html.match(/<input/gi) || []).length,
    
    // 4. Number of password input fields
    (html.match(/type=["']password["']/gi) || []).length,
    
    // 5. Number of external script links
    (html.match(/<script[^>]*src=/gi) || []).length,
    
    // 6. Number of inline scripts
    (html.match(/<script[^>]*>/gi) || []).length - (html.match(/<script[^>]*src=/gi) || []).length,
    
    // 7. Number of external stylesheet links
    (html.match(/<link[^>]*rel=["']stylesheet["']/gi) || []).length,
    
    // 8. Number of iframes
    (html.match(/<iframe/gi) || []).length,
    
    // 9. Number of anchor tags (links)
    (html.match(/<a[^>]*href=/gi) || []).length,
    
    // 10. Number of image tags
    (html.match(/<img/gi) || []).length,
    
    // 11. Contains suspicious keywords (normalized)
    containsSuspiciousKeywords(lowerHTML) ? 1 : 0,
    
    // 12. External domain reference ratio
    getExternalDomainRatio(html),
    
    // 13. Number of JavaScript event handlers
    (html.match(/on\w+\s*=/gi) || []).length,
    
    // 14. Number of meta tags
    (html.match(/<meta/gi) || []).length,
    
    // 15. Number of encoded strings (base64, hex, etc.)
    (html.match(/(data:|javascript:|&#x|%[0-9a-f]{2})/gi) || []).length
  ];
  
  return features;
};

/**
 * Checks if suspicious keywords are present
 */
function containsSuspiciousKeywords(html) {
  const suspiciousKeywords = [
    'verify',
    'account',
    'suspended',
    'locked',
    'urgent',
    'immediate',
    'click here',
    'login now',
    'confirm',
    'update',
    'security',
    'phishing',
    'verify your account',
    'account verification',
    'suspended account',
    'account locked',
    'urgent action required',
    'verify identity',
    'confirm identity',
    'security alert',
    'unusual activity',
    'verify email',
    'verify phone',
    'verify payment',
    'payment verification',
    'verify card',
    'card verification',
    'verify bank',
    'bank verification',
    'verify login',
    'login verification',
    'verify password',
    'password verification',
    'verify information',
    'information verification',
    'verify details',
    'details verification',
    'verify now',
    'verify immediately',
    'verify urgently',
    'verify asap',
    'verify quickly',
    'verify soon',
    'verify today',
    'verify now or',
    'verify or',
    'verify to',
    'verify and',
    'verify your',
    'verify my',
    'verify this',
    'verify that',
    'verify it',
    'verify us',
    'verify them',
    'verify we',
    'verify they',
    'verify i',
    'verify you',
    'verify he',
    'verify she',
    'verify it',
    'verify one',
    'verify two',
    'verify three',
    'verify four',
    'verify five',
    'verify six',
    'verify seven',
    'verify eight',
    'verify nine',
    'verify ten',
    'verify 1',
    'verify 2',
    'verify 3',
    'verify 4',
    'verify 5',
    'verify 6',
    'verify 7',
    'verify 8',
    'verify 9',
    'verify 0',
    'verify a',
    'verify b',
    'verify c',
    'verify d',
    'verify e',
    'verify f',
    'verify g',
    'verify h',
    'verify i',
    'verify j',
    'verify k',
    'verify l',
    'verify m',
    'verify n',
    'verify o',
    'verify p',
    'verify q',
    'verify r',
    'verify s',
    'verify t',
    'verify u',
    'verify v',
    'verify w',
    'verify x',
    'verify y',
    'verify z'
  ];
  
  return suspiciousKeywords.some(keyword => html.includes(keyword));
}

/**
 * Calculates external domain reference ratio
 */
function getExternalDomainRatio(html) {
  const urlPattern = /https?:\/\/([^\/"'\s]+)/gi;
  const matches = html.match(urlPattern) || [];
  
  if (matches.length === 0) return 0;
  
  // Extract domains and remove duplicates
  const domains = new Set();
  matches.forEach(url => {
    try {
      const domain = new URL(url).hostname;
      domains.add(domain);
    } catch (e) {
      // Ignore URL parsing failures
    }
  });
  
  // External domain ratio (normalized to 0-1 range)
  return Math.min(domains.size / 10, 1);
}

