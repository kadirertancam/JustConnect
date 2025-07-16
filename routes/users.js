const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');

// Middleware imports
const { 
    authenticateToken,
    searchRateLimit,
    sanitizeInput
} = require('../middleware/auth');

const {
    validateProfileUpdate,
    validateSearch,
    validatePagination,
    validateObjectId
} = require('../middleware/validation');

// Memory storage (Production'da MongoDB kullanılacak)
let users = new Map();

// Sample users
const sampleUsers = [
    {
        id: "user1",
        username: "kadir",
        email: "kadir@justconnect.com",
        firstName: "Kadir",
        lastName: "Ertan",
        avatar: "KE",
        avatarUrl: null,
        status: "online",
        bio: "JustConnect V2 geliştiricisi",
        phoneNumber: "+905551234567",
        isActive: true,
        isVerified: true,
        role: "admin",
        lastSeen: new Date(),
        preferences: {
            language: 'tr',
            theme: 'dark',
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
        contacts: ["user2", "user3"],
        blockedUsers: [],
        createdAt: new Date(Date.now() - 86400000 * 30), // 30 days ago
        updatedAt: new Date()
    },
    {
        id: "user2",
        username: "ahmet",
        email: "ahmet@justconnect.com",
        firstName: "Ahmet",
        lastName: "Yılmaz",
        avatar: "AY",
        avatarUrl: null,
        status: "online",
        bio: "Frontend Developer",
        phoneNumber: "+905557654321",
        isActive: true,
        isVerified: true,
        role: "user",
        lastSeen: new Date(),
        preferences: {
            language: 'tr',
            theme: 'light',
            notifications: {
                email: true,
                push: true,
                sound: false
            },
            privacy: {
                showLastSeen: true,
                showOnlineStatus: true,
                allowDirectMessages: true
            }
        },
        contacts: ["user1", "user3"],
        blockedUsers: [],
        createdAt: new Date(Date.now() - 86400000 * 15), // 15 days ago
        updatedAt: new Date()
    },
    {
        id: "user3",
        username: "fatma",
        email: "fatma@justconnect.com",
        firstName: "Fatma",
        lastName: "Özkan",
        avatar: "FÖ",
        avatarUrl: null,
        status: "away",
        bio: "UI/UX Designer",
        phoneNumber: "+905559876543",
        isActive: true,
        isVerified: true,
        role: "user",
        lastSeen: new Date(Date.now() - 1800000), // 30 minutes ago
        preferences: {
            language: 'tr',
            theme: 'auto',
            notifications: {
                email: false,
                push: true,
                sound: true
            },
            privacy: {
                showLastSeen: false,
                showOnlineStatus: true,
                allowDirectMessages: true
            }
        },
        contacts: ["user1", "user2"],
        blockedUsers: [],
        createdAt: new Date(Date.now() - 86400000 * 7), // 7 days ago
        updatedAt: new Date()
    },
    {
        id: "user4",
        username: "mehmet",
        email: "mehmet@justconnect.com",
        firstName: "Mehmet",
        lastName: "Kaya",
        avatar: "MK",
        avatarUrl: null,
        status: "offline",
        bio: "Backend Developer",
        phoneNumber: "+905551112233",
        isActive: true,
        isVerified: false,
        role: "user",
        lastSeen: new Date(Date.now() - 3600000), // 1 hour ago
        preferences: {
            language: 'en',
            theme: 'dark',
            notifications: {
                email: true,
                push: false,
                sound: false
            },
            privacy: {
                showLastSeen: true,
                showOnlineStatus: false,
                allowDirectMessages: false
            }
        },
        contacts: [],
        blockedUsers: [],
        createdAt: new Date(Date.now() - 86400000 * 3), // 3 days ago
        updatedAt: new Date()
    }
];

// Initialize sample users
sampleUsers.forEach(user => users.set(user.id, user));

// Helper functions
const createUserResponse = (user, isOwn = false, requesterRole = 'user') => {
    const baseResponse = {
        id: user.id,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        avatar: user.avatar,
        avatarUrl: user.avatarUrl,
        status: user.status,
        bio: user.bio,
        isVerified: user.isVerified,
        createdAt: user.createdAt
    };

    // Add more details for own profile or admin users
    if (isOwn || requesterRole === 'admin') {
        baseResponse.email = user.email;
        baseResponse.phoneNumber = user.phoneNumber;
        baseResponse.role = user.role;
        baseResponse.isActive = user.isActive;
        baseResponse.lastSeen = user.lastSeen;
        baseResponse.preferences = user.preferences;
        baseResponse.updatedAt = user.updatedAt;
    }

    // Privacy settings check
    if (!isOwn && user.preferences?.privacy) {
        if (!user.preferences.privacy.showLastSeen) {
            delete baseResponse.lastSeen;
        }
        if (!user.preferences.privacy.showOnlineStatus) {
            baseResponse.status = 'offline';
        }
    }

    return baseResponse;
};

const getStatusText = (status, lastSeen, language = 'tr') => {
    const texts = {
        tr: {
            online: 'Çevrimiçi',
            away: 'Uzakta',
            busy: 'Meşgul',
            offline: 'Çevrimdışı',
            lastSeen: 'Son görülme'
        },
        en: {
            online: 'Online',
            away: 'Away',
            busy: 'Busy',
            offline: 'Offline',
            lastSeen: 'Last seen'
        }
    };

    const t = texts[language] || texts.tr;

    if (status === 'online') return t.online;
    if (status === 'away') return t.away;
    if (status === 'busy') return t.busy;
    
    if (lastSeen) {
        const now = new Date();
        const diff = now - new Date(lastSeen);
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);

        if (minutes < 1) return t.online;
        if (minutes < 60) return `${t.lastSeen} ${minutes} dakika önce`;
        if (hours < 24) return `${t.lastSeen} ${hours} saat önce`;
        if (days < 7) return `${t.lastSeen} ${days} gün önce`;
    }

    return t.offline;
};

// Routes

/**
 * @route GET /api/users/me
 * @desc Kendi profil bilgilerini getir
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

            const userResponse = createUserResponse(user, true);

            res.json({
                success: true,
                user: userResponse
            });

        } catch (error) {
            console.error('Get own profile error:', error);
            res.status(500).json({
                error: 'GET_PROFILE_FAILED',
                message: 'Profil bilgileri alınamadı'
            });
        }
    }
);

/**
 * @route PUT /api/users/me
 * @desc Profil bilgilerini güncelle
 * @access Private
 */
router.put('/me',
    authenticateToken,
    sanitizeInput,
    validateProfileUpdate,
    async (req, res) => {
        try {
            const userId = req.user.id;
            const updates = req.body;
            const user = users.get(userId);

            if (!user) {
                return res.status(404).json({
                    error: 'USER_NOT_FOUND',
                    message: 'Kullanıcı bulunamadı'
                });
            }

            // Update allowed fields
            const allowedFields = ['firstName', 'lastName', 'bio', 'phoneNumber', 'status'];
            allowedFields.forEach(field => {
                if (updates[field] !== undefined) {
                    user[field] = updates[field];
                }
            });

            // Update preferences if provided
            if (updates.preferences) {
                user.preferences = { ...user.preferences, ...updates.preferences };
            }

            user.updatedAt = new Date();
            users.set(userId, user);

            const userResponse = createUserResponse(user, true);

            res.json({
                success: true,
                message: 'Profil başarıyla güncellendi',
                user: userResponse
            });

        } catch (error) {
            console.error('Update profile error:', error);
            res.status(500).json({
                error: 'UPDATE_PROFILE_FAILED',
                message: 'Profil güncellenemedi'
            });
        }
    }
);

/**
 * @route GET /api/users/:userId
 * @desc Kullanıcı profilini getir
 * @access Private
 */
router.get('/:userId',
    authenticateToken,
    validateObjectId('userId'),
    async (req, res) => {
        try {
            const targetUserId = req.params.userId;
            const requesterId = req.user.id;
            const requester = users.get(requesterId);

            const targetUser = users.get(targetUserId);
            if (!targetUser || !targetUser.isActive) {
                return res.status(404).json({
                    error: 'USER_NOT_FOUND',
                    message: 'Kullanıcı bulunamadı'
                });
            }

            // Check if requester is blocked
            if (targetUser.blockedUsers.includes(requesterId)) {
                return res.status(404).json({
                    error: 'USER_NOT_FOUND',
                    message: 'Kullanıcı bulunamadı'
                });
            }

            const isOwn = targetUserId === requesterId;
            const userResponse = createUserResponse(targetUser, isOwn, requester?.role);

            // Add relationship info
            const relationship = {
                isBlocked: requester?.blockedUsers.includes(targetUserId) || false,
                isContact: requester?.contacts.includes(targetUserId) || false,
                canDirectMessage: targetUser.preferences?.privacy?.allowDirectMessages !== false
            };

            res.json({
                success: true,
                user: userResponse,
                relationship
            });

        } catch (error) {
            console.error('Get user profile error:', error);
            res.status(500).json({
                error: 'GET_USER_FAILED',
                message: 'Kullanıcı profili alınamadı'
            });
        }
    }
);

/**
 * @route GET /api/users
 * @desc Kullanıcı listesini getir (admin)
 * @access Private (Admin)
 */
router.get('/',
    authenticateToken,
    validatePagination,
    async (req, res) => {
        try {
            const requester = users.get(req.user.id);
            
            if (requester?.role !== 'admin') {
                return res.status(403).json({
                    error: 'INSUFFICIENT_PERMISSIONS',
                    message: 'Bu işlem için admin yetkisi gerekli'
                });
            }

            const { page = 1, limit = 20, status, role, search } = req.query;

            let allUsers = Array.from(users.values());

            // Filter by status
            if (status) {
                allUsers = allUsers.filter(u => u.status === status);
            }

            // Filter by role
            if (role) {
                allUsers = allUsers.filter(u => u.role === role);
            }

            // Search filter
            if (search) {
                const searchRegex = new RegExp(search, 'i');
                allUsers = allUsers.filter(u => 
                    searchRegex.test(u.username) || 
                    searchRegex.test(u.email) ||
                    searchRegex.test(u.firstName) ||
                    searchRegex.test(u.lastName)
                );
            }

            // Sort by creation date (newest first)
            allUsers.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

            // Pagination
            const startIndex = (page - 1) * limit;
            const endIndex = startIndex + parseInt(limit);
            const paginatedUsers = allUsers.slice(startIndex, endIndex);

            const userResponses = paginatedUsers.map(user => createUserResponse(user, false, 'admin'));

            res.json({
                success: true,
                users: userResponses,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total: allUsers.length,
                    pages: Math.ceil(allUsers.length / limit)
                }
            });

        } catch (error) {
            console.error('Get users error:', error);
            res.status(500).json({
                error: 'GET_USERS_FAILED',
                message: 'Kullanıcı listesi alınamadı'
            });
        }
    }
);

/**
 * @route GET /api/users/search
 * @desc Kullanıcı arama
 * @access Private
 */
router.get('/search',
    authenticateToken,
    searchRateLimit,
    validateSearch,
    async (req, res) => {
        try {
            const { q: query, limit = 10 } = req.query;
            const requesterId = req.user.id;
            const requester = users.get(requesterId);

            const searchRegex = new RegExp(query, 'i');
            
            let searchResults = Array.from(users.values())
                .filter(user => 
                    user.isActive &&
                    user.id !== requesterId &&
                    !user.blockedUsers.includes(requesterId) &&
                    (searchRegex.test(user.username) ||
                     searchRegex.test(user.firstName) ||
                     searchRegex.test(user.lastName) ||
                     searchRegex.test(user.email))
                )
                .slice(0, parseInt(limit));

            const results = searchResults.map(user => {
                const userResponse = createUserResponse(user, false, requester?.role);
                
                // Add match info
                userResponse.matchScore = 0;
                if (user.username.toLowerCase().includes(query.toLowerCase())) userResponse.matchScore += 3;
                if (user.firstName?.toLowerCase().includes(query.toLowerCase())) userResponse.matchScore += 2;
                if (user.lastName?.toLowerCase().includes(query.toLowerCase())) userResponse.matchScore += 2;
                if (user.email.toLowerCase().includes(query.toLowerCase())) userResponse.matchScore += 1;

                return userResponse;
            });

            // Sort by match score
            results.sort((a, b) => b.matchScore - a.matchScore);

            res.json({
                success: true,
                query,
                results,
                count: results.length
            });

        } catch (error) {
            console.error('Search users error:', error);
            res.status(500).json({
                error: 'SEARCH_FAILED',
                message: 'Kullanıcı arama başarısız'
            });
        }
    }
);

/**
 * @route POST /api/users/:userId/contact
 * @desc Kullanıcıyı kişi listesine ekle
 * @access Private
 */
router.post('/:userId/contact',
    authenticateToken,
    validateObjectId('userId'),
    async (req, res) => {
        try {
            const targetUserId = req.params.userId;
            const requesterId = req.user.id;
            const { nickname } = req.body;

            if (targetUserId === requesterId) {
                return res.status(400).json({
                    error: 'CANNOT_ADD_SELF',
                    message: 'Kendinizi kişi listesine ekleyemezsiniz'
                });
            }

            const requester = users.get(requesterId);
            const targetUser = users.get(targetUserId);

            if (!targetUser || !targetUser.isActive) {
                return res.status(404).json({
                    error: 'USER_NOT_FOUND',
                    message: 'Kullanıcı bulunamadı'
                });
            }

            if (requester.blockedUsers.includes(targetUserId) || targetUser.blockedUsers.includes(requesterId)) {
                return res.status(400).json({
                    error: 'BLOCKED_USER',
                    message: 'Bu kullanıcı ile iletişim kurulamaz'
                });
            }

            // Check if already in contacts
            if (requester.contacts.some(c => c.user === targetUserId || c === targetUserId)) {
                return res.status(400).json({
                    error: 'ALREADY_CONTACT',
                    message: 'Bu kullanıcı zaten kişi listenizde'
                });
            }

            // Add to contacts
            const contactEntry = {
                user: targetUserId,
                nickname: nickname || null,
                addedAt: new Date()
            };

            if (Array.isArray(requester.contacts)) {
                requester.contacts.push(contactEntry);
            } else {
                // Legacy support for simple array
                requester.contacts = requester.contacts || [];
                requester.contacts.push(targetUserId);
            }

            requester.updatedAt = new Date();
            users.set(requesterId, requester);

            res.json({
                success: true,
                message: 'Kullanıcı kişi listesine eklendi'
            });

        } catch (error) {
            console.error('Add contact error:', error);
            res.status(500).json({
                error: 'ADD_CONTACT_FAILED',
                message: 'Kişi eklenemedi'
            });
        }
    }
);

/**
 * @route DELETE /api/users/:userId/contact
 * @desc Kullanıcıyı kişi listesinden çıkar
 * @access Private
 */
router.delete('/:userId/contact',
    authenticateToken,
    validateObjectId('userId'),
    async (req, res) => {
        try {
            const targetUserId = req.params.userId;
            const requesterId = req.user.id;
            const requester = users.get(requesterId);

            if (!requester.contacts.some(c => c.user === targetUserId || c === targetUserId)) {
                return res.status(404).json({
                    error: 'NOT_IN_CONTACTS',
                    message: 'Bu kullanıcı kişi listenizde değil'
                });
            }

            // Remove from contacts
            requester.contacts = requester.contacts.filter(c => 
                (typeof c === 'object' ? c.user : c) !== targetUserId
            );

            requester.updatedAt = new Date();
            users.set(requesterId, requester);

            res.json({
                success: true,
                message: 'Kullanıcı kişi listesinden çıkarıldı'
            });

        } catch (error) {
            console.error('Remove contact error:', error);
            res.status(500).json({
                error: 'REMOVE_CONTACT_FAILED',
                message: 'Kişi çıkarılamadı'
            });
        }
    }
);

/**
 * @route POST /api/users/:userId/block
 * @desc Kullanıcıyı engelle
 * @access Private
 */
router.post('/:userId/block',
    authenticateToken,
    validateObjectId('userId'),
    async (req, res) => {
        try {
            const targetUserId = req.params.userId;
            const requesterId = req.user.id;

            if (targetUserId === requesterId) {
                return res.status(400).json({
                    error: 'CANNOT_BLOCK_SELF',
                    message: 'Kendinizi engelleyemezsiniz'
                });
            }

            const requester = users.get(requesterId);
            const targetUser = users.get(targetUserId);

            if (!targetUser) {
                return res.status(404).json({
                    error: 'USER_NOT_FOUND',
                    message: 'Kullanıcı bulunamadı'
                });
            }

            if (requester.blockedUsers.includes(targetUserId)) {
                return res.status(400).json({
                    error: 'ALREADY_BLOCKED',
                    message: 'Bu kullanıcı zaten engellenmiş'
                });
            }

            // Add to blocked users
            requester.blockedUsers.push(targetUserId);

            // Remove from contacts if exists
            requester.contacts = requester.contacts.filter(c => 
                (typeof c === 'object' ? c.user : c) !== targetUserId
            );

            requester.updatedAt = new Date();
            users.set(requesterId, requester);

            res.json({
                success: true,
                message: 'Kullanıcı engellendi'
            });

        } catch (error) {
            console.error('Block user error:', error);
            res.status(500).json({
                error: 'BLOCK_USER_FAILED',
                message: 'Kullanıcı engellenemedi'
            });
        }
    }
);

/**
 * @route DELETE /api/users/:userId/block
 * @desc Kullanıcının engelini kaldır
 * @access Private
 */
router.delete('/:userId/block',
    authenticateToken,
    validateObjectId('userId'),
    async (req, res) => {
        try {
            const targetUserId = req.params.userId;
            const requesterId = req.user.id;
            const requester = users.get(requesterId);

            if (!requester.blockedUsers.includes(targetUserId)) {
                return res.status(404).json({
                    error: 'NOT_BLOCKED',
                    message: 'Bu kullanıcı engellenmiş değil'
                });
            }

            // Remove from blocked users
            requester.blockedUsers = requester.blockedUsers.filter(id => id !== targetUserId);

            requester.updatedAt = new Date();
            users.set(requesterId, requester);

            res.json({
                success: true,
                message: 'Kullanıcının engeli kaldırıldı'
            });

        } catch (error) {
            console.error('Unblock user error:', error);
            res.status(500).json({
                error: 'UNBLOCK_USER_FAILED',
                message: 'Kullanıcının engeli kaldırılamadı'
            });
        }
    }
);

/**
 * @route GET /api/users/contacts
 * @desc Kişi listesini getir
 * @access Private
 */
router.get('/contacts',
    authenticateToken,
    validatePagination,
    async (req, res) => {
        try {
            const userId = req.user.id;
            const user = users.get(userId);
            const { page = 1, limit = 50 } = req.query;

            if (!user.contacts || user.contacts.length === 0) {
                return res.json({
                    success: true,
                    contacts: [],
                    pagination: {
                        page: 1,
                        limit: parseInt(limit),
                        total: 0,
                        pages: 0
                    }
                });
            }

            // Get contact details
            const contactDetails = user.contacts
                .map(contact => {
                    const contactUserId = typeof contact === 'object' ? contact.user : contact;
                    const contactUser = users.get(contactUserId);
                    
                    if (!contactUser || !contactUser.isActive) return null;

                    const userResponse = createUserResponse(contactUser, false, user.role);
                    
                    if (typeof contact === 'object') {
                        userResponse.nickname = contact.nickname;
                        userResponse.addedAt = contact.addedAt;
                    }

                    return userResponse;
                })
                .filter(contact => contact !== null);

            // Sort by status (online first) then by name
            contactDetails.sort((a, b) => {
                if (a.status === 'online' && b.status !== 'online') return -1;
                if (a.status !== 'online' && b.status === 'online') return 1;
                return (a.firstName || a.username).localeCompare(b.firstName || b.username);
            });

            // Pagination
            const startIndex = (page - 1) * limit;
            const endIndex = startIndex + parseInt(limit);
            const paginatedContacts = contactDetails.slice(startIndex, endIndex);

            res.json({
                success: true,
                contacts: paginatedContacts,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total: contactDetails.length,
                    pages: Math.ceil(contactDetails.length / limit)
                }
            });

        } catch (error) {
            console.error('Get contacts error:', error);
            res.status(500).json({
                error: 'GET_CONTACTS_FAILED',
                message: 'Kişi listesi alınamadı'
            });
        }
    }
);

/**
 * @route GET /api/users/online
 * @desc Çevrimiçi kullanıcıları getir
 * @access Private
 */
router.get('/online',
    authenticateToken,
    async (req, res) => {
        try {
            const requesterId = req.user.id;
            const requester = users.get(requesterId);

            const onlineUsers = Array.from(users.values())
                .filter(user => 
                    user.status === 'online' &&
                    user.id !== requesterId &&
                    user.isActive &&
                    !user.blockedUsers.includes(requesterId) &&
                    !requester.blockedUsers.includes(user.id)
                )
                .map(user => createUserResponse(user, false, requester.role))
                .sort((a, b) => (a.firstName || a.username).localeCompare(b.firstName || b.username));

            res.json({
                success: true,
                onlineUsers,
                count: onlineUsers.length
            });

        } catch (error) {
            console.error('Get online users error:', error);
            res.status(500).json({
                error: 'GET_ONLINE_USERS_FAILED',
                message: 'Çevrimiçi kullanıcılar alınamadı'
            });
        }
    }
);

module.exports = router;