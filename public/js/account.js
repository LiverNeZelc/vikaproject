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

  requestAnimationFrame(() => notification.classList.add('show'));

  setTimeout(() => {
    notification.classList.remove('show');
    setTimeout(() => notification.remove(), 250);
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
      btn.disabled = false;
    }
  } catch (error) {
    console.error('Ошибка входа:', error);
    showNotification('Ошибка подключения', 'error');
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
      btn.disabled = false;
    }
  } catch (error) {
    console.error('Ошибка регистрации:', error);
    showNotification('Ошибка подключения', 'error');
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

  // Редирект на главную — ГАРАНТИРОВАННЫЙ
  setTimeout(() => {
    window.location.href = '/';
  }, 1000);
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

function switchTab(tabName, btnEl) {
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(tab => {
    tab.classList.remove('active');
    tab.classList.add('hidden');
  });

  if (btnEl) {
    btnEl.classList.add('active');
  }

  const tab = document.getElementById(tabName + 'Tab');
  if (tab) {
    tab.classList.remove('hidden');
    tab.classList.add('active');
  }

  if (tabName === 'bonus') {
    loadBonusInfo();
  }
}

async function loadUserOrders() {
  try {
    // получаем актуального пользователя (из localStorage)
    const user = currentUser || JSON.parse(localStorage.getItem('user'));
    if (!user) return;

    const response = await fetch(`/api/orders/${user.id_user}`);
    const orders = await response.json();

    // Ищем контейнеры внутри модалки, если она создана
    const modal = document.getElementById('cabinetModal');
    const currentOrdersDiv = modal ? modal.querySelector('#currentOrders') : document.getElementById('currentOrders');
    const historyDiv = modal ? modal.querySelector('#orderHistory') : document.getElementById('orderHistory');

    if (!currentOrdersDiv || !historyDiv) {
      console.warn('Контейнеры для заказов не найдены (ни в модалке, ни в глобальном DOM)');
      return;
    }

    if (!orders || orders.length === 0) {
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
  // получаем актуальные данные пользователя (если есть)
  const userFromStorage = JSON.parse(localStorage.getItem('user')) || null;
  if (!userFromStorage) return;

  try {
    const response = await fetch(`/api/auth/user/${userFromStorage.id_user}`);
    if (!response.ok) throw new Error('Нет данных пользователя');
    const userData = await response.json();

    const bonusUnits = parseInt(userData.bonus) || 0;
    const bonusInByn = (bonusUnits * 0.1).toFixed(2);

    // Если модалка/контейнер не созданы — создаём их
    if (!document.getElementById('bonusTab') && typeof createCabinetModal === 'function') {
      createCabinetModal();
      await new Promise(r => setTimeout(r, 0));
    }

    const bonusTab = document.getElementById('bonusTab');
    const bonusAmountEl = document.getElementById('bonusAmount');
    const bonusPointsEl = document.getElementById('bonusPoints');

    if (bonusAmountEl) bonusAmountEl.textContent = bonusInByn;
    if (bonusPointsEl) bonusPointsEl.textContent = `${bonusUnits} бонусов`;

    if (bonusTab) {
      let container = bonusTab.querySelector('#bonusContainer');
      if (!container) {
        container = document.createElement('div');
        container.id = 'bonusContainer';
        container.className = 'orders-list';
        container.style.marginTop = '18px';
        bonusTab.appendChild(container);
      }
      container.innerHTML = `
        <div class="order-card bonus-single">
          <div class="order-header">
            <span class="order-number">Бонусный баланс</span>
            <span class="order-status completed">Актуально</span>
          </div>
          <div class="order-items">
            <div class="bonus-single-line">Доступно: <strong>${bonusUnits} бонусов</strong> — ${bonusInByn} BYN</div>
          </div>
        </div>
      `;
    }

    // Обновим localStorage и текущего пользователя в клиенте
    currentUser = userData;
    localStorage.setItem('user', JSON.stringify(userData));
  } catch (error) {
    // fallback — берем данные из localStorage, если сервер недоступен
    const bonusUnits = parseInt(userFromStorage.bonus) || 0;
    const bonusInByn = (bonusUnits * 0.1).toFixed(2);

    if (!document.getElementById('bonusTab') && typeof createCabinetModal === 'function') {
      createCabinetModal();
      await new Promise(r => setTimeout(r, 0));
    }

    const bonusTab = document.getElementById('bonusTab');
    const bonusAmountEl = document.getElementById('bonusAmount');
    const bonusPointsEl = document.getElementById('bonusPoints');

    if (bonusAmountEl) bonusAmountEl.textContent = bonusInByn;
    if (bonusPointsEl) bonusPointsEl.textContent = `${bonusUnits} бонусов`;

    if (bonusTab) {
      let container = bonusTab.querySelector('#bonusContainer');
      if (!container) {
        container = document.createElement('div');
        container.id = 'bonusContainer';
        container.className = 'orders-list';
        container.style.marginTop = '18px';
        bonusTab.appendChild(container);
      }
      container.innerHTML = `
        <div class="order-card bonus-single">
          <div class="order-header">
            <span class="order-number">Бонусный баланс</span>
            <span class="order-status completed">Актуально</span>
          </div>
          <div class="order-items">
            <div class="bonus-single-line">Доступно: <strong>${bonusUnits} бонусов</strong> — ${bonusInByn} BYN</div>
          </div>
        </div>
      `;
    }
  }
}

async function loadUserCards() {
  try {
    const response = await fetch(`/api/cards/${currentUser.id_user}`);
    const cards = await response.json();

    const select = document.getElementById('paymentCard');
    if (!select) return;
    select.innerHTML = '<option value="">Выберите карту</option>';

    cards.forEach(card => {
      const option = document.createElement('option');
      option.value = card.id_card;
      option.dataset.balance = parseFloat(card.balance).toFixed(2);
      option.dataset.last4 = card.card_number.slice(-4);
      option.textContent = `${card.cardholder_name} • **** ${option.dataset.last4} | Баланс: ${option.dataset.balance} BYN`;
      select.appendChild(option);
    });

    select.addEventListener('change', showSelectedCardInfo);
    showSelectedCardInfo();
  } catch (error) {
    console.error('Ошибка загрузки карт:', error);
  }
}

function showSelectedCardInfo() {
  const select = document.getElementById('paymentCard');
  const info = document.getElementById('paymentCardInfo');
  if (!select || !info) return;
  const opt = select.options[select.selectedIndex];
  if (!opt || !opt.value) {
    info.textContent = '';
    return;
  }
  const last4 = opt.dataset.last4 || '----';
  const balance = opt.dataset.balance || '0.00';
  info.textContent = `Карта: **** **** **** ${last4} — Баланс: ${parseFloat(balance).toFixed(2)} BYN`;
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
    document.getElementById('checkoutTotal').dataset.originalAmount = total.toFixed(2);

    // Ограничение бонусов
    const bonusSection = document.getElementById('bonusSection');
    if (bonusSection) {
      const userBonus = currentUser.bonus || 0;
      const maxByAmount = Math.floor(total * 10);
      const maxAllowed = Math.min(userBonus, maxByAmount);

      bonusSection.innerHTML = `
        <h3>Использование бонусов</h3>
        <div style="margin-bottom: 15px; padding: 12px; background-color: var(--light-color); border-radius: 8px;">
          <p style="margin-bottom: 8px; font-size: 14px;">Доступно бонусов: <strong>${userBonus}</strong> (макс. скидка: ${(userBonus*0.1).toFixed(2)} BYN)</p>
          <p style="margin-bottom: 10px; font-size: 12px; color: #666;">1 бонус = 0.10 BYN</p>
          <div style="display: flex; gap: 10px;">
            <input type="number" id="bonusInput" min="0" max="${maxAllowed}" value="0" placeholder="Кол-во бонусов" style="flex: 1; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px;">
            <button type="button" onclick="updateCheckoutTotal()" style="padding: 8px 16px; background-color: var(--primary-color); color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: 600;">Применить</button>
          </div>
          <p id="bonusMessage" style="margin-top: 8px; font-size: 12px; color: #666;"></p>
          <p id="bonusLimit" style="margin-top: 6px; font-size: 12px; color: #999;">Максимально допустимо бонусов: ${maxAllowed} (по сумме заказа: ${maxByAmount})</p>
        </div>
      `;
    }

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
  const bonusUsed = parseInt(document.getElementById('bonusInput')?.value) || 0;

  // Проверка по сумме
  const checkoutTotalEl = document.getElementById('checkoutTotal');
  const originalAmount = parseFloat(checkoutTotalEl?.dataset.originalAmount) || 0;
  if (bonusUsed * 0.1 > originalAmount) {
    showNotification('Нельзя использовать бонусов больше, чем сумма заказа', 'error');
    return;
  }

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
        delivery_address: deliveryAddress,
        bonus_used: bonusUsed
      })
    });

    const data = await response.json();

    if (response.ok) {
      showNotification(bonusUsed > 0 ? `Заказ создан! Использовано ${bonusUsed} бонусов` : 'Заказ успешно создан!');
      localStorage.removeItem('cart');
      updateCartCount();
      closeCheckoutModal();

      // Обновляем user в client-side (чтобы бонусы уменьшились в ЛК)
      try {
        const userResp = await fetch(`/api/auth/user/${currentUser.id_user}`);
        if (userResp.ok) {
          const updatedUser = await userResp.json();
          currentUser = updatedUser;
          localStorage.setItem('user', JSON.stringify(updatedUser));
          loadBonusInfo();
        }
      } catch (e) {
        console.warn('Не удалось обновить данные пользователя после заказа', e);
      }

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
  // Проверяем, уже ли создана модалка
  if (document.getElementById('cabinetModal')) {
    return;
  }

  const modal = document.createElement('div');
  modal.id = 'cabinetModal';
  modal.className = 'modal modal-cabinet';
  
  const modalContent = document.createElement('div');
  modalContent.className = 'modal-content';
  
  modalContent.innerHTML = `
    <span class="modal-close" onclick="closeCabinetModal()">&times;</span>
    
    <div class="cabinet-header">
      <h2>Личный кабинет</h2>
      <button onclick="logoutUser()" class="btn btn-logout">Выход</button>
    </div>

    <div class="cabinet-tabs">
      <button class="tab-btn active" onclick="switchTab('orders', this)">Заказы</button>
      <button class="tab-btn" onclick="switchTab('history', this)">История заказов</button>
      <button class="tab-btn" onclick="switchTab('bonus', this)">Бонусы</button>
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
          <div class="bonus-amount" id="bonusAmount">0.00</div>
          <div class="bonus-label">BYN в бонусах</div>
          <div id="bonusPoints" style="margin-top:8px; font-size:14px; color:#666;">0 бонусов</div>
        </div>
        <p class="bonus-info-text">1 бонус = 0.10 BYN<br>За каждую покупку вы получаете 20% от суммы заказа в виде бонусов</p>
      </div>

      <!-- новый контейнер, отображается как список заказов (одна карточка) -->
      <div id="bonusContainer" class="orders-list" style="margin-top:18px;"></div>
    </div>
  `;
  
  modal.appendChild(modalContent);
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
        <button class="modal-btn modal-btn_primary" onclick="goToCheckout()">Оформить заказ</button>
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
