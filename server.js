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

app.get('/cart', (req, res) => {
  res.send('Страница корзины');
});

// API Routes
app.get('/api/products', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM products WHERE is_active = true ORDER BY created_at DESC');
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

    for (const item of cartResult.rows) {
      await pool.query(`
        INSERT INTO order_items (id_order, id_product, quantity, price_per_unit)
        VALUES ($1, $2, $3, $4)
      `, [orderId, item.id_product, item.quantity, item.price]);
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
