const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const { RateLimiterMemory } = require('rate-limiter-flexible');
const config = require('../config/config');

// JWT Token doğrulama middleware
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
        return res.status(401).json({ 
            error: 'UNAUTHORIZED',
            message: 'Access token gerekli' 
        });
    }

    jwt.verify(token, config.jwt.secret, (err, user) => {
        if (err) {
            if (err.name === 'TokenExpiredError') {
                return res.status(401).json({ 
                    error: 'TOKEN_EXPIRED',
                    message: 'Token süresi doldu' 
                });
            }
            if (err.name === 'JsonWebTokenError') {
                return res.status(403).json({ 
                    error: 'INVALID_TOKEN',
                    message: 'Geçersiz token' 
                });
            }
            return res.status(403).json({ 
                error: 'TOKEN_ERROR',
                message: 'Token doğrulama hatası' 
            });
        }

        req.user = user;
        next();
    });
};

// Opsiyonel token doğrulama (token varsa doğrula, yoksa devam et)
const optionalAuth = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return next();
    }

    jwt.verify(token, config.jwt.secret, (err, user) => {
        if (!err) {
            req.user = user;
        }
        next();
    });
};

// Admin yetkisi kontrolü
const requireAdmin = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({ 
            error: 'UNAUTHORIZED',
            message: 'Giriş yapılmalı' 
        });
    }

    if (req.user.role !== 'admin' && req.user.role !== 'owner') {
        return res.status(403).json({ 
            error: 'INSUFFICIENT_PERMISSIONS',
            message: 'Admin yetkisi gerekli' 
        });
    }

    next();
};

// Moderator yetkisi kontrolü
const requireModerator = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({ 
            error: 'UNAUTHORIZED',
            message: 'Giriş yapılmalı' 
        });
    }

    if (!['admin', 'moderator', 'owner'].includes(req.user.role)) {
        return res.status(403).json({ 
            error: 'INSUFFICIENT_PERMISSIONS',
            message: 'Moderator yetkisi gerekli' 
        });
    }

    next();
};

// Email doğrulaması kontrolü
const requireEmailVerification = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({ 
            error: 'UNAUTHORIZED',
            message: 'Giriş yapılmalı' 
        });
    }

    if (!req.user.isVerified) {
        return res.status(403).json({ 
            error: 'EMAIL_NOT_VERIFIED',
            message: 'Email adresinizi doğrulamanız gerekli' 
        });
    }

    next();
};

// Aktif kullanıcı kontrolü
const requireActiveUser = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({ 
            error: 'UNAUTHORIZED',
            message: 'Giriş yapılmalı' 
        });
    }

    if (!req.user.isActive) {
        return res.status(403).json({ 
            error: 'ACCOUNT_DISABLED',
            message: 'Hesabınız devre dışı bırakıldı' 
        });
    }

    next();
};

// Rate limiting middleware'leri
const createRateLimit = (options = {}) => {
    const defaultOptions = {
        windowMs: config.rateLimit.windowMs,
        max: config.rateLimit.max,
        message: {
            error: 'TOO_MANY_REQUESTS',
            message: config.rateLimit.message
        },
        standardHeaders: config.rateLimit.standardHeaders,
        legacyHeaders: config.rateLimit.legacyHeaders,
        skip: (req) => {
            // Admin ve owner'ları rate limit'ten muaf tut
            return req.user && ['admin', 'owner'].includes(req.user.role);
        },
        keyGenerator: (req) => {
            // Authenticated kullanıcılar için user ID'yi kullan
            if (req.user) {
                return `user:${req.user.id}`;
            }
            // Guest kullanıcılar için IP adresini kullan
            return req.ip;
        },
        ...options
    };

    return rateLimit(defaultOptions);
};

// Farklı endpoint'ler için özel rate limit'ler
const authRateLimit = createRateLimit({
    windowMs: 15 * 60 * 1000, // 15 dakika
    max: 5, // 15 dakikada maksimum 5 deneme
    message: {
        error: 'TOO_MANY_AUTH_ATTEMPTS',
        message: 'Çok fazla giriş denemesi. Lütfen 15 dakika sonra tekrar deneyin.'
    }
});

const uploadRateLimit = createRateLimit({
    windowMs: 60 * 1000, // 1 dakika
    max: 10, // Dakikada maksimum 10 dosya
    message: {
        error: 'TOO_MANY_UPLOADS',
        message: 'Çok fazla dosya yükleme isteği. Lütfen bekleyin.'
    }
});

const messageRateLimit = createRateLimit({
    windowMs: 60 * 1000, // 1 dakika
    max: 30, // Dakikada maksimum 30 mesaj
    message: {
        error: 'TOO_MANY_MESSAGES',
        message: 'Çok hızlı mesaj gönderiyorsunuz. Lütfen yavaşlayın.'
    }
});

const searchRateLimit = createRateLimit({
    windowMs: 60 * 1000, // 1 dakika
    max: 20, // Dakikada maksimum 20 arama
    message: {
        error: 'TOO_MANY_SEARCHES',
        message: 'Çok fazla arama isteği. Lütfen bekleyin.'
    }
});

// Gelişmiş rate limiting (memory tabanlı)
const rateLimiter = new RateLimiterMemory({
    keyGenerate: (req) => {
        return req.user ? `user:${req.user.id}` : `ip:${req.ip}`;
    },
    points: 100, // 100 istek
    duration: 3600, // 1 saat içinde
    blockDuration: 600, // 10 dakika blok
});

const advancedRateLimit = async (req, res, next) => {
    try {
        await rateLimiter.consume(req);
        next();
    } catch (rejRes) {
        const remainingPoints = rejRes.remainingPoints || 0;
        const msBeforeNext = rejRes.msBeforeNext || 0;
        
        res.set({
            'X-RateLimit-Limit': 100,
            'X-RateLimit-Remaining': remainingPoints,
            'X-RateLimit-Reset': new Date(Date.now() + msBeforeNext)
        });
        
        return res.status(429).json({
            error: 'RATE_LIMIT_EXCEEDED',
            message: 'Rate limit aşıldı. Lütfen daha sonra tekrar deneyin.',
            retryAfter: Math.round(msBeforeNext / 1000)
        });
    }
};

// Socket.IO için auth middleware
const socketAuth = (socket, next) => {
    const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];
    
    if (!token) {
        return next(new Error('Authentication error: Token required'));
    }
    
    jwt.verify(token, config.jwt.secret, (err, user) => {
        if (err) {
            return next(new Error('Authentication error: Invalid token'));
        }
        
        socket.userId = user.id;
        socket.userRole = user.role;
        socket.user = user;
        next();
    });
};

// Chat katılımcısı kontrolü
const requireChatParticipant = async (req, res, next) => {
    try {
        const chatId = req.params.chatId;
        const userId = req.user.id;
        
        // Bu middleware'ı kullanırken Chat modeli import edilmeli
        // Dinamik import kullanıyoruz
        const Chat = require('../models/Chat');
        
        const chat = await Chat.findById(chatId);
        if (!chat) {
            return res.status(404).json({
                error: 'CHAT_NOT_FOUND',
                message: 'Sohbet bulunamadı'
            });
        }
        
        if (!chat.isParticipant(userId)) {
            return res.status(403).json({
                error: 'NOT_PARTICIPANT',
                message: 'Bu sohbete katılımcı değilsiniz'
            });
        }
        
        req.chat = chat;
        req.participant = chat.getParticipant(userId);
        next();
    } catch (error) {
        res.status(500).json({
            error: 'SERVER_ERROR',
            message: 'Sunucu hatası'
        });
    }
};

// Chat admin kontrolü
const requireChatAdmin = async (req, res, next) => {
    if (!req.chat || !req.participant) {
        return res.status(400).json({
            error: 'MISSING_CHAT_CONTEXT',
            message: 'Chat context eksik'
        });
    }
    
    if (!['admin', 'owner'].includes(req.participant.role)) {
        return res.status(403).json({
            error: 'INSUFFICIENT_CHAT_PERMISSIONS',
            message: 'Bu işlem için admin yetkisi gerekli'
        });
    }
    
    next();
};

// Mesaj sahibi kontrolü
const requireMessageOwner = async (req, res, next) => {
    try {
        const messageId = req.params.messageId;
        const userId = req.user.id;
        
        const Message = require('../models/Message');
        
        const message = await Message.findById(messageId);
        if (!message) {
            return res.status(404).json({
                error: 'MESSAGE_NOT_FOUND',
                message: 'Mesaj bulunamadı'
            });
        }
        
        if (message.sender.toString() !== userId) {
            return res.status(403).json({
                error: 'NOT_MESSAGE_OWNER',
                message: 'Bu mesajın sahibi değilsiniz'
            });
        }
        
        req.message = message;
        next();
    } catch (error) {
        res.status(500).json({
            error: 'SERVER_ERROR',
            message: 'Sunucu hatası'
        });
    }
};

// Input sanitization middleware
const sanitizeInput = (req, res, next) => {
    const sanitizeString = (str) => {
        if (typeof str !== 'string') return str;
        
        // HTML encode to prevent XSS
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#x27;')
            .replace(/\//g, '&#x2F;');
    };
    
    const sanitizeObject = (obj) => {
        if (typeof obj !== 'object' || obj === null) return obj;
        
        for (const key in obj) {
            if (typeof obj[key] === 'string') {
                obj[key] = sanitizeString(obj[key]);
            } else if (typeof obj[key] === 'object') {
                obj[key] = sanitizeObject(obj[key]);
            }
        }
        
        return obj;
    };
    
    req.body = sanitizeObject(req.body);
    req.query = sanitizeObject(req.query);
    req.params = sanitizeObject(req.params);
    
    next();
};

module.exports = {
    authenticateToken,
    optionalAuth,
    requireAdmin,
    requireModerator,
    requireEmailVerification,
    requireActiveUser,
    createRateLimit,
    authRateLimit,
    uploadRateLimit,
    messageRateLimit,
    searchRateLimit,
    advancedRateLimit,
    socketAuth,
    requireChatParticipant,
    requireChatAdmin,
    requireMessageOwner,
    sanitizeInput
};