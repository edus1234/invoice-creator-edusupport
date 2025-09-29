import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serveStatic } from 'hono/cloudflare-workers'

type Bindings = {
  DB: D1Database;
}

const app = new Hono<{ Bindings: Bindings }>()

// CORS設定
app.use('/api/*', cors())

// 静的ファイル配信
app.use('/static/*', serveStatic({ root: './public' }))

// ヘルスチェック
app.get('/api/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// 請求書一覧取得
app.get('/api/invoices', async (c) => {
  const { env } = c;
  
  try {
    const result = await env.DB.prepare(`
      SELECT 
        id,
        invoice_number,
        client_name,
        invoice_date,
        due_date,
        total_amount,
        created_at
      FROM invoices 
      ORDER BY created_at DESC
    `).all();
    
    return c.json({ invoices: result.results });
  } catch (error) {
    return c.json({ error: 'Failed to fetch invoices' }, 500);
  }
})

// 請求書詳細取得（明細含む）
app.get('/api/invoices/:id', async (c) => {
  const { env } = c;
  const id = c.req.param('id');
  
  try {
    // 請求書基本情報取得
    const invoiceResult = await env.DB.prepare(`
      SELECT * FROM invoices WHERE id = ?
    `).bind(id).first();
    
    if (!invoiceResult) {
      return c.json({ error: 'Invoice not found' }, 404);
    }
    
    // 請求書明細取得
    const itemsResult = await env.DB.prepare(`
      SELECT * FROM invoice_items 
      WHERE invoice_id = ? 
      ORDER BY work_date ASC
    `).bind(id).all();
    
    return c.json({
      invoice: invoiceResult,
      items: itemsResult.results
    });
  } catch (error) {
    return c.json({ error: 'Failed to fetch invoice' }, 500);
  }
})

// 請求書作成
app.post('/api/invoices', async (c) => {
  const { env } = c;
  
  try {
    const body = await c.req.json();
    const { invoice, items } = body;
    
    // 請求書番号を自動生成（年月日 + 連番）
    const today = new Date();
    const dateString = today.toISOString().slice(0, 10).replace(/-/g, '');
    
    const countResult = await env.DB.prepare(`
      SELECT COUNT(*) as count FROM invoices 
      WHERE invoice_number LIKE 'INV-${dateString}-%'
    `).first();
    
    const sequence = (countResult?.count || 0) + 1;
    const invoiceNumber = `INV-${dateString}-${String(sequence).padStart(3, '0')}`;
    
    // 請求書作成
    const invoiceResult = await env.DB.prepare(`
      INSERT INTO invoices (
        invoice_number, client_name, client_address, 
        invoice_date, due_date, tax_rate, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(
      invoiceNumber,
      invoice.client_name,
      invoice.client_address || '',
      invoice.invoice_date,
      invoice.due_date || null,
      invoice.tax_rate || 0.10,
      invoice.notes || ''
    ).run();
    
    const invoiceId = invoiceResult.meta.last_row_id;
    
    // 請求書明細作成
    for (const item of items) {
      const amount = item.hours * item.hourly_rate;
      await env.DB.prepare(`
        INSERT INTO invoice_items (
          invoice_id, work_date, description, 
          hours, hourly_rate, amount
        ) VALUES (?, ?, ?, ?, ?, ?)
      `).bind(
        invoiceId,
        item.work_date,
        item.description,
        item.hours,
        item.hourly_rate,
        amount
      ).run();
    }
    
    return c.json({ 
      message: 'Invoice created successfully',
      invoice_id: invoiceId,
      invoice_number: invoiceNumber
    });
  } catch (error) {
    console.error('Error creating invoice:', error);
    return c.json({ error: 'Failed to create invoice' }, 500);
  }
})

// 請求書更新
app.put('/api/invoices/:id', async (c) => {
  const { env } = c;
  const id = c.req.param('id');
  
  try {
    const body = await c.req.json();
    const { invoice, items } = body;
    
    // 請求書更新
    await env.DB.prepare(`
      UPDATE invoices SET
        client_name = ?, client_address = ?, 
        invoice_date = ?, due_date = ?, 
        tax_rate = ?, notes = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(
      invoice.client_name,
      invoice.client_address || '',
      invoice.invoice_date,
      invoice.due_date || null,
      invoice.tax_rate || 0.10,
      invoice.notes || '',
      id
    ).run();
    
    // 既存の明細を削除
    await env.DB.prepare(`
      DELETE FROM invoice_items WHERE invoice_id = ?
    `).bind(id).run();
    
    // 新しい明細を作成
    for (const item of items) {
      const amount = item.hours * item.hourly_rate;
      await env.DB.prepare(`
        INSERT INTO invoice_items (
          invoice_id, work_date, description, 
          hours, hourly_rate, amount
        ) VALUES (?, ?, ?, ?, ?, ?)
      `).bind(
        id,
        item.work_date,
        item.description,
        item.hours,
        item.hourly_rate,
        amount
      ).run();
    }
    
    return c.json({ message: 'Invoice updated successfully' });
  } catch (error) {
    console.error('Error updating invoice:', error);
    return c.json({ error: 'Failed to update invoice' }, 500);
  }
})

// 請求書削除
app.delete('/api/invoices/:id', async (c) => {
  const { env } = c;
  const id = c.req.param('id');
  
  try {
    // 明細も自動で削除される（CASCADE設定）
    await env.DB.prepare(`
      DELETE FROM invoices WHERE id = ?
    `).bind(id).run();
    
    return c.json({ message: 'Invoice deleted successfully' });
  } catch (error) {
    return c.json({ error: 'Failed to delete invoice' }, 500);
  }
})

// メインページ
app.get('/', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="ja">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>請求書自動作成システム</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
        <script src="https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js"></script>
        <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
        <link href="/static/styles.css" rel="stylesheet">
    </head>
    <body class="bg-gray-50 min-h-screen">
        <div class="container mx-auto px-4 py-8">
            <!-- ヘッダー -->
            <header class="mb-8">
                <h1 class="text-4xl font-bold text-gray-800 flex items-center">
                    <i class="fas fa-file-invoice mr-3 text-blue-600"></i>
                    請求書自動作成システム
                </h1>
                <p class="text-gray-600 mt-2">時間入力から自動計算してPDF出力できる請求書システム</p>
            </header>

            <!-- ナビゲーション -->
            <nav class="mb-6">
                <div class="flex space-x-4">
                    <button id="showCreateForm" class="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">
                        <i class="fas fa-plus mr-2"></i>新規作成
                    </button>
                    <button id="showInvoiceList" class="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors">
                        <i class="fas fa-list mr-2"></i>請求書一覧
                    </button>
                </div>
            </nav>

            <!-- メインコンテンツエリア -->
            <main id="mainContent">
                <div id="welcomeMessage" class="text-center py-16">
                    <i class="fas fa-file-invoice text-6xl text-gray-400 mb-4"></i>
                    <h2 class="text-2xl font-semibold text-gray-700 mb-2">請求書自動作成システムへようこそ</h2>
                    <p class="text-gray-600">上のボタンから新規作成または請求書一覧を選択してください</p>
                </div>
            </main>
        </div>

        <!-- モーダル -->
        <div id="modal" class="fixed inset-0 bg-black bg-opacity-50 hidden z-50">
            <div class="flex items-center justify-center min-h-screen p-4">
                <div class="bg-white rounded-lg max-w-4xl w-full max-h-screen overflow-y-auto">
                    <div id="modalContent"></div>
                </div>
            </div>
        </div>

        <script src="/static/app.js"></script>
    </body>
    </html>
  `)
})

export default app
