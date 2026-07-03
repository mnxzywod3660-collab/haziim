/* ============================================
   Shared Utility Functions
   ============================================ */

function escapeHtml(text) {
  var d = document.createElement('div');
  d.textContent = text;
  return d.innerHTML;
}

function closeModal(id) {
  document.getElementById(id).classList.remove('active');
  document.getElementById(id).classList.remove('show');
}

function showToast(message, type) {
  if (!type) type = 'info';
  var container = document.getElementById('toastContainer');
  if (!container) return;
  var toast = document.createElement('div');
  toast.className = 'toast ' + type;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(function () {
    toast.classList.add('fade-out');
    setTimeout(function () { toast.remove(); }, 300);
  }, 4000);
}

function downloadCSV(rows, filename) {
  var content = rows.map(function (row) {
    return row.map(function (cell) {
      var str = String(cell);
      if (str.indexOf(',') !== -1 || str.indexOf('"') !== -1 || str.indexOf('\n') !== -1) {
        return '"' + str.replace(/"/g, '""') + '"';
      }
      return str;
    }).join(',');
  }).join('\n');
  var BOM = '\uFEFF';
  var blob = new Blob([BOM + content], { type: 'text/csv;charset=utf-8;' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function downloadJSON(data, filename) {
  var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function safeQuery(promise) {
  return promise.then(undefined, function (err) {
    return { error: { message: window.i18n.t('error.networkError') } };
  });
}

/* ============================================
   Dashboard Functions
   ============================================ */

async function loadDashboardCards() {
  try {
    var statsRes = await safeQuery(
      supabase.rpc('get_dashboard_stats')
    );
    if (statsRes.error) throw statsRes.error;
    var s = statsRes.data;

    document.getElementById('totalProducts').textContent = window.i18n.n(s.total_products);
    document.getElementById('totalQuantity').textContent = window.i18n.n(s.total_quantity);
    document.getElementById('addedToday').textContent = window.i18n.n(s.added_today);
    document.getElementById('removedToday').textContent = window.i18n.n(s.removed_today);
    document.getElementById('totalArchived').textContent = window.i18n.n(s.total_archived);
    document.getElementById('monthIn').textContent = window.i18n.n(s.month_in);
    document.getElementById('monthOut').textContent = window.i18n.n(s.month_out);
  } catch (err) {
    showToast(err.message || window.i18n.t('error.networkError'), 'error');
  }
}

async function refreshDashboard() {
  await loadDashboardCards();
  await fetchProducts();
  renderProductsTable();
  renderPagination();
  renderCharts();
}

/* ============================================
   Charts (Chart.js)
   ============================================ */

var stockChartInstance = null;
var weeklyChartInstance = null;
var monthlyChartInstance = null;

function getChartColors() {
  var isDark = document.documentElement.classList.contains('dark');
  return {
    grid: isDark ? '#333' : '#e0e0e0',
    text: isDark ? '#999' : '#888'
  };
}

async function renderCharts() {
  if (typeof Chart === 'undefined') return;
  var colors = getChartColors();
  await Promise.all([
    renderStockChart(colors),
    renderWeeklyChart(colors),
    renderMonthlyChart(colors)
  ]);
}

async function renderStockChart(colors) {
  var canvas = document.getElementById('stockChart');
  if (!canvas) return;
  try {
    var res = await safeQuery(
      supabase.from('products')
        .select('name, quantity')
        .eq('is_archived', false)
        .order('quantity', { ascending: false })
        .limit(15)
    );
    if (res.error) throw res.error;
    var data = res.data || [];
    var labels = data.map(function (p) { return p.name; });
    var values = data.map(function (p) { return p.quantity; });

    if (stockChartInstance) stockChartInstance.destroy();
    if (data.length === 0) return;

    stockChartInstance = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: 'Quantity',
          data: values,
          backgroundColor: '#1a73e8',
          borderRadius: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: { legend: { display: false } },
        scales: {
          y: {
            beginAtZero: true,
            grid: { color: colors.grid },
            ticks: { color: colors.text }
          },
          x: {
            grid: { display: false },
            ticks: { color: colors.text, maxRotation: 45 }
          }
        }
      }
    });
  } catch (err) {
    console.error('Stock chart error:', err);
  }
}

async function renderWeeklyChart(colors) {
  var canvas = document.getElementById('weeklyChart');
  if (!canvas) return;
  try {
    var res = await safeQuery(supabase.from('weekly_out_summary').select('*').limit(15));
    if (res.error) throw res.error;
    var data = res.data || [];
    var labels = data.map(function (r) { return r.product_name; });
    var values = data.map(function (r) { return r.total_out; });

    if (weeklyChartInstance) weeklyChartInstance.destroy();
    if (data.length === 0) return;

    weeklyChartInstance = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: 'OUT',
          data: values,
          backgroundColor: '#d93025',
          borderRadius: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: { legend: { display: false } },
        scales: {
          y: {
            beginAtZero: true,
            grid: { color: colors.grid },
            ticks: { color: colors.text }
          },
          x: {
            grid: { display: false },
            ticks: { color: colors.text, maxRotation: 45 }
          }
        }
      }
    });
  } catch (err) {
    console.error('Weekly chart error:', err);
  }
}

async function renderMonthlyChart(colors) {
  var canvas = document.getElementById('monthlyChart');
  if (!canvas) return;
  try {
    var res = await safeQuery(supabase.from('monthly_out_summary').select('*').limit(15));
    if (res.error) throw res.error;
    var data = res.data || [];
    var labels = data.map(function (r) { return r.product_name; });
    var values = data.map(function (r) { return r.total_out; });

    if (monthlyChartInstance) monthlyChartInstance.destroy();
    if (data.length === 0) return;

    monthlyChartInstance = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: 'OUT',
          data: values,
          backgroundColor: '#f9ab00',
          borderRadius: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: { legend: { display: false } },
        scales: {
          y: {
            beginAtZero: true,
            grid: { color: colors.grid },
            ticks: { color: colors.text }
          },
          x: {
            grid: { display: false },
            ticks: { color: colors.text, maxRotation: 45 }
          }
        }
      }
    });
  } catch (err) {
    console.error('Monthly chart error:', err);
  }
}

/* ============================================
   Product Details Modal
   ============================================ */

async function openProductDetails(id) {
  try {
    var res = await safeQuery(
      supabase.from('product_details_view')
        .select('*')
        .eq('id', id)
        .single()
    );
    if (res.error) throw res.error;
    var p = res.data;
    if (!p) { showToast(window.i18n.t('error.productNotFound'), 'error'); return; }

    document.getElementById('detailProductName').textContent = p.name;
    document.getElementById('detailCurrentQty').textContent = window.i18n.n(p.quantity);
    document.getElementById('detailArrivalDate').textContent = window.i18n.d(p.arrival_date);
    document.getElementById('detailLastUpdate').textContent = window.i18n.dt(p.last_update);
    document.getElementById('detailTotalIn').textContent = window.i18n.n(p.total_in);
    document.getElementById('detailTotalOut').textContent = window.i18n.n(p.total_out);
    document.getElementById('detailRemaining').textContent = window.i18n.n(p.remaining_stock);

    document.getElementById('productDetailsModal').classList.add('active');
  } catch (err) {
    showToast(err.message || window.i18n.t('error.networkError'), 'error');
  }
}

/* ============================================
   Backup - Export / Import
   ============================================ */

async function exportDatabase() {
  try {
    showToast('جاري تصدير البيانات...', 'info');
    var [prodRes, histRes, setRes] = await Promise.all([
      safeQuery(supabase.from('products').select('*').order('id')),
      safeQuery(supabase.from('history').select('*').order('id')),
      safeQuery(supabase.from('settings').select('*').limit(1).maybeSingle())
    ]);
    if (prodRes.error) throw prodRes.error;
    if (histRes.error) throw histRes.error;

    var data = {
      exported_at: new Date().toISOString(),
      products: prodRes.data || [],
      history: histRes.data || [],
      settings: setRes.data || null
    };
    downloadJSON(data, 'warehouse_backup_' + new Date().toISOString().split('T')[0] + '.json');
    showToast(window.i18n.t('success.exportSuccess'), 'success');
  } catch (err) {
    showToast(err.message || window.i18n.t('error.exportError'), 'error');
  }
}

async function importDatabase(input) {
  var file = input.files[0];
  if (!file) return;
  if (!confirm(window.i18n.t('confirm.importDb'))) {
    input.value = '';
    return;
  }

  try {
    var text = await file.text();
    var data = JSON.parse(text);
    if (!data.products || !data.history) {
      throw new Error(window.i18n.t('error.importError'));
    }

    var queries = [];

    if (data.products.length > 0) {
      var { error: delProd } = await supabase.from('products').delete().neq('id', 0);
      if (delProd) throw delProd;
      var { error: insProd } = await supabase.from('products').insert(data.products);
      if (insProd) throw insProd;
    }

    if (data.history.length > 0) {
      var { error: insHist } = await supabase.from('history').insert(data.history);
      if (insHist) throw insHist;
    }

    if (data.settings && data.settings.warehouse_name) {
      var { data: existing } = await supabase.from('settings').select('id').limit(1).maybeSingle();
      if (existing) {
        await supabase.from('settings').update({ warehouse_name: data.settings.warehouse_name }).eq('id', existing.id);
      } else {
        await supabase.from('settings').insert({ warehouse_name: data.settings.warehouse_name });
      }
    }

    showToast(window.i18n.t('success.importSuccess'), 'success');
    input.value = '';
    var path = window.location.pathname;
    if (path.indexOf('settings.html') !== -1) {
      if (typeof initSettings === 'function') await initSettings();
    } else {
      await refreshDashboard();
    }
  } catch (err) {
    showToast(err.message || window.i18n.t('error.importError'), 'error');
    input.value = '';
  }
}

/* ============================================
   Theme Initialization
   ============================================ */

(function initTheme() {
  var saved = localStorage.getItem('theme');
  if (saved === 'dark') {
    document.documentElement.classList.add('dark');
  }
})();

/* ============================================
   Page Initialization
   ============================================ */

document.addEventListener('DOMContentLoaded', async function () {
  try { await window.i18nReady; } catch (e) {}
  var path = window.location.pathname;
  if (path.indexOf('history.html') !== -1) {
    if (typeof initHistory === 'function') await initHistory();
  } else if (path.indexOf('settings.html') !== -1) {
    if (typeof initSettings === 'function') await initSettings();
  } else {
    await refreshDashboard();
  }
});

document.addEventListener('languageChanged', function () {
  var path = window.location.pathname;
  if (path.indexOf('history.html') !== -1) {
    if (typeof renderHistoryTable === 'function') renderHistoryTable();
    if (typeof renderReports === 'function') renderReports();
  } else if (path.indexOf('settings.html') !== -1) {
    if (typeof renderArchivedProducts === 'function') renderArchivedProducts();
  } else {
    if (typeof refreshDashboard === 'function') refreshDashboard();
    if (typeof renderCharts === 'function') setTimeout(renderCharts, 200);
  }
});

document.addEventListener('themeChanged', function () {
  if (typeof renderCharts === 'function') setTimeout(renderCharts, 200);
});
