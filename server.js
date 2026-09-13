require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const webhookRouter = require('./messenger/webhook');
const tripRoutes = require('./routes/tripRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());

// Capture raw body (needed for X-Hub-Signature-256 verification in webhook.js)
app.use(
  express.json({
    verify: (req, res, buf) => {
      req.rawBody = buf;
    },
  })
);

// Serve the Mini Web App (map picker) as static files
app.use(express.static(path.join(__dirname, 'public')));

// Facebook Messenger webhook (GET verify + POST events)
app.use('/webhook', webhookRouter);

// Trip business logic API, used by the Mini Web App
app.use('/api/trips', tripRoutes);

// Simple health check
app.get('/health', (req, res) => res.json({ ok: true, service: 'messenger-ride-mvp' }));

app.use((req, res) => {
  res.status(404).json({ ok: false, error: 'Not found' });
});

// Generic error handler (last resort safety net)
app.use((err, req, res, next) => {
  console.error('[server] Unhandled error:', err);
  res.status(500).json({ ok: false, error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`[server] Listening on port ${PORT}`);
  console.log(`[server] Webhook URL:  ${process.env.BASE_URL || 'http://localhost:' + PORT}/webhook`);
  console.log(`[server] Mini Web App: ${process.env.BASE_URL || 'http://localhost:' + PORT}/`);
});
