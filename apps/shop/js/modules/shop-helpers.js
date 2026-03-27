export function createShopHelpers(ctx) {
  const { state, save, STORAGE_KEYS } = ctx;

  function isPhoneLike() {
    return window.matchMedia?.('(hover: none), (pointer: coarse)').matches || /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || '');
  }

  function pulseHaptic(kind = 'light') {
    if (!isPhoneLike()) return;
    try {
      const haptic = window.Telegram?.WebApp?.HapticFeedback;
      if (haptic?.impactOccurred) {
        haptic.impactOccurred(kind);
        return;
      }
    } catch {}
    if (navigator.vibrate) navigator.vibrate(kind === 'medium' ? [18, 22, 18] : [14]);
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

  function mediaKind(src = '') {
    const value = String(src || '').toLowerCase();
    if (value.startsWith('data:video/') || /\.(mp4|webm|mov|m4v)(\?|$)/i.test(value)) return 'video';
    if (value.startsWith('data:image/gif') || /\.gif(\?|$)/i.test(value)) return 'gif';
    return 'image';
  }

  function productSupportsVariants(product) {
    return ['табак', 'уголь'].includes(product.category) && Array.isArray(product.variants) && product.variants.length > 0;
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

  function variantStock(product, variant = null) {
    if (!variant) return Math.max(0, Number(product?.stock || 0));
    const raw = variant?.stock;
    if (raw === undefined || raw === null || raw === '') return Math.max(0, Number(product?.stock || 0));
    return Math.max(0, Number(raw || 0));
  }

  function hasAvailableVariant(product) {
    const variants = Array.isArray(product?.variants) ? product.variants : [];
    if (!variants.length) return Math.max(0, Number(product?.stock || 0)) > 0;
    return variants.some(item => variantStock(product, item) > 0);
  }

  function currentVariant(product) {
    const variants = Array.isArray(product.variants) ? product.variants : [];
    if (!variants.length) return null;
    const selected = state.selectedVariants[product.id];
    const picked = variants.find(item => item.id === selected);
    if (picked) return picked;
    return variants.find(item => variantStock(product, item) > 0) || variants[0];
  }

  function totalStock(product) {
    const variants = Array.isArray(product?.variants) ? product.variants : [];
    if (!variants.length) return Math.max(0, Number(product?.stock || 0));
    return variants.reduce((sum, item) => sum + variantStock(product, item), 0);
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

  function maxQtyFor(product, variant = null) {
    if (variant) return variantStock(product, variant);
    return Math.max(0, Number(product?.stock || 0));
  }

  function activeProducts() {
    const search = state.search.trim().toLowerCase();
    let list = state.products.filter(item => !item.hiddenFromCatalog);

    if (state.view === 'favorites') {
      return sortProductsForDisplay(list.filter(item => state.favorites.includes(item.id)));
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

    return sortProductsForDisplay(list);
  }

  function sortProductsForDisplay(list) {
    const indexMap = new Map(state.products.map((item, index) => [item.id, index]));
    return [...list].sort((a, b) => {
      const topDiff = Number(Boolean(b.isTop)) - Number(Boolean(a.isTop));
      if (topDiff) return topDiff;
      const priorityDiff = Number(b.homePriority || 0) - Number(a.homePriority || 0);
      if (priorityDiff) return priorityDiff;
      const stockDiff = Number(totalStock(b) > 0) - Number(totalStock(a) > 0);
      if (stockDiff) return stockDiff;
      return (indexMap.get(a.id) ?? 0) - (indexMap.get(b.id) ?? 0);
    });
  }

  function historyStatusLabel(status) {
    const map = { new: 'Новая', fulfilled: 'Состоялась', failed: 'Не состоялась', paid: 'Состоялась', done: 'Состоялась', cancelled: 'Не состоялась' };
    return map[status] || 'Новая';
  }

  function productById(productId) {
    return state.products.find(item => item.id === productId) || null;
  }

  function selectedVariantForProduct(product, variantId = '') {
    const variants = Array.isArray(product.variants) ? product.variants : [];
    if (!variants.length) return null;
    return variants.find(item => item.id === (variantId || state.selectedVariants[product.id])) || currentVariant(product);
  }

  function shouldDisplayProduct(productId) {
    return activeProducts().some(item => item.id === productId);
  }

  return {
    isPhoneLike,
    pulseHaptic,
    money,
    escapeHtml,
    mediaKind,
    productSupportsVariants,
    categories,
    quickCategories,
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
  };
}
