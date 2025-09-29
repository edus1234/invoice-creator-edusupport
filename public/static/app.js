// 請求書自動作成システム - ワンページ形式

// グローバル変数
let workItemIndex = 0;

// ページ読み込み時の初期化
document.addEventListener('DOMContentLoaded', function() {
    initializePage();
});

function initializePage() {
    // 初期値設定
    document.getElementById('invoiceDate').value = new Date().toISOString().split('T')[0];
    
    // 自動番号生成
    generateInvoiceNumber();
    
    // 初期作業項目を1つ追加
    addWorkItem();
    
    // 初回プレビュー更新
    updatePreview();
}

// 請求書番号の自動生成
function generateInvoiceNumber() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const invoiceNumber = `INV-${year}${month}${day}-001`;
    document.getElementById('invoiceNumber').value = invoiceNumber;
}

// 作業項目を追加
function addWorkItem() {
    const container = document.getElementById('workItems');
    const itemHtml = `
        <div class="work-item bg-gray-50 p-4 rounded-lg border border-gray-200" data-index="${workItemIndex}">
            <div class="flex justify-between items-center mb-3">
                <h4 class="font-medium text-gray-700">作業項目 ${workItemIndex + 1}</h4>
                <button onclick="removeWorkItem(${workItemIndex})" class="text-red-600 hover:text-red-800 text-sm">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
            
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                <div>
                    <label class="block text-sm font-medium text-gray-600 mb-1">日付 *</label>
                    <input type="date" class="work-date w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500" 
                           value="${new Date().toISOString().split('T')[0]}" onchange="updatePreview()" required>
                </div>
                
                <div>
                    <label class="block text-sm font-medium text-gray-600 mb-1">作業内容 *</label>
                    <input type="text" class="work-description w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500" 
                           placeholder="例: ウェブサイト開発" onchange="updatePreview()" required>
                </div>
                
                <div>
                    <label class="block text-sm font-medium text-gray-600 mb-1">時間 *</label>
                    <input type="number" step="0.5" class="work-hours w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500" 
                           placeholder="8.0" onchange="calculateItemAmount(${workItemIndex}); updatePreview()" required>
                </div>
                
                <div>
                    <label class="block text-sm font-medium text-gray-600 mb-1">時給 *</label>
                    <input type="number" class="work-rate w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500" 
                           placeholder="5000" onchange="calculateItemAmount(${workItemIndex}); updatePreview()" required>
                </div>
            </div>
            
            <div class="mt-3 text-right">
                <span class="text-sm text-gray-600">金額: </span>
                <span class="item-amount font-semibold text-blue-600">¥0</span>
            </div>
        </div>
    `;
    
    container.insertAdjacentHTML('beforeend', itemHtml);
    workItemIndex++;
    updateItemNumbers();
}

// 作業項目を削除
function removeWorkItem(index) {
    const item = document.querySelector(`[data-index="${index}"]`);
    if (item && document.querySelectorAll('.work-item').length > 1) {
        item.remove();
        updateItemNumbers();
        updatePreview();
    } else if (document.querySelectorAll('.work-item').length === 1) {
        alert('最低1つの作業項目は必要です');
    }
}

// 項目番号を更新
function updateItemNumbers() {
    const items = document.querySelectorAll('.work-item');
    items.forEach((item, index) => {
        item.querySelector('h4').textContent = `作業項目 ${index + 1}`;
    });
}

// 個別項目の金額計算
function calculateItemAmount(index) {
    const item = document.querySelector(`[data-index="${index}"]`);
    if (!item) return;
    
    const hours = parseFloat(item.querySelector('.work-hours').value) || 0;
    const rate = parseFloat(item.querySelector('.work-rate').value) || 0;
    const amount = hours * rate;
    
    item.querySelector('.item-amount').textContent = `¥${amount.toLocaleString()}`;
    
    calculateTotals();
}

// 合計金額計算
function calculateTotals() {
    let subtotal = 0;
    const items = document.querySelectorAll('.work-item');
    
    items.forEach(item => {
        const hours = parseFloat(item.querySelector('.work-hours').value) || 0;
        const rate = parseFloat(item.querySelector('.work-rate').value) || 0;
        subtotal += hours * rate;
    });
    
    const taxRate = parseFloat(document.getElementById('taxRate').value) || 0;
    const tax = subtotal * (taxRate / 100);
    const total = subtotal + tax;
    
    document.getElementById('subtotalAmount').textContent = `¥${subtotal.toLocaleString()}`;
    document.getElementById('taxAmount').textContent = `¥${Math.round(tax).toLocaleString()}`;
    document.getElementById('totalAmount').textContent = `¥${Math.round(total).toLocaleString()}`;
}

// リアルタイムプレビュー更新
function updatePreview() {
    const preview = document.getElementById('invoicePreview');
    
    // フォームデータを取得
    const data = {
        billerCompany: document.getElementById('billerCompany').value,
        billerName: document.getElementById('billerName').value,
        billerAddress: document.getElementById('billerAddress').value,
        clientCompany: document.getElementById('clientCompany').value,
        clientName: document.getElementById('clientName').value,
        clientAddress: document.getElementById('clientAddress').value,
        invoiceNumber: document.getElementById('invoiceNumber').value,
        invoiceDate: document.getElementById('invoiceDate').value,
        taxRate: parseFloat(document.getElementById('taxRate').value) || 0
    };
    
    // 作業項目を取得
    const workItems = [];
    const items = document.querySelectorAll('.work-item');
    let subtotal = 0;
    
    items.forEach(item => {
        const date = item.querySelector('.work-date').value;
        const description = item.querySelector('.work-description').value;
        const hours = parseFloat(item.querySelector('.work-hours').value) || 0;
        const rate = parseFloat(item.querySelector('.work-rate').value) || 0;
        const amount = hours * rate;
        
        if (date || description || hours || rate) {
            workItems.push({ date, description, hours, rate, amount });
            subtotal += amount;
        }
    });
    
    const tax = subtotal * (data.taxRate / 100);
    const total = subtotal + tax;
    
    // 合計金額を更新
    calculateTotals();
    
    // プレビューHTMLを生成
    const previewHtml = generateInvoiceHTML(data, workItems, subtotal, tax, total);
    preview.innerHTML = previewHtml;
}

// 請求書HTMLの生成
function generateInvoiceHTML(data, workItems, subtotal, tax, total) {
    const formatDate = (dateStr) => {
        if (!dateStr) return '';
        return new Date(dateStr).toLocaleDateString('ja-JP');
    };
    
    const hasBasicInfo = data.invoiceNumber || data.clientCompany;
    
    if (!hasBasicInfo) {
        return `
            <div class="text-center text-gray-500 py-20">
                <i class="fas fa-file-invoice text-6xl mb-4"></i>
                <p>左側のフォームに情報を入力すると<br>ここに請求書のプレビューが表示されます</p>
            </div>
        `;
    }
    
    return `
        <div class="max-w-4xl mx-auto">
            <!-- ヘッダー -->
            <div class="text-center mb-8">
                <h1 class="text-3xl font-bold text-gray-800 mb-2">請求書</h1>
                ${data.invoiceNumber ? `<div class="text-lg text-gray-600">No. ${data.invoiceNumber}</div>` : ''}
            </div>
            
            <!-- 基本情報 -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                <!-- 請求元 -->
                <div>
                    <h3 class="font-semibold text-gray-700 mb-3 pb-1 border-b">請求元</h3>
                    ${data.billerCompany ? `<div class="font-medium text-lg mb-1">${data.billerCompany}</div>` : ''}
                    ${data.billerName ? `<div class="text-gray-700 mb-2">${data.billerName}</div>` : ''}
                    ${data.billerAddress ? `<div class="text-gray-600 text-sm whitespace-pre-line">${data.billerAddress}</div>` : ''}
                </div>
                
                <!-- 請求先 -->
                <div>
                    <h3 class="font-semibold text-gray-700 mb-3 pb-1 border-b">請求先</h3>
                    ${data.clientCompany ? `<div class="font-medium text-lg mb-1">${data.clientCompany}</div>` : ''}
                    ${data.clientName ? `<div class="text-gray-700 mb-2">${data.clientName}</div>` : ''}
                    ${data.clientAddress ? `<div class="text-gray-600 text-sm whitespace-pre-line">${data.clientAddress}</div>` : ''}
                </div>
            </div>
            
            <!-- 発行日 -->
            <div class="text-right mb-6">
                ${data.invoiceDate ? `<div class="text-gray-700">発行日: ${formatDate(data.invoiceDate)}</div>` : ''}
            </div>
            
            <!-- 作業項目テーブル -->
            ${workItems.length > 0 ? `
                <table class="w-full border-collapse border border-gray-300 mb-6">
                    <thead>
                        <tr class="bg-gray-50">
                            <th class="border border-gray-300 px-4 py-3 text-left">日付</th>
                            <th class="border border-gray-300 px-4 py-3 text-left">作業内容</th>
                            <th class="border border-gray-300 px-4 py-3 text-right">時間</th>
                            <th class="border border-gray-300 px-4 py-3 text-right">時給</th>
                            <th class="border border-gray-300 px-4 py-3 text-right">金額</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${workItems.map(item => `
                            <tr>
                                <td class="border border-gray-300 px-4 py-2">${formatDate(item.date)}</td>
                                <td class="border border-gray-300 px-4 py-2">${item.description}</td>
                                <td class="border border-gray-300 px-4 py-2 text-right">${item.hours ? item.hours + 'h' : ''}</td>
                                <td class="border border-gray-300 px-4 py-2 text-right">${item.rate ? '¥' + item.rate.toLocaleString() : ''}</td>
                                <td class="border border-gray-300 px-4 py-2 text-right font-medium">${item.amount ? '¥' + item.amount.toLocaleString() : ''}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            ` : ''}
            
            <!-- 合計 -->
            <div class="flex justify-end">
                <div class="w-72">
                    <div class="border border-gray-300 bg-gray-50 p-4">
                        <div class="flex justify-between py-2">
                            <span>小計:</span>
                            <span class="font-medium">¥${subtotal.toLocaleString()}</span>
                        </div>
                        <div class="flex justify-between py-2">
                            <span>消費税 (${data.taxRate}%):</span>
                            <span class="font-medium">¥${Math.round(tax).toLocaleString()}</span>
                        </div>
                        <div class="border-t border-gray-400 pt-2 mt-2">
                            <div class="flex justify-between text-lg font-semibold">
                                <span>合計:</span>
                                <span class="text-blue-600">¥${Math.round(total).toLocaleString()}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- フッター -->
            <div class="mt-12 text-center text-sm text-gray-500">
                この度はお仕事をいただき、ありがとうございます。
            </div>
        </div>
    `;
}

// PDF出力（ブラウザ印刷機能を使用）
function printInvoice() {
    // 必須項目のチェック
    const invoiceNumber = document.getElementById('invoiceNumber').value;
    const clientCompany = document.getElementById('clientCompany').value;
    const invoiceDate = document.getElementById('invoiceDate').value;
    
    if (!invoiceNumber || !clientCompany || !invoiceDate) {
        alert('請求書番号、請求先会社名、発行日は必須項目です。');
        return;
    }
    
    // 作業項目のチェック
    const workItems = document.querySelectorAll('.work-item');
    let hasValidItems = false;
    
    workItems.forEach(item => {
        const hours = parseFloat(item.querySelector('.work-hours').value) || 0;
        const rate = parseFloat(item.querySelector('.work-rate').value) || 0;
        const description = item.querySelector('.work-description').value;
        
        if (hours > 0 && rate > 0 && description) {
            hasValidItems = true;
        }
    });
    
    if (!hasValidItems) {
        alert('少なくとも1つの有効な作業項目（時間・時給・作業内容）を入力してください。');
        return;
    }
    
    // 印刷実行
    window.print();
}

// 初期化時に1回だけ実行
setTimeout(() => {
    updatePreview();
}, 100);