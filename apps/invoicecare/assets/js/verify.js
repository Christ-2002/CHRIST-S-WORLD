/* 票清 · 发票查验工作台（录入、识别、校验、报告、详情） */
(function (global) {
  'use strict';

  const IP = global.IP;
  const UI = IP.UI;
  const DB = IP.DB;
  const $ = IP.$;
  const $$ = IP.$$;
  const esc = IP.escapeHtml;
  const icon = IP.icon;

  const state = {
    form: null,
    attachment: null,
    editId: null,
    lastReport: null,
    decodedInfo: '',
    mounted: false
  };

  const SAMPLE_TEXT = [
    '发票类型：电子发票（普通）',
    '发票代码：031002300111',
    '发票号码：12345678',
    '开票日期：2026年10月18日',
    '购买方名称：青禾数字科技（上海）有限公司',
    '购买方税号：91310000MA1H8N6P44',
    '销售方名称：上海云启信息技术有限公司',
    '销售方税号：91320594MA1W8E5R7F',
    '项目名称：*信息技术服务*技术服务费',
    '金额：12500.00',
    '税率：6%',
    '税额：750.00',
    '价税合计：13250.00',
    '校验码：12345678901234567890'
  ].join('\n');

  function currentSettings() { return DB.settings(); }

  function mount(container, editId) {
    state.mounted = true;
    const targetId = editId || null;
    if (targetId) {
      const invoice = DB.invoices().find(function (item) { return item.id === targetId; });
      if (invoice) {
        state.form = JSON.parse(JSON.stringify(invoice));
        state.attachment = invoice.attachment || null;
        state.editId = invoice.id;
        state.decodedInfo = '';
      } else {
        UI.toast('未找到该发票，已为你打开新建查验', 'error');
        startNew();
      }
    } else if (!state.form || state.editId) {
      startNew();
    }
    paint(container);
  }

  function startNew() {
    state.form = IP.blankInvoice(currentSettings());
    state.attachment = null;
    state.editId = null;
    state.lastReport = null;
    state.decodedInfo = '';
    state.form.source = 'manual';
  }

  function reset() {
    startNew();
    state.mounted = false;
  }

  function paint(container) {
    if (!state.form) startNew();
    const f = state.form;
    const type = IP.getType(f.type);
    const editing = !!state.editId;
    container.innerHTML =
      '<section class="page verify-page">' +
        '<div class="page-head">' +
          '<div><div class="page-kicker">发票采集与初筛</div><h2>' + (editing ? '编辑发票并重新查验' : '发票查验') + '</h2>' +
          '<p>上传票面或手动录入，完成票面要素、税号与金额勾稽的本地合规初筛。带 <span class="text-danger">*</span> 为关键要素。</p></div>' +
          '<div class="page-head-actions">' +
            '<a class="btn btn-secondary btn-sm" href="#/ledger">' + icon('i-list') + '发票台账</a>' +
            '<button class="btn btn-ghost btn-sm" type="button" id="helpVerifyBtn">' + icon('i-help') + '查验说明</button>' +
          '</div>' +
        '</div>' +
        '<div class="verify-grid">' +
          '<div class="verify-main">' + renderForm(f, type, editing) + '</div>' +
          '<aside class="verify-rail">' +
            renderUpload() +
            renderLive() +
            '<div class="tip-card">' +
              '<h4>' + icon('i-info') + '识别说明</h4>' +
              '<p>上传含二维码的发票图片，系统会本地解码并回填代码、号码、日期、金额与校验码。</p>' +
              '<p>也可以粘贴 PDF / OFD 中的票面文本，自动提取关键字段，减少手工录入。</p>' +
            '</div>' +
          '</aside>' +
        '</div>' +
      '</section>';
    bindPage(container);
    refreshLive();
    refreshTaxHints();
    updateCalcUI();
  }

  function value(name) {
    const v = state.form ? state.form[name] : '';
    return v == null ? '' : v;
  }

  function inputValue(name) {
    return esc(String(value(name)));
  }

  function renderForm(f, type, editing) {
    const rates = IP.TAX_RATES.map(function (r) {
      return '<option value="' + r.value + '"' + (Number(f.taxRate) === r.value ? ' selected' : '') + '>' + r.label + '</option>';
    }).join('');

    return '<form class="card form-card" id="verifyForm" novalidate>' +
      '<div class="form-card-head">' +
        '<span class="form-step">01</span>' +
        '<div class="form-card-head-text"><h3>票面信息</h3><p>按发票原件录入，系统会同步进行格式与勾稽检查</p></div>' +
        (editing ? '<span class="chip chip-warn">' + icon('i-edit') + '编辑模式</span>' : '<span class="chip">' + icon('i-lock') + '本地处理</span>') +
      '</div>' +

      '<div class="form-section">' +
        '<div class="form-section-title"><h4>基本信息</h4><span class="line"></span><span class="badge">INVOICE</span></div>' +
        '<div class="form-grid">' +
          '<div class="field">' +
            '<label class="field-label" for="fType">发票类型 <span class="req">*</span></label>' +
            '<select class="select" id="fType" data-field="type">' +
              IP.TYPE_LIST.map(function (t) {
                return '<option value="' + t.key + '"' + (f.type === t.key ? ' selected' : '') + '>' + t.label + '</option>';
              }).join('') +
            '</select>' +
          '</div>' +
          '<div class="field">' +
            '<label class="field-label" for="fDate">开票日期 <span class="req">*</span></label>' +
            '<input class="input input-num" type="date" id="fDate" data-field="date" max="' + IP.todayISO() + '" value="' + inputValue('date') + '">' +
          '</div>' +
          '<div class="field">' +
            '<label class="field-label" for="fCode">发票代码 <span class="opt" id="codeOptional">' + (type.codeRequired ? '' : '（数电票无需填写）') + '</span></label>' +
            '<input class="input input-num" id="fCode" data-field="code" inputmode="numeric" maxlength="12" placeholder="' + (type.codeRequired ? '请输入 10–12 位代码' : '如无则留空') + '" value="' + inputValue('code') + '">' +
            '<span class="field-hint" id="codeHint">' + esc(type.hint) + '</span>' +
          '</div>' +
          '<div class="field">' +
            '<label class="field-label" for="fNumber">发票号码 <span class="req">*</span></label>' +
            '<input class="input input-num" id="fNumber" data-field="number" inputmode="numeric" maxlength="20" placeholder="请输入发票号码" value="' + inputValue('number') + '">' +
            '<span class="field-hint" id="numberHint">' + (type.numLen[0] === type.numLen[1] ? type.numLen[0] + ' 位数字' : type.numLen[0] + '–' + type.numLen[1] + ' 位数字') + '</span>' +
          '</div>' +
          '<div class="field span-2">' +
            '<label class="field-label" for="fCheckCode">校验码 <span class="opt">选填 · 票面校验码后 6 位或完整校验码</span></label>' +
            '<input class="input input-num" id="fCheckCode" data-field="checkCode" inputmode="numeric" maxlength="20" placeholder="传统发票可填写 20 位校验码" value="' + inputValue('checkCode') + '">' +
          '</div>' +
        '</div>' +
      '</div>' +

      '<div class="form-section">' +
        '<div class="form-section-title"><h4>交易双方</h4><span class="line"></span><span class="badge">PARTIES</span></div>' +
        '<div class="form-grid">' +
          '<div class="field">' +
            '<label class="field-label" for="fBuyerName">购买方名称 <span class="req">*</span></label>' +
            '<input class="input" id="fBuyerName" data-field="buyerName" maxlength="80" placeholder="公司或个人抬头" value="' + inputValue('buyerName') + '">' +
          '</div>' +
          '<div class="field">' +
            '<label class="field-label" for="fBuyerTaxId">购买方纳税人识别号</label>' +
            '<div class="inline-actions">' +
              '<input class="input input-num" id="fBuyerTaxId" data-field="buyerTaxId" maxlength="20" placeholder="18 位统一社会信用代码" value="' + inputValue('buyerTaxId') + '" style="flex:1">' +
              '<button class="btn btn-secondary btn-sm" type="button" id="fillDefaultBtn" title="填入默认抬头">默认</button>' +
            '</div>' +
            '<span class="field-hint" id="buyerTaxHint">将按 GB 32100 规则校验校验位</span>' +
          '</div>' +
          '<div class="field">' +
            '<label class="field-label" for="fSellerName">销售方名称 <span class="req">*</span></label>' +
            '<input class="input" id="fSellerName" data-field="sellerName" maxlength="80" placeholder="开票方名称" value="' + inputValue('sellerName') + '">' +
          '</div>' +
          '<div class="field">' +
            '<label class="field-label" for="fSellerTaxId">销售方纳税人识别号 <span class="req">*</span></label>' +
            '<input class="input input-num" id="fSellerTaxId" data-field="sellerTaxId" maxlength="20" placeholder="18 位统一社会信用代码" value="' + inputValue('sellerTaxId') + '">' +
            '<span class="field-hint" id="sellerTaxHint">用于校验开票主体税号是否有效</span>' +
          '</div>' +
        '</div>' +
      '</div>' +

      '<div class="form-section">' +
        '<div class="form-section-title"><h4>金额与税额</h4><span class="line"></span><span class="badge">AMOUNT</span></div>' +
        '<div class="form-grid">' +
          '<div class="field span-2">' +
            '<label class="field-label" for="fItem">项目名称 <span class="opt">货物或应税劳务、服务名称</span></label>' +
            '<input class="input" id="fItem" data-field="itemName" maxlength="120" placeholder="如：*信息技术服务*技术服务费" value="' + inputValue('itemName') + '">' +
          '</div>' +
          '<div class="field">' +
            '<label class="field-label" for="fAmount">金额（不含税） <span class="req">*</span></label>' +
            '<div class="input-group"><span class="input-prefix">¥</span>' +
              '<input class="input input-num" id="fAmount" data-field="amount" inputmode="decimal" placeholder="0.00" value="' + inputValue('amount') + '">' +
            '</div>' +
          '</div>' +
          '<div class="field">' +
            '<label class="field-label" for="fRate">税率</label>' +
            '<select class="select" id="fRate" data-field="taxRate">' + rates + '</select>' +
          '</div>' +
          '<div class="field">' +
            '<label class="field-label" for="fTax">税额</label>' +
            '<div class="input-group"><span class="input-prefix">¥</span>' +
              '<input class="input input-num input-calc" id="fTax" data-field="taxAmount" inputmode="decimal" placeholder="自动计算" value="' + inputValue('taxAmount') + '">' +
            '</div>' +
          '</div>' +
          '<div class="field">' +
            '<label class="field-label" for="fTotal">价税合计 <span class="req">*</span></label>' +
            '<div class="input-group"><span class="input-prefix">¥</span>' +
              '<input class="input input-num input-calc" id="fTotal" data-field="total" inputmode="decimal" placeholder="自动计算" value="' + inputValue('total') + '">' +
            '</div>' +
          '</div>' +
          '<div class="span-2" id="calcHintBox">' +
            '<div class="verify-note">' + icon('i-info') +
              '<span id="calcHint">税额与价税合计默认按「金额 × 税率」自动计算；手动修改后将校验票面勾稽关系。</span>' +
            '</div>' +
            '<button class="text-link mt-8" type="button" id="autoCalcBtn" hidden>恢复自动计算</button>' +
          '</div>' +
        '</div>' +
      '</div>' +

      '<div class="form-section">' +
        '<div class="form-section-title"><h4>备注</h4><span class="line"></span><span class="badge">NOTE</span></div>' +
        '<div class="field">' +
          '<textarea class="textarea" id="fRemark" data-field="remark" maxlength="300" placeholder="可记录报销项目、使用部门、关联合同等备注信息">' + esc(f.remark || '') + '</textarea>' +
        '</div>' +
      '</div>' +

      '<div class="form-actions">' +
        '<div class="form-actions-left">' +
          '<button class="btn btn-ghost btn-sm" type="button" id="clearFormBtn">' + icon('i-refresh') + '清空</button>' +
          '<span class="hint">数据仅保存在本机浏览器</span>' +
        '</div>' +
        '<div class="form-actions-right">' +
          (editing ? '<a class="btn btn-secondary" href="#/ledger">取消编辑</a>' : '') +
          '<button class="btn btn-primary btn-lg" type="button" id="startVerifyBtn">' +
            icon('i-shield-check') + '开始查验' +
          '</button>' +
        '</div>' +
      '</div>' +
    '</form>';
  }

  function renderUpload() {
    const a = state.attachment;
    let body;
    if (a) {
      const isPdf = a.type === 'application/pdf';
      body =
        '<div class="upload-preview">' +
          '<div class="preview-canvas">' +
            (a.data && !isPdf
              ? '<img src="' + a.data + '" alt="发票预览">' + (state.decodedInfo ? '<span class="preview-scan"></span>' : '')
              : '<div class="pdf-preview">' + icon('i-file') + '<span>' + esc(a.name || 'PDF 文件') + '</span><span class="text-xs muted-2">已关联，可在查验后归档</span></div>') +
          '</div>' +
          '<div class="preview-meta">' +
            '<span class="invoice-icon">' + icon(isPdf ? 'i-file' : 'i-image') + '</span>' +
            '<div class="preview-meta-text"><strong>' + esc(a.name || '发票附件') + '</strong><span>' + (a.size ? (a.size / 1024).toFixed(0) + ' KB · ' : '') + (state.decodedInfo ? '二维码已识别' : '本地附件') + '</span></div>' +
            '<button class="icon-btn icon-btn-xs" type="button" id="removeAttachmentBtn" title="移除附件">' + icon('i-x') + '</button>' +
          '</div>' +
        '</div>' +
        (state.decodedInfo ? '<div class="qr-result">' + icon('i-check-circle') + '<span>' + esc(state.decodedInfo) + '</span></div>' : '');
    } else {
      body =
        '<div class="dropzone" id="dropzone" tabindex="0" role="button" aria-label="上传发票图片或 PDF">' +
          '<span class="dropzone-icon">' + icon('i-upload-cloud') + '</span>' +
          '<strong>拖拽发票到这里，或点击上传</strong>' +
          '<span>支持 JPG / PNG / WEBP / PDF<br>图片二维码将在本地自动识别</span>' +
          '<span class="drop-actions"><span class="btn btn-soft">选择文件</span></span>' +
        '</div>';
    }
    return '<div class="card upload-card">' +
      '<div class="upload-head"><h3>' + icon('i-scan') + '票面识别</h3><p>上传图片自动读取二维码，也可以粘贴文本快速录入</p></div>' +
      '<div class="upload-body">' + body +
        '<div class="upload-alt">' +
          '<button class="btn btn-secondary" type="button" id="parseTextBtn">' + icon('i-file-down') + '粘贴文本识别</button>' +
          '<button class="btn btn-secondary" type="button" id="loadSampleBtn">' + icon('i-file') + '载入示例</button>' +
        '</div>' +
        '<div class="upload-note">' + icon('i-lock') + '全部识别与存储均在本机完成</div>' +
      '</div>' +
    '</div>';
  }

  function renderLive() {
    return '<div class="card live-card">' +
      '<div class="live-head"><h3>' + icon('i-shield-check') + '实时校验</h3><span class="chip" id="liveStatusChip">待完善</span></div>' +
      '<div class="live-progress">' +
        '<div class="progress-meta"><span>资料完整度</span><strong id="livePercent">0%</strong></div>' +
        '<div class="progress-track"><div class="progress-fill" id="liveProgress" style="width:0%"></div></div>' +
      '</div>' +
      '<div class="live-check-list" id="liveCheckList"></div>' +
    '</div>';
  }

  function liveRows() {
    const f = state.form;
    const report = IP.evaluateInvoice(f, { invoices: DB.invoices(), settings: currentSettings(), selfId: state.editId || f.id });
    const byKey = {};
    report.checks.forEach(function (c) { byKey[c.key] = c; });
    const core = ['required', 'number', 'buyerTaxId', 'sellerTaxId', 'taxMath', 'totalMath', 'duplicate'];
    const filledMap = {
      required: !!(f.number && f.date && f.sellerName && Number(f.amount) > 0),
      number: !!f.number,
      buyerTaxId: !!f.buyerTaxId,
      sellerTaxId: !!f.sellerTaxId,
      taxMath: Number(f.amount) > 0,
      totalMath: Number(f.total) > 0,
      duplicate: !!f.number
    };
    return core.map(function (key) {
      const check = byKey[key] || { label: key, status: 'pass', detail: '' };
      let status = check.status;
      if (!filledMap[key]) status = 'pending';
      if (key === 'buyerTaxId' && !f.buyerTaxId && (f.type === 'vat_special' || f.type === 'digital_special')) status = 'fail';
      return {
        label: check.label,
        status: status,
        detail: status === 'pending' ? '待补充相关信息' : check.detail,
        severity: check.severity
      };
    });
  }

  function refreshLive() {
    if (!state.mounted) return;
    const list = $('#liveCheckList');
    if (!list) return;
    const f = state.form;
    const fields = [f.number, f.date, f.buyerName, f.sellerName, f.sellerTaxId, f.amount, f.total];
    const done = fields.filter(function (v) { return v !== '' && v != null; }).length;
    const percent = Math.round((done / fields.length) * 100);
    $('#livePercent').textContent = percent + '%';
    $('#liveProgress').style.width = percent + '%';
    const rows = liveRows();
    const chip = $('#liveStatusChip');
    const hasFail = rows.some(function (r) { return r.status === 'fail'; });
    const hasWarn = rows.some(function (r) { return r.status === 'warn'; });
    if (chip) {
      chip.className = 'chip ' + (hasFail ? 'chip-danger' : hasWarn ? 'chip-warn' : (percent >= 85 ? 'chip-pass' : ''));
      chip.textContent = hasFail ? '存在风险' : hasWarn ? '需关注' : (percent >= 85 ? '可查验' : '待完善');
    }
    list.innerHTML = rows.map(function (row) {
      let stateClass = row.status;
      let stateIcon = row.status === 'pass' ? 'i-check' : row.status === 'warn' ? 'i-alert' : row.status === 'fail' ? 'i-x' : 'i-minus';
      const flag = row.status === 'fail' && row.severity === 'high' ? '高风险' : row.status === 'warn' ? '提醒' : '';
      return '<div class="live-check">' +
        '<span class="check-state ' + stateClass + '">' + icon(stateIcon) + '</span>' +
        '<div class="check-main"><strong>' + esc(row.label) + '</strong><span>' + esc(row.detail || '') + '</span></div>' +
        (flag ? '<span class="check-flag">' + flag + '</span>' : '') +
      '</div>';
    }).join('');
  }

  function refreshTaxHints() {
    if (!state.mounted) return;
    const buyer = $('#buyerTaxHint');
    const seller = $('#sellerTaxHint');
    if (buyer) {
      const v = state.form.buyerTaxId;
      if (!v) { buyer.className = 'field-hint'; buyer.textContent = '将按 GB 32100 规则校验校验位'; }
      else {
        const r = IP.validateTaxId(v);
        buyer.className = 'field-hint ' + (r.valid ? 'is-ok' : 'is-error');
        buyer.textContent = r.message;
      }
    }
    if (seller) {
      const v = state.form.sellerTaxId;
      if (!v) { seller.className = 'field-hint'; seller.textContent = '用于校验开票主体税号是否有效'; }
      else {
        const r = IP.validateTaxId(v);
        seller.className = 'field-hint ' + (r.valid ? 'is-ok' : 'is-error');
        seller.textContent = r.message;
      }
    }
  }

  function updateCalcUI() {
    if (!state.mounted) return;
    const btn = $('#autoCalcBtn');
    const hint = $('#calcHint');
    const tax = $('#fTax');
    const total = $('#fTotal');
    if (!btn || !hint) return;
    if (state.form.manualAmounts) {
      btn.hidden = false;
      hint.textContent = '已手动调整税额或价税合计，查验时将核对金额、税额与合计之间的勾稽差异。';
      if (tax) tax.classList.remove('input-calc');
      if (total) total.classList.remove('input-calc');
    } else {
      btn.hidden = true;
      hint.textContent = '税额与价税合计默认按「金额 × 税率」自动计算；手动修改后将校验票面勾稽关系。';
      if (tax) tax.classList.add('input-calc');
      if (total) total.classList.add('input-calc');
    }
  }

  function recalcAmounts() {
    const f = state.form;
    if (f.manualAmounts) return;
    const amount = Number(f.amount);
    const rate = Number(f.taxRate);
    if (!isFinite(amount) || amount <= 0) {
      f.taxAmount = '';
      f.total = '';
    } else {
      const tax = IP.round2(amount * rate);
      f.taxAmount = tax.toFixed(2);
      f.total = IP.round2(amount + tax).toFixed(2);
    }
    const taxInput = $('#fTax');
    const totalInput = $('#fTotal');
    if (taxInput) taxInput.value = f.taxAmount;
    if (totalInput) totalInput.value = f.total;
  }

  function setTypeHints() {
    const f = state.form;
    const type = IP.getType(f.type);
    const codeHint = $('#codeHint');
    const numberHint = $('#numberHint');
    const codeOptional = $('#codeOptional');
    if (codeHint) codeHint.textContent = type.hint;
    if (numberHint) numberHint.textContent = type.numLen[0] === type.numLen[1] ? type.numLen[0] + ' 位数字' : type.numLen[0] + '–' + type.numLen[1] + ' 位数字';
    if (codeOptional) codeOptional.textContent = type.codeRequired ? '' : '（数电票无需填写）';
  }

  function bindPage(container) {
    const form = $('#verifyForm');
    if (!form) return;

    form.addEventListener('input', function (event) {
      const el = event.target.closest('[data-field]');
      if (!el) return;
      const field = el.getAttribute('data-field');
      if (field === 'taxRate') {
        state.form.taxRate = Number(el.value);
      } else {
        state.form[field] = el.value;
      }
      el.classList.remove('is-error');
      if (field === 'amount' || field === 'taxRate') {
        state.form.manualAmounts = false;
        recalcAmounts();
        updateCalcUI();
      }
      if (field === 'taxAmount' || field === 'total') {
        state.form.manualAmounts = true;
        updateCalcUI();
      }
      if (field === 'buyerTaxId' || field === 'sellerTaxId') refreshTaxHints();
      refreshLive();
    });

    form.addEventListener('change', function (event) {
      const el = event.target.closest('[data-field]');
      if (!el) return;
      const field = el.getAttribute('data-field');
      if (field === 'type') {
        state.form.type = el.value;
        setTypeHints();
        refreshLive();
      }
    });

    const defaultBtn = $('#fillDefaultBtn');
    if (defaultBtn) {
      defaultBtn.addEventListener('click', function () {
        const s = currentSettings();
        state.form.buyerName = s.buyerName || '';
        state.form.buyerTaxId = s.buyerTaxId || '';
        const nameInput = $('#fBuyerName');
        const taxInput = $('#fBuyerTaxId');
        if (nameInput) nameInput.value = state.form.buyerName;
        if (taxInput) taxInput.value = state.form.buyerTaxId;
        refreshTaxHints();
        refreshLive();
        UI.toast('已填入默认抬头信息');
      });
    }

    const autoBtn = $('#autoCalcBtn');
    if (autoBtn) {
      autoBtn.addEventListener('click', function () {
        state.form.manualAmounts = false;
        recalcAmounts();
        updateCalcUI();
        refreshLive();
      });
    }

    const startBtn = $('#startVerifyBtn');
    if (startBtn) startBtn.addEventListener('click', runVerification);

    const clearBtn = $('#clearFormBtn');
    if (clearBtn) {
      clearBtn.addEventListener('click', async function () {
        const hasData = state.form.number || state.form.sellerName || state.form.amount || state.attachment;
        if (hasData) {
          const ok = await UI.confirm({
            title: '清空当前录入？',
            message: '已填写的内容和关联附件将被清除，此操作不可撤销。',
            confirmText: '清空',
            tone: 'danger',
            icon: 'i-refresh'
          });
          if (!ok) return;
        }
        startNew();
        paint(container);
        UI.toast('已清空录入内容', 'info');
      });
    }

    const sampleBtn = $('#loadSampleBtn');
    if (sampleBtn) {
      sampleBtn.addEventListener('click', function () {
        const parsed = IP.parseInvoiceText(SAMPLE_TEXT);
        applyParsed(parsed);
        state.form.source = 'text';
        paint(container);
        UI.toast('已载入示例发票，点击「开始查验」体验完整流程');
      });
    }

    const parseBtn = $('#parseTextBtn');
    if (parseBtn) parseBtn.addEventListener('click', openParseModal);

    const helpBtn = $('#helpVerifyBtn');
    if (helpBtn) helpBtn.addEventListener('click', showHelp);

    const removeBtn = $('#removeAttachmentBtn');
    if (removeBtn) {
      removeBtn.addEventListener('click', function () {
        state.attachment = null;
        state.decodedInfo = '';
        paint(container);
        UI.toast('已移除附件', 'info');
      });
    }

    bindUpload(container);
    if (!state.fileBound) {
      const input = $('#imageInput');
      if (input) {
        input.addEventListener('change', function () {
          const file = input.files && input.files[0];
          if (file) handleFile(file, container);
          input.value = '';
        });
      }
      state.fileBound = true;
    }
  }

  function bindUpload(container) {
    const dropzone = $('#dropzone');
    if (!dropzone) return;
    const openPicker = function () {
      const input = $('#imageInput');
      if (input) input.click();
    };
    dropzone.addEventListener('click', openPicker);
    dropzone.addEventListener('keydown', function (event) {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        openPicker();
      }
    });
    ['dragenter', 'dragover'].forEach(function (name) {
      dropzone.addEventListener(name, function (event) {
        event.preventDefault();
        dropzone.classList.add('is-dragging');
      });
    });
    ['dragleave', 'drop'].forEach(function (name) {
      dropzone.addEventListener(name, function (event) {
        event.preventDefault();
        dropzone.classList.remove('is-dragging');
      });
    });
    dropzone.addEventListener('drop', function (event) {
      const file = event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files[0];
      if (file) handleFile(file, container);
    });
  }

  function handleFile(file, container) {
    const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
    const isImage = /^image\//.test(file.type);
    if (!isPdf && !isImage) {
      UI.toast('请选择图片或 PDF 文件', 'error');
      return;
    }
    if (file.size > 12 * 1024 * 1024) {
      UI.toast('文件超过 12MB，请压缩后再上传', 'error');
      return;
    }
    if (isPdf) {
      state.attachment = { name: file.name, type: 'application/pdf', size: file.size, data: null };
      state.decodedInfo = '';
      paint(container);
      UI.toast('PDF 已关联。可点击「粘贴文本识别」快速录入票面信息', 'info');
      return;
    }

    const reader = new FileReader();
    reader.onload = function (event) {
      const img = new Image();
      img.onload = function () {
        const maxSide = 1400;
        const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        let dataUrl = '';
        try { dataUrl = canvas.toDataURL('image/jpeg', 0.82); } catch (err) { dataUrl = event.target.result; }

        let qrData = '';
        try {
          if (typeof global.jsQR === 'function') {
            const qrCanvas = document.createElement('canvas');
            const qrScale = Math.min(1, 1000 / Math.max(img.width, img.height));
            qrCanvas.width = Math.max(1, Math.round(img.width * qrScale));
            qrCanvas.height = Math.max(1, Math.round(img.height * qrScale));
            const qrCtx = qrCanvas.getContext('2d');
            qrCtx.drawImage(img, 0, 0, qrCanvas.width, qrCanvas.height);
            const imageData = qrCtx.getImageData(0, 0, qrCanvas.width, qrCanvas.height);
            const result = global.jsQR(imageData.data, qrCanvas.width, qrCanvas.height, { inversionAttempts: 'attemptBoth' });
            if (result && result.data) qrData = result.data;
          }
        } catch (err) { console.warn('二维码识别失败：', err); }

        state.attachment = { name: file.name, type: 'image/jpeg', size: Math.round(dataUrl.length * 0.75), data: dataUrl };
        state.decodedInfo = '';

        const parsed = qrData ? IP.parseQRContent(qrData) : null;
        if (parsed) {
          Object.keys(parsed).forEach(function (key) {
            if (parsed[key] !== '' && parsed[key] != null) state.form[key] = parsed[key];
          });
          if (parsed.amount != null && !parsed.taxAmount && !parsed.total) {
            state.form.manualAmounts = false;
            recalcAmounts();
          }
          state.form.source = 'qr';
          state.decodedInfo = '二维码识别成功：号码 ' + (state.form.number || '—') + ' · 金额 ¥' + IP.money(state.form.amount || 0);
          paint(container);
          UI.toast('已识别发票二维码并回填关键字段，请核对税率与金额');
        } else {
          paint(container);
          UI.toast(qrData ? '二维码已读取，但内容不是标准票面信息，请手动补充' : '图片已关联，未识别到有效二维码，可手动录入', 'info');
        }
      };
      img.onerror = function () {
        UI.toast('图片读取失败，请换一张图片重试', 'error');
      };
      img.src = event.target.result;
    };
    reader.onerror = function () { UI.toast('文件读取失败', 'error'); };
    reader.readAsDataURL(file);
  }

  function applyParsed(parsed) {
    if (!parsed) return 0;
    let count = 0;
    Object.keys(parsed).forEach(function (key) {
      if (parsed[key] === '' || parsed[key] == null) return;
      if (key === 'manualAmounts') return;
      state.form[key] = parsed[key];
      count++;
    });
    if (parsed.manualAmounts) {
      state.form.manualAmounts = true;
    } else if (parsed.amount != null && !parsed.taxAmount && !parsed.total) {
      state.form.manualAmounts = false;
      recalcAmounts();
    }
    return count;
  }

  function openParseModal() {
    const body =
      '<p class="parse-help">从 PDF、OFD 或电子发票中复制票面文字，粘贴到下方。系统会自动识别发票代码、号码、日期、交易方、金额与税额等字段。</p>' +
      '<textarea class="textarea parse-textarea" id="parseText" placeholder="在此粘贴票面文本…" autofocus></textarea>' +
      '<div class="parse-example"><strong>示例文本（可点击“填入示例”）</strong>' + esc(SAMPLE_TEXT) + '</div>';
    const footer =
      '<button class="btn btn-secondary" type="button" data-close-modal>取消</button>' +
      '<button class="btn btn-ghost btn-sm left" type="button" id="fillExampleBtn">填入示例</button>' +
      '<button class="btn btn-primary" type="button" id="doParseBtn">' + icon('i-file-down') + '自动解析</button>';
    const html = UI.buildModal({
      title: '粘贴票面文本识别',
      subtitle: '本地规则解析，不会上传任何内容',
      icon: 'i-file-down',
      className: 'modal-md',
      body: body,
      footer: footer
    });
    UI.openModal(html, {
      onMount: function (modal) {
        const textarea = $('#parseText', modal);
        const fill = $('#fillExampleBtn', modal);
        const parse = $('#doParseBtn', modal);
        if (fill) fill.addEventListener('click', function () {
          textarea.value = SAMPLE_TEXT;
          textarea.focus();
          textarea.setSelectionRange(0, 0);
        });
        if (parse) parse.addEventListener('click', function () {
          const text = textarea.value.trim();
          if (!text) {
            UI.toast('请先粘贴票面文本', 'error');
            textarea.focus();
            return;
          }
          const parsed = IP.parseInvoiceText(text);
          const count = Object.keys(parsed).filter(function (k) { return k !== 'manualAmounts' && parsed[k] !== '' && parsed[k] != null; }).length;
          if (!count) {
            UI.toast('未能识别有效字段，请检查文本格式或改用示例', 'error');
            return;
          }
          applyParsed(parsed);
          state.form.source = 'text';
          UI.closeModal();
          paint(document.getElementById('app'));
          UI.toast('已识别并回填 ' + count + ' 项信息，请核对后查验');
        });
      }
    });
  }

  function runVerification() {
    if (!state.mounted) return;
    const f = state.form;
    const missing = [];
    const checks = [
      { key: 'number', selector: '#fNumber', label: '发票号码' },
      { key: 'date', selector: '#fDate', label: '开票日期' },
      { key: 'sellerName', selector: '#fSellerName', label: '销售方名称' },
      { key: 'amount', selector: '#fAmount', label: '金额' }
    ];
    checks.forEach(function (c) {
      const val = f[c.key];
      if (val === '' || val == null || (c.key === 'amount' && !(Number(val) > 0))) {
        missing.push(c.label);
        const el = $(c.selector);
        if (el) el.classList.add('is-error');
      }
    });
    if (missing.length) {
      UI.toast('请先填写：' + missing.join('、'), 'error');
      const first = checks.find(function (c) { return missing.indexOf(c.label) >= 0; });
      const el = first ? $(first.selector) : null;
      if (el) {
        el.focus();
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }

    const invoice = Object.assign({}, f, {
      id: state.editId || null,
      amount: Number(f.amount) || 0,
      taxRate: Number(f.taxRate) || 0,
      taxAmount: Number(f.taxAmount) || 0,
      total: Number(f.total) || 0,
      attachment: state.attachment || null,
      source: f.source || 'manual'
    });
    const report = IP.evaluateInvoice(invoice, {
      invoices: DB.invoices(),
      settings: currentSettings(),
      selfId: state.editId || invoice.id
    });
    state.lastReport = { invoice: invoice, report: report, isEdit: !!state.editId };
    LOCK_SCROLL();
    openReport(invoice, report, !!state.editId);
  }

  function LOCK_SCROLL() {
    document.body.classList.add('no-scroll');
  }

  function groupForCheck(key) {
    if (['required', 'code', 'number', 'date', 'checkCode'].indexOf(key) >= 0) return 'base';
    if (['buyerName', 'buyerTaxId', 'sellerTaxId'].indexOf(key) >= 0) return 'party';
    if (['taxMath', 'totalMath'].indexOf(key) >= 0) return 'amount';
    return 'risk';
  }

  function reportStatusCopy(status) {
    if (status === 'passed') return { title: '查验通过，可以归档', desc: '基础要素齐全，未发现明显的票面逻辑或重复风险。建议正式报销前再到税务平台核验。', tone: '' };
    if (status === 'review') return { title: '基本合规，建议人工复核', desc: '平台发现需要关注的事项，请根据下方提示核对原始凭证后再入账。', tone: 'is-warn' };
    return { title: '发现高风险异常，请暂缓报销', desc: '票面存在关键逻辑冲突或重复风险，建议先与开票方核实，暂缓提交报销。', tone: 'is-danger' };
  }

  function openReport(invoice, report, isEdit) {
    const meta = IP.STATUS[report.status];
    const copy = reportStatusCopy(report.status);
    const circumference = 2 * Math.PI * 46;
    const dash = (report.score / 100) * circumference;
    const groups = { base: [], party: [], amount: [], risk: [] };
    report.checks.forEach(function (check) {
      groups[groupForCheck(check.key)].push(check);
    });
    const groupDefs = [
      { key: 'base', label: '票面要素' },
      { key: 'party', label: '交易主体与税号' },
      { key: 'amount', label: '金额勾稽' },
      { key: 'risk', label: '重复查验与风险提示' }
    ];

    const checksHtml = groupDefs.map(function (g) {
      const rows = groups[g.key].map(function (check) {
        const stateIcon = check.status === 'pass' ? 'i-check' : check.status === 'warn' ? 'i-alert' : 'i-x';
        return '<div class="report-check">' +
          '<span class="check-state ' + check.status + '">' + icon(stateIcon) + '</span>' +
          '<div class="report-check-main"><strong>' + esc(check.label) + '</strong><span>' + esc(check.detail) + '</span></div>' +
        '</div>';
      }).join('');
      return '<div class="report-group"><h4>' + esc(g.label) + '<span class="line"></span></h4>' + rows + '</div>';
    }).join('');

    const html =
      '<div class="modal modal-report" role="dialog" aria-modal="true" aria-label="发票查验报告">' +
        '<button class="modal-close report-close" type="button" data-close-modal aria-label="关闭">' + icon('i-x') + '</button>' +
        '<div class="report-banner ' + copy.tone + '">' +
          '<div class="report-score"><div class="score-ring">' +
            '<svg viewBox="0 0 104 104" width="104" height="104">' +
              '<circle class="score-ring-bg" cx="52" cy="52" r="46"/>' +
              '<circle class="score-ring-fill" cx="52" cy="52" r="46" stroke-dasharray="' + dash.toFixed(1) + ' ' + circumference.toFixed(1) + '"/>' +
            '</svg><div class="score-ring-inner"><strong>' + report.score + '</strong><span>合规分</span></div></div></div>' +
          '<div class="report-headline">' +
            '<span class="report-eyebrow">' + icon(meta.icon) + '查验完成 · ' + IP.formatDateTime(report.verifiedAt) + '</span>' +
            '<h2>' + copy.title + '</h2><p>' + copy.desc + '</p>' +
          '</div>' +
          '<div class="report-stamp">' + esc(meta.label) + '</div>' +
        '</div>' +
        '<div class="report-body">' +
          '<div class="report-meta-grid">' +
            '<div class="report-meta"><span>发票号码</span><strong>' + esc(invoice.number || '—') + '</strong></div>' +
            '<div class="report-meta"><span>销方名称</span><strong>' + esc(invoice.sellerName || '—') + '</strong></div>' +
            '<div class="report-meta"><span>价税合计</span><strong class="num">' + IP.moneySign(invoice.total) + '</strong></div>' +
          '</div>' +
          '<div class="report-groups">' + checksHtml + '</div>' +
          '<div class="report-footer">' + icon('i-info') +
            '<span>本报告由票清平台基于本地规则生成，共完成 ' + report.checks.length + ' 项检查（通过 ' + report.passCount + '、提醒 ' + report.warnCount + '、异常 ' + report.failCount + '）。不构成税务机关的正式查验结论，请以<a href="https://inv-veri.chinatax.gov.cn/" target="_blank" rel="noopener">全国增值税发票查验平台</a>结果为准。</span>' +
          '</div>' +
        '</div>' +
        '<div class="report-actions">' +
          '<div class="report-actions-left">' +
            '<button class="btn btn-ghost btn-sm" type="button" id="printReportBtn">' + icon('i-print') + '打印查验单</button>' +
            '<button class="btn btn-ghost btn-sm" type="button" id="copyReportBtn">' + icon('i-copy') + '复制摘要</button>' +
          '</div>' +
          '<div class="report-actions-right">' +
            '<button class="btn btn-secondary" type="button" data-close-modal>返回修改</button>' +
            '<button class="btn btn-primary" type="button" id="saveReportBtn">' + icon(isEdit ? 'i-save' : 'i-check') + (isEdit ? '保存修改' : '保存入台账') + '</button>' +
          '</div>' +
        '</div>' +
      '</div>';

    UI.openModal(html, {
      onMount: function (modal) {
        const printBtn = $('#printReportBtn', modal);
        if (printBtn) printBtn.addEventListener('click', function () { printInvoiceData(invoice, report); });
        const copyBtn = $('#copyReportBtn', modal);
        if (copyBtn) copyBtn.addEventListener('click', function () {
          const lines = [
            '【发票查验摘要】',
            '发票号码：' + invoice.number,
            '销售方：' + invoice.sellerName,
            '开票日期：' + IP.formatDate(invoice.date, 'long'),
            '价税合计：' + IP.moneySign(invoice.total),
            '查验结果：' + IP.STATUS[report.status].label + '（合规分 ' + report.score + '）',
            '异常/提醒：' + (report.issues.length ? report.issues.map(function (i) { return i.label; }).join('；') : '无'),
            '查验时间：' + IP.formatDateTime(report.verifiedAt)
          ];
          UI.copy(lines.join('\n')).then(function (ok) {
            UI.toast(ok ? '查验摘要已复制' : '复制失败，请手动选择文本', ok ? 'success' : 'error');
          });
        });
        const saveBtn = $('#saveReportBtn', modal);
        if (saveBtn) saveBtn.addEventListener('click', function () { saveReport(saveBtn); });
      }
    });
  }

  function saveReport(button) {
    if (!state.lastReport) return;
    const invoice = Object.assign({}, state.lastReport.invoice, { attachment: state.attachment || null });
    const isEdit = state.lastReport.isEdit;
    button.disabled = true;
    try {
      let saved;
      if (isEdit && invoice.id) {
        saved = DB.update(invoice.id, invoice);
      } else {
        delete invoice.id;
        saved = DB.add(invoice);
      }
      UI.closeModal();
      UI.toast(isEdit ? '发票信息已更新并重新校验' : '发票已保存至台账，当前状态：' + IP.STATUS[saved.status].label);
      reset();
      if (IP.router) {
        IP.router.navigate('#/ledger');
        setTimeout(function () { IP.router.openInvoice(saved.id); }, 140);
      }
    } catch (err) {
      button.disabled = false;
      UI.toast(err.message || '保存失败，请重试', 'error', 5000);
    }
  }

  function buildPrintHTML(invoice, report) {
    const type = IP.getType(invoice.type);
    const status = IP.STATUS[report.status];
    const checks = report.checks.map(function (c) {
      const cls = c.status === 'fail' ? 'fail' : c.status === 'warn' ? 'warn' : 'pass';
      const label = c.status === 'pass' ? '通过' : c.status === 'warn' ? '提醒' : '异常';
      return '<tr><td>' + esc(c.label) + '</td><td class="' + cls + '">' + label + '</td><td>' + esc(c.detail) + '</td></tr>';
    }).join('');
    return '<div class="print-doc">' +
      '<div class="print-head">' +
        '<div class="print-brand"><img src="assets/img/logo.svg" alt="票清"><div><h1>票清 · 发票查验报告</h1><p>INVOICECARE · COMPLIANCE CHECK</p></div></div>' +
        '<div class="print-meta">报告编号：QC-' + esc((invoice.number || '00000000').slice(-8)) + '<br>查验时间：' + IP.formatDateTime(report.verifiedAt) + '<br>平台版本：v' + IP.APP_VERSION + '</div>' +
      '</div>' +
      '<div class="print-status">查验结果：' + esc(status.label) + '</div>' +
      '<p class="print-score">合规分：<strong>' + report.score + '</strong> / 100　｜　' + esc(report.issues.length ? report.issues.map(function (i) { return i.label; }).join('、') : '未发现异常') + '</p>' +
      '<table class="print-table">' +
        '<tr><th>发票类型</th><td>' + esc(type.label) + '</td><th>发票代码</th><td>' + esc(invoice.code || '—') + '</td></tr>' +
        '<tr><th>发票号码</th><td>' + esc(invoice.number) + '</td><th>开票日期</th><td>' + esc(invoice.date) + '</td></tr>' +
        '<tr><th>购买方</th><td>' + esc(invoice.buyerName || '—') + '</td><th>购买方税号</th><td>' + esc(invoice.buyerTaxId || '—') + '</td></tr>' +
        '<tr><th>销售方</th><td>' + esc(invoice.sellerName || '—') + '</td><th>销售方税号</th><td>' + esc(invoice.sellerTaxId || '—') + '</td></tr>' +
        '<tr><th>项目名称</th><td colspan="3">' + esc(invoice.itemName || '—') + '</td></tr>' +
        '<tr><th>金额</th><td>' + IP.moneySign(invoice.amount) + '</td><th>税率 / 税额</th><td>' + IP.percent(invoice.taxRate) + ' / ' + IP.moneySign(invoice.taxAmount) + '</td></tr>' +
        '<tr><th>价税合计</th><td>' + IP.moneySign(invoice.total) + '</td><th>校验码</th><td>' + esc(invoice.checkCode || '—') + '</td></tr>' +
        '<tr><th>备注</th><td colspan="3">' + esc(invoice.remark || '—') + '</td></tr>' +
      '</table>' +
      '<table class="print-checks"><thead><tr><th style="width:28%">校验项目</th><th style="width:12%">结果</th><th>说明</th></tr></thead><tbody>' + checks + '</tbody></table>' +
      '<div class="print-foot">本报告由票清 · 个人发票检验平台基于本地规则生成，仅用于个人财务合规初筛，不构成税务机关的正式查验结论。<br>正式报销前请登录国家税务总局全国增值税发票查验平台（inv-veri.chinatax.gov.cn）核验。查验数据保存在本机浏览器，请注意定期备份。</div>' +
      '<div class="print-sign"><span>查验人：____________________</span><span>复核人：____________________</span><span>日期：____年__月__日</span></div>' +
    '</div>';
  }

  function printInvoiceData(invoice, report) {
    const root = document.getElementById('printRoot');
    if (!root) return;
    root.innerHTML = buildPrintHTML(invoice, report);
    setTimeout(function () {
      global.print();
      setTimeout(function () { root.innerHTML = ''; }, 600);
    }, 80);
  }

  function showRules() {
    const rules = [
      ['关键要素完整性', '检查发票类型、号码、开票日期、交易方、金额与价税合计是否齐全。'],
      ['发票代码格式', '按票种检查发票代码是否必填、位数是否正确，以及是否全部为数字。'],
      ['发票号码格式', '按票种检查发票号码位数与纯数字格式，避免号码录入错误。'],
      ['开票日期合理性', '日期不能晚于今天或早于 2000 年，并按照凭证时效设置给出提醒。'],
      ['购买方抬头', '与默认报销主体比对，提示抬头不一致或缺失的情况。'],
      ['购买方税号', '校验纳税人识别号的格式与校验位，并核对是否与默认税号一致。'],
      ['销售方税号', '检查销售方纳税人识别号格式与校验位，避免无效税号入账。'],
      ['税额与税率匹配', '按不含税金额 × 税率重算税额，差异超过 0.02 元时标记异常。'],
      ['价税合计勾稽', '校验不含税金额 + 税额是否等于价税合计，识别票面金额不勾稽。'],
      ['校验码格式', '传统发票校验码应为 6–20 位数字；数电发票通常无需填写。'],
      ['重复发票查验', '按发票代码与号码与历史台账比对，识别重复上传与重复报销。'],
      ['大额交易提示', '价税合计超过 5 万元时，提示留存合同、付款凭证与验收记录。']
    ];
    const body =
      '<div class="rule-reference-intro">' + icon('i-info') +
        '<span>平台在每次查验时于本机执行以下 12 项检查，结果仅作为发票合规初筛参考。</span></div>' +
      '<div class="rule-reference-grid">' + rules.map(function (rule, index) {
        return '<div class="rule-reference-item">' +
          '<span class="rule-reference-no">' + String(index + 1).padStart(2, '0') + '</span>' +
          '<div class="rule-reference-text"><strong>' + rule[0] + '</strong><p>' + rule[1] + '</p></div>' +
        '</div>';
      }).join('') + '</div>' +
      '<div class="notice mt-12">' + icon('i-external') +
        '<span>本地规则无法确认发票是否由税务机关真实签发。正式报销前请前往<a href="https://inv-veri.chinatax.gov.cn/" target="_blank" rel="noopener" style="color:var(--primary);text-decoration:underline">国家税务总局全国增值税发票查验平台</a>核验。</span></div>';
    UI.openModal(UI.buildModal({
      title: '合规检查规则',
      subtitle: '12 项本地校验 · 结果可解释',
      icon: 'i-shield-check',
      className: 'modal-lg',
      body: body,
      footer: '<button class="btn btn-primary" type="button" data-close-modal>我知道了</button>'
    }));
  }

  function showHelp() {
    const body =
      '<div class="form-section-title"><h4>三步完成发票初筛</h4><span class="line"></span></div>' +
      '<div class="rule-list" style="padding:0 0 12px">' +
        '<div class="rule-row"><span class="rule-icon">' + icon('i-upload-cloud') + '</span><div class="rule-text"><strong>1. 录入票面</strong><span>上传含二维码的图片、粘贴票面文本，或手动填写。</span></div></div>' +
        '<div class="rule-row"><span class="rule-icon">' + icon('i-shield-check') + '</span><div class="rule-text"><strong>2. 规则校验</strong><span>校验税号、金额勾稽、票号格式、重复发票与时效。</span></div></div>' +
        '<div class="rule-row"><span class="rule-icon">' + icon('i-list') + '</span><div class="rule-text"><strong>3. 归档台账</strong><span>保存查验结果，支持检索、统计、导出与打印。</span></div></div>' +
      '</div>' +
      '<div class="notice">' + icon('i-info') + '<span>本平台为本地发票合规初筛工具，不连接税务机关系统。正式报销前请前往<a href="https://inv-veri.chinatax.gov.cn/" target="_blank" rel="noopener" style="color:var(--primary);text-decoration:underline">国家税务总局全国增值税发票查验平台</a>核验。</span></div>' +
      '<div class="notice notice-warn mt-12">' + icon('i-lock') + '<span>所有发票数据保存在当前浏览器的 localStorage 中，更换浏览器或清理浏览器数据可能导致丢失，请定期在「设置与数据」中导出备份。</span></div>';
    UI.openModal(UI.buildModal({
      title: '使用说明',
      subtitle: '票清 · 个人发票检验平台',
      icon: 'i-help',
      className: 'modal-md',
      body: body,
      footer: '<button class="btn btn-primary" type="button" data-close-modal>我知道了</button>'
    }));
  }

  function detailItem(label, value, extraClass) {
    return '<div class="detail-item ' + (extraClass || '') + '"><span>' + esc(label) + '</span><strong' + (extraClass === 'num-full' ? ' class="num"' : '') + '>' + esc(value == null || value === '' ? '—' : value) + '</strong></div>';
  }

  function openDetail(id) {
    const invoice = DB.invoices().find(function (item) { return item.id === id; });
    if (!invoice) {
      UI.toast('发票不存在或已被删除', 'error');
      return;
    }
    const report = IP.evaluateInvoice(invoice, { invoices: DB.invoices(), settings: DB.settings(), selfId: invoice.id });
    const type = IP.getType(invoice.type);
    const meta = IP.STATUS[report.status];
    const sourceLabels = { demo: '示例数据', manual: '手工录入', qr: '二维码识别', text: '文本识别' };
    const issues = report.issues.length
      ? '<div class="detail-issues">' + report.issues.map(function (issue) {
          return '<div class="detail-issue ' + (issue.status === 'fail' ? 'is-danger' : '') + '">' + icon(issue.status === 'fail' ? 'i-alert' : 'i-info') +
            '<div><strong>' + esc(issue.label) + '</strong>' + esc(issue.detail) + '</div></div>';
        }).join('') + '</div>'
      : '<div class="notice notice-mint">' + icon('i-check-circle') + '<span>本次校验未发现异常，可正常归档。</span></div>';

    const attachment = invoice.attachment && invoice.attachment.data
      ? '<div class="detail-attachment"><img src="' + invoice.attachment.data + '" alt="发票附件"><div class="detail-attachment-meta">' + icon('i-image') + '<span>' + esc(invoice.attachment.name || '发票图片') + '</span></div></div>'
      : (invoice.attachment
        ? '<div class="detail-attachment"><div class="detail-empty-attachment" style="border:0">' + icon('i-file') + ' ' + esc(invoice.attachment.name || 'PDF 附件') + '<br><span class="text-xs">已关联文件，未保存预览</span></div></div>'
        : '<div class="detail-empty-attachment">未关联票面附件</div>');

    const body =
      '<div class="detail-status-row">' + IP.statusBadge(report.status) + IP.typeBadge(invoice.type) +
        '<span class="chip ' + (report.score >= 90 ? 'chip-pass' : report.score >= 70 ? 'chip-warn' : 'chip-danger') + '">合规分 ' + report.score + '</span>' +
      '</div>' +
      '<div class="detail-amount mt-12"><span>价税合计</span><strong>' + IP.moneySign(invoice.total) + '</strong>' +
        '<div class="detail-amount-row">' +
          '<div><span>不含税金额</span><strong>' + IP.moneySign(invoice.amount) + '</strong></div>' +
          '<div><span>税率</span><strong>' + IP.percent(invoice.taxRate) + '</strong></div>' +
          '<div><span>税额</span><strong>' + IP.moneySign(invoice.taxAmount) + '</strong></div>' +
        '</div>' +
      '</div>' +
      '<div class="detail-section"><h4>校验结论<span class="line"></span></h4>' + issues + '</div>' +
      '<div class="detail-section"><h4>发票信息<span class="line"></span></h4><div class="detail-grid">' +
        detailItem('发票类型', type.label) +
        detailItem('开票日期', IP.formatDate(invoice.date, 'long')) +
        detailItem('发票代码', invoice.code || '—') +
        detailItem('发票号码', invoice.number, 'num-full') +
        detailItem('校验码', invoice.checkCode || '—', 'full num-full') +
        detailItem('项目名称', invoice.itemName || '—', 'full') +
        detailItem('备注', invoice.remark || '—', 'full') +
      '</div></div>' +
      '<div class="detail-section"><h4>交易双方<span class="line"></span></h4><div class="detail-grid">' +
        detailItem('购买方', invoice.buyerName || '—', 'full') +
        detailItem('购买方税号', invoice.buyerTaxId || '—', 'full num-full') +
        detailItem('销售方', invoice.sellerName || '—', 'full') +
        detailItem('销售方税号', invoice.sellerTaxId || '—', 'full num-full') +
      '</div></div>' +
      '<div class="detail-section"><h4>票面附件<span class="line"></span></h4>' + attachment + '</div>' +
      '<div class="detail-meta-foot">' +
        '数据来源：' + esc(sourceLabels[invoice.source] || '手工录入') + '　·　状态：' + esc(meta.label) + '<br>' +
        '录入时间：' + IP.formatDateTime(invoice.createdAt) + '　·　最近更新：' + IP.formatDateTime(invoice.updatedAt) + '<br>' +
        '本结果由本地规则生成，不代表税务机关查验结论。' +
      '</div>';

    const footer =
      '<button class="btn btn-danger-soft" type="button" id="detailDeleteBtn">' + icon('i-trash') + '删除</button>' +
      '<button class="btn btn-secondary" type="button" id="detailPrintBtn">' + icon('i-print') + '打印</button>' +
      '<button class="btn btn-primary" type="button" id="detailEditBtn">' + icon('i-edit') + '编辑</button>';

    UI.openDrawer({
      title: '发票详情',
      subtitle: type.label + ' · ' + IP.formatDate(invoice.date, 'long'),
      body: body,
      footer: footer,
      onMount: function (drawer) {
        const del = $('#detailDeleteBtn', drawer);
        if (del) del.addEventListener('click', async function () {
          const ok = await UI.confirm({
            title: '删除这张发票？',
            message: '删除后将同步更新台账、统计与风险结果，此操作不可恢复。',
            confirmText: '确认删除',
            tone: 'danger'
          });
          if (!ok) return;
          try {
            DB.remove([invoice.id]);
            UI.closeDrawer();
            UI.toast('发票已删除');
            if (IP.router) IP.router.refresh();
          } catch (err) {
            UI.toast(err.message || '删除失败', 'error');
          }
        });
        const print = $('#detailPrintBtn', drawer);
        if (print) print.addEventListener('click', function () { printInvoiceData(invoice, report); });
        const edit = $('#detailEditBtn', drawer);
        if (edit) edit.addEventListener('click', function () {
          UI.closeDrawer();
          location.hash = '#/verify/' + invoice.id;
        });
      }
    });
  }

  function printInvoiceById(id) {
    const invoice = DB.invoices().find(function (item) { return item.id === id; });
    if (!invoice) return;
    const report = IP.evaluateInvoice(invoice, { invoices: DB.invoices(), settings: DB.settings(), selfId: invoice.id });
    printInvoiceData(invoice, report);
  }

  document.addEventListener('submit', function (event) {
    if (event.target && event.target.id === 'verifyForm') {
      event.preventDefault();
      runVerification();
    }
  });

  IP.verify = {
    mount: mount,
    reset: reset,
    openDetail: openDetail,
    showHelp: showHelp,
    showRules: showRules,
    printById: printInvoiceById,
    state: state
  };
})(window);
