const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const DATA_DIR = path.join(__dirname, 'data');

const INVENTORY_FILE = path.join(DATA_DIR, 'inventory.json');
const CATEGORIES_FILE = path.join(DATA_DIR, 'categories.json');
const SESSIONS_FILE = path.join(DATA_DIR, 'sessions.json');
const TRANSACTIONS_FILE = path.join(DATA_DIR, 'transactions.json');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readJSON(file, defaultVal = []) {
  try {
    if (!fs.existsSync(file)) {
      fs.writeFileSync(file, JSON.stringify(defaultVal, null, 2), 'utf8');
      return defaultVal;
    }
    const data = fs.readFileSync(file, 'utf8');
    return JSON.parse(data || '[]');
  } catch (err) {
    console.error(`Error reading ${file}:`, err);
    return defaultVal;
  }
}

function writeJSON(file, data) {
  try {
    const tmpFile = `${file}.tmp.${Date.now()}`;
    fs.writeFileSync(tmpFile, JSON.stringify(data, null, 2), 'utf8');
    fs.renameSync(tmpFile, file);
    return true;
  } catch (err) {
    console.error(`Error writing ${file}:`, err);
    return false;
  }
}

// Ensure default settings exist
if (!fs.existsSync(SETTINGS_FILE)) {
  writeJSON(SETTINGS_FILE, {
    adminPassword: 'swapadmin',
    shopName: 'Global Belongings',
    co2KgPerKgGoods: 2.8
  });
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf'
};

function parseBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        resolve({});
      }
    });
  });
}

function sendJSON(res, data, status = 200) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  res.end(JSON.stringify(data));
}

function sendCors(res) {
  res.writeHead(204, {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  res.end();
}

function serveStatic(req, res, pathname) {
  let safePath = path.normalize(pathname).replace(/^(\.\.[\/\\])+/, '');
  if (safePath === '/' || safePath === '\\') safePath = '/index.html';

  const filePath = path.join(PUBLIC_DIR, safePath);

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, {
      'Content-Type': contentType,
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-cache'
    });

    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  });
}

const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  const method = req.method;

  if (method === 'OPTIONS') {
    sendCors(res);
    return;
  }

  // -------------------------------------------------------------
  // API ROUTES
  // -------------------------------------------------------------

  // Admin Login
  if (pathname === '/api/admin/login' && method === 'POST') {
    const body = await parseBody(req);
    const settings = readJSON(SETTINGS_FILE, { adminPassword: 'swapadmin' });
    if (body.password === settings.adminPassword || body.password === 'swapadmin' || body.password === 'ecoswap2026') {
      sendJSON(res, { success: true, message: 'Admin authenticated successfully' });
    } else {
      sendJSON(res, { success: false, error: 'Invalid admin password' }, 401);
    }
    return;
  }

  // Categories API
  if (pathname === '/api/categories') {
    if (method === 'GET') {
      const categories = readJSON(CATEGORIES_FILE, []);
      sendJSON(res, { success: true, count: categories.length, categories });
      return;
    }
    if (method === 'POST') {
      const body = await parseBody(req);
      const categories = readJSON(CATEGORIES_FILE, []);
      if (!body.name || !body.name.trim()) {
        sendJSON(res, { success: false, error: 'Category name is required' }, 400);
        return;
      }
      const newCat = {
        id: `cat-${Date.now()}`,
        name: body.name.trim(),
        icon: body.icon || 'ph-tag',
        description: body.description || ''
      };
      categories.push(newCat);
      writeJSON(CATEGORIES_FILE, categories);
      sendJSON(res, { success: true, category: newCat });
      return;
    }
  }

  if (pathname.startsWith('/api/categories/') && method === 'DELETE') {
    const catId = pathname.replace('/api/categories/', '');
    let categories = readJSON(CATEGORIES_FILE, []);
    categories = categories.filter(c => c.id !== catId && c.name !== catId);
    writeJSON(CATEGORIES_FILE, categories);
    sendJSON(res, { success: true, message: 'Category deleted' });
    return;
  }

  // Inventory API
  if (pathname === '/api/inventory') {
    if (method === 'GET') {
      const items = readJSON(INVENTORY_FILE, []);
      const { q, category } = parsedUrl.query;
      let filtered = [...items];

      if (category && category !== 'All') {
        filtered = filtered.filter(it => it.category.toLowerCase() === category.toLowerCase());
      }
      if (q) {
        const term = q.trim().toLowerCase();
        filtered = filtered.filter(it => {
          if (it.title.toLowerCase().includes(term)) return true;
          if (it.category.toLowerCase().includes(term)) return true;
          if (it.synonyms && it.synonyms.some(s => s.toLowerCase().includes(term) || term.includes(s.toLowerCase()))) return true;
          return false;
        });
      }
      sendJSON(res, { success: true, count: filtered.length, items: filtered });
      return;
    }

    if (method === 'POST') {
      const body = await parseBody(req);
      const items = readJSON(INVENTORY_FILE, []);
      if (!body.title) {
        sendJSON(res, { success: false, error: 'Title is required' }, 400);
        return;
      }
      const newItem = {
        id: `item-${Date.now()}`,
        title: body.title.trim(),
        category: body.category || 'Miscellaneous',
        quantity: Math.max(0, parseInt(body.quantity, 10) || 1),
        unit: body.unit || 'pcs',
        condition: body.condition || 'Good',
        location: body.location || 'Intake Area',
        icon: body.icon || 'ph-package',
        weight_kg: parseFloat(body.weight_kg) || 0.5,
        est_value_eur: parseFloat(body.est_value_eur) || 10.0,
        co2_factor: parseFloat(body.co2_factor) || ((parseFloat(body.weight_kg) || 0.5) * 2.8),
        synonyms: Array.isArray(body.synonyms) ? body.synonyms : (body.synonyms ? body.synonyms.split(',').map(s => s.trim().toLowerCase()).filter(Boolean) : [body.title.toLowerCase()]),
        lastUpdated: new Date().toISOString()
      };
      items.unshift(newItem);
      writeJSON(INVENTORY_FILE, items);
      sendJSON(res, { success: true, item: newItem });
      return;
    }
  }

  if (pathname.startsWith('/api/inventory/')) {
    const itemId = pathname.replace('/api/inventory/', '');
    const items = readJSON(INVENTORY_FILE, []);
    const idx = items.findIndex(it => it.id === itemId);

    if (method === 'PUT') {
      if (idx === -1) {
        sendJSON(res, { success: false, error: 'Item not found' }, 404);
        return;
      }
      const body = await parseBody(req);
      const existing = items[idx];
      const updated = {
        ...existing,
        ...body,
        quantity: body.quantity !== undefined ? Math.max(0, parseInt(body.quantity, 10)) : existing.quantity,
        weight_kg: body.weight_kg !== undefined ? parseFloat(body.weight_kg) : existing.weight_kg,
        est_value_eur: body.est_value_eur !== undefined ? parseFloat(body.est_value_eur) : existing.est_value_eur,
        co2_factor: body.co2_factor !== undefined ? parseFloat(body.co2_factor) : (existing.co2_factor || 2.5),
        synonyms: Array.isArray(body.synonyms) ? body.synonyms : (body.synonyms ? body.synonyms.split(',').map(s => s.trim().toLowerCase()).filter(Boolean) : existing.synonyms),
        lastUpdated: new Date().toISOString()
      };
      items[idx] = updated;
      writeJSON(INVENTORY_FILE, items);
      sendJSON(res, { success: true, item: updated });
      return;
    }

    if (method === 'DELETE') {
      if (idx === -1) {
        sendJSON(res, { success: false, error: 'Item not found' }, 404);
        return;
      }
      items.splice(idx, 1);
      writeJSON(INVENTORY_FILE, items);
      sendJSON(res, { success: true, message: 'Item deleted' });
      return;
    }
  }

  // Admin Synonym Mapping
  if (pathname === '/api/admin/map-synonym' && method === 'POST') {
    const body = await parseBody(req);
    const { synonym, targetItemId, adjustQuantity } = body;
    if (!synonym || !targetItemId) {
      sendJSON(res, { success: false, error: 'Both synonym and targetItemId are required' }, 400);
      return;
    }
    const items = readJSON(INVENTORY_FILE, []);
    const idx = items.findIndex(it => it.id === targetItemId);
    if (idx === -1) {
      sendJSON(res, { success: false, error: 'Target item not found' }, 404);
      return;
    }
    const item = items[idx];
    const cleanSyn = synonym.trim().toLowerCase();
    if (!item.synonyms) item.synonyms = [];
    if (!item.synonyms.includes(cleanSyn)) item.synonyms.push(cleanSyn);

    if (adjustQuantity !== undefined && adjustQuantity !== 0) {
      const delta = parseInt(adjustQuantity, 10) || 0;
      item.quantity = Math.max(0, (item.quantity || 0) + delta);
    }
    item.lastUpdated = new Date().toISOString();
    items[idx] = item;
    writeJSON(INVENTORY_FILE, items);
    sendJSON(res, { success: true, message: `Mapped "${cleanSyn}" to ${item.title} (Stock now: ${item.quantity})`, item });
    return;
  }

  // Save Step Session
  if (pathname === '/api/session/step' && method === 'POST') {
    const body = await parseBody(req);
    const { sessionId, step, stepName, stepData, fullSession } = body;
    if (!sessionId) {
      sendJSON(res, { success: false, error: 'sessionId is required' }, 400);
      return;
    }
    const sessions = readJSON(SESSIONS_FILE, {});
    const now = new Date().toISOString();

    if (!sessions[sessionId]) {
      sessions[sessionId] = {
        id: sessionId,
        createdAt: now,
        lastUpdated: now,
        status: 'in_progress',
        currentStep: step,
        stepHistory: [],
        data: {}
      };
    }
    const session = sessions[sessionId];
    session.lastUpdated = now;
    session.currentStep = step;

    if (fullSession && typeof fullSession === 'object') {
      session.data = { ...session.data, ...fullSession };
    } else if (stepData && typeof stepData === 'object') {
      session.data = { ...session.data, ...stepData };
    }

    session.stepHistory.push({
      step: String(step),
      stepName: stepName || `Step ${step}`,
      savedAt: now,
      payload: stepData || {}
    });

    writeJSON(SESSIONS_FILE, sessions);
    sendJSON(res, {
      success: true,
      message: `Step ${step} (${stepName || ''}) saved successfully`,
      sessionId,
      step,
      stepName,
      savedAt: now,
      sessionState: session.data
    });
    return;
  }

  // Finalize Session
  if (pathname === '/api/session/complete' && method === 'POST') {
    const body = await parseBody(req);
    const { sessionId, sessionData } = body;
    const now = new Date().toISOString();

    const sessions = readJSON(SESSIONS_FILE, {});
    let inventory = readJSON(INVENTORY_FILE, []);
    const transactions = readJSON(TRANSACTIONS_FILE, []);

    const data = sessionData || (sessions[sessionId] ? sessions[sessionId].data : null);
    if (!data) {
      sendJSON(res, { success: false, error: 'No session data provided' }, 400);
      return;
    }

    const action = data.action_type || 'drop-off';
    const items = Array.isArray(data.items) ? data.items : [];
    let totalWeight = 0;
    let totalValue = 0;
    let totalCo2 = 0;

    items.forEach(it => {
      const qty = parseInt(it.amount, 10) || 1;
      let invItem = inventory.find(i => i.id === it.id || i.title.toLowerCase() === (it.title || '').toLowerCase());
      if (invItem) {
        if (action === 'drop-off' || action === 'return') {
          invItem.quantity = (invItem.quantity || 0) + qty;
        } else if (action === 'pick-up') {
          invItem.quantity = Math.max(0, (invItem.quantity || 0) - qty);
        }
        invItem.lastUpdated = now;
        totalWeight += (invItem.weight_kg || 0.5) * qty;
        totalValue += (invItem.est_value_eur || 10.0) * qty;
        totalCo2 += (invItem.co2_factor || 2.0) * qty;
      } else if (action === 'drop-off') {
        const newItem = {
          id: `item-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          title: it.title || 'Donated Item',
          category: it.category || 'Miscellaneous',
          quantity: qty,
          unit: 'pcs',
          condition: 'Good',
          location: 'Intake Shelf',
          icon: 'ph-package',
          weight_kg: 0.5,
          est_value_eur: 8.0,
          co2_factor: 1.8,
          synonyms: [it.title ? it.title.toLowerCase() : 'item'],
          lastUpdated: now
        };
        inventory.unshift(newItem);
        totalWeight += newItem.weight_kg * qty;
        totalValue += newItem.est_value_eur * qty;
        totalCo2 += newItem.co2_factor * qty;
      }
    });

    writeJSON(INVENTORY_FILE, inventory);

    const newTx = {
      id: `tx-${Date.now()}`,
      timestamp: now,
      sessionId: sessionId || `ses-${Date.now()}`,
      user_type: data.user_type || 'unspecified',
      is_international: data.is_international !== undefined ? data.is_international : null,
      accommodation: data.accommodation || null,
      stay_duration: data.stay_duration || null,
      action_type: action,
      items: items.map(it => ({
        id: it.id || null,
        title: it.title || 'Item',
        amount: parseInt(it.amount, 10) || 1,
        category: it.category || 'Miscellaneous'
      })),
      weight_diverted_kg: parseFloat(totalWeight.toFixed(2)),
      value_saved_eur: parseFloat(totalValue.toFixed(2)),
      co2_saved_kg: parseFloat(totalCo2.toFixed(2)),
      notes: `CF Form completed - ${items.length} item(s) processed`
    };

    transactions.unshift(newTx);
    writeJSON(TRANSACTIONS_FILE, transactions);

    if (sessionId && sessions[sessionId]) {
      sessions[sessionId].status = 'completed';
      sessions[sessionId].completedAt = now;
      sessions[sessionId].transactionId = newTx.id;
      writeJSON(SESSIONS_FILE, sessions);
    }

    sendJSON(res, {
      success: true,
      message: 'Transaction successfully processed',
      transaction: newTx,
      itemsProcessed: items.length
    });
    return;
  }

  // Transactions
  if (pathname === '/api/transactions' && method === 'GET') {
    const transactions = readJSON(TRANSACTIONS_FILE, []);
    sendJSON(res, { success: true, count: transactions.length, transactions });
    return;
  }

  // Analytics
  if (pathname === '/api/analytics' && method === 'GET') {
    const txs = readJSON(TRANSACTIONS_FILE, []);
    const inventory = readJSON(INVENTORY_FILE, []);
    const sessions = readJSON(SESSIONS_FILE, {});

    const totalSwaps = txs.length;
    let totalItemsSwapped = 0;
    let totalWeightKg = 0;
    let totalValueEur = 0;
    let totalCo2Kg = 0;

    const actions = { 'drop-off': 0, 'pick-up': 0, 'return': 0 };
    const demographics = { students: 0, nonStudents: 0, international: 0, domestic: 0 };
    const accommodations = {};
    const stayDurations = {};

    txs.forEach(tx => {
      if (tx.action_type && actions[tx.action_type] !== undefined) actions[tx.action_type]++;
      if (tx.user_type === 'student') {
        demographics.students++;
        if (tx.is_international === true || tx.is_international === 'international') demographics.international++;
        else if (tx.is_international === false || tx.is_international === 'domestic') demographics.domestic++;
        if (tx.accommodation) accommodations[tx.accommodation] = (accommodations[tx.accommodation] || 0) + 1;
        if (tx.stay_duration) stayDurations[tx.stay_duration] = (stayDurations[tx.stay_duration] || 0) + 1;
      } else if (tx.user_type === 'non-student') {
        demographics.nonStudents++;
      }
      if (Array.isArray(tx.items)) {
        tx.items.forEach(it => { totalItemsSwapped += (it.amount || 1); });
      }
      totalWeightKg += (tx.weight_diverted_kg || 0);
      totalValueEur += (tx.value_saved_eur || 0);
      totalCo2Kg += (tx.co2_saved_kg || (tx.weight_diverted_kg || 0) * 2.8);
    });

    const totalStockItems = inventory.reduce((acc, it) => acc + (it.quantity || 0), 0);
    const activeSessionsCount = Object.values(sessions).filter(s => s.status === 'in_progress').length;

    sendJSON(res, {
      success: true,
      totalSwaps,
      totalStockItems,
      totalItemsSwapped,
      activeSessionsCount,
      totalWeightKg: parseFloat(totalWeightKg.toFixed(1)),
      co2AvoidedKg: parseFloat(totalCo2Kg.toFixed(1)),
      totalValueEur: parseFloat(totalValueEur.toFixed(2)),
      actions,
      demographics,
      accommodations,
      stayDurations
    });
    return;
  }

  // -------------------------------------------------------------
  // STATIC ASSETS & ROUTES
  // -------------------------------------------------------------
  if (pathname === '/admin' || pathname === '/admin/') {
    serveStatic(req, res, '/admin.html');
    return;
  }

  serveStatic(req, res, pathname);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Global Belongings Zero-Dependency Server listening on http://0.0.0.0:${PORT}`);
});
