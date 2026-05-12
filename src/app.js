require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const webhookRouter = require('./routes/webhook');
const apiRouter = require('./routes/api');
const attendRouter = require('./routes/attend');
const salaryRouter = require('./routes/salary');

const app = express();

app.use(cors());

// Serve uploaded photos
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Serve static public files (attend.html etc.)
app.use(express.static(path.join(__dirname, '../public')));

// Line webhook — must come before express.json()
app.use('/webhook', webhookRouter);

// JSON body parser for API routes
app.use(express.json({ limit: '10mb' }));

// Dashboard API
app.use('/api', apiRouter);

// Attendance web page + submit API
app.use('/attend', attendRouter);

// Salary & commission management
app.use('/api/salary', salaryRouter);

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`📍 Webhook: https://YOUR_DOMAIN/webhook`);
  console.log(`📱 LIFF page: https://YOUR_DOMAIN/liff`);
});
