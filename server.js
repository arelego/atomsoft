// server.js

require('dotenv').config();                  // .env dosyasını yükler
const express       = require('express');
const http          = require('http');
const mongoose      = require('mongoose');
const morgan        = require('morgan');     // HTTP logger
const jwt           = require('jsonwebtoken');
const authMiddleware= require('./middleware/authMiddleware');

// Route tanımları
const authRoutes    = require('./routes/authRoutes');
const riderRoutes   = require('./routes/riderRoutes');
const siparisRoutes = require('./routes/siparisRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const posRoutes     = require('./routes/posRoutes');

// Model
const Yemek = require('./models/Yemek');

const app = express();
const { PORT = 3000, MONGODB_URI, JWT_SECRET } = process.env;

// 1) Global Middleware
app.use(morgan('tiny'));                     // Gelen isteği log’lar
app.use(express.json());                     // JSON body parsing
app.use(express.static('public'));           // Statik dosyalar

// 2) Auth Endpoint’leri (token gerektirmez)
app.use('/api/auth', authRoutes);

// 3) Demo Token (örnek amaçlı)
app.post('/api/auth/demo-token', (req, res) => {
  const demoUser = { _id: '64f...', rol: 'user' };
  const token = jwt.sign(
    { id: demoUser._id, rol: demoUser.rol },
    JWT_SECRET,
    { expiresIn: '1d' }
  );
  res.json({ token });
});

// 4) Korumalı ve Diğer Router’lar
app.use('/api/rider',   authMiddleware, riderRoutes);
app.use('/api/siparis',               siparisRoutes);
app.use('/api/payment',               paymentRoutes);
app.use('/api/pos',                   posRoutes);

// 5) Yemek CRUD Endpoint’leri
app.post('/yemek-ekle', async (req, res) => {
  try {
    const { ad, fiyat, aciklama, resim } = req.body;
    const yeniYemek = await Yemek.create({ ad, fiyat, aciklama, resim });
    res.status(201).json({ message: 'Yemek eklendi!', yemek: yeniYemek });
  } catch (err) {
    res.status(500).json({ message: 'Hata oluştu', error: err.message });
  }
});

app.get('/yemekler', async (req, res) => {
  try {
    const liste = await Yemek.find();
    res.json(liste);
  } catch (err) {
    res.status(500).json({ message: 'Hata oluştu', error: err.message });
  }
});

// 6) Ana Sayfa
app.get('/', (req, res) => {
  res.send('Merhaba Backend! Veritabanı bağlantısı kuruldu.');
});

// 7) MongoDB Bağlantısı
mongoose
  .connect(MONGODB_URI)
  .then(() => console.log('MongoDB bağlantısı başarılı!'))
  .catch(err => console.error('MongoDB bağlantısı başarısız:', err));

// 8) HTTP & Socket.IO
const server = http.createServer(app);
const io     = require('socket.io')(server, {
  cors: { origin: '*', methods: ['GET','POST'] }
});

io.on('connection', socket => {
  console.log('Yeni bir kurye bağlandı:', socket.id);

  socket.on('konum-guncelle', konum => {
    io.emit('konum-guncellendi', konum);
  });

  socket.on('disconnect', () => {
    console.log('Kurye bağlantısı kesildi:', socket.id);
  });
});

// 9) Sunucuyu Başlat
server.listen(PORT, () => {
  console.log(`Sunucu çalışıyor: http://localhost:${PORT}`);
});
