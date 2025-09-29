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
        <link href="/static/styles.css" rel="stylesheet">
        <style>
            @media print {
                body * { visibility: hidden; }
                #invoicePreview, #invoicePreview * { visibility: visible; }
                #invoicePreview { 
                    position: absolute;
                    left: 0;
                    top: 0;
                    width: 100% !important;
                    background: white !important;
                    padding: 20px !important;
                }
                .no-print { display: none !important; }
            }
        </style>
    </head>
    <body class="bg-gray-50 min-h-screen">
        <div class="container mx-auto px-4 py-6">
            <!-- ヘッダー -->
            <header class="mb-6 no-print">
                <h1 class="text-3xl font-bold text-gray-800 flex items-center">
                    <i class="fas fa-file-invoice mr-3 text-blue-600"></i>
                    請求書自動作成システム
                </h1>
                <p class="text-gray-600 mt-1">時間入力から自動計算してPDF出力</p>
            </header>

            <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <!-- 左側：入力フォーム -->
                <div class="no-print">
                    <div class="bg-white rounded-lg shadow-md p-6">
                        <h2 class="text-xl font-semibold mb-4 flex items-center">
                            <i class="fas fa-edit mr-2 text-blue-600"></i>
                            基本情報入力
                        </h2>

                        <!-- 請求先・発行者情報 -->
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                            <!-- 請求先 -->
                            <div>
                                <h3 class="font-medium mb-3 text-gray-700">請求先</h3>
                                <div class="space-y-3">
                                    <div>
                                        <label class="block text-sm font-medium text-gray-600 mb-1">会社名（お名前） *</label>
                                        <input type="text" id="clientCompany" class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" 
                                               placeholder="佐藤花子 / クライアント株式会社" onchange="updatePreview(); saveFormData()" required>
                                    </div>
                                    <div>
                                        <label class="block text-sm font-medium text-gray-600 mb-1">住所</label>
                                        <textarea id="clientAddress" rows="3" class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" 
                                                  placeholder="大阪府大阪市..." onchange="updatePreview(); saveFormData()"></textarea>
                                    </div>
                                </div>
                            </div>

                            <!-- 発行者 -->
                            <div>
                                <h3 class="font-medium mb-3 text-gray-700">発行者</h3>
                                <div class="space-y-3">
                                    <div>
                                        <label class="block text-sm font-medium text-gray-600 mb-1">会社名（お名前）</label>
                                        <input type="text" id="billerCompany" class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" 
                                               placeholder="山田太郎 / 株式会社サンプル" onchange="updatePreview(); saveFormData()">
                                    </div>
                                    <div>
                                        <label class="block text-sm font-medium text-gray-600 mb-1">インボイス登録番号</label>
                                        <input type="text" id="invoiceRegistrationNumber" class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" 
                                               placeholder="T1234567890123" onchange="updatePreview(); saveFormData()">
                                    </div>
                                    <div>
                                        <label class="block text-sm font-medium text-gray-600 mb-1">住所</label>
                                        <textarea id="billerAddress" rows="2" class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" 
                                                  placeholder="東京都渋谷区..." onchange="updatePreview(); saveFormData()"></textarea>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- 振込先口座情報 -->
                        <div class="mb-6">
                            <h3 class="font-medium mb-3 text-gray-700">振込先口座情報</h3>
                            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                <div>
                                    <label class="block text-sm font-medium text-gray-600 mb-1">銀行名</label>
                                    <input type="text" id="bankName" class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" 
                                           placeholder="○○銀行" onchange="updatePreview(); saveFormData()">
                                </div>
                                <div>
                                    <label class="block text-sm font-medium text-gray-600 mb-1">支店名</label>
                                    <input type="text" id="branchName" class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" 
                                           placeholder="△△支店" onchange="updatePreview(); saveFormData()">
                                </div>
                                <div>
                                    <label class="block text-sm font-medium text-gray-600 mb-1">口座種別</label>
                                    <select id="accountType" class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" 
                                            onchange="updatePreview(); saveFormData()">
                                        <option value="">選択してください</option>
                                        <option value="普通">普通</option>
                                        <option value="当座">当座</option>
                                    </select>
                                </div>
                                <div>
                                    <label class="block text-sm font-medium text-gray-600 mb-1">口座番号</label>
                                    <input type="text" id="accountNumber" class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" 
                                           placeholder="1234567" onchange="updatePreview(); saveFormData()">
                                </div>
                                <div class="md:col-span-2">
                                    <label class="block text-sm font-medium text-gray-600 mb-1">口座名義</label>
                                    <input type="text" id="accountHolder" class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" 
                                           placeholder="ヤマダ タロウ" onchange="updatePreview(); saveFormData()">
                                </div>
                            </div>
                        </div>

                        <!-- 請求書基本情報 -->
                        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
                            <div>
                                <label class="block text-sm font-medium text-gray-600 mb-1">請求書番号</label>
                                <input type="text" id="invoiceNumber" class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" 
                                       placeholder="INV-2024-001" onchange="updatePreview(); saveFormData()">
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-600 mb-1">発行日 *</label>
                                <input type="date" id="invoiceDate" class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" 
                                       onchange="updatePreview(); saveFormData(); calculateDueDate()" required>
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-600 mb-1">支払期限</label>
                                <input type="date" id="dueDate" class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50" 
                                       onchange="updatePreview(); saveFormData()" readonly title="発行日翌月末まで（自動計算）">
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-600 mb-1">税率 (%)</label>
                                <input type="number" id="taxRate" step="0.1" value="10" class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" 
                                       onchange="updatePreview(); saveFormData()">
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-600 mb-1">計算方式</label>
                                <select id="taxMode" class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" 
                                        onchange="updatePreview(); saveFormData()">
                                    <option value="exclusive">税抜き計算</option>
                                    <option value="inclusive">税込み計算</option>
                                </select>
                            </div>
                        </div>

                        <!-- 一時保存機能 -->
                        <div class="mb-6 text-center">
                            <div class="flex justify-center space-x-3">
                                <button onclick="saveFormData()" class="bg-blue-100 text-blue-700 px-4 py-2 rounded-md hover:bg-blue-200 transition-colors text-sm">
                                    <i class="fas fa-save mr-2"></i>一時保存
                                </button>
                                <button onclick="loadFormData()" class="bg-green-100 text-green-700 px-4 py-2 rounded-md hover:bg-green-200 transition-colors text-sm">
                                    <i class="fas fa-upload mr-2"></i>保存データ読込
                                </button>
                                <button onclick="clearFormData()" class="bg-red-100 text-red-700 px-4 py-2 rounded-md hover:bg-red-200 transition-colors text-sm">
                                    <i class="fas fa-trash mr-2"></i>データクリア
                                </button>
                            </div>
                            <div id="saveStatus" class="mt-2 text-sm text-gray-600"></div>
                        </div>

                        <!-- 作業項目 -->
                        <div class="mb-6">
                            <div class="flex justify-between items-center mb-4">
                                <h3 class="font-medium text-gray-700">作業項目</h3>
                                <button onclick="addWorkItem()" class="bg-blue-600 text-white px-3 py-1 rounded-md hover:bg-blue-700 transition-colors text-sm">
                                    <i class="fas fa-plus mr-1"></i>項目を追加
                                </button>
                            </div>
                            
                            <div id="workItems" class="space-y-4">
                                <!-- 作業項目がここに追加されます -->
                            </div>
                        </div>

                        <!-- 合計表示 -->
                        <div class="bg-gray-50 p-4 rounded-lg">
                            <div class="flex justify-between mb-2">
                                <span class="text-gray-600">小計:</span>
                                <span id="subtotalAmount" class="font-medium">¥0</span>
                            </div>
                            <div class="flex justify-between mb-2">
                                <span class="text-gray-600">消費税:</span>
                                <span id="taxAmount" class="font-medium">¥0</span>
                            </div>
                            <div class="flex justify-between text-lg font-semibold border-t pt-2">
                                <span>合計請求額:</span>
                                <span id="totalAmount" class="text-blue-600">¥0</span>
                            </div>
                        </div>

                        <!-- PDF出力ボタン -->
                        <div class="mt-6 text-center">
                            <button onclick="printInvoice()" class="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition-colors text-lg">
                                <i class="fas fa-print mr-2"></i>PDFとしてダウンロード
                            </button>
                        </div>
                    </div>
                </div>

                <!-- 右側：請求書プレビュー -->
                <div>
                    <div class="bg-white rounded-lg shadow-md p-1">
                        <div class="no-print mb-3 p-4">
                            <h2 class="text-xl font-semibold flex items-center">
                                <i class="fas fa-eye mr-2 text-green-600"></i>
                                請求書プレビュー
                            </h2>
                        </div>
                        
                        <!-- プレビューエリア -->
                        <div id="invoicePreview" class="bg-white p-8 border-2 border-gray-200 rounded-lg" style="min-height: 600px;">
                            <div class="text-center text-gray-500 py-20">
                                <i class="fas fa-file-invoice text-6xl mb-4"></i>
                                <p>左側のフォームに情報を入力すると<br>ここに請求書のプレビューが表示されます</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <script src="/static/app.js"></script>
    </body>
    </html>
  `)
})

export default app
