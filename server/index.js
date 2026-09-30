require('dotenv').config();
const express = require('express');
const cors = require('cors');
const routes = require('./src/routes');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

const DB_RUN = process.env.DB_RUN === 'true';

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
