// KidSafe Guard Pro – Safe Search Enforcer
(function () {
  'use strict';
  chrome.runtime.sendMessage({ type: 'GET_ENABLED' }, (response) => {
    if (chrome.runtime.lastError || !response?.enabled) return;
    enforceSafeSearch();
  });

  function enforceSafeSearch() {
    const host = window.location.hostname;
    const url  = new URL(window.location.href);

    if (host.includes('google.com')) {
      if (!url.searchParams.get('safe') || url.searchParams.get('safe') !== 'active') {
        url.searchParams.set('safe', 'active');
        window.history.replaceState(null, '', url.toString());
      }
      // Set safe search cookie
      document.cookie = 'GOOGLE_ABUSE_EXEMPTION=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
    }

    if (host.includes('bing.com')) {
      if (url.searchParams.get('adlt') !== 'strict') {
        url.searchParams.set('adlt', 'strict');
        window.history.replaceState(null, '', url.toString());
      }
    }

    if (host.includes('duckduckgo.com')) {
      if (url.searchParams.get('kp') !== '1') {
        url.searchParams.set('kp', '1');
        window.history.replaceState(null, '', url.toString());
      }
    }
  }
})();
