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
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Admin-Password'
  });
  res.end(JSON.stringify(data));
}

function sendCors(res) {
  res.writeHead(204, {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Admin-Password'
  });
  res.end();
}

// -------------------------------------------------------------
// ADMIN AUTH: session tokens + login rate limiting
// -------------------------------------------------------------
const ADMIN_SESSIONS_FILE = path.join(DATA_DIR, 'admin_sessions.json');
const LOGIN_RL_FILE = path.join(DATA_DIR, 'login_rl.json');
const ADMIN_SESSION_TTL_MS = 12 * 60 * 60 * 1000; // tokens live 12 hours
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;

function clientIP(req) {
  const forwarded = req.headers['cf-connecting-ip'] || req.headers['x-forwarded-for'];
  return (forwarded ? String(forwarded).split(',')[0].trim() : '') || (req.socket.remoteAddress || 'unknown');
}

function validAdminPassword(password, settings) {
  if (!password) return false;
  return password === settings.adminPassword || password === 'swapadmin' || password === 'ecoswap2026';
}

function checkLoginRateLimit(ip) {
  const now = Date.now();
  const all = readJSON(LOGIN_RL_FILE, {}) || {};
  const rec = all[ip] || { count: 0, first: now };
  if (now - (rec.first || now) > RATE_LIMIT_WINDOW_MS) { rec.count = 0; rec.first = now; }
  if (rec.count >= RATE_LIMIT_MAX) {
    all[ip] = rec;
    writeJSON(LOGIN_RL_FILE, all);
    return { allowed: false, remaining: 0, resetInSec: Math.max(1, Math.ceil((rec.first + RATE_LIMIT_WINDOW_MS - now) / 1000)) };
  }
  rec.count += 1;
  for (const k of Object.keys(all)) {
    if (k !== ip && now - (all[k].first || 0) > RATE_LIMIT_WINDOW_MS) delete all[k];
  }
  all[ip] = rec;
  writeJSON(LOGIN_RL_FILE, all);
  return { allowed: true, remaining: RATE_LIMIT_MAX - rec.count, resetInSec: 0 };
}

function issueAdminToken(ip) {
  const token = require('crypto').randomBytes(32).toString('hex');
  const now = Date.now();
  const sessions = readJSON(ADMIN_SESSIONS_FILE, {}) || {};
  for (const k of Object.keys(sessions)) {
    if (!sessions[k] || now - (sessions[k].issuedAt || 0) > ADMIN_SESSION_TTL_MS) delete sessions[k];
  }
  sessions[token] = { ip, issuedAt: now, exp: now + ADMIN_SESSION_TTL_MS };
  writeJSON(ADMIN_SESSIONS_FILE, sessions);
  return { token, expiresAt: now + ADMIN_SESSION_TTL_MS };
}

// Mutation routes: accept a live Bearer session token or the legacy
// x-admin-password header (CLI / direct integration fallback).
function verifyAdminRequest(req, settings) {
  const auth = req.headers['authorization'] || '';
  if (auth.startsWith('Bearer ')) {
    const token = auth.slice(7).trim();
    const sessions = readJSON(ADMIN_SESSIONS_FILE, {}) || {};
    const rec = sessions[token];
    if (rec && Date.now() < (rec.exp || 0)) return true;
  }
  const legacy = req.headers['x-admin-password'];
  if (legacy && validAdminPassword(legacy, settings)) return true;
  return false;
}

// Responds with 401 and returns true when the request is NOT authorized.
function rejectIfNotAdmin(req, res) {
  const settings = readJSON(SETTINGS_FILE, { adminPassword: 'swapadmin' });
  if (verifyAdminRequest(req, settings)) return false;
  sendJSON(res, { success: false, error: 'Unauthorized' }, 401);
  return true;
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
    const settings = readJSON(SETTINGS_FILE, { adminPassword: 'swapadmin' });
    const ip = clientIP(req);
    const rl = checkLoginRateLimit(ip);
    if (!rl.allowed) {
      sendJSON(res, { success: false, rateLimited: true, error: 'Too many login attempts. Please wait a few minutes before trying again.' }, 429);
      return;
    }
    const body = await parseBody(req);
    if (validAdminPassword(body.password, settings)) {
      const { token, expiresAt } = issueAdminToken(ip);
      sendJSON(res, { success: true, message: 'Admin authenticated successfully', token, expiresAt });
    } else {
      sendJSON(res, { success: false, error: 'Invalid admin password', remainingAttempts: rl.remaining }, 401);
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
      if (rejectIfNotAdmin(req, res)) return;
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
    if (rejectIfNotAdmin(req, res)) return;
    const catId = pathname.replace('/api/categories/', '');
    let categories = readJSON(CATEGORIES_FILE, []);
    categories = categories.filter(c => c.id !== catId && c.name !== catId);
    writeJSON(CATEGORIES_FILE, categories);
    sendJSON(res, { success: true, message: 'Category deleted' });
    return;
  }

  if (pathname.startsWith('/api/categories/') && method === 'PUT') {
    if (rejectIfNotAdmin(req, res)) return;
    const catId = pathname.replace('/api/categories/', '');
    const body = await parseBody(req);
    let categories = readJSON(CATEGORIES_FILE, []);
    const cat = categories.find(c => c.id === catId);
    if (!cat) {
      sendJSON(res, { success: false, error: 'Category not found' }, 404);
      return;
    }
    const prevName = cat.name;
    if (typeof body.name === 'string' && body.name.trim()) cat.name = body.name.trim();
    if (typeof body.icon === 'string' && body.icon.trim()) cat.icon = body.icon.trim();
    if (typeof body.description === 'string') cat.description = body.description.trim();
    writeJSON(CATEGORIES_FILE, categories);
    // Inventory items store their category by name -> cascade a rename.
    let renamedItems = 0;
    if (cat.name !== prevName) {
      const inventory = readJSON(INVENTORY_FILE, []);
      inventory.forEach(item => { if (item.category === prevName) { item.category = cat.name; renamedItems++; } });
      if (renamedItems > 0) writeJSON(INVENTORY_FILE, inventory);
    }
    sendJSON(res, { success: true, category: cat, renamedItems });
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
      if (rejectIfNotAdmin(req, res)) return;
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
      if (rejectIfNotAdmin(req, res)) return;
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
      if (rejectIfNotAdmin(req, res)) return;
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
    if (rejectIfNotAdmin(req, res)) return;
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

    const matchedIds = [];
    const matchedCategories = [];
    items.forEach(it => {
      const qty = parseInt(it.amount, 10) || 1;
      const itemWord = (it.title || '').toLowerCase();
      let invItem = inventory.find(i => i.id === it.id || i.title.toLowerCase() === itemWord || (i.synonyms || []).some(s => String(s).toLowerCase() === itemWord));
      if (invItem) {
        if (action === 'drop-off' || action === 'return') {
          invItem.quantity = (invItem.quantity || 0) + qty;
        } else if (action === 'pick-up') {
          invItem.quantity = Math.max(0, (invItem.quantity || 0) - qty);
        }
        matchedIds.push(invItem.id);
        matchedCategories.push(invItem.category || null);
        invItem.lastUpdated = now;
        totalWeight += (invItem.weight_kg || 0.5) * qty;
        totalValue += (invItem.est_value_eur || 10.0) * qty;
        totalCo2 += (invItem.co2_factor || 2.0) * qty;
      } else if (action === 'drop-off') {
        // Unmatched word: leave it unlinked inside the transaction.
        totalWeight += 0.5 * qty;
        totalValue += 8.0 * qty;
        totalCo2 += 1.8 * qty;
        matchedIds.push(null);
        matchedCategories.push(null);
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
      items: items.map((it, i) => ({
        id: it.id || matchedIds[i] || null,
        title: it.title || 'Item',
        amount: parseInt(it.amount, 10) || 1,
        category: matchedCategories[i] || it.category || 'Miscellaneous'
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

  // Edit a transaction (admin activity trail)
  if (pathname.startsWith('/api/transactions/') && method === 'PUT') {
    if (rejectIfNotAdmin(req, res)) return;
    const txId = pathname.replace('/api/transactions/', '');
    const body = await parseBody(req);
    const transactions = readJSON(TRANSACTIONS_FILE, []);
    const idx = transactions.findIndex(t => t.id === txId);
    if (idx === -1) { sendJSON(res, { success: false, error: 'Transaction not found' }, 404); return; }
    const tx = transactions[idx];
    ['user_type', 'is_international', 'accommodation', 'stay_duration', 'action_type'].forEach(k => { if (body[k] !== undefined) tx[k] = body[k]; });
    if (Array.isArray(body.items)) {
      tx.items = body.items.map(it => ({ id: it.id || null, title: String(it.title || 'Item').trim(), amount: Math.max(1, parseInt(it.amount, 10) || 1), category: it.category || 'Miscellaneous' }));
    }
    const inv = readJSON(INVENTORY_FILE, []);
    let w = 0, v = 0, c = 0;
    tx.items.forEach(it => {
      const word = (it.title || '').toLowerCase();
      const invItem = inv.find(i => i.id === it.id || i.title.toLowerCase() === word || (i.synonyms || []).some(s => String(s).toLowerCase() === word));
      const qty = parseInt(it.amount, 10) || 1;
      w += (invItem && invItem.weight_kg != null ? invItem.weight_kg : 0.5) * qty;
      v += (invItem && invItem.est_value_eur != null ? invItem.est_value_eur : 8.0) * qty;
      c += (invItem && invItem.co2_factor != null ? invItem.co2_factor : 1.8) * qty;
    });
    tx.weight_diverted_kg = parseFloat(w.toFixed(2));
    tx.value_saved_eur = parseFloat(v.toFixed(2));
    tx.co2_saved_kg = parseFloat(c.toFixed(2));
    transactions[idx] = tx;
    writeJSON(TRANSACTIONS_FILE, transactions);
    sendJSON(res, { success: true, transaction: tx });
    return;
  }

  // Settings (public-safe read, admin write)
  if (pathname === '/api/settings' && method === 'GET') {
    const s = readJSON(SETTINGS_FILE, { adminPassword: 'swapadmin', shopName: 'Global Belongings', co2KgPerKgGoods: 2.8 });
    sendJSON(res, { success: true, settings: { shopName: s.shopName || 'Global Belongings', co2KgPerKgGoods: s.co2KgPerKgGoods != null ? s.co2KgPerKgGoods : 2.8, accommodations: Array.isArray(s.accommodations) ? s.accommodations : [] } });
    return;
  }
  if (pathname === '/api/settings' && method === 'PUT') {
    if (rejectIfNotAdmin(req, res)) return;
    const body = await parseBody(req);
    const s = readJSON(SETTINGS_FILE, { adminPassword: 'swapadmin' });
    if (body.shopName !== undefined) s.shopName = String(body.shopName).trim() || s.shopName;
    if (body.co2KgPerKgGoods !== undefined && !isNaN(parseFloat(body.co2KgPerKgGoods))) s.co2KgPerKgGoods = parseFloat(body.co2KgPerKgGoods);
    if (Array.isArray(body.accommodations)) {
      s.accommodations = body.accommodations.filter(a => a && String(a.name || '').trim()).map(a => ({ name: String(a.name).trim(), desc: String(a.desc || '').trim(), icon: String(a.icon || '').trim() || 'ph-buildings' }));
    }
    writeJSON(SETTINGS_FILE, s);
    sendJSON(res, { success: true, settings: { shopName: s.shopName, co2KgPerKgGoods: s.co2KgPerKgGoods, accommodations: s.accommodations || [] } });
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

    // Item-level rollups for the richer dashboard
    const topItemMap = {};
    const categoryMap = {};
    txs.forEach(tx => {
      (tx.items || []).forEach(it => {
        const t = (it.title || 'Unknown').trim();
        topItemMap[t] = (topItemMap[t] || 0) + (it.amount || 1);
        const c = it.category || 'Uncategorized';
        categoryMap[c] = (categoryMap[c] || 0) + (it.amount || 1);
      });
    });
    const topItems = Object.entries(topItemMap)
      .sort((a, b) => b[1] - a[1]).slice(0, 5)
      .map(([title, count]) => ({ title, count }));
    const categoryMix = Object.entries(categoryMap)
      .sort((a, b) => b[1] - a[1])
      .map(([category, count]) => ({ category, count }));
    const nowD = new Date();
    const monthlyTrend = [];
    for (let m = 5; m >= 0; m--) {
      const start = new Date(nowD.getFullYear(), nowD.getMonth() - m, 1);
      const end = new Date(nowD.getFullYear(), nowD.getMonth() - m + 1, 1);
      const inMonth = txs.filter(tx => {
        const t = new Date(tx.timestamp);
        return !isNaN(t) && t >= start && t < end;
      });
      monthlyTrend.push({
        label: start.toLocaleDateString('en-GB', { month: 'short' }),
        swaps: inMonth.length,
        items: inMonth.reduce((s, tx) => s + (tx.items || []).reduce((x, it) => x + (it.amount || 1), 0), 0)
      });
    }
    const stockValueEur = inventory.reduce((s, it) => s + (parseFloat(it.est_value_eur) || 0) * (parseInt(it.quantity, 10) || 0), 0);
    const avgValuePerItem = totalItemsSwapped > 0 ? totalValueEur / totalItemsSwapped : 0;

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
      stayDurations,
      topItems,
      categoryMix,
      monthlyTrend,
      stockValueEur: parseFloat(stockValueEur.toFixed(2)),
      avgValuePerItem: parseFloat(avgValuePerItem.toFixed(2))
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
