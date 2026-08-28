/**
 * Global Belongings Mobile Kiosk Application Logic
 * Pure, distraction-free conversational swap assistant
 */

const State = {
  sessionId: null,
  currentStep: 1,
  sessionData: {
    user_type: null,
    is_international: null,
    accommodation: null,
    stay_duration: null,
    action_type: null,
    items: [],
    notes: ''
  },
  inventory: []
};

const NUMBER_WORDS = {
  'a': 1, 'an': 1, 'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5,
  'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10,
  'pair': 1, 'pair of': 1, 'couple': 2, 'few': 3, 'half dozen': 6, 'dozen': 12
};

const STUDENT_ACCOMMODATIONS = [
  { id: 'parkside', name: 'Parkside Student Residence', desc: 'North Campus Hall', icon: 'ph-buildings' },
  { id: 'oakwood', name: 'Oakwood Student Village', desc: 'East Quad Residence', icon: 'ph-buildings' },
  { id: 'riverfront', name: 'Riverfront Campus Towers', desc: 'South Bank High-Rise', icon: 'ph-buildings' },
  { id: 'meadow', name: 'Meadow Court Flats', desc: 'West Campus Lodges', icon: 'ph-buildings' },
  { id: 'westend', name: 'West End College Lodge', desc: 'Central University Hall', icon: 'ph-buildings' }
];

// Configurable at runtime via /api/settings (edited in the admin panel)
let KIOSK_ACCOMMODATIONS = STUDENT_ACCOMMODATIONS;

const STAY_DURATIONS = [
  { id: 'exchange', label: 'Short-term Exchange (< 4 months)', desc: 'Erasmus / Visiting scholar', icon: 'ph-hourglass-medium' },
  { id: '1-semester', label: '1 Semester (4–6 months)', desc: 'One study term', icon: 'ph-calendar-blank' },
  { id: '1-year', label: '1 Academic Year (9–12 months)', desc: 'Full academic session', icon: 'ph-calendar-check' },
  { id: 'degree', label: 'Full Degree (2–4+ years)', desc: 'Bachelor or Master programme', icon: 'ph-graduation-cap' },
  { id: 'other', label: 'Other / Flexible Stay', desc: 'PhD, research, or undecided', icon: 'ph-clock' }
];

async function loadShopSettings() {
  try {
    const res = await fetch('/api/settings');
    const data = await res.json();
    if (data.success && data.settings && Array.isArray(data.settings.accommodations) && data.settings.accommodations.length) {
      KIOSK_ACCOMMODATIONS = data.settings.accommodations.map(a => ({
        id: 'acc-' + String(a.name || 'residence').toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        name: a.name,
        desc: a.desc || '',
        icon: a.icon || 'ph-buildings'
      }));
    }
  } catch (err) {}
}

document.addEventListener('DOMContentLoaded', async () => {
  await loadShopSettings();
  initKioskSession();
  loadInventory();

});

// ==========================================================================
// SESSION & AUTO-SAVE MANAGEMENT
// ==========================================================================
function initKioskSession() {
  const saved = localStorage.getItem('swapshop_kiosk_session');
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      if (parsed && parsed.sessionId && parsed.currentStep < 5) {
        showResumeBanner(parsed);
        return;
      }
    } catch (e) {}
  }
  startFreshSession();
}

function startFreshSession() {
  State.sessionId = `ses_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  State.currentStep = 1;
  State.sessionData = {
    user_type: null,
    is_international: null,
    accommodation: null,
    stay_duration: null,
    action_type: null,
    items: [],
    notes: ''
  };

  localStorage.removeItem('swapshop_kiosk_session');
  clearChat();
  setSaveIndicator('idle', 'Ready');
  renderStep1_StudentVsNonStudent();
}

function showResumeBanner(savedSession) {
  const banner = document.getElementById('sessionResumeBanner');
  const bannerText = document.getElementById('resumeBannerText');
  const btnResume = document.getElementById('btnResumeSession');
  const btnDiscard = document.getElementById('btnDiscardSession');

  bannerText.textContent = `Resume saved swap at Step ${savedSession.currentStep}?`;
  banner.style.display = 'block';

  btnResume.onclick = () => {
    banner.style.display = 'none';
    restoreSession(savedSession);
  };

  btnDiscard.onclick = () => {
    banner.style.display = 'none';
    startFreshSession();
  };
}

function restoreSession(saved) {
  State.sessionId = saved.sessionId;
  State.currentStep = saved.currentStep;
  State.sessionData = saved.sessionData || State.sessionData;

  clearChat();
  replaySavedChat();
}

async function saveStep(stepKey, stepName, stepPayload) {
  setSaveIndicator('saving', 'Saving...');
  State.currentStep = stepKey;

  if (stepPayload) {
    State.sessionData = { ...State.sessionData, ...stepPayload };
  }

  const sessionBlob = {
    sessionId: State.sessionId,
    currentStep: State.currentStep,
    sessionData: State.sessionData,
    savedAt: new Date().toISOString()
  };
  localStorage.setItem('swapshop_kiosk_session', JSON.stringify(sessionBlob));

  try {
    const res = await fetch('/api/session/step', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: State.sessionId,
        step: String(stepKey),
        stepName: stepName,
        stepData: stepPayload,
        fullSession: State.sessionData
      })
    });

    if (res.ok) {
      setSaveIndicator('saved', 'Saved');
    } else {
      setSaveIndicator('saved', 'Saved locally');
    }
  } catch (err) {
    setSaveIndicator('saved', 'Saved locally');
  }
}

function setSaveIndicator(status, text) {
  const pill = document.getElementById('saveIndicator');
  const icon = document.getElementById('saveIcon');
  const label = document.getElementById('saveText');

  pill.className = `save-status-pill ${status}`;
  label.textContent = text;

  if (status === 'saving') {
    icon.className = 'ph ph-arrow-clockwise';
  } else if (status === 'saved') {
    icon.className = 'ph ph-check-circle';
  } else {
    icon.className = 'ph ph-cloud-check';
  }
}

// ==========================================================================
// GUIDED CONVERSATIONAL STEPS
// ==========================================================================

/** Step 1: Student vs Non-Student */
function renderStep1_StudentVsNonStudent() {
  addBotMessage({
    text: "Welcome to Global Belongings! Let's get your swap recorded in a few quick steps. Are you a student or visiting as a non-student / community member?",
    options: [
      {
        id: 'opt-student',
        title: 'Student',
        desc: 'University or college student',
        icon: 'ph-graduation-cap',
        action: () => handleStep1Choice('student', 'Student')
      },
      {
        id: 'opt-nonstudent',
        title: 'Non-Student',
        desc: 'Staff, visitor, or local resident',
        icon: 'ph-user',
        action: () => handleStep1Choice('non-student', 'Non-Student')
      }
    ]
  });
}

async function handleStep1Choice(value, label) {
  disableCurrentOptions();
  addUserMessage(`I am a ${label}`, '1');

  await saveStep('1', 'Student vs Non-Student', { user_type: value });

  showTyping();
  setTimeout(() => {
    hideTyping();
    if (value === 'student') {
      renderStep2_1_International();
    } else {
      addBotMessage({
        text: "Thank you for supporting community reuse! As a community member, let's jump straight to your swap items.",
        options: null
      });
      setTimeout(() => renderStep3_ActionType(), 350);
    }
  }, 350);
}

/** Step 2.1: International vs Domestic */
function renderStep2_1_International() {
  addBotMessage({
    text: "Great! Are you an international student studying from abroad, or a domestic/home student?",
    options: [
      {
        id: 'opt-intl',
        title: 'International Student',
        desc: 'Studying abroad on visa / exchange',
        icon: 'ph-globe-hemisphere-west',
        action: () => handleStep2_1Choice('international', 'International Student')
      },
      {
        id: 'opt-dom',
        title: 'Domestic / Home Student',
        desc: 'Local or home country resident',
        icon: 'ph-house-line',
        action: () => handleStep2_1Choice('domestic', 'Domestic / Home Student')
      }
    ]
  });
}

async function handleStep2_1Choice(value, label) {
  disableCurrentOptions();
  addUserMessage(label, '2.1');

  await saveStep('2.1', 'International Status', { is_international: value });

  showTyping();
  setTimeout(() => {
    hideTyping();
    renderStep2_2_Accommodation();
  }, 350);
}

/** Step 2.2: Accommodation */
function renderStep2_2_Accommodation() {
  const options = [
    {
      id: 'acc-private',
      title: 'Private Accommodation',
      desc: 'Private rented flat, house share, or family home',
      icon: 'ph-house-simple',
      action: () => handleStep2_2Choice('Private Accommodation')
    },
    ...KIOSK_ACCOMMODATIONS.map(hall => ({
      id: `acc-${hall.id}`,
      title: hall.name,
      desc: hall.desc,
      icon: hall.icon,
      action: () => handleStep2_2Choice(hall.name)
    })),
    {
      id: 'acc-other',
      title: 'Other Accommodation',
      desc: 'Commuter, homestay, or other residence',
      icon: 'ph-dots-three-circle',
      action: (btn) => showOtherAccommodationInput(btn)
    }
  ];

  addBotMessage({
    text: "Where are you currently living during your studies?",
    options
  });
}

function showOtherAccommodationInput(btn) {
  const container = btn.closest('.chat-interactive-options');
  if (!container) return;

  container.innerHTML = `
    <div class="option-custom-input-box">
      <input type="text" id="inputOtherAccom" placeholder="Type residence name..." autofocus />
      <button class="btn btn-primary btn-sm" id="btnConfirmOtherAccom">Continue</button>
    </div>
  `;

  const input = document.getElementById('inputOtherAccom');
  const confirmBtn = document.getElementById('btnConfirmOtherAccom');

  const submitCustom = () => {
    const val = input.value.trim() || 'Other Residence';
    handleStep2_2Choice(val);
  };

  confirmBtn.onclick = submitCustom;
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') submitCustom();
  });
}

async function handleStep2_2Choice(choiceText) {
  disableCurrentOptions();
  addUserMessage(`Living in: ${choiceText}`, '2.2');

  await saveStep('2.2', 'Accommodation Type', { accommodation: choiceText });

  showTyping();
  setTimeout(() => {
    hideTyping();
    renderStep2_3_StayDuration();
  }, 350);
}

/** Step 2.3: Stay Duration */
function renderStep2_3_StayDuration() {
  const options = STAY_DURATIONS.map(dur => ({
    id: `dur-${dur.id}`,
    title: dur.label,
    desc: dur.desc,
    icon: dur.icon,
    action: () => handleStep2_3Choice(dur.label)
  }));

  addBotMessage({
    text: "How long do you plan to stay in the city / university?",
    options
  });
}

async function handleStep2_3Choice(durationLabel) {
  disableCurrentOptions();
  addUserMessage(`Planned stay: ${durationLabel}`, '2.3');

  await saveStep('2.3', 'Stay Duration', { stay_duration: durationLabel });

  showTyping();
  setTimeout(() => {
    hideTyping();
    renderStep3_ActionType();
  }, 350);
}

/** Step 3: Action Type (WITH HEARTFELT THANK-YOU RESPONSES) */
function renderStep3_ActionType() {
  addBotMessage({
    text: "What brings you to the Swap Shop today?",
    options: [
      {
        id: 'act-dropoff',
        title: 'Drop-off (Donate Items)',
        desc: 'Passing on reusable kitchenware, study gear, clothes or bedding',
        icon: 'ph-tray-arrow-down',
        action: () => handleStep3Choice('drop-off', 'Drop-off (Donating items)')
      },
      {
        id: 'act-pickup',
        title: 'Pick-up (Take Items)',
        desc: 'Taking free essentials for your room or study',
        icon: 'ph-tray-arrow-up',
        action: () => handleStep3Choice('pick-up', 'Pick-up (Taking items)')
      },
      {
        id: 'act-return',
        title: 'Return (Borrow / Reusable)',
        desc: 'Returning borrowed lamps, fans, or reusable items',
        icon: 'ph-arrows-clockwise',
        action: () => handleStep3Choice('return', 'Return (Bringing items back)')
      }
    ]
  });
}

async function handleStep3Choice(actionType, actionLabel) {
  disableCurrentOptions();
  addUserMessage(actionLabel, '3');

  await saveStep('3', 'Swap Action Type', { action_type: actionType });

  showTyping();
  setTimeout(() => {
    hideTyping();

    // Heartfelt thank you responses
    if (actionType === 'drop-off') {
      addBotMessage({
        text: "Thank you so much for donating and giving your items a second life! 🌿💚 Your generous drop-off keeps student essentials circulating and prevents landfill waste.",
        options: null
      });
    } else if (actionType === 'return') {
      addBotMessage({
        text: "Thank you so much for returning these reusable items! 🔄✨ By returning them in good reusable condition, another student can now borrow them. You're a true sustainability champion!",
        options: null
      });
    } else {
      addBotMessage({
        text: "Awesome! Let's get what you need logged so our shelves stay accurate and organized for everyone.",
        options: null
      });
    }

    setTimeout(() => {
      renderStep4_InteractiveItemCardInChat();
    }, 400);
  }, 350);
}

// ==========================================================================
// STEP 4: INTERACTIVE ITEM CARD RENDERED DIRECTLY INSIDE CHAT WINDOW
// ==========================================================================
function renderStep4_InteractiveItemCardInChat() {
  const action = State.sessionData.action_type || 'drop-off';
  const actionWord = action === 'drop-off' ? 'drop off' : (action === 'pick-up' ? 'pick up' : 'return');

  const thread = document.getElementById('chatThread');
  const cardRow = document.createElement('div');
  cardRow.className = 'chat-row bot';
  cardRow.id = 'step4ChatRow';

  cardRow.innerHTML = `
    <div class="chat-avatar bot"><img src="images/logo-square.png" alt=""></div>
    <div class="chat-bubble-content" style="max-width: 96%; width: 100%;">
      <div class="bubble-text">
        Almost done! <strong>(Optional)</strong> What did you ${actionWord}? Type generic items or synonyms below (e.g. <em>"2 mugs"</em>, <em>"1 plate"</em>, <em>"3 spoons"</em>, <em>"pillow"</em>, <em>"fork"</em>).
      </div>

      <!-- IN-CHAT INTERACTIVE CARD -->
      <div class="chat-item-interactive-card">
        <div class="chat-item-header">
          <span class="badge-assistant"><i class="ph ph-sparkle"></i> Smart Synonym Assistant</span>
          <span class="hint-text">Auto-matches generic catalog items</span>
        </div>

        <!-- Input Bar inside chat -->
        <div class="chat-input-bar">
          <div class="field-qty">
            <label for="chatInputQty">Qty</label>
            <input type="number" id="chatInputQty" min="1" max="99" value="1" />
          </div>
          <div class="field-item">
            <label for="chatInputName">Generic Item or Synonym</label>
            <div class="input-icon-wrap">
              <i class="ph ph-magnifying-glass"></i>
              <input type="text" id="chatInputName" placeholder="e.g. fork, plate, cup, pan..." autocomplete="off" />
              <button type="button" class="btn-clear-txt" id="chatBtnClear" style="display: none;">
                <i class="ph ph-x"></i>
              </button>
            </div>

            <!-- Autocomplete popup -->
            <div class="chat-suggestions-dropdown" id="chatSuggDropdown" style="display: none;"></div>
          </div>

          <button type="button" class="btn-chat-add" id="chatBtnAdd">
            <i class="ph ph-plus-circle"></i> Add
          </button>
        </div>

        <!-- Quick Generic Chips -->
        <div class="quick-generic-chips">
          <span class="chip-label-txt">Quick generic:</span>
          <button type="button" class="quick-item-chip" data-q="Mug"><i class="ph ph-coffee"></i> 1x Mug</button>
          <button type="button" class="quick-item-chip" data-q="Plate"><i class="ph ph-circle"></i> 1x Plate</button>
          <button type="button" class="quick-item-chip" data-q="Fork"><i class="ph ph-fork-knife"></i> 1x Fork</button>
          <button type="button" class="quick-item-chip" data-q="Spoon"><i class="ph ph-fork-knife"></i> 1x Spoon</button>
          <button type="button" class="quick-item-chip" data-q="Knife"><i class="ph ph-fork-knife"></i> 1x Knife</button>
          <button type="button" class="quick-item-chip" data-q="Kettle"><i class="ph ph-cooking-pot"></i> 1x Kettle</button>
          <button type="button" class="quick-item-chip" data-q="Pillow"><i class="ph ph-bed"></i> 1x Pillow</button>
          <button type="button" class="quick-item-chip" data-q="Lamp"><i class="ph ph-lamp"></i> 1x Lamp</button>
        </div>

        <!-- Selected items inside card -->
        <div class="chat-selected-items-box" id="chatSelectedItemsBox">
          <div class="selected-header-row">
            <span><i class="ph ph-shopping-bag-open"></i> Items in this swap (<span id="chatItemCount">0</span>)</span>
            <span class="saved-step-chip"><i class="ph ph-check-circle"></i> Auto-saved</span>
          </div>
          <div id="chatSelectedList" style="display: flex; flex-direction: column; gap: 0.35rem;">
            <div class="empty-items-notice" style="font-size: 0.78rem; color: var(--text-muted); text-align: center; padding: 0.4rem;">
              No items added yet. Search above or skip if no specific item.
            </div>
          </div>
        </div>

        <!-- Bottom Actions -->
        <div class="chat-card-actions">
          <button type="button" class="btn-skip" id="btnChatSkip">
            <i class="ph ph-skip-forward"></i> Skip (General Visit)
          </button>
          <button type="button" class="btn-complete" id="btnChatComplete">
            <i class="ph ph-check"></i> Complete Swap <i class="ph ph-arrow-right"></i>
          </button>
        </div>

      </div>
    </div>
  `;

  thread.appendChild(cardRow);
  scrollChatBottom();

  // Attach card event handlers
  initChatCardHandlers(cardRow);
}

function initChatCardHandlers(cardRow) {
  const inputQty = cardRow.querySelector('#chatInputQty');
  const inputName = cardRow.querySelector('#chatInputName');
  const btnAdd = cardRow.querySelector('#chatBtnAdd');
  const btnClear = cardRow.querySelector('#chatBtnClear');
  const dropdown = cardRow.querySelector('#chatSuggDropdown');
  const btnSkip = cardRow.querySelector('#btnChatSkip');
  const btnComplete = cardRow.querySelector('#btnChatComplete');

  inputName.addEventListener('input', () => {
    const txt = inputName.value.trim();
    if (txt) {
      btnClear.style.display = 'block';
      handleChatTyping(txt, inputQty, dropdown);
    } else {
      btnClear.style.display = 'none';
      dropdown.style.display = 'none';
    }
  });

  btnClear.onclick = () => {
    inputName.value = '';
    btnClear.style.display = 'none';
    dropdown.style.display = 'none';
    inputName.focus();
  };

  inputName.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const first = dropdown.querySelector('.sugg-row');
      if (dropdown.style.display !== 'none' && first) {
        first.click();
      } else {
        addFromChatInputs(inputQty, inputName, dropdown, btnClear);
      }
    }
  });

  btnAdd.onclick = () => addFromChatInputs(inputQty, inputName, dropdown, btnClear);

  // Quick chips
  cardRow.querySelectorAll('.quick-item-chip').forEach(chip => {
    chip.onclick = () => {
      const q = chip.getAttribute('data-q');
      const matched = findBestInventoryMatch(q);
      if (matched) {
        addItemToSwap(matched.item, 1, matched.synonymMatched);
      } else {
        addItemToSwap({ title: q, category: 'General', icon: 'ph-package' }, 1);
      }
    };
  });

  btnSkip.onclick = async () => {
    cardRow.remove();
    addUserMessage("I have no specific items to log (General Visit)", '4');
    await saveStep('4', 'Items (Skipped)', { items: [] });
    finalizeKioskSwap();
  };

  btnComplete.onclick = () => {
    finalizeKioskSwap();
  };

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.field-item')) {
      dropdown.style.display = 'none';
    }
  });
}

function parseAmountAndItem(rawText) {
  let cleaned = rawText.trim();
  let parsedAmount = 1;
  let parsedItem = cleaned;

  const digitMatch = cleaned.match(/^(\d+)\s*(?:x\s*)?(.*)$/i);
  if (digitMatch) {
    parsedAmount = Math.max(1, parseInt(digitMatch[1], 10));
    parsedItem = digitMatch[2].trim();
    return { amount: parsedAmount, itemName: parsedItem };
  }

  const lower = cleaned.toLowerCase();
  for (const [word, num] of Object.entries(NUMBER_WORDS)) {
    if (lower.startsWith(word + ' ')) {
      parsedAmount = num;
      parsedItem = cleaned.substring(word.length).trim();
      return { amount: parsedAmount, itemName: parsedItem };
    }
  }

  return { amount: 1, itemName: parsedItem };
}

function handleChatTyping(rawInput, inputQty, dropdown) {
  const { amount, itemName } = parseAmountAndItem(rawInput);
  if (amount > 1) inputQty.value = amount;

  const query = (itemName || rawInput).toLowerCase().trim();
  if (!query) {
    dropdown.style.display = 'none';
    return;
  }

  const matches = [];
  State.inventory.forEach(item => {
    const titleLower = item.title.toLowerCase();
    let isMatch = false;
    let synMatch = null;

    if (titleLower.includes(query) || query.includes(titleLower)) {
      isMatch = true;
    } else if (item.synonyms && Array.isArray(item.synonyms)) {
      for (const s of item.synonyms) {
        if (s.toLowerCase().includes(query) || query.includes(s.toLowerCase())) {
          isMatch = true;
          synMatch = s;
          break;
        }
      }
    }

    if (isMatch) matches.push({ item, synonymMatched: synMatch });
  });

  if (matches.length === 0) {
    dropdown.innerHTML = `
      <div class="sugg-row" id="chatBtnCustom">
        <div class="sugg-left-box">
          <i class="ph ph-plus-circle"></i>
          <div>
            <div class="sugg-title-txt">Log generic item: <strong>"${escapeHtml(itemName || rawInput)}"</strong></div>
          </div>
        </div>
      </div>
    `;
    dropdown.style.display = 'block';

    const customBtn = document.getElementById('chatBtnCustom');
    if (customBtn) {
      customBtn.onclick = () => {
        const amt = parseInt(inputQty.value, 10) || 1;
        addItemToSwap({
          id: null,
          title: itemName || rawInput,
          category: 'Miscellaneous',
          icon: 'ph-package'
        }, amt);
        inputQty.value = '1';
        dropdown.parentElement.querySelector('input').value = '';
        dropdown.style.display = 'none';
      };
    }
    return;
  }

  dropdown.innerHTML = matches.slice(0, 5).map(({ item, synonymMatched }) => {
    const synTag = synonymMatched ? `<span class="sugg-syn-badge">Synonym: "${escapeHtml(synonymMatched)}"</span>` : '';
    const stockPill = item.quantity > 0
      ? `<span class="stock-pill in-stock">${item.quantity} in stock</span>`
      : `<span class="stock-pill out-stock">Out of stock</span>`;

    return `
      <div class="sugg-row" data-id="${item.id}" data-syn="${synonymMatched || ''}">
        <div class="sugg-left-box">
          <i class="ph ${item.icon || 'ph-package'}"></i>
          <div>
            <span class="sugg-title-txt">${escapeHtml(item.title)}</span>
            ${synTag}
          </div>
        </div>
        <div>${stockPill}</div>
      </div>
    `;
  }).join('');

  dropdown.style.display = 'block';

  dropdown.querySelectorAll('.sugg-row').forEach(row => {
    row.onclick = () => {
      const itemId = row.getAttribute('data-id');
      const item = State.inventory.find(i => i.id === itemId);
      const syn = row.getAttribute('data-syn');
      const amt = parseInt(inputQty.value, 10) || 1;

      if (item) addItemToSwap(item, amt, syn);
      inputQty.value = '1';
      dropdown.parentElement.querySelector('input').value = '';
      dropdown.style.display = 'none';
    };
  });
}

function findBestInventoryMatch(query) {
  const q = query.toLowerCase().trim();
  for (const item of State.inventory) {
    if (item.title.toLowerCase() === q || item.title.toLowerCase().includes(q)) {
      return { item, synonymMatched: null };
    }
    if (item.synonyms) {
      for (const s of item.synonyms) {
        if (s.toLowerCase() === q || s.toLowerCase().includes(q) || q.includes(s.toLowerCase())) {
          return { item, synonymMatched: s };
        }
      }
    }
  }
  return null;
}

function addFromChatInputs(inputQty, inputName, dropdown, btnClear) {
  const raw = inputName.value.trim();
  if (!raw) return;

  const { amount, itemName } = parseAmountAndItem(raw);
  const finalAmt = Math.max(1, parseInt(inputQty.value, 10) || amount);

  const matched = findBestInventoryMatch(itemName || raw);
  if (matched) {
    addItemToSwap(matched.item, finalAmt, matched.synonymMatched);
  } else {
    addItemToSwap({
      id: null,
      title: itemName || raw,
      category: 'Miscellaneous',
      icon: 'ph-package'
    }, finalAmt);
  }

  inputQty.value = '1';
  inputName.value = '';
  btnClear.style.display = 'none';
  dropdown.style.display = 'none';
}

async function addItemToSwap(item, amount = 1, synonymTag = null) {
  const existingIdx = State.sessionData.items.findIndex(
    it => (item.id && it.id === item.id) || it.title.toLowerCase() === item.title.toLowerCase()
  );

  if (existingIdx !== -1) {
    State.sessionData.items[existingIdx].amount += amount;
  } else {
    State.sessionData.items.push({
      id: item.id || null,
      title: item.title,
      amount,
      category: item.category || 'Miscellaneous',
      icon: item.icon || 'ph-package',
      weight_kg: item.weight_kg || 0.5,
      est_value_eur: item.est_value_eur || 10.0,
      co2_factor: item.co2_factor || 2.0,
      synonym_detected: synonymTag || null
    });
  }

  renderChatSelectedItems();
  await saveStep('4', 'Item Added', { items: State.sessionData.items });
}

function renderChatSelectedItems() {
  const list = document.getElementById('chatSelectedList');
  const countBadge = document.getElementById('chatItemCount');
  const items = State.sessionData.items;

  if (countBadge) countBadge.textContent = items.length;
  if (!list) return;

  if (items.length === 0) {
    list.innerHTML = `
      <div class="empty-items-notice" style="font-size: 0.78rem; color: var(--text-muted); text-align: center; padding: 0.4rem;">
        No items added yet. Search above or skip if no specific item.
      </div>
    `;
    return;
  }

  list.innerHTML = items.map((it, idx) => {
    const synTag = it.synonym_detected ? `<span class="sugg-syn-badge">Synonym: "${escapeHtml(it.synonym_detected)}"</span>` : '';

    return `
      <div class="selected-item-row">
        <div class="selected-item-info">
          <i class="ph ${it.icon || 'ph-package'}"></i>
          <div>
            <span class="item-name">${escapeHtml(it.title)}</span>
            ${synTag}
          </div>
        </div>

        <div style="display: flex; align-items: center; gap: 0.35rem;">
          <div class="qty-control">
            <button type="button" class="btn-qty btn-kiosk-dec" data-idx="${idx}"><i class="ph ph-minus"></i></button>
            <span class="qty-val">${it.amount}</span>
            <button type="button" class="btn-qty btn-kiosk-inc" data-idx="${idx}"><i class="ph ph-plus"></i></button>
          </div>
          <button type="button" class="btn-del-item btn-kiosk-del" data-idx="${idx}"><i class="ph ph-trash"></i></button>
        </div>
      </div>
    `;
  }).join('');

  list.querySelectorAll('.btn-kiosk-inc').forEach(b => {
    b.onclick = async () => {
      const idx = parseInt(b.getAttribute('data-idx'), 10);
      State.sessionData.items[idx].amount++;
      renderChatSelectedItems();
      await saveStep('4', 'Item Qty Increased', { items: State.sessionData.items });
    };
  });

  list.querySelectorAll('.btn-kiosk-dec').forEach(b => {
    b.onclick = async () => {
      const idx = parseInt(b.getAttribute('data-idx'), 10);
      if (State.sessionData.items[idx].amount > 1) {
        State.sessionData.items[idx].amount--;
      } else {
        State.sessionData.items.splice(idx, 1);
      }
      renderChatSelectedItems();
      await saveStep('4', 'Item Qty Adjusted', { items: State.sessionData.items });
    };
  });

  list.querySelectorAll('.btn-kiosk-del').forEach(b => {
    b.onclick = async () => {
      const idx = parseInt(b.getAttribute('data-idx'), 10);
      State.sessionData.items.splice(idx, 1);
      renderChatSelectedItems();
      await saveStep('4', 'Item Removed', { items: State.sessionData.items });
    };
  });
}

/**
 * FINALIZE KIOSK SWAP & SHOW RECEIPT
 */
async function finalizeKioskSwap() {
  const cardRow = document.getElementById('step4ChatRow');
  if (cardRow) cardRow.remove();
  document.querySelectorAll('.chat-change-btn').forEach(b => b.remove());

  // Add user summary bubble
  const summaryText = State.sessionData.items.length > 0
    ? `Items: ${State.sessionData.items.map(i => `${i.amount}x ${i.title}`).join(', ')}`
    : 'Swap completed without itemized list';
  addUserMessage(summaryText, '4');

  showTyping();

  try {
    const res = await fetch('/api/session/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: State.sessionId,
        sessionData: State.sessionData
      })
    });

    const result = await res.json();
    hideTyping();

    if (result.success) {
      renderReceiptBox(result.transaction);
      localStorage.removeItem('swapshop_kiosk_session');
    }
  } catch (err) {
    hideTyping();
    // Offline fallback receipt
    renderReceiptBox({
      id: `tx-${Date.now()}`,
      timestamp: new Date().toISOString(),
      ...State.sessionData,
      weight_diverted_kg: (State.sessionData.items.length * 0.5).toFixed(1),
      value_saved_eur: (State.sessionData.items.length * 10.0).toFixed(2),
      co2_saved_kg: (State.sessionData.items.length * 1.5).toFixed(1)
    });
    localStorage.removeItem('swapshop_kiosk_session');
  }
}

/**
 * RENDER THE CLEAN RECEIPT BOX
 * Note: Only "Print Receipt Slip" is shown.
 * "View in Split Admin" and extra buttons are removed!
 */
function renderReceiptBox(tx) {
  const thread = document.getElementById('chatThread');
  const card = document.createElement('div');
  card.className = 'receipt-card';
  card.id = 'printableReceiptBox';

  const userTypeLbl = State.sessionData.user_type === 'student'
    ? `Student (${State.sessionData.is_international === 'international' ? 'International' : 'Domestic'})`
    : 'Non-Student / Community';

  let actionBadge = '';
  let thankBanner = '';

  if (tx.action_type === 'drop-off') {
    actionBadge = '<span style="color: #059669;"><i class="ph ph-tray-arrow-down"></i> Drop-off</span>';
    thankBanner = `
      <div class="receipt-thank-banner drop-off">
        <i class="ph ph-hand-heart"></i>
        <div>
          <strong>Thank you so much for donating!</strong><br>
          Your generous drop-off directly benefits fellow students and diverts valuable items from landfill.
        </div>
      </div>
    `;
  } else if (tx.action_type === 'return') {
    actionBadge = '<span style="color: #d97706;"><i class="ph ph-arrows-clockwise"></i> Return</span>';
    thankBanner = `
      <div class="receipt-thank-banner return">
        <i class="ph ph-recycle"></i>
        <div>
          <strong>Thank you so much for returning reusable items!</strong><br>
          By returning items in clean condition, another student can borrow them. You are a circular champion!
        </div>
      </div>
    `;
  } else {
    actionBadge = '<span style="color: #0284c7;"><i class="ph ph-tray-arrow-up"></i> Pick-up</span>';
    thankBanner = `
      <div class="receipt-thank-banner pick-up">
        <i class="ph ph-sparkle"></i>
        <div>
          <strong>Enjoy your items!</strong><br>
          Remember to reuse, care for them, and pass them forward or return them when finished.
        </div>
      </div>
    `;
  }

  const itemsHtml = (tx.items && tx.items.length > 0)
    ? tx.items.map(it => `
        <div class="receipt-item-pill">
          <span><strong>${it.amount}x</strong> ${escapeHtml(it.title)}</span>
          <span style="font-size: 0.72rem; color: var(--text-muted);">${escapeHtml(it.category || 'Item')}</span>
        </div>
      `).join('')
    : '<div style="font-size: 0.8rem; color: var(--text-muted); padding: 0.25rem;">General visit (no specific items itemized)</div>';

  card.innerHTML = `
    <!-- Thank you banner -->
    ${thankBanner}

    <div class="receipt-header">
      <div class="receipt-success-icon"><i class="ph ph-check-circle"></i></div>
      <div>
        <div class="receipt-title">Swap Logged Successfully!</div>
        <div class="receipt-sub">Receipt Ref: ${tx.id || 'TX-SUCCESS'} • ${new Date().toLocaleTimeString()}</div>
      </div>
    </div>

    <div class="receipt-grid">
      <div>
        <div class="receipt-field-label">User Profile</div>
        <div class="receipt-field-val">${escapeHtml(userTypeLbl)}</div>
      </div>
      <div>
        <div class="receipt-field-label">Accommodation</div>
        <div class="receipt-field-val">${escapeHtml(State.sessionData.accommodation || 'N/A')}</div>
      </div>
      <div>
        <div class="receipt-field-label">Stay Duration</div>
        <div class="receipt-field-val">${escapeHtml(State.sessionData.stay_duration || 'N/A')}</div>
      </div>
      <div>
        <div class="receipt-field-label">Action Type</div>
        <div class="receipt-field-val">${actionBadge}</div>
      </div>
    </div>

    <div class="receipt-items-summary">
      <h5>Processed Items (${tx.items ? tx.items.length : 0}):</h5>
      ${itemsHtml}
    </div>

    <div class="receipt-impact-box">
      <div class="impact-metric">
        <div class="val">${tx.weight_diverted_kg || 0.5} kg</div>
        <div class="lbl">Landfill Diverted</div>
      </div>
      <div class="impact-metric">
        <div class="val">€${tx.value_saved_eur || 10.0}</div>
        <div class="lbl">Student Value Saved</div>
      </div>
      <div class="impact-metric">
        <div class="val">${tx.co2_saved_kg || ((tx.weight_diverted_kg || 0.5) * 2.8).toFixed(1)} kg</div>
        <div class="lbl">CO₂e Avoided</div>
      </div>
    </div>

    <!-- Print button ONLY (Hidden on printout) -->
    <div class="receipt-actions">
      <button class="btn-print-receipt" onclick="window.print()">
        <i class="ph ph-printer"></i> Print Receipt Slip
      </button>
    </div>
  `;

  thread.appendChild(card);
  scrollChatBottom();
}

// ==========================================================================
// CHAT UTILITIES
// ==========================================================================
function clearChat() {
  document.getElementById('chatThread').innerHTML = '';
}

function addBotMessage({ text, options = null }) {
  const thread = document.getElementById('chatThread');
  const row = document.createElement('div');
  row.className = 'chat-row bot';

  let optionsHtml = '';
  if (options && Array.isArray(options)) {
    optionsHtml = `
      <div class="chat-interactive-options">
        ${options.map((opt, idx) => `
          <button type="button" class="option-card-btn" id="${opt.id || 'opt-' + idx}">
            <div class="option-icon"><i class="ph ${opt.icon || 'ph-check'}"></i></div>
            <div class="option-text-group">
              <span class="option-title">${escapeHtml(opt.title)}</span>
              ${opt.desc ? `<span class="option-desc">${escapeHtml(opt.desc)}</span>` : ''}
            </div>
          </button>
        `).join('')}
      </div>
    `;
  }

  row.innerHTML = `
    <div class="chat-avatar bot"><img src="images/logo-square.png" alt=""></div>
    <div class="chat-bubble-content">
      <div class="bubble-text">${text}</div>
      ${optionsHtml}
      <div class="bubble-meta">
        <span>Global Belongings Assistant</span>
        <span>•</span>
        <span>${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
      </div>
    </div>
  `;

  thread.appendChild(row);

  if (options && Array.isArray(options)) {
    options.forEach((opt, idx) => {
      const btn = row.querySelector(`#${opt.id || 'opt-' + idx}`);
      if (btn && opt.action) btn.onclick = () => opt.action(btn);
    });
  }

  scrollChatBottom();
}

function addUserMessage(text, stepNumber = null) {
  const thread = document.getElementById('chatThread');
  const row = document.createElement('div');
  row.className = 'chat-row user';

  const savedBadge = stepNumber
    ? `<span class="saved-step-chip"><i class="ph ph-check-circle"></i> Step ${stepNumber} Saved</span>`
    : '';

  const canChange = ['1', '2.1', '2.2', '2.3', '3'].includes(stepNumber);
  const changeBtn = canChange
    ? `<button type="button" class="chat-change-btn" data-change-step="${stepNumber}" title="Change this answer"><i class="ph ph-pencil-simple"></i> Change</button>`
    : '';

  row.innerHTML = `
    <div class="chat-avatar user"><i class="ph ph-user"></i></div>
    <div class="chat-bubble-content">
      <div class="bubble-text">${escapeHtml(text)}</div>
      <div class="bubble-meta">
        ${savedBadge}
        ${changeBtn}
        <span>${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
      </div>
    </div>
  `;

  if (canChange) {
    row.querySelector('.chat-change-btn').onclick = () => changeStepAnswer(stepNumber);
  }

  thread.appendChild(row);
  rearmPastOptionCards();
  scrollChatBottom();
}

function disableCurrentOptions() {
  document.querySelectorAll('.option-card-btn').forEach(b => {
    b.disabled = true;
  });
}

/**
 * Re-arm the option cards of questions that already have a saved answer, so
 * tapping a previous response anywhere in the (scrolled) history opens the
 * same change flow as the "Change" chip on the message.
 */
function rearmPastOptionCards() {
  const thread = document.getElementById('chatThread');
  if (!thread) return;
  thread.querySelectorAll('.chat-row.user').forEach(userRow => {
    const stepBtn = userRow.querySelector('[data-change-step]');
    if (!stepBtn) return;
    let el = userRow.previousElementSibling;
    while (el) {
      const btns = el.querySelectorAll ? el.querySelectorAll('.option-card-btn') : [];
      if (btns.length) {
        const step = stepBtn.getAttribute('data-change-step');
        btns.forEach(b => {
          b.disabled = false;
          b.classList.add('option-past');
          b.title = 'Change this answer';
          b.onclick = () => changeStepAnswer(step);
        });
        return;
      }
      el = el.previousElementSibling;
    }
  });
}

function showTyping() {
  const ind = document.getElementById('typingIndicator');
  if (ind) ind.style.display = 'flex';
  scrollChatBottom();
}

function hideTyping() {
  const ind = document.getElementById('typingIndicator');
  if (ind) ind.style.display = 'none';
}

function scrollChatBottom() {
  const win = document.getElementById('cfChatWindow');
  if (win) {
    setTimeout(() => {
      win.scrollTop = win.scrollHeight;
    }, 40);
  }
}

function replaySavedChat() {
  const d = State.sessionData;
  if (d.user_type) {
    addBotMessage({ text: "Welcome back! Resuming your saved swap.", options: null });
    addUserMessage(`I am a ${d.user_type === 'student' ? 'Student' : 'Non-Student'}`, '1');
  }
  if (d.is_international) {
    addUserMessage(d.is_international === 'international' ? 'International Student' : 'Domestic / Home Student', '2.1');
  }
  if (d.accommodation) {
    addUserMessage(`Living in: ${d.accommodation}`, '2.2');
  }
  if (d.stay_duration) {
    addUserMessage(`Planned stay: ${d.stay_duration}`, '2.3');
  }
  if (d.action_type) {
    addUserMessage(`Action: ${d.action_type}`, '3');
  }

  if (!d.user_type) {
    renderStep1_StudentVsNonStudent();
  } else if (d.user_type === 'student' && !d.is_international) {
    renderStep2_1_International();
  } else if (d.user_type === 'student' && !d.accommodation) {
    renderStep2_2_Accommodation();
  } else if (d.user_type === 'student' && !d.stay_duration) {
    renderStep2_3_StayDuration();
  } else if (!d.action_type) {
    renderStep3_ActionType();
  } else {
    renderStep4_InteractiveItemCardInChat();
  }
}

const KIOSK_STEP_ORDER = ['1', '2.1', '2.2', '2.3', '3', '4'];

window.changeStepAnswer = function (stepKey) {
  stepKey = String(stepKey);
  const idx = KIOSK_STEP_ORDER.indexOf(stepKey);
  if (idx === -1) return;
  if (!confirm('Change this answer? Any answers after it will be reset.')) return;
  const toClear = KIOSK_STEP_ORDER.slice(idx);
  const d = State.sessionData;
  if (toClear.includes('1')) d.user_type = null;
  if (toClear.includes('2.1')) d.is_international = null;
  if (toClear.includes('2.2')) d.accommodation = null;
  if (toClear.includes('2.3')) d.stay_duration = null;
  if (toClear.includes('3')) d.action_type = null;
  if (toClear.includes('4')) d.items = [];
  State.currentStep = stepKey;
  clearChat();
  replaySavedChat();
  try {
    localStorage.setItem('swapshop_kiosk_session', JSON.stringify({
      sessionId: State.sessionId,
      currentStep: State.currentStep,
      sessionData: State.sessionData,
      savedAt: new Date().toISOString()
    }));
  } catch (err) {}
};

async function loadInventory() {
  try {
    const res = await fetch('/api/inventory');
    const data = await res.json();
    if (data.success && data.items) {
      State.inventory = data.items;
    }
  } catch (err) {}
}

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
