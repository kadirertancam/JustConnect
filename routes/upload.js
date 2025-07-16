const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const sharp = require('sharp');

// Middleware imports
const { 
    authenticateToken,
    uploadRateLimit,
    sanitizeInput
} = require('../middleware/auth');

const { validateFileUpload } = require('../middleware/validation');
const config = require('../config/config');

// Ensure upload directories exist
const uploadDir = path.join(__dirname, '../uploads');
const tempDir = path.join(__dirname, '../temp');
const thumbnailDir = path.join(uploadDir, 'thumbnails');

[uploadDir, tempDir, thumbnailDir].forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
});

// File type configurations
const fileTypes = {
    image: {
        extensions: ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'],
        mimeTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp'],
        maxSize: 10 * 1024 * 1024, // 10MB
        generateThumbnail: true
    },
    video: {
        extensions: ['.mp4', '.webm', '.ogg', '.avi', '.mov', '.wmv'],
        mimeTypes: ['video/mp4', 'video/webm', 'video/ogg', 'video/avi', 'video/quicktime', 'video/x-ms-wmv'],
        maxSize: 100 * 1024 * 1024, // 100MB
        generateThumbnail: true
    },
    audio: {
        extensions: ['.mp3', '.wav', '.ogg', '.aac', '.flac', '.m4a'],
        mimeTypes: ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/aac', 'audio/flac', 'audio/mp4'],
        maxSize: 50 * 1024 * 1024, // 50MB
        generateThumbnail: false
    },
    document: {
        extensions: ['.pdf', '.doc', '.docx', '.txt', '.rtf', '.odt', '.xls', '.xlsx', '.ppt', '.pptx'],
        mimeTypes: [
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'text/plain',
            'text/rtf',
            'application/vnd.oasis.opendocument.text',
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/vnd.ms-powerpoint',
            'application/vnd.openxmlformats-officedocument.presentationml.presentation'
        ],
        maxSize: 25 * 1024 * 1024, // 25MB
        generateThumbnail: false
    },
    archive: {
        extensions: ['.zip', '.rar', '.7z', '.tar', '.gz'],
        mimeTypes: [
            'application/zip',
            'application/x-rar-compressed',
            'application/x-7z-compressed',
            'application/x-tar',
            'application/gzip'
        ],
        maxSize: 50 * 1024 * 1024, // 50MB
        generateThumbnail: false
    }
};

// Detect file type from extension and mime type
const detectFileType = (filename, mimetype) => {
    const ext = path.extname(filename).toLowerCase();
    
    for (const [type, config] of Object.entries(fileTypes)) {
        if (config.extensions.includes(ext) && config.mimeTypes.includes(mimetype)) {
            return type;
        }
    }
    
    return 'document'; // Default fallback
};

// Generate unique filename
const generateUniqueFilename = (originalname) => {
    const ext = path.extname(originalname);
    const timestamp = Date.now();
    const randomBytes = crypto.randomBytes(8).toString('hex');
    return `${timestamp}-${randomBytes}${ext}`;
};

// Multer configuration
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, tempDir);
    },
    filename: (req, file, cb) => {
        const uniqueFilename = generateUniqueFilename(file.originalname);
        cb(null, uniqueFilename);
    }
});

const fileFilter = (req, file, cb) => {
    const fileType = detectFileType(file.originalname, file.mimetype);
    const typeConfig = fileTypes[fileType];
    
    if (!typeConfig) {
        return cb(new Error('Desteklenmeyen dosya türü'), false);
    }
    
    if (!typeConfig.extensions.includes(path.extname(file.originalname).toLowerCase())) {
        return cb(new Error('Geçersiz dosya uzantısı'), false);
    }
    
    if (!typeConfig.mimeTypes.includes(file.mimetype)) {
        return cb(new Error('Geçersiz dosya türü'), false);
    }
    
    req.detectedFileType = fileType;
    req.typeConfig = typeConfig;
    
    cb(null, true);
};

const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: config.upload.maxFileSize,
        files: 5 // Maximum 5 files at once
    }
});

// Helper functions
const generateThumbnail = async (inputPath, outputPath, type) => {
    try {
        if (type === 'image') {
            await sharp(inputPath)
                .resize(300, 300, {
                    fit: 'inside',
                    withoutEnlargement: true
                })
                .jpeg({ quality: 80 })
                .toFile(outputPath);
            return true;
        }
        
        // For video thumbnails, you might want to use ffmpeg
        // This is a placeholder for video thumbnail generation
        if (type === 'video') {
            // TODO: Implement video thumbnail generation using ffmpeg
            return false;
        }
        
        return false;
    } catch (error) {
        console.error('Thumbnail generation error:', error);
        return false;
    }
};

const moveFileToUploads = async (tempPath, filename) => {
    const finalPath = path.join(uploadDir, filename);
    
    return new Promise((resolve, reject) => {
        fs.rename(tempPath, finalPath, (error) => {
            if (error) {
                reject(error);
            } else {
                resolve(finalPath);
            }
        });
    });
};

const getFileInfo = (filePath) => {
    return new Promise((resolve, reject) => {
        fs.stat(filePath, (error, stats) => {
            if (error) {
                reject(error);
            } else {
                resolve(stats);
            }
        });
    });
};

const getImageDimensions = async (imagePath) => {
    try {
        const metadata = await sharp(imagePath).metadata();
        return {
            width: metadata.width,
            height: metadata.height
        };
    } catch (error) {
        return null;
    }
};

// Routes

/**
 * @route POST /api/upload/single
 * @desc Tek dosya yükle
 * @access Private
 */
router.post('/single',
    authenticateToken,
    uploadRateLimit,
    upload.single('file'),
    validateFileUpload,
    async (req, res) => {
        let tempFilePath = null;
        
        try {
            if (!req.file) {
                return res.status(400).json({
                    error: 'NO_FILE_UPLOADED',
                    message: 'Dosya yüklenmedi'
                });
            }

            const file = req.file;
            const fileType = req.detectedFileType;
            const typeConfig = req.typeConfig;
            
            tempFilePath = file.path;

            // Check file size against type-specific limits
            if (file.size > typeConfig.maxSize) {
                return res.status(400).json({
                    error: 'FILE_TOO_LARGE',
                    message: `Dosya boyutu ${fileType} için çok büyük (max: ${Math.round(typeConfig.maxSize / 1024 / 1024)}MB)`
                });
            }

            // Generate unique filename for final storage
            const finalFilename = generateUniqueFilename(file.originalname);
            
            // Move file to uploads directory
            const finalPath = await moveFileToUploads(tempFilePath, finalFilename);
            tempFilePath = null; // File moved successfully

            // Get file stats
            const fileStats = await getFileInfo(finalPath);
            
            // Prepare file response
            const fileResponse = {
                id: crypto.randomUUID(),
                filename: finalFilename,
                originalname: file.originalname,
                mimetype: file.mimetype,
                type: fileType,
                size: fileStats.size,
                url: `/uploads/${finalFilename}`,
                uploadedBy: req.user.id,
                uploadedAt: new Date(),
                metadata: {}
            };

            // Add type-specific metadata
            if (fileType === 'image') {
                const dimensions = await getImageDimensions(finalPath);
                if (dimensions) {
                    fileResponse.metadata.width = dimensions.width;
                    fileResponse.metadata.height = dimensions.height;
                }
            }

            // Generate thumbnail if supported
            if (typeConfig.generateThumbnail) {
                const thumbnailFilename = `thumb_${finalFilename}`;
                const thumbnailPath = path.join(thumbnailDir, thumbnailFilename);
                
                const thumbnailGenerated = await generateThumbnail(finalPath, thumbnailPath, fileType);
                if (thumbnailGenerated) {
                    fileResponse.thumbnail = `/uploads/thumbnails/${thumbnailFilename}`;
                }
            }

            res.status(201).json({
                success: true,
                message: 'Dosya başarıyla yüklendi',
                file: fileResponse
            });

        } catch (error) {
            // Clean up temp file if error occurs
            if (tempFilePath && fs.existsSync(tempFilePath)) {
                fs.unlinkSync(tempFilePath);
            }

            console.error('File upload error:', error);
            
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

            res.status(500).json({
                error: 'UPLOAD_FAILED',
                message: 'Dosya yüklenemedi'
            });
        }
    }
);

/**
 * @route POST /api/upload/multiple
 * @desc Çoklu dosya yükle
 * @access Private
 */
router.post('/multiple',
    authenticateToken,
    uploadRateLimit,
    upload.array('files', 5),
    validateFileUpload,
    async (req, res) => {
        const tempFiles = [];
        
        try {
            if (!req.files || req.files.length === 0) {
                return res.status(400).json({
                    error: 'NO_FILES_UPLOADED',
                    message: 'Dosya yüklenmedi'
                });
            }

            const files = req.files;
            const uploadedFiles = [];
            const errors = [];

            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                const tempFilePath = file.path;
                tempFiles.push(tempFilePath);

                try {
                    const fileType = detectFileType(file.originalname, file.mimetype);
                    const typeConfig = fileTypes[fileType];

                    // Check file size
                    if (file.size > typeConfig.maxSize) {
                        errors.push({
                            file: file.originalname,
                            error: `Dosya boyutu ${fileType} için çok büyük`
                        });
                        continue;
                    }

                    // Generate unique filename
                    const finalFilename = generateUniqueFilename(file.originalname);
                    
                    // Move file to uploads
                    const finalPath = await moveFileToUploads(tempFilePath, finalFilename);
                    tempFiles[i] = null; // Mark as moved

                    // Get file stats
                    const fileStats = await getFileInfo(finalPath);
                    
                    // Prepare response
                    const fileResponse = {
                        id: crypto.randomUUID(),
                        filename: finalFilename,
                        originalname: file.originalname,
                        mimetype: file.mimetype,
                        type: fileType,
                        size: fileStats.size,
                        url: `/uploads/${finalFilename}`,
                        uploadedBy: req.user.id,
                        uploadedAt: new Date(),
                        metadata: {}
                    };

                    // Add metadata for images
                    if (fileType === 'image') {
                        const dimensions = await getImageDimensions(finalPath);
                        if (dimensions) {
                            fileResponse.metadata.width = dimensions.width;
                            fileResponse.metadata.height = dimensions.height;
                        }
                    }

                    // Generate thumbnail
                    if (typeConfig.generateThumbnail) {
                        const thumbnailFilename = `thumb_${finalFilename}`;
                        const thumbnailPath = path.join(thumbnailDir, thumbnailFilename);
                        
                        const thumbnailGenerated = await generateThumbnail(finalPath, thumbnailPath, fileType);
                        if (thumbnailGenerated) {
                            fileResponse.thumbnail = `/uploads/thumbnails/${thumbnailFilename}`;
                        }
                    }

                    uploadedFiles.push(fileResponse);

                } catch (fileError) {
                    console.error(`Error processing file ${file.originalname}:`, fileError);
                    errors.push({
                        file: file.originalname,
                        error: 'Dosya işlenemedi'
                    });
                }
            }

            // Clean up remaining temp files
            tempFiles.forEach(tempFile => {
                if (tempFile && fs.existsSync(tempFile)) {
                    fs.unlinkSync(tempFile);
                }
            });

            const response = {
                success: uploadedFiles.length > 0,
                message: `${uploadedFiles.length} dosya yüklendi`,
                files: uploadedFiles
            };

            if (errors.length > 0) {
                response.errors = errors;
                response.message += `, ${errors.length} dosyada hata`;
            }

            res.status(uploadedFiles.length > 0 ? 201 : 400).json(response);

        } catch (error) {
            // Clean up all temp files
            tempFiles.forEach(tempFile => {
                if (tempFile && fs.existsSync(tempFile)) {
                    fs.unlinkSync(tempFile);
                }
            });

            console.error('Multiple file upload error:', error);
            res.status(500).json({
                error: 'UPLOAD_FAILED',
                message: 'Dosyalar yüklenemedi'
            });
        }
    }
);

/**
 * @route POST /api/upload/avatar
 * @desc Avatar yükle
 * @access Private
 */
router.post('/avatar',
    authenticateToken,
    uploadRateLimit,
    upload.single('avatar'),
    async (req, res) => {
        let tempFilePath = null;
        
        try {
            if (!req.file) {
                return res.status(400).json({
                    error: 'NO_FILE_UPLOADED',
                    message: 'Avatar dosyası yüklenmedi'
                });
            }

            const file = req.file;
            tempFilePath = file.path;

            // Validate image file
            if (!file.mimetype.startsWith('image/')) {
                return res.status(400).json({
                    error: 'INVALID_FILE_TYPE',
                    message: 'Avatar sadece resim dosyası olabilir'
                });
            }

            // Check file size (max 5MB for avatars)
            const maxAvatarSize = 5 * 1024 * 1024;
            if (file.size > maxAvatarSize) {
                return res.status(400).json({
                    error: 'FILE_TOO_LARGE',
                    message: 'Avatar dosyası çok büyük (max 5MB)'
                });
            }

            // Generate avatar filename
            const avatarFilename = `avatar_${req.user.id}_${Date.now()}.jpg`;
            const avatarPath = path.join(uploadDir, 'avatars');
            
            // Ensure avatars directory exists
            if (!fs.existsSync(avatarPath)) {
                fs.mkdirSync(avatarPath, { recursive: true });
            }

            const finalPath = path.join(avatarPath, avatarFilename);

            // Process and resize avatar
            await sharp(tempFilePath)
                .resize(200, 200, {
                    fit: 'cover',
                    position: 'center'
                })
                .jpeg({ quality: 90 })
                .toFile(finalPath);

            // Clean up temp file
            fs.unlinkSync(tempFilePath);
            tempFilePath = null;

            // Generate smaller thumbnail
            const thumbnailFilename = `avatar_thumb_${req.user.id}_${Date.now()}.jpg`;
            const thumbnailPath = path.join(avatarPath, thumbnailFilename);
            
            await sharp(finalPath)
                .resize(50, 50, {
                    fit: 'cover',
                    position: 'center'
                })
                .jpeg({ quality: 80 })
                .toFile(thumbnailPath);

            const avatarResponse = {
                id: crypto.randomUUID(),
                filename: avatarFilename,
                originalname: file.originalname,
                type: 'avatar',
                size: fs.statSync(finalPath).size,
                url: `/uploads/avatars/${avatarFilename}`,
                thumbnail: `/uploads/avatars/${thumbnailFilename}`,
                uploadedBy: req.user.id,
                uploadedAt: new Date()
            };

            res.status(201).json({
                success: true,
                message: 'Avatar başarıyla yüklendi',
                avatar: avatarResponse
            });

        } catch (error) {
            // Clean up temp file
            if (tempFilePath && fs.existsSync(tempFilePath)) {
                fs.unlinkSync(tempFilePath);
            }

            console.error('Avatar upload error:', error);
            res.status(500).json({
                error: 'AVATAR_UPLOAD_FAILED',
                message: 'Avatar yüklenemedi'
            });
        }
    }
);

/**
 * @route GET /api/upload/info/:filename
 * @desc Dosya bilgilerini getir
 * @access Private
 */
router.get('/info/:filename',
    authenticateToken,
    async (req, res) => {
        try {
            const filename = req.params.filename;
            const filePath = path.join(uploadDir, filename);

            if (!fs.existsSync(filePath)) {
                return res.status(404).json({
                    error: 'FILE_NOT_FOUND',
                    message: 'Dosya bulunamadı'
                });
            }

            const fileStats = await getFileInfo(filePath);
            const ext = path.extname(filename).toLowerCase();
            const fileType = detectFileType(filename, '');

            const fileInfo = {
                filename: filename,
                type: fileType,
                size: fileStats.size,
                sizeHuman: formatFileSize(fileStats.size),
                extension: ext,
                created: fileStats.birthtime,
                modified: fileStats.mtime,
                url: `/uploads/${filename}`
            };

            // Add image-specific info
            if (fileType === 'image') {
                const dimensions = await getImageDimensions(filePath);
                if (dimensions) {
                    fileInfo.width = dimensions.width;
                    fileInfo.height = dimensions.height;
                }
            }

            res.json({
                success: true,
                file: fileInfo
            });

        } catch (error) {
            console.error('Get file info error:', error);
            res.status(500).json({
                error: 'GET_FILE_INFO_FAILED',
                message: 'Dosya bilgileri alınamadı'
            });
        }
    }
);

/**
 * @route DELETE /api/upload/:filename
 * @desc Dosya sil
 * @access Private
 */
router.delete('/:filename',
    authenticateToken,
    async (req, res) => {
        try {
            const filename = req.params.filename;
            const filePath = path.join(uploadDir, filename);

            if (!fs.existsSync(filePath)) {
                return res.status(404).json({
                    error: 'FILE_NOT_FOUND',
                    message: 'Dosya bulunamadı'
                });
            }

            // TODO: Add permission check - only file owner or admin can delete
            
            // Delete main file
            fs.unlinkSync(filePath);

            // Delete thumbnail if exists
            const thumbnailPath = path.join(thumbnailDir, `thumb_${filename}`);
            if (fs.existsSync(thumbnailPath)) {
                fs.unlinkSync(thumbnailPath);
            }

            res.json({
                success: true,
                message: 'Dosya silindi'
            });

        } catch (error) {
            console.error('Delete file error:', error);
            res.status(500).json({
                error: 'DELETE_FILE_FAILED',
                message: 'Dosya silinemedi'
            });
        }
    }
);

// Helper function
const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

/**
 * @route GET /api/upload/types
 * @desc Desteklenen dosya türlerini getir
 * @access Public
 */
router.get('/types', (req, res) => {
    const supportedTypes = Object.keys(fileTypes).map(type => ({
        type,
        extensions: fileTypes[type].extensions,
        maxSize: fileTypes[type].maxSize,
        maxSizeHuman: formatFileSize(fileTypes[type].maxSize),
        generateThumbnail: fileTypes[type].generateThumbnail
    }));

    res.json({
        success: true,
        supportedTypes,
        maxFileSize: config.upload.maxFileSize,
        maxFileSizeHuman: formatFileSize(config.upload.maxFileSize)
    });
});

module.exports = router;