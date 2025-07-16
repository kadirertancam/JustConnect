const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const router = express.Router();

// Middleware imports
const { 
    authenticateToken, 
    authRateLimit,
    sanitizeInput 
} = require('../middleware/auth');

const {
    validateUserRegistration,
    validateUserLogin,
    validatePasswordChange,
    validateEmail,
    validatePasswordReset
} = require('../middleware/validation');

// Config import
const config = require('../config/config');

// Model imports (Memory'de tuttuğumuz için basit implementasyon)
// Production'da MongoDB modelleri kullanılacak
let users = new Map();
let refreshTokens = new Set();

// Sample users for development
const sampleUsers = [
    {
        id: "user1",
        username: "kadir",
        email: "kadir@justconnect.com",
        password: bcrypt.hashSync("123456", 10),
        firstName: "Kadir",
        lastName: "Ertan",
        avatar: "KE",
        status: "online",
        isActive: true,
        isVerified: true,
        role: "admin",
        createdAt: new Date(),
        updatedAt: new Date()
    },
    {
        id: "user2",
        username: "ahmet",
        email: "ahmet@justconnect.com",
        password: bcrypt.hashSync("123456", 10),
        firstName: "Ahmet",
        lastName: "Yılmaz",
        avatar: "AY",
        status: "online",
        isActive: true,
        isVerified: true,
        role: "user",
        createdAt: new Date(),
        updatedAt: new Date()
    }
];

// Initialize sample users
sampleUsers.forEach(user => users.set(user.id, user));

// Helper functions
const generateAccessToken = (user) => {
    return jwt.sign(
        { 
            id: user.id, 
            username: user.username, 
            email: user.email,
            role: user.role 
        },
        config.jwt.secret,
        { 
            expiresIn: config.jwt.expiresIn,
            issuer: config.jwt.issuer,
            audience: config.jwt.audience
        }
    );
};

const generateRefreshToken = () => {
    return crypto.randomBytes(64).toString('hex');
};

const createUserResponse = (user, includeTokens = false) => {
    const userResponse = {
        id: user.id,
        username: user.username,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        avatar: user.avatar,
        avatarUrl: user.avatarUrl,
        status: user.status,
        bio: user.bio,
        phoneNumber: user.phoneNumber,
        isVerified: user.isVerified,
        role: user.role,
        preferences: user.preferences,
        createdAt: user.createdAt
    };

    if (includeTokens) {
        const accessToken = generateAccessToken(user);
        const refreshToken = generateRefreshToken();
        
        refreshTokens.add(refreshToken);
        
        userResponse.tokens = {
            accessToken,
            refreshToken,
            expiresIn: config.jwt.expiresIn
        };
    }

    return userResponse;
};

// Routes

/**
 * @route POST /api/auth/register
 * @desc Kullanıcı kaydı
 * @access Public
 */
router.post('/register', 
    authRateLimit,
    sanitizeInput,
    validateUserRegistration,
    async (req, res) => {
        try {
            const { username, email, password, firstName, lastName, phoneNumber } = req.body;

            // Check if user already exists
            const existingUser = Array.from(users.values()).find(u => 
                u.username === username || u.email === email
            );

            if (existingUser) {
                return res.status(400).json({
                    error: 'USER_ALREADY_EXISTS',
                    message: existingUser.username === username ? 
                        'Bu kullanıcı adı zaten kullanılıyor' : 
                        'Bu email adresi zaten kullanılıyor'
                });
            }

            // Hash password
            const hashedPassword = await bcrypt.hash(password, config.security.bcryptRounds);

            // Create new user
            const newUser = {
                id: 'user' + (users.size + 1),
                username,
                email,
                password: hashedPassword,
                firstName: firstName || '',
                lastName: lastName || '',
                phoneNumber: phoneNumber || '',
                avatar: username.substring(0, 2).toUpperCase(),
                avatarUrl: null,
                status: 'online',
                bio: '',
                isActive: true,
                isVerified: false,
                role: 'user',
                preferences: {
                    language: 'tr',
                    theme: 'light',
                    notifications: {
                        email: true,
                        push: true,
                        sound: true
                    },
                    privacy: {
                        showLastSeen: true,
                        showOnlineStatus: true,
                        allowDirectMessages: true
                    }
                },
                contacts: [],
                blockedUsers: [],
                createdAt: new Date(),
                updatedAt: new Date()
            };

            users.set(newUser.id, newUser);

            // Create response with tokens
            const userResponse = createUserResponse(newUser, true);

            res.status(201).json({
                success: true,
                message: 'Kullanıcı başarıyla oluşturuldu',
                user: userResponse
            });

        } catch (error) {
            console.error('Registration error:', error);
            res.status(500).json({
                error: 'REGISTRATION_FAILED',
                message: 'Kayıt işlemi başarısız oldu'
            });
        }
    }
);

/**
 * @route POST /api/auth/login
 * @desc Kullanıcı girişi
 * @access Public
 */
router.post('/login',
    authRateLimit,
    sanitizeInput,
    validateUserLogin,
    async (req, res) => {
        try {
            const { username, password, rememberMe } = req.body;

            // Find user by username or email
            const user = Array.from(users.values()).find(u => 
                u.username === username || u.email === username
            );

            if (!user) {
                return res.status(401).json({
                    error: 'INVALID_CREDENTIALS',
                    message: 'Geçersiz kullanıcı adı veya şifre'
                });
            }

            // Check if account is active
            if (!user.isActive) {
                return res.status(403).json({
                    error: 'ACCOUNT_DISABLED',
                    message: 'Hesabınız devre dışı bırakıldı'
                });
            }

            // Verify password
            const isPasswordValid = await bcrypt.compare(password, user.password);
            if (!isPasswordValid) {
                return res.status(401).json({
                    error: 'INVALID_CREDENTIALS',
                    message: 'Geçersiz kullanıcı adı veya şifre'
                });
            }

            // Update user status and last seen
            user.status = 'online';
            user.lastSeen = new Date();
            user.updatedAt = new Date();
            users.set(user.id, user);

            // Create response with tokens
            const userResponse = createUserResponse(user, true);

            res.json({
                success: true,
                message: 'Giriş başarılı',
                user: userResponse
            });

        } catch (error) {
            console.error('Login error:', error);
            res.status(500).json({
                error: 'LOGIN_FAILED',
                message: 'Giriş işlemi başarısız oldu'
            });
        }
    }
);

/**
 * @route POST /api/auth/logout
 * @desc Kullanıcı çıkışı
 * @access Private
 */
router.post('/logout',
    authenticateToken,
    async (req, res) => {
        try {
            const { refreshToken } = req.body;
            
            // Remove refresh token
            if (refreshToken) {
                refreshTokens.delete(refreshToken);
            }

            // Update user status
            const user = users.get(req.user.id);
            if (user) {
                user.status = 'offline';
                user.lastSeen = new Date();
                user.updatedAt = new Date();
                users.set(user.id, user);
            }

            res.json({
                success: true,
                message: 'Çıkış başarılı'
            });

        } catch (error) {
            console.error('Logout error:', error);
            res.status(500).json({
                error: 'LOGOUT_FAILED',
                message: 'Çıkış işlemi başarısız oldu'
            });
        }
    }
);

/**
 * @route POST /api/auth/refresh
 * @desc Token yenileme
 * @access Public
 */
router.post('/refresh',
    authRateLimit,
    async (req, res) => {
        try {
            const { refreshToken } = req.body;

            if (!refreshToken) {
                return res.status(401).json({
                    error: 'REFRESH_TOKEN_REQUIRED',
                    message: 'Refresh token gerekli'
                });
            }

            if (!refreshTokens.has(refreshToken)) {
                return res.status(403).json({
                    error: 'INVALID_REFRESH_TOKEN',
                    message: 'Geçersiz refresh token'
                });
            }

            // Bu basit implementasyonda user ID'yi refresh token'dan alamıyoruz
            // Production'da refresh token database'de saklanmalı
            
            res.status(501).json({
                error: 'NOT_IMPLEMENTED',
                message: 'Token yenileme özelliği henüz geliştirilmedi'
            });

        } catch (error) {
            console.error('Refresh token error:', error);
            res.status(500).json({
                error: 'REFRESH_FAILED',
                message: 'Token yenileme başarısız oldu'
            });
        }
    }
);

/**
 * @route GET /api/auth/me
 * @desc Mevcut kullanıcı bilgilerini getir
 * @access Private
 */
router.get('/me',
    authenticateToken,
    async (req, res) => {
        try {
            const user = users.get(req.user.id);

            if (!user) {
                return res.status(404).json({
                    error: 'USER_NOT_FOUND',
                    message: 'Kullanıcı bulunamadı'
                });
            }

            const userResponse = createUserResponse(user);

            res.json({
                success: true,
                user: userResponse
            });

        } catch (error) {
            console.error('Get current user error:', error);
            res.status(500).json({
                error: 'GET_USER_FAILED',
                message: 'Kullanıcı bilgileri alınamadı'
            });
        }
    }
);

/**
 * @route PUT /api/auth/password
 * @desc Şifre değiştirme
 * @access Private
 */
router.put('/password',
    authenticateToken,
    sanitizeInput,
    validatePasswordChange,
    async (req, res) => {
        try {
            const { currentPassword, newPassword } = req.body;
            const user = users.get(req.user.id);

            if (!user) {
                return res.status(404).json({
                    error: 'USER_NOT_FOUND',
                    message: 'Kullanıcı bulunamadı'
                });
            }

            // Verify current password
            const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
            if (!isCurrentPasswordValid) {
                return res.status(400).json({
                    error: 'INVALID_CURRENT_PASSWORD',
                    message: 'Mevcut şifre yanlış'
                });
            }

            // Hash new password
            const hashedNewPassword = await bcrypt.hash(newPassword, config.security.bcryptRounds);
            
            // Update user
            user.password = hashedNewPassword;
            user.updatedAt = new Date();
            users.set(user.id, user);

            res.json({
                success: true,
                message: 'Şifre başarıyla değiştirildi'
            });

        } catch (error) {
            console.error('Password change error:', error);
            res.status(500).json({
                error: 'PASSWORD_CHANGE_FAILED',
                message: 'Şifre değiştirme başarısız oldu'
            });
        }
    }
);

/**
 * @route POST /api/auth/forgot-password
 * @desc Şifre sıfırlama isteği
 * @access Public
 */
router.post('/forgot-password',
    authRateLimit,
    sanitizeInput,
    validateEmail,
    async (req, res) => {
        try {
            const { email } = req.body;

            const user = Array.from(users.values()).find(u => u.email === email);

            // Güvenlik için kullanıcı bulunamasa bile başarılı mesaj göster
            if (!user) {
                return res.json({
                    success: true,
                    message: 'Eğer bu email adresi kayıtlıysa, şifre sıfırlama bağlantısı gönderildi'
                });
            }

            // Generate reset token
            const resetToken = crypto.randomBytes(32).toString('hex');
            const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 hour

            // Save reset token (in production, save to database)
            user.passwordResetToken = resetToken;
            user.passwordResetExpires = resetTokenExpiry;
            user.updatedAt = new Date();
            users.set(user.id, user);

            // TODO: Send email with reset link
            console.log(`Password reset token for ${email}: ${resetToken}`);

            res.json({
                success: true,
                message: 'Şifre sıfırlama bağlantısı email adresinize gönderildi'
            });

        } catch (error) {
            console.error('Forgot password error:', error);
            res.status(500).json({
                error: 'FORGOT_PASSWORD_FAILED',
                message: 'Şifre sıfırlama isteği başarısız oldu'
            });
        }
    }
);

/**
 * @route POST /api/auth/reset-password
 * @desc Şifre sıfırlama
 * @access Public
 */
router.post('/reset-password',
    authRateLimit,
    sanitizeInput,
    validatePasswordReset,
    async (req, res) => {
        try {
            const { token, newPassword } = req.body;

            // Find user by reset token
            const user = Array.from(users.values()).find(u => 
                u.passwordResetToken === token && 
                u.passwordResetExpires > new Date()
            );

            if (!user) {
                return res.status(400).json({
                    error: 'INVALID_RESET_TOKEN',
                    message: 'Geçersiz veya süresi dolmuş sıfırlama token\'ı'
                });
            }

            // Hash new password
            const hashedPassword = await bcrypt.hash(newPassword, config.security.bcryptRounds);

            // Update user
            user.password = hashedPassword;
            user.passwordResetToken = undefined;
            user.passwordResetExpires = undefined;
            user.updatedAt = new Date();
            users.set(user.id, user);

            res.json({
                success: true,
                message: 'Şifre başarıyla sıfırlandı'
            });

        } catch (error) {
            console.error('Reset password error:', error);
            res.status(500).json({
                error: 'RESET_PASSWORD_FAILED',
                message: 'Şifre sıfırlama başarısız oldu'
            });
        }
    }
);

/**
 * @route POST /api/auth/verify-email
 * @desc Email doğrulama
 * @access Public
 */
router.post('/verify-email',
    authRateLimit,
    async (req, res) => {
        try {
            const { token } = req.body;

            if (!token) {
                return res.status(400).json({
                    error: 'TOKEN_REQUIRED',
                    message: 'Doğrulama token\'ı gerekli'
                });
            }

            // Find user by verification token
            const user = Array.from(users.values()).find(u => 
                u.emailVerificationToken === token &&
                u.emailVerificationExpires > new Date()
            );

            if (!user) {
                return res.status(400).json({
                    error: 'INVALID_VERIFICATION_TOKEN',
                    message: 'Geçersiz veya süresi dolmuş doğrulama token\'ı'
                });
            }

            // Verify email
            user.isVerified = true;
            user.emailVerificationToken = undefined;
            user.emailVerificationExpires = undefined;
            user.updatedAt = new Date();
            users.set(user.id, user);

            res.json({
                success: true,
                message: 'Email adresi başarıyla doğrulandı'
            });

        } catch (error) {
            console.error('Email verification error:', error);
            res.status(500).json({
                error: 'EMAIL_VERIFICATION_FAILED',
                message: 'Email doğrulama başarısız oldu'
            });
        }
    }
);

/**
 * @route GET /api/auth/status
 * @desc Auth durumu kontrolü
 * @access Public
 */
router.get('/status', (req, res) => {
    res.json({
        success: true,
        message: 'Auth service aktif',
        features: {
            registration: config.features.enableRegistration,
            emailVerification: true,
            passwordReset: true,
            twoFactor: false
        },
        timestamp: new Date().toISOString()
    });
});

module.exports = router;