const express = require('express');
const cors = require('cors');
const apiRoutes = require('./api/routes');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ ok: true });
});

// Mount API routes at both root and /api
app.use('/', apiRoutes);
app.use('/api', apiRoutes);

// Only listen if run directly
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
}

module.exports = app;
