// 請求書自動作成システム - 個人事業主対応版

// グローバル変数
let workItemIndex = 0;

// ページ読み込み時の初期化
document.addEventListener('DOMContentLoaded', function() {
    initializePage();
});

function initializePage() {
    // 初期値設定
    document.getElementById('invoiceDate').value = new Date().toISOString().split('T')[0];
    
    // 支払期限を自動計算
    calculateDueDate();
    
    // 自動番号生成（任意）
    generateInvoiceNumber();
    
    // 初期作業項目を1つ追加
    addWorkItem();
    
    // 保存データがあれば読み込み
    loadFormData(false); // サイレント読み込み
    
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

// 支払期限の自動計算（発行日翌月末まで）
function calculateDueDate() {
    const invoiceDate = document.getElementById('invoiceDate').value;
    if (!invoiceDate) return;
    
    const date = new Date(invoiceDate);
    // 翌月に移動
    date.setMonth(date.getMonth() + 1);
    // その月の末日を取得（0日は前月の末日）
    const nextMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0);
    
    // YYYY-MM-DD形式で設定
    const year = nextMonth.getFullYear();
    const month = String(nextMonth.getMonth() + 1).padStart(2, '0');
    const day = String(nextMonth.getDate()).padStart(2, '0');
    const dueDateStr = `${year}-${month}-${day}`;
    
    document.getElementById('dueDate').value = dueDateStr;
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
                           value="${new Date().toISOString().split('T')[0]}" onchange="updatePreview(); saveFormData()" required>
                </div>
                
                <div>
                    <label class="block text-sm font-medium text-gray-600 mb-1">作業内容 *</label>
                    <input type="text" class="work-description w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500" 
                           placeholder="例: ウェブサイト開発" onchange="updatePreview(); saveFormData()" required>
                </div>
                
                <div>
                    <label class="block text-sm font-medium text-gray-600 mb-1">時間 *</label>
                    <input type="number" step="0.5" class="work-hours w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500" 
                           placeholder="8.0" onchange="calculateItemAmount(${workItemIndex}); updatePreview(); saveFormData()" required>
                </div>
                
                <div>
                    <label class="block text-sm font-medium text-gray-600 mb-1">時給 *</label>
                    <input type="number" class="work-rate w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500" 
                           placeholder="5000" onchange="calculateItemAmount(${workItemIndex}); updatePreview(); saveFormData()" required>
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
        saveFormData();
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

// 合計金額計算（税込み・税抜き対応）
function calculateTotals() {
    let subtotal = 0;
    const items = document.querySelectorAll('.work-item');
    
    items.forEach(item => {
        const hours = parseFloat(item.querySelector('.work-hours').value) || 0;
        const rate = parseFloat(item.querySelector('.work-rate').value) || 0;
        subtotal += hours * rate;
    });
    
    const taxRate = parseFloat(document.getElementById('taxRate').value) || 0;
    const taxMode = document.getElementById('taxMode').value;
    
    let displaySubtotal, displayTax, displayTotal;
    
    if (taxMode === 'inclusive') {
        // 税込み計算：入力金額に税が含まれている
        displayTotal = subtotal;
        displaySubtotal = Math.round(subtotal / (1 + taxRate / 100));
        displayTax = displayTotal - displaySubtotal;
    } else {
        // 税抜き計算：従来通り
        displaySubtotal = subtotal;
        displayTax = Math.round(subtotal * (taxRate / 100));
        displayTotal = displaySubtotal + displayTax;
    }
    
    document.getElementById('subtotalAmount').textContent = `¥${displaySubtotal.toLocaleString()}`;
    document.getElementById('taxAmount').textContent = `¥${displayTax.toLocaleString()}`;
    document.getElementById('totalAmount').textContent = `¥${displayTotal.toLocaleString()}`;
}

// リアルタイムプレビュー更新
function updatePreview() {
    const preview = document.getElementById('invoicePreview');
    
    // フォームデータを取得
    const data = {
        billerCompany: document.getElementById('billerCompany').value,
        billerAddress: document.getElementById('billerAddress').value,
        invoiceRegistrationNumber: document.getElementById('invoiceRegistrationNumber').value,
        clientCompany: document.getElementById('clientCompany').value,
        clientAddress: document.getElementById('clientAddress').value,
        invoiceNumber: document.getElementById('invoiceNumber').value,
        invoiceDate: document.getElementById('invoiceDate').value,
        dueDate: document.getElementById('dueDate').value,
        taxRate: parseFloat(document.getElementById('taxRate').value) || 0,
        taxMode: document.getElementById('taxMode').value,
        // 振込先口座情報
        bankName: document.getElementById('bankName').value,
        branchName: document.getElementById('branchName').value,
        accountType: document.getElementById('accountType').value,
        accountNumber: document.getElementById('accountNumber').value,
        accountHolder: document.getElementById('accountHolder').value
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
    
    // 税計算
    let displaySubtotal, displayTax, displayTotal;
    
    if (data.taxMode === 'inclusive') {
        displayTotal = subtotal;
        displaySubtotal = Math.round(subtotal / (1 + data.taxRate / 100));
        displayTax = displayTotal - displaySubtotal;
    } else {
        displaySubtotal = subtotal;
        displayTax = Math.round(subtotal * (data.taxRate / 100));
        displayTotal = displaySubtotal + displayTax;
    }
    
    // 合計金額を更新
    calculateTotals();
    
    // プレビューHTMLを生成
    const previewHtml = generateInvoiceHTML(data, workItems, displaySubtotal, displayTax, displayTotal);
    preview.innerHTML = previewHtml;
}

// 請求書HTMLの生成
function generateInvoiceHTML(data, workItems, subtotal, tax, total) {
    const formatDate = (dateStr) => {
        if (!dateStr) return '';
        return new Date(dateStr).toLocaleDateString('ja-JP');
    };
    
    const hasBasicInfo = data.clientCompany;
    
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
            <div class="text-center mb-6">
                <h1 class="text-3xl font-bold text-gray-800 mb-2">請求書</h1>
                ${data.invoiceNumber ? `<div class="text-lg text-gray-600">No. ${data.invoiceNumber}</div>` : ''}
            </div>
            
            <!-- 請求先を最初に表示 -->
            ${data.clientCompany ? `
                <div class="mb-6">
                    <div class="text-right">
                        <div class="inline-block text-left border-b-2 border-gray-300 pb-2">
                            <div class="font-bold text-xl text-gray-800">${data.clientCompany}${data.clientCompany ? '　様' : ''}</div>
                            ${data.clientAddress ? `<div class="text-gray-600 text-sm mt-1 whitespace-pre-line">${data.clientAddress}</div>` : ''}
                        </div>
                    </div>
                </div>
            ` : ''}
            
            <!-- 発行日・支払期限 -->
            <div class="text-right mb-6">
                ${data.invoiceDate ? `<div class="text-gray-700 mb-1">発行日: ${formatDate(data.invoiceDate)}</div>` : ''}
                ${data.dueDate ? `<div class="text-gray-700 font-medium">支払期限: ${formatDate(data.dueDate)}</div>` : ''}
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
            <div class="flex justify-end mb-8">
                <div class="w-72">
                    <div class="border border-gray-300 bg-gray-50 p-4">
                        ${data.taxMode === 'inclusive' ? `
                            <div class="flex justify-between py-2 text-sm text-gray-600">
                                <span>（税込み金額から算出）</span>
                            </div>
                        ` : ''}
                        <div class="flex justify-between py-2">
                            <span>小計:</span>
                            <span class="font-medium">¥${subtotal.toLocaleString()}</span>
                        </div>
                        <div class="flex justify-between py-2">
                            <span>消費税 (${data.taxRate}%):</span>
                            <span class="font-medium">¥${tax.toLocaleString()}</span>
                        </div>
                        <div class="border-t border-gray-400 pt-2 mt-2">
                            <div class="flex justify-between text-lg font-semibold">
                                <span>合計:</span>
                                <span class="text-blue-600">¥${total.toLocaleString()}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- 発行者情報 -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
                <!-- 発行者 -->
                <div>
                    <h3 class="font-semibold text-gray-700 mb-3 pb-1 border-b">発行者</h3>
                    ${data.billerCompany ? `<div class="font-medium text-lg mb-2">${data.billerCompany}</div>` : ''}
                    ${data.invoiceRegistrationNumber ? `<div class="text-gray-700 mb-2">インボイス登録番号: ${data.invoiceRegistrationNumber}</div>` : ''}
                    ${data.billerAddress ? `<div class="text-gray-600 text-sm whitespace-pre-line">${data.billerAddress}</div>` : ''}
                </div>
                
                <!-- 振込先口座 -->
                ${(data.bankName || data.branchName || data.accountNumber || data.accountHolder) ? `
                    <div>
                        <h3 class="font-semibold text-gray-700 mb-3 pb-1 border-b">振込先</h3>
                        <div class="text-sm space-y-1">
                            ${data.bankName ? `<div><span class="text-gray-600">銀行名:</span> ${data.bankName}</div>` : ''}
                            ${data.branchName ? `<div><span class="text-gray-600">支店名:</span> ${data.branchName}</div>` : ''}
                            ${data.accountType && data.accountNumber ? `<div><span class="text-gray-600">口座:</span> ${data.accountType} ${data.accountNumber}</div>` : ''}
                            ${data.accountHolder ? `<div><span class="text-gray-600">名義:</span> ${data.accountHolder}</div>` : ''}
                        </div>
                    </div>
                ` : ''}
            </div>
        </div>
    `;
}

// PDF出力（ブラウザ印刷機能を使用）
function printInvoice() {
    // 必須項目のチェック
    const clientCompany = document.getElementById('clientCompany').value;
    const invoiceDate = document.getElementById('invoiceDate').value;
    
    if (!clientCompany || !invoiceDate) {
        alert('請求先会社名（お名前）、発行日は必須項目です。');
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

// データ保存機能
function saveFormData() {
    try {
        const formData = {
            // 基本情報
            billerCompany: document.getElementById('billerCompany').value,
            billerAddress: document.getElementById('billerAddress').value,
            invoiceRegistrationNumber: document.getElementById('invoiceRegistrationNumber').value,
            clientCompany: document.getElementById('clientCompany').value,
            clientAddress: document.getElementById('clientAddress').value,
            invoiceNumber: document.getElementById('invoiceNumber').value,
            invoiceDate: document.getElementById('invoiceDate').value,
            dueDate: document.getElementById('dueDate').value,
            taxRate: document.getElementById('taxRate').value,
            taxMode: document.getElementById('taxMode').value,
            
            // 振込先口座情報
            bankName: document.getElementById('bankName').value,
            branchName: document.getElementById('branchName').value,
            accountType: document.getElementById('accountType').value,
            accountNumber: document.getElementById('accountNumber').value,
            accountHolder: document.getElementById('accountHolder').value,
            
            // 作業項目
            workItems: []
        };
        
        // 作業項目データを取得
        const items = document.querySelectorAll('.work-item');
        items.forEach(item => {
            formData.workItems.push({
                date: item.querySelector('.work-date').value,
                description: item.querySelector('.work-description').value,
                hours: item.querySelector('.work-hours').value,
                rate: item.querySelector('.work-rate').value
            });
        });
        
        // ローカルストレージに保存
        localStorage.setItem('invoiceFormData', JSON.stringify(formData));
        
        // 保存完了メッセージ
        showSaveStatus('データを保存しました', 'success');
        
    } catch (error) {
        showSaveStatus('保存に失敗しました', 'error');
        console.error('Save error:', error);
    }
}

// データ読み込み機能
function loadFormData(showMessage = true) {
    try {
        const savedData = localStorage.getItem('invoiceFormData');
        if (!savedData) {
            if (showMessage) {
                showSaveStatus('保存されたデータがありません', 'info');
            }
            return;
        }
        
        const formData = JSON.parse(savedData);
        
        // 基本情報を復元
        document.getElementById('billerCompany').value = formData.billerCompany || '';
        document.getElementById('billerAddress').value = formData.billerAddress || '';
        document.getElementById('invoiceRegistrationNumber').value = formData.invoiceRegistrationNumber || '';
        document.getElementById('clientCompany').value = formData.clientCompany || '';
        document.getElementById('clientAddress').value = formData.clientAddress || '';
        document.getElementById('invoiceNumber').value = formData.invoiceNumber || '';
        document.getElementById('invoiceDate').value = formData.invoiceDate || '';
        document.getElementById('dueDate').value = formData.dueDate || '';
        document.getElementById('taxRate').value = formData.taxRate || '10';
        document.getElementById('taxMode').value = formData.taxMode || 'exclusive';
        
        // 振込先口座情報を復元
        document.getElementById('bankName').value = formData.bankName || '';
        document.getElementById('branchName').value = formData.branchName || '';
        document.getElementById('accountType').value = formData.accountType || '';
        document.getElementById('accountNumber').value = formData.accountNumber || '';
        document.getElementById('accountHolder').value = formData.accountHolder || '';
        
        // 既存の作業項目をクリア
        document.getElementById('workItems').innerHTML = '';
        workItemIndex = 0;
        
        // 作業項目を復元
        if (formData.workItems && formData.workItems.length > 0) {
            formData.workItems.forEach(itemData => {
                addWorkItem();
                const currentItem = document.querySelector(`[data-index="${workItemIndex - 1}"]`);
                if (currentItem) {
                    currentItem.querySelector('.work-date').value = itemData.date || '';
                    currentItem.querySelector('.work-description').value = itemData.description || '';
                    currentItem.querySelector('.work-hours').value = itemData.hours || '';
                    currentItem.querySelector('.work-rate').value = itemData.rate || '';
                }
            });
        } else {
            addWorkItem(); // 最低1つの項目は必要
        }
        
        // プレビュー更新
        updatePreview();
        
        if (showMessage) {
            showSaveStatus('データを読み込みました', 'success');
        }
        
    } catch (error) {
        if (showMessage) {
            showSaveStatus('読み込みに失敗しました', 'error');
        }
        console.error('Load error:', error);
    }
}

// データクリア機能
function clearFormData() {
    if (confirm('保存されたデータと入力内容をすべてクリアしますか？')) {
        try {
            // ローカルストレージから削除
            localStorage.removeItem('invoiceFormData');
            
            // フォームをリセット
            document.querySelectorAll('input, textarea, select').forEach(element => {
                if (element.type === 'date') {
                    element.value = new Date().toISOString().split('T')[0];
                } else if (element.id === 'taxRate') {
                    element.value = '10';
                } else if (element.id === 'taxMode') {
                    element.value = 'exclusive';
                } else if (element.id === 'accountType') {
                    element.value = '';
                } else {
                    element.value = '';
                }
            });
            
            // 作業項目をリセット
            document.getElementById('workItems').innerHTML = '';
            workItemIndex = 0;
            addWorkItem();
            
            // 請求書番号を再生成
            generateInvoiceNumber();
            
            // 支払期限を再計算
            calculateDueDate();
            
            // プレビュー更新
            updatePreview();
            
            showSaveStatus('データをクリアしました', 'success');
            
        } catch (error) {
            showSaveStatus('クリアに失敗しました', 'error');
            console.error('Clear error:', error);
        }
    }
}

// 保存ステータス表示
function showSaveStatus(message, type = 'info') {
    const statusElement = document.getElementById('saveStatus');
    statusElement.textContent = message;
    
    // スタイル設定
    statusElement.className = 'mt-2 text-sm';
    if (type === 'success') {
        statusElement.className += ' text-green-600';
    } else if (type === 'error') {
        statusElement.className += ' text-red-600';
    } else {
        statusElement.className += ' text-gray-600';
    }
    
    // 3秒後にメッセージを消去
    setTimeout(() => {
        statusElement.textContent = '';
    }, 3000);
}

// 初期化時に1回だけ実行
setTimeout(() => {
    updatePreview();
}, 100);