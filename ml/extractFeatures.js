module.exports = function extract(url) {
  return [
    url.length,                                   // Feature 1: URL length
    (url.match(/@/g) || []).length,               // Feature 2: Number of @ symbols
    (url.match(/-/g) || []).length,               // Feature 3: Number of hyphens
    (url.match(/\./g) || []).length,              // Feature 4: Number of dots
    url.startsWith("https") ? 1 : 0,              // Feature 5: Has HTTPS (1) or not (0)
    /\d+\.\d+\.\d+\.\d+/.test(url) ? 1 : 0,       // Feature 6: Contains IP address
    /\.(xyz|top|click|tk|cyou)/.test(url) ? 1 : 0 // Feature 7: Suspicious TLD
  ];
};
