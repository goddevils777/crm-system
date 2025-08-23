/**
 * Утилиты для работы с временными зонами
 * Все функции возвращают время в UTC+3 (Киев/Львов)
 */

/**
 * Получает текущую дату в формате YYYY-MM-DD в киевском времени (UTC+3)
 * @returns {string} Дата в формате YYYY-MM-DD
 */
function getKyivDate() {
  const now = new Date();
  console.log('Server UTC time:', now.toISOString());
  
  // Киев/Львов = UTC+3 (постоянно, без перехода на летнее время с 2014 года)
  const kyivTime = new Date(now.getTime() + (3 * 60 * 60 * 1000));
  console.log('Kyiv time calculated:', kyivTime.toISOString());
  
  const result = kyivTime.toISOString().split('T')[0];
  console.log('Final date used:', result);
  
  return result;
}

/**
 * Получает текущую дату и время в киевском времени (UTC+3)
 * @returns {Date} Объект Date в киевском времени
 */
function getKyivDateTime() {
  const now = new Date();
  return new Date(now.getTime() + (3 * 60 * 60 * 1000));
}

/**
 * Конвертирует UTC дату в киевское время и возвращает в формате YYYY-MM-DD
 * @param {Date|string} utcDate - UTC дата
 * @returns {string} Дата в формате YYYY-MM-DD в киевском времени
 */
function convertUtcToKyivDate(utcDate) {
  const date = new Date(utcDate);
  const kyivTime = new Date(date.getTime() + (3 * 60 * 60 * 1000));
  return kyivTime.toISOString().split('T')[0];
}

module.exports = {
  getKyivDate,
  getKyivDateTime,
  convertUtcToKyivDate
};