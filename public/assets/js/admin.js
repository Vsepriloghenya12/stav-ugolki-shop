const state = {
  token: localStorage.getItem('stav-ugolki-admin-token') || '',
  currentTab: 'products',
  categories: ['Уголь', 'Табак', 'Кальяны', 'Прочее'],
  products: [],
  banners: [],
  orders: [],
  settings: {},
  analytics: null,
  statusMap: {},
  editingProductId: '',
  editingBannerId: '',
  productQuery: ''
};

const els = {
  loginScreen: document.getElementById('loginScreen'),
  adminApp: document.getElementById('adminApp'),
  loginForm: document.getElementById('loginForm'),
  loginNotice: document.getElementById('loginNotice'),
  refreshButton: document.getElementById('refreshButton'),
  logoutButton: document.getElementById('logoutButton'),
  tabButtons: Array.from(document.querySelectorAll('[data-tab]')),
  panels: Array.from(document.querySelectorAll('[data-panel]')),
  productSearchInput: document.getElementById('productSearchInput'),
  productList: document.getElementById('productList'),
  productForm: document.getElementById('productForm'),
  productNotice: document.getElementById('productNotice'),
  newProductButton: document.getElementById('newProductButton'),
  deleteProductButton: document.getElementById('deleteProductButton'),
  resetProductButton: document.getElementById('resetProductButton'),
  bannerList: document.getElementById('bannerList'),
  bannerForm: document.getElementById('bannerForm'),
  bannerNotice: document.getElementById('bannerNotice'),
  newBannerButton: document.getElementById('newBannerButton'),
  deleteBannerButton: document.getElementById('deleteBannerButton'),
  resetBannerButton: document.getElementById('resetBannerButton'),
  bannerPreview: document.getElementById('bannerPreview'),
  ordersList: document.getElementById('ordersList'),
  statsGrid: document.getElementById('statsGrid'),
  topProductsList: document.getElementById('topProductsList'),
  categoryRevenueList: document.getElementById('categoryRevenueList'),
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
  const currency = state.settings?.currency || 'VND';
  return `${Number(value || 0).toLocaleString('ru-RU')} ${currency}`;
}

async function fetchJson(url, options = {}, auth = true) {
  const headers = { ...(options.headers || {}) };
  if (auth && state.token) headers.Authorization = `Bearer ${state.token}`;
  const response = await fetch(url, { ...options, headers });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Ошибка');
  return data;
}

function setNotice(element, message = '', type = '') {
  element.textContent = message;
  element.className = 'notice';
  if (type) element.classList.add(type);
}

function saveToken(token) {
  state.token = token;
  localStorage.setItem('stav-ugolki-admin-token', token);
}

function clearToken() {
  state.token = '';
  localStorage.removeItem('stav-ugolki-admin-token');
}

async function login(event) {
  event.preventDefault();
  const formData = new FormData(els.loginForm);
  try {
    const result = await fetchJson('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(Object.fromEntries(formData.entries()))
    }, false);
    saveToken(result.token);
    await bootstrap();
  } catch (error) {
    setNotice(els.loginNotice, error.message, 'error');
  }
}

async function bootstrap() {
  try {
    const payload = await fetchJson('/api/admin/bootstrap');
    state.products = payload.products || [];
    state.banners = payload.banners || [];
    state.orders = payload.orders || [];
    state.settings = payload.settings || {};
    state.analytics = payload.analytics || null;
    state.statusMap = payload.statusMap || {};
    state.categories = payload.categories || state.categories;
    fillSettingsForm();
    renderTabs();
    renderProducts();
    renderBanners();
    renderOrders();
    renderAnalytics();
    resetProductForm();
    resetBannerForm();
    els.loginScreen.classList.add('hidden');
    els.adminApp.classList.remove('hidden');
  } catch (error) {
    clearToken();
    els.adminApp.classList.add('hidden');
    els.loginScreen.classList.remove('hidden');
    setNotice(els.loginNotice, error.message, 'error');
  }
}

function renderTabs() {
  els.tabButtons.forEach((button) => button.classList.toggle('is-active', button.dataset.tab === state.currentTab));
  els.panels.forEach((panel) => panel.classList.toggle('hidden', panel.dataset.panel !== state.currentTab));
}

function getFilteredProducts() {
  const q = state.productQuery.trim().toLowerCase();
  return [...state.products]
    .sort((a, b) => String(a.name).localeCompare(String(b.name), 'ru'))
    .filter((product) => !q || [product.name, product.category, product.deepLink, product.slug].join(' ').toLowerCase().includes(q));
}

function renderProducts() {
  const items = getFilteredProducts();
  els.productList.innerHTML = items.map((product) => `
    <button class="item-card ${product.id === state.editingProductId ? 'is-active' : ''}" type="button" data-edit-product="${product.id}">
      <img src="${escapeHtml(product.image)}" alt="${escapeHtml(product.name)}" />
      <div>
        <div class="item-card-title">${escapeHtml(product.name)}</div>
        <div class="item-card-subtitle">${escapeHtml(product.category)}</div>
      </div>
      <div class="item-card-price">${formatPrice(product.price)}</div>
    </button>
  `).join('');
}

function resetProductForm() {
  state.editingProductId = '';
  els.productForm.reset();
  els.productForm.elements.id.value = '';
  els.productForm.elements.category.value = state.categories[0] || 'Уголь';
  els.productForm.elements.inStock.checked = true;
  els.productForm.elements.featured.checked = false;
  setNotice(els.productNotice, '');
  renderProducts();
}

function fillProductForm(product) {
  state.editingProductId = product.id;
  const form = els.productForm;
  form.elements.id.value = product.id || '';
  form.elements.name.value = product.name || '';
  form.elements.category.value = product.category || 'Прочее';
  form.elements.price.value = product.price || 0;
  form.elements.image.value = product.image || '';
  form.elements.deepLink.value = product.deepLink || '';
  form.elements.slug.value = product.slug || '';
  form.elements.stockCount.value = product.stockCount || 0;
  form.elements.unit.value = product.unit || '';
  form.elements.description.value = product.description || '';
  form.elements.inStock.checked = Boolean(product.inStock);
  form.elements.featured.checked = Boolean(product.featured);
  renderProducts();
}

async function saveProduct(event) {
  event.preventDefault();
  const formData = new FormData(els.productForm);
  const payload = Object.fromEntries(formData.entries());
  payload.inStock = els.productForm.elements.inStock.checked;
  payload.featured = els.productForm.elements.featured.checked;

  try {
    let result;
    if (state.editingProductId) {
      result = await fetchJson(`/api/admin/products/${state.editingProductId}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
      });
      state.products = state.products.map((item) => item.id === result.id ? result : item);
    } else {
      result = await fetchJson('/api/admin/products', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
      });
      state.products.unshift(result);
      state.editingProductId = result.id;
    }
    fillProductForm(result);
    renderProducts();
    setNotice(els.productNotice, 'Сохранено', 'success');
    await refreshAnalytics();
  } catch (error) {
    setNotice(els.productNotice, error.message, 'error');
  }
}

async function deleteProduct() {
  if (!state.editingProductId) return;
  try {
    await fetchJson(`/api/admin/products/${state.editingProductId}`, { method: 'DELETE' });
    state.products = state.products.filter((item) => item.id !== state.editingProductId);
    resetProductForm();
    await refreshAnalytics();
  } catch (error) {
    setNotice(els.productNotice, error.message, 'error');
  }
}

function renderBanners() {
  const items = [...state.banners].sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0));
  els.bannerList.innerHTML = items.map((banner) => `
    <button class="item-card ${banner.id === state.editingBannerId ? 'is-active' : ''}" type="button" data-edit-banner="${banner.id}">
      <img src="${escapeHtml(banner.image)}" alt="Баннер" />
      <div>
        <div class="item-card-title">${escapeHtml(banner.id)}</div>
        <div class="item-card-subtitle">${banner.active ? 'Активен' : 'Скрыт'}</div>
      </div>
      <div class="item-card-price">${Number(banner.sortOrder || 0)}</div>
    </button>
  `).join('');
}

function resetBannerForm() {
  state.editingBannerId = '';
  els.bannerForm.reset();
  els.bannerForm.elements.id.value = '';
  els.bannerForm.elements.active.checked = true;
  els.bannerPreview.removeAttribute('src');
  setNotice(els.bannerNotice, '');
  renderBanners();
}

function fillBannerForm(banner) {
  state.editingBannerId = banner.id;
  const form = els.bannerForm;
  form.elements.id.value = banner.id || '';
  form.elements.image.value = banner.image || '';
  form.elements.link.value = banner.link || '';
  form.elements.sortOrder.value = banner.sortOrder || 0;
  form.elements.active.checked = Boolean(banner.active);
  els.bannerPreview.src = banner.image || '';
  renderBanners();
}

async function saveBanner(event) {
  event.preventDefault();
  const formData = new FormData(els.bannerForm);
  const payload = Object.fromEntries(formData.entries());
  payload.active = els.bannerForm.elements.active.checked;

  try {
    let result;
    if (state.editingBannerId) {
      result = await fetchJson(`/api/admin/banners/${state.editingBannerId}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
      });
      state.banners = state.banners.map((item) => item.id === result.id ? result : item);
    } else {
      result = await fetchJson('/api/admin/banners', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
      });
      state.banners.unshift(result);
      state.editingBannerId = result.id;
    }
    fillBannerForm(result);
    renderBanners();
    setNotice(els.bannerNotice, 'Сохранено', 'success');
    await refreshAnalytics();
  } catch (error) {
    setNotice(els.bannerNotice, error.message, 'error');
  }
}

async function deleteBanner() {
  if (!state.editingBannerId) return;
  try {
    await fetchJson(`/api/admin/banners/${state.editingBannerId}`, { method: 'DELETE' });
    state.banners = state.banners.filter((item) => item.id !== state.editingBannerId);
    resetBannerForm();
    await refreshAnalytics();
  } catch (error) {
    setNotice(els.bannerNotice, error.message, 'error');
  }
}

function renderOrders() {
  els.ordersList.innerHTML = state.orders.map((order) => `
    <div class="item-card">
      <div>
        <div class="item-card-title">${escapeHtml(order.id)}</div>
        <div class="item-card-subtitle">${escapeHtml(order.customer?.name || '')} · ${formatPrice(order.total)}</div>
      </div>
      <select class="status-select" data-order-id="${order.id}">
        ${Object.entries(state.statusMap).map(([value, label]) => `<option value="${value}" ${order.status === value ? 'selected' : ''}>${escapeHtml(label)}</option>`).join('')}
      </select>
    </div>
  `).join('');
}

function renderAnalytics() {
  const analytics = state.analytics;
  if (!analytics) return;
  const stats = [
    ['Выручка', analytics.metrics.revenueLabel],
    ['Средний чек', analytics.metrics.averageCheckLabel],
    ['Заказы', String(analytics.metrics.orders || 0)],
    ['Товары', String(analytics.metrics.products || 0)],
    ['Баннеры', String(analytics.metrics.banners || 0)]
  ];

  els.statsGrid.innerHTML = stats.map(([label, value]) => `
    <div class="stat-card">
      <div class="stat-card-label">${escapeHtml(label)}</div>
      <div class="stat-card-value">${escapeHtml(value)}</div>
    </div>
  `).join('');

  els.topProductsList.innerHTML = (analytics.topProducts || []).map((item) => `
    <div class="metric-line"><strong>${escapeHtml(item.name)}</strong><span>${formatPrice(item.revenue)}</span></div>
  `).join('') || '<div class="item-card-subtitle">Пока нет данных</div>';

  els.categoryRevenueList.innerHTML = (analytics.categoryRevenue || []).map((item) => `
    <div class="metric-line"><strong>${escapeHtml(item.name)}</strong><span>${formatPrice(item.revenue)}</span></div>
  `).join('') || '<div class="item-card-subtitle">Пока нет данных</div>';
}

function fillSettingsForm() {
  Object.entries(state.settings || {}).forEach(([key, value]) => {
    if (els.settingsForm.elements[key]) {
      els.settingsForm.elements[key].value = value ?? '';
    }
  });
}

async function saveSettings(event) {
  event.preventDefault();
  const payload = Object.fromEntries(new FormData(els.settingsForm).entries());
  try {
    state.settings = await fetchJson('/api/admin/settings', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
    });
    fillSettingsForm();
    setNotice(els.settingsNotice, 'Сохранено', 'success');
    await refreshAnalytics();
  } catch (error) {
    setNotice(els.settingsNotice, error.message, 'error');
  }
}

async function updateOrderStatus(orderId, status) {
  try {
    const result = await fetchJson(`/api/admin/orders/${orderId}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status })
    });
    state.orders = state.orders.map((item) => item.id === result.id ? result : item);
    renderOrders();
    await refreshAnalytics();
  } catch (_error) {
    await bootstrap();
  }
}

async function refreshAnalytics() {
  state.analytics = await fetchJson('/api/admin/analytics');
  renderAnalytics();
}

function bindEvents() {
  els.loginForm.addEventListener('submit', login);
  els.refreshButton.addEventListener('click', bootstrap);
  els.logoutButton.addEventListener('click', () => {
    clearToken();
    location.reload();
  });

  els.tabButtons.forEach((button) => button.addEventListener('click', () => {
    state.currentTab = button.dataset.tab;
    renderTabs();
  }));

  els.productSearchInput.addEventListener('input', () => {
    state.productQuery = els.productSearchInput.value || '';
    renderProducts();
  });
  els.productList.addEventListener('click', (event) => {
    const button = event.target.closest('[data-edit-product]');
    if (!button) return;
    const product = state.products.find((item) => item.id === button.dataset.editProduct);
    if (product) fillProductForm(product);
  });
  els.newProductButton.addEventListener('click', resetProductForm);
  els.resetProductButton.addEventListener('click', resetProductForm);
  els.deleteProductButton.addEventListener('click', deleteProduct);
  els.productForm.addEventListener('submit', saveProduct);

  els.bannerList.addEventListener('click', (event) => {
    const button = event.target.closest('[data-edit-banner]');
    if (!button) return;
    const banner = state.banners.find((item) => item.id === button.dataset.editBanner);
    if (banner) fillBannerForm(banner);
  });
  els.newBannerButton.addEventListener('click', resetBannerForm);
  els.resetBannerButton.addEventListener('click', resetBannerForm);
  els.deleteBannerButton.addEventListener('click', deleteBanner);
  els.bannerForm.addEventListener('submit', saveBanner);
  els.bannerForm.elements.image.addEventListener('input', () => {
    els.bannerPreview.src = els.bannerForm.elements.image.value || '';
  });

  els.ordersList.addEventListener('change', (event) => {
    const select = event.target.closest('[data-order-id]');
    if (!select) return;
    updateOrderStatus(select.dataset.orderId, select.value);
  });

  els.settingsForm.addEventListener('submit', saveSettings);
}

bindEvents();
if (state.token) {
  bootstrap();
}
