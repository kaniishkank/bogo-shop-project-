import { Router, Request, Response } from 'express';
import { pool } from '../config/database';

const router = Router();

// GET /api/products - Return all products with live current_stock
router.get('/', async (req: Request, res: Response) => {
  try {
    const result = await pool.query('SELECT * FROM products ORDER BY name ASC');
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching products:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// GET /api/products/scan/:barcode - Fast lookup route by SKU/barcode
router.get('/scan/:barcode', async (req: Request, res: Response) => {
  const { barcode } = req.params;
  try {
    const result = await pool.query(
      'SELECT id, name, sku, price::FLOAT as price, cost_price::FLOAT as cost_price, current_stock, min_threshold, supplier_name FROM products WHERE UPPER(sku) = UPPER($1)',
      [barcode.trim()]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: `Product with barcode '${barcode}' not found.` });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error scanning product barcode:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// POST /api/products - Create a new product SKU or increment stock during intake
router.post('/', async (req: Request, res: Response) => {
  const barcode = (req.body.barcode || req.body.sku || '').toString().trim().toUpperCase();
  const name = (req.body.name || '').toString().trim();
  const rawPrice = req.body.price !== undefined ? req.body.price : req.body.unit_price;
  const rawCostPrice = req.body.cost_price !== undefined ? req.body.cost_price : req.body.intake_cost;
  const rawStock = req.body.current_stock !== undefined ? req.body.current_stock : req.body.quantity;
  const rawThreshold = req.body.min_threshold;
  const supplierName = (req.body.supplier_name || 'UNKNOWN').toString().trim();

  if (!barcode) {
    return res.status(400).json({ error: 'Missing required field: barcode or sku' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Check if product with this barcode already exists
    const checkRes = await client.query('SELECT * FROM products WHERE UPPER(sku) = $1 FOR UPDATE', [barcode]);

    let product;
    if (checkRes.rows.length > 0) {
      // Product EXISTS: Update/Increment stock
      product = checkRes.rows[0];
      const quantityToAdd = rawStock !== undefined ? parseInt(rawStock.toString()) : 0;
      const updateQuery = `
        UPDATE products
        SET
          current_stock = current_stock + $1,
          supplier_name = COALESCE(NULLIF($2, 'UNKNOWN'), supplier_name),
          price = COALESCE($3, price),
          cost_price = COALESCE($4, cost_price),
          updated_at = NOW()
        WHERE id = $5
        RETURNING *
      `;
      const updateRes = await client.query(updateQuery, [
        quantityToAdd,
        supplierName,
        rawPrice !== undefined ? parseFloat(rawPrice.toString()) : null,
        rawCostPrice !== undefined ? parseFloat(rawCostPrice.toString()) : null,
        product.id
      ]);
      product = updateRes.rows[0];

      // Log the cargo shipment load intake
      if (quantityToAdd > 0) {
        await client.query(
          'INSERT INTO incoming_loads (product_id, quantity_added, supplier_name) VALUES ($1, $2, $3)',
          [product.id, quantityToAdd, supplierName]
        );
      }
    } else {
      // Product DOES NOT EXIST: Create a new product
      if (!name) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Missing required field: name (new product registration)' });
      }
      const price = rawPrice !== undefined ? parseFloat(rawPrice.toString()) : 0.00;
      const costPrice = rawCostPrice !== undefined ? parseFloat(rawCostPrice.toString()) : (price * 0.60);
      const stock = rawStock !== undefined ? parseInt(rawStock.toString()) : 0;
      const threshold = rawThreshold !== undefined ? parseInt(rawThreshold.toString()) : 5;

      const insertQuery = `
        INSERT INTO products (name, sku, price, cost_price, current_stock, min_threshold, supplier_name)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
      `;
      const insertRes = await client.query(insertQuery, [
        name,
        barcode,
        price,
        costPrice,
        stock,
        threshold,
        supplierName
      ]);
      product = insertRes.rows[0];

      // Log the cargo shipment load intake for initial stock
      if (stock > 0) {
        await client.query(
          'INSERT INTO incoming_loads (product_id, quantity_added, supplier_name) VALUES ($1, $2, $3)',
          [product.id, stock, supplierName]
        );
      }
    }

    await client.query('COMMIT');
    res.status(201).json(product);
  } catch (err: any) {
    await client.query('ROLLBACK');
    console.error('Error registering product via POST:', err);
    if (err.code === '23505') {
      res.status(409).json({ error: 'Product name or SKU already exists' });
    } else {
      res.status(500).json({ error: 'Internal Server Error' });
    }
  } finally {
    client.release();
  }
});

export default router;
