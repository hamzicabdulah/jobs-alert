/**
 * Convert the given amount to USD format (i.e. use a $ sign and commas for thousands)
 * 
 * @param {number|string} amount - The amount to convert to USD format
 * @returns {string} - The amount in USD format
 */
function USDFormat(amount) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
}

/**
 * Capitalize a string, i.e. make it first letter uppercase
 * 
 * @param {string} string - Text which is to be capitalized
 * @returns {string} - The same text capitalized
 */
function capitalize(string) {
  return `${string[0].toUpperCase()}${string.slice(1)}`;
}

module.exports = { USDFormat, capitalize };