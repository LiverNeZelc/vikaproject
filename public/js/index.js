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

  requestAnimationFrame(() => notification.classList.add('show'));

  setTimeout(() => {
    notification.classList.remove('show');
    setTimeout(() => notification.remove(), 250);
  }, 3000);
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
        checkoutTotalElement.dataset.originalAmount = total.toFixed(2);
      }

      // Показываем раздел бонусов с ограничением
      const bonusSection = document.getElementById('bonusSection');
      if (bonusSection) {
        const userBonus = currentUser.bonus || 0;
        const maxByAmount = Math.floor(total * 10);
        const maxAllowed = Math.min(userBonus, maxByAmount);
        
        if (userBonus > 0) {
          bonusSection.innerHTML = `
            <h3>Использование бонусов</h3>
            <div style="margin-bottom: 15px; padding: 12px; background-color: var(--light-color); border-radius: 8px;">
              <p style="margin-bottom: 8px; font-size: 14px;">Доступно бонусов: <strong>${userBonus}</strong> (макс. скидка: ${ (userBonus*0.1).toFixed(2) } BYN)</p>
              <p style="margin-bottom: 10px; font-size: 12px; color: #666;">1 бонус = 0.10 BYN</p>
              <div style="display: flex; gap: 10px;">
                <input type="number" id="bonusInput" min="0" max="${maxAllowed}" value="0" placeholder="Кол-во бонусов" style="flex: 1; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px;">
                <button type="button" onclick="updateCheckoutTotal()" style="padding: 8px 16px; background-color: var(--primary-color); color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: 600;">Применить</button>
              </div>
              <p id="bonusMessage" style="margin-top: 8px; font-size: 12px; color: #666;"></p>
              <p id="bonusLimit" style="margin-top: 6px; font-size: 12px; color: #999;">Максимально допустимо бонусов: ${maxAllowed} (по сумме заказа: ${maxByAmount})</p>
            </div>
          `;
        } else {
          bonusSection.innerHTML = `
            <h3>Использование бонусов</h3>
            <div style="padding: 12px; background-color: var(--light-color); border-radius: 8px; color: #999; font-size: 14px;">
              Бонусов нет
            </div>
          `;
        }
      }
    }

    const deliveryAddressElement = document.getElementById('deliveryAddress');
    if (deliveryAddressElement) {
      deliveryAddressElement.value = currentUser.address || '';
    }

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

  let usedBonus = parseInt(bonusInput.value, 10);
  if (isNaN(usedBonus) || usedBonus < 0) {
    usedBonus = 0;
    bonusInput.value = 0;
  }

  const storedUser = JSON.parse(localStorage.getItem('user')) || null;
  const storedAvailable = storedUser ? parseInt(storedUser.bonus) || 0 : 0;

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

  bonusInput.max = available;
}

async function handleCheckout(event) {
  event.preventDefault();

  const currentUser = JSON.parse(localStorage.getItem('user'));
  const cardId = document.getElementById('paymentCard').value;
  const deliveryAddress = document.getElementById('deliveryAddress').value;
  const bonusUsed = parseInt(document.getElementById('bonusInput')?.value) || 0;

  // Валидация: бонусы не превышают сумму
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

  if (bonusUsed > currentUser.bonus) {
    showNotification('Недостаточно бонусов', 'error');
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

      // Обновляем данные пользователя в client-side
      try {
        const userResp = await fetch(`/api/auth/user/${currentUser.id_user}`);
        if (userResp.ok) {
          const updatedUser = await userResp.json();
          localStorage.setItem('user', JSON.stringify(updatedUser));
          if (typeof loadBonusInfo === 'function') loadBonusInfo();
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
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(tab => {
    tab.classList.remove('active');
    tab.classList.add('hidden');
  });

  if (btnEl) btnEl.classList.add('active');

  const tab = document.getElementById(tabName + 'Tab');
  if (tab) {
    tab.classList.remove('hidden');
    tab.classList.add('active');
  }

  if (tabName === 'bonus' && typeof loadBonusInfo === 'function') {
    loadBonusInfo();
  }
}

async function loadUserOrders() {
  const currentUser = JSON.parse(localStorage.getItem('user'));
  try {
    const response = await fetch(`/api/orders/${currentUser.id_user}`);
    const orders = await response.json();

    const currentOrdersDiv = document.getElementById('currentOrders');
    const historyDiv = document.getElementById('orderHistory');

    if (!currentOrdersDiv || !historyDiv) return;

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
  // безопасно получаем список товаров (сервер возвращает items с полями product_name, quantity, price)
  const itemsList = order.items && order.items.length > 0 
    ? order.items.map(item => `<div class="order-item-detail">• ${item.product_name || item.name || 'Товар'} x${item.quantity}</div>`).join('')
    : '<div class="order-item-detail">Товары не указаны</div>';

  // безопасно получаем сумму: пробуем несколько вариантов полей и приводим к числу
  const totalRaw = order.total_amount ?? order.total_price ?? order.total ?? order.totalAmount;
  const totalValue = parseFloat(totalRaw) || 0;

  // статус для вывода
  const statusLabel = order.status === 'completed' ? 'Завершён' : (order.status === 'pending' ? 'В ожидании' : (order.status || 'Неизвестно'));

  const deleteBtn = order.status === 'completed' 
    ? `<button class="order-delete-btn" onclick="deleteOrder(${order.id_order})" title="Удалить заказ из истории">🗑️ Удалить</button>`
    : '';

  return `
    <div class="order-card">
      <div class="order-header">
        <span class="order-number">Заказ #${String(order.id_order || order.id || '').padStart(5, '0')}</span>
        <span class="order-status ${order.status}">${statusLabel}</span>
      </div>
      <div class="order-date">${order.created_at ? new Date(order.created_at).toLocaleDateString('ru-RU') : ''}</div>
      <div class="order-address">${order.delivery_address ? `📍 ${order.delivery_address}` : ''}</div>
      <div class="order-items-list">${itemsList}</div>
      <div class="order-total">Сумма: ${totalValue.toFixed(2)} BYN</div>
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

// Review modal handlers
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

// Загрузить опубликованные отзывы
async function loadPublishedReviews() {
  try {
    const response = await fetch('/api/reviews-published');
    const reviews = await response.json();
    
    if (reviews && reviews.length > 0) {
      renderScrollingReviews(reviews);
    }
  } catch (error) {
    console.error('Ошибка загрузки отзывов:', error);
  }
}

function renderScrollingReviews(reviews) {
  // Создаём контейнер если его нет
  let reviewsSection = document.querySelector('.reviews-scroll-wrapper');
  
  if (!reviewsSection) {
    reviewsSection = document.createElement('section');
    reviewsSection.className = 'reviews-scroll-wrapper';
    const standardReviewsSection = document.querySelector('.reviews-section');
    
    if (standardReviewsSection) {
      standardReviewsSection.parentNode.insertBefore(reviewsSection, standardReviewsSection);
    } else {
      document.querySelector('.slider-section').parentNode.appendChild(reviewsSection);
    }
  }

  // Дублируем отзывы для бесконечной прокрутки
  const duplicatedReviews = [...reviews, ...reviews];
  
  const scrollContainer = document.createElement('div');
  scrollContainer.className = 'reviews-scroll-container';
  
  scrollContainer.innerHTML = duplicatedReviews.map(review => {
    const stars = '⭐'.repeat(review.rating);
    return `
      <div class="review-scroll-card">
        <div class="review-scroll-header">
          <span class="review-scroll-author">${review.author_name}</span>
          <span class="review-scroll-rating">${stars}</span>
        </div>
        <p class="review-scroll-text">"${review.comment}"</p>
      </div>
    `;
  }).join('');
  
  reviewsSection.innerHTML = '';
  reviewsSection.appendChild(scrollContainer);
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  loadPublishedReviews();
  updateCartCount();
});
