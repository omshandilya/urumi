const express = require('express');
const router = express.Router();
const storeController = require('../controllers/storeController');

router.post('/', storeController.createStore);
router.get('/', storeController.listStores);
router.delete('/:id', storeController.deleteStore);

module.exports = router;
