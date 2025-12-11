// Global variables
let currentUser = null;
let authToken = null;
let currentPage = 1;
let isEditMode = false;
let charts = {};

// Currency symbols mapping
const currencySymbols = {
    'USD': '$',
    'EUR': '€',
    'GBP': '£',
    'INR': '₹',
    'JPY': '¥',
    'CAD': 'C$',
    'AUD': 'A$',
    'CHF': 'CHF',
    'CNY': '¥',
    'KRW': '₩'
};

// API base URL
const API_BASE = '/api';

// Initialize app
document.addEventListener('DOMContentLoaded', function() {
    // Initialize theme
    initializeTheme();
    
    // Initialize user's preferred currency
    initializeUserCurrency();
    
    // Check if user is logged in
    authToken = localStorage.getItem('authToken');
    if (authToken) {
        getCurrentUser();
    } else {
        showWelcomeContent();
    }

    // Set up event listeners
    setupEventListeners();
    
    // Set today's date as default
    document.getElementById('expenseDate').value = new Date().toISOString().split('T')[0];
});

// Currency helper functions
function updateCurrencySymbol() {
    const currency = document.getElementById('expenseCurrency').value;
    const symbol = currencySymbols[currency] || currency;
    document.getElementById('currencySymbol').textContent = symbol;
}

function formatCurrency(amount, currency) {
    const symbol = currencySymbols[currency] || currency;
    const formattedAmount = parseFloat(amount).toFixed(2);
    
    if (currency === 'EUR') {
        return `${formattedAmount} ${symbol}`;
    }
    return `${symbol}${formattedAmount}`;
}

// Theme Management Functions
function initializeTheme() {
    // Get saved theme from localStorage, default to 'light'
    const savedTheme = localStorage.getItem('theme') || 'light';
    setTheme(savedTheme);
}

function setTheme(theme) {
    const html = document.documentElement;
    const themeIcon = document.getElementById('themeIcon');
    
    if (theme === 'dark') {
        html.setAttribute('data-theme', 'dark');
        if (themeIcon) {
            themeIcon.className = 'fas fa-sun';
        }
    } else {
        html.setAttribute('data-theme', 'light');
        if (themeIcon) {
            themeIcon.className = 'fas fa-moon';
        }
    }
    
    // Save theme preference
    localStorage.setItem('theme', theme);
    
    // Update charts if they exist (for better visibility in dark mode)
    if (Object.keys(charts).length > 0) {
        updateChartsForTheme(theme);
    }
}

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    
    // Show toast notification
    showToast(`Switched to ${newTheme} mode`, 'success');
}

function updateChartsForTheme(theme) {
    const isDark = theme === 'dark';
    const textColor = isDark ? '#ffffff' : '#666';
    const gridColor = isDark ? '#4a5568' : '#e0e0e0';
    
    // Update all existing charts
    Object.values(charts).forEach(chart => {
        if (chart && chart.options) {
            // Update text colors
            if (chart.options.plugins && chart.options.plugins.legend) {
                chart.options.plugins.legend.labels.color = textColor;
            }
            
            // Update scales colors for line/bar charts
            if (chart.options.scales) {
                Object.keys(chart.options.scales).forEach(scaleKey => {
                    const scale = chart.options.scales[scaleKey];
                    if (scale.ticks) {
                        scale.ticks.color = textColor;
                    }
                    if (scale.grid) {
                        scale.grid.color = gridColor;
                    }
                });
            }
            
            // Update the chart
            chart.update();
        }
    });
}

// Currency preference functions
function initializeUserCurrency() {
    // Get user's MANUALLY SET default currency, not the last used currency
    const userDefaultCurrency = localStorage.getItem('userDefaultCurrency') || 'INR';
    
    // Set currency dropdown to user's default (they can change it for individual expenses)
    const currencySelect = document.getElementById('expenseCurrency');
    if (currencySelect) {
        currencySelect.value = userDefaultCurrency;
        updateCurrencySymbol();
    }
    
    // Update navbar currency selector
    updateNavbarCurrencySelector(userDefaultCurrency);
}

function setDefaultCurrency(currency) {
    // Save the new DEFAULT currency - this is user's manual choice
    localStorage.setItem('userDefaultCurrency', currency);
    
    // Update navbar display
    updateNavbarCurrencySelector(currency);
    
    // Update expense form currency to this default
    const currencySelect = document.getElementById('expenseCurrency');
    if (currencySelect) {
        currencySelect.value = currency;
        updateCurrencySymbol();
    }
    
    // Refresh dashboard with new currency
    if (authToken) {
        loadDashboard();
        loadExpenses();
        // Also refresh charts/reports so they use the new currency
        loadReports();
    }
    
    // Show success message
    showToast(`Default currency set to ${currency}. All amounts will be converted to ${currency}`, 'success');
}

function updateNavbarCurrencySelector(currency) {
    const selectedCurrency = document.getElementById('selectedCurrency');
    if (selectedCurrency) {
        selectedCurrency.textContent = currency;
    }
    
    // Update dropdown button with currency symbol
    const currencyButton = document.getElementById('currencyDropdown');
    if (currencyButton) {
        const symbol = currencySymbols[currency] || currency;
        currencyButton.innerHTML = `<i class="fas fa-coins me-1"></i>${currency} (${symbol})`;
    }
}

// Form validation helper functions
function showFieldError(fieldId, message) {
    const field = document.getElementById(fieldId);
    if (field) {
        field.classList.add('is-invalid');
        
        // Remove existing error message
        const existingError = field.parentNode.querySelector('.invalid-feedback');
        if (existingError) {
            existingError.remove();
        }
        
        // Add new error message
        const errorDiv = document.createElement('div');
        errorDiv.className = 'invalid-feedback';
        errorDiv.textContent = message;
        field.parentNode.appendChild(errorDiv);
    }
}

function clearValidationErrors() {
    // Remove all invalid classes
    const invalidFields = document.querySelectorAll('.is-invalid');
    invalidFields.forEach(field => {
        field.classList.remove('is-invalid');
    });
    
    // Remove all error messages
    const errorMessages = document.querySelectorAll('.invalid-feedback');
    errorMessages.forEach(error => {
        error.remove();
    });
}

// Currency conversion functions
async function getExchangeRates() {
    try {
        // Try to get cached rates first
        const cached = localStorage.getItem('exchangeRates');
        const cacheTime = localStorage.getItem('exchangeRatesTime');
        
        // Use cached rates if they're less than 1 hour old
        if (cached && cacheTime && (Date.now() - parseInt(cacheTime)) < 3600000) {
            return JSON.parse(cached);
        }
        
        // Fetch new rates from API
        const response = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
        if (response.ok) {
            const data = await response.json();
            // Cache the rates
            localStorage.setItem('exchangeRates', JSON.stringify(data.rates));
            localStorage.setItem('exchangeRatesTime', Date.now().toString());
            return data.rates;
        }
    } catch (error) {
        console.warn('Exchange rate fetch failed, using fallback rates');
    }
    
    // Fallback exchange rates (approximate)
    return {
        USD: 1,
        EUR: 0.85,
        GBP: 0.73,
        INR: 83.12,
        JPY: 149.50,
        CAD: 1.37,
        AUD: 1.53,
        CHF: 0.91,
        CNY: 7.31,
        KRW: 1342.50
    };
}

function convertCurrencyAmount(amount, fromCurrency, toCurrency, exchangeRates) {
    if (fromCurrency === toCurrency) return amount;
    
    // Convert to USD first, then to target currency
    const usdAmount = amount / exchangeRates[fromCurrency];
    const convertedAmount = usdAmount * exchangeRates[toCurrency];
    
    return convertedAmount;
}

async function convertAndSumExpenses(expenses, targetCurrency) {
    const exchangeRates = await getExchangeRates();
    let totalAmount = 0;
    
    expenses.forEach(expense => {
        const convertedAmount = convertCurrencyAmount(
            expense.amount, 
            expense.currency, 
            targetCurrency, 
            exchangeRates
        );
        totalAmount += convertedAmount;
    });
    
    return totalAmount;
}

async function updateDashboardWithCurrencyConversion(data, preferredCurrency) {
    try {
        const exchangeRates = await getExchangeRates();

        // Helper: fetch expenses for a date range (max limit large enough for personal use)
        async function getExpensesForRange(startDate, endDate) {
            try {
                const params = new URLSearchParams({ startDate, endDate, limit: 1000 });
                const response = await fetch(`${API_BASE}/expenses?${params}`, {
                    headers: { 'Authorization': `Bearer ${authToken}` }
                });

                if (response.ok) {
                    const result = await response.json();
                    return result.expenses || [];
                }
            } catch (err) {
                console.warn('Failed to fetch expenses for range', startDate, endDate, err);
            }
            return [];
        }

        // Convert monthly total (prefer converting individual expenses rather than trusting aggregated raw totals)
        let monthlyTotal = 0;
        if (data.monthly && data.monthly.expenses && data.monthly.expenses.length > 0) {
            monthlyTotal = await convertAndSumExpenses(data.monthly.expenses, preferredCurrency);
        } else {
            // fetch expenses for current month and sum them
            const now = new Date();
            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
            const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
            const monthlyExpenses = await getExpensesForRange(startOfMonth, endOfMonth);
            monthlyTotal = await convertAndSumExpenses(monthlyExpenses, preferredCurrency);
        }
        
        // Convert weekly total
        let weeklyTotal = 0;
        if (data.weekly && data.weekly.expenses && data.weekly.expenses.length > 0) {
            weeklyTotal = await convertAndSumExpenses(data.weekly.expenses, preferredCurrency);
        } else {
            // sum expenses for the last 7 days
            const now = new Date();
            const startOfWeekDate = new Date(now);
            startOfWeekDate.setDate(now.getDate() - 6); // last 7 days including today
            const startOfWeek = startOfWeekDate.toISOString().split('T')[0];
            const endOfWeek = new Date().toISOString().split('T')[0];
            const weeklyExpenses = await getExpensesForRange(startOfWeek, endOfWeek);
            weeklyTotal = await convertAndSumExpenses(weeklyExpenses, preferredCurrency);
        }
        
        // Convert yearly total
        let yearlyTotal = 0;
        if (data.yearly && data.yearly.expenses && data.yearly.expenses.length > 0) {
            yearlyTotal = await convertAndSumExpenses(data.yearly.expenses, preferredCurrency);
        } else {
            // sum expenses for the current year
            const yearNow = new Date().getFullYear();
            const startOfYear = new Date(yearNow, 0, 1).toISOString().split('T')[0];
            const endOfYear = new Date(yearNow, 11, 31).toISOString().split('T')[0];
            const yearlyExpenses = await getExpensesForRange(startOfYear, endOfYear);
            yearlyTotal = await convertAndSumExpenses(yearlyExpenses, preferredCurrency);
        }
        
        // Update dashboard with converted amounts
        document.getElementById('monthlyTotal').textContent = formatCurrency(monthlyTotal, preferredCurrency);
        document.getElementById('weeklyTotal').textContent = formatCurrency(weeklyTotal, preferredCurrency);
        document.getElementById('yearlyTotal').textContent = formatCurrency(yearlyTotal, preferredCurrency);
        document.getElementById('totalExpenses').textContent = data.yearly.count || 0;
        
    // Do not show a per-card conversion indicator. Dashboard values are shown in the user's preferred currency.
        
    } catch (error) {
        console.error('Currency conversion error:', error);
        // Fallback to original amounts
        document.getElementById('monthlyTotal').textContent = formatCurrency(data.monthly.total || 0, preferredCurrency);
        document.getElementById('weeklyTotal').textContent = formatCurrency(data.weekly.total || 0, preferredCurrency);
        document.getElementById('yearlyTotal').textContent = formatCurrency(data.yearly.total || 0, preferredCurrency);
        document.getElementById('totalExpenses').textContent = data.yearly.count || 0;
    }
}



// Set up event listeners
function setupEventListeners() {
    // Auth form submission
    document.getElementById('authForm').addEventListener('submit', handleAuth);
    
    // Expense form submission
    document.getElementById('expenseForm').addEventListener('submit', handleExpenseSubmit);
    
    // Search input
    document.getElementById('searchInput').addEventListener('input', debounce(loadExpenses, 500));
    
    // Category filter
    document.getElementById('categoryFilter').addEventListener('change', loadExpenses);
    
    // Tab switching
    document.getElementById('reports-tab').addEventListener('click', loadReports);
}

// Debounce function for search
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Authentication functions
function showLoginModal(mode = 'login') {
    const modal = new bootstrap.Modal(document.getElementById('loginModal'));
    const isLogin = mode === 'login';
    
    document.getElementById('authModalTitle').textContent = isLogin ? 'Login' : 'Register';
    document.getElementById('nameField').style.display = isLogin ? 'none' : 'block';
    document.getElementById('authSubmitBtn').textContent = isLogin ? 'Login' : 'Register';
    document.getElementById('authSwitchText').textContent = isLogin ? "Don't have an account?" : "Already have an account?";
    document.getElementById('authSwitchLink').textContent = isLogin ? 'Register here' : 'Login here';
    
    if (isLogin) {
        document.getElementById('name').removeAttribute('required');
    } else {
        document.getElementById('name').setAttribute('required', 'required');
    }
    
    modal.show();
}

function toggleAuthMode() {
    const title = document.getElementById('authModalTitle').textContent;
    const newMode = title === 'Login' ? 'register' : 'login';
    showLoginModal(newMode);
}

async function handleAuth(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    const isLogin = document.getElementById('authModalTitle').textContent === 'Login';
    
    const data = {
        email: formData.get('email'),
        password: formData.get('password')
    };
    
    if (!isLogin) {
        data.name = formData.get('name');
    }
    
    try {
        showLoading(true);
        const response = await fetch(`${API_BASE}/auth/${isLogin ? 'login' : 'register'}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });
        
        const result = await response.json();
        
        if (response.ok) {
            authToken = result.token;
            localStorage.setItem('authToken', authToken);
            currentUser = result.user;
            
            // Close modal and show main content
            bootstrap.Modal.getInstance(document.getElementById('loginModal')).hide();
            showMainContent();
            showToast(`${isLogin ? 'Login' : 'Registration'} successful!`, 'success');
        } else {
            showToast(result.message || 'Authentication failed', 'error');
        }
    } catch (error) {
        showToast('Network error. Please try again.', 'error');
    } finally {
        showLoading(false);
    }
}

async function getCurrentUser() {
    try {
        const response = await fetch(`${API_BASE}/auth/me`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        if (response.ok) {
            const result = await response.json();
            currentUser = result.user;
            showMainContent();
        } else {
            localStorage.removeItem('authToken');
            authToken = null;
            showWelcomeContent();
        }
    } catch (error) {
        localStorage.removeItem('authToken');
        authToken = null;
        showWelcomeContent();
    }
}

function logout() {
    localStorage.removeItem('authToken');
    authToken = null;
    currentUser = null;
    showWelcomeContent();
    showToast('Logged out successfully!', 'success');
}

// UI functions
function showWelcomeContent() {
    document.getElementById('welcomeContent').style.display = 'block';
    document.getElementById('mainContent').classList.add('d-none');
    document.getElementById('authNav').classList.add('d-none');
    document.getElementById('currencySelector').style.display = 'none';
}

function showMainContent() {
    document.getElementById('welcomeContent').style.display = 'none';
    document.getElementById('mainContent').classList.remove('d-none');
    document.getElementById('authNav').classList.remove('d-none');
    document.getElementById('currencySelector').style.display = 'block';
    document.getElementById('userName').textContent = currentUser.name;
    
    // Initialize currency selector with user's default currency
    const userDefaultCurrency = localStorage.getItem('userDefaultCurrency') || 'INR';
    updateNavbarCurrencySelector(userDefaultCurrency);
    
    // Load initial data
    loadDashboard();
    loadExpenses();
}

function showLoading(show) {
    document.getElementById('loadingSpinner').classList.toggle('d-none', !show);
}

function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    const toastMessage = document.getElementById('toastMessage');
    
    toastMessage.textContent = message;
    
    // Update toast header based on type
    const icon = toast.querySelector('.fas');
    const headerText = toast.querySelector('.me-auto');
    
    switch (type) {
        case 'success':
            icon.className = 'fas fa-check-circle text-success me-2';
            headerText.textContent = 'Success';
            break;
        case 'error':
            icon.className = 'fas fa-exclamation-circle text-danger me-2';
            headerText.textContent = 'Error';
            break;
        default:
            icon.className = 'fas fa-info-circle text-primary me-2';
            headerText.textContent = 'Info';
    }
    
    const bsToast = new bootstrap.Toast(toast);
    bsToast.show();
}

// Dashboard functions
async function loadDashboard() {
    try {
        const response = await fetch(`${API_BASE}/reports/dashboard`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            
            // Get user's MANUALLY SET preferred currency (default to INR)
            // This should ONLY change when user explicitly sets it via navbar dropdown
            const preferredCurrency = localStorage.getItem('userDefaultCurrency') || 'INR';
            
            // Convert all amounts to user's preferred currency
            await updateDashboardWithCurrencyConversion(data, preferredCurrency);
        }
    } catch (error) {
        console.error('Dashboard error:', error);
    }
}

// Expense functions
async function loadExpenses(page = 1) {
    try {
        showLoading(true);
        const params = new URLSearchParams({
            page: page,
            limit: 10
        });
        
        // Add filters
        const search = document.getElementById('searchInput').value;
        const category = document.getElementById('categoryFilter').value;
        const filterDate = document.getElementById('filterDate').value;
        
        if (search) params.append('search', search);
        if (category && category !== 'all') params.append('category', category);
        if (filterDate) {
            // If date is provided, filter by that specific month
            const date = new Date(filterDate);
            const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
            const endOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0);
            params.append('startDate', startOfMonth.toISOString().split('T')[0]);
            params.append('endDate', endOfMonth.toISOString().split('T')[0]);
        }
        
        const response = await fetch(`${API_BASE}/expenses?${params}`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            displayExpenses(data.expenses);
            displayPagination(data.pagination);
            currentPage = page;
        }
    } catch (error) {
        showToast('Error loading expenses', 'error');
    } finally {
        showLoading(false);
    }
}

async function displayExpenses(expenses) {
    const tbody = document.getElementById('expensesTableBody');
    tbody.innerHTML = '';
    
    if (expenses.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="text-center text-muted">
                    <i class="fas fa-inbox fa-2x mb-2 d-block"></i>
                    No expenses found
                </td>
            </tr>
        `;
        return;
    }
    
    const userDefaultCurrency = localStorage.getItem('userDefaultCurrency') || 'INR';
    const exchangeRates = await getExchangeRates();
    
    expenses.forEach(expense => {
        const row = document.createElement('tr');
        const originalAmount = formatCurrency(expense.amount, expense.currency || 'USD');
        
        // Show converted amount if different currency than user's default
        let amountDisplay = originalAmount;
        if (expense.currency !== userDefaultCurrency) {
            const convertedAmount = convertCurrencyAmount(
                expense.amount, 
                expense.currency || 'USD', 
                userDefaultCurrency, 
                exchangeRates
            );
            const convertedFormatted = formatCurrency(convertedAmount, userDefaultCurrency);
            amountDisplay = `
                <div class="expense-amount">${originalAmount}</div>
                <small class="text-info">≈ ${convertedFormatted}</small>
            `;
        } else {
            amountDisplay = `<div class="expense-amount">${originalAmount}</div>`;
        }
        
        row.innerHTML = `
            <td>
                <div class="fw-bold">${expense.title}</div>
                ${expense.description ? `<small class="text-muted">${expense.description}</small>` : ''}
            </td>
            <td>
                ${amountDisplay}
                <br><small class="text-muted">${expense.currency || 'USD'}</small>
            </td>
            <td>
                <span class="badge category-${expense.category}">${expense.category}</span>
            </td>
            <td class="expense-date">${new Date(expense.date).toLocaleDateString()}</td>
            <td>
                <button class="btn btn-sm btn-outline-primary me-1" onclick="editExpense('${expense._id}')">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn btn-sm btn-outline-danger" onclick="deleteExpense('${expense._id}')">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

function displayPagination(pagination) {
    const paginationContainer = document.getElementById('pagination');
    paginationContainer.innerHTML = '';
    
    if (pagination.totalPages <= 1) return;
    
    // Previous button
    if (pagination.hasPrev) {
        paginationContainer.innerHTML += `
            <li class="page-item">
                <a class="page-link" href="#" onclick="loadExpenses(${pagination.currentPage - 1})">Previous</a>
            </li>
        `;
    }
    
    // Page numbers
    for (let i = 1; i <= pagination.totalPages; i++) {
        if (i === pagination.currentPage) {
            paginationContainer.innerHTML += `
                <li class="page-item active">
                    <span class="page-link">${i}</span>
                </li>
            `;
        } else if (i === 1 || i === pagination.totalPages || Math.abs(i - pagination.currentPage) <= 2) {
            paginationContainer.innerHTML += `
                <li class="page-item">
                    <a class="page-link" href="#" onclick="loadExpenses(${i})">${i}</a>
                </li>
            `;
        } else if (Math.abs(i - pagination.currentPage) === 3) {
            paginationContainer.innerHTML += `
                <li class="page-item disabled">
                    <span class="page-link">...</span>
                </li>
            `;
        }
    }
    
    // Next button
    if (pagination.hasNext) {
        paginationContainer.innerHTML += `
            <li class="page-item">
                <a class="page-link" href="#" onclick="loadExpenses(${pagination.currentPage + 1})">Next</a>
            </li>
        `;
    }
}

async function handleExpenseSubmit(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    
    // Get form data directly from elements (more reliable)
    const title = document.getElementById('expenseTitle').value.trim();
    const amount = parseFloat(document.getElementById('expenseAmount').value);
    const category = document.getElementById('expenseCategory').value;
    const currency = document.getElementById('expenseCurrency').value;
    const date = document.getElementById('expenseDate').value;
    const description = document.getElementById('expenseDescription').value.trim();
    
    // Remove previous validation styling
    clearValidationErrors();
    
    // Validate required fields
    let hasErrors = false;
    
    if (!title) {
        showFieldError('expenseTitle', 'Title is required');
        hasErrors = true;
    }
    
    if (!amount || amount <= 0) {
        showFieldError('expenseAmount', 'Valid amount is required');
        hasErrors = true;
    }
    
    if (!category) {
        showFieldError('expenseCategory', 'Category is required');
        hasErrors = true;
    }
    
    if (!currency) {
        showFieldError('expenseCurrency', 'Currency is required');
        hasErrors = true;
    }
    
    if (!date) {
        showFieldError('expenseDate', 'Date is required');
        hasErrors = true;
    }
    
    if (hasErrors) {
        showToast('Please fill all required fields', 'error');
        return;
    }
    
    const data = {
        title,
        amount,
        category,
        currency,
        date,
        description
    };
    
    // Don't automatically change preferred currency on each expense
    // User should manually set it via navbar dropdown
    
    try {
        showLoading(true);
        const expenseId = document.getElementById('expenseId').value;
        const url = expenseId ? `${API_BASE}/expenses/${expenseId}` : `${API_BASE}/expenses`;
        const method = expenseId ? 'PUT' : 'POST';
        
        const response = await fetch(url, {
            method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify(data)
        });
        
        const result = await response.json();
        
        if (response.ok) {
            showToast(result.message, 'success');
            resetExpenseForm();
            loadExpenses(currentPage);
            loadDashboard();
            
            // Switch back to expenses tab
            document.getElementById('expenses-tab').click();
        } else {
            showToast(result.message || 'Error saving expense', 'error');
        }
    } catch (error) {
        showToast('Network error. Please try again.', 'error');
    } finally {
        showLoading(false);
    }
}

async function editExpense(id) {
    try {
        const response = await fetch(`${API_BASE}/expenses/${id}`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        if (response.ok) {
            const expense = await response.json();
            
            // Fill form with expense data
            document.getElementById('expenseId').value = expense._id;
            document.getElementById('expenseTitle').value = expense.title;
            document.getElementById('expenseAmount').value = expense.amount;
            document.getElementById('expenseCategory').value = expense.category;
            document.getElementById('expenseCurrency').value = expense.currency || 'USD';
            document.getElementById('expenseDate').value = expense.date.split('T')[0];
            document.getElementById('expenseDescription').value = expense.description || '';
            
            // Update currency symbol
            updateCurrencySymbol();
            
            // Update form UI
            document.getElementById('expenseFormTitle').textContent = 'Edit Expense';
            document.getElementById('submitBtnText').textContent = 'Update Expense';
            isEditMode = true;
            
            // Switch to add tab
            document.getElementById('add-tab').click();
        }
    } catch (error) {
        showToast('Error loading expense', 'error');
    }
}

async function deleteExpense(id) {
    if (!confirm('Are you sure you want to delete this expense?')) return;
    
    try {
        showLoading(true);
        const response = await fetch(`${API_BASE}/expenses/${id}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        const result = await response.json();
        
        if (response.ok) {
            showToast(result.message, 'success');
            loadExpenses(currentPage);
            loadDashboard();
        } else {
            showToast(result.message || 'Error deleting expense', 'error');
        }
    } catch (error) {
        showToast('Network error. Please try again.', 'error');
    } finally {
        showLoading(false);
    }
}

function resetExpenseForm() {
    document.getElementById('expenseForm').reset();
    document.getElementById('expenseId').value = '';
    document.getElementById('expenseFormTitle').textContent = 'Add New Expense';
    document.getElementById('submitBtnText').textContent = 'Add Expense';
    document.getElementById('expenseDate').value = new Date().toISOString().split('T')[0];
    
    // Clear validation errors
    clearValidationErrors();
    
    // Reset to user's default currency (not last used currency)
    const userDefaultCurrency = localStorage.getItem('userDefaultCurrency') || 'INR';
    document.getElementById('expenseCurrency').value = userDefaultCurrency;
    updateCurrencySymbol();
    
    isEditMode = false;
}

function clearFilters() {
    document.getElementById('searchInput').value = '';
    document.getElementById('categoryFilter').value = 'all';
    document.getElementById('filterDate').value = '';
    loadExpenses(1);
}

// Reports functions
async function loadReports() {
    await Promise.all([
        loadCategoryChart(),
        loadMonthlyChart(),
        loadTrendChart()
    ]);
}

async function loadCategoryChart() {
    try {
        const response = await fetch(`${API_BASE}/reports/category`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            // Convert dataset values to user's preferred currency and show currency sign
            const preferredCurrency = localStorage.getItem('userDefaultCurrency') || 'INR';
            const exchangeRates = await getExchangeRates();

            const labels = data.categoryTotals.map(cat => cat.category);
            const convertedData = data.categoryTotals.map(cat => {
                // assume server totals are USD-based amounts
                return convertCurrencyAmount(cat.total, 'USD', preferredCurrency, exchangeRates);
            });

            if (charts.categoryChart) {
                charts.categoryChart.destroy();
            }

            const ctx = document.getElementById('categoryChart');
            charts.categoryChart = new Chart(ctx, {
                type: 'pie',
                data: {
                    labels: labels,
                    datasets: [{
                        data: convertedData,
                        backgroundColor: [
                            '#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4',
                            '#ffeaa7', '#fd79a8', '#6c5ce7', '#a29bfe', '#636e72'
                        ]
                    }]
                },
                options: {
                    responsive: true,
                    plugins: {
                        legend: {
                            position: 'bottom'
                        },
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    const idx = context.dataIndex;
                                    const value = convertedData[idx] || 0;
                                    const percentage = data.categoryTotals[idx].percentage;
                                    return `${context.label}: ${formatCurrency(value, preferredCurrency)} (${percentage}%)`;
                                }
                            }
                        }
                    }
                }
            });
        }
    } catch (error) {
        console.error('Category chart error:', error);
    }
}

async function loadMonthlyChart() {
    try {
        const year = new Date().getFullYear();
        const response = await fetch(`${API_BASE}/reports/monthly?year=${year}`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            // Convert monthly totals to user's preferred currency
            const preferredCurrency = localStorage.getItem('userDefaultCurrency') || 'INR';
            const exchangeRates = await getExchangeRates();

            const labels = data.monthlyTotals.map(month => month.month);
            const converted = data.monthlyTotals.map(month => convertCurrencyAmount(month.total, 'USD', preferredCurrency, exchangeRates));

            if (charts.monthlyChart) {
                charts.monthlyChart.destroy();
            }

            const ctx = document.getElementById('monthlyChart');
            charts.monthlyChart = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'Expenses',
                        data: converted,
                        backgroundColor: 'rgba(54, 162, 235, 0.8)',
                        borderColor: 'rgba(54, 162, 235, 1)',
                        borderWidth: 1
                    }]
                },
                options: {
                    responsive: true,
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: {
                                callback: function(value) {
                                    return formatCurrency(value, preferredCurrency);
                                }
                            }
                        }
                    },
                    plugins: {
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    return `Expenses: ${formatCurrency(context.parsed.y, preferredCurrency)}`;
                                }
                            }
                        }
                    }
                }
            });
        }
    } catch (error) {
        console.error('Monthly chart error:', error);
    }
}

async function loadTrendChart() {
    try {
        const response = await fetch(`${API_BASE}/reports/trends`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            // Convert trend data to user's preferred currency
            const preferredCurrency = localStorage.getItem('userDefaultCurrency') || 'INR';
            const exchangeRates = await getExchangeRates();

            const labels = data.trends.map(trend => `${trend.month} ${trend.year}`);
            const converted = data.trends.map(trend => convertCurrencyAmount(trend.total, 'USD', preferredCurrency, exchangeRates));

            if (charts.trendChart) {
                charts.trendChart.destroy();
            }

            const ctx = document.getElementById('trendChart');
            charts.trendChart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'Monthly Expenses',
                        data: converted,
                        borderColor: 'rgba(255, 99, 132, 1)',
                        backgroundColor: 'rgba(255, 99, 132, 0.1)',
                        borderWidth: 2,
                        fill: true,
                        tension: 0.4
                    }]
                },
                options: {
                    responsive: true,
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: {
                                callback: function(value) {
                                    return formatCurrency(value, preferredCurrency);
                                }
                            }
                        }
                    },
                    plugins: {
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    return `Expenses: ${formatCurrency(context.parsed.y, preferredCurrency)}`;
                                }
                            }
                        }
                    }
                }
            });
        }
    } catch (error) {
        console.error('Trend chart error:', error);
    }
}

// Export function
async function exportCSV() {
    try {
        // Build CSV on client so we can include currency symbol in the Amount column.
        const params = new URLSearchParams();

        const filterDate = document.getElementById('filterDate').value;
        let fileSuffix = 'all';

        if (filterDate) {
            const date = new Date(filterDate);
            const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1).toISOString().split('T')[0];
            const endOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).toISOString().split('T')[0];
            params.append('startDate', startOfMonth);
            params.append('endDate', endOfMonth);
            fileSuffix = `${startOfMonth}_to_${endOfMonth}`;
        }

        // Request a large limit so we get all expenses for the range (server should support limit param)
        params.append('limit', '10000');

        const response = await fetch(`${API_BASE}/expenses?${params}`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });

        if (!response.ok) {
            showToast('Error fetching expenses for export', 'error');
            return;
        }

        const data = await response.json();
        const expenses = data.expenses || [];

        // CSV headers (no separate Currency column because Amount includes the currency code)
        const headers = ['Title', 'Amount', 'Category', 'Date', 'Description'];
        const rows = [headers];

        // Determine user's preferred currency for the total
        const preferredCurrency = localStorage.getItem('userDefaultCurrency') || 'INR';
        const exchangeRatesForTotal = await getExchangeRates();
        let totalInPreferred = 0;

        expenses.forEach(exp => {
            const title = exp.title ? exp.title.replace(/"/g, '""') : '';
            const currency = exp.currency || 'USD';
            // Use currency CODE + amount (e.g. "INR 155.00") instead of symbol
            const amountWithCode = `${currency} ${parseFloat(exp.amount).toFixed(2)}`;
            const category = exp.category || '';
            const dateIso = exp.date ? new Date(exp.date).toISOString().split('T')[0] : '';
            // Prefix date with single-quote so Excel treats it as text and won't show ####
            const dateText = dateIso ? `'${dateIso}` : '';
            const desc = exp.description ? exp.description.replace(/"/g, '""') : '';

            rows.push([
                `"${title}"`,
                `"${amountWithCode}"`,
                `"${category}"`,
                `"${dateText}"`,
                `"${desc}"`
            ]);

            // accumulate total converted to preferred currency
            const converted = convertCurrencyAmount(parseFloat(exp.amount), currency, preferredCurrency, exchangeRatesForTotal);
            totalInPreferred += converted;
        });

        // Add an empty row then a total summary row
        rows.push(['', '', '', '', '']);
        rows.push([
            `"Total Expenses"`,
            `"${preferredCurrency} ${totalInPreferred.toFixed(2)}"`,
            '""',
            '""',
            '""'
        ]);

        const csvContent = rows.map(r => r.join(',')).join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `expenses_${fileSuffix}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);

        showToast('Expenses exported successfully!', 'success');
    } catch (error) {
        showToast('Network error during export', 'error');
    }
}

// Currency functions
function updateCurrencySymbol() {
    const currency = document.getElementById('expenseCurrency').value;
    const symbol = currencySymbols[currency] || currency;
    document.getElementById('currencySymbol').textContent = symbol;
}

function formatCurrency(amount, currency) {
    const symbol = currencySymbols[currency] || currency;
    const formattedAmount = parseFloat(amount).toFixed(2);
    
    if (currency === 'EUR') {
        return `${formattedAmount} ${symbol}`;
    }
    return `${symbol}${formattedAmount}`;
}

// Currency converter functions
document.getElementById('currencyConverterForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    await convertCurrency();
});

async function convertCurrency() {
    const amount = parseFloat(document.getElementById('convertAmount').value);
    const fromCurrency = document.getElementById('fromCurrency').value;
    const toCurrency = document.getElementById('toCurrency').value;
    
    // Improved validation
    if (!amount || amount <= 0) {
        showToast('Please enter a valid amount', 'error');
        return;
    }
    
    if (!fromCurrency || !toCurrency) {
        showToast('Please select both currencies', 'error');
        return;
    }
    
    if (fromCurrency === toCurrency) {
        showToast('Please select different currencies', 'error');
        return;
    }
    
    try {
        showLoading(true);
        
        // Use our existing exchange rate system
        const exchangeRates = await getExchangeRates();
        const convertedAmount = convertCurrencyAmount(amount, fromCurrency, toCurrency, exchangeRates);
        const exchangeRate = exchangeRates[toCurrency] / exchangeRates[fromCurrency];
        
        // Display result
        const result = {
            originalAmount: amount,
            convertedAmount: convertedAmount,
            fromCurrency: fromCurrency,
            toCurrency: toCurrency,
            exchangeRate: exchangeRate
        };
        
        displayConversionResult(result);
        showToast('Currency converted successfully!', 'success');
        
    } catch (error) {
        console.error('Conversion error:', error);
        showToast('Error during currency conversion', 'error');
    } finally {
        showLoading(false);
    }
}

function displayConversionResult(data) {
    document.getElementById('fromAmount').textContent = formatCurrency(data.originalAmount, data.fromCurrency);
    document.getElementById('toAmount').textContent = formatCurrency(data.convertedAmount, data.toCurrency);
    document.getElementById('exchangeRate').textContent = `1 ${data.fromCurrency} = ${data.exchangeRate.toFixed(4)} ${data.toCurrency}`;
    document.getElementById('conversionTime').textContent = `Last updated: ${new Date().toLocaleTimeString()}`;
    
    document.getElementById('conversionResult').classList.remove('d-none');
}

function swapCurrencies() {
    const fromSelect = document.getElementById('fromCurrency');
    const toSelect = document.getElementById('toCurrency');
    
    const temp = fromSelect.value;
    fromSelect.value = toSelect.value;
    toSelect.value = temp;
}

// Load exchange rates silently (without notification)
async function loadExchangeRates() {
    try {
        showLoading(true);
        const response = await fetch(`${API_BASE}/currency/rates/USD`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        if (response.ok) {
            const result = await response.json();
            displayExchangeRates(result.data);
        }
    } catch (error) {
        console.error('Error loading exchange rates:', error);
    } finally {
        showLoading(false);
    }
}

// Refresh exchange rates with notification (for manual refresh)
async function refreshExchangeRates() {
    try {
        showLoading(true);
        const response = await fetch(`${API_BASE}/currency/rates/USD`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        if (response.ok) {
            const result = await response.json();
            displayExchangeRates(result.data);
            showToast('Exchange rates updated!', 'success');
        } else {
            showToast('Failed to fetch exchange rates', 'error');
        }
    } catch (error) {
        showToast('Network error', 'error');
    } finally {
        showLoading(false);
    }
}

function displayExchangeRates(ratesData) {
    const tbody = document.getElementById('exchangeRatesTableBody');
    const rates = ratesData.rates;
    
    const majorCurrencies = ['EUR', 'GBP', 'INR', 'JPY', 'CAD', 'AUD', 'CHF', 'CNY', 'KRW'];
    
    tbody.innerHTML = majorCurrencies.map(currency => {
        const rate = rates[currency];
        const symbol = currencySymbols[currency] || currency;
        
        return `
            <tr>
                <td><strong>${currency}</strong> ${symbol}</td>
                <td>${rate ? rate.toFixed(4) : 'N/A'}</td>
            </tr>
        `;
    }).join('');
    
    document.getElementById('ratesLastUpdated').textContent = new Date(ratesData.lastUpdated).toLocaleString();
}

// Tab change handlers for currency tab
document.addEventListener('shown.bs.tab', function(e) {
    if (e.target.id === 'currency-tab') {
        loadExchangeRates(); // Load silently without notification
    }
});