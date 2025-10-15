// 請求書自動作成システム - 個人事業主対応版

// グローバル変数
let workItemIndex = 0;
let transportItemIndex = 0;

// ページ読み込み時の初期化
document.addEventListener('DOMContentLoaded', function() {
    initializePage();
});

function initializePage() {
    // 請求先固定値設定
    document.getElementById('clientCompany').value = '株式会社EduSupport';
    document.getElementById('clientAddress').value = '東京都新宿区西新宿3-3-13 西新宿水間ビル6F';
    
    // 初期値設定
    document.getElementById('invoiceDate').value = new Date().toISOString().split('T')[0];
    
    // 支払期限を自動計算
    calculateDueDate();
    
    // 自動番号生成（任意）
    generateInvoiceNumber();
    
    // 初期作業項目を1つ追加
    addWorkItem();
    
    // 初期交通費項目を1つ追加
    addTransportItem();
    
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

// 支払期限の自動計算（作業項目最終日翌月末まで）
function calculateDueDate() {
    // 作業項目から最終日を取得
    const workItems = document.querySelectorAll('.work-item');
    let latestWorkDate = null;
    
    workItems.forEach(item => {
        const workDateStr = item.querySelector('.work-date').value;
        if (workDateStr) {
            const workDate = new Date(workDateStr);
            if (!latestWorkDate || workDate > latestWorkDate) {
                latestWorkDate = workDate;
            }
        }
    });
    
    // 作業日がない場合は発行日を使用
    if (!latestWorkDate) {
        const invoiceDate = document.getElementById('invoiceDate').value;
        if (invoiceDate) {
            latestWorkDate = new Date(invoiceDate);
        } else {
            return; // 発行日もない場合は何もしない
        }
    }
    
    // 最終作業日の翌月末日を計算
    const baseDate = new Date(latestWorkDate);
    baseDate.setMonth(baseDate.getMonth() + 1);
    // その月の末日を取得（0日は前月の末日）
    const nextMonth = new Date(baseDate.getFullYear(), baseDate.getMonth() + 1, 0);
    
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
            
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                <div>
                    <label class="block text-sm font-medium text-gray-600 mb-1">日付 *</label>
                    <input type="date" class="work-date w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500" 
                           value="${new Date().toISOString().split('T')[0]}" onchange="calculateDueDate(); updatePreview(); saveFormData()" required>
                </div>
                
                <div class="lg:col-span-1">
                    <label class="block text-sm font-medium text-gray-600 mb-1">作業内容 *</label>
                    <select class="work-description-select w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500" 
                            onchange="handleWorkDescriptionChange(${workItemIndex}); updatePreview(); saveFormData()" required>
                        <option value="">選択してください</option>
                        <option value="イベント">イベント</option>
                        <option value="研究会参加">研究会参加</option>
                        <option value="ミーティング参加">ミーティング参加</option>
                        <option value="アカウント作成＆送付">アカウント作成＆送付</option>
                        <option value="実験調査">実験調査</option>
                        <option value="チラシパンフレット作成">チラシパンフレット作成</option>
                        <option value="メルマガ">メルマガ</option>
                        <option value="ウェブ記事作成">ウェブ記事作成</option>
                        <option value="メールサポート">メールサポート</option>
                        <option value="電話サポート">電話サポート</option>
                        <option value="その他">その他</option>
                    </select>
                    <input type="text" class="work-description-other w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 mt-2" 
                           placeholder="具体的な作業内容を入力" onchange="updatePreview(); saveFormData()" style="display: none;">
                </div>
                
                <div>
                    <label class="block text-sm font-medium text-gray-600 mb-1">時間 *</label>
                    <input type="number" step="0.5" class="work-hours w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500" 
                           placeholder="8.0" onchange="calculateItemAmountWithGlobalRate(${workItemIndex}); updatePreview(); saveFormData()" required>
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
        calculateDueDate(); // 支払期限を再計算
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

// 作業内容の選択を処理
function handleWorkDescriptionChange(index) {
    const item = document.querySelector(`[data-index="${index}"]`);
    if (!item) return;
    
    const select = item.querySelector('.work-description-select');
    const otherInput = item.querySelector('.work-description-other');
    
    if (select.value === 'その他') {
        otherInput.style.display = 'block';
        otherInput.required = true;
    } else {
        otherInput.style.display = 'none';
        otherInput.required = false;
        otherInput.value = '';
    }
}

// グローバル時給を使用した個別項目の金額計算
function calculateItemAmountWithGlobalRate(index) {
    const item = document.querySelector(`[data-index="${index}"]`);
    if (!item) return;
    
    const hours = parseFloat(item.querySelector('.work-hours').value) || 0;
    const globalRate = parseFloat(document.getElementById('hourlyRate').value) || 0;
    const amount = hours * globalRate;
    
    item.querySelector('.item-amount').textContent = `¥${amount.toLocaleString()}`;
    
    calculateTotals();
}

// 個別項目の金額計算（互換性のため残存）
function calculateItemAmount(index) {
    calculateItemAmountWithGlobalRate(index);
}

// 全ての作業項目の金額を再計算
function updateAllItemAmounts() {
    const items = document.querySelectorAll('.work-item');
    items.forEach((item, index) => {
        const dataIndex = item.getAttribute('data-index');
        if (dataIndex !== null) {
            calculateItemAmountWithGlobalRate(parseInt(dataIndex));
        }
    });
}

// 合計金額計算（税込み・税抜き対応、交通費含む）
function calculateTotals() {
    // 作業代金の計算
    let workSubtotal = 0;
    const workItems = document.querySelectorAll('.work-item');
    const globalRate = parseFloat(document.getElementById('hourlyRate').value) || 0;
    
    workItems.forEach(item => {
        const hours = parseFloat(item.querySelector('.work-hours').value) || 0;
        workSubtotal += hours * globalRate;
    });
    
    // 交通費の計算
    let transportSubtotal = 0;
    const transportItems = document.querySelectorAll('.transport-item');
    
    transportItems.forEach(item => {
        const amount = parseFloat(item.querySelector('.transport-amount').value) || 0;
        transportSubtotal += amount;
    });
    
    // 小計合計
    const combinedSubtotal = workSubtotal + transportSubtotal;
    
    // 税計算（作業代金のみに適用）
    const taxRate = parseFloat(document.getElementById('taxRate').value) || 0;
    const taxMode = document.getElementById('taxMode').value;
    
    let displayWorkSubtotal, displayTax, displayTotal;
    
    if (taxMode === 'inclusive') {
        // 税込み計算：作業代金に税が含まれている
        displayWorkSubtotal = Math.round(workSubtotal / (1 + taxRate / 100));
        displayTax = workSubtotal - displayWorkSubtotal;
        displayTotal = workSubtotal + transportSubtotal;
    } else {
        // 税抜き計算：作業代金に税率をかける
        displayWorkSubtotal = workSubtotal;
        displayTax = Math.round(workSubtotal * (taxRate / 100));
        displayTotal = workSubtotal + displayTax + transportSubtotal;
    }
    
    // 表示更新
    document.getElementById('workSubtotalAmount').textContent = `¥${displayWorkSubtotal.toLocaleString()}`;
    document.getElementById('transportSubtotalAmount').textContent = `¥${transportSubtotal.toLocaleString()}`;
    document.getElementById('subtotalAmount').textContent = `¥${combinedSubtotal.toLocaleString()}`;
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
        bankType: document.getElementById('bankType').value,
        bankName: document.getElementById('bankName').value,
        branchName: document.getElementById('branchName').value,
        accountType: document.getElementById('accountType').value,
        accountNumber: document.getElementById('accountNumber').value,
        accountHolder: document.getElementById('accountHolder').value
    };
    
    // 作業項目を取得
    const workItems = [];
    const items = document.querySelectorAll('.work-item');
    let workSubtotal = 0;
    const globalRate = parseFloat(document.getElementById('hourlyRate').value) || 0;
    
    items.forEach(item => {
        const date = item.querySelector('.work-date').value;
        const select = item.querySelector('.work-description-select');
        const otherInput = item.querySelector('.work-description-other');
        let description = select.value;
        
        // 「その他」の場合は具体的な内容を使用
        if (description === 'その他' && otherInput.value) {
            description = otherInput.value;
        }
        
        const hours = parseFloat(item.querySelector('.work-hours').value) || 0;
        const amount = hours * globalRate;
        
        if (date || description || hours) {
            workItems.push({ date, description, hours, rate: globalRate, amount });
            workSubtotal += amount;
        }
    });
    
    // 交通費項目を取得
    const transportItems = [];
    const transportItemElements = document.querySelectorAll('.transport-item');
    let transportSubtotal = 0;
    
    transportItemElements.forEach(item => {
        const date = item.querySelector('.transport-date').value;
        const location = item.querySelector('.transport-location').value;
        const method = item.querySelector('.transport-method').value;
        const amount = parseFloat(item.querySelector('.transport-amount').value) || 0;
        const memo = item.querySelector('.transport-memo').value;
        
        if (date || location || method || amount) {
            transportItems.push({ date, location, method, amount, memo });
            transportSubtotal += amount;
        }
    });
    
    // 税計算（作業代金のみ）
    let displayWorkSubtotal, displayTax, displayTotal;
    
    if (data.taxMode === 'inclusive') {
        displayWorkSubtotal = Math.round(workSubtotal / (1 + data.taxRate / 100));
        displayTax = workSubtotal - displayWorkSubtotal;
        displayTotal = workSubtotal + transportSubtotal;
    } else {
        displayWorkSubtotal = workSubtotal;
        displayTax = Math.round(workSubtotal * (data.taxRate / 100));
        displayTotal = workSubtotal + displayTax + transportSubtotal;
    }
    
    // 合計金額を更新
    calculateTotals();
    
    // プレビューHTMLを生成
    const previewHtml = generateInvoiceHTML(data, workItems, transportItems, displayWorkSubtotal, displayTax, displayTotal, transportSubtotal);
    preview.innerHTML = previewHtml;
}

// 請求書HTMLの生成
function generateInvoiceHTML(data, workItems, transportItems, workSubtotal, tax, total, transportSubtotal) {
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
                <div class="mb-4">
                    <h3 class="text-sm font-semibold mb-2">作業項目</h3>
                    <table class="w-full border-collapse border border-gray-300 text-xs mb-3">
                        <thead>
                            <tr class="bg-gray-50">
                                <th class="border border-gray-300 px-2 py-1 text-left">日付</th>
                                <th class="border border-gray-300 px-2 py-1 text-left">作業内容</th>
                                <th class="border border-gray-300 px-2 py-1 text-right">時間</th>
                                <th class="border border-gray-300 px-2 py-1 text-right">時給</th>
                                <th class="border border-gray-300 px-2 py-1 text-right">金額</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${workItems.map(item => `
                                <tr>
                                    <td class="border border-gray-300 px-2 py-1">${formatDate(item.date)}</td>
                                    <td class="border border-gray-300 px-2 py-1">${item.description}</td>
                                    <td class="border border-gray-300 px-2 py-1 text-right">${item.hours ? item.hours + 'h' : ''}</td>
                                    <td class="border border-gray-300 px-2 py-1 text-right">${item.rate ? '¥' + item.rate.toLocaleString() : ''}</td>
                                    <td class="border border-gray-300 px-2 py-1 text-right font-medium">${item.amount ? '¥' + item.amount.toLocaleString() : ''}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            ` : ''}
            
            <!-- 交通費テーブル -->
            ${transportItems.length > 0 ? `
                <div class="mb-4">
                    <h3 class="text-sm font-semibold mb-2">交通費</h3>
                    <table class="w-full border-collapse border border-gray-300 text-xs mb-3">
                        <thead>
                            <tr class="bg-gray-50">
                                <th class="border border-gray-300 px-2 py-1 text-left">日付</th>
                                <th class="border border-gray-300 px-2 py-1 text-left">場所</th>
                                <th class="border border-gray-300 px-2 py-1 text-left">交通手段</th>
                                <th class="border border-gray-300 px-2 py-1 text-right">金額</th>
                                <th class="border border-gray-300 px-2 py-1 text-left">メモ</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${transportItems.map(item => `
                                <tr>
                                    <td class="border border-gray-300 px-2 py-1">${formatDate(item.date)}</td>
                                    <td class="border border-gray-300 px-2 py-1">${item.location}</td>
                                    <td class="border border-gray-300 px-2 py-1">${item.method}</td>
                                    <td class="border border-gray-300 px-2 py-1 text-right font-medium">${item.amount ? '¥' + item.amount.toLocaleString() : ''}</td>
                                    <td class="border border-gray-300 px-2 py-1">${item.memo}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            ` : ''}
            
            <!-- 合計 -->
            <div class="flex justify-end mb-4">
                <div class="w-64">
                    <div class="border border-gray-300 bg-gray-50 p-3 text-sm">
                        ${data.taxMode === 'inclusive' ? `
                            <div class="flex justify-between py-1 text-xs text-gray-600">
                                <span>（税込み金額から算出）</span>
                            </div>
                        ` : ''}
                        <div class="flex justify-between py-1">
                            <span>作業代金:</span>
                            <span class="font-medium">¥${workSubtotal.toLocaleString()}</span>
                        </div>
                        <div class="flex justify-between py-1">
                            <span>交通費:</span>
                            <span class="font-medium">¥${transportSubtotal.toLocaleString()}</span>
                        </div>
                        <div class="flex justify-between py-1">
                            <span>消費税 (${data.taxRate}%):</span>
                            <span class="font-medium">¥${tax.toLocaleString()}</span>
                        </div>
                        <div class="border-t border-gray-400 pt-1 mt-1">
                            <div class="flex justify-between font-semibold">
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
                        <div class="text-sm space-y-1 mb-3">
                            ${data.bankType && data.bankName ? `<div><span class="text-gray-600">${data.bankType}:</span> ${data.bankName}</div>` : 
                              data.bankName ? `<div><span class="text-gray-600">金融機関:</span> ${data.bankName}</div>` : ''}
                            ${data.branchName ? `<div><span class="text-gray-600">支店名:</span> ${data.branchName}</div>` : ''}
                            ${data.accountType && data.accountNumber ? `<div><span class="text-gray-600">口座:</span> ${data.accountType} ${data.accountNumber}</div>` : ''}
                            ${data.accountHolder ? `<div><span class="text-gray-600">名義:</span> ${data.accountHolder}</div>` : ''}
                        </div>
                        <div class="text-xs text-gray-600 bg-yellow-50 border border-yellow-200 rounded p-2">
                            <i class="fas fa-info-circle mr-1"></i>振込手数料はご負担願います
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
    const invoiceDate = document.getElementById('invoiceDate').value;
    
    if (!invoiceDate) {
        alert('発行日は必須項目です。');
        return;
    }
    
    // 作業項目と交通費のチェック
    const workItems = document.querySelectorAll('.work-item');
    const transportItems = document.querySelectorAll('.transport-item');
    const globalRate = parseFloat(document.getElementById('hourlyRate').value) || 0;
    let hasValidWorkItems = false;
    let hasValidTransportItems = false;
    
    // 作業項目の確認
    workItems.forEach(item => {
        const hours = parseFloat(item.querySelector('.work-hours').value) || 0;
        const select = item.querySelector('.work-description-select');
        const otherInput = item.querySelector('.work-description-other');
        let description = select.value;
        
        if (description === 'その他' && otherInput.value) {
            description = otherInput.value;
        }
        
        if (hours > 0 && globalRate > 0 && description) {
            hasValidWorkItems = true;
        }
    });
    
    // 交通費項目の確認
    transportItems.forEach(item => {
        const amount = parseFloat(item.querySelector('.transport-amount').value) || 0;
        const location = item.querySelector('.transport-location').value;
        const method = item.querySelector('.transport-method').value;
        
        if (amount > 0 && location && method) {
            hasValidTransportItems = true;
        }
    });
    
    // 作業項目か交通費のどちらかは必須
    if (!hasValidWorkItems && !hasValidTransportItems) {
        alert('作業項目または交通費のいずれかを入力してください。\n\n【作業項目】時間・作業内容・時給\n【交通費】場所・交通手段・金額');
        return;
    }
    
    // 作業項目がある場合は時給必須
    if (hasValidWorkItems && globalRate <= 0) {
        alert('作業項目を入力する場合は時給を設定してください。');
        return;
    }
    
    // 印刷実行
    window.print();
}

// データ保存機能
function saveFormData() {
    try {
        const formData = {
            // 基本情報（請求先は固定のため保存しない）
            billerCompany: document.getElementById('billerCompany').value,
            billerAddress: document.getElementById('billerAddress').value,
            invoiceRegistrationNumber: document.getElementById('invoiceRegistrationNumber').value,
            invoiceNumber: document.getElementById('invoiceNumber').value,
            invoiceDate: document.getElementById('invoiceDate').value,
            dueDate: document.getElementById('dueDate').value,
            taxRate: document.getElementById('taxRate').value,
            taxMode: document.getElementById('taxMode').value,
            
            // 基本設定
            hourlyRate: document.getElementById('hourlyRate').value,
            
            // 振込先口座情報
            bankType: document.getElementById('bankType').value,
            bankName: document.getElementById('bankName').value,
            branchName: document.getElementById('branchName').value,
            accountType: document.getElementById('accountType').value,
            accountNumber: document.getElementById('accountNumber').value,
            accountHolder: document.getElementById('accountHolder').value,
            
            // 個人識別
            userIdentifier: document.getElementById('userIdentifier').value,
            
            // 作業項目
            workItems: [],
            
            // 交通費
            transportItems: []
        };
        
        // 作業項目データを取得
        const items = document.querySelectorAll('.work-item');
        items.forEach(item => {
            const select = item.querySelector('.work-description-select');
            const otherInput = item.querySelector('.work-description-other');
            let description = select.value;
            if (description === 'その他' && otherInput.value) {
                description = otherInput.value;
            }
            
            formData.workItems.push({
                date: item.querySelector('.work-date').value,
                descriptionSelect: select.value,
                descriptionOther: otherInput.value,
                description: description,
                hours: item.querySelector('.work-hours').value
            });
        });
        
        // 交通費データを取得
        const transportItems = document.querySelectorAll('.transport-item');
        transportItems.forEach(item => {
            formData.transportItems.push({
                date: item.querySelector('.transport-date').value,
                location: item.querySelector('.transport-location').value,
                method: item.querySelector('.transport-method').value,
                amount: item.querySelector('.transport-amount').value,
                memo: item.querySelector('.transport-memo').value
            });
        });
        
        // ユーザー識別子に基づいてローカルストレージに保存
        const userIdentifier = formData.userIdentifier || 'default';
        const storageKey = `invoiceFormData_${userIdentifier}`;
        localStorage.setItem(storageKey, JSON.stringify(formData));
        
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
        // ユーザー識別子を取得
        const userIdentifier = document.getElementById('userIdentifier').value || 'default';
        const storageKey = `invoiceFormData_${userIdentifier}`;
        const savedData = localStorage.getItem(storageKey);
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
        
        // 請求先は固定値を再設定
        document.getElementById('clientCompany').value = '株式会社EduSupport';
        document.getElementById('clientAddress').value = '東京都新宿区西新宿3-3-13 西新宿水間ビル6F';
        
        document.getElementById('invoiceNumber').value = formData.invoiceNumber || '';
        document.getElementById('invoiceDate').value = formData.invoiceDate || '';
        document.getElementById('dueDate').value = formData.dueDate || '';
        document.getElementById('taxRate').value = formData.taxRate || '10';
        document.getElementById('taxMode').value = formData.taxMode || 'exclusive';
        
        // 基本設定を復元
        document.getElementById('hourlyRate').value = formData.hourlyRate || '';
        
        // 個人識別を復元
        document.getElementById('userIdentifier').value = formData.userIdentifier || '';
        
        // 振込先口座情報を復元
        document.getElementById('bankType').value = formData.bankType || '';
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
                    
                    // 作業内容の復元
                    const select = currentItem.querySelector('.work-description-select');
                    const otherInput = currentItem.querySelector('.work-description-other');
                    select.value = itemData.descriptionSelect || '';
                    otherInput.value = itemData.descriptionOther || '';
                    
                    // 「その他」の表示切替
                    if (select.value === 'その他') {
                        otherInput.style.display = 'block';
                        otherInput.required = true;
                    } else {
                        otherInput.style.display = 'none';
                        otherInput.required = false;
                    }
                    
                    currentItem.querySelector('.work-hours').value = itemData.hours || '';
                    
                    // 金額を再計算
                    calculateItemAmountWithGlobalRate(workItemIndex - 1);
                }
            });
        } else {
            addWorkItem(); // 最低1つの項目は必要
        }
        
        // 既存の交通費項目をクリア
        document.getElementById('transportItems').innerHTML = '';
        transportItemIndex = 0;
        
        // 交通費を復元
        if (formData.transportItems && formData.transportItems.length > 0) {
            formData.transportItems.forEach(itemData => {
                addTransportItem();
                const currentItem = document.querySelector(`[data-index="${transportItemIndex - 1}"].transport-item`);
                if (currentItem) {
                    currentItem.querySelector('.transport-date').value = itemData.date || '';
                    currentItem.querySelector('.transport-location').value = itemData.location || '';
                    currentItem.querySelector('.transport-method').value = itemData.method || '';
                    currentItem.querySelector('.transport-amount').value = itemData.amount || '';
                    currentItem.querySelector('.transport-memo').value = itemData.memo || '';
                }
            });
        } else {
            addTransportItem(); // 最低1つの項目は必要
        }
        
        // 交通費合計を再計算
        calculateTransportTotals();
        
        // 支払期限を再計算
        calculateDueDate();
        
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
            // ユーザー識別子に基づいてローカルストレージから削除
            const userIdentifier = document.getElementById('userIdentifier').value || 'default';
            const storageKey = `invoiceFormData_${userIdentifier}`;
            localStorage.removeItem(storageKey);
            
            // フォームをリセット
            document.querySelectorAll('input, textarea, select').forEach(element => {
                if (element.type === 'date') {
                    element.value = new Date().toISOString().split('T')[0];
                } else if (element.id === 'taxRate') {
                    element.value = '10';
                } else if (element.id === 'taxMode') {
                    element.value = 'exclusive';
                } else if (element.id === 'accountType' || element.id === 'bankType') {
                    element.value = '';
                } else {
                    element.value = '';
                }
            });
            
            // 作業項目をリセット
            document.getElementById('workItems').innerHTML = '';
            workItemIndex = 0;
            addWorkItem();
            
            // 交通費をリセット
            document.getElementById('transportItems').innerHTML = '';
            transportItemIndex = 0;
            addTransportItem();
            
            // 請求先固定値を再設定
            document.getElementById('clientCompany').value = '株式会社EduSupport';
            document.getElementById('clientAddress').value = '東京都新宿区西新宿3-3-13 西新宿水間ビル6F';
            
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

// 交通費項目を追加
function addTransportItem() {
    const container = document.getElementById('transportItems');
    const itemHtml = `
        <div class="transport-item bg-green-50 p-4 rounded-lg border border-green-200" data-index="${transportItemIndex}">
            <div class="flex justify-between items-center mb-3">
                <h4 class="font-medium text-gray-700">交通費 ${transportItemIndex + 1}</h4>
                <button onclick="removeTransportItem(${transportItemIndex})" class="text-red-600 hover:text-red-800 text-sm">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
            
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                <div>
                    <label class="block text-sm font-medium text-gray-600 mb-1">日付 *</label>
                    <input type="date" class="transport-date w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-green-500" 
                           value="${new Date().toISOString().split('T')[0]}" onchange="updatePreview(); saveFormData()" required>
                </div>
                
                <div>
                    <label class="block text-sm font-medium text-gray-600 mb-1">場所 *</label>
                    <input type="text" class="transport-location w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-green-500" 
                           placeholder="東京駅→大阪駅" onchange="updatePreview(); saveFormData()" required>
                </div>
                
                <div>
                    <label class="block text-sm font-medium text-gray-600 mb-1">交通手段 *</label>
                    <select class="transport-method w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-green-500" 
                            onchange="updatePreview(); saveFormData()" required>
                        <option value="">選択してください</option>
                        <option value="電車">電車</option>
                        <option value="新幹線">新幹線</option>
                        <option value="バス">バス</option>
                        <option value="タクシー">タクシー</option>
                        <option value="自家用車">自家用車</option>
                        <option value="航空機">航空機</option>
                        <option value="地下鉄">地下鉄</option>
                        <option value="その他">その他</option>
                    </select>
                </div>
                
                <div>
                    <label class="block text-sm font-medium text-gray-600 mb-1">金額 *</label>
                    <input type="number" class="transport-amount w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-green-500" 
                           placeholder="1000" onchange="calculateTransportTotals(); updatePreview(); saveFormData()" required>
                </div>
            </div>
            
            <div class="mt-3">
                <label class="block text-sm font-medium text-gray-600 mb-1">メモ</label>
                <input type="text" class="transport-memo w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-green-500" 
                       placeholder="会議参加のため、往復" onchange="updatePreview(); saveFormData()">
            </div>
        </div>
    `;
    
    container.insertAdjacentHTML('beforeend', itemHtml);
    transportItemIndex++;
    updateTransportItemNumbers();
}

// 交通費項目を削除
function removeTransportItem(index) {
    const item = document.querySelector(`[data-index="${index}"].transport-item`);
    if (item) {
        item.remove();
        updateTransportItemNumbers();
        calculateTransportTotals();
        updatePreview();
        saveFormData();
    }
}

// 交通費項目番号を更新
function updateTransportItemNumbers() {
    const items = document.querySelectorAll('.transport-item');
    items.forEach((item, index) => {
        item.querySelector('h4').textContent = `交通費 ${index + 1}`;
    });
}

// 交通費合計計算
function calculateTransportTotals() {
    let transportTotal = 0;
    const items = document.querySelectorAll('.transport-item');
    
    items.forEach(item => {
        const amount = parseFloat(item.querySelector('.transport-amount').value) || 0;
        transportTotal += amount;
    });
    
    document.getElementById('transportSubtotalAmount').textContent = `¥${transportTotal.toLocaleString()}`;
    
    // 全体の計算を更新
    calculateTotals();
}

// 初期化時に1回だけ実行
setTimeout(() => {
    updatePreview();
}, 100);