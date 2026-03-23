(function () {
  const STORAGE_KEYS = {
    likes: 'stav:likes',
    cart: 'stav:cart'
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
    likesHydrated: localStorage.getItem(STORAGE_KEYS.likes) !== null,
    cart: load(STORAGE_KEYS.cart, []),
    view: 'catalog',
    activeBanner: 0,
    bannerTimer: null,
    activeProductId: ''
  };

  const el = {
    bannerTrack: document.getElementById('bannerTrack'),
    bannerDots: document.getElementById('bannerDots'),
    categoryRow: document.getElementById('categoryRow'),
    productGrid: document.getElementById('productGrid'),
    sheetBackdrop: document.getElementById('sheetBackdrop'),
    searchSheet: document.getElementById('searchSheet'),
    filterSheet: document.getElementById('filterSheet'),
    productSheet: document.getElementById('productSheet'),
    cartSheet: document.getElementById('cartSheet'),
    supportSheet: document.getElementById('supportSheet'),
    searchToggle: document.getElementById('searchToggle'),
    searchInput: document.getElementById('searchInput'),
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
    bottomNav: document.querySelector('.bottom-nav'),
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
      { value: 'уголь', label: 'Уголь' },
      { value: 'табак', label: 'Табак' },
      { value: 'кальяны', label: 'Кальяны' },
      { value: 'прочее', label: 'Прочее' }
    ];
  }

  function quickCategories() {
    return categories().filter(item => item.value !== 'all');
  }

  function brandOptions() {
    const seen = new Set();
    const values = [];
    state.products.forEach(item => {
      const brand = String(item.brand || '').trim();
      if (!brand || seen.has(brand)) return;
      seen.add(brand);
      values.push(brand);
    });
    return values;
  }

  function seededFavorites(products) {
    if (state.likesHydrated) return;
    state.favorites = products.filter(item => item.favorite).map(item => item.id);
    save(STORAGE_KEYS.likes, state.favorites);
    state.likesHydrated = true;
  }

  function icon(name, active = false) {
    if (name === 'share') return '<span class="mini-icon mini-icon-share"></span>';
    if (name === 'heart') return `<span class="mini-icon mini-icon-heart ${active ? 'is-active' : ''}"></span>`;
    if (name === 'cart') return '<span class="mini-icon mini-icon-cart"></span>';
    return '';
  }

  function fallbackVisual(product) {
    if (product.category === 'уголь') return '<div class="cube"></div>';
    if (product.category === 'кальяны') return '<div class="hookah-line"></div>';
    return '<div class="bowl-line"></div>';
  }

  function getSheets() {
    return [el.searchSheet, el.filterSheet, el.productSheet, el.cartSheet, el.supportSheet];
  }

  function openSheet(sheet) {
    closeAllSheets();
    el.sheetBackdrop.classList.remove('hidden');
    sheet.classList.remove('hidden');
    requestAnimationFrame(() => sheet.classList.add('is-open'));
  }

  function closeSheet(sheet) {
    sheet.classList.remove('is-open');
    setTimeout(() => sheet.classList.add('hidden'), 220);
    const hasOpen = getSheets().some(node => node.classList.contains('is-open'));
    if (!hasOpen) el.sheetBackdrop.classList.add('hidden');
  }

  function closeAllSheets() {
    getSheets().forEach(sheet => {
      sheet.classList.remove('is-open');
      sheet.classList.add('hidden');
    });
    el.sheetBackdrop.classList.add('hidden');
  }

  function cartQty(productId) {
    const entry = state.cart.find(item => item.id === productId);
    return entry ? Number(entry.qty || 0) : 0;
  }

  function refreshAfterCartChange() {
    save(STORAGE_KEYS.cart, state.cart);
    renderCart();
    renderProducts();
    if (state.activeProductId && !el.productSheet.classList.contains('hidden')) {
      renderProductSheet(state.activeProductId, false);
    }
  }

  function setCartQty(productId, qty) {
    const nextQty = Math.max(0, Number(qty || 0));
    const index = state.cart.findIndex(item => item.id === productId);
    if (index === -1 && nextQty > 0) {
      state.cart.push({ id: productId, qty: nextQty });
    } else if (index !== -1 && nextQty > 0) {
      state.cart[index].qty = nextQty;
    } else if (index !== -1 && nextQty === 0) {
      state.cart.splice(index, 1);
    }
    refreshAfterCartChange();
  }

  function activeProducts() {
    let list = [...state.products];
    const { category, brand, priceMin, priceMax } = state.filters;

    if (category !== 'all') {
      list = list.filter(item => item.category === category);
    }
    if (brand !== 'all') {
      list = list.filter(item => String(item.brand || '').trim() === brand);
    }
    if (priceMin !== '') {
      list = list.filter(item => Number(item.price || 0) >= Number(priceMin || 0));
    }
    if (priceMax !== '') {
      list = list.filter(item => Number(item.price || 0) <= Number(priceMax || 0));
    }
    if (state.search.trim()) {
      const q = state.search.trim().toLowerCase();
      list = list.filter(item => [item.name, item.brand, item.description].some(value => String(value || '').toLowerCase().includes(q)));
    }
    if (state.view === 'favorites') {
      list = list.filter(item => state.favorites.includes(item.id));
    }
    return list;
  }

  function renderBottomNav() {
    const activeMap = {
      catalog: el.navMenu,
      favorites: el.navFavorites,
      cart: el.navCart
    };
    [el.navMenu, el.navFavorites, el.navCart, el.navFilters, el.navSupport].forEach(node => node.classList.remove('is-active'));
    const active = activeMap[state.view] || el.navMenu;
    if (active) active.classList.add('is-active');
  }

  function renderCategories() {
    el.categoryRow.innerHTML = quickCategories().map(item => `
      <button class="category-button ${state.filters.category === item.value ? 'is-active' : ''}" type="button" data-category="${item.value}">${item.label}</button>
    `).join('');
  }

  function renderFilterOptions() {
    const selectedCategory = state.filters.category;
    el.filterCategoryGrid.innerHTML = categories().map(item => `
      <button class="filter-option ${selectedCategory === item.value ? 'is-active' : ''}" type="button" data-filter-category="${item.value}">${item.label}</button>
    `).join('');

    const brands = ['all', ...brandOptions()];
    el.filterBrandGrid.innerHTML = brands.map(item => {
      const label = item === 'all' ? 'Все' : item;
      const active = state.filters.brand === item;
      return `<button class="filter-option ${active ? 'is-active' : ''}" type="button" data-filter-brand="${escapeHtml(item)}">${escapeHtml(label)}</button>`;
    }).join('');

    el.priceMinInput.value = state.filters.priceMin;
    el.priceMaxInput.value = state.filters.priceMax;
  }

  function renderBanners() {
    const slides = state.banners.length ? state.banners : [{ id: 'fallback', theme: 'coal', link: '', image: '' }];
    el.bannerTrack.innerHTML = slides.map(item => `
      <a class="banner-link" href="${item.link || '#'}" ${item.link ? 'target="_blank" rel="noreferrer"' : ''}>
        <div class="banner-card theme-${item.theme || 'coal'}">
          ${item.image ? `<img class="banner-image" src="${item.image}" alt="" />` : '<div class="banner-art"><span class="banner-smoke"></span><span class="banner-smoke-2"></span></div>'}
        </div>
      </a>
    `).join('');

    el.bannerDots.innerHTML = slides.map((_, index) => `
      <span class="banner-dot ${index === state.activeBanner ? 'is-active' : ''}"></span>
    `).join('');
  }

  function syncBanner(index) {
    const slidesCount = Math.max(state.banners.length, 1);
    state.activeBanner = ((index % slidesCount) + slidesCount) % slidesCount;
    el.bannerTrack.style.transform = `translateX(-${state.activeBanner * 100}%)`;
    [...el.bannerDots.children].forEach((node, i) => node.classList.toggle('is-active', i === state.activeBanner));
  }

  function startBannerAutoplay() {
    if (state.bannerTimer) clearInterval(state.bannerTimer);
    const count = Math.max(state.banners.length, 0);
    if (count < 2) return;
    state.bannerTimer = setInterval(() => syncBanner(state.activeBanner + 1), 4200);
  }

  function priceControlHtml(productId, isSheet = false) {
    const qty = cartQty(productId);
    const sizeClass = isSheet ? ' cart-stepper-sheet' : '';
    if (qty > 0) {
      return `<div class="cart-stepper${sizeClass}" data-cart-stepper="${productId}">
        <button class="cart-stepper-button" type="button" data-cart-minus="${productId}" aria-label="Уменьшить">−</button>
        <span class="cart-stepper-value">${qty}</span>
        <button class="cart-stepper-button" type="button" data-cart-plus="${productId}" aria-label="Увеличить">+</button>
      </div>`;
    }
    if (isSheet) {
      return `<button class="sheet-add-button" type="button" data-add-to-cart="${productId}" aria-label="Добавить в корзину"><span class="mini-icon mini-icon-cart"></span><span class="sheet-add-label">В корзину</span></button>`;
    }
    return `<button class="cart-icon-button" type="button" data-add-to-cart="${productId}" aria-label="Добавить в корзину">${icon('cart')}</button>`;
  }

  function renderProducts() {
    const products = activeProducts();
    if (!products.length) {
      el.productGrid.innerHTML = '<div class="empty-state">Ничего не найдено</div>';
      return;
    }

    el.productGrid.innerHTML = products.map(product => {
      const isFavorite = state.favorites.includes(product.id);
      return `
        <article class="product-card" data-open-product="${product.id}">
          <div class="product-image-wrap theme-${product.accent || 'coal'}">
            ${product.image
              ? `<img class="product-image" src="${product.image}" alt="${escapeHtml(product.name)}" />`
              : `<div class="product-fallback">${fallbackVisual(product)}</div>`}
            <div class="product-actions">
              <button class="mini-action" type="button" data-share="${product.id}">${icon('share')}</button>
              <button class="mini-action" type="button" data-favorite="${product.id}">${icon('heart', isFavorite)}</button>
            </div>
          </div>
          <div class="product-name">${escapeHtml(product.name)}</div>
          <div class="price-row">
            <div class="product-price">${money(product.price)}</div>
            ${priceControlHtml(product.id)}
          </div>
        </article>
      `;
    }).join('');
  }

  function renderCart() {
    const items = state.cart.map(entry => {
      const product = state.products.find(item => item.id === entry.id);
      return product ? { ...product, qty: entry.qty } : null;
    }).filter(Boolean);

    const totalQty = items.reduce((sum, item) => sum + item.qty, 0);
    el.cartCountBadge.textContent = String(totalQty);
    el.cartCountBadge.classList.toggle('hidden', totalQty === 0);

    if (!items.length) {
      el.cartList.innerHTML = '<div class="empty-state">Корзина пока пустая</div>';
      el.cartTotalLabel.textContent = '0 VND';
      return;
    }

    const total = items.reduce((sum, item) => sum + item.price * item.qty, 0);
    el.cartTotalLabel.textContent = money(total);
    el.cartList.innerHTML = items.map(item => `
      <div class="cart-item">
        <div>
          <div class="cart-item-name">${escapeHtml(item.name)}</div>
          <div class="cart-item-meta">${item.qty} × ${money(item.price)}</div>
        </div>
        <div class="cart-item-name">${money(item.price * item.qty)}</div>
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
    el.productSheetTitle.textContent = product.name;
    el.productSheetBody.innerHTML = `
      <div class="product-sheet-card">
        <div class="product-sheet-media theme-${product.accent || 'coal'}">
          ${product.image
            ? `<img class="product-image" src="${product.image}" alt="${escapeHtml(product.name)}" />`
            : `<div class="product-fallback">${fallbackVisual(product)}</div>`}
        </div>
        <div class="product-sheet-content">
          <div class="product-sheet-name">${escapeHtml(product.name)}</div>
          <div class="product-sheet-brand">${escapeHtml(product.brand || 'Без бренда')}</div>
          <div class="product-sheet-description">${escapeHtml(product.description || 'Описание пока не заполнено')}</div>
          <div class="product-sheet-meta">${escapeHtml(product.category)} • остаток ${Number(product.stock || 0)}</div>
          <div class="product-sheet-price-row">
            <div class="product-sheet-price">${money(product.price)}</div>
            ${priceControlHtml(product.id, true)}
          </div>
        </div>
      </div>
    `;
    if (shouldOpen) openSheet(el.productSheet);
  }

  function setCategory(category) {
    state.filters.category = category;
    renderCategories();
    renderFilterOptions();
    renderProducts();
  }

  function applyFilters() {
    state.filters.priceMin = String(el.priceMinInput.value || '').trim();
    state.filters.priceMax = String(el.priceMaxInput.value || '').trim();
    renderCategories();
    renderFilterOptions();
    renderProducts();
    switchView(state.view === 'favorites' ? 'favorites' : 'catalog');
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

  function addToCart(productId) {
    setCartQty(productId, cartQty(productId) + 1);
  }

  function animateToCart(sourceNode) {
    const cartTarget = el.navCart;
    if (!sourceNode || !cartTarget) return;

    const sourceRect = sourceNode.getBoundingClientRect();
    const targetRect = cartTarget.getBoundingClientRect();
    const clone = sourceNode.cloneNode(true);
    clone.classList.add('fly-clone');
    clone.style.left = `${sourceRect.left}px`;
    clone.style.top = `${sourceRect.top}px`;
    clone.style.width = `${sourceRect.width}px`;
    clone.style.height = `${sourceRect.height}px`;
    document.body.appendChild(clone);

    requestAnimationFrame(() => {
      const dx = targetRect.left + targetRect.width / 2 - (sourceRect.left + sourceRect.width / 2);
      const dy = targetRect.top + targetRect.height / 2 - (sourceRect.top + sourceRect.height / 2);
      clone.style.transition = 'transform 760ms cubic-bezier(.14,.86,.24,1), opacity 760ms ease, filter 760ms ease';
      clone.style.transform = `translate(${dx}px, ${dy}px) scale(.16) rotate(-18deg)`;
      clone.style.opacity = '.16';
      clone.style.filter = 'blur(1px) saturate(1.08)';
    });

    setTimeout(() => {
      clone.remove();
      el.navCart.classList.add('cart-pulse');
      setTimeout(() => el.navCart.classList.remove('cart-pulse'), 450);
    }, 780);
  }

  async function shareProduct(productId) {
    const product = state.products.find(item => item.id === productId);
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
      el.checkoutNotice.textContent = 'Ссылка скопирована';
      setTimeout(() => { if (el.checkoutNotice.textContent === 'Ссылка скопирована') el.checkoutNotice.textContent = ''; }, 1800);
    } catch {}
  }

  function switchView(view) {
    state.view = view;
    renderBottomNav();
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
      const product = state.products.find(item => item.id === entry.id);
      return product ? { id: product.id, name: product.name, qty: entry.qty, price: product.price } : null;
    }).filter(Boolean);
  }

  function handleStartApp() {
    const params = new URLSearchParams(location.search);
    const startApp = params.get('startapp') || '';
    if (!startApp.startsWith('product_')) return;
    const id = startApp.replace('product_', '');
    const exists = state.products.some(item => item.id === id);
    if (exists) setTimeout(() => renderProductSheet(id), 220);
  }

  function bindEvents() {
    el.searchToggle.addEventListener('click', () => {
      openSheet(el.searchSheet);
      setTimeout(() => el.searchInput.focus(), 60);
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
      switchView('catalog');
    });

    el.filterCategoryGrid.addEventListener('click', event => {
      const btn = event.target.closest('[data-filter-category]');
      if (!btn) return;
      state.filters.category = btn.dataset.filterCategory;
      renderFilterOptions();
    });

    el.filterBrandGrid.addEventListener('click', event => {
      const btn = event.target.closest('[data-filter-brand]');
      if (!btn) return;
      state.filters.brand = btn.dataset.filterBrand;
      renderFilterOptions();
    });

    el.applyFiltersBtn.addEventListener('click', applyFilters);
    el.resetFiltersBtn.addEventListener('click', () => {
      resetFilters();
      closeSheet(el.filterSheet);
    });

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

      const minusBtn = event.target.closest('[data-cart-minus]');
      if (minusBtn) {
        event.stopPropagation();
        setCartQty(minusBtn.dataset.cartMinus, cartQty(minusBtn.dataset.cartMinus) - 1);
        return;
      }

      const plusBtn = event.target.closest('[data-cart-plus]');
      if (plusBtn) {
        event.stopPropagation();
        const card = plusBtn.closest('.product-card');
        const flyNode = card?.querySelector('.product-image-wrap') || card;
        animateToCart(flyNode);
        addToCart(plusBtn.dataset.cartPlus);
        return;
      }

      const cartBtn = event.target.closest('[data-add-to-cart]');
      if (cartBtn) {
        event.stopPropagation();
        const card = cartBtn.closest('.product-card');
        const flyNode = card?.querySelector('.product-image-wrap') || card;
        animateToCart(flyNode);
        addToCart(cartBtn.dataset.addToCart);
        return;
      }

      const openBtn = event.target.closest('[data-open-product]');
      if (openBtn) {
        renderProductSheet(openBtn.dataset.openProduct);
      }
    });

    el.productSheet.addEventListener('click', event => {
      const minusBtn = event.target.closest('[data-cart-minus]');
      if (minusBtn) {
        setCartQty(minusBtn.dataset.cartMinus, cartQty(minusBtn.dataset.cartMinus) - 1);
        return;
      }
      const plusBtn = event.target.closest('[data-cart-plus]');
      if (plusBtn) {
        const flyNode = el.productSheet.querySelector('.product-sheet-media');
        animateToCart(flyNode);
        addToCart(plusBtn.dataset.cartPlus);
        return;
      }
      const addBtn = event.target.closest('[data-add-to-cart]');
      if (addBtn) {
        const flyNode = el.productSheet.querySelector('.product-sheet-media');
        animateToCart(flyNode);
        addToCart(addBtn.dataset.addToCart);
      }
    });

    el.supportList.addEventListener('click', event => {
      const item = event.target.closest('[data-contact-link]');
      if (!item) return;
      openSupportContact(item.dataset.contactLink);
    });

    el.bottomNav.addEventListener('click', event => {
      const item = event.target.closest('[data-nav]');
      if (!item) return;
      const nav = item.dataset.nav;
      if (nav === 'catalog') {
        state.search = '';
        el.searchInput.value = '';
        state.filters.category = 'all';
        state.filters.brand = 'all';
        state.filters.priceMin = '';
        state.filters.priceMax = '';
        switchView('catalog');
        renderCategories();
        renderFilterOptions();
        renderProducts();
        closeAllSheets();
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
      if (nav === 'favorites') {
        switchView(state.view === 'favorites' ? 'catalog' : 'favorites');
        closeAllSheets();
        return;
      }
      if (nav === 'cart') {
        switchView('cart');
        openSheet(el.cartSheet);
        return;
      }
      if (nav === 'filters') {
        renderFilterOptions();
        openSheet(el.filterSheet);
        return;
      }
      if (nav === 'support') {
        renderSupport();
        openSheet(el.supportSheet);
      }
    });

    el.checkoutForm.addEventListener('submit', async event => {
      event.preventDefault();
      const items = currentCartPayload();
      if (!items.length) return;
      const formData = new FormData(el.checkoutForm);
      const total = items.reduce((sum, item) => sum + item.qty * item.price, 0);
      try {
        await window.AppApi.createOrder({
          customer: {
            name: formData.get('name') || 'Telegram Client',
            phone: formData.get('phone') || ''
          },
          items,
          total
        });
        state.cart = [];
        refreshAfterCartChange();
        el.checkoutForm.reset();
        el.checkoutNotice.textContent = 'Заказ отправлен';
        closeSheet(el.cartSheet);
      } catch (error) {
        el.checkoutNotice.textContent = error.message || 'Ошибка';
      }
    });

    el.bannerTrack.addEventListener('pointerdown', () => {
      if (state.bannerTimer) clearInterval(state.bannerTimer);
    });

    let touchStartX = 0;
    let touchEndX = 0;
    el.bannerTrack.addEventListener('touchstart', event => {
      touchStartX = event.touches[0].clientX;
    }, { passive: true });

    el.bannerTrack.addEventListener('touchend', event => {
      touchEndX = event.changedTouches[0].clientX;
      if (Math.abs(touchEndX - touchStartX) > 40) {
        syncBanner(state.activeBanner + (touchEndX < touchStartX ? 1 : -1));
      }
      startBannerAutoplay();
    }, { passive: true });
  }

  async function init() {
    bindEvents();
    renderBottomNav();
    renderCategories();
    renderFilterOptions();
    renderCart();
    renderSupport();

    try {
      const data = await window.AppApi.getShopBootstrap();
      state.products = data.products || [];
      state.banners = data.banners || [];
      state.supportContacts = data.supportContacts || [];
      seededFavorites(state.products);
      renderBanners();
      renderFilterOptions();
      renderSupport();
      renderProducts();
      renderCart();
      syncBanner(0);
      startBannerAutoplay();
      handleStartApp();
    } catch (error) {
      el.productGrid.innerHTML = `<div class="empty-state">${escapeHtml(error.message || 'Ошибка загрузки')}</div>`;
    }

    if (window.Telegram?.WebApp) {
      window.Telegram.WebApp.ready();
      window.Telegram.WebApp.expand();
    }
  }

  init();
})();
