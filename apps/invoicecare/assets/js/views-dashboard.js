/* 票清 · 工作台视图 */
(function (global) {
  'use strict';

  const IP = global.IP;
  const DB = IP.DB;
  const UI = IP.UI;
  const $ = IP.$;
  const esc = IP.escapeHtml;
  const icon = IP.icon;

  function render(container) {
    const stats = IP.stats;
    const invoices = DB.invoices();
    const settings = DB.settings();
    const thisMonth = stats.monthInvoices(invoices, 0);
    const lastMonth = stats.monthInvoices(invoices, 1);
    const thisTotal = stats.sum(thisMonth, 'total');
    const prevTotal = stats.sum(lastMonth, 'total');
    const thisTax = stats.sum(thisMonth, 'taxAmount');
    const deductible = thisMonth.filter(function (item) {
      return item.type === 'vat_special' || item.type === 'digital_special';
    });
    const deductibleTax = stats.sum(deductible, 'taxAmount');
    const counts = stats.riskCounts(invoices);
    const alerts = counts.review + counts.risk;
    const compliance = invoices.length ? Math.round((counts.passed / invoices.length) * 100) : 100;
    const monthly = stats.monthlySeries(invoices, 6);
    const types = stats.typeDistribution(invoices);
    const recent = invoices.slice().sort(function (a, b) {
      return String(b.date).localeCompare(String(a.date)) || String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
    }).slice(0, 6);
    const flagged = invoices.filter(function (item) { return item.status !== 'passed'; })
      .sort(function (a, b) { return (a.riskScore || 100) - (b.riskScore || 100); }).slice(0, 3);
    const showDemo = invoices.some(function (item) { return item.source === 'demo'; }) && !settings.demoNoticeDismissed;
    const countDelta = stats.percentChange(thisMonth.length, lastMonth.length);
    const totalDelta = stats.percentChange(thisTotal, prevTotal);
    const deductionDelta = stats.percentChange(deductibleTax, stats.sum(lastMonth.filter(function (item) {
      return item.type === 'vat_special' || item.type === 'digital_special';
    }), 'taxAmount'));

    const typeColors = ['#145C4B', '#3E7E6C', '#7FA494', '#3B7088', '#8D7228', '#8A948F'];
    const donutItems = types.slice(0, 5).map(function (item, index) {
      return { label: item.label, value: item.count, color: typeColors[index] };
    });
    const donutTotal = types.reduce(function (sum, item) { return sum + item.count; }, 0);

    const specialInvoices = invoices.filter(function (item) {
      return item.type === 'vat_special' || item.type === 'digital_special';
    });
    const specialMonthly = stats.monthlySeries(specialInvoices, 6);
    const riskMonthly = stats.monthlySeries(invoices.filter(function (item) { return item.status !== 'passed'; }), 6);
    const sparkCounts = monthly.map(function (item) { return item.count; });
    const sparkTotals = monthly.map(function (item) { return item.total; });
    const sparkTax = specialMonthly.map(function (item) { return item.tax; });
    const sparkAlerts = riskMonthly.map(function (item) { return item.count; });

    const ruleOrder = ['required', 'code', 'number', 'date', 'buyerName', 'buyerTaxId', 'sellerTaxId', 'taxMath', 'totalMath', 'checkCode', 'duplicate', 'large'];
    const ruleMap = {};
    invoices.forEach(function (item) {
      const report = IP.evaluateInvoice(item, { invoices: invoices, settings: settings, selfId: item.id });
      report.checks.forEach(function (check) {
        if (!ruleMap[check.key]) {
          ruleMap[check.key] = { key: check.key, label: check.label, pass: 0, warn: 0, fail: 0, total: 0 };
        }
        if (check.status === 'pass') ruleMap[check.key].pass += 1;
        else if (check.status === 'warn') ruleMap[check.key].warn += 1;
        else ruleMap[check.key].fail += 1;
        ruleMap[check.key].total += 1;
      });
    });
    const ruleCoverage = ruleOrder.map(function (key) { return ruleMap[key]; }).filter(Boolean);
    const ruleTotals = ruleCoverage.reduce(function (acc, item) {
      acc.pass += item.pass;
      acc.warn += item.warn;
      acc.fail += item.fail;
      acc.total += item.total;
      return acc;
    }, { pass: 0, warn: 0, fail: 0, total: 0 });
    const rulePassPct = ruleTotals.total ? Math.round((ruleTotals.pass / ruleTotals.total) * 100) : 0;
    const sellers = stats.sellerTop(invoices).slice(0, 5);
    const sellerTotalAmount = invoices.reduce(function (sum, item) { return sum + (Number(item.total) || 0); }, 0);
    const maxSellerAmount = sellers.length ? Number(sellers[0].total) || 1 : 1;
    const topSellerAmount = sellers.reduce(function (sum, item) { return sum + (Number(item.total) || 0); }, 0);
    const topSellerShare = sellerTotalAmount ? (topSellerAmount / sellerTotalAmount) * 100 : 0;

    const statusTone = counts.risk ? 'danger' : counts.review ? 'warn' : invoices.length ? 'pass' : 'neutral';
    const statusChip = counts.risk ? '需处理' : counts.review ? '待复核' : invoices.length ? '正常' : '暂无数据';
    const statusTitle = counts.risk
      ? '台账存在需要关注的风险事项'
      : counts.review
        ? '台账基本合规，仍有事项待复核'
        : invoices.length
          ? '台账合规状态良好'
          : '台账尚无发票数据';
    const statusCopy = invoices.length
      ? '共 ' + invoices.length + ' 张发票，' + counts.passed + ' 张通过本地规则校验，' + counts.review + ' 张待复核，' + counts.risk + ' 张存在风险。'
      : '完成首次查验后，这里会汇总通过、待复核与风险发票的数量和比例。';
    const statusIcon = statusTone === 'danger' ? 'i-shield-alert' : statusTone === 'warn' ? 'i-alert' : 'i-shield-check';
    const passPct = invoices.length ? (counts.passed / invoices.length) * 100 : 0;
    const reviewPct = invoices.length ? (counts.review / invoices.length) * 100 : 0;
    const riskPct = invoices.length ? (counts.risk / invoices.length) * 100 : 0;
    const now = new Date();
    const monthStamp = now.getFullYear() + ' 年 ' + (now.getMonth() + 1) + ' 月';

    container.innerHTML =
      '<section class="page dashboard-page">' +
        '<div class="page-head">' +
          '<div><div class="page-kicker">运营概览 · ' + monthStamp + '</div>' +
            '<h2>发票合规概览</h2>' +
            '<p>汇总本月收票、校验状态与风险事项，所有数据均保存在本机浏览器。</p></div>' +
          '<div class="page-head-actions">' +
            '<a class="btn btn-secondary btn-sm" href="#/ledger">' + icon('i-list') + '发票台账</a>' +
            '<a class="btn btn-primary btn-sm" href="#/verify">' + icon('i-plus') + '新建查验</a>' +
          '</div>' +
        '</div>' +
        (showDemo
          ? '<div class="demo-banner" id="demoBanner">' + icon('i-info') +
              '<span><strong>当前为示例数据</strong>，可直接体验查验、台账与统计功能；正式使用时建议清空后录入自己的发票。</span>' +
              '<button class="btn btn-ghost btn-sm" type="button" id="clearDemoBtn">清空示例</button>' +
              '<button class="icon-btn icon-btn-xs" type="button" id="dismissDemoBtn" aria-label="关闭提示">' + icon('i-x') + '</button>' +
            '</div>'
          : '') +
        '<div class="status-band">' +
          '<span class="status-band-icon ' + statusTone + '">' + icon(statusIcon) + '</span>' +
          '<div class="status-band-main">' +
            '<div class="status-band-title"><h3>' + statusTitle + '</h3><span class="status status-' + (statusTone === 'neutral' ? 'neutral' : statusTone) + '"><span class="status-dot"></span>' + statusChip + '</span></div>' +
            '<p>' + statusCopy + '</p>' +
          '</div>' +
          '<div class="status-band-meter">' +
            '<div class="status-band-meter-top"><span>台账合规率</span><strong>' + (invoices.length ? compliance + '<small>%</small>' : '—') + '</strong></div>' +
            '<div class="status-band-bar">' +
              '<i class="is-pass" style="width:' + passPct.toFixed(1) + '%"></i>' +
              '<i class="is-review" style="width:' + reviewPct.toFixed(1) + '%"></i>' +
              '<i class="is-risk" style="width:' + riskPct.toFixed(1) + '%"></i>' +
            '</div>' +
            '<div class="status-band-legend">' +
              '<span><i class="is-pass"></i>已通过 <strong>' + counts.passed + '</strong></span>' +
              '<span><i class="is-review"></i>待复核 <strong>' + counts.review + '</strong></span>' +
              '<span><i class="is-risk"></i>风险 <strong>' + counts.risk + '</strong></span>' +
            '</div>' +
          '</div>' +
          '<a class="btn btn-secondary btn-sm status-band-link" href="#/risk">风险明细' + icon('i-chevron-right') + '</a>' +
        '</div>' +

        '<div class="kpi-grid dash-kpis">' +
          '<div class="kpi-card">' +
            '<div class="kpi-top"><span class="kpi-label">本月发票</span><span class="kpi-icon">' + icon('i-receipt') + '</span></div>' +
            '<div class="kpi-value">' + thisMonth.length + '<small>张</small></div>' +
            '<div class="kpi-bottom"><span class="kpi-delta ' + (countDelta.dir === 'down' ? 'down' : countDelta.dir === 'flat' ? 'flat' : '') + '">' +
              (countDelta.dir === 'up' ? icon('i-trending-up') : countDelta.dir === 'down' ? icon('i-trending-down') : '') + countDelta.text + '</span>' +
              '<span class="kpi-note">台账共 ' + invoices.length + ' 张</span></div>' +
            '<div class="kpi-spark">' + IP.charts.sparkline(sparkCounts, '#145C4B', 120, 30) + '</div>' +
          '</div>' +
          '<div class="kpi-card">' +
            '<div class="kpi-top"><span class="kpi-label">本月价税合计</span><span class="kpi-icon blue">' + icon('i-wallet') + '</span></div>' +
            '<div class="kpi-value">¥' + IP.money(thisTotal) + '</div>' +
            '<div class="kpi-bottom"><span class="kpi-delta ' + (totalDelta.dir === 'down' ? 'down' : totalDelta.dir === 'flat' ? 'flat' : '') + '">' +
              (totalDelta.dir === 'up' ? icon('i-trending-up') : totalDelta.dir === 'down' ? icon('i-trending-down') : '') + totalDelta.text + '</span>' +
              '<span class="kpi-note">平均单张 ' + IP.moneySign(thisMonth.length ? thisTotal / thisMonth.length : 0) + '</span></div>' +
            '<div class="kpi-spark">' + IP.charts.sparkline(sparkTotals, '#336C83', 120, 30) + '</div>' +
          '</div>' +
          '<div class="kpi-card">' +
            '<div class="kpi-top"><span class="kpi-label">本月可抵扣税额</span><span class="kpi-icon">' + icon('i-percent') + '</span></div>' +
            '<div class="kpi-value">¥' + IP.money(deductibleTax) + '</div>' +
            '<div class="kpi-bottom"><span class="kpi-delta ' + (deductionDelta.dir === 'down' ? 'down' : deductionDelta.dir === 'flat' ? 'flat' : '') + '">' +
              (deductionDelta.dir === 'up' ? icon('i-trending-up') : deductionDelta.dir === 'down' ? icon('i-trending-down') : '') + deductionDelta.text + '</span>' +
              '<span class="kpi-note">来自 ' + deductible.length + ' 张专票</span></div>' +
            '<div class="kpi-spark">' + IP.charts.sparkline(sparkTax, '#8D7228', 120, 30) + '</div>' +
          '</div>' +
          '<div class="kpi-card">' +
            '<div class="kpi-top"><span class="kpi-label">待处理风险</span><span class="kpi-icon warn">' + icon('i-shield-alert') + '</span></div>' +
            '<div class="kpi-value">' + alerts + '<small>项</small></div>' +
            '<div class="kpi-bottom"><span class="chip ' + (counts.risk ? 'chip-danger' : 'chip-pass') + '">' + (counts.risk ? counts.risk + ' 项高风险' : '暂无高风险') + '</span>' +
              '<span class="kpi-note">待复核 ' + counts.review + ' 张</span></div>' +
            '<div class="kpi-spark">' + IP.charts.sparkline(sparkAlerts, '#AD3A32', 120, 30) + '</div>' +
          '</div>' +
        '</div>' +

        '<div class="dash-grid">' +
          '<div class="card chart-card">' +
            '<div class="dash-chart-head"><div><h3>近 6 个月发票金额</h3><p>按月汇总价税合计，反映收票金额变化</p></div>' +
              '<div class="chart-total"><strong>¥' + IP.money(monthly.reduce(function (s, m) { return s + m.total; }, 0)) + '</strong><span>累计价税合计</span></div></div>' +
            '<div class="dash-chart-body" id="trendChart"></div>' +
          '</div>' +
          '<div class="card chart-card">' +
            '<div class="dash-chart-head"><div><h3>票种结构</h3><p>按发票类型统计张数与占比</p></div><a class="text-link" href="#/analytics">查看统计' + icon('i-chevron-right') + '</a></div>' +
            '<div class="donut-wrap"><div id="typeChart"></div>' +
              '<div class="donut-legend">' + donutItems.map(function (item) {
                const pct = donutTotal ? Math.round((item.value / donutTotal) * 100) : 0;
                return '<div class="donut-legend-row"><span class="legend-dot" style="background:' + item.color + '"></span><span class="label">' + esc(item.label) + '</span><span class="count">' + item.value + ' 张</span><span class="pct">' + pct + '%</span></div>';
              }).join('') + '</div>' +
            '</div>' +
          '</div>' +
        '</div>' +

        '<div class="dash-insight-grid">' +
          '<div class="card">' +
            '<div class="dash-card-head">' +
              '<div class="dash-card-title"><span class="dash-card-icon">' + icon('i-shield-check') + '</span><div><h3>合规检查覆盖</h3><p>12 项本地规则 · 覆盖 ' + invoices.length + ' 张发票</p></div></div>' +
              '<button class="text-link" type="button" id="ruleHelpBtn">规则说明</button>' +
            '</div>' +
            (ruleCoverage.length
              ? '<div class="rule-cover-grid">' + ruleCoverage.map(function (item) {
                  const rate = item.total ? Math.round((item.pass / item.total) * 100) : 0;
                  const state = item.fail ? 'is-fail' : item.warn ? 'is-warn' : 'is-pass';
                  return '<div class="rule-cover-item" title="' + esc(item.label) + '：通过 ' + item.pass + '，提醒 ' + item.warn + '，异常 ' + item.fail + '">' +
                    '<span class="rule-cover-state ' + state + '">' + icon(item.fail || item.warn ? 'i-alert' : 'i-check') + '</span>' +
                    '<div class="rule-cover-main">' +
                      '<div class="rule-cover-top"><span>' + esc(item.label) + '</span><span class="rule-cover-rate">' + item.pass + '/' + item.total + ' · ' + rate + '%</span></div>' +
                      '<div class="rule-cover-track"><i class="' + state + '" style="width:' + rate + '%"></i></div>' +
                    '</div>' +
                  '</div>';
                }).join('') + '</div>' +
                '<div class="rule-cover-foot"><span>共执行 <strong>' + ruleTotals.total + '</strong> 次规则检查</span><span>平均通过率 <strong>' + rulePassPct + '%</strong></span><span>异常 <strong>' + ruleTotals.fail + '</strong> 项</span></div>'
              : '<div class="empty-state" style="padding:30px 20px"><p>完成首次查验后，这里会显示 12 项规则的覆盖情况。</p></div>') +
          '</div>' +
          '<div class="card">' +
            '<div class="dash-card-head">' +
              '<div class="dash-card-title"><span class="dash-card-icon gold">' + icon('i-building') + '</span><div><h3>销售方集中度</h3><p>按价税合计排序 · Top 5</p></div></div>' +
              '<a class="text-link" href="#/analytics">更多统计' + icon('i-chevron-right') + '</a>' +
            '</div>' +
            '<div class="seller-top-list">' + (sellers.length ? sellers.map(function (item, index) {
              const share = sellerTotalAmount ? (item.total / sellerTotalAmount) * 100 : 0;
              const width = maxSellerAmount ? (item.total / maxSellerAmount) * 100 : 0;
              return '<div class="seller-top-row">' +
                '<span class="seller-rank">' + String(index + 1).padStart(2, '0') + '</span>' +
                '<div class="seller-top-main">' +
                  '<div class="seller-top-line"><strong title="' + esc(item.name) + '">' + esc(item.name) + '</strong><span>' + IP.moneySign(item.total) + '</span></div>' +
                  '<div class="seller-top-track"><i style="width:' + width.toFixed(1) + '%"></i></div>' +
                  '<div class="seller-top-foot"><span>' + item.count + ' 张发票</span><span>占 ' + share.toFixed(1) + '%</span></div>' +
                '</div>' +
              '</div>';
            }).join('') : '<div class="empty-state" style="padding:30px 10px"><p>台账中还没有销售方数据</p></div>') + '</div>' +
            (sellers.length ? '<div class="seller-top-summary"><span>Top 5 合计 <strong>' + IP.moneySign(topSellerAmount) + '</strong></span><span>占台账金额 <strong>' + topSellerShare.toFixed(1) + '%</strong></span></div>' : '') +
          '</div>' +
        '</div>' +

        '<div class="dash-grid-equal">' +
          '<div class="card">' +
            '<div class="section-head" style="padding:17px 19px 9px;margin:0"><div><h3>最近发票</h3><p class="sub">按开票日期倒序展示</p></div><a class="text-link" href="#/ledger">全部台账' + icon('i-arrow-right') + '</a></div>' +
            '<div class="recent-list">' + (recent.length ? recent.map(function (item) {
              return '<button class="recent-row" type="button" data-invoice-id="' + item.id + '">' +
                '<span class="invoice-icon">' + icon('i-receipt') + '</span>' +
                '<span class="recent-main"><strong>' + esc(item.sellerName || '未知销售方') + '</strong><span>' + IP.typeBadge(item.type) + '<span>' + esc(item.number) + ' · ' + IP.formatDate(item.date) + '</span></span></span>' +
                '<span class="recent-amount"><strong>' + IP.moneySign(item.total) + '</strong><span>' + IP.statusBadge(item.status) + '</span></span>' +
              '</button>';
            }).join('') : '<div class="empty-state" style="padding:36px"><p>还没有发票，先查验一张吧</p><a class="btn btn-primary btn-sm" href="#/verify">新建查验</a></div>') + '</div>' +
          '</div>' +
          '<div style="display:flex;flex-direction:column;gap:14px">' +
            '<div class="card">' +
              '<div class="section-head" style="padding:17px 19px 9px;margin:0"><div><h3>风险待办</h3><p class="sub">按合规分从低到高</p></div><a class="text-link" href="#/risk">风险中心' + icon('i-arrow-right') + '</a></div>' +
              '<div class="risk-mini">' + (flagged.length ? flagged.map(function (item) {
                const danger = item.status === 'risk';
                return '<button class="risk-mini-row" type="button" data-invoice-id="' + item.id + '" style="width:100%;text-align:left">' +
                  '<span class="risk-mini-icon ' + (danger ? 'is-danger' : '') + '">' + icon(danger ? 'i-shield-alert' : 'i-alert') + '</span>' +
                  '<span class="risk-mini-main"><strong>' + esc(item.sellerName || '未知销售方') + '</strong><span>' + esc(item.issues && item.issues[0] ? item.issues[0].label : '需要人工复核') + '</span></span>' +
                  '<span class="risk-mini-amount">' + IP.moneySign(item.total) + '</span>' +
                '</button>';
              }).join('') : '<div class="empty-state" style="padding:28px 20px"><div class="empty-illustration" style="width:52px;height:52px;margin-bottom:9px">' + icon('i-shield-check') + '</div><p>台账状态良好，暂无待处理风险</p></div>') + '</div>' +
            '</div>' +
            '<div class="card">' +
              '<div class="section-head" style="padding:17px 19px 0;margin:0"><h3>常用操作</h3></div>' +
              '<div class="quick-list">' +
                '<a class="quick-link" href="#/verify"><span class="quick-icon">' + icon('i-scan') + '</span><span class="quick-copy"><strong>新建查验</strong><span>识别或录入一张发票</span></span>' + icon('i-chevron-right', 'quick-arrow') + '</a>' +
                '<a class="quick-link" href="#/analytics"><span class="quick-icon">' + icon('i-chart') + '</span><span class="quick-copy"><strong>统计分析</strong><span>查看本期金额与结构</span></span>' + icon('i-chevron-right', 'quick-arrow') + '</a>' +
                '<a class="quick-link" href="#/settings"><span class="quick-icon">' + icon('i-database') + '</span><span class="quick-copy"><strong>数据备份</strong><span>导出本地台账与设置</span></span>' + icon('i-chevron-right', 'quick-arrow') + '</a>' +
                '<a class="quick-link" href="#/risk"><span class="quick-icon">' + icon('i-shield-alert') + '</span><span class="quick-copy"><strong>风险复核</strong><span>处理异常与待复核发票</span></span>' + icon('i-chevron-right', 'quick-arrow') + '</a>' +
              '</div>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</section>';

    function drawCharts() {
      IP.charts.renderAreaChart($('#trendChart'), monthly.map(function (m) {
        return { label: m.label, value: m.total, fullLabel: m.key };
      }), { color: '#145C4B', height: 254 });
      IP.charts.renderDonut($('#typeChart'), donutItems, {
        height: 172,
        centerValue: donutTotal + ' 张',
        centerLabel: '发票总数'
      });
    }
    drawCharts();
    IP.router.setRecharts(drawCharts);

    container.onclick = function (event) {
      const row = event.target.closest('[data-invoice-id]');
      if (row) {
        IP.router.openInvoice(row.getAttribute('data-invoice-id'));
        return;
      }
      const ruleHelp = event.target.closest('#ruleHelpBtn');
      if (ruleHelp) {
        IP.verify.showRules();
        return;
      }
      const dismiss = event.target.closest('#dismissDemoBtn');
      if (dismiss) {
        DB.saveSettings({ demoNoticeDismissed: true });
        const banner = $('#demoBanner');
        if (banner) banner.remove();
        return;
      }
      const clear = event.target.closest('#clearDemoBtn');
      if (clear) {
        UI.confirm({
          title: '清空示例数据？',
          message: '台账中的示例发票将被删除，你可以立即开始录入自己的发票。此操作不可撤销。',
          confirmText: '清空并开始',
          tone: 'danger'
        }).then(function (ok) {
          if (!ok) return;
          try {
            DB.clearAll();
            UI.toast('示例数据已清空，开始建立你的发票台账吧');
            IP.router.refresh();
          } catch (err) {
            UI.toast(err.message || '清空失败', 'error');
          }
        });
      }
    };
  }

  IP.views = IP.views || {};
  IP.views.dashboard = render;
})(window);
