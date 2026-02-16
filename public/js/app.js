(function () {
  'use strict';

  // Firebase Configuration
  const firebaseConfig = {
    apiKey: "AIzaSyCzHn7WH1kbvEJP-w4OjdFH_oeXOS7Hfmc",
    authDomain: "dashboard-ed869.firebaseapp.com",
    projectId: "dashboard-ed869",
    storageBucket: "dashboard-ed869.firebasestorage.app",
    messagingSenderId: "77636318964",
    appId: "1:77636318964:web:3092c08cb03d32144650a1",
    measurementId: "G-V3S1VTKCZT"
  };

  if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
  }
  var auth = firebase.auth();
  var db = firebase.firestore();

  var loginScreen = document.getElementById('login-screen');
  var mainApp = document.getElementById('main-app');
  var loginForm = document.getElementById('login-form');
  var loginError = document.getElementById('login-error');
  var btnLogout = document.getElementById('btn-logout');
  var welcomeEmail = document.getElementById('welcome-email');
  var userRoleBadge = document.getElementById('user-role-badge');
  var pageTitle = document.getElementById('page-title');
  var navAdmin = document.querySelector('.nav-item[data-route="users"]');
  var navDataEntry = document.querySelector('.nav-item[data-route="data-entry"]');

  var currentUser = null;
  var userRole = null;
  var routingInited = false;

  function escapeHtml(str) {
    if (str == null) return '';
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // Toast notification system
  function showToast(message, type) {
    type = type || 'info';
    var container = document.getElementById('toast-container');
    if (!container) return;
    var toast = document.createElement('div');
    toast.className = 'toast ' + type;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(function() {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100%)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(function() { toast.remove(); }, 300);
    }, 4000);
  }

  // ---------- Auth ----------
  auth.onAuthStateChanged(function (user) {
    if (user) {
      currentUser = user;
      if (loginScreen) loginScreen.classList.add('hidden');
      if (mainApp) mainApp.classList.remove('hidden');
      if (welcomeEmail) welcomeEmail.textContent = user.email;
      loadUserRole(user.uid);
      initRouting();
      loadDashboard();
    } else {
      currentUser = null;
      userRole = null;
      if (mainApp) mainApp.classList.add('hidden');
      if (loginScreen) loginScreen.classList.remove('hidden');
      if (loginError) loginError.textContent = '';
    }
  });

  function loadUserRole(uid) {
    db.collection('users').doc(uid).get().then(function (doc) {
      var raw = doc.exists && doc.data() && doc.data().role ? doc.data().role : '';
      userRole = (raw && String(raw).toLowerCase()) || 'owner';

      var displayRole = userRole.charAt(0).toUpperCase() + userRole.slice(1);
      if (userRoleBadge) userRoleBadge.textContent = 'role: ' + displayRole;
      if (navAdmin) {
        if (userRole === 'admin') {
          navAdmin.classList.remove('role-hidden');
        } else {
          navAdmin.classList.add('role-hidden');
        }
      }
      if (navDataEntry) {
        if (userRole === 'owner') {
          navDataEntry.classList.add('role-hidden');
          if (window.location.hash.slice(1) === 'data-entry') {
            window.location.hash = 'dashboard';
          }
        } else {
          navDataEntry.classList.remove('role-hidden');
        }
      }
      var dashboardToolbar = document.getElementById('dashboard-toolbar');
      if (dashboardToolbar) {
        if (userRole === 'owner') dashboardToolbar.classList.add('role-hidden');
        else dashboardToolbar.classList.remove('role-hidden');
      }
    }).catch(function (err) {
      userRole = 'owner';
      if (userRoleBadge) userRoleBadge.textContent = 'role: owner';
      console.warn('Could not load user role:', err && err.message);
      showToast('Warning: Could not verify user role. Defaulting to owner.', 'error');
    });
  }

  // Firestore error handler
  function handleFirestoreError(err, context) {
    context = context || 'Operation failed';
    var msg = err && err.message ? err.message : 'Unknown error';
    console.error(context + ':', err);
    if (msg.indexOf('index') !== -1 && msg.indexOf('composite') !== -1) {
      showToast(context + ': Firestore index required. Please create the index in Firebase Console.', 'error');
    } else if (msg.indexOf('permission') !== -1) {
      showToast(context + ': Permission denied. Check your Firestore rules.', 'error');
    } else if (msg.indexOf('offline') !== -1 || msg.indexOf('network') !== -1) {
      showToast(context + ': Network error. Please check your connection.', 'error');
    } else {
      showToast(context + ': ' + msg, 'error');
    }
  }

  if (loginForm) loginForm.addEventListener('submit', function (e) {
    e.preventDefault();
    if (loginError) loginError.textContent = '';
    var email = document.getElementById('email').value.trim();
    var password = document.getElementById('password').value;
    var submitBtn = loginForm.querySelector('button[type="submit"]');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Signing in…';
    }
    auth.signInWithEmailAndPassword(email, password).then(function () {
      loginForm.reset();
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Sign in'; }
    }).catch(function (err) {
      if (loginError) loginError.textContent = err.message || 'Sign-in failed.';
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Sign in'; }
      showToast(err.message || 'Sign-in failed.', 'error');
    });
  });

  if (btnLogout) {
    btnLogout.addEventListener('click', function () {
      auth.signOut();
    });
  }

  // ---------- Routing ----------
  function getRoute() {
    var hash = window.location.hash.slice(1) || 'dashboard';
    if (hash === 'users' && userRole !== 'admin') hash = 'dashboard';
    if (hash === 'data-entry' && userRole === 'owner') hash = 'dashboard';
    return hash;
  }

  function showView(route) {
    if (route === 'users' && userRole !== 'admin') {
      window.location.hash = 'dashboard';
      route = 'dashboard';
    }
    if (route === 'data-entry' && userRole === 'owner') {
      window.location.hash = 'dashboard';
      route = 'dashboard';
    }

    var views = document.querySelectorAll('.view');
    views.forEach(function (v) { v.classList.remove('active'); });
    var navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(function (n) { n.classList.remove('active'); });

    var viewId = 'view-' + route;
    var view = document.getElementById(viewId);
    if (view) view.classList.add('active');

    var nav = document.querySelector('.nav-item[data-route="' + route + '"]');
    if (nav) nav.classList.add('active');

    var titles = { dashboard: 'Dashboard', reports: 'Reports', 'data-entry': 'Data Entry', notifications: 'Notifications', users: 'User Management' };
    if (pageTitle) pageTitle.textContent = titles[route] || 'Dashboard';

    if (route === 'dashboard') loadDashboard();
    if (route === 'reports') loadReports();
    if (route === 'notifications') loadNotifications();
    if (route === 'users' && userRole === 'admin') loadUsers();
  }

  function initRouting() {
    if (routingInited) {
      showView(getRoute());
      return;
    }
    routingInited = true;
    window.addEventListener('hashchange', function () { showView(getRoute()); });
    showView(getRoute());
  }

  // ---------- Dashboard ----------
  var chartSalesTrend = null;
  var chartCategory = null;
  var chartDaily = null;

  var sampleProducts = [
    { name: 'Chicken Bucket', category: 'Main', price: 299 },
    { name: 'Fried Chicken 2pc', category: 'Main', price: 159 },
    { name: 'Rice', category: 'Sides', price: 35 },
    { name: 'Gravy', category: 'Sides', price: 25 },
    { name: 'Cola', category: 'Drinks', price: 45 },
    { name: 'Iced Tea', category: 'Drinks', price: 40 }
  ];

  function getSampleTransactions() {
    var tx = [];
    var now = new Date();
    var uid = currentUser ? currentUser.uid : '';
    for (var d = 21; d >= 0; d--) {
      var date = new Date(now);
      date.setDate(date.getDate() - d);
      date.setHours(12, 0, 0, 0);
      var count = 2 + (d % 3);
      for (var i = 0; i < count; i++) {
        var gross = 400 + Math.round(Math.random() * 3500);
        var net = Math.round(gross * (0.82 + Math.random() * 0.1));
        tx.push({
          date: firebase.firestore.Timestamp.fromDate(date),
          gross: gross,
          net: net,
          notes: null,
          createdBy: uid,
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
      }
    }
    return tx;
  }

  function getSampleExpenses() {
    var now = new Date();
    var uid = currentUser ? currentUser.uid : '';
    var items = [
      { daysAgo: 2, amount: 3500, desc: 'Chicken supply' },
      { daysAgo: 5, amount: 1200, desc: 'Cooking oil' },
      { daysAgo: 7, amount: 800, desc: 'Cleaning supplies' },
      { daysAgo: 10, amount: 4500, desc: 'Weekly groceries' },
      { daysAgo: 14, amount: 2200, desc: 'Beverages' }
    ];
    return items.map(function (item) {
      var date = new Date(now);
      date.setDate(date.getDate() - item.daysAgo);
      date.setHours(12, 0, 0, 0);
      return {
        date: firebase.firestore.Timestamp.fromDate(date),
        amount: item.amount,
        description: item.desc,
        createdBy: uid,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      };
    });
  }

  function loadSampleData() {
    if (!currentUser) {
      showToast('Please sign in to load sample data.', 'error');
      return;
    }
    if (userRole === 'owner') {
      showToast('Only Manager or Admin can add data.', 'error');
      return;
    }
    var btn = document.getElementById('btn-load-sample-data');
    if (btn) { btn.disabled = true; btn.textContent = 'Loading…'; }
    var batch = db.batch();
    sampleProducts.forEach(function (p) {
      var ref = db.collection('products').doc();
      batch.set(ref, { name: p.name, category: p.category, price: p.price, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
    });
    getSampleTransactions().forEach(function (t) {
      var ref = db.collection('transactions').doc();
      batch.set(ref, t);
    });
    getSampleExpenses().forEach(function (e) {
      var ref = db.collection('expenses').doc();
      batch.set(ref, e);
    });
    batch.commit().then(function () {
      if (btn) { btn.disabled = false; btn.textContent = 'Load sample data'; }
      loadDashboard();
      loadReports();
      showToast('Sample data loaded successfully.', 'success');
    }).catch(function (err) {
      if (btn) { btn.disabled = false; btn.textContent = 'Load sample data'; }
      showToast('Error: ' + (err.message || 'Could not load sample data.'), 'error');
    });
  }

  var btnLoadSample = document.getElementById('btn-load-sample-data');
  if (btnLoadSample) btnLoadSample.addEventListener('click', loadSampleData);

  // Reset data function for admin
  function resetAllData() {
    if (!currentUser) {
      showToast('Please sign in to reset data.', 'error');
      return;
    }
    if (userRole !== 'admin') {
      showToast('Only Admin can reset data.', 'error');
      return;
    }
    
    if (!confirm('⚠️ WARNING: This will permanently delete ALL data including:\n\n• Sales transactions\n• Products\n• Expenses\n• Uploaded CSV data\n• Analytics results\n• AI recommendations\n\nThis action cannot be undone. Continue?')) {
      return;
    }

    var btn = document.getElementById('btn-reset-data');
    if (btn) { btn.disabled = true; btn.textContent = 'Resetting…'; }

    // Collections to clear
    var collections = [
      'transactions', 'products', 'expenses', 
      'sales_data', 'market_historical_data', 
      'recommendations', 'processed_stats', 'prediction_history'
    ];

    var promises = collections.map(function(collectionName) {
      return db.collection(collectionName).get().then(function(snapshot) {
        var batch = db.batch();
        snapshot.forEach(function(doc) {
          batch.delete(doc.ref);
        });
        return batch.commit();
      });
    });

    Promise.all(promises).then(function() {
      if (btn) { btn.disabled = false; btn.textContent = 'Reset all data'; }
      loadDashboard();
      loadReports();
      loadUsers();
      showToast('All data has been reset successfully.', 'success');
    }).catch(function(err) {
      if (btn) { btn.disabled = false; btn.textContent = 'Reset all data'; }
      showToast('Error resetting data: ' + (err.message || 'Unknown error'), 'error');
    });
  }

  var btnResetData = document.getElementById('btn-reset-data');
  if (btnResetData) btnResetData.addEventListener('click', resetAllData);

  function loadDashboard() {
    var now = new Date();
    var startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    var startOfMonthTs = firebase.firestore.Timestamp.fromDate(startOfMonth);

    db.collection('transactions')
      .where('date', '>=', startOfMonthTs)
      .orderBy('date', 'desc')
      .get()
      .then(function (snap) {
        var docs = snap.docs.map(function (d) { 
          var data = d.data();
          return { id: d.id, date: data.date, gross: data.gross, net: data.net, notes: data.notes, createdBy: data.createdBy, createdAt: data.createdAt };
        });
        var gross = 0, net = 0;
        docs.forEach(function (t) {
          gross += Number(t.gross || 0);
          net += Number(t.net || 0);
        });

        // Load expenses for this month
        return db.collection('expenses')
          .where('date', '>=', startOfMonthTs)
          .get()
          .then(function (expSnap) {
            var totalExpenses = 0;
            expSnap.docs.forEach(function (d) {
              totalExpenses += Number(d.data().amount || 0);
            });

            var kpiGross = document.getElementById('kpi-gross-sales');
            var kpiNet = document.getElementById('kpi-net-sales');
            var kpiTx = document.getElementById('kpi-transactions');
            var kpiAov = document.getElementById('kpi-aov');
            var kpiExpenses = document.getElementById('kpi-expenses');
            if (kpiGross) kpiGross.textContent = '₱' + formatNum(gross);
            if (kpiNet) kpiNet.textContent = '₱' + formatNum(net);
            if (kpiTx) kpiTx.textContent = docs.length;
            if (kpiAov) kpiAov.textContent = docs.length ? '₱' + formatNum(net / docs.length) : '₱0';
            if (kpiExpenses) kpiExpenses.textContent = '₱' + formatNum(totalExpenses);
            buildCharts(docs);
            loadPredictiveCharts(); // Load Phase 4 predictive charts
          });
      })
      .catch(function (err) {
        handleFirestoreError(err, 'Failed to load dashboard data');
        var kpiGross = document.getElementById('kpi-gross-sales');
        var kpiNet = document.getElementById('kpi-net-sales');
        var kpiTx = document.getElementById('kpi-transactions');
        var kpiAov = document.getElementById('kpi-aov');
        var kpiExpenses = document.getElementById('kpi-expenses');
        if (kpiGross) kpiGross.textContent = '₱0';
        if (kpiNet) kpiNet.textContent = '₱0';
        if (kpiTx) kpiTx.textContent = '0';
        if (kpiAov) kpiAov.textContent = '₱0';
        if (kpiExpenses) kpiExpenses.textContent = '₱0';
        buildCharts([]);
        loadPredictiveCharts(); // Still attempt to load predictive charts
      });
  }

  function buildCharts(transactions) {
    var last14 = transactions.slice(0, 14).reverse();
    var byDay = {};
    last14.forEach(function (t) {
      var d = t.date && t.date.toDate ? t.date.toDate().toISOString().slice(0, 10) : '';
      if (!byDay[d]) byDay[d] = 0;
      byDay[d] += Number(t.net || 0);
    });
    var labels = Object.keys(byDay).sort();
    var values = labels.map(function (k) { return byDay[k]; });

    var ctxDaily = document.getElementById('chart-daily');
    if (ctxDaily) {
      if (chartDaily) chartDaily.destroy();
      chartDaily = new Chart(ctxDaily, {
        type: 'bar',
        data: {
          labels: labels,
          datasets: [{ label: 'Revenue (₱)', data: values, backgroundColor: 'rgba(245, 158, 11, 0.7)', borderColor: '#f59e0b', borderWidth: 1 }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.06)' }, ticks: { color: '#8b9cb3' } },
            x: { grid: { display: false }, ticks: { color: '#8b9cb3' } }
          },
          plugins: { legend: { display: false } }
        }
      });
    }

    var ctxTrend = document.getElementById('chart-sales-trend');
    if (ctxTrend) {
      if (chartSalesTrend) chartSalesTrend.destroy();
      var trendLabels = last14.map(function (t) {
        return t.date && t.date.toDate ? t.date.toDate().toLocaleDateString() : '';
      });
      var trendNet = last14.map(function (t) { return Number(t.net || 0); });
      chartSalesTrend = new Chart(ctxTrend, {
        type: 'line',
        data: {
          labels: trendLabels,
          datasets: [{ label: 'Net sales (₱)', data: trendNet, borderColor: '#f59e0b', backgroundColor: 'rgba(245, 158, 11, 0.1)', fill: true, tension: 0.3 }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.06)' }, ticks: { color: '#8b9cb3' } },
            x: { grid: { display: false }, ticks: { color: '#8b9cb3' } }
          },
          plugins: { legend: { labels: { color: '#8b9cb3' } } }
        }
      });
    }

    db.collection('products').get().then(function (prodSnap) {
      // Build a map of product categories
      var productCategories = {};
      prodSnap.docs.forEach(function (d) {
        var p = d.data();
        productCategories[d.id] = p.category || 'Other';
      });

      // Calculate sales by category from transactions
      // Since transactions don't have direct product links, we'll estimate based on product prices
      var categories = {};
      
      // For this restaurant dashboard, we'll show product count by category as a proxy
      // In a real implementation, you'd join transaction items with products
      prodSnap.docs.forEach(function (d) {
        var p = d.data();
        var cat = p.category || 'Other';
        categories[cat] = (categories[cat] || 0) + (p.price || 0);
      });

      var ctxCat = document.getElementById('chart-category');
      if (ctxCat) {
        if (chartCategory) chartCategory.destroy();
        var labels = Object.keys(categories);
        var values = Object.values(categories);
        if (labels.length === 0) {
          labels = ['No data'];
          values = [1];
        }
        chartCategory = new Chart(ctxCat, {
          type: 'doughnut',
          data: {
            labels: labels,
            datasets: [{ 
              data: values, 
              backgroundColor: ['#f59e0b', '#b45309', '#1a2332', '#243044', '#2d3a4f', '#3d4a5f', '#4d5a6f'] 
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { 
              legend: { position: 'bottom', labels: { color: '#8b9cb3' } },
              tooltip: {
                callbacks: {
                  label: function(context) {
                    var label = context.label || '';
                    var value = context.raw || 0;
                    return label + ': ₱' + formatNum(value);
                  }
                }
              }
            }
          }
        });
      }
    }).catch(function (err) {
      handleFirestoreError(err, 'Failed to load category chart');
      if (chartCategory) chartCategory.destroy();
      chartCategory = null;
    });
  }

  function formatNum(n) {
    var num = Number(n);
    if (typeof num !== 'number' || isNaN(num)) return '0';
    return num.toLocaleString('en-PH', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  }

  // ---------- Reports ----------
  function loadReports() {
    var periodEl = document.getElementById('reports-period');
    var days = periodEl ? parseInt(periodEl.value, 10) : 30;
    if (!days || days < 1) days = 30;
    var end = new Date();
    var start = new Date(end);
    start.setDate(start.getDate() - days);
    var startTs = firebase.firestore.Timestamp.fromDate(start);
    var endTs = firebase.firestore.Timestamp.fromDate(end);

    var summaryEl = document.getElementById('report-sales-summary');
    var expenseEl = document.getElementById('report-expense-summary');
    var productsEl = document.getElementById('report-top-products');
    if (summaryEl) summaryEl.innerHTML = '<p class="text-muted">Loading...</p>';
    if (expenseEl) expenseEl.innerHTML = '<p class="text-muted">Loading...</p>';
    if (productsEl) productsEl.innerHTML = '<p class="text-muted">Loading...</p>';

    // Load sales data
    db.collection('transactions').where('date', '>=', startTs).where('date', '<=', endTs).get()
      .then(function (snap) {
        var totalGross = 0, totalNet = 0;
        snap.docs.forEach(function (d) {
          var t = d.data();
          totalGross += Number(t.gross || 0);
          totalNet += Number(t.net || 0);
        });
        var html = '<p><strong>Gross:</strong> ₱' + formatNum(totalGross) + '</p><p><strong>Net:</strong> ₱' + formatNum(totalNet) + '</p><p>Transactions: ' + snap.size + '</p>';
        if (summaryEl) summaryEl.innerHTML = html;
      })
      .catch(function (err) {
        handleFirestoreError(err, 'Failed to load sales data');
        if (summaryEl) summaryEl.innerHTML = '<p class="error-msg">Unable to load sales data.</p>';
      });

    // Load expense data
    db.collection('expenses').where('date', '>=', startTs).where('date', '<=', endTs).get()
      .then(function (snap) {
        var totalExpenses = 0;
        var expenseList = [];
        snap.docs.forEach(function (d) {
          var e = d.data();
          var amount = Number(e.amount || 0);
          totalExpenses += amount;
          expenseList.push({ desc: e.description || 'Unknown', amount: amount });
        });
        var html = '<p><strong>Total Expenses:</strong> ₱' + formatNum(totalExpenses) + '</p>';
        html += '<p>Expense entries: ' + snap.size + '</p>';
        if (expenseList.length > 0) {
          html += '<ul style="margin-top: 0.5rem; max-height: 150px; overflow-y: auto;">';
          expenseList.slice(0, 5).forEach(function (e) {
            html += '<li><span>' + escapeHtml(e.desc) + '</span> <span>₱' + formatNum(e.amount) + '</span></li>';
          });
          html += '</ul>';
        }
        if (expenseEl) expenseEl.innerHTML = html;
      })
      .catch(function (err) {
        handleFirestoreError(err, 'Failed to load expense data');
        if (expenseEl) expenseEl.innerHTML = '<p class="error-msg">Unable to load expense data.</p>';
      });

    db.collection('products').get().then(function (snap) {
      var docs = snap.docs.map(function (d) { 
        var p = d.data(); 
        return { id: d.id, name: (p && p.name) ? p.name : '', price: p && p.price != null ? p.price : 0, category: (p && p.category) ? p.category : 'Other' }; 
      });
      docs.sort(function (a, b) { return String(a.name).localeCompare(String(b.name)); });
      docs = docs.slice(0, 10);
      var html;
      if (!docs.length) {
        html = '<p>No products yet.</p>';
      } else {
        html = '<ul>';
        docs.forEach(function (p) {
          html += '<li><span>' + escapeHtml(p.name || p.id) + '</span> <span>₱' + formatNum(p.price) + '</span></li>';
        });
        html += '</ul>';
      }
      if (productsEl) productsEl.innerHTML = html;
    }).catch(function (err) {
      handleFirestoreError(err, 'Failed to load products');
      if (productsEl) productsEl.innerHTML = '<p class="error-msg">Unable to load products.</p>';
    });
  }

  var reportsPeriodEl = document.getElementById('reports-period');
  if (reportsPeriodEl) reportsPeriodEl.addEventListener('change', loadReports);

  // ---------- Data entry ----------
  document.querySelectorAll('.data-entry-tabs .tab').forEach(function (tab) {
    tab.addEventListener('click', function () {
      document.querySelectorAll('.data-entry-tabs .tab').forEach(function (t) { t.classList.remove('active'); });
      document.querySelectorAll('.tab-panel').forEach(function (p) { p.classList.remove('active'); });
      tab.classList.add('active');
      var panel = document.getElementById('tab-' + tab.dataset.tab);
      if (panel) panel.classList.add('active');
    });
  });

  function getTodayStr() {
    return new Date().toISOString().slice(0, 10);
  }
  var saleDateEl = document.getElementById('sale-date');
  var expenseDateEl = document.getElementById('expense-date');
  if (saleDateEl) saleDateEl.value = getTodayStr();
  if (expenseDateEl) expenseDateEl.value = getTodayStr();

  function setFormSubmitting(form, submitting) {
    var btn = form && form.querySelector('button[type="submit"]');
    if (btn) {
      btn.disabled = submitting;
      btn.textContent = submitting ? 'Saving…' : (form.id === 'form-sale' ? 'Save sale' : form.id === 'form-product' ? 'Add product' : 'Save expense');
    }
  }

  var formSale = document.getElementById('form-sale');
  if (formSale) formSale.addEventListener('submit', function (e) {
    e.preventDefault();
    if (!currentUser) return;
    var date = document.getElementById('sale-date').value;
    var gross = parseFloat(document.getElementById('sale-gross').value) || 0;
    var net = parseFloat(document.getElementById('sale-net').value) || 0;
    var notes = document.getElementById('sale-notes').value.trim();
    if (net > gross) {
      showToast('Net amount cannot exceed gross amount.', 'error');
      return;
    }
    setFormSubmitting(formSale, true);
    db.collection('transactions').add({
      date: firebase.firestore.Timestamp.fromDate(new Date(date)),
      gross: gross,
      net: net,
      notes: notes || null,
      createdBy: currentUser.uid,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    }).then(function () {
      formSale.reset();
      var saleDate = document.getElementById('sale-date');
      if (saleDate) saleDate.value = getTodayStr();
      loadDashboard();
      setFormSubmitting(formSale, false);
      showToast('Sale saved successfully.', 'success');
    }).catch(function (err) {
      setFormSubmitting(formSale, false);
      showToast('Error: ' + (err.message || 'Could not save sale.'), 'error');
    });
  });

  var formProduct = document.getElementById('form-product');
  if (formProduct) formProduct.addEventListener('submit', function (e) {
    e.preventDefault();
    var name = document.getElementById('product-name').value.trim();
    var category = document.getElementById('product-category').value.trim();
    var price = parseFloat(document.getElementById('product-price').value) || 0;
    setFormSubmitting(formProduct, true);
    db.collection('products').add({
      name: name,
      category: category || 'General',
      price: price,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    }).then(function () {
      formProduct.reset();
      setFormSubmitting(formProduct, false);
      showToast('Product added successfully.', 'success');
    }).catch(function (err) {
      setFormSubmitting(formProduct, false);
      showToast('Error: ' + (err.message || 'Could not add product.'), 'error');
    });
  });

  var formExpense = document.getElementById('form-expense');
  if (formExpense) formExpense.addEventListener('submit', function (e) {
    e.preventDefault();
    if (!currentUser) return;
    var date = document.getElementById('expense-date').value;
    var amount = parseFloat(document.getElementById('expense-amount').value) || 0;
    var desc = document.getElementById('expense-desc').value.trim();
    setFormSubmitting(formExpense, true);
    db.collection('expenses').add({
      date: firebase.firestore.Timestamp.fromDate(new Date(date)),
      amount: amount,
      description: desc,
      createdBy: currentUser.uid,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    }).then(function () {
      formExpense.reset();
      var expenseDate = document.getElementById('expense-date');
      if (expenseDate) expenseDate.value = getTodayStr();
      setFormSubmitting(formExpense, false);
      showToast('Expense saved successfully.', 'success');
    }).catch(function (err) {
      setFormSubmitting(formExpense, false);
      showToast('Error: ' + (err.message || 'Could not save expense.'), 'error');
    });
  });

  // ---------- User management ----------
  var modalUser = document.getElementById('modal-user');
  var formUser = document.getElementById('form-user');
  var userFormError = document.getElementById('user-form-error');

  var btnAddUser = document.getElementById('btn-add-user');
  var modalUserCancel = document.getElementById('modal-user-cancel');
  if (btnAddUser) btnAddUser.addEventListener('click', function () {
    if (userFormError) userFormError.textContent = '';
    if (formUser) formUser.reset();
    if (modalUser) modalUser.showModal();
  });

  if (modalUserCancel) modalUserCancel.addEventListener('click', function () {
    if (modalUser) modalUser.close();
    var submitBtn = formUser && formUser.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.disabled = false;
  });
  if (modalUser) {
    modalUser.addEventListener('close', function () {
      var submitBtn = formUser && formUser.querySelector('button[type="submit"]');
      if (submitBtn) submitBtn.disabled = false;
    });
  }

  if (formUser) formUser.addEventListener('submit', function (e) {
    e.preventDefault();
    if (userFormError) userFormError.textContent = '';
    var email = document.getElementById('new-user-email').value.trim();
    var password = document.getElementById('new-user-password').value;
    var role = document.getElementById('new-user-role').value;
    var submitBtn = formUser.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;

    firebase.auth().createUserWithEmailAndPassword(email, password).then(function (res) {
      var uid = res.user.uid;
      return db.collection('users').doc(uid).set({ email: email, role: role, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
    }).then(function () {
      auth.signOut();
      if (modalUser) modalUser.close();
      showToast('User created. Please sign in again with your admin account.', 'success');
    }).catch(function (err) {
      if (userFormError) userFormError.textContent = err.message || 'Failed to create user.';
      if (submitBtn) submitBtn.disabled = false;
      showToast(err.message || 'Failed to create user.', 'error');
    });
  });

  function loadUsers() {
    var tbody = document.getElementById('users-tbody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="4">Loading...</td></tr>';
    db.collection('users').get().then(function (snap) {
      var docs = snap.docs.map(function (d) { 
        var u = d.data(); 
        return { 
          email: (u && u.email) ? u.email : '—', 
          role: (u && u.role) ? u.role : '—', 
          createdAt: u && u.createdAt ? u.createdAt : null 
        }; 
      });
      docs.sort(function (a, b) { return String(a.email).localeCompare(String(b.email)); });
      tbody.innerHTML = '';
      docs.forEach(function (u) {
        var created = u.createdAt && u.createdAt.toDate ? u.createdAt.toDate().toLocaleDateString() : '—';
        var tr = document.createElement('tr');
        tr.innerHTML = '<td>' + escapeHtml(u.email) + '</td><td>' + escapeHtml(u.role) + '</td><td>' + escapeHtml(created) + '</td><td></td>';
        tbody.appendChild(tr);
      });
    }).catch(function (err) {
      handleFirestoreError(err, 'Failed to load users');
      tbody.innerHTML = '<tr><td colspan="4">Unable to load users. Admin access required.</td></tr>';
    });
  }

  // ---------- Notifications System (Phase 2) ----------
  function loadNotifications() {
    var container = document.getElementById('notifications-container');
    if (!container) return;

    container.innerHTML = '<div class="notification-card"><div class="notification-icon">⏳</div><div class="notification-content"><h4>Loading...</h4><p>Fetching your AI insights and recommendations</p></div></div>';

    // Listen to recommendations collection
    db.collection('recommendations')
      .orderBy('createdAt', 'desc')
      .limit(10)
      .get()
      .then(function(snap) {
        if (snap.empty) {
          container.innerHTML = '<div class="notification-card"><div class="notification-icon">🤖</div><div class="notification-content"><h4>No Recommendations Yet</h4><p>AI-powered recommendations will appear here once data analysis begins. Upload your sales and market data to get started.</p></div></div>';
          return;
        }

        container.innerHTML = '';
        snap.forEach(function(doc) {
          var data = doc.data();
          var card = createNotificationCard(data);
          container.appendChild(card);
        });
      })
      .catch(function(err) {
        handleFirestoreError(err, 'Failed to load notifications');
        container.innerHTML = '<div class="notification-card"><div class="notification-icon">⚠️</div><div class="notification-content"><h4>Error Loading Notifications</h4><p>Unable to fetch recommendations. Please try again later.</p></div></div>';
      });
  }

  function createNotificationCard(data) {
    var card = document.createElement('div');
    card.className = 'notification-card';

    var icon = data.icon || '📊';
    var title = data.title || 'AI Insight';
    var insight = data.insight || '';
    var action = data.suggestedAction || '';
    var created = data.createdAt ? data.createdAt.toDate().toLocaleString() : 'Recently';

    var html = '<div class="notification-icon">' + escapeHtml(icon) + '</div>';
    html += '<div class="notification-content">';
    html += '<h4>' + escapeHtml(title) + '</h4>';
    
    if (insight) {
      html += '<div class="notification-insight">';
      html += '<div class="notification-insight-label">Insight</div>';
      html += '<p>' + escapeHtml(insight) + '</p>';
      html += '</div>';
    }
    
    if (action) {
      html += '<div class="notification-action">';
      html += '<strong>Suggested Action:</strong> ' + escapeHtml(action);
      html += '</div>';
    }
    
    html += '<span class="notification-time">' + escapeHtml(created) + '</span>';
    html += '</div>';

    card.innerHTML = html;
    return card;
  }

  // ---------- Predictive Charts (Phase 4) ----------
  var chartPredictedSales, chartMenuDemand, chartForecastActual;

  // Chart tab switching
  document.querySelectorAll('.chart-tab').forEach(function(tab) {
    tab.addEventListener('click', function() {
      var chartId = this.dataset.chart;
      
      // Update active tab
      document.querySelectorAll('.chart-tab').forEach(function(t) { t.classList.remove('active'); });
      this.classList.add('active');
      
      // Update active panel
      document.querySelectorAll('.chart-tab-panel').forEach(function(p) { p.classList.remove('active'); });
      document.getElementById('chart-' + chartId).classList.add('active');
    });
  });

  function loadPredictiveCharts() {
    loadPredictedSalesChart();
    loadMenuDemandChart();
    loadForecastActualChart();
  }

  function loadPredictedSalesChart() {
    var ctx = document.getElementById('chart-predicted-sales');
    var statusDiv = document.getElementById('sales-forecast-status');
    
    if (!ctx) return;
    
    if (chartPredictedSales) {
      chartPredictedSales.destroy();
    }

    // Check if we have prediction history
    db.collection('prediction_history')
      .orderBy('date', 'desc')
      .limit(7)
      .get()
      .then(function(snap) {
        if (snap.empty) {
          if (statusDiv) {
            statusDiv.innerHTML = '<div class="no-data">📊 No prediction data yet. Upload data and run analytics to generate forecasts.</div>';
          }
          return;
        }

        var dates = [];
        var predicted = [];
        
        snap.forEach(function(doc) {
          var data = doc.data();
          dates.unshift(data.date);
          predicted.unshift(data.predictedSales || 0);
        });

        // Generate 7-day future forecast
        var lastDate = new Date(dates[dates.length - 1]);
        var futureDates = [];
        var futurePredictions = [];
        
        for (var i = 1; i <= 7; i++) {
          var futureDate = new Date(lastDate);
          futureDate.setDate(futureDate.getDate() + i);
          futureDates.push(futureDate.toISOString().split('T')[0]);
          // Simple trend-based prediction (last value + small random variation)
          var lastValue = predicted[predicted.length - 1] || 0;
          var trend = predicted.length > 1 ? (predicted[predicted.length - 1] - predicted[predicted.length - 2]) : 0;
          futurePredictions.push(lastValue + trend + (Math.random() - 0.5) * 100);
        }

        chartPredictedSales = new Chart(ctx, {
          type: 'line',
          data: {
            labels: dates.concat(futureDates),
            datasets: [{
              label: 'Historical',
              data: predicted.concat(new Array(7).fill(null)),
              borderColor: '#f59e0b',
              backgroundColor: 'rgba(245, 158, 11, 0.1)',
              tension: 0.4
            }, {
              label: '7-Day Forecast',
              data: new Array(predicted.length).fill(null).concat(futurePredictions),
              borderColor: '#22c55e',
              backgroundColor: 'rgba(34, 197, 94, 0.1)',
              borderDash: [5, 5],
              tension: 0.4
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { position: 'top' } },
            scales: {
              y: { beginAtZero: true, grid: { color: '#2d3a4f' } },
              x: { grid: { color: '#2d3a4f' } }
            }
          }
        });

        if (statusDiv) statusDiv.innerHTML = '';
      })
      .catch(function(err) {
        console.error('Error loading predicted sales:', err);
        if (statusDiv) {
          statusDiv.innerHTML = '<div class="no-data">⚠️ Error loading forecast data</div>';
        }
      });
  }

  function loadMenuDemandChart() {
    var ctx = document.getElementById('chart-menu-demand');
    var statusDiv = document.getElementById('menu-demand-status');
    
    if (!ctx) return;
    
    if (chartMenuDemand) {
      chartMenuDemand.destroy();
    }

    // Fetch from prediction_history for menu demand
    db.collection('prediction_history')
      .orderBy('predictedDemand', 'desc')
      .limit(10)
      .get()
      .then(function(snap) {
        if (snap.empty) {
          if (statusDiv) {
            statusDiv.innerHTML = '<div class="no-data">📊 No demand prediction data yet. Run analytics to generate menu demand forecasts.</div>';
          }
          return;
        }

        var items = [];
        var demand = [];
        
        snap.forEach(function(doc) {
          var data = doc.data();
          if (data.itemName) {
            items.push(data.itemName);
            demand.push(data.predictedDemand || 0);
          }
        });

        if (items.length === 0) {
          // Use sample data if no predictions available
          items = ['Loading predictions...'];
          demand = [0];
        }

        chartMenuDemand = new Chart(ctx, {
          type: 'bar',
          data: {
            labels: items,
            datasets: [{
              label: 'Predicted Demand',
              data: demand,
              backgroundColor: 'rgba(245, 158, 11, 0.7)',
              borderColor: '#f59e0b',
              borderWidth: 1
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            indexAxis: 'y',
            plugins: { legend: { display: false } },
            scales: {
              x: { beginAtZero: true, grid: { color: '#2d3a4f' } },
              y: { grid: { color: '#2d3a4f' } }
            }
          }
        });

        if (statusDiv) statusDiv.innerHTML = '';
      })
      .catch(function(err) {
        console.error('Error loading menu demand:', err);
        if (statusDiv) {
          statusDiv.innerHTML = '<div class="no-data">⚠️ Error loading demand data</div>';
        }
      });
  }

  function loadForecastActualChart() {
    var ctx = document.getElementById('chart-forecast-actual');
    var statusDiv = document.getElementById('forecast-actual-status');
    
    if (!ctx) return;
    
    if (chartForecastActual) {
      chartForecastActual.destroy();
    }

    // Fetch from prediction_history and compare with actual
    db.collection('prediction_history')
      .orderBy('date', 'desc')
      .limit(14)
      .get()
      .then(function(snap) {
        if (snap.empty) {
          if (statusDiv) {
            statusDiv.innerHTML = '<div class="no-data">📊 No forecast comparison data yet. Predictions will be compared with actual sales once data is available.</div>';
          }
          return;
        }

        var dates = [];
        var predicted = [];
        var actual = [];
        
        snap.forEach(function(doc) {
          var data = doc.data();
          dates.unshift(data.date);
          predicted.unshift(data.predictedSales || 0);
          actual.unshift(data.actualSales || null);
        });

        chartForecastActual = new Chart(ctx, {
          type: 'line',
          data: {
            labels: dates,
            datasets: [{
              label: 'Predicted',
              data: predicted,
              borderColor: '#f59e0b',
              backgroundColor: 'rgba(245, 158, 11, 0.1)',
              tension: 0.4
            }, {
              label: 'Actual',
              data: actual,
              borderColor: '#22c55e',
              backgroundColor: 'rgba(34, 197, 94, 0.1)',
              tension: 0.4
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { position: 'top' } },
            scales: {
              y: { beginAtZero: true, grid: { color: '#2d3a4f' } },
              x: { grid: { color: '#2d3a4f' } }
            }
          }
        });

        // Calculate accuracy if we have actual data
        var validComparisons = 0;
        var totalError = 0;
        for (var i = 0; i < predicted.length; i++) {
          if (actual[i] !== null && actual[i] !== undefined) {
            validComparisons++;
            totalError += Math.abs(predicted[i] - actual[i]) / actual[i];
          }
        }
        
        if (validComparisons > 0) {
          var accuracy = (1 - (totalError / validComparisons)) * 100;
          if (statusDiv) {
            statusDiv.innerHTML = '<div style="color: #22c55e;">🎯 Forecast Accuracy: ' + accuracy.toFixed(1) + '%</div>';
          }
        } else {
          if (statusDiv) {
            statusDiv.innerHTML = '<div class="no-data">⏳ Waiting for actual sales data to compare with predictions...</div>';
          }
        }
      })
      .catch(function(err) {
        console.error('Error loading forecast vs actual:', err);
        if (statusDiv) {
          statusDiv.innerHTML = '<div class="no-data">⚠️ Error loading comparison data</div>';
        }
      });
  }

  // Call predictive charts when dashboard loads
  // This will be called from loadDashboard() or can be called separately
  window.loadPredictiveCharts = loadPredictiveCharts;

  // ---------- CSV/Excel Upload System (Phase 1) ----------
  var fileUpload = document.getElementById('file-upload');
  var dataType = document.getElementById('data-type');
  var btnPreviewFile = document.getElementById('btn-preview-file');
  var previewSection = document.getElementById('preview-section');
  var previewHead = document.getElementById('preview-head');
  var previewBody = document.getElementById('preview-body');
  var mappingContainer = document.getElementById('mapping-container');
  var btnSaveMappedData = document.getElementById('btn-save-mapped-data');
  var btnCancelUpload = document.getElementById('btn-cancel-upload');

  var currentFileData = [];
  var currentFileHeaders = [];

  // Required fields mapping
  var requiredFields = {
    sales: [
      { key: 'date', label: 'Date', type: 'date' },
      { key: 'amount', label: 'Amount', type: 'number' },
      { key: 'itemName', label: 'Item Name', type: 'string' },
      { key: 'orderNumber', label: 'Order Number', type: 'string' }
    ],
    market: [
      { key: 'date', label: 'Date', type: 'date' },
      { key: 'amount', label: 'Amount', type: 'number' },
      { key: 'ingredientName', label: 'Ingredient Name', type: 'string' }
    ]
  };

  // Utility: Parse CSV
  function parseCSV(text) {
    var lines = text.split('\n').filter(function(line) { return line.trim(); });
    if (lines.length === 0) return { headers: [], data: [] };
    
    var headers = lines[0].split(',').map(function(h) { return h.trim().replace(/^"|"$/g, ''); });
    var data = [];
    
    for (var i = 1; i < lines.length; i++) {
      var values = lines[i].split(',').map(function(v) { return v.trim().replace(/^"|"$/g, ''); });
      var row = {};
      for (var j = 0; j < headers.length; j++) {
        row[headers[j]] = values[j] || '';
      }
      data.push(row);
    }
    
    return { headers: headers, data: data };
  }

  // Utility: Parse Excel (basic XLSX support)
  function parseExcel(arrayBuffer) {
    try {
      var data = new Uint8Array(arrayBuffer);
      var arr = [];
      for (var i = 0; i < data.length; i++) {
        arr.push(String.fromCharCode(data[i]));
      }
      var bstr = arr.join('');
      
      // Basic CSV-like parsing for Excel (simplified)
      return parseCSV(bstr);
    } catch (err) {
      showToast('Error parsing Excel file. Please convert to CSV format.', 'error');
      return { headers: [], data: [] };
    }
  }

  // Utility: Validate and format date to ISO 8601
  function formatDate(dateStr) {
    if (!dateStr) return null;
    
    var date;
    // Try various date formats
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      date = new Date(dateStr);
    } else if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) {
      var parts = dateStr.split('/');
      date = new Date(parts[2], parts[0] - 1, parts[1]);
    } else if (/^\d{2}-\d{2}-\d{4}$/.test(dateStr)) {
      var parts = dateStr.split('-');
      date = new Date(parts[2], parts[0] - 1, parts[1]);
    } else {
      date = new Date(dateStr);
    }
    
    if (isNaN(date.getTime())) return null;
    return date.toISOString().split('T')[0]; // YYYY-MM-DD
  }

  // Utility: Sanitize amount to float
  function formatAmount(amountStr) {
    if (!amountStr) return 0;
    var cleaned = String(amountStr).replace(/[^\d.-]/g, '');
    var num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
  }

  // Show file preview
  if (btnPreviewFile) {
    btnPreviewFile.addEventListener('click', function() {
      var file = fileUpload && fileUpload.files[0];
      var type = dataType && dataType.value;
      
      if (!file) {
        showToast('Please select a file first.', 'error');
        return;
      }
      if (!type) {
        showToast('Please select a data type.', 'error');
        return;
      }

      var reader = new FileReader();
      reader.onload = function(e) {
        var result;
        if (file.name.endsWith('.csv')) {
          result = parseCSV(e.target.result);
        } else {
          result = parseExcel(e.target.result);
        }
        
        currentFileHeaders = result.headers;
        currentFileData = result.data.slice(0, 10); // Preview first 10 rows
        
        showPreview();
        createMappingInterface(type);
      };
      
      if (file.name.endsWith('.csv')) {
        reader.readAsText(file);
      } else {
        reader.readAsArrayBuffer(file);
      }
    });
  }

  // Display preview table
  function showPreview() {
    if (!previewHead || !previewBody) return;
    
    // Build header
    var headerHtml = '<tr>';
    currentFileHeaders.forEach(function(header) {
      headerHtml += '<th>' + escapeHtml(header) + '</th>';
    });
    headerHtml += '</tr>';
    previewHead.innerHTML = headerHtml;
    
    // Build body (first 5 rows)
    var bodyHtml = '';
    currentFileData.slice(0, 5).forEach(function(row) {
      bodyHtml += '<tr>';
      currentFileHeaders.forEach(function(header) {
        bodyHtml += '<td>' + escapeHtml(String(row[header] || '')) + '</td>';
      });
      bodyHtml += '</tr>';
    });
    previewBody.innerHTML = bodyHtml;
    
    if (previewSection) previewSection.classList.remove('hidden');
  }

  // Create mapping interface
  function createMappingInterface(dataType) {
    if (!mappingContainer) return;
    
    var fields = requiredFields[dataType];
    var html = '';
    
    fields.forEach(function(field) {
      html += '<div class="mapping-group">';
      html += '<label>' + escapeHtml(field.label) + ' <small>(' + escapeHtml(field.type) + ')</small></label>';
      html += '<select id="map-' + escapeHtml(field.key) + '" data-field="' + escapeHtml(field.key) + '" data-type="' + escapeHtml(field.type) + '">';
      html += '<option value="">-- Select column --</option>';
      
      currentFileHeaders.forEach(function(header) {
        // Try to auto-match based on similar names
        var isMatch = header.toLowerCase().includes(field.key.toLowerCase()) || 
                     header.toLowerCase().includes(field.label.toLowerCase());
        html += '<option value="' + escapeHtml(header) + '"' + (isMatch ? ' selected' : '') + '>' + escapeHtml(header) + '</option>';
      });
      
      html += '</select>';
      html += '</div>';
    });
    
    mappingContainer.innerHTML = html;
  }

  // Save mapped data to Firestore
  if (btnSaveMappedData) {
    btnSaveMappedData.addEventListener('click', function() {
      var type = dataType && dataType.value;
      if (!type || currentFileData.length === 0) return;
      
      var fields = requiredFields[type];
      var mapping = {};
      
      // Get selected mappings
      fields.forEach(function(field) {
        var select = document.getElementById('map-' + field.key);
        if (select && select.value) {
          mapping[field.key] = { column: select.value, type: field.type };
        }
      });
      
      // Validate all required fields are mapped
      var missingFields = fields.filter(function(f) { return !mapping[f.key]; });
      if (missingFields.length > 0) {
        showToast('Please map all required fields: ' + missingFields.map(function(f) { return f.label; }).join(', '), 'error');
        return;
      }
      
      btnSaveMappedData.disabled = true;
      btnSaveMappedData.textContent = 'Saving...';
      
      var collectionName = type === 'sales' ? 'sales_data' : 'market_historical_data';
      var batch = db.batch();
      var savedCount = 0;
      
      // Process and save data
      var promises = currentFileData.map(function(row) {
        var data = { createdAt: firebase.firestore.FieldValue.serverTimestamp() };
        
        fields.forEach(function(field) {
          var mapInfo = mapping[field.key];
          var value = row[mapInfo.column];
          
          if (field.type === 'date') {
            data[field.key] = formatDate(value);
          } else if (field.type === 'number') {
            data[field.key] = formatAmount(value);
          } else {
            data[field.key] = value || '';
          }
        });
        
        // Add to batch
        var docRef = db.collection(collectionName).doc();
        batch.set(docRef, data);
        savedCount++;
        
        return Promise.resolve();
      });
      
      batch.commit().then(function() {
        showToast('Successfully saved ' + savedCount + ' records to ' + collectionName, 'success');
        resetUploadForm();
      }).catch(function(err) {
        handleFirestoreError(err, 'Failed to save data');
      }).finally(function() {
        btnSaveMappedData.disabled = false;
        btnSaveMappedData.textContent = 'Save Mapped Data';
      });
    });
  }

  // Cancel upload
  if (btnCancelUpload) {
    btnCancelUpload.addEventListener('click', resetUploadForm);
  }

  function resetUploadForm() {
    if (fileUpload) fileUpload.value = '';
    if (dataType) dataType.value = '';
    if (previewSection) previewSection.classList.add('hidden');
    currentFileData = [];
    currentFileHeaders = [];
  }
})();
