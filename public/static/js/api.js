/**
 * MineVest API Client
 */
const API = {
  get token() {
    return localStorage.getItem('mv_token') || '';
  },
  set token(val) {
    if (val) localStorage.setItem('mv_token', val);
    else localStorage.removeItem('mv_token');
  },

  get user() {
    try {
      const u = localStorage.getItem('mv_user');
      return u ? JSON.parse(u) : null;
    } catch (e) {
      return null;
    }
  },
  set user(val) {
    if (val) localStorage.setItem('mv_user', JSON.stringify(val));
    else localStorage.removeItem('mv_user');
  },

  setSession(token, user) {
    this.token = token;
    this.user = user;
  },

  clearSession() {
    this.setSession('', null);
  },

  async request(endpoint, options = {}) {
    const headers = {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    try {
      const response = await fetch(endpoint, {
        ...options,
        headers
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || 'An error occurred during request');
      }
      return data;
    } catch (err) {
      console.error(`API Error on [${endpoint}]:`, err);
      throw err;
    }
  },

  // Public
  getPublicStats() {
    return this.request('/api/public/stats');
  },
  getPlans() {
    return this.request('/api/public/plans');
  },
  getLiveTransactions() {
    return this.request('/api/public/live-transactions');
  },

  // Auth
  register(payload) {
    return this.request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },
  confirmEmailLink(payload) {
    return this.request('/api/auth/confirm-email-link', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },
  resendLink(payload) {
    return this.request('/api/auth/resend-link', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },
  login(payload) {
    return this.request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },
  oauthLogin(payload) {
    return this.request('/api/auth/oauth-login', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },
  getMe() {
    return this.request('/api/auth/me');
  },

  // Investor
  getInvestorOverview() {
    return this.request('/api/investor/overview');
  },
  deposit(payload) {
    return this.request('/api/investor/deposit', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },
  invest(payload) {
    return this.request('/api/investor/invest', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },
  triggerYieldAccrual() {
    return this.request('/api/investor/accrue-yields', {
      method: 'POST'
    });
  },
  withdraw(payload) {
    return this.request('/api/investor/withdraw', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },
  getTransactions(type = 'all') {
    return this.request(`/api/investor/transactions?type=${type}`);
  },
  getReferrals() {
    return this.request('/api/investor/referrals');
  },
  updateProfile(payload) {
    return this.request('/api/investor/update-profile', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  // Admin
  getAdminOverview() {
    return this.request('/api/admin/overview');
  },
  getAdminUsers() {
    return this.request('/api/admin/users');
  },
  adjustUserBalance(userId, payload) {
    return this.request(`/api/admin/users/${userId}/adjust-balance`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },
  getAdminWithdrawals() {
    return this.request('/api/admin/withdrawals');
  },
  processWithdrawal(txId, action) {
    return this.request(`/api/admin/withdrawals/${txId}/action?action=${action}`, {
      method: 'POST'
    });
  },
  getAdminDeposits() {
    return this.request('/api/admin/deposits');
  },
  processDeposit(txId, action) {
    return this.request(`/api/admin/deposits/${txId}/action?action=${action}`, {
      method: 'POST'
    });
  }
};
