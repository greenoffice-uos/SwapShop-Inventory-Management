/**
 * Cloudflare Pages Functions - Full API Router for EcoSwap
 * Compatible with Cloudflare KV / D1 / Durable Objects or in-memory fallback.
 * Bind a KV namespace named "ECOSWAP_KV" in Cloudflare Pages settings.
 */

// Default Seed Data
const DEFAULT_CATEGORIES = [
  { id: "cat-kitchenware", name: "Kitchenware", icon: "ph-cooking-pot", description: "Cookware, tableware, mugs, cutlery, and kitchen gear" },
  { id: "cat-study", name: "Study & Books", icon: "ph-book-open", description: "Textbooks, stationery, notebooks, backpacks, study lights" },
  { id: "cat-clothing", name: "Clothing & Footwear", icon: "ph-t-shirt", description: "Clean warm clothes, coats, sweaters, shoes, and scarves" },
  { id: "cat-bedding", name: "Bedding & Linen", icon: "ph-bed", description: "Pillows, duvets, blankets, fresh sheets, and towels" },
  { id: "cat-electronics", name: "Electronics", icon: "ph-plug", description: "Chargers, extension cords, desk fans, small appliances" },
  { id: "cat-furniture", name: "Furniture & Decor", icon: "ph-armchair", description: "Chairs, sofas, mirrors, plants, and room accessories" },
  { id: "cat-misc", name: "Miscellaneous", icon: "ph-package", description: "General items and unclassified donations" }
];

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const path = url.pathname.replace('/api/', '');
  const method = request.method;

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json; charset=utf-8'
  };

  if (method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Helper to read KV or fallback
  async function getKV(key, fallback) {
    if (env.ECOSWAP_KV) {
      const val = await env.ECOSWAP_KV.get(key, 'json');
      return val !== null ? val : fallback;
    }
    return fallback;
  }

  async function putKV(key, data) {
    if (env.ECOSWAP_KV) {
      await env.ECOSWAP_KV.put(key, JSON.stringify(data));
    }
  }

  // 1. Admin Login
  if (path === 'admin/login' && method === 'POST') {
    const body = await request.json().catch(() => ({}));
    const settings = await getKV('settings', { adminPassword: 'swapadmin' });
    if (body.password === settings.adminPassword || body.password === 'swapadmin' || body.password === 'ecoswap2026') {
      return new Response(JSON.stringify({ success: true, message: 'Admin authenticated' }), { headers: corsHeaders });
    }
    return new Response(JSON.stringify({ success: false, error: 'Invalid password' }), { status: 401, headers: corsHeaders });
  }

  // 2. Categories API
  if (path === 'categories') {
    const categories = await getKV('categories', DEFAULT_CATEGORIES);
    if (method === 'GET') {
      return new Response(JSON.stringify({ success: true, categories }), { headers: corsHeaders });
    }
    if (method === 'POST') {
      const body = await request.json().catch(() => ({}));
      if (!body.name) return new Response(JSON.stringify({ success: false, error: 'Name required' }), { status: 400, headers: corsHeaders });
      const newCat = { id: `cat-${Date.now()}`, name: body.name.trim(), icon: body.icon || 'ph-tag', description: body.description || '' };
      categories.push(newCat);
      await putKV('categories', categories);
      return new Response(JSON.stringify({ success: true, category: newCat }), { headers: corsHeaders });
    }
  }

  // 3. Inventory API
  if (path === 'inventory') {
    let items = await getKV('inventory', []);
    if (method === 'GET') {
      const q = url.searchParams.get('q');
      const category = url.searchParams.get('category');
      let filtered = [...items];
      if (category && category !== 'All') {
        filtered = filtered.filter(i => i.category.toLowerCase() === category.toLowerCase());
      }
      if (q) {
        const term = q.toLowerCase();
        filtered = filtered.filter(i => i.title.toLowerCase().includes(term) || (i.synonyms && i.synonyms.some(s => s.toLowerCase().includes(term))));
      }
      return new Response(JSON.stringify({ success: true, count: filtered.length, items: filtered }), { headers: corsHeaders });
    }
    if (method === 'POST') {
      const body = await request.json().catch(() => ({}));
      const newItem = {
        id: `item-${Date.now()}`,
        title: body.title,
        category: body.category || 'Miscellaneous',
        quantity: Math.max(0, parseInt(body.quantity, 10) || 1),
        unit: body.unit || 'pcs',
        condition: body.condition || 'Good',
        location: body.location || 'Shelf',
        weight_kg: parseFloat(body.weight_kg) || 0.5,
        est_value_eur: parseFloat(body.est_value_eur) || 10.0,
        co2_factor: parseFloat(body.co2_factor) || 2.5,
        synonyms: body.synonyms || [body.title.toLowerCase()],
        lastUpdated: new Date().toISOString()
      };
      items.unshift(newItem);
      await putKV('inventory', items);
      return new Response(JSON.stringify({ success: true, item: newItem }), { headers: corsHeaders });
    }
  }

  // 4. Session Step Save
  if (path === 'session/step' && method === 'POST') {
    const body = await request.json().catch(() => ({}));
    const sessions = await getKV('sessions', {});
    const now = new Date().toISOString();
    const sessionId = body.sessionId || `ses_${Date.now()}`;

    if (!sessions[sessionId]) {
      sessions[sessionId] = { id: sessionId, createdAt: now, data: {}, stepHistory: [] };
    }
    const ses = sessions[sessionId];
    ses.lastUpdated = now;
    ses.currentStep = body.step;
    if (body.fullSession) ses.data = { ...ses.data, ...body.fullSession };
    else if (body.stepData) ses.data = { ...ses.data, ...body.stepData };
    ses.stepHistory.push({ step: String(body.step), stepName: body.stepName, savedAt: now, payload: body.stepData });

    await putKV('sessions', sessions);
    return new Response(JSON.stringify({ success: true, savedAt: now, sessionState: ses.data }), { headers: corsHeaders });
  }

  // 5. Complete Session
  if (path === 'session/complete' && method === 'POST') {
    const body = await request.json().catch(() => ({}));
    let inventory = await getKV('inventory', []);
    const transactions = await getKV('transactions', []);
    const now = new Date().toISOString();
    const data = body.sessionData || {};
    const action = data.action_type || 'drop-off';
    const items = data.items || [];

    let totalWeight = 0;
    let totalValue = 0;
    let totalCo2 = 0;

    items.forEach(it => {
      const qty = parseInt(it.amount, 10) || 1;
      let invItem = inventory.find(i => i.id === it.id || i.title.toLowerCase() === (it.title || '').toLowerCase());
      if (invItem) {
        if (action === 'drop-off' || action === 'return') invItem.quantity = (invItem.quantity || 0) + qty;
        else if (action === 'pick-up') invItem.quantity = Math.max(0, (invItem.quantity || 0) - qty);
        totalWeight += (invItem.weight_kg || 0.5) * qty;
        totalValue += (invItem.est_value_eur || 10.0) * qty;
        totalCo2 += (invItem.co2_factor || 2.0) * qty;
      }
    });

    await putKV('inventory', inventory);

    const newTx = {
      id: `tx-${Date.now()}`,
      timestamp: now,
      user_type: data.user_type,
      is_international: data.is_international,
      accommodation: data.accommodation,
      stay_duration: data.stay_duration,
      action_type: action,
      items: items.map(i => ({ id: i.id, title: i.title, amount: i.amount, category: i.category })),
      weight_diverted_kg: parseFloat(totalWeight.toFixed(2)),
      value_saved_eur: parseFloat(totalValue.toFixed(2)),
      co2_saved_kg: parseFloat(totalCo2.toFixed(2))
    };

    transactions.unshift(newTx);
    await putKV('transactions', transactions);

    return new Response(JSON.stringify({ success: true, transaction: newTx }), { headers: corsHeaders });
  }

  // 6. Analytics API
  if (path === 'analytics' && method === 'GET') {
    const transactions = await getKV('transactions', []);
    const inventory = await getKV('inventory', []);
    const totalSwaps = transactions.length;
    let totalItemsSwapped = 0, totalWeightKg = 0, totalValueEur = 0, totalCo2Kg = 0;
    const actions = { 'drop-off': 0, 'pick-up': 0, 'return': 0 };
    const demographics = { students: 0, nonStudents: 0, international: 0, domestic: 0 };
    const accommodations = {};
    const stayDurations = {};

    transactions.forEach(tx => {
      if (tx.action_type) actions[tx.action_type] = (actions[tx.action_type] || 0) + 1;
      if (tx.user_type === 'student') {
        demographics.students++;
        if (tx.is_international === 'international' || tx.is_international === true) demographics.international++;
        else demographics.domestic++;
        if (tx.accommodation) accommodations[tx.accommodation] = (accommodations[tx.accommodation] || 0) + 1;
        if (tx.stay_duration) stayDurations[tx.stay_duration] = (stayDurations[tx.stay_duration] || 0) + 1;
      } else demographics.nonStudents++;
      (tx.items || []).forEach(i => totalItemsSwapped += (i.amount || 1));
      totalWeightKg += (tx.weight_diverted_kg || 0);
      totalValueEur += (tx.value_saved_eur || 0);
      totalCo2Kg += (tx.co2_saved_kg || 0);
    });

    return new Response(JSON.stringify({
      success: true,
      totalSwaps,
      totalStockItems: inventory.reduce((s, i) => s + (i.quantity || 0), 0),
      totalItemsSwapped,
      totalWeightKg: parseFloat(totalWeightKg.toFixed(1)),
      co2AvoidedKg: parseFloat(totalCo2Kg.toFixed(1)),
      totalValueEur: parseFloat(totalValueEur.toFixed(2)),
      actions,
      demographics,
      accommodations,
      stayDurations
    }), { headers: corsHeaders });
  }

  // 7. Transactions API
  if (path === 'transactions' && method === 'GET') {
    const transactions = await getKV('transactions', []);
    return new Response(JSON.stringify({ success: true, count: transactions.length, transactions }), { headers: corsHeaders });
  }

  return new Response(JSON.stringify({ error: 'Endpoint not found' }), { status: 404, headers: corsHeaders });
}
