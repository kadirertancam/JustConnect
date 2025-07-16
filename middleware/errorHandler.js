const { logger, logError } = require('../utils/logger');
const config = require('../config/config');

/**
 * Error types and their corresponding HTTP status codes
 */
const ERROR_TYPES = {
    // Client errors (4xx)
    VALIDATION_ERROR: 400,
    INVALID_CREDENTIALS: 401,
    UNAUTHORIZED: 401,
    TOKEN_EXPIRED: 401,
    INVALID_TOKEN: 403,
    FORBIDDEN: 403,
    ACCESS_DENIED: 403,
    NOT_FOUND: 404,
    USER_NOT_FOUND: 404,
    CHAT_NOT_FOUND: 404,
    MESSAGE_NOT_FOUND: 404,
    FILE_NOT_FOUND: 404,
    METHOD_NOT_ALLOWED: 405,
    CONFLICT: 409,
    USER_ALREADY_EXISTS: 409,
    ALREADY_MEMBER: 409,
    UNPROCESSABLE_ENTITY: 422,
    TOO_MANY_REQUESTS: 429,
    RATE_LIMIT_EXCEEDED: 429,
    
    // Server errors (5xx)
    INTERNAL_SERVER_ERROR: 500,
    DATABASE_ERROR: 500,
    UPLOAD_FAILED: 500,
    EMAIL_SEND_FAILED: 500,
    EXTERNAL_SERVICE_ERROR: 502,
    SERVICE_UNAVAILABLE: 503,
    GATEWAY_TIMEOUT: 504
};

/**
 * Custom application error class
 */
class AppError extends Error {
    constructor(message, type = 'INTERNAL_SERVER_ERROR', statusCode = null, details = null) {
        super(message);
        this.name = 'AppError';
        this.type = type;
        this.statusCode = statusCode || ERROR_TYPES[type] || 500;
        this.details = details;
        this.timestamp = new Date();
        this.isOperational = true; // Marks this as an expected error
        
        // Capture stack trace
        Error.captureStackTrace(this, AppError);
    }
}

/**
 * Create error response object
 */
const createErrorResponse = (error, isDevelopment = false) => {
    const response = {
        success: false,
        error: {
            type: error.type || 'INTERNAL_SERVER_ERROR',
            message: error.message || 'Bir hata oluştu',
            timestamp: error.timestamp || new Date()
        }
    };

    // Add error details if available
    if (error.details) {
        response.error.details = error.details;
    }

    // Add stack trace in development
    if (isDevelopment && error.stack) {
        response.error.stack = error.stack;
    }

    // Add request ID if available
    if (error.requestId) {
        response.error.requestId = error.requestId;
    }

    return response;
};

/**
 * Handle MongoDB/Mongoose errors
 */
const handleMongoError = (error) => {
    // Duplicate key error
    if (error.code === 11000) {
        const field = Object.keys(error.keyValue)[0];
        const value = error.keyValue[field];
        
        return new AppError(
            `Bu ${field} zaten kullanılıyor: ${value}`,
            'CONFLICT',
            409,
            { field, value }
        );
    }

    // Validation error
    if (error.name === 'ValidationError') {
        const errors = Object.values(error.errors).map(err => ({
            field: err.path,
            message: err.message,
            value: err.value
        }));

        return new AppError(
            'Veri doğrulama hatası',
            'VALIDATION_ERROR',
            400,
            { validationErrors: errors }
        );
    }

    // Cast error (invalid ObjectId)
    if (error.name === 'CastError') {
        return new AppError(
            `Geçersiz ${error.path}: ${error.value}`,
            'VALIDATION_ERROR',
            400,
            { field: error.path, value: error.value }
        );
    }

    // MongoDB connection error
    if (error.name === 'MongoNetworkError' || error.name === 'MongoTimeoutError') {
        return new AppError(
            'Veritabanı bağlantı hatası',
            'DATABASE_ERROR',
            503
        );
    }

    // Default MongoDB error
    return new AppError(
        'Veritabanı hatası',
        'DATABASE_ERROR',
        500
    );
};

/**
 * Handle JWT errors
 */
const handleJWTError = (error) => {
    if (error.name === 'JsonWebTokenError') {
        return new AppError('Geçersiz token', 'INVALID_TOKEN', 403);
    }

    if (error.name === 'TokenExpiredError') {
        return new AppError('Token süresi doldu', 'TOKEN_EXPIRED', 401);
    }

    if (error.name === 'NotBeforeError') {
        return new AppError('Token henüz aktif değil', 'INVALID_TOKEN', 403);
    }

    return new AppError('Token doğrulama hatası', 'UNAUTHORIZED', 401);
};

/**
 * Handle Multer file upload errors
 */
const handleMulterError = (error) => {
    if (error.code === 'LIMIT_FILE_SIZE') {
        return new AppError(
            'Dosya boyutu çok büyük',
            'UNPROCESSABLE_ENTITY',
            422,
            { maxSize: error.limit }
        );
    }

    if (error.code === 'LIMIT_FILE_COUNT') {
        return new AppError(
            'Çok fazla dosya',
            'UNPROCESSABLE_ENTITY',
            422,
            { maxCount: error.limit }
        );
    }

    if (error.code === 'LIMIT_UNEXPECTED_FILE') {
        return new AppError(
            'Beklenmeyen dosya alanı',
            'UNPROCESSABLE_ENTITY',
            422,
            { fieldName: error.field }
        );
    }

    return new AppError(
        'Dosya yükleme hatası',
        'UPLOAD_FAILED',
        400
    );
};

/**
 * Handle express-validator errors
 */
const handleValidationError = (errors) => {
    const details = errors.map(error => ({
        field: error.path || error.param,
        message: error.msg,
        value: error.value,
        location: error.location
    }));

    return new AppError(
        'Veri doğrulama hatası',
        'VALIDATION_ERROR',
        400,
        { validationErrors: details }
    );
};

/**
 * Convert operational errors to AppError
 */
const handleOperationalError = (error) => {
    // MongoDB errors
    if (error.name?.startsWith('Mongo') || error.name === 'ValidationError' || error.name === 'CastError') {
        return handleMongoError(error);
    }

    // JWT errors
    if (error.name?.includes('JsonWebToken') || error.name?.includes('Token')) {
        return handleJWTError(error);
    }

    // Multer errors
    if (error.name === 'MulterError') {
        return handleMulterError(error);
    }

    // Already an AppError
    if (error instanceof AppError) {
        return error;
    }

    // Default to internal server error
    return new AppError(
        error.message || 'Sunucu hatası',
        'INTERNAL_SERVER_ERROR',
        500
    );
};

/**
 * Main error handling middleware
 */
const errorHandler = (error, req, res, next) => {
    // Add request ID for tracking
    const requestId = req.id || req.headers['x-request-id'] || Date.now().toString();
    error.requestId = requestId;

    // Convert to AppError if needed
    let appError = error instanceof AppError ? error : handleOperationalError(error);

    // Log error
    logError(appError, 'ERROR_HANDLER', {
        requestId,
        method: req.method,
        url: req.originalUrl,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        userId: req.user?.id,
        body: req.method !== 'GET' ? req.body : undefined
    });

    // Create error response
    const isDevelopment = config.server.env === 'development';
    const errorResponse = createErrorResponse(appError, isDevelopment);

    // Security headers for error responses
    res.set({
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'X-XSS-Protection': '1; mode=block'
    });

    // Send error response
    res.status(appError.statusCode).json(errorResponse);
};

/**
 * Handle 404 errors (route not found)
 */
const notFoundHandler = (req, res, next) => {
    const error = new AppError(
        `Route bulunamadı: ${req.method} ${req.originalUrl}`,
        'NOT_FOUND',
        404
    );

    next(error);
};

/**
 * Handle uncaught exceptions
 */
const handleUncaughtException = () => {
    process.on('uncaughtException', (error) => {
        logger.error('Uncaught Exception', {
            error: error.message,
            stack: error.stack,
            pid: process.pid
        });

        // Graceful shutdown
        process.exit(1);
    });
};

/**
 * Handle unhandled promise rejections
 */
const handleUnhandledRejection = () => {
    process.on('unhandledRejection', (reason, promise) => {
        logger.error('Unhandled Promise Rejection', {
            reason: reason?.message || reason,
            stack: reason?.stack,
            promise: promise,
            pid: process.pid
        });

        // Graceful shutdown
        process.exit(1);
    });
};

/**
 * Async error wrapper for route handlers
 */
const asyncHandler = (fn) => {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};

/**
 * Validation error handler for express-validator
 */
const validationErrorHandler = (req, res, next) => {
    const { validationResult } = require('express-validator');
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
        const appError = handleValidationError(errors.array());
        return next(appError);
    }

    next();
};

/**
 * API rate limit error handler
 */
const rateLimitHandler = (req, res, next) => {
    const error = new AppError(
        'Çok fazla istek gönderdiniz. Lütfen bekleyip tekrar deneyin.',
        'TOO_MANY_REQUESTS',
        429,
        {
            retryAfter: req.rateLimit?.resetTime || 60
        }
    );

    next(error);
};

/**
 * Create custom error for specific situations
 */
const createError = (message, type = 'INTERNAL_SERVER_ERROR', statusCode = null, details = null) => {
    return new AppError(message, type, statusCode, details);
};

/**
 * Error reporting for external services (like Sentry)
 */
const reportError = (error, context = {}) => {
    // TODO: Integrate with error reporting service
    // Example: Sentry.captureException(error, { extra: context });
    
    logger.error('Error reported to external service', {
        error: error.message,
        stack: error.stack,
        context
    });
};

/**
 * Health check error handler
 */
const healthCheckError = (service, error) => {
    return {
        service,
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date(),
        details: error.details || null
    };
};

// Initialize global error handlers
const initializeGlobalHandlers = () => {
    handleUncaughtException();
    handleUnhandledRejection();
};

module.exports = {
    // Classes
    AppError,
    
    // Main middleware
    errorHandler,
    notFoundHandler,
    
    // Utility functions
    asyncHandler,
    validationErrorHandler,
    rateLimitHandler,
    createError,
    reportError,
    healthCheckError,
    
    // Error handlers
    handleMongoError,
    handleJWTError,
    handleMulterError,
    handleValidationError,
    handleOperationalError,
    
    // Global handlers
    initializeGlobalHandlers,
    
    // Constants
    ERROR_TYPES
};