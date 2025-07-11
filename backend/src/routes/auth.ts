import express, { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken'; // Added explicit import
import { body, validationResult } from 'express-validator';
import { prisma } from '../config/database';
import { generateTokens } from '../utils/auth';

const router = express.Router();

// Register - Role field'ı olmadan
router.post('/register', [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Geçerli bir e-posta adresi girin'),
  body('username')
    .isLength({ min: 3, max: 20 })
    .trim()
    .withMessage('Kullanıcı adı 3-20 karakter arasında olmalıdır'),
  body('firstName')
    .isLength({ min: 1, max: 50 })
    .trim()
    .withMessage('Ad alanı 1-50 karakter arasında olmalıdır'),
  body('lastName')
    .isLength({ min: 1, max: 50 })
    .trim()
    .withMessage('Soyad alanı 1-50 karakter arasında olmalıdır'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Şifre en az 6 karakter olmalıdır')
], async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false,
        message: 'Validation hatası',
        errors: errors.array()
      });
    }

    const { email, username, firstName, lastName, password } = req.body;

    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [{ email }, { username }]
      }
    });

    if (existingUser) {
      return res.status(400).json({ 
        success: false,
        error: existingUser.email === email ? 'Bu e-posta zaten kullanılıyor' : 'Bu kullanıcı adı zaten alınmış'
      });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        email,
        username,
        firstName,
        lastName,
        password: hashedPassword
      },
      select: {
        id: true,
        email: true,
        username: true,
        firstName: true,
        lastName: true,
        avatar: true,
        isOnline: true,
        createdAt: true
      }
    });

    // DÜZELTME: generateTokens'e tüm gerekli bilgileri gönderiyoruz
    const { accessToken, refreshToken } = generateTokens(user.id, user.email, user.username);

    res.status(201).json({
      success: true,
      message: 'Kullanıcı başarıyla oluşturuldu',
      user,
      accessToken,
      refreshToken
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Sunucu hatası' 
    });
  }
});

// Login - Role field'ı olmadan
router.post('/login', [
  body('email').isEmail().normalizeEmail().withMessage('Geçerli bir e-posta adresi girin'),
  body('password').exists().withMessage('Şifre gerekli')
], async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false,
        message: 'Validation hatası',
        errors: errors.array() 
      });
    }

    const { email, password } = req.body;

    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        username: true,
        firstName: true,
        lastName: true,
        avatar: true,
        password: true,
        banned: true,
        banReason: true,
        isOnline: true,
        lastSeen: true
      }
    });

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(400).json({ 
        success: false,
        error: 'Geçersiz e-posta veya şifre' 
      });
    }

    // Check if user is banned
    if (user.banned) {
      return res.status(403).json({ 
        success: false,
        error: user.banReason || 'Hesabınız askıya alınmıştır' 
      });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { isOnline: true, lastSeen: new Date() }
    });

    // DÜZELTME: generateTokens'e tüm gerekli bilgileri gönderiyoruz
    const { accessToken, refreshToken } = generateTokens(user.id, user.email, user.username);

    const { password: _, ...userWithoutPassword } = user;

    res.json({
      success: true,
      message: 'Giriş başarılı',
      user: userWithoutPassword,
      accessToken,
      refreshToken
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Sunucu hatası' 
    });
  }
});

// Refresh token endpoint
router.post('/refresh', async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(401).json({
        success: false,
        error: 'Refresh token gerekli'
      });
    }

    const jwtSecret = process.env.JWT_REFRESH_SECRET || 'fallback-refresh-secret';
    const decoded = jwt.verify(refreshToken, jwtSecret) as {
      id: string;
      email: string;
      username: string;
    };

    // Verify user still exists
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: {
        id: true,
        email: true,
        username: true,
        banned: true
      }
    });

    if (!user || user.banned) {
      return res.status(401).json({
        success: false,
        error: 'Geçersiz refresh token'
      });
    }

    // Generate new tokens
    const { accessToken, refreshToken: newRefreshToken } = generateTokens(
      user.id, 
      user.email, 
      user.username
    );

    res.json({
      success: true,
      accessToken,
      refreshToken: newRefreshToken
    });
  } catch (error) {
    console.error('Refresh token error:', error);
    res.status(401).json({
      success: false,
      error: 'Geçersiz refresh token'
    });
  }
});

// Logout
router.post('/logout', async (req: Request, res: Response) => {
  try {
    res.json({
      success: true,
      message: 'Çıkış başarılı'
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Sunucu hatası' 
    });
  }
});

export default router;