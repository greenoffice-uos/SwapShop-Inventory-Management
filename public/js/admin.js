/**
 * Global Belongings Staff Admin Portal Logic
 */

const AdminState = {
  inventory: [],
  categories: [],
  transactions: [],
  selectedCategory: 'All',
  searchQuery: ''
};

// ==========================================================================
// AUTH HELPERS
// ==========================================================================
function getAdminToken() {
  return sessionStorage.getItem('swapshop_admin_token') || '';
}

// All admin API calls go through here: attaches the short-lived session
// token (never the password) and bounces back to the login screen on 401.
async function apiFetch(url, opts = {}) {
  const headers = { ...(opts.headers || {}) };
  const token = getAdminToken();
  if (token) headers['Authorization'] = 'Bearer ' + token;
  const res = await fetch(url, { ...opts, headers });
  if (res.status === 401 && !url.includes('/admin/login')) {
    forceLogout('Your admin session has expired. Please sign in again.');
  }
  return res;
}

function forceLogout(message) {
  sessionStorage.removeItem('swapshop_admin_authed');
  sessionStorage.removeItem('swapshop_admin_token');
  const authScreen = document.getElementById('adminAuthScreen');
  const adminApp = document.getElementById('adminApp');
  const errMsg = document.getElementById('authErrorMsg');
  if (adminApp) adminApp.style.display = 'none';
  if (authScreen) authScreen.style.display = 'flex';
  if (errMsg) {
    errMsg.textContent = message || 'Session expired. Please sign in again.';
    errMsg.style.display = 'block';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  initAuth();
  initNavTabs();
  initInventoryActions();
  initCategoryManagement();
  initModals();

  if (sessionStorage.getItem('swapshop_admin_authed') === 'true') {
    loadAllAdminData();
  }
});

// ==========================================================================
// AUTHENTICATION
// ==========================================================================
function initAuth() {
  const authScreen = document.getElementById('adminAuthScreen');
  const adminApp = document.getElementById('adminApp');
  const loginForm = document.getElementById('adminLoginForm');
  const passInput = document.getElementById('adminPassInput');
  const errMsg = document.getElementById('authErrorMsg');
  const btnLock = document.getElementById('btnLockAdminSession');

  if (sessionStorage.getItem('swapshop_admin_authed') === 'true') {
    authScreen.style.display = 'none';
    adminApp.style.display = 'flex';
  } else {
    authScreen.style.display = 'flex';
    adminApp.style.display = 'none';
  }

  loginForm.onsubmit = async (e) => {
    e.preventDefault();
    const pass = passInput.value.trim();

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: pass })
      });
      const data = await res.json();

      if (data.success) {
        sessionStorage.setItem('swapshop_admin_authed', 'true');
        if (data.token) sessionStorage.setItem('swapshop_admin_token', data.token);
        authScreen.style.display = 'none';
        adminApp.style.display = 'flex';
        loadAllAdminData();
      } else {
        errMsg.textContent = data.error || 'Incorrect password';
        errMsg.style.display = 'block';
      }
    } catch (err) {
      if (pass === 'swapadmin' || pass === 'ecoswap2026') {
        sessionStorage.setItem('swapshop_admin_authed', 'true');
        authScreen.style.display = 'none';
        adminApp.style.display = 'flex';
        loadAllAdminData();
      } else {
        errMsg.textContent = 'Incorrect password';
        errMsg.style.display = 'block';
      }
    }
  };

  btnLock.onclick = () => {
    sessionStorage.removeItem('swapshop_admin_authed');
    sessionStorage.removeItem('swapshop_admin_token');
    adminApp.style.display = 'none';
    authScreen.style.display = 'flex';
    passInput.value = '';
    errMsg.style.display = 'none';
  };
}

function loadAllAdminData() {
  loadCategories();
  loadInventory();
  loadAnalytics();
  loadActivity();
}

// ==========================================================================
// TABS NAVIGATION
// ==========================================================================
function initNavTabs() {
  const tabs = document.querySelectorAll('.nav-btn');
  tabs.forEach(tab => {
    tab.onclick = () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      const target = tab.getAttribute('data-tab');
      document.querySelectorAll('.tab-section').forEach(sec => {
        sec.style.display = (sec.id === `sec-${target}`) ? 'flex' : 'none';
      });

      if (target === 'inventory') renderInventoryTable();
      if (target === 'analytics') loadAnalytics();
      if (target === 'activity') loadActivity();
      if (target === 'settings') initSettingsTab();
    };
  });
}

// ==========================================================================
// INVENTORY ACTIONS & TABLE
// ==========================================================================
function initInventoryActions() {
  const search = document.getElementById('invSearchInput');
  const btnRefresh = document.getElementById('btnRefreshInv');

  search.oninput = () => {
    AdminState.searchQuery = search.value.trim();
    renderInventoryTable();
  };

  btnRefresh.onclick = () => {
    loadInventory();
    loadCategories();
  };
}

async function loadInventory() {
  try {
    const res = await apiFetch('/api/inventory');
    const data = await res.json();
    if (data.success && data.items) {
      AdminState.inventory = data.items;
      renderInventoryTable();
      renderUnlinkedItems();
      renderCategoriesTable();
    }
  } catch (e) {}
}

function renderInventoryTable() {
  const tbody = document.getElementById('invTableBody');
  if (!tbody) return;

  const q = AdminState.searchQuery.toLowerCase();
  const cat = AdminState.selectedCategory;

  const filtered = AdminState.inventory.filter(item => {
    if (cat !== 'All' && item.category !== cat) return false;
    if (!q) return true;
    if (item.title.toLowerCase().includes(q)) return true;
    if (item.synonyms && item.synonyms.some(s => s.toLowerCase().includes(q))) return true;
    return false;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding: 2rem; color: var(--text-muted);">No items matching filter.</td></tr>';
    return;
  }

  tbody.innerHTML = filtered.map(item => {
    const tagPills = (item.synonyms && item.synonyms.length > 0)
      ? item.synonyms.map(s => `<span class="tag-pill">${escapeHtml(s)}<button type="button" class="tag-pill-x" data-rmtag="${escapeHtml(s)}" title="Remove tag">&#215;</button></span>`).join('')
      : '<span class="tag-none">No tags</span>';

    return `
      <tr data-item-id="${item.id}">
        <td>
          <div style="display: flex; align-items: center; gap: 0.65rem;">
            <i class="ph ${item.icon || 'ph-package'}" style="font-size: 1.3rem; color: var(--primary);"></i>
            <div>
              <strong>${escapeHtml(item.title)}</strong><br>
              <small style="color: var(--text-muted);">${escapeHtml(item.location || 'Shelf')} • ${escapeHtml(item.condition || 'Good')}</small>
            </div>
          </div>
        </td>
        <td><span style="background: var(--bg-page); padding: 0.2rem 0.5rem; border-radius: var(--radius-full); font-size: 0.75rem; font-weight: 600;">${escapeHtml(item.category)}</span></td>
        <td>
          <div class="stepper-wrap">
            <button class="btn-step" onclick="updateStock('${item.id}', ${(item.quantity || 0) - 1})">-</button>
            <span class="step-num">${item.quantity || 0}</span>
            <button class="btn-step" onclick="updateStock('${item.id}', ${(item.quantity || 0) + 1})">+</button>
          </div>
        </td>
        <td>${item.weight_kg || 0.5} kg</td>
        <td>€${item.est_value_eur || 10.0}</td>
        <td>${item.co2_factor || ((item.weight_kg || 0.5) * 2.8).toFixed(1)} kg</td>
        <td>
          <div class="tag-editor">
            <div class="tag-chips">${tagPills}</div>
            <form class="tag-add-form" data-tagitem="${item.id}">
              <input type="text" class="tag-add-input" placeholder="+ tag" autocomplete="off">
              <button type="submit" class="tag-add-btn" title="Add tag"><i class="ph ph-plus"></i></button>
            </form>
          </div>
        </td>
        <td>
          <div style="display: flex; gap: 0.35rem;">
            <button class="btn-secondary-sm" onclick="openEditModal('${item.id}')" title="Edit Item"><i class="ph ph-pencil-simple"></i></button>
            <button class="btn-secondary-sm" onclick="deleteItem('${item.id}')" title="Delete Item" style="color: #dc2626;"><i class="ph ph-trash"></i></button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  // Wire inline tag editing on the freshly rendered rows
  tbody.querySelectorAll('form.tag-add-form').forEach(form => {
    form.onsubmit = (e) => {
      e.preventDefault();
      addTagToItem(form.dataset.tagitem, form.querySelector('input'));
    };
  });
  tbody.querySelectorAll('button.tag-pill-x').forEach(btn => {
    btn.onclick = () => {
      const tr = btn.closest('tr');
      if (tr && tr.dataset.itemId) removeTagFromItem(tr.dataset.itemId, btn.dataset.rmtag);
    };
  });
}

async function updateStock(id, newQty) {
  if (newQty < 0) return;
  try {
    const res = await apiFetch(`/api/inventory/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quantity: newQty })
    });
    if (res.ok) loadInventory();
  } catch (e) {}
}

async function deleteItem(id) {
  if (!confirm('Delete this generic item from inventory?')) return;
  try {
    const res = await apiFetch(`/api/inventory/${id}`, { method: 'DELETE' });
    if (res.ok) loadInventory();
  } catch (e) {}
}

// ==========================================================================
// TAG EDITING (inline in the inventory table)
// ==========================================================================

async function persistSynonyms(item, synonyms) {
  try {
    const res = await apiFetch(`/api/inventory/${item.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ synonyms })
    });
    if (res.ok) {
      loadInventory();   // re-render table + unlinked flag
      loadActivity();    // refresh activity trail
    }
  } catch (e) {}
}

async function addTagToItem(itemId, inputEl) {
  const val = (inputEl.value || '').trim().toLowerCase();
  if (!val) return;
  const item = AdminState.inventory.find(i => i.id === itemId);
  if (!item) return;
  if (!item.synonyms) item.synonyms = [];
  if (item.synonyms.some(s => s.toLowerCase() === val)) {
    inputEl.value = '';
    return;
  }
  item.synonyms.push(val);
  await persistSynonyms(item, item.synonyms);
}

async function removeTagFromItem(itemId, syn) {
  const item = AdminState.inventory.find(i => i.id === itemId);
  if (!item || !item.synonyms) return;
  const next = item.synonyms.filter(s => s.toLowerCase() !== String(syn).toLowerCase());
  if (next.length === item.synonyms.length) return;
  await persistSynonyms(item, next);
}

// ==========================================================================
// CATEGORIES MANAGEMENT
// ==========================================================================
function initCategoryManagement() {
  const modal = document.getElementById('categoryModal');
  const form = document.getElementById('formCatEdit');
  const nameInput = document.getElementById('catEditName');
  const catIconInput = document.getElementById('catEditIcon');
  const catIconPreview = document.getElementById('catIconPreview');
  const descInput = document.getElementById('catEditDesc');
  const idInput = document.getElementById('catEditId');
  const titleEl = document.getElementById('categoryModalTitle');
  const saveLabel = document.getElementById('catSaveLabel');
  if (!form) return;

  function normalizeIconName(v) {
    v = (v || '').trim().toLowerCase().replace(/\s+/g, '-');
    if (!v) return 'ph-tag';
    return v.startsWith('ph-') ? v : 'ph-' + v;
  }

  function updateIconPreview() {
    if (!catIconInput || !catIconPreview) return;
    const n = normalizeIconName(catIconInput.value);
    catIconPreview.className = 'ph cat-icon-preview ' + n;
    const bundled = (window.PH_ICONS || []).includes(n.replace(/^ph-/, ''));
    catIconPreview.title = bundled ? n : n + ' (not in the bundled font set)';
  }

  if (catIconInput) {
    catIconInput.addEventListener('input', updateIconPreview);
    fillIconDatalist('phIconOptions');
  }

  window.openCategoryModal = function (cat) {
    if (cat) {
      titleEl.innerHTML = '<i class="ph ph-pencil-simple"></i> Edit Item Category';
      saveLabel.textContent = 'Save changes';
      idInput.value = cat.id;
      nameInput.value = cat.name || '';
      catIconInput.value = (cat.icon || 'ph-tag').replace(/^ph-/, '');
      descInput.value = cat.description || '';
    } else {
      titleEl.innerHTML = '<i class="ph ph-folder-plus"></i> Add Item Category';
      saveLabel.textContent = 'Add category';
      form.reset();
      idInput.value = '';
    }
    updateIconPreview();
    modal.style.display = 'flex';
    setTimeout(() => nameInput.focus(), 50);
  };

  window.editCategory = function (id) {
    const cat = AdminState.categories.find(c => c.id === id);
    if (cat) window.openCategoryModal(cat);
  };

  const closeCatModal = () => { modal.style.display = 'none'; };
  const btnClose = document.getElementById('btnCloseCatModal');
  const btnCancel = document.getElementById('btnCatCancel');
  if (btnClose) btnClose.onclick = closeCatModal;
  if (btnCancel) btnCancel.onclick = closeCatModal;
  modal.addEventListener('click', (e) => { if (e.target === modal) closeCatModal(); });
  const btnOpenCatAdd = document.getElementById('btnOpenCatAdd');
  if (btnOpenCatAdd) btnOpenCatAdd.onclick = () => window.openCategoryModal(null);

  form.onsubmit = async (e) => {
    e.preventDefault();
    const id = idInput.value;
    const name = nameInput.value.trim();
    const icon = normalizeIconName(catIconInput ? catIconInput.value : '');
    const desc = descInput.value.trim();
    if (!name) return;

    try {
      const url = id ? '/api/categories/' + encodeURIComponent(id) : '/api/categories';
      const res = await apiFetch(url, {
        method: id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, icon, description: desc })
      });
      const data = await res.json();
      if (data.success) {
        modal.style.display = 'none';
        loadCategories();
        loadInventory();
      } else {
        alert(data.error || 'Error saving category');
      }
    } catch (err) {}
  };
}

async function loadCategories() {
  try {
    const res = await apiFetch('/api/categories');
    const data = await res.json();
    if (data.success && data.categories) {
      AdminState.categories = data.categories;
      renderCategoriesTable();
      renderCategoryFilterPills();
    }
  } catch (e) {}
}

function renderCategoryFilterPills() {
  const bar = document.getElementById('invCategoryFilterBar');
  if (!bar) return;

  const cats = [{ name: 'All', icon: 'ph-squares-four' }, ...AdminState.categories];
  bar.innerHTML = cats.map(c => `
    <button class="cat-pill ${c.name === AdminState.selectedCategory ? 'active' : ''}" onclick="selectFilterCat('${escapeHtml(c.name)}')">
      <i class="ph ${c.icon || 'ph-tag'}"></i> ${escapeHtml(c.name)}
    </button>
  `).join('');
}

window.selectFilterCat = (name) => {
  AdminState.selectedCategory = name;
  renderCategoryFilterPills();
  renderInventoryTable();
};

function renderCategoriesTable() {
  const list = document.getElementById('catList');
  const countBadge = document.getElementById('catTotalBadge');
  if (!list) return;

  if (countBadge) countBadge.textContent = AdminState.categories.length;

  if (!AdminState.categories.length) {
    list.innerHTML = '<p class="form-hint" id="catListEmpty">No categories yet — add one to organise your inventory.</p>';
    return;
  }

  list.innerHTML = AdminState.categories.map(cat => {
    const itemCount = AdminState.inventory.filter(i => i.category === cat.name).length;
    return `
      <div class="cat-row">
        <i class="ph ${escapeHtml(cat.icon || 'ph-tag')} cat-row-icon"></i>
        <div class="cat-row-main">
          <div class="cat-row-name">${escapeHtml(cat.name)}</div>
          ${cat.description ? `<div class="cat-row-desc">${escapeHtml(cat.description)}</div>` : ''}
        </div>
        <div class="cat-row-meta">
          <span class="cat-count-pill">${itemCount} item${itemCount === 1 ? '' : 's'}</span>
          <div class="cat-row-actions">
            <button type="button" class="btn-secondary-sm" title="Edit category" onclick="editCategory('${cat.id}')"><i class="ph ph-pencil-simple"></i> Edit</button>
            <button type="button" class="btn-secondary-sm" title="Delete category" onclick="deleteCategory('${cat.id}')" style="color:#dc2626;"><i class="ph ph-trash"></i></button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

async function deleteCategory(id) {
  if (!confirm('Delete this category?')) return;
  try {
    const res = await apiFetch(`/api/categories/${id}`, { method: 'DELETE' });
    if (res.ok) loadCategories();
  } catch (e) {}
}

// ==========================================================================
// MODALS: ADD & EDIT ITEM
// ==========================================================================
function initModals() {
  const addModal = document.getElementById('newItemModal');
  const editModal = document.getElementById('editItemModal');

  document.getElementById('btnOpenNewItemModal').onclick = () => {
    document.getElementById('formAddNewItem').reset();
    populateCategoryDropdown('newCat');
    addModal.style.display = 'flex';
  };

  document.getElementById('btnCloseNewItemModal').onclick = () => { addModal.style.display = 'none'; };
  document.getElementById('btnCancelNewItem').onclick = () => { addModal.style.display = 'none'; };
  const newIconEl = document.getElementById('newIcon');
  const newIconPrev = document.getElementById('newIconPreview');
  if (newIconEl && newIconPrev) {
    newIconEl.oninput = () => {
      const v = (newIconEl.value || '').trim().toLowerCase().replace(/\s+/g, '-');
      newIconPrev.className = 'ph cat-icon-preview ' + (v ? (v.startsWith('ph-') ? v : 'ph-' + v) : 'ph-package');
    };
  }
  document.getElementById('btnCloseEditModal').onclick = () => { editModal.style.display = 'none'; };
  document.getElementById('btnCancelEdit').onclick = () => { editModal.style.display = 'none'; };

  // Submit Add
  document.getElementById('formAddNewItem').onsubmit = async (e) => {
    e.preventDefault();
    const title = document.getElementById('newTitle').value.trim();
    const category = document.getElementById('newCat').value;
    const quantity = parseInt(document.getElementById('newQty').value, 10) || 1;
    const unit = document.getElementById('newUnit').value.trim() || 'pcs';
    const weight_kg = parseFloat(document.getElementById('newWeight').value) || 0.5;
    const est_value_eur = parseFloat(document.getElementById('newValue').value) || 10.0;
    const co2_factor = parseFloat(document.getElementById('newCo2').value) || ((weight_kg) * 2.8).toFixed(1);
    const synRaw = document.getElementById('newSynonyms').value.trim();
    const newIconRaw = (document.getElementById('newIcon') ? document.getElementById('newIcon').value : '').trim().toLowerCase().replace(/\s+/g, '-');
    const synonyms = synRaw ? synRaw.split(',').map(s => s.trim().toLowerCase()).filter(Boolean) : [title.toLowerCase()];

    try {
      const res = await apiFetch('/api/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, category, quantity, unit, weight_kg, est_value_eur, co2_factor, synonyms, icon: newIconRaw ? (newIconRaw.startsWith('ph-') ? newIconRaw : 'ph-' + newIconRaw) : 'ph-package' })
      });
      if (res.ok) {
        addModal.style.display = 'none';
        loadInventory();
      }
    } catch (e) {}
  };

  // Submit Edit
  document.getElementById('formEditItemDetails').onsubmit = async (e) => {
    e.preventDefault();
    const id = document.getElementById('editId').value;
    const title = document.getElementById('editTitle').value.trim();
    const category = document.getElementById('editCat').value;
    const quantity = parseInt(document.getElementById('editQty').value, 10) || 0;
    const unit = document.getElementById('editUnit').value.trim() || 'pcs';
    const weight_kg = parseFloat(document.getElementById('editWeight').value);
    const est_value_eur = parseFloat(document.getElementById('editValue').value);
    const co2_factor = parseFloat(document.getElementById('editCo2').value);
    const synRaw = document.getElementById('editSynonyms').value.trim();
    const synonyms = synRaw ? synRaw.split(',').map(s => s.trim().toLowerCase()).filter(Boolean) : [];
    const iconRaw = (document.getElementById('editIcon') ? document.getElementById('editIcon').value : '').trim().toLowerCase().replace(/\s+/g, '-');

    try {
      const res = await apiFetch(`/api/inventory/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, category, quantity, unit, weight_kg, est_value_eur, co2_factor, synonyms, ...(iconRaw ? { icon: iconRaw.startsWith('ph-') ? iconRaw : 'ph-' + iconRaw } : {}) })
      });
      if (res.ok) {
        editModal.style.display = 'none';
        loadInventory();
      }
    } catch (e) {}
  };
}

function populateCategoryDropdown(elementId, selected = '') {
  const select = document.getElementById(elementId);
  if (!select) return;
  select.innerHTML = AdminState.categories.map(c => `
    <option value="${escapeHtml(c.name)}" ${c.name === selected ? 'selected' : ''}>${escapeHtml(c.name)}</option>
  `).join('');
}

window.openEditModal = (id) => {
  const item = AdminState.inventory.find(i => i.id === id);
  if (!item) return;

  document.getElementById('editId').value = item.id;
  document.getElementById('editTitle').value = item.title;
  populateCategoryDropdown('editCat', item.category);
  document.getElementById('editQty').value = item.quantity || 0;
  document.getElementById('editUnit').value = item.unit || 'pcs';
  document.getElementById('editWeight').value = item.weight_kg || 0.5;
  document.getElementById('editValue').value = item.est_value_eur || 10.0;
  document.getElementById('editCo2').value = item.co2_factor || ((item.weight_kg || 0.5) * 2.8).toFixed(1);
  document.getElementById('editSynonyms').value = (item.synonyms || []).join(', ');

  const editIconEl = document.getElementById('editIcon');
  const editIconPrev = document.getElementById('editIconPreview');
  if (editIconEl && editIconPrev) {
    const rawIcon = (item.icon || '').replace(/^ph-/, '');
    editIconEl.value = rawIcon;
    const paintEditIcon = () => {
      const v = (editIconEl.value || '').trim().toLowerCase().replace(/\s+/g, '-');
      editIconPrev.className = 'ph cat-icon-preview ' + (v ? (v.startsWith('ph-') ? v : 'ph-' + v) : 'ph-package');
    };
    paintEditIcon();
    editIconEl.oninput = paintEditIcon;
  }

  document.getElementById('editItemModal').style.display = 'flex';
};

// ==========================================================================
// ANALYTICS & ACTIVITY LOG
// ==========================================================================
async function loadAnalytics() {
  try {
    const res = await apiFetch('/api/analytics');
    const data = await res.json();
    if (!data.success) return;

    document.getElementById('statItemsSwapped').textContent = data.totalItemsSwapped || 0;
    document.getElementById('statWeightDiverted').textContent = `${data.totalWeightKg || 0} kg`;
    document.getElementById('statCo2Avoided').textContent = `${data.co2AvoidedKg || 0} kg`;
    document.getElementById('statMoneySaved').textContent = `€${data.totalValueEur || 0}`;

    const demo = data.demographics || { students: 0, nonStudents: 0, international: 0, domestic: 0 };
    const total = (demo.students + demo.nonStudents) || 1;
    const pctStud = Math.round((demo.students / total) * 100);
    const pctNon = 100 - pctStud;

    document.getElementById('studCount').textContent = `${demo.students} (${pctStud}%)`;
    document.getElementById('nonStudCount').textContent = `${demo.nonStudents} (${pctNon}%)`;
    document.getElementById('barStudents').style.width = `${pctStud}%`;
    document.getElementById('barNonStudents').style.width = `${pctNon}%`;

    document.getElementById('intlCount').textContent = demo.international;
    document.getElementById('domCount').textContent = demo.domestic;

    // Accommodations
    const accomBox = document.getElementById('accomListBody');
    const accoms = data.accommodations || {};
    const maxA = Math.max(...Object.values(accoms), 1);
    accomBox.innerHTML = Object.keys(accoms).length ? Object.keys(accoms).map(k => `
      <div style="display:flex; justify-content:space-between; font-size:0.82rem; font-weight:600;">
        <span>${escapeHtml(k)}</span>
        <span>${accoms[k]}</span>
      </div>
      <div class="track" style="margin-bottom:0.4rem;"><div class="fill blue" style="width:${Math.round((accoms[k]/maxA)*100)}%;"></div></div>
    `).join('') : '<div style="color:var(--text-muted); font-size:0.8rem;">No accommodations yet.</div>';

    // Stay durations
    const stayBox = document.getElementById('stayListBody');
    const stays = data.stayDurations || {};
    const maxS = Math.max(...Object.values(stays), 1);
    stayBox.innerHTML = Object.keys(stays).length ? Object.keys(stays).map(k => `
      <div style="display:flex; justify-content:space-between; font-size:0.82rem; font-weight:600;">
        <span>${escapeHtml(k)}</span>
        <span>${stays[k]}</span>
      </div>
      <div class="track" style="margin-bottom:0.4rem;"><div class="fill green" style="width:${Math.round((stays[k]/maxS)*100)}%;"></div></div>
    `).join('') : '<div style="color:var(--text-muted); font-size:0.8rem;">No durations recorded yet.</div>';

    // 12th pass: extra KPIs
    const avgEl = document.getElementById('statAvgValueItem');
    if (avgEl) avgEl.textContent = `€${(data.avgValuePerItem || 0)}`;
    const stockEl = document.getElementById('statStockValue');
    if (stockEl) stockEl.textContent = `€${Math.round(data.stockValueEur || 0)}`;

    // 12th pass: top swapped items
    const topBox = document.getElementById('analyticsTopItems');
    if (topBox) {
      const top = data.topItems || [];
      if (top.length) {
        const maxT = Math.max(...top.map(t => t.count), 1);
        topBox.innerHTML = top.map(t => `
          <div class="topitem-row">
            <div class="ti-head">
              <span class="ti-title">${escapeHtml(t.title)}</span>
              <span class="ti-count">× ${t.count}</span>
            </div>
            <div class="track"><div class="fill teal" style="width:${Math.round((t.count / maxT) * 100)}%;"></div></div>
          </div>
        `).join('');
      } else {
        topBox.innerHTML = '<p class="form-hint">No item data yet.</p>';
      }
    }

    // 12th pass: category mix
    const mixBox = document.getElementById('analyticsCategoryMix');
    if (mixBox) {
      const mix = data.categoryMix || [];
      if (mix.length) {
        const maxM = Math.max(...mix.map(m => m.count), 1);
        mixBox.innerHTML = mix.map(m => `
          <div class="mix-row">
            <div class="mx-head">
              <span class="mx-name">${escapeHtml(m.category)}</span>
              <span class="mx-count">${m.count}</span>
            </div>
            <div class="track"><div class="fill green" style="width:${Math.round((m.count / maxM) * 100)}%;"></div></div>
          </div>
        `).join('');
      } else {
        mixBox.innerHTML = '<p class="form-hint">No item data yet.</p>';
      }
    }

    // 12th pass: 6-month activity trend
    const trendBox = document.getElementById('analyticsTrend');
    if (trendBox) {
      const trend = data.monthlyTrend || [];
      if (trend.length) {
        const maxV = Math.max(...trend.map(t => Math.max(t.items, t.swaps)), 1);
        trendBox.innerHTML = trend.map(t => {
          const v = Math.max(t.items, t.swaps);
          const h = Math.max(3, Math.round((v / maxV) * 100));
          return `
            <div class="trend-col">
              <div class="trend-bar-wrap">
                <div class="trend-bar${v ? '' : ' zero'}" style="height:${h}%;">${v ? `<span class="tb-val">${t.items} items</span>` : ''}</div>
              </div>
              <div class="trend-label">${escapeHtml(t.label)}</div>
              <div class="trend-sub">${t.swaps} swap${t.swaps === 1 ? '' : 's'}</div>
            </div>
          `;
        }).join('');
      } else {
        trendBox.innerHTML = '<p class="form-hint">No transaction data yet.</p>';
      }
    }
  } catch (e) {}
}

async function loadActivity() {
  try {
    const res = await apiFetch('/api/transactions');
    const data = await res.json();
    if (!data.success) return;
    AdminState.transactions = data.transactions || [];

    const list = document.getElementById('activityTimelineList');
    if (!list) return;

    if (!data.transactions || data.transactions.length === 0) {
      list.innerHTML = '<div style="color:var(--text-muted); font-size:0.85rem;">No transactions logged yet.</div>';
      renderUnlinkedItems();
      return;
    }

    list.innerHTML = data.transactions.map(tx => {
      const icon = tx.action_type === 'drop-off' ? 'ph-tray-arrow-down' : (tx.action_type === 'pick-up' ? 'ph-tray-arrow-up' : 'ph-arrows-clockwise');
      const actionName = tx.action_type === 'drop-off' ? 'Drop-Off' : (tx.action_type === 'pick-up' ? 'Pick-Up' : 'Return');
      const itemsHtml = (tx.items || []).map(i => `<span class="timeline-chip"><strong>${i.amount}x</strong> ${escapeHtml(i.title)}</span>`).join('');

      return `
        <div class="timeline-item">
          <div class="timeline-dot"><i class="ph ${icon}"></i></div>
          <div class="timeline-header">
            <span>${actionName} (${escapeHtml(tx.user_type)})</span>
            <span class="timeline-time">${new Date(tx.timestamp).toLocaleString()}</span>
            <div class="timeline-actions">
              <button class="timeline-action-btn" title="Edit entry" data-edit="${tx.id}"><i class="ph ph-pencil-simple"></i></button>
              <button class="timeline-action-btn danger" title="Delete entry" data-del="${tx.id}"><i class="ph ph-trash"></i></button>
            </div>
          </div>
          <div class="timeline-meta">${tx.accommodation ? escapeHtml(tx.accommodation) + ' • ' : ''}${tx.weight_diverted_kg || 0} kg diverted • €${tx.value_saved_eur || 0}</div>
          <div class="timeline-pills">${itemsHtml || '<span style="font-size:0.72rem; color:var(--text-muted);">General visit</span>'}</div>
        </div>
      `;
    }).join('');

    list.querySelectorAll('[data-edit]').forEach(btn => {
      btn.onclick = () => editTransaction(btn.getAttribute('data-edit'));
    });
    list.querySelectorAll('[data-del]').forEach(btn => {
      btn.onclick = () => deleteTransaction(btn.getAttribute('data-del'));
    });
    renderUnlinkedItems();
  } catch (e) {}
}

// ==========================================================================
// UNLINKED KIOSK ENTRIES (words that don't match the stock pool yet)
// ==========================================================================
window.deleteTransaction = async (id) => {
  if (!confirm('Delete this activity entry? This cannot be undone.')) return;
  try {
    const res = await apiFetch(`/api/transactions/${id}`, { method: 'DELETE' });
    if (res.ok) {
      loadActivity();
      loadAnalytics();
    }
  } catch (e) {}
};

// ==========================================================================
// EDIT ACTIVITY ENTRY
// ==========================================================================
function renderEditTxItems(items) {
  const listEl = document.getElementById('editTxItemsList');
  if (!listEl) return;
  listEl.innerHTML = (items || []).map(it => `
    <div class="edit-tx-item-row">
      <input type="text" class="edit-tx-item-title" value="${escapeHtml(it.title || '')}" placeholder="Item name" />
      <input type="number" class="edit-tx-item-amount" value="${it.amount || 1}" min="1" style="width: 70px;" />
      <button type="button" class="btn-secondary-sm edit-tx-item-del" title="Remove item"><i class="ph ph-trash"></i></button>
    </div>
  `).join('') || '<div class="form-hint">No items in this entry.</div>';
  listEl.querySelectorAll('.edit-tx-item-del').forEach(btn => {
    btn.onclick = () => btn.closest('.edit-tx-item-row').remove();
  });
}

const setSelectValue = (selEl, val) => {
  if (val && ![...selEl.options].some(o => o.value === val)) {
    const o = document.createElement('option');
    o.value = val; o.textContent = val;
    selEl.appendChild(o);
  }
  selEl.value = val || (selEl.options[0] ? selEl.options[0].value : '');
};

window.editTransaction = (id) => {
  const tx = (AdminState.transactions || []).find(t => t.id === id);
  if (!tx) { alert('Entry not found (it may have been deleted).'); return; }
  document.getElementById('editTxId').value = id;
  setSelectValue(document.getElementById('editTxUserType'), tx.user_type || 'unspecified');
  setSelectValue(document.getElementById('editTxInternational'), tx.is_international || '');
  document.getElementById('editTxStay').value = tx.stay_duration || '';
  document.getElementById('editTxAccom').value = tx.accommodation || '';
  setSelectValue(document.getElementById('editTxAction'), tx.action_type || 'drop-off');
  renderEditTxItems(tx.items || []);
  document.getElementById('editTxModal').style.display = 'flex';
};

document.getElementById('btnCloseEditTxModal').addEventListener('click', () => {
  document.getElementById('editTxModal').style.display = 'none';
});
document.getElementById('btnCancelEditTx').addEventListener('click', () => {
  document.getElementById('editTxModal').style.display = 'none';
});
document.getElementById('btnAddEditTxItem').addEventListener('click', () => {
  const listEl = document.getElementById('editTxItemsList');
  const hint = listEl.querySelector('.form-hint');
  if (hint) hint.remove();
  const row = document.createElement('div');
  row.className = 'edit-tx-item-row';
  row.innerHTML = `
    <input type="text" class="edit-tx-item-title" value="" placeholder="Item name" />
    <input type="number" class="edit-tx-item-amount" value="1" min="1" style="width: 70px;" />
    <button type="button" class="btn-secondary-sm edit-tx-item-del" title="Remove item"><i class="ph ph-trash"></i></button>
  `;
  row.querySelector('.edit-tx-item-del').onclick = () => row.remove();
  listEl.appendChild(row);
});

document.getElementById('formEditTx').addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('editTxId').value;
  const items = [...document.querySelectorAll('#editTxItemsList .edit-tx-item-row')].map(r => ({
    title: r.querySelector('.edit-tx-item-title').value.trim(),
    amount: parseInt(r.querySelector('.edit-tx-item-amount').value, 10) || 1
  })).filter(it => it.title);
  const payload = {
    user_type: document.getElementById('editTxUserType').value,
    is_international: document.getElementById('editTxInternational').value,
    stay_duration: document.getElementById('editTxStay').value.trim(),
    accommodation: document.getElementById('editTxAccom').value.trim(),
    action_type: document.getElementById('editTxAction').value,
    items
  };
  try {
    const res = await apiFetch(`/api/transactions/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (data.success) {
      document.getElementById('editTxModal').style.display = 'none';
      loadActivity();
      loadAnalytics();
    } else {
      alert(data.error || 'Failed to save entry.');
    }
  } catch (e) {}
});

function computeUnlinkedItems() {
  const inv = AdminState.inventory;
  const knownWords = new Set();
  inv.forEach(it => {
    knownWords.add((it.title || '').toLowerCase().trim());
    (it.synonyms || []).forEach(s => knownWords.add(String(s).toLowerCase().trim()));
  });
  const knownIds = new Set(inv.map(i => i.id));
  const counts = {};
  (AdminState.transactions || []).forEach(tx => {
    (tx.items || []).forEach(it => {
      const word = String(it.title || '').toLowerCase().trim();
      if (!word) return;
      if (knownWords.has(word)) return;
      if (it.id && knownIds.has(it.id)) return;
      if (!counts[word]) counts[word] = { word: word, count: 0 };
      counts[word].count += Math.max(1, parseInt(it.amount, 10) || 1);
    });
  });
  return Object.values(counts).sort((a, b) => b.count - a.count);
}

function renderUnlinkedItems() {
  const box = document.getElementById('unlinkedItemsList');
  if (!box) return;
  const list = computeUnlinkedItems();
  const panel = document.getElementById('unlinkedPanel');
  if (panel) panel.className = 'unlinked-panel ' + (list.length ? 'flagged' : 'clear');
  const title = document.getElementById('unlinkedTitle');
  if (title) title.innerHTML = list.length
    ? '<i class="ph ph-link"></i> Unlinked kiosk entries'
    : '<i class="ph ph-check-circle"></i> All kiosk entries linked';
  if (!list.length) {
    box.innerHTML = '<div class="unlinked-empty"><i class="ph ph-check-circle"></i> All kiosk entries match the stock pool. Nothing to link.</div>';
    return;
  }

  box.innerHTML = list.map(u => `
    <div class="unlinked-row" id="linkrow-${encodeURIComponent(u.word)}">
      <div class="unlinked-word">
        <i class="ph ph-package"></i>
        <strong>${escapeHtml(u.word)}</strong>
        <span class="unlinked-count">\u00d7 ${u.count}</span>
      </div>
      <div class="unlinked-controls">
        <div class="link-group">
          <div class="link-combo">
            <input type="text" class="link-combo-input" placeholder="Search pool items\u2026" autocomplete="off" />
            <div class="link-combo-dropdown"></div>
          </div>
          <button class="btn-primary-sm" data-link="${escapeHtml(u.word)}"><i class="ph ph-check"></i> Link to existing</button>
        </div>
        <button class="btn-secondary-sm" data-create="${escapeHtml(u.word)}"><i class="ph ph-plus"></i> New pool item</button>
      </div>
    </div>
  `).join('');

  box.querySelectorAll('.unlinked-row').forEach(row => {
    const word = row.querySelector('[data-create]').getAttribute('data-create');
    row.querySelector('[data-create]').onclick = () => createItemFromWord(word);
    row.querySelector('[data-link]').onclick = () => linkUnlinkedTo(word);

    // Searchable pool-item picker: type to filter, click a suggestion to select.
    const input = row.querySelector('.link-combo-input');
    const dd = row.querySelector('.link-combo-dropdown');
    const linkBtn = row.querySelector('[data-link]');
    if (!input || !dd) return;
    row.__selectedId = null;

    const findMatches = (q) => {
      const term = (q || '').trim().toLowerCase();
      return AdminState.inventory.filter(it => {
        if (it.title.toLowerCase().includes(term)) return true;
        return (it.synonyms || []).some(s => String(s).toLowerCase().includes(term));
      });
    };

    const renderSuggestions = (q) => {
      const m = findMatches(q).slice(0, 8);
      dd.innerHTML = m.length ? m.map(it => `
        <div class="link-combo-row${it.id === row.__selectedId ? ' selected' : ''}" data-id="${it.id}">
          <i class="ph ${escapeHtml(it.icon || 'ph-package')} lc-icon"></i>
          <span class="lc-title">${escapeHtml(it.title)}</span>
          <span class="lc-syn">${escapeHtml((it.synonyms || []).slice(0, 3).join(', '))}</span>
          <span class="lc-qty">\u00d7${it.quantity || 0}</span>
        </div>`).join('')
        : '<div class="link-combo-empty">No pool items match \u2014 use \u201cNew pool item\u201d instead.</div>';
      dd.classList.add('open');
      dd.querySelectorAll('.link-combo-row').forEach(el => {
        el.addEventListener('mousedown', (ev) => {
          ev.preventDefault();
          const id = el.getAttribute('data-id');
          const it = AdminState.inventory.find(x => x.id === id);
          if (!it) return;
          row.__selectedId = id;
          input.value = it.title;
          dd.classList.remove('open');
          linkBtn.innerHTML = '<i class="ph ph-check"></i> Link: ' + escapeHtml(it.title);
        });
      });
    };

    input.addEventListener('input', () => renderSuggestions(input.value));
    input.addEventListener('focus', () => renderSuggestions(input.value));
    input.addEventListener('blur', () => setTimeout(() => dd.classList.remove('open'), 120));
  });
}

function setUnlinkedFeedback(msg, ok = true) {
  const fb = document.getElementById('unlinkedFeedback');
  if (!fb) return;
  fb.style.display = 'block';
  fb.className = 'feedback-badge ' + (ok ? 'success' : 'error');
  fb.innerHTML = '<i class="ph ' + (ok ? 'ph-check-circle' : 'ph-x-circle') + '"></i> ' + escapeHtml(msg);
  setTimeout(() => { fb.style.display = 'none'; }, 4000);
}

async function linkUnlinkedTo(word) {
  const rowEl = document.getElementById('linkrow-' + encodeURIComponent(word));
  let targetId = rowEl ? rowEl.__selectedId : null;
  if (!targetId && rowEl) {
    const input = rowEl.querySelector('.link-combo-input');
    const typed = input ? input.value.trim().toLowerCase() : '';
    if (typed) {
      const exact = AdminState.inventory.find(it => it.title.toLowerCase() === typed);
      if (exact) targetId = exact.id;
    }
  }
  if (!targetId) { setUnlinkedFeedback('Search the pool and select a highlighted item first.', false); return; }
  try {
    const res = await apiFetch('/api/admin/map-synonym', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ synonym: word, targetItemId: targetId })
    });
    const data = await res.json();
    if (data.success) {
      await loadInventory();
      loadActivity();
      setUnlinkedFeedback('"' + word + '" now maps to "' + ((data.item && data.item.title) || 'existing pool') + '".');
    } else {
      setUnlinkedFeedback(data.error || 'Failed to link word.', false);
    }
  } catch (e) {
    setUnlinkedFeedback('Error linking word.', false);
  }
}

window.createItemFromWord = (word) => {
  const form = document.getElementById('formAddNewItem');
  if (!form) return;
  form.reset();
  document.getElementById('newTitle').value = word.charAt(0).toUpperCase() + word.slice(1);
  document.getElementById('newSynonyms').value = word;
  document.getElementById('newQty').value = 0;
  populateCategoryDropdown('newCat');
  document.getElementById('newItemModal').style.display = 'flex';
};

function fillIconDatalist(datalistId) {
  const dl = document.getElementById(datalistId);
  if (!dl || !(window.PH_ICONS || []).length) return;
  dl.innerHTML = window.PH_ICONS.map(n => `<option value="${n}"></option>`).join('');
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}


// ==========================================================================
// SETTINGS & CONTENT TAB
// ==========================================================================
const DEFAULT_ACCOMMODATIONS = [
  { name: 'Parkside Student Residence', desc: 'North Campus Hall', icon: 'ph-buildings' },
  { name: 'Oakwood Student Village', desc: 'East Quad Residence', icon: 'ph-buildings' },
  { name: 'Riverfront Campus Towers', desc: 'South Bank High-Rise', icon: 'ph-buildings' },
  { name: 'Meadow Court Flats', desc: 'West Campus Lodges', icon: 'ph-buildings' },
  { name: 'West End College Lodge', desc: 'Central University Hall', icon: 'ph-buildings' }
];

let settingsLoaded = false;

async function initSettingsTab() {
  if (settingsLoaded) return;
  settingsLoaded = true;
  let list = DEFAULT_ACCOMMODATIONS;
  try {
    const res = await apiFetch('/api/settings');
    const data = await res.json();
    if (data.success && data.settings) {
      document.getElementById('settingShopName').value = data.settings.shopName || '';
      document.getElementById('settingCo2').value = data.settings.co2KgPerKgGoods != null ? data.settings.co2KgPerKgGoods : 2.8;
      if (Array.isArray(data.settings.accommodations) && data.settings.accommodations.length) {
        list = data.settings.accommodations;
      }
    }
  } catch (e) {}
  renderAccomEditor(list);
}

function renderAccomEditor(list) {
  const box = document.getElementById('accomEditorList');
  box.innerHTML = list.map(a => `
    <div class="accom-row">
      <input type="text" class="accom-name" value="${escapeHtml(a.name || '')}" placeholder="Residence name" />
      <input type="text" class="accom-desc" value="${escapeHtml(a.desc || '')}" placeholder="Short description" />
      <input type="text" class="accom-icon" list="phIconOptions" value="${escapeHtml(a.icon || 'ph-buildings')}" placeholder="icon" />
      <button type="button" class="btn-secondary-sm accom-del" title="Remove"><i class="ph ph-trash"></i></button>
    </div>
  `).join('') || '<div class="form-hint">No accommodations yet — add one below.</div>';
  box.querySelectorAll('.accom-del').forEach(btn => {
    btn.onclick = () => btn.closest('.accom-row').remove();
  });
}

document.getElementById('btnAddAccomRow').addEventListener('click', () => {
  const box = document.getElementById('accomEditorList');
  const hint = box.querySelector('.form-hint');
  if (hint) hint.remove();
  const row = document.createElement('div');
  row.className = 'accom-row';
  row.innerHTML = `
    <input type="text" class="accom-name" value="" placeholder="Residence name" />
    <input type="text" class="accom-desc" value="" placeholder="Short description" />
    <input type="text" class="accom-icon" list="phIconOptions" value="ph-buildings" placeholder="icon" />
    <button type="button" class="btn-secondary-sm accom-del" title="Remove"><i class="ph ph-trash"></i></button>
  `;
  row.querySelector('.accom-del').onclick = () => row.remove();
  box.appendChild(row);
});

document.getElementById('formShopSettings').addEventListener('submit', async (e) => {
  e.preventDefault();
  const accommodations = [...document.querySelectorAll('#accomEditorList .accom-row')].map(r => ({
    name: r.querySelector('.accom-name').value.trim(),
    desc: r.querySelector('.accom-desc').value.trim(),
    icon: r.querySelector('.accom-icon').value.trim() || 'ph-buildings'
  })).filter(a => a.name);
  const fb = document.getElementById('settingsFeedback');
  try {
    const res = await apiFetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        shopName: document.getElementById('settingShopName').value.trim(),
        co2KgPerKgGoods: parseFloat(document.getElementById('settingCo2').value),
        accommodations
      })
    });
    const data = await res.json();
    fb.style.display = 'block';
    if (data.success) {
      fb.className = 'feedback-badge success';
      fb.innerHTML = '<i class="ph ph-check-circle"></i> Settings saved — the kiosk picks them up on next load.';
    } else {
      fb.className = 'feedback-badge error';
      fb.innerHTML = '<i class="ph ph-x-circle"></i> ' + (data.error || 'Failed to save');
    }
  } catch (e) {
    fb.style.display = 'block';
    fb.className = 'feedback-badge error';
    fb.innerHTML = '<i class="ph ph-x-circle"></i> Error saving settings';
  }
  setTimeout(() => { fb.style.display = 'none'; }, 4000);
});
