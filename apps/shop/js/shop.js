import { createShopHelpers } from './modules/shop-helpers.js';
import { createShopUi } from './modules/shop-ui.js';

(function () {
  const STORAGE_KEYS = {
    likes: 'stav:likes',
    cart: 'stav:cart:v47',
    selectedVariants: 'stav:selectedVariants:v47',
    secretTheme: 'stav:secret-theme:v1',
    orderHistory: 'stav:order-history:v47'
  };

  const state = {
    products: [],
    brands: [],
    banners: [],
    supportContacts: [],
    filters: {
      category: 'all',
      brand: 'all',
      priceMin: '',
      priceMax: ''
    },
    search: '',
    favorites: load(STORAGE_KEYS.likes, []),
    cart: load(STORAGE_KEYS.cart, []),
    selectedVariants: load(STORAGE_KEYS.selectedVariants, {}),
    view: 'catalog',
    orderHistory: load(STORAGE_KEYS.orderHistory, []),
    activeBanner: 0,
    bannerTimer: null,
    activeProductId: '',
    deferredPrompt: null,
    bannerGesture: { startX: 0, deltaX: 0, active: false },
    suppressBannerClick: false,
    secretTheme: {
      active: load(STORAGE_KEYS.secretTheme, false),
      loading: null,
      config: null,
      tapMarks: [],
      switching: false
    }
  };

  const el = {
    bannerSection: document.getElementById('bannerSection'),
    bannerTrack: document.getElementById('bannerTrack'),
    bannerDots: document.getElementById('bannerDots'),
    categoryRow: document.getElementById('categoryRow'),
    brandSubfilters: document.getElementById('brandSubfilters'),
    productGrid: document.getElementById('productGrid'),
    sheetBackdrop: document.getElementById('sheetBackdrop'),
    menuSheet: document.getElementById('menuSheet'),
    searchSheet: document.getElementById('searchSheet'),
    filterSheet: document.getElementById('filterSheet'),
    productSheet: document.getElementById('productSheet'),
    cartSheet: document.getElementById('cartSheet'),
    supportSheet: document.getElementById('supportSheet'),
    historySheet: document.getElementById('historySheet'),
    orderSuccessModal: document.getElementById('orderSuccessModal'),
    successModalCloseBtn: document.getElementById('successModalCloseBtn'),
    quickFilterToggle: document.getElementById('quickFilterToggle'),
    heroLogoButton: document.getElementById('heroLogoButton'),
    searchForm: document.getElementById('searchForm'),
    searchInput: document.getElementById('searchInput'),
    menuCatalogBtn: document.getElementById('menuCatalogBtn'),
    menuOrdersBtn: document.getElementById('menuOrdersBtn'),
    installAppBtn: document.getElementById('installAppBtn'),
    filterCategoryGrid: document.getElementById('filterCategoryGrid'),
    filterBrandGrid: document.getElementById('filterBrandGrid'),
    priceMinInput: document.getElementById('priceMinInput'),
    priceMaxInput: document.getElementById('priceMaxInput'),
    applyFiltersBtn: document.getElementById('applyFiltersBtn'),
    resetFiltersBtn: document.getElementById('resetFiltersBtn'),
    productSheetTitle: document.getElementById('productSheetTitle'),
    productSheetBody: document.getElementById('productSheetBody'),
    supportList: document.getElementById('supportList'),
    historyList: document.getElementById('historyList'),
    cartList: document.getElementById('cartList'),
    cartTotalLabel: document.getElementById('cartTotalLabel'),
    cartCountBadge: document.getElementById('cartCountBadge'),
    checkoutForm: document.getElementById('checkoutForm'),
    checkoutNotice: document.getElementById('checkoutNotice'),
    cartHistoryBtn: document.getElementById('cartHistoryBtn'),
    navMenu: document.getElementById('navMenu'),
    navFavorites: document.getElementById('navFavorites'),
    navCart: document.getElementById('navCart'),
    navSearch: document.getElementById('navSearch'),
    navSupport: document.getElementById('navSupport'),
    appLoader: document.getElementById('appLoader'),
    appLoaderLogo: document.getElementById('appLoaderLogo'),
    heroLogoImage: document.getElementById('heroLogoImage')
  };

  const {
    isPhoneLike,
    pulseHaptic,
    money,
    escapeHtml,
    mediaKind,
    productSupportsVariants,
    categories,
    quickCategories,
    brandRecordsForCategory,
    brandsForCategory,
    variantStock,
    hasAvailableVariant,
    currentVariant,
    totalStock,
    cartEntryKey,
    cartQty,
    cartTotalQty,
    maxQtyFor,
    activeProducts,
    sortProductsForDisplay,
    historyStatusLabel,
    productById,
    selectedVariantForProduct,
    shouldDisplayProduct
  } = createShopHelpers({ state, save, STORAGE_KEYS });

  const {
    icon,
    fallbackVisual,
    productBadgesHtml,
    renderBottomNav,
    renderCategories,
    renderFilterOptions,
    renderBanners,
    syncBanner,
    priceControlHtml,
    variantChipsHtml,
    productPriceRowHtml,
    productCardHtml,
    renderProducts,
    renderCart,
    renderSupport,
    renderOrderHistory,
    renderProductSkeletons
  } = createShopUi({
    state,
    el,
    money,
    escapeHtml,
    mediaKind,
    categories,
    quickCategories,
    brandRecordsForCategory,
    brandsForCategory,
    variantStock,
    hasAvailableVariant,
    currentVariant,
    maxQtyFor,
    cartQty,
    cartTotalQty,
    totalStock,
    productSupportsVariants,
    activeProducts,
    sortProductsForDisplay,
    historyStatusLabel
  });

  function load(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  }

  function save(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  const APP_ASSET_VERSION = '69';

  const DEFAULT_THEME = {
    bodyClass: '',
    headerLogoSrc: `/apps/shared/assets/img/header-logo.png?v=${APP_ASSET_VERSION}`,
    loaderLogoSrc: `/apps/shared/assets/img/header-logo.png?v=${APP_ASSET_VERSION}`,
    preload: [
      `/apps/shared/assets/img/header-logo.png?v=${APP_ASSET_VERSION}`,
      `/apps/shared/assets/img/logo-ember.png?v=${APP_ASSET_VERSION}`
    ]
  };

  const SECRET_BOOT_THEME = window.__stavBootSecretTheme ? {
    bodyClass: 'secret-theme-active',
    headerLogoSrc: `/apps/shop/secret-theme/assets/secret-logo.png?v=${APP_ASSET_VERSION}`,
    loaderLogoSrc: `/apps/shop/secret-theme/assets/secret-logo.png?v=${APP_ASSET_VERSION}`
  } : null;
  let searchViewportSyncFrame = 0;
  let searchViewportBaseHeight = 0;

  function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function setLoaderVisibility(isVisible) {
    if (!el.appLoader) return;
    el.appLoader.classList.toggle('is-hidden', !isVisible);
    document.body.classList.toggle('is-loading-app', isVisible);
  }

  function setThemeLogos(themeConfig = null) {
    const headerSrc = themeConfig?.headerLogoSrc || DEFAULT_THEME.headerLogoSrc;
    const loaderSrc = themeConfig?.loaderLogoSrc || themeConfig?.headerLogoSrc || DEFAULT_THEME.loaderLogoSrc;
    if (el.heroLogoImage && el.heroLogoImage.getAttribute('src') !== headerSrc) el.heroLogoImage.src = headerSrc;
    if (el.appLoaderLogo && el.appLoaderLogo.getAttribute('src') !== loaderSrc) el.appLoaderLogo.src = loaderSrc;
  }

  function clearThemeBootState() {
    document.documentElement.classList.remove('secret-theme-booting');
  }

  if (SECRET_BOOT_THEME) {
    setThemeLogos(SECRET_BOOT_THEME);
  }

  function loadSecretThemeModule() {
    if (window.StavSecretTheme) return Promise.resolve(window.StavSecretTheme);
    if (state.secretTheme.loading) return state.secretTheme.loading;
    state.secretTheme.loading = new Promise(resolve => {
      const existing = document.querySelector('script[data-secret-theme-script]');
      if (existing) {
        existing.addEventListener('load', () => resolve(window.StavSecretTheme || null), { once: true });
        existing.addEventListener('error', () => resolve(null), { once: true });
        return;
      }
      const script = document.createElement('script');
      script.src = `/apps/shop/secret-theme/index.js?v=${APP_ASSET_VERSION}`;
      script.async = true;
      script.dataset.secretThemeScript = '1';
      script.onload = () => resolve(window.StavSecretTheme || null);
      script.onerror = () => resolve(null);
      document.head.appendChild(script);
    }).finally(() => {
      state.secretTheme.loading = null;
    });
    return state.secretTheme.loading;
  }

  function ensureSecretThemeStyles(config) {
    if (!config?.cssHref) return Promise.resolve(false);
    const current = document.getElementById('secretThemeStylesheet');
    if (current) return Promise.resolve(true);
    return new Promise(resolve => {
      const link = document.createElement('link');
      link.id = 'secretThemeStylesheet';
      link.rel = 'stylesheet';
      link.href = `${config.cssHref}?v=${APP_ASSET_VERSION}`;
      link.onload = () => resolve(true);
      link.onerror = () => { link.remove(); resolve(false); };
      document.head.appendChild(link);
    });
  }

  function preloadThemeAssets(config) {
    const items = Array.isArray(config?.preload) ? config.preload : [];
    return Promise.allSettled(items.map(src => preloadMedia(src, mediaKind(src))));
  }

  async function activateSecretTheme(options = {}) {
    const { silent = false } = options;
    const config = await loadSecretThemeModule();
    if (!config) {
      state.secretTheme.active = false;
      save(STORAGE_KEYS.secretTheme, false);
      document.body.classList.remove('secret-theme-active');
      setThemeLogos();
      clearThemeBootState();
      return false;
    }
    const stylesReady = await ensureSecretThemeStyles(config);
    if (!stylesReady) {
      state.secretTheme.active = false;
      save(STORAGE_KEYS.secretTheme, false);
      document.body.classList.remove('secret-theme-active');
      setThemeLogos();
      clearThemeBootState();
      return false;
    }
    await preloadThemeAssets({ preload: [config.headerLogoSrc, config.loaderLogoSrc, ...(Array.isArray(config.preload) ? config.preload : [])] });
    state.secretTheme.config = config;
    state.secretTheme.active = true;
    save(STORAGE_KEYS.secretTheme, true);
    document.body.classList.add(config.bodyClass || 'secret-theme-active');
    setThemeLogos(config);
    clearThemeBootState();
    if (!silent) {
      await wait(Math.min(config.transitionMs || 1050, 180));
    }
    return true;
  }

  async function deactivateSecretTheme(options = {}) {
    const { silent = false } = options;
    await preloadThemeAssets(DEFAULT_THEME);
    state.secretTheme.active = false;
    save(STORAGE_KEYS.secretTheme, false);
    document.body.classList.remove('secret-theme-active');
    setThemeLogos();
    clearThemeBootState();
    if (!silent) {
      await wait(120);
    }
    return true;
  }

  async function toggleSecretTheme() {
    if (state.secretTheme.switching) return;
    state.secretTheme.switching = true;
    try {
      if (document.body.classList.contains('secret-theme-active')) {
        await deactivateSecretTheme({ silent: true });
      } else {
        const ok = await activateSecretTheme({ silent: true });
        if (!ok) return;
      }
      renderCategories();
      renderFilterOptions();
      renderBanners();
      renderProducts();
      renderSupport();
      renderCart();
      renderBottomNav(state.view === 'favorites' ? 'favorites' : 'catalog');
      if (state.activeProductId && !el.productSheet.classList.contains('hidden')) {
        renderProductSheet(state.activeProductId, false);
      }
      pulseHaptic('medium');
    } finally {
      state.secretTheme.switching = false;
    }
  }

  function registerSecretTap() {
    const now = Date.now();
    state.secretTheme.tapMarks = state.secretTheme.tapMarks.filter(mark => now - mark < 3600);
    state.secretTheme.tapMarks.push(now);
    if (state.secretTheme.tapMarks.length < 10) return;
    const recent = state.secretTheme.tapMarks.slice(-10);
    const fastEnough = recent[recent.length - 1] - recent[0] <= 3200;
    state.secretTheme.tapMarks = [];
    if (fastEnough) toggleSecretTheme();
  }

  function rememberVariant(productId, variantId) {
    state.selectedVariants[productId] = variantId;
    save(STORAGE_KEYS.selectedVariants, state.selectedVariants);
  }

  function setCartQty(product, qty, variant = null) {
    const variantId = variant?.id || '';
    const key = cartEntryKey(product.id, variantId);
    const nextQty = Math.max(0, Math.min(Number(qty || 0), maxQtyFor(product, variant)));
    const next = state.cart.filter(item => item.key !== key);
    if (nextQty > 0) {
      next.push({
        key,
        id: product.id,
        variantId,
        variantLabel: variant?.label || '',
        price: Number(variant?.price ?? product.price ?? 0),
        qty: nextQty
      });
    }
    state.cart = next;
    save(STORAGE_KEYS.cart, state.cart);
    patchProductCard(product.id, 'price');
    renderCart();
    if (state.activeProductId === product.id && !el.productSheet.classList.contains('hidden')) {
      renderProductSheet(product.id, false);
    }
  }

  function startBannerAutoplay() {
    if (state.bannerTimer) clearInterval(state.bannerTimer);
    if (state.banners.length < 2) return;
    state.bannerTimer = setInterval(() => syncBanner(state.activeBanner + 1), 4200);
  }

  function stopBannerAutoplay() {
    if (state.bannerTimer) clearInterval(state.bannerTimer);
    state.bannerTimer = null;
  }

  function onBannerGestureStart(clientX) {
    if ((state.banners?.length || 0) < 2) return;
    state.bannerGesture = { startX: clientX, deltaX: 0, active: true };
    state.suppressBannerClick = false;
    stopBannerAutoplay();
    el.bannerTrack.style.transition = 'none';
  }

  function onBannerGestureMove(clientX) {
    if (!state.bannerGesture.active) return;
    state.bannerGesture.deltaX = clientX - state.bannerGesture.startX;
    if (Math.abs(state.bannerGesture.deltaX) > 8) state.suppressBannerClick = true;
    syncBanner(state.activeBanner, state.bannerGesture.deltaX);
  }

  function onBannerGestureEnd() {
    if (!state.bannerGesture.active) return;
    const deltaX = state.bannerGesture.deltaX;
    state.bannerGesture.active = false;
    el.bannerTrack.style.transition = '';
    if (Math.abs(deltaX) > 46) {
      syncBanner(state.activeBanner + (deltaX < 0 ? 1 : -1));
    } else {
      syncBanner(state.activeBanner);
    }
    startBannerAutoplay();
    setTimeout(() => { state.suppressBannerClick = false; }, 120);
  }

  function patchProductCard(productId, mode = 'full') {
    const existing = el.productGrid.querySelector(`[data-product-id="${productId}"]`);
    const product = productById(productId);
    const shouldShow = shouldDisplayProduct(productId);

    if (!existing && !shouldShow) return;
    if (!product) {
      if (existing) renderProducts();
      return;
    }
    if (!existing || !shouldShow) {
      renderProducts();
      return;
    }

    if (mode === 'price') {
      const currentRow = existing.querySelector('.price-row');
      if (!currentRow) {
        renderProducts();
        return;
      }
      const template = document.createElement('template');
      template.innerHTML = productPriceRowHtml(product).trim();
      const nextRow = template.content.firstElementChild;
      if (!nextRow) {
        renderProducts();
        return;
      }
      currentRow.replaceWith(nextRow);
      return;
    }

    const template = document.createElement('template');
    template.innerHTML = productCardHtml(product).trim();
    const nextCard = template.content.firstElementChild;
    if (!nextCard) return;
    existing.replaceWith(nextCard);
  }

  function patchProductCards(productIds = []) {
    const ids = [...new Set((Array.isArray(productIds) ? productIds : [productIds]).filter(Boolean))];
    if (!ids.length) return;
    const visibleIds = new Set(activeProducts().map(item => item.id));
    const needsFullRender = ids.some(id => {
      const isVisible = visibleIds.has(id);
      const hasNode = Boolean(el.productGrid.querySelector(`[data-product-id="${id}"]`));
      return isVisible !== hasNode;
    });
    if (needsFullRender) {
      renderProducts();
      return;
    }
    ids.forEach(id => patchProductCard(id));
  }

  function saveOrderHistory() {
    save(STORAGE_KEYS.orderHistory, state.orderHistory);
  }

  function pushOrderToHistory(order) {
    if (!order?.id) return;
    state.orderHistory = [order, ...state.orderHistory.filter(item => item.id !== order.id)].slice(0, 20);
    saveOrderHistory();
    renderOrderHistory();
  }

  async function refreshOrderHistory() {
    const ids = state.orderHistory.map(item => item.id).filter(Boolean);
    if (!ids.length || !window.AppApi.getOrderHistory) return;
    try {
      const data = await window.AppApi.getOrderHistory(ids);
      if (Array.isArray(data.orders) && data.orders.length) {
        const byId = new Map(data.orders.map(item => [item.id, item]));
        state.orderHistory = state.orderHistory.map(item => byId.get(item.id) || item);
        saveOrderHistory();
      }
    } catch {}
    renderOrderHistory();
  }

  function renderProductSheet(productId, shouldOpen = true) {
    const product = state.products.find(item => item.id === productId);
    if (!product) return;
    state.activeProductId = productId;
    const variant = currentVariant(product);
    const price = variant?.price ?? product.price;
    const available = maxQtyFor(product, variant);
    el.productSheetTitle.textContent = product.name;
    el.productSheetBody.innerHTML = `
      <div class="product-sheet-card">
        <div class="product-sheet-media ${product.category === 'кальяны' ? 'product-sheet-media--hookah' : ''} theme-${product.accent || 'tiffany'}">
          ${product.image
            ? `<img class="product-sheet-image" src="${escapeHtml(product.image)}" alt="${escapeHtml(product.name)}" loading="eager" decoding="async" />`
            : `<div class="product-fallback product-fallback-sheet">${fallbackVisual(product)}</div>`}
        </div>
        <div class="product-sheet-content">
          ${productBadgesHtml(product)}
          <div class="product-sheet-name">${escapeHtml(product.name)}</div>
          <div class="product-sheet-brand">${escapeHtml(product.brand || 'Без бренда')}</div>
          ${productSupportsVariants(product) ? variantChipsHtml(product, true) : ''}
          <div class="product-sheet-description">${escapeHtml(product.description || 'Описание пока не заполнено')}</div>
          <div class="product-sheet-meta">${escapeHtml(product.category)} • ${variant ? `${escapeHtml(variant.label)} • остаток ${available}` : `остаток ${totalStock(product)}`}</div>
          <div class="product-sheet-price-row">
            <div>
              <div class="product-sheet-price">${money(price)}</div>
              ${variant ? `<div class="product-variant-caption">${escapeHtml(variant.label)}${available <= 0 ? ' • нет в наличии' : ''}</div>` : ''}
            </div>
            ${priceControlHtml(product, variant, true)}
          </div>
        </div>
      </div>
    `;
    if (shouldOpen) openSheet(el.productSheet, 'catalog', 'product');
  }

  function setCategory(category) {
    const isSame = state.filters.category === category;
    state.filters.category = isSame ? 'all' : category;
    state.filters.brand = 'all';
    state.view = 'catalog';
    renderCategories();
    renderFilterOptions();
    renderProducts();
    renderBottomNav('catalog');
  }

  function applyFilters() {
    state.filters.priceMin = String(el.priceMinInput.value || '').trim();
    state.filters.priceMax = String(el.priceMaxInput.value || '').trim();
    renderCategories();
    renderFilterOptions();
    renderProducts();
    state.view = state.view === 'favorites' ? 'favorites' : 'catalog';
    renderBottomNav(state.view === 'favorites' ? 'favorites' : 'catalog');
    closeSheet(el.filterSheet);
  }

  function resetFilters() {
    state.filters = {
      category: 'all',
      brand: 'all',
      priceMin: '',
      priceMax: ''
    };
    renderCategories();
    renderFilterOptions();
    renderProducts();
  }

  function toggleFavorite(productId) {
    pulseHaptic('light');
    if (state.favorites.includes(productId)) {
      state.favorites = state.favorites.filter(id => id !== productId);
    } else {
      state.favorites = [...state.favorites, productId];
    }
    save(STORAGE_KEYS.likes, state.favorites);
    if (state.view === 'favorites') {
      renderProducts();
    } else {
      patchProductCard(productId);
    }
    if (state.activeProductId === productId && !el.productSheet.classList.contains('hidden')) {
      renderProductSheet(productId, false);
    }
  }

  function addToCart(productId, variantId, sourceNode) {
    const product = productById(productId);
    if (!product) return;

    const flightSource = sourceNode?.closest?.('.product-card')?.querySelector?.('.product-image-wrap')
      || sourceNode?.closest?.('.product-sheet-card')?.querySelector?.('.product-sheet-media')
      || sourceNode?.closest?.('[data-open-product]')?.querySelector?.('.product-image-wrap')
      || sourceNode;

    const variant = selectedVariantForProduct(product, variantId);
    if (variant) rememberVariant(product.id, variant.id);
    if (maxQtyFor(product, variant) <= 0) {
      showNotice('Эта граммовка закончилась');
      return;
    }
    pulseHaptic('medium');
    animateToCart(product, flightSource);
    window.setTimeout(() => {
      setCartQty(product, cartQty(product.id, variant?.id || '') + 1, variant);
    }, 18);
  }

  

function animateToCart(product, sourceNode) {
  const cartTarget = el.navCart?.querySelector?.('.nav-icon') || el.navCart;
  if (!sourceNode || !cartTarget) return;

  const sourceRect = sourceNode.getBoundingClientRect();
  const targetRect = cartTarget.getBoundingClientRect();
  if (sourceRect.width < 12 || sourceRect.height < 12 || targetRect.width < 10 || targetRect.height < 10) return;

  const clone = document.createElement('div');
  clone.className = 'fly-clone-media';

  const mediaNode = sourceNode.querySelector?.('img, video, .product-fallback, .fallback-art') || null;
  let payload = null;
  if (mediaNode?.tagName === 'IMG') {
    payload = document.createElement('img');
    payload.src = mediaNode.currentSrc || mediaNode.src;
    payload.alt = product?.name || '';
  } else if (mediaNode?.tagName === 'VIDEO') {
    payload = document.createElement('video');
    payload.src = mediaNode.currentSrc || mediaNode.src || product?.image || '';
    payload.muted = true;
    payload.autoplay = true;
    payload.loop = true;
    payload.playsInline = true;
  } else if (product?.image) {
    payload = document.createElement('img');
    payload.src = product.image;
    payload.alt = product?.name || '';
  } else {
    payload = document.createElement('div');
    payload.className = 'fly-clone-fallback';
    payload.textContent = product?.name || '';
  }
  clone.appendChild(payload);

  clone.style.left = `${sourceRect.left}px`;
  clone.style.top = `${sourceRect.top}px`;
  clone.style.width = `${sourceRect.width}px`;
  clone.style.height = `${sourceRect.height}px`;
  clone.style.opacity = '1';
  document.body.appendChild(clone);

  const startX = sourceRect.left + sourceRect.width / 2;
  const startY = sourceRect.top + sourceRect.height / 2;
  const endX = targetRect.left + targetRect.width / 2;
  const endY = targetRect.top + targetRect.height / 2;
  const dx = endX - startX;
  const dy = endY - startY;
  const finalScale = Math.max(0.16, Math.min(0.26, 54 / Math.max(sourceRect.width, sourceRect.height)));
  const peakY = Math.min(-90, dy * 0.22) - 44;
  const midX = dx * 0.48;

  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    clone.remove();
    el.navCart.classList.add('cart-pulse');
    pulseHaptic('light');
    window.setTimeout(() => el.navCart.classList.remove('cart-pulse'), 420);
  };

  if (typeof clone.animate === 'function') {
    const animation = clone.animate([
      { transform: 'translate3d(0,0,0) scale(1) rotate(0deg)', opacity: 1, offset: 0 },
      { transform: `translate3d(${midX}px, ${peakY}px, 0) scale(.78) rotate(-8deg)`, opacity: 1, offset: 0.55 },
      { transform: `translate3d(${dx}px, ${dy}px, 0) scale(${finalScale}) rotate(-16deg)`, opacity: 0.06, offset: 1 }
    ], {
      duration: 880,
      easing: 'cubic-bezier(.18,.88,.22,1)',
      fill: 'forwards'
    });
    animation.onfinish = finish;
    animation.oncancel = finish;
    window.setTimeout(finish, 980);
    return;
  }

  clone.style.transition = 'transform 880ms cubic-bezier(.18,.88,.22,1), opacity 880ms ease';
  requestAnimationFrame(() => {
    clone.style.transform = `translate3d(${midX}px, ${peakY}px, 0) scale(.78) rotate(-8deg)`;
    clone.style.opacity = '1';
    setTimeout(() => {
      clone.style.transform = `translate3d(${dx}px, ${dy}px, 0) scale(${finalScale}) rotate(-16deg)`;
      clone.style.opacity = '.06';
    }, 280);
  });
  window.setTimeout(finish, 940);
}

async function shareProduct(productId) {
    const product = productById(productId);
    if (!product) return;
    const url = `${location.origin}/shop/?startapp=product_${productId}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: product.name, text: product.name, url });
        return;
      } catch {}
    }
    try {
      await navigator.clipboard.writeText(url);
      showNotice('Ссылка скопирована');
    } catch {}
  }

  function showNotice(text) {
    el.checkoutNotice.textContent = text;
    clearTimeout(showNotice.timer);
    showNotice.timer = setTimeout(() => { el.checkoutNotice.textContent = ''; }, 4200);
  }

  function showSuccessModal() {
    if (!el.orderSuccessModal) return;
    el.orderSuccessModal.classList.remove('hidden');
    document.body.classList.add('has-success-modal');
  }

  function hideSuccessModal() {
    if (!el.orderSuccessModal) return;
    el.orderSuccessModal.classList.add('hidden');
    document.body.classList.remove('has-success-modal');
  }

  function goHome() {
    state.view = 'catalog';
    state.search = '';
    state.filters.category = 'all';
    state.filters.brand = 'all';
    state.filters.priceMin = '';
    state.filters.priceMax = '';
    el.searchInput.value = '';
    closeAllSheets();
    renderCategories();
    renderFilterOptions();
    renderProducts();
    syncBanner(0);
    renderBottomNav('catalog');
  }

  function switchView(view) {
    state.view = view;
    renderBottomNav(view === 'favorites' ? 'favorites' : 'catalog');
    renderProducts();
  }

  function openSupportContact(url) {
    if (!url) return;
    if (window.Telegram?.WebApp?.openTelegramLink && url.startsWith('https://t.me/')) {
      window.Telegram.WebApp.openTelegramLink(url);
      return;
    }
    window.open(url, '_blank', 'noreferrer');
  }

  function currentCartPayload() {
    return state.cart.map(entry => {
      const product = productById(entry.id);
      return product ? {
        id: product.id,
        name: product.name,
        qty: entry.qty,
        price: entry.price,
        variantId: entry.variantId,
        variantLabel: entry.variantLabel
      } : null;
    }).filter(Boolean);
  }

  function applyBannerFilter(bannerId) {
    const banner = state.banners.find(item => item.id === bannerId);
    if (!banner) return;
    state.filters.category = banner.targetCategory || 'all';
    state.filters.brand = banner.targetBrand || 'all';
    state.filters.priceMin = String(banner.targetPriceMin || '');
    state.filters.priceMax = String(banner.targetPriceMax || '');
    state.view = 'catalog';
    renderCategories();
    renderFilterOptions();
    renderProducts();
    renderBottomNav('catalog');
    closeAllSheets();
  }

  function handleStartApp() {
    const params = new URLSearchParams(location.search);
    const startApp = params.get('startapp') || '';
    if (!startApp.startsWith('product_')) return;
    const id = startApp.replace('product_', '');
    const exists = state.products.some(item => item.id === id);
    if (exists) setTimeout(() => renderProductSheet(id), 220);
  }

  function syncOpenSheetState(activeSheet = null) {
    document.body.classList.toggle('has-cart-sheet-open', activeSheet === el.cartSheet);
    document.body.classList.toggle('has-product-sheet-open', activeSheet === el.productSheet);
  }

  function requestSearchSheetViewportSync() {
    if (searchViewportSyncFrame) cancelAnimationFrame(searchViewportSyncFrame);
    searchViewportSyncFrame = requestAnimationFrame(() => {
      searchViewportSyncFrame = 0;
      syncSearchSheetViewport();
    });
  }

  function currentSearchViewportMetrics() {
    const viewport = window.visualViewport;
    return {
      height: Math.round(viewport?.height || window.innerHeight || document.documentElement.clientHeight || 0),
      offsetTop: Math.max(0, Math.round(viewport?.offsetTop || 0))
    };
  }

  function resetSearchViewportBase() {
    const { height } = currentSearchViewportMetrics();
    if (height > 0) searchViewportBaseHeight = height;
  }

  function syncSearchSheetViewport() {
    if (!el.searchSheet) return;
    const searchOpen = !el.searchSheet.classList.contains('hidden');
    const searchFocused = document.activeElement === el.searchInput;
    const { height: viewportHeight, offsetTop: viewportOffsetTop } = currentSearchViewportMetrics();
    if (!searchOpen || !searchFocused || viewportHeight >= searchViewportBaseHeight) {
      searchViewportBaseHeight = viewportHeight || searchViewportBaseHeight;
    }
    const keyboardOffset = searchOpen && searchFocused
      ? Math.max(0, searchViewportBaseHeight - viewportHeight - viewportOffsetTop)
      : 0;
    el.searchSheet.style.setProperty('--search-sheet-keyboard-offset', `${keyboardOffset}px`);
    el.searchSheet.style.setProperty('--search-sheet-viewport-height', `${viewportHeight || searchViewportBaseHeight || window.innerHeight}px`);
    el.searchSheet.classList.toggle('sheet-keyboard-active', keyboardOffset > 0);
    if (keyboardOffset > 0 && searchFocused) {
      el.searchInput?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
  }

  function blurFocusedElementWithin(container) {
    const active = document.activeElement;
    if (!container || !active || typeof active.blur !== 'function') return;
    if (container.contains(active)) active.blur();
  }

  function submitSearch() {
    state.search = String(el.searchInput?.value || '');
    renderProducts();
    const shouldDelayClose = document.activeElement === el.searchInput;
    blurFocusedElementWithin(el.searchSheet);
    requestSearchSheetViewportSync();
    const finishSearchClose = () => {
      closeSheet(el.searchSheet);
      window.setTimeout(requestSearchSheetViewportSync, 180);
    };
    if (shouldDelayClose) {
      window.setTimeout(finishSearchClose, 90);
      return;
    }
    finishSearchClose();
  }

  function openSheet(sheet, activeNav = '', sheetKind = '') {
    closeAllSheets(false);
    el.sheetBackdrop.classList.remove('hidden');
    sheet.classList.remove('hidden');
    requestAnimationFrame(() => sheet.classList.add('sheet-visible'));
    if (sheetKind === 'product' || sheet === el.productSheet) el.sheetBackdrop.classList.add('backdrop-blur-strong');
    syncOpenSheetState(sheet);
    requestSearchSheetViewportSync();
    renderBottomNav(activeNav || (sheet === el.cartSheet ? 'cart' : sheet === el.searchSheet ? 'search' : sheet === el.supportSheet ? 'support' : 'catalog'));
  }

  function closeSheet(sheet) {
    blurFocusedElementWithin(sheet);
    sheet.classList.remove('sheet-visible');
    sheet.classList.add('hidden');
    el.sheetBackdrop.classList.remove('backdrop-blur-strong');
    const openSheets = [el.menuSheet, el.searchSheet, el.filterSheet, el.productSheet, el.cartSheet, el.supportSheet, el.historySheet].filter(node => !node.classList.contains('hidden'));
    const activeSheet = openSheets[openSheets.length - 1] || null;
    syncOpenSheetState(activeSheet);
    requestSearchSheetViewportSync();
    if (!activeSheet) {
      el.sheetBackdrop.classList.add('hidden');
      renderBottomNav(state.view === 'favorites' ? 'favorites' : 'catalog');
    }
  }

  function closeAllSheets(shouldHideBackdrop = true) {
    blurFocusedElementWithin(el.searchSheet);
    [el.menuSheet, el.searchSheet, el.filterSheet, el.productSheet, el.cartSheet, el.supportSheet, el.historySheet].forEach(node => { node.classList.remove('sheet-visible'); node.classList.add('hidden'); });
    el.sheetBackdrop.classList.remove('backdrop-blur-strong');
    syncOpenSheetState(null);
    requestSearchSheetViewportSync();
    if (shouldHideBackdrop) el.sheetBackdrop.classList.add('hidden');
    renderBottomNav(state.view === 'favorites' ? 'favorites' : 'catalog');
  }

  async function submitCheckout(event) {
    event.preventDefault();
    if (!state.cart.length) {
      showNotice('Корзина пуста');
      return;
    }
    const formData = new FormData(el.checkoutForm);
    const payload = currentCartPayload();
    const phone = String(formData.get('phone') || '').trim();
    let telegram = String(formData.get('telegram') || '').trim();
    if (telegram && telegram.startsWith('@')) telegram = `https://t.me/${telegram.slice(1)}`;
    if (!phone && !telegram) {
      showNotice('Укажите телефон или Telegram');
      return;
    }
    const total = payload.reduce((sum, item) => sum + item.price * item.qty, 0);
    try {
      const created = await window.AppApi.createOrder({
        customer: {
          name: formData.get('name') || 'Telegram Client',
          phone,
          telegram
        },
        items: payload,
        total
      });
      pushOrderToHistory(created.order);
      state.cart = [];
      save(STORAGE_KEYS.cart, state.cart);
      try {
        const fresh = await window.AppApi.getShopBootstrap();
        state.products = fresh.products || state.products;
        state.banners = fresh.banners || state.banners;
        state.supportContacts = fresh.supportContacts || state.supportContacts;
      } catch {}
      renderCart();
      renderProducts();
      el.checkoutForm.reset();
      prefillTelegramField();
      showSuccessModal();
      if (window.Telegram?.WebApp?.HapticFeedback) {
        window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
      }
    } catch (error) {
      showNotice(error.message);
    }
  }

  function prefillTelegramField() {
    const input = el.checkoutForm?.querySelector('input[name="telegram"]');
    const tgUser = window.Telegram?.WebApp?.initDataUnsafe?.user;
    if (!input || !tgUser) return;
    if (tgUser.username) {
      input.value = `https://t.me/${tgUser.username}`;
    }
  }

  function bindEvents() {
    el.quickFilterToggle.addEventListener('click', () => {
      openSheet(el.filterSheet, 'catalog');
    });

    el.menuCatalogBtn.addEventListener('click', goHome);
    el.menuOrdersBtn?.addEventListener('click', () => { renderOrderHistory(); openSheet(el.historySheet, state.view === 'favorites' ? 'favorites' : 'catalog'); });
    el.cartHistoryBtn?.addEventListener('click', () => { renderOrderHistory(); openSheet(el.historySheet, state.view === 'favorites' ? 'favorites' : 'catalog'); });

    el.installAppBtn.addEventListener('click', async () => {
      if (!state.deferredPrompt) return;
      state.deferredPrompt.prompt();
      await state.deferredPrompt.userChoice.catch(() => null);
      state.deferredPrompt = null;
      el.installAppBtn.classList.add('hidden');
    });

    el.sheetBackdrop.addEventListener('click', closeAllSheets);

    document.addEventListener('click', event => {
      const closeBtn = event.target.closest('[data-close-sheet]');
      if (!closeBtn) return;
      const sheet = document.getElementById(closeBtn.dataset.closeSheet);
      if (sheet) closeSheet(sheet);
    });

    el.searchForm?.addEventListener('submit', event => {
      event.preventDefault();
      submitSearch();
    });
    el.searchInput.addEventListener('input', event => {
      state.search = String(event.target.value || '');
      renderProducts();
    });
    el.searchInput.addEventListener('keydown', event => {
      if (event.key !== 'Enter' || event.isComposing) return;
      event.preventDefault();
      submitSearch();
    });
    el.searchInput.addEventListener('focus', () => {
      resetSearchViewportBase();
      requestSearchSheetViewportSync();
      window.setTimeout(requestSearchSheetViewportSync, 140);
      window.setTimeout(requestSearchSheetViewportSync, 300);
    });
    el.searchInput.addEventListener('blur', () => {
      requestSearchSheetViewportSync();
      window.setTimeout(requestSearchSheetViewportSync, 140);
      window.setTimeout(requestSearchSheetViewportSync, 300);
    });

    el.categoryRow.addEventListener('click', event => {
      const btn = event.target.closest('[data-category]');
      if (!btn) return;
      pulseHaptic('light');
      setCategory(btn.dataset.category);
    });

    el.brandSubfilters.addEventListener('click', event => {
      const btn = event.target.closest('[data-sub-brand]');
      if (!btn) return;
      pulseHaptic('light');
      state.filters.brand = state.filters.brand === btn.dataset.subBrand ? 'all' : btn.dataset.subBrand;
      renderCategories();
      renderFilterOptions();
      renderProducts();
    });

    el.filterCategoryGrid.addEventListener('click', event => {
      const btn = event.target.closest('[data-filter-category]');
      if (!btn) return;
      const nextCategory = btn.dataset.filterCategory;
      state.filters.category = state.filters.category === nextCategory ? 'all' : nextCategory;
      if (state.filters.category !== 'табак') state.filters.brand = 'all';
      renderFilterOptions();
    });

    el.filterBrandGrid.addEventListener('click', event => {
      const btn = event.target.closest('[data-filter-brand]');
      if (!btn) return;
      const nextBrand = btn.dataset.filterBrand;
      state.filters.brand = state.filters.brand === nextBrand ? 'all' : nextBrand;
      renderFilterOptions();
    });

    el.applyFiltersBtn.addEventListener('click', applyFilters);
    el.resetFiltersBtn.addEventListener('click', () => {
      resetFilters();
      closeSheet(el.filterSheet);
    });

    el.bannerTrack.addEventListener('click', event => {
      if (state.suppressBannerClick) return;
      const btn = event.target.closest('[data-banner-id]');
      if (!btn) return;
      applyBannerFilter(btn.dataset.bannerId);
    });

    el.bannerSection.addEventListener('touchstart', event => onBannerGestureStart(event.touches[0].clientX), { passive: true });
    el.bannerSection.addEventListener('touchmove', event => onBannerGestureMove(event.touches[0].clientX), { passive: true });
    el.bannerSection.addEventListener('touchend', onBannerGestureEnd);
    el.bannerSection.addEventListener('mousedown', event => onBannerGestureStart(event.clientX));
    window.addEventListener('mousemove', event => onBannerGestureMove(event.clientX));
    window.addEventListener('mouseup', onBannerGestureEnd);
    window.addEventListener('resize', () => syncBanner(state.activeBanner));
    window.addEventListener('resize', requestSearchSheetViewportSync);
    window.visualViewport?.addEventListener('resize', requestSearchSheetViewportSync);
    window.visualViewport?.addEventListener('scroll', requestSearchSheetViewportSync);

    el.productGrid.addEventListener('click', event => {
      const shareBtn = event.target.closest('[data-share]');
      if (shareBtn) {
        event.stopPropagation();
        shareProduct(shareBtn.dataset.share);
        return;
      }
      const favoriteBtn = event.target.closest('[data-favorite]');
      if (favoriteBtn) {
        event.stopPropagation();
        toggleFavorite(favoriteBtn.dataset.favorite);
        return;
      }
      const variantBtn = event.target.closest('[data-variant-select]');
      if (variantBtn) {
        event.stopPropagation();
        rememberVariant(variantBtn.dataset.variantSelect, variantBtn.dataset.variantId);
        patchProductCard(variantBtn.dataset.variantSelect);
        if (state.activeProductId === variantBtn.dataset.variantSelect && !el.productSheet.classList.contains('hidden')) {
          renderProductSheet(variantBtn.dataset.variantSelect, false);
        }
        return;
      }
      const minusBtn = event.target.closest('[data-cart-minus]');
      if (minusBtn) {
        event.stopPropagation();
        const product = productById(minusBtn.dataset.cartMinus);
        if (!product) return;
        const variant = selectedVariantForProduct(product, minusBtn.dataset.variantId || '');
        setCartQty(product, cartQty(product.id, variant?.id || '') - 1, variant);
        return;
      }
      const plusBtn = event.target.closest('[data-cart-plus]');
      if (plusBtn) {
        event.stopPropagation();
        const product = productById(plusBtn.dataset.cartPlus);
        if (!product) return;
        const variant = selectedVariantForProduct(product, plusBtn.dataset.variantId || '');
        setCartQty(product, cartQty(product.id, variant?.id || '') + 1, variant);
        return;
      }
      const addBtn = event.target.closest('[data-add-to-cart]');
      if (addBtn) {
        event.stopPropagation();
        addToCart(addBtn.dataset.addToCart, addBtn.dataset.variantId || '', addBtn);
        return;
      }
      const card = event.target.closest('[data-open-product]');
      if (card) {
        renderProductSheet(card.dataset.openProduct);
      }
    });

    el.productSheetBody.addEventListener('click', event => {
      const variantBtn = event.target.closest('[data-variant-select]');
      if (variantBtn) {
        rememberVariant(variantBtn.dataset.variantSelect, variantBtn.dataset.variantId);
        patchProductCard(variantBtn.dataset.variantSelect);
        renderProductSheet(variantBtn.dataset.variantSelect, false);
        return;
      }
      const minusBtn = event.target.closest('[data-cart-minus]');
      if (minusBtn) {
        const product = productById(minusBtn.dataset.cartMinus);
        if (!product) return;
        const variant = selectedVariantForProduct(product, minusBtn.dataset.variantId || '');
        setCartQty(product, cartQty(product.id, variant?.id || '') - 1, variant);
        return;
      }
      const plusBtn = event.target.closest('[data-cart-plus]');
      if (plusBtn) {
        const product = productById(plusBtn.dataset.cartPlus);
        if (!product) return;
        const variant = selectedVariantForProduct(product, plusBtn.dataset.variantId || '');
        setCartQty(product, cartQty(product.id, variant?.id || '') + 1, variant);
        return;
      }
      const addBtn = event.target.closest('[data-add-to-cart]');
      if (addBtn) {
        addToCart(addBtn.dataset.addToCart, addBtn.dataset.variantId || '', addBtn);
      }
    });

    el.cartList.addEventListener('click', event => {
      const minusBtn = event.target.closest('[data-cart-minus]');
      if (minusBtn) {
        const product = productById(minusBtn.dataset.cartMinus);
        if (!product) return;
        const variant = selectedVariantForProduct(product, minusBtn.dataset.variantId || '');
        setCartQty(product, cartQty(product.id, variant?.id || '') - 1, variant);
        return;
      }
      const plusBtn = event.target.closest('[data-cart-plus]');
      if (plusBtn) {
        const product = productById(plusBtn.dataset.cartPlus);
        if (!product) return;
        const variant = selectedVariantForProduct(product, plusBtn.dataset.variantId || '');
        setCartQty(product, cartQty(product.id, variant?.id || '') + 1, variant);
      }
    });

    el.supportList.addEventListener('click', event => {
      const item = event.target.closest('[data-contact-link]');
      if (!item) return;
      openSupportContact(item.dataset.contactLink);
    });

    el.checkoutForm.addEventListener('submit', submitCheckout);

    el.successModalCloseBtn?.addEventListener('click', hideSuccessModal);
    el.orderSuccessModal?.addEventListener('click', event => {
      if (event.target.matches('[data-close-success-modal]')) hideSuccessModal();
    });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && el.orderSuccessModal && !el.orderSuccessModal.classList.contains('hidden')) {
        hideSuccessModal();
      }
    });

    el.heroLogoButton?.addEventListener('click', () => {
      goHome();
      registerSecretTap();
    });

    el.navMenu.addEventListener('click', goHome);
    el.navFavorites.addEventListener('click', () => {
      pulseHaptic('light');
      const nextView = state.view === 'favorites' ? 'catalog' : 'favorites';
      closeAllSheets();
      switchView(nextView);
    });
    el.navCart.addEventListener('click', () => openSheet(el.cartSheet, 'cart'));
    el.navSearch.addEventListener('click', () => {
      openSheet(el.searchSheet, 'search');
      resetSearchViewportBase();
      window.setTimeout(() => {
        try {
          el.searchInput.focus({ preventScroll: true });
        } catch {
          el.searchInput.focus();
        }
        requestSearchSheetViewportSync();
      }, 60);
      window.setTimeout(requestSearchSheetViewportSync, 220);
      window.setTimeout(requestSearchSheetViewportSync, 360);
    });
    el.navSupport.addEventListener('click', () => openSheet(el.supportSheet, 'support'));
  }

  function preloadMedia(src, kind = 'image') {
    return new Promise(resolve => {
      if (!src) return resolve();
      const done = () => resolve();
      const timer = setTimeout(done, 2600);
      if (kind === 'video') {
        const video = document.createElement('video');
        video.preload = 'metadata';
        video.muted = true;
        video.playsInline = true;
        video.onloadeddata = () => { clearTimeout(timer); done(); };
        video.onerror = () => { clearTimeout(timer); done(); };
        video.src = src;
        return;
      }
      const image = new Image();
      image.decoding = 'async';
      image.loading = 'eager';
      image.onload = () => { clearTimeout(timer); done(); };
      image.onerror = () => { clearTimeout(timer); done(); };
      image.src = src;
      if (image.decode) {
        image.decode().then(() => { clearTimeout(timer); done(); }).catch(() => {});
      }
    });
  }

  async function preloadInitialMedia(data) {
    const bannerMedia = (data?.banners || []).slice(0, 1).map(item => preloadMedia(item.image || '', mediaKind(item.image)));
    const productLimit = window.matchMedia('(min-width: 900px)').matches ? 8 : 6;
    const productMedia = (data?.products || []).slice(0, productLimit).map(item => preloadMedia(item.image || '', mediaKind(item.image)));
    await Promise.allSettled([...bannerMedia, ...productMedia]);
  }

  function hideLoader() {
    setLoaderVisibility(false);
  }

  async function init() {
    const startedAt = Date.now();
    try {
      window.Telegram?.WebApp?.ready?.();
      window.Telegram?.WebApp?.expand?.();
      await preloadThemeAssets(DEFAULT_THEME);
      if (state.secretTheme.active) {
        await activateSecretTheme({ silent: true });
      } else {
        setThemeLogos();
        clearThemeBootState();
      }
      bindEvents();
      registerPwa();
      renderProductSkeletons(window.matchMedia('(min-width: 900px)').matches ? 8 : 6);
        renderOrderHistory();
        const data = await window.AppApi.getShopBootstrap();
        state.products = data.products || [];
        state.brands = data.brands || [];
        state.banners = data.banners || [];
        state.supportContacts = data.supportContacts || [];
      state.products.forEach(product => {
        if (product.variants?.length && !state.selectedVariants[product.id]) {
          state.selectedVariants[product.id] = (product.variants.find(item => variantStock(product, item) > 0) || product.variants[0]).id;
        }
      });
      save(STORAGE_KEYS.selectedVariants, state.selectedVariants);
      await preloadInitialMedia(data);
      const minLoaderMs = 320;
      const elapsed = Date.now() - startedAt;
      if (elapsed < minLoaderMs) {
        await new Promise(resolve => setTimeout(resolve, minLoaderMs - elapsed));
      }
      prefillTelegramField();
      renderCategories();
      renderFilterOptions();
      renderBanners();
      renderProducts();
      renderSupport();
      renderCart();
      renderOrderHistory();
      renderBottomNav('catalog');
      document.body.classList.toggle('desktop-mode', window.matchMedia('(min-width: 900px)').matches);
      window.addEventListener('resize', () => document.body.classList.toggle('desktop-mode', window.matchMedia('(min-width: 900px)').matches));
      startBannerAutoplay();
      handleStartApp();
      refreshOrderHistory();
      hideLoader();
      window.setTimeout(() => pulseHaptic('light'), 180);
    } catch (error) {
      clearThemeBootState();
      hideLoader();
      el.productGrid.innerHTML = `<div class="empty-state">${escapeHtml(error.message)}</div>`;
    }
  }

  function registerPwa() {
    if ('serviceWorker' in navigator) {
      const hadController = Boolean(navigator.serviceWorker.controller);
      let isReloadingForFreshWorker = false;
      if (hadController) {
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          if (isReloadingForFreshWorker) return;
          isReloadingForFreshWorker = true;
          window.location.reload();
        }, { once: true });
      }
      navigator.serviceWorker.register(`/shop-sw.js?v=${APP_ASSET_VERSION}`, { scope: '/shop/', updateViaCache: 'none' }).catch(() => {});
    }
    window.addEventListener('beforeinstallprompt', event => {
      event.preventDefault();
      state.deferredPrompt = event;
      el.installAppBtn.classList.remove('hidden');
    });
  }

  init();
})();
