@echo off
title JustConnect V2 - Kurulum

echo ⚡ JustConnect V2 Kurulum Sihirbazı
echo =====================================
echo.

echo 🔧 Sistem gereksinimleri kontrol ediliyor...
echo.

:: Node.js kontrolü
echo 📦 Node.js kontrol ediliyor...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Node.js bulunamadı!
    echo.
    echo 🔗 Lütfen Node.js yükleyin:
    echo    https://nodejs.org/
    echo.
    echo    Minimum gereksinim: Node.js v16+
    pause
    exit /b 1
) else (
    echo ✅ Node.js bulundu
    node --version
)

:: npm kontrolü
echo 📦 npm kontrol ediliyor...
npm --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ npm bulunamadı!
    pause
    exit /b 1
) else (
    echo ✅ npm bulundu
    npm --version
)

echo.
echo 🎯 Kurulum başlatılıyor...
echo.

:: Bağımlılıkları yükle
echo 📦 Bağımlılıklar yükleniyor...
npm install
if %errorlevel% neq 0 (
    echo ❌ Bağımlılık yükleme hatası!
    echo.
    echo 🔧 Çözüm önerileri:
    echo    1. İnternet bağlantınızı kontrol edin
    echo    2. npm cache clean --force
    echo    3. node_modules klasörünü silin ve tekrar deneyin
    pause
    exit /b 1
)

echo ✅ Bağımlılıklar yüklendi

:: .env dosyası oluştur
echo 📋 Konfigürasyon dosyası oluşturuluyor...
if not exist .env (
    copy .env.example .env >nul
    echo ✅ .env dosyası oluşturuldu
) else (
    echo ⚠️  .env dosyası zaten mevcut
)

:: Gerekli dizinleri oluştur
echo 📁 Proje dizinleri oluşturuluyor...
if not exist uploads mkdir uploads
if not exist logs mkdir logs
if not exist temp mkdir temp
echo ✅ Dizinler oluşturuldu

echo.
echo 🎉 Kurulum tamamlandı!
echo ================================
echo.
echo 🚀 Uygulamayı başlatmak için:
echo    start-dev.bat
echo.
echo 🌐 Uygulama adresi:
echo    http://localhost:3000
echo.
echo 📖 Daha fazla bilgi için:
echo    README.md dosyasını okuyun
echo.
echo 🔑 Test kullanıcıları:
echo    Kullanıcı: kadir, Şifre: 123456
echo    Kullanıcı: ahmet, Şifre: 123456
echo.

set /p choice="Uygulamayı şimdi başlatmak ister misiniz? (y/n): "
if /i "%choice%"=="y" (
    echo.
    echo 🚀 Uygulama başlatılıyor...
    call start-dev.bat
) else (
    echo.
    echo 👋 Kurulum tamamlandı. İyi kullanımlar!
)

pause