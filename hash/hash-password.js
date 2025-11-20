const bcrypt = require('bcrypt');
const readline = require('readline');

// Создаем интерфейс для чтения ввода
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function hashPassword() {
  rl.question('Введите пароль для хеширования: ', (password) => {
    if (!password) {
      console.log('Пароль не может быть пустым!');
      rl.close();
      return;
    }

    // Хешируем пароль с salt rounds = 10
    bcrypt.hash(password, 10, (err, hash) => {
      if (err) {
        console.error('Ошибка при хешировании:', err);
        rl.close();
        return;
      }

      console.log('\n' + '='.repeat(50));
      console.log('Исходный пароль:', password);
      console.log('Хеш пароля:', hash);
      console.log('='.repeat(50) + '\n');

      // Проверяем хеш (опционально)
      bcrypt.compare(password, hash, (err, result) => {
        if (err) {
          console.error('Ошибка при проверке:', err);
        } else {
          console.log('Проверка хеша:', result ? '✓ Успешно' : '✗ Ошибка');
        }
        
        rl.question('Хотите хешировать еще один пароль? (y/n): ', (answer) => {
          if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'д') {
            hashPassword(); // Рекурсивно запускаем снова
          } else {
            console.log('До свидания!');
            rl.close();
          }
        });
      });
    });
  });
}

// Запускаем приложение
console.log('=== BCrypt Password Hasher ===');
hashPassword();