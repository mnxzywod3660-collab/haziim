/* ============================================
   Settings Module
   ============================================ */

var archivedProducts = [];

/* ============================================
   Initialize Settings
   ============================================ */

async function initSettings() {
  await loadWarehouseSettings();
  loadThreshold();
  loadLanguage();
  loadTheme();
  await loadArchivedProducts();
  renderArchivedProducts();
}

/* ============================================
   Warehouse Name
   ============================================ */

async function loadWarehouseSettings() {
  try {
    var res = await supabase
      .from('settings')
      .select('id, warehouse_name')
      .limit(1)
      .maybeSingle();

    if (res.error) throw res.error;

    var input = document.getElementById('warehouseNameInput');
    if (res.data) {
      input.value = res.data.warehouse_name;
    } else {
      var insertRes = await supabase
        .from('settings')
        .insert({ warehouse_name: window.i18n.t('app.name') })
        .select();
      if (insertRes.data && insertRes.data[0]) {
        input.value = insertRes.data[0].warehouse_name;
      }
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function saveWarehouseName() {
  var input = document.getElementById('warehouseNameInput');
  var name = input.value.trim();
  if (!name) {
    showToast(window.i18n.t('error.requiredName'), 'error');
    return;
  }

  try {
    var res = await supabase.from('settings').select('id').limit(1).maybeSingle();
    if (res.error) throw res.error;

    if (res.data) {
      await supabase.from('settings').update({ warehouse_name: name }).eq('id', res.data.id);
    } else {
      await supabase.from('settings').insert({ warehouse_name: name });
    }

    showToast(window.i18n.t('success.warehouseUpdated'), 'success');
    var titleEl = document.getElementById('warehouseTitle');
    if (titleEl) titleEl.textContent = name;
  } catch (err) {
    showToast(err.message, 'error');
  }
}

/* ============================================
   Low Stock Threshold
   ============================================ */

function loadThreshold() {
  var val = localStorage.getItem('lowStockThreshold');
  document.getElementById('thresholdInput').value = val ? parseInt(val) : 10;
}

function saveThreshold() {
  var val = parseInt(document.getElementById('thresholdInput').value);
  if (!val || val < 1) val = 10;
  localStorage.setItem('lowStockThreshold', val);
  showToast(window.i18n.t('success.settingsSaved'), 'success');
}

/* ============================================
   Language
   ============================================ */

function loadLanguage() {
  var lang = localStorage.getItem('lang') || 'ar';
  var sel = document.getElementById('langSelect');
  if (sel) sel.value = lang;
}

function changeLanguage(lang) {
  window.i18n.switchLanguage(lang).then(function () {
    var sel = document.getElementById('langSelect');
    if (sel) sel.value = lang;
  });
}

/* ============================================
   Theme
   ============================================ */

function loadTheme() {
  var theme = localStorage.getItem('theme') || 'light';
  var sel = document.getElementById('themeSelect');
  if (sel) sel.value = theme;
  if (theme === 'dark') {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
}

function changeTheme(theme) {
  localStorage.setItem('theme', theme);
  if (theme === 'dark') {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
  var sel = document.getElementById('themeSelect');
  if (sel) sel.value = theme;
  document.dispatchEvent(new CustomEvent('themeChanged'));
}

/* ============================================
   Archived Products
   ============================================ */

async function loadArchivedProducts() {
  try {
    var res = await supabase
      .from('products')
      .select('*')
      .eq('is_archived', true)
      .order('archived_at', { ascending: false });

    if (res.error) throw res.error;
    archivedProducts = res.data || [];
  } catch (err) {
    showToast(err.message, 'error');
    archivedProducts = [];
  }
}

function renderArchivedProducts() {
  var tbody = document.getElementById('archivedTableBody');
  if (!tbody) return;

  if (archivedProducts.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--text-secondary);padding:40px;">' +
      window.i18n.t('settings.noArchived') + '</td></tr>';
    return;
  }

  var html = '';
  for (var i = 0; i < archivedProducts.length; i++) {
    var p = archivedProducts[i];
    var archiveDate = p.archived_at ? window.i18n.dt(p.archived_at) : window.i18n.d(p.updated_at);

    html += '<tr>' +
      '<td><strong>' + escapeHtml(p.name) + '</strong></td>' +
      '<td>' + window.i18n.n(p.quantity) + '</td>' +
      '<td>' + archiveDate + '</td>' +
      '<td><button class="btn btn-success btn-sm" onclick="restoreProduct(' + p.id + ')">' +
      window.i18n.t('product.restore') + '</button></td>' +
      '</tr>';
  }
  tbody.innerHTML = html;
}

async function restoreProduct(id) {
  if (!confirm(window.i18n.t('settings.restoreConfirm') + '?"')) return;

  try {
    var res = await supabase
      .from('products')
      .update({ is_archived: false, archived_at: null })
      .eq('id', id);

    if (res.error) throw res.error;

    showToast(window.i18n.t('success.productRestored'), 'success');
    await loadArchivedProducts();
    renderArchivedProducts();
  } catch (err) {
    showToast(err.message, 'error');
  }
}
