const winston = require('winston');
const path = require('path');
const fs = require('fs');
const config = require('../config/config');

// Create logs directory if it doesn't exist
const logsDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
}

// Custom format for logs
const customFormat = winston.format.combine(
    winston.format.timestamp({
        format: 'YYYY-MM-DD HH:mm:ss'
    }),
    winston.format.errors({ stack: true }),
    winston.format.printf(({ level, message, timestamp, stack, ...meta }) => {
        let log = `${timestamp} [${level.toUpperCase()}]: ${message}`;
        
        // Add stack trace for errors
        if (stack) {
            log += `\n${stack}`;
        }
        
        // Add metadata if present
        if (Object.keys(meta).length > 0) {
            log += `\nMetadata: ${JSON.stringify(meta, null, 2)}`;
        }
        
        return log;
    })
);

// Create winston logger
const logger = winston.createLogger({
    level: config.logging.level || 'info',
    format: customFormat,
    defaultMeta: { service: 'justconnect-v2' },
    transports: [
        // File transport for errors
        new winston.transports.File({
            filename: path.join(logsDir, 'error.log'),
            level: 'error',
            maxsize: 5242880, // 5MB
            maxFiles: 5,
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.json()
            )
        }),
        
        // File transport for all logs
        new winston.transports.File({
            filename: path.join(logsDir, 'combined.log'),
            maxsize: 5242880, // 5MB
            maxFiles: 10,
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.json()
            )
        })
        
        // Removed DailyRotateFile - use the basic File transport instead
    ],
    
    // Handle uncaught exceptions
    exceptionHandlers: [
        new winston.transports.File({
            filename: path.join(logsDir, 'exceptions.log')
        })
    ],
    
    // Handle unhandled promise rejections
    rejectionHandlers: [
        new winston.transports.File({
            filename: path.join(logsDir, 'rejections.log')
        })
    ]
});

// Add console transport for development
if (process.env.NODE_ENV !== 'production') {
    logger.add(new winston.transports.Console({
        format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple(),
            winston.format.printf(({ level, message, timestamp }) => {
                return `${timestamp} ${level}: ${message}`;
            })
        )
    }));
}

// Custom logging methods for different contexts
const createContextLogger = (context) => {
    return {
        error: (message, meta = {}) => {
            logger.error(message, { context, ...meta });
        },
        warn: (message, meta = {}) => {
            logger.warn(message, { context, ...meta });
        },
        info: (message, meta = {}) => {
            logger.info(message, { context, ...meta });
        },
        debug: (message, meta = {}) => {
            logger.debug(message, { context, ...meta });
        },
        verbose: (message, meta = {}) => {
            logger.verbose(message, { context, ...meta });
        }
    };
};

// HTTP request logger middleware
const httpLogger = (req, res, next) => {
    const start = Date.now();
    
    // Log request
    logger.info('HTTP Request', {
        method: req.method,
        url: req.url,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        userId: req.user?.id,
        context: 'HTTP'
    });
    
    // Log response
    res.on('finish', () => {
        const duration = Date.now() - start;
        const level = res.statusCode >= 400 ? 'warn' : 'info';
        
        logger.log(level, 'HTTP Response', {
            method: req.method,
            url: req.url,
            statusCode: res.statusCode,
            duration: `${duration}ms`,
            ip: req.ip,
            userId: req.user?.id,
            context: 'HTTP'
        });
    });
    
    next();
};

// Socket.IO logger
const socketLogger = createContextLogger('SOCKET');

// Authentication logger
const authLogger = createContextLogger('AUTH');

// Database logger
const dbLogger = createContextLogger('DATABASE');

// File upload logger
const uploadLogger = createContextLogger('UPLOAD');

// Chat logger
const chatLogger = createContextLogger('CHAT');

// Error logger with stack trace
const logError = (error, context = 'APPLICATION', meta = {}) => {
    logger.error(error.message || 'Unknown error', {
        context,
        stack: error.stack,
        name: error.name,
        code: error.code,
        ...meta
    });
};

// Security event logger
const securityLogger = {
    loginAttempt: (email, ip, success, reason = null) => {
        const level = success ? 'info' : 'warn';
        logger.log(level, `Login attempt ${success ? 'successful' : 'failed'}`, {
            email,
            ip,
            success,
            reason,
            context: 'SECURITY'
        });
    },
    
    passwordChange: (userId, ip) => {
        logger.info('Password changed', {
            userId,
            ip,
            context: 'SECURITY'
        });
    },
    
    accountLocked: (email, ip, reason) => {
        logger.warn('Account locked', {
            email,
            ip,
            reason,
            context: 'SECURITY'
        });
    },
    
    suspiciousActivity: (userId, activity, ip, details = {}) => {
        logger.warn('Suspicious activity detected', {
            userId,
            activity,
            ip,
            details,
            context: 'SECURITY'
        });
    },
    
    tokenGenerated: (type, userId, ip) => {
        logger.info('Token generated', {
            type,
            userId,
            ip,
            context: 'SECURITY'
        });
    },
    
    fileUpload: (userId, filename, fileType, size, ip) => {
        logger.info('File uploaded', {
            userId,
            filename,
            fileType,
            size,
            ip,
            context: 'SECURITY'
        });
    }
};

// Performance logger
const performanceLogger = {
    startTimer: (operation) => {
        const start = process.hrtime.bigint();
        return {
            end: (details = {}) => {
                const end = process.hrtime.bigint();
                const duration = Number(end - start) / 1000000; // Convert to milliseconds
                
                logger.info(`Performance: ${operation}`, {
                    operation,
                    duration: `${duration.toFixed(2)}ms`,
                    ...details,
                    context: 'PERFORMANCE'
                });
                
                return duration;
            }
        };
    },
    
    memoryUsage: () => {
        const usage = process.memoryUsage();
        logger.info('Memory usage', {
            rss: `${Math.round(usage.rss / 1024 / 1024)}MB`,
            heapTotal: `${Math.round(usage.heapTotal / 1024 / 1024)}MB`,
            heapUsed: `${Math.round(usage.heapUsed / 1024 / 1024)}MB`,
            external: `${Math.round(usage.external / 1024 / 1024)}MB`,
            context: 'PERFORMANCE'
        });
    },
    
    dbQuery: (query, duration, results = null) => {
        logger.debug('Database query', {
            query: query.substring(0, 200), // Truncate long queries
            duration: `${duration}ms`,
            resultCount: results?.length || 0,
            context: 'PERFORMANCE'
        });
    }
};

// Application lifecycle logger
const lifecycleLogger = {
    startup: (port, environment) => {
        logger.info('Application starting', {
            port,
            environment,
            nodeVersion: process.version,
            pid: process.pid,
            context: 'LIFECYCLE'
        });
    },
    
    shutdown: (reason) => {
        logger.info('Application shutting down', {
            reason,
            uptime: process.uptime(),
            context: 'LIFECYCLE'
        });
    },
    
    ready: (port) => {
        logger.info('Application ready', {
            port,
            context: 'LIFECYCLE'
        });
    },
    
    error: (error) => {
        logger.error('Application error', {
            error: error.message,
            stack: error.stack,
            context: 'LIFECYCLE'
        });
    }
};

// Stream logs for real-time monitoring
const getLogStream = (level = 'info') => {
    const stream = new winston.transports.Stream({
        stream: process.stdout,
        level: level
    });
    
    return stream;
};

// Export log files list
const getLogFiles = () => {
    try {
        const files = fs.readdirSync(logsDir);
        return files.map(file => ({
            name: file,
            path: path.join(logsDir, file),
            size: fs.statSync(path.join(logsDir, file)).size,
            modified: fs.statSync(path.join(logsDir, file)).mtime
        }));
    } catch (error) {
        logger.error('Error reading log files', { error: error.message });
        return [];
    }
};

// Clean old logs
const cleanOldLogs = (daysOld = 30) => {
    try {
        const files = fs.readdirSync(logsDir);
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysOld);
        
        let deletedCount = 0;
        
        files.forEach(file => {
            const filePath = path.join(logsDir, file);
            const stats = fs.statSync(filePath);
            
            if (stats.mtime < cutoffDate) {
                fs.unlinkSync(filePath);
                deletedCount++;
            }
        });
        
        logger.info('Log cleanup completed', {
            deletedFiles: deletedCount,
            cutoffDate: cutoffDate.toISOString(),
            context: 'MAINTENANCE'
        });
        
        return deletedCount;
    } catch (error) {
        logger.error('Error cleaning old logs', { error: error.message });
        return 0;
    }
};

module.exports = {
    // Main logger
    logger,
    
    // Context loggers
    createContextLogger,
    httpLogger,
    socketLogger,
    authLogger,
    dbLogger,
    uploadLogger,
    chatLogger,
    
    // Specialized loggers
    logError,
    securityLogger,
    performanceLogger,
    lifecycleLogger,
    
    // Utilities
    getLogStream,
    getLogFiles,
    cleanOldLogs
};