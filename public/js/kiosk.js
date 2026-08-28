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
    if (value === 'non-student') {
      const d = State.sessionData;
      // Student-only answers no longer apply — clear them and remove their
      // chat rows when the user just changed their step-1 answer.
      const stepFields = { '2.1': 'is_international', '2.2': 'accommodation', '2.3': 'stay_duration' };
      Object.keys(stepFields).forEach(s => {
        if (d[stepFields[s]]) {
          d[stepFields[s]] = null;
          removeStepHistoryRow(s);
        }
      });
      addBotMessage({
        text: "Thank you for supporting community reuse! As a community member, let's jump straight to your swap items.",
        options: null
      });
    }
    proceedAfterChoice();
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

  proceedAfterChoice();
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

  proceedAfterChoice();
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

  proceedAfterChoice();
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

    proceedAfterChoice();
  }, 350);
}

// ==========================================================================
// STEP 4: INTERACTIVE ITEM CARD RENDERED DIRECTLY INSIDE CHAT WINDOW
// ==========================================================================
function renderStep4_InteractiveItemCardInChat() {
  const action = State.sessionData.action_type || 'drop-off';
  const actionWord = action === 'drop-off' ? 'drop off' : (action === 'pick-up' ? 'pick up' : 'return');

  const thread = document.getElementById('chatThread');
  // The flow can return to step 4 after an earlier answer change — replace
  // any previous card so the chat keeps one live card and unique IDs.
  const oldCard = thread.querySelector('#step4ChatRow');
  if (oldCard) oldCard.remove();
  const cardRow = document.createElement('div');
  cardRow.className = 'chat-row bot';
  cardRow.id = 'step4ChatRow';

  cardRow.innerHTML = `
    <div class="chat-avatar bot"><img src="images/logo-square.png" alt=""></div>
    <div class="chat-bubble-content" style="max-width: 96%; width: 100%;">
      <div class="bubble-text">
        Almost done! <strong>(Optional)</strong> What did you ${actionWord}? List your items below (e.g. <em>"3 mugs, 1 plate, 2 forks"</em>).
      </div>

      <!-- IN-CHAT INTERACTIVE CARD -->
      <div class="chat-item-interactive-card">
        <div class="chat-item-header">
          <span class="badge-assistant"><i class="ph ph-sparkle"></i> Smart Synonym Assistant</span>
          <span class="hint-text">Auto-matches generic catalog items</span>
        </div>

        <!-- Input Bar inside chat -->
        <div class="chat-input-bar">
          <div class="field-item">
            <label for="chatInputName">Your items — separate with commas</label>
            <div class="input-icon-wrap">
              <i class="ph ph-magnifying-glass"></i>
              <input type="text" id="chatInputName" placeholder="e.g. 3 mugs, 1 plate, 2 forks" autocomplete="off" />
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

        <div class="chat-list-hint">
          <i class="ph ph-list-magnifying-glasses"></i>
          List items separated by commas — e.g. <strong>3 mugs, 1 plate, 2 forks</strong> (the number sets the quantity)
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
  renderChatSelectedItems();
}

function initChatCardHandlers(cardRow) {
  const inputName = cardRow.querySelector('#chatInputName');
  const btnAdd = cardRow.querySelector('#chatBtnAdd');
  const btnClear = cardRow.querySelector('#chatBtnClear');
  const dropdown = cardRow.querySelector('#chatSuggDropdown');
  const btnSkip = cardRow.querySelector('#btnChatSkip');
  const btnComplete = cardRow.querySelector('#btnChatComplete');

  // Number of commas in the input at last check — when it grows, the
  // segments between the old and the new last comma are finished and get
  // committed (one per typed comma, the whole batch when pasted).
  let lastCommaCount = 0;

  inputName.addEventListener('input', () => {
    const val = inputName.value;
    const commaCount = (val.match(/,/g) || []).length;
    if (commaCount > lastCommaCount) {
      const finishedText = val.slice(0, val.lastIndexOf(',') + 1);
      const segs = getListSegments(finishedText);
      for (let i = lastCommaCount; i < commaCount; i++) {
        if (segs[i]) commitOneSegment(segs[i]);
      }
      dropdown.style.display = 'none';
    }
    lastCommaCount = commaCount;

    const seg = getActiveSegment(val);
    if (val.trim()) {
      btnClear.style.display = 'block';
      if (seg) handleChatTyping(inputName, dropdown);
      else dropdown.style.display = 'none';
    } else {
      btnClear.style.display = 'none';
      dropdown.style.display = 'none';
    }
  });

  btnClear.onclick = () => {
    inputName.value = '';
    lastCommaCount = 0;
    btnClear.style.display = 'none';
    dropdown.style.display = 'none';
    inputName.focus();
  };

  inputName.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const first = dropdown.querySelector('.sugg-row');
    if (dropdown.style.display !== 'none' && first) {
      first.click();
    } else if (getActiveSegment(inputName.value)) {
      commitActiveSegment(inputName, dropdown);
    } else {
      commitAllPendingSegments(inputName);
    }
  });

  btnAdd.onclick = () => {
    if (getActiveSegment(inputName.value)) commitActiveSegment(inputName, dropdown);
    else commitAllPendingSegments(inputName);
  };

  // Quick chips: one-tap items that also append to the list text, so the
  // input stays the single record of the swap.
  cardRow.querySelectorAll('.quick-item-chip').forEach(chip => {
    chip.onclick = () => {
      const label = chip.getAttribute('data-q');
      let v = inputName.value.replace(/\s*$/, '');
      if (v) v += ',';
      inputName.value = (v ? v + ' ' : '') + label + ', ';
      lastCommaCount = (inputName.value.match(/,/g) || []).length;
      commitOneSegment(label);
      btnClear.style.display = 'block';
      dropdown.style.display = 'none';
      inputName.focus();
    };
  });

  btnSkip.onclick = async () => {
    cardRow.remove();
    addUserMessage("I have no specific items to log (General Visit)", '4');
    await saveStep('4', 'Items (Skipped)', { items: [] });
    finalizeKioskSwap();
  };

  btnComplete.onclick = () => {
    commitAllPendingSegments(inputName).then(() => finalizeKioskSwap());
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

/* ------------------------------------------------------------------ *
 * List input (step 4): the user types a comma-separated list with
 * per-item quantities, e.g. "3 mugs, 1 plate, 2 forks".
 *   - each comma completes the current segment (item gets committed)
 *   - suggestions cover ONLY the active segment (text after the last
 *     comma) and show the finished segment, quantity included
 *   - clicking a suggestion rewrites only the active segment and
 *     appends ", " so typing momentum continues
 * ------------------------------------------------------------------ */

function getListSegments(text) {
  return String(text || '').split(',').map(s => s.trim()).filter(Boolean);
}

function getActiveSegment(text) {
  const t = String(text || '');
  const i = t.lastIndexOf(',');
  return (i === -1 ? t : t.slice(i + 1)).trim();
}

// Rewrite only the active segment (text after the last comma), keep
// everything typed before it, re-focus with the cursor at the end.
function setCompletedSegment(inputEl, segmentText) {
  if (!inputEl) return;
  const val = String(inputEl.value || '');
  const i = val.lastIndexOf(',');
  const head = i === -1 ? '' : val.slice(0, i + 1).replace(/\s*$/, '') + ' ';
  inputEl.value = head + segmentText + ', ';
  inputEl.focus();
  try {
    const L = inputEl.value.length;
    inputEl.setSelectionRange(L, L);
  } catch (err) {}
}

// Record a committed "qty|title" pair so the same segment is never
// committed twice (comma, then Enter, then Complete, ...).
function trackCommitted(amount, title) {
  if (!State.committedSegments) State.committedSegments = [];
  const key = amount + '|' + String(title).toLowerCase();
  if (State.committedSegments.includes(key)) return false;
  State.committedSegments.push(key);
  return true;
}

// Commit one finished segment to the swap list.
async function commitOneSegment(segment) {
  const seg = String(segment || '').trim();
  if (!seg) return false;
  const { amount, itemName } = parseAmountAndItem(seg);
  if (!itemName) return false;
  if (!trackCommitted(amount, itemName)) return false;
  const matched = findBestInventoryMatch(itemName);
  if (matched) {
    await addItemToSwap(matched.item, amount, matched.synonymMatched);
  } else {
    await addItemToSwap({
      id: null,
      title: itemName,
      category: 'Miscellaneous',
      icon: 'ph-package'
    }, amount);
  }
  return true;
}

// Commit every complete segment in the list (Enter / Add / Complete —
// e.g. after pasting a whole list at once).
async function commitAllPendingSegments(inputEl) {
  let addedAny = false;
  for (const seg of getListSegments(inputEl ? inputEl.value : '')) {
    if (await commitOneSegment(seg)) addedAny = true;
  }
  return addedAny;
}

// Commit the active segment and normalize the typed text
// ("2 pla" -> "2 Plate, "), then keep focus for the next item.
async function commitActiveSegment(inputEl, dropdown) {
  const seg = getActiveSegment(inputEl ? inputEl.value : '');
  if (!seg) return false;
  const { amount, itemName } = parseAmountAndItem(seg);
  if (!itemName) return false;
  const q = amount > 1 ? amount + ' ' : '';
  const matched = findBestInventoryMatch(itemName);
  const label = matched ? matched.item.title : itemName;
  setCompletedSegment(inputEl, q + label);
  if (dropdown) dropdown.style.display = 'none';
  const btnClear = document.getElementById('chatBtnClear');
  if (btnClear && inputEl.value) btnClear.style.display = 'block';
  if (trackCommitted(amount, label)) {
    if (matched) await addItemToSwap(matched.item, amount, matched.synonymMatched);
    else await addItemToSwap({ id: null, title: label, category: 'Miscellaneous', icon: 'ph-package' }, amount);
  }
  if (inputEl) inputEl.focus();
  return true;
}

function handleChatTyping(inputName, dropdown) {
  const segment = getActiveSegment(inputName ? inputName.value : '');
  const { amount, itemName } = parseAmountAndItem(segment);
  const query = (itemName || '').toLowerCase().trim();
  if (!query) {
    if (dropdown) dropdown.style.display = 'none';
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

  const newTitle = itemName || segment;
  const q = amount > 1 ? amount + ' ' : '';

  // The "log as a new item" row is ALWAYS available, even when pool
  // suggestions exist — a fuzzy match (e.g. "käse" vs "Käsemauken")
  // must never block adding the typed word as its own item.
  const customRowHtml = `
    <div class="sugg-row sugg-row-custom" id="chatBtnCustom">
      <div class="sugg-left-box">
        <i class="ph ph-plus-circle"></i>
        <div>
          <div class="sugg-title-txt">Add as a new item: <strong>"${escapeHtml(q + newTitle)}"</strong></div>
        </div>
      </div>
    </div>
  `;

  const wireCustomRow = () => {
    const customBtn = dropdown.querySelector('#chatBtnCustom');
    if (!customBtn) return;
    customBtn.onclick = () => {
      setCompletedSegment(inputName, q + newTitle);
      dropdown.style.display = 'none';
      if (trackCommitted(amount, newTitle)) {
        addItemToSwap({
          id: null,
          title: newTitle,
          category: 'Miscellaneous',
          icon: 'ph-package'
        }, amount);
      }
      const btnClear = document.getElementById('chatBtnClear');
      if (btnClear && inputName.value) btnClear.style.display = 'block';
      inputName.focus();
    };
  };

  if (matches.length === 0) {
    dropdown.innerHTML = customRowHtml;
    dropdown.style.display = 'block';
    wireCustomRow();
    return;
  }

  const visibleMatches = matches.slice(0, 4);
  dropdown.innerHTML = visibleMatches.map(({ item, synonymMatched }) => {
    const synTag = synonymMatched ? `<span class="sugg-syn-badge">Synonym: "${escapeHtml(synonymMatched)}"</span>` : '';
    const stockPill = item.quantity > 0
      ? `<span class="stock-pill in-stock">${item.quantity} in stock</span>`
      : `<span class="stock-pill out-stock">Out of stock</span>`;

    return `
      <div class="sugg-row" data-id="${item.id}" data-syn="${synonymMatched || ''}">
        <div class="sugg-left-box">
          <i class="ph ${item.icon || 'ph-package'}"></i>
          <div>
            <span class="sugg-title-txt">${q}${escapeHtml(item.title)}</span>
            ${synTag}
          </div>
        </div>
        <div>${stockPill}</div>
      </div>
    `;
  }).join('') + customRowHtml;

  dropdown.style.display = 'block';

  dropdown.querySelectorAll('.sugg-row[data-id]').forEach(row => {
    row.onclick = () => {
      const itemId = row.getAttribute('data-id');
      const item = State.inventory.find(i => i.id === itemId);
      const syn = row.getAttribute('data-syn');
      if (!item) return;

      // Autocomplete ONLY the active segment: "3 Mug, 4 Spoon, 2 Pla"
      // -> "3 Mug, 4 Spoon, 2 Plate, " — then commit that item.
      setCompletedSegment(inputName, q + item.title);
      dropdown.style.display = 'none';
      if (trackCommitted(amount, item.title)) {
        addItemToSwap(item, amount, syn || null);
      }
      const btnClear = document.getElementById('chatBtnClear');
      if (btnClear && inputName.value) btnClear.style.display = 'block';
      inputName.focus();
    };
  });
  wireCustomRow();
}

function findBestInventoryMatch(query) {
  const q = String(query || '').toLowerCase().trim();
  if (!q) return null;
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

function addBotMessage({ text, options = null, scroll = true }) {
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
      if (btn && opt.action) {
        // Keep the original action so the in-place change flow can restore it.
        btn.__origAction = () => opt.action(btn);
        btn.onclick = btn.__origAction;
      }
    });
  }

  if (scroll) scrollChatBottom();
}

// When set (a step key), the next addUserMessage for that step updates the
// existing bubble in place instead of appending a new one — the in-place
// answer-change flow (no confirm, later answers kept).
let pendingAnswerUpdate = null;

// The chat row of a bubble that was just updated in place. While set,
// scrollChatBottom() is suppressed so an answer change never yanks the
// view back to the bottom of the conversation; the choice handlers
// re-center this row instead (see proceedAfterChoice).
let inPlaceCommit = null;

function addUserMessage(text, stepNumber = null) {
  const thread = document.getElementById('chatThread');

  if (pendingAnswerUpdate && stepNumber && String(stepNumber) === String(pendingAnswerUpdate)) {
    const existing = [...thread.querySelectorAll('.chat-row.user')].find(r => {
      const btn = r.querySelector('[data-change-step]');
      return btn && btn.getAttribute('data-change-step') === String(stepNumber);
    });
    if (existing) {
      const bubble = existing.querySelector('.bubble-text');
      // Re-selecting the same answer is a silent no-op: no badge, no flash.
      const currentBase = bubble
        ? bubble.innerHTML.replace(/ ?<span class="updated-badge">updated<\/span>\s*$/, '')
        : '';
      const sameText = !!bubble && currentBase === escapeHtml(text);
      if (bubble && !sameText) {
        bubble.innerHTML = escapeHtml(text) + ' <span class="updated-badge">updated</span>';
      }
      if (!sameText) {
        existing.classList.remove('bubble-updated');
        void existing.offsetWidth; // restart the flash animation
        existing.classList.add('bubble-updated');
      }
      pendingAnswerUpdate = null;
      inPlaceCommit = existing;
      rearmPastOptionCards();
      existing.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      return;
    }
    pendingAnswerUpdate = null;
  }

  inPlaceCommit = null;
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
 * tapping a previous response anywhere in the (scrolled) history changes the
 * answer immediately — one click, no intermediate "change mode" step. The
 * "Change" chip on the message still exists for explicitly re-opening a
 * question (e.g. to type a custom accommodation).
 */
/**
 * Stage an in-place answer change for a step: mark the next commit for that
 * step as an in-place bubble update and park every other question's cards.
 * Shared by the "Change" chip flow (changeStepAnswer, which additionally
 * shows the hint + scrolls to the question) and the one-click flow where a
 * saved answer card is tapped directly.
 */
function prepareInPlaceChange(step) {
  const thread = document.getElementById('chatThread');
  if (!thread) return;
  const userRow = [...thread.querySelectorAll('.chat-row.user')].find(r => {
    const btn = r.querySelector('[data-change-step]');
    return btn && btn.getAttribute('data-change-step') === String(step);
  });
  let qRow = userRow ? userRow.previousElementSibling : null;
  while (qRow && !(qRow.classList && qRow.classList.contains('bot'))) qRow = qRow.previousElementSibling;

  pendingAnswerUpdate = step;
  State.currentStep = step;

  if (qRow) {
    qRow.querySelectorAll('.option-card-btn').forEach(b => {
      b.disabled = false;
      b.classList.remove('option-past');
      b.title = '';
      if (b.__origAction) b.onclick = b.__origAction;
    });
  }
  // Park the cards of every other question so only this one is live.
  thread.querySelectorAll('.chat-row.bot').forEach(row => {
    if (row === qRow) return;
    row.querySelectorAll('.option-card-btn').forEach(b => { b.disabled = true; });
  });
  return qRow;
}

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
          b.title = 'Tap to change your answer to this';
          // One click = the answer changes: stage the in-place update, then
          // run the original choice action directly (no intermediate step).
          b.onclick = b.__origAction
            ? () => { prepareInPlaceChange(step); b.__origAction(b); }
            : () => changeStepAnswer(step);
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
  if (inPlaceCommit) return; // keep the view on an in-place answer change
  const win = document.getElementById('cfChatWindow');
  if (win) {
    setTimeout(() => {
      win.scrollTop = win.scrollHeight;
    }, 40);
  }
}

/**
 * Shared "answer committed" tail: typing indicator, then the next question.
 * For in-place answer changes, re-centers the updated bubble afterwards
 * instead of letting the conversation snap to the bottom.
 */
function proceedAfterChoice() {
  showTyping();
  setTimeout(() => {
    hideTyping();
    renderNextQuestion();
    const row = inPlaceCommit;
    if (row) {
      inPlaceCommit = null;
      setTimeout(() => row.scrollIntoView({ behavior: 'smooth', block: 'center' }), 80);
    }
  }, 350);
}

function replaySavedChat() {
  const d = State.sessionData;
  if (d.user_type) {
    addBotMessage({ text: "Welcome back! Resuming your saved swap.", options: null });
    renderStep1_StudentVsNonStudent();
    addUserMessage(`I am a ${d.user_type === 'student' ? 'Student' : 'Non-Student'}`, '1');
  }
  if (d.user_type === 'student' && d.is_international) {
    renderStep2_1_International();
    addUserMessage(d.is_international === 'international' ? 'International Student' : 'Domestic / Home Student', '2.1');
  }
  if (d.user_type === 'student' && d.accommodation) {
    renderStep2_2_Accommodation();
    addUserMessage(`Living in: ${d.accommodation}`, '2.2');
  }
  if (d.user_type === 'student' && d.stay_duration) {
    renderStep2_3_StayDuration();
    addUserMessage(`Planned stay: ${d.stay_duration}`, '2.3');
  }
  if (d.action_type) {
    renderStep3_ActionType();
    addUserMessage(`Action: ${d.action_type}`, '3');
  }

  renderNextQuestion();
}

/**
 * Render the next unanswered question, honouring any answers that were
 * preserved across an in-place answer change.
 */
function renderNextQuestion() {
  const d = State.sessionData;
  if (!d.user_type) return renderStep1_StudentVsNonStudent();
  if (d.user_type === 'student' && !d.is_international) return renderStep2_1_International();
  if (d.user_type === 'student' && !d.accommodation) return renderStep2_2_Accommodation();
  if (d.user_type === 'student' && !d.stay_duration) return renderStep2_3_StayDuration();
  if (!d.action_type) return renderStep3_ActionType();
  return renderStep4_InteractiveItemCardInChat();
}

const KIOSK_STEP_ORDER = ['1', '2.1', '2.2', '2.3', '3', '4'];

window.changeStepAnswer = function (stepKey) {
  stepKey = String(stepKey);
  if (!KIOSK_STEP_ORDER.includes(stepKey)) return;

  const thread = document.getElementById('chatThread');
  if (!thread) return;

  if (stepKey === '4') {
    // Items: nothing earlier is affected, so just clear the items and re-ask.
    State.sessionData.items = [];
    removeStepHistoryRow('4');
    State.currentStep = '4';
    persistKioskSession();
    renderStep4_InteractiveItemCardInChat();
    return;
  }

  // No confirm — jump straight into the change: re-enable the original
  // question's option cards (parking all others) so the user can tap their
  // new answer.
  const qRow = prepareInPlaceChange(stepKey);

  // Show the hint once — re-opening an already-open question must not stack
  // identical hint bubbles. No bottom scroll: the view stays on the question.
  const hintText = "No problem — just tap the option you'd like instead. Your other answers are kept unless this change affects them.";
  const lastBot = [...thread.querySelectorAll('.chat-row.bot')].pop();
  const hintShown = lastBot && lastBot.querySelector('.bubble-text') &&
    lastBot.querySelector('.bubble-text').textContent.includes('just tap the option');
  if (!hintShown) addBotMessage({ text: hintText, options: null, scroll: false });
  persistKioskSession();
  if (qRow) qRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
};

function persistKioskSession() {
  try {
    localStorage.setItem('swapshop_kiosk_session', JSON.stringify({
      sessionId: State.sessionId,
      currentStep: State.currentStep,
      sessionData: State.sessionData,
      savedAt: new Date().toISOString()
    }));
  } catch (err) {}
}

function removeStepHistoryRow(stepKey) {
  const thread = document.getElementById('chatThread');
  if (!thread) return;
  const userRow = [...thread.querySelectorAll('.chat-row.user')].find(r => {
    const btn = r.querySelector('[data-change-step]');
    return btn && btn.getAttribute('data-change-step') === String(stepKey);
  });
  if (!userRow) return;
  const prev = userRow.previousElementSibling;
  userRow.remove();
  if (prev && prev.classList && prev.classList.contains('bot') && prev.querySelector('.option-card-btn')) {
    prev.remove();
  }
}

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
