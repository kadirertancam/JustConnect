const mongoose = require('mongoose');

const chatSchema = new mongoose.Schema({
    name: {
        type: String,
        trim: true,
        maxlength: [100, 'Sohbet adı en fazla 100 karakter olabilir']
    },
    description: {
        type: String,
        trim: true,
        maxlength: [500, 'Sohbet açıklaması en fazla 500 karakter olabilir']
    },
    type: {
        type: String,
        enum: ['private', 'group', 'channel', 'broadcast'],
        required: true,
        default: 'private'
    },
    participants: [{
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        role: {
            type: String,
            enum: ['member', 'admin', 'owner'],
            default: 'member'
        },
        joinedAt: {
            type: Date,
            default: Date.now
        },
        lastReadMessageId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Message'
        },
        lastSeenAt: {
            type: Date,
            default: Date.now
        },
        isActive: {
            type: Boolean,
            default: true
        },
        nickname: String,
        permissions: {
            canSendMessages: {
                type: Boolean,
                default: true
            },
            canSendMedia: {
                type: Boolean,
                default: true
            },
            canAddMembers: {
                type: Boolean,
                default: false
            },
            canRemoveMembers: {
                type: Boolean,
                default: false
            },
            canChangeInfo: {
                type: Boolean,
                default: false
            },
            canPinMessages: {
                type: Boolean,
                default: false
            }
        }
    }],
    lastMessage: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Message'
    },
    lastActivity: {
        type: Date,
        default: Date.now
    },
    avatar: {
        type: String,
        default: null
    },
    avatarUrl: {
        type: String,
        default: null
    },
    settings: {
        isPublic: {
            type: Boolean,
            default: false
        },
        allowInviteLinks: {
            type: Boolean,
            default: true
        },
        requireApproval: {
            type: Boolean,
            default: false
        },
        muteNotifications: {
            type: Boolean,
            default: false
        },
        messageRetention: {
            type: Number,
            default: 0 // 0 = unlimited, in days
        },
        maxMembers: {
            type: Number,
            default: 100
        }
    },
    inviteCode: {
        type: String,
        unique: true,
        sparse: true
    },
    pinnedMessages: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Message'
    }],
    isArchived: {
        type: Boolean,
        default: false
    },
    isDeleted: {
        type: Boolean,
        default: false
    },
    deletedAt: Date,
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    tags: [String],
    category: {
        type: String,
        enum: ['work', 'personal', 'education', 'gaming', 'other'],
        default: 'other'
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Indexes
chatSchema.index({ participants: 1 });
chatSchema.index({ type: 1 });
chatSchema.index({ lastActivity: -1 });
chatSchema.index({ createdBy: 1 });
chatSchema.index({ inviteCode: 1 });
chatSchema.index({ isDeleted: 1 });
chatSchema.index({ 'participants.user': 1 });

// Virtual fields
chatSchema.virtual('memberCount').get(function() {
    return this.participants.filter(p => p.isActive).length;
});

chatSchema.virtual('displayName').get(function() {
    if (this.name) return this.name;
    
    if (this.type === 'private' && this.participants.length === 2) {
        // For private chats, generate name from participants
        return 'Özel Sohbet';
    }
    
    return `${this.type === 'group' ? 'Grup' : 'Kanal'} Sohbeti`;
});

chatSchema.virtual('displayAvatar').get(function() {
    return this.avatarUrl || this.avatar || this.displayName.substring(0, 2).toUpperCase();
});

// Pre-save middleware
chatSchema.pre('save', function(next) {
    this.lastActivity = new Date();
    next();
});

// Instance methods
chatSchema.methods.addParticipant = function(userId, role = 'member', addedBy = null) {
    const existingParticipant = this.participants.find(p => 
        p.user.toString() === userId.toString()
    );
    
    if (existingParticipant) {
        if (!existingParticipant.isActive) {
            existingParticipant.isActive = true;
            existingParticipant.joinedAt = new Date();
        }
        return this.save();
    }
    
    // Check member limit
    if (this.memberCount >= this.settings.maxMembers) {
        throw new Error('Maksimum üye sayısına ulaşıldı');
    }
    
    this.participants.push({
        user: userId,
        role: role,
        joinedAt: new Date()
    });
    
    return this.save();
};

chatSchema.methods.removeParticipant = function(userId, removedBy = null) {
    const participant = this.participants.find(p => 
        p.user.toString() === userId.toString()
    );
    
    if (!participant) {
        throw new Error('Kullanıcı bu sohbette değil');
    }
    
    participant.isActive = false;
    participant.leftAt = new Date();
    
    return this.save();
};

chatSchema.methods.updateParticipantRole = function(userId, newRole, updatedBy = null) {
    const participant = this.participants.find(p => 
        p.user.toString() === userId.toString() && p.isActive
    );
    
    if (!participant) {
        throw new Error('Kullanıcı bu sohbette değil');
    }
    
    participant.role = newRole;
    return this.save();
};

chatSchema.methods.isParticipant = function(userId) {
    return this.participants.some(p => 
        p.user.toString() === userId.toString() && p.isActive
    );
};

chatSchema.methods.getParticipant = function(userId) {
    return this.participants.find(p => 
        p.user.toString() === userId.toString() && p.isActive
    );
};

chatSchema.methods.isAdmin = function(userId) {
    const participant = this.getParticipant(userId);
    return participant && ['admin', 'owner'].includes(participant.role);
};

chatSchema.methods.isOwner = function(userId) {
    const participant = this.getParticipant(userId);
    return participant && participant.role === 'owner';
};

chatSchema.methods.canUserPerformAction = function(userId, action) {
    const participant = this.getParticipant(userId);
    if (!participant) return false;
    
    // Owner can do everything
    if (participant.role === 'owner') return true;
    
    // Admin permissions
    if (participant.role === 'admin') {
        const adminActions = ['sendMessages', 'sendMedia', 'addMembers', 'pinMessages'];
        if (adminActions.includes(action)) return true;
    }
    
    // Check specific permissions
    const permission = `can${action.charAt(0).toUpperCase() + action.slice(1)}`;
    return participant.permissions[permission] || false;
};

chatSchema.methods.generateInviteCode = function() {
    if (!this.settings.allowInviteLinks) {
        throw new Error('Bu sohbet için davet bağlantıları kapalı');
    }
    
    const code = Math.random().toString(36).substring(2, 15) + 
                 Math.random().toString(36).substring(2, 15);
    this.inviteCode = code;
    return this.save();
};

chatSchema.methods.archive = function() {
    this.isArchived = true;
    return this.save();
};

chatSchema.methods.unarchive = function() {
    this.isArchived = false;
    return this.save();
};

chatSchema.methods.softDelete = function() {
    this.isDeleted = true;
    this.deletedAt = new Date();
    return this.save();
};

chatSchema.methods.markAsRead = function(userId, messageId = null) {
    const participant = this.getParticipant(userId);
    if (participant) {
        participant.lastSeenAt = new Date();
        if (messageId) {
            participant.lastReadMessageId = messageId;
        }
        return this.save();
    }
};

chatSchema.methods.getUnreadCount = function(userId) {
    const participant = this.getParticipant(userId);
    if (!participant || !participant.lastReadMessageId) {
        return 0; // Could implement a more sophisticated count here
    }
    return 0;
};

// Static methods
chatSchema.statics.findByParticipant = function(userId, options = {}) {
    const query = {
        'participants.user': userId,
        'participants.isActive': true,
        isDeleted: false
    };
    
    if (options.type) {
        query.type = options.type;
    }
    
    if (options.includeArchived !== true) {
        query.isArchived = false;
    }
    
    return this.find(query)
        .populate('participants.user', 'username firstName lastName avatar avatarUrl status')
        .populate('lastMessage')
        .sort({ lastActivity: -1 });
};

chatSchema.statics.findPrivateChat = function(user1Id, user2Id) {
    return this.findOne({
        type: 'private',
        'participants.user': { $all: [user1Id, user2Id] },
        'participants.isActive': true,
        isDeleted: false
    });
};

chatSchema.statics.createPrivateChat = function(user1Id, user2Id) {
    return this.create({
        type: 'private',
        participants: [
            { user: user1Id, role: 'member' },
            { user: user2Id, role: 'member' }
        ],
        createdBy: user1Id
    });
};

chatSchema.statics.createGroupChat = function(name, creatorId, participantIds = []) {
    const participants = [
        { user: creatorId, role: 'owner' },
        ...participantIds.map(id => ({ user: id, role: 'member' }))
    ];
    
    return this.create({
        name: name,
        type: 'group',
        participants: participants,
        createdBy: creatorId
    });
};

chatSchema.statics.findByInviteCode = function(code) {
    return this.findOne({
        inviteCode: code,
        isDeleted: false,
        'settings.allowInviteLinks': true
    });
};

chatSchema.statics.searchChats = function(query, userId, limit = 10) {
    const searchRegex = new RegExp(query, 'i');
    return this.find({
        $or: [
            { name: searchRegex },
            { description: searchRegex }
        ],
        'participants.user': userId,
        'participants.isActive': true,
        isDeleted: false
    })
    .limit(limit)
    .sort({ lastActivity: -1 });
};

module.exports = mongoose.model('Chat', chatSchema);