/* ============================================
   Products Module
   ============================================ */

var products = [];
var searchTerm = '';
var sortField = 'name';

var currentPage = 1;
var pageSize = 50;
var totalProductsCount = 0;
var totalPages = 1;

function getToday() {
  var d = new Date();
  return d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0');
}

function getLowStockThreshold() {
  return parseInt(localStorage.getItem('lowStockThreshold')) || 10;
}

/* ============================================
   Count Active Products
   ============================================ */

async function countActiveProducts(search) {
  try {
    var query = supabase.from('products')
      .select('id', { count: 'exact', head: true })
      .eq('is_archived', false);
    if (search) {
      query = query.ilike('name', '%' + search.replace(/'/g, "''") + '%');
    }
    var res = await query;
    if (res.error) throw res.error;
    return res.count || 0;
  } catch (err) {
    showToast(err.message, 'error');
    return 0;
  }
}

/* ============================================
   Fetch Products with Pagination
   ============================================ */

async function fetchProducts() {
  try {
    totalProductsCount = await countActiveProducts(searchTerm);
    totalPages = Math.max(1, Math.ceil(totalProductsCount / pageSize));

    if (currentPage > totalPages) currentPage = totalPages;

    var usePagination = totalProductsCount > 100;
    var query = supabase
      .from('products')
      .select('*')
      .eq('is_archived', false);

    if (searchTerm) {
      query = query.ilike('name', '%' + searchTerm.replace(/'/g, "''") + '%');
    }

    var orderDir = sortField === 'updated_at' ? { ascending: false } : { ascending: true };
    query = query.order(sortField, orderDir);

    if (usePagination) {
      var start = (currentPage - 1) * pageSize;
      var end = start + pageSize - 1;
      query = query.range(start, end);
    }

    var res = await query;
    if (res.error) throw res.error;
    products = res.data || [];

    var pagEl = document.getElementById('paginationControls');
    if (pagEl) {
      pagEl.style.display = usePagination ? 'flex' : 'none';
    }

    return products;
  } catch (err) {
    showToast(err.message, 'error');
    return [];
  }
}

/* ============================================
   Change Page
   ============================================ */

function changePage(page) {
  if (page < 1 || page > totalPages) return;
  currentPage = page;
  fetchProducts().then(function () {
    renderProductsTable();
    renderPagination();
  });
}

function renderPagination() {
  var container = document.getElementById('pageNumbers');
  var infoEl = document.getElementById('pageInfo');
  var prevBtn = document.getElementById('prevPage');
  var nextBtn = document.getElementById('nextPage');
  if (!container) return;

  if (totalProductsCount <= 100) {
    if (infoEl) infoEl.textContent = '';
    return;
  }

  if (prevBtn) prevBtn.disabled = currentPage <= 1;
  if (nextBtn) nextBtn.disabled = currentPage >= totalPages;

  var html = '';
  var maxVisible = 5;
  var startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2));
  var endPage = Math.min(totalPages, startPage + maxVisible - 1);
  if (endPage - startPage + 1 < maxVisible) {
    startPage = Math.max(1, endPage - maxVisible + 1);
  }

  for (var i = startPage; i <= endPage; i++) {
    html += '<button class="page-btn' + (i === currentPage ? ' active' : '') +
      '" onclick="changePage(' + i + ')">' + i + '</button>';
  }
  container.innerHTML = html;

  if (infoEl) {
    var start = (currentPage - 1) * pageSize + 1;
    var end = Math.min(currentPage * pageSize, totalProductsCount);
    infoEl.textContent = window.i18n.t('pagination.showing') + ' ' + start + ' ' +
      window.i18n.t('pagination.to') + ' ' + end + ' ' +
      window.i18n.t('pagination.of') + ' ' + totalProductsCount + ' ' +
      window.i18n.t('pagination.entries');
  }
}

/* ============================================
   Search (Client + Server hybrid)
   ============================================ */

var searchTimeout = null;

function handleSearch() {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(function () {
    searchTerm = document.getElementById('searchBox').value;
    currentPage = 1;
    fetchProducts().then(function () {
      renderProductsTable();
      renderPagination();
    });
  }, 300);
}

function handleSort() {
  sortField = document.getElementById('sortSelect').value;
  currentPage = 1;
  fetchProducts().then(function () {
    renderProductsTable();
    renderPagination();
  });
}

/* ============================================
   Render Table
   ============================================ */

function renderProductsTable() {
  var tbody = document.getElementById('productsTableBody');
  if (!tbody) return;
  var threshold = getLowStockThreshold();

  if (products.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--text-secondary);padding:40px;">' +
      window.i18n.t('empty.noProducts') + '</td></tr>';
    return;
  }

  var html = '';
  for (var i = 0; i < products.length; i++) {
    var p = products[i];
    var isLow = p.quantity < threshold;
    html += '<tr class="' + (isLow ? 'low-stock' : '') + '">' +
      '<td><strong style="cursor:pointer;color:var(--blue);" onclick="openProductDetails(' + p.id + ')" title="' + window.i18n.t('product.details') + '">' + escapeHtml(p.name) + '</strong></td>' +
      '<td>' + window.i18n.n(p.quantity) + '</td>' +
      '<td>' + window.i18n.d(p.created_at) + '</td>' +
      '<td>' + window.i18n.dt(p.updated_at) + '</td>' +
      '<td><div class="actions">' +
      '<button class="btn btn-success btn-sm btn-icon" onclick="openAddStockModal(' + p.id + ')" title="' + window.i18n.t('product.addStock') + '">+</button>' +
      '<button class="btn btn-danger btn-sm btn-icon" onclick="openRemoveStockModal(' + p.id + ')" title="' + window.i18n.t('product.removeStock') + '">-</button>' +
      '<button class="btn btn-secondary btn-sm" onclick="openEditProductModal(' + p.id + ')">' + window.i18n.t('product.edit') + '</button>' +
      '<button class="btn btn-warning btn-sm" onclick="openArchiveModal(' + p.id + ')">' + window.i18n.t('product.archive') + '</button>' +
      '</div></td></tr>';
  }
  tbody.innerHTML = html;
}

/* ============================================
   Check Duplicate
   ============================================ */

async function checkDuplicateProduct(name, excludeId) {
  try {
    var res = await supabase.rpc('check_duplicate_product', {
      p_name: name,
      p_exclude_id: excludeId || null
    });
    if (res.error) throw res.error;
    return res.data === true;
  } catch (err) {
    return false;
  }
}

/* ============================================
   Add Product (with duplicate check)
   ============================================ */

function openAddProductModal() {
  document.getElementById('productName').value = '';
  document.getElementById('productQuantity').value = '';
  document.getElementById('productDate').value = getToday();
  var errEl = document.getElementById('addProductError');
  errEl.classList.remove('show');
  errEl.textContent = '';
  document.getElementById('addProductModal').classList.add('active');
}

async function saveProduct() {
  var name = document.getElementById('productName').value.trim();
  var quantity = parseInt(document.getElementById('productQuantity').value) || 0;
  var date = document.getElementById('productDate').value;
  var errEl = document.getElementById('addProductError');

  if (!name) {
    errEl.textContent = window.i18n.t('error.requiredName');
    errEl.classList.add('show');
    return;
  }
  if (quantity < 0) {
    errEl.textContent = window.i18n.t('error.negativeQuantity');
    errEl.classList.add('show');
    return;
  }

  var isDuplicate = await checkDuplicateProduct(name);
  if (isDuplicate) {
    errEl.textContent = window.i18n.t('error.duplicateProduct');
    errEl.classList.add('show');
    return;
  }

  try {
    var res = await supabase.rpc('add_product', {
      p_name: name,
      p_quantity: quantity,
      p_arrival_date: date || new Date().toISOString()
    });
    if (res.error) throw res.error;
    var result = res.data;
    if (!result.success) {
      if (result.error === 'DUPLICATE_PRODUCT') {
        errEl.textContent = window.i18n.t('error.duplicateProduct');
        errEl.classList.add('show');
        return;
      }
      throw new Error(result.error || window.i18n.t('error.networkError'));
    }

    closeModal('addProductModal');
    showToast(window.i18n.t('success.productAdded'), 'success');
    await refreshDashboard();
  } catch (err) {
    errEl.textContent = err.message;
    errEl.classList.add('show');
  }
}

/* ============================================
   Edit Product
   ============================================ */

function openEditProductModal(id) {
  var p = null;
  for (var i = 0; i < products.length; i++) {
    if (products[i].id === id) { p = products[i]; break; }
  }
  if (!p) return;
  document.getElementById('editProductId').value = p.id;
  document.getElementById('editProductName').value = p.name;
  document.getElementById('editProductDate').value = (p.created_at || '').split('T')[0];
  var errEl = document.getElementById('editProductError');
  errEl.classList.remove('show');
  errEl.textContent = '';
  document.getElementById('editProductModal').classList.add('active');
}

async function updateProduct() {
  var id = document.getElementById('editProductId').value;
  var name = document.getElementById('editProductName').value.trim();
  var date = document.getElementById('editProductDate').value;
  var errEl = document.getElementById('editProductError');

  if (!name) {
    errEl.textContent = window.i18n.t('error.requiredName');
    errEl.classList.add('show');
    return;
  }

  var isDuplicate = await checkDuplicateProduct(name, parseInt(id));
  if (isDuplicate) {
    errEl.textContent = window.i18n.t('error.duplicateProduct');
    errEl.classList.add('show');
    return;
  }

  try {
    var res = await supabase
      .from('products')
      .update({ name: name, created_at: date || undefined })
      .eq('id', id);
    if (res.error) throw res.error;

    closeModal('editProductModal');
    showToast(window.i18n.t('success.productUpdated'), 'success');
    await refreshDashboard();
  } catch (err) {
    errEl.textContent = err.message;
    errEl.classList.add('show');
  }
}

/* ============================================
   Add Stock - Atomic via RPC
   ============================================ */

function openAddStockModal(id) {
  var p = null;
  for (var i = 0; i < products.length; i++) {
    if (products[i].id === id) { p = products[i]; break; }
  }
  if (!p) return;
  document.getElementById('addStockProductId').value = p.id;
  document.getElementById('addStockProductName').textContent = p.name;
  document.getElementById('addStockQuantity').value = '';
  var errEl = document.getElementById('addStockError');
  errEl.classList.remove('show');
  errEl.textContent = '';
  document.getElementById('addStockModal').classList.add('active');
}

async function confirmAddStock() {
  var id = parseInt(document.getElementById('addStockProductId').value);
  var quantity = parseInt(document.getElementById('addStockQuantity').value);
  var errEl = document.getElementById('addStockError');

  if (!quantity || quantity <= 0) {
    errEl.textContent = window.i18n.t('error.validQuantity');
    errEl.classList.add('show');
    return;
  }

  try {
    var res = await supabase.rpc('increase_stock', {
      p_product_id: id,
      p_quantity: quantity
    });
    if (res.error) throw res.error;
    var result = res.data;
    if (!result.success) {
      if (result.error === 'PRODUCT_NOT_FOUND') {
        errEl.textContent = window.i18n.t('error.productNotFound');
      } else {
        errEl.textContent = result.error || window.i18n.t('error.networkError');
      }
      errEl.classList.add('show');
      return;
    }

    closeModal('addStockModal');
    showToast(window.i18n.t('success.stockAdded', {
      qty: quantity,
      items: window.i18n.t('stock.items')
    }), 'success');
    await refreshDashboard();
  } catch (err) {
    errEl.textContent = err.message;
    errEl.classList.add('show');
  }
}

/* ============================================
   Remove Stock - Atomic via RPC
   ============================================ */

function openRemoveStockModal(id) {
  var p = null;
  for (var i = 0; i < products.length; i++) {
    if (products[i].id === id) { p = products[i]; break; }
  }
  if (!p) return;
  document.getElementById('removeStockProductId').value = p.id;
  document.getElementById('removeStockCurrentQty').value = p.quantity;
  document.getElementById('removeStockProductName').textContent = p.name;
  document.getElementById('removeStockCurrentQtyDisplay').textContent =
    window.i18n.t('stock.currentStock') + ' ' + window.i18n.n(p.quantity);
  document.getElementById('removeStockQuantity').value = '';
  var errEl = document.getElementById('removeStockError');
  errEl.classList.remove('show');
  errEl.textContent = '';
  document.getElementById('removeStockModal').classList.add('active');
}

async function confirmRemoveStock() {
  var id = parseInt(document.getElementById('removeStockProductId').value);
  var currentQty = parseInt(document.getElementById('removeStockCurrentQty').value);
  var quantity = parseInt(document.getElementById('removeStockQuantity').value);
  var errEl = document.getElementById('removeStockError');

  if (!quantity || quantity <= 0) {
    errEl.textContent = window.i18n.t('error.validQuantity');
    errEl.classList.add('show');
    return;
  }
  if (quantity > currentQty) {
    errEl.textContent = window.i18n.t('error.insufficientStock', {
      qty: window.i18n.n(currentQty),
      items: window.i18n.t('stock.items')
    });
    errEl.classList.add('show');
    return;
  }

  try {
    var res = await supabase.rpc('decrease_stock', {
      p_product_id: id,
      p_quantity: quantity
    });
    if (res.error) throw res.error;
    var result = res.data;
    if (!result.success) {
      if (result.error === 'INSUFFICIENT_STOCK') {
        errEl.textContent = window.i18n.t('error.insufficientStock', {
          qty: window.i18n.n(currentQty),
          items: window.i18n.t('stock.items')
        });
      } else if (result.error === 'PRODUCT_NOT_FOUND') {
        errEl.textContent = window.i18n.t('error.productNotFound');
      } else {
        errEl.textContent = result.error || window.i18n.t('error.networkError');
      }
      errEl.classList.add('show');
      return;
    }

    closeModal('removeStockModal');
    showToast(window.i18n.t('success.stockRemoved', {
      qty: quantity,
      items: window.i18n.t('stock.items')
    }), 'success');
    await refreshDashboard();
  } catch (err) {
    errEl.textContent = err.message;
    errEl.classList.add('show');
  }
}

/* ============================================
   Archive Product (Soft Delete)
   ============================================ */

function openArchiveModal(id) {
  var p = null;
  for (var i = 0; i < products.length; i++) {
    if (products[i].id === id) { p = products[i]; break; }
  }
  if (!p) return;
  document.getElementById('archiveProductId').value = p.id;
  document.getElementById('archiveProductName').textContent =
    window.i18n.t('confirm.archiveProduct') + ' "' + p.name + '"?';
  document.getElementById('archiveModal').classList.add('active');
}

async function confirmArchiveProduct() {
  var id = parseInt(document.getElementById('archiveProductId').value);
  try {
    var res = await supabase
      .from('products')
      .update({
        is_archived: true,
        archived_at: new Date().toISOString()
      })
      .eq('id', id);
    if (res.error) throw res.error;

    closeModal('archiveModal');
    showToast(window.i18n.t('success.productArchived'), 'success');
    await refreshDashboard();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

/* ============================================
   Export to CSV
   ============================================ */

function exportProductsToExcel() {
  if (totalProductsCount === 0) {
    showToast(window.i18n.t('info.noExportProducts'), 'info');
    return;
  }

  fetchAllForExport().then(function (allProducts) {
    if (allProducts.length === 0) {
      showToast(window.i18n.t('info.noExportProducts'), 'info');
      return;
    }

    var rows = [[
      window.i18n.t('table.productName'),
      window.i18n.t('table.currentQuantity'),
      window.i18n.t('table.arrivalDate'),
      window.i18n.t('table.lastUpdated')
    ]];

    for (var i = 0; i < allProducts.length; i++) {
      var p = allProducts[i];
      rows.push([p.name, p.quantity, window.i18n.d(p.created_at), window.i18n.dt(p.updated_at)]);
    }
    downloadCSV(rows, 'products_export.csv');
  });
}

async function fetchAllForExport() {
  try {
    var res = await supabase
      .from('products')
      .select('name, quantity, created_at, updated_at')
      .eq('is_archived', false)
      .order('name');
    if (res.error) throw res.error;
    return res.data || [];
  } catch (err) {
    showToast(err.message, 'error');
    return [];
  }
}
