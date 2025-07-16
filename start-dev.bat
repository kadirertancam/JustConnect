@echo off
title JustConnect V2 - Development Server

echo 🚀 JustConnect V2 Başlatılıyor...
echo ==================================

echo 📦 Node.js sürümü kontrol ediliyor...
node --version
if %errorlevel% neq 0 (
    echo ❌ Node.js bulunamadı! Lütfen Node.js yükleyin.
    echo 🔗 https://nodejs.org/
    pause
    exit /b 1
)

echo 📦 npm sürümü kontrol ediliyor...
npm --version

echo 📋 .env dosyası kontrol ediliyor...
if not exist .env (
    echo ⚠️  .env dosyası bulunamadı!
    echo 📋 .env.example dosyasından .env oluşturuluyor...
    copy .env.example .env >nul
    echo ✅ .env dosyası oluşturuldu. Lütfen gerekli değişkenleri düzenleyin.
)

echo 📦 Bağımlılıklar kontrol ediliyor...
if not exist node_modules (
    echo 📦 Bağımlılıklar yükleniyor...
    npm install
    if %errorlevel% neq 0 (
        echo ❌ Bağımlılık yükleme hatası!
        pause
        exit /b 1
    )
) else (
    echo ✅ Bağımlılıklar mevcut.
)

echo 📁 Gerekli dizinler oluşturuluyor...
if not exist uploads mkdir uploads
if not exist logs mkdir logs
if not exist temp mkdir temp
echo ✅ Dizinler hazır.

echo 🎯 Geliştirme sunucusu başlatılıyor...
echo 🌐 Uygulama: http://localhost:3000
echo 📚 API: http://localhost:3000/api
echo 📝 Logs: logs/app.log
echo ==================================
echo 🛑 Durdurmak için Ctrl+C kullanın
echo.

npm run dev

if %errorlevel% neq 0 (
    echo ❌ Sunucu başlatma hatası!
    pause
)

echo 👋 JustConnect V2 kapatıldı.
pause