const express = require('express');
const session = require('express-session');
const path = require('path');
const bcrypt = require('bcrypt');
const { pool, initDb } = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Set view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false, // set to true if using HTTPS
    httpOnly: true,
    maxAge: 1000 * 60 * 60 * 24, // 24 hours
  },
}));

// Routes
app.get('/', (req, res) => {
  res.render('index');
});

app.get('/catalog', (req, res) => {
  res.render('catalog');
});

app.get('/account', (req, res) => {
  res.render('account');
});

app.get('/about', (req, res) => {
  res.render('about');
});

app.get('/cart', (req, res) => {
  res.send('Страница корзины');
});

// API Routes
app.get('/api/products', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM products WHERE is_active = true AND quantity_in_stock > 0 ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (error) {
    console.error('Ошибка получения товаров:', error);
    res.status(500).json({ error: 'Ошибка получения товаров' });
  }
});

// Получить все товары (включая неактивные) для админа
app.get('/api/products-all', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM products ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (error) {
    console.error('Ошибка получения товаров:', error);
    res.status(500).json({ error: 'Ошибка получения товаров' });
  }
});

// Health check
app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT NOW()');
    res.json({ status: 'ok', message: 'Server is running' });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// API Auth Routes
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, first_name, last_name, phone, password } = req.body;

    const existingUser = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (existingUser.rows.length > 0) {
      return res.status(400).json({ message: 'Email уже зарегистрирован' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO users (email, password_hash, first_name, last_name, phone) VALUES ($1, $2, $3, $4, $5) RETURNING id_user, email, first_name, last_name, phone, role',
      [email, hashedPassword, first_name, last_name, phone]
    );

    req.session.userId = result.rows[0].id_user;
    res.json({ user: result.rows[0] });
  } catch (error) {
    console.error('Ошибка регистрации:', error);
    res.status(500).json({ message: 'Ошибка регистрации' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (result.rows.length === 0) {
      return res.status(401).json({ message: 'Неверный email или пароль' });
    }

    const user = result.rows[0];
    const validPassword = await bcrypt.compare(password, user.password_hash);

    if (!validPassword) {
      return res.status(401).json({ message: 'Неверный email или пароль' });
    }

    req.session.userId = user.id_user;
    res.json({ 
      user: {
        id_user: user.id_user,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        phone: user.phone,
        role: user.role,
        bonus: user.bonus
      }
    });
  } catch (error) {
    console.error('Ошибка входа:', error);
    res.status(500).json({ message: 'Ошибка входа' });
  }
});

// Получить данные пользователя
app.get('/api/auth/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const result = await pool.query(
      'SELECT id_user, email, first_name, last_name, phone, bonus FROM users WHERE id_user = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Пользователь не найден' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Ошибка получения пользователя:', error);
    res.status(500).json({ message: 'Ошибка получения пользователя' });
  }
});

// Cart API Routes
app.post('/api/cart/merge', async (req, res) => {
  try {
    const { user_id, guest_cart } = req.body;

    for (const item of guest_cart) {
      const cartResult = await pool.query(
        'SELECT id_cart FROM carts WHERE id_user = $1',
        [user_id]
      );

      let cartId;
      if (cartResult.rows.length === 0) {
        const newCart = await pool.query(
          'INSERT INTO carts (id_user) VALUES ($1) RETURNING id_cart',
          [user_id]
        );
        cartId = newCart.rows[0].id_cart;
      } else {
        cartId = cartResult.rows[0].id_cart;
      }

      // Проверяем, есть ли товар в корзине
      const existingItem = await pool.query(
        'SELECT quantity FROM cart_items WHERE id_cart = $1 AND id_product = $2',
        [cartId, item.id]
      );

      if (existingItem.rows.length > 0) {
        // Если товар есть, увеличиваем количество
        await pool.query(
          'UPDATE cart_items SET quantity = quantity + $1 WHERE id_cart = $2 AND id_product = $3',
          [item.quantity, cartId, item.id]
        );
      } else {
        // Если товара нет, добавляем его
        await pool.query(
          'INSERT INTO cart_items (id_cart, id_product, quantity) VALUES ($1, $2, $3)',
          [cartId, item.id, item.quantity]
        );
      }
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Ошибка слияния корзины:', error);
    res.status(500).json({ message: 'Ошибка слияния корзины' });
  }
});

app.get('/api/cart/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    const result = await pool.query(
      `SELECT p.id_product as id, p.name, p.price, ci.quantity
       FROM cart_items ci
       JOIN carts c ON ci.id_cart = c.id_cart
       JOIN products p ON ci.id_product = p.id_product
       WHERE c.id_user = $1`,
      [userId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Ошибка получения корзины:', error);
    res.status(500).json({ message: 'Ошибка получения корзины' });
  }
});

app.put('/api/cart/quantity', async (req, res) => {
  try {
    const { user_id, product_id, change } = req.body;

    const result = await pool.query(
      `UPDATE cart_items SET quantity = quantity + $1
       WHERE id_product = $2 AND id_cart IN (
         SELECT id_cart FROM carts WHERE id_user = $3
       )
       RETURNING quantity`,
      [change, product_id, user_id]
    );

    if (result.rows[0].quantity <= 0) {
      await pool.query(
        `DELETE FROM cart_items WHERE id_product = $1 AND id_cart IN (
           SELECT id_cart FROM carts WHERE id_user = $2
         )`,
        [product_id, user_id]
      );
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Ошибка изменения количества:', error);
    res.status(500).json({ message: 'Ошибка изменения количества' });
  }
});

app.delete('/api/cart/item', async (req, res) => {
  try {
    const { user_id, product_id } = req.body;

    await pool.query(
      `DELETE FROM cart_items WHERE id_product = $1 AND id_cart IN (
         SELECT id_cart FROM carts WHERE id_user = $2
       )`,
      [product_id, user_id]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Ошибка удаления товара:', error);
    res.status(500).json({ message: 'Ошибка удаления товара' });
  }
});

// Получить корзину пользователя
app.get('/api/carts/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const result = await pool.query(
      'SELECT id_cart FROM carts WHERE id_user = $1 LIMIT 1',
      [userId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Ошибка получения корзины:', error);
    res.status(500).json({ message: 'Ошибка получения корзины' });
  }
});

// Создать новую корзину
app.post('/api/carts/create', async (req, res) => {
  try {
    const { user_id } = req.body;
    const result = await pool.query(
      'INSERT INTO carts (id_user) VALUES ($1) RETURNING id_cart',
      [user_id]
    );
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Ошибка создания корзины:', error);
    res.status(500).json({ message: 'Ошибка создания корзины' });
  }
});

// Добавить товар в корзину
app.post('/api/cart/add-item', async (req, res) => {
  try {
    const { cart_id, product_id, quantity } = req.body;
    
    const existingItem = await pool.query(
      'SELECT * FROM cart_items WHERE id_cart = $1 AND id_product = $2',
      [cart_id, product_id]
    );
    
    if (existingItem.rows.length > 0) {
      await pool.query(
        'UPDATE cart_items SET quantity = quantity + $1 WHERE id_cart = $2 AND id_product = $3',
        [quantity, cart_id, product_id]
      );
    } else {
      await pool.query(
        'INSERT INTO cart_items (id_cart, id_product, quantity) VALUES ($1, $2, $3)',
        [cart_id, product_id, quantity]
      );
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Ошибка добавления товара в корзину:', error);
    res.status(500).json({ message: 'Ошибка добавления товара' });
  }
});

// Orders API Routes
app.get('/api/orders/next-number/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const result = await pool.query(
      'SELECT COUNT(*) + 1 as next_number FROM orders WHERE id_user = $1',
      [userId]
    );
    res.json({ nextNumber: result.rows[0].next_number });
  } catch (error) {
    console.error('Ошибка получения номера заказа:', error);
    res.status(500).json({ message: 'Ошибка получения номера заказа' });
  }
});

app.get('/api/orders/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const result = await pool.query(`
      SELECT 
        o.id_order,
        o.id_user,
        o.status,
        o.total_amount,
        o.delivery_address,
        o.payment_status,
        o.bonus_earned,
        o.created_at,
        COUNT(oi.id_order_item) as items_count,
        json_agg(json_build_object(
          'product_name', p.name,
          'quantity', oi.quantity,
          'price', oi.price_per_unit
        )) as items
      FROM orders o
      LEFT JOIN order_items oi ON o.id_order = oi.id_order
      LEFT JOIN products p ON oi.id_product = p.id_product
      WHERE o.id_user = $1
      GROUP BY o.id_order
      ORDER BY o.created_at DESC
    `, [userId]);
    res.json(result.rows);
  } catch (error) {
    console.error('Ошибка получения заказов:', error);
    res.status(500).json({ message: 'Ошибка получения заказов' });
  }
});

app.post('/api/orders/create', async (req, res) => {
  try {
    const { user_id, card_id, delivery_address, bonus_used } = req.body;

    // Получаем информацию о карте
    const cardResult = await pool.query(
      'SELECT balance FROM cards WHERE id_card = $1 AND id_user = $2',
      [card_id, user_id]
    );

    if (cardResult.rows.length === 0) {
      return res.status(400).json({ message: 'Карта не найдена' });
    }

    const cartResult = await pool.query(`
      SELECT ci.id_product, ci.quantity, p.price, p.name
      FROM cart_items ci
      JOIN carts c ON ci.id_cart = c.id_cart
      JOIN products p ON ci.id_product = p.id_product
      WHERE c.id_user = $1
    `, [user_id]);

    if (cartResult.rows.length === 0) {
      return res.status(400).json({ message: 'Корзина пуста' });
    }

    let totalAmount = 0;
    cartResult.rows.forEach(item => {
      totalAmount += item.price * item.quantity;
    });

    // Вычисляем скидку от бонусов (1 бонус = 0.1 BYN)
    const bonusDiscount = (bonus_used || 0) * 0.1;
    const finalAmount = Math.max(0, totalAmount - bonusDiscount);

    // Проверяем баланс карты
    if (cardResult.rows[0].balance < finalAmount) {
      return res.status(400).json({ message: 'Недостаточно средств на карте' });
    }

    // Рассчитываем бонусы: 20% от оригинальной суммы (до скидки)
    const bonusEarned = Math.round((totalAmount * 0.2 * 10)); // в "бонус-единицах"

    const orderResult = await pool.query(`
      INSERT INTO orders (id_user, total_amount, delivery_address, payment_status, bonus_earned, status)
      VALUES ($1, $2, $3, 'paid', $4, 'pending')
      RETURNING id_order, created_at
    `, [user_id, finalAmount, delivery_address, bonusEarned]);

    const orderId = orderResult.rows[0].id_order;

    // Добавляем товары в заказ и уменьшаем количество в каталоге
    for (const item of cartResult.rows) {
      await pool.query(`
        INSERT INTO order_items (id_order, id_product, quantity, price_per_unit)
        VALUES ($1, $2, $3, $4)
      `, [orderId, item.id_product, item.quantity, item.price]);

      // УМЕНЬШАЕМ КОЛИЧЕСТВО ТОВАРА В КАТАЛОГЕ
      await pool.query(`
        UPDATE products SET quantity_in_stock = quantity_in_stock - $1 
        WHERE id_product = $2
      `, [item.quantity, item.id_product]);
    }

    // Вычитаем сумму из баланса карты
    await pool.query(`
      UPDATE cards SET balance = balance - $1 WHERE id_card = $2
    `, [finalAmount, card_id]);

    // Обновляем бонусы пользователя: добавляем заработанные, вычитаем использованные
    await pool.query(`
      UPDATE users SET bonus = bonus + $1 - $2 WHERE id_user = $3
    `, [bonusEarned, bonus_used || 0, user_id]);

    await pool.query(`
      DELETE FROM cart_items WHERE id_cart IN (
        SELECT id_cart FROM carts WHERE id_user = $1
      )
    `, [user_id]);

    res.json({ 
      success: true, 
      order_id: orderId,
      order: {
        id_order: orderId,
        total_amount: finalAmount,
        original_amount: totalAmount,
        bonus_used: bonus_used || 0,
        bonus_earned: bonusEarned,
        delivery_address: delivery_address,
        status: 'pending',
        items_count: cartResult.rows.length,
        created_at: orderResult.rows[0].created_at
      }
    });
  } catch (error) {
    console.error('Ошибка создания заказа:', error);
    res.status(500).json({ message: 'Ошибка создания заказа' });
  }
});

// Cards API Routes
app.get('/api/cards/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const result = await pool.query(
      'SELECT id_card, card_number, balance, created_at FROM cards WHERE id_user = $1 ORDER BY created_at DESC',
      [userId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Ошибка получения карт:', error);
    res.status(500).json({ message: 'Ошибка получения карт' });
  }
});

// Reviews API - сохранить отзыв (id_user может быть null для гостя)
app.post('/api/reviews', async (req, res) => {
  try {
    const { id_user, rating, comment } = req.body;
    if (!rating || !comment) {
      return res.status(400).json({ message: 'Необходимы рейтинг и комментарий' });
    }

    const result = await pool.query(
      `INSERT INTO reviews (id_user, rating, comment, status)
       VALUES ($1, $2, $3, 'не проверен')
       RETURNING id_review`,
      [id_user || null, parseInt(rating, 10), comment]
    );

    res.json({ success: true, id_review: result.rows[0].id_review });
  } catch (error) {
    console.error('Ошибка сохранения отзыва:', error);
    res.status(500).json({ message: 'Ошибка сохранения отзыва' });
  }
});

// Получить заказы со статусом pending для управления доставкой
app.get('/api/orders-pending', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        o.id_order,
        o.id_user,
        o.status,
        o.total_amount,
        o.delivery_address,
        o.payment_status,
        o.bonus_earned,
        o.created_at,
        u.first_name,
        u.last_name,
        COUNT(oi.id_order_item) as items_count,
        json_agg(json_build_object(
          'product_name', p.name,
          'quantity', oi.quantity,
          'price', oi.price_per_unit
        )) as items
      FROM orders o
      JOIN users u ON o.id_user = u.id_user
      LEFT JOIN order_items oi ON o.id_order = oi.id_order
      LEFT JOIN products p ON oi.id_product = p.id_product
      WHERE o.status = 'pending'
      GROUP BY o.id_order, u.first_name, u.last_name
      ORDER BY o.created_at ASC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Ошибка получения заказов:', error);
    res.status(500).json({ message: 'Ошибка получения заказов' });
  }
});

// Обновить статус заказа на completed
app.put('/api/orders/:orderId/complete', async (req, res) => {
  try {
    const { orderId } = req.params;

    const result = await pool.query(
      'UPDATE orders SET status = $1 WHERE id_order = $2 RETURNING id_order, status',
      ['completed', orderId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Заказ не найден' });
    }

    res.json({ success: true, order: result.rows[0] });
  } catch (error) {
    console.error('Ошибка обновления статуса заказа:', error);
    res.status(500).json({ message: 'Ошибка обновления статуса' });
  }
});

// Удалить заказ (для пользователя)
app.delete('/api/orders/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.body.user_id;

    // Проверяем, что заказ принадлежит пользователю и имеет статус completed
    const orderCheck = await pool.query(
      'SELECT id_order, id_user, status FROM orders WHERE id_order = $1',
      [orderId]
    );

    if (orderCheck.rows.length === 0) {
      return res.status(404).json({ message: 'Заказ не найден' });
    }

    const order = orderCheck.rows[0];

    // Проверяем права доступа и статус
    if (order.id_user !== parseInt(userId)) {
      return res.status(403).json({ message: 'Нет прав на удаление этого заказа' });
    }

    if (order.status !== 'completed') {
      return res.status(400).json({ message: 'Можно удалять только завершённые заказы' });
    }

    // Удаляем заказ (каскадное удаление автоматически удалит order_items)
    const result = await pool.query(
      'DELETE FROM orders WHERE id_order = $1 RETURNING id_order',
      [orderId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Ошибка при удалении заказа' });
    }

    res.json({ success: true, message: 'Заказ успешно удалён' });
  } catch (error) {
    console.error('Ошибка удаления заказа:', error);
    res.status(500).json({ message: 'Ошибка удаления заказа' });
  }
});

// Обновить товар (для админа)
app.put('/api/products/:productId', async (req, res) => {
  try {
    const { productId } = req.params;
    const { name, description, price, quantity_in_stock, category } = req.body;

    let query = 'UPDATE products SET ';
    const updates = [];
    const values = [];
    let paramCount = 1;

    if (name !== undefined) {
      updates.push(`name = $${paramCount++}`);
      values.push(name);
    }
    if (description !== undefined) {
      updates.push(`description = $${paramCount++}`);
      values.push(description);
    }
    if (price !== undefined) {
      updates.push(`price = $${paramCount++}`);
      values.push(price);
    }
    if (quantity_in_stock !== undefined) {
      updates.push(`quantity_in_stock = $${paramCount++}`);
      values.push(quantity_in_stock);
    }
    if (category !== undefined) {
      updates.push(`category = $${paramCount++}`);
      values.push(category);
    }

    if (updates.length === 0) {
      return res.status(400).json({ message: 'Нет данных для обновления' });
    }

    query += updates.join(', ');
    query += ` WHERE id_product = $${paramCount}`;
    values.push(productId);

    const result = await pool.query(query, values);

    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Товар не найден' });
    }

    res.json({ success: true, message: 'Товар обновлён' });
  } catch (error) {
    console.error('Ошибка обновления товара:', error);
    res.status(500).json({ error: 'Ошибка обновления товара' });
  }
});

// Добавить товар (для админа)
app.post('/api/products', async (req, res) => {
  try {
    const { name, description, price, quantity_in_stock, category } = req.body;

    if (!name || !description || !price || quantity_in_stock === undefined || !category) {
      return res.status(400).json({ message: 'Заполните все обязательные поля' });
    }

    // Получаем следующий ID для генерации SKU
    const lastProduct = await pool.query('SELECT MAX(id_product) as max_id FROM products');
    const nextId = (lastProduct.rows[0].max_id || 0) + 1;
    const sku = `SKU${nextId}`;
    const imageUrl = `/images/pic${nextId}.jpg`;

    const result = await pool.query(
      `INSERT INTO products (name, description, price, quantity_in_stock, category, sku, image_url, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, true)
       RETURNING id_product, name, description, price, quantity_in_stock, category, sku, image_url`,
      [name, description, price, quantity_in_stock, category, sku, imageUrl]
    );

    res.json({
      success: true,
      message: 'Товар добавлен успешно',
      product: result.rows[0]
    });
  } catch (error) {
    console.error('Ошибка добавления товара:', error);
    res.status(500).json({ error: 'Ошибка добавления товара' });
  }
});

// Initialize database and start server
const startServer = async () => {
  try {
    await initDb();
    
    app.listen(PORT, () => {
      console.log(`🚀 Сервер запущен на http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('✗ Ошибка при запуске сервера:', error);
    process.exit(1);
  }
};

startServer();

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Завершение работы сервера...');
  await pool.end();
  process.exit(0);
});

// Получить все отзывы (для админа)
app.get('/api/reviews-all', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        r.id_review,
        r.id_user,
        r.rating,
        r.comment,
        r.status,
        r.created_at,
        COALESCE(u.first_name || ' ' || u.last_name, 'Гость') as author_name
      FROM reviews r
      LEFT JOIN users u ON r.id_user = u.id_user
      ORDER BY r.created_at ASC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Ошибка получения отзывов:', error);
    res.status(500).json({ message: 'Ошибка получения отзывов' });
  }
});

// Опубликовать отзыв (изменить статус на проверен)
app.put('/api/reviews/:reviewId/publish', async (req, res) => {
  try {
    const { reviewId } = req.params;

    const result = await pool.query(
      'UPDATE reviews SET status = $1 WHERE id_review = $2 RETURNING id_review, status',
      ['проверен', reviewId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Отзыв не найден' });
    }

    res.json({ success: true, review: result.rows[0] });
  } catch (error) {
    console.error('Ошибка публикации отзыва:', error);
    res.status(500).json({ message: 'Ошибка публикации отзыва' });
  }
});

// Обновить текст отзыва
app.put('/api/reviews/:reviewId', async (req, res) => {
  try {
    const { reviewId } = req.params;
    const { comment } = req.body;

    if (!comment || comment.trim().length === 0) {
      return res.status(400).json({ message: 'Текст отзыва не может быть пустым' });
    }

    const result = await pool.query(
      'UPDATE reviews SET comment = $1 WHERE id_review = $2 RETURNING id_review, comment',
      [comment, reviewId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Отзыв не найден' });
    }

    res.json({ success: true, review: result.rows[0] });
  } catch (error) {
    console.error('Ошибка обновления отзыва:', error);
    res.status(500).json({ message: 'Ошибка обновления отзыва' });
  }
});

// Удалить отзыв
app.delete('/api/reviews/:reviewId', async (req, res) => {
  try {
    const { reviewId } = req.params;

    const result = await pool.query(
      'DELETE FROM reviews WHERE id_review = $1 RETURNING id_review',
      [reviewId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Отзыв не найден' });
    }

    res.json({ success: true, message: 'Отзыв удалён' });
  } catch (error) {
    console.error('Ошибка удаления отзыва:', error);
    res.status(500).json({ message: 'Ошибка удаления отзыва' });
  }
});

// Получить проверенные отзывы для главной страницы
app.get('/api/reviews-published', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        r.id_review,
        r.rating,
        r.comment,
        COALESCE(u.first_name || ' ' || u.last_name, 'Гость') as author_name
      FROM reviews r
      LEFT JOIN users u ON r.id_user = u.id_user
      WHERE r.status = 'проверен'
      ORDER BY r.created_at DESC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Ошибка получения опубликованных отзывов:', error);
    res.status(500).json({ message: 'Ошибка получения отзывов' });
  }
});

// Аналитика - получить статистику
app.get('/api/analytics/:period', async (req, res) => {
  try {
    const { period } = req.params;
    let dateFilter = '';

    // Определяем период для фильтрации
    switch(period) {
      case 'day':
        dateFilter = "CURRENT_DATE";
        break;
      case 'week':
        dateFilter = "CURRENT_DATE - INTERVAL '7 days'";
        break;
      case 'month':
        dateFilter = "CURRENT_DATE - INTERVAL '30 days'";
        break;
      case 'year':
        dateFilter = "CURRENT_DATE - INTERVAL '365 days'";
        break;
      default:
        dateFilter = "CURRENT_DATE";
    }

    // Прибыль
    const profitResult = await pool.query(`
      SELECT COALESCE(SUM(total_amount), 0) as profit
      FROM orders
      WHERE created_at >= ${dateFilter} AND status = 'completed'
    `);

    // Кол-во заказов
    const ordersResult = await pool.query(`
      SELECT COUNT(*) as order_count
      FROM orders
      WHERE created_at >= ${dateFilter}
    `);

    // Кол-во товаров продано
    const itemsResult = await pool.query(`
      SELECT COALESCE(SUM(oi.quantity), 0) as items_sold
      FROM order_items oi
      JOIN orders o ON oi.id_order = o.id_order
      WHERE o.created_at >= ${dateFilter}
    `);

    // Кол-во новых пользователей
    const usersResult = await pool.query(`
      SELECT COUNT(*) as new_users
      FROM users
      WHERE created_at >= ${dateFilter}
    `);

    // Средний чек
    const avgCheckResult = await pool.query(`
      SELECT COALESCE(AVG(total_amount), 0) as avg_check
      FROM orders
      WHERE created_at >= ${dateFilter} AND status = 'completed'
    `);

    // Средний рейтинг отзывов
    const ratingResult = await pool.query(`
      SELECT COALESCE(AVG(rating), 0) as avg_rating, COUNT(*) as review_count
      FROM reviews
      WHERE created_at >= ${dateFilter}
    `);

    res.json({
      period,
      profit: parseFloat(profitResult.rows[0].profit).toFixed(2),
      orderCount: parseInt(ordersResult.rows[0].order_count),
      itemsSold: parseInt(itemsResult.rows[0].items_sold),
      newUsers: parseInt(usersResult.rows[0].new_users),
      avgCheck: parseFloat(avgCheckResult.rows[0].avg_check).toFixed(2),
      avgRating: parseFloat(ratingResult.rows[0].avg_rating).toFixed(2),
      reviewCount: parseInt(ratingResult.rows[0].review_count)
    });
  } catch (error) {
    console.error('Ошибка получения аналитики:', error);
    res.status(500).json({ message: 'Ошибка получения аналитики' });
  }
});

// DOCX отчет - заказы
app.get('/api/reports/orders', async (req, res) => {
  try {
    const { period } = req.query;
    let dateFilter = '';

    // Определяем период для фильтрации
    switch(period) {
      case 'day':
        dateFilter = "CURRENT_DATE";
        break;
      case 'week':
        dateFilter = "CURRENT_DATE - INTERVAL '7 days'";
        break;
      case 'month':
        dateFilter = "CURRENT_DATE - INTERVAL '30 days'";
        break;
      case 'year':
        dateFilter = "CURRENT_DATE - INTERVAL '365 days'";
        break;
      default:
        dateFilter = "CURRENT_DATE";
    }

    const result = await pool.query(`
      SELECT 
        o.id_order,
        o.created_at,
        o.total_amount,
        u.first_name,
        u.last_name,
        json_agg(json_build_object(
          'product_name', p.name,
          'quantity', oi.quantity,
          'price', oi.price_per_unit
        )) as items
      FROM orders o
      JOIN users u ON o.id_user = u.id_user
      LEFT JOIN order_items oi ON o.id_order = oi.id_order
      LEFT JOIN products p ON oi.id_product = p.id_product
      WHERE o.created_at >= ${dateFilter}
      GROUP BY o.id_order, u.first_name, u.last_name
      ORDER BY o.created_at DESC
    `);

    // Генерация DOCX
    const docx = require('docx');
    const { Document, Packer, Paragraph, TextRun } = docx;

    const doc = new Document({
      sections: [
        {
          properties: {},
          children: [
            new Paragraph({
              children: [
                new TextRun({
                  text: 'Отчет по заказам',
                  bold: true,
                  size: 24,
                }),
              ],
            }),
            new Paragraph({
              text: `Период: ${period}`,
              spacing: { after: 120 },
            }),
            ...result.rows.map(order => {
              return new Paragraph({
                children: [
                  new TextRun(`Заказ ID: ${order.id_order}`).bold(),
                  new TextRun(` | Дата: ${new Date(order.created_at).toLocaleString()}`),
                  new TextRun(` | Сумма: ${order.total_amount} BYN`),
                  new TextRun(` | Клиент: ${order.first_name} ${order.last_name}`),
                  new TextRun('\nТовары:').bold(),
                  ...order.items.map(item => {
                    return new TextRun(`- ${item.product_name} (x${item.quantity}): ${item.price} BYN`);
                  }),
                ],
                spacing: { after: 120 },
              });
            }),
          ],
        },
      ],
    });

    const buffer = await Packer.toBuffer(doc);

    // Устанавливаем заголовки для скачивания файла
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': 'attachment; filename=orders_report.docx',
      'Content-Length': buffer.length,
    });

    // Отправляем файл
    res.send(buffer);
  } catch (error) {
    console.error('Ошибка генерации отчета:', error);
    res.status(500).json({ message: 'Ошибка генерации отчета' });
  }
});

// Скачивание аналитики в DOCX
app.post('/api/analytics/download', async (req, res) => {
  try {
    const { Document, Packer, Paragraph, Table, TableCell, TableRow, BorderStyle, WidthType, AlignmentType, HeadingLevel } = require('docx');

    const { day, week, month, year } = req.body;

    const doc = new Document({
      sections: [{
        children: [
          new Paragraph({
            text: 'АНАЛИТИКА ARTSHOP',
            heading: HeadingLevel.HEADING_1,
            alignment: AlignmentType.CENTER,
            spacing: { after: 200 }
          }),

          new Paragraph({
            text: `Дата отчёта: ${new Date().toLocaleDateString('ru-RU')}`,
            spacing: { after: 400 }
          }),

          // ===== ДЕНЬ =====
          new Paragraph({
            text: 'СТАТИСТИКА ПО ДНЯМ',
            heading: HeadingLevel.HEADING_2,
            spacing: { after: 200 }
          }),

          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph('Метрика')], shading: { fill: 'E0E0E0' } }),
                  new TableCell({ children: [new Paragraph('Значение')], shading: { fill: 'E0E0E0' } })
                ]
              }),
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph('Прибыль (BYN)')] }),
                  new TableCell({ children: [new Paragraph(day.profit)] })
                ]
              }),
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph('Заказов')] }),
                  new TableCell({ children: [new Paragraph(day.orderCount.toString())] })
                ]
              }),
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph('Товаров продано')] }),
                  new TableCell({ children: [new Paragraph(day.itemsSold.toString())] })
                ]
              }),
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph('Новых пользователей')] }),
                  new TableCell({ children: [new Paragraph(day.newUsers.toString())] })
                ]
              }),
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph('Средний чек (BYN)')] }),
                  new TableCell({ children: [new Paragraph(day.avgCheck)] })
                ]
              }),
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph('Средний рейтинг')] }),
                  new TableCell({ children: [new Paragraph(day.avgRating)] })
                ]
              })
            ]
          }),

          new Paragraph({ text: '', spacing: { after: 400 } }),

          // ===== НЕДЕЛЯ =====
          new Paragraph({
            text: 'СТАТИСТИКА ПО НЕДЕЛЯМ',
            heading: HeadingLevel.HEADING_2,
            spacing: { after: 200 }
          }),

          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph('Метрика')], shading: { fill: 'E0E0E0' } }),
                  new TableCell({ children: [new Paragraph('Значение')], shading: { fill: 'E0E0E0' } })
                ]
              }),
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph('Прибыль (BYN)')] }),
                  new TableCell({ children: [new Paragraph(week.profit)] })
                ]
              }),
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph('Заказов')] }),
                  new TableCell({ children: [new Paragraph(week.orderCount.toString())] })
                ]
              }),
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph('Товаров продано')] }),
                  new TableCell({ children: [new Paragraph(week.itemsSold.toString())] })
                ]
              }),
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph('Новых пользователей')] }),
                  new TableCell({ children: [new Paragraph(week.newUsers.toString())] })
                ]
              }),
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph('Средний чек (BYN)')] }),
                  new TableCell({ children: [new Paragraph(week.avgCheck)] })
                ]
              }),
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph('Средний рейтинг')] }),
                  new TableCell({ children: [new Paragraph(week.avgRating)] })
                ]
              })
            ]
          }),

          new Paragraph({ text: '', spacing: { after: 400 } }),

          // ===== МЕСЯЦ =====
          new Paragraph({
            text: 'СТАТИСТИКА ПО МЕСЯЦАМ',
            heading: HeadingLevel.HEADING_2,
            spacing: { after: 200 }
          }),

          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph('Метрика')], shading: { fill: 'E0E0E0' } }),
                  new TableCell({ children: [new Paragraph('Значение')], shading: { fill: 'E0E0E0' } })
                ]
              }),
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph('Прибыль (BYN)')] }),
                  new TableCell({ children: [new Paragraph(month.profit)] })
                ]
              }),
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph('Заказов')] }),
                  new TableCell({ children: [new Paragraph(month.orderCount.toString())] })
                ]
              }),
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph('Товаров продано')] }),
                  new TableCell({ children: [new Paragraph(month.itemsSold.toString())] })
                ]
              }),
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph('Новых пользователей')] }),
                  new TableCell({ children: [new Paragraph(month.newUsers.toString())] })
                ]
              }),
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph('Средний чек (BYN)')] }),
                  new TableCell({ children: [new Paragraph(month.avgCheck)] })
                ]
              }),
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph('Средний рейтинг')] }),
                  new TableCell({ children: [new Paragraph(month.avgRating)] })
                ]
              })
            ]
          }),

          new Paragraph({ text: '', spacing: { after: 400 } }),

          // ===== ГОД =====
          new Paragraph({
            text: 'СТАТИСТИКА ПО ГОДАМ',
            heading: HeadingLevel.HEADING_2,
            spacing: { after: 200 }
          }),

          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph('Метрика')], shading: { fill: 'E0E0E0' } }),
                  new TableCell({ children: [new Paragraph('Значение')], shading: { fill: 'E0E0E0' } })
                ]
              }),
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph('Прибыль (BYN)')] }),
                  new TableCell({ children: [new Paragraph(year.profit)] })
                ]
              }),
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph('Заказов')] }),
                  new TableCell({ children: [new Paragraph(year.orderCount.toString())] })
                ]
              }),
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph('Товаров продано')] }),
                  new TableCell({ children: [new Paragraph(year.itemsSold.toString())] })
                ]
              }),
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph('Новых пользователей')] }),
                  new TableCell({ children: [new Paragraph(year.newUsers.toString())] })
                ]
              }),
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph('Средний чек (BYN)')] }),
                  new TableCell({ children: [new Paragraph(year.avgCheck)] })
                ]
              }),
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph('Средний рейтинг')] }),
                  new TableCell({ children: [new Paragraph(year.avgRating)] })
                ]
              })
            ]
          })
        ]
      }]
    });

    const buffer = await Packer.toBuffer(doc);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="analytics_${new Date().toISOString().split('T')[0]}.docx"`);
    res.send(buffer);
  } catch (error) {
    console.error('Ошибка создания DOCX:', error);
    res.status(500).json({ message: 'Ошибка создания файла' });
  }
});
