require('dotenv').config();
const express = require('express');
const path = require('node:path');
const helmet = require('helmet');
const authRoutes = require('./routes/auth');
const sessionRoutes = require('./routes/sessions');
const app = express();
app.disable('x-powered-by');
app.use(helmet({ contentSecurityPolicy: { directives: { defaultSrc: ["'self'"], scriptSrc: ["'self'"], styleSrc: ["'self'"], connectSrc: ["'self'"], imgSrc: ["'self'", 'data:'], objectSrc: ["'none'"], upgradeInsecureRequests: null } } }));
app.use(express.json({ limit: '20kb' }));
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));
app.use('/api/auth', authRoutes);
app.use('/api/sessions', sessionRoutes);
app.use(express.static(path.join(__dirname, '..', 'frontend')));
app.use('/api', (req, res) => res.status(404).json({ error: 'API endpoint not found.' }));
app.use((err, req, res, next) => {
  console.error('Request failed:', err?.message || 'Unknown error');
  if (res.headersSent) return next(err);
  res.status(500).json({ error: 'The server could not complete that request. Check the server configuration and try again.' });
});
const port = Number(process.env.PORT) || 3000;
app.listen(port, () => console.log(`Interview practice app listening on http://localhost:${port}`));

