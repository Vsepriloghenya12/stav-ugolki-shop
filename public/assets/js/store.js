const state = {
  tg: window.Telegram?.WebApp || null,
  settings: null,
  banners: [],
  bannerIndex: 0,
  bannerTimer: null,
  products: [],
  query: '',
  category: '',
  favoritesOnly: false,
  favorites: loadJson('stav-ugolki-favorites-v1', []),
  cart: loadJson('stav-ugolki-cart-v3', []),
  selectedProductId: '',
  selectedQty: 1
};

const els = {
  brandName: document.getElementById('brandName'),
  bannerTrack: document.getElementById('bannerTrack'),
  bannerDots: document.getElementById('bannerDots'),
  bannerSection: document.getElementById('bannerSection'),
  categoryRow: document.getElementById('categoryRow'),
  productGrid: document.getElementById('productGrid'),
  searchToggle: document.getElementById('searchToggle'),
  searchSheet: document.getElementById('searchSheet'),
  searchInput: document.getElementById('searchInput'),
  productSheet: document.getElementById('productSheet'),
  productSheetTitle: document.getElementById('productSheetTitle'),
  productSheetBody: document.getElementById('productSheetBody'),
  cartSheet: document.getElementById('cartSheet'),
  cartList: document.getElementById('cartList'),
  cartTotalLabel: document.getElementById('cartTotalLabel'),
  checkoutForm: document.getElementById('checkoutForm'),
  checkoutNotice: document.getElementById('checkoutNotice'),
  navMenu: document.getElementById('navMenu'),
  navFavorites: document.getElementById('navFavorites'),
  navCart: document.getElementById('navCart'),
  navFilters: document.getElementById('navFilters'),
  navSupport: document.getElementById('navSupport'),
  cartCountBadge: document.getElementById('cartCountBadge'),
  sheetBackdrop: document.getElementById('sheetBackdrop')
};

function loadJson(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback));
  } catch (_error) {
    return fallback;
  }
}

function saveState() {
  localStorage.setItem('stav-ugolki-favorites-v1', JSON.stringify(state.favorites));
  localStorage.setItem('stav-ugolki-cart-v3', JSON.stringify(state.cart));
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatPrice(value) {
  const currency = state.settings?.currency || 'VND';
  return `${Number(value || 0).toLocaleString('ru-RU')} ${currency}`;
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Ошибка');
  return data;
}

function applyTheme() {
  const settings = state.settings || {};
  const root = document.documentElement;
  root.style.setProperty('--bg', settings.background || '#101214');
  root.style.setProperty('--surface', settings.surface || '#171a1c');
  root.style.setProperty('--text', settings.textPrimary || '#f3ead7');
  root.style.setProperty('--muted', settings.textMuted || '#9ba2a8');
  root.style.setProperty('--accent', settings.accent || '#5a9b87');
  root.style.setProperty('--accent-warm', settings.accentWarm || '#ff3b30');
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
    if (fullName && !els.checkoutForm.elements.name.value) els.checkoutForm.elements.name.value = fullName;
    if (user.username && !els.checkoutForm.elements.telegram.value) els.checkoutForm.elements.telegram.value = `@${user.username}`;
  }
}

function isFavorite(id) {
  return state.favorites.includes(id);
}

function toggleFavorite(id) {
  if (isFavorite(id)) {
    state.favorites = state.favorites.filter((item) => item !== id);
  } else {
    state.favorites.unshift(id);
  }
  saveState();
  renderProducts();
  updateBottomNav();
}

function getVisibleProducts() {
  return state.products.filter((product) => {
    if (!product.inStock) return false;
    if (state.category && product.category !== state.category) return false;
    if (state.favoritesOnly && !isFavorite(product.id)) return false;
    if (state.query) {
      const haystack = [product.name, product.category, product.description, product.slug, product.deepLink].join(' ').toLowerCase();
      if (!haystack.includes(state.query.toLowerCase())) return false;
    }
    return true;
  });
}

function getCartCount() {
  return state.cart.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
}

function getCartTotal() {
  return state.cart.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 0), 0);
}

function updateBottomNav() {
  const count = getCartCount();
  els.cartCountBadge.textContent = count;
  els.cartCountBadge.classList.toggle('hidden', count < 1);
  els.navFavorites.classList.toggle('is-active', state.favoritesOnly);
}

function renderBanners() {
  const items = state.banners || [];
  if (!items.length) {
    els.bannerSection.classList.add('hidden');
    return;
  }
  els.bannerSection.classList.remove('hidden');
  els.bannerTrack.innerHTML = items
    .map((banner) => `
      <a class="banner-link" href="#" data-banner-link="${escapeHtml(banner.link || '')}">
        <img class="banner-image" src="${escapeHtml(banner.image)}" alt="" loading="lazy" />
      </a>
    `)
    .join('');

  els.bannerDots.innerHTML = items
    .map((_, index) => `<button class="banner-dot ${index === state.bannerIndex ? 'is-active' : ''}" type="button" data-banner-dot="${index}"></button>`)
    .join('');

  setBannerIndex(state.bannerIndex, false);
  resetBannerTimer();
}

function setBannerIndex(index, animate = true) {
  const max = Math.max((state.banners?.length || 1) - 1, 0);
  state.bannerIndex = Math.max(0, Math.min(index, max));
  els.bannerTrack.style.transition = animate ? 'transform 0.35s ease' : 'none';
  els.bannerTrack.style.transform = `translateX(-${state.bannerIndex * 100}%)`;
  Array.from(els.bannerDots.querySelectorAll('[data-banner-dot]')).forEach((button, i) => {
    button.classList.toggle('is-active', i === state.bannerIndex);
  });
}

function resetBannerTimer() {
  window.clearInterval(state.bannerTimer);
  if ((state.banners || []).length <= 1) return;
  state.bannerTimer = window.setInterval(() => {
    const next = (state.bannerIndex + 1) % state.banners.length;
    setBannerIndex(next);
  }, 4000);
}

function renderCategoryButtons() {
  Array.from(els.categoryRow.querySelectorAll('[data-category]')).forEach((button) => {
    button.classList.toggle('is-active', button.dataset.category === state.category);
  });
}

function buildProductCard(product) {
  const favoriteClass = isFavorite(product.id) ? 'is-active' : '';
  return `
    <article class="product-card">
      <div class="product-image-wrap" data-open-product="${product.id}">
        <div class="product-actions">
          <button class="mini-action" type="button" data-share-product="${product.id}" aria-label="Поделиться"><span class="mini-icon mini-icon-share"></span></button>
          <button class="mini-action" type="button" data-favorite-product="${product.id}" aria-label="Избранное"><span class="mini-icon mini-icon-heart ${favoriteClass}"></span></button>
        </div>
        <img class="product-image" src="${escapeHtml(product.image)}" alt="${escapeHtml(product.name)}" loading="lazy" />
      </div>
      <button class="product-name" type="button" data-open-product="${product.id}">${escapeHtml(product.name)}</button>
      <div class="price-row">
        <div class="product-price">${formatPrice(product.price)}</div>
        <button class="cart-icon-button" type="button" data-add-product="${product.id}" aria-label="В корзину"><span class="mini-icon mini-icon-cart"></span></button>
      </div>
    </article>
  `;
}

function renderProducts() {
  const products = getVisibleProducts();
  els.productGrid.innerHTML = products.map(buildProductCard).join('');
}

function openSheet(id) {
  els.sheetBackdrop.classList.remove('hidden');
  document.querySelectorAll('.sheet').forEach((sheet) => sheet.classList.add('hidden'));
  document.getElementById(id).classList.remove('hidden');
}

function closeSheets() {
  els.sheetBackdrop.classList.add('hidden');
  document.querySelectorAll('.sheet').forEach((sheet) => sheet.classList.add('hidden'));
}

function getProductById(id) {
  return state.products.find((product) => product.id === id);
}

function openProduct(id) {
  const product = getProductById(id);
  if (!product) return;
  state.selectedProductId = id;
  state.selectedQty = 1;
  els.productSheetTitle.textContent = product.name;
  renderProductSheet();
  openSheet('productSheet');
}

function renderProductSheet() {
  const product = getProductById(state.selectedProductId);
  if (!product) return;
  els.productSheetBody.innerHTML = `
    <img class="sheet-product-image" src="${escapeHtml(product.image)}" alt="${escapeHtml(product.name)}" />
    <div class="sheet-product-price">${formatPrice(product.price)}</div>
    <div class="qty-row">
      <div class="qty-box">
        <button type="button" data-qty="minus">−</button>
        <strong id="selectedQtyLabel">${state.selectedQty}</strong>
        <button type="button" data-qty="plus">+</button>
      </div>
      <button class="submit-button" type="button" data-product-submit="${product.id}">В корзину</button>
    </div>
  `;
}

function addToCart(productId, quantity = 1) {
  const product = getProductById(productId);
  if (!product || !product.inStock) return;
  const item = state.cart.find((entry) => entry.productId === productId);
  if (item) {
    item.quantity += quantity;
  } else {
    state.cart.unshift({
      productId: product.id,
      name: product.name,
      image: product.image,
      price: Number(product.price),
      quantity
    });
  }
  saveState();
  renderCart();
  updateBottomNav();
}

function changeCart(productId, delta) {
  const item = state.cart.find((entry) => entry.productId === productId);
  if (!item) return;
  item.quantity += delta;
  if (item.quantity <= 0) {
    state.cart = state.cart.filter((entry) => entry.productId !== productId);
  }
  saveState();
  renderCart();
  updateBottomNav();
}

function renderCart() {
  els.cartList.innerHTML = state.cart.map((item) => `
    <div class="cart-item">
      <img class="cart-item-image" src="${escapeHtml(item.image)}" alt="${escapeHtml(item.name)}" />
      <div>
        <div class="cart-item-name">${escapeHtml(item.name)}</div>
        <div class="cart-item-price">${formatPrice(item.price * item.quantity)}</div>
      </div>
      <div class="cart-item-controls">
        <button type="button" data-cart-change="1" data-product-id="${item.productId}">+</button>
        <button type="button" data-cart-change="-1" data-product-id="${item.productId}">−</button>
      </div>
    </div>
  `).join('');
  els.cartTotalLabel.textContent = formatPrice(getCartTotal());
}

function setNotice(message = '', type = '') {
  els.checkoutNotice.textContent = message;
  els.checkoutNotice.className = 'sheet-notice';
  if (type) els.checkoutNotice.classList.add(type);
}

async function handleCheckout(event) {
  event.preventDefault();
  if (!state.cart.length) {
    setNotice('Корзина пуста', 'error');
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
    setNotice(result.order.id, 'success');
    if (state.tg?.sendData) {
      state.tg.sendData(JSON.stringify(result.order));
    }
    state.cart = [];
    saveState();
    renderCart();
    updateBottomNav();
    els.checkoutForm.reset();
  } catch (error) {
    setNotice(error.message, 'error');
  }
}

async function shareProduct(productId) {
  const product = getProductById(productId);
  if (!product) return;
  const sharePath = `product=${encodeURIComponent(product.deepLink || product.id)}`;
  const url = `${window.location.origin}${window.location.pathname}?${sharePath}`;
  try {
    if (navigator.share) {
      await navigator.share({ title: product.name, url });
      return;
    }
    await navigator.clipboard.writeText(url);
    if (state.tg?.showPopup) {
      state.tg.showPopup({ title: 'Ссылка', message: 'Скопировано', buttons: [{ type: 'ok' }] });
    }
  } catch (_error) {
    // ignore share cancellation
  }
}

function handleBannerLink(link) {
  if (!link) return;
  if (link.startsWith('http://') || link.startsWith('https://')) {
    if (state.tg?.openLink) state.tg.openLink(link);
    else window.open(link, '_blank', 'noopener');
    return;
  }
  const product = state.products.find((item) => [item.id, item.deepLink, item.slug].includes(link));
  if (product) {
    openProduct(product.id);
  }
}

function openSupport() {
  const value = state.settings?.supportTelegram || '';
  if (!value) return;
  const url = value.startsWith('@') ? `https://t.me/${value.replace('@', '')}` : value;
  if (state.tg?.openTelegramLink && url.startsWith('https://t.me/')) {
    state.tg.openTelegramLink(url);
  } else if (state.tg?.openLink) {
    state.tg.openLink(url);
  } else {
    window.open(url, '_blank', 'noopener');
  }
}

function tryOpenStartParam() {
  const params = new URLSearchParams(window.location.search);
  const needle = params.get('product') || params.get('startapp') || params.get('tgWebAppStartParam') || state.tg?.initDataUnsafe?.start_param;
  if (!needle) return;
  const product = state.products.find((item) => [item.id, item.deepLink, item.slug].includes(needle));
  if (product) openProduct(product.id);
}

function bindEvents() {
  els.searchToggle.addEventListener('click', () => {
    openSheet('searchSheet');
    window.setTimeout(() => els.searchInput.focus(), 50);
  });

  els.searchInput.addEventListener('input', () => {
    state.query = els.searchInput.value.trim();
    renderProducts();
  });

  els.categoryRow.addEventListener('click', (event) => {
    const button = event.target.closest('[data-category]');
    if (!button) return;
    state.category = state.category === button.dataset.category ? '' : button.dataset.category;
    renderCategoryButtons();
    renderProducts();
  });

  els.bannerDots.addEventListener('click', (event) => {
    const button = event.target.closest('[data-banner-dot]');
    if (!button) return;
    setBannerIndex(Number(button.dataset.bannerDot));
    resetBannerTimer();
  });

  els.bannerTrack.addEventListener('click', (event) => {
    const link = event.target.closest('[data-banner-link]');
    if (!link) return;
    event.preventDefault();
    handleBannerLink(link.dataset.bannerLink);
  });

  document.addEventListener('click', (event) => {
    const favoriteButton = event.target.closest('[data-favorite-product]');
    if (favoriteButton) {
      toggleFavorite(favoriteButton.dataset.favoriteProduct);
      return;
    }

    const shareButton = event.target.closest('[data-share-product]');
    if (shareButton) {
      shareProduct(shareButton.dataset.shareProduct);
      return;
    }

    const addButton = event.target.closest('[data-add-product]');
    if (addButton) {
      addToCart(addButton.dataset.addProduct, 1);
      return;
    }

    const productButton = event.target.closest('[data-open-product]');
    if (productButton) {
      openProduct(productButton.dataset.openProduct);
      return;
    }

    const closeButton = event.target.closest('[data-close-sheet]');
    if (closeButton) {
      closeSheets();
      return;
    }

    const cartChangeButton = event.target.closest('[data-cart-change]');
    if (cartChangeButton) {
      changeCart(cartChangeButton.dataset.productId, Number(cartChangeButton.dataset.cartChange));
      return;
    }
  });

  els.sheetBackdrop.addEventListener('click', closeSheets);

  els.productSheetBody.addEventListener('click', (event) => {
    const qtyButton = event.target.closest('[data-qty]');
    if (qtyButton) {
      state.selectedQty += qtyButton.dataset.qty === 'plus' ? 1 : -1;
      if (state.selectedQty < 1) state.selectedQty = 1;
      const label = document.getElementById('selectedQtyLabel');
      if (label) label.textContent = state.selectedQty;
      return;
    }

    const submitButton = event.target.closest('[data-product-submit]');
    if (submitButton) {
      addToCart(submitButton.dataset.productSubmit, state.selectedQty);
      closeSheets();
    }
  });

  els.checkoutForm.addEventListener('submit', handleCheckout);

  els.navMenu.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
  els.navFavorites.addEventListener('click', () => {
    state.favoritesOnly = !state.favoritesOnly;
    renderProducts();
    updateBottomNav();
  });
  els.navCart.addEventListener('click', () => {
    setNotice('', '');
    renderCart();
    openSheet('cartSheet');
  });
  els.navFilters.addEventListener('click', () => {
    els.categoryRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
  els.navSupport.addEventListener('click', openSupport);
}

async function init() {
  try {
    const [settings, banners, products] = await Promise.all([
      fetchJson('/api/settings'),
      fetchJson('/api/banners'),
      fetchJson('/api/products')
    ]);
    state.settings = settings;
    state.banners = banners.items || [];
    state.products = products.items || [];
    applyTheme();
    els.brandName.textContent = settings.storeName || 'Ставь угольки';
    document.title = settings.storeName || 'Ставь угольки';
    initTelegram();
    renderBanners();
    renderCategoryButtons();
    renderProducts();
    renderCart();
    updateBottomNav();
    bindEvents();
    tryOpenStartParam();
  } catch (error) {
    els.productGrid.innerHTML = '';
  }
}

init();
