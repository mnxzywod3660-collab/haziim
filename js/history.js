/* ============================================
   History Module
   ============================================ */

var historyData = [];
var currentPeriod = 'today';
var productNamesCache = {};

/* ============================================
   Fetch Product Name
   ============================================ */

async function fetchProductName(productId) {
  if (productNamesCache[productId]) return productNamesCache[productId];
  try {
    var res = await supabase
      .from('products')
      .select('name')
      .eq('id', productId)
      .single();

    if (res.error) throw res.error;
    productNamesCache[productId] = res.data.name;
    return res.data.name;
  } catch (e) {
    productNamesCache[productId] = 'Unknown';
    return 'Unknown';
  }
}

/* ============================================
   Fetch History
   ============================================ */

async function fetchHistory(period) {
  try {
    var query = supabase
      .from('history')
      .select('*')
      .order('created_at', { ascending: false });

    var now = new Date();
    var fromDate = null;

    if (period === 'today') {
      fromDate = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    } else if (period === 'week') {
      var dayOfWeek = now.getDay();
      var diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      var monday = new Date(now);
      monday.setDate(now.getDate() - diff);
      monday.setHours(0, 0, 0, 0);
      fromDate = monday.toISOString();
    } else if (period === 'month') {
      fromDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    }

    if (fromDate) {
      query = query.gte('created_at', fromDate);
    }

    var res = await query;
    if (res.error) throw res.error;
    historyData = res.data || [];

    var promises = [];
    for (var i = 0; i < historyData.length; i++) {
      promises.push(fetchProductName(historyData[i].product_id));
    }
    await Promise.all(promises);

    return historyData;
  } catch (err) {
    showToast(err.message, 'error');
    return [];
  }
}

/* ============================================
   Filters
   ============================================ */

function getFilteredHistory() {
  var productFilter = (document.getElementById('filterProduct').value || '').toLowerCase().trim();
  var fromDate = document.getElementById('filterFrom').value;
  var toDate = document.getElementById('filterTo').value;
  var filtered = historyData.slice();

  if (productFilter) {
    filtered = filtered.filter(function (h) {
      var name = productNamesCache[h.product_id] || '';
      return name.toLowerCase().indexOf(productFilter) !== -1;
    });
  }

  if (fromDate) {
    var from = new Date(fromDate);
    filtered = filtered.filter(function (h) {
      return new Date(h.created_at) >= from;
    });
  }

  if (toDate) {
    var to = new Date(toDate);
    to.setHours(23, 59, 59, 999);
    filtered = filtered.filter(function (h) {
      return new Date(h.created_at) <= to;
    });
  }

  return filtered;
}

/* ============================================
   Render Table
   ============================================ */

function renderHistoryTable() {
  var tbody = document.getElementById('historyTableBody');
  if (!tbody) return;
  var data = getFilteredHistory();

  if (data.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--text-secondary);padding:40px;">' +
      window.i18n.t('empty.history') + '</td></tr>';
    return;
  }

  var html = '';
  for (var i = 0; i < data.length; i++) {
    var h = data[i];
    var name = productNamesCache[h.product_id] || 'Unknown';
    var color = h.operation_type === 'IN' ? '#34a853' : '#d93025';

    html += '<tr>' +
      '<td>' + window.i18n.d(h.created_at) + '</td>' +
      '<td>' + window.i18n.t12(h.created_at) + '</td>' +
      '<td>' + escapeHtml(name) + '</td>' +
      '<td style="color:' + color + ';font-weight:600;">' + window.i18n.fmt(h.operation_type) + '</td>' +
      '<td>' + window.i18n.n(h.quantity) + '</td>' +
      '</tr>';
  }
  tbody.innerHTML = html;
}

/* ============================================
   Reports
   ============================================ */

function renderReports() {
  var weeklyContent = document.getElementById('weeklyReportContent');
  var monthlyContent = document.getElementById('monthlyReportContent');

  if (currentPeriod === 'week') {
    weeklyContent.innerHTML = generateReportHTML(historyData);
  } else {
    weeklyContent.innerHTML = '<p style="color:var(--text-secondary);">' +
      window.i18n.t('report.selectWeek') + '</p>';
  }

  if (currentPeriod === 'month') {
    monthlyContent.innerHTML = generateReportHTML(historyData);
  } else {
    monthlyContent.innerHTML = '<p style="color:var(--text-secondary);">' +
      window.i18n.t('report.selectMonth') + '</p>';
  }
}

function generateReportHTML(data) {
  var summary = {};

  for (var i = 0; i < data.length; i++) {
    var h = data[i];
    if (h.operation_type === 'OUT') {
      var name = productNamesCache[h.product_id] || 'Unknown';
      summary[name] = (summary[name] || 0) + h.quantity;
    }
  }

  var names = Object.keys(summary);
  if (names.length === 0) {
    return '<p style="color:var(--text-secondary);">' +
      window.i18n.t('report.noRemovals') + '</p>';
  }

  var html = '';
  for (var j = 0; j < names.length; j++) {
    html += '<div class="report-item">' +
      '<span class="product-name">' + escapeHtml(names[j]) + '</span>' +
      '<span class="removed-qty">' + window.i18n.t('reportLabel.removed') + ' ' + window.i18n.n(summary[names[j]]) + '</span>' +
      '</div>';
  }
  return html;
}

/* ============================================
   Tab Switching
   ============================================ */

function switchTab(period) {
  currentPeriod = period;
  var tabs = document.querySelectorAll('.tab');
  for (var i = 0; i < tabs.length; i++) {
    tabs[i].classList.remove('active');
  }
  var activeTab = document.querySelector('.tab[data-period="' + period + '"]');
  if (activeTab) activeTab.classList.add('active');
  loadHistory();
}

function applyFilters() {
  renderHistoryTable();
}

/* ============================================
   Load & Init
   ============================================ */

async function loadHistory() {
  showLoading();
  await fetchHistory(currentPeriod);
  renderHistoryTable();
  renderReports();
}

function showLoading() {
  var tbody = document.getElementById('historyTableBody');
  if (tbody) {
    tbody.innerHTML = '<tr><td colspan="5" class="loading">' +
      window.i18n.t('loading.history') + '</td></tr>';
  }
}

function initHistory() {
  return loadHistory();
}

/* ============================================
   Export to CSV
   ============================================ */

function exportHistoryToExcel() {
  var data = getFilteredHistory();
  if (data.length === 0) {
    showToast(window.i18n.t('info.noExportHistory'), 'info');
    return;
  }

  var rows = [[
    window.i18n.t('table.date'),
    window.i18n.t('table.time'),
    window.i18n.t('table.productName'),
    window.i18n.t('table.type'),
    window.i18n.t('table.quantity')
  ]];

  for (var i = 0; i < data.length; i++) {
    var h = data[i];
    rows.push([
      window.i18n.d(h.created_at),
      window.i18n.t12(h.created_at),
      productNamesCache[h.product_id] || 'Unknown',
      window.i18n.fmt(h.operation_type),
      h.quantity
    ]);
  }

  downloadCSV(rows, 'history_export.csv');
}
