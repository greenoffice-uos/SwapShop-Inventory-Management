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

document.addEventListener('DOMContentLoaded', () => {
  initAuth();
  initNavTabs();
  initInventoryActions();
  initSynonymMapping();
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
        errMsg.textContent = 'Incorrect password (default: swapadmin)';
        errMsg.style.display = 'block';
      }
    }
  };

  btnLock.onclick = () => {
    sessionStorage.removeItem('swapshop_admin_authed');
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
      if (target === 'synonyms') renderSynonymDirectory();
      if (target === 'categories') renderCategoriesTable();
      if (target === 'analytics') loadAnalytics();
      if (target === 'activity') loadActivity();
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
    const res = await fetch('/api/inventory');
    const data = await res.json();
    if (data.success && data.items) {
      AdminState.inventory = data.items;
      renderInventoryTable();
      renderSynonymDirectory();
      populateTargetItemSelect();
      renderUnlinkedItems();
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
    const synChips = (item.synonyms && item.synonyms.length > 0)
      ? item.synonyms.map(s => `<span class="syn-micro-pill">${escapeHtml(s)}</span>`).join('')
      : '<span style="color: var(--text-muted); font-size: 0.75rem;">None</span>';

    return `
      <tr>
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
        <td><div class="syn-chips-wrap">${synChips}</div></td>
        <td>
          <div style="display: flex; gap: 0.35rem;">
            <button class="btn-secondary-sm" onclick="openEditModal('${item.id}')" title="Edit Item"><i class="ph ph-pencil-simple"></i></button>
            <button class="btn-secondary-sm" onclick="deleteItem('${item.id}')" title="Delete Item" style="color: #dc2626;"><i class="ph ph-trash"></i></button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

async function updateStock(id, newQty) {
  if (newQty < 0) return;
  try {
    const res = await fetch(`/api/inventory/${id}`, {
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
    const res = await fetch(`/api/inventory/${id}`, { method: 'DELETE' });
    if (res.ok) loadInventory();
  } catch (e) {}
}

// ==========================================================================
// SYNONYM & POOL MAPPING ASSISTANT
// ==========================================================================
function initSynonymMapping() {
  const form = document.getElementById('formMapSynonymPool');
  const feedback = document.getElementById('mapFeedback');

  form.onsubmit = async (e) => {
    e.preventDefault();
    const syn = document.getElementById('mapWord').value.trim();
    const targetId = document.getElementById('mapTargetItem').value;
    const delta = parseInt(document.getElementById('mapDeltaQty').value, 10) || 0;

    if (!syn || !targetId) return;

    try {
      const res = await fetch('/api/admin/map-synonym', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          synonym: syn,
          targetItemId: targetId,
          adjustQuantity: delta
        })
      });
      const data = await res.json();
      if (data.success) {
        feedback.textContent = `✓ ${data.message}`;
        feedback.style.display = 'block';
        document.getElementById('mapWord').value = '';
        document.getElementById('mapDeltaQty').value = '0';
        loadInventory();
        setTimeout(() => { feedback.style.display = 'none'; }, 4000);
      }
    } catch (e) {}
  };
}

function renderSynonymDirectory() {
  const grid = document.getElementById('synonymDirectoryGrid');
  if (!grid) return;

  const sorted = [...AdminState.inventory].sort((a, b) => a.title.localeCompare(b.title));

  grid.innerHTML = sorted.map(item => {
    const pills = (item.synonyms || []).map(s => `
      <span class="dir-syn-pill">
        ${escapeHtml(s)}
        <button class="btn-del-syn" onclick="removeSynonym('${item.id}', '${escapeHtml(s)}')">×</button>
      </span>
    `).join('');

    return `
      <div class="dir-card">
        <div class="dir-header">
          <span class="dir-title"><i class="ph ${item.icon || 'ph-package'}"></i> ${escapeHtml(item.title)}</span>
          <span class="dir-stock">${item.quantity || 0} in pool</span>
        </div>
        <div class="dir-pills">${pills || '<span style="font-size:0.75rem; color:var(--text-muted);">No synonyms</span>'}</div>
        <form class="quick-add-syn" onsubmit="event.preventDefault(); addSynonym(this, '${item.id}');">
          <input type="text" placeholder="+ add synonym..." required />
          <button type="submit" class="btn-secondary-sm" style="padding: 0.2rem 0.5rem;"><i class="ph ph-plus"></i></button>
        </form>
      </div>
    `;
  }).join('');
}

async function addSynonym(formEl, itemId) {
  const input = formEl.querySelector('input');
  const val = input.value.trim().toLowerCase();
  if (!val) return;

  const item = AdminState.inventory.find(i => i.id === itemId);
  if (!item) return;

  if (!item.synonyms) item.synonyms = [];
  if (!item.synonyms.includes(val)) {
    item.synonyms.push(val);
    await fetch(`/api/inventory/${itemId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ synonyms: item.synonyms })
    });
    input.value = '';
    loadInventory();
  }
}

async function removeSynonym(itemId, syn) {
  const item = AdminState.inventory.find(i => i.id === itemId);
  if (!item || !item.synonyms) return;

  item.synonyms = item.synonyms.filter(s => s.toLowerCase() !== syn.toLowerCase());
  await fetch(`/api/inventory/${itemId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ synonyms: item.synonyms })
  });
  loadInventory();
}

function populateTargetItemSelect() {
  const select = document.getElementById('mapTargetItem');
  if (!select) return;

  const sorted = [...AdminState.inventory].sort((a, b) => a.title.localeCompare(b.title));
  select.innerHTML = sorted.map(i => `
    <option value="${i.id}">${escapeHtml(i.title)} (${escapeHtml(i.category)} • Stock: ${i.quantity})</option>
  `).join('');
}

// ==========================================================================
// CATEGORIES MANAGEMENT
// ==========================================================================
function initCategoryManagement() {
  const form = document.getElementById('formCreateCategory');
  const catIconInput = document.getElementById('catIconInput');
  const catIconPreview = document.getElementById('catIconPreview');

  function normalizeIconName(v) {
    v = (v || '').trim().toLowerCase().replace(/\s+/g, '-');
    if (!v) return 'ph-tag';
    return v.startsWith('ph-') ? v : 'ph-' + v;
  }

  function updateIconPreview() {
    const n = normalizeIconName(catIconInput.value);
    catIconPreview.className = 'ph cat-icon-preview ' + n;
    const bundled = (window.PH_ICONS || []).includes(n.replace(/^ph-/, ''));
    catIconPreview.title = bundled ? n : n + ' (not in the bundled font set)';
  }

  if (catIconInput) {
    catIconInput.addEventListener('input', updateIconPreview);
    fillIconDatalist('phIconOptions');
    updateIconPreview();
  }

  form.onsubmit = async (e) => {
    e.preventDefault();
    const name = document.getElementById('catNameInput').value.trim();
    const icon = catIconInput ? normalizeIconName(catIconInput.value) : 'ph-tag';
    const desc = document.getElementById('catDescInput').value.trim();

    if (!name) return;

    try {
      const res = await fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, icon, description: desc })
      });
      const data = await res.json();
      if (data.success) {
        form.reset();
        loadCategories();
      } else {
        alert(data.error || 'Error creating category');
      }
    } catch (e) {}
  };
}

async function loadCategories() {
  try {
    const res = await fetch('/api/categories');
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
  const tbody = document.getElementById('categoriesTableBody');
  const countBadge = document.getElementById('catTotalBadge');
  if (!tbody) return;

  countBadge.textContent = AdminState.categories.length;

  tbody.innerHTML = AdminState.categories.map(cat => {
    const itemCount = AdminState.inventory.filter(i => i.category === cat.name).length;
    return `
      <tr>
        <td><strong>${escapeHtml(cat.name)}</strong><br><small style="color:var(--text-muted);">${escapeHtml(cat.description || '')}</small></td>
        <td><i class="ph ${cat.icon || 'ph-tag'}" style="font-size: 1.25rem; color: var(--primary);"></i> <code>${escapeHtml(cat.icon || 'ph-tag')}</code></td>
        <td><span style="background:#dcfce7; color:#166534; padding:0.15rem 0.5rem; border-radius:var(--radius-full); font-weight:700; font-size:0.75rem;">${itemCount} items</span></td>
        <td>
          <button class="btn-secondary-sm" onclick="deleteCategory('${cat.id}')" style="color: #dc2626;"><i class="ph ph-trash"></i></button>
        </td>
      </tr>
    `;
  }).join('');
}

async function deleteCategory(id) {
  if (!confirm('Delete this category?')) return;
  try {
    const res = await fetch(`/api/categories/${id}`, { method: 'DELETE' });
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
    const synonyms = synRaw ? synRaw.split(',').map(s => s.trim().toLowerCase()).filter(Boolean) : [title.toLowerCase()];

    try {
      const res = await fetch('/api/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, category, quantity, unit, weight_kg, est_value_eur, co2_factor, synonyms, icon: 'ph-package' })
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

    try {
      const res = await fetch(`/api/inventory/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, category, quantity, unit, weight_kg, est_value_eur, co2_factor, synonyms })
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

  document.getElementById('editItemModal').style.display = 'flex';
};

// ==========================================================================
// ANALYTICS & ACTIVITY LOG
// ==========================================================================
async function loadAnalytics() {
  try {
    const res = await fetch('/api/analytics');
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
  } catch (e) {}
}

async function loadActivity() {
  try {
    const res = await fetch('/api/transactions');
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
            <button class="tx-delete-btn" title="Delete this entry" onclick="deleteTransaction('${tx.id}')"><i class="ph ph-trash"></i></button>
          </div>
          <div class="timeline-meta">${tx.accommodation ? escapeHtml(tx.accommodation) + ' • ' : ''}${tx.weight_diverted_kg || 0} kg diverted • €${tx.value_saved_eur || 0}</div>
          <div class="timeline-pills">${itemsHtml || '<span style="font-size:0.72rem; color:var(--text-muted);">General visit</span>'}</div>
        </div>
      `;
    }).join('');
    renderUnlinkedItems();
  } catch (e) {}
}

// ==========================================================================
// UNLINKED KIOSK ENTRIES (words that don't match the stock pool yet)
// ==========================================================================
window.deleteTransaction = async (id) => {
  if (!confirm('Delete this activity entry? This cannot be undone.')) return;
  try {
    const res = await fetch(`/api/transactions/${id}`, { method: 'DELETE' });
    if (res.ok) {
      loadActivity();
      loadAnalytics();
    }
  } catch (e) {}
};

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
  if (!list.length) {
    box.innerHTML = '<div class="unlinked-empty"><i class="ph ph-check-circle"></i> All kiosk entries match the stock pool. Nothing to link.</div>';
    return;
  }
  box.innerHTML = list.map(u => `
    <div class="unlinked-row">
      <div class="unlinked-word">
        <i class="ph ph-package"></i>
        <strong>${escapeHtml(u.word)}</strong>
        <span class="unlinked-count">\u00d7 ${u.count}</span>
      </div>
      <div class="unlinked-actions">
        <button class="btn-secondary-sm" onclick="linkUnlinked('${escapeHtml(u.word)}')"><i class="ph ph-link"></i> Link to existing</button>
        <button class="btn-primary-sm" onclick="createItemFromWord('${escapeHtml(u.word)}')"><i class="ph ph-plus"></i> New pool item</button>
      </div>
    </div>
  `).join('');
}

window.linkUnlinked = (word) => {
  const w = document.getElementById('mapWord');
  if (w) {
    w.value = word;
    const form = document.getElementById('formMapSynonymPool');
    if (form) form.scrollIntoView({ behavior: 'smooth', block: 'center' });
    w.focus();
  }
};

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
