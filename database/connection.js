const mongoose = require('mongoose');
const config = require('../config/config');
const { dbLogger, performanceLogger } = require('../utils/logger');

// Connection state
let isConnected = false;
let connectionRetries = 0;
const maxRetries = 5;
const retryDelay = 5000; // 5 seconds

/**
 * Connect to MongoDB
 */
const connectDB = async () => {
    // If already connected, return
    if (isConnected) {
        return mongoose.connection;
    }

    try {
        // Set mongoose options for better performance and stability
        mongoose.set('strictQuery', false);
        
        // MongoDB connection options
        const options = {
            ...config.database.mongodb.options,
            // Connection options
            maxPoolSize: 10, // Maintain up to 10 socket connections
            serverSelectionTimeoutMS: 5000, // Keep trying to send operations for 5 seconds
            socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
            family: 4, // Use IPv4, skip trying IPv6
            // Monitoring
            monitorCommands: true
        };

        dbLogger.info('Connecting to MongoDB...', {
            uri: config.database.mongodb.uri.replace(/\/\/.*@/, '//***:***@'), // Hide credentials
            options: options
        });

        const timer = performanceLogger.startTimer('mongodb_connection');

        // Connect to MongoDB
        await mongoose.connect(config.database.mongodb.uri, options);

        const connectionTime = timer.end();
        
        isConnected = true;
        connectionRetries = 0;

        dbLogger.info('MongoDB connected successfully', {
            host: mongoose.connection.host,
            port: mongoose.connection.port,
            database: mongoose.connection.name,
            connectionTime: `${connectionTime.toFixed(2)}ms`
        });

        // Set up connection event handlers
        setupConnectionHandlers();

        return mongoose.connection;

    } catch (error) {
        isConnected = false;
        connectionRetries++;

        dbLogger.error('MongoDB connection failed', {
            error: error.message,
            retryCount: connectionRetries,
            maxRetries: maxRetries
        });

        // Retry connection if within retry limit
        if (connectionRetries < maxRetries) {
            dbLogger.info(`Retrying MongoDB connection in ${retryDelay / 1000} seconds...`, {
                attempt: connectionRetries + 1,
                maxRetries: maxRetries
            });

            setTimeout(() => {
                connectDB();
            }, retryDelay);
        } else {
            dbLogger.error('Max MongoDB connection retries exceeded', {
                maxRetries: maxRetries
            });
            process.exit(1);
        }

        throw error;
    }
};

/**
 * Set up MongoDB connection event handlers
 */
const setupConnectionHandlers = () => {
    const connection = mongoose.connection;

    // Connection events
    connection.on('connected', () => {
        isConnected = true;
        dbLogger.info('MongoDB connected');
    });

    connection.on('error', (error) => {
        isConnected = false;
        dbLogger.error('MongoDB connection error', { error: error.message });
    });

    connection.on('disconnected', () => {
        isConnected = false;
        dbLogger.warn('MongoDB disconnected');
        
        // Attempt to reconnect
        if (connectionRetries < maxRetries) {
            setTimeout(() => {
                dbLogger.info('Attempting to reconnect to MongoDB...');
                connectDB();
            }, retryDelay);
        }
    });

    connection.on('reconnected', () => {
        isConnected = true;
        connectionRetries = 0;
        dbLogger.info('MongoDB reconnected');
    });

    // Command monitoring for performance
    if (process.env.NODE_ENV === 'development') {
        connection.on('commandStarted', (event) => {
            dbLogger.debug('MongoDB command started', {
                commandName: event.commandName,
                databaseName: event.databaseName,
                requestId: event.requestId
            });
        });

        connection.on('commandSucceeded', (event) => {
            dbLogger.debug('MongoDB command succeeded', {
                commandName: event.commandName,
                duration: `${event.duration}ms`,
                requestId: event.requestId
            });
        });

        connection.on('commandFailed', (event) => {
            dbLogger.error('MongoDB command failed', {
                commandName: event.commandName,
                failure: event.failure,
                duration: `${event.duration}ms`,
                requestId: event.requestId
            });
        });
    }

    // Graceful shutdown
    process.on('SIGINT', async () => {
        await disconnectDB();
        process.exit(0);
    });

    process.on('SIGTERM', async () => {
        await disconnectDB();
        process.exit(0);
    });
};

/**
 * Disconnect from MongoDB
 */
const disconnectDB = async () => {
    if (!isConnected) {
        return;
    }

    try {
        await mongoose.connection.close();
        isConnected = false;
        dbLogger.info('MongoDB disconnected gracefully');
    } catch (error) {
        dbLogger.error('Error disconnecting from MongoDB', { error: error.message });
        throw error;
    }
};

/**
 * Get connection status
 */
const getConnectionStatus = () => {
    return {
        isConnected: isConnected,
        readyState: mongoose.connection.readyState,
        host: mongoose.connection.host,
        port: mongoose.connection.port,
        database: mongoose.connection.name,
        retryCount: connectionRetries
    };
};

/**
 * Get database statistics
 */
const getDatabaseStats = async () => {
    if (!isConnected) {
        throw new Error('Database not connected');
    }

    try {
        const admin = mongoose.connection.db.admin();
        const stats = await admin.stats();
        
        return {
            database: mongoose.connection.name,
            collections: stats.collections,
            documents: stats.objects,
            avgObjSize: stats.avgObjSize,
            dataSize: stats.dataSize,
            storageSize: stats.storageSize,
            indexes: stats.indexes,
            indexSize: stats.indexSize,
            fileSize: stats.fileSize
        };
    } catch (error) {
        dbLogger.error('Error getting database stats', { error: error.message });
        throw error;
    }
};

/**
 * Health check for database
 */
const healthCheck = async () => {
    try {
        if (!isConnected) {
            return {
                status: 'disconnected',
                message: 'Database not connected'
            };
        }

        // Simple ping to check connection
        await mongoose.connection.db.admin().ping();

        return {
            status: 'healthy',
            message: 'Database connection is healthy',
            readyState: mongoose.connection.readyState,
            host: mongoose.connection.host,
            database: mongoose.connection.name
        };
    } catch (error) {
        return {
            status: 'unhealthy',
            message: error.message,
            error: error.name
        };
    }
};

/**
 * Create database indexes for better performance
 */
const createIndexes = async () => {
    if (!isConnected) {
        throw new Error('Database not connected');
    }

    try {
        dbLogger.info('Creating database indexes...');

        // User indexes
        const User = require('../models/User');
        await User.createIndexes();

        // Chat indexes
        const Chat = require('../models/Chat');
        await Chat.createIndexes();

        // Message indexes
        const Message = require('../models/Message');
        await Message.createIndexes();

        dbLogger.info('Database indexes created successfully');
    } catch (error) {
        dbLogger.error('Error creating database indexes', { error: error.message });
        throw error;
    }
};

/**
 * Drop database (use with caution)
 */
const dropDatabase = async () => {
    if (!isConnected) {
        throw new Error('Database not connected');
    }

    if (process.env.NODE_ENV === 'production') {
        throw new Error('Cannot drop database in production');
    }

    try {
        await mongoose.connection.db.dropDatabase();
        dbLogger.warn('Database dropped', {
            database: mongoose.connection.name
        });
    } catch (error) {
        dbLogger.error('Error dropping database', { error: error.message });
        throw error;
    }
};

/**
 * Seed database with initial data
 */
const seedDatabase = async () => {
    if (!isConnected) {
        throw new Error('Database not connected');
    }

    try {
        dbLogger.info('Seeding database with initial data...');

        const User = require('../models/User');
        const bcrypt = require('bcryptjs');

        // Check if admin user exists
        const adminExists = await User.findOne({ role: 'admin' });
        
        if (!adminExists) {
            // Create default admin user
            const adminUser = new User({
                username: 'admin',
                email: 'admin@justconnect.com',
                password: await bcrypt.hash('admin123', 12),
                firstName: 'System',
                lastName: 'Administrator',
                role: 'admin',
                isVerified: true,
                isActive: true
            });

            await adminUser.save();
            dbLogger.info('Default admin user created');
        }

        // Create sample users if in development
        if (process.env.NODE_ENV === 'development') {
            const userCount = await User.countDocuments();
            
            if (userCount < 3) {
                const sampleUsers = [
                    {
                        username: 'kadir',
                        email: 'kadir@justconnect.com',
                        password: await bcrypt.hash('123456', 12),
                        firstName: 'Kadir',
                        lastName: 'Ertan',
                        role: 'admin',
                        isVerified: true,
                        isActive: true
                    },
                    {
                        username: 'ahmet',
                        email: 'ahmet@justconnect.com',
                        password: await bcrypt.hash('123456', 12),
                        firstName: 'Ahmet',
                        lastName: 'Yılmaz',
                        role: 'user',
                        isVerified: true,
                        isActive: true
                    },
                    {
                        username: 'fatma',
                        email: 'fatma@justconnect.com',
                        password: await bcrypt.hash('123456', 12),
                        firstName: 'Fatma',
                        lastName: 'Özkan',
                        role: 'user',
                        isVerified: true,
                        isActive: true
                    }
                ];

                await User.insertMany(sampleUsers);
                dbLogger.info('Sample users created for development');
            }
        }

        dbLogger.info('Database seeding completed');
    } catch (error) {
        dbLogger.error('Error seeding database', { error: error.message });
        throw error;
    }
};

/**
 * Backup database
 */
const backupDatabase = async (backupPath) => {
    if (!isConnected) {
        throw new Error('Database not connected');
    }

    // Note: This is a basic implementation
    // For production, use mongodump or a proper backup solution
    try {
        dbLogger.info('Starting database backup...', { backupPath });

        const fs = require('fs');
        const path = require('path');

        // Ensure backup directory exists
        const backupDir = path.dirname(backupPath);
        if (!fs.existsSync(backupDir)) {
            fs.mkdirSync(backupDir, { recursive: true });
        }

        // Get all collections
        const collections = await mongoose.connection.db.listCollections().toArray();
        const backup = {};

        for (const collectionInfo of collections) {
            const collectionName = collectionInfo.name;
            const collection = mongoose.connection.db.collection(collectionName);
            const documents = await collection.find({}).toArray();
            backup[collectionName] = documents;
        }

        // Write backup to file
        fs.writeFileSync(backupPath, JSON.stringify(backup, null, 2));

        dbLogger.info('Database backup completed', {
            backupPath,
            collections: collections.length,
            fileSize: fs.statSync(backupPath).size
        });

        return backupPath;
    } catch (error) {
        dbLogger.error('Error backing up database', { error: error.message });
        throw error;
    }
};

/**
 * Clean up old data
 */
const cleanupOldData = async (daysOld = 30) => {
    if (!isConnected) {
        throw new Error('Database not connected');
    }

    try {
        dbLogger.info('Starting database cleanup...', { daysOld });

        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysOld);

        const Message = require('../models/Message');
        
        // Delete expired messages
        const expiredMessages = await Message.deleteMany({
            expiresAt: { $lt: new Date() }
        });

        // Delete old temporary messages
        const oldTempMessages = await Message.deleteMany({
            isDeleted: true,
            deletedAt: { $lt: cutoffDate }
        });

        dbLogger.info('Database cleanup completed', {
            expiredMessages: expiredMessages.deletedCount,
            oldTempMessages: oldTempMessages.deletedCount
        });

        return {
            expiredMessages: expiredMessages.deletedCount,
            oldTempMessages: oldTempMessages.deletedCount
        };
    } catch (error) {
        dbLogger.error('Error cleaning up database', { error: error.message });
        throw error;
    }
};

// Export database utilities
module.exports = {
    connectDB,
    disconnectDB,
    getConnectionStatus,
    getDatabaseStats,
    healthCheck,
    createIndexes,
    dropDatabase,
    seedDatabase,
    backupDatabase,
    cleanupOldData,
    
    // Mongoose instance for direct access
    mongoose
};