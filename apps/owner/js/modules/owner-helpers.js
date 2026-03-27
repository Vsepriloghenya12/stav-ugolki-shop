export function createOwnerHelpers(ctx) {
  const { state, resizeImage, fileToDataUrl } = ctx;

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;');
  }

  function money(value) {
    return `${Number(value || 0).toLocaleString('ru-RU')} VND`;
  }

  function normalizeVariantDrafts(variants, fallbackStock = 0) {
    return (Array.isArray(variants) ? variants : [])
      .map((item, index) => ({
        id: String(item.id || `variant-${Date.now()}-${index}`).slice(0, 60),
        label: String(item.label || '').trim(),
        price: Number(item.price || 0),
        stock: Number(item.stock ?? fallbackStock ?? 0),
        minStock: Math.max(0, Number(item.minStock ?? 0))
      }))
      .filter(item => item.label);
  }

  function categoryVariantMeta(category) {
    if (category === 'табак') {
      return {
        title: 'Граммовки табака',
        helper: 'Для каждой граммовки задайте цену и остаток отдельно. Если остаток 0, эта граммовка станет неактивной у клиента.'
      };
    }
    if (category === 'уголь') {
      return {
        title: 'Фасовки угля',
        helper: 'Для каждой фасовки укажите цену и остаток отдельно.'
      };
    }
    return {
      title: 'Варианты товара',
      helper: 'При необходимости можно добавить размеры или другие варианты товара.'
    };
  }

  function variantPlaceholder(category) {
    if (category === 'табак') return '20 г';
    if (category === 'уголь') return '1 кг';
    return 'Вариант';
  }

  function totalStock(product) {
    const variants = Array.isArray(product?.variants) ? product.variants : [];
    if (!variants.length) return Number(product?.stock || 0);
    return variants.reduce((sum, item) => sum + Number(item.stock || 0), 0);
  }

  function displayPrice(product) {
    const variants = Array.isArray(product?.variants) ? product.variants : [];
    if (!variants.length) return Number(product?.price || 0);
    return Math.min(...variants.map(item => Number(item.price || 0)));
  }

  function brandsForCategory(category, currentBrand = '') {
    const items = state.brands
      .filter(item => String(item.category || '') === String(category || ''))
      .map(item => String(item.name || '').trim())
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b, 'ru'));
    if (currentBrand && !items.includes(currentBrand)) items.unshift(currentBrand);
    return items;
  }

  function allBrandNames(currentBrand = '') {
    const items = [...new Set(state.brands.map(item => String(item.name || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ru'));
    if (currentBrand && !items.includes(currentBrand)) items.unshift(currentBrand);
    return items;
  }

  function nameOptionsFor(category, brand = '', currentId = '') {
    const normalizedBrand = String(brand || '').trim().toLowerCase();
    const names = new Set();
    state.products
      .filter(item => item.id !== currentId)
      .filter(item => String(item.category || '') === String(category || ''))
      .filter(item => !normalizedBrand || String(item.brand || '').trim().toLowerCase() === normalizedBrand)
      .forEach(item => names.add(String(item.name || '').trim()));

    if (!names.size) {
      state.products
        .filter(item => item.id !== currentId)
        .filter(item => String(item.category || '') === String(category || ''))
        .forEach(item => names.add(String(item.name || '').trim()));
    }

    return [...names].filter(Boolean).sort((a, b) => a.localeCompare(b, 'ru'));
  }

  function looksLikeVideo(src = '') {
    const value = String(src || '').toLowerCase();
    return value.startsWith('data:video/') || /\.(mp4|webm|mov|m4v)(\?|$)/i.test(value);
  }

  function looksLikeGif(src = '') {
    const value = String(src || '').toLowerCase();
    return value.startsWith('data:image/gif') || /\.gif(\?|$)/i.test(value);
  }

  async function mediaFieldValue(form) {
    const urlField = form.querySelector('input[name="image"]');
    const fileField = form.querySelector('input[name="imageFile"]');
    if (fileField?.files?.[0]) {
      const file = fileField.files[0];
      const type = String(file.type || '').toLowerCase();
      if (type.startsWith('video/') || type === 'image/gif') return fileToDataUrl(file);
      if (type.startsWith('image/')) return resizeImage(file);
      return fileToDataUrl(file);
    }
    return String(urlField?.value || '').trim();
  }

  return {
    escapeHtml,
    money,
    normalizeVariantDrafts,
    categoryVariantMeta,
    variantPlaceholder,
    totalStock,
    displayPrice,
    brandsForCategory,
    allBrandNames,
    nameOptionsFor,
    looksLikeVideo,
    looksLikeGif,
    mediaFieldValue
  };
}
