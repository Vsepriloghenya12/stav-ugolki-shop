const state = {
  settings: null,
  products: [],
  categories: [],
  filter: 'all',
  query: '',
  cart: loadCart(),
  isCartOpen: false,
  tg: window.Telegram?.WebApp || null
};

const els = {
  topbarSubtitle: document.getElementById('topbarSubtitle'),
  heroTitle: document.getElementById('heroTitle'),
  heroSubtitle: document.getElementById('heroSubtitle'),
  heroBadges: document.getElementById('heroBadges'),
  announcementBox: document.getElementById('announcementBox'),
  minOrderLabel: document.getElementById('minOrderLabel'),
  deliveryLabel: document.getElementById('deliveryLabel'),
  supportHandleLabel: document.getElementById('supportHandleLabel'),
  workingHoursLabel: document.getElementById('workingHoursLabel'),
  supportLink: document.getElementById('supportLink'),
  searchInput: document.getElementById('searchInput'),
  categoryFilters: document.getElementById('categoryFilters'),
  productGrid: document.getElementById('productGrid'),
  catalogCount: document.getElementById('catalogCount'),
  catalogEmpty: document.getElementById('catalogEmpty'),
  cartItems: document.getElementById('cartItems'),
  cartEmpty: document.getElementById('cartEmpty'),
  cartSubtotal: document.getElementById('cartSubtotal'),
  cartDelivery: document.getElementById('cartDelivery'),
  cartTotal: document.getElementById('cartTotal'),
  mobileCartTotal: document.getElementById('mobileCartTotal'),
  cartCounter: document.getElementById('cartCounter'),
  checkoutForm: document.getElementById('checkoutForm'),
  checkoutNotice: document.getElementById('checkoutNotice'),
  cartButton: document.getElementById('cartButton'),
  mobileCartToggle: document.getElementById('mobileCartToggle'),
  checkoutCard: document.getElementById('checkoutCard'),
  cartOverlay: document.getElementById('cartOverlay'),
  closeCartMobile: document.getElementById('closeCartMobile'),
  clearCartBtn: document.getElementById('clearCartBtn'),
  footerNote: document.getElementById('footerNote')
};

function loadCart() {
  try {
    return JSON.parse(localStorage.getItem('stav-ugolki-cart') || '[]');
  } catch (_error) {
    return [];
  }
}

function saveCart() {
  localStorage.setItem('stav-ugolki-cart', JSON.stringify(state.cart));
}

function formatPrice(value) {
  const currency = state.settings?.currency || '₽';
  return `${Number(value || 0).toLocaleString('ru-RU')} ${currency}`;
}

function getDeliveryPrice() {
  const deliveryType = new FormData(els.checkoutForm).get('deliveryType');
  return deliveryType === 'Самовывоз' ? 0 : Number(state.settings?.deliveryPrice || 0);
}

function getCartStats() {
  const subtotal = state.cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const delivery = state.cart.length ? getDeliveryPrice() : 0;
  return {
    count: state.cart.reduce((sum, item) => sum + item.quantity, 0),
    subtotal,
    delivery,
    total: subtotal + delivery
  };
}

function applyTheme(settings) {
  const root = document.documentElement;
  root.style.setProperty('--bg', settings.background || '#1e2628');
  root.style.setProperty('--bg-soft', settings.surface || '#243033');
  root.style.setProperty('--accent', settings.accent || '#58b8aa');
  root.style.setProperty('--text', settings.textPrimary || '#f2ead5');
  root.style.setProperty('--muted', settings.textMuted || '#9db2ad');
}

function initTelegram() {
  if (!state.tg) return;

  state.tg.ready();
  state.tg.expand();
  state.tg.disableVerticalSwipes?.();

  if (state.settings?.background) {
    state.tg.setBackgroundColor?.(state.settings.background);
    state.tg.setHeaderColor?.(state.settings.background);
  }

  const user = state.tg.initDataUnsafe?.user;
  if (user) {
    const name = [user.first_name, user.last_name].filter(Boolean).join(' ');
    if (name && !els.checkoutForm.elements.name.value) {
      els.checkoutForm.elements.name.value = name;
    }
    if (user.username && !els.checkoutForm.elements.telegram.value) {
      els.checkoutForm.elements.telegram.value = `@${user.username}`;
    }
  }
}

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Ошибка запроса');
  }
  return data;
}

async function loadSettings() {
  state.settings = await fetchJson('/api/settings');
  applyTheme(state.settings);

  document.title = `${state.settings.storeName || 'Ставь угольки'} — магазин`;
  els.topbarSubtitle.textContent = state.settings.headline || 'магазин угля и аксессуаров';
  els.heroTitle.textContent = state.settings.storeName || 'Ставь угольки';
  els.heroSubtitle.textContent = state.settings.headline || 'Уголь, розжиг и аксессуары — в один тап внутри Telegram.';
  els.announcementBox.textContent = state.settings.announcement || '';
  els.announcementBox.style.display = state.settings.announcement ? 'flex' : 'none';
  els.minOrderLabel.textContent = formatPrice(state.settings.minOrder || 0);
  els.deliveryLabel.textContent = formatPrice(state.settings.deliveryPrice || 0);
  els.supportHandleLabel.textContent = state.settings.supportTelegram || '—';
  els.workingHoursLabel.textContent = state.settings.workingHours || '—';
  const supportLink = state.settings.supportTelegram?.startsWith('@')
    ? `https://t.me/${state.settings.supportTelegram.replace('@', '')}`
    : '';
  els.supportLink.href = supportLink || '#';
  els.supportLink.style.display = supportLink ? 'inline-flex' : 'none';
  els.footerNote.textContent = `Самовывоз: ${state.settings.pickupAddress || 'по запросу'} · Поддержка: ${state.settings.supportPhone || '—'}`;

  els.heroBadges.innerHTML = (state.settings.heroBadges || [])
    .map((badge) => `<span class="badge">${badge}</span>`)
    .join('');
}

async function loadProducts() {
  const payload = await fetchJson('/api/products?all=1');
  state.products = payload.items || [];
  state.categories = payload.categories || [];
  renderFilters();
  renderProducts();
  syncCartWithProducts();
}

function syncCartWithProducts() {
  state.cart = state.cart
    .map((cartItem) => {
      const product = state.products.find((item) => item.id === cartItem.productId);
      if (!product || !product.inStock) return null;
      return {
        ...cartItem,
        name: product.name,
        price: product.price,
        image: product.image
      };
    })
    .filter(Boolean);
  saveCart();
  renderCart();
}

function renderFilters() {
  const buttons = ['all', ...state.categories].map((category) => {
    const label = category === 'all' ? 'Все' : category;
    const active = state.filter === category ? 'is-active' : '';
    return `<button class="filter-chip ${active}" type="button" data-category="${category}">${label}</button>`;
  });
  els.categoryFilters.innerHTML = buttons.join('');
}

function getVisibleProducts() {
  return state.products.filter((product) => {
    const matchesStock = product.inStock;
    const matchesCategory = state.filter === 'all' || product.category === state.filter;
    const query = state.query.trim().toLowerCase();
    const haystack = [product.name, product.description, product.category].join(' ').toLowerCase();
    const matchesQuery = !query || haystack.includes(query);
    return matchesStock && matchesCategory && matchesQuery;
  });
}

function renderProducts() {
  const visible = getVisibleProducts();
  els.catalogCount.textContent = `${visible.length} ${pluralize(visible.length, ['товар', 'товара', 'товаров'])}`;
  els.catalogEmpty.classList.toggle('hidden', visible.length !== 0);

  els.productGrid.innerHTML = visible
    .map((product) => {
      const inCart = state.cart.find((item) => item.productId === product.id);
      return `
        <article class="product-card">
          <div class="product-cover">
            <img src="${product.image}" alt="${escapeHtml(product.name)}" loading="lazy" />
          </div>
          <div class="product-body">
            <div class="product-topline">
              <div>
                <div class="card-tags">
                  <span class="tag">${product.category}</span>
                  ${product.featured ? '<span class="tag featured">Хит</span>' : ''}
                </div>
                <h3>${product.name}</h3>
              </div>
              <span class="tag">★ ${product.rating || 4.8}</span>
            </div>
            <p>${product.description}</p>
            <div class="price-row">
              <span class="price">${formatPrice(product.price)}</span>
              ${product.oldPrice ? `<span class="old-price">${formatPrice(product.oldPrice)}</span>` : ''}
            </div>
            <div class="card-tags">
              <span class="tag">Остаток: ${product.stockCount || 0} ${product.unit || 'шт'}</span>
            </div>
            <div class="card-actions">
              <button class="primary-btn" type="button" data-add-to-cart="${product.id}">
                ${inCart ? 'Добавить ещё' : 'В корзину'}
              </button>
            </div>
          </div>
        </article>
      `;
    })
    .join('');
}

function renderCart() {
  const { subtotal, delivery, total, count } = getCartStats();
  els.cartCounter.textContent = count;
  els.cartSubtotal.textContent = formatPrice(subtotal);
  els.cartDelivery.textContent = formatPrice(delivery);
  els.cartTotal.textContent = formatPrice(total);
  els.mobileCartTotal.textContent = formatPrice(total);

  const hasItems = state.cart.length > 0;
  els.cartEmpty.classList.toggle('hidden', hasItems);
  els.cartItems.innerHTML = state.cart
    .map((item) => `
      <div class="cart-item">
        <div>
          <div class="cart-item-title">${item.name}</div>
          <div class="muted">${formatPrice(item.price)} · ${item.quantity} ${pluralize(item.quantity, ['шт', 'шт', 'шт'])}</div>
          <div class="qty-controls">
            <button type="button" data-qty-action="decrease" data-product-id="${item.productId}">−</button>
            <strong>${item.quantity}</strong>
            <button type="button" data-qty-action="increase" data-product-id="${item.productId}">+</button>
            <button class="secondary-btn" type="button" data-qty-action="remove" data-product-id="${item.productId}">Удалить</button>
          </div>
        </div>
        <strong>${formatPrice(item.price * item.quantity)}</strong>
      </div>
    `)
    .join('');

  if (!hasItems) {
    showNotice('', '');
  }

  saveCart();
}

function showNotice(message, type) {
  els.checkoutNotice.className = 'notice';
  els.checkoutNotice.textContent = message;
  if (message) {
    els.checkoutNotice.classList.add(type);
  }
}

function addToCart(productId) {
  const product = state.products.find((item) => item.id === productId && item.inStock);
  if (!product) return;

  const existing = state.cart.find((item) => item.productId === productId);
  if (existing) {
    existing.quantity += 1;
  } else {
    state.cart.push({
      productId: product.id,
      name: product.name,
      price: Number(product.price),
      image: product.image,
      quantity: 1
    });
  }

  renderProducts();
  renderCart();
  if (window.innerWidth <= 860) {
    toggleCart(true);
  }
}

function updateQuantity(productId, action) {
  const item = state.cart.find((entry) => entry.productId === productId);
  if (!item) return;

  if (action === 'increase') item.quantity += 1;
  if (action === 'decrease') item.quantity -= 1;
  if (action === 'remove' || item.quantity <= 0) {
    state.cart = state.cart.filter((entry) => entry.productId !== productId);
  }
  renderCart();
}

function clearCart() {
  state.cart = [];
  renderProducts();
  renderCart();
}

function toggleCart(force) {
  state.isCartOpen = typeof force === 'boolean' ? force : !state.isCartOpen;
  els.checkoutCard.classList.toggle('is-open', state.isCartOpen);
  els.cartOverlay.classList.toggle('is-open', state.isCartOpen);
}

function pluralize(number, forms) {
  const n = Math.abs(number) % 100;
  const n1 = n % 10;
  if (n > 10 && n < 20) return forms[2];
  if (n1 > 1 && n1 < 5) return forms[1];
  if (n1 === 1) return forms[0];
  return forms[2];
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

async function handleCheckout(event) {
  event.preventDefault();
  if (!state.cart.length) {
    showNotice('Добавьте хотя бы один товар в корзину', 'error');
    return;
  }

  const formData = new FormData(els.checkoutForm);
  const payload = {
    customer: Object.fromEntries(formData.entries()),
    items: state.cart.map((item) => ({ productId: item.productId, quantity: item.quantity })),
    source: state.tg ? 'telegram-mini-app' : 'web'
  };

  try {
    const result = await fetchJson('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    showNotice(`Заказ ${result.order.id} оформлен. Мы скоро свяжемся с вами.`, 'success');

    if (state.tg?.sendData) {
      state.tg.sendData(JSON.stringify(result.order));
      state.tg.MainButton?.hide?.();
      state.tg.showPopup?.({
        title: 'Заказ принят',
        message: `Номер заказа: ${result.order.id}`,
        buttons: [{ type: 'ok' }]
      });
    }

    clearCart();
    els.checkoutForm.reset();
    els.checkoutForm.elements.deliveryType.value = 'Доставка';
    if (window.innerWidth <= 860) {
      toggleCart(false);
    }
  } catch (error) {
    showNotice(error.message, 'error');
  }
}

function bindEvents() {
  els.searchInput.addEventListener('input', (event) => {
    state.query = event.target.value;
    renderProducts();
  });

  els.categoryFilters.addEventListener('click', (event) => {
    const button = event.target.closest('[data-category]');
    if (!button) return;
    state.filter = button.dataset.category;
    renderFilters();
    renderProducts();
  });

  els.productGrid.addEventListener('click', (event) => {
    const button = event.target.closest('[data-add-to-cart]');
    if (!button) return;
    addToCart(button.dataset.addToCart);
  });

  els.cartItems.addEventListener('click', (event) => {
    const button = event.target.closest('[data-qty-action]');
    if (!button) return;
    updateQuantity(button.dataset.productId, button.dataset.qtyAction);
  });

  els.checkoutForm.addEventListener('submit', handleCheckout);
  els.checkoutForm.elements.deliveryType.addEventListener('change', renderCart);

  els.cartButton.addEventListener('click', () => toggleCart(true));
  els.mobileCartToggle.addEventListener('click', () => toggleCart(true));
  els.closeCartMobile.addEventListener('click', () => toggleCart(false));
  els.cartOverlay.addEventListener('click', () => toggleCart(false));
  els.clearCartBtn.addEventListener('click', clearCart);
}

async function init() {
  try {
    await loadSettings();
    initTelegram();
    await loadProducts();
    bindEvents();
    renderCart();
  } catch (error) {
    els.productGrid.innerHTML = `<div class="empty-state"><h3>Не удалось загрузить магазин</h3><p>${error.message}</p></div>`;
  }
}

init();
