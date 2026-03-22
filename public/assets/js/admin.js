const adminState = {
  token: localStorage.getItem('stav-ugolki-admin-token') || '',
  username: localStorage.getItem('stav-ugolki-admin-user') || 'owner',
  products: [],
  orders: [],
  analytics: null,
  settings: null,
  activeTab: 'dashboard'
};

const ui = {
  loginWrap: document.getElementById('loginWrap'),
  loginForm: document.getElementById('loginForm'),
  loginNotice: document.getElementById('loginNotice'),
  adminApp: document.getElementById('adminApp'),
  adminUserBadge: document.getElementById('adminUserBadge'),
  logoutBtn: document.getElementById('logoutBtn'),
  navButtons: Array.from(document.querySelectorAll('.nav-btn')),
  panels: Array.from(document.querySelectorAll('[data-panel]')),
  refreshDashboardBtn: document.getElementById('refreshDashboardBtn'),
  refreshOrdersBtn: document.getElementById('refreshOrdersBtn'),
  dashboardMetrics: document.getElementById('dashboardMetrics'),
  dashboardChart: document.getElementById('dashboardChart'),
  dashboardRecentOrders: document.getElementById('dashboardRecentOrders'),
  productCountLabel: document.getElementById('productCountLabel'),
  productAdminList: document.getElementById('productAdminList'),
  productForm: document.getElementById('productForm'),
  productFormTitle: document.getElementById('productFormTitle'),
  productNotice: document.getElementById('productNotice'),
  resetProductFormBtn: document.getElementById('resetProductFormBtn'),
  ordersList: document.getElementById('ordersList'),
  analyticsMetrics: document.getElementById('analyticsMetrics'),
  analyticsRevenueChart: document.getElementById('analyticsRevenueChart'),
  analyticsCategories: document.getElementById('analyticsCategories'),
  topProductsTable: document.getElementById('topProductsTable'),
  recentOrdersTable: document.getElementById('recentOrdersTable'),
  settingsForm: document.getElementById('settingsForm'),
  settingsNotice: document.getElementById('settingsNotice')
};

function formatPrice(value) {
  const currency = adminState.settings?.currency || '₽';
  return `${Number(value || 0).toLocaleString('ru-RU')} ${currency}`;
}

function formatDate(value) {
  const date = new Date(value);
  return date.toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function pluralize(number, forms) {
  const n = Math.abs(number) % 100;
  const n1 = n % 10;
  if (n > 10 && n < 20) return forms[2];
  if (n1 > 1 && n1 < 5) return forms[1];
  if (n1 === 1) return forms[0];
  return forms[2];
}

function showNotice(element, message, type) {
  element.className = 'notice';
  element.textContent = message;
  if (message) {
    element.classList.add(type);
  }
}

async function api(url, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  if (adminState.token) {
    headers.Authorization = `Bearer ${adminState.token}`;
  }

  const response = await fetch(url, { ...options, headers });
  const data = await response.json();

  if (!response.ok) {
    if (response.status === 401) {
      logout();
    }
    throw new Error(data.error || 'Ошибка запроса');
  }

  return data;
}

function setActiveTab(tab) {
  adminState.activeTab = tab;
  ui.navButtons.forEach((button) => {
    button.classList.toggle('is-active', button.dataset.tab === tab);
  });
  ui.panels.forEach((panel) => {
    panel.classList.toggle('hidden', panel.dataset.panel !== tab);
  });
}

function loginSucceeded(token, username) {
  adminState.token = token;
  adminState.username = username;
  localStorage.setItem('stav-ugolki-admin-token', token);
  localStorage.setItem('stav-ugolki-admin-user', username);
  ui.adminUserBadge.textContent = username;
  ui.loginWrap.classList.add('hidden');
  ui.adminApp.classList.remove('hidden');
}

function logout() {
  localStorage.removeItem('stav-ugolki-admin-token');
  localStorage.removeItem('stav-ugolki-admin-user');
  adminState.token = '';
  ui.adminApp.classList.add('hidden');
  ui.loginWrap.classList.remove('hidden');
  showNotice(ui.loginNotice, 'Сессия завершена. Войдите снова.', 'error');
}

function resetProductForm() {
  ui.productForm.reset();
  ui.productForm.elements.id.value = '';
  ui.productForm.elements.inStock.checked = true;
  ui.productForm.elements.featured.checked = false;
  ui.productFormTitle.textContent = 'Новый товар';
}

function fillProductForm(product) {
  ui.productForm.elements.id.value = product.id;
  ui.productForm.elements.name.value = product.name || '';
  ui.productForm.elements.category.value = product.category || '';
  ui.productForm.elements.price.value = product.price || 0;
  ui.productForm.elements.oldPrice.value = product.oldPrice || 0;
  ui.productForm.elements.image.value = product.image || '';
  ui.productForm.elements.stockCount.value = product.stockCount || 0;
  ui.productForm.elements.unit.value = product.unit || 'шт';
  ui.productForm.elements.description.value = product.description || '';
  ui.productForm.elements.inStock.checked = Boolean(product.inStock);
  ui.productForm.elements.featured.checked = Boolean(product.featured);
  ui.productFormTitle.textContent = `Редактирование: ${product.name}`;
  setActiveTab('products');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function renderDashboard() {
  const metrics = adminState.analytics?.metrics;
  if (!metrics) return;

  ui.dashboardMetrics.innerHTML = [
    { label: 'Выручка', value: metrics.revenueLabel },
    { label: 'Заказы', value: `${metrics.orders}` },
    { label: 'Средний чек', value: metrics.averageCheckLabel },
    { label: 'Новые', value: `${metrics.newOrders}` },
    { label: 'Хиты', value: `${metrics.featuredProducts}` },
    { label: 'Остаток', value: `${metrics.totalStock}` }
  ]
    .map(
      (item) => `
        <div class="metric-card">
          <small>${item.label}</small>
          <strong>${item.value}</strong>
        </div>
      `
    )
    .join('');

  renderRevenueChart(ui.dashboardChart, adminState.analytics.dailyRevenue);
  ui.dashboardRecentOrders.innerHTML = adminState.analytics.recentOrders
    .slice(0, 5)
    .map(
      (order) => `
        <div class="order-list-item">
          <div class="order-row">
            <strong>${order.id}</strong>
            <span class="status-chip ${order.status}">${adminState.analytics.statusMap[order.status]}</span>
          </div>
          <div class="muted">${order.customer?.name || 'Клиент'} · ${formatDate(order.createdAt)}</div>
          <strong>${formatPrice(order.total)}</strong>
        </div>
      `
    )
    .join('');
}

function renderRevenueChart(target, items = []) {
  if (!items.length) {
    target.innerHTML = '<p class="muted">Пока нет данных для графика.</p>';
    return;
  }

  const maxValue = Math.max(...items.map((item) => item.revenue), 1);
  target.innerHTML = items
    .map((item) => {
      const height = Math.max(18, Math.round((item.revenue / maxValue) * 180));
      return `
        <div class="bar-wrap">
          <div class="bar" style="height:${height}px"></div>
          <strong>${formatPrice(item.revenue)}</strong>
          <span class="bar-label">${item.label}</span>
        </div>
      `;
    })
    .join('');
}

function renderProducts() {
  ui.productCountLabel.textContent = `${adminState.products.length} ${pluralize(adminState.products.length, ['позиция', 'позиции', 'позиций'])}`;
  ui.productAdminList.innerHTML = adminState.products
    .map(
      (product) => `
        <div class="product-admin-card">
          <div class="product-thumb"><img src="${product.image}" alt="${product.name}" loading="lazy" /></div>
          <div>
            <div class="card-tags">
              <span class="tag">${product.category}</span>
              ${product.featured ? '<span class="tag featured">Хит</span>' : ''}
              ${product.inStock ? '<span class="tag">В наличии</span>' : '<span class="tag out">Нет в наличии</span>'}
            </div>
            <h3 style="margin:10px 0 8px;">${product.name}</h3>
            <p class="muted">${product.description || 'Без описания'}</p>
            <div class="helper-row">
              <strong>${formatPrice(product.price)}</strong>
              <span class="muted">Остаток: ${product.stockCount || 0} ${product.unit || 'шт'}</span>
            </div>
          </div>
          <div class="stack-actions">
            <button class="secondary-btn" type="button" data-edit-product="${product.id}">Редактировать</button>
            <button class="secondary-btn is-danger" type="button" data-delete-product="${product.id}">Удалить</button>
          </div>
        </div>
      `
    )
    .join('');

  const productsNav = ui.navButtons.find((btn) => btn.dataset.tab === 'products');
  if (productsNav) {
    productsNav.innerHTML = `Товары <span>${adminState.products.length}</span>`;
  }
}

function renderOrders() {
  if (!adminState.orders.length) {
    ui.ordersList.innerHTML = '<div class="empty-state"><h3>Заказов пока нет</h3><p>Новые заказы появятся здесь автоматически.</p></div>';
    return;
  }

  ui.ordersList.innerHTML = adminState.orders
    .map((order) => {
      const itemsText = (order.items || [])
        .map((item) => `${item.name} × ${item.quantity}`)
        .join(', ');

      return `
        <div class="order-list-item">
          <div class="order-row">
            <div>
              <strong>${order.id}</strong>
              <div class="muted">${formatDate(order.createdAt)} · ${order.source || 'web'}</div>
            </div>
            <div class="status-row">
              <span class="status-chip ${order.status}">${statusLabel(order.status)}</span>
              <select class="status-select secondary-btn" data-order-status-id="${order.id}">
                ${['new', 'confirmed', 'delivering', 'done', 'cancelled']
                  .map(
                    (status) => `
                      <option value="${status}" ${order.status === status ? 'selected' : ''}>${statusLabel(status)}</option>
                    `
                  )
                  .join('')}
              </select>
            </div>
          </div>
          <div class="order-row">
            <div>
              <div><strong>${order.customer?.name || 'Без имени'}</strong></div>
              <div class="muted">${order.customer?.phone || 'Телефон не указан'} · ${order.customer?.telegram || 'TG не указан'}</div>
              <div class="muted">${order.customer?.deliveryType || 'Доставка'} · ${order.customer?.address || 'Адрес не указан'}</div>
            </div>
            <div style="text-align:right;">
              <div><strong>${formatPrice(order.total)}</strong></div>
              <div class="muted">${itemsText}</div>
            </div>
          </div>
          ${order.customer?.comment ? `<div class="muted">Комментарий: ${order.customer.comment}</div>` : ''}
        </div>
      `;
    })
    .join('');

  const ordersNav = ui.navButtons.find((btn) => btn.dataset.tab === 'orders');
  if (ordersNav) {
    const newOrders = adminState.orders.filter((order) => order.status === 'new').length;
    ordersNav.innerHTML = `Заказы <span>${newOrders || adminState.orders.length}</span>`;
  }
}

function renderAnalytics() {
  if (!adminState.analytics) return;
  const metrics = adminState.analytics.metrics;
  ui.analyticsMetrics.innerHTML = [
    { label: 'Выручка', value: metrics.revenueLabel },
    { label: 'Средний чек', value: metrics.averageCheckLabel },
    { label: 'Всего заказов', value: `${metrics.orders}` },
    { label: 'Завершено', value: `${metrics.doneOrders}` },
    { label: 'Новых заказов', value: `${metrics.newOrders}` },
    { label: 'Остатков', value: `${metrics.totalStock}` }
  ]
    .map(
      (item) => `
        <div class="metric-card">
          <small>${item.label}</small>
          <strong>${item.value}</strong>
        </div>
      `
    )
    .join('');

  renderRevenueChart(ui.analyticsRevenueChart, adminState.analytics.dailyRevenue);
  renderCategoryProgress();
  renderTopProductsTable();
  renderRecentOrdersTable();
}

function renderCategoryProgress() {
  const categories = adminState.analytics.topCategories || [];
  if (!categories.length) {
    ui.analyticsCategories.innerHTML = '<p class="muted">Категории появятся после первых продаж.</p>';
    return;
  }
  const maxValue = Math.max(...categories.map((item) => item.revenue), 1);
  ui.analyticsCategories.innerHTML = categories
    .map(
      (item) => `
        <div class="progress-item">
          <div class="helper-row">
            <strong>${item.name}</strong>
            <span>${formatPrice(item.revenue)}</span>
          </div>
          <div class="progress-line"><span style="width:${Math.max(12, Math.round((item.revenue / maxValue) * 100))}%"></span></div>
        </div>
      `
    )
    .join('');
}

function renderTopProductsTable() {
  const products = adminState.analytics.topProducts || [];
  ui.topProductsTable.innerHTML = products.length
    ? products
        .map(
          (item) => `
            <tr>
              <td>${item.name}</td>
              <td>${item.quantity}</td>
              <td>${formatPrice(item.revenue)}</td>
            </tr>
          `
        )
        .join('')
    : '<tr><td colspan="3" class="muted">Данных пока нет</td></tr>';
}

function renderRecentOrdersTable() {
  const orders = adminState.analytics.recentOrders || [];
  ui.recentOrdersTable.innerHTML = orders.length
    ? orders
        .map(
          (order) => `
            <tr>
              <td>${order.id}</td>
              <td>${order.customer?.name || 'Клиент'}</td>
              <td>${formatPrice(order.total)}</td>
            </tr>
          `
        )
        .join('')
    : '<tr><td colspan="3" class="muted">Заказов пока нет</td></tr>';
}

function statusLabel(status) {
  return {
    new: 'Новый',
    confirmed: 'Подтвержден',
    delivering: 'В доставке',
    done: 'Завершен',
    cancelled: 'Отменен'
  }[status] || status;
}

function fillSettingsForm() {
  if (!adminState.settings) return;
  const form = ui.settingsForm;
  Object.entries(adminState.settings).forEach(([key, value]) => {
    if (!(key in form.elements)) return;
    form.elements[key].value = Array.isArray(value) ? value.join(', ') : value ?? '';
  });
}

async function loadProtectedData() {
  const [products, orders, analytics, settings] = await Promise.all([
    api('/api/admin/products'),
    api('/api/admin/orders'),
    api('/api/admin/analytics'),
    api('/api/admin/settings')
  ]);

  adminState.products = products;
  adminState.orders = orders.items || [];
  adminState.analytics = analytics;
  adminState.settings = settings;

  renderProducts();
  renderOrders();
  renderDashboard();
  renderAnalytics();
  fillSettingsForm();
}

async function handleLogin(event) {
  event.preventDefault();
  showNotice(ui.loginNotice, '', '');

  const formData = new FormData(ui.loginForm);
  try {
    const data = await api('/api/admin/login', {
      method: 'POST',
      headers: {},
      body: JSON.stringify(Object.fromEntries(formData.entries()))
    });
    loginSucceeded(data.token, data.username);
    await loadProtectedData();
  } catch (error) {
    showNotice(ui.loginNotice, error.message, 'error');
  }
}

async function handleProductSubmit(event) {
  event.preventDefault();
  const formData = new FormData(ui.productForm);
  const raw = Object.fromEntries(formData.entries());
  const payload = {
    ...raw,
    price: Number(raw.price || 0),
    oldPrice: Number(raw.oldPrice || 0),
    stockCount: Number(raw.stockCount || 0),
    inStock: ui.productForm.elements.inStock.checked,
    featured: ui.productForm.elements.featured.checked,
    unit: raw.unit || 'шт'
  };

  try {
    if (raw.id) {
      await api(`/api/admin/products/${raw.id}`, {
        method: 'PUT',
        body: JSON.stringify(payload)
      });
      showNotice(ui.productNotice, 'Товар обновлен', 'success');
    } else {
      await api('/api/admin/products', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      showNotice(ui.productNotice, 'Товар создан', 'success');
    }
    resetProductForm();
    await loadProtectedData();
  } catch (error) {
    showNotice(ui.productNotice, error.message, 'error');
  }
}

async function handleProductActions(event) {
  const editBtn = event.target.closest('[data-edit-product]');
  if (editBtn) {
    const product = adminState.products.find((item) => item.id === editBtn.dataset.editProduct);
    if (product) fillProductForm(product);
    return;
  }

  const deleteBtn = event.target.closest('[data-delete-product]');
  if (deleteBtn) {
    const product = adminState.products.find((item) => item.id === deleteBtn.dataset.deleteProduct);
    const confirmed = window.confirm(`Удалить товар «${product?.name || ''}»?`);
    if (!confirmed) return;

    try {
      await api(`/api/admin/products/${deleteBtn.dataset.deleteProduct}`, { method: 'DELETE' });
      showNotice(ui.productNotice, 'Товар удален', 'success');
      await loadProtectedData();
    } catch (error) {
      showNotice(ui.productNotice, error.message, 'error');
    }
  }
}

async function handleOrderStatusChange(event) {
  const select = event.target.closest('[data-order-status-id]');
  if (!select) return;

  try {
    await api(`/api/admin/orders/${select.dataset.orderStatusId}`, {
      method: 'PUT',
      body: JSON.stringify({ status: select.value })
    });
    await loadProtectedData();
  } catch (error) {
    window.alert(error.message);
  }
}

async function handleSettingsSubmit(event) {
  event.preventDefault();
  const raw = Object.fromEntries(new FormData(ui.settingsForm).entries());
  raw.minOrder = Number(raw.minOrder || 0);
  raw.deliveryPrice = Number(raw.deliveryPrice || 0);

  try {
    const saved = await api('/api/admin/settings', {
      method: 'PUT',
      body: JSON.stringify(raw)
    });
    adminState.settings = saved;
    fillSettingsForm();
    showNotice(ui.settingsNotice, 'Настройки сохранены', 'success');
    await loadProtectedData();
  } catch (error) {
    showNotice(ui.settingsNotice, error.message, 'error');
  }
}

function bindEvents() {
  ui.loginForm.addEventListener('submit', handleLogin);
  ui.logoutBtn.addEventListener('click', logout);
  ui.navButtons.forEach((button) => {
    button.addEventListener('click', () => setActiveTab(button.dataset.tab));
  });
  ui.refreshDashboardBtn.addEventListener('click', loadProtectedData);
  ui.refreshOrdersBtn.addEventListener('click', loadProtectedData);
  ui.productForm.addEventListener('submit', handleProductSubmit);
  ui.resetProductFormBtn.addEventListener('click', () => {
    resetProductForm();
    showNotice(ui.productNotice, '', '');
  });
  ui.productAdminList.addEventListener('click', handleProductActions);
  ui.ordersList.addEventListener('change', handleOrderStatusChange);
  ui.settingsForm.addEventListener('submit', handleSettingsSubmit);
}

async function init() {
  bindEvents();

  if (!adminState.token) {
    return;
  }

  try {
    loginSucceeded(adminState.token, adminState.username);
    await loadProtectedData();
  } catch (_error) {
    logout();
  }
}

init();
