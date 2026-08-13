# SARAWANAS STORES - Smart Inventory & Cashier POS Terminal

SARAWANAS is a state-of-the-art, high-performance, and persistent Smart Inventory Management and Cashier Point of Sale (POS) Billing Terminal designed for retail stores. The system features webcam-based barcode scanning, real-time telemetry analytics, shipment load intakes, and transaction-safe checkout workflows.

---

## 🚀 Key Features

### 1. Cashier POS Billing Terminal (`/pos-billing`)
*   **Zero-Latency Memory Scanning**: Pre-caches the product catalog in a local memory Map, enabling instant **0ms** barcode additions to the cart. Falls back gracefully to background API checks for new entries.
*   **Component-Level Memoization**: Optimizes lists (`ProductCard`, `CartItemRow`) using `React.memo` to eliminate input lag when filtering or scanning.
*   **Atomic Transactions**: Processes sales checkouts securely with Express and PostgreSQL row locks (`FOR UPDATE`), automatically adjusting inventory levels and logging sales.
*   **Invoice Receipts**: Simulates a printed invoice receipt modal upon successful transaction completion with full item listings and payment methods.

### 2. Live Camera Barcode Scanner Modal
*   **Webcam Scanner Overlay**: Integrates `html5-qrcode` to capture video frames using environment/rear-facing cameras.
*   **Dynamic Bundle Code Splitting**: Lazy-loads the camera libraries only when the camera modal is opened, dropping the initial bundle size by over **60%** for instant page loads.
*   **Multi-Format Support**: Decodes standard barcodes (EAN-13, EAN-8, UPC-A, Code 128, QR Codes) with instant audio beep feedback on success.
*   **Reusability**: Reused across both `/pos-billing` (cart additions) and `/load-intake` (form auto-fills).

### 3. Cargo Shipment Load Intake (`/load-intake`)
*   **Inventory Registrations**: Adds new items to the catalog or increments stock levels for existing SKUs with autocomplete search matching.
*   **Live Shipment Feed Table**: Shows the latest 100 shipment logs with a dedicated **Edit Action** column.
*   **Entry Editing Modal**: Allows editing barcodes, names, quantities, costs, and thresholds, recalculating parent product stock levels automatically.

### 4. Telemetry Dashboard & Financials (`/` / `/financials`)
*   **Live Metrics**: Monitors total catalog SKUs, gross revenue, low stock counts, and dead stock items.
*   **Stock Warnings**: Displays orange warnings for low-stock items ($\le$ threshold) and critical notifications for dead-stock items (no sales in 90 days).
*   **Financial Reports**: Computes Cost of Goods Sold (COGS) and Gross Profit Margins on live charts.

---

## 🛠️ Technology Stack

*   **Frontend**: React (v18), TypeScript, Vite, Lucide Icons, Vanilla CSS (Premium Glassmorphic Dark UI)
*   **Backend**: Node.js, Express, PG Pool (PostgreSQL Client)
*   **Database**: PostgreSQL (v15-alpine)
*   **Deployment**: Docker, Docker Compose, Nginx (Frontend Reverse Proxy)

---

## 📦 Docker Container Architecture

The system runs as a multi-container Docker Compose application:

1.  **`smart-inventory-db`**: PostgreSQL database service storing products, incoming loads, and sales transaction logs. Configured with a persistent volume (`db_data`) to protect data across reloads.
2.  **`smart-inventory-backend`**: Node.js Express REST API server running on port `5000`.
3.  **`smart-inventory-frontend`**: React web application built with Vite and served via Nginx on port `3000`.

---

## ⚙️ Setup and Installation

### Prerequisites
*   [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed on Windows, Mac, or Linux.

### Launching the Application
1.  Open your terminal inside the project root directory.
2.  Run the following command to compile code assets and start the container stack:
    ```bash
    docker compose up -d --build
    ```
3.  Access the web portals:
    *   **Cashier Portal (Frontend)**: [http://localhost:3000](http://localhost:3000)
    *   **REST API Gateway (Backend)**: [http://localhost:5000/api/health](http://localhost:5000/api/health)

### Database Reset & Clean Slate
If you want to clear the database to show a completely fresh demo:
1.  Open `docker-compose.yml`.
2.  In the `backend` environment variables, temporarily add/set:
    ```yaml
    - RESET_DB=true
    ```
3.  Restart backend: `docker compose up -d` (all tables are dropped and recreated empty).
4.  Set `RESET_DB=false` again in `docker-compose.yml` and restart `docker compose up -d` to resume normal persistence.
