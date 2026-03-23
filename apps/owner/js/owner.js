(function () {
  const tokenKey = 'stav:owner:token';
  const state = {
    token: localStorage.getItem(tokenKey) || '',
    products: [],
    banners: [],
    supportContacts: [],
    orders: [],
    summary: null,
    activeSection: 'dashboard',
    editProductId: '',
    editBannerId: '',
    editSupportId: ''
  };

  const el = {
    loginCard: document.getElementById('loginCard'),
    ownerApp: document.getElementById('ownerApp'),
    loginForm: document.getElementById('loginForm'),
    ownerNav: document.getElementById('ownerNav'),
    logoutBtn: document.getElementById('logoutBtn'),
    statsGrid: document.getElementById('statsGrid'),
    topProducts: document.getElementById('topProducts'),
    lastOrders: document.getElementById('lastOrders'),
    productsBody: document.getElementById('productsBody'),
    productForm: document.getElementById('productForm'),
    newProductBtn: document.getElementById('newProductBtn'),
    bannersBody: document.getElementById('bannersBody'),
    bannerForm: document.getElementById('bannerForm'),
    newBannerBtn: document.getElementById('newBannerBtn'),
    supportBody: document.getElementById('supportBody'),
    supportForm: document.getElementById('supportForm'),
    newSupportBtn: document.getElementById('newSupportBtn'),
    ordersList: document.getElementById('ordersList')
  };

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

  function showApp(isAuth) {
    el.loginCard.classList.toggle('hidden', isAuth);
    el.ownerApp.classList.toggle('hidden', !isAuth);
  }

  function mediaPreview(src, alt) {
    return src
      ? `<img class="form-media-preview" src="${escapeHtml(src)}" alt="${escapeHtml(alt)}" />`
      : '<div class="form-media-preview empty"></div>';
  }

  function renderStats() {
    const s = state.summary;
    if (!s) return;
    const cards = [
      ['Выручка', money(s.revenue)],
      ['Заказы', s.orderCount],
      ['Средний чек', money(s.averageCheck)],
      ['Активные баннеры', s.activeBanners],
      ['Избранные товары', s.favorites],
      ['Продано позиций', s.totalItemsSold],
      ['Оплачено', s.paidCount],
      ['Мало остатка', s.lowStock]
    ];

    el.statsGrid.innerHTML = cards.map(([label, value]) => `
      <div class="stat-card">
        <div class="stat-label">${label}</div>
        <div class="stat-value">${value}</div>
      </div>
    `).join('');
  }

  function renderTopProducts() {
    const items = state.summary?.topProducts || [];
    el.topProducts.innerHTML = items.length
      ? `<div class="list-lines">${items.map(item => `
          <div class="list-line">
            <div>
              <div>${escapeHtml(item.name)}</div>
              <div class="order-meta">${escapeHtml(item.brand || 'Без бренда')}</div>
            </div>
            <div>${item.sold} шт.</div>
          </div>`).join('')}</div>`
      : '<div class="order-meta">Пока нет данных</div>';
  }

  function renderLastOrders() {
    const items = state.orders.slice(0, 5);
    el.lastOrders.innerHTML = items.length
      ? `<div class="list-lines">${items.map(item => `
          <div class="list-line">
            <div>
              <div>${escapeHtml(item.customer?.name || '')}</div>
              <div class="order-meta">${item.status}</div>
            </div>
            <div>${money(item.total)}</div>
          </div>`).join('')}</div>`
      : '<div class="order-meta">Пока нет заказов</div>';
  }

  function renderProductsTable() {
    el.productsBody.innerHTML = state.products.map(item => `
      <tr>
        <td>
          <div class="product-mini">
            ${item.image ? `<img class="product-thumb" src="${escapeHtml(item.image)}" alt="${escapeHtml(item.name)}" />` : '<div class="product-thumb"></div>'}
            <span>${escapeHtml(item.name)}</span>
          </div>
        </td>
        <td>${escapeHtml(item.brand || '—')}</td>
        <td>${escapeHtml(item.category)}</td>
        <td>${money(item.price)}</td>
        <td>${item.stock}</td>
        <td>
          <div class="table-actions">
            <button class="ghost-btn" data-edit-product="${item.id}" type="button">Изменить</button>
            <button class="danger-btn" data-delete-product="${item.id}" type="button">Удалить</button>
          </div>
        </td>
      </tr>
    `).join('');
  }

  function renderBannersTable() {
    el.bannersBody.innerHTML = state.banners.map(item => `
      <tr>
        <td>${escapeHtml(item.id)}</td>
        <td>${escapeHtml(item.theme)}</td>
        <td><span class="banner-link-cut">${escapeHtml(item.link || '')}</span></td>
        <td>${item.active ? 'Да' : 'Нет'}</td>
        <td>
          <div class="table-actions">
            <button class="ghost-btn" data-edit-banner="${item.id}" type="button">Изменить</button>
            <button class="danger-btn" data-delete-banner="${item.id}" type="button">Удалить</button>
          </div>
        </td>
      </tr>
    `).join('');
  }

  function renderSupportTable() {
    el.supportBody.innerHTML = state.supportContacts.map(item => `
      <tr>
        <td>${escapeHtml(item.title || 'Контакт')}</td>
        <td>${escapeHtml(item.value || '')}</td>
        <td><span class="banner-link-cut">${escapeHtml(item.link || '')}</span></td>
        <td>
          <div class="table-actions">
            <button class="ghost-btn" data-edit-support="${item.id}" type="button">Изменить</button>
            <button class="danger-btn" data-delete-support="${item.id}" type="button">Удалить</button>
          </div>
        </td>
      </tr>
    `).join('');
  }

  function renderOrders() {
    el.ordersList.innerHTML = state.orders.length ? state.orders.map(order => `
      <div class="order-card">
        <div class="order-head">
          <div>
            <div class="order-id">${escapeHtml(order.id)}</div>
            <div class="order-meta">${escapeHtml(order.customer?.name || '')} • ${escapeHtml(order.customer?.phone || '')}</div>
          </div>
          <div>
            <select class="status-select" data-order-status-id="${order.id}">
              ${['new', 'paid', 'done', 'cancelled'].map(status => `<option value="${status}" ${status === order.status ? 'selected' : ''}>${status}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="order-items">${order.items.map(item => `${escapeHtml(item.name)} × ${item.qty}`).join('<br />')}</div>
        <div class="order-meta">${new Date(order.createdAt).toLocaleString('ru-RU')}</div>
        <div class="order-id">${money(order.total)}</div>
      </div>
    `).join('') : '<div class="order-meta">Пока нет заказов</div>';
  }

  function compressImage(file, maxWidth, maxHeight, quality) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const image = new Image();
        image.onload = () => {
          let width = image.width;
          let height = image.height;
          const ratio = Math.min(maxWidth / width, maxHeight / height, 1);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(image, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', quality));
        };
        image.onerror = () => reject(new Error('Не удалось прочитать изображение'));
        image.src = reader.result;
      };
      reader.onerror = () => reject(new Error('Не удалось прочитать файл'));
      reader.readAsDataURL(file);
    });
  }

  async function getProductImagePayload() {
    const fileInput = el.productForm.querySelector('input[name="imageFile"]');
    const imageField = el.productForm.querySelector('input[name="image"]');
    const file = fileInput?.files?.[0];
    if (file) return compressImage(file, 1200, 1200, 0.84);
    return imageField?.value || '';
  }

  async function getBannerImagePayload() {
    const fileInput = el.bannerForm.querySelector('input[name="imageFile"]');
    const imageField = el.bannerForm.querySelector('input[name="image"]');
    const file = fileInput?.files?.[0];
    if (file) return compressImage(file, 1600, 900, 0.84);
    return imageField?.value || '';
  }

  async function updatePreview(form, targetName) {
    const fileInput = form.querySelector('input[name="imageFile"]');
    const imageField = form.querySelector('input[name="image"]');
    const preview = form.querySelector('[data-preview]');
    if (!preview) return;
    const file = fileInput?.files?.[0];
    if (file) {
      try {
        const src = await compressImage(file, targetName === 'banner' ? 1600 : 1200, targetName === 'banner' ? 900 : 1200, 0.84);
        imageField.value = src;
        preview.innerHTML = mediaPreview(src, targetName === 'banner' ? 'Баннер' : 'Товар');
      } catch (error) {
        alert(error.message);
      }
      return;
    }
    preview.innerHTML = mediaPreview(imageField?.value || '', targetName === 'banner' ? 'Баннер' : 'Товар');
  }

  function productFormTemplate(product = {}) {
    return `
      <input type="hidden" name="id" value="${escapeHtml(product.id || '')}" />
      <input name="name" placeholder="Название" value="${escapeHtml(product.name || '')}" required />
      <div class="form-grid-2">
        <input name="brand" placeholder="Бренд" value="${escapeHtml(product.brand || '')}" />
        <select name="category">
          ${['уголь', 'табак', 'кальяны', 'прочее'].map(value => `<option value="${value}" ${value === product.category ? 'selected' : ''}>${value}</option>`).join('')}
        </select>
      </div>
      <div class="form-grid-2">
        <select name="accent">
          ${['ember', 'mint', 'coal'].map(value => `<option value="${value}" ${value === product.accent ? 'selected' : ''}>${value}</option>`).join('')}
        </select>
        <input name="stock" type="number" placeholder="Остаток" value="${Number(product.stock || 0)}" />
      </div>
      <div class="form-grid-2">
        <input name="price" type="number" placeholder="Цена" value="${Number(product.price || 0)}" />
        <label class="form-check"><input name="favorite" type="checkbox" ${product.favorite ? 'checked' : ''} /> Избранный</label>
      </div>
      <textarea name="description" placeholder="Описание">${escapeHtml(product.description || '')}</textarea>
      <div class="media-uploader">
        <input name="image" placeholder="URL изображения" value="${escapeHtml(product.image || '')}" />
        <input class="file-input" name="imageFile" type="file" accept="image/*" />
        <div class="helper-text">Можно вставить ссылку или загрузить фото с устройства. Загруженное фото автоматически сжимается.</div>
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
      <input name="link" placeholder="Ссылка" value="${escapeHtml(banner.link || '')}" />
      <div class="media-uploader">
        <input name="image" placeholder="URL изображения" value="${escapeHtml(banner.image || '')}" />
        <input class="file-input" name="imageFile" type="file" accept="image/*" />
        <div class="helper-text">Для баннера лучше горизонтальное фото. Можно дать ссылку или загрузить файл.</div>
        <div data-preview>${mediaPreview(banner.image || '', 'Баннер')}</div>
      </div>
      <div class="form-grid-2">
        <select name="theme">
          ${['ember', 'mint', 'coal'].map(value => `<option value="${value}" ${value === banner.theme ? 'selected' : ''}>${value}</option>`).join('')}
        </select>
        <select name="active">
          <option value="true" ${banner.active !== false ? 'selected' : ''}>Активен</option>
          <option value="false" ${banner.active === false ? 'selected' : ''}>Выключен</option>
        </select>
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
      <input name="link" placeholder="Ссылка (например https://t.me/username)" value="${escapeHtml(contact.link || '')}" required />
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
    state.summary = data.summary || null;
    if (!state.editProductId && state.products[0]) state.editProductId = state.products[0].id;
    if (!state.editBannerId && state.banners[0]) state.editBannerId = state.banners[0].id;
    if (!state.editSupportId && state.supportContacts[0]) state.editSupportId = state.supportContacts[0].id;
    renderAll();
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
      if (deleteBtn) {
        if (!confirm('Удалить товар?')) return;
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
      if (deleteBtn) {
        if (!confirm('Удалить баннер?')) return;
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
      if (deleteBtn) {
        if (!confirm('Удалить контакт?')) return;
        try {
          await window.AppApi.ownerDeleteSupportContact(state.token, deleteBtn.dataset.deleteSupport);
          state.editSupportId = '';
          await loadBootstrap();
        } catch (error) {
          alert(error.message);
        }
      }
    });

    el.productForm.addEventListener('change', async event => {
      if (event.target.matches('input[name="imageFile"], input[name="image"]')) {
        await updatePreview(el.productForm, 'product');
      }
    });

    el.bannerForm.addEventListener('change', async event => {
      if (event.target.matches('input[name="imageFile"], input[name="image"]')) {
        await updatePreview(el.bannerForm, 'banner');
      }
    });

    el.productForm.addEventListener('click', event => {
      const clearBtn = event.target.closest('[data-clear-product-image]');
      if (!clearBtn) return;
      const fileInput = el.productForm.querySelector('input[name="imageFile"]');
      const imageField = el.productForm.querySelector('input[name="image"]');
      if (fileInput) fileInput.value = '';
      if (imageField) imageField.value = '';
      updatePreview(el.productForm, 'product');
    });

    el.bannerForm.addEventListener('click', event => {
      const clearBtn = event.target.closest('[data-clear-banner-image]');
      if (!clearBtn) return;
      const fileInput = el.bannerForm.querySelector('input[name="imageFile"]');
      const imageField = el.bannerForm.querySelector('input[name="image"]');
      if (fileInput) fileInput.value = '';
      if (imageField) imageField.value = '';
      updatePreview(el.bannerForm, 'banner');
    });

    el.productForm.addEventListener('submit', async event => {
      event.preventDefault();
      const formData = new FormData(el.productForm);
      const payload = {
        id: formData.get('id') || '',
        name: formData.get('name') || '',
        brand: formData.get('brand') || '',
        category: formData.get('category') || 'прочее',
        accent: formData.get('accent') || 'ember',
        price: Number(formData.get('price') || 0),
        stock: Number(formData.get('stock') || 0),
        description: formData.get('description') || '',
        image: await getProductImagePayload(),
        favorite: formData.get('favorite') === 'on'
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
        link: formData.get('link') || '',
        image: await getBannerImagePayload(),
        theme: formData.get('theme') || 'ember',
        active: formData.get('active') === 'true'
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
  }

  async function init() {
    bindEvents();
    activateSection(state.activeSection);
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
