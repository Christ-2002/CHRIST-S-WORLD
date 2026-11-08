/* 票清 · 应用外壳、路由、全局搜索与统计辅助 */
(function (global) {
  'use strict';

  const IP = global.IP;
  const DB = IP.DB;
  const UI = IP.UI;
  const $ = IP.$;
  const $$ = IP.$$;
  const esc = IP.escapeHtml;
  const icon = IP.icon;

  IP.views = IP.views || {};

  const appEl = $('#app');
  const pageTitleEl = $('#pageTitle');
  const crumbEl = $('#crumbCurrent');
  const sidebar = $('#sidebar');
  const scrim = $('#sidebarScrim');
  const notificationPopover = $('#notificationPopover');

  const pageMeta = {
    dashboard: { title: '工作台', crumb: '总览', doc: '工作台' },
    verify: { title: '发票查验', crumb: '查验工作台', doc: '发票查验' },
    ledger: { title: '发票台账', crumb: '发票管理', doc: '发票台账' },
    risk: { title: '风险中心', crumb: '风险预警', doc: '风险中心' },
    analytics: { title: '统计分析', crumb: '统计报表', doc: '统计分析' },
    settings: { title: '设置与数据', crumb: '系统设置', doc: '设置' }
  };

  const routerState = { route: 'dashboard', param: null, recharts: null };

  /* ---------- 统计辅助 ---------- */
  function sum(list, key) {
    return list.reduce(function (total, item) { return total + (Number(item[key]) || 0); }, 0);
  }

  function monthlySeries(list, months) {
    const keys = IP.lastMonths(months || 6);
    const map = {};
    keys.forEach(function (key) {
      map[key] = { key: key, label: IP.monthLabel(key), amount: 0, tax: 0, total: 0, count: 0 };
    });
    list.forEach(function (item) {
      const key = IP.monthKey(item.date);
      if (!map[key]) return;
      map[key].amount += Number(item.amount) || 0;
      map[key].tax += Number(item.taxAmount) || 0;
      map[key].total += Number(item.total) || 0;
      map[key].count += 1;
    });
    return keys.map(function (key) {
      const row = map[key];
      row.amount = IP.round2(row.amount);
      row.tax = IP.round2(row.tax);
      row.total = IP.round2(row.total);
      return row;
    });
  }

  function typeDistribution(list) {
    const map = {};
    list.forEach(function (item) {
      if (!map[item.type]) map[item.type] = { type: item.type, label: IP.getType(item.type).short, count: 0, total: 0 };
      map[item.type].count += 1;
      map[item.type].total += Number(item.total) || 0;
    });
    return Object.values(map).sort(function (a, b) { return b.count - a.count; });
  }

  function riskCounts(list) {
    const counts = { passed: 0, review: 0, risk: 0 };
    list.forEach(function (item) { if (counts[item.status] != null) counts[item.status] += 1; });
    return counts;
  }

  function sellerTop(list) {
    const map = {};
    list.forEach(function (item) {
      const name = item.sellerName || '未知销售方';
      if (!map[name]) map[name] = { name: name, count: 0, total: 0 };
      map[name].count += 1;
      map[name].total += Number(item.total) || 0;
    });
    return Object.values(map).sort(function (a, b) { return b.total - a.total; });
  }

  function rateDistribution(list) {
    const map = {};
    list.forEach(function (item) {
      const rate = Number(item.taxRate) || 0;
      if (!map[rate]) map[rate] = { rate: rate, count: 0, total: 0, tax: 0 };
      map[rate].count += 1;
      map[rate].total += Number(item.total) || 0;
      map[rate].tax += Number(item.taxAmount) || 0;
    });
    return Object.values(map).sort(function (a, b) { return b.total - a.total; });
  }

  function monthInvoices(list, offset) {
    const d = new Date();
    const target = new Date(d.getFullYear(), d.getMonth() - offset, 1);
    const key = target.getFullYear() + '-' + String(target.getMonth() + 1).padStart(2, '0');
    return list.filter(function (item) { return IP.monthKey(item.date) === key; });
  }

  function percentChange(current, previous) {
    if (!previous) return current > 0 ? { text: '本月新增', dir: 'up' } : { text: '暂无数据', dir: 'flat' };
    const pct = ((current - previous) / previous) * 100;
    if (Math.abs(pct) < 0.5) return { text: '与上月持平', dir: 'flat' };
    return { text: (pct > 0 ? '+' : '') + pct.toFixed(1) + '% 较上月', dir: pct > 0 ? 'up' : 'down' };
  }

  function filterByRange(list, range) {
    if (range === 'all') return list.slice();
    const months = range === '12m' ? 12 : 6;
    const keys = new Set(IP.lastMonths(months));
    return list.filter(function (item) { return keys.has(IP.monthKey(item.date)); });
  }

  IP.stats = {
    sum: sum,
    monthlySeries: monthlySeries,
    typeDistribution: typeDistribution,
    riskCounts: riskCounts,
    sellerTop: sellerTop,
    rateDistribution: rateDistribution,
    monthInvoices: monthInvoices,
    percentChange: percentChange,
    filterByRange: filterByRange
  };

  /* ---------- 路由 ---------- */
  function parseHash() {
    const raw = (location.hash || '#/dashboard').replace(/^#\/?/, '');
    const parts = raw.split('?')[0].split('/').filter(Boolean);
    return { name: parts[0] || 'dashboard', id: parts[1] || null };
  }

  function navigate(hash) {
    if (location.hash === hash) {
      route();
    } else {
      location.hash = hash;
    }
  }

  function route(initial) {
    const parsed = parseHash();
    let name = parsed.name;
    if (!pageMeta[name]) name = 'dashboard';
    routerState.route = name;
    routerState.param = parsed.id;
    routerState.recharts = null;
    UI.closeAll();
    closeSidebar();
    closeNotifications();

    $$('.nav-item[data-route]').forEach(function (item) {
      item.classList.toggle('active', item.getAttribute('data-route') === name);
    });
    const meta = pageMeta[name];
    pageTitleEl.textContent = meta.title;
    crumbEl.textContent = meta.crumb;
    document.title = meta.doc + ' · 票清';

    if (name === 'verify') {
      IP.verify.mount(appEl, parsed.id);
    } else if (IP.views[name]) {
      IP.views[name](appEl, { id: parsed.id });
    } else {
      appEl.innerHTML = '<div class="empty-state"><h4>页面不存在</h4><p>请从左侧导航重新进入。</p></div>';
    }
    updateChrome();
    if (!initial) {
      try { global.scrollTo({ top: 0, behavior: 'auto' }); } catch (err) { global.scrollTo(0, 0); }
    }
  }

  function refresh() {
    route();
  }

  function openInvoice(id) {
    if (routerState.route !== 'ledger') {
      navigate('#/ledger');
      setTimeout(function () { IP.verify.openDetail(id); }, 160);
    } else {
      IP.verify.openDetail(id);
    }
  }

  function updateChrome() {
    const invoices = DB.invoices();
    const settings = DB.settings();
    const counts = riskCounts(invoices);
    const ledgerBadge = $('#navLedgerCount');
    if (ledgerBadge) ledgerBadge.textContent = invoices.length;
    const riskBadge = $('#navRiskCount');
    if (riskBadge) {
      riskBadge.textContent = counts.risk;
      riskBadge.hidden = counts.risk === 0;
    }
    const notifyDot = $('#notifyDot');
    if (notifyDot) notifyDot.hidden = (counts.risk + counts.review) === 0;

    const buyerName = $('#sidebarBuyerName');
    if (buyerName) buyerName.textContent = settings.buyerName || '未设置默认抬头';
    const buyerTaxId = $('#sidebarBuyerTaxId');
    if (buyerTaxId) buyerTaxId.textContent = settings.buyerTaxId || '未设置纳税人识别号';
    const dataCount = $('#sidebarDataCount');
    if (dataCount) dataCount.textContent = invoices.length + ' 张发票';

    renderNotifications();
  }

  /* ---------- 侧栏 ---------- */
  function openSidebar() {
    sidebar.classList.add('is-open');
    scrim.hidden = false;
    document.body.classList.add('no-scroll');
  }

  function closeSidebar() {
    sidebar.classList.remove('is-open');
    scrim.hidden = true;
    if (!document.querySelector('.modal-root.is-open') && !document.querySelector('.drawer-root.is-open')) {
      document.body.classList.remove('no-scroll');
    }
  }

  function bindShell() {
    const menuBtn = $('#menuBtn');
    if (menuBtn) menuBtn.addEventListener('click', openSidebar);
    if (scrim) scrim.addEventListener('click', closeSidebar);
    $$('.nav-item[data-route], .brand, .sidebar-cta, .workspace-card').forEach(function (link) {
      link.addEventListener('click', closeSidebar);
    });

    const helpBtn = $('#helpBtn');
    if (helpBtn) helpBtn.addEventListener('click', IP.verify.showHelp);
    const helpNavBtn = $('#helpNavBtn');
    if (helpNavBtn) helpNavBtn.addEventListener('click', function () {
      closeSidebar();
      IP.verify.showHelp();
    });

    const searchBtn = $('#globalSearchBtn');
    if (searchBtn) searchBtn.addEventListener('click', openPalette);

    const bell = $('#notificationBtn');
    if (bell) bell.addEventListener('click', function (event) {
      event.stopPropagation();
      if (notificationPopover.hidden) {
        renderNotifications();
        notificationPopover.hidden = false;
      } else {
        notificationPopover.hidden = true;
      }
    });

    document.addEventListener('click', function (event) {
      if (!notificationPopover.hidden && !event.target.closest('#notificationPopover') && !event.target.closest('#notificationBtn')) {
        closeNotifications();
      }
    });

    notificationPopover.addEventListener('click', function (event) {
      const item = event.target.closest('[data-notify-id]');
      if (item) {
        closeNotifications();
        openInvoice(item.getAttribute('data-notify-id'));
      }
      const all = event.target.closest('[data-open-risk]');
      if (all) closeNotifications();
    });

    document.addEventListener('keydown', function (event) {
      const tag = (event.target.tagName || '').toLowerCase();
      const typing = tag === 'input' || tag === 'textarea' || tag === 'select' || event.target.isContentEditable;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        openPalette();
        return;
      }
      if (!typing && !event.ctrlKey && !event.metaKey && event.key.toLowerCase() === 'n') {
        if (document.querySelector('.modal-root.is-open') || document.querySelector('.drawer-root.is-open')) return;
        event.preventDefault();
        navigate('#/verify');
      }
    });

    global.addEventListener('resize', IP.debounce(function () {
      if (routerState.recharts) routerState.recharts();
    }, 260));
  }

  function closeNotifications() {
    if (notificationPopover) notificationPopover.hidden = true;
  }

  function renderNotifications() {
    const body = $('#notificationBody');
    if (!body) return;
    const flagged = DB.invoices().filter(function (item) { return item.status !== 'passed'; })
      .sort(function (a, b) { return (a.riskScore || 100) - (b.riskScore || 100); })
      .slice(0, 4);
    if (!flagged.length) {
      body.innerHTML = '<div class="popover-empty">' + icon('i-shield-check') + '<p style="margin-top:6px">台账中没有待处理风险</p></div>';
      return;
    }
    body.innerHTML = flagged.map(function (item) {
      const danger = item.status === 'risk';
      return '<button class="popover-item" type="button" data-notify-id="' + item.id + '" style="width:100%;text-align:left">' +
        '<span class="invoice-icon" style="' + (danger ? 'background:var(--danger-soft);color:var(--danger)' : 'background:var(--warn-soft);color:var(--warn)') + '">' + icon(danger ? 'i-shield-alert' : 'i-alert') + '</span>' +
        '<span class="popover-item-text"><strong>' + esc(item.sellerName || '未知销售方') + '</strong><span>' + esc(item.issues && item.issues[0] ? item.issues[0].label : '需要复核') + ' · ' + IP.moneySign(item.total) + '</span></span>' +
        '</button>';
    }).join('') +
    '<div class="popover-foot"><a href="#/risk" class="text-link" data-open-risk>进入风险中心 ' + icon('i-arrow-right') + '</a></div>';
  }

  /* ---------- 全局搜索 ---------- */
  let paletteActions = [];
  let paletteIndex = 0;

  function openPalette() {
    closeNotifications();
    const html =
      '<div class="modal command-modal" role="dialog" aria-modal="true" aria-label="全局搜索">' +
        '<div class="command-search">' + icon('i-search') +
          '<input type="text" id="commandInput" placeholder="搜索发票号码、销售方、购买方，或输入指令…" autocomplete="off" autofocus>' +
          '<kbd>ESC</kbd>' +
        '</div>' +
        '<div class="command-body" id="commandBody"></div>' +
        '<div class="command-pop"><span><kbd>↑↓</kbd> 选择</span><span><kbd>↵</kbd> 打开</span><span><kbd>Ctrl K</kbd> 随时唤起</span></div>' +
      '</div>';
    UI.openModal(html, {
      onMount: function (modal) {
        const input = $('#commandInput', modal);
        const body = $('#commandBody', modal);
        input.addEventListener('input', function () { paletteIndex = 0; paintPalette(body, input.value); });
        input.addEventListener('keydown', function (event) {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            const items = $$('.command-item', body);
            if (!items.length) return;
            paletteIndex = (paletteIndex + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
            items.forEach(function (item, i) { item.classList.toggle('is-active', i === paletteIndex); });
            items[paletteIndex].scrollIntoView({ block: 'nearest' });
          } else if (event.key === 'Enter') {
            event.preventDefault();
            const item = $$('.command-item', body)[paletteIndex];
            if (item) item.click();
          }
        });
        body.addEventListener('click', function (event) {
          const item = event.target.closest('.command-item');
          if (!item) return;
          const action = paletteActions[Number(item.getAttribute('data-action-index'))];
          if (!action) return;
          UI.closeModal();
          if (action.type === 'invoice') {
            setTimeout(function () { openInvoice(action.id); }, 80);
          } else {
            navigate(action.hash);
          }
        });
        paintPalette(body, '');
      }
    });
  }

  function paintPalette(body, query) {
    const q = String(query || '').trim().toLowerCase();
    const quick = [
      { label: '新建发票查验', sub: '上传图片或手工录入', icon: 'i-scan', hash: '#/verify', keywords: 'verify scan new 查验 发票' },
      { label: '打开发票台账', sub: '检索、筛选与导出全部发票', icon: 'i-list', hash: '#/ledger', keywords: 'ledger list 台账 发票' },
      { label: '查看风险中心', sub: '处理重复、税号与金额异常', icon: 'i-shield-alert', hash: '#/risk', keywords: 'risk 风险 异常' },
      { label: '数据备份与恢复', sub: '导出 JSON 或清理本地数据', icon: 'i-database', hash: '#/settings', keywords: 'backup data settings 备份 数据' }
    ];
    const actions = quick.filter(function (item) {
      return !q || (item.label + item.sub + item.keywords).toLowerCase().indexOf(q) >= 0;
    });
    const invoices = q
      ? DB.invoices().filter(function (item) {
          return [item.number, item.sellerName, item.buyerName, item.itemName, item.code].join(' ').toLowerCase().indexOf(q) >= 0;
        }).slice(0, 6)
      : DB.invoices().slice(0, 4);

    paletteActions = [];
    let html = '';
    if (actions.length) {
      html += '<div class="command-group-label">快捷操作</div>';
      actions.forEach(function (action) {
        const idx = paletteActions.length;
        paletteActions.push({ type: 'action', hash: action.hash });
        html += '<button class="command-item" type="button" data-action-index="' + idx + '">' +
          '<span class="invoice-icon">' + icon(action.icon) + '</span>' +
          '<span class="command-item-text"><strong>' + esc(action.label) + '</strong><span>' + esc(action.sub) + '</span></span>' +
          icon('i-arrow-right') + '</button>';
      });
    }
    if (invoices.length) {
      html += '<div class="command-group-label">' + (q ? '匹配发票' : '最近发票') + '</div>';
      invoices.forEach(function (invoice) {
        const idx = paletteActions.length;
        paletteActions.push({ type: 'invoice', id: invoice.id });
        html += '<button class="command-item" type="button" data-action-index="' + idx + '">' +
          '<span class="invoice-icon">' + icon('i-receipt') + '</span>' +
          '<span class="command-item-text"><strong>' + esc(invoice.sellerName || '未知销售方') + '</strong><span>' + esc(invoice.number) + ' · ' + IP.formatDate(invoice.date) + ' · ' + IP.moneySign(invoice.total) + '</span></span>' +
          IP.statusBadge(invoice.status) + '</button>';
      });
    }
    if (!html) {
      html = '<div class="command-empty">没有找到与「' + esc(query) + '」相关的内容<br><span class="text-xs">试试发票号码、销售方名称或「查验」</span></div>';
    }
    body.innerHTML = html;
    paletteIndex = 0;
    const first = body.querySelector('.command-item');
    if (first) first.classList.add('is-active');
  }

  /* ---------- 启动 ---------- */
  function boot() {
    DB.load();
    bindShell();
    if (!location.hash) location.replace('#/dashboard');
    global.addEventListener('hashchange', function () { route(false); });
    route(true);
    if (!DB.storageAvailable) {
      UI.toast('浏览器本地存储不可用，数据可能无法保存', 'error', 5000);
    }
  }

  IP.router = {
    navigate: navigate,
    refresh: refresh,
    openInvoice: openInvoice,
    setRecharts: function (fn) { routerState.recharts = fn; },
    route: function () { return routerState.route; }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})(window);
