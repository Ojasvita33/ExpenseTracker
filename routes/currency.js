const express = require('express');
const currencyService = require('../services/currencyService');
const auth = require('../middleware/auth');
const Expense = require('../models/Expense');

const router = express.Router();

// Get supported currencies
router.get('/supported', (req, res) => {
    try {
        const currencies = currencyService.getSupportedCurrencies();
        res.json({
            success: true,
            currencies
        });
    } catch (error) {
        console.error('Get currencies error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Get exchange rates for a base currency
router.get('/rates/:baseCurrency', async (req, res) => {
    try {
        const { baseCurrency } = req.params;
        const rates = await currencyService.getExchangeRates(baseCurrency.toUpperCase());
        
        res.json({
            success: true,
            data: rates
        });
    } catch (error) {
        console.error('Get exchange rates error:', error);
        res.status(500).json({ message: 'Failed to fetch exchange rates', error: error.message });
    }
});

// Convert amount between currencies
router.post('/convert', async (req, res) => {
    try {
        const { amount, fromCurrency, toCurrency } = req.body;
        
        if (!amount || !fromCurrency || !toCurrency) {
            return res.status(400).json({ 
                message: 'Amount, from currency, and to currency are required' 
            });
        }

        const conversion = await currencyService.convertCurrency(
            parseFloat(amount),
            fromCurrency.toUpperCase(),
            toCurrency.toUpperCase()
        );

        res.json({
            success: true,
            data: conversion
        });
    } catch (error) {
        console.error('Currency conversion error:', error);
        res.status(500).json({ message: 'Conversion failed', error: error.message });
    }
});

// Get expenses converted to a specific currency
router.get('/expenses/:targetCurrency', auth, async (req, res) => {
    try {
        const { targetCurrency } = req.params;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        // Build filter object
        const filter = { userId: req.user._id };
        
        // Date range filter
        if (req.query.startDate || req.query.endDate) {
            filter.date = {};
            if (req.query.startDate) {
                filter.date.$gte = new Date(req.query.startDate);
            }
            if (req.query.endDate) {
                filter.date.$lte = new Date(req.query.endDate);
            }
        }
        
        // Category filter
        if (req.query.category && req.query.category !== 'all') {
            filter.category = req.query.category;
        }

        const expenses = await Expense.find(filter)
            .sort({ date: -1 })
            .skip(skip)
            .limit(limit);

        const total = await Expense.countDocuments(filter);
        const totalPages = Math.ceil(total / limit);

        // Convert all expenses to target currency
        const convertedExpenses = await currencyService.convertExpenses(
            expenses.map(exp => exp.toObject()),
            targetCurrency.toUpperCase()
        );

        // Calculate totals in target currency
        const totalConverted = convertedExpenses.reduce((sum, exp) => sum + exp.convertedAmount, 0);

        res.json({
            success: true,
            data: {
                expenses: convertedExpenses,
                pagination: {
                    currentPage: page,
                    totalPages,
                    totalExpenses: total,
                    hasNext: page < totalPages,
                    hasPrev: page > 1
                },
                summary: {
                    totalAmount: totalConverted,
                    currency: targetCurrency.toUpperCase(),
                    conversionTimestamp: new Date()
                }
            }
        });
    } catch (error) {
        console.error('Get converted expenses error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Get expense summary in multiple currencies
router.get('/summary/:baseCurrency', auth, async (req, res) => {
    try {
        const { baseCurrency } = req.params;
        const targetCurrencies = req.query.currencies ? req.query.currencies.split(',') : ['USD', 'EUR', 'GBP', 'INR'];

        // Get user's expenses for current month
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);

        const expenses = await Expense.find({
            userId: req.user._id,
            date: { $gte: startOfMonth }
        });

        // Calculate totals by original currency
        const originalTotals = {};
        expenses.forEach(expense => {
            const currency = expense.currency || 'USD';
            if (!originalTotals[currency]) {
                originalTotals[currency] = 0;
            }
            originalTotals[currency] += expense.amount;
        });

        // Convert to target currencies
        const conversions = {};
        const rates = await currencyService.getExchangeRates(baseCurrency.toUpperCase());

        for (const targetCurrency of targetCurrencies) {
            let totalInTarget = 0;
            
            for (const [origCurrency, amount] of Object.entries(originalTotals)) {
                if (origCurrency === targetCurrency) {
                    totalInTarget += amount;
                } else {
                    try {
                        const conversion = await currencyService.convertCurrency(
                            amount,
                            origCurrency,
                            targetCurrency.toUpperCase()
                        );
                        totalInTarget += conversion.convertedAmount;
                    } catch (error) {
                        console.error(`Failed to convert ${origCurrency} to ${targetCurrency}:`, error);
                    }
                }
            }

            conversions[targetCurrency.toUpperCase()] = {
                amount: parseFloat(totalInTarget.toFixed(2)),
                currency: targetCurrency.toUpperCase()
            };
        }

        res.json({
            success: true,
            data: {
                period: {
                    startDate: startOfMonth,
                    endDate: new Date()
                },
                originalTotals,
                conversions,
                baseCurrency: baseCurrency.toUpperCase(),
                exchangeRates: rates,
                timestamp: new Date()
            }
        });
    } catch (error) {
        console.error('Get currency summary error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Clear currency cache (admin function)
router.post('/clear-cache', auth, (req, res) => {
    try {
        currencyService.clearCache();
        res.json({
            success: true,
            message: 'Currency cache cleared successfully'
        });
    } catch (error) {
        console.error('Clear cache error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

module.exports = router;