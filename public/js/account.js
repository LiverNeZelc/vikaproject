let currentUser = null;
let currentOrderNumber = 1;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  checkUserStatus();
  updateCartCount();
});

function toggleForms() {
  const loginBox = document.getElementById('loginBox');
  const registerBox = document.getElementById('registerBox');
  loginBox.classList.toggle('hidden');
  registerBox.classList.toggle('hidden');
}

function showNotification(message, type = 'success') {
  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  notification.textContent = message;
  document.body.appendChild(notification);

  setTimeout(() => {
    notification.remove();
  }, 3000);
}

async function handleLogin(event) {
  event.preventDefault();
  
  const email = document.getElementById('loginEmail').value;
  const password = document.getElementById('loginPassword').value;
  const btn = event.target.querySelector('button');
  btn.disabled = true;

  try {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const data = await response.json();

    if (response.ok) {
      currentUser = data.user;
      localStorage.setItem('user', JSON.stringify(data.user));
      showNotification('Успешный вход!');
      setTimeout(() => {
        mergeGuestCart();
      }, 500);
    } else {
      showNotification(data.message || 'Ошибка входа', 'error');
    }
  } catch (error) {
    console.error('Ошибка входа:', error);
    showNotification('Ошибка подключения', 'error');
  } finally {
    btn.disabled = false;
  }
}

async function handleRegister(event) {
  event.preventDefault();

  const password = document.getElementById('regPassword').value;
  const passwordConfirm = document.getElementById('regPasswordConfirm').value;

  if (password !== passwordConfirm) {
    showNotification('Пароли не совпадают', 'error');
    return;
  }

  const userData = {
    email: document.getElementById('regEmail').value,
    first_name: document.getElementById('regFirstName').value,
    last_name: document.getElementById('regLastName').value,
    phone: document.getElementById('regPhone').value,
    password: password
  };

  const btn = event.target.querySelector('button');
  btn.disabled = true;

  try {
    const response = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userData)
    });

    const data = await response.json();

    if (response.ok) {
      currentUser = data.user;
      localStorage.setItem('user', JSON.stringify(data.user));
      showNotification('Регистрация успешна!');
      setTimeout(() => {
        mergeGuestCart();
      }, 500);
    } else {
      showNotification(data.message || 'Ошибка регистрации', 'error');
    }
  } catch (error) {
    console.error('Ошибка регистрации:', error);
    showNotification('Ошибка подключения', 'error');
  } finally {
    btn.disabled = false;
  }
}

async function mergeGuestCart() {
  const guestCart = JSON.parse(localStorage.getItem('cart')) || [];
  
  if (guestCart.length > 0 && currentUser) {
    try {
      const response = await fetch('/api/cart/merge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: currentUser.id_user,
          guest_cart: guestCart
        })
      });

      if (response.ok) {
        localStorage.removeItem('cart');
        showNotification('Корзина обновлена');
        updateCartCount();
      }
    } catch (error) {
      console.error('Ошибка слияния корзины:', error);
    }
  }

  showCabinet();
}

function checkUserStatus() {
  const user = localStorage.getItem('user');
  if (user) {
    currentUser = JSON.parse(user);
  }
}

function showCabinet() {
  if (!document.getElementById('userCabinet')) {
    return;
  }
  document.getElementById('authForms').classList.add('hidden');
  document.getElementById('userCabinet').classList.remove('hidden');
  document.getElementById('userName').textContent = `${currentUser.first_name} ${currentUser.last_name}`;
  loadUserOrders();
  loadBonusInfo();
  loadUserCards();
}

function logoutUser() {
  currentUser = null;
  localStorage.removeItem('user');
  if (document.getElementById('authForms')) {
    document.getElementById('authForms').classList.remove('hidden');
    document.getElementById('userCabinet').classList.add('hidden');
    document.getElementById('loginForm').reset();
    document.getElementById('registerForm').reset();
  }
  closeCabinetModal();
  showNotification('Вы вышли из аккаунта');
}

function switchTab(tabName) {
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(tab => tab.classList.add('hidden'));
  
  event.target.classList.add('active');
  document.getElementById(tabName + 'Tab').classList.remove('hidden');
}

async function loadUserOrders() {
  try {
    const response = await fetch(`/api/orders/${currentUser.id_user}`);
    const orders = await response.json();

    const currentOrdersDiv = document.getElementById('currentOrders');
    const historyDiv = document.getElementById('orderHistory');

    if (orders.length === 0) {
      currentOrdersDiv.innerHTML = '<div class="empty-state">Нет активных заказов</div>';
      historyDiv.innerHTML = '<div class="empty-state">История заказов пуста</div>';
      return;
    }

    const currentOrders = orders.filter(o => o.status !== 'completed');
    const historyOrders = orders.filter(o => o.status === 'completed');

    currentOrdersDiv.innerHTML = currentOrders.length === 0 
      ? '<div class="empty-state">Нет активных заказов</div>'
      : currentOrders.map(order => renderOrderCard(order)).join('');

    historyDiv.innerHTML = historyOrders.length === 0
      ? '<div class="empty-state">История заказов пуста</div>'
      : historyOrders.map(order => renderOrderCard(order)).join('');
  } catch (error) {
    console.error('Ошибка загрузки заказов:', error);
  }
}

function renderOrderCard(order) {
  return `
    <div class="order-card">
      <div class="order-header">
        <span class="order-number">Заказ #${order.id_order}</span>
        <span class="order-status ${order.status}">${order.status === 'pending' ? 'В ожидании' : 'Завершён'}</span>
      </div>
      <div class="order-date">${new Date(order.created_at).toLocaleDateString('ru-RU')}</div>
      <div class="order-items">${order.items_count} товаров</div>
      <div class="order-total">${order.total_amount.toFixed(2)} BYN</div>
    </div>
  `;
}

async function loadBonusInfo() {
  const bonusAmount = (currentUser.bonus / 10).toFixed(2);
  document.getElementById('bonusAmount').textContent = bonusAmount;
}

async function loadUserCards() {
  try {
    const response = await fetch(`/api/cards/${currentUser.id_user}`);
    const cards = await response.json();

    const select = document.getElementById('paymentCard');
    select.innerHTML = '<option value="">Выберите карту</option>';

    cards.forEach(card => {
      const option = document.createElement('option');
      option.value = card.id_card;
      option.textContent = `${card.cardholder_name} - **** ${card.card_number.slice(-4)}`;
      select.appendChild(option);
    });
  } catch (error) {
    console.error('Ошибка загрузки карт:', error);
  }
}

function updateCartCount() {
  if (currentUser) {
    fetchUserCart();
  } else {
    const cart = JSON.parse(localStorage.getItem('cart')) || [];
    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
    document.querySelector('.cart-count').textContent = totalItems;
  }
}

async function fetchUserCart() {
  try {
    const response = await fetch(`/api/cart/${currentUser.id_user}`);
    const data = await response.json();
    const totalItems = data.reduce((sum, item) => sum + item.quantity, 0);
    document.querySelector('.cart-count').textContent = totalItems;
  } catch (error) {
    console.error('Ошибка получения корзины:', error);
  }
}

function updateCartItems() {
  if (currentUser) {
    fetchCartItems();
  } else {
    updateGuestCartItems();
  }
}

async function fetchCartItems() {
  try {
    const response = await fetch(`/api/cart/${currentUser.id_user}`);
    const cart = await response.json();
    renderCartItems(cart);
  } catch (error) {
    console.error('Ошибка получения товаров корзины:', error);
  }
}

function updateGuestCartItems() {
  const cart = JSON.parse(localStorage.getItem('cart')) || [];
  renderCartItems(cart);
}

function renderCartItems(cart) {
  const cartItemsDiv = document.getElementById('cartItems');

  if (cart.length === 0) {
    cartItemsDiv.innerHTML = '<div class="empty-cart"><p>Корзина пуста</p></div>';
    document.getElementById('cartTotal').textContent = '0 BYN';
    return;
  }

  let totalPrice = 0;
  cartItemsDiv.innerHTML = cart.map(item => {
    const itemTotal = item.price * item.quantity;
    totalPrice += itemTotal;
    return `
      <div class="cart-item">
        <div class="cart-item-info">
          <div class="cart-item-name">${item.name}</div>
          <div class="cart-item-quantity">Цена: ${item.price.toFixed(2)} BYN</div>
        </div>
        <div class="cart-item-controls">
          <button class="quantity-btn" onclick="changeQuantity(${item.id}, -1)">−</button>
          <div class="quantity-display">${item.quantity}</div>
          <button class="quantity-btn" onclick="changeQuantity(${item.id}, 1)">+</button>
        </div>
        <div class="cart-item-price">${itemTotal.toFixed(2)} BYN</div>
        <button class="cart-item-remove" onclick="removeFromCart(${item.id})">Удалить</button>
      </div>
    `;
  }).join('');

  document.getElementById('cartTotal').textContent = totalPrice.toFixed(2) + ' BYN';
}

function changeQuantity(productId, change) {
  if (currentUser) {
    changeUserCartQuantity(productId, change);
  } else {
    changeGuestCartQuantity(productId, change);
  }
}

function changeGuestCartQuantity(productId, change) {
  const cart = JSON.parse(localStorage.getItem('cart')) || [];
  const item = cart.find(i => i.id === productId);

  if (item) {
    item.quantity += change;
    if (item.quantity <= 0) {
      removeFromCart(productId);
    } else {
      localStorage.setItem('cart', JSON.stringify(cart));
      updateCartCount();
      updateCartItems();
    }
  }
}

async function changeUserCartQuantity(productId, change) {
  try {
    const response = await fetch('/api/cart/quantity', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: currentUser.id_user,
        product_id: productId,
        change: change
      })
    });

    if (response.ok) {
      updateCartCount();
      updateCartItems();
    }
  } catch (error) {
    console.error('Ошибка изменения количества:', error);
  }
}

function removeFromCart(productId) {
  if (currentUser) {
    removeUserCartItem(productId);
  } else {
    removeGuestCartItem(productId);
  }
}

function removeGuestCartItem(productId) {
  let cart = JSON.parse(localStorage.getItem('cart')) || [];
  cart = cart.filter(item => item.id !== productId);
  localStorage.setItem('cart', JSON.stringify(cart));
  updateCartCount();
  updateCartItems();
  showNotification('Товар удален из корзины', 'info');
}

async function removeUserCartItem(productId) {
  try {
    const response = await fetch('/api/cart/item', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: currentUser.id_user,
        product_id: productId
      })
    });

    if (response.ok) {
      updateCartCount();
      updateCartItems();
      showNotification('Товар удален из корзины', 'info');
    }
  } catch (error) {
    console.error('Ошибка удаления товара:', error);
  }
}

function showCartModal() {
  if (!currentUser) {
    showNotification('Пожалуйста, авторизуйтесь', 'error');
    return;
  }

  let modal = document.getElementById('cartModal');
  if (!modal) {
    createCartModal();
    modal = document.getElementById('cartModal');
  }
  updateCartItems();
  modal.classList.add('active');
}

function closeCartModal() {
  const modal = document.getElementById('cartModal');
  if (modal) {
    modal.classList.remove('active');
  }
}

function goToCheckout() {
  if (!currentUser) {
    showNotification('Пожалуйста, авторизуйтесь', 'error');
    return;
  }

  closeCartModal();
  prepareCheckout();
}

async function prepareCheckout() {
  try {
    const cart = await fetch(`/api/cart/${currentUser.id_user}`).then(r => r.json());
    
    if (cart.length === 0) {
      showNotification('Корзина пуста', 'error');
      return;
    }

    const orderNumberResponse = await fetch(`/api/orders/next-number/${currentUser.id_user}`);
    const { nextNumber } = await orderNumberResponse.json();
    currentOrderNumber = nextNumber;

    document.getElementById('orderNumber').textContent = `#${String(nextNumber).padStart(5, '0')}`;
    
    const checkoutItemsDiv = document.getElementById('checkoutItems');
    let total = 0;
    
    checkoutItemsDiv.innerHTML = cart.map(item => {
      const itemTotal = item.price * item.quantity;
      total += itemTotal;
      return `
        <div class="checkout-item">
          <div class="checkout-item-name">${item.name}</div>
          <div class="checkout-item-qty">x${item.quantity}</div>
          <div class="checkout-item-price">${itemTotal.toFixed(2)} BYN</div>
        </div>
      `;
    }).join('');

    document.getElementById('checkoutTotal').textContent = total.toFixed(2) + ' BYN';
    document.getElementById('deliveryAddress').value = currentUser.address || '';

    document.getElementById('checkoutModal').classList.add('active');
  } catch (error) {
    console.error('Ошибка подготовки оформления:', error);
    showNotification('Ошибка подготовки заказа', 'error');
  }
}

function closeCheckoutModal() {
  document.getElementById('checkoutModal').classList.remove('active');
}

function showAddCardForm() {
  document.getElementById('addCardForm').classList.remove('hidden');
}

function hideAddCardForm() {
  document.getElementById('addCardForm').classList.add('hidden');
}

async function addNewCard() {
  const cardNumber = document.getElementById('cardNumber').value.replace(/\s/g, '');
  const cardName = document.getElementById('cardName').value;
  const expiryDate = document.getElementById('cardExpiry').value;

  if (cardNumber.length !== 16) {
    showNotification('Неверный номер карты', 'error');
    return;
  }

  try {
    const response = await fetch('/api/cards/add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: currentUser.id_user,
        card_number: cardNumber,
        cardholder_name: cardName,
        expiry_date: expiryDate
      })
    });

    if (response.ok) {
      showNotification('Карта добавлена успешно');
      hideAddCardForm();
      document.getElementById('cardNumber').value = '';
      document.getElementById('cardName').value = '';
      document.getElementById('cardExpiry').value = '';
      document.getElementById('cardCvv').value = '';
      loadUserCards();
    } else {
      showNotification('Ошибка добавления карты', 'error');
    }
  } catch (error) {
    console.error('Ошибка добавления карты:', error);
    showNotification('Ошибка подключения', 'error');
  }
}

async function handleCheckout(event) {
  event.preventDefault();

  const cardId = document.getElementById('paymentCard').value;
  const deliveryAddress = document.getElementById('deliveryAddress').value;

  if (!cardId) {
    showNotification('Пожалуйста, выберите способ оплаты', 'error');
    return;
  }

  try {
    const response = await fetch('/api/orders/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: currentUser.id_user,
        card_id: cardId,
        delivery_address: deliveryAddress
      })
    });

    const data = await response.json();

    if (response.ok) {
      showNotification('Заказ успешно создан!');
      localStorage.removeItem('cart');
      updateCartCount();
      closeCheckoutModal();
      
      setTimeout(() => {
        location.reload();
      }, 1500);
    } else {
      showNotification(data.message || 'Ошибка создания заказа', 'error');
    }
  } catch (error) {
    console.error('Ошибка оформления заказа:', error);
    showNotification('Ошибка подключения', 'error');
  }
}

function showCabinetModal() {
  if (!currentUser) {
    showNotification('Пожалуйста, авторизуйтесь', 'error');
    return;
  }

  let modal = document.getElementById('cabinetModal');
  if (!modal) {
    createCabinetModal();
    modal = document.getElementById('cabinetModal');
  }
  
  loadUserOrders();
  loadBonusInfo();
  loadUserCards();
  modal.classList.add('active');
}

function closeCabinetModal() {
  const modal = document.getElementById('cabinetModal');
  if (modal) {
    modal.classList.remove('active');
  }
}

function createCabinetModal() {
  const modal = document.createElement('div');
  modal.id = 'cabinetModal';
  modal.className = 'modal modal-cabinet';
  modal.innerHTML = `
    <div class="modal-content modal-cabinet-content">
      <span class="modal-close" onclick="closeCabinetModal()">&times;</span>
      
      <div class="cabinet-header">
        <h2>Личный кабинет</h2>
        <button onclick="logoutUser()" class="btn btn-logout">Выход</button>
      </div>

      <div class="cabinet-tabs">
        <button class="tab-btn active" onclick="switchTab('orders')">Заказы</button>
        <button class="tab-btn" onclick="switchTab('history')">История заказов</button>
        <button class="tab-btn" onclick="switchTab('bonus')">Бонусы</button>
      </div>

      <div class="tab-content active" id="ordersTab">
        <h3>Текущие заказы</h3>
        <div id="currentOrders" class="orders-list"></div>
      </div>

      <div class="tab-content hidden" id="historyTab">
        <h3>История заказов</h3>
        <div id="orderHistory" class="orders-list"></div>
      </div>

      <div class="tab-content hidden" id="bonusTab">
        <h3>Мои бонусы</h3>
        <div class="bonus-info">
          <div class="bonus-card">
            <div class="bonus-amount" id="bonusAmount">0</div>
            <div class="bonus-label">BYN в бонусах</div>
          </div>
          <p class="bonus-info-text">1 бонус = 0.10 BYN<br>За каждую покупку вы получаете 5% от суммы заказа в виде бонусов</p>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      closeCabinetModal();
    }
  });
}

function createCartModal() {
  const modal = document.createElement('div');
  modal.id = 'cartModal';
  modal.className = 'modal';
  modal.innerHTML = `
    <div class="modal-content modal-cart">
      <span class="modal-close" onclick="closeCartModal()">&times;</span>
      <h2>Корзина покупок</h2>
      
      <div id="cartItems" class="cart-items"></div>
      
      <div class="cart-summary">
        <div class="cart-total">
          <strong>Итого:</strong>
          <strong id="cartTotal">0 BYN</strong>
        </div>
      </div>

      <div class="modal-actions">
        <button class="modal-btn modal-btn-secondary" onclick="closeCartModal()">Продолжить покупки</button>
        <button class="modal-btn modal-btn-primary" onclick="goToCheckout()">Оформить заказ</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      closeCartModal();
    }
  });
}
