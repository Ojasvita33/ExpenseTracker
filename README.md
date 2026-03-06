# 💰 Expense Tracker

A full-stack expense tracking web application that helps users manage daily spending with authentication, multi-currency support, analytics dashboards, and AI-powered insights.

The app provides a clean UI, interactive reports, and tools to analyze spending habits effectively.

---

## 🚀 Features

### 🔐 Authentication

* Secure user registration and login
* JWT-based authentication
* Password reset via email

### 💸 Expense Management

* Add, edit, and delete expenses
* Categorize expenses
* Track spending by date

### 💱 Multi-Currency Support

* Supports multiple currencies (INR, USD, EUR, GBP, etc.)
* Automatic currency conversion
* Built-in currency converter

### 📊 Dashboard & Reports

* Monthly, weekly, and yearly summaries
* Category-wise breakdown using pie charts
* Monthly expense trends
* Interactive charts using Chart.js

### 🤖 AI Insights

* AI-powered expense analysis
* Spending pattern insights
* Smart saving suggestions

### 📥 Export

* Export expenses to CSV

### 🎨 UI/UX

* Dark / Light mode
* Responsive design for mobile and desktop
* Clean Bootstrap interface

---

## 🛠 Tech Stack

### Frontend

* HTML
* CSS
* Bootstrap
* JavaScript
* Chart.js

### Backend

* Node.js
* Express.js
* MongoDB
* JWT Authentication
* Nodemailer (Password Reset)
* Google Gemini API (AI Insights)

---

## ⚙️ Setup

### 1️⃣ Install dependencies

npm install

### 2️⃣ Create `.env` file

PORT=5000
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_secret_key

EMAIL=your_email
EMAIL_PASS=your_app_password

GEMINI_API_KEY=your_gemini_api_key

### 3️⃣ Start the server

npm start

### 4️⃣ Open in browser

http://localhost:5000

---

## 📂 Project Structure

ExpenseTracker
│
├── middleware/      # Authentication middleware
├── models/          # MongoDB schemas
├── routes/          # API routes
├── services/        # Currency & AI services
├── public/          # Frontend files
│   ├── index.html
│   ├── styles.css
│   └── app.js
│
├── server.js        # Main backend server
├── package.json
└── README.md

---

## 📊 Usage

1. Register or login
2. Add expenses with category and currency
3. Track spending from the dashboard
4. View reports and charts
5. Analyze expenses using AI insights
6. Export data to CSV

---

## 🌐 Deployment

This project is be deployed on: Vercel

MongoDB Atlas is recommended for the database.

---

❤️ Built for learning and portfolio projects.
