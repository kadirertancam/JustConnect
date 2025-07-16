const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
    chat: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Chat',
        required: true
    },
    sender: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    content: {
        text: {
            type: String,
            maxlength: [2000, 'Mesaj en fazla 2000 karakter olabilir']
        },
        type: {
            type: String,
            enum: ['text', 'image', 'video', 'audio', 'file', 'location', 'contact', 'sticker', 'gif'],
            default: 'text'
        },
        file: {
            url: String,
            filename: String,
            originalname: String,
            mimetype: String,
            size: Number,
            thumbnail: String,
            duration: Number, // for audio/video files
            width: Number,    // for images/videos
            height: Number    // for images/videos
        },
        location: {
            latitude: Number,
            longitude: Number,
            address: String
        },
        contact: {
            name: String,
            phone: String,
            email: String
        }
    },
    replyTo: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Message'
    },
    forwardedFrom: {
        originalMessage: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Message'
        },
        originalSender: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        originalChat: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Chat'
        }
    },
    mentions: [{
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        text: String,
        offset: Number,
        length: Number
    }],
    reactions: [{
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        emoji: {
            type: String,
            required: true
        },
        createdAt: {
            type: Date,
            default: Date.now
        }
    }],
    status: {
        type: String,
        enum: ['sending', 'sent', 'delivered', 'read', 'failed'],
        default: 'sending'
    },
    readBy: [{
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        readAt: {
            type: Date,
            default: Date.now
        }
    }],
    editHistory: [{
        content: {
            text: String,
            type: String
        },
        editedAt: {
            type: Date,
            default: Date.now
        }
    }],
    isEdited: {
        type: Boolean,
        default: false
    },
    isDeleted: {
        type: Boolean,
        default: false
    },
    deletedAt: Date,
    deletedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    isPinned: {
        type: Boolean,
        default: false
    },
    pinnedAt: Date,
    pinnedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    expiresAt: Date,
    metadata: {
        platform: String,
        userAgent: String,
        ipAddress: String
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Indexes
messageSchema.index({ chat: 1, createdAt: -1 });
messageSchema.index({ sender: 1 });
messageSchema.index({ createdAt: -1 });
messageSchema.index({ 'content.type': 1 });
messageSchema.index({ replyTo: 1 });
messageSchema.index({ isPinned: 1 });
messageSchema.index({ isDeleted: 1 });
messageSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Virtual fields
messageSchema.virtual('isFile').get(function() {
    return ['image', 'video', 'audio', 'file'].includes(this.content.type);
});

messageSchema.virtual('hasReactions').get(function() {
    return this.reactions && this.reactions.length > 0;
});

messageSchema.virtual('reactionCount').get(function() {
    return this.reactions ? this.reactions.length : 0;
});

messageSchema.virtual('isExpired').get(function() {
    return this.expiresAt && this.expiresAt < new Date();
});

messageSchema.virtual('displayText').get(function() {
    if (this.isDeleted) return 'Bu mesaj silindi';
    if (this.isExpired) return 'Bu mesajın süresi doldu';
    
    switch (this.content.type) {
        case 'image':
            return '📷 Fotoğraf';
        case 'video':
            return '🎥 Video';
        case 'audio':
            return '🎵 Ses kaydı';
        case 'file':
            return `📎 ${this.content.file?.originalname || 'Dosya'}`;
        case 'location':
            return '📍 Konum';
        case 'contact':
            return '👤 Kişi';
        case 'sticker':
            return '😀 Sticker';
        case 'gif':
            return '🎬 GIF';
        default:
            return this.content.text || '';
    }
});

// Pre-save middleware
messageSchema.pre('save', function(next) {
    // Auto-set status to sent if not specified
    if (this.isNew && this.status === 'sending') {
        this.status = 'sent';
    }
    next();
});

// Instance methods
messageSchema.methods.markAsRead = function(userId) {
    const existingRead = this.readBy.find(r => 
        r.user.toString() === userId.toString()
    );
    
    if (!existingRead) {
        this.readBy.push({
            user: userId,
            readAt: new Date()
        });
        
        // Update status to read if this is the last unread message
        this.status = 'read';
    }
    
    return this.save();
};

messageSchema.methods.addReaction = function(userId, emoji) {
    // Remove existing reaction from this user
    this.reactions = this.reactions.filter(r => 
        r.user.toString() !== userId.toString()
    );
    
    // Add new reaction
    this.reactions.push({
        user: userId,
        emoji: emoji
    });
    
    return this.save();
};

messageSchema.methods.removeReaction = function(userId, emoji = null) {
    if (emoji) {
        this.reactions = this.reactions.filter(r => 
            !(r.user.toString() === userId.toString() && r.emoji === emoji)
        );
    } else {
        this.reactions = this.reactions.filter(r => 
            r.user.toString() !== userId.toString()
        );
    }
    
    return this.save();
};

messageSchema.methods.editContent = function(newContent) {
    if (this.isDeleted) {
        throw new Error('Silinmiş mesaj düzenlenemez');
    }
    
    // Save to edit history
    this.editHistory.push({
        content: {
            text: this.content.text,
            type: this.content.type
        },
        editedAt: new Date()
    });
    
    // Update content
    this.content.text = newContent;
    this.isEdited = true;
    
    return this.save();
};

messageSchema.methods.softDelete = function(deletedBy = null) {
    this.isDeleted = true;
    this.deletedAt = new Date();
    if (deletedBy) {
        this.deletedBy = deletedBy;
    }
    return this.save();
};

messageSchema.methods.pin = function(pinnedBy) {
    this.isPinned = true;
    this.pinnedAt = new Date();
    this.pinnedBy = pinnedBy;
    return this.save();
};

messageSchema.methods.unpin = function() {
    this.isPinned = false;
    this.pinnedAt = null;
    this.pinnedBy = null;
    return this.save();
};

messageSchema.methods.setExpiration = function(expirationTime) {
    this.expiresAt = new Date(Date.now() + expirationTime);
    return this.save();
};

messageSchema.methods.isReadBy = function(userId) {
    return this.readBy.some(r => r.user.toString() === userId.toString());
};

messageSchema.methods.getReactionsByEmoji = function() {
    const reactionMap = new Map();
    
    this.reactions.forEach(reaction => {
        if (reactionMap.has(reaction.emoji)) {
            reactionMap.get(reaction.emoji).push(reaction.user);
        } else {
            reactionMap.set(reaction.emoji, [reaction.user]);
        }
    });
    
    return Object.fromEntries(reactionMap);
};

messageSchema.methods.canUserEdit = function(userId) {
    // Only sender can edit, and only text messages
    return this.sender.toString() === userId.toString() && 
           this.content.type === 'text' && 
           !this.isDeleted &&
           !this.isExpired;
};

messageSchema.methods.canUserDelete = function(userId, userRole = 'member') {
    // Sender can delete their own messages
    if (this.sender.toString() === userId.toString()) {
        return true;
    }
    
    // Admins and owners can delete any message
    return ['admin', 'owner'].includes(userRole);
};

// Static methods
messageSchema.statics.findByChatId = function(chatId, options = {}) {
    const query = {
        chat: chatId,
        isDeleted: false
    };
    
    if (options.beforeDate) {
        query.createdAt = { $lt: options.beforeDate };
    }
    
    if (options.afterDate) {
        query.createdAt = { $gt: options.afterDate };
    }
    
    if (options.messageType) {
        query['content.type'] = options.messageType;
    }
    
    return this.find(query)
        .populate('sender', 'username firstName lastName avatar avatarUrl')
        .populate('replyTo')
        .populate('reactions.user', 'username firstName lastName')
        .sort({ createdAt: options.ascending ? 1 : -1 })
        .limit(options.limit || 50);
};

messageSchema.statics.searchInChat = function(chatId, searchQuery, limit = 50) {
    const searchRegex = new RegExp(searchQuery, 'i');
    
    return this.find({
        chat: chatId,
        'content.text': searchRegex,
        isDeleted: false
    })
    .populate('sender', 'username firstName lastName avatar avatarUrl')
    .sort({ createdAt: -1 })
    .limit(limit);
};

messageSchema.statics.findUnreadMessages = function(chatId, userId, lastReadMessageId) {
    const query = {
        chat: chatId,
        isDeleted: false
    };
    
    if (lastReadMessageId) {
        query._id = { $gt: lastReadMessageId };
    }
    
    return this.find(query)
        .populate('sender', 'username firstName lastName avatar avatarUrl')
        .sort({ createdAt: 1 });
};

messageSchema.statics.markChatAsRead = function(chatId, userId) {
    return this.updateMany(
        {
            chat: chatId,
            'readBy.user': { $ne: userId },
            isDeleted: false
        },
        {
            $addToSet: {
                readBy: {
                    user: userId,
                    readAt: new Date()
                }
            },
            $set: { status: 'read' }
        }
    );
};

messageSchema.statics.getMediaMessages = function(chatId, mediaType = null) {
    const query = {
        chat: chatId,
        'content.type': mediaType ? mediaType : { $in: ['image', 'video', 'audio', 'file'] },
        isDeleted: false
    };
    
    return this.find(query)
        .populate('sender', 'username firstName lastName avatar avatarUrl')
        .sort({ createdAt: -1 });
};

messageSchema.statics.getPinnedMessages = function(chatId) {
    return this.find({
        chat: chatId,
        isPinned: true,
        isDeleted: false
    })
    .populate('sender', 'username firstName lastName avatar avatarUrl')
    .populate('pinnedBy', 'username firstName lastName')
    .sort({ pinnedAt: -1 });
};

messageSchema.statics.deleteExpiredMessages = function() {
    return this.deleteMany({
        expiresAt: { $lt: new Date() }
    });
};

messageSchema.statics.getMessageStatistics = function(chatId, timeRange = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - timeRange);
    
    return this.aggregate([
        {
            $match: {
                chat: mongoose.Types.ObjectId(chatId),
                createdAt: { $gte: startDate },
                isDeleted: false
            }
        },
        {
            $group: {
                _id: {
                    sender: '$sender',
                    type: '$content.type'
                },
                count: { $sum: 1 }
            }
        },
        {
            $group: {
                _id: '$_id.sender',
                totalMessages: { $sum: '$count' },
                messageTypes: {
                    $push: {
                        type: '$_id.type',
                        count: '$count'
                    }
                }
            }
        },
        {
            $lookup: {
                from: 'users',
                localField: '_id',
                foreignField: '_id',
                as: 'sender'
            }
        }
    ]);
};

module.exports = mongoose.model('Message', messageSchema);