# 💰 ExpenseTracker

A simple yet powerful expense tracking web app with user authentication and multi-currency support. Track your expenses efficiently with beautiful charts and insightful reports.

## ✨ Features

- 🔐 User registration and login (JWT authentication)
- ➕ Add, edit, and delete expenses
- 💱 Multi-currency support with live conversion rates
- 📊 Interactive dashboard with expense summaries (This Month, Week, Year)
- 📈 Visual reports with category-wise breakdown and monthly trends
- 📥 CSV export for external analysis
- 🌓 Dark/Light theme toggle
- 📱 Responsive design for mobile and desktop

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Create `.env` file:
   ```env
   PORT=5000
   MONGODB_URI=your_mongodb_connection_string
   JWT_SECRET=your_secret_key
   ```

3. Start the server:
   ```bash
   npm start
   ```

4. Open `http://localhost:5000`


## 📁 Project Structure

```
├── middleware/     # Authentication
├── models/         # User & Expense schemas
├── routes/         # API routes
├── services/       # Currency service
├── public/         # Frontend files
└── server.js       # Main server
```

## 🎯 Usage

1. **Register** a new account or login with existing credentials
2. **Add expenses** with title, amount, category, date, and optional description
3. **Select currency** for each expense (supports INR, USD, EUR, GBP, etc.)
4. **View dashboard** to see your spending patterns
5. **Analyze reports** with interactive charts
6. **Export data** to CSV for further analysis
7. **Switch themes** using the toggle button

## 📝 License

MIT License - feel free to use this project for learning purposes.

---
Made with ❤️ 
```