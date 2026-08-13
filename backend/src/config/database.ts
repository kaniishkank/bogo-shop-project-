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
  -- Insert mock products matching refactored schema
  INSERT INTO products (name, sku, price, cost_price, current_stock, min_threshold, supplier_name, last_sold_at, created_at)
  VALUES 
    -- Healthy stock item
    ('Premium Wireless Headphones', 'SKU-HEAD-7492', 89.99, 50.00, 45, 15, 'Apex Audio Group', NOW() - INTERVAL '2 days', NOW() - INTERVAL '10 days'),
    -- Low stock item
    ('Mechanical Gaming Keyboard', 'SKU-KEYB-8392', 129.50, 75.00, 4, 10, 'Vertex Peripherals', NOW() - INTERVAL '1 day', NOW() - INTERVAL '12 days'),
    -- Critical low stock item
    ('Ergonomic Office Chair', 'SKU-CHAI-9182', 249.99, 150.00, 1, 5, 'Zenith Furniture Ltd', NOW() - INTERVAL '5 hours', NOW() - INTERVAL '20 days'),
    -- Dead stock item 1
    ('Vintage Copper Tea Set', 'SKU-TEAS-1029', 75.00, 40.00, 12, 5, 'Legacy Imports', NOW() - INTERVAL '95 days', NOW() - INTERVAL '110 days'),
    -- Dead stock item 2
    ('Heavy Duty Cargo Straps', 'SKU-STRA-4829', 19.99, 10.00, 8, 3, 'Titan Logistics Supply', NOW() - INTERVAL '92 days', NOW() - INTERVAL '120 days'),
    -- Out of stock normal item
    ('USB-C Fast Charging Cable', 'SKU-USBC-6729', 14.99, 6.00, 0, 20, 'ElectroWire Corp', NOW() - INTERVAL '12 days', NOW() - INTERVAL '30 days')
  ON CONFLICT (sku) DO NOTHING;

  -- Seed sales transactions and transaction items for historical chart display
  INSERT INTO sales_transactions (id, total_amount, total_cogs, payment_method, status, created_at)
  VALUES
    (101, 104.98, 56.00, 'CASH', 'COMPLETED', NOW() - INTERVAL '15 days'),
    (102, 249.99, 150.00, 'CARD', 'COMPLETED', NOW() - INTERVAL '12 days'),
    (103, 309.48, 175.00, 'MOBILE', 'COMPLETED', NOW() - INTERVAL '8 days'),
    (104, 89.99, 50.00, 'CASH', 'COMPLETED', NOW() - INTERVAL '5 days'),
    (105, 409.48, 237.00, 'CARD', 'COMPLETED', NOW() - INTERVAL '3 days'),
    (106, 144.49, 81.00, 'CASH', 'COMPLETED', NOW() - INTERVAL '1 day'),
    (107, 339.98, 200.00, 'CARD', 'COMPLETED', NOW() - INTERVAL '5 hours')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO transaction_items (transaction_id, product_id, quantity, unit_price)
  VALUES
    -- Transaction 101: 1 Headphone, 1 Cable
    (101, (SELECT id FROM products WHERE sku = 'SKU-HEAD-7492'), 1, 89.99),
    (101, (SELECT id FROM products WHERE sku = 'SKU-USBC-6729'), 1, 14.99),
    -- Transaction 102: 1 Ergonomic Chair
    (102, (SELECT id FROM products WHERE sku = 'SKU-CHAI-9182'), 1, 249.99),
    -- Transaction 103: 2 Headphone, 1 Gaming Keyboard
    (103, (SELECT id FROM products WHERE sku = 'SKU-HEAD-7492'), 2, 89.99),
    (103, (SELECT id FROM products WHERE sku = 'SKU-KEYB-8392'), 1, 129.50),
    -- Transaction 104: 1 Headphone
    (104, (SELECT id FROM products WHERE sku = 'SKU-HEAD-7492'), 1, 89.99),
    -- Transaction 105: 1 Chair, 1 Keyboard, 2 Cables
    (105, (SELECT id FROM products WHERE sku = 'SKU-CHAI-9182'), 1, 249.99),
    (105, (SELECT id FROM products WHERE sku = 'SKU-KEYB-8392'), 1, 129.50),
    (105, (SELECT id FROM products WHERE sku = 'SKU-USBC-6729'), 2, 14.99),
    -- Transaction 106: 1 Keyboard, 1 Cable
    (106, (SELECT id FROM products WHERE sku = 'SKU-KEYB-8392'), 1, 129.50),
    (106, (SELECT id FROM products WHERE sku = 'SKU-USBC-6729'), 1, 14.99),
    -- Transaction 107: 1 Chair, 1 Headphone
    (107, (SELECT id FROM products WHERE sku = 'SKU-CHAI-9182'), 1, 249.99),
    (107, (SELECT id FROM products WHERE sku = 'SKU-HEAD-7492'), 1, 89.99)
  ON CONFLICT DO NOTHING;

  -- Resync transaction serial ID sequence
  SELECT setval('sales_transactions_id_seq', COALESCE((SELECT MAX(id)+1 FROM sales_transactions), 1), false);
`;

export async function initializeDatabase(retries = 5, delay = 2000): Promise<void> {
  for (let i = 0; i < retries; i++) {
    try {
      console.log(`Connecting to database (Attempt ${i + 1}/${retries})...`);
      const client = await pool.connect();
      try {
        // Query to check if the public.products table already exists in public schema
        const tableCheck = await client.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
              AND table_name = 'products'
          );
        `);
        const tablesExist = tableCheck.rows[0].exists;

        if (!tablesExist) {
          console.log('Database tables not found. Running migrations (creating tables)...');
          await client.query(migrationSql);
          console.log('Seeding mock data...');
          await client.query(seedSql);
          console.log('Seeding complete.');
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
