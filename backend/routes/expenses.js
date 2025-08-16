const express = require('express');
const router = express.Router();

// Временный роут для тестирования
router.get('/', (req, res) => {
  res.json({ message: 'Модуль расходов' });
});

module.exports = router;