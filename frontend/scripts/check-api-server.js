const axios = require('axios');

// Конфигурация
const API_BASE = process.argv[2] || 'http://127.0.0.1:8000';
const TIMEOUT = 5000; // 5 секунд

async function checkApiServer() {
  console.log('🔍 Проверяем доступность API сервера...');
  console.log('🌐 URL:', API_BASE);
  console.log('⏱️ Таймаут:', TIMEOUT + 'ms');
  console.log('');

  try {
    // Простой запрос для проверки доступности
    const response = await axios.get(API_BASE, {
      timeout: TIMEOUT,
      headers: {
        'Accept': 'application/json',
      },
      validateStatus: function (status) {
        return status < 500; // Принимаем любые статусы кроме 5xx
      }
    });

    console.log('✅ API сервер доступен!');
    console.log('📊 Статус:', response.status);
    console.log('📄 Ответ:', response.data ? 'Получен' : 'Пустой');
    
    if (response.headers['access-control-allow-origin']) {
      console.log('🌐 CORS настроен:', response.headers['access-control-allow-origin']);
    } else {
      console.log('⚠️ CORS не настроен или не указан в заголовках');
    }

  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      console.log('❌ Сервер недоступен - соединение отклонено');
      console.log('💡 Убедитесь, что API сервер запущен на', API_BASE);
    } else if (error.code === 'ETIMEDOUT') {
      console.log('❌ Таймаут соединения');
      console.log('💡 Сервер не отвечает в течение', TIMEOUT + 'ms');
    } else if (error.response) {
      console.log('📊 Статус:', error.response.status);
      console.log('📄 Ответ:', error.response.data);
      
      if (error.response.status === 404) {
        console.log('ℹ️ Endpoint не найден, но сервер доступен');
      }
    } else {
      console.log('❌ Неизвестная ошибка:', error.message);
    }
  }

  console.log('');
  console.log('🔧 Рекомендации:');
  console.log('1. Убедитесь, что API сервер запущен');
  console.log('2. Проверьте правильность URL:', API_BASE);
  console.log('3. Настройте CORS на сервере для фронтенда');
  console.log('4. Проверьте firewall и сетевые настройки');
}

// Запускаем проверку
checkApiServer()
  .then(() => {
    console.log('✅ Проверка завершена');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Ошибка при проверке:', error.message);
    process.exit(1);
  });
