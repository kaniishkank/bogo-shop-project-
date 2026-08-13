import { Router, Request, Response } from 'express';
import { pool } from '../config/database';

const router = Router();

// Helper to auto-generate a unique SKU based on the product name
function generateSKU(name: string): string {
  const cleanPrefix = name
    .replace(/[^a-zA-Z]/g, '')
    .substring(0, 4)
    .toUpperCase();
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  return `SKU-${cleanPrefix || 'ITEM'}-${randomSuffix}`;
}

// POST /api/inventory/load - Log shipment and auto-sync catalog stock
router.post('/load', async (req: Request, res: Response) => {
  const { name, quantity_added, supplier_name, unit_price, min_threshold } = req.body;

  if (!name || !quantity_added || !supplier_name) {
    return res.status(400).json({ 
      error: 'Missing required fields: name, quantity_added, supplier_name' 
    });
  }

  const qty = parseInt(quantity_added);
  if (isNaN(qty) || qty <= 0) {
    return res.status(400).json({ error: 'quantity_added must be a positive integer' });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Check if the product name already exists (case-insensitive query)
    const productQuery = 'SELECT * FROM products WHERE UPPER(name) = UPPER($1) FOR UPDATE';
    const productRes = await client.query(productQuery, [name.trim()]);

    let product;

    if (productRes.rows.length > 0) {
      // Product EXISTS: Increment stock and update supplier
      product = productRes.rows[0];
      const updateQuery = `
        UPDATE products
        SET 
          current_stock = current_stock + $1, 
          supplier_name = $2, 
          updated_at = NOW()
        WHERE id = $3
        RETURNING *
      `;
      const updateRes = await client.query(updateQuery, [qty, supplier_name.trim(), product.id]);
      product = updateRes.rows[0];
    } else {
      // Product DOES NOT EXIST: Create a new product SKU record
      if (unit_price === undefined || min_threshold === undefined) {
        await client.query('ROLLBACK');
        return res.status(400).json({ 
          error: `Product '${name}' is new and requires 'unit_price' and 'min_threshold' parameters to register in the catalog.` 
        });
      }

      const price = parseFloat(unit_price);
      const threshold = parseInt(min_threshold);

      if (isNaN(price) || price < 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'unit_price must be a non-negative number' });
      }
      if (isNaN(threshold) || threshold < 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'min_threshold must be a non-negative integer' });
      }

      const generatedSku = generateSKU(name);
      
      const insertQuery = `
        INSERT INTO products (name, sku, price, cost_price, current_stock, min_threshold, supplier_name)
        VALUES ($1, $2, $3, $3 * 0.60, $4, $5, $6)
        RETURNING *
      `;
      const insertRes = await client.query(insertQuery, [
        name.trim(),
        generatedSku,
        price,
        qty, // Initial stock is set to Quantity Added
        threshold,
        supplier_name.trim()
      ]);
      product = insertRes.rows[0];
    }

    // 2. Insert shipment receipt load record
    const loadQuery = `
      INSERT INTO incoming_loads (product_id, quantity_added, supplier_name)
      VALUES ($1, $2, $3)
      RETURNING *
    `;
    const loadRes = await client.query(loadQuery, [product.id, qty, supplier_name.trim()]);

    await client.query('COMMIT');

    res.status(201).json({
      message: productRes.rows.length > 0 ? 'Stock incremented' : 'New SKU cataloged and stock initialized',
      load: loadRes.rows[0],
      product
    });
  } catch (err: any) {
    await client.query('ROLLBACK');
    console.error('Error in Load Intake transaction:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  } finally {
    client.release();
  }
});

// GET /api/inventory/loads - Fetch history of shipment logs
router.get('/loads', async (req: Request, res: Response) => {
  try {
    const query = `
      SELECT 
        l.id,
        l.product_id,
        p.name as product_name,
        p.sku as product_sku,
        l.quantity_added,
        l.supplier_name,
        p.price::FLOAT as price,
        p.cost_price::FLOAT as cost_price,
        p.min_threshold as min_threshold,
        l.created_at
      FROM incoming_loads l
      JOIN products p ON l.product_id = p.id
      ORDER BY l.created_at DESC
      LIMIT 100
    `;
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching loads history:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// PUT /api/inventory/loads/:id - Update shipment and product entries
router.put('/loads/:id', async (req: Request, res: Response) => {
  const loadId = parseInt(req.params.id);
  const { barcode, name, quantity_added, supplier_name, price, cost_price, min_threshold } = req.body;

  if (isNaN(loadId)) {
    return res.status(400).json({ error: 'Invalid load ID' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Fetch current load record
    const loadQuery = await client.query('SELECT * FROM incoming_loads WHERE id = $1 FOR UPDATE', [loadId]);
    if (loadQuery.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Shipment load record not found' });
    }
    const oldLoad = loadQuery.rows[0];
    const oldQty = oldLoad.quantity_added;
    const productId = oldLoad.product_id;

    // 2. Fetch current product record
    const productQuery = await client.query('SELECT * FROM products WHERE id = $1 FOR UPDATE', [productId]);
    if (productQuery.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Corresponding product not found' });
    }
    const product = productQuery.rows[0];

    // 3. Calculate stock difference
    const qtyDiff = parseInt(quantity_added) - oldQty;
    const newStock = product.current_stock + qtyDiff;

    if (newStock < 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Cannot reduce quantity added: resulting stock level would fall below 0.' });
    }

    // 4. Update products fields
    const updateProductQuery = `
      UPDATE products
      SET 
        sku = COALESCE($1, sku),
        name = COALESCE($2, name),
        price = COALESCE($3, price),
        cost_price = COALESCE($4, cost_price),
        min_threshold = COALESCE($5, min_threshold),
        current_stock = $6,
        supplier_name = COALESCE($7, supplier_name),
        updated_at = NOW()
      WHERE id = $8
    `;
    await client.query(updateProductQuery, [
      barcode ? barcode.trim() : null,
      name ? name.trim() : null,
      price !== undefined ? parseFloat(price) : null,
      cost_price !== undefined ? parseFloat(cost_price) : null,
      min_threshold !== undefined ? parseInt(min_threshold) : null,
      newStock,
      supplier_name ? supplier_name.trim() : null,
      productId
    ]);

    // 5. Update incoming_loads record
    const updateLoadQuery = `
      UPDATE incoming_loads
      SET 
        quantity_added = $1,
        supplier_name = $2
      WHERE id = $3
    `;
    await client.query(updateLoadQuery, [parseInt(quantity_added), supplier_name ? supplier_name.trim() : oldLoad.supplier_name, loadId]);

    await client.query('COMMIT');

    res.json({ success: true, message: 'Shipment entry updated successfully!' });
  } catch (err: any) {
    await client.query('ROLLBACK');
    console.error('Error updating load shipment entry:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  } finally {
    client.release();
  }
});

// GET /api/inventory/alerts - Get low stock and dead stock items
router.get('/alerts', async (req: Request, res: Response) => {
  try {
    // 1. Fetch low stock items: current_stock <= min_threshold
    const lowStockQuery = `
      SELECT * FROM products 
      WHERE current_stock <= min_threshold 
      ORDER BY current_stock ASC, name ASC
    `;
    const lowStockRes = await pool.query(lowStockQuery);

    // 2. Fetch dead stock items (unsold for 90 days, sitting stock > 0)
    const deadStockQuery = `
      SELECT 
        id, name, sku, price, current_stock, min_threshold, supplier_name, last_sold_at, created_at,
        COALESCE(
          EXTRACT(DAY FROM NOW() - last_sold_at),
          EXTRACT(DAY FROM NOW() - created_at)
        )::INT AS days_since_last_sale
      FROM products
      WHERE current_stock > 0 
        AND (
          last_sold_at < NOW() - INTERVAL '90 days'
          OR (last_sold_at IS NULL AND created_at < NOW() - INTERVAL '90 days')
        )
      ORDER BY days_since_last_sale DESC, name ASC
    `;
    const deadStockRes = await pool.query(deadStockQuery);

    res.json({
      low_stock_items: lowStockRes.rows,
      dead_stock_90_days_items: deadStockRes.rows
    });
  } catch (err) {
    console.error('Error fetching inventory alerts:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// GET /api/inventory/stats - Live database-aggregated telemetry statistics
router.get('/stats', async (req: Request, res: Response) => {
  try {
    // 1. Catalog SKUs
    const catalogRes = await pool.query('SELECT COUNT(*)::INT as count FROM products');
    const catalogSkus = catalogRes.rows[0].count;

    // 2. Gross Revenue
    const revenueRes = await pool.query(`
      SELECT COALESCE(SUM(total_amount), 0)::FLOAT as sum 
      FROM sales_transactions 
      WHERE status = 'COMPLETED'
    `);
    const grossRevenue = revenueRes.rows[0].sum;

    // 3. Low Stock SKUs
    const lowStockRes = await pool.query(`
      SELECT COUNT(*)::INT as count 
      FROM products 
      WHERE current_stock <= min_threshold
    `);
    const lowStockSkus = lowStockRes.rows[0].count;

    // 4. Dead Stock SKUs
    const deadStockRes = await pool.query(`
      SELECT COUNT(*)::INT as count 
      FROM products 
      WHERE current_stock > 0 
        AND (last_sold_at IS NULL OR last_sold_at < NOW() - INTERVAL '90 days')
    `);
    const deadStockSkus = deadStockRes.rows[0].count;

    res.json({
      catalog_skus: catalogSkus,
      gross_revenue: grossRevenue,
      low_stock_skus: lowStockSkus,
      dead_stock_skus: deadStockSkus
    });
  } catch (err) {
    console.error('Error fetching inventory stats:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

export default router;
