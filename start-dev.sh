#!/bin/bash

# JustConnect V2 - Geliştirme Başlatma Scripti
# Bu script uygulamayı geliştirme modunda başlatır

echo "🚀 JustConnect V2 Başlatılıyor..."
echo "=================================="

# Node.js sürümünü kontrol et
echo "📦 Node.js sürümü kontrol ediliyor..."
NODE_VERSION=$(node --version)
echo "Node.js Sürümü: $NODE_VERSION"

# npm sürümünü kontrol et
NPM_VERSION=$(npm --version)
echo "npm Sürümü: $NPM_VERSION"

# .env dosyasının var olup olmadığını kontrol et
if [ ! -f .env ]; then
    echo "⚠️  .env dosyası bulunamadı!"
    echo "📋 .env.example dosyasından .env oluşturuluyor..."
    cp .env.example .env
    echo "✅ .env dosyası oluşturuldu. Lütfen gerekli değişkenleri düzenleyin."
fi

# Bağımlılıkları kontrol et
if [ ! -d "node_modules" ]; then
    echo "📦 Bağımlılıklar yükleniyor..."
    npm install
else
    echo "✅ Bağımlılıklar mevcut."
fi

# Gerekli dizinleri oluştur
echo "📁 Gerekli dizinler oluşturuluyor..."
mkdir -p uploads
mkdir -p logs
mkdir -p temp

echo "✅ Dizinler hazır."

# Port kontrolü
PORT=${PORT:-3000}
echo "🔌 Port $PORT kontrol ediliyor..."

# Lsof komutu varsa port kontrolü yap (Linux/Mac)
if command -v lsof > /dev/null; then
    if lsof -Pi :$PORT -sTCP:LISTEN -t >/dev/null ; then
        echo "⚠️  Port $PORT zaten kullanımda!"
        echo "🔄 Başka bir port kullanmayı deneyin veya çalışan uygulamayı durdurun."
        exit 1
    fi
fi

echo "✅ Port $PORT kullanılabilir."

# Geliştirme sunucusunu başlat
echo "🎯 Geliştirme sunucusu başlatılıyor..."
echo "🌐 Uygulama: http://localhost:$PORT"
echo "📚 API: http://localhost:$PORT/api"
echo "📝 Logs: logs/app.log"
echo "=================================="
echo "🛑 Durdurmak için Ctrl+C kullanın"
echo ""

# Sunucuyu başlat
npm run dev