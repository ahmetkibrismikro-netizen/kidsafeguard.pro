// ─────────────────────────────────────────────────────────────────────────────
//  KidSafe Guard Pro – Background Service Worker v2.0
//  TRIPLE-LAYER PROTECTION:
//   Layer 1: declarativeNetRequest (blocks at network level - fastest)
//   Layer 2: webNavigation watcher (catches redirects and SPA navigation)
//   Layer 3: tabs.onUpdated watcher (catches URL changes in active tabs)
// ─────────────────────────────────────────────────────────────────────────────

'use strict';

// ══════════════════════════════════════════════════════════════════════════════
//  MASTER BLOCKED DOMAIN LIST (synced with rules/adult.json)
//  All domains + common subdomains are checked
// ══════════════════════════════════════════════════════════════════════════════
const BLOCKED_DOMAINS = [
  // ── Adult Video Tubes ──
  'pornhub.com','xvideos.com','xhamster.com','xnxx.com',
  'redtube.com','youporn.com','tube8.com','spankbang.com',
  'txxx.com','beeg.com','tnaflix.com','drtuber.com',
  'extremetube.com','slutload.com','empflix.com','fuq.com',
  'cliphunter.com','hclips.com','4tube.com','eporner.com',
  'vporn.com','hardsextube.com','keezmovies.com',
  'porn.com','sex.com','adult.com','xxx.com',
  'xmovies8.com','porntrex.com','faphouse.com','fapster.xxx',
  'lobstertube.com','nuvid.com','porntube.com',
  'bigporntube.com','porndoe.com','shesfreaky.com',
  'porndig.com','pornhat.com','pornone.com',
  'anysex.com','yourporn.sexy','alotporn.com',
  'sextvx.com','xnxx.eu','xvideos2.com',
  'youjizz.com','spankwire.com','pornoxo.com',
  'gotporn.com','wearehairy.com','fux.com',
  'javhd.com','av01.tv','tktube.com','javmost.com',
  'hentaigasm.com','nhentai.net','hentai.tv',
  // ── Adult Studios ──
  'brazzers.com','bangbros.com','realitykings.com',
  'naughtyamerica.com','digitalplayground.com','evilangel.com',
  'wicked.com','penthouse.com','playboy.com','hustler.com',
  'vivid.com','mofos.com','teamskeet.com','puremature.com',
  'twistys.com','girlfriendsfilms.com','adulttime.com',
  'bangbros.com','manyvideos.com',
  // ── Adult Image & Social ──
  'motherless.com','imagefap.com','ero.me',
  'adultfriendfinder.com','ashleymadison.com','fling.com','bdsmlr.com',
  'e621.net','rule34.xxx','rule34.paheal.net','gelbooru.com',
  'danbooru.donmai.us','sankakucomplex.com',
  // ── Gambling ──
  'bet365.com','draftkings.com','fanduel.com',
  'pokerstars.com','888casino.com','888poker.com',
  'betway.com','unibet.com','bwin.com',
  'williamhill.com','betfair.com','paddypower.com',
  'leovegas.com','casumo.com','mrgreen.com',
  'casinoroom.com','rizk.com','jackpotcity.com',
  'bovada.lv','betonline.ag','mybookie.ag',
  'slotomania.com','doubledown.com','casino.com',
  // ── Live Cams & Adult Chat ──
  'chatroulette.com','omegle.com','chaturbate.com',
  'bongacams.com','stripchat.com','livejasmin.com',
  'myfreecams.com','cam4.com','camsoda.com','jerkmate.com',
  'flirt4free.com','jasmin.com','cams.com',
  // ── Drugs / Dark Web ──
  'silk-road.com','darknet.com','onion.ly',
  // ── Violence ──
  'goregrish.com','bestgore.com','liveleak.com','efukt.com',
  // ── Harmful Social ──
  'thechive.com','4chan.org','8chan.moe','kiwifarms.net',
];

const BLOCKED_SET = new Set(BLOCKED_DOMAINS);

// ── INSTALL & STARTUP ────────────────────────────────────────────────────────
chrome.runtime.onInstalled.addListener(async (details) => {
  const data = await chrome.storage.local.get(['password', 'enabled', 'firstRun', 'proLicense', 'proEmail']);

  if (!data.password) {
    await chrome.storage.local.set({
      password: null,
      enabled: false,
      firstRun: true,
      proLicense: null,
      proEmail: null,
      scheduledStart: null,
      scheduledEnd: null,
      blockKeywords: [],
      sessionTimer: null,
    });
  }

  if (data.enabled) await applyRuleset(true);
  await updateBadge(data.enabled || false, !!data.proLicense);
});

chrome.runtime.onStartup.addListener(async () => {
  const { enabled, proLicense } = await chrome.storage.local.get(['enabled', 'proLicense']);
  if (enabled) {
    await applyRuleset(true);
    await updateBadge(true, !!proLicense);
  }
});

// ── LAYER 2: Navigation Watcher ──────────────────────────────────────────────
chrome.webNavigation.onBeforeNavigate.addListener(async (details) => {
  if (details.frameId !== 0) return;
  const { enabled } = await chrome.storage.local.get('enabled');
  if (!enabled) return;
  if (isBlockedUrl(details.url)) {
    chrome.tabs.update(details.tabId, {
      url: chrome.runtime.getURL('blocked.html')
    }).catch(() => {});
  }
});

// ── LAYER 3: Tab URL Watcher ──────────────────────────────────────────────────
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (!changeInfo.url) return;
  const { enabled } = await chrome.storage.local.get('enabled');
  if (!enabled) return;
  if (isBlockedUrl(changeInfo.url)) {
    chrome.tabs.update(tabId, {
      url: chrome.runtime.getURL('blocked.html')
    }).catch(() => {});
  }
});

// ── URL CHECKER ───────────────────────────────────────────────────────────────
function isBlockedUrl(urlStr) {
  if (!urlStr) return false;
  if (urlStr.startsWith('chrome') || urlStr.startsWith('about:') || urlStr.startsWith('chrome-extension:')) return false;
  try {
    const hostname = new URL(urlStr).hostname.toLowerCase().replace(/^www\./, '');
    if (BLOCKED_SET.has(hostname)) return true;
    for (const domain of BLOCKED_SET) {
      if (hostname.endsWith('.' + domain)) return true;
    }
    // Keyword check in URL path for extra protection
    const fullUrl = urlStr.toLowerCase();
    const dangerKeywords = ['porn', 'xxx', 'sex', 'adult', 'nude', 'naked', 'escort', 'hentai'];
    for (const kw of dangerKeywords) {
      if (hostname.includes(kw)) return true;
    }
    return false;
  } catch {
    return false;
  }
}

// ── MESSAGE HANDLER ───────────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {

  if (message.type === 'GET_STATE') {
    chrome.storage.local.get([
      'enabled', 'password', 'firstRun', 'proLicense', 'proEmail',
      'scheduledStart', 'scheduledEnd', 'sessionTimer'
    ]).then(sendResponse);
    return true;
  }

  if (message.type === 'GET_ENABLED') {
    chrome.storage.local.get(['enabled']).then(d => sendResponse({ enabled: !!d.enabled }));
    return true;
  }

  if (message.type === 'SETUP_PASSWORD') {
    const pwd = (message.password || '').trim();
    if (pwd.length < 4) {
      sendResponse({ success: false, error: 'Password must be at least 4 characters.' });
      return true;
    }
    chrome.storage.local.set({ password: pwd, firstRun: false })
      .then(() => sendResponse({ success: true }));
    return true;
  }

  if (message.type === 'ENABLE') {
    enableProtection().then(() => sendResponse({ success: true })).catch(() => sendResponse({ success: false }));
    return true;
  }

  if (message.type === 'DISABLE') {
    chrome.storage.local.get(['password']).then(data => {
      if (message.password === data.password) {
        disableProtection()
          .then(() => sendResponse({ success: true }))
          .catch(() => sendResponse({ success: false }));
      } else {
        sendResponse({ success: false, error: 'Incorrect password. Try again.' });
      }
    });
    return true;
  }

  if (message.type === 'CHANGE_PASSWORD') {
    chrome.storage.local.get(['password']).then(data => {
      if (message.oldPassword !== data.password) {
        sendResponse({ success: false, error: 'Current password is incorrect.' });
        return;
      }
      const newPwd = (message.newPassword || '').trim();
      if (newPwd.length < 4) {
        sendResponse({ success: false, error: 'New password must be at least 4 characters.' });
        return;
      }
      chrome.storage.local.set({ password: newPwd }).then(() => sendResponse({ success: true }));
    });
    return true;
  }

  if (message.type === 'ACTIVATE_PRO') {
    const code = (message.code || '').trim().toUpperCase();
    // Pro license validation: codes start with KSGPRO- and are 16 chars total
    if (validateProCode(code)) {
      chrome.storage.local.set({
        proLicense: code,
        proEmail: message.email || '',
        proActivatedAt: Date.now()
      }).then(() => {
        updateBadge(true, true);
        sendResponse({ success: true });
      });
    } else {
      sendResponse({ success: false, error: 'Invalid license code. Please check your email and try again.' });
    }
    return true;
  }

  if (message.type === 'SET_SCHEDULE') {
    chrome.storage.local.set({
      scheduledStart: message.start,
      scheduledEnd: message.end
    }).then(() => sendResponse({ success: true }));
    return true;
  }

  if (message.type === 'GET_BLOCKED_COUNT') {
    chrome.storage.local.get(['blockedCount']).then(d => {
      sendResponse({ count: d.blockedCount || 0 });
    });
    return true;
  }
});

// ── PRO CODE VALIDATOR ────────────────────────────────────────────────────────
function validateProCode(code) {
  // Format: KSGPRO-XXXXXXXX (15 chars with dash)
  if (!code || code.length !== 15) return false;
  if (!code.startsWith('KSGPRO-')) return false;
  const suffix = code.slice(7);
  if (!/^[A-Z0-9]{8}$/.test(suffix)) return false;
  return true;
}

// ── ENABLE / DISABLE ──────────────────────────────────────────────────────────
async function enableProtection() {
  await applyRuleset(true);
  await chrome.storage.local.set({ enabled: true });
  const { proLicense } = await chrome.storage.local.get('proLicense');
  await updateBadge(true, !!proLicense);
  reloadAllTabs();
}

async function disableProtection() {
  await applyRuleset(false);
  await chrome.storage.local.set({ enabled: false });
  const { proLicense } = await chrome.storage.local.get('proLicense');
  await updateBadge(false, !!proLicense);
  reloadAllTabs();
}

async function applyRuleset(enable) {
  try {
    if (enable) {
      await chrome.declarativeNetRequest.updateEnabledRulesets({
        enableRulesetIds: ['adult_block'],
        disableRulesetIds: []
      });
    } else {
      await chrome.declarativeNetRequest.updateEnabledRulesets({
        enableRulesetIds: [],
        disableRulesetIds: ['adult_block']
      });
    }
  } catch (e) {
    console.warn('Ruleset update error:', e);
  }
}

async function updateBadge(enabled, isPro) {
  try {
    if (isPro && enabled) {
      await chrome.action.setBadgeText({ text: 'PRO' });
      await chrome.action.setBadgeBackgroundColor({ color: '#f59e0b' });
    } else if (enabled) {
      await chrome.action.setBadgeText({ text: 'ON' });
      await chrome.action.setBadgeBackgroundColor({ color: '#22c55e' });
    } else {
      await chrome.action.setBadgeText({ text: 'OFF' });
      await chrome.action.setBadgeBackgroundColor({ color: '#94a3b8' });
    }
  } catch (e) { /* ignore */ }
}

function reloadAllTabs() {
  chrome.tabs.query({}, (tabs) => {
    for (const tab of tabs) {
      if (tab.url &&
        !tab.url.startsWith('chrome://') &&
        !tab.url.startsWith('chrome-extension://') &&
        !tab.url.startsWith('about:')) {
        chrome.tabs.reload(tab.id).catch(() => {});
      }
    }
  });
}

// ── KEEP ALIVE ─────────────────────────────────────────────────────────────────
chrome.alarms.create('keepAlive', { periodInMinutes: 0.5 });
chrome.alarms.create('scheduleCheck', { periodInMinutes: 1 });

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'keepAlive') {
    const { enabled } = await chrome.storage.local.get('enabled');
    if (enabled) await applyRuleset(true);
  }

  if (alarm.name === 'scheduleCheck') {
    const data = await chrome.storage.local.get(['scheduledStart', 'scheduledEnd', 'enabled', 'proLicense']);
    if (!data.proLicense || !data.scheduledStart || !data.scheduledEnd) return;

    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes();
    const [startH, startM] = data.scheduledStart.split(':').map(Number);
    const [endH, endM] = data.scheduledEnd.split(':').map(Number);
    const startMins = startH * 60 + startM;
    const endMins = endH * 60 + endM;

    const shouldBeActive = currentTime >= startMins && currentTime < endMins;
    if (shouldBeActive && !data.enabled) {
      await enableProtection();
    } else if (!shouldBeActive && data.enabled) {
      await disableProtection();
    }
  }
});
