window.AppApi = {
  async getShopBootstrap() {
    const response = await fetch('/api/shop/bootstrap');
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Не удалось загрузить магазин');
    return data;
  },

  async createOrder(payload) {
    const response = await fetch('/api/shop/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Не удалось создать заказ');
    return data;
  },

  async ownerLogin(payload) {
    const response = await fetch('/api/owner/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Ошибка входа');
    return data;
  },

  async ownerGetBootstrap(token) {
    const response = await fetch('/api/owner/bootstrap', {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Не удалось загрузить кабинет');
    return data;
  },

  async ownerSaveProduct(token, product, isNew) {
    const response = await fetch(isNew ? '/api/owner/products' : `/api/owner/products/${product.id}`, {
      method: isNew ? 'POST' : 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(product)
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Не удалось сохранить товар');
    return data;
  },

  async ownerDeleteProduct(token, id) {
    const response = await fetch(`/api/owner/products/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Не удалось удалить товар');
    return data;
  },

  async ownerSaveBanner(token, banner, isNew) {
    const response = await fetch(isNew ? '/api/owner/banners' : `/api/owner/banners/${banner.id}`, {
      method: isNew ? 'POST' : 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(banner)
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Не удалось сохранить баннер');
    return data;
  },

  async ownerDeleteBanner(token, id) {
    const response = await fetch(`/api/owner/banners/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Не удалось удалить баннер');
    return data;
  },

  async ownerSaveSupportContact(token, contact, isNew) {
    const response = await fetch(isNew ? '/api/owner/support-contacts' : `/api/owner/support-contacts/${contact.id}`, {
      method: isNew ? 'POST' : 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(contact)
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Не удалось сохранить контакт');
    return data;
  },

  async ownerDeleteSupportContact(token, id) {
    const response = await fetch(`/api/owner/support-contacts/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Не удалось удалить контакт');
    return data;
  },

  async ownerUpdateOrderStatus(token, id, status) {
    const response = await fetch(`/api/owner/orders/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ status })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Не удалось обновить заказ');
    return data;
  }
};
