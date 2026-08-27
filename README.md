# Global Belongings — Swap Shop (Guided Conversational Form Inventory System)

A complete, intelligent **Conversational Form (CF)** inventory management system built specifically for university and community **Swap Shops** (circular reuse hubs). 

Featuring **generic item descriptions** (with cutlery divided into individual pieces), a **password-protected admin panel** with **split-screen view**, **custom category setup**, **synonym-to-pool mapping**, **heartfelt thank-you messages**, **buttonless receipt printing**, and **instant save-after-each-step** persistence.

---

## 🌟 What's New in This Version

1. **Generic Item Descriptions & Individual Cutlery**:
   - Cutlery is divided into individual items: **Fork**, **Knife**, **Spoon**, and **Teaspoon**.
   - All catalog titles are now clean and generic: `Mug`, `Plate`, `Bowl`, `Pan`, `Pot`, `Toaster`, `Pillow`, `Duvet`, `Lamp`, `Book`, `Notebook`, `Hoodie`, `Coat`, `Shoes`, `Towel`, `Hanger`, etc.
   - Comprehensive synonym mapping: colloquial terms (`"coffee cup"`, `"beaker"`, `"skillet"`, `"flatware"`, `"quilt"`, `"cushion"`, `"sneakers"`) automatically resolve to these generic items.

2. **Split View: User Kiosk + Admin Panel**:
   - **Kiosk View**: Dedicated full-screen customer/student interface.
   - **Split View**: 50/50 side-by-side view where the customer kiosk runs on the left and the staff admin panel runs on the right, with live real-time synchronization.
   - **Admin View**: Full-width staff management dashboard.

3. **Password-Protected Admin Panel**:
   - Access to Split View or Admin Panel requires staff verification.
   - Default password: `swapadmin` (or `ecoswap2026`).
   - Quick **"Lock Admin"** button to immediately secure the panel after staff finish their work.

4. **Admin Category Setup & Item Parameter Editing**:
   - **Categories Manager**: Create new custom categories with Phosphor icons, description, and delete capabilities.
   - **Item Parameters**: Edit weight (kg), estimated value (€), CO₂ factor (kg CO₂e), stock levels, condition, shelf location, and synonym lists.

5. **Synonym & Stock Pool Mapping Assistant**:
   - Link newly entered submissions or colloquial words directly as synonyms of existing items.
   - Instantly adjust the existing item's stock pool (`+` or `-` units) when mapping donations.

6. **Heartfelt Thank-You Messages**:
   - **Drop-offs (Donations)**: Bot thanks the visitor with warm appreciation (`🌿💚 Thank you so much for donating and giving your items a second life!`), and the receipt features an eco-donation thank-you banner.
   - **Returns**: Bot thanks the visitor for returning reusables (`🔄✨ Thank you for returning reusable items so another student can borrow them!`).
   - **Pick-ups**: Friendly reminder that reusing beats buying new every time.

7. **Clean Receipt Printing (Only the Box, No Buttons)**:
   - When clicking **"Print Receipt Slip"**, the print stylesheet hides all website chrome, navigation, headers, chat bubbles, and **completely removes all action buttons**.
   - The result is a clean paper slip showing only the **"Swap Logged Successfully!"** receipt box with student demographics, itemized list, and circular impact metrics.

8. **Zero-Dependency Native Architecture**:
   - Built with standard Node.js built-ins (`http`, `fs`, `path`, `url`), eliminating fragile `node_modules` dependencies and guaranteeing instant startup and 100% uptime.

---

## 📋 Guided Conversational Flow (CF)

1. **Student vs. Non-Student** (`ph-graduation-cap` vs `ph-user`)
   - *Auto-saved to server & local storage.*
2. **If Student:**
   - **2.1 International / Domestic** (`ph-globe-hemisphere-west` vs `ph-house-line`)
   - **2.2 Accommodation Type**: Private Accommodation, Campus Halls (*Parkside*, *Oakwood*, *Riverfront*, *Meadow Court*, *West End*), or Other.
   - **2.3 Length of Stay**: Short-term exchange, 1 semester, 1 academic year, full degree, or flexible.
   - *Auto-saved after each sub-step.*
3. **Action Type:**
   - **Drop-off** (Donate items)
   - **Pick-up** (Take items)
   - **Return** (Reusable / borrowed items)
   - *Auto-saved after selection with personalized thank-you response.*
4. **(Optional) What did you drop off/pick up `[Amount] [Item]`:**
   - Smart natural language amount parser (`"2 mugs"`, `"3 spoons"`, `"1 plate"`, `"pillow"`).
   - Real-time synonym autocomplete popup.
   - Live stock validation & quantity steppers (`+` / `-`).
   - Optional: can be skipped for general visits.
   - *Auto-saved after adding, adjusting, or skipping items.*
5. **Receipt & Impact Summary:**
   - Visual receipt showing items processed, landfill diverted (kg), student savings (€), and CO₂e avoided.
   - Single-click printout optimized for physical receipts.

---

## 🗂️ Project Structure

```
/home/user/
├── server.js              # Zero-dependency native Node.js HTTP server & REST API
├── package.json           # Project manifest
├── README.md              # System documentation
├── data/
│   ├── inventory.json     # 37 generic items with synonyms, weights, values, CO2 factors
│   ├── categories.json    # Dynamic category definitions with Phosphor icons
│   ├── sessions.json      # In-progress and completed sessions with step history
│   ├── transactions.json  # Logged drop-offs, pick-ups, and returns
│   └── settings.json      # Admin password & shop configuration
└── public/
    ├── index.html         # Single-page app with Kiosk, Split View, and Admin Panel
    ├── css/style.css      # Responsive styles with Phosphor typography and print stylesheet
    ├── js/app.js          # CF engine, synonym parser, split view & admin controller
    └── vendor/
        ├── phosphor/      # Self-hosted Phosphor Icons web fonts & CSS
        └── conversational-form/ # Self-hosted SPACE10 CF engine & CSS
```

---

## 🚀 Running the System

Start the server:
```bash
node server.js
```
The server listens on `http://0.0.0.0:3000`.

- **Staff Admin Password**: `swapadmin` (or `ecoswap2026`).
- **Audit Log**: Click the clock icon in the top header to inspect the live chronological step-save log.
