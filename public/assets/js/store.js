const state = {
  tg: window.Telegram?.WebApp || null,
  settings: null,
  products: [],
  categories: [],
  collections: {},
  query: '',
  filter: 'all',
  cart: loadCart(),
  selectedProductId: null,
  productQty: 1
};

const els = {
  headerSubtitle: document.getElementById('headerSubtitle'),
  heroTitle: document.getElementById('heroTitle'),
  heroSubtitle: document.getElementById('heroSubtitle'),
  heroBadges: document.getElementById('heroBadges'),
  announcementCard: document.getElementById('announcementCard'),
  announcementText: document.getElementById('announcementText'),
  minOrderLabel: document.getElementById('minOrderLabel'),
  deliveryLabel: document.getElementById('deliveryLabel'),
  freeDeliveryLabel: document.getElementById('freeDeliveryLabel'),
  pickupLabel: document.getElementById('pickupLabel'),
  supportMeta: document.getElementById('supportMeta'),
  supportLink: document.getElementById('supportLink'),
  searchInput: document.getElementById('searchInput'),
  categoryFilters: document.getElementById('categoryFilters'),
  featuredRow: document.getElementById('featuredRow'),
  catalogCount: document.getElementById('catalogCount'),
  productGrid: document.getElementById('productGrid'),
  catalogEmpty: document.getElementById('catalogEmpty'),
  cartButton: document.getElementById('cartButton'),
  cartCounter: document.getElementById('cartCounter'),
  stickyCartButton: document.getElementById('stickyCartButton'),
  stickyCartSummary: document.getElementById('stickyCartSummary'),
  productOverlay: document.getElementById('productOverlay'),
  productSheet: document.getElementById('productSheet'),
  productDetail: document.getElementById('productDetail'),
  closeProductButton: document.getElementById('closeProductButton'),
  cartOverlay: document.getElementById('cartOverlay'),
  cartSheet: document.getElementById('cartSheet'),
  closeCartButton: document.getElementById('closeCartButton'),
  clearCartButton: document.getElementById('clearCartButton'),
  cartItems: document.getElementById('cartItems'),
  cartEmpty: document.getElementById('cartEmpty'),
  cartSubtotal: document.getElementById('cartSubtotal'),
  cartDelivery: document.getElementById('cartDelivery'),
  cartTotal: document.getElementById('cartTotal'),
  checkoutForm: document.getElementById('checkoutForm'),
  checkoutNotice: document.getElementById('checkoutNotice'),
  resetFiltersBtn: document.getElementById('resetFiltersBtn')
};

function loadCart() {
  try {
    return JSON.parse(localStorage.getItem('stav-ugolki-cart-v2') || '[]');
  } catch (_error) {
    return [];
  }
}

function saveCart() {
  localStorage.setItem('stav-ugolki-cart-v2', JSON.stringify(state.cart));
}

function formatPrice(value) {
  const currency = state.settings?.currency || '₽';
  return `${Number(value || 0).toLocaleString('ru-RU')} ${currency}`;
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function pluralize(number, forms) {
  const n = Math.abs(number) % 100;
  const n1 = n % 10;
  if (n > 10 && n < 20) return forms[2];
  if (n1 > 1 && n1 < 5) return forms[1];
  if (n1 === 1) return forms[0];
  return forms[2];
}

function applyTheme(settings) {
  const root = document.documentElement;
  root.style.setProperty('--bg', settings.background || '#23282a');
  root.style.setProperty('--bg-soft', settings.surface || '#2d3132');
  root.style.setProperty('--accent', settings.accent || '#5a9b87');
  root.style.setProperty('--text', settings.textPrimary || '#f4ead2');
  root.style.setProperty('--muted', settings.textMuted || '#a8bbb2');
}

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Ошибка запроса');
  }
  return data;
}

function getDeliveryPrice() {
  const form = els.checkoutForm;
  const deliveryType = form.elements.deliveryType.value;
  const subtotal = state.cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  if (deliveryType === 'Самовывоз') return 0;
  if (state.settings?.freeDeliveryFrom && subtotal >= Number(state.settings.freeDeliveryFrom)) {
    return 0;
  }
  return Number(state.settings?.deliveryPrice || 0);
}

function getCartStats() {
  const subtotal = state.cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const count = state.cart.reduce((sum, item) => sum + item.quantity, 0);
  const delivery = count ? getDeliveryPrice() : 0;
  return {
    subtotal,
    delivery,
    total: subtotal + delivery,
    count
  };
}

function updateTelegramMainButton() {
  if (!state.tg) return;
  const stats = getCartStats();
  const mainButton = state.tg.MainButton;
  if (!mainButton) return;

  mainButton.offClick?.(openCart);
  if (stats.count > 0) {
    mainButton.setText(`Корзина · ${formatPrice(stats.total)}`);
    mainButton.show();
    mainButton.onClick(openCart);
  } else {
    mainButton.hide();
  }
}

async function loadSettings() {
  state.settings = await fetchJson('/api/settings');
  applyTheme(state.settings);

  document.title = `${state.settings.storeName || 'Ставь угольки'} — магазин`;
  els.headerSubtitle.textContent = state.settings.headline || 'магазин угля и аксессуаров';
  els.heroTitle.textContent = state.settings.storeName || 'Ставь угольки';
  els.heroSubtitle.textContent = state.settings.subheadline || state.settings.headline || '';
  els.announcementText.textContent = state.settings.announcement || '';
  els.announcementCard.classList.toggle('hidden', !state.settings.announcement);
  els.minOrderLabel.textContent = formatPrice(state.settings.minOrder || 0);
  els.deliveryLabel.textContent = formatPrice(state.settings.deliveryPrice || 0);
  els.freeDeliveryLabel.textContent = state.settings.freeDeliveryFrom ? formatPrice(state.settings.freeDeliveryFrom) : '—';
  els.pickupLabel.textContent = state.settings.city || 'Самовывоз';
  els.supportMeta.textContent = `${state.settings.workingHours || 'ежедневно'} · ${state.settings.supportPhone || 'по запросу'}`;
  els.supportLink.href = state.settings.supportTelegram?.startsWith('@')
    ? `https://t.me/${state.settings.supportTelegram.replace('@', '')}`
    : '#';
  els.supportLink.style.display = els.supportLink.href === '#' ? 'none' : 'inline-flex';

  els.heroBadges.innerHTML = (state.settings.heroBadges || [])
    .map((badge) => `<span class="tag-pill">${escapeHtml(badge)}</span>`)
    .join('');
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
    const fullName = [user.first_name, user.last_name].filter(Boolean).join(' ');
    if (fullName && !els.checkoutForm.elements.name.value) {
      els.checkoutForm.elements.name.value = fullName;
    }
    if (user.username && !els.checkoutForm.elements.telegram.value) {
      els.checkoutForm.elements.telegram.value = `@${user.username}`;
    }
  }
}

async function loadProducts() {
  const payload = await fetchJson('/api/products?all=1');
  state.products = payload.items || [];
  state.categories = payload.categories || [];
  state.collections = payload.collections || {};
  syncCartWithProducts();
  renderFilters();
  renderFeatured();
  renderProducts();
}

function syncCartWithProducts() {
  state.cart = state.cart
    .map((item) => {
      const product = state.products.find((entry) => entry.id === item.productId);
      if (!product || !product.inStock) return null;
      return {
        productId: product.id,
        name: product.name,
        price: product.price,
        image: product.image,
        quantity: item.quantity
      };
    })
    .filter(Boolean);
  saveCart();
}

function renderFilters() {
  const filters = ['all', ...state.categories];
  els.categoryFilters.innerHTML = filters
    .map((category) => {
      const active = state.filter === category ? 'is-active' : '';
      const label = category === 'all' ? 'Все' : category;
      return `<button class="filter-pill ${active}" type="button" data-category="${escapeHtml(category)}">${escapeHtml(label)}</button>`;
    })
    .join('');
}

function getVisibleProducts() {
  return state.products.filter((product) => {
    const matchesStock = product.inStock;
    const matchesCategory = state.filter === 'all' || product.category === state.filter;
    const haystack = [product.name, product.subtitle, product.description, product.category, product.brand, ...(product.tags || [])]
      .join(' ')
      .toLowerCase();
    const matchesQuery = !state.query || haystack.includes(state.query.toLowerCase());
    return matchesStock && matchesCategory && matchesQuery;
  });
}

function buildProductCard(product) {
  const inCart = state.cart.find((item) => item.productId === product.id);
  return `
    <article class="product-card">
      <div class="product-image">
        ${product.badge ? `<span class="badge-float">${escapeHtml(product.badge)}</span>` : ''}
        <img src="${product.image}" alt="${escapeHtml(product.name)}" loading="lazy" />
      </div>
      <div class="product-card-body">
        <div class="card-topline">
          <div>
            <div class="eyebrow">${escapeHtml(product.category || '')}</div>
            <h3>${escapeHtml(product.name)}</h3>
          </div>
          <span class="tag-pill">★ ${Number(product.rating || 4.8).toFixed(1)}</span>
        </div>
        <p>${escapeHtml(product.subtitle || product.description || '')}</p>
        <div class="detail-pills">
          ${product.pack ? `<span class="tag-pill">${escapeHtml(product.pack)}</span>` : ''}
          ${product.heat ? `<span class="tag-pill">${escapeHtml(product.heat)}</span>` : ''}
        </div>
        <div class="price-row">
          <span class="price-current">${formatPrice(product.price)}</span>
          ${product.oldPrice ? `<span class="price-old">${formatPrice(product.oldPrice)}</span>` : ''}
        </div>
        <div class="card-actions">
          <button class="secondary-button" type="button" data-open-product="${product.id}">Открыть</button>
          <button class="primary-button" type="button" data-add-fast="${product.id}">${inCart ? 'Ещё' : 'В корзину'}</button>
        </div>
      </div>
    </article>
  `;
}

function renderProducts() {
  const products = getVisibleProducts();
  els.catalogCount.textContent = `${products.length} ${pluralize(products.length, ['товар', 'товара', 'товаров'])}`;
  els.catalogEmpty.classList.toggle('hidden', products.length > 0);
  els.productGrid.innerHTML = products.map(buildProductCard).join('');
}

function renderFeatured() {
  const items = (state.collections.featured || []).slice(0, 6);
  els.featuredRow.innerHTML = items
    .map((product) => `
      <article class="featured-card">
        <div class="featured-cover">
          <img src="${product.image}" alt="${escapeHtml(product.name)}" loading="lazy" />
        </div>
        <div class="card-topline">
          <div>
            <div class="eyebrow">${escapeHtml(product.category || '')}</div>
            <h3>${escapeHtml(product.name)}</h3>
          </div>
          ${product.badge ? `<span class="tag-pill">${escapeHtml(product.badge)}</span>` : ''}
        </div>
        <p>${escapeHtml(product.subtitle || product.description || '')}</p>
        <div class="price-row">
          <span class="price-current">${formatPrice(product.price)}</span>
          ${product.oldPrice ? `<span class="price-old">${formatPrice(product.oldPrice)}</span>` : ''}
        </div>
        <div class="card-actions">
          <button class="secondary-button" type="button" data-open-product="${product.id}">Подробнее</button>
          <button class="primary-button" type="button" data-add-fast="${product.id}">В корзину</button>
        </div>
      </article>
    `)
    .join('');
}

function setProductQuantity(nextValue) {
  state.productQty = Math.max(1, Number(nextValue || 1));
  const qtyLabel = document.getElementById('productQtyLabel');
  if (qtyLabel) qtyLabel.textContent = state.productQty;
}

function getSelectedProduct() {
  return state.products.find((product) => product.id === state.selectedProductId);
}

function openProduct(productId) {
  state.selectedProductId = productId;
  state.productQty = 1;
  renderProductDetail();
  els.productOverlay.classList.add('is-open');
  els.productSheet.classList.add('is-open');
}

function closeProduct() {
  els.productOverlay.classList.remove('is-open');
  els.productSheet.classList.remove('is-open');
}

function renderProductDetail() {
  const product = getSelectedProduct();
  if (!product) return;

  const inCart = state.cart.find((item) => item.productId === product.id);
  els.productDetail.innerHTML = `
    <div class="product-detail-cover">
      <img src="${product.image}" alt="${escapeHtml(product.name)}" />
    </div>
    <div class="product-detail-meta">
      <div class="detail-pills">
        ${product.badge ? `<span class="tag-pill">${escapeHtml(product.badge)}</span>` : ''}
        <span class="tag-pill">${escapeHtml(product.category)}</span>
        <span class="tag-pill">★ ${Number(product.rating || 4.8).toFixed(1)}</span>
      </div>
      <h2>${escapeHtml(product.name)}</h2>
      <p>${escapeHtml(product.description || product.subtitle || '')}</p>
      <div class="detail-pills">
        ${product.pack ? `<span class="tag-pill">${escapeHtml(product.pack)}</span>` : ''}
        ${product.heat ? `<span class="tag-pill">${escapeHtml(product.heat)}</span>` : ''}
        <span class="tag-pill">Остаток: ${Number(product.stockCount || 0)} ${escapeHtml(product.unit || 'шт.')}</span>
      </div>
      <div class="price-row">
        <span class="price-current">${formatPrice(product.price)}</span>
        ${product.oldPrice ? `<span class="price-old">${formatPrice(product.oldPrice)}</span>` : ''}
      </div>
      <div class="qty-row">
        <div class="qty-box">
          <button type="button" data-product-qty="decrease">−</button>
          <strong id="productQtyLabel">${state.productQty}</strong>
          <button type="button" data-product-qty="increase">+</button>
        </div>
        <div class="muted-text">${inCart ? `Уже в корзине: ${inCart.quantity}` : 'Можно добавить несколько упаковок сразу'}</div>
      </div>
      <div class="card-actions">
        <button class="secondary-button" type="button" data-product-action="buy-now">Купить сейчас</button>
        <button class="primary-button" type="button" data-product-action="add">${inCart ? 'Добавить ещё' : 'В корзину'}</button>
      </div>
    </div>
  `;
}

function addToCart(productId, quantity = 1) {
  const product = state.products.find((item) => item.id === productId && item.inStock);
  if (!product) return;

  const existing = state.cart.find((item) => item.productId === productId);
  if (existing) {
    existing.quantity += quantity;
  } else {
    state.cart.push({
      productId: product.id,
      name: product.name,
      price: Number(product.price),
      image: product.image,
      quantity
    });
  }

  saveCart();
  renderFeatured();
  renderProducts();
  renderCart();
  updateTelegramMainButton();
}

function openCart() {
  closeProduct();
  els.cartOverlay.classList.add('is-open');
  els.cartSheet.classList.add('is-open');
}

function closeCart() {
  els.cartOverlay.classList.remove('is-open');
  els.cartSheet.classList.remove('is-open');
}

function updateCartQuantity(productId, action) {
  const item = state.cart.find((entry) => entry.productId === productId);
  if (!item) return;

  if (action === 'increase') item.quantity += 1;
  if (action === 'decrease') item.quantity -= 1;
  if (action === 'remove' || item.quantity <= 0) {
    state.cart = state.cart.filter((entry) => entry.productId !== productId);
  }

  saveCart();
  renderProducts();
  renderFeatured();
  renderCart();
  updateTelegramMainButton();
}

function clearCart() {
  state.cart = [];
  saveCart();
  renderProducts();
  renderFeatured();
  renderCart();
  updateTelegramMainButton();
}

function renderCart() {
  const stats = getCartStats();
  els.cartCounter.textContent = stats.count;
  els.cartSubtotal.textContent = formatPrice(stats.subtotal);
  els.cartDelivery.textContent = formatPrice(stats.delivery);
  els.cartTotal.textContent = formatPrice(stats.total);
  els.stickyCartSummary.textContent = stats.count ? `${stats.count} · ${formatPrice(stats.total)}` : formatPrice(0);

  const hasItems = state.cart.length > 0;
  els.cartEmpty.classList.toggle('hidden', hasItems);
  els.stickyCartButton.classList.toggle('hidden', !hasItems);

  els.cartItems.innerHTML = state.cart
    .map((item) => `
      <div class="cart-item">
        <div class="card-topline">
          <div>
            <div class="cart-item-title">${escapeHtml(item.name)}</div>
            <div class="muted-text">${formatPrice(item.price)} × ${item.quantity}</div>
          </div>
          <strong>${formatPrice(item.price * item.quantity)}</strong>
        </div>
        <div class="qty-controls">
          <button type="button" data-cart-action="decrease" data-product-id="${item.productId}">−</button>
          <button type="button" data-cart-action="increase" data-product-id="${item.productId}">+</button>
          <button class="secondary-button" type="button" data-cart-action="remove" data-product-id="${item.productId}">Удалить</button>
        </div>
      </div>
    `)
    .join('');

  if (!hasItems) {
    showNotice('', '');
  }
}

function showNotice(message, type) {
  els.checkoutNotice.textContent = message;
  els.checkoutNotice.className = 'notice';
  if (message && type) {
    els.checkoutNotice.classList.add(type);
  }
}

async function handleCheckout(event) {
  event.preventDefault();

  if (!state.cart.length) {
    showNotice('Добавьте товары в корзину', 'error');
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

    showNotice(`Заказ ${result.order.id} оформлен. Мы скоро напишем вам.`, 'success');

    if (state.tg?.sendData) {
      state.tg.sendData(JSON.stringify(result.order));
      state.tg.showPopup?.({
        title: 'Заказ принят',
        message: `Номер заказа: ${result.order.id}`,
        buttons: [{ type: 'ok' }]
      });
    }

    clearCart();
    els.checkoutForm.reset();
    els.checkoutForm.elements.deliveryType.value = 'Доставка';
    closeCart();
  } catch (error) {
    showNotice(error.message, 'error');
  }
}

function tryOpenDeepLinkedProduct() {
  const params = new URLSearchParams(window.location.search);
  const deepLinkValue =
    params.get('product') ||
    params.get('startapp') ||
    params.get('tgWebAppStartParam') ||
    state.tg?.initDataUnsafe?.start_param;

  if (!deepLinkValue) return;
  const product = state.products.find((item) =>
    [item.id, item.slug, item.deepLink].filter(Boolean).includes(deepLinkValue)
  );
  if (product) {
    openProduct(product.id);
  }
}

function bindEvents() {
  els.searchInput.addEventListener('input', (event) => {
    state.query = event.target.value.trim();
    renderProducts();
  });

  els.categoryFilters.addEventListener('click', (event) => {
    const button = event.target.closest('[data-category]');
    if (!button) return;
    state.filter = button.dataset.category;
    renderFilters();
    renderProducts();
  });

  els.resetFiltersBtn.addEventListener('click', () => {
    state.filter = 'all';
    state.query = '';
    els.searchInput.value = '';
    renderFilters();
    renderProducts();
  });

  document.addEventListener('click', (event) => {
    const openButton = event.target.closest('[data-open-product]');
    const fastAddButton = event.target.closest('[data-add-fast]');
    if (openButton) {
      openProduct(openButton.dataset.openProduct);
    }
    if (fastAddButton) {
      addToCart(fastAddButton.dataset.addFast, 1);
    }
  });

  els.productDetail.addEventListener('click', (event) => {
    const qtyButton = event.target.closest('[data-product-qty]');
    if (qtyButton) {
      setProductQuantity(state.productQty + (qtyButton.dataset.productQty === 'increase' ? 1 : -1));
    }

    const actionButton = event.target.closest('[data-product-action]');
    if (!actionButton) return;

    const product = getSelectedProduct();
    if (!product) return;

    addToCart(product.id, state.productQty);
    if (actionButton.dataset.productAction === 'buy-now') {
      closeProduct();
      openCart();
    } else {
      renderProductDetail();
    }
  });

  els.cartItems.addEventListener('click', (event) => {
    const button = event.target.closest('[data-cart-action]');
    if (!button) return;
    updateCartQuantity(button.dataset.productId, button.dataset.cartAction);
  });

  els.cartButton.addEventListener('click', openCart);
  els.stickyCartButton.addEventListener('click', openCart);
  els.closeCartButton.addEventListener('click', closeCart);
  els.cartOverlay.addEventListener('click', closeCart);

  els.closeProductButton.addEventListener('click', closeProduct);
  els.productOverlay.addEventListener('click', closeProduct);

  els.clearCartButton.addEventListener('click', clearCart);
  els.checkoutForm.addEventListener('submit', handleCheckout);
  els.checkoutForm.elements.deliveryType.addEventListener('change', renderCart);
}

async function init() {
  try {
    await loadSettings();
    initTelegram();
    bindEvents();
    await loadProducts();
    renderCart();
    updateTelegramMainButton();
    tryOpenDeepLinkedProduct();
  } catch (error) {
    els.productGrid.innerHTML = `<div class="empty-state"><h3>Не удалось загрузить магазин</h3><p>${escapeHtml(error.message)}</p></div>`;
  }
}

init();
