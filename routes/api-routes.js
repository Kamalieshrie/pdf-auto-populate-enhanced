const express = require('express');
const router = express.Router();
const validation = require('../middleware/validation');
const fieldController = require('../controllers/field-controller');

router.use(validation.sanitizeInput);

router.get('/fields/types', fieldController.getFieldTypes.bind(fieldController));
router.post('/fields/validate', fieldController.validateFields.bind(fieldController));
router.get('/fields/mappings', fieldController.getPropertyMappings.bind(fieldController));
router.post('/fields/generate', fieldController.generateFieldConfig.bind(fieldController));
router.post('/fields', fieldController.createField.bind(fieldController));
router.put('/fields/:id', fieldController.updateField.bind(fieldController));
router.delete('/fields/:id', fieldController.deleteField.bind(fieldController));
router.post('/fields/:id/duplicate', fieldController.duplicateField.bind(fieldController));

module.exports = router;
