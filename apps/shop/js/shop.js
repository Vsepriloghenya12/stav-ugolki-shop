(function () {
  const state = {
    products: [],
    banners: [],
    supportUrl: '',
    category: 'all',
    search: '',
    favorites: load('stav:likes', []),
    cart: load('stav:cart', []),
    bannerIndex: 0,
    view: 'catalog'
  };

  const el = {
    bannerCarousel: document.getElementById('bannerCarousel'),
    categoryRow: document.getElementById('categoryRow'),
    productGrid: document.getElementById('productGrid'),
    searchToggle: document.getElementById('searchToggle'),
    searchPanel: document.getElementById('searchPanel'),
    searchInput: document.getElementById('searchInput'),
    productSheet: document.getElementById('productSheet'),
    sheetContent: document.getElementById('sheetContent'),
    cartSheet: document.getElementById('cartSheet'),
    cartList: document.getElementById('cartList'),
    cartBadge: document.getElementById('cartBadge'),
    checkoutForm: document.getElementById('checkoutForm'),
    bottomNav: document.querySelector('.bottom-nav')
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

  function icon(name) {
    const map = {
      search: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M21 21l-4.35-4.35" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="11" cy="11" r="6" stroke="currentColor" stroke-width="2"/></svg>',
      heart: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M12 20.7s-7-4.35-7-10.08A4.62 4.62 0 0 1 9.65 6a4.6 4.6 0 0 1 2.35.64A4.6 4.6 0 0 1 14.35 6 4.62 4.62 0 0 1 19 10.62C19 16.35 12 20.7 12 20.7Z" stroke="currentColor" stroke-width="2"/></svg>',
      heartFill: '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 20.7s-7-4.35-7-10.08A4.62 4.62 0 0 1 9.65 6a4.6 4.6 0 0 1 2.35.64A4.6 4.6 0 0 1 14.35 6 4.62 4.62 0 0 1 19 10.62C19 16.35 12 20.7 12 20.7Z"/></svg>',
      share: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><circle cx="18" cy="5" r="3" stroke="currentColor" stroke-width="2"/><circle cx="6" cy="12" r="3" stroke="currentColor" stroke-width="2"/><circle cx="18" cy="19" r="3" stroke="currentColor" stroke-width="2"/><path d="M8.8 10.8 15.2 7.2M8.8 13.2l6.4 3.6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
      bag: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M7 9V7a5 5 0 0 1 10 0v2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M5 9h14l-1 10a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 9Z" stroke="currentColor" stroke-width="2"/></svg>',
      close: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6 6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
      menu: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z" stroke="currentColor" stroke-width="1.8"/></svg><span>Меню</span>',
      favNav: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M12 20.7s-7-4.35-7-10.08A4.62 4.62 0 0 1 9.65 6a4.6 4.6 0 0 1 2.35.64A4.6 4.6 0 0 1 14.35 6 4.62 4.62 0 0 1 19 10.62C19 16.35 12 20.7 12 20.7Z" stroke="currentColor" stroke-width="2"/></svg><span>Избранное</span>',
      cartNav: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M7 9V7a5 5 0 0 1 10 0v2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M5 9h14l-1 10a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 9Z" stroke="currentColor" stroke-width="2"/></svg><span>Корзина</span>',
      filters: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M4 7h16M7 12h10M10 17h4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg><span>Фильтры</span>',
      support: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v8Z" stroke="currentColor" stroke-width="2"/></svg><span>Поддержка</span>'
    };
    return map[name] || '';
  }

  function getCategories() {
    return [
      { value: 'all', label: 'Все' },
      { value: 'уголь', label: 'Уголь' },
      { value: 'табак', label: 'Табак' },
      { value: 'кальяны', label: 'Кальяны' },
      { value: 'прочее', label: 'Прочее' }
    ];
  }

  function fallbackVisual(product) {
    if (product.category === 'кальяны') return '<div class="fallback-hookah"></div>';
    if (product.category === 'уголь') return '<div class="fallback-char"></div>';
    return '<div class="fallback-cube"></div>';
  }

  function filteredProducts() {
    let list = [...state.products];
    if (state.category !== 'all') list = list.filter(item => item.category === state.category);
    if (state.search.trim()) {
      const query = state.search.trim().toLowerCase();
      list = list.filter(item => item.name.toLowerCase().includes(query));
    }
    if (state.view === 'favorites') list = list.filter(item => state.favorites.includes(item.id));
    return list;
  }

  function renderHeaderIcons() {
    el.searchToggle.innerHTML = icon('search');
    document.querySelectorAll('.close-sheet').forEach(node => node.innerHTML = icon('close'));
    const navMap = ['menu', 'favNav', 'cartNav', 'filters', 'support'];
    [...document.querySelectorAll('.nav-item')].forEach((node, index) => node.innerHTML = navMap[index] ? icon(navMap[index]) : '');
  }

  function renderBanners() {
    const slides = state.banners.length ? state.banners : [{ id: 'fallback', theme: 'coal', link: '#' }];
    el.bannerCarousel.innerHTML = `
      ${slides.map(item => `
        <a class="banner-card theme-${item.theme || 'coal'}" href="${item.link || '#'}" ${item.link ? 'target="_blank" rel="noreferrer"' : ''}>
          ${item.image ? `<img class="product-picture" src="${item.image}" alt="" />` : '<div class="banner-visual"><span class="smoke-1"></span><span class="smoke-2"></span></div>'}
        </a>
      `).join('')}
    `;

    if (slides.length > 1) {
      const dots = document.createElement('div');
      dots.className = 'banner-dots';
      dots.innerHTML = slides.map((_, index) => `<div class="banner-dot ${index === state.bannerIndex ? 'is-active' : ''}"></div>`).join('');
      el.bannerCarousel.after(dots);
      syncDots();
    } else {
      const existingDots = document.querySelector('.banner-dots');
      if (existingDots) existingDots.remove();
    }
  }

  function syncDots() {
    const dots = document.querySelectorAll('.banner-dot');
    dots.forEach((dot, index) => dot.classList.toggle('is-active', index === state.bannerIndex));
  }

  function renderCategories() {
    el.categoryRow.innerHTML = getCategories().slice(1).map(item => `
      <button class="category-btn ${state.category === item.value ? 'is-active' : ''}" type="button" data-category="${item.value}">${item.label}</button>
    `).join('');
  }

  function renderProducts() {
    const products = filteredProducts();
    if (!products.length) {
      el.productGrid.innerHTML = '<div class="empty-state surface" style="grid-column: 1 / -1; border-radius: 24px;">Ничего не найдено</div>';
      return;
    }

    el.productGrid.innerHTML = products.map(product => {
      const isFav = state.favorites.includes(product.id);
      return `
        <article class="product-card fade-in" data-product-id="${product.id}">
          <div class="product-media accent-${product.accent || 'coal'}">
            ${product.image ? `<img class="product-picture" src="${product.image}" alt="${product.name}" />` : `<div class="product-fallback">${fallbackVisual(product)}</div>`}
            <div class="media-actions">
              <button class="icon-btn media-action" data-share="${product.id}" type="button">${icon('share')}</button>
              <button class="icon-btn media-action ${isFav ? 'is-favorite' : ''}" data-like="${product.id}" type="button">${isFav ? icon('heartFill') : icon('heart')}</button>
            </div>
          </div>
          <div class="product-name">${product.name}</div>
          <div class="product-meta">
            <div class="product-price">${money(product.price)}</div>
            <button class="icon-btn cart-action" data-add-to-cart="${product.id}" type="button">${icon('bag')}</button>
          </div>
        </article>
      `;
    }).join('');
  }

  function renderCart() {
    const totalQty = state.cart.reduce((sum, item) => sum + item.qty, 0);
    el.cartBadge.textContent = String(totalQty);
    el.cartBadge.classList.toggle('hidden', totalQty === 0);

    if (!state.cart.length) {
      el.cartList.innerHTML = '<div class="empty-state">Корзина пока пустая</div>';
      return;
    }

    const entries = state.cart.map(item => {
      const product = state.products.find(p => p.id === item.id);
      if (!product) return '';
      return `
        <div class="cart-item">
          <div>
            <div class="cart-item-name">${product.name}</div>
            <div class="cart-item-meta">${item.qty} × ${money(product.price)}</div>
          </div>
          <div class="cart-item-name">${money(product.price * item.qty)}</div>
        </div>
      `;
    }).join('');

    const total = state.cart.reduce((sum, item) => {
      const product = state.products.find(p => p.id === item.id);
      return sum + (product ? product.price * item.qty : 0);
    }, 0);

    el.cartList.innerHTML = `${entries}<div class="cart-item"><div class="cart-item-name">Итого</div><div class="cart-item-name">${money(total)}</div></div>`;
  }

  function openProductSheet(productId) {
    const product = state.products.find(item => item.id === productId);
    if (!product) return;
    el.sheetContent.innerHTML = `
      <div class="sheet-content-media product-media accent-${product.accent || 'coal'}">
        ${product.image ? `<img class="product-picture" src="${product.image}" alt="${product.name}" />` : `<div class="product-fallback">${fallbackVisual(product)}</div>`}
      </div>
      <div class="sheet-title">${product.name}</div>
      <div class="sheet-description">${product.category} • остаток ${product.stock}</div>
      <div class="sheet-price-row">
        <div class="sheet-title" style="font-size: 18px;">${money(product.price)}</div>
        <button class="sheet-cta" id="sheetAddBtn" type="button">В корзину</button>
      </div>
    `;
    el.productSheet.classList.remove('hidden');
    document.getElementById('sheetAddBtn').addEventListener('click', () => {
      addToCart(productId);
      el.productSheet.classList.add('hidden');
    });
  }

  function toggleFavorite(productId) {
    state.favorites = state.favorites.includes(productId)
      ? state.favorites.filter(id => id !== productId)
      : [...state.favorites, productId];
    save('stav:likes', state.favorites);
    renderProducts();
  }

  function addToCart(productId) {
    const current = state.cart.find(item => item.id === productId);
    if (current) {
      current.qty += 1;
    } else {
      state.cart.push({ id: productId, qty: 1 });
    }
    save('stav:cart', state.cart);
    renderCart();
  }

  async function shareProduct(productId) {
    const product = state.products.find(item => item.id === productId);
    if (!product) return;
    const url = `${location.origin}${location.pathname}?startapp=product_${productId}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: product.name, text: product.name, url });
      } catch {}
      return;
    }
    await navigator.clipboard.writeText(url);
  }

  function switchView(view) {
    state.view = view;
    document.querySelectorAll('.nav-item').forEach(node => {
      node.classList.toggle('is-active', node.dataset.nav === view || (view === 'catalog' && node.dataset.nav === 'catalog'));
    });
    if (view === 'cart') {
      el.cartSheet.classList.remove('hidden');
    } else if (view === 'support') {
      const url = state.supportUrl || 'https://t.me/your_support';
      if (window.Telegram?.WebApp?.openTelegramLink) {
        window.Telegram.WebApp.openTelegramLink(url);
      } else {
        window.open(url, '_blank', 'noreferrer');
      }
    } else {
      el.cartSheet.classList.add('hidden');
      renderProducts();
    }
  }

  function handleStartApp() {
    const params = new URLSearchParams(location.search);
    const startapp = params.get('startapp') || '';
    if (startapp.startsWith('product_')) {
      const productId = startapp.replace('product_', '');
      setTimeout(() => openProductSheet(productId), 200);
    }
  }

  function bindEvents() {
    el.searchToggle.addEventListener('click', () => {
      el.searchPanel.classList.toggle('hidden');
      if (!el.searchPanel.classList.contains('hidden')) {
        el.searchInput.focus();
      }
    });

    el.searchInput.addEventListener('input', event => {
      state.search = event.target.value || '';
      renderProducts();
    });

    el.categoryRow.addEventListener('click', event => {
      const button = event.target.closest('[data-category]');
      if (!button) return;
      state.category = button.dataset.category;
      renderCategories();
      renderProducts();
    });

    el.productGrid.addEventListener('click', event => {
      const shareBtn = event.target.closest('[data-share]');
      if (shareBtn) {
        event.stopPropagation();
        return shareProduct(shareBtn.dataset.share);
      }
      const likeBtn = event.target.closest('[data-like]');
      if (likeBtn) {
        event.stopPropagation();
        return toggleFavorite(likeBtn.dataset.like);
      }
      const cartBtn = event.target.closest('[data-add-to-cart]');
      if (cartBtn) {
        event.stopPropagation();
        addToCart(cartBtn.dataset.addToCart);
        return;
      }
      const card = event.target.closest('[data-product-id]');
      if (card) openProductSheet(card.dataset.productId);
    });

    document.addEventListener('click', event => {
      if (event.target.closest('[data-close-sheet]')) el.productSheet.classList.add('hidden');
      if (event.target.closest('[data-close-cart]')) el.cartSheet.classList.add('hidden');
    });

    el.bottomNav.addEventListener('click', event => {
      const item = event.target.closest('[data-nav]');
      if (!item) return;
      const nav = item.dataset.nav;
      if (nav === 'favorites') {
        switchView(state.view === 'favorites' ? 'catalog' : 'favorites');
      } else if (nav === 'filters') {
        const next = getCategories();
        const currentIndex = next.findIndex(item => item.value === state.category);
        const nextItem = next[(currentIndex + 1) % next.length] || next[0];
        state.category = nextItem.value;
        renderCategories();
        renderProducts();
      } else {
        switchView(nav);
      }
    });

    el.checkoutForm.addEventListener('submit', async event => {
      event.preventDefault();
      if (!state.cart.length) return;
      const formData = new FormData(el.checkoutForm);
      const items = state.cart.map(item => {
        const product = state.products.find(p => p.id === item.id);
        return {
          id: product.id,
          name: product.name,
          qty: item.qty,
          price: product.price
        };
      });
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
        save('stav:cart', state.cart);
        renderCart();
        el.checkoutForm.reset();
        el.cartSheet.classList.add('hidden');
        alert('Заказ отправлен');
      } catch (error) {
        alert(error.message);
      }
    });

    el.bannerCarousel.addEventListener('scroll', () => {
      const width = el.bannerCarousel.clientWidth || 1;
      state.bannerIndex = Math.round(el.bannerCarousel.scrollLeft / width);
      syncDots();
    });
  }

  async function init() {
    renderHeaderIcons();
    bindEvents();
    renderCart();
    try {
      const data = await window.AppApi.getShopBootstrap();
      state.products = data.products || [];
      state.banners = data.banners || [];
      state.supportUrl = data.supportUrl || '';
      renderBanners();
      renderCategories();
      renderProducts();
      handleStartApp();
    } catch (error) {
      el.productGrid.innerHTML = `<div class="empty-state surface" style="grid-column:1 / -1; border-radius:24px;">${error.message}</div>`;
    }

    if (window.Telegram?.WebApp) {
      window.Telegram.WebApp.ready();
      window.Telegram.WebApp.expand();
    }
  }

  init();
})();
