// KidSafe Guard Pro – YouTube Safe Mode v2.0
(function () {
  'use strict';

  chrome.runtime.sendMessage({ type: 'GET_ENABLED' }, (response) => {
    if (chrome.runtime.lastError || !response?.enabled) return;
    enforceYouTubeSafe();
  });

  function enforceYouTubeSafe() {
    // 1. Set Restricted Mode cookie
    const expiry = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toUTCString();
    document.cookie = `PREF=f2=8000000&hl=en; expires=${expiry}; domain=.youtube.com; path=/`;
    document.cookie = `VISITOR_INFO1_LIVE=; expires=${expiry}; domain=.youtube.com; path=/`;

    // 2. Force ?safe=active
    const url = new URL(window.location.href);
    if (url.searchParams.get('safe') !== 'active') {
      const safePaths = ['/', '/watch', '/results', '/channel', '/c/', '/@', '/shorts', '/feed'];
      if (safePaths.some(p => url.pathname.startsWith(p))) {
        url.searchParams.set('safe', 'active');
        window.history.replaceState(null, '', url.toString());
      }
    }

    // 3. Intercept pushState / replaceState
    const patchHistory = (method) => {
      const original = history[method].bind(history);
      history[method] = function (state, title, newUrl) {
        return original(state, title, addSafe(newUrl));
      };
    };
    patchHistory('pushState');
    patchHistory('replaceState');

    // 4. Watch DOM for link mutations
    const observer = new MutationObserver(patchLinks);
    const startObserver = () => {
      if (document.body) {
        observer.observe(document.body, { childList: true, subtree: true });
        patchLinks();
      }
    };
    if (document.body) startObserver();
    else document.addEventListener('DOMContentLoaded', startObserver);

    // 5. Re-enforce on YouTube navigation events
    window.addEventListener('yt-navigate-finish', () => {
      const cur = new URL(window.location.href);
      if (cur.searchParams.get('safe') !== 'active') {
        cur.searchParams.set('safe', 'active');
        window.history.replaceState(null, '', cur.toString());
      }
      patchLinks();
    });
  }

  function addSafe(urlStr) {
    if (!urlStr || urlStr.startsWith('blob:') || urlStr.startsWith('data:')) return urlStr;
    try {
      const u = new URL(urlStr, window.location.origin);
      u.searchParams.set('safe', 'active');
      return u.pathname + u.search + u.hash;
    } catch {
      return urlStr;
    }
  }

  function patchLinks() {
    const links = document.querySelectorAll('a[href]');
    links.forEach(link => {
      const href = link.getAttribute('href');
      if (!href || href.startsWith('http') || href.includes('safe=active')) return;
      if (href.startsWith('/watch') || href.startsWith('/results') ||
          href.startsWith('/shorts') || href.startsWith('/channel') ||
          href.startsWith('/@') || href.startsWith('/c/')) {
        try {
          const u = new URL(href, window.location.origin);
          u.searchParams.set('safe', 'active');
          link.setAttribute('href', u.pathname + u.search);
        } catch {}
      }
    });
  }
})();
