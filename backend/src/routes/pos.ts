import { Router, Request, Response } from 'express';
import { pool } from '../config/database';

const router = Router();

interface CartItem {
  product_id: number;
  quantity?: number;
  quantity_sold?: number; // fallback
}

// POST /checkout - Checkout shopping cart items atomically
// (Mounted as both POST /api/pos/checkout and POST /api/checkout)
router.post('/checkout', async (req: Request, res: Response) => {
  let items = req.body.items;
  const cartItems = req.body.cartItems;
  const paymentMethod = (req.body.paymentMethod || req.body.payment_method || 'CASH').toString().trim().toUpperCase();

  // If frontend sent cartItems format, translate it to internal items format
  if (cartItems && Array.isArray(cartItems)) {
    items = [];
    for (const item of cartItems) {
      let productId = item.id;
      // If product ID is not present, resolve it via barcode lookup
      if (!productId && item.barcode) {
        try {
          const prodRes = await pool.query('SELECT id FROM products WHERE UPPER(sku) = UPPER($1)', [item.barcode.toString().trim()]);
          if (prodRes.rows.length > 0) {
            productId = prodRes.rows[0].id;
          }
        } catch (err) {
          console.error('Error matching barcode in checkout:', err);
        }
      }
      items.push({
        product_id: productId,
        quantity: item.quantity !== undefined ? item.quantity : item.quantity_sold
      });
    }
  }

  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Cart is empty. Must include an array of items with product_id and quantity.' });
  }

  // Basic validation of inputs
  for (const item of items) {
    if (!item.product_id || (item.quantity === undefined && item.quantity_sold === undefined)) {
      return res.status(400).json({ error: 'Each cart item must have a product_id and quantity.' });
    }
    const qty = parseInt((item.quantity !== undefined ? item.quantity : item.quantity_sold!).toString());
    if (isNaN(qty) || qty <= 0) {
      return res.status(400).json({ error: 'quantity must be a positive integer.' });
    }
  }

  // Sort items by product_id to prevent deadlocks when locking rows concurrently
  const sortedItems = [...items].sort((a, b) => a.product_id - b.product_id);

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    let totalAmount = 0;
    let totalCogs = 0;
    const validatedItems: Array<{
      product_id: number;
      name: string;
      quantity: number;
      unit_price: number;
      cost_price: number;
    }> = [];

    // 1. Validate stock and gather pricing/cogs for all items
    for (const item of sortedItems) {
      const qty = parseInt((item.quantity !== undefined ? item.quantity : item.quantity_sold!).toString());
      
      // Lock the product row for update
      const productRes = await client.query(
        'SELECT id, name, current_stock, price::FLOAT as price, cost_price::FLOAT as cost_price FROM products WHERE id = $1 FOR UPDATE',
        [item.product_id]
      );

      if (productRes.rowCount === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: `Product with ID ${item.product_id} not found.` });
      }

      const product = productRes.rows[0];
      
      if (product.current_stock < qty) {
        await client.query('ROLLBACK');
        return res.status(400).json({ 
          error: `Insufficient stock for product '${product.name}'. Requested: ${qty}, Available: ${product.current_stock}.` 
        });
      }

      const itemTotal = qty * product.price;
      const itemCogs = qty * product.cost_price;
      totalAmount += itemTotal;
      totalCogs += itemCogs;

      validatedItems.push({
        product_id: item.product_id,
        name: product.name,
        quantity: qty,
        unit_price: product.price,
        cost_price: product.cost_price
      });
    }

    // 2. Insert sales transaction record (storing total_amount, total_cogs, and payment_method)
    const transactionQuery = `
      INSERT INTO sales_transactions (total_amount, total_cogs, payment_method, status)
      VALUES ($1, $2, $3, 'COMPLETED')
      RETURNING id, total_amount, total_cogs, payment_method, status, created_at
    `;
    const transactionRes = await client.query(transactionQuery, [totalAmount, totalCogs, paymentMethod]);
    const transactionId = transactionRes.rows[0].id;

    // 3. Deduct stock and insert transaction items
    for (const item of validatedItems) {
      // Deduct stock and update last_sold_at
      const updateProductQuery = `
        UPDATE products
        SET 
          current_stock = current_stock - $1,
          last_sold_at = NOW(),
          updated_at = NOW()
        WHERE id = $2
      `;
      await client.query(updateProductQuery, [item.quantity, item.product_id]);

      // Insert transaction item
      const itemQuery = `
        INSERT INTO transaction_items (transaction_id, product_id, quantity, unit_price)
        VALUES ($1, $2, $3, $4)
      `;
      await client.query(itemQuery, [transactionId, item.product_id, item.quantity, item.unit_price]);
    }

    // Commit the entire atomic checkout transaction
    await client.query('COMMIT');

    res.status(200).json({
      success: true,
      message: "Sale completed!",
      transaction: transactionRes.rows[0],
      items: validatedItems.map(vi => ({
        product_id: vi.product_id,
        name: vi.name,
        quantity_sold: vi.quantity, // mapped for backwards compatibility in frontend Success receipt
        unit_price: vi.unit_price
      }))
    });
  } catch (err: any) {
    await client.query('ROLLBACK');
    console.error('POS Checkout Transaction failed:', err);
    if (err.code === '23514') {
      res.status(400).json({ error: 'Database constraint violation: Stock cannot fall below 0.' });
    } else {
      res.status(500).json({ error: 'Internal Server Error during checkout.' });
    }
  } finally {
    client.release();
  }
});

// GET /api/pos/transactions - Fetch history of transactions (useful helper)
router.get('/transactions', async (req: Request, res: Response) => {
  try {
    const query = `
      SELECT 
        t.id, 
        t.total_amount, 
        t.total_cogs,
        t.payment_method,
        t.status, 
        t.created_at,
        COUNT(ti.id)::INT as total_items_count
      FROM sales_transactions t
      LEFT JOIN transaction_items ti ON t.id = ti.transaction_id
      GROUP BY t.id
      ORDER BY t.created_at DESC
      LIMIT 50
    `;
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching transactions:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

export default router;
