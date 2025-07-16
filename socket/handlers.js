const { socketAuth } = require('../middleware/auth');
const { socketLogger, performanceLogger } = require('../utils/logger');
const { generateUUID } = require('../utils/helpers');

// In-memory storage for active connections
// Production'da Redis kullanılmalı
const activeUsers = new Map(); // socketId -> userData
const userSockets = new Map(); // userId -> Set of socketIds
const chatRooms = new Map(); // chatId -> Set of socketIds
const typingUsers = new Map(); // chatId -> Set of userIds

// Rate limiting for socket events
const rateLimits = new Map(); // socketId -> { eventType: { count, lastReset } }

const RATE_LIMITS = {
    'send_message': { max: 30, window: 60000 }, // 30 messages per minute
    'typing_start': { max: 60, window: 60000 }, // 60 typing events per minute
    'join_chat': { max: 20, window: 60000 }, // 20 join attempts per minute
    'user_status': { max: 10, window: 60000 } // 10 status changes per minute
};

// Check rate limit
const checkRateLimit = (socketId, eventType) => {
    const now = Date.now();
    const limits = RATE_LIMITS[eventType];
    
    if (!limits) return true;
    
    if (!rateLimits.has(socketId)) {
        rateLimits.set(socketId, {});
    }
    
    const userLimits = rateLimits.get(socketId);
    
    if (!userLimits[eventType]) {
        userLimits[eventType] = { count: 0, lastReset: now };
    }
    
    const eventLimit = userLimits[eventType];
    
    // Reset if window has passed
    if (now - eventLimit.lastReset > limits.window) {
        eventLimit.count = 0;
        eventLimit.lastReset = now;
    }
    
    // Check if limit exceeded
    if (eventLimit.count >= limits.max) {
        return false;
    }
    
    eventLimit.count++;
    return true;
};

// Setup Socket.IO handlers
const setupSocketHandlers = (io) => {
    // Authentication middleware
    io.use(socketAuth);
    
    io.on('connection', (socket) => {
        const timer = performanceLogger.startTimer('socket_connection');
        
        socketLogger.info('User connected', {
            socketId: socket.id,
            userId: socket.userId,
            ip: socket.handshake.address
        });
        
        // Store active user
        const userData = {
            userId: socket.userId,
            socketId: socket.id,
            connectedAt: new Date(),
            lastActivity: new Date(),
            status: 'online'
        };
        
        activeUsers.set(socket.id, userData);
        
        // Map user to socket
        if (!userSockets.has(socket.userId)) {
            userSockets.set(socket.userId, new Set());
        }
        userSockets.get(socket.userId).add(socket.id);
        
        timer.end({ userId: socket.userId });

        // Send current online users count
        socket.emit('online_users_count', {
            count: userSockets.size
        });

        // Broadcast user online status
        socket.broadcast.emit('user_status_changed', {
            userId: socket.userId,
            status: 'online',
            lastSeen: new Date()
        });

        // Join user to their chat rooms
        handleJoinUserChats(socket);

        // === EVENT HANDLERS ===

        /**
         * Handle joining a chat room
         */
        socket.on('join_chat', async (data) => {
            if (!checkRateLimit(socket.id, 'join_chat')) {
                socket.emit('error', { 
                    type: 'RATE_LIMIT',
                    message: 'Çok fazla sohbet katılma isteği' 
                });
                return;
            }

            try {
                const { chatId } = data;
                
                if (!chatId) {
                    socket.emit('error', { 
                        type: 'INVALID_DATA',
                        message: 'Chat ID gerekli' 
                    });
                    return;
                }

                // TODO: Verify user has access to this chat
                // const hasAccess = await verifyUserChatAccess(socket.userId, chatId);
                // if (!hasAccess) return;

                // Join socket room
                socket.join(`chat_${chatId}`);
                
                // Track chat room members
                if (!chatRooms.has(chatId)) {
                    chatRooms.set(chatId, new Set());
                }
                chatRooms.get(chatId).add(socket.id);

                socketLogger.info('User joined chat', {
                    userId: socket.userId,
                    chatId: chatId,
                    socketId: socket.id
                });

                socket.emit('chat_joined', { chatId });

                // Notify other users in the chat
                socket.to(`chat_${chatId}`).emit('user_joined_chat', {
                    userId: socket.userId,
                    chatId: chatId,
                    timestamp: new Date()
                });

            } catch (error) {
                socketLogger.error('Error joining chat', {
                    error: error.message,
                    userId: socket.userId,
                    data
                });
                
                socket.emit('error', {
                    type: 'JOIN_CHAT_ERROR',
                    message: 'Sohbete katılırken hata oluştu'
                });
            }
        });

        /**
         * Handle leaving a chat room
         */
        socket.on('leave_chat', (data) => {
            try {
                const { chatId } = data;
                
                socket.leave(`chat_${chatId}`);
                
                // Remove from chat room tracking
                if (chatRooms.has(chatId)) {
                    chatRooms.get(chatId).delete(socket.id);
                    if (chatRooms.get(chatId).size === 0) {
                        chatRooms.delete(chatId);
                    }
                }

                socketLogger.info('User left chat', {
                    userId: socket.userId,
                    chatId: chatId
                });

                socket.emit('chat_left', { chatId });

                // Notify other users
                socket.to(`chat_${chatId}`).emit('user_left_chat', {
                    userId: socket.userId,
                    chatId: chatId,
                    timestamp: new Date()
                });

            } catch (error) {
                socketLogger.error('Error leaving chat', {
                    error: error.message,
                    userId: socket.userId,
                    data
                });
            }
        });

        /**
         * Handle sending a message
         */
        socket.on('send_message', async (data) => {
            if (!checkRateLimit(socket.id, 'send_message')) {
                socket.emit('error', { 
                    type: 'RATE_LIMIT',
                    message: 'Çok hızlı mesaj gönderiyorsunuz' 
                });
                return;
            }

            try {
                const { chatId, content, type = 'text', replyTo, tempId } = data;

                if (!chatId || !content) {
                    socket.emit('error', {
                        type: 'INVALID_DATA',
                        message: 'Chat ID ve içerik gerekli'
                    });
                    return;
                }

                // TODO: Validate user permissions and save to database
                
                const message = {
                    id: generateUUID(),
                    tempId: tempId, // Client-side temporary ID for optimistic updates
                    chatId: chatId,
                    senderId: socket.userId,
                    content: {
                        text: content.text || content,
                        type: type
                    },
                    replyTo: replyTo || null,
                    timestamp: new Date(),
                    status: 'sent'
                };

                socketLogger.info('Message sent', {
                    userId: socket.userId,
                    chatId: chatId,
                    messageId: message.id,
                    type: type
                });

                // Send to all users in the chat
                io.to(`chat_${chatId}`).emit('new_message', message);

                // Send delivery confirmation to sender
                socket.emit('message_sent', {
                    tempId: tempId,
                    messageId: message.id,
                    timestamp: message.timestamp
                });

                // Stop typing indicator for this user
                handleStopTyping(socket, chatId);

            } catch (error) {
                socketLogger.error('Error sending message', {
                    error: error.message,
                    userId: socket.userId,
                    data
                });

                socket.emit('message_error', {
                    tempId: data.tempId,
                    error: 'Mesaj gönderilemedi'
                });
            }
        });

        /**
         * Handle message read receipt
         */
        socket.on('message_read', (data) => {
            try {
                const { chatId, messageId } = data;

                // TODO: Update read status in database

                // Notify other users in the chat
                socket.to(`chat_${chatId}`).emit('message_read_by', {
                    messageId: messageId,
                    userId: socket.userId,
                    readAt: new Date()
                });

                socketLogger.debug('Message marked as read', {
                    userId: socket.userId,
                    chatId: chatId,
                    messageId: messageId
                });

            } catch (error) {
                socketLogger.error('Error marking message as read', {
                    error: error.message,
                    userId: socket.userId,
                    data
                });
            }
        });

        /**
         * Handle typing indicators
         */
        socket.on('typing_start', (data) => {
            if (!checkRateLimit(socket.id, 'typing_start')) {
                return;
            }

            try {
                const { chatId } = data;
                
                if (!typingUsers.has(chatId)) {
                    typingUsers.set(chatId, new Set());
                }
                
                typingUsers.get(chatId).add(socket.userId);

                // Notify other users in the chat
                socket.to(`chat_${chatId}`).emit('user_typing', {
                    userId: socket.userId,
                    chatId: chatId,
                    timestamp: new Date()
                });

                // Auto-stop typing after 5 seconds
                setTimeout(() => {
                    handleStopTyping(socket, chatId);
                }, 5000);

            } catch (error) {
                socketLogger.error('Error handling typing start', {
                    error: error.message,
                    userId: socket.userId,
                    data
                });
            }
        });

        socket.on('typing_stop', (data) => {
            try {
                const { chatId } = data;
                handleStopTyping(socket, chatId);
            } catch (error) {
                socketLogger.error('Error handling typing stop', {
                    error: error.message,
                    userId: socket.userId,
                    data
                });
            }
        });

        /**
         * Handle user status changes
         */
        socket.on('user_status', (data) => {
            if (!checkRateLimit(socket.id, 'user_status')) {
                return;
            }

            try {
                const { status } = data;
                const validStatuses = ['online', 'away', 'busy', 'offline'];
                
                if (!validStatuses.includes(status)) {
                    socket.emit('error', {
                        type: 'INVALID_STATUS',
                        message: 'Geçersiz durum'
                    });
                    return;
                }

                // Update user data
                const userData = activeUsers.get(socket.id);
                if (userData) {
                    userData.status = status;
                    userData.lastActivity = new Date();
                    activeUsers.set(socket.id, userData);
                }

                // TODO: Update database

                // Broadcast status change
                socket.broadcast.emit('user_status_changed', {
                    userId: socket.userId,
                    status: status,
                    lastSeen: new Date()
                });

                socketLogger.info('User status changed', {
                    userId: socket.userId,
                    status: status
                });

            } catch (error) {
                socketLogger.error('Error changing user status', {
                    error: error.message,
                    userId: socket.userId,
                    data
                });
            }
        });

        /**
         * Handle voice/video call signaling
         */
        socket.on('call_initiate', (data) => {
            try {
                const { targetUserId, callType, chatId } = data;
                const targetSockets = userSockets.get(targetUserId);
                
                if (targetSockets) {
                    targetSockets.forEach(targetSocketId => {
                        io.to(targetSocketId).emit('incoming_call', {
                            callerId: socket.userId,
                            callType: callType,
                            chatId: chatId,
                            callId: generateUUID()
                        });
                    });
                }

                socketLogger.info('Call initiated', {
                    callerId: socket.userId,
                    targetUserId: targetUserId,
                    callType: callType
                });

            } catch (error) {
                socketLogger.error('Error initiating call', {
                    error: error.message,
                    userId: socket.userId,
                    data
                });
            }
        });

        /**
         * Handle call responses
         */
        socket.on('call_response', (data) => {
            try {
                const { callerId, accepted, callId } = data;
                const callerSockets = userSockets.get(callerId);
                
                if (callerSockets) {
                    callerSockets.forEach(callerSocketId => {
                        io.to(callerSocketId).emit('call_response', {
                            responderId: socket.userId,
                            accepted: accepted,
                            callId: callId
                        });
                    });
                }

                socketLogger.info('Call responded', {
                    responderId: socket.userId,
                    callerId: callerId,
                    accepted: accepted
                });

            } catch (error) {
                socketLogger.error('Error responding to call', {
                    error: error.message,
                    userId: socket.userId,
                    data
                });
            }
        });

        /**
         * Handle activity tracking
         */
        socket.on('user_activity', () => {
            const userData = activeUsers.get(socket.id);
            if (userData) {
                userData.lastActivity = new Date();
                activeUsers.set(socket.id, userData);
            }
        });

        /**
         * Handle ping for connection testing
         */
        socket.on('ping', () => {
            socket.emit('pong', { timestamp: new Date() });
        });

        /**
         * Handle disconnect
         */
        socket.on('disconnect', (reason) => {
            handleUserDisconnect(socket, reason);
        });

        /**
         * Handle errors
         */
        socket.on('error', (error) => {
            socketLogger.error('Socket error', {
                error: error.message,
                userId: socket.userId,
                socketId: socket.id
            });
        });
    });

    // === HELPER FUNCTIONS ===

    /**
     * Handle user joining their chats on connection
     */
    const handleJoinUserChats = async (socket) => {
        try {
            // TODO: Get user's chats from database
            // const userChats = await getUserChats(socket.userId);
            
            // For now, we'll skip auto-joining chats
            // User will join chats explicitly when they navigate to them
            
        } catch (error) {
            socketLogger.error('Error joining user chats', {
                error: error.message,
                userId: socket.userId
            });
        }
    };

    /**
     * Handle stopping typing indicator
     */
    const handleStopTyping = (socket, chatId) => {
        if (typingUsers.has(chatId)) {
            typingUsers.get(chatId).delete(socket.userId);
            
            if (typingUsers.get(chatId).size === 0) {
                typingUsers.delete(chatId);
            }
        }

        // Notify other users
        socket.to(`chat_${chatId}`).emit('user_stopped_typing', {
            userId: socket.userId,
            chatId: chatId,
            timestamp: new Date()
        });
    };

    /**
     * Handle user disconnect
     */
    const handleUserDisconnect = (socket, reason) => {
        const timer = performanceLogger.startTimer('socket_disconnect');
        
        socketLogger.info('User disconnected', {
            socketId: socket.id,
            userId: socket.userId,
            reason: reason
        });

        // Remove from active users
        activeUsers.delete(socket.id);

        // Remove from user sockets mapping
        if (userSockets.has(socket.userId)) {
            userSockets.get(socket.userId).delete(socket.id);
            
            // If no more sockets for this user, mark as offline
            if (userSockets.get(socket.userId).size === 0) {
                userSockets.delete(socket.userId);
                
                // Broadcast user offline status
                socket.broadcast.emit('user_status_changed', {
                    userId: socket.userId,
                    status: 'offline',
                    lastSeen: new Date()
                });
            }
        }

        // Remove from chat rooms
        chatRooms.forEach((sockets, chatId) => {
            if (sockets.has(socket.id)) {
                sockets.delete(socket.id);
                
                // Stop typing if user was typing
                handleStopTyping(socket, chatId);
                
                if (sockets.size === 0) {
                    chatRooms.delete(chatId);
                }
            }
        });

        // Remove from typing users
        typingUsers.forEach((users, chatId) => {
            users.delete(socket.userId);
            if (users.size === 0) {
                typingUsers.delete(chatId);
            }
        });

        // Remove rate limits
        rateLimits.delete(socket.id);

        timer.end({ userId: socket.userId, reason });
    };

    // === ADMIN FUNCTIONS ===

    /**
     * Get server statistics
     */
    const getServerStats = () => {
        return {
            activeConnections: activeUsers.size,
            activeUsers: userSockets.size,
            activeChatRooms: chatRooms.size,
            typingUsers: Array.from(typingUsers.entries()).map(([chatId, users]) => ({
                chatId,
                userCount: users.size
            })),
            memoryUsage: process.memoryUsage()
        };
    };

    /**
     * Broadcast message to all users
     */
    const broadcastToAll = (event, data) => {
        io.emit(event, data);
        socketLogger.info('Broadcast sent to all users', {
            event: event,
            userCount: userSockets.size
        });
    };

    /**
     * Send message to specific user
     */
    const sendToUser = (userId, event, data) => {
        const sockets = userSockets.get(userId);
        if (sockets) {
            sockets.forEach(socketId => {
                io.to(socketId).emit(event, data);
            });
            return true;
        }
        return false;
    };

    /**
     * Send message to chat room
     */
    const sendToChat = (chatId, event, data) => {
        io.to(`chat_${chatId}`).emit(event, data);
        socketLogger.debug('Message sent to chat', {
            chatId: chatId,
            event: event
        });
    };

    /**
     * Clean up inactive connections
     */
    const cleanupInactiveConnections = () => {
        const now = new Date();
        const inactiveThreshold = 30 * 60 * 1000; // 30 minutes
        
        let cleanedCount = 0;

        activeUsers.forEach((userData, socketId) => {
            if (now - userData.lastActivity > inactiveThreshold) {
                const socket = io.sockets.sockets.get(socketId);
                if (socket) {
                    socket.disconnect(true);
                    cleanedCount++;
                }
            }
        });

        if (cleanedCount > 0) {
            socketLogger.info('Cleaned up inactive connections', {
                count: cleanedCount
            });
        }
    };

    // Cleanup inactive connections every 10 minutes
    setInterval(cleanupInactiveConnections, 10 * 60 * 1000);

    // Return admin functions for external use
    return {
        getServerStats,
        broadcastToAll,
        sendToUser,
        sendToChat,
        cleanupInactiveConnections,
        
        // Getters for current state
        getActiveUsers: () => Array.from(activeUsers.values()),
        getActiveUserIds: () => Array.from(userSockets.keys()),
        getChatRooms: () => Array.from(chatRooms.keys()),
        getTypingUsers: () => Array.from(typingUsers.entries())
    };
};

module.exports = {
    setupSocketHandlers
};