/**
 * PDF Auto-Populate Enhanced Server
 * Main server entry point
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const path = require('path');
require('dotenv').config();

// Import configuration
const appConfig = require('./config/app-config');
const database = require('./config/database');

// Import middleware
const errorHandler = require('./middleware/error-handler');
const upload = require('./middleware/upload');

// Import routes
const pdfRoutes = require('./routes/pdf-routes');
const templateRoutes = require('./routes/template-routes');
const apiRoutes = require('./routes/api-routes');

class Server {
    constructor() {
        this.app = express();
        this.port = process.env.PORT || 3000;
        this.host = process.env.HOST || 'localhost';
        
        this.setupMiddleware();
        this.setupRoutes();
        this.setupErrorHandling();
    }

    setupMiddleware() {
        // Security middleware
        this.app.use(helmet({
            contentSecurityPolicy: {
                directives: {
                    defaultSrc: ["'self'"],
                    styleSrc: ["'self'", "'unsafe-inline'"],
                    scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
                    imgSrc: ["'self'", "data:", "blob:"],
                    fontSrc: ["'self'", "data:"],
                    connectSrc: ["'self'"],
                    frameSrc: ["'self'"]
                }
            }
        }));

        // CORS configuration
        const corsOptions = {
            origin: process.env.NODE_ENV === 'production' ? 
                ['https://yourdomain.com'] : 
                ['http://localhost:3000', 'http://127.0.0.1:3000'],
            credentials: true,
            methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
            allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
        };
        this.app.use(cors(corsOptions));

        // Compression and parsing middleware
        this.app.use(compression());
        this.app.use(express.json({ limit: '10mb' }));
        this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));
        this.app.use(cookieParser());

        // Logging
        if (process.env.NODE_ENV !== 'test') {
            this.app.use(morgan('combined'));
        }

        // Static files
        this.app.use(express.static(path.join(__dirname, 'public'), {
            maxAge: process.env.NODE_ENV === 'production' ? '1d' : 0,
            setHeaders: (res, path) => {
                if (path.endsWith('.pdf')) {
                    res.set('Content-Type', 'application/pdf');
                }
            }
        }));

        // Upload middleware
        this.app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));
    }

    setupRoutes() {
        // Health check endpoint
        this.app.get('/health', (req, res) => {
            res.status(200).json({
                status: 'OK',
                timestamp: new Date().toISOString(),
                version: process.env.npm_package_version || '1.0.0',
                environment: process.env.NODE_ENV || 'development'
            });
        });

        // API routes
        this.app.use('/api/pdf', pdfRoutes);
        this.app.use('/api/templates', templateRoutes);
        this.app.use('/api', apiRoutes);

        // Serve main application
        this.app.get('/', (req, res) => {
            res.sendFile(path.join(__dirname, 'public', 'index.html'));
        });

        // Catch all route for SPA
        this.app.get('*', (req, res) => {
            // If it's an API route that doesn't exist, return 404
            if (req.path.startsWith('/api/')) {
                return res.status(404).json({
                    error: 'API endpoint not found',
                    path: req.path,
                    method: req.method
                });
            }
            
            // Otherwise serve the main app
            res.sendFile(path.join(__dirname, 'public', 'index.html'));
        });
    }

    setupErrorHandling() {
        // 404 handler
        this.app.use((req, res, next) => {
            const error = new Error(`Route ${req.originalUrl} not found`);
            error.status = 404;
            next(error);
        });

        // Global error handler
        this.app.use(errorHandler.handle);
    }

    async start() {
        try {
            // Initialize database connection
            await database.connect();
            console.log('Database connected successfully');

            // Ensure upload directories exist
            await this.ensureDirectoriesExist();

            // Start server
            this.server = this.app.listen(this.port, this.host, () => {
                console.log(`
╔═══════════════════════════════════════════════════════════╗
║                PDF Auto-Populate Enhanced                 ║
║                                                           ║
║  🚀 Server running at: http://${this.host}:${this.port.toString().padEnd(20)} ║
║  📝 Environment: ${(process.env.NODE_ENV || 'development').padEnd(27)} ║
║  📊 Process ID: ${process.pid.toString().padEnd(28)} ║
║  🕒 Started: ${new Date().toLocaleString().padEnd(31)} ║
╚═══════════════════════════════════════════════════════════╝
                `);
            });

            // Graceful shutdown
            this.setupGracefulShutdown();

        } catch (error) {
            console.error('Failed to start server:', error);
            process.exit(1);
        }
    }

    async ensureDirectoriesExist() {
        const fs = require('fs').promises;
        const directories = [
            'public/uploads',
            'public/uploads/pdfs',
            'public/uploads/templates', 
            'public/uploads/signatures',
            'logs'
        ];

        for (const dir of directories) {
            try {
                await fs.access(dir);
            } catch {
                await fs.mkdir(dir, { recursive: true });
                console.log(`Created directory: ${dir}`);
            }
        }
    }

    setupGracefulShutdown() {
        const gracefulShutdown = async (signal) => {
            console.log(`\n${signal} received. Starting graceful shutdown...`);
            
            if (this.server) {
                this.server.close(async () => {
                    console.log('HTTP server closed');
                    
                    try {
                        await database.disconnect();
                        console.log('Database connection closed');
                    } catch (error) {
                        console.error('Error closing database connection:', error);
                    }
                    
                    console.log('Graceful shutdown completed');
                    process.exit(0);
                });

                // Force shutdown after 10 seconds
                setTimeout(() => {
                    console.error('Forceful shutdown');
                    process.exit(1);
                }, 10000);
            } else {
                process.exit(0);
            }
        };

        // Listen for termination signals
        process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
        process.on('SIGINT', () => gracefulShutdown('SIGINT'));

        // Handle uncaught exceptions
        process.on('uncaughtException', (error) => {
            console.error('Uncaught Exception:', error);
            gracefulShutdown('UNCAUGHT_EXCEPTION');
        });

        process.on('unhandledRejection', (reason, promise) => {
            console.error('Unhandled Rejection at:', promise, 'reason:', reason);
            gracefulShutdown('UNHANDLED_REJECTION');
        });
    }

    stop() {
        if (this.server) {
            this.server.close();
        }
    }
}

// Create and start server
const server = new Server();

// Only start if this file is run directly (not required as module)
if (require.main === module) {
    server.start().catch((error) => {
        console.error('Server startup failed:', error);
        process.exit(1);
    });
}

module.exports = server;
