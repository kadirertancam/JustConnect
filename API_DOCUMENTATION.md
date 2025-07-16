# 📚 JustConnect V2 API Documentation

## 🚀 Genel Bakış

JustConnect V2, modern bir mesajlaşma platformu için RESTful API ve WebSocket tabanlı gerçek zamanlı iletişim sağlar.

**Base URL:** `http://localhost:3000/api`  
**WebSocket URL:** `http://localhost:3000`  
**API Version:** 2.0.0

## 🔐 Kimlik Doğrulama

API, JWT (JSON Web Token) tabanlı kimlik doğrulama kullanır.

### Token Kullanımı
```http
Authorization: Bearer <your_jwt_token>
```

### Token Alma
POST `/api/auth/login` endpoint'ini kullanarak token alabilirsiniz.

---

## 📋 Endpoint'ler

### 🔑 Authentication Endpoints

#### POST /api/auth/register
Yeni kullanıcı kaydı oluşturur.

**Request Body:**
```json
{
  "username": "string (3-30 karakter)",
  "email": "string (geçerli email)",
  "password": "string (min 6 karakter)",
  "firstName": "string (opsiyonel)",
  "lastName": "string (opsiyonel)",
  "phoneNumber": "string (opsiyonel)"
}
```

**Response (201):**
```json
{
  "success": true,
  "message": "Kullanıcı başarıyla oluşturuldu",
  "user": {
    "id": "string",
    "username": "string",
    "email": "string",
    "firstName": "string",
    "lastName": "string",
    "avatar": "string",
    "status": "online",
    "tokens": {
      "accessToken": "string",
      "refreshToken": "string",
      "expiresIn": "24h"
    }
  }
}
```

#### POST /api/auth/login
Kullanıcı girişi yapar.

**Request Body:**
```json
{
  "username": "string", // username veya email
  "password": "string",
  "rememberMe": "boolean (opsiyonel)"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Giriş başarılı",
  "user": {
    "id": "string",
    "username": "string",
    "email": "string",
    "firstName": "string",
    "lastName": "string",
    "avatar": "string",
    "status": "online",
    "tokens": {
      "accessToken": "string",
      "refreshToken": "string",
      "expiresIn": "24h"
    }
  }
}
```

#### POST /api/auth/logout
Kullanıcı çıkışı yapar.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "refreshToken": "string (opsiyonel)"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Çıkış başarılı"
}
```

#### GET /api/auth/me
Mevcut kullanıcı bilgilerini getirir.

**Headers:** `Authorization: Bearer <token>`

**Response (200):**
```json
{
  "success": true,
  "user": {
    "id": "string",
    "username": "string",
    "email": "string",
    "firstName": "string",
    "lastName": "string",
    "avatar": "string",
    "status": "string",
    "bio": "string",
    "phoneNumber": "string",
    "isVerified": "boolean",
    "role": "string",
    "preferences": {
      "language": "string",
      "theme": "string",
      "notifications": {
        "email": "boolean",
        "push": "boolean",
        "sound": "boolean"
      }
    }
  }
}
```

#### PUT /api/auth/password
Şifre değiştirir.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "currentPassword": "string",
  "newPassword": "string",
  "confirmPassword": "string"
}
```

---

### 👤 User Endpoints

#### GET /api/users/me
Kendi profil bilgilerini getirir.

**Headers:** `Authorization: Bearer <token>`

#### PUT /api/users/me
Profil bilgilerini günceller.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "firstName": "string (opsiyonel)",
  "lastName": "string (opsiyonel)",
  "bio": "string (opsiyonel)",
  "phoneNumber": "string (opsiyonel)",
  "status": "online|away|busy|offline (opsiyonel)",
  "preferences": {
    "language": "string (opsiyonel)",
    "theme": "string (opsiyonel)",
    "notifications": {
      "email": "boolean (opsiyonel)",
      "push": "boolean (opsiyonel)",
      "sound": "boolean (opsiyonel)"
    }
  }
}
```

#### GET /api/users/:userId
Kullanıcı profilini getirir.

**Headers:** `Authorization: Bearer <token>`

**Parameters:**
- `userId`: User ID

#### GET /api/users/search
Kullanıcı arama yapar.

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
- `q`: Arama terimi (required, 2-100 karakter)
- `limit`: Sonuç limiti (opsiyonel, default: 10, max: 50)

**Response (200):**
```json
{
  "success": true,
  "query": "string",
  "results": [
    {
      "id": "string",
      "username": "string",
      "firstName": "string",
      "lastName": "string",
      "avatar": "string",
      "status": "string",
      "matchScore": "number"
    }
  ],
  "count": "number"
}
```

#### POST /api/users/:userId/contact
Kullanıcıyı kişi listesine ekler.

**Headers:** `Authorization: Bearer <token>`

**Parameters:**
- `userId`: Eklenecek kullanıcının ID'si

**Request Body:**
```json
{
  "nickname": "string (opsiyonel)"
}
```

#### DELETE /api/users/:userId/contact
Kullanıcıyı kişi listesinden çıkarır.

#### POST /api/users/:userId/block
Kullanıcıyı engeller.

#### DELETE /api/users/:userId/block
Kullanıcının engelini kaldırır.

#### GET /api/users/contacts
Kişi listesini getirir.

**Query Parameters:**
- `page`: Sayfa numarası (default: 1)
- `limit`: Sayfa başına sonuç (default: 50)

#### GET /api/users/online
Çevrimiçi kullanıcıları getirir.

---

### 💬 Chat Endpoints

#### GET /api/chats
Kullanıcının sohbetlerini getirir.

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
- `page`: Sayfa numarası (default: 1)
- `limit`: Sayfa başına sonuç (default: 20)
- `type`: Sohbet türü (private|group|channel|broadcast)

**Response (200):**
```json
{
  "success": true,
  "chats": [
    {
      "id": "number",
      "name": "string",
      "type": "string",
      "participants": [
        {
          "user": {
            "id": "string",
            "username": "string",
            "firstName": "string",
            "lastName": "string",
            "avatar": "string",
            "status": "string"
          },
          "role": "string",
          "joinedAt": "date"
        }
      ],
      "lastMessage": {
        "id": "number",
        "text": "string",
        "time": "date",
        "sender": "string"
      },
      "lastActivity": "date",
      "avatar": "string",
      "unreadCount": "number",
      "createdAt": "date"
    }
  ],
  "pagination": {
    "page": "number",
    "limit": "number",
    "total": "number",
    "pages": "number"
  }
}
```

#### GET /api/chats/:chatId
Sohbet detaylarını getirir.

**Headers:** `Authorization: Bearer <token>`

**Parameters:**
- `chatId`: Sohbet ID

#### GET /api/chats/:chatId/messages
Sohbet mesajlarını getirir.

**Headers:** `Authorization: Bearer <token>`

**Parameters:**
- `chatId`: Sohbet ID

**Query Parameters:**
- `page`: Sayfa numarası (default: 1)
- `limit`: Sayfa başına sonuç (default: 50)
- `before`: Bu tarihten önceki mesajlar
- `search`: Mesajlarda arama

**Response (200):**
```json
{
  "success": true,
  "messages": [
    {
      "id": "number",
      "chat": "number",
      "sender": {
        "id": "string",
        "username": "string",
        "firstName": "string",
        "lastName": "string",
        "avatar": "string"
      },
      "content": {
        "text": "string",
        "type": "text|image|video|audio|file|location|contact"
      },
      "replyTo": {
        "id": "number",
        "text": "string",
        "sender": "string"
      },
      "reactions": [
        {
          "user": "string",
          "emoji": "string",
          "createdAt": "date"
        }
      ],
      "status": "sending|sent|delivered|read",
      "isEdited": "boolean",
      "isPinned": "boolean",
      "createdAt": "date",
      "displayText": "string"
    }
  ],
  "pagination": {
    "page": "number",
    "limit": "number",
    "total": "number",
    "hasMore": "boolean"
  }
}
```

#### POST /api/chats/:chatId/messages
Mesaj gönderir.

**Headers:** `Authorization: Bearer <token>`

**Parameters:**
- `chatId`: Sohbet ID

**Request Body:**
```json
{
  "content": {
    "text": "string",
    "type": "text|image|video|audio|file|location|contact"
  },
  "replyTo": "number (opsiyonel)"
}
```

#### PUT /api/chats/:chatId/messages/:messageId
Mesaj düzenler.

**Headers:** `Authorization: Bearer <token>`

**Parameters:**
- `chatId`: Sohbet ID
- `messageId`: Mesaj ID

**Request Body:**
```json
{
  "content": "string"
}
```

#### DELETE /api/chats/:chatId/messages/:messageId
Mesaj siler.

#### POST /api/chats/:chatId/messages/:messageId/reactions
Mesaja reaction ekler.

**Request Body:**
```json
{
  "emoji": "string"
}
```

#### POST /api/chats/:chatId/read
Sohbeti okundu olarak işaretler.

---

### 📎 Upload Endpoints

#### POST /api/upload/single
Tek dosya yükler.

**Headers:** `Authorization: Bearer <token>`

**Form Data:**
- `file`: Dosya (max 100MB)
- `type`: Dosya türü (opsiyonel: image|video|audio|document)

**Response (201):**
```json
{
  "success": true,
  "message": "Dosya başarıyla yüklendi",
  "file": {
    "id": "string",
    "filename": "string",
    "originalname": "string",
    "mimetype": "string",
    "type": "string",
    "size": "number",
    "url": "string",
    "thumbnail": "string (opsiyonel)",
    "uploadedBy": "string",
    "uploadedAt": "date",
    "metadata": {
      "width": "number (resimler için)",
      "height": "number (resimler için)"
    }
  }
}
```

#### POST /api/upload/multiple
Çoklu dosya yükler.

**Headers:** `Authorization: Bearer <token>`

**Form Data:**
- `files`: Dosyalar (max 5 dosya)

#### POST /api/upload/avatar
Avatar yükler.

**Headers:** `Authorization: Bearer <token>`

**Form Data:**
- `avatar`: Avatar dosyası (max 5MB, sadece resim)

#### GET /api/upload/info/:filename
Dosya bilgilerini getirir.

#### DELETE /api/upload/:filename
Dosya siler.

#### GET /api/upload/types
Desteklenen dosya türlerini getirir.

---

## 🔌 WebSocket Events

### Client → Server Events

#### `user_connected`
Kullanıcı bağlandığında gönderilir.

**Data:**
```json
{
  "userId": "string",
  "username": "string",
  "avatar": "string"
}
```

#### `join_chat`
Sohbete katılmak için gönderilir.

**Data:**
```json
{
  "chatId": "number"
}
```

#### `leave_chat`
Sohbetten ayrılmak için gönderilir.

**Data:**
```json
{
  "chatId": "number"
}
```

#### `send_message`
Mesaj göndermek için gönderilir.

**Data:**
```json
{
  "chatId": "number",
  "content": {
    "text": "string",
    "type": "text"
  },
  "replyTo": "number (opsiyonel)",
  "tempId": "string (opsiyonel)"
}
```

#### `message_read`
Mesajı okundu olarak işaretlemek için gönderilir.

**Data:**
```json
{
  "chatId": "number",
  "messageId": "number"
}
```

#### `typing_start`
Yazmaya başladığında gönderilir.

**Data:**
```json
{
  "chatId": "number"
}
```

#### `typing_stop`
Yazmayı bıraktığında gönderilir.

**Data:**
```json
{
  "chatId": "number"
}
```

#### `user_status`
Kullanıcı durumunu değiştirmek için gönderilir.

**Data:**
```json
{
  "status": "online|away|busy|offline"
}
```

#### `user_activity`
Kullanıcı aktivitesini bildirmek için gönderilir.

#### `ping`
Bağlantı test etmek için gönderilir.

### Server → Client Events

#### `chat_joined`
Sohbete katılım onayı.

**Data:**
```json
{
  "chatId": "number"
}
```

#### `new_message`
Yeni mesaj bildirimi.

**Data:**
```json
{
  "id": "string",
  "chatId": "number",
  "senderId": "string",
  "content": {
    "text": "string",
    "type": "text"
  },
  "timestamp": "date",
  "status": "sent"
}
```

#### `message_sent`
Mesaj gönderim onayı.

**Data:**
```json
{
  "tempId": "string",
  "messageId": "string",
  "timestamp": "date"
}
```

#### `message_read_by`
Mesaj okundu bildirimi.

**Data:**
```json
{
  "messageId": "string",
  "userId": "string",
  "readAt": "date"
}
```

#### `user_typing`
Kullanıcı yazıyor bildirimi.

**Data:**
```json
{
  "userId": "string",
  "chatId": "number",
  "timestamp": "date"
}
```

#### `user_stopped_typing`
Kullanıcı yazmayı bıraktı bildirimi.

**Data:**
```json
{
  "userId": "string",
  "chatId": "number",
  "timestamp": "date"
}
```

#### `user_status_changed`
Kullanıcı durumu değişti bildirimi.

**Data:**
```json
{
  "userId": "string",
  "status": "string",
  "lastSeen": "date"
}
```

#### `online_users_count`
Çevrimiçi kullanıcı sayısı.

**Data:**
```json
{
  "count": "number"
}
```

#### `error`
Hata bildirimi.

**Data:**
```json
{
  "type": "string",
  "message": "string"
}
```

#### `pong`
Ping yanıtı.

**Data:**
```json
{
  "timestamp": "date"
}
```

---

## 📊 Status Codes

### Success Codes
- `200` - OK
- `201` - Created
- `204` - No Content

### Client Error Codes
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `409` - Conflict
- `422` - Unprocessable Entity
- `429` - Too Many Requests

### Server Error Codes
- `500` - Internal Server Error
- `502` - Bad Gateway
- `503` - Service Unavailable

---

## 🚦 Rate Limiting

### API Rate Limits
- **Genel**: 100 istek/dakika
- **Auth**: 5 giriş denemesi/15 dakika
- **Upload**: 10 dosya/dakika
- **Mesaj**: 30 mesaj/dakika
- **Arama**: 20 arama/dakika

### WebSocket Rate Limits
- **Mesaj Gönderme**: 30 mesaj/dakika
- **Yazma Göstergesi**: 60 event/dakika
- **Sohbet Katılma**: 20 katılma/dakika
- **Durum Değişikliği**: 10 değişiklik/dakika

---

## 🔧 Error Format

Tüm hatalar aşağıdaki format ile döner:

```json
{
  "success": false,
  "error": {
    "type": "ERROR_TYPE",
    "message": "Hata mesajı",
    "timestamp": "2024-07-16T12:00:00.000Z",
    "details": {
      "field": "value"
    }
  }
}
```

### Yaygın Error Types
- `VALIDATION_ERROR` - Veri doğrulama hatası
- `UNAUTHORIZED` - Yetkisiz erişim
- `NOT_FOUND` - Kaynak bulunamadı
- `RATE_LIMIT_EXCEEDED` - Rate limit aşıldı
- `INTERNAL_SERVER_ERROR` - Sunucu hatası

---

## 🛠️ Development

### Test Environment
- **Base URL**: `http://localhost:3000/api`
- **WebSocket**: `ws://localhost:3000`

### Test Users
- **Username**: `kadir` **Password**: `123456` (Admin)
- **Username**: `ahmet` **Password**: `123456` (User)
- **Username**: `fatma` **Password**: `123456` (User)

### Health Check
`GET /health` endpoint'i ile sistem durumunu kontrol edebilirsiniz.

---

## 📞 Destek

Herhangi bir sorun yaşarsanız:
- GitHub Issues: [JustConnect V2 Issues](https://github.com/kadirertan/justconnect-v2/issues)
- Email: kadir@justconnect.com

---

*Son Güncelleme: 16 Temmuz 2024*