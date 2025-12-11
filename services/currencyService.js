const fetch = require('node-fetch');

class CurrencyService {
    constructor() {
        this.apiKey = process.env.CURRENCY_API_KEY || 'e8a2d2fccaa7582f1e7a5936';
        this.baseUrl = 'https://v6.exchangerate-api.com/v6';
        this.cache = new Map();
        this.cacheExpiry = 5 * 60 * 1000; // 5 minutes cache
    }

    // Get exchange rates for a base currency
    async getExchangeRates(baseCurrency = 'USD') {
        const cacheKey = `rates_${baseCurrency}`;
        const cached = this.cache.get(cacheKey);
        
        if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
            return cached.data;
        }

        try {
            const response = await fetch(`${this.baseUrl}/${this.apiKey}/latest/${baseCurrency}`);
            
            if (!response.ok) {
                throw new Error(`API request failed: ${response.status}`);
            }

            const data = await response.json();
            
            if (data.result !== 'success') {
                throw new Error(`API error: ${data['error-type']}`);
            }

            const rates = {
                base: baseCurrency,
                rates: data.conversion_rates,
                lastUpdated: new Date(data.time_last_update_unix * 1000),
                nextUpdate: new Date(data.time_next_update_unix * 1000)
            };

            // Cache the result
            this.cache.set(cacheKey, {
                data: rates,
                timestamp: Date.now()
            });

            return rates;
        } catch (error) {
            console.error('Currency API error:', error);
            // Return fallback rates if API fails
            return this.getFallbackRates(baseCurrency);
        }
    }

    // Convert amount from one currency to another
    async convertCurrency(amount, fromCurrency, toCurrency) {
        if (fromCurrency === toCurrency) {
            return {
                originalAmount: amount,
                convertedAmount: amount,
                fromCurrency,
                toCurrency,
                exchangeRate: 1,
                timestamp: new Date()
            };
        }

        try {
            const rates = await this.getExchangeRates(fromCurrency);
            const exchangeRate = rates.rates[toCurrency];
            
            if (!exchangeRate) {
                throw new Error(`Exchange rate not found for ${toCurrency}`);
            }

            const convertedAmount = parseFloat((amount * exchangeRate).toFixed(2));

            return {
                originalAmount: amount,
                convertedAmount,
                fromCurrency,
                toCurrency,
                exchangeRate,
                timestamp: new Date()
            };
        } catch (error) {
            console.error('Currency conversion error:', error);
            throw error;
        }
    }

    // Convert multiple expenses to a target currency
    async convertExpenses(expenses, targetCurrency) {
        const conversions = [];
        
        for (const expense of expenses) {
            try {
                if (expense.currency !== targetCurrency) {
                    const conversion = await this.convertCurrency(
                        expense.amount,
                        expense.currency,
                        targetCurrency
                    );
                    conversions.push({
                        ...expense,
                        originalAmount: expense.amount,
                        originalCurrency: expense.currency,
                        convertedAmount: conversion.convertedAmount,
                        convertedCurrency: targetCurrency,
                        exchangeRate: conversion.exchangeRate
                    });
                } else {
                    conversions.push({
                        ...expense,
                        originalAmount: expense.amount,
                        originalCurrency: expense.currency,
                        convertedAmount: expense.amount,
                        convertedCurrency: targetCurrency,
                        exchangeRate: 1
                    });
                }
            } catch (error) {
                console.error(`Failed to convert expense ${expense._id}:`, error);
                // Keep original if conversion fails
                conversions.push({
                    ...expense,
                    originalAmount: expense.amount,
                    originalCurrency: expense.currency,
                    convertedAmount: expense.amount,
                    convertedCurrency: expense.currency,
                    exchangeRate: 1,
                    conversionError: error.message
                });
            }
        }

        return conversions;
    }

    // Get supported currencies
    getSupportedCurrencies() {
        return [
            { code: 'USD', name: 'US Dollar', symbol: '$' },
            { code: 'EUR', name: 'Euro', symbol: '€' },
            { code: 'GBP', name: 'British Pound', symbol: '£' },
            { code: 'INR', name: 'Indian Rupee', symbol: '₹' },
            { code: 'JPY', name: 'Japanese Yen', symbol: '¥' },
            { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$' },
            { code: 'AUD', name: 'Australian Dollar', symbol: 'A$' },
            { code: 'CHF', name: 'Swiss Franc', symbol: 'CHF' },
            { code: 'CNY', name: 'Chinese Yuan', symbol: '¥' },
            { code: 'KRW', name: 'South Korean Won', symbol: '₩' },
            { code: 'SEK', name: 'Swedish Krona', symbol: 'kr' },
            { code: 'NOK', name: 'Norwegian Krone', symbol: 'kr' },
            { code: 'DKK', name: 'Danish Krone', symbol: 'kr' },
            { code: 'PLN', name: 'Polish Zloty', symbol: 'zł' },
            { code: 'CZK', name: 'Czech Koruna', symbol: 'Kč' },
            { code: 'HUF', name: 'Hungarian Forint', symbol: 'Ft' },
            { code: 'RUB', name: 'Russian Ruble', symbol: '₽' },
            { code: 'BRL', name: 'Brazilian Real', symbol: 'R$' },
            { code: 'MXN', name: 'Mexican Peso', symbol: '$' },
            { code: 'SGD', name: 'Singapore Dollar', symbol: 'S$' }
        ];
    }

    // Fallback rates if API fails (approximate rates)
    getFallbackRates(baseCurrency) {
        const fallbackRates = {
            USD: { EUR: 0.85, GBP: 0.73, INR: 83.12, JPY: 149.50, CAD: 1.25, AUD: 1.52 },
            EUR: { USD: 1.18, GBP: 0.86, INR: 97.75, JPY: 176.05, CAD: 1.47, AUD: 1.79 },
            GBP: { USD: 1.37, EUR: 1.16, INR: 113.67, JPY: 204.83, CAD: 1.71, AUD: 2.08 }
        };

        return {
            base: baseCurrency,
            rates: fallbackRates[baseCurrency] || fallbackRates.USD,
            lastUpdated: new Date(),
            nextUpdate: new Date(Date.now() + 60 * 60 * 1000),
            isFallback: true
        };
    }

    // Clear cache
    clearCache() {
        this.cache.clear();
    }
}

module.exports = new CurrencyService();