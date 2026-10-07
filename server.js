require('dotenv').config();
const express = require('express');
const fs = require('fs');
const path = require('path');
const session = require('express-session');
const multer = require('multer');
const crypto = require('crypto');

const app = express();
const PORT = Number(process.env.PORT || 3000);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, path.join(__dirname, 'images')),
  filename: (_req, file, cb) => {
    const extension = path.extname(file.originalname).toLowerCase();
    cb(null, `${crypto.randomUUID()}${extension}`);
  }
});

const allowedImageTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (!allowedImageTypes.has(file.mimetype)) {
      return cb(new Error('فرمت تصویر باید JPG، PNG یا WebP باشد.'));
    }
    cb(null, true);
  }
});

app.disable('x-powered-by');
app.set('trust proxy', process.env.NODE_ENV === 'production' ? 1 : 0);
app.use(express.json({ limit: '100kb' }));

const sessionSecret = process.env.SESSION_SECRET || crypto.randomBytes(48).toString('hex');
app.use(session({
  name: 'hna.sid',
  secret: sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 1000 * 60 * 60 * 2
  }
}));

const ADMIN_USERNAME = process.env.ADMIN_USERNAME;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

const productsFile = path.join(__dirname, 'products.json');
const ordersFile = path.join(__dirname, 'orders.json');
const reviewsFile = path.join(__dirname, 'reviews.json');

const SHIPPING_COSTS = Object.freeze({
  post: 80000,
  courier: 150000
});

const CATEGORIES = new Set(['candles', 'decor']);
const ALLOWED_ORDER_STATUSES = ['جدید', 'در حال آماده‌سازی', 'ارسال‌شده', 'تکمیل‌شده'];

function readJson(file, fallback) {
  if (!fs.existsSync(file)) return fallback;
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    return parsed;
  } catch (_error) {
    return fallback;
  }
}

function writeJson(file, value) {
  fs.writeFileSync(file, JSON.stringify(value, null, 2), 'utf8');
}

function normalizePhone(value) {
  return String(value || '')
    .trim()
    .replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d))
    .replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d))
    .replace(/[\s()-]/g, '');
}

function isValidPhone(value) {
  return /^\+?[0-9]{8,15}$/.test(normalizePhone(value));
}

function getProducts() {
  const products = readJson(productsFile, []);
  if (!Array.isArray(products)) return [];

  // Migration from the previous version: inventory is intentionally removed.
  const normalized = products.map(product => ({
    id: Number(product.id),
    name: String(product.name || '').trim(),
    price: Number(product.price),
    category: CATEGORIES.has(product.category) ? product.category : 'candles',
    image: typeof product.image === 'string' ? product.image : ''
  })).filter(product => Number.isFinite(product.id) && product.name && Number.isFinite(product.price) && product.price >= 0);

  const changed = JSON.stringify(normalized) !== JSON.stringify(products);
  if (changed) writeJson(productsFile, normalized);
  return normalized;
}

function saveProducts(products) {
  writeJson(productsFile, products);
}

function getOrders() {
  const orders = readJson(ordersFile, []);
  return Array.isArray(orders) ? orders : [];
}

function saveOrders(orders) {
  writeJson(ordersFile, orders);
}

function getReviews() {
  const reviews = readJson(reviewsFile, []);
  return Array.isArray(reviews) ? reviews : [];
}

function saveReviews(reviews) {
  writeJson(reviewsFile, reviews);
}

function requireAdmin(req, res, next) {
  if (!req.session.isAdmin) {
    return res.status(401).json({ success: false, message: 'دسترسی غیرمجاز است.' });
  }
  next();
}

app.get('/admin.html', (req, res) => {
  if (!req.session.isAdmin) return res.redirect('/admin-login.html');
  res.sendFile(path.join(__dirname, 'admin.html'));
});

const privateFiles = new Set([
  'server.js', 'orders.json', 'products.json', 'reviews.json', 'package.json',
  'package-lock.json', '.env', '.env.local'
]);
app.use((req, res, next) => {
  const requested = path.basename(req.path);
  if (privateFiles.has(requested) || req.path.startsWith('/node_modules/')) return res.sendStatus(404);
  next();
});
app.use(express.static(__dirname, { index: 'index.html', dotfiles: 'deny' }));

const loginAttempts = new Map();
app.post('/api/admin/login', (req, res) => {
  if (!ADMIN_USERNAME || !ADMIN_PASSWORD) {
    return res.status(503).json({ success: false, message: 'اطلاعات ورود مدیر در تنظیمات سرور تعریف نشده است.' });
  }

  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const record = loginAttempts.get(ip) || { count: 0, blockedUntil: 0 };
  if (record.blockedUntil > now) {
    return res.status(429).json({ success: false, message: 'تلاش‌های ورود بیش از حد مجاز است. کمی بعد دوباره امتحان کنید.' });
  }

  const { username, password } = req.body || {};
  if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
    loginAttempts.delete(ip);
    return req.session.regenerate(err => {
      if (err) return res.status(500).json({ success: false, message: 'ورود انجام نشد.' });
      req.session.isAdmin = true;
      req.session.save(saveErr => {
        if (saveErr) return res.status(500).json({ success: false, message: 'ورود انجام نشد.' });
        res.json({ success: true });
      });
    });
  }

  record.count += 1;
  if (record.count >= 5) {
    record.count = 0;
    record.blockedUntil = now + 15 * 60 * 1000;
  }
  loginAttempts.set(ip, record);
  res.status(401).json({ success: false, message: 'نام کاربری یا رمز عبور اشتباه است.' });
});

app.post('/api/admin/logout', requireAdmin, (req, res) => {
  req.session.destroy(error => {
    if (error) return res.status(500).json({ success: false, message: 'خروج انجام نشد.' });
    res.json({ success: true });
  });
});

// ---------- Orders ----------
app.post('/api/orders', (req, res) => {
  const order = req.body || {};
  const customer = order.customer;
  const items = order.products;

  if (!customer || typeof customer !== 'object' || !Array.isArray(items) || items.length === 0 || items.length > 50) {
    return res.status(400).json({ success: false, message: 'اطلاعات سفارش ناقص یا نامعتبر است.' });
  }

  const customerName = String(customer.name || '').trim();
  const phone = normalizePhone(customer.phone);
  const address = String(customer.address || '').trim();
  const description = String(customer.description || '').trim().slice(0, 1000);
  if (!customerName || customerName.length > 100 || !isValidPhone(phone) || !address || address.length > 1000) {
    return res.status(400).json({ success: false, message: 'نام، شماره تماس یا نشانی معتبر نیست.' });
  }

  const catalog = getProducts();
  const byId = new Map(catalog.map(product => [Number(product.id), product]));
  const quantities = new Map();

  for (const item of items) {
    const id = Number(item && item.id);
    const quantity = Number(item && item.quantity);
    if (!byId.has(id) || !Number.isInteger(quantity) || quantity < 1 || quantity > 99) {
      return res.status(400).json({ success: false, message: 'یکی از محصولات یا تعداد آن نامعتبر است.' });
    }
    quantities.set(id, (quantities.get(id) || 0) + quantity);
  }

  const normalizedItems = [];
  let productsTotal = 0;
  for (const [id, quantity] of quantities) {
    const product = byId.get(id);
    const price = Number(product.price);
    if (!Number.isFinite(price) || price < 0) {
      return res.status(400).json({ success: false, message: 'قیمت یکی از محصولات معتبر نیست.' });
    }
    productsTotal += price * quantity;
    normalizedItems.push({
      id: product.id,
      name: product.name,
      price,
      image: product.image || '',
      quantity
    });
  }

  const shippingMethod = String(order.shipping?.method || 'post');
  if (!Object.prototype.hasOwnProperty.call(SHIPPING_COSTS, shippingMethod)) {
    return res.status(400).json({ success: false, message: 'روش ارسال معتبر نیست.' });
  }
  const shippingCost = SHIPPING_COSTS[shippingMethod];

  const now = Date.now();
  const newOrder = {
    id: now,
    orderNumber: 'HNA-' + now.toString().slice(-6),
    customer: { name: customerName, phone, address, description },
    products: normalizedItems,
    shipping: { method: shippingMethod, cost: shippingCost },
    total: productsTotal + shippingCost,
    status: 'جدید',
    date: new Date().toLocaleString('fa-IR')
  };

  const orders = getOrders();
  orders.push(newOrder);
  saveOrders(orders);
  res.status(201).json({ success: true, order: newOrder });
});

app.get('/api/orders', requireAdmin, (_req, res) => {
  res.json({ success: true, orders: getOrders() });
});

app.get('/api/admin/stats', requireAdmin, (_req, res) => {
  const orders = getOrders();
  res.json({
    success: true,
    stats: {
      totalOrders: orders.length,
      newOrders: orders.filter(o => o.status === 'جدید').length,
      preparingOrders: orders.filter(o => o.status === 'در حال آماده‌سازی').length,
      shippedOrders: orders.filter(o => o.status === 'ارسال‌شده').length,
      completedOrders: orders.filter(o => o.status === 'تکمیل‌شده').length,
      totalSales: orders.reduce((sum, order) => sum + Number(order.total || 0), 0)
    }
  });
});

app.patch('/api/orders/:id', requireAdmin, (req, res) => {
  const orderId = Number(req.params.id);
  const newStatus = String(req.body?.status || '');
  if (!ALLOWED_ORDER_STATUSES.includes(newStatus)) {
    return res.status(400).json({ success: false, message: 'وضعیت نامعتبر است.' });
  }
  const orders = getOrders();
  const order = orders.find(item => item.id === orderId);
  if (!order) return res.status(404).json({ success: false, message: 'سفارش پیدا نشد.' });
  order.status = newStatus;
  saveOrders(orders);
  res.json({ success: true, order });
});

app.delete('/api/orders/:id', requireAdmin, (req, res) => {
  const orderId = Number(req.params.id);
  const orders = getOrders();
  const index = orders.findIndex(item => item.id === orderId);
  if (index === -1) return res.status(404).json({ success: false, message: 'سفارش پیدا نشد.' });
  orders.splice(index, 1);
  saveOrders(orders);
  res.json({ success: true });
});

// ---------- Products ----------
app.get('/api/public/products', (_req, res) => {
  res.json({ success: true, products: getProducts() });
});

app.get('/api/products', requireAdmin, (_req, res) => {
  res.json({ success: true, products: getProducts() });
});

function validateProductFields(name, price, category) {
  return typeof name === 'string' && name.trim() && name.length <= 120 &&
    Number.isFinite(Number(price)) && Number(price) >= 0 && CATEGORIES.has(category);
}

app.post('/api/products', requireAdmin, upload.single('image'), (req, res) => {
  const name = String(req.body?.name || '').trim();
  const price = Number(req.body?.price);
  const category = String(req.body.category || "").trim();

  if (!validateProductFields(name, price, category)) {
    if (req.file) fs.rmSync(req.file.path, { force: true });
    return res.status(400).json({ success: false, message: 'نام، قیمت یا دسته‌بندی محصول معتبر نیست.' });
  }

  const products = getProducts();
  const product = {
    id: Date.now(),
    name,
    price,
    category,
    image: req.file ? `/images/${req.file.filename}` : ''
  };
  products.push(product);
  saveProducts(products);
  res.status(201).json({ success: true, product });
});

app.patch('/api/products/:id', requireAdmin, upload.single('image'), (req, res) => {
  const productId = Number(req.params.id);
  const products = getProducts();
  const product = products.find(item => item.id === productId);
  if (!product) {
    if (req.file) fs.rmSync(req.file.path, { force: true });
    return res.status(404).json({ success: false, message: 'محصول پیدا نشد.' });
  }

  const name = String(req.body?.name || '').trim();
  const price = Number(req.body?.price);
  const category = String(req.body?.category || '').trim();
  if (!validateProductFields(name, price, category)) {
    if (req.file) fs.rmSync(req.file.path, { force: true });
    return res.status(400).json({ success: false, message: 'نام، قیمت یا دسته‌بندی محصول معتبر نیست.' });
  }

  const oldImage = product.image;
  product.name = name;
  product.price = price;
  product.category = category;
  if (req.file) {
    product.image = `/images/${req.file.filename}`;
    if (oldImage && oldImage.startsWith('/images/')) {
      fs.rmSync(path.join(__dirname, oldImage.replace(/^\//, '')), { force: true });
    }
  }

  saveProducts(products);
  res.json({ success: true, product });
});

app.delete('/api/products/:id', requireAdmin, (req, res) => {
  const productId = Number(req.params.id);
  const products = getProducts();
  const index = products.findIndex(item => item.id === productId);
  if (index === -1) return res.status(404).json({ success: false, message: 'محصول پیدا نشد.' });
  const [removed] = products.splice(index, 1);
  saveProducts(products);
  if (removed.image?.startsWith('/images/')) {
    fs.rmSync(path.join(__dirname, removed.image.replace(/^\//, '')), { force: true });
  }
  res.json({ success: true });
});

// ---------- Reviews / Ratings ----------
app.get('/api/public/reviews', (req, res) => {
  const productId = Number(req.query.productId);
  if (!Number.isInteger(productId)) return res.status(400).json({ success: false, message: 'شناسه محصول نامعتبر است.' });
  const reviews = getReviews().filter(review => review.productId === productId && review.status === 'approved');
  const ratingSum = reviews.reduce((sum, review) => sum + review.rating, 0);
  const averageRating = reviews.length ? Number((ratingSum / reviews.length).toFixed(1)) : 0;
  res.json({ success: true, reviews, summary: { averageRating, count: reviews.length } });
});

app.post('/api/reviews', (req, res) => {
  const productId = Number(req.body?.productId);
  const rating = Number(req.body?.rating);
  const orderNumber = String(req.body?.orderNumber || '').trim();
  const phone = normalizePhone(req.body?.phone);
  const text = String(req.body?.text || '').trim().slice(0, 1000);

  if (!Number.isInteger(productId) || !Number.isInteger(rating) || rating < 1 || rating > 5 ||
      !orderNumber || !isValidPhone(phone) || text.length < 3) {
    return res.status(400).json({ success: false, message: 'اطلاعات نظر کامل یا معتبر نیست.' });
  }

  const product = getProducts().find(item => item.id === productId);
  if (!product) return res.status(404).json({ success: false, message: 'محصول پیدا نشد.' });

  const order = getOrders().find(item => item.orderNumber === orderNumber && normalizePhone(item.customer?.phone) === phone);
  if (!order || !['ارسال‌شده', 'تکمیل‌شده'].includes(order.status)) {
    return res.status(403).json({ success: false, message: 'فقط مشتری‌ای که سفارش او ارسال شده یا تکمیل شده است می‌تواند نظر ثبت کند.' });
  }

  const purchased = order.products.some(item => Number(item.id) === productId);
  if (!purchased) return res.status(403).json({ success: false, message: 'این محصول در سفارش شما وجود ندارد.' });

  const reviews = getReviews();
  const alreadyReviewed = reviews.some(review => review.orderNumber === orderNumber && review.productId === productId);
  if (alreadyReviewed) return res.status(409).json({ success: false, message: 'برای این محصول قبلاً نظر ثبت کرده‌اید.' });

  const review = {
    id: Date.now(),
    productId,
    orderNumber,
    customerName: order.customer.name,
    rating,
    text,
    verifiedPurchase: true,
    status: 'pending',
    date: new Date().toLocaleString('fa-IR')
  };
  reviews.push(review);
  saveReviews(reviews);
  res.status(201).json({ success: true, message: 'نظر شما ثبت شد و پس از تأیید نمایش داده می‌شود.' });
});

app.get('/api/reviews', requireAdmin, (_req, res) => {
  const reviews = getReviews().map(review => ({
    ...review,
    productName: getProducts().find(product => product.id === review.productId)?.name || 'محصول حذف‌شده'
  }));
  res.json({ success: true, reviews });
});

app.patch('/api/reviews/:id', requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const status = String(req.body?.status || '');
  if (!['approved', 'rejected', 'pending'].includes(status)) {
    return res.status(400).json({ success: false, message: 'وضعیت نظر نامعتبر است.' });
  }
  const reviews = getReviews();
  const review = reviews.find(item => item.id === id);
  if (!review) return res.status(404).json({ success: false, message: 'نظر پیدا نشد.' });
  review.status = status;
  saveReviews(reviews);
  res.json({ success: true, review });
});

app.delete('/api/reviews/:id', requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const reviews = getReviews();
  const index = reviews.findIndex(item => item.id === id);
  if (index === -1) return res.status(404).json({ success: false, message: 'نظر پیدا نشد.' });
  reviews.splice(index, 1);
  saveReviews(reviews);
  res.json({ success: true });
});

app.get('/api/test', (_req, res) => res.json({ success: true, message: 'H&A.HOME Backend is working!' }));

app.use((err, _req, res, _next) => {
  const message = err?.code === 'LIMIT_FILE_SIZE'
    ? 'حجم تصویر نباید بیشتر از ۵ مگابایت باشد.'
    : (err?.message || 'درخواست قابل پردازش نیست.');
  res.status(400).json({ success: false, message });
});

app.get('/health', (_req, res) => res.json({ success: true, service: 'H&A.HOME' }));

app.listen(PORT, '0.0.0.0', () => {
  if (!ADMIN_USERNAME || !ADMIN_PASSWORD) console.warn('ADMIN_USERNAME و ADMIN_PASSWORD را در متغیرهای محیطی تنظیم کنید.');
  console.log(`H&A.HOME SERVER RUNNING ON ${PORT}`);
});
