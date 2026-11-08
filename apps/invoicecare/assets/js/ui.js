/* 票清 · 浮层、提示与交互基础组件 */
(function (global) {
  'use strict';

  const IP = global.IP;
  const $ = IP.$;
  const icon = IP.icon;

  const modalRoot = $('#modalRoot');
  const drawerRoot = $('#drawerRoot');
  const toastRoot = $('#toastRoot');
  let previousFocus = null;
  let confirmRoot = null;

  function lockScroll() {
    document.body.classList.add('no-scroll');
  }

  function unlockScroll() {
    if (!modalRoot.classList.contains('is-open') && !drawerRoot.classList.contains('is-open') && !confirmRoot) {
      document.body.classList.remove('no-scroll');
    }
  }

  function focusFirst(container) {
    if (!container) return;
    const target = container.querySelector('[autofocus], input:not([type="hidden"]), textarea, select, button');
    if (target) {
      try { target.focus({ preventScroll: true }); } catch (err) { target.focus(); }
    }
  }

  function openModal(html, options) {
    const opts = options || {};
    previousFocus = document.activeElement;
    modalRoot.innerHTML = '<div class="overlay" data-close-modal></div>' + html;
    modalRoot.classList.add('is-open');
    lockScroll();
    const modal = modalRoot.querySelector('.modal');
    if (opts.onMount) opts.onMount(modal);
    requestAnimationFrame(function () { focusFirst(modal); });
    return modal;
  }

  function closeModal() {
    if (!modalRoot.classList.contains('is-open')) return;
    modalRoot.classList.remove('is-open');
    modalRoot.innerHTML = '';
    unlockScroll();
    if (previousFocus && previousFocus.focus) {
      try { previousFocus.focus({ preventScroll: true }); } catch (err) { /* noop */ }
    }
    previousFocus = null;
  }

  function buildModal(config) {
    const cfg = config || {};
    return '<div class="modal ' + (cfg.className || '') + '" role="dialog" aria-modal="true" aria-label="' + IP.escapeHtml(cfg.title || '对话框') + '">' +
      '<button class="modal-close" type="button" data-close-modal aria-label="关闭">' + icon('i-x') + '</button>' +
      '<div class="modal-head">' +
        (cfg.icon ? '<div class="' + (cfg.iconClass || 'modal-icon') + '">' + icon(cfg.icon) + '</div>' : '') +
        '<div class="modal-head-text"><h3>' + IP.escapeHtml(cfg.title || '') + '</h3>' +
        (cfg.subtitle ? '<p>' + IP.escapeHtml(cfg.subtitle) + '</p>' : '') + '</div>' +
      '</div>' +
      '<div class="modal-body ' + (cfg.bodyClass || '') + '">' + (cfg.body || '') + '</div>' +
      (cfg.footer ? '<div class="modal-foot">' + cfg.footer + '</div>' : '') +
    '</div>';
  }

  function openDrawer(config) {
    const cfg = config || {};
    previousFocus = document.activeElement;
    drawerRoot.innerHTML =
      '<div class="drawer-scrim" data-close-drawer></div>' +
      '<aside class="drawer" role="dialog" aria-modal="true" aria-label="' + IP.escapeHtml(cfg.title || '详情') + '">' +
        '<div class="drawer-head">' +
          '<div class="drawer-head-text"><h3>' + IP.escapeHtml(cfg.title || '') + '</h3>' +
          (cfg.subtitle ? '<p>' + cfg.subtitle + '</p>' : '') + '</div>' +
          '<button class="drawer-close" type="button" data-close-drawer aria-label="关闭">' + icon('i-x') + '</button>' +
        '</div>' +
        '<div class="drawer-body">' + (cfg.body || '') + '</div>' +
        (cfg.footer ? '<div class="drawer-foot">' + cfg.footer + '</div>' : '') +
      '</aside>';
    drawerRoot.classList.add('is-open');
    lockScroll();
    const drawer = drawerRoot.querySelector('.drawer');
    if (cfg.onMount) cfg.onMount(drawer);
    requestAnimationFrame(function () { focusFirst(drawer); });
    return drawer;
  }

  function closeDrawer() {
    if (!drawerRoot.classList.contains('is-open')) return;
    drawerRoot.classList.remove('is-open');
    drawerRoot.innerHTML = '';
    unlockScroll();
    if (previousFocus && previousFocus.focus) {
      try { previousFocus.focus({ preventScroll: true }); } catch (err) { /* noop */ }
    }
    previousFocus = null;
  }

  function toast(message, type, duration) {
    const kind = type || 'success';
    const iconName = kind === 'error' ? 'i-alert' : (kind === 'info' ? 'i-info' : 'i-check-circle');
    const node = document.createElement('div');
    node.className = 'toast toast-' + kind;
    node.innerHTML = icon(iconName) + '<span>' + IP.escapeHtml(message) + '</span>';
    toastRoot.appendChild(node);
    setTimeout(function () {
      node.classList.add('hide');
      setTimeout(function () { node.remove(); }, 220);
    }, duration || 3200);
  }

  function confirmDialog(config) {
    const cfg = config || {};
    return new Promise(function (resolve) {
      if (confirmRoot) confirmRoot.remove();
      confirmRoot = document.createElement('div');
      confirmRoot.className = 'confirm-root';
      confirmRoot.innerHTML =
        '<div class="overlay" data-confirm-cancel></div>' +
        '<div class="confirm-card" role="alertdialog" aria-modal="true">' +
          '<div class="confirm-icon ' + (cfg.tone === 'danger' ? 'danger' : '') + '">' + icon(cfg.icon || (cfg.tone === 'danger' ? 'i-trash' : 'i-info')) + '</div>' +
          '<h3>' + IP.escapeHtml(cfg.title || '确认操作') + '</h3>' +
          '<p>' + (cfg.message || '') + '</p>' +
          '<div class="confirm-actions">' +
            '<button class="btn btn-secondary" type="button" data-confirm-cancel>取消</button>' +
            '<button class="btn ' + (cfg.tone === 'danger' ? 'btn-danger' : 'btn-primary') + '" type="button" data-confirm-ok>' + IP.escapeHtml(cfg.confirmText || '确认') + '</button>' +
          '</div>' +
        '</div>';
      document.body.appendChild(confirmRoot);
      document.body.classList.add('no-scroll');
      const finish = function (value) {
        confirmRoot.remove();
        confirmRoot = null;
        unlockScroll();
        resolve(value);
      };
      confirmRoot.querySelector('[data-confirm-ok]').addEventListener('click', function () { finish(true); });
        confirmRoot.querySelectorAll('[data-confirm-cancel]').forEach(function (el) {
          el.addEventListener('click', function () { finish(false); });
        });
      requestAnimationFrame(function () { focusFirst(confirmRoot); });
    });
  }

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).then(function () { return true; }).catch(function () { return fallbackCopy(text); });
    }
    return Promise.resolve(fallbackCopy(text));
  }

  function fallbackCopy(text) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch (err) { ok = false; }
    document.body.removeChild(ta);
    return ok;
  }

  document.addEventListener('click', function (event) {
    if (event.target.closest('[data-close-modal]')) closeModal();
    if (event.target.closest('[data-close-drawer]')) closeDrawer();
  });

  document.addEventListener('keydown', function (event) {
    if (event.key !== 'Escape') return;
    if (confirmRoot) {
      confirmRoot.querySelector('[data-confirm-cancel]').click();
    } else if (modalRoot.classList.contains('is-open')) {
      closeModal();
    } else if (drawerRoot.classList.contains('is-open')) {
      closeDrawer();
    }
  });

  IP.UI = {
    openModal: openModal,
    closeModal: closeModal,
    buildModal: buildModal,
    openDrawer: openDrawer,
    closeDrawer: closeDrawer,
    toast: toast,
    confirm: confirmDialog,
    copy: copyText,
    closeAll: function () { closeModal(); closeDrawer(); if (confirmRoot) confirmRoot.remove(); }
  };
})(window);
