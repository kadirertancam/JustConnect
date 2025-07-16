const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
    username: {
        type: String,
        required: [true, 'Kullanıcı adı gereklidir'],
        unique: true,
        trim: true,
        minlength: [3, 'Kullanıcı adı en az 3 karakter olmalıdır'],
        maxlength: [30, 'Kullanıcı adı en fazla 30 karakter olabilir'],
        match: [/^[a-zA-Z0-9_]+$/, 'Kullanıcı adı sadece harf, rakam ve alt çizgi içerebilir']
    },
    email: {
        type: String,
        required: [true, 'Email gereklidir'],
        unique: true,
        lowercase: true,
        trim: true,
        match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Geçerli bir email adresi giriniz']
    },
    password: {
        type: String,
        required: [true, 'Şifre gereklidir'],
        minlength: [6, 'Şifre en az 6 karakter olmalıdır']
    },
    firstName: {
        type: String,
        trim: true,
        maxlength: [50, 'Ad en fazla 50 karakter olabilir']
    },
    lastName: {
        type: String,
        trim: true,
        maxlength: [50, 'Soyad en fazla 50 karakter olabilir']
    },
    avatar: {
        type: String,
        default: function() {
            return this.username ? this.username.substring(0, 2).toUpperCase() : 'U';
        }
    },
    avatarUrl: {
        type: String,
        default: null
    },
    status: {
        type: String,
        enum: ['online', 'away', 'busy', 'offline'],
        default: 'offline'
    },
    lastSeen: {
        type: Date,
        default: Date.now
    },
    isActive: {
        type: Boolean,
        default: true
    },
    isVerified: {
        type: Boolean,
        default: false
    },
    role: {
        type: String,
        enum: ['user', 'moderator', 'admin'],
        default: 'user'
    },
    phoneNumber: {
        type: String,
        trim: true,
        match: [/^\+?[1-9]\d{1,14}$/, 'Geçerli bir telefon numarası giriniz']
    },
    bio: {
        type: String,
        maxlength: [200, 'Bio en fazla 200 karakter olabilir'],
        trim: true
    },
    preferences: {
        language: {
            type: String,
            default: 'tr',
            enum: ['tr', 'en', 'de', 'fr', 'es']
        },
        theme: {
            type: String,
            default: 'light',
            enum: ['light', 'dark', 'auto']
        },
        notifications: {
            email: {
                type: Boolean,
                default: true
            },
            push: {
                type: Boolean,
                default: true
            },
            sound: {
                type: Boolean,
                default: true
            }
        },
        privacy: {
            showLastSeen: {
                type: Boolean,
                default: true
            },
            showOnlineStatus: {
                type: Boolean,
                default: true
            },
            allowDirectMessages: {
                type: Boolean,
                default: true
            }
        }
    },
    blockedUsers: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    contacts: [{
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        nickname: String,
        addedAt: {
            type: Date,
            default: Date.now
        }
    }],
    loginAttempts: {
        type: Number,
        default: 0
    },
    lockUntil: Date,
    passwordResetToken: String,
    passwordResetExpires: Date,
    emailVerificationToken: String,
    emailVerificationExpires: Date,
    twoFactorSecret: String,
    twoFactorEnabled: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Indexes
userSchema.index({ username: 1 });
userSchema.index({ email: 1 });
userSchema.index({ status: 1 });
userSchema.index({ lastSeen: -1 });
userSchema.index({ 'contacts.user': 1 });

// Virtual fields
userSchema.virtual('fullName').get(function() {
    if (this.firstName && this.lastName) {
        return `${this.firstName} ${this.lastName}`;
    }
    return this.firstName || this.lastName || this.username;
});

userSchema.virtual('isLocked').get(function() {
    return !!(this.lockUntil && this.lockUntil > Date.now());
});

userSchema.virtual('displayAvatar').get(function() {
    return this.avatarUrl || this.avatar;
});

// Pre-save middleware
userSchema.pre('save', async function(next) {
    // Hash password if modified
    if (this.isModified('password')) {
        const saltRounds = 12;
        this.password = await bcrypt.hash(this.password, saltRounds);
    }
    
    // Update lastSeen when status changes to online
    if (this.isModified('status') && this.status === 'online') {
        this.lastSeen = new Date();
    }
    
    next();
});

// Instance methods
userSchema.methods.comparePassword = async function(candidatePassword) {
    return bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.toSafeObject = function() {
    const obj = this.toObject();
    delete obj.password;
    delete obj.passwordResetToken;
    delete obj.passwordResetExpires;
    delete obj.emailVerificationToken;
    delete obj.emailVerificationExpires;
    delete obj.twoFactorSecret;
    delete obj.loginAttempts;
    delete obj.lockUntil;
    return obj;
};

userSchema.methods.isOnline = function() {
    return this.status === 'online';
};

userSchema.methods.updateLastSeen = function() {
    this.lastSeen = new Date();
    return this.save();
};

userSchema.methods.addContact = function(userId, nickname = null) {
    const existingContact = this.contacts.find(contact => 
        contact.user.toString() === userId.toString()
    );
    
    if (!existingContact) {
        this.contacts.push({
            user: userId,
            nickname: nickname
        });
    }
    
    return this.save();
};

userSchema.methods.removeContact = function(userId) {
    this.contacts = this.contacts.filter(contact => 
        contact.user.toString() !== userId.toString()
    );
    return this.save();
};

userSchema.methods.blockUser = function(userId) {
    if (!this.blockedUsers.includes(userId)) {
        this.blockedUsers.push(userId);
    }
    return this.save();
};

userSchema.methods.unblockUser = function(userId) {
    this.blockedUsers = this.blockedUsers.filter(id => 
        id.toString() !== userId.toString()
    );
    return this.save();
};

userSchema.methods.isBlocked = function(userId) {
    return this.blockedUsers.some(id => id.toString() === userId.toString());
};

// Static methods
userSchema.statics.findByEmail = function(email) {
    return this.findOne({ email: email.toLowerCase() });
};

userSchema.statics.findByUsername = function(username) {
    return this.findOne({ username: username });
};

userSchema.statics.findOnlineUsers = function() {
    return this.find({ status: 'online' });
};

userSchema.statics.searchUsers = function(query, limit = 10) {
    const searchRegex = new RegExp(query, 'i');
    return this.find({
        $or: [
            { username: searchRegex },
            { email: searchRegex },
            { firstName: searchRegex },
            { lastName: searchRegex }
        ],
        isActive: true
    })
    .select('username email firstName lastName avatar avatarUrl status')
    .limit(limit);
};

// Account locking methods
userSchema.statics.getAuthenticated = async function(username, password) {
    const user = await this.findOne({
        $or: [
            { username: username },
            { email: username.toLowerCase() }
        ]
    });

    if (!user) {
        return { user: null, error: 'USER_NOT_FOUND' };
    }

    // Check if account is locked
    if (user.isLocked) {
        return { user: null, error: 'ACCOUNT_LOCKED' };
    }

    // Check password
    const isMatch = await user.comparePassword(password);
    
    if (!isMatch) {
        // Increase login attempts
        user.loginAttempts += 1;
        
        // Lock account after 5 failed attempts for 2 hours
        if (user.loginAttempts >= 5) {
            user.lockUntil = Date.now() + 2 * 60 * 60 * 1000; // 2 hours
        }
        
        await user.save();
        return { user: null, error: 'INVALID_PASSWORD' };
    }

    // Reset login attempts on successful login
    if (user.loginAttempts > 0) {
        user.loginAttempts = 0;
        user.lockUntil = undefined;
        await user.save();
    }

    return { user: user, error: null };
};

module.exports = mongoose.model('User', userSchema);