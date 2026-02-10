const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const logger = require('./utils/logger');
const storeRoutes = require('./routes/stores');
const errorHandler = require('./middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(helmet());
app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`);
  next();
});

app.use('/stores', storeRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'healthy' });
});

app.use(errorHandler);

app.listen(PORT, () => {
  logger.info(`API server running on port ${PORT}`);
});

module.exports = app;
