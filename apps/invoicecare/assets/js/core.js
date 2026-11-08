/* 票清 · 个人发票检验平台 — 核心数据与校验引擎 */
(function (global) {
  'use strict';

  const STORE_KEY = 'piaoqing_invoice_platform_v1';
  const APP_VERSION = '1.0.0';

  const TYPES = {
    digital_normal: {
      key: 'digital_normal', label: '数电普通发票', short: '数电普票', category: '数电发票',
      codeRequired: false, codeLen: [0, 12], numLen: [20, 20], tone: 'mint',
      hint: '全电发票无发票代码，发票号码为 20 位'
    },
    digital_special: {
      key: 'digital_special', label: '数电专用发票', short: '数电专票', category: '数电发票',
      codeRequired: false, codeLen: [0, 12], numLen: [20, 20], tone: 'blue',
      hint: '全电发票无发票代码，可用于进项抵扣'
    },
    vat_special: {
      key: 'vat_special', label: '增值税专用发票', short: '专票', category: '传统发票',
      codeRequired: true, codeLen: [10, 12], numLen: [8, 8], tone: 'indigo',
      hint: '发票代码一般为 10 位，号码为 8 位'
    },
    vat_normal: {
      key: 'vat_normal', label: '增值税普通发票', short: '普票', category: '传统发票',
      codeRequired: true, codeLen: [10, 12], numLen: [8, 8], tone: 'green',
      hint: '发票代码一般为 10 或 12 位，号码为 8 位'
    },
    electronic: {
      key: 'electronic', label: '电子发票（普通）', short: '电子普票', category: '电子发票',
      codeRequired: true, codeLen: [12, 12], numLen: [8, 8], tone: 'violet',
      hint: '传统电子发票代码为 12 位，号码为 8 位'
    },
    other: {
      key: 'other', label: '其他票据', short: '其他', category: '其他',
      codeRequired: false, codeLen: [0, 12], numLen: [4, 20], tone: 'gray',
      hint: '出租车票、行程单等，按票面信息录入'
    }
  };

  const TYPE_LIST = Object.values(TYPES);

  const STATUS = {
    passed: { key: 'passed', label: '已通过', tone: 'pass', icon: 'i-shield-check', desc: '基础校验未发现异常' },
    review: { key: 'review', label: '待复核', tone: 'warn', icon: 'i-alert', desc: '存在需人工确认的事项' },
    risk: { key: 'risk', label: '风险', tone: 'danger', icon: 'i-shield-alert', desc: '存在高风险异常，建议优先核实' }
  };

  const TAX_RATES = [
    { value: 0, label: '0%' },
    { value: 0.01, label: '1%' },
    { value: 0.03, label: '3%' },
    { value: 0.05, label: '5%' },
    { value: 0.06, label: '6%' },
    { value: 0.09, label: '9%' },
    { value: 0.13, label: '13%' }
  ];

  const DEFAULT_SETTINGS = {
    buyerName: '青禾数字科技（上海）有限公司',
    buyerTaxId: '91310000MA1H8N6P44',
    strictTaxId: true,
    duplicateCheck: true,
    expiryDays: 365,
    defaultTaxRate: 0.06,
    userName: '个人工作台',
    demoNoticeDismissed: false
  };

  /* ---------- 通用工具 ---------- */
  const $ = (selector, root) => (root || document).querySelector(selector);
  const $$ = (selector, root) => Array.prototype.slice.call((root || document).querySelectorAll(selector));

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }

  function round2(value) {
    const n = Number(value);
    if (!isFinite(n)) return 0;
    return Math.round((n + Number.EPSILON) * 100) / 100;
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  const moneyFormatter = new Intl.NumberFormat('zh-CN', {
    minimumFractionDigits: 2, maximumFractionDigits: 2
  });

  function money(value) {
    return moneyFormatter.format(Number(value) || 0);
  }

  function moneySign(value) {
    const n = Number(value) || 0;
    return (n < 0 ? '-¥' : '¥') + money(Math.abs(n));
  }

  function compactNumber(value) {
    const n = Number(value) || 0;
    if (Math.abs(n) >= 100000000) return (n / 100000000).toFixed(1).replace(/\.0$/, '') + '亿';
    if (Math.abs(n) >= 10000) return (n / 10000).toFixed(1).replace(/\.0$/, '') + '万';
    if (Math.abs(n) >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
    return String(Math.round(n));
  }

  function pad2(n) {
    return String(n).padStart(2, '0');
  }

  function toISODate(date) {
    const d = date instanceof Date ? date : new Date(date);
    if (isNaN(d.getTime())) return '';
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }

  function parseISODate(iso) {
    if (!iso) return null;
    const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return null;
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0);
    return isNaN(d.getTime()) ? null : d;
  }

  function todayISO() {
    return toISODate(new Date());
  }

  function formatDate(iso, style) {
    const d = parseISODate(iso);
    if (!d) return '—';
    if (style === 'long') return d.getFullYear() + '年' + (d.getMonth() + 1) + '月' + d.getDate() + '日';
    if (style === 'short') return (d.getMonth() + 1) + '月' + d.getDate() + '日';
    return toISODate(d);
  }

  function formatDateTime(value) {
    const d = value ? new Date(value) : null;
    if (!d || isNaN(d.getTime())) return '—';
    return toISODate(d) + ' ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes());
  }

  function addDays(date, days) {
    const d = new Date(date.getTime());
    d.setDate(d.getDate() + days);
    return d;
  }

  function daysBetween(fromISO, toISOValue) {
    const a = parseISODate(fromISO);
    const b = parseISODate(toISOValue || todayISO());
    if (!a || !b) return 0;
    return Math.round((b.getTime() - a.getTime()) / 86400000);
  }

  function monthKey(iso) {
    return String(iso || '').slice(0, 7);
  }

  function monthLabel(key) {
    const parts = String(key).split('-');
    return parts.length === 2 ? Number(parts[1]) + '月' : key;
  }

  function lastMonths(count, endDate) {
    const end = endDate ? new Date(endDate) : new Date();
    const arr = [];
    for (let i = count - 1; i >= 0; i--) {
      const d = new Date(end.getFullYear(), end.getMonth() - i, 1);
      arr.push(d.getFullYear() + '-' + pad2(d.getMonth() + 1));
    }
    return arr;
  }

  function uid(prefix) {
    return (prefix || 'inv') + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function debounce(fn, wait) {
    let timer = null;
    return function () {
      const args = arguments;
      const ctx = this;
      clearTimeout(timer);
      timer = setTimeout(function () { fn.apply(ctx, args); }, wait || 200);
    };
  }

  function normalizeText(value) {
    return String(value == null ? '' : value)
      .replace(/[\s　]/g, '')
      .replace(/[（]/g, '(').replace(/[）]/g, ')')
      .replace(/[，,]/g, '')
      .toUpperCase();
  }

  function percent(rate) {
    const n = Number(rate) * 100;
    return (Math.round(n * 100) / 100) + '%';
  }

  function icon(name, cls) {
    return '<svg class="icon ' + (cls || '') + '" aria-hidden="true"><use href="#' + name + '"/></svg>';
  }

  function statusBadge(status, extraClass) {
    const meta = STATUS[status] || STATUS.review;
    return '<span class="status status-' + meta.tone + ' ' + (extraClass || '') + '"><span class="status-dot"></span>' + meta.label + '</span>';
  }

  function typeBadge(type) {
    const meta = TYPES[type] || TYPES.other;
    return '<span class="type-tag type-' + meta.tone + '">' + meta.short + '</span>';
  }

  function getType(type) {
    return TYPES[type] || TYPES.other;
  }

  /* ---------- 税号校验 ---------- */
  const USCC_CHARSET = '0123456789ABCDEFGHJKLMNPQRTUWXY';
  const USCC_WEIGHTS = [1, 3, 9, 27, 19, 26, 16, 17, 20, 29, 25, 13, 8, 24, 10, 30, 28];

  function validateTaxId(raw) {
    const id = String(raw == null ? '' : raw).trim().toUpperCase().replace(/\s/g, '');
    if (!id) return { state: 'empty', valid: false, message: '未填写纳税人识别号' };
    if (!/^[0-9A-HJ-NPQRTUWXY]+$/.test(id)) {
      return { state: 'invalid', valid: false, message: '包含不支持的字符，请检查是否误输入 I、O、S、V、Z' };
    }
    if (id.length === 18) {
      let sum = 0;
      for (let i = 0; i < 17; i++) {
        const idx = USCC_CHARSET.indexOf(id.charAt(i));
        if (idx < 0) return { state: 'invalid', valid: false, message: '统一社会信用代码格式不正确' };
        sum += idx * USCC_WEIGHTS[i];
      }
      const expected = USCC_CHARSET.charAt((31 - (sum % 31)) % 31);
      if (id.charAt(17) !== expected) {
        return { state: 'invalid', valid: false, message: '校验位不匹配，请核对第 18 位字符' };
      }
      return { state: 'valid', valid: true, message: '18 位统一社会信用代码校验通过' };
    }
    if ([15, 17, 20].indexOf(id.length) >= 0) {
      return { state: 'legacy', valid: true, message: '非 18 位登记号，已通过格式校验' };
    }
    return { state: 'invalid', valid: false, message: '纳税人识别号通常为 15、17、18 或 20 位' };
  }

  /* ---------- 发票校验引擎 ---------- */
  function evaluateInvoice(invoice, options) {
    const opts = options || {};
    const invoices = opts.invoices || [];
    const settings = Object.assign({}, DEFAULT_SETTINGS, opts.settings || {});
    const selfId = opts.selfId || invoice.id;
    const checks = [];

    function add(key, label, severity, status, detail) {
      checks.push({ key: key, label: label, severity: severity, status: status, detail: detail });
    }

    const type = getType(invoice.type);
    const amount = Number(invoice.amount) || 0;
    const tax = Number(invoice.taxAmount) || 0;
    const total = Number(invoice.total) || 0;
    const rate = Number(invoice.taxRate) || 0;
    const number = String(invoice.number || '').trim();
    const code = String(invoice.code || '').trim();

    /* 1. 必填项 */
    const missing = [];
    if (!invoice.type) missing.push('发票类型');
    if (!number) missing.push('发票号码');
    if (!invoice.date) missing.push('开票日期');
    if (!invoice.sellerName) missing.push('销售方名称');
    if (!(amount > 0)) missing.push('金额');
    if (!(total > 0)) missing.push('价税合计');
    add('required', '关键要素完整性', 'high', missing.length ? 'fail' : 'pass',
      missing.length ? '缺少：' + missing.join('、') : '发票类型、号码、日期、交易方及金额均已填写');

    /* 2. 发票代码 */
    if (type.codeRequired) {
      if (!code) {
        add('code', '发票代码格式', 'high', 'fail', '该票种需填写发票代码，请核对票面左上角代码');
      } else if (!/^\d+$/.test(code) || code.length < type.codeLen[0] || code.length > type.codeLen[1]) {
        add('code', '发票代码格式', 'medium', 'fail',
          '发票代码应为 ' + type.codeLen[0] + '–' + type.codeLen[1] + ' 位数字，当前为 ' + code.length + ' 位');
      } else {
        add('code', '发票代码格式', 'medium', 'pass', '发票代码为 ' + code.length + ' 位数字，符合该票种规则');
      }
    } else if (code && (!/^\d{10,12}$/.test(code))) {
      add('code', '发票代码格式', 'low', 'warn', '该票种通常无发票代码，当前填写的代码格式异常，请确认是否误填');
    } else {
      add('code', '发票代码格式', 'low', 'pass', code ? '已录入发票代码' : '数电发票无需填写发票代码');
    }

    /* 3. 发票号码 */
    if (!number) {
      add('number', '发票号码格式', 'high', 'fail', '请填写发票号码');
    } else if (!/^\d+$/.test(number)) {
      add('number', '发票号码格式', 'high', 'fail', '发票号码应为纯数字，请检查是否混入字母或空格');
    } else if (number.length < type.numLen[0] || number.length > type.numLen[1]) {
      add('number', '发票号码格式', 'medium', 'fail',
        type.label + '的发票号码应为 ' + type.numLen[0] + (type.numLen[0] === type.numLen[1] ? '' : '–' + type.numLen[1]) + ' 位，当前为 ' + number.length + ' 位');
    } else {
      add('number', '发票号码格式', 'medium', 'pass', '发票号码为 ' + number.length + ' 位纯数字');
    }

    /* 4. 开票日期 */
    if (!invoice.date || !parseISODate(invoice.date)) {
      add('date', '开票日期合理性', 'high', 'fail', '请填写有效的开票日期');
    } else {
      const age = daysBetween(invoice.date, todayISO());
      if (age < 0) {
        add('date', '开票日期合理性', 'high', 'fail', '开票日期晚于今天，请检查是否录入错误');
      } else if (parseISODate(invoice.date).getFullYear() < 2000) {
        add('date', '开票日期合理性', 'medium', 'fail', '开票日期早于 2000 年，明显异常');
      } else if (age > Number(settings.expiryDays || 365)) {
        add('date', '开票日期合理性', 'low', 'warn', '距开票已 ' + age + ' 天，超过 ' + settings.expiryDays + ' 天提醒线，请关注入账时效');
      } else {
        add('date', '开票日期合理性', 'low', 'pass', '距开票 ' + age + ' 天，处于 ' + settings.expiryDays + ' 天提醒期内');
      }
    }

    /* 5. 购买方信息 */
    if (!invoice.buyerName) {
      add('buyerName', '购买方抬头', 'medium', 'warn', '未填写购买方名称，建议补充以便核对报销主体');
    } else if (settings.buyerName && normalizeText(invoice.buyerName) !== normalizeText(settings.buyerName)) {
      add('buyerName', '购买方抬头', 'medium', 'warn',
        '与默认抬头「' + settings.buyerName + '」不一致，请确认是否应由其他主体报销');
    } else {
      add('buyerName', '购买方抬头', 'medium', 'pass', '购买方名称与默认抬头一致');
    }

    if (!invoice.buyerTaxId) {
      if (invoice.type === 'vat_special' || invoice.type === 'digital_special') {
        add('buyerTaxId', '购买方税号', 'high', 'fail', '专用发票必须填写购买方纳税人识别号，否则影响进项抵扣');
      } else {
        add('buyerTaxId', '购买方税号', 'low', 'warn', '未填写购买方税号；个人抬头可忽略，单位报销建议补充');
      }
    } else {
      const buyerCheck = validateTaxId(invoice.buyerTaxId);
      if (!buyerCheck.valid) {
        add('buyerTaxId', '购买方税号', settings.strictTaxId ? 'high' : 'medium', 'fail', buyerCheck.message);
      } else if (settings.buyerTaxId && normalizeText(invoice.buyerTaxId) !== normalizeText(settings.buyerTaxId)) {
        add('buyerTaxId', '购买方税号', 'medium', 'warn', '购买方税号与默认抬头税号不一致，请确认报销主体');
      } else {
        add('buyerTaxId', '购买方税号', 'medium', 'pass', buyerCheck.message);
      }
    }

    /* 6. 销售方税号 */
    if (!invoice.sellerTaxId) {
      add('sellerTaxId', '销售方税号', 'medium', 'fail', '未填写销售方纳税人识别号，无法完成税号合规校验');
    } else {
      const sellerCheck = validateTaxId(invoice.sellerTaxId);
      if (!sellerCheck.valid) {
        add('sellerTaxId', '销售方税号', settings.strictTaxId ? 'high' : 'medium', 'fail', sellerCheck.message);
      } else {
        add('sellerTaxId', '销售方税号', 'medium', 'pass', sellerCheck.message);
      }
    }

    /* 7. 金额勾稽 */
    if (!(amount > 0)) {
      add('taxMath', '税额与税率匹配', 'high', 'fail', '金额需大于 0 才能校验税额');
    } else {
      const expectedTax = round2(amount * rate);
      const taxDiff = round2(tax - expectedTax);
      if (Math.abs(taxDiff) > 0.02) {
        add('taxMath', '税额与税率匹配', 'high', 'fail',
          '按金额 × 税率计算税额应为 ' + moneySign(expectedTax) + '，票面为 ' + moneySign(tax) + '，差额 ' + moneySign(taxDiff));
      } else {
        add('taxMath', '税额与税率匹配', 'high', 'pass', '税额 ' + moneySign(tax) + ' 与金额 × ' + percent(rate) + ' 的计算结果一致');
      }
    }

    const expectedTotal = round2(amount + tax);
    const totalDiff = round2(total - expectedTotal);
    if (!(total > 0)) {
      add('totalMath', '价税合计勾稽', 'high', 'fail', '请填写价税合计');
    } else if (Math.abs(totalDiff) > 0.02) {
      add('totalMath', '价税合计勾稽', 'high', 'fail',
        '金额 ' + moneySign(amount) + ' + 税额 ' + moneySign(tax) + ' 应为 ' + moneySign(expectedTotal) + '，票面合计为 ' + moneySign(total) + '，差额 ' + moneySign(totalDiff));
    } else {
      add('totalMath', '价税合计勾稽', 'high', 'pass', '金额 + 税额 = 价税合计，勾稽关系成立');
    }

    /* 8. 校验码 */
    const checkCode = String(invoice.checkCode || '').replace(/\s/g, '');
    if (!checkCode) {
      add('checkCode', '校验码格式', 'low', 'pass', '未填写校验码；数电发票通常无校验码，传统发票建议录入后 6 位');
    } else if (!/^\d{6,20}$/.test(checkCode)) {
      add('checkCode', '校验码格式', 'medium', 'fail', '校验码应为 6–20 位数字，请核对票面校验码');
    } else {
      add('checkCode', '校验码格式', 'low', 'pass', '校验码格式正确（' + checkCode.length + ' 位）');
    }

    /* 9. 重复查验 */
    if (settings.duplicateCheck === false) {
      add('duplicate', '重复发票查验', 'low', 'pass', '重复查验已在设置中关闭');
    } else if (!number) {
      add('duplicate', '重复发票查验', 'high', 'fail', '缺少发票号码，无法比对历史台账');
    } else {
      const key = duplicateKey(invoice);
      const duplicate = invoices.find(function (item) {
        return item && item.id !== selfId && duplicateKey(item) === key;
      });
      if (duplicate) {
        add('duplicate', '重复发票查验', 'high', 'fail',
          '与台账中 ' + formatDate(duplicate.date) + ' 的「' + (duplicate.sellerName || '未知销售方') + '」发票重复，请警惕重复报销');
      } else {
        add('duplicate', '重复发票查验', 'high', 'pass', '已与台账内 ' + invoices.length + ' 张发票比对，未发现同号发票');
      }
    }

    /* 10. 大额提示 */
    if (total >= 50000) {
      add('large', '大额交易提示', 'info', 'pass', '价税合计 ' + moneySign(total) + '，建议留存合同、付款凭证与验收记录备查');
    } else {
      add('large', '大额交易提示', 'info', 'pass', '价税合计未超过 5 万元，按常规凭证留存即可');
    }

    let deduction = 0;
    let hasHighFail = false;
    checks.forEach(function (check) {
      if (check.status === 'fail') {
        if (check.severity === 'high') { deduction += 45; hasHighFail = true; }
        else if (check.severity === 'medium') deduction += 20;
        else deduction += 8;
      } else if (check.status === 'warn') {
        if (check.severity === 'high') deduction += 22;
        else if (check.severity === 'medium') deduction += 12;
        else deduction += 4;
      }
    });

    let score = clamp(100 - deduction, 0, 100);
    const hasWarning = checks.some(function (c) { return c.status === 'warn' || c.status === 'fail'; });
    const status = hasHighFail ? 'risk' : (hasWarning ? 'review' : 'passed');
    if (status === 'risk') score = Math.min(score, 59);
    if (status === 'review') score = Math.min(score, 89);

    const issues = checks.filter(function (c) { return c.status === 'fail' || c.status === 'warn'; })
      .map(function (c) { return { key: c.key, label: c.label, detail: c.detail, status: c.status, severity: c.severity }; });

    return {
      score: Math.round(score),
      status: status,
      checks: checks,
      issues: issues,
      passCount: checks.filter(function (c) { return c.status === 'pass'; }).length,
      warnCount: checks.filter(function (c) { return c.status === 'warn'; }).length,
      failCount: checks.filter(function (c) { return c.status === 'fail'; }).length,
      verifiedAt: new Date().toISOString()
    };
  }

  function duplicateKey(invoice) {
    if (!invoice) return '';
    const number = String(invoice.number || '').replace(/\s/g, '');
    if (!number) return '';
    const code = String(invoice.code || '').replace(/\s/g, '');
    const digital = invoice.type === 'digital_normal' || invoice.type === 'digital_special' || number.length === 20;
    return digital ? 'N:' + number : 'C:' + code + '|' + number;
  }

  function blankInvoice(settings) {
    const s = settings || DEFAULT_SETTINGS;
    return {
      id: null,
      type: 'digital_normal',
      code: '',
      number: '',
      date: todayISO(),
      checkCode: '',
      buyerName: s.buyerName || '',
      buyerTaxId: s.buyerTaxId || '',
      sellerName: '',
      sellerTaxId: '',
      itemName: '',
      amount: '',
      taxRate: s.defaultTaxRate != null ? s.defaultTaxRate : 0.06,
      taxAmount: '',
      total: '',
      remark: '',
      source: 'manual',
      attachment: null,
      manualAmounts: false,
      createdAt: null,
      updatedAt: null,
      verifiedAt: null,
      status: 'review',
      riskScore: null,
      issues: []
    };
  }

  /* ---------- 文本解析 ---------- */
  function parseInvoiceText(text) {
    const source = String(text || '');
    const result = {};
    function grab(regex) {
      const m = source.match(regex);
      return m ? String(m[1]).trim() : '';
    }

    const typeLine = grab(/(?:发票类型|票种)[：:\s]*([^\n\r]+)/);
    if (typeLine) {
      if (/数电.*专/.test(typeLine)) result.type = 'digital_special';
      else if (/数电/.test(typeLine)) result.type = 'digital_normal';
      else if (/电子.*专/.test(typeLine)) result.type = 'digital_special';
      else if (/电子/.test(typeLine)) result.type = 'electronic';
      else if (/专用/.test(typeLine)) result.type = 'vat_special';
      else if (/普通|普票/.test(typeLine)) result.type = 'vat_normal';
    }

    const code = grab(/(?:发票代码|票据代码)[：:\s]*([0-9]{8,12})/);
    if (code) result.code = code;
    const number = grab(/(?:发票号码|票据号码|号码)[：:\s]*([0-9]{4,20})/);
    if (number) result.number = number;
    const date = grab(/(?:开票日期|日期)[：:\s]*(\d{4})[年\-/.](\d{1,2})[月\-/.](\d{1,2})/);
    if (date) {
      const m = source.match(/(?:开票日期|日期)[：:\s]*(\d{4})[年\-/.](\d{1,2})[月\-/.](\d{1,2})/);
      result.date = m[1] + '-' + pad2(m[2]) + '-' + pad2(m[3]);
    }
    const checkCode = grab(/(?:校验码|验证码)[：:\s]*([0-9]{6,20})/);
    if (checkCode) result.checkCode = checkCode;

    const buyerName = grab(/(?:购买方名称|购方名称|付款方)[：:\s]*([^\n\r]+)/);
    if (buyerName) result.buyerName = buyerName.replace(/\s+$/, '');
    const buyerTax = grab(/(?:购买方税号|购方税号|购买方纳税人识别号)[：:\s]*([0-9A-Za-z]{15,20})/);
    if (buyerTax) result.buyerTaxId = buyerTax.toUpperCase();
    const sellerName = grab(/(?:销售方名称|销方名称|收款方)[：:\s]*([^\n\r]+)/);
    if (sellerName) result.sellerName = sellerName.replace(/\s+$/, '');
    const sellerTax = grab(/(?:销售方税号|销方税号|销售方纳税人识别号)[：:\s]*([0-9A-Za-z]{15,20})/);
    if (sellerTax) result.sellerTaxId = sellerTax.toUpperCase();

    const item = grab(/(?:项目名称|货物或应税劳务|服务名称)[：:\s]*([^\n\r]+)/);
    if (item) result.itemName = item;

    const amount = grab(/(?:不含税金额|金额|合计金额)[：:\s]*[¥￥]?\s*([\d,]+(?:\.\d{1,2})?)/);
    const tax = grab(/(?:税额|合计税额)[：:\s]*[¥￥]?\s*([\d,]+(?:\.\d{1,2})?)/);
    const total = grab(/(?:价税合计|合计|小写)[：:\s]*(?:[¥￥])?\s*([\d,]+(?:\.\d{1,2})?)/);
    const rate = grab(/税率[：:\s]*(\d+(?:\.\d+)?)\s*%/);
    if (amount) result.amount = parseFloat(amount.replace(/,/g, ''));
    if (tax) result.taxAmount = parseFloat(tax.replace(/,/g, ''));
    if (total) result.total = parseFloat(total.replace(/,/g, ''));
    if (rate) result.taxRate = parseFloat(rate) / 100;
    if (result.taxAmount != null || result.total != null) result.manualAmounts = true;

    return result;
  }

  function parseQRContent(text) {
    const raw = String(text || '').trim();
    if (!raw) return null;
    const parts = raw.split(',');
    if (parts.length >= 7 && /^\d{2}$/.test(parts[0])) {
      const typeCode = parts[1];
      const code = (parts[2] || '').replace(/\D/g, '');
      const number = (parts[3] || '').replace(/\D/g, '');
      const amount = parseFloat((parts[4] || '').replace(/,/g, ''));
      const dateRaw = (parts[5] || '').replace(/\D/g, '');
      const check = (parts[6] || '').replace(/\D/g, '');
      const out = {
        code: code,
        number: number,
        checkCode: check,
        source: 'qr'
      };
      if (dateRaw.length === 8) out.date = dateRaw.slice(0, 4) + '-' + dateRaw.slice(4, 6) + '-' + dateRaw.slice(6, 8);
      if (isFinite(amount) && amount > 0) {
        out.amount = amount;
        out.manualAmounts = true;
      }
      const typeMap = { '01': 'vat_special', '04': 'vat_normal', '10': 'electronic', '11': 'electronic' };
      if (typeMap[typeCode]) out.type = typeMap[typeCode];
      if (number.length === 20) out.type = /专/.test(raw) ? 'digital_special' : 'digital_normal';
      return out;
    }
    return null;
  }

  global.IP = {
    STORE_KEY: STORE_KEY,
    APP_VERSION: APP_VERSION,
    TYPES: TYPES,
    TYPE_LIST: TYPE_LIST,
    STATUS: STATUS,
    TAX_RATES: TAX_RATES,
    DEFAULT_SETTINGS: DEFAULT_SETTINGS,
    $: $, $$: $$,
    escapeHtml: escapeHtml,
    round2: round2,
    clamp: clamp,
    money: money,
    moneySign: moneySign,
    compactNumber: compactNumber,
    toISODate: toISODate,
    parseISODate: parseISODate,
    todayISO: todayISO,
    formatDate: formatDate,
    formatDateTime: formatDateTime,
    addDays: addDays,
    daysBetween: daysBetween,
    monthKey: monthKey,
    monthLabel: monthLabel,
    lastMonths: lastMonths,
    uid: uid,
    debounce: debounce,
    normalizeText: normalizeText,
    percent: percent,
    icon: icon,
    statusBadge: statusBadge,
    typeBadge: typeBadge,
    getType: getType,
    validateTaxId: validateTaxId,
    evaluateInvoice: evaluateInvoice,
    duplicateKey: duplicateKey,
    blankInvoice: blankInvoice,
    parseInvoiceText: parseInvoiceText,
    parseQRContent: parseQRContent
  };
})(window);
