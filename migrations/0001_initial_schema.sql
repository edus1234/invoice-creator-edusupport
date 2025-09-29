-- 請求書システムのテーブル設計
-- 請求書メインテーブル
CREATE TABLE IF NOT EXISTS invoices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_number TEXT UNIQUE NOT NULL,
    client_name TEXT NOT NULL,
    client_address TEXT,
    invoice_date DATE NOT NULL,
    due_date DATE,
    tax_rate REAL DEFAULT 0.10,
    notes TEXT,
    total_amount_before_tax REAL NOT NULL DEFAULT 0,
    tax_amount REAL NOT NULL DEFAULT 0,
    total_amount REAL NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 請求書明細テーブル（作業項目）
CREATE TABLE IF NOT EXISTS invoice_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_id INTEGER NOT NULL,
    work_date DATE NOT NULL,
    description TEXT NOT NULL,
    hours REAL NOT NULL,
    hourly_rate REAL NOT NULL,
    amount REAL NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE
);

-- インデックス作成
CREATE INDEX IF NOT EXISTS idx_invoices_number ON invoices(invoice_number);
CREATE INDEX IF NOT EXISTS idx_invoices_date ON invoices(invoice_date);
CREATE INDEX IF NOT EXISTS idx_items_invoice_id ON invoice_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_items_work_date ON invoice_items(work_date);

-- トリガー：請求書の合計金額を自動更新
CREATE TRIGGER IF NOT EXISTS update_invoice_totals
AFTER INSERT ON invoice_items
BEGIN
    UPDATE invoices 
    SET 
        total_amount_before_tax = (
            SELECT COALESCE(SUM(amount), 0) 
            FROM invoice_items 
            WHERE invoice_id = NEW.invoice_id
        ),
        tax_amount = (
            SELECT COALESCE(SUM(amount), 0) * tax_rate 
            FROM invoice_items 
            WHERE invoice_id = NEW.invoice_id
        ),
        total_amount = (
            SELECT COALESCE(SUM(amount), 0) * (1 + tax_rate)
            FROM invoice_items 
            WHERE invoice_id = NEW.invoice_id
        ),
        updated_at = CURRENT_TIMESTAMP
    WHERE id = NEW.invoice_id;
END;

-- トリガー：請求書明細更新時の合計金額自動更新
CREATE TRIGGER IF NOT EXISTS update_invoice_totals_on_update
AFTER UPDATE ON invoice_items
BEGIN
    UPDATE invoices 
    SET 
        total_amount_before_tax = (
            SELECT COALESCE(SUM(amount), 0) 
            FROM invoice_items 
            WHERE invoice_id = NEW.invoice_id
        ),
        tax_amount = (
            SELECT COALESCE(SUM(amount), 0) * tax_rate 
            FROM invoice_items 
            WHERE invoice_id = NEW.invoice_id
        ),
        total_amount = (
            SELECT COALESCE(SUM(amount), 0) * (1 + tax_rate)
            FROM invoice_items 
            WHERE invoice_id = NEW.invoice_id
        ),
        updated_at = CURRENT_TIMESTAMP
    WHERE id = NEW.invoice_id;
END;

-- トリガー：請求書明細削除時の合計金額自動更新
CREATE TRIGGER IF NOT EXISTS update_invoice_totals_on_delete
AFTER DELETE ON invoice_items
BEGIN
    UPDATE invoices 
    SET 
        total_amount_before_tax = (
            SELECT COALESCE(SUM(amount), 0) 
            FROM invoice_items 
            WHERE invoice_id = OLD.invoice_id
        ),
        tax_amount = (
            SELECT COALESCE(SUM(amount), 0) * tax_rate 
            FROM invoice_items 
            WHERE invoice_id = OLD.invoice_id
        ),
        total_amount = (
            SELECT COALESCE(SUM(amount), 0) * (1 + tax_rate)
            FROM invoice_items 
            WHERE invoice_id = OLD.invoice_id
        ),
        updated_at = CURRENT_TIMESTAMP
    WHERE id = OLD.invoice_id;
END;