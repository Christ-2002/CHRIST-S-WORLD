/* 票清 · 发票台账与风险中心 */
(function (global) {
  'use strict';

  const IP = global.IP;
  const DB = IP.DB;
  const UI = IP.UI;
  const $ = IP.$;
  const esc = IP.escapeHtml;
  const icon = IP.icon;

  const ledgerState = {
    q: '',
    status: 'all',
    type: 'all',
    from: '',
    to: '',
    sort: 'date_desc',
    page: 1,
    pageSize: 8,
    selected: new Set()
  };

  function filteredInvoices() {
    const q = ledgerState.q.trim().toLowerCase();
    let list = DB.invoices().filter(function (item) {
      if (ledgerState.status !== 'all' && item.status !== ledgerState.status) return false;
      if (ledgerState.type !== 'all' && item.type !== ledgerState.type) return false;
      if (ledgerState.from && item.date < ledgerState.from) return false;
      if (ledgerState.to && item.date > ledgerState.to) return false;
      if (q) {
        const haystack = [item.number, item.code, item.sellerName, item.buyerName, item.itemName].join(' ').toLowerCase();
        if (haystack.indexOf(q) < 0) return false;
      }
      return true;
    });
    list.sort(function (a, b) {
      if (ledgerState.sort === 'amount_desc') return (Number(b.total) || 0) - (Number(a.total) || 0);
      if (ledgerState.sort === 'amount_asc') return (Number(a.total) || 0) - (Number(b.total) || 0);
      return String(b.date).localeCompare(String(a.date)) || String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
    });
    return list;
  }

  function statusCounts() {
    const counts = { all: 0, passed: 0, review: 0, risk: 0 };
    DB.invoices().forEach(function (item) {
      counts.all += 1;
      if (counts[item.status] != null) counts[item.status] += 1;
    });
    return counts;
  }

  function render(container, options) {
    const stats = IP.stats;
    const opts = options || {};
    const counts = statusCounts();
    const list = filteredInvoices();
    const totalPages = Math.max(1, Math.ceil(list.length / ledgerState.pageSize));
    if (ledgerState.page > totalPages) ledgerState.page = totalPages;
    const pageStart = (ledgerState.page - 1) * ledgerState.pageSize;
    const pageRows = list.slice(pageStart, pageStart + ledgerState.pageSize);
    const pageIds = pageRows.map(function (item) { return item.id; });
    const selectedVisible = pageIds.filter(function (id) { return ledgerState.selected.has(id); });
    const allChecked = pageIds.length > 0 && selectedVisible.length === pageIds.length;
    const total = stats.sum(list, 'total');
    const tax = stats.sum(list, 'taxAmount');
    const selectedCount = ledgerState.selected.size;

    const tabs = [
      { key: 'all', label: '全部发票', count: counts.all },
      { key: 'passed', label: '已通过', count: counts.passed },
      { key: 'review', label: '待复核', count: counts.review },
      { key: 'risk', label: '风险', count: counts.risk }
    ];

    container.innerHTML =
      '<section class="page ledger-page">' +
        '<div class="page-head">' +
          '<div><div class="page-kicker">发票归档与检索</div><h2>发票台账</h2><p>统一检索、核对与导出，所有数据仅保存在本机浏览器。</p></div>' +
          '<div class="page-head-actions">' +
            '<button class="btn btn-secondary btn-sm" type="button" id="exportFilteredBtn">' + icon('i-download') + '导出台账</button>' +
            '<a class="btn btn-primary btn-sm" href="#/verify">' + icon('i-plus') + '新建查验</a>' +
          '</div>' +
        '</div>' +
        '<div class="card ledger-card">' +
          '<div class="tab-bar">' + tabs.map(function (tab) {
            return '<button class="tab ' + (ledgerState.status === tab.key ? 'active' : '') + '" type="button" data-tab="' + tab.key + '">' + tab.label +
              '<span class="tab-count">' + tab.count + '</span></button>';
          }).join('') + '</div>' +
          '<div class="table-tools">' +
            '<div class="table-tools-left">' +
              '<div class="search-box wide">' + icon('i-search') +
                '<input class="input" id="ledgerSearch" type="search" placeholder="搜索发票号码、销售方、项目…" value="' + esc(ledgerState.q) + '">' +
              '</div>' +
              '<select class="select-sm" id="ledgerType" aria-label="按票种筛选">' +
                '<option value="all">全部票种</option>' +
                IP.TYPE_LIST.map(function (t) { return '<option value="' + t.key + '"' + (ledgerState.type === t.key ? ' selected' : '') + '>' + t.short + '</option>'; }).join('') +
              '</select>' +
              '<div class="date-range"><input class="date-input" type="date" id="ledgerFrom" value="' + ledgerState.from + '" aria-label="开始日期">' +
                '<span>至</span><input class="date-input" type="date" id="ledgerTo" value="' + ledgerState.to + '" aria-label="结束日期"></div>' +
            '</div>' +
            '<div class="table-tools-right">' +
              '<select class="select-sm" id="ledgerSort" aria-label="排序方式">' +
                '<option value="date_desc"' + (ledgerState.sort === 'date_desc' ? ' selected' : '') + '>按日期（新→旧）</option>' +
                '<option value="amount_desc"' + (ledgerState.sort === 'amount_desc' ? ' selected' : '') + '>按金额（高→低）</option>' +
                '<option value="amount_asc"' + (ledgerState.sort === 'amount_asc' ? ' selected' : '') + '>按金额（低→高）</option>' +
              '</select>' +
              '<button class="btn btn-ghost btn-sm" type="button" id="resetFiltersBtn">' + icon('i-filter') + '重置</button>' +
            '</div>' +
          '</div>' +
          '<div class="ledger-summary">' +
            '<div class="ledger-summary-item"><span>当前筛选</span><strong>' + list.length + ' 张</strong></div>' +
            '<div class="ledger-summary-item"><span>价税合计</span><strong class="accent">' + IP.moneySign(total) + '</strong></div>' +
            '<div class="ledger-summary-item"><span>税额合计</span><strong>' + IP.moneySign(tax) + '</strong></div>' +
            '<div class="ledger-summary-item"><span>平均单张</span><strong>' + IP.moneySign(list.length ? total / list.length : 0) + '</strong></div>' +
            '<div class="spacer"></div>' +
            (ledgerState.status !== 'all' || ledgerState.q || ledgerState.type !== 'all' || ledgerState.from || ledgerState.to
              ? '<span class="filter-hint">' + icon('i-filter') + '已应用筛选 <button type="button" id="clearFiltersInline">清除</button></span>' : '') +
          '</div>' +
          (selectedCount ? '<div class="bulk-bar">已选择 <strong>' + selectedCount + '</strong> 张发票' +
            '<span class="spacer"></span>' +
            '<button class="btn btn-secondary" type="button" id="exportSelectedBtn">导出所选</button>' +
            '<button class="btn btn-danger-soft" type="button" id="deleteSelectedBtn">删除所选</button>' +
            '<button class="btn btn-ghost" type="button" id="clearSelectedBtn">取消</button></div>' : '') +
          '<div class="table-wrap">' +
            '<table class="data-table">' +
              '<thead><tr>' +
                '<th class="th-check"><input class="row-check" type="checkbox" id="checkAll" aria-label="全选当前页"' + (allChecked ? ' checked' : '') + '></th>' +
                '<th>发票信息</th><th>销售方</th><th>开票日期</th><th>价税合计 / 税额</th><th>状态</th><th>操作</th>' +
              '</tr></thead>' +
              '<tbody>' + (pageRows.length ? pageRows.map(function (item) {
                const type = IP.getType(item.type);
                return '<tr data-row-id="' + item.id + '" class="' + (ledgerState.selected.has(item.id) ? 'is-selected' : '') + '">' +
                  '<td class="td-check"><input class="row-check" type="checkbox" data-check-id="' + item.id + '"' + (ledgerState.selected.has(item.id) ? ' checked' : '') + ' aria-label="选择发票 ' + esc(item.number) + '"></td>' +
                  '<td><div class="invoice-cell"><span class="invoice-icon">' + icon('i-receipt') + '</span>' +
                    '<span class="invoice-cell-text"><span class="cell-main">' + esc(item.number) + '</span><span class="cell-sub">' + IP.typeBadge(item.type) + (type.codeRequired ? ' ' + esc(item.code || '无代码') : '') + '</span></span></div></td>' +
                  '<td><div class="seller-cell"><div class="cell-main" title="' + esc(item.sellerName) + '">' + esc(item.sellerName || '—') + '</div><div class="cell-sub truncate" title="' + esc(item.itemName) + '">' + esc(item.itemName || '—') + '</div></div></td>' +
                  '<td class="cell-num">' + IP.formatDate(item.date) + '</td>' +
                  '<td><div class="cell-num cell-amount">' + IP.moneySign(item.total) + '</div><div class="cell-num cell-tax">税额 ' + IP.moneySign(item.taxAmount) + '</div></td>' +
                  '<td>' + IP.statusBadge(item.status) + '</td>' +
                  '<td class="td-actions"><div class="row-actions">' +
                    '<button class="icon-btn icon-btn-xs" type="button" data-view-id="' + item.id + '" title="查看详情">' + icon('i-eye') + '</button>' +
                    '<a class="icon-btn icon-btn-xs" href="#/verify/' + item.id + '" title="编辑发票">' + icon('i-edit') + '</a>' +
                    '<button class="icon-btn icon-btn-xs" type="button" data-delete-id="' + item.id + '" title="删除发票">' + icon('i-trash') + '</button>' +
                  '</div></td>' +
                '</tr>';
              }).join('') : '<tr class="empty-row"><td colspan="7"><div class="empty-state">' +
                '<div class="empty-illustration">' + icon('i-receipt') + '</div>' +
                '<h4>没有符合条件的发票</h4><p>调整筛选条件，或立即录入一张新发票。</p>' +
                '<div class="flex gap-8"><button class="btn btn-secondary btn-sm" type="button" id="emptyResetBtn">清除筛选</button><a class="btn btn-primary btn-sm" href="#/verify">新建查验</a></div>' +
              '</div></td></tr>') + '</tbody>' +
            '</table>' +
          '</div>' +
          '<div class="table-footer">' +
            '<span>共 <strong>' + list.length + '</strong> 张 · 第 ' + ledgerState.page + ' / ' + totalPages + ' 页</span>' +
            '<div class="pagination">' +
              '<button class="page-btn" type="button" data-page="' + (ledgerState.page - 1) + '"' + (ledgerState.page <= 1 ? ' disabled' : '') + ' aria-label="上一页">' + icon('i-chevron-left') + '</button>' +
              pageNumbers(ledgerState.page, totalPages).map(function (p) {
                if (p === '...') return '<span class="page-btn" style="pointer-events:none">…</span>';
                return '<button class="page-btn ' + (p === ledgerState.page ? 'active' : '') + '" type="button" data-page="' + p + '">' + p + '</button>';
              }).join('') +
              '<button class="page-btn" type="button" data-page="' + (ledgerState.page + 1) + '"' + (ledgerState.page >= totalPages ? ' disabled' : '') + ' aria-label="下一页">' + icon('i-chevron-right') + '</button>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</section>';

    bindLedger(container, opts);
    if (opts.focusSearch) {
      const input = $('#ledgerSearch');
      if (input) {
        input.focus();
        const len = input.value.length;
        try { input.setSelectionRange(len, len); } catch (err) { /* noop */ }
      }
    }
  }

  function pageNumbers(current, total) {
    if (total <= 5) {
      const arr = [];
      for (let i = 1; i <= total; i++) arr.push(i);
      return arr;
    }
    const pages = new Set([1, total, current, current - 1, current + 1]);
    const list = Array.from(pages).filter(function (p) { return p >= 1 && p <= total; }).sort(function (a, b) { return a - b; });
    const out = [];
    list.forEach(function (p, i) {
      if (i > 0 && p - list[i - 1] > 1) out.push('...');
      out.push(p);
    });
    return out;
  }

  function rerender(container, focus) {
    render(container, { focusSearch: !!focus });
  }

  function bindLedger(container, opts) {
    const debouncedSearch = IP.debounce(function (value) {
      ledgerState.q = value;
      ledgerState.page = 1;
      ledgerState.selected.clear();
      rerender(container, true);
    }, 320);
    const search = $('#ledgerSearch');
    if (search) {
      search.addEventListener('input', function () { debouncedSearch(search.value); });
    }
    const type = $('#ledgerType');
    if (type) type.addEventListener('change', function () {
      ledgerState.type = type.value;
      ledgerState.page = 1;
      ledgerState.selected.clear();
      rerender(container);
    });
    const from = $('#ledgerFrom');
    if (from) from.addEventListener('change', function () {
      ledgerState.from = from.value;
      ledgerState.page = 1;
      ledgerState.selected.clear();
      rerender(container);
    });
    const to = $('#ledgerTo');
    if (to) to.addEventListener('change', function () {
      ledgerState.to = to.value;
      ledgerState.page = 1;
      ledgerState.selected.clear();
      rerender(container);
    });
    const sort = $('#ledgerSort');
    if (sort) sort.addEventListener('change', function () {
      ledgerState.sort = sort.value;
      ledgerState.page = 1;
      rerender(container);
    });

    container.querySelectorAll('[data-tab]').forEach(function (tab) {
      tab.addEventListener('click', function () {
        ledgerState.status = tab.getAttribute('data-tab');
        ledgerState.page = 1;
        ledgerState.selected.clear();
        rerender(container);
      });
    });

    const reset = function () {
      ledgerState.q = '';
      ledgerState.type = 'all';
      ledgerState.status = 'all';
      ledgerState.from = '';
      ledgerState.to = '';
      ledgerState.sort = 'date_desc';
      ledgerState.page = 1;
      ledgerState.selected.clear();
      rerender(container);
    };
    ['resetFiltersBtn', 'clearFiltersInline', 'emptyResetBtn'].forEach(function (id) {
      const btn = $('#' + id);
      if (btn) btn.addEventListener('click', reset);
    });

    container.querySelectorAll('[data-page]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const page = Number(btn.getAttribute('data-page'));
        const list = filteredInvoices();
        const max = Math.max(1, Math.ceil(list.length / ledgerState.pageSize));
        if (page < 1 || page > max) return;
        ledgerState.page = page;
        rerender(container);
      });
    });

    const checkAll = $('#checkAll');
    if (checkAll) checkAll.addEventListener('change', function () {
      const list = filteredInvoices();
      const start = (ledgerState.page - 1) * ledgerState.pageSize;
      const current = list.slice(start, start + ledgerState.pageSize);
      current.forEach(function (item) {
        if (checkAll.checked) ledgerState.selected.add(item.id);
        else ledgerState.selected.delete(item.id);
      });
      rerender(container);
    });

    container.querySelectorAll('[data-check-id]').forEach(function (box) {
      box.addEventListener('change', function () {
        const id = box.getAttribute('data-check-id');
        if (box.checked) ledgerState.selected.add(id);
        else ledgerState.selected.delete(id);
        rerender(container);
      });
    });

    container.querySelectorAll('[data-row-id]').forEach(function (row) {
      row.addEventListener('click', function (event) {
        if (event.target.closest('input,button,a')) return;
        IP.router.openInvoice(row.getAttribute('data-row-id'));
      });
    });

    container.querySelectorAll('[data-view-id]').forEach(function (btn) {
      btn.addEventListener('click', function (event) {
        event.stopPropagation();
        IP.router.openInvoice(btn.getAttribute('data-view-id'));
      });
    });

    container.querySelectorAll('[data-delete-id]').forEach(function (btn) {
      btn.addEventListener('click', function (event) {
        event.stopPropagation();
        const id = btn.getAttribute('data-delete-id');
        const invoice = DB.invoices().find(function (item) { return item.id === id; });
        UI.confirm({
          title: '删除这张发票？',
          message: '「' + esc(invoice ? invoice.sellerName : '该发票') + '」将从台账、统计与风险中心同步移除，且不可恢复。',
          confirmText: '删除',
          tone: 'danger'
        }).then(function (ok) {
          if (!ok) return;
          try {
            DB.remove([id]);
            ledgerState.selected.delete(id);
            UI.toast('发票已删除');
            IP.router.refresh();
          } catch (err) {
            UI.toast(err.message || '删除失败', 'error');
          }
        });
      });
    });

    const clearSelected = $('#clearSelectedBtn');
    if (clearSelected) clearSelected.addEventListener('click', function () {
      ledgerState.selected.clear();
      rerender(container);
    });

    const exportFiltered = $('#exportFilteredBtn');
    if (exportFiltered) exportFiltered.addEventListener('click', function () {
      exportRows(filteredInvoices(), '发票台账');
    });
    const exportSelected = $('#exportSelectedBtn');
    if (exportSelected) exportSelected.addEventListener('click', function () {
      const rows = DB.invoices().filter(function (item) { return ledgerState.selected.has(item.id); });
      exportRows(rows, '选中发票');
    });
    const deleteSelected = $('#deleteSelectedBtn');
    if (deleteSelected) deleteSelected.addEventListener('click', function () {
      const ids = Array.from(ledgerState.selected);
      if (!ids.length) return;
      UI.confirm({
        title: '批量删除 ' + ids.length + ' 张发票？',
        message: '删除后不可恢复，相关统计与风险提示会同步更新。建议先导出备份。',
        confirmText: '确认删除',
        tone: 'danger'
      }).then(function (ok) {
        if (!ok) return;
        try {
          DB.remove(ids);
          ledgerState.selected.clear();
          UI.toast('已删除 ' + ids.length + ' 张发票');
          IP.router.refresh();
        } catch (err) {
          UI.toast(err.message || '删除失败', 'error');
        }
      });
    });
  }

  function exportRows(rows, label) {
    if (!rows.length) {
      UI.toast('当前没有可导出的发票', 'error');
      return;
    }
    const date = IP.todayISO();
    const csv = IP.toCSV(rows);
    IP.downloadFile(label + '_' + date + '.csv', csv, 'text/csv;charset=utf-8');
    UI.toast('已导出 ' + rows.length + ' 张发票为 CSV');
  }

  IP.views = IP.views || {};
  IP.views.ledger = render;

  /* ============================================================
     风险中心
     ============================================================ */
  function renderRisk(container) {
    const stats = IP.stats;
    const invoices = DB.invoices();
    const counts = stats.riskCounts(invoices);
    const flagged = invoices.filter(function (item) { return item.status !== 'passed'; })
      .sort(function (a, b) { return (a.riskScore || 100) - (b.riskScore || 100); });
    const health = invoices.length ? Math.round(invoices.reduce(function (sum, item) { return sum + (item.riskScore == null ? 100 : item.riskScore); }, 0) / invoices.length) : 100;
    const circumference = 2 * Math.PI * 38;
    const dash = (health / 100) * circumference;
    const highRisk = flagged.filter(function (item) { return item.status === 'risk'; });
    const review = flagged.filter(function (item) { return item.status === 'review'; });

    container.innerHTML =
      '<section class="page risk-page">' +
        '<div class="page-head"><div><div class="page-kicker">风险监控与复核</div><h2>风险中心</h2><p>集中处理重复报销、税号异常、金额勾稽与凭证时效问题。</p></div>' +
          '<div class="page-head-actions"><button class="btn btn-secondary btn-sm" type="button" id="revalidateBtn">' + icon('i-refresh') + '重新校验</button>' +
          '<a class="btn btn-primary btn-sm" href="#/verify">' + icon('i-plus') + '新建查验</a></div></div>' +
        '<div class="risk-hero">' +
          '<div class="risk-hero-score"><div class="risk-gauge">' +
            '<svg viewBox="0 0 94 94" width="94" height="94"><circle class="risk-gauge-bg" cx="47" cy="47" r="38"/>' +
            '<circle class="risk-gauge-fill" cx="47" cy="47" r="38" stroke-dasharray="' + dash.toFixed(1) + ' ' + circumference.toFixed(1) + '"/></svg>' +
            '<div class="risk-gauge-inner"><strong>' + health + '</strong><span>健康度</span></div></div>' +
            '<div class="risk-hero-copy"><h2>' + (flagged.length ? '有 ' + flagged.length + ' 张发票需要你关注' : '台账状态良好，暂无风险事项') + '</h2>' +
            '<p>' + (flagged.length ? '建议优先处理合规分较低的发票，核实票面与业务真实性后再完成报销。' : '所有已归档发票均通过本地基础校验，记得定期重新校验并导出备份。') + '</p></div>' +
          '</div>' +
          '<div class="risk-hero-stats">' +
            '<div class="risk-stat danger"><strong>' + counts.risk + '</strong><span>高风险</span></div>' +
            '<div class="risk-stat warn"><strong>' + counts.review + '</strong><span>待复核</span></div>' +
            '<div class="risk-stat pass"><strong>' + counts.passed + '</strong><span>已通过</span></div>' +
          '</div>' +
        '</div>' +
        '<div class="risk-layout">' +
          '<div>' +
            '<div class="section-head"><div><h3>风险清单</h3><p class="sub">按合规分升序排列 · 共 ' + flagged.length + ' 张</p></div>' +
              '<span class="chip ' + (highRisk.length ? 'chip-danger' : 'chip-pass') + '">' + (highRisk.length ? highRisk.length + ' 项高风险' : '暂无高风险') + '</span></div>' +
            '<div class="risk-list">' + (flagged.length ? flagged.map(function (item) {
              const danger = item.status === 'risk';
              const issues = (item.issues || []).slice(0, 3);
              return '<div class="risk-item" data-risk-id="' + item.id + '">' +
                '<span class="risk-item-icon ' + (danger ? 'is-danger' : '') + '">' + icon(danger ? 'i-shield-alert' : 'i-alert') + '</span>' +
                '<div class="risk-item-main">' +
                  '<div class="risk-item-top"><strong>' + esc(item.sellerName || '未知销售方') + '</strong>' + IP.statusBadge(item.status) + '<span class="chip">合规分 ' + (item.riskScore || 0) + '</span></div>' +
                  '<div class="risk-item-seller">' + esc(item.itemName || '—') + ' · 发票号码 ' + esc(item.number) + '</div>' +
                  '<div class="risk-item-issues">' + (issues.length ? issues.map(function (issue) {
                    return '<span class="chip ' + (issue.status === 'fail' ? 'chip-danger' : 'chip-warn') + '">' + esc(issue.label) + '</span>';
                  }).join('') : '<span class="chip chip-warn">需要人工复核</span>') + '</div>' +
                  '<div class="risk-item-meta"><span>' + icon('i-calendar') + ' ' + IP.formatDate(item.date) + '</span><span>' + icon('i-receipt') + ' ' + IP.typeBadge(item.type) + '</span></div>' +
                '</div>' +
                '<div class="risk-item-right"><strong>' + esc(IP.moneySign(item.total)) + '</strong><button class="btn btn-secondary" type="button" data-risk-open="' + item.id + '">' + (danger ? '去核实' : '查看') + icon('i-chevron-right') + '</button></div>' +
              '</div>';
            }).join('') : '<div class="card"><div class="empty-state"><div class="empty-illustration">' + icon('i-shield-check') + '</div><h4>暂未发现风险发票</h4><p>平台会持续根据税号、金额、重复与时效规则检查台账。新增发票后会自动更新。</p><a class="btn btn-primary btn-sm" href="#/verify">查验一张发票</a></div></div>') +
            '</div>' +
          '</div>' +
          '<aside class="risk-side">' +
            '<div class="card"><div class="section-head" style="padding:17px 18px 0;margin:0"><div><h3>校验维度</h3><p class="sub">本地规则如何判断风险</p></div></div>' +
              '<div class="rule-list">' +
                '<div class="rule-row"><span class="rule-icon">' + icon('i-shield-check') + '</span><div class="rule-text"><strong>税号合规</strong><span>依据 GB 32100 校验 18 位统一社会信用代码校验位。</span></div></div>' +
                '<div class="rule-row"><span class="rule-icon">' + icon('i-percent') + '</span><div class="rule-text"><strong>金额勾稽</strong><span>核对金额 × 税率 = 税额，以及金额 + 税额 = 价税合计。</span></div></div>' +
                '<div class="rule-row"><span class="rule-icon">' + icon('i-copy') + '</span><div class="rule-text"><strong>重复查验</strong><span>按发票代码与号码比对台账，识别重复报销风险。</span></div></div>' +
                '<div class="rule-row"><span class="rule-icon">' + icon('i-clock') + '</span><div class="rule-text"><strong>凭证时效</strong><span>超过 ' + DB.settings().expiryDays + ' 天未入账的发票会提示关注。</span></div></div>' +
              '</div>' +
            '</div>' +
            '<div class="notice notice-warn">' + icon('i-info') + '<span><strong>处理建议：</strong>高风险发票先与开票方或业务经办人核实，确认非重复报销、票面信息真实后再入账；必要时到税务平台完成官方查验。</span></div>' +
            '<div class="card"><div class="section-head" style="padding:17px 18px 0;margin:0"><h3>状态说明</h3></div><div class="rule-list">' +
              '<div class="rule-row"><span class="check-state fail" style="width:24px;height:24px">' + icon('i-x') + '</span><div class="rule-text"><strong>风险</strong><span>存在高严重度异常，建议暂缓报销。</span></div></div>' +
              '<div class="rule-row"><span class="check-state warn" style="width:24px;height:24px">' + icon('i-alert') + '</span><div class="rule-text"><strong>待复核</strong><span>存在提醒项，需要人工确认后归档。</span></div></div>' +
              '<div class="rule-row"><span class="check-state pass" style="width:24px;height:24px">' + icon('i-check') + '</span><div class="rule-text"><strong>已通过</strong><span>基础校验通过，可按常规流程入账。</span></div></div>' +
            '</div></div>' +
          '</aside>' +
        '</div>' +
      '</section>';

    container.onclick = function (event) {
      const open = event.target.closest('[data-risk-open]') || event.target.closest('[data-risk-id]');
      if (open) {
        const id = open.getAttribute('data-risk-open') || open.getAttribute('data-risk-id');
        if (id) IP.router.openInvoice(id);
        return;
      }
      const refreshBtn = event.target.closest('#revalidateBtn');
      if (refreshBtn) {
        try {
          DB.refreshAll(true);
          UI.toast('已按当前规则重新校验全部发票');
          IP.router.refresh();
        } catch (err) {
          UI.toast(err.message || '重新校验失败', 'error');
        }
      }
    };
  }

  IP.views.risk = renderRisk;
})(window);
