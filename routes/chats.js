const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Middleware imports
const { 
    authenticateToken,
    messageRateLimit,
    uploadRateLimit,
    sanitizeInput
} = require('../middleware/auth');

const {
    validateSendMessage,
    validateEditMessage,
    validateCreateGroup,
    validateUpdateGroup,
    validateAddParticipant,
    validateUpdateParticipantRole,
    validateSearch,
    validatePagination,
    validateObjectId,
    validateAddReaction
} = require('../middleware/validation');

// Config import
const config = require('../config/config');

// Memory storage for chats and messages (Production'da MongoDB kullanılacak)
let chats = new Map();
let messages = new Map();
let users = new Map(); // Auth routes'tan import edilmeli

// Sample data
const sampleUsers = [
    {
        id: "user1",
        username: "kadir",
        firstName: "Kadir",
        lastName: "Ertan",
        avatar: "KE",
        status: "online"
    },
    {
        id: "user2", 
        username: "ahmet",
        firstName: "Ahmet", 
        lastName: "Yılmaz",
        avatar: "AY",
        status: "online"
    },
    {
        id: "user3",
        username: "fatma",
        firstName: "Fatma",
        lastName: "Özkan", 
        avatar: "FÖ",
        status: "away"
    }
];

const sampleChats = [
    {
        id: 1,
        name: null,
        type: 'private',
        participants: [
            { 
                user: "user1", 
                role: 'member', 
                joinedAt: new Date(), 
                isActive: true,
                lastSeenAt: new Date()
            },
            { 
                user: "user2", 
                role: 'member', 
                joinedAt: new Date(), 
                isActive: true,
                lastSeenAt: new Date()
            }
        ],
        lastMessage: 3,
        lastActivity: new Date(),
        avatar: "AY",
        settings: {
            isPublic: false,
            allowInviteLinks: false,
            requireApproval: false,
            muteNotifications: false,
            maxMembers: 2
        },
        createdBy: "user1",
        createdAt: new Date(),
        updatedAt: new Date()
    },
    {
        id: 2,
        name: "Proje Ekibi",
        type: 'group',
        participants: [
            { 
                user: "user1", 
                role: 'owner', 
                joinedAt: new Date(), 
                isActive: true,
                lastSeenAt: new Date()
            },
            { 
                user: "user2", 
                role: 'admin', 
                joinedAt: new Date(), 
                isActive: true,
                lastSeenAt: new Date()
            },
            { 
                user: "user3", 
                role: 'member', 
                joinedAt: new Date(), 
                isActive: true,
                lastSeenAt: new Date()
            }
        ],
        lastMessage: 6,
        lastActivity: new Date(),
        avatar: "PE",
        settings: {
            isPublic: false,
            allowInviteLinks: true,
            requireApproval: false,
            muteNotifications: false,
            maxMembers: 100
        },
        createdBy: "user1",
        createdAt: new Date(),
        updatedAt: new Date()
    }
];

const sampleMessages = [
    {
        id: 1,
        chat: 1,
        sender: "user2",
        content: {
            text: "Merhaba! Nasılsın?",
            type: "text"
        },
        status: "read",
        readBy: [
            { user: "user1", readAt: new Date() }
        ],
        reactions: [],
        isEdited: false,
        isDeleted: false,
        isPinned: false,
        createdAt: new Date(Date.now() - 300000), // 5 minutes ago
        updatedAt: new Date(Date.now() - 300000)
    },
    {
        id: 2,
        chat: 1,
        sender: "user1",
        content: {
            text: "Merhaba Ahmet! İyiyim, sen nasılsın?",
            type: "text"
        },
        status: "read",
        readBy: [
            { user: "user2", readAt: new Date() }
        ],
        reactions: [],
        replyTo: 1,
        isEdited: false,
        isDeleted: false,
        isPinned: false,
        createdAt: new Date(Date.now() - 240000), // 4 minutes ago
        updatedAt: new Date(Date.now() - 240000)
    },
    {
        id: 3,
        chat: 1,
        sender: "user2",
        content: {
            text: "Toplantı için hazırlandın mı?",
            type: "text"
        },
        status: "delivered",
        readBy: [],
        reactions: [],
        isEdited: false,
        isDeleted: false,
        isPinned: false,
        createdAt: new Date(Date.now() - 180000), // 3 minutes ago
        updatedAt: new Date(Date.now() - 180000)
    },
    {
        id: 4,
        chat: 2,
        sender: "user1",
        content: {
            text: "Yeni proje toplantısı için hazırlık yapıyoruz",
            type: "text"
        },
        status: "read",
        readBy: [
            { user: "user2", readAt: new Date() },
            { user: "user3", readAt: new Date() }
        ],
        reactions: [
            { user: "user2", emoji: "👍", createdAt: new Date() }
        ],
        isEdited: false,
        isDeleted: false,
        isPinned: true,
        pinnedAt: new Date(),
        pinnedBy: "user1",
        createdAt: new Date(Date.now() - 600000), // 10 minutes ago
        updatedAt: new Date(Date.now() - 600000)
    },
    {
        id: 5,
        chat: 2,
        sender: "user3",
        content: {
            text: "Hangi konuları ele alacağız?",
            type: "text"
        },
        status: "read",
        readBy: [
            { user: "user1", readAt: new Date() },
            { user: "user2", readAt: new Date() }
        ],
        reactions: [],
        isEdited: false,
        isDeleted: false,
        isPinned: false,
        createdAt: new Date(Date.now() - 480000), // 8 minutes ago
        updatedAt: new Date(Date.now() - 480000)
    },
    {
        id: 6,
        chat: 2,
        sender: "user2",
        content: {
            text: "Yeni tasarımlar paylaşıldı. Lütfen gözden geçirin.",
            type: "text"
        },
        status: "delivered",
        readBy: [
            { user: "user1", readAt: new Date() }
        ],
        reactions: [],
        isEdited: false,
        isDeleted: false,
        isPinned: false,
        createdAt: new Date(Date.now() - 120000), // 2 minutes ago
        updatedAt: new Date(Date.now() - 120000)
    }
];

// Initialize sample data
sampleUsers.forEach(user => users.set(user.id, user));
sampleChats.forEach(chat => chats.set(chat.id, chat));
sampleMessages.forEach(message => messages.set(message.id, message));

// Helper functions
const getChatWithDetails = (chat, currentUserId) => {
    const lastMessage = chat.lastMessage ? messages.get(chat.lastMessage) : null;
    const participants = chat.participants
        .filter(p => p.isActive)
        .map(p => {
            const user = users.get(p.user);
            return {
                ...p,
                user: user ? {
                    id: user.id,
                    username: user.username,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    avatar: user.avatar,
                    status: user.status
                } : null
            };
        });

    const unreadCount = getUnreadMessageCount(chat.id, currentUserId);
    
    let displayName = chat.name;
    if (!displayName && chat.type === 'private' && participants.length === 2) {
        const otherUser = participants.find(p => p.user && p.user.id !== currentUserId);
        displayName = otherUser ? `${otherUser.user.firstName} ${otherUser.user.lastName}`.trim() || otherUser.user.username : 'Özel Sohbet';
    }

    return {
        id: chat.id,
        name: displayName,
        type: chat.type,
        participants,
        lastMessage: lastMessage ? {
            id: lastMessage.id,
            text: getMessageDisplayText(lastMessage),
            time: lastMessage.createdAt,
            sender: lastMessage.sender
        } : null,
        lastActivity: chat.lastActivity,
        avatar: chat.avatar,
        unreadCount,
        settings: chat.settings,
        createdAt: chat.createdAt
    };
};

const getMessageDisplayText = (message) => {
    if (message.isDeleted) return 'Bu mesaj silindi';
    
    switch (message.content.type) {
        case 'image': return '📷 Fotoğraf';
        case 'video': return '🎥 Video';
        case 'audio': return '🎵 Ses kaydı';
        case 'file': return `📎 ${message.content.file?.originalname || 'Dosya'}`;
        case 'location': return '📍 Konum';
        case 'contact': return '👤 Kişi';
        default: return message.content.text || '';
    }
};

const getUnreadMessageCount = (chatId, userId) => {
    const chatMessages = Array.from(messages.values())
        .filter(m => m.chat === chatId && !m.isDeleted)
        .filter(m => !m.readBy.some(r => r.user === userId));
    return chatMessages.length;
};

const isUserInChat = (chatId, userId) => {
    const chat = chats.get(chatId);
    return chat && chat.participants.some(p => p.user === userId && p.isActive);
};

const getUserRole = (chatId, userId) => {
    const chat = chats.get(chatId);
    if (!chat) return null;
    
    const participant = chat.participants.find(p => p.user === userId && p.isActive);
    return participant ? participant.role : null;
};

// Routes

/**
 * @route GET /api/chats
 * @desc Kullanıcının sohbetlerini getir
 * @access Private
 */
router.get('/',
    authenticateToken,
    validatePagination,
    async (req, res) => {
        try {
            const userId = req.user.id;
            const { page = 1, limit = 20, type } = req.query;

            // Filter user's chats
            let userChats = Array.from(chats.values())
                .filter(chat => chat.participants.some(p => p.user === userId && p.isActive));

            // Filter by type if specified
            if (type) {
                userChats = userChats.filter(chat => chat.type === type);
            }

            // Sort by last activity
            userChats.sort((a, b) => new Date(b.lastActivity) - new Date(a.lastActivity));

            // Pagination
            const startIndex = (page - 1) * limit;
            const endIndex = startIndex + parseInt(limit);
            const paginatedChats = userChats.slice(startIndex, endIndex);

            // Get detailed chat info
            const detailedChats = paginatedChats.map(chat => getChatWithDetails(chat, userId));

            res.json({
                success: true,
                chats: detailedChats,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total: userChats.length,
                    pages: Math.ceil(userChats.length / limit)
                }
            });

        } catch (error) {
            console.error('Get chats error:', error);
            res.status(500).json({
                error: 'GET_CHATS_FAILED',
                message: 'Sohbetler alınamadı'
            });
        }
    }
);

/**
 * @route GET /api/chats/:chatId
 * @desc Sohbet detaylarını getir
 * @access Private
 */
router.get('/:chatId',
    authenticateToken,
    validateObjectId('chatId'),
    async (req, res) => {
        try {
            const chatId = parseInt(req.params.chatId);
            const userId = req.user.id;

            if (!isUserInChat(chatId, userId)) {
                return res.status(403).json({
                    error: 'ACCESS_DENIED',
                    message: 'Bu sohbete erişim izniniz yok'
                });
            }

            const chat = chats.get(chatId);
            if (!chat) {
                return res.status(404).json({
                    error: 'CHAT_NOT_FOUND',
                    message: 'Sohbet bulunamadı'
                });
            }

            const detailedChat = getChatWithDetails(chat, userId);

            res.json({
                success: true,
                chat: detailedChat
            });

        } catch (error) {
            console.error('Get chat error:', error);
            res.status(500).json({
                error: 'GET_CHAT_FAILED',
                message: 'Sohbet bilgileri alınamadı'
            });
        }
    }
);

/**
 * @route GET /api/chats/:chatId/messages
 * @desc Sohbet mesajlarını getir
 * @access Private
 */
router.get('/:chatId/messages',
    authenticateToken,
    validateObjectId('chatId'),
    validatePagination,
    async (req, res) => {
        try {
            const chatId = parseInt(req.params.chatId);
            const userId = req.user.id;
            const { page = 1, limit = 50, before, search } = req.query;

            if (!isUserInChat(chatId, userId)) {
                return res.status(403).json({
                    error: 'ACCESS_DENIED',
                    message: 'Bu sohbete erişim izniniz yok'
                });
            }

            // Get messages for this chat
            let chatMessages = Array.from(messages.values())
                .filter(m => m.chat === chatId && !m.isDeleted);

            // Search filter
            if (search) {
                const searchRegex = new RegExp(search, 'i');
                chatMessages = chatMessages.filter(m => 
                    m.content.text && searchRegex.test(m.content.text)
                );
            }

            // Before filter (for pagination)
            if (before) {
                const beforeDate = new Date(before);
                chatMessages = chatMessages.filter(m => m.createdAt < beforeDate);
            }

            // Sort by creation date (newest first)
            chatMessages.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

            // Pagination
            const startIndex = (page - 1) * limit;
            const endIndex = startIndex + parseInt(limit);
            const paginatedMessages = chatMessages.slice(startIndex, endIndex);

            // Add sender info and reply info
            const detailedMessages = paginatedMessages.map(message => {
                const sender = users.get(message.sender);
                const replyToMessage = message.replyTo ? messages.get(message.replyTo) : null;

                return {
                    ...message,
                    sender: sender ? {
                        id: sender.id,
                        username: sender.username,
                        firstName: sender.firstName,
                        lastName: sender.lastName,
                        avatar: sender.avatar
                    } : null,
                    replyTo: replyToMessage ? {
                        id: replyToMessage.id,
                        text: getMessageDisplayText(replyToMessage),
                        sender: replyToMessage.sender
                    } : null,
                    displayText: getMessageDisplayText(message)
                };
            });

            res.json({
                success: true,
                messages: detailedMessages.reverse(), // Reverse to show oldest first in UI
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total: chatMessages.length,
                    hasMore: endIndex < chatMessages.length
                }
            });

        } catch (error) {
            console.error('Get messages error:', error);
            res.status(500).json({
                error: 'GET_MESSAGES_FAILED',
                message: 'Mesajlar alınamadı'
            });
        }
    }
);

/**
 * @route POST /api/chats/:chatId/messages
 * @desc Mesaj gönder
 * @access Private
 */
router.post('/:chatId/messages',
    authenticateToken,
    messageRateLimit,
    sanitizeInput,
    validateSendMessage,
    async (req, res) => {
        try {
            const chatId = parseInt(req.params.chatId);
            const userId = req.user.id;
            const { content, replyTo } = req.body;

            if (!isUserInChat(chatId, userId)) {
                return res.status(403).json({
                    error: 'ACCESS_DENIED',
                    message: 'Bu sohbete mesaj gönderme izniniz yok'
                });
            }

            // Validate reply message if specified
            if (replyTo) {
                const replyMessage = messages.get(replyTo);
                if (!replyMessage || replyMessage.chat !== chatId) {
                    return res.status(400).json({
                        error: 'INVALID_REPLY_MESSAGE',
                        message: 'Geçersiz yanıt mesajı'
                    });
                }
            }

            // Create new message
            const messageId = messages.size + 1;
            const newMessage = {
                id: messageId,
                chat: chatId,
                sender: userId,
                content,
                replyTo: replyTo || null,
                status: 'sent',
                readBy: [],
                reactions: [],
                mentions: [], // TODO: Extract mentions from text
                isEdited: false,
                isDeleted: false,
                isPinned: false,
                createdAt: new Date(),
                updatedAt: new Date()
            };

            messages.set(messageId, newMessage);

            // Update chat's last message and activity
            const chat = chats.get(chatId);
            if (chat) {
                chat.lastMessage = messageId;
                chat.lastActivity = new Date();
                chat.updatedAt = new Date();
                chats.set(chatId, chat);
            }

            // Add sender info for response
            const sender = users.get(userId);
            const responseMessage = {
                ...newMessage,
                sender: sender ? {
                    id: sender.id,
                    username: sender.username,
                    firstName: sender.firstName,
                    lastName: sender.lastName,
                    avatar: sender.avatar
                } : null,
                displayText: getMessageDisplayText(newMessage)
            };

            res.status(201).json({
                success: true,
                message: responseMessage
            });

        } catch (error) {
            console.error('Send message error:', error);
            res.status(500).json({
                error: 'SEND_MESSAGE_FAILED',
                message: 'Mesaj gönderilemedi'
            });
        }
    }
);

/**
 * @route PUT /api/chats/:chatId/messages/:messageId
 * @desc Mesaj düzenle
 * @access Private
 */
router.put('/:chatId/messages/:messageId',
    authenticateToken,
    sanitizeInput,
    validateEditMessage,
    async (req, res) => {
        try {
            const chatId = parseInt(req.params.chatId);
            const messageId = parseInt(req.params.messageId);
            const userId = req.user.id;
            const { content } = req.body;

            if (!isUserInChat(chatId, userId)) {
                return res.status(403).json({
                    error: 'ACCESS_DENIED',
                    message: 'Bu sohbete erişim izniniz yok'
                });
            }

            const message = messages.get(messageId);
            if (!message || message.chat !== chatId) {
                return res.status(404).json({
                    error: 'MESSAGE_NOT_FOUND',
                    message: 'Mesaj bulunamadı'
                });
            }

            // Check if user can edit this message
            if (message.sender !== userId) {
                return res.status(403).json({
                    error: 'EDIT_PERMISSION_DENIED',
                    message: 'Bu mesajı düzenleme izniniz yok'
                });
            }

            if (message.content.type !== 'text') {
                return res.status(400).json({
                    error: 'CANNOT_EDIT_NON_TEXT',
                    message: 'Sadece metin mesajları düzenlenebilir'
                });
            }

            // Save edit history
            if (!message.editHistory) {
                message.editHistory = [];
            }
            message.editHistory.push({
                content: message.content,
                editedAt: new Date()
            });

            // Update message
            message.content.text = content;
            message.isEdited = true;
            message.updatedAt = new Date();
            messages.set(messageId, message);

            // Add sender info for response
            const sender = users.get(userId);
            const responseMessage = {
                ...message,
                sender: sender ? {
                    id: sender.id,
                    username: sender.username,
                    firstName: sender.firstName,
                    lastName: sender.lastName,
                    avatar: sender.avatar
                } : null,
                displayText: getMessageDisplayText(message)
            };

            res.json({
                success: true,
                message: responseMessage
            });

        } catch (error) {
            console.error('Edit message error:', error);
            res.status(500).json({
                error: 'EDIT_MESSAGE_FAILED',
                message: 'Mesaj düzenlenemedi'
            });
        }
    }
);

/**
 * @route DELETE /api/chats/:chatId/messages/:messageId
 * @desc Mesaj sil
 * @access Private
 */
router.delete('/:chatId/messages/:messageId',
    authenticateToken,
    async (req, res) => {
        try {
            const chatId = parseInt(req.params.chatId);
            const messageId = parseInt(req.params.messageId);
            const userId = req.user.id;

            if (!isUserInChat(chatId, userId)) {
                return res.status(403).json({
                    error: 'ACCESS_DENIED',
                    message: 'Bu sohbete erişim izniniz yok'
                });
            }

            const message = messages.get(messageId);
            if (!message || message.chat !== chatId) {
                return res.status(404).json({
                    error: 'MESSAGE_NOT_FOUND',
                    message: 'Mesaj bulunamadı'
                });
            }

            const userRole = getUserRole(chatId, userId);
            
            // Check delete permissions
            const canDelete = message.sender === userId || ['admin', 'owner'].includes(userRole);
            if (!canDelete) {
                return res.status(403).json({
                    error: 'DELETE_PERMISSION_DENIED',
                    message: 'Bu mesajı silme izniniz yok'
                });
            }

            // Soft delete message
            message.isDeleted = true;
            message.deletedAt = new Date();
            message.deletedBy = userId;
            message.updatedAt = new Date();
            messages.set(messageId, message);

            res.json({
                success: true,
                message: 'Mesaj silindi'
            });

        } catch (error) {
            console.error('Delete message error:', error);
            res.status(500).json({
                error: 'DELETE_MESSAGE_FAILED',
                message: 'Mesaj silinemedi'
            });
        }
    }
);

/**
 * @route POST /api/chats/:chatId/messages/:messageId/reactions
 * @desc Mesaja reaction ekle
 * @access Private
 */
router.post('/:chatId/messages/:messageId/reactions',
    authenticateToken,
    validateAddReaction,
    async (req, res) => {
        try {
            const chatId = parseInt(req.params.chatId);
            const messageId = parseInt(req.params.messageId);
            const userId = req.user.id;
            const { emoji } = req.body;

            if (!isUserInChat(chatId, userId)) {
                return res.status(403).json({
                    error: 'ACCESS_DENIED',
                    message: 'Bu sohbete erişim izniniz yok'
                });
            }

            const message = messages.get(messageId);
            if (!message || message.chat !== chatId) {
                return res.status(404).json({
                    error: 'MESSAGE_NOT_FOUND',
                    message: 'Mesaj bulunamadı'
                });
            }

            // Remove existing reaction from this user
            message.reactions = message.reactions.filter(r => r.user !== userId);

            // Add new reaction
            message.reactions.push({
                user: userId,
                emoji: emoji,
                createdAt: new Date()
            });

            message.updatedAt = new Date();
            messages.set(messageId, message);

            res.json({
                success: true,
                message: 'Reaction eklendi'
            });

        } catch (error) {
            console.error('Add reaction error:', error);
            res.status(500).json({
                error: 'ADD_REACTION_FAILED',
                message: 'Reaction eklenemedi'
            });
        }
    }
);

/**
 * @route POST /api/chats/:chatId/read
 * @desc Sohbeti okundu olarak işaretle
 * @access Private
 */
router.post('/:chatId/read',
    authenticateToken,
    async (req, res) => {
        try {
            const chatId = parseInt(req.params.chatId);
            const userId = req.user.id;

            if (!isUserInChat(chatId, userId)) {
                return res.status(403).json({
                    error: 'ACCESS_DENIED',
                    message: 'Bu sohbete erişim izniniz yok'
                });
            }

            // Mark all unread messages as read
            const chatMessages = Array.from(messages.values())
                .filter(m => m.chat === chatId && !m.isDeleted)
                .filter(m => !m.readBy.some(r => r.user === userId));

            chatMessages.forEach(message => {
                message.readBy.push({
                    user: userId,
                    readAt: new Date()
                });
                message.status = 'read';
                message.updatedAt = new Date();
                messages.set(message.id, message);
            });

            res.json({
                success: true,
                message: 'Sohbet okundu olarak işaretlendi',
                markedCount: chatMessages.length
            });

        } catch (error) {
            console.error('Mark as read error:', error);
            res.status(500).json({
                error: 'MARK_READ_FAILED',
                message: 'Okundu işaretlemesi başarısız'
            });
        }
    }
);

module.exports = router;