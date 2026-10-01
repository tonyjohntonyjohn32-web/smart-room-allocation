/**
 * UI Utilities, Toast Notifications, and Modal Management
 */

const UI = {
  /**
   * Display a floating toast notification
   * @param {'success'|'error'|'warning'|'info'} type 
   * @param {string} message 
   * @param {string} [title] 
   */
  showToast(type = 'info', message = '', title = '') {
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    const defaultTitles = {
      success: 'Success',
      error: 'Error',
      warning: 'Warning',
      info: 'Notification'
    };

    const header = title || defaultTitles[type] || 'Notice';

    toast.innerHTML = `
      <div class="toast-content">
        <div class="toast-title">${header}</div>
        <div class="toast-message">${message}</div>
      </div>
    `;

    container.appendChild(toast);

    // Auto-remove after 4 seconds
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(50px)';
      toast.style.transition = 'all 200ms ease';
      setTimeout(() => toast.remove(), 200);
    }, 4000);
  },

  /**
   * Open an HTML5 <dialog> modal with light dismiss
   * @param {string} modalId 
   */
  openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;

    if (typeof modal.showModal === 'function') {
      modal.showModal();
    } else {
      modal.setAttribute('open', '');
    }

    // Light dismiss: Close on backdrop click
    modal.onclick = (event) => {
      const rect = modal.getBoundingClientRect();
      const isInDialog = (
        rect.top <= event.clientY &&
        event.clientY <= rect.top + rect.height &&
        rect.left <= event.clientX &&
        event.clientX <= rect.left + rect.width
      );
      if (!isInDialog) {
        UI.closeModal(modalId);
      }
    };
  },

  /**
   * Close an HTML5 <dialog> modal
   * @param {string} modalId 
   */
  closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    if (typeof modal.close === 'function') {
      modal.close();
    } else {
      modal.removeAttribute('open');
    }
  },

  /**
   * Reusable confirmation prompt dialog
   */
  confirm(title, message, onConfirm) {
    let confirmModal = document.getElementById('global-confirm-modal');
    if (!confirmModal) {
      confirmModal = document.createElement('dialog');
      confirmModal.id = 'global-confirm-modal';
      confirmModal.className = 'modal';
      confirmModal.innerHTML = `
        <div class="modal-header">
          <h3 id="confirm-modal-title">Confirm Action</h3>
          <button type="button" class="btn-close-modal" onclick="UI.closeModal('global-confirm-modal')">&times;</button>
        </div>
        <div class="modal-body">
          <p id="confirm-modal-msg">Are you sure?</p>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary btn-sm" onclick="UI.closeModal('global-confirm-modal')">Cancel</button>
          <button type="button" id="confirm-modal-btn-ok" class="btn btn-danger btn-sm">Confirm</button>
        </div>
      `;
      document.body.appendChild(confirmModal);
    }

    document.getElementById('confirm-modal-title').textContent = title;
    document.getElementById('confirm-modal-msg').textContent = message;

    const okBtn = document.getElementById('confirm-modal-btn-ok');
    okBtn.onclick = () => {
      UI.closeModal('global-confirm-modal');
      if (typeof onConfirm === 'function') onConfirm();
    };

    UI.openModal('global-confirm-modal');
  },

  /**
   * Show loading placeholder
   */
  showLoading(element) {
    if (!element) return;
    element.innerHTML = `
      <div style="text-align: center; padding: 2.5rem; color: var(--color-text-muted);">
        <div style="font-size: 1.5rem; margin-bottom: 0.5rem; animation: spin 1s linear infinite;">⏳</div>
        <p>Loading data from server...</p>
      </div>
    `;
  },

  /**
   * Format 24-hr time to 12-hr with AM/PM
   */
  formatTime(timeStr) {
    if (!timeStr) return '';
    const [hours, minutes] = timeStr.split(':').map(Number);
    const suffix = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    return `${displayHours}:${String(minutes).padStart(2, '0')} ${suffix}`;
  }
};

window.UI = UI;
