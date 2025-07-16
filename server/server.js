const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
require('dotenv').config();

// Import utilities and middleware
const config = require('./config/config');
const { connectDB } = require('./database/connection');
const { setupSocketHandlers } = require('./socket/handlers');
const { 
    errorHandler, 
    notFoundHandler, 
    initializeGlobalHandlers 
} = require('./middleware/errorHandler');
const { httpLogger, lifecycleLogger } = require('./utils/logger');
const { emailService } = require('./utils/email');

// Import routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const chatRoutes = require('./routes/chats');
const uploadRoutes = require('./routes/upload');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, config.socketIO);

// Initialize global error handlers
initializeGlobalHandlers();

// Trust proxy (for deployment behind reverse proxy)
app.set('trust proxy', 1);

// Security middleware
app.use(helmet(config.security.helmet));
app.use(compression());
app.use(cors(config.cors));

// Body parsing middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// HTTP request logging
app.use(httpLogger);

// Static file serving
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.static(path.join(__dirname, 'frontend')));

// Health check endpoint
app.get('/health', async (req, res) => {
    try {
        const { healthCheck: dbHealth } = require('./database/connection');
        const dbStatus = await dbHealth();
        
        res.json({
            status: 'OK',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            memory: process.memoryUsage(),
            environment: process.env.NODE_ENV,
            database: dbStatus,
            services: {
                api: 'healthy',
                socket: 'healthy',
                upload: 'healthy'
            }
        });
    } catch (error) {
        res.status(503).json({
            status: 'ERROR',
            timestamp: new Date().toISOString(),
            error: error.message
        });
    }
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/chats', chatRoutes);
app.use('/api/upload', uploadRoutes);

// API status endpoint
app.get('/api/status', (req, res) => {
    res.json({
        success: true,
        message: 'JustConnect V2 API is running',
        version: '2.0.0',
        timestamp: new Date().toISOString(),
        features: {
            authentication: true,
            realTimeMessaging: true,
            fileUpload: true,
            userManagement: true,
            chatRooms: true
        }
    });
});

// Serve main application
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'frontend/index.html'));
});

// 404 handler
app.use(notFoundHandler);

// Global error handler
app.use(errorHandler);

// Setup Socket.IO handlers
const socketHandlers = setupSocketHandlers(io);

// Graceful shutdown handler
const gracefulShutdown = async (signal) => {
    lifecycleLogger.shutdown(signal);
    
    console.log(`\n🛑 ${signal} signal received. Starting graceful shutdown...`);
    
    // Stop accepting new connections
    server.close(() => {
        console.log('✅ HTTP server closed');
    });
    
    // Close Socket.IO connections
    io.close(() => {
        console.log('✅ Socket.IO server closed');
    });
    
    // Close database connection
    try {
        const { disconnectDB } = require('./database/connection');
        await disconnectDB();
        console.log('✅ Database connection closed');
    } catch (error) {
        console.error('❌ Error closing database connection:', error.message);
    }
    
    // Exit process
    process.exit(0);
};

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Start server
const startServer = async () => {
    try {
        const PORT = config.server.port;
        
        lifecycleLogger.startup(PORT, config.server.env);
        
        // Connect to database
        console.log('🔌 Connecting to database...');
        await connectDB();
        console.log('✅ Database connected');
        
        // Create necessary directories
        const directories = ['uploads', 'uploads/avatars', 'uploads/thumbnails', 'logs', 'temp'];
        directories.forEach(dir => {
            const dirPath = path.join(__dirname, dir);
            if (!fs.existsSync(dirPath)) {
                fs.mkdirSync(dirPath, { recursive: true });
                console.log(`📁 Created directory: ${dir}`);
            }
        });
        
        // Verify email configuration (optional)
        try {
            const { verifyEmailConfig } = require('./utils/email');
            const emailConfigValid = await verifyEmailConfig();
            if (emailConfigValid) {
                console.log('📧 Email service verified');
            } else {
                console.log('⚠️  Email service not configured properly');
            }
        } catch (error) {
            console.log('⚠️  Email service not available:', error.message);
        }
        
        // Seed database with initial data (development only)
        if (config.server.env === 'development') {
            try {
                const { seedDatabase } = require('./database/connection');
                await seedDatabase();
                console.log('🌱 Database seeded with initial data');
            } catch (error) {
                console.log('⚠️  Database seeding failed:', error.message);
            }
        }
        
        // Start the server
        server.listen(PORT, () => {
            lifecycleLogger.ready(PORT);
            
            console.log('\n🚀 JustConnect V2 Server Started Successfully!');
            console.log('=====================================');
            console.log(`📍 Environment: ${config.server.env}`);
            console.log(`🌐 Server: http://localhost:${PORT}`);
            console.log(`📱 Frontend: http://localhost:${PORT}`);
            console.log(`🔗 API: http://localhost:${PORT}/api`);
            console.log(`⚡ Socket.IO: WebSocket connections ready`);
            console.log(`📊 Health Check: http://localhost:${PORT}/health`);
            console.log('=====================================');
            
            if (config.server.env === 'development') {
                console.log('\n👥 Test Users:');
                console.log('   Username: kadir    Password: 123456');
                console.log('   Username: ahmet    Password: 123456');
                console.log('   Username: fatma    Password: 123456');
                console.log('=====================================\n');
            }
        });
        
    } catch (error) {
        lifecycleLogger.error(error);
        console.error('❌ Failed to start server:', error.message);
        process.exit(1);
    }
};

// Start the application
startServer();

module.exports = { app, server, io, socketHandlers };