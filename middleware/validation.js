const { body, param, query, validationResult } = require('express-validator');

// Validation sonuçlarını kontrol eden middleware
const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    
    if (!errors.isEmpty()) {
        const errorMessages = errors.array().map(error => ({
            field: error.path,
            message: error.msg,
            value: error.value
        }));
        
        return res.status(400).json({
            error: 'VALIDATION_ERROR',
            message: 'Girilen veriler geçersiz',
            details: errorMessages
        });
    }
    
    next();
};

// Kullanıcı kayıt validasyonu
const validateUserRegistration = [
    body('username')
        .isLength({ min: 3, max: 30 })
        .withMessage('Kullanıcı adı 3-30 karakter arasında olmalıdır')
        .matches(/^[a-zA-Z0-9_]+$/)
        .withMessage('Kullanıcı adı sadece harf, rakam ve alt çizgi içerebilir')
        .trim(),
    
    body('email')
        .isEmail()
        .withMessage('Geçerli bir email adresi giriniz')
        .normalizeEmail()
        .trim(),
    
    body('password')
        .isLength({ min: 6, max: 100 })
        .withMessage('Şifre en az 6 karakter olmalıdır')
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
        .withMessage('Şifre en az bir küçük harf, bir büyük harf ve bir rakam içermelidir'),
    
    body('firstName')
        .optional()
        .isLength({ max: 50 })
        .withMessage('Ad en fazla 50 karakter olabilir')
        .trim(),
    
    body('lastName')
        .optional()
        .isLength({ max: 50 })
        .withMessage('Soyad en fazla 50 karakter olabilir')
        .trim(),
    
    body('phoneNumber')
        .optional()
        .matches(/^\+?[1-9]\d{1,14}$/)
        .withMessage('Geçerli bir telefon numarası giriniz'),
    
    handleValidationErrors
];

// Kullanıcı giriş validasyonu
const validateUserLogin = [
    body('username')
        .notEmpty()
        .withMessage('Kullanıcı adı veya email gereklidir')
        .trim(),
    
    body('password')
        .notEmpty()
        .withMessage('Şifre gereklidir'),
    
    handleValidationErrors
];

// Şifre değiştirme validasyonu
const validatePasswordChange = [
    body('currentPassword')
        .notEmpty()
        .withMessage('Mevcut şifre gereklidir'),
    
    body('newPassword')
        .isLength({ min: 6, max: 100 })
        .withMessage('Yeni şifre en az 6 karakter olmalıdır')
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
        .withMessage('Yeni şifre en az bir küçük harf, bir büyük harf ve bir rakam içermelidir'),
    
    body('confirmPassword')
        .custom((value, { req }) => {
            if (value !== req.body.newPassword) {
                throw new Error('Şifre onayı eşleşmiyor');
            }
            return true;
        }),
    
    handleValidationErrors
];

// Profil güncelleme validasyonu
const validateProfileUpdate = [
    body('firstName')
        .optional()
        .isLength({ max: 50 })
        .withMessage('Ad en fazla 50 karakter olabilir')
        .trim(),
    
    body('lastName')
        .optional()
        .isLength({ max: 50 })
        .withMessage('Soyad en fazla 50 karakter olabilir')
        .trim(),
    
    body('bio')
        .optional()
        .isLength({ max: 200 })
        .withMessage('Bio en fazla 200 karakter olabilir')
        .trim(),
    
    body('phoneNumber')
        .optional()
        .matches(/^\+?[1-9]\d{1,14}$/)
        .withMessage('Geçerli bir telefon numarası giriniz'),
    
    body('status')
        .optional()
        .isIn(['online', 'away', 'busy', 'offline'])
        .withMessage('Geçersiz durum değeri'),
    
    handleValidationErrors
];

// Mesaj gönderme validasyonu
const validateSendMessage = [
    body('chatId')
        .isMongoId()
        .withMessage('Geçersiz sohbet ID\'si'),
    
    body('content.text')
        .optional()
        .isLength({ max: 2000 })
        .withMessage('Mesaj en fazla 2000 karakter olabilir')
        .trim(),
    
    body('content.type')
        .isIn(['text', 'image', 'video', 'audio', 'file', 'location', 'contact', 'sticker', 'gif'])
        .withMessage('Geçersiz mesaj türü'),
    
    body('replyTo')
        .optional()
        .isMongoId()
        .withMessage('Geçersiz yanıtlanan mesaj ID\'si'),
    
    // Text mesajları için content.text zorunlu
    body('content.text')
        .if(body('content.type').equals('text'))
        .notEmpty()
        .withMessage('Metin mesajları için içerik gereklidir'),
    
    handleValidationErrors
];

// Mesaj düzenleme validasyonu
const validateEditMessage = [
    param('messageId')
        .isMongoId()
        .withMessage('Geçersiz mesaj ID\'si'),
    
    body('content')
        .notEmpty()
        .withMessage('Mesaj içeriği gereklidir')
        .isLength({ max: 2000 })
        .withMessage('Mesaj en fazla 2000 karakter olabilir')
        .trim(),
    
    handleValidationErrors
];

// Grup oluşturma validasyonu
const validateCreateGroup = [
    body('name')
        .notEmpty()
        .withMessage('Grup adı gereklidir')
        .isLength({ min: 1, max: 100 })
        .withMessage('Grup adı 1-100 karakter arasında olmalıdır')
        .trim(),
    
    body('description')
        .optional()
        .isLength({ max: 500 })
        .withMessage('Grup açıklaması en fazla 500 karakter olabilir')
        .trim(),
    
    body('participants')
        .isArray({ min: 1 })
        .withMessage('En az bir katılımcı gereklidir'),
    
    body('participants.*')
        .isMongoId()
        .withMessage('Geçersiz katılımcı ID\'si'),
    
    body('settings.maxMembers')
        .optional()
        .isInt({ min: 2, max: 1000 })
        .withMessage('Maksimum üye sayısı 2-1000 arasında olmalıdır'),
    
    handleValidationErrors
];

// Grup güncelleme validasyonu
const validateUpdateGroup = [
    param('chatId')
        .isMongoId()
        .withMessage('Geçersiz sohbet ID\'si'),
    
    body('name')
        .optional()
        .isLength({ min: 1, max: 100 })
        .withMessage('Grup adı 1-100 karakter arasında olmalıdır')
        .trim(),
    
    body('description')
        .optional()
        .isLength({ max: 500 })
        .withMessage('Grup açıklaması en fazla 500 karakter olabilir')
        .trim(),
    
    body('settings.maxMembers')
        .optional()
        .isInt({ min: 2, max: 1000 })
        .withMessage('Maksimum üye sayısı 2-1000 arasında olmalıdır'),
    
    handleValidationErrors
];

// Katılımcı ekleme validasyonu
const validateAddParticipant = [
    param('chatId')
        .isMongoId()
        .withMessage('Geçersiz sohbet ID\'si'),
    
    body('userId')
        .isMongoId()
        .withMessage('Geçersiz kullanıcı ID\'si'),
    
    body('role')
        .optional()
        .isIn(['member', 'admin', 'owner'])
        .withMessage('Geçersiz rol değeri'),
    
    handleValidationErrors
];

// Katılımcı rolü güncelleme validasyonu
const validateUpdateParticipantRole = [
    param('chatId')
        .isMongoId()
        .withMessage('Geçersiz sohbet ID\'si'),
    
    param('userId')
        .isMongoId()
        .withMessage('Geçersiz kullanıcı ID\'si'),
    
    body('role')
        .isIn(['member', 'admin', 'owner'])
        .withMessage('Geçersiz rol değeri'),
    
    handleValidationErrors
];

// Arama validasyonu
const validateSearch = [
    query('q')
        .notEmpty()
        .withMessage('Arama terimi gereklidir')
        .isLength({ min: 2, max: 100 })
        .withMessage('Arama terimi 2-100 karakter arasında olmalıdır')
        .trim(),
    
    query('limit')
        .optional()
        .isInt({ min: 1, max: 50 })
        .withMessage('Limit 1-50 arasında olmalıdır'),
    
    query('offset')
        .optional()
        .isInt({ min: 0 })
        .withMessage('Offset 0 veya daha büyük olmalıdır'),
    
    handleValidationErrors
];

// Dosya yükleme validasyonu
const validateFileUpload = [
    body('type')
        .optional()
        .isIn(['image', 'video', 'audio', 'document'])
        .withMessage('Geçersiz dosya türü'),
    
    // Multer error handling middleware'i
    (error, req, res, next) => {
        if (error instanceof multer.MulterError) {
            if (error.code === 'LIMIT_FILE_SIZE') {
                return res.status(400).json({
                    error: 'FILE_TOO_LARGE',
                    message: 'Dosya boyutu çok büyük'
                });
            }
            if (error.code === 'LIMIT_FILE_COUNT') {
                return res.status(400).json({
                    error: 'TOO_MANY_FILES',
                    message: 'Çok fazla dosya'
                });
            }
        }
        
        if (error.message === 'Bu dosya türü desteklenmiyor!') {
            return res.status(400).json({
                error: 'UNSUPPORTED_FILE_TYPE',
                message: error.message
            });
        }
        
        next(error);
    },
    
    handleValidationErrors
];

// Reaktion ekleme validasyonu
const validateAddReaction = [
    param('messageId')
        .isMongoId()
        .withMessage('Geçersiz mesaj ID\'si'),
    
    body('emoji')
        .notEmpty()
        .withMessage('Emoji gereklidir')
        .isLength({ min: 1, max: 10 })
        .withMessage('Emoji 1-10 karakter arasında olmalıdır'),
    
    handleValidationErrors
];

// Sayfalama validasyonu
const validatePagination = [
    query('page')
        .optional()
        .isInt({ min: 1 })
        .withMessage('Sayfa numarası 1 veya daha büyük olmalıdır'),
    
    query('limit')
        .optional()
        .isInt({ min: 1, max: 100 })
        .withMessage('Limit 1-100 arasında olmalıdır'),
    
    handleValidationErrors
];

// MongoDB ObjectId validasyonu
const validateObjectId = (paramName) => [
    param(paramName)
        .isMongoId()
        .withMessage(`Geçersiz ${paramName}`),
    
    handleValidationErrors
];

// Email validasyonu
const validateEmail = [
    body('email')
        .isEmail()
        .withMessage('Geçerli bir email adresi giriniz')
        .normalizeEmail(),
    
    handleValidationErrors
];

// Şifre sıfırlama validasyonu
const validatePasswordReset = [
    body('token')
        .notEmpty()
        .withMessage('Sıfırlama token\'ı gereklidir'),
    
    body('newPassword')
        .isLength({ min: 6, max: 100 })
        .withMessage('Yeni şifre en az 6 karakter olmalıdır')
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
        .withMessage('Yeni şifre en az bir küçük harf, bir büyük harf ve bir rakam içermelidir'),
    
    handleValidationErrors
];

// Konum validasyonu
const validateLocation = [
    body('latitude')
        .isFloat({ min: -90, max: 90 })
        .withMessage('Geçersiz enlem değeri'),
    
    body('longitude')
        .isFloat({ min: -180, max: 180 })
        .withMessage('Geçersiz boylam değeri'),
    
    body('address')
        .optional()
        .isLength({ max: 200 })
        .withMessage('Adres en fazla 200 karakter olabilir')
        .trim(),
    
    handleValidationErrors
];

// İletişim bilgisi validasyonu
const validateContact = [
    body('name')
        .notEmpty()
        .withMessage('İletişim adı gereklidir')
        .isLength({ max: 100 })
        .withMessage('İletişim adı en fazla 100 karakter olabilir')
        .trim(),
    
    body('phone')
        .optional()
        .matches(/^\+?[1-9]\d{1,14}$/)
        .withMessage('Geçerli bir telefon numarası giriniz'),
    
    body('email')
        .optional()
        .isEmail()
        .withMessage('Geçerli bir email adresi giriniz'),
    
    handleValidationErrors
];

module.exports = {
    handleValidationErrors,
    validateUserRegistration,
    validateUserLogin,
    validatePasswordChange,
    validateProfileUpdate,
    validateSendMessage,
    validateEditMessage,
    validateCreateGroup,
    validateUpdateGroup,
    validateAddParticipant,
    validateUpdateParticipantRole,
    validateSearch,
    validateFileUpload,
    validateAddReaction,
    validatePagination,
    validateObjectId,
    validateEmail,
    validatePasswordReset,
    validateLocation,
    validateContact
};