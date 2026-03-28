async function parseResponsePayload(response) {
  const contentType = String(response.headers.get('content-type') || '').toLowerCase();
  if (contentType.includes('application/json')) {
    try {
      return await response.json();
    } catch {
      return {};
    }
  }
  try {
    const text = await response.text();
    return text ? { error: text } : {};
  } catch {
    return {};
  }
}

async function requestJson(url, options = {}, config = {}) {
  const response = await fetch(url, options);
  const data = await parseResponsePayload(response);
  if (!response.ok) {
    const message = data.error || config.defaultError || 'Ошибка запроса';
    const error = new Error(message);
    error.status = response.status;
    error.payload = data;
    if (config.ownerAuth && response.status === 401) {
      error.ownerAuthExpired = true;
      window.dispatchEvent(new CustomEvent('owner-auth-expired', {
        detail: {
          url,
          method: options.method || 'GET',
          status: response.status,
          message
        }
      }));
    }
    throw error;
  }
  return data;
}

window.AppApi = {
  async getShopBootstrap() {
    return requestJson('/api/shop/bootstrap', {}, { defaultError: 'Не удалось загрузить магазин' });
  },

  async createOrder(payload) {
    return requestJson('/api/shop/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }, { defaultError: 'Не удалось создать заказ' });
  },

  async getOrderHistory(ids) {
    return requestJson('/api/shop/orders/history', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids })
    }, { defaultError: 'Не удалось загрузить историю' });
  },

  async ownerLogin(payload) {
    return requestJson('/api/owner/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }, { defaultError: 'Ошибка входа' });
  },

  async ownerGetBootstrap(token) {
    return requestJson('/api/owner/bootstrap', {
      headers: { Authorization: `Bearer ${token}` }
    }, { ownerAuth: true, defaultError: 'Не удалось загрузить кабинет' });
  },

  async ownerSaveProduct(token, product, isNew) {
    return requestJson(isNew ? '/api/owner/products' : `/api/owner/products/${product.id}`, {
      method: isNew ? 'POST' : 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(product)
    }, { ownerAuth: true, defaultError: 'Не удалось сохранить товар' });
  },

  async ownerDeleteProduct(token, id) {
    return requestJson(`/api/owner/products/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    }, { ownerAuth: true, defaultError: 'Не удалось удалить товар' });
  },

  async ownerSaveBrand(token, brand, isNew) {
    return requestJson(isNew ? '/api/owner/brands' : `/api/owner/brands/${brand.id}`, {
      method: isNew ? 'POST' : 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(brand)
    }, { ownerAuth: true, defaultError: 'Не удалось сохранить бренд' });
  },

  async ownerDeleteBrand(token, id) {
    return requestJson(`/api/owner/brands/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    }, { ownerAuth: true, defaultError: 'Не удалось удалить бренд' });
  },

  async ownerSaveBanner(token, banner, isNew) {
    return requestJson(isNew ? '/api/owner/banners' : `/api/owner/banners/${banner.id}`, {
      method: isNew ? 'POST' : 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(banner)
    }, { ownerAuth: true, defaultError: 'Не удалось сохранить баннер' });
  },

  async ownerDeleteBanner(token, id) {
    return requestJson(`/api/owner/banners/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    }, { ownerAuth: true, defaultError: 'Не удалось удалить баннер' });
  },

  async ownerSaveSupportContact(token, contact, isNew) {
    return requestJson(isNew ? '/api/owner/support-contacts' : `/api/owner/support-contacts/${contact.id}`, {
      method: isNew ? 'POST' : 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(contact)
    }, { ownerAuth: true, defaultError: 'Не удалось сохранить контакт' });
  },

  async ownerDeleteSupportContact(token, id) {
    return requestJson(`/api/owner/support-contacts/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    }, { ownerAuth: true, defaultError: 'Не удалось удалить контакт' });
  },

  async ownerSaveOrder(token, id, payload) {
    return requestJson(`/api/owner/orders/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    }, { ownerAuth: true, defaultError: 'Не удалось обновить заявку' });
  },

  async ownerCreatePost(token, post) {
    return requestJson('/api/owner/posts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(post)
    }, { ownerAuth: true, defaultError: 'Не удалось отправить пост' });
  }
};
