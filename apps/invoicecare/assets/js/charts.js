/* 票清 · 轻量 SVG 图表（无第三方依赖） */
(function (global) {
  'use strict';

  const IP = global.IP;
  const money = IP.money;
  const compact = IP.compactNumber;

  let uidSeed = 0;
  function nextId(prefix) {
    uidSeed += 1;
    return prefix + '-' + uidSeed;
  }

  const PALETTE = ['#145C4B', '#3E7E6C', '#7FA494', '#3B7088', '#8D7228', '#8A948F', '#5F6E67'];

  function safeWidth(el, fallback) {
    const rect = el.getBoundingClientRect ? el.getBoundingClientRect() : null;
    const width = rect && rect.width ? rect.width : el.clientWidth;
    return Math.max(280, Math.round(width || fallback || 640));
  }

  function emptyState(message, height) {
    return '<div class="chart-empty" style="height:' + (height || 240) + 'px">' +
      '<span class="chart-empty-icon">' + IP.icon('i-chart') + '</span>' +
      '<p>' + (message || '暂无可展示的数据') + '</p></div>';
  }

  function niceMax(value) {
    if (!value || value <= 0) return 100;
    const raw = value * 1.12;
    const power = Math.pow(10, Math.floor(Math.log10(raw)));
    const norm = raw / power;
    let step;
    if (norm <= 1) step = 1;
    else if (norm <= 2) step = 2;
    else if (norm <= 5) step = 5;
    else step = 10;
    return step * power;
  }

  function linePath(points, smooth) {
    if (!points.length) return '';
    if (points.length === 1) return 'M' + points[0].x + ',' + points[0].y;
    if (!smooth) {
      return points.map(function (p, i) { return (i === 0 ? 'M' : 'L') + p.x + ',' + p.y; }).join(' ');
    }
    let d = 'M' + points[0].x + ',' + points[0].y;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i - 1] || points[i];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = points[i + 2] || p2;
      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;
      d += ' C' + cp1x.toFixed(1) + ',' + cp1y.toFixed(1) + ' ' + cp2x.toFixed(1) + ',' + cp2y.toFixed(1) + ' ' + p2.x.toFixed(1) + ',' + p2.y.toFixed(1);
    }
    return d;
  }

  /* 面积折线图 */
  function renderAreaChart(el, data, opts) {
    const options = opts || {};
    if (!el) return;
    if (!data || !data.length) {
      el.innerHTML = emptyState(options.emptyText, options.height);
      return;
    }
    const width = safeWidth(el, options.fallbackWidth || 640);
    const height = options.height || 250;
    const pad = { top: 22, right: 18, bottom: 34, left: 52 };
    const chartW = width - pad.left - pad.right;
    const chartH = height - pad.top - pad.bottom;
    const values = data.map(function (d) { return Number(d.value) || 0; });
    const max = niceMax(Math.max.apply(null, values.concat([1])));
    const n = data.length;
    const stepX = n > 1 ? chartW / (n - 1) : 0;
    const points = data.map(function (d, i) {
      return {
        x: pad.left + (n > 1 ? i * stepX : chartW / 2),
        y: pad.top + chartH - ((Number(d.value) || 0) / max) * chartH,
        label: d.label,
        value: Number(d.value) || 0,
        fullLabel: d.fullLabel || d.label
      };
    });

    const line = linePath(points, true);
    const area = line + ' L' + points[points.length - 1].x + ',' + (pad.top + chartH) + ' L' + points[0].x + ',' + (pad.top + chartH) + ' Z';
    const gradId = nextId('areaGrad');

    let grid = '';
    const ticks = 4;
    for (let i = 0; i <= ticks; i++) {
      const y = pad.top + (chartH / ticks) * i;
      const value = max - (max / ticks) * i;
      grid += '<line class="chart-grid" x1="' + pad.left + '" y1="' + y.toFixed(1) + '" x2="' + (width - pad.right) + '" y2="' + y.toFixed(1) + '"/>';
      grid += '<text class="chart-axis" x="' + (pad.left - 10) + '" y="' + (y + 4).toFixed(1) + '" text-anchor="end">' + compact(value) + '</text>';
    }

    let xLabels = '';
    const labelEvery = n > 7 ? Math.ceil(n / 6) : 1;
    points.forEach(function (p, i) {
      if (i % labelEvery !== 0 && i !== n - 1) return;
      xLabels += '<text class="chart-axis" x="' + p.x.toFixed(1) + '" y="' + (height - 12) + '" text-anchor="middle">' + IP.escapeHtml(p.label) + '</text>';
    });

    let dots = '';
    points.forEach(function (p) {
      const isLast = p === points[points.length - 1];
      dots += '<g class="chart-point">' +
        '<circle class="chart-dot-hit" cx="' + p.x.toFixed(1) + '" cy="' + p.y.toFixed(1) + '" r="14" fill="transparent"/>' +
        '<circle class="chart-dot' + (isLast ? ' is-last' : '') + '" cx="' + p.x.toFixed(1) + '" cy="' + p.y.toFixed(1) + '" r="' + (isLast ? 5 : 3.5) + '"/>' +
        '<title>' + IP.escapeHtml(p.fullLabel) + '：' + IP.moneySign(p.value) + '</title>' +
        '</g>';
    });

    const last = points[points.length - 1];
    const lastLabelW = 74;
    const lastLabelX = Math.min(width - pad.right - lastLabelW, Math.max(pad.left, last.x - lastLabelW / 2));
    const lastLabel = '<g class="chart-last-label" transform="translate(' + lastLabelX + ',' + Math.max(4, last.y - 40) + ')">' +
      '<rect width="' + lastLabelW + '" height="26" rx="4"/>' +
      '<text x="' + (lastLabelW / 2) + '" y="17" text-anchor="middle">¥' + money(last.value) + '</text></g>';

    el.innerHTML = '<svg class="chart-svg" viewBox="0 0 ' + width + ' ' + height + '" width="100%" height="' + height + '" role="img" aria-label="' + IP.escapeHtml(options.ariaLabel || '趋势图') + '">' +
      '<defs><linearGradient id="' + gradId + '" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0%" stop-color="' + (options.color || '#0F8A6E') + '" stop-opacity=".22"/>' +
      '<stop offset="100%" stop-color="' + (options.color || '#0F8A6E') + '" stop-opacity="0"/>' +
      '</linearGradient></defs>' +
      grid +
      '<path class="chart-area" d="' + area + '" fill="url(#' + gradId + ')"/>' +
      '<path class="chart-line" d="' + line + '" pathLength="1"/>' +
      dots + lastLabel + xLabels +
      '</svg>';
  }

  /* 堆叠柱状图：不含税金额 + 税额 */
  function renderBarChart(el, data, opts) {
    const options = opts || {};
    if (!el) return;
    if (!data || !data.length) {
      el.innerHTML = emptyState(options.emptyText, options.height || 260);
      return;
    }
    const width = safeWidth(el, options.fallbackWidth || 720);
    const height = options.height || 270;
    const pad = { top: 24, right: 16, bottom: 38, left: 56 };
    const chartW = width - pad.left - pad.right;
    const chartH = height - pad.top - pad.bottom;
    const totals = data.map(function (d) { return (Number(d.amount) || 0) + (Number(d.tax) || 0); });
    const max = niceMax(Math.max.apply(null, totals.concat([1])));
    const n = data.length;
    const slot = chartW / n;
    const barW = Math.min(options.maxBarWidth || 42, slot * 0.52);

    let grid = '';
    for (let i = 0; i <= 4; i++) {
      const y = pad.top + (chartH / 4) * i;
      grid += '<line class="chart-grid" x1="' + pad.left + '" y1="' + y.toFixed(1) + '" x2="' + (width - pad.right) + '" y2="' + y.toFixed(1) + '"/>';
      grid += '<text class="chart-axis" x="' + (pad.left - 10) + '" y="' + (y + 4).toFixed(1) + '" text-anchor="end">' + compact(max - (max / 4) * i) + '</text>';
    }

    let bars = '';
    let labels = '';
    data.forEach(function (d, i) {
      const amount = Number(d.amount) || 0;
      const tax = Number(d.tax) || 0;
      const total = amount + tax;
      const h = total > 0 ? (total / max) * chartH : 0;
      const x = pad.left + slot * i + (slot - barW) / 2;
      const y = pad.top + chartH - h;
      const taxH = total > 0 ? (tax / max) * chartH : 0;
      const amountH = Math.max(0, h - taxH);
      const radius = Math.min(5, barW / 2);
      bars += '<g class="chart-bar-group">' +
        '<rect class="chart-bar-hit" x="' + (pad.left + slot * i) + '" y="' + pad.top + '" width="' + slot + '" height="' + chartH + '" fill="transparent"/>' +
        '<rect class="chart-bar-amount" x="' + x.toFixed(1) + '" y="' + (y + taxH).toFixed(1) + '" width="' + barW + '" height="' + amountH.toFixed(1) + '" rx="' + radius + '"/>' +
        '<rect class="chart-bar-tax" x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + barW + '" height="' + taxH.toFixed(1) + '" rx="' + Math.min(3, radius) + '"/>' +
        '<title>' + IP.escapeHtml(d.fullLabel || d.label) + '：价税合计 ' + IP.moneySign(total) + '（税额 ' + IP.moneySign(tax) + '）</title>' +
        '</g>';
      labels += '<text class="chart-axis" x="' + (pad.left + slot * i + slot / 2).toFixed(1) + '" y="' + (height - 14) + '" text-anchor="middle">' + IP.escapeHtml(d.label) + '</text>';
    });

    el.innerHTML = '<svg class="chart-svg" viewBox="0 0 ' + width + ' ' + height + '" width="100%" height="' + height + '" role="img" aria-label="' + IP.escapeHtml(options.ariaLabel || '柱状图') + '">' +
      grid + bars + labels + '</svg>';
  }

  function arcPath(cx, cy, radius, startAngle, endAngle) {
    const start = polar(cx, cy, radius, endAngle);
    const end = polar(cx, cy, radius, startAngle);
    const largeArc = endAngle - startAngle <= 180 ? 0 : 1;
    return ['M', start.x, start.y, 'A', radius, radius, 0, largeArc, 0, end.x, end.y].join(' ');
  }

  function polar(cx, cy, r, angle) {
    const rad = (angle - 90) * Math.PI / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  }

  /* 环形图 */
  function renderDonut(el, items, opts) {
    const options = opts || {};
    if (!el) return;
    const data = (items || []).filter(function (d) { return Number(d.value) > 0; });
    if (!data.length) {
      el.innerHTML = emptyState(options.emptyText || '暂无票种数据', options.height || 210);
      return;
    }
    const width = safeWidth(el, options.fallbackWidth || 280);
    const height = options.height || 200;
    const cx = width / 2;
    const cy = height / 2;
    const radius = Math.min(width, height) / 2 - 18;
    const thickness = 16;
    const total = data.reduce(function (sum, d) { return sum + (Number(d.value) || 0); }, 0);
    let angle = 0;
    let arcs = '';
    data.forEach(function (d, i) {
      const sweep = (Number(d.value) / total) * 360;
      const gap = data.length > 1 ? Math.min(1.4, sweep / 6) : 0;
      const start = angle + gap / 2;
      const end = angle + sweep - gap / 2;
      const color = d.color || PALETTE[i % PALETTE.length];
      if (end > start) {
        arcs += '<path class="donut-seg" d="' + arcPath(cx, cy, radius, start, end) + '" stroke="' + color + '" stroke-width="' + thickness + '" fill="none" stroke-linecap="butt">' +
          '<title>' + IP.escapeHtml(d.label) + '：' + (Number(d.value) || 0) + ' 张（' + Math.round((Number(d.value) / total) * 100) + '%）</title></path>';
      }
      angle += sweep;
    });
    const centerValue = options.centerValue != null ? options.centerValue : total + ' 张';
    const centerLabel = options.centerLabel || '发票总数';
    el.innerHTML = '<svg class="donut-svg" viewBox="0 0 ' + width + ' ' + height + '" width="100%" height="' + height + '" role="img" aria-label="' + IP.escapeHtml(options.ariaLabel || '占比图') + '">' +
      '<circle cx="' + cx + '" cy="' + cy + '" r="' + radius + '" fill="none" stroke="#EEF4F1" stroke-width="' + thickness + '"/>' +
      arcs +
      '<text x="' + cx + '" y="' + (cy - 2) + '" text-anchor="middle" class="donut-value">' + IP.escapeHtml(String(centerValue)) + '</text>' +
      '<text x="' + cx + '" y="' + (cy + 18) + '" text-anchor="middle" class="donut-label">' + IP.escapeHtml(centerLabel) + '</text>' +
      '</svg>';
  }

  function sparkline(values, color, width, height) {
    const w = width || 96;
    const h = height || 34;
    const vals = (values && values.length ? values : [0, 0]).map(function (v) { return Number(v) || 0; });
    const max = Math.max.apply(null, vals.concat([1]));
    const min = Math.min.apply(null, vals);
    const range = max - min || 1;
    const pts = vals.map(function (v, i) {
      const x = vals.length > 1 ? (i / (vals.length - 1)) * (w - 4) + 2 : w / 2;
      const y = h - 3 - ((v - min) / range) * (h - 8);
      return { x: x, y: y };
    });
    const d = linePath(pts, true);
    const area = d + ' L' + pts[pts.length - 1].x + ',' + h + ' L' + pts[0].x + ',' + h + ' Z';
    const gradId = nextId('spark');
    return '<svg class="sparkline" viewBox="0 0 ' + w + ' ' + h + '" width="' + w + '" height="' + h + '" aria-hidden="true">' +
      '<defs><linearGradient id="' + gradId + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="' + color + '" stop-opacity=".24"/><stop offset="100%" stop-color="' + color + '" stop-opacity="0"/></linearGradient></defs>' +
      '<path d="' + area + '" fill="url(#' + gradId + ')"/>' +
      '<path d="' + d + '" fill="none" stroke="' + color + '" stroke-width="2" stroke-linecap="round"/></svg>';
  }

  IP.charts = {
    renderAreaChart: renderAreaChart,
    renderBarChart: renderBarChart,
    renderDonut: renderDonut,
    sparkline: sparkline,
    PALETTE: PALETTE
  };
})(window);
