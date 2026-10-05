/* ============================================================
   全站公共脚本：年份 / 一键复制 / 奖牌系统 / 系统弹窗
   ============================================================ */

document.addEventListener('DOMContentLoaded', function () {
  // 页脚年份自动更新
  var yearEl = document.getElementById('footer-year');
  if (yearEl) {
    yearEl.textContent = new Date().getFullYear();
  }

  // 渲染奖牌榜（页面上有 #medalBoard 才会渲染）
  SiteMedals.renderBoard();

  // 一键复制：给元素加 data-copy="要复制的内容" 即可
  var copyEls = document.querySelectorAll('[data-copy]');
  for (var i = 0; i < copyEls.length; i++) {
    copyEls[i].addEventListener('click', function () {
      var text = this.getAttribute('data-copy');
      var el = this;
      var done = function () {
        showToast('微信号已复制：' + text);
        flashCopied(el);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done).catch(function () {
          fallbackCopy(text, done);
        });
      } else {
        fallbackCopy(text, done);
      }
    });
  }
});

/* ---------------- 复制功能 ---------------- */
function fallbackCopy(text, cb) {
  var ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  try { document.execCommand('copy'); cb(); } catch (e) { showToast('复制失败，请手动添加：' + text); }
  document.body.removeChild(ta);
}

function flashCopied(el) {
  var original = el.innerHTML;
  el.innerHTML = '已复制';
  el.disabled = true;
  setTimeout(function () {
    el.innerHTML = original;
    el.disabled = false;
  }, 1600);
}

var toastTimer = null;
function showToast(msg) {
  var t = document.querySelector('.toast');
  if (!t) {
    t = document.createElement('div');
    t.className = 'toast';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  requestAnimationFrame(function () { t.classList.add('show'); });
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function () { t.classList.remove('show'); }, 2200);
}

/* ============================================================
   奖牌系统
   数据存在 localStorage 的 site-medals：
   { snake:{bronze:false,silver:false,gold:false},
     tictactoe:{bronze:false,silver:false,gold:false} }
   ============================================================ */
var MEDAL_COLORS = { gold: '#f0b429', silver: '#c3c9d2', bronze: '#d98b46' };
var MEDAL_NAMES = { gold: '金牌', silver: '银牌', bronze: '铜牌' };
var MEDAL_ORDER = ['gold', 'silver', 'bronze'];

var SiteMedals = {
  _default: function () {
    return {
      snake: { bronze: false, silver: false, gold: false },
      tictactoe: { bronze: false, silver: false, gold: false },
      mario: { bronze: false, silver: false, gold: false },
      battlematch: { bronze: false, silver: false, gold: false },
      run: { bronze: false, silver: false, gold: false }
    };
  },

  load: function () {
    var data = this._default();
    try {
      var saved = JSON.parse(localStorage.getItem('site-medals') || 'null');
      if (saved) {
        for (var game in data) {
          if (saved[game]) {
            MEDAL_ORDER.forEach(function (k) {
              data[game][k] = !!saved[game][k];
            });
          }
        }
      }
    } catch (e) {}
    return data;
  },

  save: function (data) {
    try { localStorage.setItem('site-medals', JSON.stringify(data)); } catch (e) {}
  },

  // 上报某游戏本局/当前达到的奖牌条件，解锁新奖牌；
  // 返回本次新获得的最高等级（'gold'/'silver'/'bronze'），没有则 null
  unlock: function (game, earned) {
    var data = this.load();
    if (!data[game]) { data[game] = { bronze: false, silver: false, gold: false }; }
    var newly = [];
    MEDAL_ORDER.forEach(function (k) {
      if (earned[k] && !data[game][k]) {
        data[game][k] = true;
        newly.push(k);
      }
    });
    if (newly.length) { this.save(data); }
    if (newly.indexOf('gold') !== -1) { return 'gold'; }
    if (newly.indexOf('silver') !== -1) { return 'silver'; }
    if (newly.indexOf('bronze') !== -1) { return 'bronze'; }
    return null;
  },

  // 统计全站奖牌数量
  counts: function () {
    var data = this.load();
    var c = { gold: 0, silver: 0, bronze: 0 };
    for (var game in data) {
      MEDAL_ORDER.forEach(function (k) { if (data[game][k]) { c[k]++; } });
    }
    return c;
  },

  // 某游戏当前最高等级奖牌（无则 null）
  topMedal: function (game) {
    var g = this.load()[game];
    if (!g) { return null; }
    if (g.gold) { return 'gold'; }
    if (g.silver) { return 'silver'; }
    if (g.bronze) { return 'bronze'; }
    return null;
  },

  // 渲染游戏列表页：右上角奖牌榜 + 卡片标题旁的最高奖牌
  renderBoard: function () {
    var c = this.counts();
    ['Gold', 'Silver', 'Bronze'].forEach(function (cap) {
      var el = document.getElementById('cnt' + cap);
      if (el) { el.textContent = c[cap.toLowerCase()]; }
    });
    var cardMap = { snake: 'cardMedalSnake', tictactoe: 'cardMedalTictactoe', mario: 'cardMedalMario', battlematch: 'cardMedalBattlematch', run: 'cardMedalRun' };
    for (var game in cardMap) {
      var el = document.getElementById(cardMap[game]);
      if (el) {
        var top = this.topMedal(game);
        el.innerHTML = top ? medalSvg(top) : '';
        el.title = top ? ('已获得' + MEDAL_NAMES[top]) : '';
      }
    }
  }
};

/* ---------------- 奖牌 SVG（绶带 + 圆盘 + 星） ---------------- */
function medalSvg(level) {
  var color = MEDAL_COLORS[level];
  return '' +
    '<svg viewBox="0 0 48 56" class="medal-svg" aria-hidden="true">' +
      '<path d="M19 3 L11 27 L20.5 22 Z" fill="#35659c"/>' +
      '<path d="M29 3 L37 27 L27.5 22 Z" fill="#2a5280"/>' +
      '<circle cx="24" cy="35" r="14" fill="' + color + '" stroke="#1f2d20" stroke-width="3"/>' +
      '<circle cx="24" cy="35" r="9.5" fill="none" stroke="#1f2d20" stroke-width="1.6" opacity=".35"/>' +
      '<path d="M24 28.5 L25.35 32.2 L29.3 32.4 L26.2 34.9 L27.2 38.8 L24 36.7 L20.8 38.8 L21.8 34.9 L18.7 32.4 L22.65 32.2 Z" fill="#ffffff"/>' +
    '</svg>';
}

/* ---------------- 系统提示弹窗（点击“确认”关闭） ---------------- */
function showMedalDialog(level, gameName, onClose) {
  // 同一时间只保留一个弹窗
  var old = document.querySelector('.modal-mask');
  if (old) { old.remove(); }

  var mask = document.createElement('div');
  mask.className = 'modal-mask';
  mask.innerHTML =
    '<div class="modal-box" role="dialog" aria-modal="true">' +
      '<div class="modal-medal">' + medalSvg(level) + '</div>' +
      '<h3 class="modal-title">获得' + MEDAL_NAMES[level] + '！</h3>' +
      '<p class="modal-text">来自「' + gameName + '」的' + MEDAL_NAMES[level] +
        '已加入游戏页右上角的奖牌榜。</p>' +
      '<button class="pixel-btn" type="button" id="modalOk">确认</button>' +
    '</div>';
  document.body.appendChild(mask);

  function close() {
    mask.remove();
    document.removeEventListener('keydown', onKey);
    if (typeof onClose === 'function') { onClose(); }
  }
  function onKey(e) {
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape') {
      e.preventDefault();
      close();
    }
  }
  mask.querySelector('#modalOk').addEventListener('click', close);
  document.addEventListener('keydown', onKey);
}
