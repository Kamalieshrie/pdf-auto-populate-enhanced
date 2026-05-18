// Simple auth middleware stub
const auth = {
    required: (req, res, next) => next(),
    optional: (req, res, next) => next(),
    admin: (req, res, next) => next(),
    apiKey: (req, res, next) => next(),
};

module.exports = auth;
