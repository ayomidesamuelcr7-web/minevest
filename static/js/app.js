/**
 * Minimalist Clean Application Controller for MineVest
 * Color scheme: #0500A3 (Cobalt Blue) & Pure White (#FFFFFF)
 * Powered by Firebase Authentication & Core Database Engine
 */

const App = {
  currentView: 'landing',
  plans: [],
  btcData: null,
  pendingVerificationEmail: null,

  async init() {
    this.setupNavigation();
    this.setupModals();
    await this.loadPublicData();

    // Check if user arrived via Email confirmation link redirect
    const fullHash = window.location.hash || '';
    if (fullHash.includes('confirmed')) {
      try {
        history.replaceState(null, '', window.location.pathname);
      } catch (e) {}
      this.showToast("Email confirmed successfully! You can now sign in.", "success");
      setTimeout(() => this.openModal('login'), 350);
    }

    if (API.token && API.user) {
      this.updateAuthUI(true, API.user);
      const hash = window.location.hash.replace('#', '');
      if (hash === 'dashboard') {
        this.navigate('dashboard', false);
      } else if (hash === 'admin' && API.user.role === 'admin') {
        this.navigate('admin', false);
      } else if (hash === 'landing') {
        this.navigate('landing', false);
      } else {
        if (API.user.role === 'admin') {
          this.navigate('admin', false);
        } else {
          this.navigate('dashboard', false);
        }
      }
    } else {
      this.updateAuthUI(false);
      this.navigate('landing', false);
    }

    setInterval(() => this.updateLiveBtcTicker(), 30000);
    setInterval(() => this.loadLiveTransactions(), 20000);
  },

  navigate(viewName, updateHash = true) {
    this.currentView = viewName;
    if (updateHash && window.location.hash !== `#${viewName}`) {
      window.location.hash = viewName;
    }

    document.getElementById('view-landing').classList.toggle('hidden', viewName !== 'landing');
    document.getElementById('view-dashboard').classList.toggle('hidden', viewName !== 'dashboard');
    document.getElementById('view-admin').classList.toggle('hidden', viewName !== 'admin');

    window.scrollTo({ top: 0, behavior: 'smooth' });

    if (viewName === 'dashboard') {
      if (!API.token) {
        this.openModal('login');
        return;
      }
      Dashboard.init();
    } else if (viewName === 'admin') {
      if (!API.token || API.user?.role !== 'admin') {
        this.showToast("Admin privileges required", "error");
        this.navigate('landing');
        return;
      }
      Admin.init();
    }
  },

  async loadPublicData() {
    try {
      const statsRes = await API.getPublicStats();
      this.btcData = statsRes.btc;
      this.renderBtcStats(statsRes.btc, statsRes.platform);

      const plansRes = await API.getPlans();
      this.plans = plansRes.plans;
      this.renderPlansSection(this.plans);

      await this.loadLiveTransactions();
    } catch (err) {
      console.error("Error loading public data:", err);
    }
  },

  renderBtcStats(btc, platform) {
    const elTicker = document.getElementById('btc-live-price');
    const elChange = document.getElementById('btc-live-change');
    const elHeroPrice = document.getElementById('hero-btc-price');

    if (elTicker) elTicker.innerText = `$${btc.price_usd.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
    if (elHeroPrice) elHeroPrice.innerText = `$${btc.price_usd.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
    
    if (elChange) {
      const isPositive = btc.change_24h >= 0;
      elChange.innerHTML = `<i class="fa-solid fa-arrow-${isPositive ? 'up' : 'down'} text-[10px]"></i> ${isPositive ? '+' : ''}${btc.change_24h}%`;
      elChange.className = `text-xs font-semibold px-2 py-0.5 rounded-full ${
        isPositive ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'
      }`;
    }

    if (platform) {
      const elAum = document.getElementById('stat-aum');
      const elInvestors = document.getElementById('stat-investors');
      const elPayouts = document.getElementById('stat-payouts');
      const elReserve = document.getElementById('stat-reserves');

      if (elAum) elAum.innerText = platform.aum_usd;
      if (elInvestors) elInvestors.innerText = platform.total_investors;
      if (elPayouts) elPayouts.innerText = platform.total_paid_out_usd;
      if (elReserve) elReserve.innerText = platform.insurance_fund_usd;
    }
  },

  async updateLiveBtcTicker() {
    try {
      const stats = await API.getPublicStats();
      this.btcData = stats.btc;
      this.renderBtcStats(stats.btc, stats.platform);
    } catch (e) {
      console.warn("Ticker update caught:", e);
    }
  },

  renderPlansSection(plans) {
    const container = document.getElementById('landing-plans-grid');
    if (!container) return;

    container.innerHTML = plans.map(p => {
      const isRecommended = p.slug === 'pro';
      return `
        <div class="card-clean p-8 flex flex-col justify-between relative ${isRecommended ? 'border-[#0500A3] ring-1 ring-[#0500A3] shadow-md' : ''}">
          ${isRecommended ? `
            <div class="absolute -top-3 left-6 bg-[#0500A3] text-white text-[10px] font-bold uppercase tracking-wider px-3 py-0.5 rounded-full">
              Recommended Plan
            </div>
          ` : ''}

          <div>
            <div class="flex justify-between items-center mb-4">
              <span class="text-xs font-semibold text-slate-500">${p.name}</span>
              <span class="text-xs font-medium text-slate-400">${p.duration_days} Days Lock</span>
            </div>

            <div class="mb-4">
              <div class="text-3xl font-extrabold text-slate-900 tracking-tight">
                ${p.daily_roi_percent}% <span class="text-sm font-normal text-slate-500">/ day</span>
              </div>
              <div class="text-xs font-medium text-emerald-600 mt-1">
                Total Return: +${p.total_roi_percent}% ROI
              </div>
            </div>

            <p class="text-xs text-slate-600 mb-6 leading-relaxed">${p.description}</p>

            <div class="py-4 border-y border-slate-100 space-y-2 text-xs mb-6">
              <div class="flex justify-between text-slate-600">
                <span>Minimum Deposit:</span>
                <span class="font-semibold text-slate-900">$${p.min_deposit_usd.toLocaleString()}</span>
              </div>
              <div class="flex justify-between text-slate-600">
                <span>Maximum Deposit:</span>
                <span class="font-semibold text-slate-900">$${p.max_deposit_usd.toLocaleString()}</span>
              </div>
              <div class="flex justify-between text-slate-600">
                <span>Capital Protection:</span>
                <span class="font-semibold text-emerald-600">100% Principal Returned</span>
              </div>
              <div class="flex justify-between text-slate-600">
                <span>Payout Frequency:</span>
                <span class="font-semibold text-slate-900">Daily Automated</span>
              </div>
            </div>

            <div class="space-y-2.5 mb-8">
              ${p.features_list.map(f => `
                <div class="flex items-start gap-2.5 text-xs text-slate-700">
                  <i class="fa-solid fa-check text-[#0500A3] text-[11px] mt-0.5"></i>
                  <span>${f}</span>
                </div>
              `).join('')}
            </div>
          </div>

          <button onclick="App.handlePlanSelect(${p.id})" class="w-full py-3 rounded-xl font-semibold text-xs ${
            isRecommended ? 'btn-primary' : 'btn-secondary'
          }">
            Select ${p.name}
          </button>
        </div>
      `;
    }).join('');
  },

  async loadLiveTransactions() {
    try {
      const res = await API.getLiveTransactions();
      const container = document.getElementById('landing-live-tx-tbody');
      if (!container) return;

      container.innerHTML = res.transactions.map(tx => {
        const isDep = tx.type === 'deposit';
        return `
          <tr class="border-b border-slate-100 hover:bg-slate-50/70 transition-colors text-xs">
            <td class="py-3 px-4 font-semibold text-slate-900 flex items-center gap-2">
              <span class="w-2 h-2 rounded-full ${isDep ? 'bg-emerald-500' : 'bg-slate-400'}"></span>
              ${tx.user}
            </td>
            <td class="py-3 px-4">
              <span class="px-2 py-0.5 rounded-full text-[11px] font-medium ${
                isDep ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-700 border border-slate-200'
              }">
                ${isDep ? 'Deposit' : 'Withdrawal'}
              </span>
            </td>
            <td class="py-3 px-4 font-semibold text-slate-900">$${tx.amount_usd.toLocaleString()}</td>
            <td class="py-3 px-4 font-mono text-slate-600">${tx.amount_btc} BTC</td>
            <td class="py-3 px-4 font-mono text-slate-400">${tx.tx_hash}</td>
            <td class="py-3 px-4 text-right">
              <span class="text-emerald-700 text-xs font-medium inline-flex items-center gap-1">
                <i class="fa-solid fa-check-double text-[10px]"></i> Confirmed
              </span>
            </td>
          </tr>
        `;
      }).join('');
    } catch (e) {
      console.warn("Live tx update caught:", e);
    }
  },

  handlePlanSelect(planId) {
    if (API.token) {
      this.navigate('dashboard');
      Dashboard.switchTab('invest');
      Dashboard.openInvestModal(planId);
    } else {
      this.openModal('register');
    }
  },

  updateAuthUI(isLoggedIn, user = null) {
    const authGuestGroup = document.getElementById('nav-guest-group');
    const authUserGroup = document.getElementById('nav-user-group');
    const navAdminBtn = document.getElementById('nav-admin-link');

    if (isLoggedIn && user) {
      if (authGuestGroup) authGuestGroup.classList.add('hidden');
      if (authUserGroup) authUserGroup.classList.remove('hidden');
      if (navAdminBtn) {
        navAdminBtn.classList.toggle('hidden', user.role !== 'admin');
      }
      const elNavName = document.getElementById('nav-user-display-name');
      if (elNavName) elNavName.innerText = user.full_name;
    } else {
      if (authGuestGroup) authGuestGroup.classList.remove('hidden');
      if (authUserGroup) authUserGroup.classList.add('hidden');
      if (navAdminBtn) navAdminBtn.classList.add('hidden');
    }
  },

  setupNavigation() {
    window.addEventListener('hashchange', () => {
      const rawHash = (window.location.hash || '').replace('#', '');
      if (rawHash === 'dashboard') {
        this.navigate('dashboard', false);
      } else if (rawHash === 'admin') {
        this.navigate('admin', false);
      } else if (rawHash === 'landing') {
        this.navigate('landing', false);
      } else if (!rawHash) {
        if (API.token && API.user) {
          this.navigate(API.user.role === 'admin' ? 'admin' : 'dashboard', false);
        } else {
          this.navigate('landing', false);
        }
      }
    });

    document.querySelectorAll('.btn-home').forEach(el => {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        this.navigate('landing');
      });
    });
  },

  setupModals() {
    ['loginModal', 'registerModal', 'linkSentModal', 'investModal', 'adminBalanceModal'].forEach(id => {
      const modal = document.getElementById(id);
      if (modal) {
        modal.addEventListener('click', (e) => {
          if (e.target === modal) modal.classList.add('hidden');
        });
      }
    });
  },

  openModal(type) {
    const loginM = document.getElementById('loginModal');
    const regM = document.getElementById('registerModal');
    const linkM = document.getElementById('linkSentModal');

    if (type === 'login') {
      if (loginM) loginM.classList.remove('hidden');
      if (regM) regM.classList.add('hidden');
      if (linkM) linkM.classList.add('hidden');
    } else if (type === 'register') {
      if (regM) regM.classList.remove('hidden');
      if (loginM) loginM.classList.add('hidden');
      if (linkM) linkM.classList.add('hidden');
    } else if (type === 'linkSent') {
      if (linkM) linkM.classList.remove('hidden');
      if (loginM) loginM.classList.add('hidden');
      if (regM) regM.classList.add('hidden');
    }
  },

  closeModal(id) {
    const modal = document.getElementById(id);
    if (modal) modal.classList.add('hidden');
  },

  quickDemoLogin(role) {
    const email = role === 'admin' ? 'ayomide4354@gmail.com' : '';
    const password = role === 'admin' ? 'admin123' : '';
    
    document.getElementById('login-email').value = email;
    document.getElementById('login-password').value = password;
    this.handleLoginSubmit();
  },

  async loginWithGoogle() {
    try {
      this.showToast("Opening Google Sign In...", "info");
      const firebaseUser = await FirebaseAuth.signInWithGoogle();
      if (!firebaseUser || !firebaseUser.email) {
        throw new Error("No Google account selected.");
      }

      const email = firebaseUser.email;
      const fullName = firebaseUser.displayName || email.split('@')[0];

      // Sync and log in with MineVest backend (persisted in core database)
      const res = await API.oauthLogin({
        email: email,
        full_name: fullName,
        provider: 'google'
      });

      API.setSession(res.token, res.user);
      this.updateAuthUI(true, res.user);
      this.closeModal('loginModal');
      this.closeModal('registerModal');
      this.showToast(`Signed in with Google as ${res.user.full_name}!`, "success");

      if (res.user.role === 'admin') {
        this.navigate('admin');
      } else {
        this.navigate('dashboard');
      }
    } catch (err) {
      console.error("Google Sign-In error:", err);
      if (err.code === 'auth/popup-closed-by-user') {
        return; // User closed popup, do not show error toast
      }
      this.showToast(err.message || "Failed to sign in with Google", "error");
    }
  },

  async handleLoginSubmit() {
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;

    if (!email || !password) {
      this.showToast("Email and password are required", "error");
      return;
    }

    try {
      const res = await API.login({ email, password });
      API.setSession(res.token, res.user);
      this.updateAuthUI(true, res.user);
      this.closeModal('loginModal');
      this.showToast(`Signed in as ${res.user.full_name}`, "success");

      if (res.user.role === 'admin') {
        this.navigate('admin');
      } else {
        this.navigate('dashboard');
      }
    } catch (err) {
      const msg = (err.message || "").toLowerCase();
      if (msg.includes("activated") || msg.includes("confirm") || msg.includes("verify") || msg.includes("verification")) {
        this.pendingVerificationEmail = email;
        const elEmailDisp = document.getElementById('link-sent-email');
        if (elEmailDisp) elEmailDisp.innerText = email;
        this.closeModal('loginModal');
        this.openModal('linkSent');
        this.showToast(err.message, "info");
      } else {
        this.showToast(err.message, "error");
      }
    }
  },

  async handleRegisterSubmit() {
    const fullName = document.getElementById('reg-name').value.trim();
    const email = document.getElementById('reg-email').value.trim();
    const password = document.getElementById('reg-password').value;
    const refCode = document.getElementById('reg-ref').value.trim();

    if (!fullName || !email || !password) {
      this.showToast("All fields are required", "error");
      return;
    }

    const btn = document.getElementById('btn-register-submit');
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin mr-1"></i> Creating Account...`;
    }

    try {
      const res = await API.register({ full_name: fullName, email, password, referral_code: refCode });
      
      if (res && (res.requires_email_link || res.requires_verification)) {
        this.pendingVerificationEmail = email;
        
        const elEmailDisp = document.getElementById('link-sent-email');
        if (elEmailDisp) elEmailDisp.innerText = email;

        const devBox = document.getElementById('link-sent-dev-box');
        const devBtn = document.getElementById('link-sent-direct-btn');
        if (devBox && devBtn) {
          if (res.rate_limit_exceeded && res.direct_activation_link) {
            devBox.classList.remove('hidden');
            devBtn.href = res.direct_activation_link;
          } else {
            devBox.classList.add('hidden');
          }
        }

        this.closeModal('registerModal');
        this.openModal('linkSent');
        this.showToast(res.message || "Confirmation link sent to your email!", "info");
      } else {
        const createdName = (res && res.user && res.user.full_name) ? res.user.full_name : fullName;
        if (res && res.token && res.user) {
          API.setSession(res.token, res.user);
          this.updateAuthUI(true, res.user);
        }
        this.closeModal('registerModal');
        this.showToast(`Account created for ${createdName}`, "success");
        this.navigate('dashboard');
      }
    } catch (err) {
      this.showToast(err.message, "error");
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerText = "Create Account";
      }
    }
  },

  async handleResendLink() {
    const email = this.pendingVerificationEmail;
    if (!email) {
      this.showToast("Email address missing. Please register again.", "error");
      this.openModal('register');
      return;
    }

    const btn = document.getElementById('btn-resend-link');
    if (btn) {
      btn.disabled = true;
      btn.innerText = "Resending...";
    }

    try {
      const res = await API.resendLink({ email });
      const devBox = document.getElementById('link-sent-dev-box');
      const devBtn = document.getElementById('link-sent-direct-btn');
      if (devBox && devBtn && res && res.rate_limit_exceeded && res.direct_activation_link) {
        devBox.classList.remove('hidden');
        devBtn.href = res.direct_activation_link;
      }
      this.showToast(`Confirmation link re-sent to ${email}!`, "success");
    } catch (err) {
      this.showToast(err.message || "Failed to resend confirmation link", "error");
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerText = "Resend Link";
      }
    }
  },

  logout() {
    try {
      if (typeof FirebaseAuth !== 'undefined') {
        FirebaseAuth.signOut();
      }
    } catch (e) {}
    API.clearSession();
    this.updateAuthUI(false);
    this.navigate('landing');
    this.showToast("You have been signed out.", "info");
  },

  showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    const borderClasses = type === 'success' 
      ? 'border-emerald-200 text-slate-900 bg-white' 
      : type === 'error'
      ? 'border-rose-200 text-slate-900 bg-white'
      : 'border-slate-200 text-slate-900 bg-white';

    const iconColor = type === 'success' 
      ? 'text-emerald-600 fa-circle-check' 
      : type === 'error' 
      ? 'text-rose-600 fa-circle-exclamation' 
      : 'text-[#0500A3] fa-circle-info';

    toast.className = `toast-item flex items-center gap-3 px-4 py-3 border text-xs font-medium transform transition-all duration-300 translate-y-2 opacity-0 ${borderClasses}`;
    toast.innerHTML = `
      <i class="fa-solid ${iconColor} text-sm"></i>
      <span>${message}</span>
    `;

    container.appendChild(toast);
    setTimeout(() => {
      toast.classList.remove('translate-y-2', 'opacity-0');
    }, 10);

    setTimeout(() => {
      toast.classList.add('opacity-0', 'translate-y-1');
      setTimeout(() => toast.remove(), 250);
    }, 3500);
  }
};

window.addEventListener('DOMContentLoaded', () => {
  App.init();
});
