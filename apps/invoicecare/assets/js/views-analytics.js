/* 票清 · 统计分析、设置与数据管理 */
(function (global) {
  'use strict';

  const IP = global.IP;
  const DB = IP.DB;
  const UI = IP.UI;
  const $ = IP.$;
  const esc = IP.escapeHtml;
  const icon = IP.icon;

  let analyticsRange = '6m';

  /* ============================================================
     统计分析
     ============================================================ */
  function renderAnalytics(container) {
    const stats = IP.stats;
    const all = DB.invoices();
    const rows = stats.filterByRange(all, analyticsRange);
    const count = rows.length;
    const total = stats.sum(rows, 'total');
    const tax = stats.sum(rows, 'taxAmount');
    const deductible = rows.filter(function (item) {
      return item.type === 'vat_special' || item.type === 'digital_special';
    });
    const deductibleTax = stats.sum(deductible, 'taxAmount');
    const months = analyticsRange === '12m' || analyticsRange === 'all' ? 12 : 6;
    const monthly = stats.monthlySeries(rows, months);
    const types = stats.typeDistribution(rows);
    const sellers = stats.sellerTop(rows).slice(0, 5);
    const counts = stats.riskCounts(rows);
    const rates = stats.rateDistribution(rows);
    const maxSeller = sellers.length ? sellers[0].total : 1;
    const maxRateCount = rates.length ? Math.max.apply(null, rates.map(function (r) { return r.count; })) : 1;
    const topSeller = sellers[0];
    const topType = types[0];
    const rangeLabel = analyticsRange === '6m' ? '近 6 个月' : analyticsRange === '12m' ? '近 12 个月' : '全部时间';
    const typeColors = ['#145C4B', '#3E7E6C', '#7FA494', '#3B7088', '#8D7228', '#8A948F'];
    const donutItems = types.slice(0, 5).map(function (item, index) {
      return { label: item.label, value: item.count, color: typeColors[index] };
    });
    const donutTotal = types.reduce(function (s, item) { return s + item.count; }, 0);

    container.innerHTML =
      '<section class="page analytics-page">' +
        '<div class="page-head"><div><div class="page-kicker">经营分析与报表</div><h2>统计分析</h2><p>从金额、票种、销售方与风险结构四个维度，梳理本期发票数据。</p></div>' +
          '<div class="page-head-actions"><button class="btn btn-secondary btn-sm" type="button" id="analyticsExportBtn">' + icon('i-download') + '导出当前数据</button></div></div>' +
        '<div class="analytics-toolbar">' +
          '<div class="segmented">' +
            '<button type="button" data-range="6m" class="' + (analyticsRange === '6m' ? 'active' : '') + '">近 6 个月</button>' +
            '<button type="button" data-range="12m" class="' + (analyticsRange === '12m' ? 'active' : '') + '">近 12 个月</button>' +
            '<button type="button" data-range="all" class="' + (analyticsRange === 'all' ? 'active' : '') + '">全部时间</button>' +
          '</div>' +
          '<span class="text-xs muted-2">' + rangeLabel + ' · 共 ' + count + ' 张发票 · 数据截至 ' + IP.formatDate(IP.todayISO()) + '</span>' +
        '</div>' +
        '<div class="insight-strip">' + icon('i-file') +
          '<span><span class="insight-badge">本期摘要</span>' +
          (count
            ? '在' + rangeLabel + '内，你共收票 <strong>' + count + ' 张</strong>，价税合计 <strong>' + IP.moneySign(total) + '</strong>；' +
              (topSeller ? '开票金额最高的是<strong>' + esc(topSeller.name) + '</strong>（' + IP.moneySign(topSeller.total) + '，占 ' + Math.round((topSeller.total / (total || 1)) * 100) + '%）；' : '') +
              (topType ? '票种以<strong>' + esc(topType.label) + '</strong>为主；' : '') +
              '可抵扣进项税额约 <strong>' + IP.moneySign(deductibleTax) + '</strong>。'
            : '当前时间范围内还没有发票数据，录入后即可查看金额结构、销售方分布与风险占比。') +
          '</span></div>' +
        '<div class="kpi-grid analytics-kpis">' +
          '<div class="kpi-card"><div class="kpi-top"><span class="kpi-label">发票总数</span><span class="kpi-icon">' + icon('i-receipt') + '</span></div><div class="kpi-value">' + count + '<small>张</small></div><div class="kpi-bottom"><span class="kpi-note">' + rangeLabel + '</span><span class="kpi-note">专票 ' + deductible.length + ' 张</span></div></div>' +
          '<div class="kpi-card"><div class="kpi-top"><span class="kpi-label">价税合计</span><span class="kpi-icon blue">' + icon('i-wallet') + '</span></div><div class="kpi-value">¥' + IP.money(total) + '</div><div class="kpi-bottom"><span class="kpi-note">平均单张 ' + IP.moneySign(count ? total / count : 0) + '</span></div></div>' +
          '<div class="kpi-card"><div class="kpi-top"><span class="kpi-label">税额合计</span><span class="kpi-icon gold">' + icon('i-percent') + '</span></div><div class="kpi-value">¥' + IP.money(tax) + '</div><div class="kpi-bottom"><span class="kpi-note">综合税负 ' + (total ? ((tax / total) * 100).toFixed(2) : '0.00') + '%</span></div></div>' +
          '<div class="kpi-card"><div class="kpi-top"><span class="kpi-label">可抵扣进项税</span><span class="kpi-icon">' + icon('i-shield-check') + '</span></div><div class="kpi-value">¥' + IP.money(deductibleTax) + '</div><div class="kpi-bottom"><span class="kpi-note">来自 ' + deductible.length + ' 张专用发票</span></div></div>' +
        '</div>' +
        '<div class="analytics-grid">' +
          '<div class="card chart-card"><div class="dash-chart-head"><div><h3>月度发票金额</h3><p>不含税金额与税额的堆叠构成</p></div>' +
            '<div class="chart-legend"><span class="chart-legend-item"><span class="legend-dot" style="background:#b9e3d4"></span>不含税金额</span><span class="chart-legend-item"><span class="legend-dot" style="background:#0f8a6e"></span>税额</span></div></div>' +
            '<div class="dash-chart-body" id="analyticsBar" style="padding-top:14px"></div></div>' +
          '<div class="card chart-card"><div class="dash-chart-head"><div><h3>票种构成</h3><p>各票种张数占比</p></div></div>' +
            '<div class="donut-wrap"><div id="analyticsDonut"></div><div class="donut-legend">' + donutItems.map(function (item, index) {
              const pct = donutTotal ? Math.round((item.value / donutTotal) * 100) : 0;
              return '<div class="donut-legend-row"><span class="legend-dot" style="background:' + item.color + '"></span><span class="label">' + esc(item.label) + '</span><span class="count">' + item.value + ' 张</span><span class="pct">' + pct + '%</span></div>';
            }).join('') + '</div></div></div>' +
        '</div>' +
        '<div class="analytics-grid-3">' +
          '<div class="card"><div class="section-head" style="padding:18px 20px 0;margin:0"><div><h3>销售方 Top 5</h3><p class="sub">按价税合计排序</p></div></div>' +
            '<div class="hbar-list" style="padding-top:14px">' + (sellers.length ? sellers.map(function (seller) {
              return '<div class="hbar-row"><div class="hbar-top"><span class="label">' + esc(seller.name) + '</span><span class="value">' + IP.moneySign(seller.total) + '</span></div>' +
                '<div class="hbar-track"><div class="hbar-fill" style="width:' + ((seller.total / maxSeller) * 100).toFixed(1) + '%"></div></div>' +
                '<span class="hbar-sub">' + seller.count + ' 张发票</span></div>';
            }).join('') : '<div class="chart-empty" style="height:120px">暂无销售方数据</div>') + '</div></div>' +
          '<div class="card"><div class="section-head" style="padding:18px 20px 0;margin:0"><div><h3>风险结构</h3><p class="sub">按查验状态分布</p></div></div>' +
            '<div class="hbar-list" style="padding-top:14px">' +
              riskBar('已通过', counts.passed, count, '#0f8a6e') +
              riskBar('待复核', counts.review, count, '#c47a13') +
              riskBar('高风险', counts.risk, count, '#cf4a43') +
            '</div>' +
            '<div style="padding:0 20px 20px"><div class="notice notice-mint">' + icon('i-info') + '<span>整体通过率 ' + (count ? Math.round((counts.passed / count) * 100) : 100) + '%，风险发票建议尽快核实。</span></div></div></div>' +
          '<div class="card"><div class="section-head" style="padding:18px 20px 0;margin:0"><div><h3>税率分布</h3><p class="sub">按发票张数统计</p></div></div>' +
            '<div class="taxrate-grid">' + (rates.length ? rates.map(function (rate) {
              return '<div class="taxrate-item"><div class="rate-label"><span>税率 ' + IP.percent(rate.rate) + '</span><strong>' + rate.count + ' 张</strong></div>' +
                '<div class="rate-bar"><i style="width:' + ((rate.count / maxRateCount) * 100).toFixed(1) + '%"></i></div>' +
                '<div class="rate-amount">价税合计 ' + IP.moneySign(rate.total) + '</div></div>';
            }).join('') : '<div class="chart-empty" style="grid-column:span 2;height:100px">暂无税率数据</div>') + '</div></div>' +
        '</div>' +
      '</section>';

    function drawCharts() {
      IP.charts.renderBarChart($('#analyticsBar'), monthly.map(function (m) {
        return { label: m.label, amount: m.amount, tax: m.tax, fullLabel: m.key };
      }), { height: 272 });
      IP.charts.renderDonut($('#analyticsDonut'), donutItems, { height: 180, centerValue: donutTotal + ' 张', centerLabel: '发票总数' });
    }
    drawCharts();
    IP.router.setRecharts(drawCharts);

    container.querySelectorAll('[data-range]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        analyticsRange = btn.getAttribute('data-range');
        IP.router.refresh();
      });
    });
    const exportBtn = $('#analyticsExportBtn');
    if (exportBtn) exportBtn.addEventListener('click', function () {
      if (!rows.length) {
        UI.toast('当前时间范围没有可导出的发票', 'error');
        return;
      }
      IP.downloadFile('发票统计明细_' + IP.todayISO() + '.csv', IP.toCSV(rows), 'text/csv;charset=utf-8');
      UI.toast('已导出 ' + rows.length + ' 张发票明细');
    });
  }

  function riskBar(label, value, total, color) {
    const pct = total ? (value / total) * 100 : 0;
    return '<div class="hbar-row"><div class="hbar-top"><span class="label">' + label + '</span><span class="value">' + value + ' 张 · ' + Math.round(pct) + '%</span></div>' +
      '<div class="hbar-track"><div class="hbar-fill" style="width:' + pct.toFixed(1) + '%;background:' + color + '"></div></div></div>';
  }

  IP.views = IP.views || {};
  IP.views.analytics = renderAnalytics;

  /* ============================================================
     设置与数据
     ============================================================ */
  function renderSettings(container) {
    const settings = DB.settings();
    const invoices = DB.invoices();
    let size = 0;
    try { size = new Blob([JSON.stringify(DB.exportBackup())]).size; } catch (err) { size = 0; }
    const usagePct = Math.min(100, (size / (5 * 1024 * 1024)) * 100);
    const taxCheck = IP.validateTaxId(settings.buyerTaxId);
    const demoCount = invoices.filter(function (item) { return item.source === 'demo'; }).length;

    container.innerHTML =
      '<section class="page settings-page">' +
        '<div class="page-head"><div><div class="page-kicker">本地账户与数据</div><h2>设置与数据</h2><p>配置默认抬头与查验偏好，管理仅存储在本机的发票数据。</p></div></div>' +
        '<div class="settings-layout">' +
          '<div class="settings-main">' +
            '<div class="card settings-card">' +
              '<div class="settings-card-head"><span class="settings-icon">' + icon('i-building') + '</span><div><h3>默认购买方抬头</h3><p>新建查验时自动带入，用于核对发票抬头与税号一致性</p></div></div>' +
              '<div class="settings-body">' +
                '<div class="settings-form">' +
                  '<div class="field span-2"><label class="field-label" for="setBuyerName">购买方名称</label><input class="input" id="setBuyerName" maxlength="80" value="' + esc(settings.buyerName) + '" placeholder="公司或个人名称"></div>' +
                  '<div class="field span-2"><label class="field-label" for="setBuyerTaxId">纳税人识别号</label><input class="input input-num" id="setBuyerTaxId" maxlength="20" value="' + esc(settings.buyerTaxId) + '" placeholder="18 位统一社会信用代码">' +
                    '<span class="field-hint ' + (settings.buyerTaxId ? (taxCheck.valid ? 'is-ok' : 'is-error') : '') + '" id="setTaxHint">' + esc(taxCheck.message) + '。留空则不做抬头一致性校验。</span></div>' +
                '</div>' +
                '<div class="settings-actions"><button class="btn btn-primary btn-sm" type="button" id="saveProfileBtn">' + icon('i-save') + '保存抬头</button></div>' +
              '</div>' +
            '</div>' +

            '<div class="card settings-card">' +
              '<div class="settings-card-head"><span class="settings-icon">' + icon('i-sliders') + '</span><div><h3>查验偏好</h3><p>调整本地校验的严格程度与提醒阈值</p></div></div>' +
              '<div class="settings-body">' +
                '<div class="setting-row"><div class="setting-row-text"><strong>严格校验纳税人识别号</strong><p>开启后，税号校验位不匹配将计为高风险异常；关闭后仅作为一般提醒。</p></div>' +
                  '<div class="setting-row-control"><label class="switch"><input type="checkbox" id="setStrict" ' + (settings.strictTaxId ? 'checked' : '') + '><span class="switch-track"></span></label></div></div>' +
                '<div class="setting-row"><div class="setting-row-text"><strong>启用重复发票查验</strong><p>按发票代码与号码比对台账，识别重复报销风险。建议保持开启。</p></div>' +
                  '<div class="setting-row-control"><label class="switch"><input type="checkbox" id="setDuplicate" ' + (settings.duplicateCheck ? 'checked' : '') + '><span class="switch-track"></span></label></div></div>' +
                '<div class="setting-row"><div class="setting-row-text"><strong>凭证时效提醒</strong><p>发票距开票日期超过设定天数时，在查验报告中提示关注入账时效。</p></div>' +
                  '<div class="setting-row-control"><div class="inline-flex items-center gap-6"><input class="input input-num" type="number" min="30" max="3650" step="30" id="setExpiry" style="width:92px;height:36px" value="' + Number(settings.expiryDays) + '"><span class="text-xs muted-2">天</span></div></div></div>' +
                '<div class="setting-row"><div class="setting-row-text"><strong>默认税率</strong><p>新建发票时预选的税率，可按实际业务调整。</p></div>' +
                  '<div class="setting-row-control"><select class="select-sm" id="setRate">' + IP.TAX_RATES.map(function (rate) {
                    return '<option value="' + rate.value + '"' + (Number(settings.defaultTaxRate) === rate.value ? ' selected' : '') + '>' + rate.label + '</option>';
                  }).join('') + '</select></div></div>' +
                '<div class="settings-actions"><button class="btn btn-primary btn-sm" type="button" id="savePrefsBtn">' + icon('i-save') + '保存偏好</button></div>' +
              '</div>' +
            '</div>' +

            '<div class="card settings-card">' +
              '<div class="settings-card-head"><span class="settings-icon">' + icon('i-database') + '</span><div><h3>数据管理</h3><p>备份、迁移与清理本地发票数据</p></div></div>' +
              '<div class="settings-body">' +
                '<div class="data-list">' +
                  '<button class="data-action" type="button" id="backupBtn">' + icon('i-file-down') + '<span class="data-action-text"><strong>导出 JSON 备份</strong><span>完整保存发票、附件与设置，可用于迁移或恢复</span></span>' + icon('i-arrow-right', 'arrow') + '</button>' +
                  '<button class="data-action" type="button" id="importBtn">' + icon('i-upload-cloud') + '<span class="data-action-text"><strong>导入 JSON 备份</strong><span>导入后将替换当前台账，请先备份现有数据</span></span>' + icon('i-arrow-right', 'arrow') + '</button>' +
                  '<button class="data-action" type="button" id="csvBtn">' + icon('i-download') + '<span class="data-action-text"><strong>导出台账 CSV</strong><span>适合在 Excel / WPS 中继续分析，含全部票面字段</span></span>' + icon('i-arrow-right', 'arrow') + '</button>' +
                  '<button class="data-action" type="button" id="demoBtn">' + icon('i-refresh') + '<span class="data-action-text"><strong>重置为示例数据</strong><span>恢复 18 张演示发票，便于重新体验完整功能</span></span>' + icon('i-arrow-right', 'arrow') + '</button>' +
                  '<button class="data-action danger" type="button" id="clearAllBtn">' + icon('i-trash') + '<span class="data-action-text"><strong>清空全部数据</strong><span>删除所有发票与附件，操作不可撤销</span></span>' + icon('i-arrow-right', 'arrow') + '</button>' +
                '</div>' +
                '<div class="data-usage"><div class="data-usage-meta"><span>本地存储用量</span><strong>' + (size / 1024).toFixed(1) + ' KB / 约 5 MB</strong></div>' +
                  '<div class="progress-track"><div class="progress-fill" style="width:' + usagePct.toFixed(2) + '%;background:' + (usagePct > 80 ? 'var(--danger)' : 'linear-gradient(90deg,#57c5a4,#0f8a6e)') + '"></div></div>' +
                  '<p class="field-hint" style="margin-top:6px">发票图片会压缩后存储，若空间不足请先导出备份并清理附件。</p></div>' +
              '</div>' +
            '</div>' +
          '</div>' +

          '<aside class="settings-side">' +
            '<div class="card about-card">' +
              '<div class="about-logo"><img src="assets/img/logo.svg" alt="票清"><div><strong>票清 InvoiceCare</strong><span>发票合规管理平台 · v' + IP.APP_VERSION + '</span></div></div>' +
              '<p>面向个人与小微团队的本地发票合规管理工具，覆盖票面识别、规则校验、风险提示、台账归档与统计分析。全部数据保存在本机浏览器，无需服务器与网络连接。</p>' +
              '<div class="about-capabilities"><span>二维码识别</span><span>12 项规则</span><span>风险分级</span><span>本地存储</span></div>' +
              '<div class="about-meta"><div><span>当前台账</span><strong>' + invoices.length + ' 张</strong></div><div><span>示例数据</span><strong>' + demoCount + ' 张</strong></div><div><span>运行方式</span><strong>纯本地 · 无需联网</strong></div><div><span>数据存储</span><strong>浏览器 localStorage</strong></div></div>' +
            '</div>' +
            '<div class="card"><div class="section-head" style="padding:17px 18px 0;margin:0"><h3>使用提示</h3></div>' +
              '<div class="rule-list">' +
                '<div class="rule-row"><span class="rule-icon">' + icon('i-lock') + '</span><div class="rule-text"><strong>数据不出本机</strong><span>无后端、无账号体系，所有解析与存储均在浏览器完成。</span></div></div>' +
                '<div class="rule-row"><span class="rule-icon">' + icon('i-save') + '</span><div class="rule-text"><strong>定期备份</strong><span>清理浏览器缓存或更换设备前，请导出 JSON 备份。</span></div></div>' +
                '<div class="rule-row"><span class="rule-icon">' + icon('i-external') + '</span><div class="rule-text"><strong>官方查验</strong><span>本地规则不替代税务机关查验，<a class="text-link" href="https://inv-veri.chinatax.gov.cn/" target="_blank" rel="noopener">前往官方平台</a>。</span></div></div>' +
              '</div>' +
            '</div>' +
            '<div class="notice notice-warn">' + icon('i-info') + '<span><strong>合规声明：</strong>本平台不提供发票真伪鉴定服务，查验结论仅基于本地规则，不具有法律效力；正式入账前请以税务机关官方查验结果为准。</span></div>' +
          '</aside>' +
        '</div>' +
      '</section>';

    bindSettings(container);
  }

  function bindSettings(container) {
    const taxInput = $('#setBuyerTaxId');
    if (taxInput) {
      taxInput.addEventListener('input', function () {
        const hint = $('#setTaxHint');
        if (!taxInput.value) {
          hint.className = 'field-hint';
          hint.textContent = '留空则不做抬头一致性校验。';
          return;
        }
        const check = IP.validateTaxId(taxInput.value);
        hint.className = 'field-hint ' + (check.valid ? 'is-ok' : 'is-error');
        hint.textContent = check.message;
      });
    }

    const saveProfile = $('#saveProfileBtn');
    if (saveProfile) saveProfile.addEventListener('click', function () {
      const name = $('#setBuyerName').value.trim();
      const taxId = $('#setBuyerTaxId').value.trim().toUpperCase();
      const check = taxId ? IP.validateTaxId(taxId) : { valid: true };
      const apply = function () {
        try {
          DB.saveSettings({ buyerName: name, buyerTaxId: taxId });
          UI.toast('默认抬头已保存，历史发票状态已同步更新');
          IP.router.refresh();
        } catch (err) {
          UI.toast(err.message || '保存失败', 'error');
        }
      };
      if (taxId && !check.valid) {
        UI.confirm({
          title: '税号校验未通过',
          message: esc(check.message) + '。仍要保存这个纳税人识别号吗？',
          confirmText: '仍然保存',
          tone: 'danger'
        }).then(function (ok) { if (ok) apply(); });
      } else {
        apply();
      }
    });

    const savePrefs = $('#savePrefsBtn');
    if (savePrefs) savePrefs.addEventListener('click', function () {
      const expiry = Number($('#setExpiry').value);
      if (!isFinite(expiry) || expiry < 30 || expiry > 3650) {
        UI.toast('时效提醒天数需在 30–3650 之间', 'error');
        return;
      }
      try {
        DB.saveSettings({
          strictTaxId: $('#setStrict').checked,
          duplicateCheck: $('#setDuplicate').checked,
          expiryDays: Math.round(expiry),
          defaultTaxRate: Number($('#setRate').value)
        });
        UI.toast('查验偏好已保存，规则已重新应用');
        IP.router.refresh();
      } catch (err) {
        UI.toast(err.message || '保存失败', 'error');
      }
    });

    const backup = $('#backupBtn');
    if (backup) backup.addEventListener('click', function () {
      const payload = JSON.stringify(DB.exportBackup(), null, 2);
      IP.downloadFile('票清备份_' + IP.todayISO() + '.json', payload, 'application/json;charset=utf-8');
      UI.toast('JSON 备份已导出，请妥善保存');
    });

    const importBtn = $('#importBtn');
    if (importBtn) importBtn.addEventListener('click', function () {
      const input = $('#importInput');
      if (input) {
        input.value = '';
        input.click();
      }
    });
    const importInput = $('#importInput');
    if (importInput && !importInput.dataset.bound) {
      importInput.dataset.bound = '1';
      importInput.addEventListener('change', function () {
        const file = importInput.files && importInput.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = function () {
          UI.confirm({
            title: '导入备份并替换当前数据？',
            message: '当前台账中的 ' + DB.invoices().length + ' 张发票将被备份文件替换。建议先导出当前数据。',
            confirmText: '导入并替换',
            tone: 'danger'
          }).then(function (ok) {
            if (!ok) return;
            try {
              const count = DB.importBackup(reader.result);
              UI.toast('导入成功，共恢复 ' + count + ' 张发票');
              IP.router.navigate('#/ledger');
              IP.router.refresh();
            } catch (err) {
              UI.toast(err.message || '导入失败，请检查文件格式', 'error', 5000);
            }
          });
        };
        reader.readAsText(file, 'utf-8');
      });
    }

    const csv = $('#csvBtn');
    if (csv) csv.addEventListener('click', function () {
      if (!DB.invoices().length) {
        UI.toast('当前台账没有可导出的发票', 'error');
        return;
      }
      IP.downloadFile('发票台账_' + IP.todayISO() + '.csv', IP.toCSV(DB.invoices()), 'text/csv;charset=utf-8');
      UI.toast('已导出 ' + DB.invoices().length + ' 张发票');
    });

    const demo = $('#demoBtn');
    if (demo) demo.addEventListener('click', function () {
      UI.confirm({
        title: '重置为示例数据？',
        message: '当前台账中的所有发票将被 18 张示例发票替换，适合重新体验完整流程。',
        confirmText: '重置示例',
        tone: 'danger'
      }).then(function (ok) {
        if (!ok) return;
        try {
          DB.resetDemo();
          UI.toast('已恢复示例数据');
          IP.router.refresh();
        } catch (err) {
          UI.toast(err.message || '重置失败', 'error');
        }
      });
    });

    const clear = $('#clearAllBtn');
    if (clear) clear.addEventListener('click', function () {
      UI.confirm({
        title: '清空全部发票数据？',
        message: '所有发票、附件和查验记录都会被删除，且无法恢复。建议先导出 JSON 备份。',
        confirmText: '继续',
        tone: 'danger'
      }).then(function (ok) {
        if (!ok) return;
        UI.confirm({
          title: '再次确认',
          message: '这是不可撤销的操作。确定要从空白台账开始吗？',
          confirmText: '确认清空',
          tone: 'danger'
        }).then(function (ok2) {
          if (!ok2) return;
          try {
            DB.clearAll();
            UI.toast('本地数据已清空');
            IP.router.navigate('#/dashboard');
            IP.router.refresh();
          } catch (err) {
            UI.toast(err.message || '清空失败', 'error');
          }
        });
      });
    });
  }

  IP.views.settings = renderSettings;
})(window);
