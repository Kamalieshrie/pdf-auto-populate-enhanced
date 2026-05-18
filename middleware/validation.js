const Joi = require('joi');

const validateSchema = (schema) => (req, res, next) => {
    const { error } = schema.validate(req.body, { abortEarly: false });
    if (error) return res.status(400).json({ error: error.details.map(d => d.message) });
    next();
};

const schemas = {
    customValidate: (schema) => Joi.object(schema),
    queryParams: Joi.object({ search: Joi.string(), page: Joi.number(), limit: Joi.number() })
};

module.exports = {
    validateBody: (schema) => (req, res, next) => { const {error} = schema.validate(req.body); if(error) return res.status(400).json({error: error.message}); next(); },
    validateQuery: (req, res, next) => next(),
    validateParams: (req, res, next) => next(),
    validateCustomFields: (req, res, next) => next(),
    validateTemplateData: (req, res, next) => next(),
    validatePropertyMapping: (req, res, next) => next(),
    validatePagination: (req, res, next) => next(),
    sanitize: (req, res, next) => next(),
    sanitizeInput: (req, res, next) => next(),
    validatePdfFileUpload: (req, res, next) => next(),
    validatePdfUpload: (req, res, next) => next(),
    validateSchema,
    validateQueryParams: (req, res, next) => next(),
    validateFieldData: (req, res, next) => next(),
    validateObjectId: (req, res, next) => next(),
    schemas
};
