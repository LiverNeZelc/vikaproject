/**
 * Админ-панель функции
 */

let allProductsForManagement = [];
let filteredProductsForManagement = [];

function createAdminModal() {
  // Проверяем, уже ли создана модалка
  if (document.getElementById('adminModal')) {
    return;
  }

  const modal = document.createElement('div');
  modal.id = 'adminModal';
  modal.className = 'modal modal-cabinet';
  
  const modalContent = document.createElement('div');
  modalContent.className = 'modal-content';
  
  modalContent.innerHTML = `
    <span class="modal-close" onclick="closeAdminModal()">&times;</span>
    
    <div class="cabinet-header">
      <h2>Панель администратора</h2>
      <button onclick="logoutUser()" class="btn btn-logout">Выход</button>
    </div>

    <div class="admin-buttons">
      <button class="admin-btn admin-btn-primary" onclick="openProductsManagementModal()">
        📦 Управление товарами
      </button>
      <button class="admin-btn admin-btn-primary" onclick="openDeliveryManagementModal()">
        🚚 Управление доставкой
      </button>
      <button class="admin-btn admin-btn-primary" onclick="openReviewsManagementModal()">
        ⭐ Редактирование отзывов
      </button>
      <button class="admin-btn admin-btn-primary" onclick="openAnalyticsModal()">
        📊 Аналитика
      </button>
    </div>
  `;
  
  modal.appendChild(modalContent);
  document.body.appendChild(modal);

  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      closeAdminModal();
    }
  });
}

function closeAdminModal() {
  const modal = document.getElementById('adminModal');
  if (modal) {
    modal.classList.remove('active');
  }
}

function openProductsManagementModal() {
  let modal = document.getElementById('productManagementModal');
  if (!modal) {
    createProductManagementModal();
    modal = document.getElementById('productManagementModal');
  }
  loadProductsForManagement();
  modal.classList.add('active');
}

function closeProductManagementModal() {
  const modal = document.getElementById('productManagementModal');
  if (modal) {
    modal.classList.remove('active');
  }
}

function openDeliveryManagementModal() {
  let modal = document.getElementById('deliveryManagementModal');
  if (!modal) {
    createDeliveryManagementModal();
    modal = document.getElementById('deliveryManagementModal');
  }
  loadPendingOrders();
  modal.classList.add('active');
}

function closeDeliveryManagementModal() {
  const modal = document.getElementById('deliveryManagementModal');
  if (modal) {
    modal.classList.remove('active');
  }
}

function openReviewsManagementModal() {
  let modal = document.getElementById('reviewsManagementModal');
  if (!modal) {
    createReviewsManagementModal();
    modal = document.getElementById('reviewsManagementModal');
  }
  loadReviewsForManagement();
  modal.classList.add('active');
}

function closeReviewsManagementModal() {
  const modal = document.getElementById('reviewsManagementModal');
  if (modal) {
    modal.classList.remove('active');
  }
}

function createProductManagementModal() {
  const modal = document.createElement('div');
  modal.id = 'productManagementModal';
  modal.className = 'modal modal-cabinet';
  
  const modalContent = document.createElement('div');
  modalContent.className = 'modal-content';
  
  modalContent.innerHTML = `
    <span class="modal-close" onclick="closeProductManagementModal()">&times;</span>
    
    <div class="cabinet-header">
      <h2>Управление товарами</h2>
      <button onclick="openAddProductModal()" class="btn btn-primary" style="background-color: #27ae60;">+ Добавить товар</button>
    </div>

    <div class="products-management-buttons">
      <button onclick="exportProductsToJSON()" class="btn btn-primary">⬇️ Выгрузить JSON</button>
      <button onclick="document.getElementById('jsonFileInput').click()" class="btn btn-primary">⬆️ Загрузить JSON</button>
      <input type="file" id="jsonFileInput" accept=".json" onchange="handleJSONUpload(event)">
    </div>

    <div class="search-box" style="margin-bottom: 20px;">
      <input 
        type="text" 
        id="productSearchInput" 
        class="search-input" 
        placeholder="Поиск товаров..."
        autocomplete="off"
        onkeyup="filterProductsForManagement()"
      >
      <span class="search-icon">🔍</span>
    </div>

    <div id="productsContainer" class="products-management-container">
      <!-- Товары будут загружены здесь -->
    </div>
  `;
  
  modal.appendChild(modalContent);
  document.body.appendChild(modal);

  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      closeProductManagementModal();
    }
  });
}

function createDeliveryManagementModal() {
  const modal = document.createElement('div');
  modal.id = 'deliveryManagementModal';
  modal.className = 'modal modal-cabinet';
  
  const modalContent = document.createElement('div');
  modalContent.className = 'modal-content';
  
  modalContent.innerHTML = `
    <span class="modal-close" onclick="closeDeliveryManagementModal()">&times;</span>
    
    <div class="cabinet-header">
      <h2>Управление доставкой</h2>
    </div>

    <div id="pendingOrdersContainer" class="products-management-container">
      <!-- Заказы с статусом pending будут загружены здесь -->
    </div>
  `;
  
  modal.appendChild(modalContent);
  document.body.appendChild(modal);

  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      closeDeliveryManagementModal();
    }
  });
}

function createReviewsManagementModal() {
  const modal = document.createElement('div');
  modal.id = 'reviewsManagementModal';
  modal.className = 'modal modal-cabinet';
  
  const modalContent = document.createElement('div');
  modalContent.className = 'modal-content';
  
  modalContent.innerHTML = `
    <span class="modal-close" onclick="closeReviewsManagementModal()">&times;</span>
    
    <div class="cabinet-header">
      <h2>Редактирование отзывов</h2>
    </div>

    <div id="reviewsContainer" class="products-management-container">
      <!-- Отзывы будут загружены здесь -->
    </div>
  `;
  
  modal.appendChild(modalContent);
  document.body.appendChild(modal);

  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      closeReviewsManagementModal();
    }
  });
}

async function loadProductsForManagement() {
  try {
    const response = await fetch('/api/products-all');
    allProductsForManagement = await response.json();
    filteredProductsForManagement = [...allProductsForManagement];
    renderProductsForManagement();
  } catch (error) {
    console.error('Ошибка загрузки товаров:', error);
    showNotification('Ошибка загрузки товаров', 'error');
  }
}

function filterProductsForManagement() {
  const searchQuery = document.getElementById('productSearchInput').value.toLowerCase();
  
  filteredProductsForManagement = allProductsForManagement.filter(product => {
    return product.name.toLowerCase().includes(searchQuery) ||
           product.description.toLowerCase().includes(searchQuery) ||
           product.sku.toLowerCase().includes(searchQuery);
  });

  renderProductsForManagement();
}

function renderProductsForManagement() {
  const container = document.getElementById('productsContainer');
  
  if (!filteredProductsForManagement || filteredProductsForManagement.length === 0) {
    container.innerHTML = '<div class="empty-state">Товары не найдены</div>';
    return;
  }

  container.innerHTML = filteredProductsForManagement.map(product => `
    <div class="product-management-card" id="product-card-${product.id_product}">
      <div class="product-mgmt-header">
        <h3>${product.name}</h3>
        <span style="font-size: 12px; color: #999;">SKU: ${product.sku}</span>
      </div>
      <div class="product-mgmt-row">
        <label>Название:</label>
        <input type="text" value="${product.name}" id="name_${product.id_product}" class="product-mgmt-input">
      </div>
      <div class="product-mgmt-row">
        <label>Цена:</label>
        <input type="number" value="${product.price}" step="0.01" min="0" id="price_${product.id_product}" class="product-mgmt-input">
      </div>
      <div class="product-mgmt-row">
        <label>Количество:</label>
        <input type="number" value="${product.quantity_in_stock}" min="0" id="quantity_${product.id_product}" class="product-mgmt-input">
      </div>
      <div style="display: flex; gap: 10px;">
        <button class="modal-btn modal-btn-primary" onclick="updateProduct(${product.id_product})" style="flex: 1;">
          Обновить товар
        </button>
        <button class="modal-btn" onclick="deleteProductFromAdmin(${product.id_product})" style="flex: 1; background-color: #e74c3c;">
          🗑️ Удалить
        </button>
      </div>
    </div>
  `).join('');
}

async function updateProduct(productId) {
  const name = document.getElementById(`name_${productId}`).value;
  const price = parseFloat(document.getElementById(`price_${productId}`).value);
  const quantity = parseInt(document.getElementById(`quantity_${productId}`).value);

  if (!name || !price || quantity === undefined) {
    showNotification('Заполните все поля', 'error');
    return;
  }

  // Валидация: цена и количество не могут быть отрицательными
  if (price < 0) {
    showNotification('Цена не может быть отрицательной', 'error');
    return;
  }

  if (quantity < 0) {
    showNotification('Количество товара не может быть отрицательным', 'error');
    return;
  }

  try {
    const response = await fetch(`/api/products/${productId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        price,
        quantity_in_stock: quantity
      })
    });

    const data = await response.json();

    if (response.ok) {
      showNotification('Товар обновлён успешно', 'success');
      loadProductsForManagement();
    } else {
      showNotification(data.message || 'Ошибка обновления товара', 'error');
    }
  } catch (error) {
    console.error('Ошибка обновления товара:', error);
    showNotification('Ошибка обновления товара', 'error');
  }
}

function openAddProductModal() {
  let modal = document.getElementById('addProductModal');
  if (!modal) {
    createAddProductModal();
    modal = document.getElementById('addProductModal');
  }
  modal.classList.add('active');
}

function closeAddProductModal() {
  const modal = document.getElementById('addProductModal');
  if (modal) {
    modal.classList.remove('active');
  }
}

function createAddProductModal() {
  const categoryMap = {
    'tools': 'Инструменты',
    'brushes': 'Кисти',
    'paints': 'Краски',
    'canvas': 'Холсты',
    'paper': 'Бумага'
  };
  
  const modal = document.createElement('div');
  modal.id = 'addProductModal';
  modal.className = 'modal';
  
  const modalContent = document.createElement('div');
  modalContent.className = 'modal-content modal-checkout';
  
  modalContent.innerHTML = `
    <span class="modal-close" onclick="closeAddProductModal()">&times;</span>
    <h2>Добавить новый товар</h2>

    <form id="addProductForm" onsubmit="handleAddProduct(event)">
      <div class="form-group">
        <label for="newProductName">Название товара:</label>
        <input type="text" id="newProductName" name="name" required style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px; font-family: inherit; font-size: 14px;">
      </div>

      <div class="form-group">
        <label for="newProductDescription">Описание:</label>
        <textarea id="newProductDescription" name="description" rows="4" required style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px; font-family: inherit; font-size: 14px; resize: vertical;"></textarea>
      </div>

      <div class="form-group">
        <label for="newProductPrice">Цена (BYN):</label>
        <input type="number" id="newProductPrice" name="price" step="0.01" min="0" required style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px; font-family: inherit; font-size: 14px;">
      </div>

      <div class="form-group">
        <label for="newProductQuantity">Количество:</label>
        <input type="number" id="newProductQuantity" name="quantity" min="0" required style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px; font-family: inherit; font-size: 14px;">
      </div>

      <div class="form-group">
        <label for="newProductCategory">Категория:</label>
        <select id="newProductCategory" name="category" required style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px; font-family: inherit; font-size: 14px;">
          <option value="">Выберите категорию</option>
          <option value="tools">Инструменты</option>
          <option value="brushes">Кисти</option>
          <option value="paints">Краски</option>
          <option value="canvas">Холсты</option>
          <option value="paper">Бумага</option>
        </select>
      </div>

      <div class="form-group">
        <label for="newProductImage">Загрузить картинку:</label>
        <div style="display: flex; gap: 10px; align-items: center;">
          <input type="file" id="newProductImage" accept="image/*" style="flex: 1; padding: 10px; border: 1px solid #ddd; border-radius: 4px; font-family: inherit; font-size: 14px;">
          <button type="button" onclick="uploadProductImage()" style="padding: 10px 20px; background-color: #3498db; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: 600; white-space: nowrap;">Загрузить</button>
        </div>
        <div id="imageUploadStatus" style="margin-top: 8px; font-size: 12px; color: #666;"></div>
        <img id="imagePreview" style="margin-top: 10px; max-width: 200px; max-height: 200px; border-radius: 4px; display: none;">
      </div>

      <div class="modal-actions">
        <button type="button" class="modal-btn modal-btn-secondary" onclick="closeAddProductModal()">Отмена</button>
        <button type="submit" class="modal-btn modal-btn-primary">Добавить товар</button>
      </div>
    </form>
  `;
  
  modal.appendChild(modalContent);
  document.body.appendChild(modal);

  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      closeAddProductModal();
    }
  });
}

async function uploadProductImage() {
  const fileInput = document.getElementById('newProductImage');
  const statusDiv = document.getElementById('imageUploadStatus');
  const previewImg = document.getElementById('imagePreview');

  if (!fileInput.files.length) {
    statusDiv.textContent = 'Пожалуйста, выберите файл';
    statusDiv.style.color = '#e74c3c';
    return;
  }

  const file = fileInput.files[0];
  
  // Проверяем размер файла (макс 5MB)
  if (file.size > 5 * 1024 * 1024) {
    statusDiv.textContent = 'Файл слишком большой (максимум 5MB)';
    statusDiv.style.color = '#e74c3c';
    return;
  }

  // Проверяем тип файла
  if (!file.type.startsWith('image/')) {
    statusDiv.textContent = 'Пожалуйста, загрузите изображение';
    statusDiv.style.color = '#e74c3c';
    return;
  }

  statusDiv.textContent = 'Загрузка...';
  statusDiv.style.color = '#666';

  const formData = new FormData();
  formData.append('image', file);

  try {
    const response = await fetch('/api/upload-image', {
      method: 'POST',
      body: formData
    });

    const data = await response.json();

    if (response.ok) {
      statusDiv.textContent = '✓ Изображение загружено успешно';
      statusDiv.style.color = '#27ae60';
      
      // Показываем превью
      const reader = new FileReader();
      reader.onload = (e) => {
        previewImg.src = e.target.result;
        previewImg.style.display = 'block';
      };
      reader.readAsDataURL(file);

      // Сохраняем путь загруженной картинки
      window.uploadedImagePath = data.imagePath;
    } else {
      statusDiv.textContent = data.message || 'Ошибка загрузки';
      statusDiv.style.color = '#e74c3c';
    }
  } catch (error) {
    console.error('Ошибка загрузки изображения:', error);
    statusDiv.textContent = 'Ошибка при загрузке';
    statusDiv.style.color = '#e74c3c';
  }
}

async function handleAddProduct(event) {
  event.preventDefault();

  const name = document.getElementById('newProductName').value;
  const description = document.getElementById('newProductDescription').value;
  const price = parseFloat(document.getElementById('newProductPrice').value);
  const quantity = parseInt(document.getElementById('newProductQuantity').value);
  const category = document.getElementById('newProductCategory').value;

  if (!name || !description || !price || !quantity || !category) {
    showNotification('Заполните все поля', 'error');
    return;
  }

  // Валидация: цена и количество не могут быть отрицательными
  if (price < 0) {
    showNotification('Цена не может быть отрицательной', 'error');
    return;
  }

  if (quantity < 0) {
    showNotification('Количество товара не может быть отрицательным', 'error');
    return;
  }

  // Если картинка загружена, используем её путь
  // Если нет - будет использован путь по умолчанию на сервере
  const imagePath = window.uploadedImagePath || null;

  try {
    const response = await fetch('/api/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        description,
        price,
        quantity_in_stock: quantity,
        category,
        image_path: imagePath
      })
    });

    const data = await response.json();

    if (response.ok) {
      showNotification('Товар добавлен успешно', 'success');
      document.getElementById('addProductForm').reset();
      document.getElementById('imageUploadStatus').textContent = '';
      document.getElementById('imagePreview').style.display = 'none';
      window.uploadedImagePath = null;
      closeAddProductModal();
      loadProductsForManagement();
    } else {
      showNotification(data.message || 'Ошибка добавления товара', 'error');
    }
  } catch (error) {
    console.error('Ошибка добавления товара:', error);
    showNotification('Ошибка добавления товара', 'error');
  }
}

function exportProductsToJSON() {
  if (!allProductsForManagement || allProductsForManagement.length === 0) {
    showNotification('Нет товаров для экспорта', 'error');
    return;
  }

  const exportData = allProductsForManagement.map(product => ({
    id_product: product.id_product,
    name: product.name,
    price: parseFloat(product.price),
    quantity_in_stock: parseInt(product.quantity_in_stock)
  }));

  const dataStr = JSON.stringify(exportData, null, 2);
  const dataBlob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(dataBlob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `products_${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  showNotification('JSON выгружен успешно', 'success');
}

function handleJSONUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const jsonData = JSON.parse(e.target.result);

      // Валидируем структуру JSON
      if (!Array.isArray(jsonData)) {
        showNotification('JSON должен быть массивом товаров', 'error');
        return;
      }

      let validationErrors = [];
      let updatedCount = 0;
      let errorCount = 0;

      // Проверяем каждый товар
      for (const item of jsonData) {
        if (!item.id_product || item.price === undefined || item.quantity_in_stock === undefined) {
          validationErrors.push(`Товар ${item.name || 'без имени'}: отсутствуют требуемые поля`);
          errorCount++;
          continue;
        }

        try {
          const response = await fetch(`/api/products/${item.id_product}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              price: parseFloat(item.price),
              quantity_in_stock: parseInt(item.quantity_in_stock)
            })
          });

          if (response.ok) {
            updatedCount++;
          } else {
            errorCount++;
            validationErrors.push(`Товар ${item.name || item.id_product}: ошибка обновления`);
          }
        } catch (error) {
          errorCount++;
          validationErrors.push(`Товар ${item.name || item.id_product}: ${error.message}`);
        }
      }

      // Обновляем список товаров
      loadProductsForManagement();

      // Показываем результаты
      if (updatedCount > 0) {
        showNotification(`Загружено успешно: ${updatedCount} товаров обновлено`, 'success');
      }
      if (errorCount > 0) {
        showNotification(`Ошибок при загрузке: ${errorCount}. Проверьте консоль для деталей`, 'error');
        if (validationErrors.length > 0) {
          console.warn('Ошибки при загрузке JSON:', validationErrors);
        }
      }
    } catch (error) {
      showNotification('Ошибка парсинга JSON: ' + error.message, 'error');
      console.error('JSON Parse Error:', error);
    }
  };

  reader.onerror = () => {
    showNotification('Ошибка чтения файла', 'error');
  };

  reader.readAsText(file);

  // Очищаем input для возможности повторной загрузки того же файла
  event.target.value = '';
}

function openDeliveryManagement() {
  let modal = document.getElementById('deliveryManagementModal');
  if (!modal) {
    createDeliveryManagementModal();
    modal = document.getElementById('deliveryManagementModal');
  }
  loadPendingOrders();
  modal.classList.add('active');
}

function closeDeliveryManagementModal() {
  const modal = document.getElementById('deliveryManagementModal');
  if (modal) {
    modal.classList.remove('active');
  }
}

async function loadPendingOrders() {
  try {
    const response = await fetch('/api/orders-pending');
    const orders = await response.json();
    renderPendingOrders(orders);
  } catch (error) {
    console.error('Ошибка загрузки заказов:', error);
    showNotification('Ошибка загрузки заказов', 'error');
  }
}

function renderPendingOrders(orders) {
  const container = document.getElementById('pendingOrdersContainer');
  
  if (!orders || orders.length === 0) {
    container.innerHTML = '<div class="empty-state">Нет заказов в ожидании доставки</div>';
    return;
  }

  container.innerHTML = orders.map(order => {
    const itemsList = order.items && order.items.length > 0 
      ? order.items.map(item => `<div class="order-item-detail">• ${item.product_name} x${item.quantity}</div>`).join('')
      : '<div class="order-item-detail">Товары не указаны</div>';

    const userName = `${order.first_name} ${order.last_name}`;
    const orderDate = new Date(order.created_at).toLocaleDateString('ru-RU');

    return `
      <div class="delivery-order-card">
        <div class="delivery-order-header">
          <div>
            <div class="delivery-order-user"><strong>${userName}</strong></div>
            <div class="delivery-order-date">Дата: ${orderDate}</div>
          </div>
          <div class="delivery-order-number">Заказ #${String(order.id_order).padStart(5, '0')}</div>
        </div>
        <div class="delivery-order-address">📍 ${order.delivery_address}</div>
        <div class="delivery-order-items">${itemsList}</div>
        <div class="delivery-order-total">Сумма: ${parseFloat(order.total_amount).toFixed(2)} BYN</div>
        <button class="modal-btn modal-btn-primary" onclick="completeDelivery(${order.id_order})" style="width: 100%; margin-top: 12px;">
          ✓ Заказ доставлен
        </button>
      </div>
    `;
  }).join('');
}

async function completeDelivery(orderId) {
  try {
    const response = await fetch(`/api/orders/${orderId}/complete`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' }
    });

    const data = await response.json();

    if (response.ok) {
      showNotification('Заказ отмечен как доставленный', 'success');
      loadPendingOrders();
    } else {
      showNotification(data.message || 'Ошибка обновления статуса', 'error');
    }
  } catch (error) {
    console.error('Ошибка завершения доставки:', error);
    showNotification('Ошибка завершения доставки', 'error');
  }
}

function openAnalytics() {
  showNotification('Функция аналитики в разработке', 'info');
}

function openReviewsManagement() {
  let modal = document.getElementById('reviewsManagementModal');
  if (!modal) {
    createReviewsManagementModal();
    modal = document.getElementById('reviewsManagementModal');
  }
  loadReviewsForManagement();
  modal.classList.add('active');
}

function closeReviewsManagementModal() {
  const modal = document.getElementById('reviewsManagementModal');
  if (modal) {
    modal.classList.remove('active');
  }
}

async function loadReviewsForManagement() {
  try {
    const response = await fetch('/api/reviews-all');
    const reviews = await response.json();
    renderReviewsForManagement(reviews);
  } catch (error) {
    console.error('Ошибка загрузки отзывов:', error);
    showNotification('Ошибка загрузки отзывов', 'error');
  }
}

function renderReviewsForManagement(reviews) {
  const container = document.getElementById('reviewsContainer');
  
  // Фильтруем только отзывы со статусом "не проверен"
  const unverifiedReviews = reviews.filter(review => review.status === 'не проверен');
  
  if (!unverifiedReviews || unverifiedReviews.length === 0) {
    container.innerHTML = '<div class="empty-state">Нет отзывов на проверке</div>';
    return;
  }

  container.innerHTML = unverifiedReviews.map(review => `
    <div class="review-management-card">
      <div class="review-mgmt-header">
        <div>
          <div class="review-mgmt-author"><strong>${review.author_name}</strong></div>
          <div class="review-mgmt-date">Дата: ${new Date(review.created_at).toLocaleDateString('ru-RU')}</div>
          <div class="review-mgmt-status">Статус: <span class="review-status-badge ${review.status}">${review.status === 'проверен' ? '✓ Опубликован' : '⏳ На проверке'}</span></div>
        </div>
      </div>
      <div class="review-mgmt-text">
        <textarea id="review_${review.id_review}" class="review-mgmt-textarea" placeholder="Текст отзыва">${review.comment}</textarea>
      </div>
      <div class="review-mgmt-actions">
        <button class="modal-btn modal-btn-primary" onclick="publishReview(${review.id_review}, ${review.id_review})" style="flex: 1;">
          ✓ Опубликовать
        </button>
        <button class="modal-btn modal-btn-secondary" onclick="deleteReview(${review.id_review})" style="flex: 1; background-color: #e74c3c;">
          🗑️ Удалить
        </button>
      </div>
    </div>
  `).join('');
}

async function publishReview(reviewId, textareaId) {
  // Получаем текст из textarea
  const textarea = document.getElementById(`review_${textareaId}`);
  const updatedComment = textarea.value;

  try {
    // Сначала обновляем текст отзыва (если он был изменён)
    await fetch(`/api/reviews/${reviewId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ comment: updatedComment })
    });

    // Затем публикуем отзыв
    const response = await fetch(`/api/reviews/${reviewId}/publish`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' }
    });

    const data = await response.json();

    if (response.ok) {
      showNotification('Отзыв опубликован', 'success');
      loadReviewsForManagement();
    } else {
      showNotification(data.message || 'Ошибка публикации отзыва', 'error');
    }
  } catch (error) {
    console.error('Ошибка публикации отзыва:', error);
    showNotification('Ошибка публикации отзыва', 'error');
  }
}

async function deleteReview(reviewId) {
  if (!confirm('Вы уверены? Этот отзыв будет удалён безвозвратно.')) {
    return;
  }

  try {
    const response = await fetch(`/api/reviews/${reviewId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' }
    });

    const data = await response.json();

    if (response.ok) {
      showNotification('Отзыв удалён', 'success');
      loadReviewsForManagement();
    } else {
      showNotification(data.message || 'Ошибка удаления отзыва', 'error');
    }
  } catch (error) {
    console.error('Ошибка удаления отзыва:', error);
    showNotification('Ошибка удаления отзыва', 'error');
  }
}

function openAnalyticsModal() {
  let modal = document.getElementById('analyticsModal');
  if (!modal) {
    createAnalyticsModal();
    modal = document.getElementById('analyticsModal');
  }
  loadAnalytics('day');
  modal.classList.add('active');
}

function closeAnalyticsModal() {
  const modal = document.getElementById('analyticsModal');
  if (modal) {
    modal.classList.remove('active');
  }
}

function createAnalyticsModal() {
  if (document.getElementById('analyticsModal')) {
    return;
  }

  const modal = document.createElement('div');
  modal.id = 'analyticsModal';
  modal.className = 'modal modal-cabinet';
  
  const modalContent = document.createElement('div');
  modalContent.className = 'modal-content';
  
  modalContent.innerHTML = `
    <span class="modal-close" onclick="closeAnalyticsModal()">&times;</span>
    
    <div class="cabinet-header">
      <h2>Аналитика</h2>
      <button onclick="downloadAnalyticsDocx()" class="btn btn-primary" style="background-color: #27ae60;">📥 Скачать DOCX</button>
    </div>

    <div class="analytics-period-tabs">
      <button class="analytics-btn active" onclick="loadAnalytics('day', this)">День</button>
      <button class="analytics-btn" onclick="loadAnalytics('week', this)">Неделя</button>
      <button class="analytics-btn" onclick="loadAnalytics('month', this)">Месяц</button>
      <button class="analytics-btn" onclick="loadAnalytics('year', this)">Год</button>
    </div>

    <div id="analyticsContent" class="analytics-content">
      <!-- Загруженная аналитика будет здесь -->
    </div>
  `;
  
  modal.appendChild(modalContent);
  document.body.appendChild(modal);

  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      closeAnalyticsModal();
    }
  });
}

async function loadAnalytics(period, btnEl) {
  // Обновляем активную кнопку
  if (btnEl) {
    document.querySelectorAll('.analytics-btn').forEach(btn => btn.classList.remove('active'));
    btnEl.classList.add('active');
  }

  try {
    const response = await fetch(`/api/analytics/${period}`);
    const data = await response.json();

    const periodLabels = {
      'day': 'за день',
      'week': 'за неделю',
      'month': 'за месяц',
      'year': 'за год'
    };

    const analyticsContent = document.getElementById('analyticsContent');
    analyticsContent.innerHTML = `
      <div class="analytics-grid">
        <div class="analytics-card">
          <div class="analytics-label">Прибыль ${periodLabels[period]}</div>
          <div class="analytics-value">${data.profit} BYN</div>
        </div>

        <div class="analytics-card">
          <div class="analytics-label">Количество заказов</div>
          <div class="analytics-value">${data.orderCount}</div>
        </div>

        <div class="analytics-card">
          <div class="analytics-label">Товаров продано</div>
          <div class="analytics-value">${data.itemsSold}</div>
        </div>

        <div class="analytics-card">
          <div class="analytics-label">Новых пользователей</div>
          <div class="analytics-value">${data.newUsers}</div>
        </div>

        <div class="analytics-card">
          <div class="analytics-label">Средний чек</div>
          <div class="analytics-value">${data.avgCheck} BYN</div>
        </div>

        <div class="analytics-card">
          <div class="analytics-label">Средний рейтинг</div>
          <div class="analytics-value">${data.avgRating} ⭐</div>
        </div>

        <div class="analytics-card">
          <div class="analytics-label">Кол-во отзывов</div>
          <div class="analytics-value">${data.reviewCount}</div>
        </div>
      </div>
    `;

    // Сохраняем данные для скачивания
    window.currentAnalytics = data;
  } catch (error) {
    console.error('Ошибка загрузки аналитики:', error);
    showNotification('Ошибка загрузки аналитики', 'error');
  }
}

async function downloadAnalyticsDocx() {
  try {
    const response = await fetch('/api/analytics/download', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        day: await fetch('/api/analytics/day').then(r => r.json()),
        week: await fetch('/api/analytics/week').then(r => r.json()),
        month: await fetch('/api/analytics/month').then(r => r.json()),
        year: await fetch('/api/analytics/year').then(r => r.json())
      })
    });

    if (!response.ok) {
      throw new Error('Ошибка скачивания');
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `analytics_${new Date().toISOString().split('T')[0]}.docx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);

    showNotification('Аналитика скачана', 'success');
  } catch (error) {
    console.error('Ошибка скачивания аналитики:', error);
    showNotification('Ошибка скачивания аналитики', 'error');
  }
}

function showAdminModal() {
  const currentUser = JSON.parse(localStorage.getItem('user'));
  
  if (!currentUser) {
    showNotification('Пожалуйста, авторизуйтесь', 'error');
    return;
  }

  if (currentUser.role !== 'admin') {
    showNotification('У вас нет прав администратора', 'error');
    return;
  }

  let modal = document.getElementById('adminModal');
  if (!modal) {
    createAdminModal();
    modal = document.getElementById('adminModal');
  }
  
  if (modal) {
    modal.classList.add('active');
  }
}

function logoutUser() {
  localStorage.removeItem('user');
  closeAdminModal();
  window.location.href = '/account';
  showNotification('Вы вышли из аккаунта');
}

/**
 * Функции для работы с товарами
 */

async function deleteProductFromAdmin(productId) {
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
      
      // Удаляем карточку товара из DOM сразу с анимацией
      const card = document.getElementById(`product-card-${productId}`);
      if (card) {
        card.style.animation = 'fadeOut 0.3s ease-out';
        setTimeout(() => card.remove(), 300);
      }
      
      // Перезагружаем список в фоне
      loadProductsForManagement();
    } else {
      showNotification(data.message || 'Ошибка удаления товара', 'error');
    }
  } catch (error) {
    console.error('Ошибка удаления товара:', error);
    showNotification('Ошибка удаления товара', 'error');
  }
}
