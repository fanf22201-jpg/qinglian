/* =========================================================
 * 轻练 · UI 工具模块（ui.js）
 * Toast 轻提示 / 底部弹窗 / 确认框 / 小工具
 * ========================================================= */
'use strict';

const UI = (() => {

  function escapeHtml(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /** 轻提示 */
  function toast(msg, ms) {
    const root = document.getElementById('toast-root');
    const t = document.createElement('div');
    t.className = 'toast';
    t.textContent = msg;
    root.appendChild(t);
    setTimeout(() => {
      t.classList.add('out');
      setTimeout(() => t.remove(), 350);
    }, ms || 2200);
  }

  let modalCount = 0;

  /**
   * 打开弹窗（底部抽屉，大屏居中）
   * opts: { title, bodyHTML, actions:[{label, cls, value, primary}], onOpen(el), onAction(value) }
   * 返回 { close }
   */
  function modal(opts) {
    const root = document.getElementById('modal-root');
    const id = 'm' + (++modalCount);
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    backdrop.id = id;
    const actionsHTML = (opts.actions || []).map(a =>
      `<button type="button" class="btn ${a.cls || 'btn-primary'}" data-act="${a.value}">${escapeHtml(a.label)}</button>`
    ).join('');
    backdrop.innerHTML = `
      <div class="modal" role="dialog" aria-modal="true">
        <div class="modal-grip" aria-hidden="true"></div>
        <div class="modal-head">
          <h3 class="modal-title">${escapeHtml(opts.title || '')}</h3>
          ${opts.dismissable !== false ? '<button type="button" class="modal-close" data-act="__close">✕</button>' : ''}
        </div>
        <div class="modal-body">${opts.bodyHTML || ''}</div>
        ${actionsHTML ? `<div class="modal-actions">${actionsHTML}</div>` : ''}
      </div>`;
    root.appendChild(backdrop);
    if (opts.onOpen) opts.onOpen(backdrop.querySelector('.modal'));

    function close() {
      backdrop.classList.add('out');
      setTimeout(() => backdrop.remove(), 300);
    }
    backdrop.addEventListener('click', e => {
      if (e.target === backdrop) { if (opts.dismissable === false) return; close(); if (opts.onAction) opts.onAction('__close'); }
      const btn = e.target.closest('[data-act]');
      if (btn) {
        const v = btn.dataset.act;
        if (v === '__close' || v === 'cancel') { close(); }
        if (opts.onAction) opts.onAction(v);
      }
    });
    return { close };
  }

  /** 确认框：返回 Promise<boolean> */
  function confirm(message, opts) {
    opts = opts || {};
    return new Promise(resolve => {
      const m = modal({
        title: opts.title || '确认操作',
        bodyHTML: `<p class="confirm-text">${escapeHtml(message)}</p>`,
        dismissable: false,
        actions: [
          { label: '取消', cls: 'btn-secondary', value: 'no' },
          { label: opts.okText || '确认', cls: opts.danger ? 'btn-danger' : 'btn-primary', value: 'yes' }
        ],
        onAction(v) { resolve(v === 'yes'); m.close(); }
      });
    });
  }

  /** 简单输入框 */
  function promptInput(label, opts) {
    opts = opts || {};
    return new Promise(resolve => {
      const m = modal({
        title: opts.title || label,
        bodyHTML: `
          <label class="label">${escapeHtml(label)}</label>
          <input id="pi-input" class="input" type="${opts.type || 'text'}" value="${escapeHtml(opts.value || '')}" placeholder="${escapeHtml(opts.placeholder || '')}" inputmode="${opts.inputmode || ''}">`,
        dismissable: false,
        actions: [
          { label: '取消', cls: 'btn-secondary', value: 'cancel' },
          { label: opts.okText || '确定', cls: 'btn-primary', value: 'ok' }
        ],
        onOpen(el) {
          const inp = el.querySelector('#pi-input');
          inp.focus();
          if (opts.type === 'number') inp.addEventListener('input', () => { inp.value = inp.value.replace(/[^\d.]/g, ''); });
          inp.addEventListener('keydown', e => { if (e.key === 'Enter') { resolve(inp.value.trim()); m.close(); } });
        },
        onAction(v) {
          if (v === 'ok') {
            const inp = document.querySelector('#pi-input');
            resolve(inp ? inp.value.trim() : null);
            m.close();
          }
        }
      });
    });
  }

  /** 关闭所有弹窗（切换页面时兜底） */
  function closeAllModals() {
    const root = document.getElementById('modal-root');
    root.innerHTML = '';
  }

  /** 根据数字生成 SVG 进度环 */
  function ringHTML(percent, size, stroke, color) {
    const r = (size - stroke) / 2;
    const c = 2 * Math.PI * r;
    const p = Math.max(0, Math.min(1, percent));
    return `
      <svg class="ring" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
        <circle class="ring-bg" cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke-width="${stroke}"></circle>
        <circle class="ring-fg" cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke-width="${stroke}"
          stroke="${color}" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - p)}"></circle>
      </svg>`;
  }

  return { escapeHtml, toast, modal, confirm, promptInput, closeAllModals, ringHTML };
})();
