require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');
const routes = require('./src/routes');
const liveRoutes = require('./src/live');

const app = express();
// Behind a tunnel/proxy (cloudflared), use the forwarded https protocol for overlay links
app.set('trust proxy', true);
app.use(cors());
app.use(express.json({ limit: '10mb' }));

const DB_RUN = process.env.DB_RUN === 'true';

// Live match sharing is in-memory, so it works regardless of DB_RUN
app.use('/api/live', liveRoutes);

// YouTube score overlay page (add it as a browser source in the streaming app)
app.get('/overlay/:code', (req, res) => res.sendFile(path.join(__dirname, 'src', 'overlay.html')));

if (DB_RUN) {
  app.use('/api', routes);
  console.log('✅ DB_RUN=true — MySQL API routes active');
} else {
  app.use('/api', (req, res) => {
    res.status(503).json({ error: 'DB_RUN is false. Set DB_RUN=true in .env to enable API.' });
  });
  console.log('⚠️  DB_RUN=false — API disabled, app using local storage');
}

app.get('/health', (req, res) => res.json({ status: 'ok', db: DB_RUN }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
