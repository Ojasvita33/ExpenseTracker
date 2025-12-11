const express = require('express');
const Expense = require('../models/Expense');
const auth = require('../middleware/auth');
const { Parser } = require('json2csv');

const router = express.Router();

// Get monthly expense totals
router.get('/monthly', auth, async (req, res) => {
  try {
    const year = parseInt(req.query.year) || new Date().getFullYear();
    
    const monthlyExpenses = await Expense.aggregate([
      {
        $match: {
          userId: req.user._id,
          date: {
            $gte: new Date(year, 0, 1),
            $lt: new Date(year + 1, 0, 1)
          }
        }
      },
      {
        $group: {
          _id: { $month: '$date' },
          total: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { '_id': 1 }
      }
    ]);

    // Fill in missing months with 0
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                   'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    const result = months.map((month, index) => {
      const found = monthlyExpenses.find(item => item._id === index + 1);
      return {
        month,
        total: found ? found.total : 0,
        count: found ? found.count : 0
      };
    });

    res.json({
      year,
      monthlyTotals: result,
      yearTotal: result.reduce((sum, month) => sum + month.total, 0)
    });
  } catch (error) {
    console.error('Monthly report error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get category-wise totals
router.get('/category', auth, async (req, res) => {
  try {
    const startDate = req.query.startDate ? new Date(req.query.startDate) : new Date(new Date().getFullYear(), 0, 1);
    const endDate = req.query.endDate ? new Date(req.query.endDate) : new Date();

    const categoryTotals = await Expense.aggregate([
      {
        $match: {
          userId: req.user._id,
          date: {
            $gte: startDate,
            $lte: endDate
          }
        }
      },
      {
        $group: {
          _id: '$category',
          total: { $sum: '$amount' },
          count: { $sum: 1 },
          avgAmount: { $avg: '$amount' }
        }
      },
      {
        $sort: { total: -1 }
      }
    ]);

    const totalAmount = categoryTotals.reduce((sum, cat) => sum + cat.total, 0);
    
    const result = categoryTotals.map(cat => ({
      category: cat._id,
      total: cat.total,
      count: cat.count,
      avgAmount: Math.round(cat.avgAmount * 100) / 100,
      percentage: totalAmount > 0 ? Math.round((cat.total / totalAmount) * 100 * 100) / 100 : 0
    }));

    res.json({
      period: { startDate, endDate },
      categoryTotals: result,
      overallTotal: totalAmount
    });
  } catch (error) {
    console.error('Category report error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get expense trends (last 12 months)
router.get('/trends', auth, async (req, res) => {
  try {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 11);
    startDate.setDate(1);

    const trends = await Expense.aggregate([
      {
        $match: {
          userId: req.user._id,
          date: {
            $gte: startDate,
            $lte: endDate
          }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$date' },
            month: { $month: '$date' }
          },
          total: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { '_id.year': 1, '_id.month': 1 }
      }
    ]);

    // Create array of last 12 months
    const months = [];
    const current = new Date(startDate);
    
    while (current <= endDate) {
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                         'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      
      const found = trends.find(t => 
        t._id.year === current.getFullYear() && 
        t._id.month === current.getMonth() + 1
      );

      months.push({
        month: monthNames[current.getMonth()],
        year: current.getFullYear(),
        total: found ? found.total : 0,
        count: found ? found.count : 0
      });

      current.setMonth(current.getMonth() + 1);
    }

    res.json({
      period: { startDate, endDate },
      trends: months
    });
  } catch (error) {
    console.error('Trends report error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get dashboard summary
router.get('/dashboard', auth, async (req, res) => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    const startOfYear = new Date(now.getFullYear(), 0, 1);

    // Current month stats
    const monthlyStats = await Expense.aggregate([
      {
        $match: {
          userId: req.user._id,
          date: { $gte: startOfMonth }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$amount' },
          count: { $sum: 1 },
          avgAmount: { $avg: '$amount' }
        }
      }
    ]);

    // Weekly stats
    const weeklyStats = await Expense.aggregate([
      {
        $match: {
          userId: req.user._id,
          date: { $gte: startOfWeek }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      }
    ]);

    // Yearly stats
    const yearlyStats = await Expense.aggregate([
      {
        $match: {
          userId: req.user._id,
          date: { $gte: startOfYear }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      }
    ]);

    // Top categories this month
    const topCategories = await Expense.aggregate([
      {
        $match: {
          userId: req.user._id,
          date: { $gte: startOfMonth }
        }
      },
      {
        $group: {
          _id: '$category',
          total: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { total: -1 }
      },
      {
        $limit: 5
      }
    ]);

    res.json({
      monthly: monthlyStats[0] || { total: 0, count: 0, avgAmount: 0 },
      weekly: weeklyStats[0] || { total: 0, count: 0 },
      yearly: yearlyStats[0] || { total: 0, count: 0 },
      topCategories: topCategories.map(cat => ({
        category: cat._id,
        total: cat.total,
        count: cat.count
      }))
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Export expenses to CSV
router.get('/export/csv', auth, async (req, res) => {
  try {
    const startDate = req.query.startDate ? new Date(req.query.startDate) : new Date(new Date().getFullYear(), 0, 1);
    const endDate = req.query.endDate ? new Date(req.query.endDate) : new Date();

    const expenses = await Expense.find({
      userId: req.user._id,
      date: {
        $gte: startDate,
        $lte: endDate
      }
    }).sort({ date: -1 });

    const fields = ['title', 'amount', 'category', 'date', 'description'];
    const opts = { fields };
    
    const parser = new Parser(opts);
    const csv = parser.parse(expenses);

    res.header('Content-Type', 'text/csv');
    res.attachment('expenses.csv');
    res.send(csv);
  } catch (error) {
    console.error('Export CSV error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;