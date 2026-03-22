const state = {
  token: localStorage.getItem('stav-ugolki-admin-token') || '',
  username: localStorage.getItem('stav-ugolki-admin-user') || 'owner',
  currentTab: 'dashboard',
  products: [],
  orders: [],
  settings: {},
  analytics: null,
  statusMap: {},
  editingProductId: null,
  productQuery: '',
  orderFilter: 'all'
};

const els = {
  loginView: document.getElementById('loginView'),
  adminApp: document.getElementById('adminApp'),
  loginForm: document.getElementById('loginForm'),
  loginNotice: document.getElementById('loginNotice'),
  adminUserBadge: document.getElementById('adminUserBadge'),
  logoutButton: document.getElementById('logoutButton'),
  navButtons: Array.from(document.querySelectorAll('.nav-button')),
  panelSections: Array.from(document.querySelectorAll('.panel-section')),
  refreshButton: document.getElementById('refreshButton'),
  dashboardMetrics: document.getElementById('dashboardMetrics'),
  dashboardRevenueBars: document.getElementById('dashboardRevenueBars'),
  dashboardRecentOrders: document.getElementById('dashboardRecentOrders'),
  lowStockList: document.getElementById('lowStockList'),
  sourceBreakdown: document.getElementById('sourceBreakdown'),
  productSearchInput: document.getElementById('productSearchInput'),
  newProductButton: document.getElementById('newProductButton'),
  adminProductList: document.getElementById('adminProductList'),
  productForm: document.getElementById('productForm'),
  productEditorTitle: document.getElementById('productEditorTitle'),
  productNotice: document.getElementById('productNotice'),
  deleteProductButton: document.getElementById('deleteProductButton'),
  resetProductButton: document.getElementById('resetProductButton'),
  orderFilterSelect: document.getElementById('orderFilterSelect'),
  ordersList: document.getElementById('ordersList'),
  topProductsList: document.getElementById('topProductsList'),
  categoryRevenueList: document.getElementById('categoryRevenueList'),
  statusCards: document.getElementById('statusCards'),
  settingsForm: document.getElementById('settingsForm'),
  settingsNotice: document.getElementById('settingsNotice')
};

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatPrice(value) {
  const currency = state.settings?.currency || '₽';
  return `${Number(value || 0).toLocaleString('ru-RU')} ${currency}`;
}

async function fetchJson(url, options = {}, auth = true) {
  const headers = { ...(options.headers || {}) };
  if (auth && state.token) {
    headers.Authorization = `Bearer ${state.token}`;
  }
  const response = await fetch(url, { ...options, headers });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Ошибка запроса');
  }
  return data;
}

function setLoginNotice(message, type) {
  els.loginNotice.textContent = message;
  els.loginNotice.className = 'notice';
  if (message && type) {
    els.loginNotice.classList.add(type);
  }
}

function setProductNotice(message, type) {
  els.productNotice.textContent = message;
  els.productNotice.className = 'notice';
  if (message && type) {
    els.productNotice.classList.add(type);
  }
}

function setSettingsNotice(message, type) {
  els.settingsNotice.textContent = message;
  els.settingsNotice.className = 'notice';
  if (message && type) {
    els.settingsNotice.classList.add(type);
  }
}

function saveAuth(token, username) {
  state.token = token;
  state.username = username;
  localStorage.setItem('stav-ugolki-admin-token', token);
  localStorage.setItem('stav-ugolki-admin-user', username);
}

function clearAuth() {
  state.token = '';
  localStorage.removeItem('stav-ugolki-admin-token');
  localStorage.removeItem('stav-ugolki-admin-user');
}

async function handleLogin(event) {
  event.preventDefault();
  const formData = new FormData(els.loginForm);
  try {
    const result = await fetchJson('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(Object.fromEntries(formData.entries()))
    }, false);
    saveAuth(result.token, result.username);
    state.username = result.username;
    await bootstrapAdmin();
  } catch (error) {
    setLoginNotice(error.message, 'error');
  }
}

async function bootstrapAdmin() {
  try {
    const payload = await fetchJson('/api/admin/bootstrap');
    state.products = payload.products || [];
    state.orders = payload.orders || [];
    state.settings = payload.settings || {};
    state.analytics = payload.analytics || null;
    state.statusMap = payload.statusMap || {};
    els.adminUserBadge.textContent = state.username;
    els.loginView.classList.add('hidden');
    els.adminApp.classList.remove('hidden');
    renderAll();
  } catch (error) {
    clearAuth();
    els.adminApp.classList.add('hidden');
    els.loginView.classList.remove('hidden');
    setLoginNotice(error.message, 'error');
  }
}

function renderAll() {
  renderNav();
  renderDashboard();
  renderProducts();
  renderOrders();
  renderAnalytics();
  fillSettingsForm();
  updateProductEditor();
}

function renderNav() {
  els.navButtons.forEach((button) => {
    button.classList.toggle('is-active', button.dataset.tab === state.currentTab);
  });
  els.panelSections.forEach((section) => {
    section.classList.toggle('hidden', section.dataset.panel !== state.currentTab);
  });
}

function renderDashboard() {
  const analytics = state.analytics;
  if (!analytics) return;
  const metrics = [
    { label: 'Выручка', value: analytics.metrics.revenueLabel },
    { label: 'Средний чек', value: analytics.metrics.averageCheckLabel },
    { label: 'Заказы', value: String(analytics.metrics.orders) },
    { label: 'Новые заказы', value: String(analytics.metrics.newOrders) },
    { label: 'Товары', value: String(analytics.metrics.products) },
    { label: 'Хиты', value: String(analytics.metrics.featuredProducts) },
    { label: 'Низкий остаток', value: String(analytics.metrics.lowStock) },
    { label: 'Завершено', value: String(analytics.metrics.doneOrders) }
  ];

  els.dashboardMetrics.innerHTML = metrics
    .map((item) => `
      <article class="metric-card">
        <span class="muted-text">${escapeHtml(item.label)}</span>
        <strong>${escapeHtml(item.value)}</strong>
      </article>
    `)
    .join('');

  const dailyRevenue = analytics.dailyRevenue || [];
  const maxRevenue = Math.max(...dailyRevenue.map((item) => item.revenue), 1);
  els.dashboardRevenueBars.innerHTML = dailyRevenue
    .map((item) => {
      const height = Math.max(8, Math.round((item.revenue / maxRevenue) * 170));
      return `
        <div class="chart-bar-item">
          <div class="chart-bar" style="height:${height}px"></div>
          <div class="chart-bar-label">${escapeHtml(item.label)}</div>
        </div>
      `;
    })
    .join('');

  els.dashboardRecentOrders.innerHTML = (analytics.recentOrders || [])
    .map((order) => `
      <article class="stack-item">
        <div class="stack-item-head">
          <div>
            <strong>${escapeHtml(order.id)}</strong>
            <p>${escapeHtml(order.customer?.name || 'Клиент')}</p>
          </div>
          <span class="order-status-pill">${escapeHtml(state.statusMap[order.status] || order.status)}</span>
        </div>
        <p>${formatPrice(order.total)} · ${new Date(order.createdAt).toLocaleString('ru-RU')}</p>
      </article>
    `)
    .join('') || '<div class="muted-text">Заказов пока нет</div>';

  els.lowStockList.innerHTML = (analytics.lowStockProducts || [])
    .map((product) => `
      <article class="stack-item">
        <div class="stack-item-head">
          <div>
            <strong>${escapeHtml(product.name)}</strong>
            <p>${escapeHtml(product.category || '')}</p>
          </div>
          <span class="order-status-pill">${Number(product.stockCount || 0)} ${escapeHtml(product.unit || 'шт.')}</span>
        </div>
      </article>
    `)
    .join('') || '<div class="muted-text">Все остатки в норме</div>';

  const totalSources = (analytics.sources || []).reduce((sum, item) => sum + Number(item.value || 0), 0);
  els.sourceBreakdown.innerHTML = (analytics.sources || [])
    .map((source) => {
      const percent = totalSources ? Math.round((Number(source.value || 0) / totalSources) * 100) : 0;
      return `
        <article class="source-item">
          <strong>${escapeHtml(source.name)}</strong>
          <span>${percent}%</span>
          <div class="source-track"><div class="source-fill" style="width:${percent}%"></div></div>
        </article>
      `;
    })
    .join('') || '<div class="muted-text">Источники появятся после заказов</div>';
}

function getFilteredProducts() {
  const query = state.productQuery.trim().toLowerCase();
  return [...state.products]
    .sort((a, b) => String(a.name).localeCompare(String(b.name), 'ru'))
    .filter((product) => {
      if (!query) return true;
      const haystack = [product.name, product.subtitle, product.category, product.brand, ...(product.tags || [])]
        .join(' ')
        .toLowerCase();
      return haystack.includes(query);
    });
}

function resetProductForm() {
  state.editingProductId = null;
  els.productForm.reset();
  els.productForm.elements.id.value = '';
  els.productForm.elements.inStock.checked = true;
  els.productForm.elements.featured.checked = false;
  els.productEditorTitle.textContent = 'Новый товар';
  setProductNotice('', '');
  renderProducts();
}

function updateProductEditor() {
  const product = state.products.find((item) => item.id === state.editingProductId);
  if (!product) {
    resetProductForm();
    return;
  }

  els.productEditorTitle.textContent = `Редактирование: ${product.name}`;
  const form = els.productForm;
  form.elements.id.value = product.id || '';
  form.elements.name.value = product.name || '';
  form.elements.subtitle.value = product.subtitle || '';
  form.elements.category.value = product.category || '';
  form.elements.brand.value = product.brand || '';
  form.elements.price.value = product.price || 0;
  form.elements.oldPrice.value = product.oldPrice || 0;
  form.elements.stockCount.value = product.stockCount || 0;
  form.elements.unit.value = product.unit || '';
  form.elements.badge.value = product.badge || '';
  form.elements.rating.value = product.rating || 4.8;
  form.elements.pack.value = product.pack || '';
  form.elements.heat.value = product.heat || '';
  form.elements.image.value = product.image || '';
  form.elements.slug.value = product.slug || '';
  form.elements.deepLink.value = product.deepLink || '';
  form.elements.tags.value = Array.isArray(product.tags) ? product.tags.join(', ') : '';
  form.elements.description.value = product.description || '';
  form.elements.inStock.checked = Boolean(product.inStock);
  form.elements.featured.checked = Boolean(product.featured);
  setProductNotice('', '');
}

function selectProduct(productId) {
  state.editingProductId = productId;
  updateProductEditor();
  renderProducts();
}

function renderProducts() {
  const items = getFilteredProducts();
  els.adminProductList.innerHTML = items
    .map((product) => `
      <article class="product-admin-item ${state.editingProductId === product.id ? 'is-active' : ''}" data-product-id="${product.id}">
        <div class="product-admin-head">
          <div>
            <strong>${escapeHtml(product.name)}</strong>
            <div class="muted-text">${escapeHtml(product.category || '')} · ${formatPrice(product.price)}</div>
          </div>
          <span class="admin-chip">${product.inStock ? `Остаток ${Number(product.stockCount || 0)}` : 'Нет в наличии'}</span>
        </div>
        <div class="detail-pills">
          ${product.featured ? '<span class="tag-pill">Хит</span>' : ''}
          ${product.badge ? `<span class="tag-pill">${escapeHtml(product.badge)}</span>` : ''}
          ${product.deepLink ? `<span class="tag-pill">${escapeHtml(product.deepLink)}</span>` : ''}
        </div>
      </article>
    `)
    .join('') || '<div class="muted-text">Товары не найдены</div>';
}

async function handleProductSubmit(event) {
  event.preventDefault();
  const formData = new FormData(els.productForm);
  const payload = Object.fromEntries(formData.entries());
  payload.inStock = els.productForm.elements.inStock.checked;
  payload.featured = els.productForm.elements.featured.checked;

  try {
    let result;
    if (state.editingProductId) {
      result = await fetchJson(`/api/admin/products/${state.editingProductId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      state.products = state.products.map((item) => item.id === result.id ? result : item);
      setProductNotice('Товар сохранен', 'success');
    } else {
      result = await fetchJson('/api/admin/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      state.products.unshift(result);
      state.editingProductId = result.id;
      setProductNotice('Товар создан', 'success');
    }
    refreshAnalytics();
    renderProducts();
    updateProductEditor();
  } catch (error) {
    setProductNotice(error.message, 'error');
  }
}

async function handleDeleteProduct() {
  if (!state.editingProductId) {
    setProductNotice('Сначала выберите товар', 'error');
    return;
  }
  if (!window.confirm('Удалить выбранный товар?')) return;

  try {
    await fetchJson(`/api/admin/products/${state.editingProductId}`, { method: 'DELETE' });
    state.products = state.products.filter((item) => item.id !== state.editingProductId);
    resetProductForm();
    refreshAnalytics();
    renderProducts();
    setProductNotice('Товар удален', 'success');
  } catch (error) {
    setProductNotice(error.message, 'error');
  }
}

function getFilteredOrders() {
  return state.orders.filter((order) => state.orderFilter === 'all' || order.status === state.orderFilter);
}

function renderOrders() {
  const orders = getFilteredOrders();
  els.ordersList.innerHTML = orders
    .map((order) => `
      <article class="order-card">
        <div class="order-card-head">
          <div>
            <h3>${escapeHtml(order.id)}</h3>
            <div class="muted-text">${escapeHtml(order.customer?.name || 'Клиент')} · ${escapeHtml(order.customer?.phone || '')}</div>
          </div>
          <span class="order-status-pill">${escapeHtml(state.statusMap[order.status] || order.status)}</span>
        </div>

        <p class="order-meta">${new Date(order.createdAt).toLocaleString('ru-RU')} · ${escapeHtml(order.customer?.deliveryType || 'Доставка')}</p>
        <p>${escapeHtml(order.customer?.address || 'Адрес не указан')}</p>

        <ul class="order-items-list">
          ${(order.items || [])
            .map((item) => `<li>${escapeHtml(item.name)} × ${Number(item.quantity || 0)} — ${formatPrice(item.lineTotal || 0)}</li>`)
            .join('')}
        </ul>

        <div class="order-actions">
          <strong>${formatPrice(order.total)}</strong>
          <select class="field" data-order-status="${order.id}">
            ${Object.entries(state.statusMap)
              .map(([value, label]) => `<option value="${value}" ${order.status === value ? 'selected' : ''}>${escapeHtml(label)}</option>`)
              .join('')}
          </select>
        </div>
      </article>
    `)
    .join('') || '<div class="muted-text">Нет заказов под выбранный фильтр</div>';
}

async function handleOrderStatusChange(orderId, status) {
  try {
    const updated = await fetchJson(`/api/admin/orders/${orderId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });
    state.orders = state.orders.map((order) => order.id === updated.id ? updated : order);
    await refreshAnalytics();
    renderOrders();
    renderDashboard();
    renderAnalytics();
  } catch (error) {
    window.alert(error.message);
  }
}

function renderAnalytics() {
  const analytics = state.analytics;
  if (!analytics) return;

  els.topProductsList.innerHTML = (analytics.topProducts || [])
    .map((item) => `
      <article class="stack-item">
        <div class="stack-item-head">
          <div>
            <strong>${escapeHtml(item.name)}</strong>
            <p>${Number(item.quantity || 0)} ${Number(item.quantity || 0) === 1 ? 'ед.' : 'ед.'}</p>
          </div>
          <strong>${formatPrice(item.revenue || 0)}</strong>
        </div>
      </article>
    `)
    .join('') || '<div class="muted-text">Статистика появится после заказов</div>';

  els.categoryRevenueList.innerHTML = (analytics.categoryRevenue || [])
    .map((item) => `
      <article class="stack-item">
        <div class="stack-item-head">
          <div>
            <strong>${escapeHtml(item.name)}</strong>
            <p>${Number(item.quantity || 0)} продано</p>
          </div>
          <strong>${formatPrice(item.revenue || 0)}</strong>
        </div>
      </article>
    `)
    .join('') || '<div class="muted-text">Пока нет данных</div>';

  els.statusCards.innerHTML = Object.entries(analytics.statusCounts || {})
    .map(([status, count]) => `
      <article class="status-card">
        <span class="muted-text">${escapeHtml(state.statusMap[status] || status)}</span>
        <strong>${Number(count || 0)}</strong>
      </article>
    `)
    .join('');
}

function fillSettingsForm() {
  const form = els.settingsForm;
  Object.entries(state.settings || {}).forEach(([key, value]) => {
    if (!form.elements[key]) return;
    if (Array.isArray(value)) {
      form.elements[key].value = value.join(', ');
    } else {
      form.elements[key].value = value ?? '';
    }
  });
}

async function handleSettingsSubmit(event) {
  event.preventDefault();
  const payload = Object.fromEntries(new FormData(els.settingsForm).entries());

  try {
    const result = await fetchJson('/api/admin/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    state.settings = result;
    await refreshAnalytics();
    fillSettingsForm();
    setSettingsNotice('Настройки сохранены', 'success');
  } catch (error) {
    setSettingsNotice(error.message, 'error');
  }
}

async function refreshAnalytics() {
  const analytics = await fetchJson('/api/admin/analytics');
  state.analytics = analytics;
}

function bindEvents() {
  els.loginForm.addEventListener('submit', handleLogin);
  els.logoutButton.addEventListener('click', () => {
    clearAuth();
    window.location.reload();
  });

  els.navButtons.forEach((button) => {
    button.addEventListener('click', () => {
      state.currentTab = button.dataset.tab;
      renderNav();
    });
  });

  els.refreshButton.addEventListener('click', bootstrapAdmin);

  els.productSearchInput.addEventListener('input', (event) => {
    state.productQuery = event.target.value;
    renderProducts();
  });

  els.newProductButton.addEventListener('click', resetProductForm);
  els.resetProductButton.addEventListener('click', resetProductForm);
  els.deleteProductButton.addEventListener('click', handleDeleteProduct);
  els.productForm.addEventListener('submit', handleProductSubmit);

  els.adminProductList.addEventListener('click', (event) => {
    const item = event.target.closest('[data-product-id]');
    if (!item) return;
    selectProduct(item.dataset.productId);
  });

  els.orderFilterSelect.addEventListener('change', (event) => {
    state.orderFilter = event.target.value;
    renderOrders();
  });

  els.ordersList.addEventListener('change', (event) => {
    const select = event.target.closest('[data-order-status]');
    if (!select) return;
    handleOrderStatusChange(select.dataset.orderStatus, select.value);
  });

  els.settingsForm.addEventListener('submit', handleSettingsSubmit);
}

async function init() {
  bindEvents();
  if (state.token) {
    await bootstrapAdmin();
  }
}

init();
