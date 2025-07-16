module.exports = {
  // Sunucu Konfigürasyonu
  server: {
    port: process.env.PORT || 3000,
    host: process.env.HOST || 'localhost',
    env: process.env.NODE_ENV || 'development'
  },

  // Veritabanı Konfigürasyonu
  database: {
    mongodb: {
      uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/justconnect_v2',
      options: {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
      }
    },
    redis: {
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT || 6379,
      password: process.env.REDIS_PASSWORD || '',
      ttl: 3600 // 1 hour
    }
  },

  // JWT Konfigürasyonu
  jwt: {
    secret: process.env.JWT_SECRET || 'justconnect_default_secret',
    expiresIn: process.env.JWT_EXPIRES_IN || '24h',
    issuer: 'JustConnect V2',
    audience: 'justconnect-users'
  },

  // Dosya Yükleme Konfigürasyonu
  upload: {
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE) || 104857600, // 100MB
    allowedTypes: (process.env.ALLOWED_FILE_TYPES || 'jpeg,jpg,png,gif,pdf,doc,docx,txt,zip,rar').split(','),
    uploadPath: 'uploads/',
    tempPath: 'temp/'
  },

  // CORS Konfigürasyonu
  cors: {
    origin: process.env.CORS_ORIGIN || ['http://localhost:3000', 'http://localhost:3001'],
    methods: (process.env.CORS_METHODS || 'GET,POST,PUT,DELETE,OPTIONS').split(','),
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    credentials: true
  },

  // Rate Limiting Konfigürasyonu
  rateLimit: {
    windowMs: (parseInt(process.env.RATE_LIMIT_WINDOW) || 15) * 60 * 1000, // 15 dakika
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
    message: 'Çok fazla istek gönderildi, lütfen daha sonra tekrar deneyin.',
    standardHeaders: true,
    legacyHeaders: false
  },

  // Email Konfigürasyonu
  email: {
    smtp: {
      host: process.env.EMAIL_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.EMAIL_PORT) || 587,
      secure: false,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    },
    from: process.env.EMAIL_FROM || 'noreply@justconnect.com',
    templates: {
      welcome: 'welcome',
      resetPassword: 'reset-password',
      notification: 'notification'
    }
  },

  // Güvenlik Konfigürasyonu
  security: {
    bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS) || 12,
    sessionSecret: process.env.SESSION_SECRET || 'justconnect_session_secret',
    helmet: {
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
          scriptSrc: ["'self'", "https://unpkg.com", "https://cdnjs.cloudflare.com"],
          imgSrc: ["'self'", "data:", "https:"],
          connectSrc: ["'self'", "ws:", "wss:"],
          fontSrc: ["'self'", "https://cdnjs.cloudflare.com"]
        }
      },
      crossOriginEmbedderPolicy: false
    }
  },

  // Logging Konfigürasyonu
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    file: process.env.LOG_FILE || 'logs/app.log',
    maxSize: '10MB',
    maxFiles: 5,
    datePattern: 'YYYY-MM-DD',
    format: 'combined'
  },

  // Socket.IO Konfigürasyonu
  socketIO: {
    cors: {
      origin: process.env.CORS_ORIGIN || ['http://localhost:3000'],
      methods: ["GET", "POST"],
      credentials: true
    },
    transports: ['websocket', 'polling'],
    pingTimeout: 60000,
    pingInterval: 25000
  },

  // Uygulama Özellikleri
  features: {
    enableRegistration: process.env.ENABLE_REGISTRATION !== 'false',
    enableFileUpload: process.env.ENABLE_FILE_UPLOAD !== 'false',
    enableGroupChats: process.env.ENABLE_GROUP_CHATS !== 'false',
    enableVoiceCall: process.env.ENABLE_VOICE_CALL === 'true',
    enableVideoCall: process.env.ENABLE_VIDEO_CALL === 'true',
    maxGroupMembers: parseInt(process.env.MAX_GROUP_MEMBERS) || 100,
    maxMessageLength: parseInt(process.env.MAX_MESSAGE_LENGTH) || 2000
  },

  // Cache Konfigürasyonu
  cache: {
    ttl: 3600, // 1 hour
    checkperiod: 600, // 10 minutes
    useClones: false,
    errorOnMissing: false
  },

  // API Konfigürasyonu
  api: {
    prefix: '/api',
    version: 'v1',
    documentation: {
      enabled: process.env.NODE_ENV === 'development',
      path: '/api-docs'
    }
  }
};