/* Umami bekommt keine Schlüssel aus Adressen (Audit 10.10.2026, S1).
 * Sharelinks (/share/<token>) und Passwort-Links (/reset/<token>) werden
 * gekürzt, Suchteil und Anker schickt Umami ohnehin nicht mehr
 * (data-exclude-search, data-exclude-hash in index.html). Fremde Verweise
 * gehen nur als Ursprung mit. Die Version steht im Dateinamen, weil nginx
 * .js-Dateien lange zwischenspeichert. */
(function () {
  var SECRET_PATH = /^\/(share|reset)\/[^/?#]+/;
  function clean(u, foreignOrigin) {
    if (!u) return u;
    try {
      var x = new URL(u, location.origin);
      if (x.origin !== location.origin) return foreignOrigin ? x.origin + '/' : '';
      var p = x.pathname.replace(SECRET_PATH, '/$1/…');
      return /^https?:/i.test(u) ? x.origin + p : p;
    } catch (e) { return ''; }
  }
  window.cvUmamiBeforeSend = function (type, payload) {
    if (!payload || typeof payload !== 'object') return payload;
    if (payload.url) payload.url = clean(payload.url, false);
    if (payload.referrer) payload.referrer = clean(payload.referrer, true);
    return payload;
  };
})();
