// 請求書自動作成システム - フロントエンド JavaScript

class InvoiceApp {
    constructor() {
        this.currentInvoice = null;
        this.currentItems = [];
        this.init();
    }

    init() {
        this.bindEvents();
        this.loadInvoiceList();
    }

    bindEvents() {
        // ナビゲーション
        document.getElementById('showCreateForm')?.addEventListener('click', () => {
            this.showCreateForm();
        });

        document.getElementById('showInvoiceList')?.addEventListener('click', () => {
            this.showInvoiceList();
        });

        // モーダル閉じる
        document.getElementById('modal')?.addEventListener('click', (e) => {
            if (e.target.id === 'modal') {
                this.closeModal();
            }
        });
    }

    async showCreateForm() {
        const content = `
            <div class="modal-header">
                <h3 class="text-lg font-semibold">新規請求書作成</h3>
                <button onclick="app.closeModal()" class="text-gray-400 hover:text-gray-600">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="modal-body">
                ${this.getInvoiceForm()}
            </div>
        `;
        this.showModal(content);
        this.initInvoiceForm();
    }

    async showInvoiceList() {
        try {
            const response = await axios.get('/api/invoices');
            const invoices = response.data.invoices;

            const content = `
                <div class="modal-header">
                    <h3 class="text-lg font-semibold">請求書一覧</h3>
                    <button onclick="app.closeModal()" class="text-gray-400 hover:text-gray-600">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <div class="overflow-x-auto">
                        <table class="invoice-table">
                            <thead>
                                <tr>
                                    <th>請求書番号</th>
                                    <th>顧客名</th>
                                    <th>請求日</th>
                                    <th>金額</th>
                                    <th>操作</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${invoices.map(invoice => `
                                    <tr>
                                        <td>${invoice.invoice_number}</td>
                                        <td>${invoice.client_name}</td>
                                        <td>${new Date(invoice.invoice_date).toLocaleDateString('ja-JP')}</td>
                                        <td class="text-right">¥${Number(invoice.total_amount).toLocaleString()}</td>
                                        <td>
                                            <div class="flex space-x-2">
                                                <button onclick="app.viewInvoice(${invoice.id})" class="text-blue-600 hover:text-blue-800">
                                                    <i class="fas fa-eye"></i>
                                                </button>
                                                <button onclick="app.editInvoice(${invoice.id})" class="text-green-600 hover:text-green-800">
                                                    <i class="fas fa-edit"></i>
                                                </button>
                                                <button onclick="app.deleteInvoice(${invoice.id})" class="text-red-600 hover:text-red-800">
                                                    <i class="fas fa-trash"></i>
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            `;
            this.showModal(content);
        } catch (error) {
            console.error('Error loading invoices:', error);
            this.showAlert('請求書の読み込みに失敗しました', 'error');
        }
    }

    async viewInvoice(id) {
        try {
            const response = await axios.get(`/api/invoices/${id}`);
            const { invoice, items } = response.data;

            const content = `
                <div class="modal-header">
                    <h3 class="text-lg font-semibold">請求書詳細 - ${invoice.invoice_number}</h3>
                    <button onclick="app.closeModal()" class="text-gray-400 hover:text-gray-600">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    ${this.getInvoicePreview(invoice, items)}
                    <div class="mt-6 flex space-x-3">
                        <button onclick="app.downloadPDF(${id})" class="btn-primary">
                            <i class="fas fa-download mr-2"></i>PDF ダウンロード
                        </button>
                        <button onclick="app.editInvoice(${id})" class="btn-secondary">
                            <i class="fas fa-edit mr-2"></i>編集
                        </button>
                    </div>
                </div>
            `;
            this.showModal(content);
        } catch (error) {
            console.error('Error loading invoice:', error);
            this.showAlert('請求書の読み込みに失敗しました', 'error');
        }
    }

    async editInvoice(id) {
        try {
            const response = await axios.get(`/api/invoices/${id}`);
            const { invoice, items } = response.data;

            this.currentInvoice = invoice;
            this.currentItems = items;

            const content = `
                <div class="modal-header">
                    <h3 class="text-lg font-semibold">請求書編集 - ${invoice.invoice_number}</h3>
                    <button onclick="app.closeModal()" class="text-gray-400 hover:text-gray-600">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    ${this.getInvoiceForm(true)}
                </div>
            `;
            this.showModal(content);
            this.initInvoiceForm(true);
        } catch (error) {
            console.error('Error loading invoice for edit:', error);
            this.showAlert('請求書の読み込みに失敗しました', 'error');
        }
    }

    async deleteInvoice(id) {
        if (!confirm('この請求書を削除してもよろしいですか？')) {
            return;
        }

        try {
            await axios.delete(`/api/invoices/${id}`);
            this.showAlert('請求書を削除しました', 'success');
            this.showInvoiceList(); // リストを再読み込み
        } catch (error) {
            console.error('Error deleting invoice:', error);
            this.showAlert('請求書の削除に失敗しました', 'error');
        }
    }

    getInvoiceForm(isEdit = false) {
        const invoice = this.currentInvoice || {};
        const items = this.currentItems || [];

        return `
            <form id="invoiceForm">
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <!-- 基本情報 -->
                    <div>
                        <h4 class="font-semibold mb-4">基本情報</h4>
                        
                        <div class="invoice-form-group">
                            <label class="invoice-form-label">顧客名 *</label>
                            <input type="text" name="client_name" value="${invoice.client_name || ''}" 
                                   class="invoice-form-input" required>
                        </div>
                        
                        <div class="invoice-form-group">
                            <label class="invoice-form-label">顧客住所</label>
                            <textarea name="client_address" rows="3" 
                                      class="invoice-form-textarea">${invoice.client_address || ''}</textarea>
                        </div>
                        
                        <div class="invoice-form-group">
                            <label class="invoice-form-label">請求日 *</label>
                            <input type="date" name="invoice_date" 
                                   value="${invoice.invoice_date || new Date().toISOString().split('T')[0]}" 
                                   class="invoice-form-input" required>
                        </div>
                        
                        <div class="invoice-form-group">
                            <label class="invoice-form-label">支払期日</label>
                            <input type="date" name="due_date" 
                                   value="${invoice.due_date || ''}" 
                                   class="invoice-form-input">
                        </div>
                        
                        <div class="invoice-form-group">
                            <label class="invoice-form-label">税率 (%)</label>
                            <input type="number" name="tax_rate" step="0.01" 
                                   value="${(invoice.tax_rate || 0.10) * 100}" 
                                   class="invoice-form-input">
                        </div>
                        
                        <div class="invoice-form-group">
                            <label class="invoice-form-label">備考</label>
                            <textarea name="notes" rows="3" 
                                      class="invoice-form-textarea">${invoice.notes || ''}</textarea>
                        </div>
                    </div>
                    
                    <!-- 作業項目 -->
                    <div>
                        <div class="flex justify-between items-center mb-4">
                            <h4 class="font-semibold">作業項目</h4>
                            <button type="button" onclick="app.addWorkItem()" class="btn-primary">
                                <i class="fas fa-plus mr-2"></i>項目追加
                            </button>
                        </div>
                        
                        <div id="workItems">
                            ${items.map((item, index) => this.getWorkItemHTML(item, index)).join('')}
                        </div>
                        
                        <!-- 合計表示 -->
                        <div class="invoice-summary mt-6">
                            <div class="flex justify-between mb-2">
                                <span>小計:</span>
                                <span id="subtotal">¥0</span>
                            </div>
                            <div class="flex justify-between mb-2">
                                <span>消費税:</span>
                                <span id="tax">¥0</span>
                            </div>
                            <div class="flex justify-between font-semibold text-lg">
                                <span>合計:</span>
                                <span id="total">¥0</span>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="modal-footer">
                    <button type="button" onclick="app.closeModal()" class="btn-secondary">
                        キャンセル
                    </button>
                    <button type="submit" class="btn-success">
                        <i class="fas fa-save mr-2"></i>${isEdit ? '更新' : '作成'}
                    </button>
                </div>
            </form>
        `;
    }

    getWorkItemHTML(item = {}, index = 0) {
        return `
            <div class="work-item border border-gray-300 rounded-lg p-4 mb-4" data-index="${index}">
                <div class="flex justify-between items-start mb-3">
                    <h5 class="font-medium">作業項目 ${index + 1}</h5>
                    <button type="button" onclick="app.removeWorkItem(${index})" class="text-red-600 hover:text-red-800">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
                
                <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                        <label class="invoice-form-label">作業日 *</label>
                        <input type="date" name="work_date_${index}" 
                               value="${item.work_date || ''}" 
                               class="invoice-form-input" required>
                    </div>
                    
                    <div>
                        <label class="invoice-form-label">作業内容 *</label>
                        <input type="text" name="description_${index}" 
                               value="${item.description || ''}" 
                               class="invoice-form-input" required 
                               placeholder="例: ウェブサイト開発">
                    </div>
                    
                    <div>
                        <label class="invoice-form-label">時間 *</label>
                        <input type="number" name="hours_${index}" step="0.5" 
                               value="${item.hours || ''}" 
                               class="invoice-form-input work-hours" required 
                               onchange="app.calculateAmount(${index})" 
                               placeholder="例: 8.0">
                    </div>
                    
                    <div>
                        <label class="invoice-form-label">時給 *</label>
                        <input type="number" name="hourly_rate_${index}" 
                               value="${item.hourly_rate || ''}" 
                               class="invoice-form-input work-rate" required 
                               onchange="app.calculateAmount(${index})" 
                               placeholder="例: 5000">
                    </div>
                </div>
                
                <div class="mt-3">
                    <div class="flex justify-between items-center">
                        <span class="font-medium">金額:</span>
                        <span class="item-amount text-lg font-semibold">¥${item.amount ? Number(item.amount).toLocaleString() : '0'}</span>
                    </div>
                </div>
            </div>
        `;
    }

    getInvoicePreview(invoice, items) {
        const subtotal = items.reduce((sum, item) => sum + Number(item.amount), 0);
        const tax = subtotal * Number(invoice.tax_rate);
        const total = subtotal + tax;

        return `
            <div class="invoice-preview">
                <div class="invoice-header">
                    <div class="invoice-title">請求書</div>
                    <div class="text-right">
                        <div class="text-lg font-semibold">${invoice.invoice_number}</div>
                        <div class="text-gray-600">${new Date(invoice.invoice_date).toLocaleDateString('ja-JP')}</div>
                    </div>
                </div>
                
                <div class="invoice-details">
                    <div>
                        <h5 class="font-semibold mb-2">請求先</h5>
                        <div class="text-lg font-medium">${invoice.client_name}</div>
                        ${invoice.client_address ? `<div class="text-gray-600 whitespace-pre-line">${invoice.client_address}</div>` : ''}
                    </div>
                    
                    <div>
                        <h5 class="font-semibold mb-2">請求情報</h5>
                        <div class="grid grid-cols-2 gap-2 text-sm">
                            <div>請求日:</div>
                            <div>${new Date(invoice.invoice_date).toLocaleDateString('ja-JP')}</div>
                            ${invoice.due_date ? `
                                <div>支払期日:</div>
                                <div>${new Date(invoice.due_date).toLocaleDateString('ja-JP')}</div>
                            ` : ''}
                        </div>
                    </div>
                </div>
                
                <table class="invoice-items-table">
                    <thead>
                        <tr>
                            <th>作業日</th>
                            <th>作業内容</th>
                            <th class="text-right">時間</th>
                            <th class="text-right">時給</th>
                            <th class="text-right">金額</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${items.map(item => `
                            <tr>
                                <td>${new Date(item.work_date).toLocaleDateString('ja-JP')}</td>
                                <td>${item.description}</td>
                                <td class="text-right">${Number(item.hours).toFixed(1)}h</td>
                                <td class="text-right">¥${Number(item.hourly_rate).toLocaleString()}</td>
                                <td class="text-right">¥${Number(item.amount).toLocaleString()}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                
                <div class="invoice-total">
                    <table class="w-full">
                        <tr>
                            <td class="text-right py-1">小計:</td>
                            <td class="text-right py-1 font-medium">¥${subtotal.toLocaleString()}</td>
                        </tr>
                        <tr>
                            <td class="text-right py-1">消費税 (${(invoice.tax_rate * 100).toFixed(1)}%):</td>
                            <td class="text-right py-1 font-medium">¥${tax.toLocaleString()}</td>
                        </tr>
                        <tr class="border-t border-gray-300">
                            <td class="text-right py-2 text-lg font-semibold">合計:</td>
                            <td class="text-right py-2 text-lg font-semibold">¥${total.toLocaleString()}</td>
                        </tr>
                    </table>
                </div>
                
                ${invoice.notes ? `
                    <div class="mt-6">
                        <h5 class="font-semibold mb-2">備考</h5>
                        <div class="text-gray-700 whitespace-pre-line">${invoice.notes}</div>
                    </div>
                ` : ''}
            </div>
        `;
    }

    initInvoiceForm(isEdit = false) {
        const form = document.getElementById('invoiceForm');
        if (!form) return;

        // 初期項目がない場合は1つ追加
        if (document.querySelectorAll('.work-item').length === 0) {
            this.addWorkItem();
        }

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.saveInvoice(isEdit);
        });

        // 初期計算
        this.calculateTotals();
    }

    addWorkItem() {
        const container = document.getElementById('workItems');
        const index = container.children.length;
        const itemHTML = this.getWorkItemHTML({}, index);
        
        const div = document.createElement('div');
        div.innerHTML = itemHTML;
        container.appendChild(div.firstElementChild);
        
        this.updateItemIndices();
        this.calculateTotals();
    }

    removeWorkItem(index) {
        const item = document.querySelector(`[data-index="${index}"]`);
        if (item) {
            item.remove();
            this.updateItemIndices();
            this.calculateTotals();
        }
    }

    updateItemIndices() {
        const items = document.querySelectorAll('.work-item');
        items.forEach((item, index) => {
            item.dataset.index = index;
            item.querySelector('h5').textContent = `作業項目 ${index + 1}`;
            
            // input name属性を更新
            ['work_date', 'description', 'hours', 'hourly_rate'].forEach(field => {
                const input = item.querySelector(`[name^="${field}_"]`);
                if (input) {
                    input.name = `${field}_${index}`;
                    if (field === 'hours' || field === 'hourly_rate') {
                        input.onchange = () => this.calculateAmount(index);
                    }
                }
            });
            
            // 削除ボタンを更新
            const deleteBtn = item.querySelector('button[onclick*="removeWorkItem"]');
            if (deleteBtn) {
                deleteBtn.onclick = () => this.removeWorkItem(index);
            }
        });
    }

    calculateAmount(index) {
        const hoursInput = document.querySelector(`[name="hours_${index}"]`);
        const rateInput = document.querySelector(`[name="hourly_rate_${index}"]`);
        const amountSpan = document.querySelector(`[data-index="${index}"] .item-amount`);
        
        if (hoursInput && rateInput && amountSpan) {
            const hours = parseFloat(hoursInput.value) || 0;
            const rate = parseFloat(rateInput.value) || 0;
            const amount = hours * rate;
            
            amountSpan.textContent = `¥${amount.toLocaleString()}`;
        }
        
        this.calculateTotals();
    }

    calculateTotals() {
        const items = document.querySelectorAll('.work-item');
        let subtotal = 0;
        
        items.forEach((item, index) => {
            const hoursInput = item.querySelector(`[name="hours_${index}"]`);
            const rateInput = item.querySelector(`[name="hourly_rate_${index}"]`);
            
            if (hoursInput && rateInput) {
                const hours = parseFloat(hoursInput.value) || 0;
                const rate = parseFloat(rateInput.value) || 0;
                subtotal += hours * rate;
            }
        });
        
        const taxRateInput = document.querySelector('[name="tax_rate"]');
        const taxRate = taxRateInput ? (parseFloat(taxRateInput.value) || 10) / 100 : 0.10;
        const tax = subtotal * taxRate;
        const total = subtotal + tax;
        
        document.getElementById('subtotal').textContent = `¥${subtotal.toLocaleString()}`;
        document.getElementById('tax').textContent = `¥${Math.round(tax).toLocaleString()}`;
        document.getElementById('total').textContent = `¥${Math.round(total).toLocaleString()}`;
    }

    async saveInvoice(isEdit = false) {
        const form = document.getElementById('invoiceForm');
        const formData = new FormData(form);
        
        // 基本情報
        const invoice = {
            client_name: formData.get('client_name'),
            client_address: formData.get('client_address'),
            invoice_date: formData.get('invoice_date'),
            due_date: formData.get('due_date'),
            tax_rate: parseFloat(formData.get('tax_rate')) / 100,
            notes: formData.get('notes')
        };
        
        // 作業項目
        const items = [];
        const itemCount = document.querySelectorAll('.work-item').length;
        
        for (let i = 0; i < itemCount; i++) {
            const workDate = formData.get(`work_date_${i}`);
            const description = formData.get(`description_${i}`);
            const hours = parseFloat(formData.get(`hours_${i}`));
            const hourlyRate = parseFloat(formData.get(`hourly_rate_${i}`));
            
            if (workDate && description && hours && hourlyRate) {
                items.push({
                    work_date: workDate,
                    description: description,
                    hours: hours,
                    hourly_rate: hourlyRate
                });
            }
        }
        
        if (items.length === 0) {
            this.showAlert('作業項目を少なくとも1つ入力してください', 'error');
            return;
        }
        
        try {
            const url = isEdit ? `/api/invoices/${this.currentInvoice.id}` : '/api/invoices';
            const method = isEdit ? 'PUT' : 'POST';
            
            const response = await axios({
                method: method,
                url: url,
                data: { invoice, items }
            });
            
            this.showAlert(
                isEdit ? '請求書を更新しました' : '請求書を作成しました', 
                'success'
            );
            this.closeModal();
            
            if (!isEdit) {
                // 作成後は詳細を表示
                setTimeout(() => {
                    this.showInvoiceList();
                }, 1000);
            }
        } catch (error) {
            console.error('Error saving invoice:', error);
            this.showAlert('請求書の保存に失敗しました', 'error');
        }
    }

    async downloadPDF(id) {
        try {
            const response = await axios.get(`/api/invoices/${id}`);
            const { invoice, items } = response.data;
            
            // jsPDFを使用してPDF生成
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();
            
            // PDFのコンテンツを生成
            this.generatePDF(doc, invoice, items);
            
            // PDFダウンロード
            doc.save(`${invoice.invoice_number}.pdf`);
        } catch (error) {
            console.error('Error generating PDF:', error);
            this.showAlert('PDF生成に失敗しました', 'error');
        }
    }

    generatePDF(doc, invoice, items) {
        // 日本語フォントサポートのため基本フォントを使用
        doc.setFont('helvetica');
        
        // ヘッダー
        doc.setFontSize(24);
        doc.text('請求書', 20, 30);
        
        doc.setFontSize(12);
        doc.text(`請求書番号: ${invoice.invoice_number}`, 140, 30);
        doc.text(`請求日: ${new Date(invoice.invoice_date).toLocaleDateString('ja-JP')}`, 140, 40);
        
        // 請求先
        doc.setFontSize(14);
        doc.text('請求先:', 20, 60);
        doc.setFontSize(12);
        doc.text(invoice.client_name, 20, 70);
        
        if (invoice.client_address) {
            const addressLines = invoice.client_address.split('\n');
            addressLines.forEach((line, index) => {
                doc.text(line, 20, 80 + (index * 10));
            });
        }
        
        // 支払期日
        if (invoice.due_date) {
            doc.text(`支払期日: ${new Date(invoice.due_date).toLocaleDateString('ja-JP')}`, 140, 60);
        }
        
        // 作業項目テーブル
        let y = 110;
        doc.setFontSize(10);
        
        // テーブルヘッダー
        doc.text('作業日', 20, y);
        doc.text('作業内容', 50, y);
        doc.text('時間', 120, y);
        doc.text('時給', 140, y);
        doc.text('金額', 170, y);
        
        y += 10;
        doc.line(20, y - 5, 190, y - 5); // ヘッダーの下線
        
        // 作業項目
        let subtotal = 0;
        items.forEach((item, index) => {
            const amount = Number(item.amount);
            subtotal += amount;
            
            doc.text(new Date(item.work_date).toLocaleDateString('ja-JP'), 20, y);
            
            // 作業内容が長い場合の処理
            const description = item.description.length > 20 ? 
                item.description.substring(0, 17) + '...' : 
                item.description;
            doc.text(description, 50, y);
            
            doc.text(`${Number(item.hours).toFixed(1)}h`, 120, y);
            doc.text(`¥${Number(item.hourly_rate).toLocaleString()}`, 140, y);
            doc.text(`¥${amount.toLocaleString()}`, 170, y);
            
            y += 10;
        });
        
        // 合計計算
        const tax = subtotal * Number(invoice.tax_rate);
        const total = subtotal + tax;
        
        y += 10;
        doc.line(120, y - 5, 190, y - 5); // 合計部分の上線
        
        doc.text('小計:', 140, y);
        doc.text(`¥${subtotal.toLocaleString()}`, 170, y);
        
        y += 10;
        doc.text(`消費税 (${(invoice.tax_rate * 100).toFixed(1)}%):`, 140, y);
        doc.text(`¥${Math.round(tax).toLocaleString()}`, 170, y);
        
        y += 10;
        doc.line(140, y - 5, 190, y - 5); // 合計の上線
        doc.setFontSize(12);
        doc.text('合計:', 140, y);
        doc.text(`¥${Math.round(total).toLocaleString()}`, 170, y);
        
        // 備考
        if (invoice.notes) {
            y += 20;
            doc.setFontSize(10);
            doc.text('備考:', 20, y);
            y += 10;
            
            const noteLines = invoice.notes.split('\n');
            noteLines.forEach(line => {
                doc.text(line, 20, y);
                y += 10;
            });
        }
    }

    showModal(content) {
        const modal = document.getElementById('modal');
        const modalContent = document.getElementById('modalContent');
        modalContent.innerHTML = content;
        modal.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    }

    closeModal() {
        const modal = document.getElementById('modal');
        modal.classList.add('hidden');
        document.body.style.overflow = '';
        this.currentInvoice = null;
        this.currentItems = [];
    }

    showAlert(message, type = 'success') {
        const alertDiv = document.createElement('div');
        alertDiv.className = `alert-${type} mb-4 fixed top-4 right-4 z-50 min-w-64`;
        alertDiv.innerHTML = `
            <span>${message}</span>
            <button onclick="this.parentElement.remove()" class="float-right ml-4">×</button>
        `;
        
        document.body.appendChild(alertDiv);
        
        setTimeout(() => {
            alertDiv.remove();
        }, 5000);
    }

    async loadInvoiceList() {
        // アプリケーション起動時の初期データ読み込み（必要に応じて）
    }
}

// アプリケーション初期化
const app = new InvoiceApp();