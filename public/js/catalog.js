let allProducts = [];
let filteredProducts = [];

let productsGrid;
let searchInput;
let categoryFilter;
let sortSelect;

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
    <div class="product-card" onclick="showProductModal(${product.id_product}, '${product.name.replace(/'/g, "\\'")}', '${product.image_url}', ${product.price}, ${product.quantity_in_stock}, '${product.description.replace(/'/g, "\\'")}')" style="cursor: pointer;">
      <img src="${product.image_url}" alt="${product.name}" class="product-image">
      <div class="product-info">
        <h3 class="product-name">${product.name}</h3>
        <p class="product-description">${product.description}</p>
        <div class="product-price">${parseFloat(product.price).toFixed(2)} BYN</div>
        <p class="product-stock">Осталось: ${product.quantity_in_stock} шт.</p>
        <button class="add-to-cart-btn" ${product.quantity_in_stock === 0 ? 'disabled' : ''} onclick="event.stopPropagation(); addToCart(${product.id_product}, '${product.name.replace(/'/g, "\\'")}', ${product.price})">
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

  // trigger enter animation
  requestAnimationFrame(() => notification.classList.add('show'));

  // remove after 3s with fade-out
  setTimeout(() => {
    notification.classList.remove('show');
    setTimeout(() => notification.remove(), 250);
  }, 3000);
}

function addToCart(productId, productName, price) {
  const currentUser = JSON.parse(localStorage.getItem('user'));
  
  // Админ не может добавлять товары в корзину
  if (currentUser && currentUser.role === 'admin') {
    showNotification('Администраторы не могут добавлять товары в корзину', 'error');
    return;
  }
  
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
    showNotification(`"Товар ${productName}" добавлен в корзину!`);
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
    showNotification(`"Товар ${productName}" добавлен в корзину!`);
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
  const currentUser = JSON.parse(localStorage.getItem('user'));
  
  // Админ не может открыть корзину
  if (currentUser && currentUser.role === 'admin') {
    showNotification('Администраторы не могут использовать корзину', 'error');
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
        checkoutTotalElement.dataset.originalAmount = total.toFixed(2);
      }

      // Показываем раздел бонусов (и задаём max для input по сумме и по балансу)
      const bonusSection = document.getElementById('bonusSection');
      if (bonusSection) {
        const userBonus = currentUser.bonus || 0;
        // максимум бонусов, который покрывает сумму = floor(total / 0.1) = floor(total * 10)
        const maxByAmount = Math.floor(total * 10);
        const maxAllowed = Math.min(userBonus, maxByAmount);

        bonusSection.innerHTML = `
          <h3>Использование бонусов</h3>
          <div style="margin-bottom: 15px; padding: 12px; background-color: var(--light-color); border-radius: 8px;">
            <p style="margin-bottom: 8px; font-size: 14px;">Доступно бонусов: <strong>${userBonus}</strong> (макс. скидка: ${(userBonus*0.1).toFixed(2)} BYN)</p>
            <p style="margin-bottom: 10px; font-size: 12px; color: #666;">1 бонус = 0.10 BYN</p>
            <div style="display: flex; gap: 10px; align-items: center;">
              <input type="number" id="bonusInput" min="0" max="${maxAllowed}" value="0" placeholder="Кол-во бонусов для использования" style="flex: 1; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px;">
              <button type="button" onclick="updateCheckoutTotal()" style="padding: 8px 16px; background-color: var(--primary-color); color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: 600;">Применить</button>
            </div>
            <p id="bonusMessage" style="margin-top: 8px; font-size: 12px; color: #666;"></p>
            <p id="bonusLimit" style="margin-top: 6px; font-size: 12px; color: #999;">Максимально допустимо бонусов: ${maxAllowed} (по сумме заказа: ${maxByAmount})</p>
          </div>
        `;
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

function updateCheckoutTotal() {
  const bonusInput = document.getElementById('bonusInput');
  if (!bonusInput) return;

  // валидируем введённое количество бонусов
  let usedBonus = parseInt(bonusInput.value, 10);
  if (isNaN(usedBonus) || usedBonus < 0) {
    usedBonus = 0;
    bonusInput.value = 0;
  }

  // получаем доступные бонусы из currentUser (localStorage)
  const storedUser = JSON.parse(localStorage.getItem('user')) || null;
  const storedAvailable = storedUser ? parseInt(storedUser.bonus) || 0 : 0;

  // получаем оригинальную сумму (BYN) и считаем максимум бонусов по сумме
  const checkoutTotalEl = document.getElementById('checkoutTotal');
  const originalAmount = parseFloat(checkoutTotalEl?.dataset.originalAmount) || 0;
  const maxByAmount = Math.floor(originalAmount * 10);
  const available = Math.min(storedAvailable, maxByAmount);

  if (usedBonus > available) {
    showNotification('Недостаточно бонусов или превышен лимит по сумме заказа', 'error');
    usedBonus = available;
    bonusInput.value = available;
  }

  const discount = usedBonus * 0.1;
  const finalAmount = Math.max(0, originalAmount - discount);

  if (checkoutTotalEl) {
    checkoutTotalEl.textContent = finalAmount.toFixed(2) + ' BYN';
  }

  const bonusMessage = document.getElementById('bonusMessage');
  if (bonusMessage) {
    bonusMessage.textContent = usedBonus > 0 ? `Скидка от бонусов: -${discount.toFixed(2)} BYN` : '';
  }

  // обновим атрибут max на случай изменения суммы
  bonusInput.max = Math.min(storedAvailable, maxByAmount);
}

async function handleCheckout(event) {
  event.preventDefault();

  const currentUser = JSON.parse(localStorage.getItem('user'));
  const cardId = document.getElementById('paymentCard').value;
  const deliveryAddress = document.getElementById('deliveryAddress').value;
  const bonusUsed = parseInt(document.getElementById('bonusInput')?.value) || 0;

  // Проверка: бонусы не больше суммы
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
      const message = bonusUsed > 0 
        ? `Заказ создан! Использовано ${bonusUsed} бонусов (-${(bonusUsed * 0.1).toFixed(2)} BYN)` 
        : 'Заказ успешно создан!';
      showNotification(message);
      localStorage.removeItem('cart');
      updateCartCount();
      closeCheckoutModal();

      // Обновляем данные пользователя (чтобы бонусы уменьшились в UI)
      try {
        const userResp = await fetch(`/api/auth/user/${currentUser.id_user}`);
        if (userResp.ok) {
          const updatedUser = await userResp.json();
          localStorage.setItem('user', JSON.stringify(updatedUser));
          if (typeof loadBonusInfo === 'function') loadBonusInfo();
          if (typeof updateCartCount === 'function') updateCartCount();
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
  const currentUser = JSON.parse(localStorage.getItem('user'));
  if (!currentUser) {
    window.location.href = '/account';
    return;
  }

  // Если админ, открываем админ-модалку
  if (currentUser.role === 'admin') {
    showAdminModal();
    return;
  }

  // Иначе обычная модалка кабинета
  let modal = document.getElementById('cabinetModal');
  if (!modal) {
    if (typeof createCabinetModal === 'function') {
      createCabinetModal();
      modal = document.getElementById('cabinetModal');
    }
  }
  
  if (modal) {
    loadUserOrders();
    loadBonusInfo();
    loadUserCards();
    modal.classList.add('active');
  }
}

function closeCabinetModal() {
  const modal = document.getElementById('cabinetModal');
  if (modal) {
    modal.classList.remove('active');
  }
}

function switchTab(tabName, btnEl) {
  // убрать активность у всех кнопок и контента
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(tab => {
    tab.classList.remove('active');
    tab.classList.add('hidden');
  });

  // пометить нажатую кнопку
  if (btnEl) btnEl.classList.add('active');

  // показать и пометить активным нужный таб
  const tab = document.getElementById(tabName + 'Tab');
  if (tab) {
    tab.classList.remove('hidden');
    tab.classList.add('active');
  }

  // доп.логика для бонусов
  if (tabName === 'bonus' && typeof loadBonusInfo === 'function') {
    loadBonusInfo();
  }
}

async function loadUserOrders() {
  const currentUser = JSON.parse(localStorage.getItem('user'));
  try {
    const response = await fetch(`/api/orders/${currentUser.id_user}`);
    const orders = await response.json();

    const modal = document.getElementById('cabinetModal');
    const currentOrdersDiv = modal ? modal.querySelector('#currentOrders') : document.getElementById('currentOrders');
    const historyDiv = modal ? modal.querySelector('#orderHistory') : document.getElementById('orderHistory');

    if (!currentOrdersDiv || !historyDiv) {
      console.warn('Контейнеры для заказов не найдены (ни в модалке, ни в глобальном DOM)');
      return;
    }

    // Разделяем заказы на текущие (pending) и историю (completed)
    const currentOrders = orders.filter(o => o.status === 'pending');
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

  const deleteBtn = order.status === 'completed' 
    ? `<button class="order-delete-btn" onclick="deleteOrder(${order.id_order})" title="Удалить заказ из истории">🗑️ Удалить</button>`
    : '';

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
      ${deleteBtn}
    </div>
  `;
}

async function deleteOrder(orderId) {
  const currentUser = JSON.parse(localStorage.getItem('user'));
  
  if (!confirm('Вы уверены? Этот заказ будет удалён из истории безвозвратно.')) {
    return;
  }

  try {
    const response = await fetch(`/api/orders/${orderId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: currentUser.id_user })
    });

    const data = await response.json();

    if (response.ok) {
      showNotification('Заказ удалён из истории', 'success');
      loadUserOrders();
    } else {
      showNotification(data.message || 'Ошибка удаления заказа', 'error');
    }
  } catch (error) {
    console.error('Ошибка удаления заказа:', error);
    showNotification('Ошибка удаления заказа', 'error');
  }
}

async function deleteProduct(productId) {
  if (!confirm('Вы уверены? Этот товар будет удалён безвозвратно вместе с его картинкой!')) {
    return;
  }

  try {
    const response = await fetch(`/api/products/${productId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' }
    });

    const data = await response.json();

    if (response.ok) {
      showNotification('Товар удалён успешно', 'success');
      // Перезагружаем товары - они исчезнут и из каталога, и из админ-панели
      loadProducts();
    } else {
      showNotification(data.message || 'Ошибка удаления товара', 'error');
    }
  } catch (error) {
    console.error('Ошибка удаления товара:', error);
    showNotification('Ошибка удаления товара', 'error');
  }
}

function showAdminModal() {
  const modal = document.getElementById('adminModal');
  if (!modal) {
    createAdminModal();
  }
  const adminModal = document.getElementById('adminModal');
  if (adminModal) {
    adminModal.classList.add('active');
  }
}

function closeAdminModal() {
  const modal = document.getElementById('adminModal');
  if (modal) {
    modal.classList.remove('active');
  }
}

async function handleProductUpdate(event, productId) {
  event.preventDefault();
  const modal = document.getElementById('adminModal');
  if (!modal) return;

  const formData = new FormData(modal.querySelector('form'));
  const payload = Object.fromEntries(formData.entries());

  try {
    const response = await fetch(`/api/products/${productId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    if (response.ok) {
      showNotification('Товар обновлён', 'success');
      closeAdminModal();
      loadProducts();
    } else {
      showNotification(data.message || 'Ошибка обновления товара', 'error');
    }
  } catch (error) {
    console.error('Ошибка обновления товара:', error);
    showNotification('Ошибка обновления товара', 'error');
  }
}

async function handleProductDelete(productId) {
  if (!confirm('Вы уверены? Этот товар будет удалён навсегда.')) {
    return;
  }

  try {
    const response = await fetch(`/api/products/${productId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' }
    });

    const data = await response.json();
    if (response.ok) {
      showNotification('Товар удалён', 'success');
      loadProducts();
    } else {
      showNotification(data.message || 'Ошибка удаления товара', 'error');
    }
  } catch (error) {
    console.error('Ошибка удаления товара:', error);
    showNotification('Ошибка удаления товара', 'error');
  }
}

function showReviewModal() {
  const modal = document.getElementById('reviewModal');
  if (!modal) return;
  modal.classList.add('active');
  const rating = modal.querySelector('#rating');
  if (rating) rating.focus();
}

function closeReviewModal() {
  const modal = document.getElementById('reviewModal');
  if (!modal) return;
  modal.classList.remove('active');
  const form = modal.querySelector('#reviewForm');
  if (form) form.reset();
}

async function handleReviewSubmit(event) {
  event.preventDefault();
  const modal = document.getElementById('reviewModal');
  if (!modal) return;
  const ratingEl = modal.querySelector('#rating');
  const commentEl = modal.querySelector('#comment');
  const rating = parseInt(ratingEl.value, 10);
  const comment = (commentEl.value || '').trim();

  if (!rating || comment.length === 0) {
    showNotification('Пожалуйста, заполните рейтинг и комментарий', 'error');
    return;
  }

  const user = JSON.parse(localStorage.getItem('user')) || null;
  const payload = {
    id_user: user ? user.id_user : null,
    rating,
    comment
  };

  try {
    const resp = await fetch('/api/reviews', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await resp.json();
    if (resp.ok) {
      showNotification('Спасибо! Отзыв отправлен.', 'success');
      closeReviewModal();
    } else {
      showNotification(data.message || 'Ошибка при отправке отзыва', 'error');
    }
  } catch (err) {
    console.error('Ошибка отправки отзыва:', err);
    showNotification('Ошибка подключения', 'error');
  }
}

// Закрытие модалки при клике на фон
document.addEventListener('DOMContentLoaded', () => {
  const reviewModal = document.getElementById('reviewModal');
  if (reviewModal) {
    reviewModal.addEventListener('click', (e) => {
      if (e.target === reviewModal) {
        closeReviewModal();
      }
    });
  }
});

document.addEventListener('DOMContentLoaded', () => {
  // назначаем элементы после построения DOM
  productsGrid = document.getElementById('productsGrid');
  searchInput = document.getElementById('searchInput');
  categoryFilter = document.getElementById('categoryFilter');
  sortSelect = document.getElementById('sortSelect');

  if (!productsGrid) {
    console.warn('Элемент productsGrid не найден в DOM — каталог не будет отображён на этой странице.');
    return;
  }

  // навесим обработчики только если элементы существуют
  if (searchInput) searchInput.addEventListener('input', applyFiltersAndSort);
  if (categoryFilter) categoryFilter.addEventListener('change', applyFiltersAndSort);
  if (sortSelect) sortSelect.addEventListener('change', applyFiltersAndSort);

  // безопасно загружаем товары и обновляем счётчик корзины
  loadProducts().catch(err => {
    console.error('Ошибка при загрузке товаров (init):', err);
    productsGrid.innerHTML = '<p style="text-align:center; grid-column: 1/-1;">Ошибка загрузки товаров</p>';
  });

  // updateCartCount() используется в других скриптах — вызываем, если функция доступна
  try {
    if (typeof updateCartCount === 'function') updateCartCount();
  } catch (e) {
    console.warn('updateCartCount недоступна при инициализации каталога');
  }
});

async function loadUserCards() {
  const currentUser = JSON.parse(localStorage.getItem('user'));
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
      const cardDisplay = `**** **** **** ${option.dataset.last4} | Баланс: ${option.dataset.balance} BYN`;
      option.textContent = cardDisplay;
      select.appendChild(option);
    });

    // показа информации о выбранной карте
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

function showProductModal(productId, productName, imageUrl, price, stock, description) {
  const currentUser = JSON.parse(localStorage.getItem('user'));
  
  let modal = document.getElementById('productDetailModal');
  if (!modal) {
    createProductDetailModal();
    modal = document.getElementById('productDetailModal');
  }

  // Заполняем данные товара
  const modalContent = modal.querySelector('.product-detail-content');
  
  modalContent.innerHTML = `
    <img src="${imageUrl}" alt="${productName}" class="product-detail-image">
    <div class="product-detail-info">
      <h2 class="product-detail-name">${productName}</h2>
      <div class="product-detail-price">${parseFloat(price).toFixed(2)} BYN</div>
      <div class="product-detail-stock">Осталось: ${stock} шт.</div>
      <div class="product-detail-description">${description}</div>
      <div class="product-detail-actions">
        <button class="add-to-cart-btn" ${stock === 0 ? 'disabled' : ''} ${currentUser && currentUser.role === 'admin' ? 'disabled' : ''} onclick="event.stopPropagation(); addToCart(${productId}, '${productName.replace(/'/g, "\\'")}', ${price}); closeProductModal();">
          ${stock === 0 ? 'Нет в наличии' : (currentUser && currentUser.role === 'admin' ? 'Недоступно для админа' : 'Добавить в корзину')}
        </button>
        <button class="modal-btn modal-btn-secondary" onclick="closeProductModal()">Закрыть</button>
      </div>
    </div>
  `;

  modal.classList.add('active');
}

function closeProductModal() {
  const modal = document.getElementById('productDetailModal');
  if (modal) {
    modal.classList.remove('active');
  }
}

function createProductDetailModal() {
  if (document.getElementById('productDetailModal')) {
    return;
  }

  const modal = document.createElement('div');
  modal.id = 'productDetailModal';
  modal.className = 'modal';
  
  const modalContent = document.createElement('div');
  modalContent.className = 'modal-content product-detail-modal';
  
  modalContent.innerHTML = `
    <span class="modal-close" onclick="closeProductModal()">&times;</span>
    <div class="product-detail-content">
      <!-- Содержимое будет заполнено динамически -->
    </div>
  `;

  modal.appendChild(modalContent);
  document.body.appendChild(modal);

  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      closeProductModal();
    }
  });
}
