export function createShopUi(ctx) {
  const {
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
  } = ctx;

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

  function productBadgesHtml(product) {
    const badges = [];
    if (product.isNew) badges.push('<span class="product-badge product-badge--new">Новинка</span>');
    if (product.isTop) badges.push('<span class="product-badge product-badge--top">Топ</span>');
    if (!hasAvailableVariant(product)) badges.push('<span class="product-badge product-badge--sold">Нет в наличии</span>');
    if (!badges.length) return '';
    return `<div class="product-badges">${badges.join('')}</div>`;
  }

  function renderBottomNav(active = state.view === 'favorites' ? 'favorites' : 'catalog') {
    [
      [el.navMenu, active === 'catalog'],
      [el.navFavorites, active === 'favorites'],
      [el.navCart, active === 'cart'],
      [el.navSearch, active === 'search'],
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

    const brands = brandRecordsForCategory('табак');
    el.brandSubfilters.innerHTML = brands.map(brandLogoButtonHtml).join('');
  }

  function brandFallbackLabel(name = '') {
    const normalized = String(name || '').trim();
    if (!normalized) return 'BR';
    const letters = normalized
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map(part => part[0])
      .join('')
      .toUpperCase();
    return escapeHtml((letters || normalized.slice(0, 2)).toUpperCase());
  }

  function brandLogoButtonHtml(brand = {}) {
    const name = String(brand.name || '').trim();
    if (!name) return '';
    const activeClass = state.filters.brand === name ? ' is-active' : '';
    const media = brand.logo
      ? `<img class="subfilter-chip-logo" src="${escapeHtml(brand.logo)}" alt="${escapeHtml(name)}" loading="lazy" decoding="async" />`
      : `<span class="subfilter-chip-fallback" aria-hidden="true">${brandFallbackLabel(name)}</span>`;
    return `
      <button class="subfilter-chip subfilter-chip--brand${activeClass}" data-sub-brand="${escapeHtml(name)}" type="button" aria-label="${escapeHtml(name)}" title="${escapeHtml(name)}">
        <span class="subfilter-chip-media">${media}</span>
      </button>
    `;
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
    el.bannerTrack.innerHTML = slides.map(item => {
      const kind = mediaKind(item.image || '');
      const media = item.image
        ? (kind === 'video'
            ? `<video class="banner-video" src="${escapeHtml(item.image)}" autoplay muted loop playsinline preload="metadata"></video>`
            : `<img class="banner-image" src="${escapeHtml(item.image)}" alt="Баннер" loading="eager" decoding="async" />`)
        : `<div class="banner-art"><span class="banner-glow"></span><span class="banner-glow-2"></span></div>`;
      return `
      <button class="banner-link" type="button" data-banner-id="${item.id}">
        <div class="banner-card theme-${item.theme || 'tiffany'}">
          ${media}
        </div>
      </button>`;
    }).join('');

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

  function priceControlHtml(product, variant, isSheet = false) {
    const available = maxQtyFor(product, variant);
    const qty = cartQty(product.id, variant?.id || '');
    const sizeClass = isSheet ? ' cart-stepper-sheet' : '';
    if (qty > 0) {
      return `<div class="cart-stepper${sizeClass}${isSheet ? '' : ' cart-stepper-card'}" data-cart-stepper="${product.id}" data-variant-id="${variant?.id || ''}">
        <button class="cart-stepper-button" type="button" data-cart-minus="${product.id}" data-variant-id="${variant?.id || ''}" aria-label="Уменьшить">−</button>
        <span class="cart-stepper-value">${qty}</span>
        <button class="cart-stepper-button" type="button" data-cart-plus="${product.id}" data-variant-id="${variant?.id || ''}" aria-label="Увеличить" ${qty >= available ? 'disabled' : ''}>+</button>
      </div>`;
    }
    if (available <= 0) {
      return isSheet
        ? `<button class="sheet-add-button is-disabled" type="button" disabled aria-label="Нет в наличии">${icon('cart')}<span class="sheet-add-label">Нет в наличии</span></button>`
        : `<button class="cart-icon-button is-disabled" type="button" disabled aria-label="Нет в наличии">${icon('cart')}</button>`;
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
      ${variants.map(item => {
        const soldOut = variantStock(product, item) <= 0;
        return `
        <button class="variant-chip ${selected === item.id ? 'is-active' : ''} ${soldOut ? 'is-disabled' : ''}" type="button" data-variant-select="${product.id}" data-variant-id="${item.id}" ${soldOut ? 'disabled' : ''}>${escapeHtml(item.label)}</button>`;
      }).join('')}
    </div>`;
  }

  function productPriceCopyHtml(product, variant = currentVariant(product)) {
    const price = variant?.price ?? product.price;
    const variantInStock = maxQtyFor(product, variant);
    return `
      <div class="price-row-copy">
        <div class="product-price">${money(price)}</div>
        ${variant
          ? `<div class="product-variant-caption">${escapeHtml(variant.label)}${variantInStock <= 0 ? ' • нет в наличии' : ''}</div>`
          : `<div class="product-variant-caption">остаток ${totalStock(product)}</div>`}
      </div>
    `;
  }

  function productPriceRowHtml(product) {
    const variant = currentVariant(product);
    return `
      <div class="price-row">
        ${productPriceCopyHtml(product, variant)}
        <div class="price-row-cart-slot">
          ${priceControlHtml(product, variant)}
        </div>
      </div>
    `;
  }

  function productCardHtml(product) {
    const isFavorite = state.favorites.includes(product.id);
    return `
      <article class="product-card ${product.isTop ? 'product-card--top' : ''}" data-open-product="${product.id}" data-product-id="${product.id}" data-has-no-variants="${productSupportsVariants(product) ? 'false' : 'true'}">
        <div class="product-image-wrap theme-${product.accent || 'tiffany'}">
          ${productBadgesHtml(product)}
          ${product.image
            ? `<img class="product-image" src="${escapeHtml(product.image)}" alt="${escapeHtml(product.name)}" loading="lazy" decoding="async" fetchpriority="low" />`
            : `<div class="product-fallback">${fallbackVisual(product)}</div>`}
          <div class="product-actions">
            <button class="mini-action" type="button" data-share="${product.id}">${icon('share')}</button>
            <button class="mini-action" type="button" data-favorite="${product.id}">${icon('heart', isFavorite)}</button>
          </div>
        </div>
        <div class="product-name">${escapeHtml(product.name)}</div>
        ${productSupportsVariants(product) ? variantChipsHtml(product) : '<div class="variant-row variant-row-empty" aria-hidden="true"></div>'}
        ${productPriceRowHtml(product)}
      </article>
    `;
  }

  function renderProducts() {
    const products = activeProducts();
    if (!products.length) {
      el.productGrid.innerHTML = '<div class="empty-state">Ничего не найдено</div>';
      return;
    }

    el.productGrid.innerHTML = products.map(product => productCardHtml(product)).join('');
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

  function renderOrderHistory() {
    if (!el.historyList) return;
    if (!state.orderHistory.length) {
      el.historyList.innerHTML = '<div class="empty-state">История заказов пока пуста</div>';
      return;
    }
    el.historyList.innerHTML = state.orderHistory.map(order => `
      <article class="history-card">
        <div class="history-card-head">
          <div>
            <div class="history-card-title">Заказ ${escapeHtml(order.id || '')}</div>
            <div class="history-card-meta">${new Date(order.createdAt || Date.now()).toLocaleString('ru-RU')}</div>
          </div>
          <span class="history-status history-status--${escapeHtml(order.status || 'new')}">${escapeHtml(historyStatusLabel(order.status))}</span>
        </div>
        <div class="history-items">${(order.items || []).map(item => `<div class="mini-row"><span>${escapeHtml(item.name)}${item.variantLabel ? ` · ${escapeHtml(item.variantLabel)}` : ''} × ${item.qty}</span><strong>${money(item.price * item.qty)}</strong></div>`).join('')}</div>
        <div class="history-total">${money(order.total || 0)}</div>
      </article>
    `).join('');
  }

  function renderProductSkeletons(count = 6) {
    el.productGrid.innerHTML = Array.from({ length: count }).map(() => `
      <article class="product-card product-card-skeleton">
        <div class="product-image-wrap skeleton-box"></div>
        <div class="skeleton-line skeleton-line-title"></div>
        <div class="variant-row variant-row-empty skeleton-variants" aria-hidden="true"></div>
        <div class="price-row skeleton-price-row">
          <div class="skeleton-line skeleton-line-price"></div>
          <div class="skeleton-circle"></div>
        </div>
      </article>
    `).join('');
  }

  return {
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
    productPriceCopyHtml,
    productPriceRowHtml,
    productCardHtml,
    renderProducts,
    renderCart,
    renderSupport,
    renderOrderHistory,
    renderProductSkeletons
  };
}
