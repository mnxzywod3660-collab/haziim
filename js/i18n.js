/* ============================================
   i18n - Internationalization Module
   ============================================ */
(function () {
  var i18n = {
    currentLang: 'ar',
    translations: {},

    loadLang: async function (lang) {
      try {
        var url = 'lang/' + lang + '.json?_=' + Date.now();
        var resp = await fetch(url);
        if (!resp.ok && lang !== 'en') {
          resp = await fetch('lang/en.json?_=' + Date.now());
        }
        if (!resp.ok) { this.translations = {}; return; }
        this.translations = await resp.json();
      } catch (e) {
        this.translations = {};
      }
    },

    t: function (key, params) {
      if (!key) return '';
      var val = key.split('.').reduce(function (o, k) {
        return (o && o[k] !== undefined && o[k] !== null) ? o[k] : null;
      }, this.translations);
      if (val === null || val === undefined) return key;
      if (params) {
        var keys = Object.keys(params);
        for (var i = 0; i < keys.length; i++) {
          var re = new RegExp('\\{' + keys[i] + '\\}', 'g');
          val = val.replace(re, params[keys[i]]);
        }
      }
      return val;
    },

    apply: function () {
      var isAr = this.currentLang === 'ar';
      var root = document.documentElement;
      root.lang = this.currentLang;
      root.dir = isAr ? 'rtl' : 'ltr';

      var savedTheme = localStorage.getItem('theme');
      root.classList.toggle('dark', savedTheme === 'dark');

      var i18nEls = document.querySelectorAll('[data-i18n]');
      for (var i = 0; i < i18nEls.length; i++) {
        var key = i18nEls[i].getAttribute('data-i18n');
        if (key) i18nEls[i].textContent = this.t(key);
      }

      var phEls = document.querySelectorAll('[data-i18n-placeholder]');
      for (var j = 0; j < phEls.length; j++) {
        var pk = phEls[j].getAttribute('data-i18n-placeholder');
        if (pk) phEls[j].placeholder = this.t(pk);
      }

      var titleEls = document.querySelectorAll('[data-i18n-title]');
      for (var k = 0; k < titleEls.length; k++) {
        var tk = titleEls[k].getAttribute('data-i18n-title');
        if (tk) titleEls[k].title = this.t(tk);
      }

      var valueEls = document.querySelectorAll('[data-i18n-value]');
      for (var v = 0; v < valueEls.length; v++) {
        var vk = valueEls[v].getAttribute('data-i18n-value');
        if (vk) valueEls[v].value = this.t(vk);
      }

      var langBtn = document.getElementById('langToggle');
      if (langBtn) langBtn.textContent = this.t('lang.switch');

      var langSelect = document.getElementById('langSelect');
      if (langSelect) langSelect.value = this.currentLang;

      document.dispatchEvent(new CustomEvent('languageChanged', {
        detail: { lang: this.currentLang }
      }));
    },

    init: async function () {
      var saved = localStorage.getItem('lang');
      this.currentLang = saved || 'ar';
      await this.loadLang(this.currentLang);
      this.apply();
    },

    switchLanguage: async function (lang) {
      if (lang === this.currentLang) return;
      this.currentLang = lang;
      localStorage.setItem('lang', lang);
      await this.loadLang(lang);
      this.apply();
    },

    toggleLanguage: async function () {
      var next = this.currentLang === 'ar' ? 'en' : 'ar';
      await this.switchLanguage(next);
    },

    n: function (num) {
      var val = Number(num);
      if (isNaN(val)) return '0';
      return val.toLocaleString(this.currentLang === 'ar' ? 'ar-EG' : 'en-US');
    },

    d: function (date) {
      if (!date) return '';
      return new Date(date).toLocaleDateString(
        this.currentLang === 'ar' ? 'ar-EG' : 'en-US',
        { year: 'numeric', month: 'short', day: 'numeric' }
      );
    },

    t12: function (date) {
      if (!date) return '';
      return new Date(date).toLocaleTimeString(
        this.currentLang === 'ar' ? 'ar-EG' : 'en-US',
        { hour: '2-digit', minute: '2-digit' }
      );
    },

    dt: function (date) {
      if (!date) return '';
      return new Date(date).toLocaleString(
        this.currentLang === 'ar' ? 'ar-EG' : 'en-US'
      );
    },

    fmt: function (type) {
      return type === 'IN' ? this.t('type.in') : this.t('type.out');
    }
  };

  window.i18n = i18n;
  window.i18nReady = i18n.init();
  window.toggleLanguage = function () { i18n.toggleLanguage(); };
})();
