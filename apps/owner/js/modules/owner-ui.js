export function createOwnerUi(ctx) {
  const {
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
  } = ctx;

  function productImageThumb(src, alt = 'Товар') {
    if (!src) return '<div class="thumb-badge">Фото</div>';
    return `<img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}" loading="lazy" decoding="async" />`;
  }

  function brandLogoThumb(brand = {}) {
    const name = String(brand.name || '').trim();
    if (brand.logo) {
      return `<div class="brand-logo-thumb"><img src="${escapeHtml(brand.logo)}" alt="${escapeHtml(name || 'Бренд')}" loading="lazy" decoding="async" /></div>`;
    }
    const letters = (name || 'BR')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map(part => part[0])
      .join('')
      .toUpperCase() || 'BR';
    return `<div class="brand-logo-thumb brand-logo-thumb--fallback">${escapeHtml(letters)}</div>`;
  }

  function productBadgeChips(product = {}) {
    const chips = [];
    if (product.isNew) chips.push('<span class="owner-badge-chip owner-badge-chip--new">Новинка</span>');
    if (product.isTop) chips.push('<span class="owner-badge-chip owner-badge-chip--top">Топ</span>');
    if (product.hiddenFromCatalog) chips.push('<span class="owner-badge-chip">Скрыт</span>');
    if (totalStock(product) <= 0) chips.push('<span class="owner-badge-chip">Нет в наличии</span>');
    return chips.join('');
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

  function renderLowStockAlerts() {
    const items = Array.isArray(state.lowStockAlerts) ? state.lowStockAlerts : [];
    el.lowStockAlerts.innerHTML = items.length
      ? items.map(item => `<div class="mini-row"><span>${escapeHtml(item.name)}${item.variantLabel ? ` · ${escapeHtml(item.variantLabel)}` : ''}</span><strong>${item.stock}/${item.minStock}</strong></div>`).join('')
      : '<div class="empty-box">Все остатки в норме</div>';
  }

  function renderBrandsTable() {
    el.brandsBody.innerHTML = state.brands.length
      ? [...state.brands]
          .sort((a, b) => String(a.category || '').localeCompare(String(b.category || ''), 'ru') || String(a.name || '').localeCompare(String(b.name || ''), 'ru'))
          .map(item => `
            <tr>
              <td>${brandLogoThumb(item)}</td>
              <td>${escapeHtml(item.name)}</td>
              <td>${escapeHtml(item.category)}</td>
              <td>
                <div class="table-actions">
                  <button class="ghost-btn" type="button" data-edit-brand="${item.id}">Редактировать</button>
                  <button class="danger-btn" type="button" data-delete-brand="${item.id}">Удалить</button>
                </div>
              </td>
            </tr>
          `).join('')
      : '<tr><td colspan="4"><div class="empty-box">Брендов пока нет</div></td></tr>';
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
        <td>${item.image ? `<span class="thumb-badge">${looksLikeVideo(item.image) ? 'Видео' : looksLikeGif(item.image) ? 'GIF' : 'Фото'}</span>` : 'Без медиа'}</td>
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
    el.supportBody.innerHTML = state.supportContacts.length
      ? state.supportContacts.map(item => `
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
        `).join('')
      : '<tr><td colspan="4"><div class="empty-box">Контактов пока нет</div></td></tr>';
  }

  function orderStatusLabel(status = 'new') {
    const map = {
      new: 'Новая',
      fulfilled: 'Состоялась',
      failed: 'Не состоялась',
      paid: 'Состоялась',
      done: 'Состоялась',
      cancelled: 'Не состоялась'
    };
    return map[String(status || 'new')] || 'Новая';
  }

  function isProcessedOrder(order = {}) {
    return !['', 'new'].includes(String(order.status || 'new'));
  }

  function activeOrders() {
    return state.orders.filter(order => !isProcessedOrder(order));
  }

  function historyOrders() {
    return state.orders.filter(order => isProcessedOrder(order));
  }

  function renderOrdersNavCount() {
    if (!el.ordersNavCount) return;
    el.ordersNavCount.textContent = String(activeOrders().length);
    el.ordersNavCount.classList.toggle('is-hidden', !activeOrders().length);
  }

  function orderProductOptions(selectedProductId = '') {
    const options = [...state.products].sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'ru'));
    const hasSelected = selectedProductId && options.some(item => item.id === selectedProductId);
    const dynamic = !hasSelected && selectedProductId
      ? [{ id: selectedProductId, name: 'Удалённый товар', brand: '', category: '' }]
      : [];
    return [...dynamic, ...options].map(product => `<option value="${escapeHtml(product.id)}" ${product.id === selectedProductId ? 'selected' : ''}>${escapeHtml(product.name || 'Товар')}${product.brand ? ` · ${escapeHtml(product.brand)}` : ''}</option>`).join('');
  }

  function orderVariantOptions(productId = '', selectedVariantId = '') {
    const product = state.products.find(item => item.id === productId);
    const variants = Array.isArray(product?.variants) ? product.variants : [];
    if (!product || !variants.length) {
      return '<option value="" selected>Без варианта</option>';
    }
    const selectedExists = variants.some(item => item.id === selectedVariantId);
    const dynamic = !selectedExists && selectedVariantId ? [{ id: selectedVariantId, label: 'Старый вариант' }] : [];
    const items = [...dynamic, ...variants];
    return items.map(variant => `<option value="${escapeHtml(variant.id || '')}" ${(variant.id || '') === (selectedVariantId || '') ? 'selected' : ''}>${escapeHtml(variant.label || 'Без варианта')}</option>`).join('');
  }

  function orderItemEditorRowTemplate(item = {}, index = 0) {
    return `
      <div class="order-editor-row" data-order-item-row>
        <select name="orderItemProduct">
          <option value="">Выбрать товар</option>
          ${orderProductOptions(item.id || '')}
        </select>
        <select name="orderItemVariant">
          ${orderVariantOptions(item.id || '', item.variantId || '')}
        </select>
        <input name="orderItemQty" type="number" min="1" placeholder="Кол-во" value="${Number(item.qty || 1)}" />
        <button class="danger-btn" type="button" data-remove-order-item="${index}">Удалить</button>
      </div>
    `;
  }

  function orderEditorTemplate(order = {}) {
    const items = Array.isArray(order.items) && order.items.length ? order.items : [{ id: '', qty: 1, variantId: '' }];
    return `
      <form class="owner-form order-editor" data-order-form="${escapeHtml(order.id || '')}">
        <div class="form-grid-2">
          <input name="customerName" placeholder="Имя" value="${escapeHtml(order.customer?.name || '')}" />
          <input name="customerPhone" placeholder="Телефон" value="${escapeHtml(order.customer?.phone || '')}" />
        </div>
        <input name="customerTelegram" placeholder="Ссылка / ник Telegram" value="${escapeHtml(order.customer?.telegram || '')}" />
        <div class="field-title">Состав заявки</div>
        <div class="order-editor-items" data-order-items-editor>
          ${items.map((item, index) => orderItemEditorRowTemplate(item, index)).join('')}
        </div>
        <div class="form-actions">
          <button class="secondary-btn" type="button" data-add-order-item="${escapeHtml(order.id || '')}">Добавить товар</button>
          <button class="owner-btn" type="submit">Сохранить изменения</button>
          <button class="ghost-btn" type="button" data-close-order-editor="${escapeHtml(order.id || '')}">Закрыть</button>
        </div>
      </form>
    `;
  }

  function renderOrders() {
    const active = activeOrders();
    const history = historyOrders();
    renderOrdersNavCount();

    const activeHtml = active.length
      ? active.map(order => {
          const isOpen = state.editOrderId === order.id;
          return `
            <article class="order-card ${isOpen ? 'is-open' : ''}" data-order-card="${escapeHtml(order.id)}">
              <div class="order-head">
                <div>
                  <div class="order-title">${escapeHtml(order.customer?.name || 'Клиент')}</div>
                  <div class="order-meta">${new Date(order.createdAt).toLocaleString('ru-RU')}</div>
                  <div class="order-meta">${escapeHtml(order.customer?.phone || '')}${order.customer?.telegram ? ` · ${escapeHtml(order.customer.telegram)}` : ''}</div>
                </div>
                <div class="order-side">
                  <span class="order-status-pill order-status-pill--new">${orderStatusLabel(order.status)}</span>
                  <strong>${money(order.total)}</strong>
                </div>
              </div>
              <div class="order-items">
                ${(order.items || []).map(item => `<div class="mini-row"><span>${escapeHtml(item.name)}${item.variantLabel ? ` · ${escapeHtml(item.variantLabel)}` : ''} × ${item.qty}</span><strong>${money(item.price * item.qty)}</strong></div>`).join('')}
              </div>
              <div class="form-actions order-actions-row">
                <button class="owner-btn" type="button" data-order-complete="${escapeHtml(order.id)}">Состоялась</button>
                <button class="secondary-btn" type="button" data-order-fail="${escapeHtml(order.id)}">Не состоялась</button>
                <button class="ghost-btn" type="button" data-edit-order="${escapeHtml(order.id)}">Редактировать</button>
              </div>
              ${isOpen ? `<div class="order-editor-wrap">${orderEditorTemplate(order)}</div>` : ''}
            </article>
          `;
        }).join('')
      : '<div class="empty-box">Необработанных заявок нет</div>';

    const historyHtml = history.length
      ? history.map(order => `
          <article class="order-card order-card--history">
            <div class="order-head">
              <div>
                <div class="order-title">${escapeHtml(order.customer?.name || 'Клиент')}</div>
                <div class="order-meta">${new Date(order.processedAt || order.createdAt).toLocaleString('ru-RU')}</div>
                <div class="order-meta">${escapeHtml(order.customer?.phone || '')}${order.customer?.telegram ? ` · ${escapeHtml(order.customer.telegram)}` : ''}</div>
              </div>
              <div class="order-side">
                <span class="order-status-pill order-status-pill--${escapeHtml(String(order.status || 'new'))}">${orderStatusLabel(order.status)}</span>
                <strong>${money(order.total)}</strong>
              </div>
            </div>
            <div class="order-items">
              ${(order.items || []).map(item => `<div class="mini-row"><span>${escapeHtml(item.name)}${item.variantLabel ? ` · ${escapeHtml(item.variantLabel)}` : ''} × ${item.qty}</span><strong>${money(item.price * item.qty)}</strong></div>`).join('')}
            </div>
          </article>
        `).join('')
      : '<div class="empty-box">История пока пуста</div>';

    el.ordersList.innerHTML = `
      <div class="orders-list-head">
        <span class="state-chip ok">Необработано: ${active.length}</span>
      </div>
      <div class="orders-list orders-list--active">${activeHtml}</div>
      <details class="orders-history-box">
        <summary>История (${history.length})</summary>
        <div class="orders-list orders-list--history">${historyHtml}</div>
      </details>
    `;
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

  function variantRowsHtml(category, variants = []) {
    const rows = normalizeVariantDrafts(variants, 0);
    if (!rows.length && ['табак', 'уголь'].includes(category)) {
      rows.push({ id: `variant-${Date.now()}-0`, label: category === 'табак' ? '20 г' : '1 кг', price: 0, stock: 0 });
    }
    return rows.map((item, index) => `
      <div class="variant-editor-row" data-variant-row>
        <input type="hidden" name="variantId" value="${escapeHtml(item.id)}" />
        <input name="variantLabel" placeholder="${escapeHtml(variantPlaceholder(category))}" value="${escapeHtml(item.label)}" />
        <input name="variantPrice" type="number" placeholder="Цена" value="${Number(item.price || 0)}" />
        <input name="variantStock" type="number" placeholder="Остаток" value="${Number(item.stock || 0)}" />
        <input name="variantMinStock" type="number" placeholder="Мин. остаток" value="${Number(item.minStock || 0)}" />
        <button class="danger-btn variant-remove-btn" type="button" data-remove-variant="${index}">Удалить</button>
      </div>
    `).join('');
  }

  function mediaPreview(src, alt = 'Изображение', mode = 'cover') {
    const containClass = mode === 'contain' ? ' preview-card--contain' : '';
    if (!src) return `<div class="preview-card${containClass} empty">Изображение не выбрано</div>`;
    if (looksLikeVideo(src)) {
      return `<div class="preview-card${containClass}"><video src="${escapeHtml(src)}" playsinline muted loop controls preload="metadata"></video></div>`;
    }
    return `<div class="preview-card${containClass}"><img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}" loading="lazy" decoding="async" /></div>`;
  }

  function brandFormTemplate(brand = {}) {
    return `
      <input type="hidden" name="id" value="${escapeHtml(brand.id || '')}" />
      <input name="name" placeholder="Название бренда" value="${escapeHtml(brand.name || '')}" required />
      <select name="category">
        ${['табак', 'уголь', 'кальяны', 'прочее'].map(value => `<option value="${value}" ${value === (brand.category || 'табак') ? 'selected' : ''}>${value}</option>`).join('')}
      </select>
      <div class="media-uploader">
        <input name="logo" placeholder="URL логотипа" value="${escapeHtml(brand.logo || '')}" />
        <input class="file-input" name="logoFile" type="file" accept="image/*,.gif,.svg" />
        <div class="helper-text">Логотип используется на кнопке быстрого бренд-фильтра в магазине.</div>
        <div data-preview>${mediaPreview(brand.logo || '', brand.name || 'Логотип бренда', 'contain')}</div>
      </div>
      <div class="form-actions">
        <button class="secondary-btn" type="button" data-clear-brand-logo>Очистить логотип</button>
        <button class="owner-btn" type="submit">Сохранить бренд</button>
      </div>
    `;
  }

  function productFormTemplate(product = {}, isNew = false) {
    const category = product.category || 'табак';
    const variantsMeta = categoryVariantMeta(category);
    const usesVariantStock = ['табак', 'уголь'].includes(category);
    const productVariants = normalizeVariantDrafts(product.variants, Number(product.stock || 0));
    const brandOptions = brandsForCategory(category, product.brand || '');
    const nameOptions = nameOptionsFor(category, product.brand || '', product.id || '');
    const formId = isNew ? PRODUCT_NEW_ID : String(product.id || '');
    const brandListId = `brand-options-${isNew ? 'new' : String(product.id || 'draft')}`;
    return `
      <form class="owner-form product-inline-form" data-product-inline-form="${escapeHtml(formId)}">
        <input type="hidden" name="id" value="${escapeHtml(formId === PRODUCT_NEW_ID ? '' : formId)}" />
        <div class="form-grid-2">
          <select name="category">
            ${['табак', 'уголь', 'кальяны', 'прочее'].map(value => `<option value="${value}" ${value === category ? 'selected' : ''}>${value}</option>`).join('')}
          </select>
          <div>
            <input name="brand" list="${escapeHtml(brandListId)}" placeholder="Бренд" value="${escapeHtml(product.brand || '')}" autocomplete="off" />
            <datalist id="${escapeHtml(brandListId)}">
              ${brandOptions.map(value => `<option value="${escapeHtml(value)}"></option>`).join('')}
            </datalist>
          </div>
        </div>
        <div class="helper-text">Можно выбрать бренд из подсказок или ввести вручную. Для общего справочника брендов используйте вкладку «Бренды».</div>
        <select name="namePreset">
          <option value="">Выбрать название из списка</option>
          ${nameOptions.map(value => `<option value="${escapeHtml(value)}" ${value === (product.name || '') ? 'selected' : ''}>${escapeHtml(value)}</option>`).join('')}
        </select>
        <input name="name" placeholder="Название" value="${escapeHtml(product.name || '')}" required />
        <div class="form-grid-2">
          <input name="price" type="number" placeholder="Базовая цена" value="${Number(product.price || 0)}" />
          ${usesVariantStock
            ? `<div class="owner-note-inline">Общий остаток считается по граммовкам / фасовкам</div>`
            : `<input name="stock" type="number" placeholder="Остаток" value="${Number(product.stock || 0)}" />`}
        </div>
        <div class="form-grid-2">
          <label class="form-check"><input name="favorite" type="checkbox" ${product.favorite ? 'checked' : ''} /> Избранный</label>
          <input name="homePriority" type="number" placeholder="Приоритет на главной" value="${Number(product.homePriority || 0)}" />
        </div>
        <div class="form-grid-2">
          <label class="form-check"><input name="hiddenFromCatalog" type="checkbox" ${product.hiddenFromCatalog ? 'checked' : ''} /> Скрыть с витрины</label>
          ${usesVariantStock ? `<div class="owner-note-inline">Для уведомлений используйте мин. остаток у граммовок</div>` : `<input name="minStock" type="number" placeholder="Мин. остаток для уведомления" value="${Number(product.minStock || 0)}" />`}
        </div>
        <div class="form-grid-2">
          <label class="form-check"><input name="isNew" type="checkbox" ${product.isNew ? 'checked' : ''} /> Бирка «Новинка»</label>
          <label class="form-check"><input name="isTop" type="checkbox" ${product.isTop ? 'checked' : ''} /> Бирка «Топ»</label>
        </div>
        <div class="helper-text">Чем больше число, тем выше товар поднимается на главной странице.</div>
        <textarea name="description" placeholder="Описание">${escapeHtml(product.description || '')}</textarea>
        <div class="field-title">${escapeHtml(variantsMeta.title)}</div>
        <div class="helper-text">${escapeHtml(variantsMeta.helper)}</div>
        <div class="variants-editor" data-variants-editor data-variant-kind="${escapeHtml(category)}">
          ${variantRowsHtml(category, productVariants)}
        </div>
        <div class="form-actions">
          <button class="secondary-btn" type="button" data-add-variant>${usesVariantStock ? (category === 'табак' ? 'Добавить граммовку' : 'Добавить фасовку') : 'Добавить вариант'}</button>
        </div>
        <div class="media-uploader">
          <input name="image" placeholder="URL изображения" value="${escapeHtml(product.image || '')}" />
          <input class="file-input" name="imageFile" type="file" accept="image/*,.gif" />
          <div class="helper-text">Фото автоматически сжимается, чтобы каталог грузился быстрее.</div>
          <div data-preview>${mediaPreview(product.image || '', product.name || 'Товар')}</div>
        </div>
        <div class="form-actions">
          <button class="owner-btn" type="submit">Сохранить</button>
          <button class="secondary-btn" type="button" data-clear-product-image>Очистить фото</button>
          <button class="ghost-btn" type="button" data-close-product-card="${escapeHtml(formId)}">Закрыть</button>
        </div>
      </form>
    `;
  }

  function bannerFormTemplate(banner = {}) {
    return `
      <input type="hidden" name="id" value="${escapeHtml(banner.id || '')}" />
      <div class="form-grid-2">
        <select name="active">
          <option value="true" ${banner.active !== false ? 'selected' : ''}>Активен</option>
          <option value="false" ${banner.active === false ? 'selected' : ''}>Выключен</option>
        </select>
        <select name="targetCategory">
          ${['all', 'табак', 'уголь', 'кальяны', 'прочее'].map(value => `<option value="${value}" ${value === (banner.targetCategory || 'all') ? 'selected' : ''}>${value === 'all' ? 'Все категории' : value}</option>`).join('')}
        </select>
      </div>
      <div class="form-grid-2">
        <select name="targetBrand">
          <option value="all">Все бренды</option>
          ${allBrandNames(banner.targetBrand && banner.targetBrand !== 'all' ? banner.targetBrand : '').map(value => `<option value="${escapeHtml(value)}" ${value === (banner.targetBrand || '') ? 'selected' : ''}>${escapeHtml(value)}</option>`).join('')}
        </select>
        <input name="targetPriceMin" type="number" placeholder="Цена от" value="${escapeHtml(banner.targetPriceMin || '')}" />
      </div>
      <input name="targetPriceMax" type="number" placeholder="Цена до" value="${escapeHtml(banner.targetPriceMax || '')}" />
      <div class="media-uploader">
        <input name="image" placeholder="URL медиа" value="${escapeHtml(banner.image || '')}" />
        <input class="file-input" name="imageFile" type="file" accept="image/*,video/*,.gif,.webm,.mp4" />
        <div class="helper-text">Баннер поддерживает фото, gif и видео.</div>
        <div data-preview>${mediaPreview(banner.image || '', 'Баннер')}</div>
      </div>
      <div class="form-actions">
        <button class="owner-btn" type="submit">Сохранить</button>
        <button class="secondary-btn" type="button" data-clear-banner-image>Очистить медиа</button>
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

  function productCardTemplate(product, isNew = false) {
    const open = state.editProductId === (isNew ? PRODUCT_NEW_ID : product.id);
    const formProduct = isNew ? product : (state.products.find(item => item.id === product.id) || product);
    return `
      <article class="product-admin-card ${open ? 'is-open' : ''} ${isNew ? 'is-new' : ''}" data-product-card="${escapeHtml(isNew ? PRODUCT_NEW_ID : product.id)}">
        <div class="product-admin-card-summary" data-open-product-card="${escapeHtml(isNew ? PRODUCT_NEW_ID : product.id)}">
          <div class="product-admin-thumb">${productImageThumb(formProduct.image || '', formProduct.name || 'Товар')}</div>
          <div class="product-admin-info">
            <div class="product-admin-title">${escapeHtml(formProduct.name || 'Новый товар')}</div>
            <div class="product-admin-badges">${productBadgeChips(formProduct)}</div>
            <div class="product-admin-meta">${escapeHtml(formProduct.category || 'табак')}${formProduct.brand ? ` · ${escapeHtml(formProduct.brand)}` : ''}</div>
            <div class="product-admin-note">Остаток: ${totalStock(formProduct)} · Доступно: ${Number(formProduct.availableStock ?? totalStock(formProduct))}${Number(formProduct.reserved || 0) ? ` · Резерв: ${Number(formProduct.reserved || 0)}` : ''} · Приоритет: ${Number(formProduct.homePriority || 0)}${formProduct.hiddenFromCatalog ? ' · скрыт с витрины' : ''}</div>
          </div>
          <div class="product-admin-side">
            <div class="product-admin-price">${money(displayPrice(formProduct))}</div>
            <div class="table-actions">
              ${!isNew ? `<button class="ghost-btn" type="button" data-edit-product="${escapeHtml(product.id)}">Редактировать</button>
              <button class="danger-btn" type="button" data-delete-product="${escapeHtml(product.id)}">Удалить</button>` : ''}
            </div>
          </div>
        </div>
        ${open ? `<div class="product-admin-editor">${productFormTemplate(formProduct, isNew)}</div>` : ''}
      </article>
    `;
  }

  function renderProductsList() {
    const sorted = [...state.products].sort((a, b) => Number(b.homePriority || 0) - Number(a.homePriority || 0) || String(a.name || '').localeCompare(String(b.name || ''), 'ru'));
    const draft = {
      id: '',
      name: '',
      brand: '',
      category: 'табак',
      price: 0,
      stock: 0,
      homePriority: 0,
      favorite: false,
      isNew: false,
      isTop: false,
      description: '',
      image: '',
      variants: []
    };
    const list = [];
    if (state.editProductId === PRODUCT_NEW_ID) list.push(productCardTemplate(draft, true));
    list.push(...sorted.map(item => productCardTemplate(item, false)));
    el.productsList.innerHTML = list.join('') || '<div class="empty-box">Товаров пока нет</div>';
  }

  function renderForms() {
    const banner = state.banners.find(item => item.id === state.editBannerId) || {};
    el.bannerForm.innerHTML = bannerFormTemplate(banner);
    const brand = state.brands.find(item => item.id === state.editBrandId) || {};
    el.brandForm.innerHTML = brandFormTemplate(brand);
    const contact = state.supportContacts.find(item => item.id === state.editSupportId) || {};
    el.supportForm.innerHTML = supportFormTemplate(contact);
  }

  function renderAll() {
    renderStats();
    renderTopProducts();
    renderLastOrders();
    renderLowStockAlerts();
    renderProductsList();
    renderBrandsTable();
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
    document.querySelectorAll('[data-owner-panel]').forEach(node => {
      const isCurrent = node.dataset.ownerPanel === name;
      node.classList.toggle('hidden', !isCurrent);
      node.classList.toggle('is-active', isCurrent);
    });
  }

  async function loadBootstrap() {
    const data = await window.AppApi.ownerGetBootstrap(state.token);
    state.products = data.products || [];
    state.banners = data.banners || [];
    state.brands = data.brands || [];
    state.supportContacts = data.supportContacts || [];
    state.orders = data.orders || [];
    state.posts = data.posts || [];
    state.summary = data.summary || null;
    state.lowStockAlerts = data.summary?.lowStockAlerts || [];
    state.telegramConfig = data.telegramConfig || null;
    if (!state.editBannerId && state.banners[0]) state.editBannerId = state.banners[0].id;
    if (!state.editBrandId && state.brands[0]) state.editBrandId = state.brands[0].id;
    if (!state.editSupportId && state.supportContacts[0]) state.editSupportId = state.supportContacts[0].id;
    if (state.editProductId !== PRODUCT_NEW_ID && state.editProductId && !state.products.some(item => item.id === state.editProductId)) state.editProductId = '';
    if (state.editOrderId && !state.orders.some(item => item.id === state.editOrderId && String(item.status || 'new') === 'new')) state.editOrderId = '';
    renderAll();
  }

  async function updatePreview(form, fallbackName = 'Изображение', options = {}) {
    const src = await mediaFieldValue(form, options).catch(() => '');
    const preview = form.querySelector('[data-preview]');
    const mode = options.mode === 'contain' ? 'contain' : 'cover';
    if (preview) preview.innerHTML = mediaPreview(src, fallbackName, mode);
  }

  return {
    renderOrders,
    variantRowsHtml,
    productCardTemplate,
    renderProductsList,
    renderForms,
    activateSection,
    loadBootstrap,
    updatePreview
  };
}
