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
      localStorage.setItem('user', JSON.stringify(data.user));
      showNotification('Успешный вход!');
      setTimeout(() => {
        mergeGuestCart(data.user);
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
      localStorage.setItem('user', JSON.stringify(data.user));
      showNotification('Регистрация успешна!');
      setTimeout(() => {
        mergeGuestCart(data.user);
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

async function mergeGuestCart(user) {
  const guestCart = JSON.parse(localStorage.getItem('cart')) || [];
  
  if (guestCart.length > 0) {
    try {
      // Сначала получаем или создаем корзину пользователя
      const cartResponse = await fetch(`/api/carts/user/${user.id_user}`);
      const carts = await cartResponse.json();
      
      let cartId = carts[0]?.id_cart;
      
      if (!cartId) {
        // Создаем новую корзину если её нет
        const newCartResponse = await fetch('/api/carts/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: user.id_user })
        });
        const newCart = await newCartResponse.json();
        cartId = newCart.id_cart;
      }
      
      // Добавляем каждый товар из гостевой корзины
      for (const item of guestCart) {
        await fetch('/api/cart/add-item', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            cart_id: cartId,
            product_id: item.id,
            quantity: item.quantity
          })
        });
      }
      
      localStorage.removeItem('cart');
      showNotification('Корзина успешно обновлена');
    } catch (error) {
      console.error('Ошибка слияния корзины:', error);
      showNotification('Ошибка при обновлении корзины', 'error');
    }
  }

  setTimeout(() => {
    window.location.href = '/';
  }, 1500);
}

// Check if user already logged in
function checkUserStatus() {
  const user = localStorage.getItem('user');
  if (user) {
    window.location.href = '/';
  }
}

// Initialize
checkUserStatus();
