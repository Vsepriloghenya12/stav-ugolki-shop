(function () {
  const STORAGE_KEYS = {
    likes: 'stav:likes',
    cart: 'stav:cart'
  };

  const state = {
    products: [],
    banners: [],
    supportUrl: '',
    category: 'all',
    search: '',
    favorites: load(STORAGE_KEYS.likes, []),
    likesHydrated: localStorage.getItem(STORAGE_KEYS.likes) !== null,
    cart: load(STORAGE_KEYS.cart, []),
    view: 'catalog',
    activeBanner: 0,
    bannerTimer: null
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
    searchToggle: document.getElementById('searchToggle'),
    searchInput: document.getElementById('searchInput'),
    filterGrid: document.getElementById('filterGrid'),
    productSheetTitle: document.getElementById('productSheetTitle'),
    productSheetBody: document.getElementById('productSheetBody'),
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
      { value: 'уголь', label: 'Уголь' },
      { value: 'табак', label: 'Табак' },
      { value: 'кальяны', label: 'Кальяны' },
      { value: 'прочее', label: 'Прочее' }
    ];
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

  function openSheet(sheet) {
    closeAllSheets();
    el.sheetBackdrop.classList.remove('hidden');
    sheet.classList.remove('hidden');
    requestAnimationFrame(() => sheet.classList.add('is-open'));
  }

  function closeSheet(sheet) {
    sheet.classList.remove('is-open');
    setTimeout(() => sheet.classList.add('hidden'), 220);
    if (![el.searchSheet, el.filterSheet, el.productSheet, el.cartSheet].some(node => node.classList.contains('is-open'))) {
      el.sheetBackdrop.classList.add('hidden');
    }
  }

  function closeAllSheets() {
    [el.searchSheet, el.filterSheet, el.productSheet, el.cartSheet].forEach(sheet => {
      sheet.classList.remove('is-open');
      sheet.classList.add('hidden');
    });
    el.sheetBackdrop.classList.add('hidden');
  }

  function cartQty(productId) {
    const entry = state.cart.find(item => item.id === productId);
    return entry ? Number(entry.qty || 0) : 0;
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
    save(STORAGE_KEYS.cart, state.cart);
    renderCart();
    renderProducts();
  }

  function activeProducts() {
    let list = [...state.products];
    if (state.category !== 'all') {
      list = list.filter(item => item.category === state.category);
    }
    if (state.search.trim()) {
      const q = state.search.trim().toLowerCase();
      list = list.filter(item => item.name.toLowerCase().includes(q));
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
    const items = categories();
    el.categoryRow.innerHTML = items.map(item => `
      <button class="category-button ${state.category === item.value ? 'is-active' : ''}" type="button" data-category="${item.value}">${item.label}</button>
    `).join('');
  }

  function renderFilterOptions() {
    el.filterGrid.innerHTML = categories().map(item => `
      <button class="filter-option ${state.category === item.value ? 'is-active' : ''}" type="button" data-filter-category="${item.value}">${item.label}</button>
    `).join('');
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

  function renderProducts() {
    const products = activeProducts();
    if (!products.length) {
      el.productGrid.innerHTML = '<div class="empty-state">Ничего не найдено</div>';
      return;
    }

    el.productGrid.innerHTML = products.map(product => {
      const isFavorite = state.favorites.includes(product.id);
      const qty = cartQty(product.id);
      const cartControl = qty > 0
        ? `<div class="cart-stepper" data-cart-stepper="${product.id}">
            <button class="cart-stepper-button" type="button" data-cart-minus="${product.id}" aria-label="Уменьшить">−</button>
            <span class="cart-stepper-value">${qty}</span>
            <button class="cart-stepper-button" type="button" data-cart-plus="${product.id}" aria-label="Увеличить">+</button>
          </div>`
        : `<button class="cart-icon-button" type="button" data-add-to-cart="${product.id}" aria-label="Добавить в корзину">${icon('cart')}</button>`;
      return `
        <article class="product-card" data-product-id="${product.id}">
          <div class="product-image-wrap theme-${product.accent || 'coal'}" data-open-product="${product.id}">
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
            ${cartControl}
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

  function renderProductSheet(productId) {
    const product = state.products.find(item => item.id === productId);
    if (!product) return;
    el.productSheetTitle.textContent = product.name;
    el.productSheetBody.innerHTML = `
      <div class="product-sheet-media product-image-wrap theme-${product.accent || 'coal'}">
        ${product.image
          ? `<img class="product-image" src="${product.image}" alt="${escapeHtml(product.name)}" />`
          : `<div class="product-fallback">${fallbackVisual(product)}</div>`}
      </div>
      <div class="product-sheet-meta">${escapeHtml(product.category)} • остаток ${Number(product.stock || 0)}</div>
      <div class="product-sheet-price-row">
        <div class="product-sheet-price">${money(product.price)}</div>
        <button class="sheet-add-button" type="button" data-sheet-add="${product.id}" aria-label="Добавить в корзину"></button>
      </div>
    `;
    openSheet(el.productSheet);
  }

  function setCategory(category) {
    state.category = category;
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
      clone.style.transition = 'transform 650ms cubic-bezier(.18,.8,.24,1), opacity 650ms ease';
      clone.style.transform = `translate(${dx}px, ${dy}px) scale(.16) rotate(-14deg)`;
      clone.style.opacity = '.2';
    });

    setTimeout(() => {
      clone.remove();
      el.navCart.classList.add('cart-pulse');
      setTimeout(() => el.navCart.classList.remove('cart-pulse'), 450);
    }, 680);
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

  function openSupport() {
    const url = state.supportUrl || 'https://t.me/your_support';
    if (window.Telegram?.WebApp?.openTelegramLink) {
      window.Telegram.WebApp.openTelegramLink(url);
    } else {
      window.open(url, '_blank', 'noreferrer');
    }
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

    el.filterGrid.addEventListener('click', event => {
      const btn = event.target.closest('[data-filter-category]');
      if (!btn) return;
      setCategory(btn.dataset.filterCategory);
      switchView('catalog');
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
        addToCart(plusBtn.dataset.cartPlus);
        animateToCart(flyNode);
        return;
      }

      const cartBtn = event.target.closest('[data-add-to-cart]');
      if (cartBtn) {
        event.stopPropagation();
        const card = cartBtn.closest('.product-card');
        const flyNode = card?.querySelector('.product-image-wrap') || card;
        addToCart(cartBtn.dataset.addToCart);
        animateToCart(flyNode);
        return;
      }

      const openBtn = event.target.closest('[data-open-product]');
      if (openBtn) {
        renderProductSheet(openBtn.dataset.openProduct);
      }
    });

    el.productSheet.addEventListener('click', event => {
      const addBtn = event.target.closest('[data-sheet-add]');
      if (!addBtn) return;
      const flyNode = el.productSheet.querySelector('.product-sheet-media');
      addToCart(addBtn.dataset.sheetAdd);
      animateToCart(flyNode);
    });

    el.bottomNav.addEventListener('click', event => {
      const item = event.target.closest('[data-nav]');
      if (!item) return;
      const nav = item.dataset.nav;
      if (nav === 'catalog') {
        state.search = '';
        el.searchInput.value = '';
        state.category = 'all';
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
        openSupport();
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
        save(STORAGE_KEYS.cart, state.cart);
        renderCart();
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

    try {
      const data = await window.AppApi.getShopBootstrap();
      state.products = data.products || [];
      state.banners = data.banners || [];
      state.supportUrl = data.supportUrl || '';
      seededFavorites(state.products);
      renderBanners();
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
