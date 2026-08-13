import { Router, Request, Response } from 'express';
import { pool } from '../config/database';

const router = Router();

// GET /api/analytics/financials - Get summary metrics and time-series data
router.get('/financials', async (req: Request, res: Response) => {
  const range = (req.query.range as string) || 'all'; // Default to All Time

  let startDateStr = "NOW() - INTERVAL '7 days'";
  if (range === 'day') startDateStr = "NOW() - INTERVAL '24 hours'";
  else if (range === 'month') startDateStr = "NOW() - INTERVAL '30 days'";
  else if (range === 'year') startDateStr = "NOW() - INTERVAL '12 months'";
  else if (range === 'all') startDateStr = 'all';

  try {
    // 1. Fetch Total Revenue (matching dashboard sum of total_amount)
    const revenueQuery = `
      SELECT COALESCE(SUM(total_amount), 0)::FLOAT as total_revenue
      FROM sales_transactions
      WHERE status = 'COMPLETED'
        ${startDateStr !== 'all' ? `AND created_at >= ${startDateStr}` : ''}
    `;
    const revenueRes = await pool.query(revenueQuery);
    const totalRevenue = revenueRes.rows[0].total_revenue;

    // 2. Fetch Total COGS (cost of goods sold) directly from transactions
    const cogsQuery = `
      SELECT COALESCE(SUM(total_cogs), 0)::FLOAT as cogs
      FROM sales_transactions
      WHERE status = 'COMPLETED'
        ${startDateStr !== 'all' ? `AND created_at >= ${startDateStr}` : ''}
    `;
    const cogsRes = await pool.query(cogsQuery);
    const cogs = cogsRes.rows[0].cogs;

    const netProfit = totalRevenue - cogs;
    const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

    const summary = {
      total_revenue: totalRevenue,
      cogs: cogs,
      net_profit: netProfit,
      profit_margin: profitMargin
    };

    // 3. Fetch Time-Series chart data using CTEs
    let seriesQuery = '';
    if (range === 'day') {
      seriesQuery = `
        WITH hourly_stats AS (
          SELECT 
            date_trunc('hour', created_at) as hour,
            SUM(total_amount)::FLOAT as revenue,
            SUM(total_cogs)::FLOAT as cogs
          FROM sales_transactions
          WHERE status = 'COMPLETED'
          GROUP BY date_trunc('hour', created_at)
        )
        SELECT 
          TO_CHAR(series.h, 'HH24:00') as label,
          COALESCE(hs.revenue, 0)::FLOAT as revenue,
          COALESCE(hs.cogs, 0)::FLOAT as cost,
          COALESCE(hs.revenue - hs.cogs, 0)::FLOAT as profit
        FROM generate_series(
          date_trunc('hour', NOW() - INTERVAL '23 hours'),
          date_trunc('hour', NOW()),
          '1 hour'::interval
        ) as series(h)
        LEFT JOIN hourly_stats hs ON hs.hour = date_trunc('hour', series.h)
        ORDER BY series.h ASC;
      `;
    } else if (range === 'week') {
      seriesQuery = `
        WITH weekly_stats AS (
          SELECT 
            date_trunc('day', created_at) as day,
            SUM(total_amount)::FLOAT as revenue,
            SUM(total_cogs)::FLOAT as cogs
          FROM sales_transactions
          WHERE status = 'COMPLETED'
          GROUP BY date_trunc('day', created_at)
        )
        SELECT 
          TO_CHAR(series.d, 'Dy') as label,
          COALESCE(ws.revenue, 0)::FLOAT as revenue,
          COALESCE(ws.cogs, 0)::FLOAT as cost,
          COALESCE(ws.revenue - ws.cogs, 0)::FLOAT as profit
        FROM generate_series(
          date_trunc('day', NOW() - INTERVAL '6 days'),
          date_trunc('day', NOW()),
          '1 day'::interval
        ) as series(d)
        LEFT JOIN weekly_stats ws ON ws.day = date_trunc('day', series.d)
        ORDER BY series.d ASC;
      `;
    } else if (range === 'month' || range === 'all') {
      seriesQuery = `
        WITH daily_stats AS (
          SELECT 
            date_trunc('day', created_at) as day,
            SUM(total_amount)::FLOAT as revenue,
            SUM(total_cogs)::FLOAT as cogs
          FROM sales_transactions
          WHERE status = 'COMPLETED'
          GROUP BY date_trunc('day', created_at)
        )
        SELECT 
          TO_CHAR(series.d, 'DD Mon') as label,
          COALESCE(ds.revenue, 0)::FLOAT as revenue,
          COALESCE(ds.cogs, 0)::FLOAT as cost,
          COALESCE(ds.revenue - ds.cogs, 0)::FLOAT as profit
        FROM generate_series(
          date_trunc('day', NOW() - INTERVAL '29 days'),
          date_trunc('day', NOW()),
          '1 day'::interval
        ) as series(d)
        LEFT JOIN daily_stats ds ON ds.day = date_trunc('day', series.d)
        ORDER BY series.d ASC;
      `;
    } else { // year
      seriesQuery = `
        WITH monthly_stats AS (
          SELECT 
            date_trunc('month', created_at) as month,
            SUM(total_amount)::FLOAT as revenue,
            SUM(total_cogs)::FLOAT as cogs
          FROM sales_transactions
          WHERE status = 'COMPLETED'
          GROUP BY date_trunc('month', created_at)
        )
        SELECT 
          TO_CHAR(series.m, 'Mon YY') as label,
          COALESCE(ms.revenue, 0)::FLOAT as revenue,
          COALESCE(ms.cogs, 0)::FLOAT as cost,
          COALESCE(ms.revenue - ms.cogs, 0)::FLOAT as profit
        FROM generate_series(
          date_trunc('month', NOW() - INTERVAL '11 months'),
          date_trunc('month', NOW()),
          '1 month'::interval
        ) as series(m)
        LEFT JOIN monthly_stats ms ON ms.month = date_trunc('month', series.m)
        ORDER BY series.m ASC;
      `;
    }
    const seriesRes = await pool.query(seriesQuery);

    // 4. Fetch Product Profitability Breakdown
    const productQuery = `
      SELECT 
        p.name,
        COALESCE(SUM(ti.quantity), 0)::INT as units_sold,
        COALESCE(SUM(ti.quantity * ti.unit_price), 0)::FLOAT as gross_revenue,
        COALESCE(SUM(ti.quantity * p.cost_price), 0)::FLOAT as estimated_cost,
        COALESCE(SUM(ti.quantity * (ti.unit_price - p.cost_price)), 0)::FLOAT as total_profit,
        CASE 
          WHEN SUM(ti.quantity * ti.unit_price) > 0 
          THEN (SUM(ti.quantity * (ti.unit_price - p.cost_price)) / SUM(ti.quantity * ti.unit_price) * 100)::FLOAT 
          ELSE 0.0 
        END as margin_percent
      FROM products p
      JOIN transaction_items ti ON p.id = ti.product_id
      JOIN sales_transactions t ON ti.transaction_id = t.id
      WHERE t.status = 'COMPLETED'
        ${startDateStr !== 'all' ? `AND t.created_at >= ${startDateStr}` : ''}
      GROUP BY p.id, p.name
      ORDER BY total_profit DESC
      LIMIT 10
    `;
    const productRes = await pool.query(productQuery);

    res.json({
      summary,
      timeSeries: seriesRes.rows,
      productsBreakdown: productRes.rows
    });
  } catch (err) {
    console.error('Error fetching financial analytics:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

export default router;
