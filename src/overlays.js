let toastContainer = null;

function ensureToastContainer() {
  if (toastContainer?.isConnected) return toastContainer;
  toastContainer = document.getElementById('toast-container');
  if (toastContainer?.isConnected) return toastContainer;
  toastContainer = document.createElement('div');
  toastContainer.id = 'toast-container';
  toastContainer.className = 'toast-container';
  document.body.appendChild(toastContainer);
  return toastContainer;
}

export function toast(message, { title = '', variant = 'neutral', timeoutMs = 2600 } = {}) {
  const container = ensureToastContainer();
  const el = document.createElement('div');
  el.className = `app-toast app-toast-${variant}`;

  if (title) {
    const t = document.createElement('div');
    t.className = 'app-toast-title';
    t.textContent = String(title);
    el.appendChild(t);
  }

  const body = document.createElement('div');
  body.className = 'app-toast-body';
  body.textContent = String(message || '');
  el.appendChild(body);

  container.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));

  const remove = () => {
    el.classList.remove('show');
    setTimeout(() => el.remove(), 180);
  };

  el.addEventListener('click', remove);
  if (timeoutMs > 0) setTimeout(remove, timeoutMs);
}

let dialogEl = null;
let dialogTitleEl = null;
let dialogBodyEl = null;
let dialogOkBtn = null;
let dialogCancelBtn = null;
let dialogCloseBtn = null;

function ensureDialog() {
  if (dialogEl?.isConnected) return;
  dialogEl = document.getElementById('app-dialog');
  dialogTitleEl = document.getElementById('app-dialog-title');
  dialogBodyEl = document.getElementById('app-dialog-body');
  dialogOkBtn = document.getElementById('app-dialog-ok');
  dialogCancelBtn = document.getElementById('app-dialog-cancel');
  dialogCloseBtn = document.getElementById('app-dialog-close');
}

export function confirmDialog({
  title = 'Confirm',
  message = '',
  confirmText = 'OK',
  cancelText = 'Cancel',
  danger = false,
} = {}) {
  ensureDialog();

  if (!dialogEl || typeof dialogEl.showModal !== 'function') {
    return Promise.resolve(window.confirm(`${title ? `${title}\n\n` : ''}${message}`));
  }

  dialogTitleEl.textContent = String(title || 'Confirm');
  dialogBodyEl.textContent = String(message || '');

  dialogOkBtn.textContent = String(confirmText || 'OK');
  dialogCancelBtn.textContent = String(cancelText || 'Cancel');
  dialogOkBtn.className = `btn btn-sm ${danger ? 'btn-danger' : 'btn-dark'}`;

  return new Promise((resolve) => {
    const onClose = () => resolve(dialogEl.returnValue === 'ok');

    const onCloseBtn = () => dialogEl.close('cancel');
    dialogEl.addEventListener('close', onClose, { once: true });
    dialogCloseBtn?.addEventListener('click', onCloseBtn, { once: true });

    dialogEl.showModal();
  });
}

