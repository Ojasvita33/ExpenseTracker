// Currency utilities and symbols
const currencies = {
  USD: { name: 'US Dollar', symbol: '$', code: 'USD' },
  EUR: { name: 'Euro', symbol: '€', code: 'EUR' },
  GBP: { name: 'British Pound', symbol: '£', code: 'GBP' },
  INR: { name: 'Indian Rupee', symbol: '₹', code: 'INR' },
  JPY: { name: 'Japanese Yen', symbol: '¥', code: 'JPY' },
  CAD: { name: 'Canadian Dollar', symbol: 'C$', code: 'CAD' },
  AUD: { name: 'Australian Dollar', symbol: 'A$', code: 'AUD' },
  CHF: { name: 'Swiss Franc', symbol: 'CHF', code: 'CHF' },
  CNY: { name: 'Chinese Yuan', symbol: '¥', code: 'CNY' },
  KRW: { name: 'South Korean Won', symbol: '₩', code: 'KRW' }
};

// Get currency symbol
function getCurrencySymbol(currencyCode) {
  return currencies[currencyCode]?.symbol || currencyCode;
}

// Get currency name
function getCurrencyName(currencyCode) {
  return currencies[currencyCode]?.name || currencyCode;
}

// Format amount with currency
function formatCurrency(amount, currencyCode) {
  const symbol = getCurrencySymbol(currencyCode);
  const formattedAmount = parseFloat(amount).toFixed(2);
  
  // For some currencies, put symbol after the amount
  if (currencyCode === 'EUR') {
    return `${formattedAmount} ${symbol}`;
  }
  
  return `${symbol}${formattedAmount}`;
}

// Get all available currencies
function getAllCurrencies() {
  return Object.keys(currencies).map(code => ({
    code,
    name: currencies[code].name,
    symbol: currencies[code].symbol
  }));
}

module.exports = {
  currencies,
  getCurrencySymbol,
  getCurrencyName,
  formatCurrency,
  getAllCurrencies
};