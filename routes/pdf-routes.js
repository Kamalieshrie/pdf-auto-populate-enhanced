const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const validation = require('../middleware/validation');
const pdfController = require('../controllers/pdf-controller');

const upload = multer({ dest: 'public/uploads/' });

router.use(validation.sanitizeInput);

router.post('/upload', upload.single('pdf'), pdfController.inspectPdf.bind(pdfController));
router.post('/populate', upload.single('pdf'), pdfController.populatePdf.bind(pdfController));
router.get('/download/:filename', pdfController.downloadPdf.bind(pdfController));
router.get('/health', pdfController.healthCheck.bind(pdfController));

module.exports = router;
