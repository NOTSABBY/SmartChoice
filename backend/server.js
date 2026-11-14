const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const connectDB = require('./config/database');
const { notFound, errorHandler } = require('./middleware/errorHandler');

const productRoutes = require('./routes/productRoutes');
const catalogRoutes = require('./routes/catalogRoutes');
const analysisRoutes = require('./routes/analysisRoutes');

// Connect to MongoDB and start server
const startServer = async () => {
  try {
    try {
      await connectDB();
    } catch (dbError) {
      console.error("Failed to connect to database, but starting server anyway:", dbError);
    }
    
    const app = express();
    const PORT = process.env.PORT || 8080;

    // Middleware
    app.use(helmet({ crossOriginResourcePolicy: false }));
    app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173' }));
    app.use(express.json());
    app.use(morgan('dev'));

    const limiter = rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 100,
    });
    app.use('/api', limiter);

    // Routes
    app.get('/api/health', (req, res) => {
      res.json({
        success: true,
        message: "SmartChoice API is running"
      });
    });

    app.use('/api/products', productRoutes);
    app.use('/api/catalog', catalogRoutes);
    app.use('/api/analysis', analysisRoutes);

    app.get('/api/search/semantic', require('./controllers/productController').semanticSearch);
    app.post('/api/compare', require('./controllers/productController').compareProducts);
    app.post('/api/scores', require('./controllers/productController').getScores);

    // Phase 5: Recommendation endpoints
    app.get('/api/preferences/default', require('./controllers/productController').getDefaultPreferences);
    app.post('/api/recommendations', require('./controllers/productController').getRecommendations);
    app.post('/api/recommendations/rank', require('./controllers/productController').getRecommendations);

    // Phase 7: RAG endpoints
    app.get('/api/rag/context', require('./controllers/ragController').getRagContext);
    app.post('/api/rag/query', require('./controllers/ragController').postRagQuery);

    // Error Handling Middleware
    app.use(notFound);
    app.use(errorHandler);

    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
};

startServer();
