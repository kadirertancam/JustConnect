const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');
const config = require('../config/config');
const { logger } = require('./logger');

// Email templates directory
const templatesDir = path.join(__dirname, '../templates/email');

// Create transporter based on configuration
const createTransporter = () => {
    const transporterConfig = {
        host: config.email.smtp.host,
        port: config.email.smtp.port,
        secure: config.email.smtp.secure || false,
        auth: {
            user: config.email.smtp.auth.user,
            pass: config.email.smtp.auth.pass
        }
    };

    // Add additional options for different providers
    if (config.email.smtp.host.includes('gmail')) {
        transporterConfig.service = 'gmail';
    }

    return nodemailer.createTransporter(transporterConfig);
};

// Verify email configuration
const verifyEmailConfig = async () => {
    try {
        const transporter = createTransporter();
        await transporter.verify();
        logger.info('Email configuration verified successfully');
        return true;
    } catch (error) {
        logger.error('Email configuration verification failed', { error: error.message });
        return false;
    }
};

// Load email template
const loadTemplate = (templateName, variables = {}) => {
    try {
        const templatePath = path.join(templatesDir, `${templateName}.html`);
        
        if (!fs.existsSync(templatePath)) {
            // Return default template if specific template doesn't exist
            return generateDefaultTemplate(templateName, variables);
        }

        let template = fs.readFileSync(templatePath, 'utf8');

        // Replace variables in template
        Object.keys(variables).forEach(key => {
            const regex = new RegExp(`{{${key}}}`, 'g');
            template = template.replace(regex, variables[key]);
        });

        return template;
    } catch (error) {
        logger.error(`Error loading email template: ${templateName}`, { error: error.message });
        return generateDefaultTemplate(templateName, variables);
    }
};

// Generate default email template
const generateDefaultTemplate = (templateName, variables = {}) => {
    const baseTemplate = `
    <!DOCTYPE html>
    <html lang="tr">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>{{title}}</title>
        <style>
            body {
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                line-height: 1.6;
                color: #333;
                background-color: #f4f4f4;
                margin: 0;
                padding: 0;
            }
            .container {
                max-width: 600px;
                margin: 0 auto;
                background-color: #ffffff;
                padding: 20px;
                border-radius: 10px;
                box-shadow: 0 0 10px rgba(0,0,0,0.1);
                margin-top: 20px;
            }
            .header {
                text-align: center;
                padding: 20px 0;
                border-bottom: 2px solid #3498db;
                margin-bottom: 20px;
            }
            .logo {
                font-size: 28px;
                font-weight: bold;
                color: #3498db;
            }
            .content {
                padding: 20px 0;
            }
            .button {
                display: inline-block;
                padding: 12px 24px;
                background-color: #3498db;
                color: #ffffff;
                text-decoration: none;
                border-radius: 5px;
                font-weight: bold;
                margin: 20px 0;
            }
            .footer {
                text-align: center;
                padding: 20px 0;
                border-top: 1px solid #eee;
                margin-top: 20px;
                font-size: 12px;
                color: #666;
            }
            .highlight {
                background-color: #f39c12;
                color: white;
                padding: 2px 6px;
                border-radius: 3px;
                font-weight: bold;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <div class="logo">JustConnect V2</div>
                <p>Profesyonel Mesajlaşma Platformu</p>
            </div>
            <div class="content">
                {{content}}
            </div>
            <div class="footer">
                <p>Bu email JustConnect V2 tarafından gönderilmiştir.</p>
                <p>Eğer bu emaili beklemiyordunuz, lütfen dikkate almayın.</p>
            </div>
        </div>
    </body>
    </html>
    `;

    const templates = {
        welcome: {
            title: 'Hoş Geldiniz - JustConnect V2',
            content: `
                <h2>Hoş Geldiniz, {{name}}!</h2>
                <p>JustConnect V2'ye başarıyla kayıt oldunuz. Hesabınızı aktifleştirmek için aşağıdaki bağlantıya tıklayın:</p>
                <p style="text-align: center;">
                    <a href="{{verificationUrl}}" class="button">Hesabımı Aktifleştir</a>
                </p>
                <p>Bu bağlantı 24 saat geçerlidir.</p>
                <p>Eğer buton çalışmıyorsa, aşağıdaki bağlantıyı kopyalayıp tarayıcınızza yapıştırabilirsiniz:</p>
                <p style="word-break: break-all;">{{verificationUrl}}</p>
            `
        },
        resetPassword: {
            title: 'Şifre Sıfırlama - JustConnect V2',
            content: `
                <h2>Şifre Sıfırlama</h2>
                <p>Merhaba {{name}},</p>
                <p>Şifrenizi sıfırlamak için bir talepte bulundunuz. Aşağıdaki bağlantıya tıklayarak yeni şifrenizi belirleyebilirsiniz:</p>
                <p style="text-align: center;">
                    <a href="{{resetUrl}}" class="button">Şifremi Sıfırla</a>
                </p>
                <p>Bu bağlantı 1 saat geçerlidir.</p>
                <p>Eğer bu talebi siz yapmadıysanız, bu emaili dikkate almayın.</p>
                <p>Güvenliğiniz için:</p>
                <ul>
                    <li>Bu bağlantıyı kimseyle paylaşmayın</li>
                    <li>Güçlü bir şifre seçin</li>
                    <li>Şifrenizi düzenli olarak değiştirin</li>
                </ul>
            `
        },
        verification: {
            title: 'Email Doğrulama - JustConnect V2',
            content: `
                <h2>Email Doğrulama</h2>
                <p>Merhaba {{name}},</p>
                <p>Email adresinizi doğrulamak için aşağıdaki kodu kullanın:</p>
                <p style="text-align: center; font-size: 24px;">
                    <span class="highlight">{{code}}</span>
                </p>
                <p>Bu kod 15 dakika geçerlidir.</p>
                <p>Alternatif olarak, aşağıdaki bağlantıya tıklayabilirsiniz:</p>
                <p style="text-align: center;">
                    <a href="{{verificationUrl}}" class="button">Email'imi Doğrula</a>
                </p>
            `
        },
        notification: {
            title: 'Bildirim - JustConnect V2',
            content: `
                <h2>{{subject}}</h2>
                <p>Merhaba {{name}},</p>
                <div>{{message}}</div>
                <p style="text-align: center;">
                    <a href="{{actionUrl}}" class="button">{{actionText}}</a>
                </p>
            `
        },
        invite: {
            title: 'Davetiye - JustConnect V2',
            content: `
                <h2>JustConnect V2'ye Davetlisiniz!</h2>
                <p>Merhaba,</p>
                <p><strong>{{inviterName}}</strong> sizi JustConnect V2'de <strong>{{chatName}}</strong> sohbetine davet etti.</p>
                <p style="text-align: center;">
                    <a href="{{inviteUrl}}" class="button">Daveti Kabul Et</a>
                </p>
                <p>Bu davet kodu: <span class="highlight">{{inviteCode}}</span></p>
                <p>JustConnect V2 ile güvenli ve hızlı mesajlaşmanın keyfini çıkarın!</p>
            `
        }
    };

    const template = templates[templateName] || templates.notification;
    let html = baseTemplate.replace('{{title}}', template.title);
    html = html.replace('{{content}}', template.content);

    // Replace variables
    Object.keys(variables).forEach(key => {
        const regex = new RegExp(`{{${key}}}`, 'g');
        html = html.replace(regex, variables[key] || '');
    });

    return html;
};

// Send email function
const sendEmail = async (options) => {
    try {
        const transporter = createTransporter();
        
        const mailOptions = {
            from: options.from || config.email.from || 'JustConnect V2 <noreply@justconnect.com>',
            to: options.to,
            subject: options.subject,
            text: options.text,
            html: options.html,
            attachments: options.attachments || []
        };

        const result = await transporter.sendMail(mailOptions);
        
        logger.info('Email sent successfully', {
            to: options.to,
            subject: options.subject,
            messageId: result.messageId
        });

        return {
            success: true,
            messageId: result.messageId,
            response: result.response
        };

    } catch (error) {
        logger.error('Email sending failed', {
            to: options.to,
            subject: options.subject,
            error: error.message
        });

        return {
            success: false,
            error: error.message
        };
    }
};

// Send templated email
const sendTemplatedEmail = async (templateName, to, variables = {}, options = {}) => {
    try {
        const html = loadTemplate(templateName, variables);
        
        const emailOptions = {
            to: to,
            subject: options.subject || `JustConnect V2 - ${templateName}`,
            html: html,
            text: options.text,
            from: options.from,
            attachments: options.attachments
        };

        return await sendEmail(emailOptions);

    } catch (error) {
        logger.error(`Failed to send templated email: ${templateName}`, {
            to: to,
            error: error.message
        });

        return {
            success: false,
            error: error.message
        };
    }
};

// Specific email functions
const emailService = {
    // Welcome email
    sendWelcomeEmail: async (user, verificationUrl) => {
        return await sendTemplatedEmail('welcome', user.email, {
            name: user.firstName || user.username,
            verificationUrl: verificationUrl
        }, {
            subject: 'JustConnect V2\'ye Hoş Geldiniz!'
        });
    },

    // Password reset email
    sendPasswordResetEmail: async (user, resetUrl) => {
        return await sendTemplatedEmail('resetPassword', user.email, {
            name: user.firstName || user.username,
            resetUrl: resetUrl
        }, {
            subject: 'Şifre Sıfırlama Talebi'
        });
    },

    // Email verification
    sendVerificationEmail: async (user, verificationUrl, code) => {
        return await sendTemplatedEmail('verification', user.email, {
            name: user.firstName || user.username,
            verificationUrl: verificationUrl,
            code: code
        }, {
            subject: 'Email Doğrulama Kodu'
        });
    },

    // General notification
    sendNotificationEmail: async (user, subject, message, actionUrl = null, actionText = 'Görüntüle') => {
        return await sendTemplatedEmail('notification', user.email, {
            name: user.firstName || user.username,
            subject: subject,
            message: message,
            actionUrl: actionUrl || '',
            actionText: actionText
        }, {
            subject: subject
        });
    },

    // Chat invitation
    sendChatInviteEmail: async (inviteeEmail, inviterName, chatName, inviteUrl, inviteCode) => {
        return await sendTemplatedEmail('invite', inviteeEmail, {
            inviterName: inviterName,
            chatName: chatName,
            inviteUrl: inviteUrl,
            inviteCode: inviteCode
        }, {
            subject: `${inviterName} sizi ${chatName} sohbetine davet etti`
        });
    },

    // Bulk email sending
    sendBulkEmail: async (recipients, subject, template, variables = {}) => {
        const results = [];
        
        for (const recipient of recipients) {
            try {
                const personalizedVariables = {
                    ...variables,
                    name: recipient.name || recipient.email,
                    email: recipient.email
                };

                const result = await sendTemplatedEmail(template, recipient.email, personalizedVariables, {
                    subject: subject
                });

                results.push({
                    email: recipient.email,
                    success: result.success,
                    messageId: result.messageId,
                    error: result.error
                });

                // Small delay to avoid overwhelming the email server
                await new Promise(resolve => setTimeout(resolve, 100));

            } catch (error) {
                results.push({
                    email: recipient.email,
                    success: false,
                    error: error.message
                });
            }
        }

        const successCount = results.filter(r => r.success).length;
        logger.info('Bulk email sending completed', {
            total: recipients.length,
            successful: successCount,
            failed: recipients.length - successCount
        });

        return {
            total: recipients.length,
            successful: successCount,
            failed: recipients.length - successCount,
            results: results
        };
    }
};

// Email queue for handling high volume emails
class EmailQueue {
    constructor() {
        this.queue = [];
        this.processing = false;
        this.maxConcurrent = 5;
        this.retryAttempts = 3;
    }

    async add(emailData) {
        this.queue.push({
            ...emailData,
            attempts: 0,
            addedAt: new Date()
        });

        if (!this.processing) {
            this.process();
        }
    }

    async process() {
        if (this.processing || this.queue.length === 0) {
            return;
        }

        this.processing = true;

        while (this.queue.length > 0) {
            const batch = this.queue.splice(0, this.maxConcurrent);
            
            const promises = batch.map(async (emailData) => {
                try {
                    const result = await sendEmail(emailData);
                    if (!result.success && emailData.attempts < this.retryAttempts) {
                        emailData.attempts++;
                        this.queue.push(emailData);
                    }
                    return result;
                } catch (error) {
                    if (emailData.attempts < this.retryAttempts) {
                        emailData.attempts++;
                        this.queue.push(emailData);
                    }
                    return { success: false, error: error.message };
                }
            });

            await Promise.all(promises);
            
            // Small delay between batches
            if (this.queue.length > 0) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }

        this.processing = false;
    }

    getQueueStatus() {
        return {
            pending: this.queue.length,
            processing: this.processing
        };
    }
}

// Create email queue instance
const emailQueue = new EmailQueue();

module.exports = {
    // Core functions
    sendEmail,
    sendTemplatedEmail,
    loadTemplate,
    verifyEmailConfig,
    
    // Service functions
    emailService,
    
    // Queue
    emailQueue,
    
    // Utilities
    createTransporter,
    generateDefaultTemplate
};