// 自定义确认弹窗（替代浏览器原生 confirm）
// 支持：淡入淡出动画、Esc/Enter 键盘操作、点击遮罩关闭
var ConfirmDialog = {
  /**
   * @param {string}  title        - 弹窗标题
   * @param {string}  description  - 弹窗描述
   * @param {string}  [confirmText] - 确认按钮文字，默认"确认删除"
   * @param {string}  [cancelText]  - 取消按钮文字，默认"取消"
   * @returns {Promise<boolean>} 用户点击确认 → true，取消/关闭 → false
   */
  show: function (title, description, confirmText, cancelText) {
    return new Promise(function (resolve) {
      // 移除已存在的弹窗（防止重复）
      var existing = document.querySelector('.confirm-overlay');
      if (existing) existing.remove();

      var overlay = document.createElement('div');
      overlay.className = 'confirm-overlay';
      overlay.innerHTML =
        '<div class="confirm-dialog" role="alertdialog" aria-modal="true">' +
          '<div class="confirm-icon">' +
            '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
              '<circle cx="12" cy="12" r="10"/>' +
              '<line x1="12" y1="8" x2="12" y2="12"/>' +
              '<line x1="12" y1="16" x2="12.01" y2="16"/>' +
            '</svg>' +
          '</div>' +
          '<h3 class="confirm-title">' + (title || '确认操作') + '</h3>' +
          '<p class="confirm-desc">' + (description || '') + '</p>' +
          '<div class="confirm-actions">' +
            '<button class="btn btn-secondary confirm-cancel">' + (cancelText || '取消') + '</button>' +
            '<button class="btn btn-danger confirm-ok">' + (confirmText || '确认删除') + '</button>' +
          '</div>' +
        '</div>';

      document.body.appendChild(overlay);

      var dialog = overlay.querySelector('.confirm-dialog');
      var onKeydown;

      function close(result) {
        if (onKeydown) document.removeEventListener('keydown', onKeydown);
        dialog.classList.add('closing');
        overlay.style.animation = 'fadeOut 0.15s ease forwards';
        setTimeout(function () {
          if (overlay.parentNode) overlay.remove();
          resolve(result);
        }, 150);
      }

      overlay.querySelector('.confirm-cancel').addEventListener('click', function () { close(false); });
      overlay.querySelector('.confirm-ok').addEventListener('click', function () { close(true); });

      // 点击遮罩层关闭
      overlay.addEventListener('click', function (e) {
        if (e.target === overlay) close(false);
      });

      // 键盘操作
      onKeydown = function (e) {
        if (e.key === 'Escape') { close(false); e.preventDefault(); }
      };
      document.addEventListener('keydown', onKeydown);

      // 自动聚焦取消按钮
      setTimeout(function () {
        var cancelBtn = overlay.querySelector('.confirm-cancel');
        if (cancelBtn) cancelBtn.focus();
      }, 80);
    });
  }
};
