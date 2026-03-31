import { createOwnerHelpers } from './modules/owner-helpers.js';
import { createOwnerUi } from './modules/owner-ui.js';

(function () {
  const tokenKey = 'stav:owner:token';
  const PRODUCT_NEW_ID = '__new__';

  const state = {
    token: localStorage.getItem(tokenKey) || '',
    activeSection: 'dashboard',
    products: [],
    banners: [],
    brands: [],
    supportContacts: [],
    orders: [],
    posts: [],
    summary: null,
    lowStockAlerts: [],
    telegramConfig: null,
    editProductId: '',
    editBannerId: '',
    editBrandId: '',
    editSupportId: '',
    editOrderId: '',
    authExpiredAlertShown: false
  };

  const el = {
    ownerLogin: document.getElementById('ownerLogin'),
    ownerApp: document.getElementById('ownerApp'),
    loginForm: document.getElementById('loginForm'),
    ownerNav: document.getElementById('ownerNav'),
    logoutBtn: document.getElementById('logoutBtn'),
    statsGrid: document.getElementById('statsGrid'),
    topProducts: document.getElementById('topProducts'),
    lastOrders: document.getElementById('lastOrders'),
    productsList: document.getElementById('productsList'),
    brandsBody: document.getElementById('brandsBody'),
    bannersBody: document.getElementById('bannersBody'),
    supportBody: document.getElementById('supportBody'),
    ordersList: document.getElementById('ordersList'),
    ordersNavCount: document.getElementById('ordersNavCount'),
    postsHistory: document.getElementById('postsHistory'),
    telegramState: document.getElementById('telegramState'),
    lowStockAlerts: document.getElementById('lowStockAlerts'),
    newProductBtn: document.getElementById('newProductBtn'),
    newBrandBtn: document.getElementById('newBrandBtn'),
    newBannerBtn: document.getElementById('newBannerBtn'),
    newSupportBtn: document.getElementById('newSupportBtn'),
    brandForm: document.getElementById('brandForm'),
    bannerForm: document.getElementById('bannerForm'),
    supportForm: document.getElementById('supportForm'),
    postForm: document.getElementById('postForm')
  };

  const {
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
  } = createOwnerHelpers({ state, resizeImage, fileToDataUrl });

  const {
    renderOrders,
    variantRowsHtml,
    productCardTemplate,
    renderProductsList,
    renderForms,
    activateSection,
    loadBootstrap,
    updatePreview
  } = createOwnerUi({
    PRODUCT_NEW_ID,
    state,
    el,
    escapeHtml,
    money,
    categoryVariantMeta,
    variantPlaceholder,
    totalStock,
    displayPrice,
    allBrandNames,
    brandsForCategory,
    nameOptionsFor,
    normalizeVariantDrafts,
    looksLikeVideo,
    looksLikeGif,
    mediaFieldValue
  });

  function showApp(isVisible) {
    el.ownerLogin.classList.toggle('hidden', isVisible);
    el.ownerApp.classList.toggle('hidden', !isVisible);
  }

  function collectVariantsFromForm(form) {
    return [...form.querySelectorAll('[data-variant-row]')]
      .map((row, index) => ({
        id: row.querySelector('input[name="variantId"]')?.value || `variant-${Date.now()}-${index}`,
        label: row.querySelector('input[name="variantLabel"]')?.value || '',
        price: Number(row.querySelector('input[name="variantPrice"]')?.value || 0),
        stock: Number(row.querySelector('input[name="variantStock"]')?.value || 0),
        minStock: Number(row.querySelector('input[name="variantMinStock"]')?.value || 0)
      }))
      .filter(item => String(item.label || '').trim());
  }

  async function resizeImage(file, maxSize = 1080, quality = 0.8, outputType = 'image/jpeg') {
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

    const image = await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = dataUrl;
    });

    const ratio = Math.min(1, maxSize / Math.max(image.width, image.height));
    const width = Math.max(1, Math.round(image.width * ratio));
    const height = Math.max(1, Math.round(image.height * ratio));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(image, 0, 0, width, height);
    if (outputType === 'image/png') return canvas.toDataURL('image/png');
    return canvas.toDataURL(outputType || 'image/jpeg', quality);
  }

  async function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function clearImageFields(form, urlFieldName = 'image', fileFieldName = 'imageFile') {
    const file = form.querySelector(`input[name="${fileFieldName}"]`);
    const text = form.querySelector(`input[name="${urlFieldName}"]`);
    if (file) file.value = '';
    if (text) text.value = '';
  }

  function draftFromProductForm(form) {
    const formData = new FormData(form);
    const id = String(formData.get('id') || '');
    const existing = state.products.find(item => item.id === id) || {};
    return {
      ...existing,
      id,
      name: String(formData.get('name') || existing.name || ''),
      brand: String(formData.get('brand') || existing.brand || ''),
      category: String(formData.get('category') || existing.category || 'табак'),
      price: Number(formData.get('price') || existing.price || 0),
      stock: Number(formData.get('stock') || existing.stock || 0),
      favorite: formData.get('favorite') === 'on',
      isNew: formData.get('isNew') === 'on',
      isTop: formData.get('isTop') === 'on',
      homePriority: Number(formData.get('homePriority') || existing.homePriority || 0),
      hiddenFromCatalog: formData.get('hiddenFromCatalog') === 'on',
      minStock: Number(formData.get('minStock') || existing.minStock || 0),
      description: String(formData.get('description') || existing.description || ''),
      image: String(form.querySelector('input[name="image"]')?.value || existing.image || ''),
      variants: collectVariantsFromForm(form)
    };
  }

  function orderVariantOptionsHtml(productId = '', selectedVariantId = '') {
    const product = state.products.find(item => item.id === productId);
    const variants = Array.isArray(product?.variants) ? product.variants : [];
    if (!product || !variants.length) {
      return '<option value="" selected>Без варианта</option>';
    }
    const selectedExists = variants.some(item => item.id === selectedVariantId);
    const list = !selectedExists && selectedVariantId
      ? [{ id: selectedVariantId, label: 'Старый вариант' }, ...variants]
      : variants;
    return list.map(variant => `<option value="${escapeHtml(variant.id || '')}" ${(variant.id || '') === (selectedVariantId || '') ? 'selected' : ''}>${escapeHtml(variant.label || 'Без варианта')}</option>`).join('');
  }

  function orderProductOptionsHtml(selectedProductId = '') {
    const list = [...state.products].sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'ru'));
    const hasSelected = selectedProductId && list.some(item => item.id === selectedProductId);
    const items = !hasSelected && selectedProductId
      ? [{ id: selectedProductId, name: 'Удалённый товар', brand: '' }, ...list]
      : list;
    return items.map(product => `<option value="${escapeHtml(product.id)}" ${product.id === selectedProductId ? 'selected' : ''}>${escapeHtml(product.name || 'Товар')}${product.brand ? ` · ${escapeHtml(product.brand)}` : ''}</option>`).join('');
  }

  function makeOrderItemRow(item = {}) {
    const row = document.createElement('div');
    row.className = 'order-editor-row';
    row.setAttribute('data-order-item-row', '');
    row.innerHTML = `
      <select name="orderItemProduct">
        <option value="">Выбрать товар</option>
        ${orderProductOptionsHtml(String(item.id || ''))}
      </select>
      <select name="orderItemVariant">
        ${orderVariantOptionsHtml(String(item.id || ''), String(item.variantId || ''))}
      </select>
      <input name="orderItemQty" type="number" min="1" placeholder="Кол-во" value="${Number(item.qty || 1)}" />
      <button class="danger-btn" type="button" data-remove-order-item>Удалить</button>
    `;
    return row;
  }

  function collectOrderItemsFromForm(form) {
    return [...form.querySelectorAll('[data-order-item-row]')]
      .map(row => ({
        id: String(row.querySelector('select[name="orderItemProduct"]')?.value || '').trim(),
        variantId: String(row.querySelector('select[name="orderItemVariant"]')?.value || '').trim(),
        qty: Math.max(0, Math.floor(Number(row.querySelector('input[name="orderItemQty"]')?.value || 0)))
      }))
      .filter(item => item.id && item.qty > 0);
  }

  function draftFromOrderForm(form) {
    return {
      customer: {
        name: String(form.querySelector('input[name="customerName"]')?.value || ''),
        phone: String(form.querySelector('input[name="customerPhone"]')?.value || ''),
        telegram: String(form.querySelector('input[name="customerTelegram"]')?.value || '')
      },
      items: collectOrderItemsFromForm(form)
    };
  }

  function rerenderOpenProductForm(form) {
    const isNew = form.dataset.productInlineForm === PRODUCT_NEW_ID;
    const draft = draftFromProductForm(form);
    if (isNew) {
      state.editProductId = PRODUCT_NEW_ID;
      const card = el.productsList.querySelector(`[data-product-card="${PRODUCT_NEW_ID}"]`);
      if (card) card.outerHTML = productCardTemplate(draft, true);
      return;
    }
    const id = form.dataset.productInlineForm || draft.id;
    state.editProductId = id;
    const card = el.productsList.querySelector(`[data-product-card="${CSS.escape(id)}"]`);
    if (card) card.outerHTML = productCardTemplate({ ...draft, id }, false);
  }


  function handleOwnerAuthExpired() {
    if (!state.token && !el.ownerLogin.classList.contains('hidden')) return;
    localStorage.removeItem(tokenKey);
    state.token = '';
    state.authExpiredAlertShown = state.authExpiredAlertShown || false;
    showApp(false);
    if (!state.authExpiredAlertShown) {
      state.authExpiredAlertShown = true;
      alert('Сессия владельца истекла. Войдите снова.');
    }
  }

  function showActionError(error) {
    if (error && error.ownerAuthExpired) return;
    alert(error && error.message ? error.message : 'Произошла ошибка');
  }

  function bindEvents() {
    window.addEventListener('owner-auth-expired', handleOwnerAuthExpired);

    el.loginForm.addEventListener('submit', async event => {
      event.preventDefault();
      const formData = new FormData(el.loginForm);
      try {
        const data = await window.AppApi.ownerLogin({
          login: formData.get('login'),
          password: formData.get('password')
        });
        state.token = data.token;
        state.authExpiredAlertShown = false;
        localStorage.setItem(tokenKey, data.token);
        showApp(true);
        await loadBootstrap();
      } catch (error) {
        showActionError(error);
      }
    });

    el.ownerNav.addEventListener('click', event => {
      const btn = event.target.closest('[data-section]');
      if (!btn) return;
      activateSection(btn.dataset.section);
    });

    el.logoutBtn.addEventListener('click', () => {
      localStorage.removeItem(tokenKey);
      state.token = '';
      state.authExpiredAlertShown = false;
      showApp(false);
    });

    el.newProductBtn.addEventListener('click', () => {
      state.editProductId = PRODUCT_NEW_ID;
      renderProductsList();
      activateSection('products');
    });

    el.newBrandBtn?.addEventListener('click', () => {
      state.editBrandId = '';
      renderForms();
      activateSection('brands');
    });

    el.newBannerBtn.addEventListener('click', () => {
      state.editBannerId = '';
      renderForms();
      activateSection('banners');
    });

    el.newSupportBtn.addEventListener('click', () => {
      state.editSupportId = '';
      renderForms();
      activateSection('support');
    });

    el.productsList.addEventListener('click', async event => {
      const deleteBtn = event.target.closest('[data-delete-product]');
      if (deleteBtn && confirm('Удалить товар?')) {
        try {
          await window.AppApi.ownerDeleteProduct(state.token, deleteBtn.dataset.deleteProduct);
          if (state.editProductId === deleteBtn.dataset.deleteProduct) state.editProductId = '';
          await loadBootstrap();
        } catch (error) {
          showActionError(error);
        }
        return;
      }

      const editBtn = event.target.closest('[data-edit-product]');
      if (editBtn) {
        state.editProductId = editBtn.dataset.editProduct;
        renderProductsList();
        activateSection('products');
        return;
      }

      const openBtn = event.target.closest('[data-open-product-card]');
      if (openBtn && !event.target.closest('button')) {
        const id = openBtn.dataset.openProductCard;
        state.editProductId = state.editProductId === id ? '' : id;
        renderProductsList();
        return;
      }

      if (event.target.closest('[data-clear-product-image]')) {
        const form = event.target.closest('[data-product-inline-form]');
        clearImageFields(form);
        updatePreview(form, 'Товар');
        return;
      }

      const closeBtn = event.target.closest('[data-close-product-card]');
      if (closeBtn) {
        state.editProductId = '';
        renderProductsList();
        return;
      }

      const addBtn = event.target.closest('[data-add-variant]');
      if (addBtn) {
        const form = event.target.closest('[data-product-inline-form]');
        const editor = form?.querySelector('[data-variants-editor]');
        if (!editor) return;
        const category = editor.dataset.variantKind || form.querySelector('select[name="category"]')?.value || 'табак';
        editor.insertAdjacentHTML('beforeend', variantRowsHtml(category, [{ id: '', label: '', price: 0, stock: 0 }]));
        return;
      }

      const removeBtn = event.target.closest('[data-remove-variant]');
      if (removeBtn) {
        removeBtn.closest('[data-variant-row]')?.remove();
      }
    });

    el.productsList.addEventListener('change', async event => {
      const form = event.target.closest('[data-product-inline-form]');
      if (!form) return;
      if (event.target.matches('input[name="image"], input[name="imageFile"]')) {
        await updatePreview(form, 'Товар');
        return;
      }
      if (event.target.matches('select[name="namePreset"]')) {
        const nameInput = form.querySelector('input[name="name"]');
        if (nameInput && event.target.value) nameInput.value = event.target.value;
        return;
      }
      if (event.target.matches('select[name="category"], input[name="brand"]')) {
        rerenderOpenProductForm(form);
      }
    });

    el.productsList.addEventListener('submit', async event => {
      const form = event.target.closest('[data-product-inline-form]');
      if (!form) return;
      event.preventDefault();
      const formData = new FormData(form);
      const variants = collectVariantsFromForm(form);
      const payload = {
        id: formData.get('id') || '',
        name: formData.get('name') || '',
        brand: formData.get('brand') || '',
        category: formData.get('category') || 'прочее',
        accent: 'tiffany',
        price: Number(formData.get('price') || 0),
        stock: variants.length ? variants.reduce((sum, item) => sum + Number(item.stock || 0), 0) : Number(formData.get('stock') || 0),
        description: formData.get('description') || '',
        image: await mediaFieldValue(form),
        favorite: formData.get('favorite') === 'on',
        isNew: formData.get('isNew') === 'on',
        isTop: formData.get('isTop') === 'on',
        homePriority: Number(formData.get('homePriority') || 0),
        hiddenFromCatalog: formData.get('hiddenFromCatalog') === 'on',
        minStock: Number(formData.get('minStock') || 0),
        variants
      };
      try {
        const result = await window.AppApi.ownerSaveProduct(state.token, payload, !payload.id);
        state.editProductId = result?.product?.id || payload.id || '';
        await loadBootstrap();
        activateSection('products');
      } catch (error) {
        showActionError(error);
      }
    });

    el.brandsBody.addEventListener('click', async event => {
      const editBtn = event.target.closest('[data-edit-brand]');
      if (editBtn) {
        state.editBrandId = editBtn.dataset.editBrand;
        renderForms();
        activateSection('brands');
        return;
      }
      const deleteBtn = event.target.closest('[data-delete-brand]');
      if (deleteBtn && confirm('Удалить бренд? Если он выбран в товарах этой категории, выбор бренда будет очищен.')) {
        try {
          await window.AppApi.ownerDeleteBrand(state.token, deleteBtn.dataset.deleteBrand);
          state.editBrandId = '';
          await loadBootstrap();
        } catch (error) {
          showActionError(error);
        }
      }
    });

    el.brandForm.addEventListener('submit', async event => {
      event.preventDefault();
      const formData = new FormData(el.brandForm);
      const payload = {
        id: formData.get('id') || '',
        name: formData.get('name') || '',
        category: formData.get('category') || 'табак',
        logo: await mediaFieldValue(el.brandForm, {
          urlFieldName: 'logo',
          fileFieldName: 'logoFile',
          maxSize: 640,
          quality: 0.88,
          outputType: 'image/png'
        })
      };
      try {
        const result = await window.AppApi.ownerSaveBrand(state.token, payload, !payload.id);
        state.editBrandId = result?.brand?.id || payload.id || '';
        await loadBootstrap();
        activateSection('brands');
      } catch (error) {
        showActionError(error);
      }
    });

    el.brandForm.addEventListener('click', event => {
      if (!event.target.closest('[data-clear-brand-logo]')) return;
      clearImageFields(el.brandForm, 'logo', 'logoFile');
      updatePreview(el.brandForm, 'Логотип бренда', {
        urlFieldName: 'logo',
        fileFieldName: 'logoFile',
        maxSize: 640,
        quality: 0.88,
        outputType: 'image/png',
        mode: 'contain'
      });
    });

    el.brandForm.addEventListener('change', async event => {
      if (!event.target.matches('input[name="logo"], input[name="logoFile"]')) return;
      await updatePreview(el.brandForm, 'Логотип бренда', {
        urlFieldName: 'logo',
        fileFieldName: 'logoFile',
        maxSize: 640,
        quality: 0.88,
        outputType: 'image/png',
        mode: 'contain'
      });
    });

    el.bannersBody.addEventListener('click', async event => {
      const editBtn = event.target.closest('[data-edit-banner]');
      if (editBtn) {
        state.editBannerId = editBtn.dataset.editBanner;
        renderForms();
        activateSection('banners');
        return;
      }
      const deleteBtn = event.target.closest('[data-delete-banner]');
      if (deleteBtn && confirm('Удалить баннер?')) {
        try {
          await window.AppApi.ownerDeleteBanner(state.token, deleteBtn.dataset.deleteBanner);
          state.editBannerId = '';
          await loadBootstrap();
        } catch (error) {
          showActionError(error);
        }
      }
    });

    el.supportBody.addEventListener('click', async event => {
      const editBtn = event.target.closest('[data-edit-support]');
      if (editBtn) {
        state.editSupportId = editBtn.dataset.editSupport;
        renderForms();
        activateSection('support');
        return;
      }
      const deleteBtn = event.target.closest('[data-delete-support]');
      if (deleteBtn && confirm('Удалить контакт?')) {
        try {
          await window.AppApi.ownerDeleteSupportContact(state.token, deleteBtn.dataset.deleteSupport);
          state.editSupportId = '';
          await loadBootstrap();
        } catch (error) {
          showActionError(error);
        }
      }
    });

    el.ordersList.addEventListener('change', event => {
      const productSelect = event.target.closest('select[name="orderItemProduct"]');
      if (!productSelect) return;
      const row = productSelect.closest('[data-order-item-row]');
      const variantSelect = row?.querySelector('select[name="orderItemVariant"]');
      if (!variantSelect) return;
      variantSelect.innerHTML = orderVariantOptionsHtml(productSelect.value, '');
    });

    el.ordersList.addEventListener('click', async event => {
      const editBtn = event.target.closest('[data-edit-order]');
      if (editBtn) {
        const id = editBtn.dataset.editOrder;
        state.editOrderId = state.editOrderId === id ? '' : id;
        renderOrders();
        return;
      }

      const closeBtn = event.target.closest('[data-close-order-editor]');
      if (closeBtn) {
        state.editOrderId = '';
        renderOrders();
        return;
      }

      const addBtn = event.target.closest('[data-add-order-item]');
      if (addBtn) {
        const form = event.target.closest('[data-order-form]');
        const editor = form?.querySelector('[data-order-items-editor]');
        if (!editor) return;
        editor.appendChild(makeOrderItemRow({ id: '', variantId: '', qty: 1 }));
        return;
      }

      const removeBtn = event.target.closest('[data-remove-order-item]');
      if (removeBtn) {
        removeBtn.closest('[data-order-item-row]')?.remove();
        return;
      }

      const completeBtn = event.target.closest('[data-order-complete]');
      if (completeBtn) {
        const orderId = completeBtn.dataset.orderComplete;
        const form = el.ordersList.querySelector(`[data-order-form="${CSS.escape(orderId)}"]`);
        const payload = form ? draftFromOrderForm(form) : {};
        try {
          await window.AppApi.ownerSaveOrder(state.token, orderId, { ...payload, action: 'fulfilled' });
          state.editOrderId = '';
          await loadBootstrap();
          activateSection('orders');
        } catch (error) {
          showActionError(error);
        }
        return;
      }

      const failBtn = event.target.closest('[data-order-fail]');
      if (failBtn) {
        const orderId = failBtn.dataset.orderFail;
        const form = el.ordersList.querySelector(`[data-order-form="${CSS.escape(orderId)}"]`);
        const payload = form ? draftFromOrderForm(form) : {};
        try {
          await window.AppApi.ownerSaveOrder(state.token, orderId, { ...payload, action: 'failed' });
          state.editOrderId = '';
          await loadBootstrap();
          activateSection('orders');
        } catch (error) {
          showActionError(error);
        }
        return;
      }
    });

    el.ordersList.addEventListener('submit', async event => {
      const form = event.target.closest('[data-order-form]');
      if (!form) return;
      event.preventDefault();
      try {
        await window.AppApi.ownerSaveOrder(state.token, form.dataset.orderForm, { ...draftFromOrderForm(form), action: 'save' });
        await loadBootstrap();
        state.editOrderId = form.dataset.orderForm;
        renderOrders();
      } catch (error) {
        showActionError(error);
      }
    });

    [el.bannerForm, el.postForm].forEach(form => {
      form.addEventListener('change', async event => {
        if (event.target.matches('input[name="image"], input[name="imageFile"]')) {
          await updatePreview(form);
        }
      });
    });

    el.bannerForm.addEventListener('click', event => {
      if (!event.target.closest('[data-clear-banner-image]')) return;
      clearImageFields(el.bannerForm);
      updatePreview(el.bannerForm, 'Баннер');
    });

    el.bannerForm.addEventListener('submit', async event => {
      event.preventDefault();
      const formData = new FormData(el.bannerForm);
      const payload = {
        id: formData.get('id') || '',
        image: await mediaFieldValue(el.bannerForm),
        theme: 'tiffany',
        active: formData.get('active') === 'true',
        targetCategory: formData.get('targetCategory') || 'all',
        targetBrand: formData.get('targetBrand') || 'all',
        targetPriceMin: formData.get('targetPriceMin') || '',
        targetPriceMax: formData.get('targetPriceMax') || ''
      };
      try {
        await window.AppApi.ownerSaveBanner(state.token, payload, !payload.id);
        await loadBootstrap();
        activateSection('banners');
      } catch (error) {
        showActionError(error);
      }
    });

    el.supportForm.addEventListener('submit', async event => {
      event.preventDefault();
      const formData = new FormData(el.supportForm);
      const payload = {
        id: formData.get('id') || '',
        title: formData.get('title') || '',
        value: formData.get('value') || '',
        link: formData.get('link') || ''
      };
      try {
        await window.AppApi.ownerSaveSupportContact(state.token, payload, !payload.id);
        await loadBootstrap();
        activateSection('support');
      } catch (error) {
        showActionError(error);
      }
    });

    el.postForm.addEventListener('submit', async event => {
      event.preventDefault();
      const formData = new FormData(el.postForm);
      const payload = {
        target: formData.get('target') || 'group',
        text: formData.get('text') || '',
        image: await mediaFieldValue(el.postForm)
      };
      try {
        await window.AppApi.ownerCreatePost(state.token, payload);
        el.postForm.reset();
        await updatePreview(el.postForm, 'Пост');
        await loadBootstrap();
        activateSection('posts');
        alert('Пост отправлен');
      } catch (error) {
        showActionError(error);
      }
    });
  }

  async function init() {
    bindEvents();
    activateSection(state.activeSection);
    await updatePreview(el.postForm, 'Пост');
    if (!state.token) {
      showApp(false);
      return;
    }
    try {
      showApp(true);
      await loadBootstrap();
    } catch {
      showApp(false);
      state.authExpiredAlertShown = false;
      localStorage.removeItem(tokenKey);
    }
  }

  init();
})();
