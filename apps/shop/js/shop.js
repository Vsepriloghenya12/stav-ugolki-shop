(function () {
  const STORAGE_KEYS = {
    likes: 'stav:likes',
    cart: 'stav:cart:v10',
    selectedVariants: 'stav:selectedVariants:v10'
  };

  const state = {
    products: [],
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
    activeBanner: 0,
    bannerTimer: null,
    activeProductId: '',
    deferredPrompt: null,
    bannerGesture: { startX: 0, deltaX: 0, active: false },
    suppressBannerClick: false
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
    searchToggle: document.getElementById('searchToggle'),
    heroLogoButton: document.getElementById('heroLogoButton'),
    searchInput: document.getElementById('searchInput'),
    menuCatalogBtn: document.getElementById('menuCatalogBtn'),
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
    cartList: document.getElementById('cartList'),
    cartTotalLabel: document.getElementById('cartTotalLabel'),
    cartCountBadge: document.getElementById('cartCountBadge'),
    checkoutForm: document.getElementById('checkoutForm'),
    checkoutNotice: document.getElementById('checkoutNotice'),
    navMenu: document.getElementById('navMenu'),
    navFavorites: document.getElementById('navFavorites'),
    navCart: document.getElementById('navCart'),
    navFilters: document.getElementById('navFilters'),
    navSupport: document.getElementById('navSupport')
  };

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

  function money(value) {
    return `${Number(value || 0).toLocaleString('ru-RU')} VND`;
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;');
  }

  function categories() {
    return [
      { value: 'all', label: 'Все' },
      { value: 'табак', label: 'Табак' },
      { value: 'уголь', label: 'Уголь' },
      { value: 'кальяны', label: 'Кальяны' },
      { value: 'прочее', label: 'Прочее' }
    ];
  }

  function quickCategories() {
    return categories().filter(item => item.value !== 'all');
  }

  function brandsForCategory(category) {
    const seen = new Set();
    const values = [];
    state.products
      .filter(item => category === 'all' ? true : item.category === category)
      .forEach(item => {
        const brand = String(item.brand || '').trim();
        if (!brand || seen.has(brand)) return;
        seen.add(brand);
        values.push(brand);
      });
    return values.sort((a, b) => a.localeCompare(b, 'ru'));
  }

  function currentVariant(product) {
    const variants = Array.isArray(product.variants) ? product.variants : [];
    if (!variants.length) return null;
    const selected = state.selectedVariants[product.id];
    return variants.find(item => item.id === selected) || variants[0];
  }

  function rememberVariant(productId, variantId) {
    state.selectedVariants[productId] = variantId;
    save(STORAGE_KEYS.selectedVariants, state.selectedVariants);
  }

  function cartEntryKey(productId, variantId) {
    return `${productId}::${variantId || 'base'}`;
  }

  function cartQty(productId, variantId = '') {
    return state.cart.find(item => item.key === cartEntryKey(productId, variantId))?.qty || 0;
  }

  function cartTotalQty() {
    return state.cart.reduce((sum, item) => sum + Number(item.qty || 0), 0);
  }

  function setCartQty(product, qty, variant = null) {
    const variantId = variant?.id || '';
    const key = cartEntryKey(product.id, variantId);
    const nextQty = Math.max(0, Number(qty || 0));
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
    renderProducts();
    renderCart();
    if (state.activeProductId === product.id && !el.productSheet.classList.contains('hidden')) {
      renderProductSheet(product.id, false);
    }
  }

  function activeProducts() {
    const search = state.search.trim().toLowerCase();
    let list = [...state.products];

    if (state.view === 'favorites') {
      list = list.filter(item => state.favorites.includes(item.id));
    }
    if (state.filters.category !== 'all') {
      list = list.filter(item => item.category === state.filters.category);
    }
    if (state.filters.brand !== 'all') {
      list = list.filter(item => item.brand === state.filters.brand);
    }
    if (state.filters.priceMin) {
      const min = Number(state.filters.priceMin);
      list = list.filter(item => {
        const price = currentVariant(item)?.price ?? item.price;
        return price >= min;
      });
    }
    if (state.filters.priceMax) {
      const max = Number(state.filters.priceMax);
      list = list.filter(item => {
        const price = currentVariant(item)?.price ?? item.price;
        return price <= max;
      });
    }
    if (search) {
      list = list.filter(item => [item.name, item.brand, item.description].join(' ').toLowerCase().includes(search));
    }

    return list;
  }

  function icon(name, filled = false) {
    const map = {
      heart: filled
        ? `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 21.35 10.55 20.03C5.4 15.36 2 12.27 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09A5.9 5.9 0 0 1 16.5 3C19.58 3 22 5.42 22 8.5c0 3.77-3.4 6.86-8.55 11.54L12 21.35Z"/></svg>`
        : `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="m12 20-1.45-1.32C5.4 14.36 2 11.28 2 7.5A4.5 4.5 0 0 1 6.5 3C8.24 3 9.91 3.81 11 5.09 12.09 3.81 13.76 3 15.5 3A4.5 4.5 0 0 1 20 7.5c0 3.78-3.4 6.86-8.55 11.18Z"/></svg>`,
      share: `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M18 8a3 3 0 1 0-2.83-4H15a3 3 0 0 0 .17 1L8.91 8.09A3 3 0 0 0 6 7a3 3 0 1 0 2.91 4.09L15.17 15a3 3 0 0 0-.17 1 3 3 0 1 0 .17-1l-6.26-3.91A3 3 0 0 0 9 10c0-.34-.06-.67-.17-.98L15.09 5.1A3 3 0 0 0 18 8Z"/></svg>`,
      cart: `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M6 6h15l-1.4 7.04a2 2 0 0 1-1.96 1.6H9.2a2 2 0 0 1-1.96-1.6L5 4H2"/><circle cx="9" cy="19" r="1.7" fill="currentColor"/><circle cx="18" cy="19" r="1.7" fill="currentColor"/></svg>`
    };
    return map[name] || '';
  }

  function fallbackVisual(product) {
    const text = escapeHtml((product.brand || product.name || '').slice(0, 18));
    return `<div class="fallback-art"><span>${text}</span></div>`;
  }

  function renderBottomNav(active = state.view === 'favorites' ? 'favorites' : 'menu') {
    [
      [el.navMenu, active === 'menu'],
      [el.navFavorites, active === 'favorites'],
      [el.navCart, active === 'cart'],
      [el.navFilters, active === 'filters'],
      [el.navSupport, active === 'support']
    ].forEach(([node, isActive]) => node.classList.toggle('is-active', Boolean(isActive)));
  }

  function renderCategories() {
    el.categoryRow.innerHTML = quickCategories().map(item => `
      <button class="category-button ${state.filters.category === item.value ? 'is-active' : ''}" data-category="${item.value}" type="button">${item.label}</button>
    `).join('');

    const showBrands = state.filters.category === 'табак';
    el.brandSubfilters.classList.toggle('hidden', !showBrands);
    if (!showBrands) {
      el.brandSubfilters.innerHTML = '';
      return;
    }

    const brands = brandsForCategory('табак');
    el.brandSubfilters.innerHTML = brands.map(brand => `
      <button class="subfilter-chip ${state.filters.brand === brand ? 'is-active' : ''}" data-sub-brand="${escapeHtml(brand)}" type="button">${escapeHtml(brand)}</button>
    `).join('');
  }

  function renderFilterOptions() {
    el.filterCategoryGrid.innerHTML = categories().map(item => `
      <button class="filter-option ${state.filters.category === item.value ? 'is-active' : ''}" data-filter-category="${item.value}" type="button">${item.label}</button>
    `).join('');

    const filterBrandSource = state.filters.category !== 'all' ? brandsForCategory(state.filters.category) : brandsForCategory('all');
    const brandOptions = ['all', ...filterBrandSource];
    el.filterBrandGrid.innerHTML = brandOptions.map(item => {
      const value = item === 'all' ? 'all' : item;
      const label = item === 'all' ? 'Все бренды' : item;
      return `<button class="filter-option ${state.filters.brand === value ? 'is-active' : ''}" data-filter-brand="${escapeHtml(value)}" type="button">${escapeHtml(label)}</button>`;
    }).join('');

    el.priceMinInput.value = state.filters.priceMin;
    el.priceMaxInput.value = state.filters.priceMax;
  }

  function renderBanners() {
    const slides = state.banners.length ? state.banners : [{ id: 'fallback', theme: 'tiffany', image: '', title: '', subtitle: '' }];
    el.bannerTrack.innerHTML = slides.map(item => `
      <button class="banner-link" type="button" data-banner-id="${item.id}">
        <div class="banner-card theme-${item.theme || 'tiffany'}">
          ${item.image ? `<img class="banner-image" src="${item.image}" alt="Баннер" />` : `<div class="banner-art"><span class="banner-glow"></span><span class="banner-glow-2"></span></div>`}
        </div>
      </button>
    `).join('');

    el.bannerDots.innerHTML = slides.map((_, index) => `<span class="banner-dot ${index === state.activeBanner ? 'is-active' : ''}"></span>`).join('');
    syncBanner(state.activeBanner);
  }

  function syncBanner(index, offsetPx = 0) {
    const count = Math.max(state.banners.length || 1, 1);
    state.activeBanner = ((index % count) + count) % count;
    const width = el.bannerSection?.clientWidth || 0;
    const base = -(state.activeBanner * width);
    el.bannerTrack.style.transform = width
      ? `translate3d(${base + offsetPx}px, 0, 0)`
      : `translateX(-${state.activeBanner * 100}%)`;
    [...el.bannerDots.children].forEach((node, i) => node.classList.toggle('is-active', i === state.activeBanner));
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

  function priceControlHtml(product, variant, isSheet = false) {
    const qty = cartQty(product.id, variant?.id || '');
    const sizeClass = isSheet ? ' cart-stepper-sheet' : '';
    if (qty > 0) {
      return `<div class="cart-stepper${sizeClass}${isSheet ? '' : ' cart-stepper-card'}" data-cart-stepper="${product.id}" data-variant-id="${variant?.id || ''}">

        <button class="cart-stepper-button" type="button" data-cart-minus="${product.id}" data-variant-id="${variant?.id || ''}" aria-label="Уменьшить">−</button>
        <span class="cart-stepper-value">${qty}</span>
        <button class="cart-stepper-button" type="button" data-cart-plus="${product.id}" data-variant-id="${variant?.id || ''}" aria-label="Увеличить">+</button>
      </div>`;
    }
    if (isSheet) {
      return `<button class="sheet-add-button" type="button" data-add-to-cart="${product.id}" data-variant-id="${variant?.id || ''}" aria-label="Добавить в корзину">${icon('cart')}<span class="sheet-add-label">В корзину</span></button>`;
    }
    return `<button class="cart-icon-button" type="button" data-add-to-cart="${product.id}" data-variant-id="${variant?.id || ''}" aria-label="Добавить в корзину">${icon('cart')}</button>`;
  }

  function variantChipsHtml(product, isSheet = false) {
    const variants = Array.isArray(product.variants) ? product.variants : [];
    if (!variants.length) return '';
    const selected = currentVariant(product)?.id;
    return `<div class="variant-row ${isSheet ? 'variant-row-sheet' : ''}">
      ${variants.map(item => `
        <button class="variant-chip ${selected === item.id ? 'is-active' : ''}" type="button" data-variant-select="${product.id}" data-variant-id="${item.id}">${escapeHtml(item.label)}</button>
      `).join('')}
    </div>`;
  }

  function renderProducts() {
    const products = activeProducts();
    if (!products.length) {
      el.productGrid.innerHTML = '<div class="empty-state">Ничего не найдено</div>';
      return;
    }

    el.productGrid.innerHTML = products.map(product => {
      const isFavorite = state.favorites.includes(product.id);
      const variant = currentVariant(product);
      const price = variant?.price ?? product.price;
      return `
        <article class="product-card" data-open-product="${product.id}">
          <div class="product-image-wrap theme-${product.accent || 'tiffany'}">
            ${product.image
              ? `<img class="product-image" src="${product.image}" alt="${escapeHtml(product.name)}" />`
              : `<div class="product-fallback">${fallbackVisual(product)}</div>`}
            <div class="product-actions">
              <button class="mini-action" type="button" data-share="${product.id}">${icon('share')}</button>
              <button class="mini-action" type="button" data-favorite="${product.id}">${icon('heart', isFavorite)}</button>
            </div>
          </div>
          <div class="product-name">${escapeHtml(product.name)}</div>
          ${product.category === 'табак' ? variantChipsHtml(product) : ''}
          <div class="price-row">
            <div>
              <div class="product-price">${money(price)}</div>
              ${variant ? `<div class="product-variant-caption">${escapeHtml(variant.label)}</div>` : ''}
            </div>
            ${priceControlHtml(product, variant)}
          </div>
        </article>
      `;
    }).join('');
  }

  function renderCart() {
    const items = state.cart.map(entry => {
      const product = state.products.find(item => item.id === entry.id);
      return product ? { ...product, qty: entry.qty, variantId: entry.variantId, variantLabel: entry.variantLabel, price: entry.price } : null;
    }).filter(Boolean);

    const totalQty = cartTotalQty();
    el.cartCountBadge.textContent = String(totalQty);
    el.cartCountBadge.classList.toggle('hidden', totalQty === 0);

    if (!items.length) {
      el.cartList.innerHTML = '<div class="empty-state">Корзина пока пуста</div>';
      el.cartTotalLabel.textContent = '0 VND';
      return;
    }

    const total = items.reduce((sum, item) => sum + item.price * item.qty, 0);
    el.cartTotalLabel.textContent = money(total);
    el.cartList.innerHTML = items.map(item => `
      <div class="cart-item">
        <div>
          <div class="cart-item-name">${escapeHtml(item.name)}</div>
          <div class="cart-item-meta">${item.variantLabel ? `${escapeHtml(item.variantLabel)} • ` : ''}${item.qty} × ${money(item.price)}</div>
        </div>
        <div class="cart-item-side">
          <div class="cart-item-sum">${money(item.price * item.qty)}</div>
          ${priceControlHtml(item, item.variantLabel ? { id: item.variantId, label: item.variantLabel, price: item.price } : null)}
        </div>
      </div>
    `).join('');
  }

  function renderSupport() {
    if (!state.supportContacts.length) {
      el.supportList.innerHTML = '<div class="empty-state">Контакты пока не добавлены</div>';
      return;
    }
    el.supportList.innerHTML = state.supportContacts.map(item => `
      <button class="support-item" type="button" data-contact-link="${escapeHtml(item.link || '')}">
        <span class="support-item-title">${escapeHtml(item.title || 'Контакт')}</span>
        <span class="support-item-value">${escapeHtml(item.value || item.link || '')}</span>
      </button>
    `).join('');
  }

  function renderProductSheet(productId, shouldOpen = true) {
    const product = state.products.find(item => item.id === productId);
    if (!product) return;
    state.activeProductId = productId;
    const variant = currentVariant(product);
    const price = variant?.price ?? product.price;
    el.productSheetTitle.textContent = product.name;
    el.productSheetBody.innerHTML = `
      <div class="product-sheet-card">
        <div class="product-sheet-media theme-${product.accent || 'tiffany'}">
          ${product.image
            ? `<img class="product-sheet-image" src="${product.image}" alt="${escapeHtml(product.name)}" />`
            : `<div class="product-fallback product-fallback-sheet">${fallbackVisual(product)}</div>`}
        </div>
        <div class="product-sheet-content">
          <div class="product-sheet-name">${escapeHtml(product.name)}</div>
          <div class="product-sheet-brand">${escapeHtml(product.brand || 'Без бренда')}</div>
          ${product.category === 'табак' ? variantChipsHtml(product, true) : ''}
          <div class="product-sheet-description">${escapeHtml(product.description || 'Описание пока не заполнено')}</div>
          <div class="product-sheet-meta">${escapeHtml(product.category)} • остаток ${Number(product.stock || 0)}</div>
          <div class="product-sheet-price-row">
            <div>
              <div class="product-sheet-price">${money(price)}</div>
              ${variant ? `<div class="product-variant-caption">${escapeHtml(variant.label)}</div>` : ''}
            </div>
            ${priceControlHtml(product, variant, true)}
          </div>
        </div>
      </div>
    `;
    if (shouldOpen) openSheet(el.productSheet, 'menu');
  }

  function setCategory(category) {
    const isSame = state.filters.category === category;
    state.filters.category = isSame ? 'all' : category;
    state.filters.brand = 'all';
    state.view = 'catalog';
    renderCategories();
    renderFilterOptions();
    renderProducts();
    renderBottomNav('menu');
  }

  function applyFilters() {
    state.filters.priceMin = String(el.priceMinInput.value || '').trim();
    state.filters.priceMax = String(el.priceMaxInput.value || '').trim();
    renderCategories();
    renderFilterOptions();
    renderProducts();
    state.view = state.view === 'favorites' ? 'favorites' : 'catalog';
    renderBottomNav(state.view === 'favorites' ? 'favorites' : 'menu');
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
    if (state.favorites.includes(productId)) {
      state.favorites = state.favorites.filter(id => id !== productId);
    } else {
      state.favorites = [...state.favorites, productId];
    }
    save(STORAGE_KEYS.likes, state.favorites);
    renderProducts();
    if (state.activeProductId === productId && !el.productSheet.classList.contains('hidden')) {
      renderProductSheet(productId, false);
    }
  }

  function productById(productId) {
    return state.products.find(item => item.id === productId) || null;
  }

  function selectedVariantForProduct(product, variantId = '') {
    const variants = Array.isArray(product.variants) ? product.variants : [];
    if (!variants.length) return null;
    return variants.find(item => item.id === (variantId || state.selectedVariants[product.id])) || variants[0];
  }

  function addToCart(productId, variantId, sourceNode) {
    const product = productById(productId);
    if (!product) return;
    const variant = selectedVariantForProduct(product, variantId);
    if (variant) rememberVariant(product.id, variant.id);
    setCartQty(product, cartQty(product.id, variant?.id || '') + 1, variant);

    const flightSource = sourceNode?.closest?.('[data-open-product]')?.querySelector('.product-image-wrap')
      || sourceNode?.closest?.('.product-sheet-card')?.querySelector('.product-sheet-media')
      || sourceNode;

    animateToCart(flightSource);
  }

  function animateToCart(sourceNode) {
    const cartTarget = el.navCart;
    if (!sourceNode || !cartTarget) return;

    const sourceRect = sourceNode.getBoundingClientRect();
    const targetRect = cartTarget.getBoundingClientRect();
    if (!sourceRect.width || !sourceRect.height) return;

    const clone = sourceNode.cloneNode(true);
    clone.querySelectorAll?.('.product-actions, .mini-action').forEach(node => node.remove());
    clone.classList.add('fly-clone');
    clone.style.left = `${sourceRect.left}px`;
    clone.style.top = `${sourceRect.top}px`;
    clone.style.width = `${sourceRect.width}px`;
    clone.style.height = `${sourceRect.height}px`;
    document.body.appendChild(clone);

    requestAnimationFrame(() => {
      const dx = targetRect.left + targetRect.width / 2 - (sourceRect.left + sourceRect.width / 2);
      const dy = targetRect.top + targetRect.height / 2 - (sourceRect.top + sourceRect.height / 2);
      clone.style.transform = `translate3d(${dx}px, ${dy}px, 0) scale(.14) rotate(-12deg)`;
      clone.style.opacity = '.14';
      clone.style.filter = 'blur(1.4px) saturate(1.15)';
      clone.style.borderRadius = '16px';
    });

    setTimeout(() => {
      clone.remove();
      el.navCart.classList.add('cart-pulse');
      setTimeout(() => el.navCart.classList.remove('cart-pulse'), 420);
    }, 820);
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
    showNotice.timer = setTimeout(() => { el.checkoutNotice.textContent = ''; }, 2200);
  }

  function switchView(view) {
    state.view = view;
    renderBottomNav(view === 'favorites' ? 'favorites' : 'menu');
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
    renderBottomNav('menu');
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

  function openSheet(sheet, activeNav = '') {
    closeAllSheets(false);
    el.sheetBackdrop.classList.remove('hidden');
    sheet.classList.remove('hidden');
    renderBottomNav(activeNav || (sheet === el.cartSheet ? 'cart' : sheet === el.filterSheet ? 'filters' : sheet === el.supportSheet ? 'support' : 'menu'));
  }

  function closeSheet(sheet) {
    sheet.classList.add('hidden');
    const hasOpen = [el.menuSheet, el.searchSheet, el.filterSheet, el.productSheet, el.cartSheet, el.supportSheet].some(node => !node.classList.contains('hidden'));
    if (!hasOpen) {
      el.sheetBackdrop.classList.add('hidden');
      renderBottomNav(state.view === 'favorites' ? 'favorites' : 'menu');
    }
  }

  function closeAllSheets(shouldHideBackdrop = true) {
    [el.menuSheet, el.searchSheet, el.filterSheet, el.productSheet, el.cartSheet, el.supportSheet].forEach(node => node.classList.add('hidden'));
    if (shouldHideBackdrop) el.sheetBackdrop.classList.add('hidden');
    renderBottomNav(state.view === 'favorites' ? 'favorites' : 'menu');
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
      await window.AppApi.createOrder({
        customer: {
          name: formData.get('name') || 'Telegram Client',
          phone,
          telegram
        },
        items: payload,
        total
      });
      state.cart = [];
      save(STORAGE_KEYS.cart, state.cart);
      renderCart();
      renderProducts();
      el.checkoutForm.reset();
      prefillTelegramField();
      showNotice('Заказ отправлен');
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
    el.searchToggle.addEventListener('click', () => {
      openSheet(el.searchSheet, 'menu');
      setTimeout(() => el.searchInput.focus(), 60);
    });

    el.menuCatalogBtn.addEventListener('click', () => {
      switchView('catalog');
      closeSheet(el.menuSheet);
    });

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

    el.searchInput.addEventListener('input', event => {
      state.search = String(event.target.value || '');
      renderProducts();
    });

    el.categoryRow.addEventListener('click', event => {
      const btn = event.target.closest('[data-category]');
      if (!btn) return;
      setCategory(btn.dataset.category);
    });

    el.brandSubfilters.addEventListener('click', event => {
      const btn = event.target.closest('[data-sub-brand]');
      if (!btn) return;
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
        renderProducts();
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
        renderProducts();
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

    el.heroLogoButton?.addEventListener('click', () => {
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
      renderBottomNav('menu');
    });

    el.navMenu.addEventListener('click', () => openSheet(el.menuSheet, 'menu'));
    el.navFavorites.addEventListener('click', () => {
      switchView(state.view === 'favorites' ? 'catalog' : 'favorites');
      closeAllSheets();
    });
    el.navCart.addEventListener('click', () => openSheet(el.cartSheet, 'cart'));
    el.navFilters.addEventListener('click', () => openSheet(el.filterSheet, 'filters'));
    el.navSupport.addEventListener('click', () => openSheet(el.supportSheet, 'support'));
  }

  async function init() {
    try {
      window.Telegram?.WebApp?.ready?.();
      window.Telegram?.WebApp?.expand?.();
      bindEvents();
      registerPwa();
      const data = await window.AppApi.getShopBootstrap();
      state.products = data.products || [];
      state.banners = data.banners || [];
      state.supportContacts = data.supportContacts || [];
      state.products.forEach(product => {
        if (product.variants?.length && !state.selectedVariants[product.id]) {
          state.selectedVariants[product.id] = product.variants[0].id;
        }
      });
      save(STORAGE_KEYS.selectedVariants, state.selectedVariants);
      prefillTelegramField();
      renderCategories();
      renderFilterOptions();
      renderBanners();
      renderProducts();
      renderSupport();
      renderCart();
      renderBottomNav('menu');
      startBannerAutoplay();
      handleStartApp();
    } catch (error) {
      el.productGrid.innerHTML = `<div class="empty-state">${escapeHtml(error.message)}</div>`;
    }
  }

  function registerPwa() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/shop-sw.js', { scope: '/shop/' }).catch(() => {});
    }
    window.addEventListener('beforeinstallprompt', event => {
      event.preventDefault();
      state.deferredPrompt = event;
      el.installAppBtn.classList.remove('hidden');
    });
  }

  init();
})();
