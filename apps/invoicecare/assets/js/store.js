/* 票清 · 本地数据仓库与示例数据 */
(function (global) {
  'use strict';

  const IP = global.IP;
  const STORE_KEY = IP.STORE_KEY;
  const evaluateInvoice = IP.evaluateInvoice;
  const round2 = IP.round2;
  const toISODate = IP.toISODate;
  const uid = IP.uid;

  function daysAgo(days) {
    const d = new Date();
    d.setHours(12, 0, 0, 0);
    d.setDate(d.getDate() - days);
    return toISODate(d);
  }

  function isoTime(days, hour) {
    const d = new Date();
    d.setHours(hour || 10, 20, 0, 0);
    d.setDate(d.getDate() - days);
    return d.toISOString();
  }

  function digitalNo(index) {
    return '2631200000001' + String(index).padStart(7, '0');
  }

  function buildSeed() {
    const buyerName = IP.DEFAULT_SETTINGS.buyerName;
    const buyerTaxId = IP.DEFAULT_SETTINGS.buyerTaxId;
    const defs = [
      { type: 'digital_normal', days: 2, seller: '滴滴出行科技有限公司', sellerTax: '91310115MA1K4B7X93', item: '*运输服务*客运服务费', amount: 126.42, rate: 0.03, remark: '日常通勤', number: digitalNo(101) },
      { type: 'digital_special', days: 4, seller: '阿里云计算有限公司', sellerTax: '91330106MA2B3T9K55', item: '*信息技术服务*云服务器租用费', amount: 3680, rate: 0.06, remark: '项目开发环境', number: digitalNo(102) },
      { type: 'digital_normal', days: 8, seller: '上海星巴克咖啡经营有限公司', sellerTax: '91310000607213579D', item: '*餐饮服务*咖啡饮品', amount: 68, rate: 0.06, remark: '客户接待', number: digitalNo(103) },
      { type: 'vat_special', days: 13, seller: '北京京东世纪信息技术有限公司', sellerTax: '91110108MA01C8D42P', item: '*办公用品*打印纸及耗材', amount: 2460, rate: 0.13, code: '1100230011', number: '88451236', checkCode: '882145', remark: '办公室耗材采购' },
      { type: 'digital_normal', days: 22, seller: '中国石化销售股份有限公司', sellerTax: '91310000MA1FL0A23T', item: '*汽油*95号汽油', amount: 500, rate: 0.13, remark: '市内交通', number: digitalNo(105) },
      { type: 'electronic', days: 35, seller: '上海携程商务有限公司', sellerTax: '91310000607342896R', item: '*住宿服务*差旅住宿费', amount: 1280, rate: 0.06, code: '031002300112', number: '44102873', remark: '杭州出差', checkCode: '661209' },
      { type: 'digital_normal', days: 40, seller: '顺丰速运有限公司', sellerTax: '91440300MA5F1Q6W3L', item: '*物流辅助服务*快递费', amount: 246, rate: 0.06, remark: '合同寄送', number: digitalNo(107) },
      { type: 'vat_special', days: 48, seller: '华为技术有限公司', sellerTax: '91440300708461136T', item: '*电子设备*无线耳机', amount: 8999, rate: 0.13, code: '4400230022', number: '66120987', checkCode: '451208', remark: '会议设备' },
      { type: 'digital_special', days: 58, seller: '国网上海市电力公司', sellerTax: '91310000100023817G', item: '*电力*办公用电费', amount: 1580, rate: 0.13, remark: '8 月电费', number: digitalNo(109) },
      { type: 'electronic', days: 66, seller: '中国移动通信集团有限公司', sellerTax: '911101087481059966', item: '*电信服务*通信费', amount: 199, rate: 0.06, code: '031002300113', number: '33218876', checkCode: '920315', remark: '企业宽带' },
      { type: 'digital_normal', days: 78, seller: '北京三快在线科技有限公司', sellerTax: '91110108551385082Q', item: '*餐饮服务*工作餐', amount: 328, rate: 0.06, remark: '团队加班餐', number: digitalNo(111) },
      { type: 'vat_normal', days: 92, seller: '百望股份有限公司', sellerTax: '91310000607421857L', item: '*信息技术服务*税控技术服务费', amount: 1200, rate: 0.06, code: '3100230044', number: '77120356', checkCode: '302156', remark: '开票系统年费', buyerTaxId: '' },
      { type: 'digital_special', days: 105, seller: '上海云启管理咨询有限公司', sellerTax: '91320594MA1W8E5R7F', item: '*咨询服务*财务咨询费', amount: 12500, rate: 0.06, remark: '年度财务顾问服务', number: digitalNo(113) },
      { type: 'digital_special', days: 104, seller: '上海云启管理咨询有限公司', sellerTax: '91320594MA1W8E5R7F', item: '*咨询服务*财务咨询费', amount: 12500, rate: 0.06, remark: '疑似重复上传，用于示例重复报销识别', number: digitalNo(113) },
      { type: 'vat_special', days: 120, seller: '罗技科技（苏州）有限公司', sellerTax: '91310000607342896R', item: '*办公设备*键鼠套装', amount: 689, rate: 0.13, code: '3100230033', number: '55318842', checkCode: '714209', remark: '示例数据：税额与金额不勾稽', taxAmount: 99.57, total: 788.57 },
      { type: 'digital_normal', days: 138, seller: '北京思维造物信息科技有限公司', sellerTax: '91110105MA01K3J920', item: '*教育服务*培训费', amount: 199, rate: 0.03, remark: '示例数据：抬头与默认主体不一致', number: digitalNo(116), buyerName: '青禾数字科技有限公司' },
      { type: 'other', days: 155, seller: '上海强生出租汽车有限公司', sellerTax: '91310000100023817G', item: '出租车客运服务', amount: 45, rate: 0, remark: '纸质出租车票补录', code: '', number: '20260612001' },
      { type: 'digital_normal', days: 175, seller: '中国邮政集团有限公司', sellerTax: '91110000100010564G', item: '*邮政服务*文件寄递费', amount: 86, rate: 0.06, remark: '发票原件寄送', number: digitalNo(118) }
    ];

    return defs.map(function (def, index) {
      const taxAmount = def.taxAmount != null ? def.taxAmount : round2(def.amount * def.rate);
      const total = def.total != null ? def.total : round2(def.amount + taxAmount);
      const code = def.code != null ? def.code : '';
      return {
        id: 'demo_' + String(index + 1).padStart(2, '0'),
        type: def.type,
        code: code,
        number: def.number,
        date: daysAgo(def.days),
        checkCode: def.checkCode || '',
        buyerName: def.buyerName != null ? def.buyerName : buyerName,
        buyerTaxId: def.buyerTaxId != null ? def.buyerTaxId : buyerTaxId,
        sellerName: def.seller,
        sellerTaxId: def.sellerTax,
        itemName: def.item,
        amount: def.amount,
        taxRate: def.rate,
        taxAmount: taxAmount,
        total: total,
        remark: def.remark || '',
        source: 'demo',
        attachment: null,
        manualAmounts: def.taxAmount != null || def.total != null,
        createdAt: isoTime(def.days, 9 + (index % 8)),
        updatedAt: isoTime(def.days, 9 + (index % 8)),
        verifiedAt: isoTime(def.days, 9 + (index % 8)),
        status: 'passed',
        riskScore: 100,
        issues: []
      };
    });
  }

  const DB = {
    data: null,
    storageAvailable: true,

    load: function () {
      let parsed = null;
      try {
        const raw = global.localStorage.getItem(STORE_KEY);
        if (raw) parsed = JSON.parse(raw);
      } catch (err) {
        console.warn('读取本地数据失败：', err);
        this.storageAvailable = false;
      }

      if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.invoices)) {
        parsed = {
          version: 1,
          createdAt: new Date().toISOString(),
          seeded: false,
          settings: Object.assign({}, IP.DEFAULT_SETTINGS),
          invoices: []
        };
      }
      parsed.settings = Object.assign({}, IP.DEFAULT_SETTINGS, parsed.settings || {});
      this.data = parsed;

      if (!parsed.seeded && parsed.invoices.length === 0) {
        parsed.invoices = buildSeed();
        parsed.seeded = true;
        this.refreshAll(false);
        this.persist(true);
      } else if (!parsed.seeded) {
        parsed.seeded = true;
      }
      this.refreshAll(false);
      return this.data;
    },

    persist: function (silent) {
      try {
        global.localStorage.setItem(STORE_KEY, JSON.stringify(this.data));
        this.storageAvailable = true;
        return true;
      } catch (err) {
        this.storageAvailable = false;
        console.error('保存本地数据失败：', err);
        if (!silent) {
          throw new Error('本地存储空间不足。请先导出备份，再删除部分带附件的发票后重试。');
        }
        return false;
      }
    },

    settings: function () {
      return this.data.settings;
    },

    invoices: function () {
      return this.data.invoices;
    },

    saveSettings: function (patch) {
      this.data.settings = Object.assign({}, this.data.settings, patch);
      this.refreshAll(false);
      this.persist();
      return this.data.settings;
    },

    add: function (invoice) {
      const now = new Date().toISOString();
      const record = Object.assign({}, invoice, {
        id: invoice.id || uid('inv'),
        createdAt: invoice.createdAt || now,
        updatedAt: now,
        verifiedAt: now
      });
      this.data.invoices.unshift(record);
      this.refreshAll(false);
      this.persist();
      return record;
    },

    update: function (id, patch) {
      const idx = this.data.invoices.findIndex(function (item) { return item.id === id; });
      if (idx < 0) return null;
      this.data.invoices[idx] = Object.assign({}, this.data.invoices[idx], patch, {
        updatedAt: new Date().toISOString(),
        verifiedAt: new Date().toISOString()
      });
      this.refreshAll(false);
      this.persist();
      return this.data.invoices[idx];
    },

    remove: function (ids) {
      const set = new Set(Array.isArray(ids) ? ids : [ids]);
      const before = this.data.invoices.length;
      this.data.invoices = this.data.invoices.filter(function (item) { return !set.has(item.id); });
      this.refreshAll(false);
      this.persist();
      return before - this.data.invoices.length;
    },

    clearAll: function () {
      this.data.invoices = [];
      this.data.seeded = true;
      this.data.settings.demoNoticeDismissed = true;
      this.persist();
    },

    resetDemo: function () {
      this.data.invoices = buildSeed();
      this.data.seeded = true;
      this.data.settings.demoNoticeDismissed = false;
      this.refreshAll(false);
      this.persist();
      return this.data.invoices.length;
    },

    refreshAll: function (persistAfter) {
      const settings = this.settings();
      const list = this.data.invoices;
      const ids = new Set();
      list.forEach(function (invoice) {
        if (invoice.id) ids.add(invoice.id);
      });
      list.forEach(function (invoice) {
        if (!invoice.id || ids.has(invoice.id) === false) {
          invoice.id = uid('inv');
          ids.add(invoice.id);
        }
        const report = evaluateInvoice(invoice, { invoices: list, settings: settings, selfId: invoice.id });
        invoice.status = report.status;
        invoice.riskScore = report.score;
        invoice.issues = report.issues;
      });
      if (persistAfter) this.persist(true);
    },

    exportBackup: function () {
      return {
        app: '票清 · 个人发票检验平台',
        version: IP.APP_VERSION,
        exportedAt: new Date().toISOString(),
        settings: this.data.settings,
        invoices: this.data.invoices
      };
    },

    importBackup: function (text) {
      let payload;
      try {
        payload = JSON.parse(text);
      } catch (err) {
        throw new Error('文件不是有效的 JSON 备份');
      }
      if (!payload || !Array.isArray(payload.invoices)) {
        throw new Error('备份文件缺少 invoices 数据');
      }
      const cleaned = payload.invoices.filter(function (item) {
        return item && typeof item === 'object' && item.number;
      }).map(function (item, index) {
        return Object.assign({}, item, {
          id: item.id || uid('inv'),
          createdAt: item.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          attachment: item.attachment && item.attachment.data ? item.attachment : null
        });
      });
      if (!cleaned.length) throw new Error('备份文件中没有可导入的发票');
      this.data.invoices = cleaned;
      if (payload.settings) {
        this.data.settings = Object.assign({}, IP.DEFAULT_SETTINGS, payload.settings);
      }
      this.data.seeded = true;
      this.refreshAll(false);
      this.persist();
      return cleaned.length;
    }
  };

  function toCSV(invoices) {
    const headers = ['发票类型', '发票代码', '发票号码', '开票日期', '购买方名称', '购买方税号', '销售方名称', '销售方税号', '项目名称', '金额', '税率', '税额', '价税合计', '查验状态', '风险分', '备注'];
    function cell(value) {
      const text = value == null ? '' : String(value);
      return '"' + text.replace(/"/g, '""').replace(/\r?\n/g, ' ') + '"';
    }
    const rows = invoices.map(function (inv) {
      const report = evaluateInvoice(inv, { invoices: invoices, settings: DB.settings(), selfId: inv.id });
      return [
        IP.getType(inv.type).label, inv.code || '', inv.number, inv.date,
        inv.buyerName || '', inv.buyerTaxId || '', inv.sellerName || '', inv.sellerTaxId || '',
        inv.itemName || '', Number(inv.amount || 0).toFixed(2), IP.percent(inv.taxRate),
        Number(inv.taxAmount || 0).toFixed(2), Number(inv.total || 0).toFixed(2),
        IP.STATUS[report.status] ? IP.STATUS[report.status].label : '', report.score, inv.remark || ''
      ].map(cell).join(',');
    });
    return '\uFEFF' + headers.map(cell).join(',') + '\r\n' + rows.join('\r\n');
  }

  function downloadFile(filename, content, mime) {
    const blob = new Blob([content], { type: mime || 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 400);
  }

  IP.DB = DB;
  IP.toCSV = toCSV;
  IP.downloadFile = downloadFile;
  IP.buildSeed = buildSeed;
})(window);
