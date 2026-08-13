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

// POST /api/products - Create a new product SKU (Manual administrative flow)
router.post('/', async (req: Request, res: Response) => {
  const { name, sku, unit_price, current_stock, min_threshold, supplier_name } = req.body;

  if (!name || !sku || !supplier_name || unit_price === undefined) {
    return res.status(400).json({ error: 'Missing required fields: name, sku, supplier_name, unit_price' });
  }

  const price = parseFloat(unit_price);
  const stock = current_stock !== undefined ? parseInt(current_stock) : 0;
  const threshold = min_threshold !== undefined ? parseInt(min_threshold) : 10;

  if (isNaN(price) || price < 0) {
    return res.status(400).json({ error: 'unit_price must be a non-negative number' });
  }
  if (isNaN(stock) || stock < 0) {
    return res.status(400).json({ error: 'current_stock must be a non-negative integer' });
  }
  if (isNaN(threshold) || threshold < 0) {
    return res.status(400).json({ error: 'min_threshold must be a non-negative integer' });
  }

  try {
    const query = `
      INSERT INTO products (name, sku, unit_price, current_stock, min_threshold, supplier_name)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;
    const result = await pool.query(query, [name.trim(), sku.trim().toUpperCase(), price, stock, threshold, supplier_name.trim()]);
    res.status(201).json(result.rows[0]);
  } catch (err: any) {
    console.error('Error creating product:', err);
    if (err.code === '23505') {
      res.status(409).json({ error: `Product SKU or name already exists` });
    } else if (err.code === '23514') {
      res.status(400).json({ error: 'Stock violation: current_stock must be >= 0' });
    } else {
      res.status(500).json({ error: 'Internal Server Error' });
    }
  }
});

export default router;
