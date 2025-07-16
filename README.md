# 🚀 JustConnect V2 - Profesyonel Mesajlaşma Uygulaması

## 📖 Açıklama

JustConnect V2, Telegram benzeri modern ve profesyonel bir mesajlaşma uygulamasıdır. Kurumsal kullanım için optimize edilmiş, gerçek zamanlı mesajlaşma, dosya paylaşımı ve grup sohbetleri destekleyen kapsamlı bir iletişim platformudur.

## ✨ Özellikler

### 🎯 Temel Özellikler
- **Gerçek Zamanlı Mesajlaşma**: Socket.IO ile anlık mesaj iletimi
- **Kullanıcı Kimlik Doğrulama**: JWT tabanlı güvenli giriş sistemi
- **Dosya Paylaşımı**: 100MB'a kadar dosya yükleme desteği
- **Grup Sohbetleri**: Çoklu kullanıcı grup konuşmaları
- **Durum Göstergeleri**: Çevrimiçi/Çevrimdışı/Uzakta durumları
- **Yazma Göstergesi**: Gerçek zamanlı yazma bildirimleri
- **Arama Fonksiyonu**: Sohbetlerde arama yapabilme

### 🎨 Kullanıcı Arayüzü
- **Modern Tasarım**: Profesyonel ve kullanıcı dostu arayüz
- **Responsive Tasarım**: Mobil ve masaüstü uyumlu
- **Dark/Light Tema**: Karanlık ve aydınlık tema desteği
- **Emoji Desteği**: Mesajlarda emoji kullanımı
- **Dosya Önizleme**: Yüklenen dosyaların önizlemesi

### 🔒 Güvenlik
- **Şifreleme**: bcrypt ile şifre hashleme
- **JWT Token**: Güvenli oturum yönetimi
- **Dosya Güvenliği**: Dosya türü kontrolü
- **Rate Limiting**: Spam koruması
- **CORS Koruması**: Cross-origin güvenlik

## 🛠️ Teknoloji Stack

### Frontend
- **React 18**: Modern frontend framework
- **HTML5 & CSS3**: Responsive tasarım
- **Font Awesome**: İkon kütüphanesi
- **WebSocket**: Gerçek zamanlı iletişim

### Backend
- **Node.js**: Sunucu tarafı JavaScript
- **Express.js**: Web framework
- **Socket.IO**: Gerçek zamanlı iletişim
- **JWT**: Kimlik doğrulama
- **Multer**: Dosya yükleme
- **bcrypt**: Şifre hashleme

## 📦 Kurulum

### Gereksinimler
- Node.js (v16 veya üzeri)
- npm (v8 veya üzeri)

### 1. Projeyi Klonlayın
```bash
git clone https://github.com/kadirertan/justconnect-v2.git
cd justconnect-v2
```

### 2. Bağımlılıkları Yükleyin
```bash
npm install
```

### 3. Environment Dosyasını Oluşturun
```bash
cp .env.example .env
```

### 4. Environment Değişkenlerini Düzenleyin
`.env` dosyasını açın ve gerekli değişkenleri düzenleyin:
```env
PORT=3000
JWT_SECRET=your_super_secret_jwt_key
NODE_ENV=development
```

### 5. Uygulamayı Başlatın

#### Geliştirme Modu
```bash
npm run dev
```

#### Üretim Modu
```bash
npm start
```

### 6. Uygulamaya Erişin
Tarayıcınızda `http://localhost:3000` adresine gidin.

## 🎮 Kullanım

### Kullanıcı Kaydı
1. Ana sayfada "Kayıt Ol" butonuna tıklayın
2. Kullanıcı adı, email ve şifre bilgilerinizi girin
3. Hesabınız oluşturulduktan sonra otomatik olarak giriş yapılır

### Örnek Kullanıcılar
Geliştirme sırasında test için önceden tanımlanmış kullanıcılar:
- **Kullanıcı Adı**: `kadir` **Şifre**: `123456`
- **Kullanıcı Adı**: `ahmet` **Şifre**: `123456`

### Mesajlaşma
1. Sol panelden bir sohbet seçin
2. Alt kısımdaki mesaj kutusuna mesajınızı yazın
3. Enter tuşuna basın veya gönder butonuna tıklayın

### Dosya Paylaşımı
1. Mesaj kutusunun yanındaki ataş butonuna tıklayın
2. Paylaşmak istediğiniz dosyayı seçin
3. Dosya otomatik olarak yüklenir ve paylaşılır

## 📁 Proje Yapısı

```
JustConnect V2/
├── frontend/
│   └── index.html          # Ana frontend dosyası
├── server/
│   └── server.js           # Backend sunucu
├── uploads/                # Yüklenen dosyalar
├── .env.example            # Environment örnek dosyası
├── .env                    # Environment konfigürasyonu
├── package.json            # Node.js bağımlılıkları
└── README.md              # Bu dosya
```

## 🔧 API Endpoints

### Kimlik Doğrulama
- `POST /api/auth/login` - Kullanıcı girişi
- `POST /api/auth/register` - Kullanıcı kaydı

### Sohbetler
- `GET /api/chats` - Kullanıcının sohbetlerini getir
- `GET /api/chats/:chatId/messages` - Sohbet mesajlarını getir

### Dosya İşlemleri
- `POST /api/upload` - Dosya yükle
- `GET /uploads/:filename` - Dosya indir

## 🔌 Socket.IO Events

### Client → Server
- `user_connected` - Kullanıcı bağlandı
- `send_message` - Mesaj gönder
- `typing_start` - Yazma başladı
- `typing_stop` - Yazma durdu

### Server → Client
- `new_message` - Yeni mesaj alındı
- `user_status_changed` - Kullanıcı durumu değişti
- `user_typing` - Kullanıcı yazıyor
- `user_stopped_typing` - Kullanıcı yazmayı bıraktı

## 🚀 Deployment

### Heroku
1. Heroku hesabı oluşturun
2. Heroku CLI'yi yükleyin
3. Projeyi deploy edin:
```bash
heroku create justconnect-v2
git push heroku main
```

### VPS/Dedicated Server
1. Sunucuda Node.js yükleyin
2. Projeyi klonlayın
3. PM2 ile çalıştırın:
```bash
npm install -g pm2
pm2 start server/server.js --name "justconnect-v2"
```

## 🔐 Güvenlik Notları

- Production ortamında `.env` dosyasındaki `JWT_SECRET` değerini değiştirin
- HTTPS kullanın
- Firewall kurallarını yapılandırın
- Rate limiting aktif tutun
- Dosya yükleme limitlerini kontrol edin

## 📈 Geliştirme Roadmap

### v2.1 (Planlanan)
- [ ] MongoDB entegrasyonu
- [ ] Redis cache sistemi
- [ ] Email bildirimleri
- [ ] Sesli/Görüntülü arama
- [ ] Mesaj şifreleme

### v2.2 (Gelecek)
- [ ] Mobile uygulama (React Native)
- [ ] Desktop uygulama (Electron)
- [ ] Advanced admin paneli
- [ ] API Rate limiting improvements
- [ ] Multi-language support

## 🤝 Katkıda Bulunma

1. Bu repository'yi fork edin
2. Feature branch oluşturun (`git checkout -b feature/amazing-feature`)
3. Değişikliklerinizi commit edin (`git commit -m 'Add amazing feature'`)
4. Branch'inizi push edin (`git push origin feature/amazing-feature`)
5. Pull Request oluşturun

## 📝 Lisans

Bu proje MIT lisansı altında lisanslanmıştır. Detaylar için [LICENSE](LICENSE) dosyasına bakın.

## 👨‍💻 Geliştirici

**Kadir Ertan**
- GitHub: [@kadirertan](https://github.com/kadirertan)
- Email: kadir@justconnect.com

## 📞 Destek

Herhangi bir sorun yaşarsanız veya öneriniz varsa:
- Issue açın: [GitHub Issues](https://github.com/kadirertan/justconnect-v2/issues)
- Email gönderin: support@justconnect.com

## 🙏 Teşekkürler

Bu projeyi geliştirmede kullanılan açık kaynak kütüphanelerin geliştiricilerine teşekkürler.

---

⭐ Bu projeyi beğendiyseniz star vermeyi unutmayın!

🔄 Son Güncelleme: 2024-07-16