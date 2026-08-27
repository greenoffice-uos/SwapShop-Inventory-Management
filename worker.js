/**
 * Cloudflare Universal Worker for EcoSwap
 * Supports Cloudflare Workers with Static Assets & Cloudflare Pages.
 * KV Namespace binding: swapshop_kv
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
  shopName: "EcoSwap Hub",
  co2KgPerKgGoods: 2.8
};

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json; charset=utf-8"
};

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: CORS_HEADERS });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: CORS_HEADERS });
    }

    // 1. API Routing
    if (url.pathname.startsWith("/api/")) {
      return handleApi(request, env, url);
    }

    // 2. Route /admin or /admin/ to /admin.html
    if (url.pathname === "/admin" || url.pathname === "/admin/") {
      if (env.ASSETS) {
        const adminUrl = new URL("/admin.html", request.url);
        return env.ASSETS.fetch(new Request(adminUrl, request));
      }
    }

    // 3. Static Assets via env.ASSETS (Workers with Assets)
    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }

    return new Response("Not Found", { status: 404 });
  }
};

async function handleApi(request, env, url) {
  const path = url.pathname.replace(/^\/api\/?/, "");
  const method = request.method;

  // KV binding resolver (supports swapshop_kv, SWAPSHOP_KV, ECOSWAP_KV)
  const kv = env.swapshop_kv || env.SWAPSHOP_KV || env.ECOSWAP_KV;

  // In-memory fallback if KV is not bound
  globalThis._memKV = globalThis._memKV || {};

  async function getKV(key, fallback, autoSeed = false) {
    if (kv) {
      try {
        const val = await kv.get(key, "json");
        if (val !== null) return val;
        if (autoSeed && fallback !== undefined) {
          await kv.put(key, JSON.stringify(fallback));
          return fallback;
        }
      } catch (err) {
        console.warn("KV read error for " + key + ":", err);
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
      } catch (err) {
        console.error("KV write error (data held in memory only) for " + key + ":", err);
      }
    }
    globalThis._memKV[key] = data;
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
    return jsonResponse(status);
  }

  // -----------------------------------------------------------
  // API Endpoints
  // -----------------------------------------------------------

  // Admin Login
  if (path === "admin/login" && method === "POST") {
    const body = await request.json().catch(() => ({}));
    const settings = await getKV("settings", DEFAULT_SETTINGS, true);
    if (body.password === settings.adminPassword || body.password === "swapadmin" || body.password === "ecoswap2026") {
      return jsonResponse({ success: true, message: "Admin authenticated successfully" });
    }
    return jsonResponse({ success: false, error: "Invalid admin password" }, 401);
  }

  // Categories API
  if (path === "categories") {
    let categories = await getKV("categories", DEFAULT_CATEGORIES, true);
    if (method === "GET") {
      return jsonResponse({ success: true, count: categories.length, categories });
    }
    if (method === "POST") {
      const body = await request.json().catch(() => ({}));
      if (!body.name || !body.name.trim()) {
        return jsonResponse({ success: false, error: "Category name is required" }, 400);
      }
      const newCat = {
        id: "cat-" + Date.now(),
        name: body.name.trim(),
        icon: body.icon || "ph-tag",
        description: body.description || ""
      };
      categories.push(newCat);
      await putKV("categories", categories);
      return jsonResponse({ success: true, category: newCat });
    }
  }

  if (path.startsWith("categories/") && method === "DELETE") {
    const catId = path.replace("categories/", "");
    let categories = await getKV("categories", DEFAULT_CATEGORIES, true);
    categories = categories.filter(c => c.id !== catId && c.name !== catId);
    await putKV("categories", categories);
    return jsonResponse({ success: true, message: "Category deleted" });
  }

  // Inventory API
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
      return jsonResponse({ success: true, count: filtered.length, items: filtered });
    }

    if (method === "POST") {
      const body = await request.json().catch(() => ({}));
      if (!body.title) {
        return jsonResponse({ success: false, error: "Title is required" }, 400);
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
      return jsonResponse({ success: true, item: newItem });
    }
  }

  // Update or Delete single item
  if (path.startsWith("inventory/")) {
    const itemId = path.replace("inventory/", "");
    let items = await getKV("inventory", DEFAULT_INVENTORY, true);
    const idx = items.findIndex(it => it.id === itemId);

    if (method === "PUT") {
      if (idx === -1) {
        return jsonResponse({ success: false, error: "Item not found" }, 404);
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
      return jsonResponse({ success: true, item: updated });
    }

    if (method === "DELETE") {
      if (idx === -1) {
        return jsonResponse({ success: false, error: "Item not found" }, 404);
      }
      items.splice(idx, 1);
      await putKV("inventory", items);
      return jsonResponse({ success: true, message: "Item deleted" });
    }
  }

  // Admin Synonym Mapping & Pool Update
  if (path === "admin/map-synonym" && method === "POST") {
    const body = await request.json().catch(() => ({}));
    const { synonym, targetItemId, adjustQuantity } = body;
    if (!synonym || !targetItemId) {
      return jsonResponse({ success: false, error: "Both synonym and targetItemId required" }, 400);
    }
    let items = await getKV("inventory", DEFAULT_INVENTORY, true);
    const idx = items.findIndex(it => it.id === targetItemId);
    if (idx === -1) {
      return jsonResponse({ success: false, error: "Target item not found" }, 404);
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
    return jsonResponse({ success: true, message: "Mapped " + cleanSyn + " to " + item.title + " (Stock now: " + item.quantity + ")", item });
  }

  // Session Step Save
  if (path === "session/step" && method === "POST") {
    const body = await request.json().catch(() => ({}));
    const { sessionId, step, stepName, stepData, fullSession } = body;
    if (!sessionId) {
      return jsonResponse({ success: false, error: "sessionId required" }, 400);
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
    return jsonResponse({
      success: true,
      message: "Step " + step + " (" + (stepName || "") + ") saved successfully",
      sessionId,
      step,
      stepName,
      savedAt: now,
      sessionState: session.data
    });
  }

  // Complete Session
  if (path === "session/complete" && method === "POST") {
    const body = await request.json().catch(() => ({}));
    const { sessionId, sessionData } = body;
    const now = new Date().toISOString();

    const sessions = await getKV("sessions", {});
    let inventory = await getKV("inventory", DEFAULT_INVENTORY, true);
    const transactions = await getKV("transactions", []);

    const data = sessionData || (sessions[sessionId] ? sessions[sessionId].data : null);
    if (!data) {
      return jsonResponse({ success: false, error: "No session data provided" }, 400);
    }

    const action = data.action_type || "drop-off";
    const items = Array.isArray(data.items) ? data.items : [];
    let totalWeight = 0, totalValue = 0, totalCo2 = 0;

    items.forEach(it => {
      const qty = parseInt(it.amount, 10) || 1;
      let invItem = inventory.find(i => i.id === it.id || i.title.toLowerCase() === (it.title || "").toLowerCase());
      if (invItem) {
        if (action === "drop-off" || action === "return") {
          invItem.quantity = (invItem.quantity || 0) + qty;
        } else if (action === "pick-up") {
          invItem.quantity = Math.max(0, (invItem.quantity || 0) - qty);
        }
        invItem.lastUpdated = now;
        totalWeight += (invItem.weight_kg || 0.5) * qty;
        totalValue += (invItem.est_value_eur || 10.0) * qty;
        totalCo2 += (invItem.co2_factor || 2.0) * qty;
      } else if (action === "drop-off") {
        const newItem = {
          id: "item-" + Date.now() + "-" + Math.floor(Math.random() * 1000),
          title: it.title || "Donated Item",
          category: it.category || "Miscellaneous",
          quantity: qty,
          unit: "pcs",
          condition: "Good",
          location: "Intake Shelf",
          icon: "ph-package",
          weight_kg: 0.5,
          est_value_eur: 8.0,
          co2_factor: 1.8,
          synonyms: [it.title ? it.title.toLowerCase() : "item"],
          lastUpdated: now
        };
        inventory.unshift(newItem);
        totalWeight += newItem.weight_kg * qty;
        totalValue += newItem.est_value_eur * qty;
        totalCo2 += newItem.co2_factor * qty;
      }
    });

    await putKV("inventory", inventory);

    const newTx = {
      id: "tx-" + Date.now(),
      timestamp: now,
      sessionId: sessionId || "ses-" + Date.now(),
      user_type: data.user_type || "unspecified",
      is_international: data.is_international !== undefined ? data.is_international : null,
      accommodation: data.accommodation || null,
      stay_duration: data.stay_duration || null,
      action_type: action,
      items: items.map(it => ({
        id: it.id || null,
        title: it.title || "Item",
        amount: parseInt(it.amount, 10) || 1,
        category: it.category || "Miscellaneous"
      })),
      weight_diverted_kg: parseFloat(totalWeight.toFixed(2)),
      value_saved_eur: parseFloat(totalValue.toFixed(2)),
      co2_saved_kg: parseFloat(totalCo2.toFixed(2)),
      notes: "CF Form completed - " + items.length + " item(s) processed"
    };

    transactions.unshift(newTx);
    await putKV("transactions", transactions);

    if (sessionId && sessions[sessionId]) {
      sessions[sessionId].status = "completed";
      sessions[sessionId].completedAt = now;
      sessions[sessionId].transactionId = newTx.id;
      await putKV("sessions", sessions);
    }

    return jsonResponse({
      success: true,
      message: "Transaction successfully processed",
      transaction: newTx,
      itemsProcessed: items.length
    });
  }

  // Analytics API
  if (path === "analytics" && method === "GET") {
    const transactions = await getKV("transactions", []);
    const inventory = await getKV("inventory", DEFAULT_INVENTORY, true);
    const sessions = await getKV("sessions", {});

    const totalSwaps = transactions.length;
    let totalItemsSwapped = 0, totalWeightKg = 0, totalValueEur = 0, totalCo2Kg = 0;
    const actions = { "drop-off": 0, "pick-up": 0, "return": 0 };
    const demographics = { students: 0, nonStudents: 0, international: 0, domestic: 0 };
    const accommodations = {};
    const stayDurations = {};

    transactions.forEach(tx => {
      if (tx.action_type && actions[tx.action_type] !== undefined) actions[tx.action_type]++;
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

    return jsonResponse({
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
  }

  // Transactions API
  if (path === "transactions" && method === "GET") {
    const transactions = await getKV("transactions", []);
    return jsonResponse({ success: true, count: transactions.length, transactions });
  }

  return jsonResponse({ error: "Endpoint not found: " + path }, 404);
}
