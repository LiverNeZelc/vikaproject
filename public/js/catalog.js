let allProducts = [];
let filteredProducts = [];

const productsGrid = document.getElementById('productsGrid');
const searchInput = document.getElementById('searchInput');
const categoryFilter = document.getElementById('categoryFilter');
const sortSelect = document.getElementById('sortSelect');

// Load products from database
async function loadProducts() {
  try {
    const response = await fetch('/api/products');
    allProducts = await response.json();
    filteredProducts = [...allProducts];
    renderProducts(filteredProducts);
  } catch (error) {
    console.error('Ошибка загрузки товаров:', error);
    productsGrid.innerHTML = '<p>Ошибка загрузки товаров</p>';
  }
}

function renderProducts(products) {
  if (products.length === 0) {
    productsGrid.innerHTML = '<p style="text-align: center; grid-column: 1/-1;">Товары не найдены</p>';
    return;
  }

  productsGrid.innerHTML = products.map(product => `
    <div class="product-card">
      <img src="${product.image_url}" alt="${product.name}" class="product-image">
      <div class="product-info">
        <h3 class="product-name">${product.name}</h3>
        <p class="product-description">${product.description}</p>
        <div class="product-price">${parseFloat(product.price).toFixed(2)} BYN</div>
        <p class="product-stock">Осталось: ${product.quantity_in_stock} шт.</p>
        <button class="add-to-cart-btn" ${product.quantity_in_stock === 0 ? 'disabled' : ''} onclick="addToCart(${product.id_product}, '${product.name.replace(/'/g, "\\'")}', ${product.price})">
          ${product.quantity_in_stock === 0 ? 'Нет в наличии' : 'В корзину'}
        </button>
      </div>
    </div>
  `).join('');
}

function applyFiltersAndSort() {
  const selectedCategory = categoryFilter.value;
  const sortBy = sortSelect.value;
  const searchQuery = searchInput.value.toLowerCase();

  // Фильтрация по категориям и поиску
  let result = allProducts.filter(product => {
    const matchesCategory = selectedCategory === '' || product.category === selectedCategory;
    const matchesSearch = searchQuery === '' || 
      product.name.toLowerCase().includes(searchQuery) ||
      product.description.toLowerCase().includes(searchQuery);
    
    return matchesCategory && matchesSearch;
  });

  // Сортировка
  if (sortBy === 'price-asc') {
    result.sort((a, b) => a.price - b.price);
  } else if (sortBy === 'price-desc') {
    result.sort((a, b) => b.price - a.price);
  } else if (sortBy === 'newest') {
    result.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }

  filteredProducts = result;
  renderProducts(filteredProducts);
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

function addToCart(productId, productName, price) {
  const currentUser = JSON.parse(localStorage.getItem('user'));
  
  if (currentUser) {
    // Авторизованный пользователь - добавляем в БД
    addToUserCart(productId, productName, price);
  } else {
    // Гость - добавляем in localStorage
    const cart = JSON.parse(localStorage.getItem('cart')) || [];
    const existingItem = cart.find(item => item.id === productId);

    if (existingItem) {
      existingItem.quantity += 1;
    } else {
      cart.push({ id: productId, name: productName, price: parseFloat(price), quantity: 1 });
    }

    localStorage.setItem('cart', JSON.stringify(cart));
    updateCartCount();
    showNotification(`"${productName}" добавлен в корзину!`);
  }
}

async function addToUserCart(productId, productName, price) {
  const currentUser = JSON.parse(localStorage.getItem('user'));
  
  try {
    // Получаем текущую корзину пользователя
    const cartResponse = await fetch(`/api/cart/${currentUser.id_user}`);
    const currentCart = await cartResponse.json();
    
    // Проверяем, есть ли товар в корзине
    const existingItem = currentCart.find(item => item.id === productId);
    
    if (existingItem) {
      // Если товар есть, увеличиваем количество
      await fetch('/api/cart/quantity', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: currentUser.id_user,
          product_id: productId,
          change: 1
        })
      });
    } else {
      // Если товара нет, добавляем его
      const cartResult = await fetch(`/api/carts/user/${currentUser.id_user}`);
      const carts = await cartResult.json();
      let cartId = carts[0]?.id_cart;
      
      if (!cartId) {
        // Создаем новую корзину если её нет
        const newCartResponse = await fetch('/api/carts/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: currentUser.id_user })
        });
        const newCart = await newCartResponse.json();
        cartId = newCart.id_cart;
      }
      
      await fetch('/api/cart/add-item', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cart_id: cartId,
          product_id: productId,
          quantity: 1
        })
      });
    }
    
    updateCartCount();
    showNotification(`"${productName}" добавлен в корзину!`);
  } catch (error) {
    console.error('Ошибка добавления товара в корзину:', error);
    showNotification('Ошибка при добавлении товара', 'error');
  }
}

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
    document.querySelector('.cart-count').textContent = '0';
  }
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
      
      // Обновляем данные пользователя с новым бонусом
      const updatedUser = await fetch(`/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: currentUser.email
        })
      }).catch(() => null);
      
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
  console.log('🔍 loadBonusInfo - текущий пользователь:', currentUser);
  
  try {
    const response = await fetch(`/api/auth/user/${currentUser.id_user}`);
    console.log('📡 Ответ сервера статус:', response.status);
    
    const userData = await response.json();
    console.log('📊 Данные пользователя от сервера:', userData);
    
    const bonusAmount = parseFloat(userData.bonus);
    console.log('💰 Распарсен бонус:', bonusAmount);
    
    const bonusElement = document.getElementById('bonusAmount');
    console.log('🎯 Элемент bonusAmount:', bonusElement);
    
    if (bonusElement) {
      bonusElement.textContent = bonusAmount.toFixed(2);
      console.log('✅ Бонус успешно установлен:', bonusAmount.toFixed(2));
    } else {
      console.error('❌ Элемент bonusAmount не найден в DOM');
    }
  } catch (error) {
    console.error('❌ Ошибка загрузки бонусов:', error);
    const bonusAmount = parseFloat(currentUser.bonus);
    console.log('📌 Использую бонус из localStorage:', bonusAmount);
    
    const bonusElement = document.getElementById('bonusAmount');
    if (bonusElement) {
      bonusElement.textContent = bonusAmount.toFixed(2);
    }
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
  modal.style.display = 'none';
  
  const modalContent = document.createElement('div');
  modalContent.className = 'modal-content modal-cabinet-content';
  
  modalContent.innerHTML = `
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
  `;
  
  modal.appendChild(modalContent);
  document.body.appendChild(modal);
  console.log('✅ Modal кабинета создан и добавлен в DOM');

  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      closeCabinetModal();
    }
  });
}

// Event listeners
searchInput.addEventListener('input', applyFiltersAndSort);
categoryFilter.addEventListener('change', applyFiltersAndSort);
sortSelect.addEventListener('change', applyFiltersAndSort);

// Initial load
loadProducts();
updateCartCount();
