const { Pool } = require('pg');

const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'shop',
  password: 'password',
  port: 5432,
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
});

const initDb = async () => {
  try {
    // Таблица ПОЛЬЗОВАТЕЛЬ
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id_user SERIAL PRIMARY KEY,
        email VARCHAR(255) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        first_name VARCHAR(255),
        last_name VARCHAR(255),
        phone VARCHAR(20),
        address TEXT,
        role VARCHAR(50) DEFAULT 'user',
        bonus DECIMAL(10, 2) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Таблица КАТЕГОРИЯ
    await pool.query(`
      CREATE TABLE IF NOT EXISTS categories (
        id_category SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        parent_category_id INTEGER REFERENCES categories(id_category) ON DELETE SET NULL,
        slug VARCHAR(255) NOT NULL UNIQUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Таблица ТОВАР
    await pool.query(`
      CREATE TABLE IF NOT EXISTS products (
        id_product SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        price DECIMAL(10, 2) NOT NULL,
        quantity_in_stock INTEGER NOT NULL DEFAULT 0,
        sku VARCHAR(100) UNIQUE,
        image_url VARCHAR(500),
        category VARCHAR(50),
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Таблица связи ТОВАР-КАТЕГОРИЯ
    await pool.query(`
      CREATE TABLE IF NOT EXISTS product_categories (
        id_product INTEGER REFERENCES products(id_product) ON DELETE CASCADE,
        id_category INTEGER REFERENCES categories(id_category) ON DELETE CASCADE,
        PRIMARY KEY (id_product, id_category)
      )
    `);

    // Таблица КАРТЫ
    await pool.query(`
      CREATE TABLE IF NOT EXISTS cards (
        id_card SERIAL PRIMARY KEY,
        id_user INTEGER NOT NULL REFERENCES users(id_user) ON DELETE CASCADE,
        card_number VARCHAR(20) NOT NULL,
        balance DECIMAL(10, 2) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Таблица ЗАКАЗ
    await pool.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id_order SERIAL PRIMARY KEY,
        id_user INTEGER NOT NULL REFERENCES users(id_user) ON DELETE CASCADE,
        status VARCHAR(50) DEFAULT 'pending',
        total_amount DECIMAL(12, 2) NOT NULL,
        delivery_address TEXT NOT NULL,
        payment_method VARCHAR(100),
        payment_status VARCHAR(50) DEFAULT 'unpaid',
        bonus_earned DECIMAL(10, 2) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Таблица ЭЛЕМЕНТ_ЗАКАЗА
    await pool.query(`
      CREATE TABLE IF NOT EXISTS order_items (
        id_order_item SERIAL PRIMARY KEY,
        id_order INTEGER NOT NULL REFERENCES orders(id_order) ON DELETE CASCADE,
        id_product INTEGER NOT NULL REFERENCES products(id_product) ON DELETE RESTRICT,
        quantity INTEGER NOT NULL,
        price_per_unit DECIMAL(10, 2) NOT NULL
      )
    `);

    // Таблица ОТЗЫВЫ
    await pool.query(`
      CREATE TABLE IF NOT EXISTS reviews (
        id_review SERIAL PRIMARY KEY,
        id_user INTEGER REFERENCES users(id_user) ON DELETE SET NULL,
        rating INTEGER CHECK (rating >= 1 AND rating <= 5) NOT NULL,
        comment TEXT NOT NULL,
        status VARCHAR(50) DEFAULT 'не проверен',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Таблица КОРЗИНА
    await pool.query(`
      CREATE TABLE IF NOT EXISTS carts (
        id_cart SERIAL PRIMARY KEY,
        id_user INTEGER REFERENCES users(id_user) ON DELETE CASCADE,
        session_id VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Таблица ЭЛЕМЕНТ_КОРЗИНЫ
    await pool.query(`
      CREATE TABLE IF NOT EXISTS cart_items (
        id_cart_item SERIAL PRIMARY KEY,
        id_cart INTEGER NOT NULL REFERENCES carts(id_cart) ON DELETE CASCADE,
        id_product INTEGER NOT NULL REFERENCES products(id_product) ON DELETE CASCADE,
        quantity INTEGER NOT NULL,
        added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log('✓ База данных успешно инициализирована');
  } catch (error) {
    console.error('✗ Ошибка инициализации БД:', error);
    throw error;
  }
};

module.exports = {
  pool,
  initDb,
};
