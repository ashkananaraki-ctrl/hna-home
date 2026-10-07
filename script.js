(function () {
  'use strict';

  const CART_KEY = 'haHOMEcart';
  const ORDER_KEY = 'haHOMEOrder';

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>'"]/g, char => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    }[char]));
  }

  function toNumber(value) {
    return Number(String(value ?? '').replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).replace(/,/g, ''));
  }

  function formatPrice(value) {
    return Number(value || 0).toLocaleString('fa-IR');
  }

  function getCart() {
    try {
      const cart = JSON.parse(localStorage.getItem(CART_KEY) || '[]');
      return Array.isArray(cart) ? cart : [];
    } catch (_error) {
      return [];
    }
  }

  function saveCart(cart) {
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
  }

  function updateCartCount() {
    const count = getCart().reduce((sum, item) => sum + Math.max(0, Number(item.quantity) || 0), 0);
    document.querySelectorAll('#cart-count').forEach(el => { el.textContent = count; });
  }

  async function fetchProducts() {
    const response = await fetch('/api/public/products');
    const result = await response.json();
    if (!result.success) throw new Error(result.message || 'خطا در دریافت محصولات');
    return result.products || [];
  }

  async function addProductToCart(productId, quantity = 1) {
    const products = await fetchProducts();
    const product = products.find(item => Number(item.id) === Number(productId));
    if (!product) throw new Error('محصول پیدا نشد.');
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) throw new Error('تعداد محصول نامعتبر است.');

    const cart = getCart();
    const existing = cart.find(item => Number(item.id) === Number(product.id));
    if (existing) existing.quantity += quantity;
    else cart.push({ id: product.id, name: product.name, price: product.price, image: product.image || '', quantity });
    saveCart(cart);
    updateCartCount();
    return product;
  }

  window.openProduct = function (productId) {
    window.location.href = `product.html?id=${encodeURIComponent(productId)}`;
  };

  window.addProductToCartFromHome = async function (productId) {
    try {
      await addProductToCart(productId, 1);
      alert('محصول به سبد خرید اضافه شد 🛒');
    } catch (error) {
      alert(error.message || 'افزودن به سبد خرید انجام نشد.');
    }
  };

  window.changeQuantity = function (index, amount) {
    const cart = getCart();
    if (!cart[index]) return;
    cart[index].quantity = Math.max(1, Number(cart[index].quantity || 1) + amount);
    saveCart(cart);
    displayCart();
    updateCartCount();
  };

  window.removeProduct = function (index) {
    const cart = getCart();
    cart.splice(index, 1);
    saveCart(cart);
    displayCart();
    updateCartCount();
  };

  function displayCart() {
    const container = document.querySelector('#cart-items');
    const totalElement = document.querySelector('#cart-total');
    if (!container) return;

    const cart = getCart();
    if (!cart.length) {
      container.innerHTML = '<div class="cart-empty"><h3>سبد خرید شما خالی است.</h3><a class="hero-button" href="index.html#categories">مشاهده محصولات</a></div>';
      if (totalElement) totalElement.textContent = '۰';
      return;
    }

    let total = 0;
    container.innerHTML = cart.map((product, index) => {
      const itemTotal = Number(product.price || 0) * Number(product.quantity || 0);
      total += itemTotal;
      return `
        <div class="cart-product">
          <div class="cart-product-image">
            ${product.image ? `<img src="${escapeHtml(product.image)}" alt="${escapeHtml(product.name)}">` : '<div class="product-image-placeholder">H&A.HOME</div>'}
          </div>
          <div class="cart-product-info">
            <h3>${escapeHtml(product.name)}</h3>
            <p>${formatPrice(product.price)} تومان</p>
            <div class="cart-quantity-controls">
              <button type="button" onclick="changeQuantity(${index}, 1)">+</button>
              <strong>${product.quantity}</strong>
              <button type="button" onclick="changeQuantity(${index}, -1)">−</button>
            </div>
            <button type="button" class="remove-product" onclick="removeProduct(${index})">حذف محصول</button>
          </div>
          <strong>${formatPrice(itemTotal)} تومان</strong>
        </div>`;
    }).join('');
    if (totalElement) totalElement.textContent = formatPrice(total);
  }

  const cartPage = document.querySelector('#cart-items');
  if (cartPage) displayCart();

  const checkoutButton = document.querySelector('#checkout-button');
  if (checkoutButton) {
    checkoutButton.addEventListener('click', () => {
      if (!getCart().length) return alert('سبد خرید شما خالی است.');
      window.location.href = 'checkout.html';
    });
  }

  function renderProductCards(products, container) {
    if (!products.length) {
      container.innerHTML = '<p>فعلاً محصولی در این دسته وجود ندارد.</p>';
      return;
    }
    container.innerHTML = products.map(product => `
      <div class="product-card" onclick="openProduct(${Number(product.id)})">
        <div class="product-image">
          ${product.image ? `<img src="${escapeHtml(product.image)}" alt="${escapeHtml(product.name)}" loading="lazy">` : '<div class="product-image-placeholder">H&A.HOME</div>'}
        </div>
        <div class="product-info">
          <h3>${escapeHtml(product.name)}</h3>
          <p class="product-price">${formatPrice(product.price)} تومان</p>
          <button class="product-button" type="button" onclick="event.stopPropagation(); openProduct(${Number(product.id)})">مشاهده محصول</button>
        </div>
      </div>`).join('');
  }

  async function renderProductList() {
    const container = document.querySelector('#product-list');
    if (!container) return;
    try { renderProductCards(await fetchProducts(), container); }
    catch (_error) { container.innerHTML = '<p>دریافت محصولات انجام نشد.</p>'; }
  }
  renderProductList();

  window.loadCategoryProducts = async function (category) {
    const container = document.querySelector('#category-products');
    if (!container) return;
    try {
      const products = await fetchProducts();
      renderProductCards(products.filter(product => product.category === category), container);
    } catch (_error) {
      container.innerHTML = '<p>ارتباط با سرور برقرار نشد.</p>';
    }
  };

  window.filterProducts = async function (category) {
    const container = document.querySelector('#product-list');
    if (!container) return;
    try {
      const products = await fetchProducts();
      renderProductCards(category ? products.filter(product => product.category === category) : products, container);
    } catch (_error) {
      container.innerHTML = '<p>دریافت محصولات انجام نشد.</p>';
    }
  };

  // ---------- Checkout ----------
  const checkoutItems = document.querySelector('#checkout-items');
  const checkoutForm = document.querySelector('#checkout-form');
  const shippingOptions = [...document.querySelectorAll('input[name="shipping"]')];
  const checkoutTotal = document.querySelector('#checkout-total');

  function selectedShippingMethod() {
    return document.querySelector('input[name="shipping"]:checked')?.value || 'post';
  }

  function calculateCheckoutTotal() {
    const productsTotal = getCart().reduce((sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 0), 0);
    const shippingCost = selectedShippingMethod() === 'courier' ? 150000 : 80000;
    if (checkoutTotal) checkoutTotal.textContent = formatPrice(productsTotal + shippingCost) + ' تومان';
    return { productsTotal, shippingCost, finalTotal: productsTotal + shippingCost };
  }

  if (checkoutItems) {
    const cart = getCart();
    checkoutItems.innerHTML = cart.length ? cart.map(item => `
      <div class="checkout-item">
        <div class="checkout-item-image">${item.image ? `<img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.name)}">` : ''}</div>
        <div class="checkout-item-info"><h3>${escapeHtml(item.name)}</h3><p>تعداد: ${item.quantity}</p></div>
        <strong>${formatPrice(Number(item.price) * Number(item.quantity))} تومان</strong>
      </div>`).join('') : '<p>سبد خرید شما خالی است.</p>';
  }
  calculateCheckoutTotal();
  shippingOptions.forEach(option => option.addEventListener('change', calculateCheckoutTotal));

  if (checkoutForm) {
    checkoutForm.addEventListener('submit', async event => {
      event.preventDefault();
      const cart = getCart();
      if (!cart.length) return alert('سبد خرید شما خالی است.');
      const name = document.querySelector('#name').value.trim();
      const phone = document.querySelector('#phone').value.trim();
      const address = document.querySelector('#address').value.trim();
      const description = document.querySelector('#description').value.trim();
      if (!name || !phone || !address) return alert('لطفاً اطلاعات ضروری را کامل کنید.');

      try {
        const response = await fetch('/api/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            customer: { name, phone, address, description },
            products: cart.map(item => ({ id: item.id, quantity: item.quantity })),
            shipping: { method: selectedShippingMethod() }
          })
        });
        const result = await response.json();
        if (!result.success) return alert(result.message || 'ثبت سفارش انجام نشد.');
        localStorage.setItem(ORDER_KEY, JSON.stringify(result.order));
        localStorage.removeItem(CART_KEY);
        window.location.href = 'success.html';
      } catch (_error) {
        alert('ارتباط با سرور برقرار نشد.');
      }
    });
  }

  const orderNumberElement = document.querySelector('#order-number');
  if (orderNumberElement) {
    try { orderNumberElement.textContent = JSON.parse(localStorage.getItem(ORDER_KEY) || '{}').orderNumber || ''; } catch (_error) {}
  }

  // ---------- Product detail + reviews ----------
  const productDetail = document.querySelector('#product-detail');
  if (productDetail) {
    const productId = Number(new URLSearchParams(window.location.search).get('id'));
    fetchProducts().then(products => {
      const product = products.find(item => Number(item.id) === productId);
      if (!product) { productDetail.innerHTML = '<p>محصول پیدا نشد.</p>'; return; }
      document.title = `${product.name} | H&A.HOME`;
      productDetail.innerHTML = `
        <div class="product-detail">
          <div class="product-detail-image">${product.image ? `<img src="${escapeHtml(product.image)}" alt="${escapeHtml(product.name)}">` : '<div class="product-image-placeholder">H&A.HOME</div>'}</div>
          <div class="product-detail-info">
            <h1>${escapeHtml(product.name)}</h1>
            <p class="product-detail-price">${formatPrice(product.price)} تومان</p>
            <div class="product-rating-row"><div class="product-rating-summary" id="product-rating-summary">در حال دریافت امتیاز...</div><button type="button" class="review-jump-button" onclick="document.querySelector('#review-form-box')?.scrollIntoView({ behavior: 'smooth', block: 'start' })">ثبت امتیاز و نظر ⭐</button></div>
            <div class="product-quantity">
              <button type="button" onclick="changeProductQuantity(-1)">−</button>
              <span id="product-quantity">1</span>
              <button type="button" onclick="changeProductQuantity(1)">+</button>
            </div>
            <button type="button" class="product-detail-button" onclick="addProductDetailToCart(${product.id})">افزودن به سبد خرید</button>
          </div>
        </div>
        <section class="reviews-section">
          <h2>نظرات مشتریان</h2>
          <div id="product-reviews">در حال بارگذاری نظرات...</div>
          <div class="review-form-box" id="review-form-box">
            <h3>ثبت امتیاز و نظر ⭐</h3>
             <div class="review-help">بعد از اینکه سفارشت به دستت رسید، از همین‌جا می‌تونی امتیاز و نظرت رو ثبت کنی.</div>
            <p>برای ثبت نظر، شماره سفارش و همان شماره موبایلی که هنگام خرید وارد کردی را وارد کن. فقط خریداران تأییدشده می‌توانند برای محصولی که خریده‌اند نظر بدهند.</p>
            <form id="review-form">
              <div class="review-stars-input">
                <label>امتیاز</label>
                <select id="review-rating" required><option value="5">★★★★★ — عالی</option><option value="4">★★★★☆ — خوب</option><option value="3">★★★☆☆ — متوسط</option><option value="2">★★☆☆☆ — ضعیف</option><option value="1">★☆☆☆☆ — خیلی ضعیف</option></select>
              </div>
              <input id="review-order-number" required placeholder="شماره سفارش، مثلاً HNA-123456">
              <input id="review-phone" required placeholder="شماره موبایل سفارش">
              <textarea id="review-text" required minlength="3" maxlength="1000" rows="4" placeholder="نظرت درباره محصول..."></textarea>
              <button type="submit" class="product-detail-button">ثبت نظر</button>
            </form>
          </div>
        </section>`;

      window.changeProductQuantity = function (amount) {
        const el = document.querySelector('#product-quantity');
        if (el) el.textContent = Math.max(1, Number(el.textContent) + amount);
      };
      window.addProductDetailToCart = async function (id) {
        const quantity = Math.max(1, Number(document.querySelector('#product-quantity')?.textContent || 1));
        try { await addProductToCart(id, quantity); alert('محصول به سبد خرید اضافه شد 🛒'); }
        catch (error) { alert(error.message || 'افزودن به سبد خرید انجام نشد.'); }
      };

      loadReviews(product);
      document.querySelector('#review-form').addEventListener('submit', async event => {
        event.preventDefault();
        try {
          const response = await fetch('/api/reviews', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              productId: product.id,
              rating: Number(document.querySelector('#review-rating').value),
              orderNumber: document.querySelector('#review-order-number').value.trim(),
              phone: document.querySelector('#review-phone').value.trim(),
              text: document.querySelector('#review-text').value.trim()
            })
          });
          const result = await response.json();
          alert(result.message || (result.success ? 'نظر ثبت شد.' : 'ثبت نظر انجام نشد.'));
          if (result.success) document.querySelector('#review-form').reset();
        } catch (_error) { alert('ارتباط با سرور برقرار نشد.'); }
      });
    }).catch(() => { productDetail.innerHTML = '<p>خطا در دریافت اطلاعات محصول.</p>'; });
  }

  async function loadReviews(product) {
    const reviewsBox = document.querySelector('#product-reviews');
    const summaryBox = document.querySelector('#product-rating-summary');
    if (!reviewsBox) return;
    try {
      const response = await fetch(`/api/public/reviews?productId=${product.id}`);
      const result = await response.json();
      const average = Number(result.summary?.averageRating || 0);
      const count = Number(result.summary?.count || 0);
      if (summaryBox) summaryBox.innerHTML = count ? `⭐ ${average.toLocaleString('fa-IR')} از ۵ <span>(${count.toLocaleString('fa-IR')} نظر)</span>` : 'هنوز امتیازی ثبت نشده است.';
      reviewsBox.innerHTML = result.reviews?.length ? result.reviews.map(review => `
        <article class="review-card">
          <div class="review-card-top"><strong>${escapeHtml(review.customerName)}</strong><span>⭐ ${review.rating}/5</span></div>
          <p>${escapeHtml(review.text)}</p>
          <small>خرید تأییدشده · ${escapeHtml(review.date)}</small>
        </article>`).join('') : '<p>هنوز نظری برای این محصول ثبت نشده است.</p>';
      addProductSchema(product, average, count);
    } catch (_error) {
      reviewsBox.innerHTML = '<p>دریافت نظرات انجام نشد.</p>';
    }
  }

  function addProductSchema(product, average, count) {
    const existing = document.querySelector('#product-schema');
    if (existing) existing.remove();
    const data = {
      '@context': 'https://schema.org', '@type': 'Product', name: product.name,
      image: product.image ? [new URL(product.image, window.location.origin).href] : undefined,
      offers: { '@type': 'Offer', priceCurrency: 'IRR', price: Number(product.price) * 10 }
    };
    if (count > 0) data.aggregateRating = { '@type': 'AggregateRating', ratingValue: average, bestRating: 5, worstRating: 1, reviewCount: count };
    const script = document.createElement('script'); script.id = 'product-schema'; script.type = 'application/ld+json'; script.textContent = JSON.stringify(data); document.head.appendChild(script);
  }

  // ---------- Admin ----------
  const adminProductsList = document.querySelector('#admin-products-list');
  async function loadAdminProducts() {
    if (!adminProductsList) return;
    try {
      const response = await fetch('/api/products');
      const result = await response.json();
      if (!result.success) throw new Error(result.message);
      adminProductsList.innerHTML = result.products.length ? result.products.map(product => `
        <div class="admin-product-item">
          <h3>${escapeHtml(product.name)}</h3>
          <p>قیمت: ${formatPrice(product.price)} تومان</p>
          <p>دسته‌بندی: ${escapeHtml(product.category)}</p>
          <button class="edit-product-button" onclick="editProduct(${product.id})">ویرایش محصول</button>
          <button class="delete-product-button" onclick="deleteProduct(${product.id})">حذف محصول</button>
        </div>`).join('') : '<p>هنوز محصولی اضافه نشده است.</p>';
    } catch (_error) { adminProductsList.innerHTML = '<p>دریافت محصولات انجام نشد.</p>'; }
  }
  loadAdminProducts();

  const addProductButton = document.querySelector('#add-product-button');
  if (addProductButton) addProductButton.addEventListener('click', async () => {
    const name = document.querySelector('#product-name').value.trim();
    const price = toNumber(document.querySelector('#product-price').value);
    const category = document.querySelector('#product-category').value;
    const image = document.querySelector('#product-image').files[0];
    if (!name || !Number.isFinite(price) || price < 0 || !category) return alert('لطفاً اطلاعات محصول را کامل کنید.');
    const formData = new FormData(); formData.append('name', name); formData.append('price', price); formData.append('category', category); if (image) formData.append('image', image);
    try {
      const response = await fetch('/api/products', { method: 'POST', body: formData }); const result = await response.json();
      if (!result.success) return alert(result.message || 'افزودن محصول انجام نشد.');
      alert('محصول با موفقیت اضافه شد ✅'); document.querySelector('#product-name').value = ''; document.querySelector('#product-price').value = ''; document.querySelector('#product-image').value = ''; loadAdminProducts();
    } catch (_error) { alert('ارتباط با سرور برقرار نشد.'); }
  });

  window.editProduct = async function (id) {
    const name = prompt('نام جدید محصول:'); if (name === null) return;
    const price = prompt('قیمت جدید به تومان:'); if (price === null) return;
    const category = prompt('دسته‌بندی: candles / accessories / sets', 'accessories'); if (category === null) return;
    const image = document.createElement('input'); image.type = 'file'; image.accept = 'image/jpeg,image/png,image/webp';
    image.onchange = async () => {
      const formData = new FormData(); formData.append('name', name.trim()); formData.append('price', toNumber(price)); formData.append('category', category.trim()); if (image.files[0]) formData.append('image', image.files[0]);
      try { const response = await fetch(`/api/products/${id}`, { method: 'PATCH', body: formData }); const result = await response.json(); if (!result.success) return alert(result.message || 'ویرایش انجام نشد.'); alert('محصول ویرایش شد ✅'); loadAdminProducts(); }
      catch (_error) { alert('ارتباط با سرور برقرار نشد.'); }
    };
    image.click();
  };

  window.deleteProduct = async function (id) {
    if (!confirm('آیا مطمئن هستید که این محصول حذف شود؟')) return;
    try { const response = await fetch(`/api/products/${id}`, { method: 'DELETE' }); const result = await response.json(); if (!result.success) return alert(result.message || 'حذف انجام نشد.'); loadAdminProducts(); }
    catch (_error) { alert('ارتباط با سرور برقرار نشد.'); }
  };

  const adminOrdersList = document.querySelector('#admin-orders-list');
  const orderSearch = document.querySelector('#order-search');
  const orderStatusFilter = document.querySelector('#order-status-filter');
  let adminOrders = [];

  function renderAdminOrders() {
    if (!adminOrdersList) return;
    const query = (orderSearch?.value || '').trim().toLowerCase();
    const status = orderStatusFilter?.value || 'all';
    const filtered = adminOrders.filter(order => {
      const text = `${order.orderNumber} ${order.customer?.name || ''} ${order.customer?.phone || ''}`.toLowerCase();
      return text.includes(query) && (status === 'all' || order.status === status);
    }).slice().reverse();
    if (!filtered.length) { adminOrdersList.innerHTML = '<div class="admin-empty"><h3>سفارشی پیدا نشد.</h3></div>'; return; }
    adminOrdersList.innerHTML = filtered.map(order => `
      <div class="admin-order">
        <h3>سفارش ${escapeHtml(order.orderNumber)}</h3>
        <div class="order-status"><strong>وضعیت:</strong><select onchange="changeOrderStatus(${order.id}, this.value)">${['جدید','در حال آماده‌سازی','ارسال‌شده','تکمیل‌شده'].map(s => `<option ${order.status === s ? 'selected' : ''}>${s}</option>`).join('')}</select></div>
        <p><strong>نام:</strong> ${escapeHtml(order.customer?.name)}</p><p><strong>موبایل:</strong> ${escapeHtml(order.customer?.phone)}</p><p><strong>آدرس:</strong> ${escapeHtml(order.customer?.address)}</p><p><strong>توضیحات:</strong> ${escapeHtml(order.customer?.description || 'ندارد')}</p><p><strong>تاریخ:</strong> ${escapeHtml(order.date)}</p>
        <p><strong>روش ارسال:</strong> ${order.shipping?.method === 'courier' ? 'ارسال با پیک' : 'ارسال با پست'}</p>
        <hr><h4>محصولات:</h4>
        ${(order.products || []).map(item => `<div class="admin-product"><strong>${escapeHtml(item.name)}</strong><p>تعداد: ${item.quantity}</p><p>مبلغ: ${formatPrice(Number(item.price) * Number(item.quantity))} تومان</p></div>`).join('')}
        <p><strong>مبلغ نهایی:</strong> ${formatPrice(order.total)} تومان</p>
        <button class="delete-order-button" onclick="deleteOrder(${order.id})">حذف سفارش</button>
      </div>`).join('');
  }

  async function loadAdminOrders() {
    if (!adminOrdersList) return;
    try { const response = await fetch('/api/orders'); const result = await response.json(); if (!result.success) throw new Error(); adminOrders = result.orders || []; renderAdminOrders(); }
    catch (_error) { adminOrdersList.innerHTML = '<p>دریافت سفارش‌ها انجام نشد.</p>'; }
  }
  loadAdminOrders();
  orderSearch?.addEventListener('input', renderAdminOrders); orderStatusFilter?.addEventListener('change', renderAdminOrders);

  window.changeOrderStatus = async function (id, status) {
    const response = await fetch(`/api/orders/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) });
    const result = await response.json(); if (!result.success) return alert(result.message || 'تغییر وضعیت انجام نشد.'); loadAdminOrders(); loadAdminStats();
  };
  window.deleteOrder = async function (id) {
    if (!confirm('این سفارش حذف شود؟')) return;
    const response = await fetch(`/api/orders/${id}`, { method: 'DELETE' }); const result = await response.json(); if (!result.success) return alert(result.message || 'حذف انجام نشد.'); loadAdminOrders(); loadAdminStats();
  };

  async function loadAdminStats() {
    const totalOrdersElement = document.querySelector('#total-orders'); if (!totalOrdersElement) return;
    try { const result = await (await fetch('/api/admin/stats')).json(); if (!result.success) return; const s = result.stats; document.querySelector('#total-orders').textContent = s.totalOrders; document.querySelector('#new-orders').textContent = s.newOrders; document.querySelector('#preparing-orders').textContent = s.preparingOrders; document.querySelector('#shipped-orders').textContent = s.shippedOrders; document.querySelector('#completed-orders').textContent = s.completedOrders; document.querySelector('#total-sales').textContent = formatPrice(s.totalSales) + ' تومان'; } catch (_error) {}
  }
  loadAdminStats();

  // ---------- Admin reviews ----------
  const adminReviewsList = document.querySelector('#admin-reviews-list');
  async function loadAdminReviews() {
    if (!adminReviewsList) return;
    try {
      const result = await (await fetch('/api/reviews')).json();
      if (!result.success) throw new Error();
      adminReviewsList.innerHTML = result.reviews.length ? result.reviews.slice().reverse().map(review => `
        <div class="admin-review-item">
          <h3>${escapeHtml(review.productName)} — ${'★'.repeat(review.rating)}${'☆'.repeat(5 - review.rating)}</h3>
          <p><strong>${escapeHtml(review.customerName)}</strong> · سفارش ${escapeHtml(review.orderNumber)}</p>
          <p>${escapeHtml(review.text)}</p>
          <p>وضعیت: ${review.status === 'approved' ? 'تأییدشده' : review.status === 'rejected' ? 'ردشده' : 'در انتظار بررسی'}</p>
          <button onclick="setReviewStatus(${review.id}, 'approved')">تأیید</button>
          <button onclick="setReviewStatus(${review.id}, 'rejected')">رد</button>
          <button onclick="deleteReview(${review.id})">حذف</button>
        </div>`).join('') : '<p>هنوز نظری ثبت نشده است.</p>';
    } catch (_error) { adminReviewsList.innerHTML = '<p>دریافت نظرات انجام نشد.</p>'; }
  }
  loadAdminReviews();
  window.setReviewStatus = async function (id, status) { const result = await (await fetch(`/api/reviews/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) })).json(); if (!result.success) return alert(result.message || 'تغییر وضعیت نظر انجام نشد.'); loadAdminReviews(); };
  window.deleteReview = async function (id) { if (!confirm('این نظر حذف شود؟')) return; const result = await (await fetch(`/api/reviews/${id}`, { method: 'DELETE' })).json(); if (!result.success) return alert(result.message || 'حذف نظر انجام نشد.'); loadAdminReviews(); };

  // ---------- Admin logout ----------
  const logoutButton = document.querySelector('#admin-logout-button');
  if (logoutButton) logoutButton.addEventListener('click', async () => {
    try { const result = await (await fetch('/api/admin/logout', { method: 'POST' })).json(); if (result.success) window.location.href = 'admin-login.html'; else alert(result.message || 'خروج انجام نشد.'); }
    catch (_error) { alert('ارتباط با سرور برقرار نشد.'); }
  });

  updateCartCount();
})();
