// server.js (CommonJS)
const express = require('express');
const compression = require('compression');
const path = require('path');

const app = express();
app.use(compression());

const dist = path.join(__dirname, 'dist');
app.use(express.static(dist));

// health check
app.get('/healthz', (_, res) => res.status(200).send('ok'));

// example API
app.get('/api/ping', (_, res) => res.json({ ok: true }));

// SPA fallback
app.use((req, res) => {
  res.sendFile(path.join(dist, 'index.html'));
});
const port = process.env.PORT || 8080;
app.listen(port, () => console.log(`Server listening on ${port}`));
