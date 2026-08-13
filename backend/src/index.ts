import express from 'express';
import cors from 'cors';
import * as dotenv from 'dotenv';
import { initializeDatabase } from './config/database';
import productsRouter from './routes/products';
import inventoryRouter from './routes/inventory';
import posRouter from './routes/pos';
import analyticsRouter from './routes/analytics';

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

// Enable CORS
app.use(cors());

// Enable JSON parsing middleware
app.use(express.json());

// Log incoming requests
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date() });
});

// Mount Routes
app.use('/api/products', productsRouter);
app.use('/api/inventory', inventoryRouter);
app.use('/api/pos', posRouter);
app.use('/api/analytics', analyticsRouter);

// Initialize DB and Start Server
async function startServer() {
  try {
    // Resilient DB Migration & Seeding
    await initializeDatabase();
    
    app.listen(port, () => {
      console.log(`Backend Server is running on port ${port} in ${process.env.NODE_ENV || 'development'} mode`);
    });
  } catch (error) {
    console.error('Failed to start server due to database initialization failure:', error);
    process.exit(1);
  }
}

startServer();
