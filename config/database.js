// server/config/database.js - Database Configuration and Connection Management
const path = require('path');
const fs = require('fs').promises;

// Load environment variables
require('dotenv').config();

const databaseConfig = {
    // PostgreSQL Configuration (Primary Database)
    postgresql: {
        enabled: process.env.DATABASE_URL ? true : false,
        connection: {
            host: process.env.DB_HOST || 'localhost',
            port: parseInt(process.env.DB_PORT) || 5432,
            database: process.env.DB_NAME || 'pdf_system',
            username: process.env.DB_USER || 'postgres',
            password: process.env.DB_PASSWORD || '',
            ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
            dialectOptions: {
                ssl: process.env.DB_SSL === 'true' ? {
                    require: true,
                    rejectUnauthorized: false
                } : false
            }
        },
        pool: {
            min: parseInt(process.env.DB_POOL_MIN) || 2,
            max: parseInt(process.env.DB_POOL_SIZE) || 10,
            acquire: parseInt(process.env.DB_ACQUIRE_TIMEOUT) || 30000,
            idle: parseInt(process.env.DB_IDLE_TIMEOUT) || 10000,
        },
        options: {
            dialect: 'postgres',
            logging: process.env.NODE_ENV === 'development' ? console.log : false,
            define: {
                timestamps: true,
                underscored: true,
                freezeTableName: true,
            },
            timezone: process.env.TZ || 'UTC',
        }
    },

    // SQLite Configuration (Development/Fallback)
    sqlite: {
        enabled: !process.env.DATABASE_URL || process.env.NODE_ENV === 'development',
        connection: {
            storage: path.resolve(__dirname, '../..', 'data', 'database.sqlite'),
            logging: process.env.NODE_ENV === 'development' ? console.log : false,
        },
        options: {
            dialect: 'sqlite',
            define: {
                timestamps: true,
                underscored: true,
                freezeTableName: true,
            },
        }
    },

    // Redis Configuration (Caching/Sessions)
    redis: {
        enabled: process.env.REDIS_URL ? true : false,
        connection: {
            url: process.env.REDIS_URL || 'redis://localhost:6379',
            host: process.env.REDIS_HOST || 'localhost',
            port: parseInt(process.env.REDIS_PORT) || 6379,
            password: process.env.REDIS_PASSWORD || null,
            db: parseInt(process.env.REDIS_DB) || 0,
        },
        options: {
            retryDelayOnFailover: 100,
            enableReadyCheck: true,
            maxRetriesPerRequest: 3,
            lazyConnect: true,
            keyPrefix: process.env.REDIS_KEY_PREFIX || 'pdf-system:',
        },
        ttl: {
            session: parseInt(process.env.REDIS_SESSION_TTL) || 86400, // 24 hours
            cache: parseInt(process.env.REDIS_CACHE_TTL) || 3600, // 1 hour
            template: parseInt(process.env.REDIS_TEMPLATE_TTL) || 86400 * 7, // 7 days
        }
    },

    // File-based Storage Configuration (JSON Files)
    fileStorage: {
        enabled: true, // Always enabled as fallback
        paths: {
            templates: path.resolve(__dirname, '../..', 'templates', 'saved-layouts'),
            userProfiles: path.resolve(__dirname, '../..', 'data', 'users'),
            analytics: path.resolve(__dirname, '../..', 'data', 'analytics'),
            backups: path.resolve(__dirname, '../..', 'data', 'backups'),
        },
        options: {
            autoBackup: process.env.ENABLE_AUTO_BACKUP === 'true',
            backupInterval: parseInt(process.env.BACKUP_INTERVAL) || 86400000, // 24 hours
            maxBackups: parseInt(process.env.MAX_BACKUPS) || 30,
            compression: process.env.BACKUP_COMPRESSION === 'true',
        }
    },

    // Migration Configuration
    migrations: {
        enabled: process.env.ENABLE_MIGRATIONS !== 'false',
        path: path.resolve(__dirname, '../migrations'),
        tableName: 'migrations',
        pattern: /^\d+[\w-]+\.js$/,
        autoRun: process.env.AUTO_RUN_MIGRATIONS === 'true',
    },

    // Seeding Configuration
    seeds: {
        enabled: process.env.ENABLE_SEEDS === 'true',
        path: path.resolve(__dirname, '../seeds'),
        pattern: /^\d+[\w-]+\.js$/,
        autoRun: process.env.AUTO_RUN_SEEDS === 'true',
    },
};

// Database Schema Definitions
const schemaDefinitions = {
    // User Management (if enabled)
    users: {
        id: {
            type: 'INTEGER',
            primaryKey: true,
            autoIncrement: true,
        },
        email: {
            type: 'STRING',
            unique: true,
            allowNull: false,
        },
        password_hash: {
            type: 'STRING',
            allowNull: false,
        },
        first_name: {
            type: 'STRING',
            allowNull: false,
        },
        last_name: {
            type: 'STRING',
            allowNull: false,
        },
        role: {
            type: 'ENUM',
            values: ['admin', 'user'],
            defaultValue: 'user',
        },
        is_active: {
            type: 'BOOLEAN',
            defaultValue: true,
        },
        last_login: {
            type: 'DATE',
            allowNull: true,
        },
        created_at: {
            type: 'DATE',
            defaultValue: 'NOW',
        },
        updated_at: {
            type: 'DATE',
            defaultValue: 'NOW',
        },
    },

    // PDF Templates
    pdf_templates: {
        id: {
            type: 'INTEGER',
            primaryKey: true,
            autoIncrement: true,
        },
        user_id: {
            type: 'INTEGER',
            references: { model: 'users', key: 'id' },
            allowNull: true,
        },
        name: {
            type: 'STRING',
            allowNull: false,
        },
        description: {
            type: 'TEXT',
            allowNull: true,
        },
        original_filename: {
            type: 'STRING',
            allowNull: false,
        },
        file_path: {
            type: 'STRING',
            allowNull: false,
        },
        file_size: {
            type: 'INTEGER',
            allowNull: false,
        },
        form_fields: {
            type: 'JSON',
            allowNull: true,
        },
        custom_fields: {
            type: 'JSON',
            allowNull: true,
        },
        is_public: {
            type: 'BOOLEAN',
            defaultValue: false,
        },
        usage_count: {
            type: 'INTEGER',
            defaultValue: 0,
        },
        created_at: {
            type: 'DATE',
            defaultValue: 'NOW',
        },
        updated_at: {
            type: 'DATE',
            defaultValue: 'NOW',
        },
    },

    // Custom Field Templates
    field_templates: {
        id: {
            type: 'INTEGER',
            primaryKey: true,
            autoIncrement: true,
        },
        user_id: {
            type: 'INTEGER',
            references: { model: 'users', key: 'id' },
            allowNull: true,
        },
        name: {
            type: 'STRING',
            allowNull: false,
        },
        description: {
            type: 'TEXT',
            allowNull: true,
        },
        fields_data: {
            type: 'JSON',
            allowNull: false,
        },
        category: {
            type: 'STRING',
            allowNull: true,
        },
        is_public: {
            type: 'BOOLEAN',
            defaultValue: false,
        },
        usage_count: {
            type: 'INTEGER',
            defaultValue: 0,
        },
        created_at: {
            type: 'DATE',
            defaultValue: 'NOW',
        },
        updated_at: {
            type: 'DATE',
            defaultValue: 'NOW',
        },
    },

    // Processing History
    processing_history: {
        id: {
            type: 'INTEGER',
            primaryKey: true,
            autoIncrement: true,
        },
        user_id: {
            type: 'INTEGER',
            references: { model: 'users', key: 'id' },
            allowNull: true,
        },
        template_id: {
            type: 'INTEGER',
            references: { model: 'pdf_templates', key: 'id' },
            allowNull: true,
        },
        input_filename: {
            type: 'STRING',
            allowNull: false,
        },
        output_filename: {
            type: 'STRING',
            allowNull: false,
        },
        processing_data: {
            type: 'JSON',
            allowNull: true,
        },
        custom_fields_used: {
            type: 'JSON',
            allowNull: true,
        },
        processing_time_ms: {
            type: 'INTEGER',
            allowNull: true,
        },
        status: {
            type: 'ENUM',
            values: ['success', 'error', 'processing'],
            defaultValue: 'processing',
        },
        error_message: {
            type: 'TEXT',
            allowNull: true,
        },
        ip_address: {
            type: 'STRING',
            allowNull: true,
        },
        user_agent: {
            type: 'STRING',
            allowNull: true,
        },
        created_at: {
            type: 'DATE',
            defaultValue: 'NOW',
        },
    },

    // System Analytics
    analytics: {
        id: {
            type: 'INTEGER',
            primaryKey: true,
            autoIncrement: true,
        },
        event_type: {
            type: 'STRING',
            allowNull: false,
        },
        event_data: {
            type: 'JSON',
            allowNull: true,
        },
        user_id: {
            type: 'INTEGER',
            references: { model: 'users', key: 'id' },
            allowNull: true,
        },
        ip_address: {
            type: 'STRING',
            allowNull: true,
        },
        user_agent: {
            type: 'STRING',
            allowNull: true,
        },
        created_at: {
            type: 'DATE',
            defaultValue: 'NOW',
        },
    },
};

// Utility Functions
const dbUtils = {
    // Create data directories if they don't exist
    async ensureDataDirectories() {
        const paths = [
            path.resolve(__dirname, '../..', 'data'),
            databaseConfig.fileStorage.paths.templates,
            databaseConfig.fileStorage.paths.userProfiles,
            databaseConfig.fileStorage.paths.analytics,
            databaseConfig.fileStorage.paths.backups,
        ];

        for (const dirPath of paths) {
            try {
                await fs.access(dirPath);
            } catch (error) {
                await fs.mkdir(dirPath, { recursive: true });
                console.log(`Created directory: ${dirPath}`);
            }
        }
    },

    // Get connection string based on environment
    getConnectionString() {
        if (process.env.DATABASE_URL) {
            return process.env.DATABASE_URL;
        }

        const config = databaseConfig.postgresql.connection;
        return `postgresql://${config.username}:${config.password}@${config.host}:${config.port}/${config.database}`;
    },

    // Test database connectivity
    async testConnection() {
        console.log('Testing database connectivity...');
        
        try {
            if (databaseConfig.postgresql.enabled) {
                // Test PostgreSQL connection
                const { Client } = require('pg');
                const client = new Client({
                    connectionString: this.getConnectionString(),
                    ssl: databaseConfig.postgresql.connection.ssl,
                });
                
                await client.connect();
                await client.query('SELECT NOW()');
                await client.end();
                
                console.log('✅ PostgreSQL connection successful');
                return { type: 'postgresql', status: 'connected' };
            } else {
                // Test SQLite connection
                const sqlite3 = require('sqlite3');
                const { open } = require('sqlite');
                
                const db = await open({
                    filename: databaseConfig.sqlite.connection.storage,
                    driver: sqlite3.Database,
                });
                
                await db.get('SELECT 1');
                await db.close();
                
                console.log('✅ SQLite connection successful');
                return { type: 'sqlite', status: 'connected' };
            }
        } catch (error) {
            console.error('❌ Database connection failed:', error.message);
            return { type: 'none', status: 'failed', error: error.message };
        }
    },

    // Initialize file storage directories
    async initializeFileStorage() {
        await this.ensureDataDirectories();
        
        // Create initial template files if they don't exist
        const defaultTemplatePath = path.join(databaseConfig.fileStorage.paths.templates, 'default.json');
        
        try {
            await fs.access(defaultTemplatePath);
        } catch (error) {
            const defaultTemplate = {
                name: 'Default Template',
                description: 'Default field template',
                fields: [],
                created: new Date().toISOString(),
            };
            
            await fs.writeFile(defaultTemplatePath, JSON.stringify(defaultTemplate, null, 2));
            console.log('Created default template file');
        }
    },

    // Backup database (for SQLite)
    async backupDatabase() {
        if (!databaseConfig.fileStorage.options.autoBackup) {
            return;
        }

        const backupDir = databaseConfig.fileStorage.paths.backups;
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupFile = path.join(backupDir, `database-backup-${timestamp}.sqlite`);

        try {
            if (databaseConfig.sqlite.enabled) {
                const sourceFile = databaseConfig.sqlite.connection.storage;
                await fs.copyFile(sourceFile, backupFile);
                console.log(`Database backed up to: ${backupFile}`);
            }
        } catch (error) {
            console.error('Database backup failed:', error.message);
        }
    },
};

// Environment-specific configuration
if (process.env.NODE_ENV === 'test') {
    databaseConfig.sqlite.connection.storage = ':memory:';
    databaseConfig.postgresql.enabled = false;
}

module.exports = {
    config: databaseConfig,
    schemas: schemaDefinitions,
    utils: dbUtils,
};