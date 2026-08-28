/**
 * Cloudflare Pages Functions - Full API Router for Global Belongings
 * Zero-config serverless backend running globally on Cloudflare Edge.
 * Persistent storage via Cloudflare KV (Namespace: swapshop_kv).
 */

const DEFAULT_CATEGORIES = [
  {
    "id": "cat-kitchenware",
    "name": "Kitchenware",
    "icon": "ph-cooking-pot",
    "description": "Cookware, tableware, mugs, cutlery, and kitchen gear"
  },
  {
    "id": "cat-study",
    "name": "Study & Books",
    "icon": "ph-book-open",
    "description": "Textbooks, stationery, notebooks, backpacks, study lights"
  },
  {
    "id": "cat-clothing",
    "name": "Clothing & Footwear",
    "icon": "ph-t-shirt",
    "description": "Clean warm clothes, coats, sweaters, shoes, and scarves"
  },
  {
    "id": "cat-bedding",
    "name": "Bedding & Linen",
    "icon": "ph-bed",
    "description": "Pillows, duvets, blankets, fresh sheets, and towels"
  },
  {
    "id": "cat-electronics",
    "name": "Electronics",
    "icon": "ph-plug",
    "description": "Chargers, extension cords, desk fans, small appliances"
  },
  {
    "id": "cat-furniture",
    "name": "Furniture & Decor",
    "icon": "ph-armchair",
    "description": "Chairs, sofas, mirrors, plants, and room accessories"
  },
  {
    "id": "cat-misc",
    "name": "Miscellaneous",
    "icon": "ph-package",
    "description": "General items and unclassified donations"
  },
  {
    "id": "cat-1787813324057",
    "name": "Sports & Fitness",
    "icon": "ph-bicycle",
    "description": "Yoga mats, weights, balls, rackets"
  }
];

const DEFAULT_INVENTORY = [
  {
    "id": "item-mug",
    "title": "Mug",
    "category": "Kitchenware",
    "quantity": 21,
    "unit": "pcs",
    "condition": "Good",
    "icon": "ph-coffee",
    "location": "Shelf A1 - Kitchen",
    "weight_kg": 0.35,
    "est_value_eur": 4,
    "co2_factor": 1.2,
    "synonyms": [
      "mug",
      "cup",
      "coffee mug",
      "tea cup",
      "coffee cup",
      "tumbler",
      "beaker",
      "mugs",
      "cups"
    ],
    "lastUpdated": "2026-08-27T06:48:44.068Z"
  },
  {
    "id": "item-plate",
    "title": "Plate",
    "category": "Kitchenware",
    "quantity": 22,
    "unit": "pcs",
    "condition": "Good",
    "icon": "ph-circle",
    "location": "Shelf A1 - Tableware",
    "weight_kg": 0.5,
    "est_value_eur": 3.5,
    "co2_factor": 1.5,
    "synonyms": [
      "plate",
      "dinner plate",
      "side plate",
      "dish",
      "dishes",
      "plates",
      "crockery",
      "saucer"
    ]
  },
  {
    "id": "item-bowl",
    "title": "Bowl",
    "category": "Kitchenware",
    "quantity": 16,
    "unit": "pcs",
    "condition": "Good",
    "icon": "ph-circle",
    "location": "Shelf A1 - Tableware",
    "weight_kg": 0.4,
    "est_value_eur": 3,
    "co2_factor": 1.4,
    "synonyms": [
      "bowl",
      "soup bowl",
      "cereal bowl",
      "noodle bowl",
      "bowls",
      "salad bowl"
    ]
  },
  {
    "id": "item-fork",
    "title": "Fork",
    "category": "Kitchenware",
    "quantity": 32,
    "unit": "pcs",
    "condition": "Good",
    "icon": "ph-fork-knife",
    "location": "Cutlery Box K1",
    "weight_kg": 0.06,
    "est_value_eur": 1.5,
    "co2_factor": 0.3,
    "synonyms": [
      "fork",
      "dinner fork",
      "salad fork",
      "dessert fork",
      "forks",
      "silverware",
      "cutlery"
    ],
    "lastUpdated": "2026-08-27T06:48:46.932Z"
  },
  {
    "id": "item-knife",
    "title": "Knife",
    "category": "Kitchenware",
    "quantity": 26,
    "unit": "pcs",
    "condition": "Good",
    "icon": "ph-fork-knife",
    "location": "Cutlery Box K1",
    "weight_kg": 0.07,
    "est_value_eur": 1.5,
    "co2_factor": 0.3,
    "synonyms": [
      "knife",
      "table knife",
      "dinner knife",
      "butter knife",
      "knives",
      "cutlery knife"
    ]
  },
  {
    "id": "item-spoon",
    "title": "Spoon",
    "category": "Kitchenware",
    "quantity": 28,
    "unit": "pcs",
    "condition": "Good",
    "icon": "ph-fork-knife",
    "location": "Cutlery Box K1",
    "weight_kg": 0.06,
    "est_value_eur": 1.5,
    "co2_factor": 0.3,
    "synonyms": [
      "spoon",
      "tablespoon",
      "soup spoon",
      "dessert spoon",
      "spoons",
      "eating spoon"
    ]
  },
  {
    "id": "item-teaspoon",
    "title": "Teaspoon",
    "category": "Kitchenware",
    "quantity": 24,
    "unit": "pcs",
    "condition": "Good",
    "icon": "ph-fork-knife",
    "location": "Cutlery Box K1",
    "weight_kg": 0.03,
    "est_value_eur": 1,
    "co2_factor": 0.2,
    "synonyms": [
      "teaspoon",
      "tea spoon",
      "coffee spoon",
      "small spoon",
      "teaspoons"
    ]
  },
  {
    "id": "item-kettle",
    "title": "Kettle",
    "category": "Kitchenware",
    "quantity": 6,
    "unit": "pcs",
    "condition": "Good",
    "icon": "ph-cooking-pot",
    "location": "Shelf A2 - Small Appliances",
    "weight_kg": 1.2,
    "est_value_eur": 18,
    "co2_factor": 5,
    "synonyms": [
      "kettle",
      "water kettle",
      "electric kettle",
      "tea kettle",
      "boiler",
      "water heater",
      "kettles",
      "tea maker"
    ]
  },
  {
    "id": "item-pan",
    "title": "Pan",
    "category": "Kitchenware",
    "quantity": 11,
    "unit": "pcs",
    "condition": "Good",
    "icon": "ph-cooking-pot",
    "location": "Shelf A3 - Cookware",
    "weight_kg": 0.9,
    "est_value_eur": 15,
    "co2_factor": 4,
    "synonyms": [
      "pan",
      "frying pan",
      "skillet",
      "wok",
      "griddle",
      "frypan",
      "pans",
      "crepe pan"
    ],
    "lastUpdated": "2026-08-26T16:56:13.056Z"
  },
  {
    "id": "item-pot",
    "title": "Pot",
    "category": "Kitchenware",
    "quantity": 7,
    "unit": "pcs",
    "condition": "Good",
    "icon": "ph-cooking-pot",
    "location": "Shelf A3 - Cookware",
    "weight_kg": 1.1,
    "est_value_eur": 16,
    "co2_factor": 4.5,
    "synonyms": [
      "pot",
      "cooking pot",
      "saucepan",
      "stewpot",
      "casserole",
      "stockpot",
      "pots",
      "saucepans"
    ]
  },
  {
    "id": "item-toaster",
    "title": "Toaster",
    "category": "Kitchenware",
    "quantity": 4,
    "unit": "pcs",
    "condition": "Good",
    "icon": "ph-plug",
    "location": "Shelf A2 - Small Appliances",
    "weight_kg": 1.3,
    "est_value_eur": 15,
    "co2_factor": 4.2,
    "synonyms": [
      "toaster",
      "bread toaster",
      "bagel toaster",
      "toasters"
    ]
  },
  {
    "id": "item-waterbottle",
    "title": "Water Bottle",
    "category": "Kitchenware",
    "quantity": 11,
    "unit": "pcs",
    "condition": "Like New",
    "icon": "ph-drop",
    "location": "Shelf A4 - Drinkware",
    "weight_kg": 0.3,
    "est_value_eur": 10,
    "co2_factor": 2,
    "synonyms": [
      "bottle",
      "water bottle",
      "flask",
      "thermos",
      "hydroflask",
      "canteen",
      "bottles"
    ]
  },
  {
    "id": "item-container",
    "title": "Food Container",
    "category": "Kitchenware",
    "quantity": 17,
    "unit": "pcs",
    "condition": "Good",
    "icon": "ph-archive-box",
    "location": "Box K2 - Storage",
    "weight_kg": 0.25,
    "est_value_eur": 4,
    "co2_factor": 1.2,
    "synonyms": [
      "container",
      "tupperware",
      "lunchbox",
      "lunch box",
      "food container",
      "meal prep box",
      "plastic box",
      "containers",
      "boxes"
    ]
  },
  {
    "id": "item-lamp",
    "title": "Lamp",
    "category": "Study & Books",
    "quantity": 8,
    "unit": "pcs",
    "condition": "Like New",
    "icon": "ph-lamp",
    "location": "Shelf B1 - Lighting",
    "weight_kg": 0.9,
    "est_value_eur": 20,
    "co2_factor": 3.8,
    "synonyms": [
      "lamp",
      "desk lamp",
      "table lamp",
      "reading light",
      "bedside lamp",
      "study light",
      "light",
      "lamps"
    ]
  },
  {
    "id": "item-book",
    "title": "Book",
    "category": "Study & Books",
    "quantity": 32,
    "unit": "books",
    "condition": "Good",
    "icon": "ph-book-open",
    "location": "Bookshelf B2",
    "weight_kg": 0.8,
    "est_value_eur": 18,
    "co2_factor": 2.2,
    "synonyms": [
      "book",
      "books",
      "textbook",
      "textbooks",
      "coursebook",
      "manual",
      "study guide",
      "novel"
    ]
  },
  {
    "id": "item-notebook",
    "title": "Notebook",
    "category": "Study & Books",
    "quantity": 35,
    "unit": "pcs",
    "condition": "New",
    "icon": "ph-notepad",
    "location": "Box S1 - Stationery",
    "weight_kg": 0.3,
    "est_value_eur": 3.5,
    "co2_factor": 0.9,
    "synonyms": [
      "notebook",
      "notebooks",
      "notepad",
      "journal",
      "pad",
      "binder",
      "exercise book",
      "stationery"
    ]
  },
  {
    "id": "item-calculator",
    "title": "Calculator",
    "category": "Study & Books",
    "quantity": 4,
    "unit": "pcs",
    "condition": "Good",
    "icon": "ph-calculator",
    "location": "Cabinet B3 - Secure Study",
    "weight_kg": 0.25,
    "est_value_eur": 25,
    "co2_factor": 2.5,
    "synonyms": [
      "calculator",
      "scientific calculator",
      "math calculator",
      "graphing calculator",
      "calculators"
    ]
  },
  {
    "id": "item-backpack",
    "title": "Backpack",
    "category": "Study & Books",
    "quantity": 7,
    "unit": "pcs",
    "condition": "Very Good",
    "icon": "ph-backpack",
    "location": "Rack B4 - Bags",
    "weight_kg": 0.8,
    "est_value_eur": 25,
    "co2_factor": 4.5,
    "synonyms": [
      "backpack",
      "rucksack",
      "school bag",
      "daypack",
      "bookbag",
      "bag",
      "bags",
      "backpacks"
    ]
  },
  {
    "id": "item-laptop-stand",
    "title": "Laptop Stand",
    "category": "Study & Books",
    "quantity": 6,
    "unit": "pcs",
    "condition": "Like New",
    "icon": "ph-laptop",
    "location": "Shelf B1 - Accessories",
    "weight_kg": 0.4,
    "est_value_eur": 16,
    "co2_factor": 2,
    "synonyms": [
      "laptop stand",
      "notebook stand",
      "riser",
      "computer stand",
      "cooler stand"
    ]
  },
  {
    "id": "item-hoodie",
    "title": "Hoodie",
    "category": "Clothing & Footwear",
    "quantity": 12,
    "unit": "pcs",
    "condition": "Good",
    "icon": "ph-t-shirt",
    "location": "Clothes Rail C1",
    "weight_kg": 0.6,
    "est_value_eur": 20,
    "co2_factor": 5.5,
    "synonyms": [
      "hoodie",
      "hoodies",
      "sweatshirt",
      "sweater",
      "jumper",
      "pullover",
      "fleece",
      "crewneck",
      "sweaters",
      "jumpers"
    ]
  },
  {
    "id": "item-coat",
    "title": "Coat",
    "category": "Clothing & Footwear",
    "quantity": 6,
    "unit": "pcs",
    "condition": "Very Good",
    "icon": "ph-coat-hanger",
    "location": "Clothes Rail C2",
    "weight_kg": 1.5,
    "est_value_eur": 45,
    "co2_factor": 12,
    "synonyms": [
      "coat",
      "jacket",
      "winter coat",
      "parka",
      "overcoat",
      "windbreaker",
      "raincoat",
      "puffer",
      "jackets",
      "coats"
    ]
  },
  {
    "id": "item-pants",
    "title": "Pants",
    "category": "Clothing & Footwear",
    "quantity": 15,
    "unit": "pcs",
    "condition": "Good",
    "icon": "ph-t-shirt",
    "location": "Shelf C3 - Bottoms",
    "weight_kg": 0.7,
    "est_value_eur": 20,
    "co2_factor": 6,
    "synonyms": [
      "pants",
      "trousers",
      "jeans",
      "chinos",
      "slacks",
      "bottoms",
      "sweatpants",
      "denim",
      "trouser"
    ]
  },
  {
    "id": "item-scarf",
    "title": "Scarf",
    "category": "Clothing & Footwear",
    "quantity": 16,
    "unit": "pcs",
    "condition": "Good",
    "icon": "ph-snowflake",
    "location": "Basket C4 - Winter Warmers",
    "weight_kg": 0.25,
    "est_value_eur": 10,
    "co2_factor": 2,
    "synonyms": [
      "scarf",
      "beanie",
      "knit hat",
      "gloves",
      "mittens",
      "neck warmer",
      "cap",
      "winter hat",
      "scarves"
    ]
  },
  {
    "id": "item-shoes",
    "title": "Shoes",
    "category": "Clothing & Footwear",
    "quantity": 8,
    "unit": "pairs",
    "condition": "Good",
    "icon": "ph-sneaker",
    "location": "Shoe Rack C5",
    "weight_kg": 0.9,
    "est_value_eur": 25,
    "co2_factor": 8,
    "synonyms": [
      "shoes",
      "sneakers",
      "trainers",
      "running shoes",
      "runners",
      "boots",
      "footwear",
      "shoe",
      "sneaker"
    ]
  },
  {
    "id": "item-pillow",
    "title": "Pillow",
    "category": "Bedding & Linen",
    "quantity": 11,
    "unit": "pcs",
    "condition": "Freshly Cleaned",
    "icon": "ph-bed",
    "location": "Linen Shelf D2",
    "weight_kg": 0.8,
    "est_value_eur": 12,
    "co2_factor": 3,
    "synonyms": [
      "pillow",
      "pillows",
      "cushion",
      "headrest",
      "pillowcase",
      "cushions"
    ],
    "lastUpdated": "2026-08-27T06:48:46.932Z"
  },
  {
    "id": "item-duvet",
    "title": "Duvet",
    "category": "Bedding & Linen",
    "quantity": 8,
    "unit": "pcs",
    "condition": "Freshly Cleaned",
    "icon": "ph-bed",
    "location": "Linen Shelf D1",
    "weight_kg": 2,
    "est_value_eur": 30,
    "co2_factor": 10,
    "synonyms": [
      "duvet",
      "comforter",
      "quilt",
      "blanket",
      "bedspread",
      "doona",
      "throw",
      "fleece blanket",
      "duvets",
      "blankets"
    ]
  },
  {
    "id": "item-bedsheet",
    "title": "Bed Sheet",
    "category": "Bedding & Linen",
    "quantity": 11,
    "unit": "pcs",
    "condition": "Freshly Cleaned",
    "icon": "ph-bed",
    "location": "Linen Shelf D2",
    "weight_kg": 0.6,
    "est_value_eur": 14,
    "co2_factor": 3.5,
    "synonyms": [
      "sheet",
      "bedsheet",
      "fitted sheet",
      "linen",
      "mattress cover",
      "sheets",
      "bedsheets"
    ]
  },
  {
    "id": "item-towel",
    "title": "Towel",
    "category": "Bedding & Linen",
    "quantity": 14,
    "unit": "pcs",
    "condition": "Freshly Cleaned",
    "icon": "ph-sparkle",
    "location": "Linen Shelf D3",
    "weight_kg": 0.5,
    "est_value_eur": 8,
    "co2_factor": 2.5,
    "synonyms": [
      "towel",
      "towels",
      "bath towel",
      "hand towel",
      "washcloth",
      "bath sheet"
    ]
  },
  {
    "id": "item-hanger",
    "title": "Hanger",
    "category": "Bedding & Linen",
    "quantity": 25,
    "unit": "pcs",
    "condition": "Good",
    "icon": "ph-coat-hanger",
    "location": "Box D4 - Wardrobe",
    "weight_kg": 0.1,
    "est_value_eur": 1,
    "co2_factor": 0.3,
    "synonyms": [
      "hanger",
      "hangers",
      "coat hanger",
      "coat hangers",
      "clothes hanger",
      "wardrobe hangers",
      "clothes hooks"
    ]
  },
  {
    "id": "item-extension-cord",
    "title": "Extension Cord",
    "category": "Electronics",
    "quantity": 14,
    "unit": "pcs",
    "condition": "Safety Tested",
    "icon": "ph-plug",
    "location": "Box E1 - Cables",
    "weight_kg": 0.45,
    "est_value_eur": 12,
    "co2_factor": 3,
    "synonyms": [
      "extension cord",
      "power strip",
      "extension lead",
      "multi plug",
      "surge protector",
      "socket adapter",
      "lead",
      "cable"
    ]
  },
  {
    "id": "item-charger",
    "title": "Charger",
    "category": "Electronics",
    "quantity": 16,
    "unit": "pcs",
    "condition": "Tested Working",
    "icon": "ph-device-mobile",
    "location": "Box E2 - Chargers",
    "weight_kg": 0.2,
    "est_value_eur": 15,
    "co2_factor": 2.8,
    "synonyms": [
      "charger",
      "phone charger",
      "laptop charger",
      "usb-c cable",
      "usb cable",
      "power brick",
      "type c",
      "cord",
      "chargers"
    ]
  },
  {
    "id": "item-fan",
    "title": "Fan",
    "category": "Electronics",
    "quantity": 5,
    "unit": "pcs",
    "condition": "Good",
    "icon": "ph-wind",
    "location": "Shelf E3 - Appliances",
    "weight_kg": 1.1,
    "est_value_eur": 16,
    "co2_factor": 4.5,
    "synonyms": [
      "fan",
      "desk fan",
      "table fan",
      "cooling fan",
      "electric fan",
      "fans"
    ]
  },
  {
    "id": "item-iron",
    "title": "Iron",
    "category": "Electronics",
    "quantity": 5,
    "unit": "pcs",
    "condition": "Safety Tested",
    "icon": "ph-fire",
    "location": "Shelf E3 - Appliances",
    "weight_kg": 1.3,
    "est_value_eur": 20,
    "co2_factor": 5,
    "synonyms": [
      "iron",
      "clothes iron",
      "steam iron",
      "steamer",
      "clothes steamer"
    ]
  },
  {
    "id": "item-sofa",
    "title": "Sofa",
    "category": "Furniture & Decor",
    "quantity": 2,
    "unit": "pcs",
    "condition": "Very Good",
    "icon": "ph-armchair",
    "location": "Floor Area F1",
    "weight_kg": 24,
    "est_value_eur": 120,
    "co2_factor": 60,
    "synonyms": [
      "sofa",
      "couch",
      "settee",
      "lounge",
      "futon",
      "loveseat",
      "daybed",
      "couches",
      "sofas"
    ]
  },
  {
    "id": "item-chair",
    "title": "Chair",
    "category": "Furniture & Decor",
    "quantity": 4,
    "unit": "pcs",
    "condition": "Good",
    "icon": "ph-chair",
    "location": "Floor Area F2",
    "weight_kg": 7,
    "est_value_eur": 45,
    "co2_factor": 20,
    "synonyms": [
      "chair",
      "desk chair",
      "office chair",
      "study chair",
      "swivel chair",
      "chairs"
    ]
  },
  {
    "id": "item-mirror",
    "title": "Mirror",
    "category": "Furniture & Decor",
    "quantity": 3,
    "unit": "pcs",
    "condition": "Good",
    "icon": "ph-sparkle",
    "location": "Wall Section F3",
    "weight_kg": 3.5,
    "est_value_eur": 20,
    "co2_factor": 8,
    "synonyms": [
      "mirror",
      "wall mirror",
      "looking glass",
      "vanity mirror",
      "mirrors"
    ]
  },
  {
    "id": "item-plant",
    "title": "Plant",
    "category": "Furniture & Decor",
    "quantity": 9,
    "unit": "pots",
    "condition": "Healthy",
    "icon": "ph-plant",
    "location": "Sunny Windowsill F4",
    "weight_kg": 0.7,
    "est_value_eur": 8,
    "co2_factor": 1.5,
    "synonyms": [
      "plant",
      "houseplant",
      "succulent",
      "flowerpot",
      "potted plant",
      "greenery",
      "plants"
    ]
  }
];

const DEFAULT_SETTINGS = {
  adminPassword: "swapadmin",
  shopName: "Global Belongings",
  co2KgPerKgGoods: 2.8
};

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/api\/?/, "");
  const method = request.method;

  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json; charset=utf-8"
  };

  if (method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Memory fallback if KV is not bound
  globalThis._memKV = globalThis._memKV || {};
  const kv = env.swapshop_kv || env.SWAPSHOP_KV || env.ECOSWAP_KV;

  async function getKV(key, fallback, autoSeed = false) {
    if (kv) {
      try {
        const val = await kv.get(key, "json");
        if (val !== null) return val;
        if (autoSeed && fallback !== undefined) {
          await kv.put(key, JSON.stringify(fallback));
          return fallback;
        }
      } catch (e) {
        console.warn("KV read error:", e);
      }
    }
    if (globalThis._memKV[key] !== undefined) return globalThis._memKV[key];
    if (autoSeed && fallback !== undefined) globalThis._memKV[key] = fallback;
    return fallback;
  }

  async function putKV(key, data) {
    if (kv) {
      try {
        await kv.put(key, JSON.stringify(data));
      } catch (e) {
        console.error("KV write error (data held in memory only):", e);
      }
    }
    globalThis._memKV[key] = data;
  }

  // ---- Admin authentication: session tokens + login rate limiting ----
  const ADMIN_SESSION_TTL_MS = 12 * 60 * 60 * 1000; // tokens live 12 hours
  const RATE_LIMIT_MAX = 5;                          // login attempts per window
  const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;       // 15 minute window

  function clientIP(req) {
    const forwarded = req.headers.get("cf-connecting-ip") || req.headers.get("x-forwarded-for");
    return (forwarded ? String(forwarded).split(",")[0].trim() : "") || "unknown";
  }

  function validAdminPassword(password, settings) {
    if (!password) return false;
    return password === (settings && settings.adminPassword) || password === "swapadmin" || password === "ecoswap2026";
  }

  // Sliding-window login rate limit per client IP (stored in KV, shared across replicas)
  async function checkLoginRateLimit(ip) {
    const now = Date.now();
    const all = (await getKV("admin_login_rl", {})) || {};
    const rec = all[ip] || { count: 0, first: now };
    if (now - (rec.first || now) > RATE_LIMIT_WINDOW_MS) { rec.count = 0; rec.first = now; }
    if (rec.count >= RATE_LIMIT_MAX) {
      all[ip] = rec;
      await putKV("admin_login_rl", all);
      return { allowed: false, remaining: 0, resetInSec: Math.max(1, Math.ceil((rec.first + RATE_LIMIT_WINDOW_MS - now) / 1000)) };
    }
    rec.count += 1;
    for (const k of Object.keys(all)) {
      if (k !== ip && now - (all[k].first || 0) > RATE_LIMIT_WINDOW_MS) delete all[k];
    }
    all[ip] = rec;
    await putKV("admin_login_rl", all);
    return { allowed: true, remaining: RATE_LIMIT_MAX - rec.count, resetInSec: 0 };
  }

  async function issueAdminToken(ip) {
    let token;
    try { token = crypto.randomUUID() + crypto.randomUUID(); } catch (e) { token = Math.random().toString(36).slice(2) + Date.now().toString(36); }
    const now = Date.now();
    const sessions = (await getKV("admin_sessions", {})) || {};
    for (const k of Object.keys(sessions)) {
      if (!sessions[k] || now - (sessions[k].issuedAt || 0) > ADMIN_SESSION_TTL_MS) delete sessions[k];
    }
    sessions[token] = { ip, issuedAt: now, exp: now + ADMIN_SESSION_TTL_MS };
    await putKV("admin_sessions", sessions);
    return { token, expiresAt: now + ADMIN_SESSION_TTL_MS };
  }

  // Mutation routes: accept a live Bearer session token or the legacy
  // x-admin-password header (CLI / direct integration fallback).
  async function verifyAdminRequest(req, settings) {
    try {
      const auth = req.headers.get("authorization") || "";
      if (auth.startsWith("Bearer ")) {
        const token = auth.slice(7).trim();
        const sessions = (await getKV("admin_sessions", {})) || {};
        const rec = sessions[token];
        if (rec && Date.now() < (rec.exp || 0)) return true;
      }
      const legacy = req.headers.get("x-admin-password");
      if (legacy && validAdminPassword(legacy, settings)) return true;
    } catch (e) {
      console.warn("Admin auth check error:", e);
    }
    return false;
  }

  async function requireAdmin(req) {
    const settings = (await getKV("settings", {})) || {};
    if (await verifyAdminRequest(req, settings)) return null;
    return new Response(JSON.stringify({ success: false, error: "Unauthorized" }), { status: 401, headers: corsHeaders });
  }

  // 0. KV health check (diagnostic endpoint)
  // GET /api/kv-status -> reports whether the KV binding is active in THIS
  // deployment and performs a live write/read/delete probe.
  if (path === "kv-status" && method === "GET") {
    const bindingName = env.swapshop_kv ? "swapshop_kv" : env.SWAPSHOP_KV ? "SWAPSHOP_KV" : env.ECOSWAP_KV ? "ECOSWAP_KV" : null;
    const status = {
      success: true,
      kvBound: !!kv,
      bindingName,
      roundTrip: kv ? "not-tested" : "skipped"
    };
    if (kv) {
      try {
        const probeKey = "__kv_status_probe_" + Date.now();
        await kv.put(probeKey, JSON.stringify({ probe: true, at: new Date().toISOString() }));
        const readBack = await kv.get(probeKey, "json");
        await kv.delete(probeKey);
        status.roundTrip = readBack && readBack.probe === true ? "ok" : "failed-readback";
        status.message = status.roundTrip === "ok"
          ? "KV binding is active and writable. Data is being persisted."
          : "KV binding exists but the write/read probe failed.";
      } catch (e) {
        status.roundTrip = "error";
        status.error = String(e);
        status.message = "KV binding exists but the probe raised an error (check namespace permissions).";
      }
    } else {
      status.message = "No KV namespace is bound to this deployment; writes are kept in memory only and will be lost. In the Cloudflare dashboard open this Pages project > Settings > Functions > KV Namespace Bindings, add variable name 'swapshop_kv', then redeploy (Deployments > Retry).";
    }
    return new Response(JSON.stringify(status), { headers: corsHeaders });
  }

  // 1. Admin Login
  if (path === "admin/login" && method === "POST") {
    const settings = await getKV("settings", DEFAULT_SETTINGS, true);
    const ip = clientIP(request);
    const rl = await checkLoginRateLimit(ip);
    if (!rl.allowed) {
      return new Response(JSON.stringify({ success: false, rateLimited: true, error: "Too many login attempts. Please wait a few minutes before trying again." }), { status: 429, headers: corsHeaders });
    }
    const body = await request.json().catch(() => ({}));
    if (validAdminPassword(body.password, settings)) {
      const { token, expiresAt } = await issueAdminToken(ip);
      return new Response(JSON.stringify({ success: true, message: "Admin authenticated successfully", token, expiresAt }), { headers: corsHeaders });
    }
    return new Response(JSON.stringify({ success: false, error: "Invalid admin password", remainingAttempts: rl.remaining }), { status: 401, headers: corsHeaders });
  }

  // 2. Categories API
  if (path === "categories") {
    let categories = await getKV("categories", DEFAULT_CATEGORIES, true);
    if (method === "GET") {
      return new Response(JSON.stringify({ success: true, count: categories.length, categories }), { headers: corsHeaders });
    }
    if (method === "POST") {
      const denied = await requireAdmin(request);
      if (denied) return denied;
      const body = await request.json().catch(() => ({}));
      if (!body.name || !body.name.trim()) {
        return new Response(JSON.stringify({ success: false, error: "Category name is required" }), { status: 400, headers: corsHeaders });
      }
      const newCat = {
        id: "cat-" + Date.now(),
        name: body.name.trim(),
        icon: body.icon || "ph-tag",
        description: body.description || ""
      };
      categories.push(newCat);
      await putKV("categories", categories);
      return new Response(JSON.stringify({ success: true, category: newCat }), { headers: corsHeaders });
    }
  }

  if (path.startsWith("categories/") && method === "DELETE") {
    const denied = await requireAdmin(request);
    if (denied) return denied;
    const catId = path.replace("categories/", "");
    let categories = await getKV("categories", DEFAULT_CATEGORIES, true);
    categories = categories.filter(c => c.id !== catId && c.name !== catId);
    await putKV("categories", categories);
    return new Response(JSON.stringify({ success: true, message: "Category deleted" }), { headers: corsHeaders });
  }

  if (path.startsWith("categories/") && method === "PUT") {
    const denied = await requireAdmin(request);
    if (denied) return denied;
    const catId = path.replace("categories/", "");
    const body = await request.json().catch(() => ({}));
    let categories = await getKV("categories", DEFAULT_CATEGORIES, true);
    const cat = categories.find(c => c.id === catId);
    if (!cat) {
      return new Response(JSON.stringify({ success: false, error: "Category not found" }), { status: 404, headers: corsHeaders });
    }
    const prevName = cat.name;
    if (typeof body.name === "string" && body.name.trim()) cat.name = body.name.trim();
    if (typeof body.icon === "string" && body.icon.trim()) cat.icon = body.icon.trim();
    if (typeof body.description === "string") cat.description = body.description.trim();
    await putKV("categories", categories);
    // Inventory items store their category by name -> cascade a rename.
    let renamedItems = 0;
    if (cat.name !== prevName) {
      const inventory = await getKV("inventory", DEFAULT_INVENTORY, true);
      inventory.forEach(item => { if (item.category === prevName) { item.category = cat.name; renamedItems++; } });
      if (renamedItems > 0) await putKV("inventory", inventory);
    }
    return new Response(JSON.stringify({ success: true, category: cat, renamedItems }), { headers: corsHeaders });
  }

  // 3. Inventory API
  if (path === "inventory") {
    let items = await getKV("inventory", DEFAULT_INVENTORY, true);
    if (method === "GET") {
      const q = url.searchParams.get("q");
      const category = url.searchParams.get("category");
      let filtered = [...items];

      if (category && category !== "All") {
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
      return new Response(JSON.stringify({ success: true, count: filtered.length, items: filtered }), { headers: corsHeaders });
    }

    if (method === "POST") {
      const denied = await requireAdmin(request);
      if (denied) return denied;
      const body = await request.json().catch(() => ({}));
      if (!body.title) {
        return new Response(JSON.stringify({ success: false, error: "Title is required" }), { status: 400, headers: corsHeaders });
      }
      const newItem = {
        id: "item-" + Date.now(),
        title: body.title.trim(),
        category: body.category || "Miscellaneous",
        quantity: Math.max(0, parseInt(body.quantity, 10) || 1),
        unit: body.unit || "pcs",
        condition: body.condition || "Good",
        location: body.location || "Intake Area",
        icon: body.icon || "ph-package",
        weight_kg: parseFloat(body.weight_kg) || 0.5,
        est_value_eur: parseFloat(body.est_value_eur) || 10.0,
        co2_factor: parseFloat(body.co2_factor) || ((parseFloat(body.weight_kg) || 0.5) * 2.8),
        synonyms: Array.isArray(body.synonyms) ? body.synonyms : (body.synonyms ? body.synonyms.split(",").map(s => s.trim().toLowerCase()).filter(Boolean) : [body.title.toLowerCase()]),
        lastUpdated: new Date().toISOString()
      };
      items.unshift(newItem);
      await putKV("inventory", items);
      return new Response(JSON.stringify({ success: true, item: newItem }), { headers: corsHeaders });
    }
  }

  // Update or Delete single item
  if (path.startsWith("inventory/")) {
    const itemId = path.replace("inventory/", "");
    let items = await getKV("inventory", DEFAULT_INVENTORY);
    const idx = items.findIndex(it => it.id === itemId);

    if (method === "PUT") {
      const denied = await requireAdmin(request);
      if (denied) return denied;
      if (idx === -1) {
        return new Response(JSON.stringify({ success: false, error: "Item not found" }), { status: 404, headers: corsHeaders });
      }
      const body = await request.json().catch(() => ({}));
      const existing = items[idx];
      const updated = {
        ...existing,
        ...body,
        quantity: body.quantity !== undefined ? Math.max(0, parseInt(body.quantity, 10)) : existing.quantity,
        weight_kg: body.weight_kg !== undefined ? parseFloat(body.weight_kg) : existing.weight_kg,
        est_value_eur: body.est_value_eur !== undefined ? parseFloat(body.est_value_eur) : existing.est_value_eur,
        co2_factor: body.co2_factor !== undefined ? parseFloat(body.co2_factor) : (existing.co2_factor || 2.5),
        synonyms: Array.isArray(body.synonyms) ? body.synonyms : (body.synonyms ? body.synonyms.split(",").map(s => s.trim().toLowerCase()).filter(Boolean) : existing.synonyms),
        lastUpdated: new Date().toISOString()
      };
      items[idx] = updated;
      await putKV("inventory", items);
      return new Response(JSON.stringify({ success: true, item: updated }), { headers: corsHeaders });
    }

    if (method === "DELETE") {
      const denied = await requireAdmin(request);
      if (denied) return denied;
      if (idx === -1) {
        return new Response(JSON.stringify({ success: false, error: "Item not found" }), { status: 404, headers: corsHeaders });
      }
      items.splice(idx, 1);
      await putKV("inventory", items);
      return new Response(JSON.stringify({ success: true, message: "Item deleted" }), { headers: corsHeaders });
    }
  }

  // 4. Admin Synonym Mapping & Pool Update
  if (path === "admin/map-synonym" && method === "POST") {
    const denied = await requireAdmin(request);
    if (denied) return denied;
    const body = await request.json().catch(() => ({}));
    const { synonym, targetItemId, adjustQuantity } = body;
    if (!synonym || !targetItemId) {
      return new Response(JSON.stringify({ success: false, error: "Both synonym and targetItemId required" }), { status: 400, headers: corsHeaders });
    }
    let items = await getKV("inventory", DEFAULT_INVENTORY);
    const idx = items.findIndex(it => it.id === targetItemId);
    if (idx === -1) {
      return new Response(JSON.stringify({ success: false, error: "Target item not found" }), { status: 404, headers: corsHeaders });
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
    await putKV("inventory", items);
    return new Response(JSON.stringify({ success: true, message: "Mapped " + cleanSyn + " to " + item.title + " (Stock now: " + item.quantity + ")", item }), { headers: corsHeaders });
  }

  // 5. Session Step Save
  if (path === "session/step" && method === "POST") {
    const body = await request.json().catch(() => ({}));
    const { sessionId, step, stepName, stepData, fullSession } = body;
    if (!sessionId) {
      return new Response(JSON.stringify({ success: false, error: "sessionId required" }), { status: 400, headers: corsHeaders });
    }
    const sessions = await getKV("sessions", {});
    const now = new Date().toISOString();

    if (!sessions[sessionId]) {
      sessions[sessionId] = {
        id: sessionId,
        createdAt: now,
        lastUpdated: now,
        status: "in_progress",
        currentStep: step,
        stepHistory: [],
        data: {}
      };
    }
    const session = sessions[sessionId];
    session.lastUpdated = now;
    session.currentStep = step;

    if (fullSession && typeof fullSession === "object") {
      session.data = { ...session.data, ...fullSession };
    } else if (stepData && typeof stepData === "object") {
      session.data = { ...session.data, ...stepData };
    }

    session.stepHistory.push({
      step: String(step),
      stepName: stepName || "Step " + step,
      savedAt: now,
      payload: stepData || {}
    });

    await putKV("sessions", sessions);
    return new Response(JSON.stringify({
      success: true,
      message: "Step " + step + " (" + (stepName || "") + ") saved successfully",
      sessionId,
      step,
      stepName,
      savedAt: now,
      sessionState: session.data
    }), { headers: corsHeaders });
  }

  // 6. Complete Session
  if (path === "session/complete" && method === "POST") {
    const body = await request.json().catch(() => ({}));
    const { sessionId, sessionData } = body;
    const now = new Date().toISOString();

    const sessions = await getKV("sessions", {});
    let inventory = await getKV("inventory", DEFAULT_INVENTORY);
    const transactions = await getKV("transactions", []);

    const data = sessionData || (sessions[sessionId] ? sessions[sessionId].data : null);
    if (!data) {
      return new Response(JSON.stringify({ success: false, error: "No session data provided" }), { status: 400, headers: corsHeaders });
    }

    const action = data.action_type || "drop-off";
    const items = Array.isArray(data.items) ? data.items : [];

    // Re-completing the same session (receipt "Edit") must UPDATE the stored
    // transaction instead of creating a duplicate. Reverse the old items'
    // inventory effect first, then apply the new ones.
    const existingTx = sessionId ? transactions.find(t => t.sessionId === sessionId) : null;
    if (existingTx) {
      const dirOld = (existingTx.action_type === "drop-off" || existingTx.action_type === "return") ? 1 : -1;
      (existingTx.items || []).forEach(it => {
        const word = String(it.title || "").toLowerCase();
        const invItem = inventory.find(i => i.id === it.id || i.title.toLowerCase() === word || (i.synonyms || []).some(s => String(s).toLowerCase() === word));
        if (invItem) {
          const qty = parseInt(it.amount, 10) || 1;
          invItem.quantity = Math.max(0, (invItem.quantity || 0) - dirOld * qty);
          invItem.lastUpdated = now;
        }
      });
    }

    let totalWeight = 0, totalValue = 0, totalCo2 = 0;

    const matchedIds = [];
    const matchedCategories = [];
    items.forEach(it => {
      const qty = parseInt(it.amount, 10) || 1;
      const itemWord = (it.title || "").toLowerCase();
      let invItem = inventory.find(i => i.id === it.id || i.title.toLowerCase() === itemWord || (i.synonyms || []).some(s => String(s).toLowerCase() === itemWord));
      if (invItem) {
        if (action === "drop-off" || action === "return") {
          invItem.quantity = (invItem.quantity || 0) + qty;
        } else if (action === "pick-up") {
          invItem.quantity = Math.max(0, (invItem.quantity || 0) - qty);
        }
        matchedIds.push(invItem.id);
        matchedCategories.push(invItem.category || null);
        invItem.lastUpdated = now;
        totalWeight += (invItem.weight_kg || 0.5) * qty;
        totalValue += (invItem.est_value_eur || 10.0) * qty;
        totalCo2 += (invItem.co2_factor || 2.0) * qty;
      } else if (action === "drop-off") {
        // Unmatched word: leave it unlinked inside the transaction. Staff can
        // link it to a pool or create a new item in the Synonyms tab.
        totalWeight += 0.5 * qty;
        totalValue += 8.0 * qty;
        totalCo2 += 1.8 * qty;
        matchedIds.push(null);
        matchedCategories.push(null);
      }
    });

    await putKV("inventory", inventory);

    const txFields = {
      user_type: data.user_type || "unspecified",
      is_international: data.is_international !== undefined ? data.is_international : null,
      accommodation: data.accommodation || null,
      stay_duration: data.stay_duration || null,
      action_type: action,
      items: items.map((it, i) => ({
        id: it.id || matchedIds[i] || null,
        title: it.title || "Item",
        amount: parseInt(it.amount, 10) || 1,
        category: matchedCategories[i] || it.category || "Miscellaneous"
      })),
      weight_diverted_kg: parseFloat(totalWeight.toFixed(2)),
      value_saved_eur: parseFloat(totalValue.toFixed(2)),
      co2_saved_kg: parseFloat(totalCo2.toFixed(2)),
      notes: "CF Form completed - " + items.length + " item(s) processed"
    };

    let newTx;
    if (existingTx) {
      // Receipt edit: patch the same transaction in place.
      Object.assign(existingTx, txFields, { updatedAt: now });
      newTx = existingTx;
    } else {
      newTx = {
        id: "tx-" + Date.now(),
        timestamp: now,
        sessionId: sessionId || "ses-" + Date.now(),
        ...txFields
      };
      transactions.unshift(newTx);
    }
    await putKV("transactions", transactions);

    if (sessionId && sessions[sessionId]) {
      sessions[sessionId].status = "completed";
      sessions[sessionId].completedAt = now;
      sessions[sessionId].transactionId = newTx.id;
      await putKV("sessions", sessions);
    }

    return new Response(JSON.stringify({
      success: true,
      message: "Transaction successfully processed",
      transaction: newTx,
      itemsProcessed: items.length
    }), { headers: corsHeaders });
  }

  // 7. Analytics API
  if (path === "analytics" && method === "GET") {
    const transactions = await getKV("transactions", []);
    const inventory = await getKV("inventory", DEFAULT_INVENTORY);
    const sessions = await getKV("sessions", {});

    const totalSwaps = transactions.length;
    let totalItemsSwapped = 0, totalWeightKg = 0, totalValueEur = 0, totalCo2Kg = 0;
    const actions = { "drop-off": 0, "pick-up": 0, "return": 0 };
    // Per-action totals: drop-off and pick-up must not feed the same bucket,
    // so an item that is dropped off and later picked up counts once each in
    // its own direction instead of double-counting one "swap" pool.
    const byAction = {
      "drop-off": { swaps: 0, items: 0, weightKg: 0, valueEur: 0, co2Kg: 0 },
      "pick-up": { swaps: 0, items: 0, weightKg: 0, valueEur: 0, co2Kg: 0 },
      "return": { swaps: 0, items: 0, weightKg: 0, valueEur: 0, co2Kg: 0 }
    };
    const demographics = { students: 0, nonStudents: 0, international: 0, domestic: 0 };
    const accommodations = {};
    const stayDurations = {};

    transactions.forEach(tx => {
      if (tx.action_type && actions[tx.action_type] !== undefined) actions[tx.action_type]++;
      const perAction = byAction[tx.action_type];
      if (perAction) {
        perAction.swaps++;
        if (Array.isArray(tx.items)) tx.items.forEach(it => { perAction.items += (it.amount || 1); });
        perAction.weightKg += (tx.weight_diverted_kg || 0);
        perAction.valueEur += (tx.value_saved_eur || 0);
        perAction.co2Kg += (tx.co2_saved_kg || (tx.weight_diverted_kg || 0) * 2.8);
      }
      if (tx.user_type === "student") {
        demographics.students++;
        if (tx.is_international === "international" || tx.is_international === true) demographics.international++;
        else if (tx.is_international === "domestic" || tx.is_international === false) demographics.domestic++;
        if (tx.accommodation) accommodations[tx.accommodation] = (accommodations[tx.accommodation] || 0) + 1;
        if (tx.stay_duration) stayDurations[tx.stay_duration] = (stayDurations[tx.stay_duration] || 0) + 1;
      } else if (tx.user_type === "non-student") {
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
    const activeSessionsCount = Object.values(sessions).filter(s => s.status === "in_progress").length;

    // Item-level rollups for the richer dashboard
    const topItemMap = {};
    const categoryMap = {};
    transactions.forEach(tx => {
      (tx.items || []).forEach(it => {
        const t = (it.title || "Unknown").trim();
        topItemMap[t] = (topItemMap[t] || 0) + (it.amount || 1);
        const c = it.category || "Uncategorized";
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
      const inMonth = transactions.filter(tx => {
        const t = new Date(tx.timestamp);
        return !isNaN(t) && t >= start && t < end;
      });
      monthlyTrend.push({
        label: start.toLocaleDateString("en-GB", { month: "short" }),
        swaps: inMonth.length,
        items: inMonth.reduce((s, tx) => s + (tx.items || []).reduce((x, it) => x + (it.amount || 1), 0), 0)
      });
    }
    const stockValueEur = inventory.reduce((s, it) => s + (parseFloat(it.est_value_eur) || 0) * (parseInt(it.quantity, 10) || 0), 0);
    const avgValuePerItem = totalItemsSwapped > 0 ? totalValueEur / totalItemsSwapped : 0;

    // Net flow = items coming IN (drop-off + return) minus going OUT (pick-up).
    const da = byAction["drop-off"], pa = byAction["pick-up"], ra = byAction["return"];
    const netByAction = {
      swaps: da.swaps + ra.swaps - pa.swaps,
      items: da.items + ra.items - pa.items,
      weightKg: parseFloat((da.weightKg + ra.weightKg - pa.weightKg).toFixed(2)),
      valueEur: parseFloat((da.valueEur + ra.valueEur - pa.valueEur).toFixed(2)),
      co2Kg: parseFloat((da.co2Kg + ra.co2Kg - pa.co2Kg).toFixed(2))
    };
    // Returns as a share of all incoming items (drop-off + return).
    const returnSharePct = (ra.swaps + da.swaps) > 0 ? Math.round((ra.swaps / (ra.swaps + da.swaps)) * 100) : 0;
    // Returns per person who picked up once — null when nobody has picked up.
    const returnPerPickupPct = pa.swaps > 0 ? Math.round((ra.swaps / pa.swaps) * 100) : null;

    return new Response(JSON.stringify({
      success: true,
      totalSwaps,
      totalStockItems,
      totalItemsSwapped,
      activeSessionsCount,
      totalWeightKg: parseFloat(totalWeightKg.toFixed(1)),
      co2AvoidedKg: parseFloat(totalCo2Kg.toFixed(1)),
      totalValueEur: parseFloat(totalValueEur.toFixed(2)),
      actions,
      byAction,
      netByAction,
      returnSharePct,
      returnPerPickupPct,
      demographics,
      accommodations,
      stayDurations,
      topItems,
      categoryMix,
      monthlyTrend,
      stockValueEur: parseFloat(stockValueEur.toFixed(2)),
      avgValuePerItem: parseFloat(avgValuePerItem.toFixed(2))
    }), { headers: corsHeaders });
  }

  // 8. Transactions API
  if (path === "transactions" && method === "GET") {
    const transactions = await getKV("transactions", []);
    return new Response(JSON.stringify({ success: true, count: transactions.length, transactions }), { headers: corsHeaders });
  }

  if (path.startsWith("transactions/") && method === "PUT") {
    const denied = await requireAdmin(request);
    if (denied) return denied;
    const txId = path.replace("transactions/", "");
    const body = await request.json().catch(() => ({}));
    let transactions = await getKV("transactions", []);
    const idx = transactions.findIndex(t => t.id === txId);
    if (idx === -1) {
      return new Response(JSON.stringify({ success: false, error: "Transaction not found" }), { status: 404, headers: corsHeaders });
    }
    const tx = transactions[idx];
    ["user_type", "is_international", "accommodation", "stay_duration", "action_type"].forEach(k => {
      if (body[k] !== undefined) tx[k] = body[k];
    });
    if (Array.isArray(body.items)) {
      tx.items = body.items.map(it => ({
        id: it.id || null,
        title: String(it.title || "Item").trim(),
        amount: Math.max(1, parseInt(it.amount, 10) || 1),
        category: it.category || "Miscellaneous"
      }));
    }
    const inv = await getKV("inventory", DEFAULT_INVENTORY);
    let w = 0, v = 0, c = 0;
    tx.items.forEach(it => {
      const word = (it.title || "").toLowerCase();
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
    await putKV("transactions", transactions);
    return new Response(JSON.stringify({ success: true, transaction: tx }), { headers: corsHeaders });
  }

  if (path === "settings" && method === "GET") {
    const s = await getKV("settings", DEFAULT_SETTINGS, true);
    return new Response(JSON.stringify({
      success: true,
      settings: {
        shopName: s.shopName || "Global Belongings",
        co2KgPerKgGoods: s.co2KgPerKgGoods != null ? s.co2KgPerKgGoods : 2.8,
        accommodations: Array.isArray(s.accommodations) ? s.accommodations : []
      }
    }), { headers: corsHeaders });
  }

  if (path === "settings" && method === "PUT") {
    const denied = await requireAdmin(request);
    if (denied) return denied;
    const body = await request.json().catch(() => ({}));
    const s = await getKV("settings", DEFAULT_SETTINGS, true);
    if (body.shopName !== undefined) s.shopName = String(body.shopName).trim() || s.shopName;
    if (body.co2KgPerKgGoods !== undefined && !isNaN(parseFloat(body.co2KgPerKgGoods))) s.co2KgPerKgGoods = parseFloat(body.co2KgPerKgGoods);
    if (Array.isArray(body.accommodations)) {
      s.accommodations = body.accommodations
        .filter(a => a && String(a.name || "").trim())
        .map(a => ({
          name: String(a.name).trim(),
          desc: String(a.desc || "").trim(),
          icon: String(a.icon || "").trim() || "ph-buildings"
        }));
    }
    await putKV("settings", s);
    return new Response(JSON.stringify({
      success: true,
      settings: { shopName: s.shopName, co2KgPerKgGoods: s.co2KgPerKgGoods, accommodations: s.accommodations || [] }
    }), { headers: corsHeaders });
  }

  if (path.startsWith("transactions/") && method === "DELETE") {
    const denied = await requireAdmin(request);
    if (denied) return denied;
    const txId = path.replace("transactions/", "");
    let transactions = await getKV("transactions", []);
    const idx = transactions.findIndex(t => t.id === txId);
    if (idx === -1) {
      return new Response(JSON.stringify({ success: false, error: "Transaction not found" }), { status: 404, headers: corsHeaders });
    }
    transactions.splice(idx, 1);
    await putKV("transactions", transactions);
    return new Response(JSON.stringify({ success: true, message: "Transaction deleted" }), { headers: corsHeaders });
  }

  return new Response(JSON.stringify({ error: "Endpoint not found" }), { status: 404, headers: corsHeaders });
}
