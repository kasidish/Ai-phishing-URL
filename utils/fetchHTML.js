const puppeteer = require('puppeteer');

/**
 * Fetches HTML from URL. Automatically bypasses warning pages.
 * @param {string} url - URL to fetch
 * @param {number} timeout - Timeout in milliseconds (default: 30000)
 * @returns {Promise<string>} HTML content
 */
async function fetchHTML(url, timeout = 30000) {
  let browser;
  
  try {
    // Launch browser (headless mode)
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled',
        '--disable-web-security',
        '--disable-features=IsolateOrigins,site-per-process'
      ]
    });

    const page = await browser.newPage();
    
    // Set User-Agent (to appear as a regular browser)
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    // Set timeout
    page.setDefaultTimeout(timeout);

    // Set up listener for warning page detection and bypass
    page.on('dialog', async dialog => {
      console.log(`Warning dialog detected: ${dialog.message()}`);
      await dialog.accept(); // Automatically accept warning dialog
    });

    // Load page
    await page.goto(url, {
      waitUntil: 'networkidle2', // Wait until network is mostly idle
      timeout: timeout
    });

    // Attempt to automatically click warning page buttons
    try {
      // Common warning page button selectors
      const warningSelectors = [
        'button:contains("Continue")',
        'button:contains("Visit Site")',
        'a:contains("Continue")',
        'a:contains("Visit Site")',
        '[id*="continue"]',
        '[id*="proceed"]',
        '[class*="continue"]',
        '[class*="proceed"]',
        'button[type="submit"]',
        'input[type="submit"]'
      ];

      // Check page content
      const pageContent = await page.content();
      const lowerContent = pageContent.toLowerCase();
      
      // Check if it's a warning page (common warning text)
      const isWarningPage = 
        lowerContent.includes('warning') ||
        lowerContent.includes('deceptive site') ||
        lowerContent.includes('phishing') ||
        lowerContent.includes('suspicious') ||
        lowerContent.includes('unsafe');

      if (isWarningPage) {
        console.log(`Warning page detected, attempting to bypass...`);
        
        // Find and click continue button using multiple methods
        let clicked = false;
        
        // 1. Find button by text
        const buttonSelectors = [
          'button',
          'a',
          'input[type="submit"]',
          '[role="button"]'
        ];
        
        for (const selector of buttonSelectors) {
          try {
            const buttons = await page.$$(selector);
            for (const btn of buttons) {
              const text = await page.evaluate(el => el.textContent?.toLowerCase() || '', btn);
              if (text.includes('continue') || text.includes('visit') || 
                  text.includes('proceed') || text.includes('details')) {
                await btn.click();
                clicked = true;
                await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 }).catch(() => {});
                break;
              }
            }
            if (clicked) break;
          } catch (e) {
            // Continue trying
          }
        }
        
        // 2. Find by ID or class
        if (!clicked) {
          const idSelectors = [
            '[id*="continue"]',
            '[id*="proceed"]',
            '[id*="visit"]',
            '[class*="continue"]',
            '[class*="proceed"]',
            '[class*="visit"]'
          ];
          
          for (const selector of idSelectors) {
            try {
              const element = await page.$(selector);
              if (element) {
                await element.click();
                clicked = true;
                await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 }).catch(() => {});
                break;
              }
            } catch (e) {
              // Continue trying
            }
          }
        }
        
        // 3. Click first link if available
        if (!clicked) {
          try {
            const links = await page.$$('a[href]');
            if (links.length > 0) {
              await links[0].click();
              await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 }).catch(() => {});
            }
          } catch (e) {
            // Continue even if link click fails
          }
        }
      }
    } catch (error) {
      console.log(`Warning page bypass failed (continuing): ${error.message}`);
    }

    // Get final HTML
    const html = await page.content();
    
    await browser.close();
    return html;
    
  } catch (error) {
    if (browser) {
      await browser.close();
    }
    throw new Error(`Failed to fetch HTML (${url}): ${error.message}`);
  }
}

module.exports = fetchHTML;

