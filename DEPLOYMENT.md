# 🚀 JustConnect V2 - Deployment Rehberi

## 📋 İçindekiler
1. [Production Hazırlık](#production-hazırlık)
2. [VPS/Cloud Server Deployment](#vpscloud-server-deployment)
3. [Heroku Deployment](#heroku-deployment)
4. [Docker Deployment](#docker-deployment)
5. [SSL Sertifikası](#ssl-sertifikası)
6. [Performans Optimizasyonu](#performans-optimizasyonu)
7. [İzleme ve Logging](#izleme-ve-logging)

## 🔧 Production Hazırlık

### 1. Environment Konfigürasyonu
Production için `.env` dosyasını güncelleyin:

```env
NODE_ENV=production
PORT=80
JWT_SECRET=super_secure_random_string_here
MONGODB_URI=mongodb://username:password@localhost:27017/justconnect_v2
REDIS_HOST=localhost
REDIS_PORT=6379
```

### 2. Güvenlik Ayarları
- JWT secret'ı güçlü bir değer ile değiştirin
- Database şifrelerini güçlendirin
- CORS ayarlarını production domain'e göre düzenleyin
- Rate limiting değerlerini ayarlayın

### 3. Performans Ayarları
- File upload limitlerini ihtiyaca göre ayarlayın
- Cache TTL değerlerini optimize edin
- Database connection pool boyutunu ayarlayın

## 🖥️ VPS/Cloud Server Deployment

### Sistem Gereksinimleri
- **OS**: Ubuntu 20.04+ / CentOS 8+ / Amazon Linux 2
- **RAM**: Minimum 2GB (4GB önerilen)
- **Disk**: Minimum 20GB SSD
- **CPU**: 2 Core önerilen

### 1. Sunucu Hazırlığı

```bash
# Sistem güncellemesi
sudo apt update && sudo apt upgrade -y

# Node.js yükleme (LTS sürüm)
curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
sudo apt-get install -y nodejs

# PM2 yükleme (Process Manager)
sudo npm install -g pm2

# Nginx yükleme (Reverse Proxy)
sudo apt install nginx -y

# MongoDB yükleme (Opsiyonel)
wget -qO - https://www.mongodb.org/static/pgp/server-6.0.asc | sudo apt-key add -
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu focal/mongodb-org/6.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-6.0.list
sudo apt-get update
sudo apt-get install -y mongodb-org

# Redis yükleme (Opsiyonel)
sudo apt install redis-server -y
```

### 2. Uygulama Deploy

```bash
# Projeyi klonla
git clone https://github.com/kadirertan/justconnect-v2.git
cd justconnect-v2

# Bağımlılıkları yükle
npm install --production

# .env dosyasını oluştur
cp .env.example .env
nano .env  # Production değerlerini girin

# PM2 ile başlat
pm2 start server/server.js --name "justconnect-v2"
pm2 startup  # Otomatik başlatma için
pm2 save
```

### 3. Nginx Konfigürasyonu

`/etc/nginx/sites-available/justconnect` dosyası oluşturun:

```nginx
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # WebSocket desteği
    location /socket.io/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Statik dosyalar
    location /uploads/ {
        alias /path/to/justconnect-v2/uploads/;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

Nginx'i aktifleştirin:
```bash
sudo ln -s /etc/nginx/sites-available/justconnect /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

## ☁️ Heroku Deployment

### 1. Heroku CLI Kurulumu
```bash
# Heroku CLI yükle
curl https://cli-assets.heroku.com/install.sh | sh

# Giriş yap
heroku login
```

### 2. Procfile Oluştur
Proje kökünde `Procfile` dosyası oluşturun:
```
web: node server/server.js
```

### 3. Deploy İşlemi
```bash
# Heroku uygulaması oluştur
heroku create justconnect-v2

# Environment değişkenlerini ayarla
heroku config:set NODE_ENV=production
heroku config:set JWT_SECRET=your_super_secret_key
heroku config:set MONGODB_URI=your_mongodb_uri

# Deploy et
git add .
git commit -m "Production deployment"
git push heroku main

# Uygulamayı aç
heroku open
```

### 4. Add-ons (Opsiyonel)
```bash
# MongoDB Atlas
heroku addons:create mongolab:sandbox

# Redis
heroku addons:create heroku-redis:hobby-dev

# Papertrail (Logging)
heroku addons:create papertrail:choklad
```

## 🐳 Docker Deployment

### 1. Dockerfile Oluştur

```dockerfile
FROM node:18-alpine

WORKDIR /app

# Package files kopyala
COPY package*.json ./
RUN npm ci --only=production

# Uygulama kodunu kopyala
COPY . .

# Kullanıcı oluştur
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

# Dosya sahipliklerini ayarla
RUN chown -R nodejs:nodejs /app
USER nodejs

EXPOSE 3000

CMD ["node", "server/server.js"]
```

### 2. docker-compose.yml Oluştur

```yaml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - JWT_SECRET=your_secret_here
      - MONGODB_URI=mongodb://mongo:27017/justconnect_v2
      - REDIS_HOST=redis
    depends_on:
      - mongo
      - redis
    volumes:
      - ./uploads:/app/uploads
      - ./logs:/app/logs

  mongo:
    image: mongo:6.0
    environment:
      - MONGO_INITDB_ROOT_USERNAME=admin
      - MONGO_INITDB_ROOT_PASSWORD=password
    volumes:
      - mongo_data:/data/db
    ports:
      - "27017:27017"

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/nginx/ssl
    depends_on:
      - app

volumes:
  mongo_data:
  redis_data:
```

### 3. Docker ile Çalıştır

```bash
# Build ve çalıştır
docker-compose up -d

# Logları görüntüle
docker-compose logs -f

# Durdur
docker-compose down
```

## 🔒 SSL Sertifikası

### Let's Encrypt ile Ücretsiz SSL

```bash
# Certbot yükle
sudo apt install certbot python3-certbot-nginx -y

# SSL sertifikası al
sudo certbot --nginx -d your-domain.com -d www.your-domain.com

# Otomatik yenileme ayarla
sudo crontab -e
# Şu satırı ekleyin:
0 12 * * * /usr/bin/certbot renew --quiet
```

## ⚡ Performans Optimizasyonu

### 1. PM2 Cluster Mode
```bash
# Cluster mode ile başlat (CPU core sayısı kadar process)
pm2 start server/server.js -i max --name "justconnect-v2-cluster"
```

### 2. Nginx Gzip Compression
```nginx
# /etc/nginx/nginx.conf içine ekleyin
gzip on;
gzip_vary on;
gzip_min_length 1024;
gzip_types text/plain text/css text/xml text/javascript application/javascript application/xml+rss application/json;
```

### 3. Node.js Optimizasyonu
```bash
# Memory limit artır
node --max_old_space_size=4096 server/server.js

# PM2 ile memory limit
pm2 start server/server.js --max-memory-restart 1G
```

## 📊 İzleme ve Logging

### 1. PM2 Monitoring
```bash
# PM2 monitor
pm2 monitor

# Logs
pm2 logs justconnect-v2
```

### 2. Log Rotation
```bash
# /etc/logrotate.d/justconnect dosyası oluşturun
/path/to/justconnect-v2/logs/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 0644 nodejs nodejs
    postrotate
        pm2 reloadLogs
    endscript
}
```

### 3. Health Check Endpoint
Server.js'e health check endpoint ekleyin:

```javascript
app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        environment: process.env.NODE_ENV
    });
});
```

## 🔧 Maintenance Scripts

### 1. Backup Script
```bash
#!/bin/bash
# backup.sh
DATE=$(date +%Y%m%d_%H%M%S)
mongodump --uri="$MONGODB_URI" --out="/backups/mongo_$DATE"
tar -czf "/backups/uploads_$DATE.tar.gz" uploads/
```

### 2. Update Script
```bash
#!/bin/bash
# update.sh
git pull origin main
npm install --production
pm2 reload justconnect-v2
```

## 📈 Monitoring Tools (Opsiyonel)

- **Application Monitoring**: New Relic, DataDog
- **Server Monitoring**: Grafana + Prometheus
- **Uptime Monitoring**: Uptime Robot, Pingdom
- **Error Tracking**: Sentry

## 🆘 Troubleshooting

### Yaygın Sorunlar

1. **Port zaten kullanımda**
   ```bash
   sudo lsof -i :3000
   sudo kill -9 PID
   ```

2. **Permission denied**
   ```bash
   sudo chown -R $USER:$USER /path/to/justconnect-v2
   ```

3. **Memory issues**
   ```bash
   pm2 restart justconnect-v2
   ```

4. **Database connection**
   ```bash
   # MongoDB servisini kontrol et
   sudo systemctl status mongod
   ```

---

Bu rehber ile JustConnect V2 uygulamanızı güvenli ve verimli bir şekilde production ortamına deploy edebilirsiniz. Herhangi bir sorun yaşarsanız lütfen GitHub Issues üzerinden bildirin.