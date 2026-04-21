// ─────────────────────────────────────────────────────────────────────────────
//  KidSafe Guard Pro – Popup Logic v2.0
// ─────────────────────────────────────────────────────────────────────────────
'use strict';

let currentEnabled = false;
let isPro = false;

// ── BOOT ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  bindAll();
  loadState();
});

// ── BIND ALL BUTTONS ──────────────────────────────────────────────────────────
function bindAll() {
  on('mainBtn',           'click', handleMainBtn);
  on('changePwdBtn',      'click', openChangePwdModal);
  on('aboutBtn',          'click', () => openModal('aboutModal'));
  on('proActivateBtn',    'click', openProModal);
  on('proCta',            'click', () => window.open('https://kidsafeguard.pro/#pricing', '_blank'));
  on('scheduleBtn',       'click', openScheduleModal);

  // Setup
  on('setupSaveBtn',      'click', saveSetupPassword);
  on('setupPwd1',         'keydown', enterKey(saveSetupPassword));
  on('setupPwd2',         'keydown', enterKey(saveSetupPassword));

  // Disable
  on('disableCancelBtn',  'click', () => closeModal('disableModal'));
  on('disableConfirmBtn', 'click', doDisable);
  on('disablePwd',        'keydown', enterKey(doDisable));

  // Change Password
  on('changePwdCancelBtn','click', () => closeModal('changePwdModal'));
  on('changePwdSaveBtn',  'click', doChangePassword);
  on('oldPwd',            'keydown', enterKey(doChangePassword));
  on('newPwd1',           'keydown', enterKey(doChangePassword));
  on('newPwd2',           'keydown', enterKey(doChangePassword));

  // Pro
  on('proCancelBtn',      'click', () => closeModal('proModal'));
  on('proConfirmBtn',     'click', doActivatePro);
  on('proCode',           'keydown', enterKey(doActivatePro));

  // Schedule
  on('scheduleCancelBtn', 'click', () => closeModal('scheduleModal'));
  on('scheduleSaveBtn',   'click', doSaveSchedule);

  // About
  on('aboutCloseBtn',     'click', () => closeModal('aboutModal'));

  // Click overlay to close
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay && overlay.id !== 'setupModal') {
        closeModal(overlay.id);
      }
    });
  });
}

// ── LOAD STATE ────────────────────────────────────────────────────────────────
async function loadState() {
  const state = await msg('GET_STATE');
  currentEnabled = state.enabled || false;
  isPro = !!(state.proLicense);

  if (state.firstRun || !state.password) {
    openModal('setupModal');
    setTimeout(() => el('setupPwd1').focus(), 200);
    return;
  }

  renderState(currentEnabled, isPro);

  if (state.scheduledStart && el('scheduleStart')) {
    el('scheduleStart').value = state.scheduledStart;
  }
  if (state.scheduledEnd && el('scheduleEnd')) {
    el('scheduleEnd').value = state.scheduledEnd;
  }
}

// ── RENDER UI ─────────────────────────────────────────────────────────────────
function renderState(enabled, pro) {
  currentEnabled = enabled;
  isPro = pro;

  const ring   = el('statusRing');
  const label  = el('statusLabel');
  const sub    = el('statusSub');
  const btn    = el('mainBtn');
  const badge  = el('proBadge');
  const cta    = el('proCta');
  const stats  = el('statsRow');
  const dots   = [1,2,3,4,5].map(i => el(`dot${i}`));

  // Pro badge
  badge.classList.toggle('show', pro);
  cta.classList.toggle('hidden', pro);
  stats.classList.toggle('show', pro);

  // Dot 5 (schedule) only active if pro
  dots[4].classList.toggle('active', pro && enabled);

  if (enabled) {
    document.body.classList.add('protected');
    ring.textContent = '🛡️';
    ring.classList.add('on');
    label.textContent = pro ? '✨ Pro Protection ON' : 'Protection ON';
    sub.textContent   = 'Your child is safe ✅';
    btn.className     = 'toggle-btn btn-disable';
    btn.textContent   = '🔓 Turn Off Protection';
    dots.slice(0,4).forEach(d => d.classList.add('active'));
  } else {
    document.body.classList.remove('protected');
    ring.textContent = '🔓';
    ring.classList.remove('on');
    label.textContent = 'Protection OFF';
    sub.textContent   = 'Tap to protect your child';
    btn.className     = 'toggle-btn btn-enable';
    btn.textContent   = '🔒 Enable Child Protection';
    dots.forEach(d => d.classList.remove('active'));
  }
}

// ── MAIN TOGGLE ───────────────────────────────────────────────────────────────
function handleMainBtn() {
  if (currentEnabled) {
    el('disablePwd').value = '';
    el('disableError').classList.remove('show');
    openModal('disableModal');
    setTimeout(() => el('disablePwd').focus(), 150);
  } else {
    doEnable();
  }
}

async function doEnable() {
  const btn = el('mainBtn');
  btn.disabled    = true;
  btn.innerHTML   = '<span class="spinner"></span> Enabling…';
  await new Promise(r => setTimeout(r, 300));
  const res = await msg('ENABLE');
  btn.disabled    = false;
  if (res && res.success) {
    renderState(true, isPro);
  }
}

async function doDisable() {
  const pwd   = el('disablePwd').value;
  const errEl = el('disableError');
  const btn   = el('disableConfirmBtn');
  btn.disabled  = true;
  btn.innerHTML = '<span class="spinner"></span>';

  const res = await msg('DISABLE', { password: pwd });
  btn.disabled  = false;
  btn.innerHTML = '🔓 Turn Off';

  if (res && res.success) {
    closeModal('disableModal');
    renderState(false, isPro);
  } else {
    showError('disableError', (res && res.error) || 'Incorrect password!');
    shake(el('disablePwd'));
    el('disablePwd').value = '';
    el('disablePwd').focus();
  }
}

// ── SETUP ─────────────────────────────────────────────────────────────────────
async function saveSetupPassword() {
  const p1 = el('setupPwd1').value.trim();
  const p2 = el('setupPwd2').value.trim();
  if (p1.length < 4) { showError('setupError', 'Password must be at least 4 characters.'); return; }
  if (p1 !== p2)     { showError('setupError', 'Passwords do not match.'); shake(el('setupPwd2')); el('setupPwd2').value=''; el('setupPwd2').focus(); return; }

  const res = await msg('SETUP_PASSWORD', { password: p1 });
  if (res && res.success) {
    closeModal('setupModal');
    renderState(false, false);
  } else {
    showError('setupError', (res && res.error) || 'Could not save password.');
  }
}

// ── CHANGE PASSWORD ───────────────────────────────────────────────────────────
function openChangePwdModal() {
  ['oldPwd','newPwd1','newPwd2'].forEach(id => { el(id).value = ''; });
  el('changePwdError').classList.remove('show');
  el('changePwdSuccess').classList.remove('show');
  openModal('changePwdModal');
  setTimeout(() => el('oldPwd').focus(), 150);
}

async function doChangePassword() {
  const old = el('oldPwd').value;
  const n1  = el('newPwd1').value.trim();
  const n2  = el('newPwd2').value.trim();

  if (n1 !== n2) { showError('changePwdError', 'New passwords do not match.'); return; }
  if (n1.length < 4) { showError('changePwdError', 'Minimum 4 characters.'); return; }

  const res = await msg('CHANGE_PASSWORD', { oldPassword: old, newPassword: n1 });
  if (res && res.success) {
    el('changePwdError').classList.remove('show');
    el('changePwdSuccess').classList.add('show');
    setTimeout(() => closeModal('changePwdModal'), 1500);
  } else {
    showError('changePwdError', (res && res.error) || 'Incorrect password.');
    shake(el('oldPwd')); el('oldPwd').value = ''; el('oldPwd').focus();
  }
}

// ── PRO ACTIVATION ────────────────────────────────────────────────────────────
function openProModal() {
  el('proCode').value  = '';
  el('proEmail').value = '';
  el('proError').classList.remove('show');
  el('proSuccess').classList.remove('show');
  openModal('proModal');
  setTimeout(() => el('proCode').focus(), 150);
}

async function doActivatePro() {
  const code  = el('proCode').value.trim().toUpperCase();
  const email = el('proEmail').value.trim();
  const btn   = el('proConfirmBtn');

  if (!code) { showError('proError', 'Please enter your license code.'); return; }
  if (!email) { showError('proError', 'Please enter your email address.'); return; }

  btn.disabled  = true;
  btn.innerHTML = '<span class="spinner"></span> Activating…';

  await new Promise(r => setTimeout(r, 800));
  const res = await msg('ACTIVATE_PRO', { code, email });
  btn.disabled  = false;
  btn.innerHTML = '⭐ Activate Pro';

  if (res && res.success) {
    el('proError').classList.remove('show');
    el('proSuccess').classList.add('show');
    isPro = true;
    setTimeout(() => {
      closeModal('proModal');
      renderState(currentEnabled, true);
    }, 1800);
  } else {
    showError('proError', (res && res.error) || 'Invalid code.');
    shake(el('proCode'));
  }
}

// ── SCHEDULE (Pro) ────────────────────────────────────────────────────────────
function openScheduleModal() {
  if (!isPro) {
    openModal('proModal');
    setTimeout(() => {
      el('proError').textContent = '⭐ Schedule feature requires Pro. Please activate your license.';
      el('proError').classList.add('show');
    }, 100);
    return;
  }
  el('scheduleError').classList.remove('show');
  el('scheduleSuccess').classList.remove('show');
  openModal('scheduleModal');
}

async function doSaveSchedule() {
  const start = el('scheduleStart').value;
  const end   = el('scheduleEnd').value;
  if (!start || !end) { showError('scheduleError', 'Please set both start and end times.'); return; }
  if (start >= end)   { showError('scheduleError', 'End time must be after start time.'); return; }

  const res = await msg('SET_SCHEDULE', { start, end });
  if (res && res.success) {
    el('scheduleError').classList.remove('show');
    el('scheduleSuccess').classList.add('show');
    setTimeout(() => closeModal('scheduleModal'), 1500);
  }
}

// ── MODALS ────────────────────────────────────────────────────────────────────
function openModal(id)  { el(id).classList.add('show'); }
function closeModal(id) { el(id).classList.remove('show'); }

function showError(elId, text) {
  const e = el(elId);
  e.textContent = text;
  e.classList.add('show');
}

function shake(element) {
  element.classList.remove('shake');
  void element.offsetWidth;
  element.classList.add('shake');
  setTimeout(() => element.classList.remove('shake'), 500);
}

// ── UTILS ─────────────────────────────────────────────────────────────────────
function el(id) { return document.getElementById(id); }

function on(id, event, handler) {
  const element = document.getElementById(id);
  if (element) element.addEventListener(event, handler);
}

function enterKey(fn) {
  return (e) => { if (e.key === 'Enter') fn(); };
}

function msg(type, extra = {}) {
  return new Promise((resolve) => {
    try {
      chrome.runtime.sendMessage({ type, ...extra }, (response) => {
        if (chrome.runtime.lastError) {
          resolve({ success: false, error: 'Extension error. Please reload.' });
          return;
        }
        resolve(response || { success: false });
      });
    } catch (err) {
      resolve({ success: false });
    }
  });
}
