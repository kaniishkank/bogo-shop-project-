import { Pool } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

const connectionString = process.env.DATABASE_URL;

export const pool = new Pool({
  connectionString,
});

const migrationSql = `
  -- Create products table
  CREATE TABLE IF NOT EXISTS products (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) UNIQUE NOT NULL,
    sku VARCHAR(100) UNIQUE NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    cost_price DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    current_stock INT NOT NULL DEFAULT 0 CHECK (current_stock >= 0),
    min_threshold INT NOT NULL DEFAULT 5,
    supplier_name VARCHAR(255) NOT NULL,
    last_sold_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  );

  -- Create incoming_loads table
  CREATE TABLE IF NOT EXISTS incoming_loads (
    id SERIAL PRIMARY KEY,
    product_id INT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    quantity_added INT NOT NULL CHECK (quantity_added > 0),
    supplier_name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  );

  -- Create sales_transactions table
  CREATE TABLE IF NOT EXISTS sales_transactions (
    id SERIAL PRIMARY KEY,
    total_amount DECIMAL(10, 2) NOT NULL,
    total_cogs DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    payment_method VARCHAR(100) NOT NULL DEFAULT 'CASH',
    status VARCHAR(50) NOT NULL DEFAULT 'COMPLETED' CHECK (status IN ('COMPLETED', 'CANCELLED')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  );

  -- Create transaction_items table
  CREATE TABLE IF NOT EXISTS transaction_items (
    id SERIAL PRIMARY KEY,
    transaction_id INT NOT NULL REFERENCES sales_transactions(id) ON DELETE CASCADE,
    product_id INT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    quantity INT NOT NULL CHECK (quantity > 0),
    unit_price DECIMAL(10, 2) NOT NULL
  );
`;

const seedSql = `
  -- Seed SQL (Empty for clean slate demo)
  SELECT 1;
`;

export async function initializeDatabase(retries = 5, delay = 2000): Promise<void> {
  for (let i = 0; i < retries; i++) {
    try {
      console.log(`Connecting to database (Attempt ${i + 1}/${retries})...`);
      const client = await pool.connect();
      try {
        // Check if database reset is requested via env variable
        const forceReset = process.env.RESET_DB === 'true';
        
        if (forceReset) {
          console.log('RESET_DB=true detected. Wiping all database tables for a clean slate demo...');
          await client.query(`
            DROP TABLE IF EXISTS transaction_items CASCADE;
            DROP TABLE IF EXISTS sales_transactions CASCADE;
            DROP TABLE IF EXISTS incoming_loads CASCADE;
            DROP TABLE IF EXISTS products CASCADE;
          `);
        }

        // Query to check if the public.products table already exists in public schema
        const tableCheck = await client.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
              AND table_name = 'products'
          );
        `);
        const tablesExist = tableCheck.rows[0].exists;

        if (!tablesExist || forceReset) {
          console.log('Database tables not found. Running migrations (creating tables)...');
          await client.query(migrationSql);
          console.log('Seeding mock data (clean slate)...');
          await client.query(seedSql);
          console.log('Database initialization complete.');
        } else {
          console.log('Database tables already exist. Skipping migrations and seed to ensure data persistence.');
        }
        return;
      } finally {
        client.release();
      }
    } catch (err) {
      console.error(`Database connection failed: ${(err as Error).message}`);
      if (i < retries - 1) {
        console.log(`Waiting ${delay / 1000}s before next attempt...`);
        await new Promise((res) => setTimeout(res, delay));
      } else {
        throw new Error('Could not connect to PostgreSQL after multiple attempts');
      }
    }
  }
}
