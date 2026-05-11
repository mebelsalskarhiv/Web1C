-- Web1C Database Initialization Script
-- PostgreSQL 16+

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Create enum types
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('admin', 'partner', 'customer');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE order_status AS ENUM ('new', 'confirmed', 'processing', 'shipped', 'completed', 'cancelled', 'reserved');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE sync_status AS ENUM ('pending', 'in_progress', 'completed', 'failed', 'partial');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE sync_operation AS ENUM ('create', 'update', 'delete', 'full_sync');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ===========================================
-- SETTINGS - 1C Connection Settings
-- ===========================================
CREATE TABLE IF NOT EXISTS settings (
    id SERIAL PRIMARY KEY,
    key VARCHAR(100) UNIQUE NOT NULL,
    value TEXT,
    description TEXT,
    is_encrypted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO settings (key, value, description, is_encrypted) VALUES
    ('onec_url', 'http://localhost:8080/hs/odata', '1C OData publication URL', FALSE),
    ('onec_user', 'odata_user', '1C OData username', FALSE),
    ('onec_password', '', '1C OData password (encrypted)', TRUE),
    ('sync_interval', '300', 'Sync interval in seconds', FALSE),
    ('auto_sync_enabled', 'true', 'Enable automatic synchronization', FALSE),
    ('reserve_on_order', 'true', 'Reserve products when order created', FALSE)
ON CONFLICT (key) DO NOTHING;

-- ===========================================
-- USERS - Application Users
-- ===========================================
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    inn VARCHAR(20) UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role user_role NOT NULL DEFAULT 'customer',
    partner_id INTEGER,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    phone VARCHAR(50),
    is_active BOOLEAN DEFAULT TRUE,
    email_verified BOOLEAN DEFAULT FALSE,
    last_login_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_inn ON users(inn);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_partner_id ON users(partner_id);

-- ===========================================
-- PARTNERS - Partners from 1C
-- ===========================================
CREATE TABLE IF NOT EXISTS partners (
    id SERIAL PRIMARY KEY,
    guid_1c VARCHAR(50) UNIQUE, -- GUID из 1С
    inn VARCHAR(20),
    kpp VARCHAR(20),
    name_full TEXT NOT NULL,
    name_short VARCHAR(255),
    address_legal TEXT,
    address_postal TEXT,
    phone_main VARCHAR(50),
    phone_mobile VARCHAR(50),
    email VARCHAR(255),
    website VARCHAR(255),
    contact_person VARCHAR(255),
    contact_position VARCHAR(100),
    
    -- Financial
    balance_debit DECIMAL(15,2) DEFAULT 0, -- Дебиторская задолженность (нам должны)
    balance_credit DECIMAL(15,2) DEFAULT 0, -- Кредиторская задолженность (мы должны)
    discount_percent DECIMAL(5,2) DEFAULT 0,
    price_type_1c VARCHAR(50), -- Тип цен в 1С
    
    -- 1C References
    counterparty_guid_1c VARCHAR(50), -- GUID контрагента в 1С
    agreement_guid_1c VARCHAR(50), -- GUID договора в 1С
    
    -- Merged partners (склеенные партнёры)
    merged_into_id INTEGER REFERENCES partners(id) ON DELETE SET NULL,
    is_merged BOOLEAN DEFAULT FALSE,
    
    -- Sync
    last_sync_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_partners_inn ON partners(inn);
CREATE INDEX IF NOT EXISTS idx_partners_guid_1c ON partners(guid_1c);
CREATE INDEX IF NOT EXISTS idx_partners_name ON partners USING gin(name_full gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_partners_merged ON partners(is_merged) WHERE is_merged = TRUE;

DO $$ BEGIN
    ALTER TABLE users
    ADD CONSTRAINT fk_users_partner_id
    FOREIGN KEY (partner_id) REFERENCES partners(id) ON DELETE SET NULL;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ===========================================
-- USER_MANAGED_PARTNERS - Link users to managed partners
-- ===========================================
CREATE TABLE IF NOT EXISTS user_managed_partners (
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    partner_id INTEGER NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, partner_id)
);

CREATE INDEX IF NOT EXISTS idx_user_managed_partners_user ON user_managed_partners(user_id);
CREATE INDEX IF NOT EXISTS idx_user_managed_partners_partner ON user_managed_partners(partner_id);

-- ===========================================
-- PARTNER_MERGE_HISTORY - History of merged partners
-- ===========================================
CREATE TABLE IF NOT EXISTS partner_merge_history (
    id SERIAL PRIMARY KEY,
    source_partner_id INTEGER NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
    target_partner_id INTEGER NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
    merged_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    merged_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    reason TEXT
);

CREATE INDEX IF NOT EXISTS idx_merge_history_source ON partner_merge_history(source_partner_id);
CREATE INDEX IF NOT EXISTS idx_merge_history_target ON partner_merge_history(target_partner_id);

-- ===========================================
-- PRODUCT_GROUPS - Product Categories from 1C
-- ===========================================
CREATE TABLE IF NOT EXISTS product_groups (
    id SERIAL PRIMARY KEY,
    guid_1c VARCHAR(50) UNIQUE NOT NULL,
    parent_id INTEGER REFERENCES product_groups(id) ON DELETE CASCADE,
    name_1c VARCHAR(255) NOT NULL,
    name_web VARCHAR(255),
    description TEXT,
    sort_order INTEGER DEFAULT 0,
    image_url VARCHAR(500),
    is_active BOOLEAN DEFAULT TRUE,
    path VARCHAR(500), -- Materialized path for fast tree queries
    depth INTEGER DEFAULT 0,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_product_groups_guid ON product_groups(guid_1c);
CREATE INDEX IF NOT EXISTS idx_product_groups_parent ON product_groups(parent_id);
CREATE INDEX IF NOT EXISTS idx_product_groups_path ON product_groups(path);

-- ===========================================
-- PRODUCTS - Products from 1C
-- ===========================================
CREATE TABLE IF NOT EXISTS products (
    id SERIAL PRIMARY KEY,
    guid_1c VARCHAR(50) UNIQUE NOT NULL,
    article VARCHAR(100),
    name VARCHAR(500) NOT NULL,
    name_full TEXT,
    description TEXT,
    description_short VARCHAR(500),
    
    -- Group reference
    group_id INTEGER REFERENCES product_groups(id) ON DELETE SET NULL,
    
    -- Units
    base_unit_1c VARCHAR(50),
    base_unit_name VARCHAR(100),
    
    -- Prices (cached from 1C)
    purchase_price DECIMAL(15,2),
    retail_price DECIMAL(15,2),
    wholesale_price DECIMAL(15,2),
    price_currency VARCHAR(10) DEFAULT 'RUB',
    
    -- Dimensions & Weight
    length DECIMAL(10,2),
    width DECIMAL(10,2),
    height DECIMAL(10,2),
    weight DECIMAL(10,2),
    
    -- Flags
    is_active BOOLEAN DEFAULT TRUE,
    is_service BOOLEAN DEFAULT FALSE,
    is_marked BOOLEAN DEFAULT FALSE, -- Помечен на удаление в 1С
    
    -- SEO
    slug VARCHAR(500),
    meta_title VARCHAR(255),
    meta_description TEXT,
    
    -- Sync
    last_sync_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_products_guid ON products(guid_1c);
CREATE INDEX IF NOT EXISTS idx_products_group ON products(group_id);
CREATE INDEX IF NOT EXISTS idx_products_article ON products(article);
CREATE INDEX IF NOT EXISTS idx_products_name ON products USING gin(name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_products_active ON products(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_products_slug ON products(slug);

-- ===========================================
-- PRODUCT_IMAGES - Product Images
-- ===========================================
CREATE TABLE IF NOT EXISTS product_images (
    id SERIAL PRIMARY KEY,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    guid_1c VARCHAR(50),
    
    -- Stored locally
    filename VARCHAR(255) NOT NULL,
    original_filename VARCHAR(255),
    file_path VARCHAR(500) NOT NULL,
    file_url VARCHAR(500) NOT NULL,
    mime_type VARCHAR(100),
    file_size INTEGER,
    
    -- Image metadata
    width INTEGER,
    height INTEGER,
    
    -- Display
    sort_order INTEGER DEFAULT 0,
    is_main BOOLEAN DEFAULT FALSE,
    alt_text VARCHAR(255),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_product_images_product ON product_images(product_id);
CREATE INDEX IF NOT EXISTS idx_product_images_main ON product_images(product_id, is_main) WHERE is_main = TRUE;

-- ===========================================
-- PRODUCT_STOCKS - Product Stock Levels
-- ===========================================
CREATE TABLE IF NOT EXISTS product_stocks (
    id SERIAL PRIMARY KEY,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    warehouse_guid_1c VARCHAR(50),
    warehouse_name VARCHAR(255),
    
    quantity DECIMAL(15,3) DEFAULT 0,
    reserved DECIMAL(15,3) DEFAULT 0,
    available DECIMAL(15,3) GENERATED ALWAYS AS (quantity - reserved) STORED,
    
    price_type VARCHAR(50),
    
    last_sync_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(product_id, warehouse_guid_1c, price_type)
);

CREATE INDEX IF NOT EXISTS idx_stocks_product ON product_stocks(product_id);
CREATE INDEX IF NOT EXISTS idx_stocks_warehouse ON product_stocks(warehouse_guid_1c);

-- ===========================================
-- CART_ITEMS - User cart
-- ===========================================
CREATE TABLE IF NOT EXISTS cart_items (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    quantity DECIMAL(15,3) NOT NULL,
    is_selected BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_cart_items_user ON cart_items(user_id);
CREATE INDEX IF NOT EXISTS idx_cart_items_product ON cart_items(product_id);

-- ===========================================
-- PRODUCT_RESERVATIONS - Temporary Reservations
-- ===========================================
CREATE TABLE IF NOT EXISTS product_reservations (
    id SERIAL PRIMARY KEY,
    order_id INTEGER,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    warehouse_guid_1c VARCHAR(50),
    
    quantity DECIMAL(15,3) NOT NULL,
    status VARCHAR(20) DEFAULT 'active', -- active, confirmed, cancelled, expired
    expires_at TIMESTAMP WITH TIME ZONE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_reservations_order ON product_reservations(order_id);
CREATE INDEX IF NOT EXISTS idx_reservations_product ON product_reservations(product_id);
CREATE INDEX IF NOT EXISTS idx_reservations_status ON product_reservations(status);
CREATE INDEX IF NOT EXISTS idx_reservations_expires ON product_reservations(expires_at) WHERE status = 'active';

-- ===========================================
-- ORDERS - Customer Orders (sync with 1C)
-- ===========================================
CREATE TABLE IF NOT EXISTS orders (
    id SERIAL PRIMARY KEY,
    guid_1c VARCHAR(50) UNIQUE, -- GUID документа в 1С
    order_number_1c VARCHAR(50) UNIQUE, -- Номер в 1С
    order_number_web VARCHAR(50), -- Номер в веб-приложении
    
    -- Partner & User
    partner_id INTEGER REFERENCES partners(id) ON DELETE SET NULL,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    
    -- Order Info
    status order_status NOT NULL DEFAULT 'new',
    order_date DATE,
    realization_date DATE, -- Дата реализации (когда отгружено)
    
    -- Delivery
    delivery_address TEXT,
    delivery_date DATE,
    delivery_method VARCHAR(50),
    
    -- Financial
    total_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
    discount_amount DECIMAL(15,2) DEFAULT 0,
    paid_amount DECIMAL(15,2) DEFAULT 0,
    currency VARCHAR(10) DEFAULT 'RUB',
    
    -- Payment status
    payment_status VARCHAR(20) DEFAULT 'pending', -- pending, partial, paid, refunded
    payment_method VARCHAR(50),
    
    -- 1C References
    sales_order_guid_1c VARCHAR(50), -- Заказ клиента GUID
    realization_guid_1c VARCHAR(50), -- Реализация GUID
    agreement_guid_1c VARCHAR(50), -- Договор
    
    -- Additional
    comment_user TEXT, -- Комментарий пользователя
    comment_manager TEXT, -- Комментарий менеджера
    tracking_number VARCHAR(100),
    
    -- PDF generation
    invoice_pdf_url VARCHAR(500),
    invoice_uid VARCHAR(100), -- УИД для штрих-кода
    
    -- Sync
    last_sync_at TIMESTAMP WITH TIME ZONE,
    sync_error TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_orders_guid ON orders(guid_1c);
CREATE INDEX IF NOT EXISTS idx_orders_number ON orders(order_number_1c);
CREATE INDEX IF NOT EXISTS idx_orders_partner ON orders(partner_id);
CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_date ON orders(order_date);
CREATE INDEX IF NOT EXISTS idx_orders_web_number ON orders(order_number_web);

DO $$ BEGIN
    ALTER TABLE product_reservations
    ADD CONSTRAINT fk_product_reservations_order_id
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ===========================================
-- ORDER_ITEMS - Order Line Items
-- ===========================================
CREATE TABLE IF NOT EXISTS order_items (
    id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
    
    -- Product snapshot at order time
    product_name VARCHAR(500) NOT NULL,
    product_article VARCHAR(100),
    product_guid_1c VARCHAR(50),
    
    quantity DECIMAL(15,3) NOT NULL,
    unit VARCHAR(50),
    price DECIMAL(15,2) NOT NULL,
    discount_percent DECIMAL(5,2) DEFAULT 0,
    total DECIMAL(15,2) NOT NULL,
    
    -- 1C
    nomenclature_guid_1c VARCHAR(50),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product ON order_items(product_id);

-- ===========================================
-- ORDER_HISTORY - Order Status History
-- ===========================================
CREATE TABLE IF NOT EXISTS order_history (
    id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    
    status_from VARCHAR(50),
    status_to VARCHAR(50) NOT NULL,
    
    changed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    changed_by_role user_role,
    
    comment TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_order_history_order ON order_history(order_id);
CREATE INDEX IF NOT EXISTS idx_order_history_date ON order_history(created_at);

-- ===========================================
-- SYNC_LOGS - Synchronization Logs
-- ===========================================
CREATE TABLE IF NOT EXISTS sync_logs (
    id SERIAL PRIMARY KEY,
    sync_session_id VARCHAR(100), -- ID сессии синхронизации
    
    entity_type VARCHAR(50) NOT NULL, -- products, partners, orders, stocks
    entity_id VARCHAR(100), -- ID сущности
    entity_guid_1c VARCHAR(50), -- GUID из 1С
    
    operation sync_operation NOT NULL,
    status sync_status NOT NULL DEFAULT 'pending',
    
    request_data JSONB,
    response_data JSONB,
    error_message TEXT,
    error_details JSONB,
    
    duration_ms INTEGER,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_sync_logs_session ON sync_logs(sync_session_id);
CREATE INDEX IF NOT EXISTS idx_sync_logs_entity ON sync_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_sync_logs_status ON sync_logs(status);
CREATE INDEX IF NOT EXISTS idx_sync_logs_date ON sync_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_sync_logs_request ON sync_logs USING gin(request_data);

-- ===========================================
-- SYNC_SESSIONS - Sync Session Tracking
-- ===========================================
CREATE TABLE IF NOT EXISTS sync_sessions (
    id SERIAL PRIMARY KEY,
    session_uuid UUID DEFAULT uuid_generate_v4() UNIQUE,
    
    sync_type VARCHAR(50) NOT NULL, -- full, incremental, products, partners, orders
    status sync_status NOT NULL DEFAULT 'pending',
    
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    
    items_processed INTEGER DEFAULT 0,
    items_total INTEGER DEFAULT 0,
    items_failed INTEGER DEFAULT 0,
    
    error_message TEXT,
    
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sync_sessions_uuid ON sync_sessions(session_uuid);
CREATE INDEX IF NOT EXISTS idx_sync_sessions_status ON sync_sessions(status);
CREATE INDEX IF NOT EXISTS idx_sync_sessions_date ON sync_sessions(created_at);

-- ===========================================
-- API_KEYS - API Keys for External Access
-- ===========================================
CREATE TABLE IF NOT EXISTS api_keys (
    id SERIAL PRIMARY KEY,
    key_hash VARCHAR(255) UNIQUE NOT NULL,
    key_prefix VARCHAR(20) NOT NULL, -- For identification (first 8 chars)
    
    name VARCHAR(255),
    owner_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    
    permissions JSONB DEFAULT '[]'::jsonb,
    rate_limit INTEGER DEFAULT 1000, -- Requests per hour
    
    last_used_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE,
    
    is_active BOOLEAN DEFAULT TRUE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_api_keys_owner ON api_keys(owner_id);

-- ===========================================
-- TRIGGERS - Auto-update timestamps
-- ===========================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_partners_updated_at BEFORE UPDATE ON partners
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_product_groups_updated_at BEFORE UPDATE ON product_groups
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_settings_updated_at BEFORE UPDATE ON settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ===========================================
-- VIEWS - Useful Views
-- ===========================================
CREATE OR REPLACE VIEW v_products_available AS
SELECT 
    p.*,
    COALESCE(SUM(ps.available), 0) as total_available,
    COALESCE(SUM(ps.quantity), 0) as total_quantity,
    COALESCE(SUM(ps.reserved), 0) as total_reserved
FROM products p
LEFT JOIN product_stocks ps ON p.id = ps.product_id
WHERE p.is_active = TRUE AND p.is_marked = FALSE
GROUP BY p.id;

CREATE OR REPLACE VIEW v_partners_with_balance AS
SELECT 
    p.*,
    (balance_debit - balance_credit) as net_balance,
    CASE 
        WHEN balance_debit > balance_credit THEN 'debtor'
        WHEN balance_credit > balance_debit THEN 'creditor'
        ELSE 'balanced'
    END as balance_type
FROM partners p
WHERE p.is_merged = FALSE OR p.is_merged IS NULL;

CREATE OR REPLACE VIEW v_orders_with_items_count AS
SELECT 
    o.*,
    COUNT(oi.id) as items_count
FROM orders o
LEFT JOIN order_items oi ON o.id = oi.order_id
GROUP BY o.id;

-- ===========================================
-- INITIAL DATA
-- ===========================================
-- Default admin user (password: admin123 - change immediately!)
-- Password hash generated with bcrypt
INSERT INTO users (email, password_hash, role, first_name, last_name, is_active)
VALUES (
    'admin@web1c.local',
    '$2a$10$cvDAO4Saopwr6x/jQpTTDumxIYmbsUjlFR/Oz1M5VwWpXEGUBahF.',
    'admin',
    'Администратор',
    'Системы',
    TRUE
) ON CONFLICT (email) DO NOTHING;

-- Comment: Initial schema created for Web1C Shop
