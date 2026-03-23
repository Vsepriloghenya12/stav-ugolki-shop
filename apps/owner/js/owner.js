(function () {
  const tokenKey = 'stav:owner:token';
  const state = {
    token: localStorage.getItem(tokenKey) || '',
    products: [],
    banners: [],
    orders: [],
    summary: null,
    activeSection: 'dashboard',
    editProductId: '',
    editBannerId: ''
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
            <div>${escapeHtml(item.name)}</div>
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
        <td>${escapeHtml(item.name)}</td>
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
        <td>${escapeHtml(item.link || '')}</td>
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

  function renderOrders() {
    el.ordersList.innerHTML = state.orders.map(order => `
      <article class="order-card">
        <div class="order-head">
          <div>
            <div class="order-id">${escapeHtml(order.id)}</div>
            <div class="order-meta">${new Date(order.createdAt).toLocaleString('ru-RU')}</div>
          </div>
          <div>${money(order.total)}</div>
        </div>
        <div class="order-meta">${escapeHtml(order.customer?.name || '')} • ${escapeHtml(order.customer?.phone || '')}</div>
        <div class="order-items">${order.items.map(item => `${escapeHtml(item.name)} × ${item.qty}`).join('<br />')}</div>
        <div style="margin-top:12px; display:flex; gap:10px; flex-wrap:wrap; align-items:center;">
          <select class="status-select" data-order-status-id="${order.id}">
            ${['new', 'paid', 'done', 'cancelled'].map(status => `<option value="${status}" ${status === order.status ? 'selected' : ''}>${status}</option>`).join('')}
          </select>
        </div>
      </article>
    `).join('');
  }

  function productFormTemplate(product = {}) {
    return `
      <input type="hidden" name="id" value="${escapeHtml(product.id || '')}" />
      <input name="name" placeholder="Название" value="${escapeHtml(product.name || '')}" required />
      <div class="form-grid-2">
        <select name="category">
          ${['уголь', 'табак', 'кальяны', 'прочее'].map(value => `<option value="${value}" ${value === product.category ? 'selected' : ''}>${value}</option>`).join('')}
        </select>
        <select name="accent">
          ${['ember', 'mint', 'coal'].map(value => `<option value="${value}" ${value === product.accent ? 'selected' : ''}>${value}</option>`).join('')}
        </select>
      </div>
      <div class="form-grid-2">
        <input name="price" type="number" placeholder="Цена" value="${Number(product.price || 0)}" />
        <input name="stock" type="number" placeholder="Остаток" value="${Number(product.stock || 0)}" />
      </div>
      <input name="image" placeholder="URL изображения" value="${escapeHtml(product.image || '')}" />
      <label class="form-check"><input name="favorite" type="checkbox" ${product.favorite ? 'checked' : ''} /> Избранный</label>
      <div class="form-actions">
        <button class="owner-btn" type="submit">Сохранить</button>
      </div>
    `;
  }

  function bannerFormTemplate(banner = {}) {
    return `
      <input type="hidden" name="id" value="${escapeHtml(banner.id || '')}" />
      <input name="link" placeholder="Ссылка" value="${escapeHtml(banner.link || '')}" />
      <input name="image" placeholder="URL изображения" value="${escapeHtml(banner.image || '')}" />
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
      </div>
    `;
  }

  function renderForms() {
    const product = state.products.find(item => item.id === state.editProductId) || {};
    el.productForm.innerHTML = productFormTemplate(product);
    const banner = state.banners.find(item => item.id === state.editBannerId) || {};
    el.bannerForm.innerHTML = bannerFormTemplate(banner);
  }

  function renderAll() {
    renderStats();
    renderTopProducts();
    renderLastOrders();
    renderProductsTable();
    renderBannersTable();
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
    state.orders = data.orders || [];
    state.summary = data.summary || null;
    if (!state.editProductId && state.products[0]) state.editProductId = state.products[0].id;
    if (!state.editBannerId && state.banners[0]) state.editBannerId = state.banners[0].id;
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

    el.productsBody.addEventListener('click', async event => {
      const editBtn = event.target.closest('[data-edit-product]');
      if (editBtn) {
        state.editProductId = editBtn.dataset.editProduct;
        renderForms();
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

    el.productForm.addEventListener('submit', async event => {
      event.preventDefault();
      const formData = new FormData(el.productForm);
      const payload = {
        id: formData.get('id') || '',
        name: formData.get('name') || '',
        category: formData.get('category') || 'прочее',
        accent: formData.get('accent') || 'ember',
        price: Number(formData.get('price') || 0),
        stock: Number(formData.get('stock') || 0),
        image: formData.get('image') || '',
        favorite: formData.get('favorite') === 'on'
      };
      try {
        await window.AppApi.ownerSaveProduct(state.token, payload, !payload.id);
        await loadBootstrap();
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
        image: formData.get('image') || '',
        theme: formData.get('theme') || 'ember',
        active: formData.get('active') === 'true'
      };
      try {
        await window.AppApi.ownerSaveBanner(state.token, payload, !payload.id);
        await loadBootstrap();
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
