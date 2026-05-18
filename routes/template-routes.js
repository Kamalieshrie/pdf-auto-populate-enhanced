const express = require('express');
const router = express.Router();
const multer = require('multer');
const validation = require('../middleware/validation');
const templateController = require('../controllers/template-controller');

const upload = multer({ dest: 'public/uploads/' });
router.use(validation.sanitizeInput);

router.post('/save', templateController.saveTemplate.bind(templateController));
router.get('/', templateController.loadTemplates.bind(templateController));
router.get('/search', templateController.searchTemplates.bind(templateController));
router.get('/categories', templateController.getCategories.bind(templateController));
router.get('/stats', templateController.getTemplateStats.bind(templateController));
router.get('/:id', templateController.loadTemplate.bind(templateController));
router.delete('/:id', templateController.deleteTemplate.bind(templateController));
router.post('/:id/duplicate', templateController.duplicateTemplate.bind(templateController));
router.post('/import', upload.single('template'), templateController.importTemplate.bind(templateController));
router.get('/:id/export', templateController.exportTemplate.bind(templateController));
router.post('/cleanup', templateController.cleanupTemplates.bind(templateController));

module.exports = router;
