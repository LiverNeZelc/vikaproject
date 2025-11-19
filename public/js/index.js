let currentSlideIndex = 0;

function showSlide(index) {
  const slides = document.querySelectorAll('.slide');
  const dots = document.querySelectorAll('.dot');

  if (index >= slides.length) {
    currentSlideIndex = 0;
  } else if (index < 0) {
    currentSlideIndex = slides.length - 1;
  }

  slides.forEach(slide => slide.classList.remove('active'));
  dots.forEach(dot => dot.classList.remove('active'));

  slides[currentSlideIndex].classList.add('active');
  dots[currentSlideIndex].classList.add('active');
}

function changeSlide(n) {
  currentSlideIndex += n;
  showSlide(currentSlideIndex);
}

function currentSlide(index) {
  currentSlideIndex = index;
  showSlide(currentSlideIndex);
}

// Auto-slide every 5 seconds
setInterval(() => {
  changeSlide(1);
}, 5000);

// Cart and Cabinet functions
function updateCartCount() {
  const currentUser = JSON.parse(localStorage.getItem('user'));
  if (currentUser) {
    fetchUserCart();
  } else {
    const cart = JSON.parse(localStorage.getItem('cart')) || [];
    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
    document.querySelector('.cart-count').textContent = totalItems;
  }
}

async function fetchUserCart() {
  const currentUser = JSON.parse(localStorage.getItem('user'));
  try {
    const response = await fetch(`/api/cart/${currentUser.id_user}`);
    const data = await response.json();
    const totalItems = data.reduce((sum, item) => sum + item.quantity, 0);
    document.querySelector('.cart-count').textContent = totalItems;
  } catch (error) {
    console.error('Ошибка получения корзины:', error);
  }
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

function showCartModal() {
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

function updateCartItems() {
  const currentUser = JSON.parse(localStorage.getItem('user'));
  if (currentUser) {
    fetchCartItems();
  } else {
    updateGuestCartItems();
  }
}

async function fetchCartItems() {
  const currentUser = JSON.parse(localStorage.getItem('user'));
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
  const currentUser = JSON.parse(localStorage.getItem('user'));

  if (!cart || cart.length === 0) {
    cartItemsDiv.innerHTML = '<div class="empty-cart"><p>Корзина пуста</p></div>';
    document.getElementById('cartTotal').textContent = '0 BYN';
    document.querySelector('.cart-count').textContent = '0';
    
    const modalActions = document.querySelector('.modal-actions');
    if (modalActions) {
      modalActions.innerHTML = `
        <button class="modal-btn modal-btn-secondary" onclick="closeCartModal()">Продолжить покупки</button>
        <button class="modal-btn modal-btn-primary" disabled style="opacity: 0.5; cursor: not-allowed;">Оформить заказ</button>
      `;
    }
    return;
  }

  let totalPrice = 0;
  cartItemsDiv.innerHTML = cart.map(item => {
    const price = parseFloat(item.price);
    const itemTotal = price * item.quantity;
    totalPrice += itemTotal;
    return `
      <div class="cart-item">
        <div class="cart-item-info">
          <div class="cart-item-name">${item.name}</div>
          <div class="cart-item-quantity">Цена: ${price.toFixed(2)} BYN</div>
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
  
  const modalActions = document.querySelector('.modal-actions');
  if (modalActions) {
    if (currentUser) {
      modalActions.innerHTML = `
        <button class="modal-btn modal-btn-secondary" onclick="closeCartModal()">Продолжить покупки</button>
        <button class="modal-btn modal-btn-primary" onclick="goToCheckout()">Оформить заказ</button>
      `;
    } else {
      modalActions.innerHTML = `
        <button class="modal-btn modal-btn-secondary" onclick="closeCartModal()">Продолжить покупки</button>
        <button class="modal-btn modal-btn-primary" disabled style="opacity: 0.5; cursor: not-allowed;" title="Авторизуйтесь для оформления заказа">Оформить заказ</button>
      `;
    }
  }
}

function changeQuantity(productId, change) {
  const currentUser = JSON.parse(localStorage.getItem('user'));
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
  const currentUser = JSON.parse(localStorage.getItem('user'));
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
  const currentUser = JSON.parse(localStorage.getItem('user'));
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
  const currentUser = JSON.parse(localStorage.getItem('user'));
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

function goToCheckout() {
  const currentUser = JSON.parse(localStorage.getItem('user'));
  if (!currentUser) {
    showNotification('Пожалуйста, авторизуйтесь', 'error');
    return;
  }

  closeCartModal();
  prepareCheckout();
}

async function prepareCheckout() {
  const currentUser = JSON.parse(localStorage.getItem('user'));
  try {
    const cart = await fetch(`/api/cart/${currentUser.id_user}`).then(r => r.json());
    
    if (cart.length === 0) {
      showNotification('Корзина пуста', 'error');
      return;
    }

    const orderNumberResponse = await fetch(`/api/orders/next-number/${currentUser.id_user}`);
    const { nextNumber } = await orderNumberResponse.json();

    const orderNumberElement = document.getElementById('orderNumber');
    if (orderNumberElement) {
      orderNumberElement.textContent = `#${String(nextNumber).padStart(5, '0')}`;
    }
    
    const checkoutItemsDiv = document.getElementById('checkoutItems');
    if (checkoutItemsDiv) {
      let total = 0;
      
      checkoutItemsDiv.innerHTML = cart.map(item => {
        const price = parseFloat(item.price);
        const itemTotal = price * item.quantity;
        total += itemTotal;
        return `
          <div class="checkout-item">
            <div class="checkout-item-name">${item.name}</div>
            <div class="checkout-item-qty">x${item.quantity}</div>
            <div class="checkout-item-price">${itemTotal.toFixed(2)} BYN</div>
          </div>
        `;
      }).join('');

      const checkoutTotalElement = document.getElementById('checkoutTotal');
      if (checkoutTotalElement) {
        checkoutTotalElement.textContent = total.toFixed(2) + ' BYN';
      }
    }

    const deliveryAddressElement = document.getElementById('deliveryAddress');
    if (deliveryAddressElement) {
      deliveryAddressElement.value = currentUser.address || '';
    }

    // Загрузить карты перед открытием модального окна
    await loadUserCards();

    const checkoutModal = document.getElementById('checkoutModal');
    if (checkoutModal) {
      checkoutModal.classList.add('active');
    }
  } catch (error) {
    console.error('Ошибка подготовки оформления:', error);
    showNotification('Ошибка подготовки заказа', 'error');
  }
}

function closeCheckoutModal() {
  document.getElementById('checkoutModal').classList.remove('active');
}

async function loadUserCards() {
  const currentUser = JSON.parse(localStorage.getItem('user'));
  try {
    const response = await fetch(`/api/cards/${currentUser.id_user}`);
    const cards = await response.json();

    const select = document.getElementById('paymentCard');
    select.innerHTML = '<option value="">Выберите карту</option>';

    cards.forEach(card => {
      const option = document.createElement('option');
      option.value = card.id_card;
      const cardDisplay = `**** **** **** ${card.card_number.slice(-4)} | Баланс: ${parseFloat(card.balance).toFixed(2)} BYN`;
      option.textContent = cardDisplay;
      select.appendChild(option);
    });
  } catch (error) {
    console.error('Ошибка загрузки карт:', error);
  }
}

async function handleCheckout(event) {
  event.preventDefault();

  const currentUser = JSON.parse(localStorage.getItem('user'));
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
  const currentUser = JSON.parse(localStorage.getItem('user'));
  if (!currentUser) {
    window.location.href = '/account';
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

function switchTab(tabName) {
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(tab => tab.classList.add('hidden'));
  
  event.target.classList.add('active');
  document.getElementById(tabName + 'Tab').classList.remove('hidden');
}

async function loadUserOrders() {
  const currentUser = JSON.parse(localStorage.getItem('user'));
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
  const itemsList = order.items && order.items.length > 0 
    ? order.items.map(item => `<div class="order-item-detail">• ${item.product_name} x${item.quantity}</div>`).join('')
    : '<div class="order-item-detail">Товары не указаны</div>';

  return `
    <div class="order-card">
      <div class="order-header">
        <span class="order-number">Заказ #${String(order.id_order).padStart(5, '0')}</span>
        <span class="order-status ${order.status}">${order.status === 'pending' ? 'В ожидании' : 'Завершён'}</span>
      </div>
      <div class="order-date">${new Date(order.created_at).toLocaleDateString('ru-RU')}</div>
      <div class="order-address">📍 ${order.delivery_address}</div>
      <div class="order-items-list">${itemsList}</div>
      <div class="order-total">Сумма: ${parseFloat(order.total_amount).toFixed(2)} BYN</div>
    </div>
  `;
}

async function loadBonusInfo() {
  const currentUser = JSON.parse(localStorage.getItem('user'));
  try {
    const response = await fetch(`/api/auth/user/${currentUser.id_user}`);
    const userData = await response.json();
    const bonusAmount = parseFloat(userData.bonus);
    document.getElementById('bonusAmount').textContent = bonusAmount.toFixed(2);
  } catch (error) {
    console.error('Ошибка загрузки бонусов:', error);
    const bonusAmount = parseFloat(currentUser.bonus);
    document.getElementById('bonusAmount').textContent = bonusAmount.toFixed(2);
  }
}

function logoutUser() {
  localStorage.removeItem('user');
  closeCabinetModal();
  window.location.href = '/account';
  showNotification('Вы вышли из аккаунта');
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
            <div class="bonus-label">бонусов</div>
          </div>
          <p class="bonus-info-text">1 бонус = 10 копеек</p>
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

// Initialize
showSlide(currentSlideIndex);
updateCartCount();
