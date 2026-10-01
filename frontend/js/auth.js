/**
 * Authentication & Session Management Module
 */

const Auth = {
  TOKEN_KEY: 'sra_token',
  USER_KEY: 'sra_user',

  /**
   * Check if token is present
   */
  isAuthenticated() {
    return !!localStorage.getItem(this.TOKEN_KEY);
  },

  /**
   * Get current stored user object
   */
  getCurrentUser() {
    try {
      const userStr = localStorage.getItem(this.USER_KEY);
      return userStr ? JSON.parse(userStr) : null;
    } catch (e) {
      return null;
    }
  },

  /**
   * Check if logged in user is admin
   */
  isAdmin() {
    const user = this.getCurrentUser();
    return user && user.role === 'admin';
  },

  /**
   * Save session upon successful login
   */
  saveSession(token, user) {
    localStorage.setItem(this.TOKEN_KEY, token);
    localStorage.setItem(this.USER_KEY, JSON.stringify(user));
  },

  /**
   * Clear session and log out
   */
  logout() {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.USER_KEY);
    window.location.href = 'login.html';
  },

  /**
   * Initialize and enforce authentication on protected pages
   */
  initProtection() {
    if (!this.isAuthenticated()) {
      window.location.href = 'login.html';
      return false;
    }

    const user = this.getCurrentUser();
    if (user) {
      // Update sidebar and header UI user elements
      const userNameEls = document.querySelectorAll('.user-name-display');
      const userRoleEls = document.querySelectorAll('.user-role-display');

      userNameEls.forEach(el => { el.textContent = user.name || 'User'; });
      userRoleEls.forEach(el => { el.textContent = (user.role || 'faculty').toUpperCase(); });

      // Apply role-based visibility
      if (user.role !== 'admin') {
        const adminElements = document.querySelectorAll('[data-role="admin"]');
        adminElements.forEach(el => {
          el.style.display = 'none';
        });
      }
    }

    return true;
  }
};

window.Auth = Auth;
