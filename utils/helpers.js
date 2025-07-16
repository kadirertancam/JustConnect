const crypto = require('crypto');
const moment = require('moment');

/**
 * Generate a random string of specified length
 * @param {number} length - Length of random string
 * @param {string} charset - Character set to use
 * @returns {string} Random string
 */
const generateRandomString = (length = 32, charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789') => {
    let result = '';
    for (let i = 0; i < length; i++) {
        result += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    return result;
};

/**
 * Generate a cryptographically secure random string
 * @param {number} bytes - Number of bytes to generate
 * @returns {string} Hex string
 */
const generateSecureRandomString = (bytes = 32) => {
    return crypto.randomBytes(bytes).toString('hex');
};

/**
 * Generate UUID v4
 * @returns {string} UUID
 */
const generateUUID = () => {
    return crypto.randomUUID();
};

/**
 * Hash a string using SHA-256
 * @param {string} input - Input string to hash
 * @param {string} salt - Optional salt
 * @returns {string} Hashed string
 */
const hashString = (input, salt = '') => {
    return crypto.createHash('sha256').update(input + salt).digest('hex');
};

/**
 * Generate a hash-based token
 * @param {string} data - Data to hash
 * @param {string} secret - Secret key
 * @returns {string} Token
 */
const generateToken = (data, secret) => {
    const timestamp = Date.now().toString();
    const payload = `${data}-${timestamp}`;
    const signature = crypto.createHmac('sha256', secret).update(payload).digest('hex');
    return `${Buffer.from(payload).toString('base64')}.${signature}`;
};

/**
 * Verify a token
 * @param {string} token - Token to verify
 * @param {string} secret - Secret key
 * @param {number} maxAge - Maximum age in milliseconds (optional)
 * @returns {object|null} Decoded data or null if invalid
 */
const verifyToken = (token, secret, maxAge = null) => {
    try {
        const [payloadB64, signature] = token.split('.');
        if (!payloadB64 || !signature) return null;

        const payload = Buffer.from(payloadB64, 'base64').toString();
        const expectedSignature = crypto.createHmac('sha256', secret).update(payload).digest('hex');

        if (signature !== expectedSignature) return null;

        const [data, timestamp] = payload.split('-');
        const tokenTime = parseInt(timestamp);

        if (maxAge && Date.now() - tokenTime > maxAge) return null;

        return { data, timestamp: tokenTime };
    } catch (error) {
        return null;
    }
};

/**
 * Generate invite code
 * @param {number} length - Length of invite code
 * @returns {string} Invite code
 */
const generateInviteCode = (length = 8) => {
    const charset = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Excluding similar characters
    return generateRandomString(length, charset);
};

/**
 * Generate verification code (numeric)
 * @param {number} length - Length of verification code
 * @returns {string} Verification code
 */
const generateVerificationCode = (length = 6) => {
    const charset = '0123456789';
    return generateRandomString(length, charset);
};

/**
 * Mask email address for privacy
 * @param {string} email - Email address
 * @returns {string} Masked email
 */
const maskEmail = (email) => {
    if (!email || typeof email !== 'string') return '';
    
    const [username, domain] = email.split('@');
    if (!username || !domain) return email;
    
    if (username.length <= 2) {
        return `${username[0]}***@${domain}`;
    }
    
    const maskedUsername = username[0] + '*'.repeat(username.length - 2) + username[username.length - 1];
    return `${maskedUsername}@${domain}`;
};

/**
 * Mask phone number for privacy
 * @param {string} phone - Phone number
 * @returns {string} Masked phone
 */
const maskPhoneNumber = (phone) => {
    if (!phone || typeof phone !== 'string') return '';
    
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length < 4) return phone;
    
    const visible = 2;
    const masked = '*'.repeat(cleaned.length - visible * 2);
    return cleaned.substring(0, visible) + masked + cleaned.substring(cleaned.length - visible);
};

/**
 * Generate a slug from text
 * @param {string} text - Text to slugify
 * @param {string} separator - Separator character
 * @returns {string} Slug
 */
const slugify = (text, separator = '-') => {
    return text
        .toString()
        .toLowerCase()
        .trim()
        .replace(/\s+/g, separator)
        .replace(/[^\w\-]+/g, '')
        .replace(/\-\-+/g, separator)
        .replace(/^-+/, '')
        .replace(/-+$/, '');
};

/**
 * Truncate text to specified length
 * @param {string} text - Text to truncate
 * @param {number} maxLength - Maximum length
 * @param {string} suffix - Suffix to add when truncated
 * @returns {string} Truncated text
 */
const truncateText = (text, maxLength = 100, suffix = '...') => {
    if (!text || text.length <= maxLength) return text;
    return text.substring(0, maxLength - suffix.length) + suffix;
};

/**
 * Escape HTML characters
 * @param {string} text - Text to escape
 * @returns {string} Escaped text
 */
const escapeHtml = (text) => {
    if (!text) return '';
    
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#x27;',
        '/': '&#x2F;'
    };
    
    return text.replace(/[&<>"'/]/g, (s) => map[s]);
};

/**
 * Remove HTML tags from text
 * @param {string} html - HTML text
 * @returns {string} Plain text
 */
const stripHtml = (html) => {
    if (!html) return '';
    return html.replace(/<[^>]*>/g, '');
};

/**
 * Validate email format
 * @param {string} email - Email to validate
 * @returns {boolean} Is valid email
 */
const isValidEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
};

/**
 * Validate phone number format
 * @param {string} phone - Phone number to validate
 * @returns {boolean} Is valid phone
 */
const isValidPhoneNumber = (phone) => {
    const phoneRegex = /^\+?[1-9]\d{1,14}$/;
    return phoneRegex.test(phone.replace(/\s/g, ''));
};

/**
 * Validate URL format
 * @param {string} url - URL to validate
 * @returns {boolean} Is valid URL
 */
const isValidUrl = (url) => {
    try {
        new URL(url);
        return true;
    } catch {
        return false;
    }
};

/**
 * Format file size in human readable format
 * @param {number} bytes - File size in bytes
 * @param {number} decimals - Number of decimal places
 * @returns {string} Formatted size
 */
const formatFileSize = (bytes, decimals = 2) => {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
    
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

/**
 * Format number with thousand separators
 * @param {number} num - Number to format
 * @param {string} separator - Thousand separator
 * @returns {string} Formatted number
 */
const formatNumber = (num, separator = ',') => {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, separator);
};

/**
 * Get relative time from now
 * @param {Date|string} date - Date to compare
 * @param {string} locale - Locale for formatting
 * @returns {string} Relative time
 */
const getRelativeTime = (date, locale = 'tr') => {
    moment.locale(locale);
    return moment(date).fromNow();
};

/**
 * Format date to readable string
 * @param {Date|string} date - Date to format
 * @param {string} format - Moment.js format string
 * @param {string} locale - Locale for formatting
 * @returns {string} Formatted date
 */
const formatDate = (date, format = 'DD.MM.YYYY HH:mm', locale = 'tr') => {
    moment.locale(locale);
    return moment(date).format(format);
};

/**
 * Check if date is today
 * @param {Date|string} date - Date to check
 * @returns {boolean} Is today
 */
const isToday = (date) => {
    return moment(date).isSame(moment(), 'day');
};

/**
 * Check if date is this week
 * @param {Date|string} date - Date to check
 * @returns {boolean} Is this week
 */
const isThisWeek = (date) => {
    return moment(date).isSame(moment(), 'week');
};

/**
 * Get time ago in a specific format
 * @param {Date|string} date - Date to compare
 * @param {string} locale - Locale
 * @returns {string} Time ago string
 */
const getTimeAgo = (date, locale = 'tr') => {
    const now = moment();
    const then = moment(date);
    const diff = now.diff(then);
    
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    const weeks = Math.floor(days / 7);
    const months = Math.floor(days / 30);
    const years = Math.floor(days / 365);
    
    const texts = {
        tr: {
            now: 'şimdi',
            seconds: 'saniye önce',
            minutes: 'dakika önce',
            hours: 'saat önce',
            days: 'gün önce',
            weeks: 'hafta önce',
            months: 'ay önce',
            years: 'yıl önce'
        },
        en: {
            now: 'now',
            seconds: 'seconds ago',
            minutes: 'minutes ago',
            hours: 'hours ago',
            days: 'days ago',
            weeks: 'weeks ago',
            months: 'months ago',
            years: 'years ago'
        }
    };
    
    const t = texts[locale] || texts.tr;
    
    if (seconds < 60) return t.now;
    if (minutes < 60) return `${minutes} ${t.minutes}`;
    if (hours < 24) return `${hours} ${t.hours}`;
    if (days < 7) return `${days} ${t.days}`;
    if (weeks < 4) return `${weeks} ${t.weeks}`;
    if (months < 12) return `${months} ${t.months}`;
    return `${years} ${t.years}`;
};

/**
 * Deep clone an object
 * @param {any} obj - Object to clone
 * @returns {any} Cloned object
 */
const deepClone = (obj) => {
    if (obj === null || typeof obj !== 'object') return obj;
    if (obj instanceof Date) return new Date(obj.getTime());
    if (obj instanceof Array) return obj.map(item => deepClone(item));
    if (typeof obj === 'object') {
        const clonedObj = {};
        for (const key in obj) {
            if (obj.hasOwnProperty(key)) {
                clonedObj[key] = deepClone(obj[key]);
            }
        }
        return clonedObj;
    }
};

/**
 * Merge objects deeply
 * @param {object} target - Target object
 * @param {object} source - Source object
 * @returns {object} Merged object
 */
const deepMerge = (target, source) => {
    const result = deepClone(target);
    
    for (const key in source) {
        if (source.hasOwnProperty(key)) {
            if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
                result[key] = deepMerge(result[key] || {}, source[key]);
            } else {
                result[key] = source[key];
            }
        }
    }
    
    return result;
};

/**
 * Debounce function execution
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @param {boolean} immediate - Execute immediately
 * @returns {Function} Debounced function
 */
const debounce = (func, wait, immediate = false) => {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            timeout = null;
            if (!immediate) func(...args);
        };
        const callNow = immediate && !timeout;
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
        if (callNow) func(...args);
    };
};

/**
 * Throttle function execution
 * @param {Function} func - Function to throttle
 * @param {number} limit - Limit in milliseconds
 * @returns {Function} Throttled function
 */
const throttle = (func, limit) => {
    let inThrottle;
    return function(...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
};

/**
 * Sleep for specified milliseconds
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise} Promise that resolves after sleep
 */
const sleep = (ms) => {
    return new Promise(resolve => setTimeout(resolve, ms));
};

module.exports = {
    // Random generation
    generateRandomString,
    generateSecureRandomString,
    generateUUID,
    generateInviteCode,
    generateVerificationCode,
    
    // Crypto
    hashString,
    generateToken,
    verifyToken,
    
    // Text processing
    maskEmail,
    maskPhoneNumber,
    slugify,
    truncateText,
    escapeHtml,
    stripHtml,
    
    // Validation
    isValidEmail,
    isValidPhoneNumber,
    isValidUrl,
    
    // Formatting
    formatFileSize,
    formatNumber,
    formatDate,
    getRelativeTime,
    getTimeAgo,
    
    // Date utilities
    isToday,
    isThisWeek,
    
    // Object utilities
    deepClone,
    deepMerge,
    
    // Function utilities
    debounce,
    throttle,
    sleep
};