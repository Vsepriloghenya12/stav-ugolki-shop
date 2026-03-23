(function () {
  const tokenKey = 'stav:owner:token';

  const state = {
    token: localStorage.getItem(tokenKey) || '',
    activeSection: 'dashboard',
    products: [],
    banners: [],
    supportContacts: [],
    orders: [],
    posts: [],
    summary: null,
    telegramConfig: null,
    editProductId: '',
    editBannerId: '',
    editSupportId: ''
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
    productsBody: document.getElementById('productsBody'),
    bannersBody: document.getElementById('bannersBody'),
    supportBody: document.getElementById('supportBody'),
    ordersList: document.getElementById('ordersList'),
    postsHistory: document.getElementById('postsHistory'),
    telegramState: document.getElementById('telegramState'),
    newProductBtn: document.getElementById('newProductBtn'),
    newBannerBtn: document.getElementById('newBannerBtn'),
    newSupportBtn: document.getElementById('newSupportBtn'),
    productForm: document.getElementById('productForm'),
    bannerForm: document.getElementById('bannerForm'),
    supportForm: document.getElementById('supportForm'),
    postForm: document.getElementById('postForm')
  };

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

  function showApp(isVisible) {
    el.ownerLogin.classList.toggle('hidden', isVisible);
    el.ownerApp.classList.toggle('hidden', !isVisible);
  }

  function parseVariantsText(text) {
    return String(text || '')
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(Boolean)
      .map((line, index) => {
        const [labelPart, pricePart] = line.split('|');
        const label = String(labelPart || '').trim();
        const price = Number(String(pricePart || '').trim());
        if (!label || !Number.isFinite(price)) return null;
        return { id: `variant-${Date.now()}-${index}`, label, price };
      })
      .filter(Boolean);
  }

  function variantsText(variants) {
    return (Array.isArray(variants) ? variants : []).map(item => `${item.label}|${item.price}`).join('\n');
  }

  async function resizeImage(file, maxSize = 1400, quality = 0.86) {
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
    return canvas.toDataURL('image/jpeg', quality);
  }

  async function mediaFieldValue(form) {
    const urlField = form.querySelector('input[name="image"]');
    const fileField = form.querySelector('input[name="imageFile"]');
    if (fileField?.files?.[0]) return resizeImage(fileField.files[0]);
    return String(urlField?.value || '').trim();
  }

  function mediaPreview(src, alt = 'Изображение') {
    if (!src) return '<div class="preview-card empty">Изображение не выбрано</div>';
    return `<div class="preview-card"><img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}" /></div>`;
  }

  function statsData() {
    const s = state.summary || {};
    return [
      ['Выручка', money(s.revenue || 0)],
      ['Заказы', String(s.orderCount || 0)],
      ['Средний чек', money(s.averageCheck || 0)],
      ['Продано единиц', String(s.totalItemsSold || 0)]
    ];
  }

  function renderStats() {
    el.statsGrid.innerHTML = statsData().map(item => `
      <div class="stat-card">
        <div class="stat-label">${item[0]}</div>
        <div class="stat-value">${item[1]}</div>
      </div>
    `).join('');
  }

  function renderTopProducts() {
    const items = state.summary?.topProducts || [];
    el.topProducts.innerHTML = items.length
      ? items.map(item => `<div class="mini-row"><span>${escapeHtml(item.name)}</span><strong>${item.sold || 0}</strong></div>`).join('')
      : '<div class="empty-box">Пока нет данных</div>';
  }

  function renderLastOrders() {
    const items = state.orders.slice(0, 5);
    el.lastOrders.innerHTML = items.length
      ? items.map(item => `<div class="mini-row"><span>${escapeHtml(item.customer?.name || 'Клиент')}</span><strong>${money(item.total)}</strong></div>`).join('')
      : '<div class="empty-box">Заказов пока нет</div>';
  }

  function renderProductsTable() {
    el.productsBody.innerHTML = state.products.map(item => `
      <tr>
        <td>${escapeHtml(item.name)}</td>
        <td>${escapeHtml(item.category)}</td>
        <td>${escapeHtml(item.brand || '—')}</td>
        <td>${money(item.price)}</td>
        <td>${Number(item.stock || 0)}</td>
        <td>
          <div class="table-actions">
            <button class="ghost-btn" type="button" data-edit-product="${item.id}">Редактировать</button>
            <button class="danger-btn" type="button" data-delete-product="${item.id}">Удалить</button>
          </div>
        </td>
      </tr>
    `).join('');
  }

  function bannerTargetLabel(item) {
    const parts = [];
    if (item.targetCategory && item.targetCategory !== 'all') parts.push(item.targetCategory);
    if (item.targetBrand && item.targetBrand !== 'all') parts.push(item.targetBrand);
    if (item.targetPriceMin) parts.push(`от ${item.targetPriceMin}`);
    if (item.targetPriceMax) parts.push(`до ${item.targetPriceMax}`);
    return parts.join(' · ') || 'Без фильтра';
  }

  function renderBannersTable() {
    el.bannersBody.innerHTML = state.banners.map(item => `
      <tr>
        <td>${item.image ? '<span class="thumb-badge">Фото</span>' : 'Без фото'}</td>
        <td>${escapeHtml(bannerTargetLabel(item))}</td>
        <td>${item.active ? 'Активен' : 'Выключен'}</td>
        <td>
          <div class="table-actions">
            <button class="ghost-btn" type="button" data-edit-banner="${item.id}">Редактировать</button>
            <button class="danger-btn" type="button" data-delete-banner="${item.id}">Удалить</button>
          </div>
        </td>
      </tr>
    `).join('');
  }

  function renderSupportTable() {
    el.supportBody.innerHTML = state.supportContacts.map(item => `
      <tr>
        <td>${escapeHtml(item.title)}</td>
        <td>${escapeHtml(item.value || '—')}</td>
        <td>${escapeHtml(item.link)}</td>
        <td>
          <div class="table-actions">
            <button class="ghost-btn" type="button" data-edit-support="${item.id}">Редактировать</button>
            <button class="danger-btn" type="button" data-delete-support="${item.id}">Удалить</button>
          </div>
        </td>
      </tr>
    `).join('');
  }

  function renderOrders() {
    if (!state.orders.length) {
      el.ordersList.innerHTML = '<div class="empty-box">Заказов пока нет</div>';
      return;
    }
    el.ordersList.innerHTML = state.orders.map(order => `
      <div class="order-card">
        <div class="order-head">
          <div>
            <div class="order-title">${escapeHtml(order.customer?.name || 'Клиент')}</div>
            <div class="order-meta">${new Date(order.createdAt).toLocaleString('ru-RU')}</div>
            <div class="order-meta">${escapeHtml(order.customer?.phone || '')}${order.customer?.telegram ? ` · ${escapeHtml(order.customer.telegram)}` : ''}</div>
          </div>
          <div class="order-side">
            <strong>${money(order.total)}</strong>
            <select class="status-select" data-order-status-id="${order.id}">
              ${['new', 'paid', 'done', 'cancelled'].map(status => `<option value="${status}" ${order.status === status ? 'selected' : ''}>${status}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="order-items">
          ${order.items.map(item => `<div class="mini-row"><span>${escapeHtml(item.name)}${item.variantLabel ? ` · ${escapeHtml(item.variantLabel)}` : ''} × ${item.qty}</span><strong>${money(item.price * item.qty)}</strong></div>`).join('')}
        </div>
      </div>
    `).join('');
  }

  function renderPostsHistory() {
    el.postsHistory.innerHTML = state.posts.length
      ? state.posts.map(item => `
          <div class="post-item">
            <div class="mini-row"><span>${new Date(item.createdAt).toLocaleString('ru-RU')}</span><strong>${escapeHtml(item.target)}</strong></div>
            <div class="post-text">${escapeHtml(item.text)}</div>
          </div>
        `).join('')
      : '<div class="empty-box">Постов пока нет</div>';
  }

  function renderTelegramState() {
    const cfg = state.telegramConfig || {};
    const chips = [
      ['BOT_TOKEN', cfg.hasBotToken],
      ['ADMIN_GROUP_CHAT_ID', cfg.hasAdminGroup],
      ['CHANNEL_CHAT_ID', cfg.hasChannel]
    ];
    el.telegramState.innerHTML = chips.map(item => `<span class="state-chip ${item[1] ? 'ok' : 'warn'}">${item[0]}</span>`).join('');
  }

  function productFormTemplate(product = {}) {
    return `
      <input type="hidden" name="id" value="${escapeHtml(product.id || '')}" />
      <input name="name" placeholder="Название" value="${escapeHtml(product.name || '')}" required />
      <div class="form-grid-2">
        <input name="brand" placeholder="Бренд" value="${escapeHtml(product.brand || '')}" />
        <select name="category">
          ${['табак', 'уголь', 'кальяны', 'прочее'].map(value => `<option value="${value}" ${value === product.category ? 'selected' : ''}>${value}</option>`).join('')}
        </select>
      </div>
      <div class="form-grid-2">
        <select name="accent">
          ${['tiffany', 'ember', 'coal'].map(value => `<option value="${value}" ${value === product.accent ? 'selected' : ''}>${value}</option>`).join('')}
        </select>
        <input name="stock" type="number" placeholder="Остаток" value="${Number(product.stock || 0)}" />
      </div>
      <div class="form-grid-2">
        <input name="price" type="number" placeholder="Базовая цена" value="${Number(product.price || 0)}" />
        <label class="form-check"><input name="favorite" type="checkbox" ${product.favorite ? 'checked' : ''} /> Избранный</label>
      </div>
      <textarea name="description" placeholder="Описание">${escapeHtml(product.description || '')}</textarea>
      <textarea name="variantsText" placeholder="Граммовки для табака: одна строка = label|price">${escapeHtml(variantsText(product.variants))}</textarea>
      <div class="helper-text">Пример: 25 г|65000</div>
      <div class="media-uploader">
        <input name="image" placeholder="URL изображения" value="${escapeHtml(product.image || '')}" />
        <input class="file-input" name="imageFile" type="file" accept="image/*" />
        <div class="helper-text">Можно вставить ссылку или загрузить фото с устройства.</div>
        <div data-preview>${mediaPreview(product.image || '', product.name || 'Товар')}</div>
      </div>
      <div class="form-actions">
        <button class="owner-btn" type="submit">Сохранить</button>
        <button class="secondary-btn" type="button" data-clear-product-image>Очистить фото</button>
      </div>
    `;
  }

  function bannerFormTemplate(banner = {}) {
    return `
      <input type="hidden" name="id" value="${escapeHtml(banner.id || '')}" />
      <div class="form-grid-2">
        <select name="theme">
          ${['tiffany', 'ember', 'coal'].map(value => `<option value="${value}" ${value === banner.theme ? 'selected' : ''}>${value}</option>`).join('')}
        </select>
        <select name="active">
          <option value="true" ${banner.active !== false ? 'selected' : ''}>Активен</option>
          <option value="false" ${banner.active === false ? 'selected' : ''}>Выключен</option>
        </select>
      </div>
      <div class="form-grid-2">
        <select name="targetCategory">
          ${['all', 'табак', 'уголь', 'кальяны', 'прочее'].map(value => `<option value="${value}" ${value === (banner.targetCategory || 'all') ? 'selected' : ''}>${value === 'all' ? 'Все категории' : value}</option>`).join('')}
        </select>
        <input name="targetBrand" placeholder="Бренд или all" value="${escapeHtml(banner.targetBrand || 'all')}" />
      </div>
      <div class="form-grid-2">
        <input name="targetPriceMin" type="number" placeholder="Цена от" value="${escapeHtml(banner.targetPriceMin || '')}" />
        <input name="targetPriceMax" type="number" placeholder="Цена до" value="${escapeHtml(banner.targetPriceMax || '')}" />
      </div>
      <div class="media-uploader">
        <input name="image" placeholder="URL изображения" value="${escapeHtml(banner.image || '')}" />
        <input class="file-input" name="imageFile" type="file" accept="image/*" />
        <div class="helper-text">При нажатии на баннер клиенту откроется подборка по указанным фильтрам.</div>
        <div data-preview>${mediaPreview(banner.image || '', 'Баннер')}</div>
      </div>
      <div class="form-actions">
        <button class="owner-btn" type="submit">Сохранить</button>
        <button class="secondary-btn" type="button" data-clear-banner-image>Очистить фото</button>
      </div>
    `;
  }

  function supportFormTemplate(contact = {}) {
    return `
      <input type="hidden" name="id" value="${escapeHtml(contact.id || '')}" />
      <input name="title" placeholder="Название контакта" value="${escapeHtml(contact.title || '')}" required />
      <input name="value" placeholder="Текст / ник / телефон" value="${escapeHtml(contact.value || '')}" />
      <input name="link" placeholder="Ссылка" value="${escapeHtml(contact.link || '')}" required />
      <div class="form-actions">
        <button class="owner-btn" type="submit">Сохранить</button>
      </div>
    `;
  }

  function renderForms() {
    const product = state.products.find(item => item.id === state.editProductId) || {};
    el.productForm.innerHTML = productFormTemplate(product);
    const banner = state.banners.find(item => item.id === state.editBannerId) || {};
    el.bannerForm.innerHTML = bannerFormTemplate(banner);
    const contact = state.supportContacts.find(item => item.id === state.editSupportId) || {};
    el.supportForm.innerHTML = supportFormTemplate(contact);
  }

  function renderAll() {
    renderStats();
    renderTopProducts();
    renderLastOrders();
    renderProductsTable();
    renderBannersTable();
    renderSupportTable();
    renderOrders();
    renderPostsHistory();
    renderTelegramState();
    renderForms();
  }

  function activateSection(name) {
    state.activeSection = name;
    document.querySelectorAll('.owner-nav-item').forEach(node => node.classList.toggle('is-active', node.dataset.section === name));
    document.querySelectorAll('[data-section-panel]').forEach(node => node.classList.toggle('hidden', node.dataset.sectionPanel !== name));
  }

  async function loadBootstrap() {
    const data = await window.AppApi.ownerGetBootstrap(state.token);
    state.products = data.products || [];
    state.banners = data.banners || [];
    state.supportContacts = data.supportContacts || [];
    state.orders = data.orders || [];
    state.posts = data.posts || [];
    state.summary = data.summary || null;
    state.telegramConfig = data.telegramConfig || null;
    if (!state.editProductId && state.products[0]) state.editProductId = state.products[0].id;
    if (!state.editBannerId && state.banners[0]) state.editBannerId = state.banners[0].id;
    if (!state.editSupportId && state.supportContacts[0]) state.editSupportId = state.supportContacts[0].id;
    renderAll();
  }

  async function updatePreview(form, fallbackName = 'Изображение') {
    const src = await mediaFieldValue(form).catch(() => '');
    const preview = form.querySelector('[data-preview]');
    if (preview) preview.innerHTML = mediaPreview(src, fallbackName);
  }

  function clearImageFields(form) {
    const file = form.querySelector('input[name="imageFile"]');
    const text = form.querySelector('input[name="image"]');
    if (file) file.value = '';
    if (text) text.value = '';
  }

  function bindEvents() {
    el.loginForm.addEventListener('submit', async event => {
      event.preventDefault();
      const formData = new FormData(el.loginForm);
      try {
        const data = await window.AppApi.ownerLogin({
          login: formData.get('login'),
          password: formData.get('password')
        });
        state.token = data.token;
        localStorage.setItem(tokenKey, data.token);
        showApp(true);
        await loadBootstrap();
      } catch (error) {
        alert(error.message);
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
      showApp(false);
    });

    el.newProductBtn.addEventListener('click', () => {
      state.editProductId = '';
      renderForms();
      activateSection('products');
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

    el.productsBody.addEventListener('click', async event => {
      const editBtn = event.target.closest('[data-edit-product]');
      if (editBtn) {
        state.editProductId = editBtn.dataset.editProduct;
        renderForms();
        activateSection('products');
        return;
      }
      const deleteBtn = event.target.closest('[data-delete-product]');
      if (deleteBtn && confirm('Удалить товар?')) {
        try {
          await window.AppApi.ownerDeleteProduct(state.token, deleteBtn.dataset.deleteProduct);
          state.editProductId = '';
          await loadBootstrap();
        } catch (error) {
          alert(error.message);
        }
      }
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
          alert(error.message);
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
          alert(error.message);
        }
      }
    });

    el.ordersList.addEventListener('change', async event => {
      const select = event.target.closest('[data-order-status-id]');
      if (!select) return;
      try {
        await window.AppApi.ownerUpdateOrderStatus(state.token, select.dataset.orderStatusId, select.value);
        await loadBootstrap();
      } catch (error) {
        alert(error.message);
      }
    });

    [el.productForm, el.bannerForm, el.postForm].forEach(form => {
      form.addEventListener('change', async event => {
        if (event.target.matches('input[name="image"], input[name="imageFile"]')) {
          await updatePreview(form);
        }
      });
    });

    el.productForm.addEventListener('click', event => {
      if (!event.target.closest('[data-clear-product-image]')) return;
      clearImageFields(el.productForm);
      updatePreview(el.productForm, 'Товар');
    });

    el.bannerForm.addEventListener('click', event => {
      if (!event.target.closest('[data-clear-banner-image]')) return;
      clearImageFields(el.bannerForm);
      updatePreview(el.bannerForm, 'Баннер');
    });

    el.productForm.addEventListener('submit', async event => {
      event.preventDefault();
      const formData = new FormData(el.productForm);
      const payload = {
        id: formData.get('id') || '',
        name: formData.get('name') || '',
        brand: formData.get('brand') || '',
        category: formData.get('category') || 'прочее',
        accent: formData.get('accent') || 'tiffany',
        price: Number(formData.get('price') || 0),
        stock: Number(formData.get('stock') || 0),
        description: formData.get('description') || '',
        image: await mediaFieldValue(el.productForm),
        favorite: formData.get('favorite') === 'on',
        variants: parseVariantsText(formData.get('variantsText') || '')
      };
      try {
        await window.AppApi.ownerSaveProduct(state.token, payload, !payload.id);
        await loadBootstrap();
        activateSection('products');
      } catch (error) {
        alert(error.message);
      }
    });

    el.bannerForm.addEventListener('submit', async event => {
      event.preventDefault();
      const formData = new FormData(el.bannerForm);
      const payload = {
        id: formData.get('id') || '',
        image: await mediaFieldValue(el.bannerForm),
        theme: formData.get('theme') || 'tiffany',
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
        alert(error.message);
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
        alert(error.message);
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
        alert(error.message);
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
      localStorage.removeItem(tokenKey);
    }
  }

  init();
})();
