/**
 * EcoSwap - Guided Conversational Form (CF) Inventory System
 * 
 * Features:
 * - Generic Item Descriptions (Mug, Plate, Fork, Knife, Spoon, Teaspoon, Pillow, Lamp, etc.)
 * - Split View Mode (Customer Kiosk on left, Admin Dashboard on right)
 * - Password-Protected Admin Panel (default password: swapadmin)
 * - Setup new item categories & live category management
 * - Map new item submissions as synonyms of existing items and adjust stock pool
 * - Set item parameters: weights (kg), values (€), CO2 factors, conditions, locations
 * - Heartfelt thank-you messages for Drop-offs and Returns
 * - Clean receipt printing: prints ONLY the "Swap Logged Successfully!" box without buttons
 * - Save After Each Step with audit log & session persistence
 * - Phosphor Icons integration throughout
 */

// Application State
const State = {
  viewMode: 'kiosk', // 'kiosk' | 'split' | 'admin'
  kioskEngine: 'enhanced', // 'enhanced' | 'space10'
  adminAuthed: false,
  pendingViewMode: null,
  sessionId: null,
  currentStep: 1, // 1, 2.1, 2.2, 2.3, 3, 4, 5 (complete)
  sessionData: {
    user_type: null,
    is_international: null,
    accommodation: null,
    stay_duration: null,
    action_type: null,
    items: [],
    notes: ''
  },
  stepSaveHistory: [],
  inventory: [],
  categories: [],
  selectedCategory: 'All',
  adminSelectedCategory: 'All',
  searchQuery: '',
  adminSearchQuery: ''
};

let space10Instance = null;

// Word-to-number mapping for natural language parsing
const NUMBER_WORDS = {
  'a': 1, 'an': 1, 'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5,
  'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10,
  'pair': 1, 'pair of': 1, 'couple': 2, 'few': 3, 'half dozen': 6, 'dozen': 12
};

// Student accommodation choices
const STUDENT_ACCOMMODATIONS = [
  { id: 'parkside', name: 'Parkside Student Residence', desc: 'North Campus Hall', icon: 'ph-buildings' },
  { id: 'oakwood', name: 'Oakwood Student Village', desc: 'East Quad Residence', icon: 'ph-buildings' },
  { id: 'riverfront', name: 'Riverfront Campus Towers', desc: 'South Bank High-Rise', icon: 'ph-buildings' },
  { id: 'meadow', name: 'Meadow Court Flats', desc: 'West Campus Lodges', icon: 'ph-buildings' },
  { id: 'westend', name: 'West End College Lodge', desc: 'Central University Hall', icon: 'ph-buildings' }
];

// Stay duration choices
const STAY_DURATIONS = [
  { id: 'exchange', label: 'Short-term Exchange (< 4 months)', desc: 'Erasmus / Visiting scholar', icon: 'ph-hourglass-medium' },
  { id: '1-semester', label: '1 Semester (4–6 months)', desc: 'One study term', icon: 'ph-calendar-blank' },
  { id: '1-year', label: '1 Academic Year (9–12 months)', desc: 'Full academic session', icon: 'ph-calendar-check' },
  { id: 'degree', label: 'Full Degree (2–4+ years)', desc: 'Bachelor or Master programme', icon: 'ph-graduation-cap' },
  { id: 'other', label: 'Other / Flexible Stay', desc: 'PhD, research, or undecided', icon: 'ph-clock' }
];

// ==========================================================================
// Initialization
// ==========================================================================
document.addEventListener('DOMContentLoaded', () => {
  checkAdminAuth();
  initViewSwitcher();
  initAdminPasswordModal();
  initSession();
  initSmartItemParser();
  initAuditDrawer();
  initAdminTabs();
  initAdminForms();

  loadCategories();
  loadInventory();
  loadAnalytics();
  loadActivityLog();

  // Polling for live sync across Split View
  setInterval(() => {
    loadInventory(false);
    loadAnalytics(false);
    loadActivityLog(false);
  }, 8000);
});

// ==========================================================================
// VIEW SWITCHER & SPLIT VIEW MANAGEMENT
// ==========================================================================
function checkAdminAuth() {
  const authed = sessionStorage.getItem('ecoswap_admin_authed') === 'true';
  State.adminAuthed = authed;
  updateAdminLockUI();
}

function updateAdminLockUI() {
  const badge = document.getElementById('adminLockBadge');
  const btnUnlock = document.getElementById('btnQuickUnlockAdmin');

  if (State.adminAuthed) {
    badge.className = 'admin-lock-badge unlocked';
    badge.innerHTML = '<i class="ph ph-lock-key-open"></i> Admin Unlocked';
    btnUnlock.style.display = 'none';
  } else {
    badge.className = 'admin-lock-badge locked';
    badge.innerHTML = '<i class="ph ph-lock"></i> Admin Locked';
    btnUnlock.style.display = 'inline-flex';
  }
}

function initViewSwitcher() {
  const btnKiosk = document.getElementById('btnViewKiosk');
  const btnSplit = document.getElementById('btnViewSplit');
  const btnAdmin = document.getElementById('btnViewAdmin');
  const btnQuickUnlock = document.getElementById('btnQuickUnlockAdmin');
  const btnLock = document.getElementById('btnAdminLock');

  btnKiosk.onclick = () => setViewMode('kiosk');
  btnSplit.onclick = () => requestViewMode('split');
  btnAdmin.onclick = () => requestViewMode('admin');

  btnQuickUnlock.onclick = () => {
    State.pendingViewMode = State.viewMode;
    openPasswordModal();
  };

  btnLock.onclick = () => {
    sessionStorage.removeItem('ecoswap_admin_authed');
    State.adminAuthed = false;
    updateAdminLockUI();
    setViewMode('kiosk');
  };

  // CF engine toggle (Enhanced vs Space10)
  const btnEngEnh = document.getElementById('btnEngineEnhanced');
  const btnEngSp10 = document.getElementById('btnEngineSpace10');
  const chatWin = document.getElementById('cfChatWindow');
  const sp10Card = document.getElementById('space10Card');
  const itemPanel = document.getElementById('cfItemActionPanel');

  btnEngEnh.onclick = () => {
    btnEngEnh.classList.add('active');
    btnEngSp10.classList.remove('active');
    State.kioskEngine = 'enhanced';
    sp10Card.style.display = 'none';
    chatWin.style.display = 'flex';
    if (State.currentStep === 4) itemPanel.style.display = 'flex';
  };

  btnEngSp10.onclick = () => {
    btnEngSp10.classList.add('active');
    btnEngEnh.classList.remove('active');
    State.kioskEngine = 'space10';
    chatWin.style.display = 'none';
    itemPanel.style.display = 'none';
    sp10Card.style.display = 'flex';
    initSpace10Instance();
  };
}

function requestViewMode(mode) {
  if (mode === 'kiosk') {
    setViewMode('kiosk');
    return;
  }

  if (State.adminAuthed) {
    setViewMode(mode);
  } else {
    State.pendingViewMode = mode;
    openPasswordModal();
  }
}

function setViewMode(mode) {
  State.viewMode = mode;
  const wrapper = document.getElementById('viewsWrapper');
  wrapper.className = `views-wrapper mode-${mode}`;

  document.getElementById('btnViewKiosk').classList.toggle('active', mode === 'kiosk');
  document.getElementById('btnViewSplit').classList.toggle('active', mode === 'split');
  document.getElementById('btnViewAdmin').classList.toggle('active', mode === 'admin');

  if (mode === 'split' || mode === 'admin') {
    loadInventory(false);
    loadCategories();
    loadAnalytics(false);
  }
}

function openPasswordModal() {
  const modal = document.getElementById('adminPasswordModal');
  const input = document.getElementById('adminAuthPassword');
  const err = document.getElementById('adminAuthError');
  input.value = '';
  err.style.display = 'none';
  modal.style.display = 'flex';
  setTimeout(() => input.focus(), 100);
}

function initAdminPasswordModal() {
  const modal = document.getElementById('adminPasswordModal');
  const form = document.getElementById('formAdminAuth');
  const input = document.getElementById('adminAuthPassword');
  const err = document.getElementById('adminAuthError');
  const btnClose = document.getElementById('btnClosePasswordModal');
  const btnCancel = document.getElementById('btnCancelAdminAuth');

  const closeModal = () => { modal.style.display = 'none'; };
  btnClose.onclick = closeModal;
  btnCancel.onclick = closeModal;

  form.onsubmit = async (e) => {
    e.preventDefault();
    const pass = input.value.trim();

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: pass })
      });

      const data = await res.json();
      if (data.success) {
        sessionStorage.setItem('ecoswap_admin_authed', 'true');
        State.adminAuthed = true;
        updateAdminLockUI();
        closeModal();
        setViewMode(State.pendingViewMode || 'admin');
        State.pendingViewMode = null;
      } else {
        err.textContent = data.error || 'Incorrect password';
        err.style.display = 'block';
      }
    } catch (error) {
      // Offline fallback: check default password
      if (pass === 'swapadmin' || pass === 'ecoswap2026') {
        sessionStorage.setItem('ecoswap_admin_authed', 'true');
        State.adminAuthed = true;
        updateAdminLockUI();
        closeModal();
        setViewMode(State.pendingViewMode || 'admin');
        State.pendingViewMode = null;
      } else {
        err.textContent = 'Incorrect password (default is swapadmin)';
        err.style.display = 'block';
      }
    }
  };
}

// ==========================================================================
// SESSION & SAVE-AFTER-EACH-STEP CORE
// ==========================================================================
function initSession() {
  const saved = localStorage.getItem('ecoswap_active_session');
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      if (parsed && parsed.sessionId && parsed.currentStep < 5) {
        showResumeBanner(parsed);
        return;
      }
    } catch (e) {
      console.warn('Corrupt saved session:', e);
    }
  }

  startFreshSession();
}

function startFreshSession() {
  State.sessionId = `ses_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
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
  State.stepSaveHistory = [];

  localStorage.removeItem('ecoswap_active_session');
  updateSessionIdTag();
  updateStepCountBadge();
  resetProgressTracker(1);
  clearChatThread();
  renderStep1_StudentVsNonStudent();
  hideItemActionPanel();
}

function showResumeBanner(savedSession) {
  const banner = document.getElementById('sessionResumeBanner');
  const bannerText = document.getElementById('resumeBannerText');
  const btnResume = document.getElementById('btnResumeSession');
  const btnDiscard = document.getElementById('btnDiscardSession');

  bannerText.textContent = `You have an in-progress swap session saved at Step ${savedSession.currentStep}.`;
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
  State.stepSaveHistory = saved.stepSaveHistory || [];

  updateSessionIdTag();
  updateStepCountBadge();
  resetProgressTracker(Math.min(4, Math.floor(State.currentStep)));
  clearChatThread();
  replaySavedChat();
}

/**
 * SAVE AFTER EACH STEP FUNCTION
 */
async function saveStep(stepKey, stepName, stepPayload) {
  setSaveIndicator('saving', `Saving Step ${stepKey}...`);

  State.currentStep = stepKey;
  if (stepPayload) {
    State.sessionData = { ...State.sessionData, ...stepPayload };
  }

  const timestamp = new Date().toLocaleTimeString();
  const saveEntry = {
    step: String(stepKey),
    stepName: stepName,
    time: timestamp,
    data: JSON.parse(JSON.stringify(stepPayload || {}))
  };
  State.stepSaveHistory.push(saveEntry);
  updateStepCountBadge();
  appendAuditDrawerCard(saveEntry);

  // 1. Save to LocalStorage
  const sessionBlob = {
    sessionId: State.sessionId,
    currentStep: State.currentStep,
    sessionData: State.sessionData,
    stepSaveHistory: State.stepSaveHistory,
    savedAt: new Date().toISOString()
  };
  localStorage.setItem('ecoswap_active_session', JSON.stringify(sessionBlob));

  // 2. Post to Backend API
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
      setSaveIndicator('saved', `Step ${stepKey} saved (${timestamp})`);
      triggerMicroSaveFeedback();
    } else {
      setSaveIndicator('saved', `Step ${stepKey} saved locally`);
    }
  } catch (err) {
    setSaveIndicator('saved', `Step ${stepKey} saved locally`);
  }
}

function setSaveIndicator(status, text) {
  const box = document.getElementById('saveIndicator');
  const icon = document.getElementById('saveIcon');
  const label = document.getElementById('saveText');

  box.className = `save-indicator ${status}`;
  label.textContent = text;

  if (status === 'saving') {
    icon.className = 'ph ph-arrow-clockwise';
  } else if (status === 'saved') {
    icon.className = 'ph ph-cloud-check';
  } else {
    icon.className = 'ph ph-cloud';
  }
}

function triggerMicroSaveFeedback() {
  const micro = document.getElementById('itemsSavedMicro');
  if (micro) {
    micro.innerHTML = '<i class="ph ph-check-circle"></i> Auto-saved to server';
  }
}

function updateSessionIdTag() {
  const tag = document.getElementById('kioskSessionIdTag');
  if (tag) {
    tag.innerHTML = `<i class="ph ph-fingerprint"></i> Session: <strong>${State.sessionId.substring(0, 16)}</strong>`;
  }
}

function updateStepCountBadge() {
  const badge = document.getElementById('stepSaveCountBadge');
  if (badge) {
    badge.textContent = State.stepSaveHistory.length;
  }
}

// ==========================================================================
// GUIDED CONVERSATIONAL FORM FLOW
// ==========================================================================

/**
 * STEP 1: Student vs Non-Student
 */
function renderStep1_StudentVsNonStudent() {
  resetProgressTracker(1);
  addBotMessage({
    text: "Welcome to EcoSwap! Let's get your swap recorded in a few guided steps. First: are you a university student or visiting as a non-student / community member?",
    options: [
      {
        id: 'opt-student',
        title: 'Student',
        desc: 'Enrolled university / college student',
        icon: 'ph-graduation-cap',
        action: () => handleStep1Choice('student', 'Student')
      },
      {
        id: 'opt-nonstudent',
        title: 'Non-Student',
        desc: 'Staff, local resident, or community visitor',
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

  showTypingIndicator();
  setTimeout(() => {
    hideTypingIndicator();
    if (value === 'student') {
      renderStep2_1_International();
    } else {
      addBotMessage({
        text: "Thank you for supporting community reuse! As a community visitor, we'll jump straight to your swap items.",
        options: null
      });
      setTimeout(() => {
        renderStep3_ActionType();
      }, 400);
    }
  }, 400);
}

/**
 * STEP 2.1: International / Domestic
 */
function renderStep2_1_International() {
  resetProgressTracker(2);
  addBotMessage({
    text: "Great! Are you an international student studying from abroad, or a domestic/home student?",
    options: [
      {
        id: 'opt-intl',
        title: 'International Student',
        desc: 'From abroad on study visa / exchange',
        icon: 'ph-globe-hemisphere-west',
        action: () => handleStep2_1Choice('international', 'International Student')
      },
      {
        id: 'opt-dom',
        title: 'Domestic / Home Student',
        desc: 'Home or local country resident',
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

  showTypingIndicator();
  setTimeout(() => {
    hideTypingIndicator();
    renderStep2_2_Accommodation();
  }, 400);
}

/**
 * STEP 2.2: Accommodation (Private vs Student Accommodations vs Other)
 */
function renderStep2_2_Accommodation() {
  const options = [
    {
      id: 'acc-private',
      title: 'Private Accommodation',
      desc: 'Private rented flat, house share, or family home',
      icon: 'ph-house-simple',
      action: () => handleStep2_2Choice('Private Accommodation')
    },
    ...STUDENT_ACCOMMODATIONS.map(hall => ({
      id: `acc-${hall.id}`,
      title: hall.name,
      desc: hall.desc,
      icon: hall.icon,
      action: () => handleStep2_2Choice(hall.name)
    })),
    {
      id: 'acc-other',
      title: 'Other Accommodation',
      desc: 'Commuter, homestay, or other',
      icon: 'ph-dots-three-circle',
      action: (btn) => showOtherAccommodationInput(btn)
    }
  ];

  addBotMessage({
    text: "Where do you live during your studies?",
    options: options
  });
}

function showOtherAccommodationInput(btn) {
  const container = btn.closest('.chat-interactive-options');
  if (!container) return;

  container.innerHTML = `
    <div class="option-custom-input-box">
      <input type="text" id="inputOtherAccom" placeholder="Enter accommodation or residence name..." autofocus />
      <button class="btn btn-primary btn-sm" id="btnConfirmOtherAccom">
        <i class="ph ph-check"></i> Continue
      </button>
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

  showTypingIndicator();
  setTimeout(() => {
    hideTypingIndicator();
    renderStep2_3_StayDuration();
  }, 400);
}

/**
 * STEP 2.3: Stay Duration
 */
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
    options: options
  });
}

async function handleStep2_3Choice(durationLabel) {
  disableCurrentOptions();
  addUserMessage(`Planned stay: ${durationLabel}`, '2.3');

  await saveStep('2.3', 'Stay Duration', { stay_duration: durationLabel });

  showTypingIndicator();
  setTimeout(() => {
    hideTypingIndicator();
    renderStep3_ActionType();
  }, 400);
}

/**
 * STEP 3: Drop-off or Pick-up or Return (WITH THANK-YOU MESSAGES)
 */
function renderStep3_ActionType() {
  resetProgressTracker(3);
  addBotMessage({
    text: "What brings you to the Swap Shop today?",
    options: [
      {
        id: 'act-dropoff',
        title: 'Drop-off (Donate Items)',
        desc: 'Passing on reusable kitchenware, study gear, clothes, or bedding',
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
        desc: 'Returning borrowed fans, lamps, or reusable kitchen items',
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

  showTypingIndicator();
  setTimeout(() => {
    hideTypingIndicator();

    // Heartfelt thank-you responses based on action type
    if (actionType === 'drop-off') {
      addBotMessage({
        text: "Thank you so much for donating and giving your items a second life! 🌿💚 Your generous drop-off keeps student essentials circulating and prevents landfill waste.",
        options: null
      });
    } else if (actionType === 'return') {
      addBotMessage({
        text: "Thank you so much for returning these reusable items! 🔄✨ By returning them in good reusable condition, another student can now borrow them. You're a sustainability champion!",
        options: null
      });
    } else {
      addBotMessage({
        text: "Awesome! Let's get what you need logged so our shelves stay accurate and organized for everyone.",
        options: null
      });
    }

    setTimeout(() => {
      renderStep4_ItemsOptional();
    }, 450);
  }, 400);
}

/**
 * STEP 4: (Optional) What did you drop off/pick up [Amount] [Item]
 */
function renderStep4_ItemsOptional() {
  resetProgressTracker(4);
  const action = State.sessionData.action_type || 'drop-off';
  const actionWord = action === 'drop-off' ? 'drop off' : (action === 'pick-up' ? 'pick up' : 'return');

  addBotMessage({
    text: `Almost done! <strong>(Optional)</strong> What did you ${actionWord}? Type <code>[Amount] [Item]</code> in the search below (e.g. <em>"2 mugs"</em>, <em>"1 plate"</em>, <em>"3 spoons"</em>, <em>"pillow"</em>, <em>"fork"</em>). Our smart engine auto-matches synonyms, or click skip if you're just browsing!`,
    options: null
  });

  showItemActionPanel();
  renderSelectedItemsList();
}

async function handleSkipStep4() {
  addUserMessage("I have no specific items to log (General Visit)", '4');
  await saveStep('4', 'Items (Skipped)', { items: [] });
  finalizeTransaction();
}

/**
 * FINALIZE & COMPLETE SWAP
 */
async function finalizeTransaction() {
  hideItemActionPanel();
  resetProgressTracker(5);
  showTypingIndicator();

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
    hideTypingIndicator();

    if (result.success) {
      renderReceiptCard(result.transaction);
      localStorage.removeItem('ecoswap_active_session');
      loadInventory(false);
      loadAnalytics(false);
      loadActivityLog(false);
    } else {
      addBotMessage({
        text: `There was an issue processing your swap: ${result.error || 'Unknown error'}. Please ask staff.`,
        options: null
      });
    }
  } catch (err) {
    hideTypingIndicator();
    // Offline fallback
    renderReceiptCard({
      id: `tx-${Date.now()}`,
      timestamp: new Date().toISOString(),
      ...State.sessionData,
      weight_diverted_kg: (State.sessionData.items.length * 0.5).toFixed(1),
      value_saved_eur: (State.sessionData.items.length * 10.0).toFixed(2),
      co2_saved_kg: (State.sessionData.items.length * 1.5).toFixed(1)
    });
    localStorage.removeItem('ecoswap_active_session');
  }
}

/**
 * Render Receipt Confirmation Card in Chat
 * Note: Styled so print prints ONLY this box without buttons
 */
function renderReceiptCard(tx) {
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
          By returning items in clean condition, another student can now borrow them. You are a circular champion!
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
          <span class="category-tag">${escapeHtml(it.category || 'Item')}</span>
        </div>
      `).join('')
    : '<div class="empty-items-notice" style="padding: 0.25rem;">General visit (no specific items itemized)</div>';

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
        <div class="receipt-field-val"><i class="ph ph-user"></i> ${escapeHtml(userTypeLbl)}</div>
      </div>
      <div>
        <div class="receipt-field-label">Accommodation</div>
        <div class="receipt-field-val"><i class="ph ph-house"></i> ${escapeHtml(State.sessionData.accommodation || 'N/A')}</div>
      </div>
      <div>
        <div class="receipt-field-label">Stay Duration</div>
        <div class="receipt-field-val"><i class="ph ph-calendar"></i> ${escapeHtml(State.sessionData.stay_duration || 'N/A')}</div>
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
        <div class="lbl">Waste Diverted</div>
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

    <!-- Action buttons (Hidden on Print) -->
    <div class="receipt-actions">
      <button class="btn btn-primary" onclick="printReceiptOnly()">
        <i class="ph ph-printer"></i> Print Receipt Slip
      </button>
      <button class="btn btn-secondary" onclick="requestViewMode('split')">
        <i class="ph ph-columns"></i> View in Split Admin
      </button>
      <button class="btn btn-secondary" onclick="startFreshSession()">
        <i class="ph ph-arrows-clockwise"></i> Start Another Swap
      </button>
    </div>
  `;

  thread.appendChild(card);
  scrollChatToBottom();
}

/**
 * Print function: Prints ONLY the receipt box without buttons
 */
function printReceiptOnly() {
  window.print();
}

function replaySavedChat() {
  const d = State.sessionData;
  if (d.user_type) {
    addBotMessage({ text: "Welcome back! Replaying your saved progress.", options: null });
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
    renderStep4_ItemsOptional();
  }
}

// ==========================================================================
// STEP 4: SMART SUGGESTION & SYNONYM PARSER (GENERIC ITEMS)
// ==========================================================================
function initSmartItemParser() {
  const inputAmount = document.getElementById('inputItemAmount');
  const inputName = document.getElementById('inputItemName');
  const btnAdd = document.getElementById('btnAddParsedItem');
  const btnClear = document.getElementById('btnClearInput');
  const dropdown = document.getElementById('suggestionsDropdown');
  const btnSkip = document.getElementById('btnSkipStep4');
  const btnFinish = document.getElementById('btnFinishSwap');

  inputName.addEventListener('input', () => {
    const text = inputName.value.trim();
    if (text) {
      btnClear.style.display = 'block';
      handleSmartTyping(text);
    } else {
      btnClear.style.display = 'none';
      dropdown.style.display = 'none';
    }
  });

  btnClear.addEventListener('click', () => {
    inputName.value = '';
    btnClear.style.display = 'none';
    dropdown.style.display = 'none';
    inputName.focus();
  });

  inputName.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const firstSugg = dropdown.querySelector('.suggestion-item');
      if (dropdown.style.display !== 'none' && firstSugg) {
        firstSugg.click();
      } else {
        addItemFromInputs();
      }
    } else if (e.key === 'Escape') {
      dropdown.style.display = 'none';
    }
  });

  btnAdd.addEventListener('click', () => addItemFromInputs());

  // Quick Chips
  document.querySelectorAll('.quick-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const q = chip.getAttribute('data-query');
      const amt = parseInt(chip.getAttribute('data-amount'), 10) || 1;
      const matched = findBestInventoryMatch(q);
      if (matched) {
        addSelectedItem(matched.item, amt, matched.synonymMatched);
      } else {
        addSelectedItem({ title: q, category: 'General', icon: 'ph-package' }, amt);
      }
    });
  });

  btnSkip.addEventListener('click', handleSkipStep4);
  btnFinish.addEventListener('click', finalizeTransaction);

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.input-field-item')) {
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

function handleSmartTyping(rawInput) {
  const dropdown = document.getElementById('suggestionsDropdown');
  const inputAmount = document.getElementById('inputItemAmount');

  const { amount, itemName } = parseAmountAndItem(rawInput);
  if (amount > 1) inputAmount.value = amount;

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
      for (const syn of item.synonyms) {
        if (syn.toLowerCase().includes(query) || query.includes(syn.toLowerCase())) {
          isMatch = true;
          synMatch = syn;
          break;
        }
      }
    }

    if (isMatch) {
      matches.push({ item, synonymMatched: synMatch });
    }
  });

  if (matches.length === 0) {
    dropdown.innerHTML = `
      <div class="suggestion-item" id="btnCustomItemSugg">
        <div class="sugg-left">
          <i class="ph ph-plus-circle sugg-icon"></i>
          <div>
            <div class="sugg-title">Log as custom generic item: <strong>"${escapeHtml(itemName || rawInput)}"</strong></div>
            <span class="help-hint">Will be added to transaction (Staff can map to pool)</span>
          </div>
        </div>
      </div>
    `;
    dropdown.style.display = 'block';

    const customBtn = document.getElementById('btnCustomItemSugg');
    if (customBtn) {
      customBtn.onclick = () => {
        const amt = parseInt(inputAmount.value, 10) || 1;
        addSelectedItem({
          id: null,
          title: itemName || rawInput,
          category: 'Miscellaneous',
          icon: 'ph-package'
        }, amt);
        resetSmartInputs();
      };
    }
    return;
  }

  dropdown.innerHTML = matches.slice(0, 6).map(({ item, synonymMatched }) => {
    const synTag = synonymMatched
      ? `<span class="sugg-synonym-tag"><i class="ph ph-sparkle"></i> Synonym: "${escapeHtml(synonymMatched)}"</span>`
      : '';
    const stockStatus = item.quantity > 0
      ? `<span class="stock-tag in-stock">${item.quantity} in stock</span>`
      : `<span class="stock-tag out-stock">Out of stock</span>`;

    return `
      <div class="suggestion-item" data-id="${item.id}" data-syn="${synonymMatched || ''}">
        <div class="sugg-left">
          <i class="ph ${item.icon || 'ph-package'} sugg-icon"></i>
          <div>
            <span class="sugg-title">${escapeHtml(item.title)}</span>
            ${synTag}
            <div style="font-size: 0.72rem; color: var(--text-muted);">${escapeHtml(item.category)} • ${item.location || 'Shelf'}</div>
          </div>
        </div>
        <div class="sugg-right">
          ${stockStatus}
        </div>
      </div>
    `;
  }).join('');

  dropdown.style.display = 'block';

  dropdown.querySelectorAll('.suggestion-item').forEach(suggEl => {
    suggEl.onclick = () => {
      const itemId = suggEl.getAttribute('data-id');
      const item = State.inventory.find(i => i.id === itemId);
      const syn = suggEl.getAttribute('data-syn');
      const amt = parseInt(inputAmount.value, 10) || 1;

      if (item) addSelectedItem(item, amt, syn);
      resetSmartInputs();
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
      for (const syn of item.synonyms) {
        if (syn.toLowerCase() === q || syn.toLowerCase().includes(q) || q.includes(syn.toLowerCase())) {
          return { item, synonymMatched: syn };
        }
      }
    }
  }
  return null;
}

function addItemFromInputs() {
  const inputAmount = document.getElementById('inputItemAmount');
  const inputName = document.getElementById('inputItemName');
  const rawText = inputName.value.trim();

  if (!rawText) return;

  const { amount, itemName } = parseAmountAndItem(rawText);
  const finalAmount = Math.max(1, parseInt(inputAmount.value, 10) || amount);

  const matched = findBestInventoryMatch(itemName || rawText);
  if (matched) {
    addSelectedItem(matched.item, finalAmount, matched.synonymMatched);
  } else {
    addSelectedItem({
      id: null,
      title: itemName || rawText,
      category: 'Miscellaneous',
      icon: 'ph-package'
    }, finalAmount);
  }

  resetSmartInputs();
}

function resetSmartInputs() {
  const inputAmount = document.getElementById('inputItemAmount');
  const inputName = document.getElementById('inputItemName');
  const btnClear = document.getElementById('btnClearInput');
  const dropdown = document.getElementById('suggestionsDropdown');

  inputAmount.value = '1';
  inputName.value = '';
  btnClear.style.display = 'none';
  dropdown.style.display = 'none';
  inputName.focus();
}

async function addSelectedItem(item, amount = 1, synonymTag = null) {
  const existingIdx = State.sessionData.items.findIndex(
    it => (item.id && it.id === item.id) || it.title.toLowerCase() === item.title.toLowerCase()
  );

  if (existingIdx !== -1) {
    State.sessionData.items[existingIdx].amount += amount;
  } else {
    State.sessionData.items.push({
      id: item.id || null,
      title: item.title,
      amount: amount,
      category: item.category || 'Miscellaneous',
      icon: item.icon || 'ph-package',
      weight_kg: item.weight_kg || 0.5,
      est_value_eur: item.est_value_eur || 10.0,
      co2_factor: item.co2_factor || 2.0,
      synonym_detected: synonymTag || null
    });
  }

  renderSelectedItemsList();
  await saveStep('4', 'Item Added', { items: State.sessionData.items });
}

function renderSelectedItemsList() {
  const listContainer = document.getElementById('selectedItemsList');
  const countBadge = document.getElementById('selectedItemCount');
  const items = State.sessionData.items;

  countBadge.textContent = items.length;

  if (items.length === 0) {
    listContainer.innerHTML = `
      <div class="empty-items-notice">
        <i class="ph ph-hand-pointing"></i> No items added yet. Type with synonyms above, click quick generic items, or skip if no specific item.
      </div>
    `;
    return;
  }

  listContainer.innerHTML = items.map((it, idx) => {
    const synNotice = it.synonym_detected
      ? `<span class="sugg-synonym-tag" style="margin-left: 0.5rem;"><i class="ph ph-sparkle"></i> Synonym: ${escapeHtml(it.synonym_detected)}</span>`
      : '';

    let stockNotice = '';
    if (State.sessionData.action_type === 'pick-up') {
      const invItem = State.inventory.find(i => (it.id && i.id === it.id) || i.title.toLowerCase() === it.title.toLowerCase());
      if (invItem) {
        if (invItem.quantity < it.amount) {
          stockNotice = `<span class="stock-tag out-stock" style="margin-left: 0.35rem;"><i class="ph ph-warning-circle"></i> Only ${invItem.quantity} available</span>`;
        } else {
          stockNotice = `<span class="stock-tag in-stock" style="margin-left: 0.35rem;">✓ In stock (${invItem.quantity})</span>`;
        }
      }
    }

    return `
      <div class="selected-item-row">
        <div class="selected-item-info">
          <i class="ph ${it.icon || 'ph-package'} selected-item-icon"></i>
          <div>
            <span class="selected-item-name">${escapeHtml(it.title)}</span>
            ${synNotice}
            ${stockNotice}
            <div>
              <span class="selected-item-cat">${escapeHtml(it.category)}</span>
            </div>
          </div>
        </div>

        <div class="selected-item-controls">
          <div class="qty-control">
            <button class="btn-qty btn-dec" data-idx="${idx}"><i class="ph ph-minus"></i></button>
            <span class="qty-val">${it.amount}</span>
            <button class="btn-qty btn-inc" data-idx="${idx}"><i class="ph ph-plus"></i></button>
          </div>
          <button class="btn-item-delete" data-idx="${idx}" title="Remove item"><i class="ph ph-trash"></i></button>
        </div>
      </div>
    `;
  }).join('');

  listContainer.querySelectorAll('.btn-inc').forEach(btn => {
    btn.onclick = async () => {
      const idx = parseInt(btn.getAttribute('data-idx'), 10);
      State.sessionData.items[idx].amount++;
      renderSelectedItemsList();
      await saveStep('4', 'Item Qty Increased', { items: State.sessionData.items });
    };
  });

  listContainer.querySelectorAll('.btn-dec').forEach(btn => {
    btn.onclick = async () => {
      const idx = parseInt(btn.getAttribute('data-idx'), 10);
      if (State.sessionData.items[idx].amount > 1) {
        State.sessionData.items[idx].amount--;
      } else {
        State.sessionData.items.splice(idx, 1);
      }
      renderSelectedItemsList();
      await saveStep('4', 'Item Qty Adjusted', { items: State.sessionData.items });
    };
  });

  listContainer.querySelectorAll('.btn-item-delete').forEach(btn => {
    btn.onclick = async () => {
      const idx = parseInt(btn.getAttribute('data-idx'), 10);
      State.sessionData.items.splice(idx, 1);
      renderSelectedItemsList();
      await saveStep('4', 'Item Removed', { items: State.sessionData.items });
    };
  });
}

function showItemActionPanel() {
  document.getElementById('cfItemActionPanel').style.display = 'flex';
  document.getElementById('inputItemName').focus();
}

function hideItemActionPanel() {
  document.getElementById('cfItemActionPanel').style.display = 'none';
}

// ==========================================================================
// CHAT UI HELPERS & DOM MANIPULATION
// ==========================================================================
function clearChatThread() {
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
    <div class="chat-avatar bot"><i class="ph ph-recycle"></i></div>
    <div class="chat-bubble-content">
      <div class="bubble-text">${text}</div>
      ${optionsHtml}
      <div class="bubble-meta">
        <span><i class="ph ph-sparkle"></i> EcoSwap Assistant</span>
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
        btn.onclick = () => opt.action(btn);
      }
    });
  }

  scrollChatToBottom();
}

function addUserMessage(text, stepNumber = null) {
  const thread = document.getElementById('chatThread');
  const row = document.createElement('div');
  row.className = 'chat-row user';

  const savedBadge = stepNumber
    ? `<span class="saved-step-chip"><i class="ph ph-check-circle"></i> Step ${stepNumber} Saved</span>`
    : '';

  row.innerHTML = `
    <div class="chat-avatar user"><i class="ph ph-user"></i></div>
    <div class="chat-bubble-content">
      <div class="bubble-text">${escapeHtml(text)}</div>
      <div class="bubble-meta">
        ${savedBadge}
        <span>${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
      </div>
    </div>
  `;

  thread.appendChild(row);
  scrollChatToBottom();
}

function disableCurrentOptions() {
  document.querySelectorAll('.option-card-btn').forEach(btn => {
    btn.disabled = true;
    btn.style.opacity = '0.6';
    btn.style.cursor = 'default';
  });
}

function showTypingIndicator() {
  document.getElementById('typingIndicator').style.display = 'flex';
  scrollChatToBottom();
}

function hideTypingIndicator() {
  document.getElementById('typingIndicator').style.display = 'none';
}

function scrollChatToBottom() {
  const win = document.getElementById('cfChatWindow');
  setTimeout(() => {
    win.scrollTop = win.scrollHeight;
  }, 50);
}

function resetProgressTracker(currentActiveStep) {
  for (let i = 1; i <= 5; i++) {
    const stepEl = document.getElementById(`pstep-${i}`);
    const lineEl = document.getElementById(`pline-${i}`);

    if (stepEl) {
      stepEl.className = 'progress-step-item';
      if (i < currentActiveStep) {
        stepEl.classList.add('completed');
      } else if (i === currentActiveStep) {
        stepEl.classList.add('active');
      }
    }

    if (lineEl) {
      lineEl.className = 'progress-line';
      if (i < currentActiveStep) {
        lineEl.classList.add('completed');
      }
    }
  }
}

// ==========================================================================
// SPACE10 CONVERSATIONAL FORM ENGINE INTEGRATION
// ==========================================================================
function initSpace10Instance() {
  const container = document.getElementById('space10ChatWrapper');
  const formEl = document.getElementById('swap-cf-form');
  if (!container || !formEl) return;

  if (!space10Instance && window.cf && window.cf.ConversationalForm) {
    container.innerHTML = '';
    formEl.style.display = 'block';

    space10Instance = new window.cf.ConversationalForm({
      formEl: formEl,
      context: container,
      preventAutoFocus: true,
      flowStepCallback: function(dto, success, error) {
        const fieldName = (dto.tag && dto.tag.name) || 'cf-step';
        const fieldValue = dto.text;
        saveStep(fieldName, `Space10: ${fieldName}`, { [fieldName]: fieldValue });
        success();
      },
      submitCallback: function() {
        const formData = space10Instance.getFormData(true);
        if (formData.user_type) State.sessionData.user_type = formData.user_type;
        if (formData.is_international) State.sessionData.is_international = formData.is_international;
        if (formData.accommodation) State.sessionData.accommodation = formData.accommodation;
        if (formData.stay_duration) State.sessionData.stay_duration = formData.stay_duration;
        if (formData.action_type) State.sessionData.action_type = formData.action_type;
        if (formData.items_summary && formData.items_summary.toLowerCase() !== 'skip') {
          const { amount, itemName } = parseAmountAndItem(formData.items_summary);
          const matched = findBestInventoryMatch(itemName);
          if (matched) {
            State.sessionData.items.push({
              id: matched.item.id,
              title: matched.item.title,
              amount: amount,
              category: matched.item.category,
              icon: matched.item.icon
            });
          } else {
            State.sessionData.items.push({
              title: itemName,
              amount: amount,
              category: 'Miscellaneous',
              icon: 'ph-package'
            });
          }
        }

        finalizeTransaction();
        const btnEnh = document.getElementById('btnEngineEnhanced');
        if (btnEnh) btnEnh.click();
      }
    });

    formEl.style.display = 'none';
  }
}

// ==========================================================================
// ADMIN PANEL ENGINE & SUB-TABS
// ==========================================================================
function initAdminTabs() {
  const tabs = document.querySelectorAll('.admin-tab');
  tabs.forEach(tab => {
    tab.onclick = () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      const target = tab.getAttribute('data-atab');
      document.querySelectorAll('.admin-tab-content').forEach(c => {
        c.style.display = (c.id === `atab-${target}`) ? 'flex' : 'none';
      });

      if (target === 'catalog') renderAdminInventoryTable();
      if (target === 'synonyms') renderSynonymsDirectory();
      if (target === 'categories') renderAdminCategoriesTable();
      if (target === 'analytics') loadAnalytics(false);
      if (target === 'activity') loadActivityLog(false);
    };
  });

  const btnRefresh = document.getElementById('btnAdminRefresh');
  if (btnRefresh) {
    btnRefresh.onclick = () => {
      loadInventory(true);
      loadCategories();
      loadAnalytics(true);
      loadActivityLog(true);
    };
  }

  // Admin Search
  const searchInput = document.getElementById('adminSearchInput');
  if (searchInput) {
    searchInput.oninput = () => {
      State.adminSearchQuery = searchInput.value.trim();
      renderAdminInventoryTable();
    };
  }
}

function initAdminForms() {
  // Form: Map Word / Synonym to Item Pool
  const formMap = document.getElementById('formMapSynonym');
  if (formMap) {
    formMap.onsubmit = async (e) => {
      e.preventDefault();
      const syn = document.getElementById('mapWordInput').value.trim();
      const targetId = document.getElementById('mapTargetItemSelect').value;
      const delta = parseInt(document.getElementById('mapStockDelta').value, 10) || 0;
      const feedback = document.getElementById('mapFeedbackNotice');

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
          document.getElementById('mapWordInput').value = '';
          document.getElementById('mapStockDelta').value = '0';
          loadInventory(false);
          renderSynonymsDirectory();
          setTimeout(() => { feedback.style.display = 'none'; }, 4000);
        }
      } catch (err) {
        console.error('Error mapping synonym:', err);
      }
    };
  }

  // Form: Add New Category
  const formCat = document.getElementById('formAddCategory');
  if (formCat) {
    formCat.onsubmit = async (e) => {
      e.preventDefault();
      const name = document.getElementById('newCatName').value.trim();
      const icon = document.getElementById('newCatIcon').value;
      const desc = document.getElementById('newCatDesc').value.trim();

      if (!name) return;

      try {
        const res = await fetch('/api/categories', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, icon, description: desc })
        });

        const data = await res.json();
        if (data.success) {
          formCat.reset();
          loadCategories();
        } else {
          alert(data.error || 'Failed to add category');
        }
      } catch (err) {
        console.error('Error adding category:', err);
      }
    };
  }

  // Form: Add New Generic Item Modal (Admin)
  const btnOpenAdd = document.getElementById('btnAdminOpenAddItem');
  const addModal = document.getElementById('addItemModal');
  const formAdd = document.getElementById('formAddNewItem');
  const btnCloseAdd = document.getElementById('btnCloseAddItemModal');
  const btnCancelAdd = document.getElementById('btnCancelAddItem');

  if (btnOpenAdd && addModal && formAdd) {
    btnOpenAdd.onclick = () => {
      formAdd.reset();
      // Populate category dropdown from State.categories
      const catSelect = document.getElementById('newItemCategory');
      if (catSelect && State.categories.length > 0) {
        catSelect.innerHTML = State.categories.map(c => `
          <option value="${escapeHtml(c.name)}">${escapeHtml(c.name)}</option>
        `).join('');
      }
      addModal.style.display = 'flex';
    };

    const closeAddModal = () => { addModal.style.display = 'none'; };
    if (btnCloseAdd) btnCloseAdd.onclick = closeAddModal;
    if (btnCancelAdd) btnCancelAdd.onclick = closeAddModal;

    formAdd.onsubmit = async (e) => {
      e.preventDefault();
      const title = document.getElementById('newItemTitle').value.trim();
      const category = document.getElementById('newItemCategory').value;
      const quantity = parseInt(document.getElementById('newItemQuantity').value, 10) || 1;
      const unit = document.getElementById('newItemUnit').value.trim() || 'pcs';
      const condition = document.getElementById('newItemCondition').value;
      const location = document.getElementById('newItemLocation').value.trim() || 'Intake Area';
      const weight_kg = parseFloat(document.getElementById('newItemWeight').value) || 0.5;
      const est_value_eur = parseFloat(document.getElementById('newItemValue').value) || 10.0;
      const co2_factor = parseFloat(document.getElementById('newItemCo2').value) || ((weight_kg) * 2.8).toFixed(1);
      const synRaw = document.getElementById('newItemSynonyms').value.trim();

      const synonyms = synRaw
        ? synRaw.split(',').map(s => s.trim().toLowerCase()).filter(Boolean)
        : [title.toLowerCase()];

      try {
        const res = await fetch('/api/inventory', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title, category, quantity, unit, condition, location,
            weight_kg, est_value_eur, co2_factor, synonyms,
            icon: 'ph-package'
          })
        });

        if (res.ok) {
          closeAddModal();
          loadInventory(false);
        }
      } catch (err) {
        console.error('Error adding new generic item:', err);
      }
    };
  }

  // Form: Edit Item Modal
  initEditItemModal();
}

function initEditItemModal() {
  const modal = document.getElementById('editItemModal');
  const form = document.getElementById('formEditItem');
  const btnClose = document.getElementById('btnCloseEditItemModal');
  const btnCancel = document.getElementById('btnCancelEditItem');

  const closeModal = () => { modal.style.display = 'none'; };
  btnClose.onclick = closeModal;
  btnCancel.onclick = closeModal;

  form.onsubmit = async (e) => {
    e.preventDefault();
    const id = document.getElementById('editItemId').value;
    const title = document.getElementById('editItemTitle').value.trim();
    const category = document.getElementById('editItemCategory').value;
    const quantity = parseInt(document.getElementById('editItemQuantity').value, 10);
    const unit = document.getElementById('editItemUnit').value.trim();
    const condition = document.getElementById('editItemCondition').value;
    const location = document.getElementById('editItemLocation').value.trim();
    const weight_kg = parseFloat(document.getElementById('editItemWeight').value);
    const est_value_eur = parseFloat(document.getElementById('editItemValue').value);
    const co2_factor = parseFloat(document.getElementById('editItemCo2').value);
    const synRaw = document.getElementById('editItemSynonyms').value.trim();

    const synonyms = synRaw ? synRaw.split(',').map(s => s.trim().toLowerCase()).filter(Boolean) : [];

    try {
      const res = await fetch(`/api/inventory/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title, category, quantity, unit, condition, location,
          weight_kg, est_value_eur, co2_factor, synonyms
        })
      });

      if (res.ok) {
        closeModal();
        loadInventory(false);
      }
    } catch (err) {
      console.error('Error updating item:', err);
    }
  };
}

function openEditItemModal(item) {
  const modal = document.getElementById('editItemModal');
  document.getElementById('editItemId').value = item.id;
  document.getElementById('editItemTitle').value = item.title;

  // Populate category select
  const catSelect = document.getElementById('editItemCategory');
  catSelect.innerHTML = State.categories.map(c => `
    <option value="${escapeHtml(c.name)}" ${c.name === item.category ? 'selected' : ''}>${escapeHtml(c.name)}</option>
  `).join('');

  document.getElementById('editItemQuantity').value = item.quantity || 0;
  document.getElementById('editItemUnit').value = item.unit || 'pcs';
  document.getElementById('editItemCondition').value = item.condition || 'Good';
  document.getElementById('editItemLocation').value = item.location || 'Shelf';
  document.getElementById('editItemWeight').value = item.weight_kg || 0.5;
  document.getElementById('editItemValue').value = item.est_value_eur || 10.0;
  document.getElementById('editItemCo2').value = item.co2_factor || ((item.weight_kg || 0.5) * 2.8).toFixed(1);
  document.getElementById('editItemSynonyms').value = (item.synonyms || []).join(', ');

  modal.style.display = 'flex';
}

// ==========================================================================
// CATEGORIES DATA & RENDERING
// ==========================================================================
async function loadCategories() {
  try {
    const res = await fetch('/api/categories');
    const data = await res.json();
    if (data.success && data.categories) {
      State.categories = data.categories;
      renderCategoryFilters();
      renderAdminCategoriesTable();
      populateTargetItemSelect();
    }
  } catch (err) {
    console.error('Error loading categories:', err);
  }
}

function renderCategoryFilters() {
  const bar = document.getElementById('adminCategoryPillsBar');
  if (!bar) return;

  const cats = [{ name: 'All', icon: 'ph-squares-four' }, ...State.categories];
  bar.innerHTML = cats.map(c => `
    <button class="cat-pill ${c.name === State.adminSelectedCategory ? 'active' : ''}" data-cat="${escapeHtml(c.name)}">
      <i class="ph ${c.icon || 'ph-tag'}"></i> ${escapeHtml(c.name)}
    </button>
  `).join('');

  bar.querySelectorAll('.cat-pill').forEach(pill => {
    pill.onclick = () => {
      bar.querySelectorAll('.cat-pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      State.adminSelectedCategory = pill.getAttribute('data-cat');
      renderAdminInventoryTable();
    };
  });
}

function renderAdminCategoriesTable() {
  const tbody = document.getElementById('adminCategoriesTableBody');
  const countBadge = document.getElementById('categoryCountBadge');
  if (!tbody) return;

  countBadge.textContent = State.categories.length;

  tbody.innerHTML = State.categories.map(cat => {
    const itemCount = State.inventory.filter(i => i.category === cat.name).length;
    return `
      <tr>
        <td><strong>${escapeHtml(cat.name)}</strong><br><small style="color: var(--text-muted);">${escapeHtml(cat.description || '')}</small></td>
        <td><i class="ph ${cat.icon || 'ph-tag'}" style="font-size: 1.25rem; color: var(--primary);"></i> <code>${escapeHtml(cat.icon || 'ph-tag')}</code></td>
        <td><span class="stock-tag in-stock">${itemCount} items</span></td>
        <td>
          <button class="btn-item-delete" onclick="deleteCategory('${cat.id}')" title="Delete Category"><i class="ph ph-trash"></i></button>
        </td>
      </tr>
    `;
  }).join('');
}

async function deleteCategory(catId) {
  if (!confirm('Are you sure you want to delete this category?')) return;
  try {
    const res = await fetch(`/api/categories/${catId}`, { method: 'DELETE' });
    if (res.ok) loadCategories();
  } catch (err) {
    console.error('Error deleting category:', err);
  }
}

function populateTargetItemSelect() {
  const select = document.getElementById('mapTargetItemSelect');
  if (!select) return;

  const sorted = [...State.inventory].sort((a, b) => a.title.localeCompare(b.title));
  select.innerHTML = sorted.map(i => `
    <option value="${i.id}">${escapeHtml(i.title)} (${escapeHtml(i.category)} • Stock: ${i.quantity})</option>
  `).join('');
}

// ==========================================================================
// INVENTORY DATA & ADMIN TABLE
// ==========================================================================
async function loadInventory(showNotice = false) {
  try {
    const res = await fetch('/api/inventory');
    const data = await res.json();
    if (data.success && data.items) {
      State.inventory = data.items;
      updateHeaderCount();
      renderAdminInventoryTable();
      renderSynonymsDirectory();
      populateTargetItemSelect();
    }
  } catch (err) {
    console.error('Error loading inventory:', err);
  }
}

function updateHeaderCount() {
  const total = State.inventory.reduce((sum, it) => sum + (it.quantity || 0), 0);
  const badge = document.getElementById('totalCatalogCount');
  if (badge) badge.textContent = total;
}

function renderAdminInventoryTable() {
  const tbody = document.getElementById('adminInventoryTableBody');
  if (!tbody) return;

  const q = State.adminSearchQuery.toLowerCase();
  const cat = State.adminSelectedCategory;

  const filtered = State.inventory.filter(item => {
    if (cat !== 'All' && item.category !== cat) return false;
    if (!q) return true;
    if (item.title.toLowerCase().includes(q)) return true;
    if (item.synonyms && item.synonyms.some(s => s.toLowerCase().includes(q))) return true;
    return false;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" class="empty-notice">No items found matching criteria.</td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = filtered.map(item => {
    const synChips = (item.synonyms && item.synonyms.length > 0)
      ? item.synonyms.map(s => `<span class="synonym-chip-micro">${escapeHtml(s)}</span>`).join('')
      : '<span class="help-text">None</span>';

    return `
      <tr>
        <td>
          <div class="item-cell-wrapper">
            <div class="item-icon-box"><i class="ph ${item.icon || 'ph-package'}"></i></div>
            <div>
              <div class="item-title-text">${escapeHtml(item.title)}</div>
              <div class="item-id-sub">${item.location || 'Shelf'} • ${item.condition || 'Good'}</div>
            </div>
          </div>
        </td>
        <td><span class="category-tag">${escapeHtml(item.category)}</span></td>
        <td>
          <div class="stock-stepper">
            <button class="btn-stock-dec" data-id="${item.id}"><i class="ph ph-minus"></i></button>
            <span class="stock-count-number">${item.quantity || 0}</span>
            <button class="btn-stock-inc" data-id="${item.id}"><i class="ph ph-plus"></i></button>
          </div>
        </td>
        <td>${item.weight_kg || 0.5} kg</td>
        <td>€${item.est_value_eur || 10.0}</td>
        <td>${item.co2_factor || ((item.weight_kg || 0.5) * 2.8).toFixed(1)} kg</td>
        <td><div class="synonym-chips-list">${synChips}</div></td>
        <td>
          <div style="display: flex; gap: 0.35rem;">
            <button class="btn-sm btn-secondary btn-edit-item" data-id="${item.id}" title="Edit Item Details">
              <i class="ph ph-pencil-simple"></i> Edit
            </button>
            <button class="btn-item-delete btn-delete-item" data-id="${item.id}" title="Delete Item">
              <i class="ph ph-trash"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  // Attach Table Event Handlers
  tbody.querySelectorAll('.btn-stock-inc').forEach(btn => {
    btn.onclick = async () => {
      const id = btn.getAttribute('data-id');
      const item = State.inventory.find(i => i.id === id);
      if (item) await updateStockDirect(id, (item.quantity || 0) + 1);
    };
  });

  tbody.querySelectorAll('.btn-stock-dec').forEach(btn => {
    btn.onclick = async () => {
      const id = btn.getAttribute('data-id');
      const item = State.inventory.find(i => i.id === id);
      if (item && item.quantity > 0) await updateStockDirect(id, item.quantity - 1);
    };
  });

  tbody.querySelectorAll('.btn-edit-item').forEach(btn => {
    btn.onclick = () => {
      const id = btn.getAttribute('data-id');
      const item = State.inventory.find(i => i.id === id);
      if (item) openEditItemModal(item);
    };
  });

  tbody.querySelectorAll('.btn-delete-item').forEach(btn => {
    btn.onclick = async () => {
      const id = btn.getAttribute('data-id');
      if (confirm('Delete this item from inventory?')) {
        await deleteItemDirect(id);
      }
    };
  });
}

async function updateStockDirect(id, newQty) {
  try {
    const res = await fetch(`/api/inventory/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quantity: newQty })
    });
    if (res.ok) loadInventory(false);
  } catch (err) {
    console.error('Error updating stock:', err);
  }
}

async function deleteItemDirect(id) {
  try {
    const res = await fetch(`/api/inventory/${id}`, { method: 'DELETE' });
    if (res.ok) loadInventory(false);
  } catch (err) {
    console.error('Error deleting item:', err);
  }
}

// ==========================================================================
// SYNONYM DIRECTORY & POOL MAPPING
// ==========================================================================
function renderSynonymsDirectory() {
  const grid = document.getElementById('synonymDirectoryGrid');
  if (!grid) return;

  const sorted = [...State.inventory].sort((a, b) => a.title.localeCompare(b.title));

  grid.innerHTML = sorted.map(item => {
    const pills = (item.synonyms || []).map((syn, synIdx) => `
      <span class="synonym-pill-admin">
        ${escapeHtml(syn)}
        <button type="button" class="btn-remove-syn" onclick="removeSynonymFromItem('${item.id}', '${escapeHtml(syn)}')" title="Remove synonym">×</button>
      </span>
    `).join('');

    return `
      <div class="synonym-card-item">
        <div class="synonym-card-header">
          <span class="synonym-card-title"><i class="ph ${item.icon || 'ph-package'}"></i> ${escapeHtml(item.title)}</span>
          <span class="synonym-card-stock">${item.quantity || 0} in pool</span>
        </div>
        <div class="synonym-pills-wrap">
          ${pills || '<span class="help-text">No synonyms yet</span>'}
        </div>
        <form class="quick-add-syn-form" onsubmit="event.preventDefault(); addSynonymDirect(this, '${item.id}');">
          <input type="text" placeholder="+ add synonym..." required />
          <button type="submit" class="btn btn-secondary btn-sm"><i class="ph ph-plus"></i></button>
        </form>
      </div>
    `;
  }).join('');
}

async function addSynonymDirect(formEl, itemId) {
  const input = formEl.querySelector('input');
  const word = input.value.trim().toLowerCase();
  if (!word) return;

  const item = State.inventory.find(i => i.id === itemId);
  if (!item) return;

  if (!item.synonyms) item.synonyms = [];
  if (!item.synonyms.includes(word)) {
    item.synonyms.push(word);
    await fetch(`/api/inventory/${itemId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ synonyms: item.synonyms })
    });
    input.value = '';
    loadInventory(false);
  }
}

async function removeSynonymFromItem(itemId, synToRemove) {
  const item = State.inventory.find(i => i.id === itemId);
  if (!item || !item.synonyms) return;

  item.synonyms = item.synonyms.filter(s => s.toLowerCase() !== synToRemove.toLowerCase());

  await fetch(`/api/inventory/${itemId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ synonyms: item.synonyms })
  });

  loadInventory(false);
}

// ==========================================================================
// ANALYTICS & DEMOGRAPHICS
// ==========================================================================
async function loadAnalytics(refresh = true) {
  try {
    const res = await fetch('/api/analytics');
    const data = await res.json();
    if (data.success) {
      renderAnalytics(data);
    }
  } catch (err) {
    console.error('Error loading analytics:', err);
  }
}

function renderAnalytics(data) {
  const ecoSwapped = document.getElementById('adminEcoTotalItemsSwapped');
  const ecoWeight = document.getElementById('adminEcoWeightDiverted');
  const ecoCo2 = document.getElementById('adminEcoCo2Avoided');
  const ecoMoney = document.getElementById('adminEcoMoneySaved');

  if (ecoSwapped) ecoSwapped.textContent = data.totalItemsSwapped || 0;
  if (ecoWeight) ecoWeight.textContent = `${data.totalWeightKg || 0} kg`;
  if (ecoCo2) ecoCo2.textContent = `${data.co2AvoidedKg || 0} kg`;
  if (ecoMoney) ecoMoney.textContent = `€${data.totalValueEur || 0}`;

  const demo = data.demographics || { students: 0, nonStudents: 0, international: 0, domestic: 0 };
  const totalUsers = (demo.students + demo.nonStudents) || 1;
  const pctStudents = Math.round((demo.students / totalUsers) * 100);
  const pctNonStudents = 100 - pctStudents;

  const statStud = document.getElementById('adminStatStudentCount');
  const statNon = document.getElementById('adminStatNonStudentCount');
  const barStud = document.getElementById('adminBarStudents');
  const barNon = document.getElementById('adminBarNonStudents');

  if (statStud) statStud.textContent = `${demo.students} (${pctStudents}%)`;
  if (statNon) statNon.textContent = `${demo.nonStudents} (${pctNonStudents}%)`;
  if (barStud) barStud.style.width = `${pctStudents}%`;
  if (barNon) barNon.style.width = `${pctNonStudents}%`;

  const statIntl = document.getElementById('adminStatIntlCount');
  const statDom = document.getElementById('adminStatDomCount');
  if (statIntl) statIntl.textContent = demo.international;
  if (statDom) statDom.textContent = demo.domestic;

  const actions = data.actions || { 'drop-off': 0, 'pick-up': 0, 'return': 0 };
  const actDrop = document.getElementById('adminStatActionDropoff');
  const actPick = document.getElementById('adminStatActionPickup');
  const actRet = document.getElementById('adminStatActionReturn');

  if (actDrop) actDrop.textContent = actions['drop-off'] || 0;
  if (actPick) actPick.textContent = actions['pick-up'] || 0;
  if (actRet) actRet.textContent = actions['return'] || 0;

  // Accommodations breakdown
  const accomContainer = document.getElementById('adminAccommodationsListBody');
  if (accomContainer) {
    const accoms = data.accommodations || {};
    const accomKeys = Object.keys(accoms);
    if (accomKeys.length === 0) {
      accomContainer.innerHTML = '<div class="empty-notice">No accommodations recorded yet.</div>';
    } else {
      const maxVal = Math.max(...Object.values(accoms), 1);
      accomContainer.innerHTML = accomKeys.map(key => {
        const cnt = accoms[key];
        const pct = Math.round((cnt / maxVal) * 100);
        return `
          <div class="stat-breakdown-row">
            <span class="stat-row-name"><i class="ph ph-buildings"></i> ${escapeHtml(key)}</span>
            <div class="stat-row-bar-wrap">
              <div class="bar-fill blue" style="width: ${pct}%;"></div>
            </div>
            <span class="stat-row-count">${cnt}</span>
          </div>
        `;
      }).join('');
    }
  }

  // Stay durations breakdown
  const stayContainer = document.getElementById('adminStayDurationsListBody');
  if (stayContainer) {
    const stays = data.stayDurations || {};
    const stayKeys = Object.keys(stays);
    if (stayKeys.length === 0) {
      stayContainer.innerHTML = '<div class="empty-notice">No stay durations recorded yet.</div>';
    } else {
      const maxVal = Math.max(...Object.values(stays), 1);
      stayContainer.innerHTML = stayKeys.map(key => {
        const cnt = stays[key];
        const pct = Math.round((cnt / maxVal) * 100);
        return `
          <div class="stat-breakdown-row">
            <span class="stat-row-name"><i class="ph ph-calendar"></i> ${escapeHtml(key)}</span>
            <div class="stat-row-bar-wrap">
              <div class="bar-fill green" style="width: ${pct}%;"></div>
            </div>
            <span class="stat-row-count">${cnt}</span>
          </div>
        `;
      }).join('');
    }
  }
}

// ==========================================================================
// ACTIVITY LOG & TIMELINE
// ==========================================================================
async function loadActivityLog(refresh = true) {
  try {
    const res = await fetch('/api/transactions');
    const data = await res.json();
    if (data.success) {
      renderActivityTimeline(data.transactions);
    }
  } catch (err) {
    console.error('Error loading activity:', err);
  }
}

function renderActivityTimeline(txs) {
  const timeline = document.getElementById('adminActivityTimeline');
  if (!timeline) return;

  if (!txs || txs.length === 0) {
    timeline.innerHTML = '<div class="empty-notice">No transactions logged yet.</div>';
    return;
  }

  timeline.innerHTML = txs.map(tx => {
    const actionClass = tx.action_type || 'drop-off';
    const actionIcon = tx.action_type === 'drop-off' ? 'ph-tray-arrow-down' : (tx.action_type === 'pick-up' ? 'ph-tray-arrow-up' : 'ph-arrows-clockwise');
    const actionLabel = tx.action_type === 'drop-off' ? 'Drop-Off Donation' : (tx.action_type === 'pick-up' ? 'Pick-Up' : 'Return');

    const userDesc = tx.user_type === 'student'
      ? `Student (${tx.is_international ? 'International' : 'Domestic'}) • ${tx.accommodation || 'Accommodation'}`
      : 'Non-Student / Community Visitor';

    const itemsChips = (tx.items && tx.items.length > 0)
      ? tx.items.map(it => `<span class="timeline-item-chip"><strong>${it.amount}x</strong> ${escapeHtml(it.title)}</span>`).join('')
      : '<span class="help-text">General visit</span>';

    const dateStr = new Date(tx.timestamp).toLocaleString();

    return `
      <div class="timeline-item">
        <div class="timeline-dot ${actionClass}">
          <i class="ph ${actionIcon}"></i>
        </div>
        <div class="timeline-header">
          <span class="timeline-title">${actionLabel}</span>
          <span class="timeline-time">${dateStr}</span>
        </div>
        <div class="timeline-meta">
          <span><i class="ph ph-user"></i> ${escapeHtml(userDesc)}</span>
          ${tx.weight_diverted_kg ? `<span>• <i class="ph ph-leaf"></i> ${tx.weight_diverted_kg} kg</span>` : ''}
          ${tx.value_saved_eur ? `<span>• €${tx.value_saved_eur}</span>` : ''}
        </div>
        <div class="timeline-items-pill-group">
          ${itemsChips}
        </div>
      </div>
    `;
  }).join('');
}

// ==========================================================================
// STEP AUTO-SAVE AUDIT DRAWER
// ==========================================================================
function initAuditDrawer() {
  const btnOpen = document.getElementById('btnAuditDrawer');
  const btnClose = document.getElementById('btnCloseAuditDrawer');
  const drawer = document.getElementById('auditDrawer');
  const overlay = document.getElementById('drawerOverlay');

  const openDrawer = () => {
    drawer.classList.add('open');
    overlay.classList.add('open');
  };

  const closeDrawer = () => {
    drawer.classList.remove('open');
    overlay.classList.remove('open');
  };

  if (btnOpen) btnOpen.onclick = openDrawer;
  if (btnClose) btnClose.onclick = closeDrawer;
  if (overlay) overlay.onclick = closeDrawer;
}

function appendAuditDrawerCard(saveEntry) {
  const body = document.getElementById('auditDrawerBody');
  if (!body) return;

  const empty = body.querySelector('.empty-notice');
  if (empty) empty.remove();

  const card = document.createElement('div');
  card.className = 'drawer-save-card';

  card.innerHTML = `
    <div class="drawer-save-header">
      <span class="drawer-step-badge">Step ${saveEntry.step}</span>
      <span class="drawer-save-time"><i class="ph ph-clock"></i> ${saveEntry.time}</span>
    </div>
    <div style="font-size: 0.82rem; font-weight: 600; color: var(--text-main);">${escapeHtml(saveEntry.stepName)}</div>
    <div class="drawer-save-payload">${escapeHtml(JSON.stringify(saveEntry.data, null, 2))}</div>
  `;

  body.prepend(card);
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
