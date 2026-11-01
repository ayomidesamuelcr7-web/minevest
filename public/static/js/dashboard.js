/**
 * Minimalist Clean Investor Dashboard Logic
 * Color scheme: #0500A3 & Pure White
 */
const Dashboard = {
  currentTab: 'overview',
  data: null,
  chartInstance: null,

  async init() {
    await this.refresh();
    this.setupListeners();
  },

  async refresh() {
    try {
      this.data = await API.getInvestorOverview();
      this.renderUserData();
      this.renderOverviewTab();
      this.renderActiveInvestments();
      this.renderTransactions();
    } catch (err) {
      console.error("Dashboard refresh error:", err);
      if (err.message && (err.message.includes("expired session") || err.message.includes("401"))) {
        App.logout();
      } else {
        App.showToast(err.message || "Unable to sync dashboard ledger", "error");
      }
    }
  },

  switchTab(tabId) {
    this.currentTab = tabId;
    
    document.querySelectorAll('.dash-nav-btn').forEach(btn => {
      const active = btn.getAttribute('data-tab') === tabId;
      btn.classList.toggle('bg-[#EEF0FF]', active);
      btn.classList.toggle('text-[#0500A3]', active);
      btn.classList.toggle('font-semibold', active);
      btn.classList.toggle('text-slate-600', !active);
    });

    document.querySelectorAll('.dash-tab-pane').forEach(pane => {
      pane.classList.toggle('hidden', pane.id !== `dash-pane-${tabId}`);
    });

    if (tabId === 'overview') {
      this.renderOverviewTab();
    } else if (tabId === 'deposit') {
      this.renderDepositTab();
    } else if (tabId === 'invest') {
      this.renderInvestTab();
    } else if (tabId === 'my-investments') {
      this.renderActiveInvestmentsTab();
    } else if (tabId === 'withdraw') {
      this.renderWithdrawTab();
    } else if (tabId === 'transactions') {
      this.renderTransactionsTab();
    } else if (tabId === 'referrals') {
      this.renderReferralsTab();
    } else if (tabId === 'settings') {
      this.renderSettingsTab();
    }
  },

  renderUserData() {
    if (!this.data) return;
    const { user, balance } = this.data;

    const elHdrBalance = document.getElementById('hdr-user-balance');
    const elHdrBtc = document.getElementById('hdr-user-btc');
    const elUserName = document.getElementById('dash-user-name');
    const elUserEmail = document.getElementById('dash-user-email');
    const elUserKyc = document.getElementById('dash-user-kyc');

    if (elHdrBalance) elHdrBalance.innerText = `$${balance.available_usd.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
    if (elHdrBtc) elHdrBtc.innerText = `(${balance.available_btc} BTC)`;
    if (elUserName) elUserName.innerText = user.full_name;
    if (elUserEmail) elUserEmail.innerText = user.email;
    if (elUserKyc) {
      elUserKyc.innerText = user.kyc_status.toUpperCase();
      elUserKyc.className = `text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
        user.kyc_status === 'verified' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
      }`;
    }
  },

  renderOverviewTab() {
    if (!this.data) return;
    const { balance } = this.data;

    document.getElementById('dash-total-portfolio').innerText = `$${balance.portfolio_usd.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
    document.getElementById('dash-total-portfolio-btc').innerText = `≈ ${balance.portfolio_btc} BTC`;

    const elAvail = document.getElementById('dash-available-balance');
    if (elAvail) elAvail.innerText = `$${balance.available_usd.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
    const elAvailBtc = document.getElementById('dash-available-balance-btc');
    if (elAvailBtc) elAvailBtc.innerText = `≈ ${balance.available_btc} BTC`;

    document.getElementById('dash-active-invested').innerText = `$${balance.active_invested_usd.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
    document.getElementById('dash-active-invested-btc').innerText = `≈ ${balance.active_invested_btc} BTC`;

    document.getElementById('dash-total-profit').innerText = `+$${balance.total_profit_usd.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
    document.getElementById('dash-total-profit-btc').innerText = `≈ ${balance.total_profit_btc} BTC`;

    this.renderPortfolioChart();
  },

  renderPortfolioChart() {
    const ctx = document.getElementById('portfolioChart');
    if (!ctx) return;

    if (this.chartInstance) {
      this.chartInstance.destroy();
    }

    const { balance, recent_transactions, active_investments } = this.data;
    const hasActivity = (balance && balance.portfolio_usd > 0) || 
                        (recent_transactions && recent_transactions.length > 0) || 
                        (active_investments && active_investments.length > 0);

    const emptyStateEl = document.getElementById('dash-chart-empty-state');
    const badgeEl = document.getElementById('dash-chart-change-badge');
    const labels = ['Day 1', 'Day 2', 'Day 3', 'Day 4', 'Day 5', 'Day 6', 'Today'];

    let dataPoints = [];

    if (!hasActivity) {
      // User has no balance, no investments, and no transactions yet
      if (emptyStateEl) emptyStateEl.classList.remove('hidden');
      if (badgeEl) {
        badgeEl.innerText = "0.0% This Week";
        badgeEl.className = "text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200";
      }
      dataPoints = [0, 0, 0, 0, 0, 0, 0];
    } else {
      if (emptyStateEl) emptyStateEl.classList.add('hidden');

      const currentVal = balance.portfolio_usd || 0;
      const profitVal = balance.total_profit_usd || 0;
      const startVal = Math.max(0, currentVal - profitVal);
      const diff = currentVal - startVal;

      const pctChange = startVal > 0 ? ((diff / startVal) * 100).toFixed(1) : (currentVal > 0 ? '100.0' : '0.0');
      const isPos = parseFloat(pctChange) >= 0;

      if (badgeEl) {
        badgeEl.innerHTML = `<i class="fa-solid fa-arrow-${isPos ? 'up' : 'down'} text-[10px]"></i> ${isPos ? '+' : ''}${pctChange}% This Week`;
        badgeEl.className = `text-xs font-semibold px-2.5 py-0.5 rounded-full ${
          isPos ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'
        }`;
      }

      dataPoints = [
        Math.round(startVal),
        Math.round(startVal + diff * 0.18),
        Math.round(startVal + diff * 0.38),
        Math.round(startVal + diff * 0.58),
        Math.round(startVal + diff * 0.78),
        Math.round(startVal + diff * 0.92),
        Math.round(currentVal)
      ];
    }

    this.chartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: 'Portfolio (USD)',
          data: dataPoints,
          borderColor: hasActivity ? '#0500A3' : '#CBD5E1',
          backgroundColor: hasActivity ? 'rgba(5, 0, 163, 0.04)' : 'rgba(203, 213, 225, 0.04)',
          borderWidth: 2.5,
          fill: true,
          tension: 0.35,
          pointBackgroundColor: hasActivity ? '#0500A3' : '#94A3B8',
          pointBorderColor: '#FFFFFF',
          pointBorderWidth: 2,
          pointRadius: hasActivity ? 4 : 2,
          pointHoverRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            enabled: hasActivity,
            backgroundColor: '#0B0F19',
            titleColor: '#FFFFFF',
            bodyColor: '#EEF0FF',
            padding: 10,
            cornerRadius: 8,
            displayColors: false,
            callbacks: {
              label: (context) => `$${context.parsed.y.toLocaleString()}`
            }
          }
        },
        scales: {
          x: {
            grid: { color: '#F1F5F9' },
            ticks: { color: '#94A3B8', font: { size: 11, family: 'Inter' } }
          },
          y: {
            min: 0,
            grid: { color: '#F1F5F9' },
            ticks: {
              color: '#94A3B8',
              font: { size: 11, family: 'Inter' },
              callback: (val) => `$${val.toLocaleString()}`
            }
          }
        }
      }
    });
  },

  renderActiveInvestments() {
    const container = document.getElementById('dash-active-plans-container');
    if (!container) return;

    const list = this.data.active_investments || [];
    if (list.length === 0) {
      container.innerHTML = `
        <div class="text-center py-10 px-4 card-clean border-dashed">
          <i class="fa-solid fa-layer-group text-2xl text-slate-300 mb-2 block"></i>
          <p class="text-slate-500 text-xs font-medium">No active investment cycles currently running.</p>
          <button onclick="Dashboard.switchTab('invest')" class="mt-3 px-4 py-2 btn-primary text-xs">
            Explore Yield Plans
          </button>
        </div>
      `;
      return;
    }

    container.innerHTML = list.map(inv => `
      <div class="card-clean p-6">
        <div class="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div>
            <div class="flex items-center gap-2">
              <span class="w-2 h-2 rounded-full bg-emerald-500"></span>
              <h4 class="font-bold text-slate-900 text-base">${inv.plan_name}</h4>
              <span class="text-xs px-2.5 py-0.5 rounded-full bg-[#EEF0FF] text-[#0500A3] font-semibold border border-[#0500A3]/20">+${inv.daily_roi_percent}% Daily</span>
            </div>
            <p class="text-xs text-slate-500 mt-1">Start Date: ${inv.start_date.substring(0, 10)} &bull; Maturity: ${inv.end_date.substring(0, 10)}</p>
          </div>
          <div class="text-right">
            <div class="text-xs text-slate-500">Allocated Capital</div>
            <div class="text-base font-bold text-slate-900">$${inv.amount_usd.toLocaleString()} <span class="text-xs text-slate-500 font-normal">(${inv.amount_btc} BTC)</span></div>
          </div>
        </div>

        <div class="mb-4">
          <div class="flex justify-between text-xs text-slate-500 mb-1.5">
            <span>Cycle Progress: <strong class="text-slate-900 font-semibold">${inv.progress_percent}%</strong></span>
            <span>${inv.days_remaining} Days Remaining</span>
          </div>
          <div class="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
            <div class="bg-[#0500A3] h-2 rounded-full transition-all duration-500" style="width: ${inv.progress_percent}%"></div>
          </div>
        </div>

        <div class="grid grid-cols-2 md:grid-cols-3 gap-3 p-3.5 bg-slate-50 rounded-xl border border-slate-100 text-xs">
          <div>
            <span class="text-slate-500 block">Daily Distribution:</span>
            <span class="font-semibold text-emerald-700">+$${inv.daily_payout_usd} / day</span>
          </div>
          <div>
            <span class="text-slate-500 block">Accrued to Date:</span>
            <span class="font-semibold text-slate-900">+$${inv.total_earned_usd.toLocaleString()}</span>
          </div>
          <div>
            <span class="text-slate-500 block">Total Payout at Maturity:</span>
            <span class="font-semibold text-[#0500A3]">$${inv.total_expected_return_usd.toLocaleString()}</span>
          </div>
        </div>
      </div>
    `).join('');
  },

  renderTransactions() {
    const tbody = document.getElementById('dash-recent-tx-tbody');
    if (!tbody) return;

    const list = this.data.recent_transactions || [];
    if (list.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" class="text-center py-6 text-slate-400">No recent transactions recorded.</td></tr>`;
      return;
    }

    tbody.innerHTML = list.map(tx => {
      let typeBadge = '';
      if (tx.type === 'deposit') typeBadge = '<span class="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200"><i class="fa-solid fa-arrow-down mr-1"></i> Deposit</span>';
      else if (tx.type === 'withdrawal') typeBadge = '<span class="px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200"><i class="fa-solid fa-arrow-up mr-1"></i> Withdrawal</span>';
      else if (tx.type === 'profit') typeBadge = '<span class="px-2 py-0.5 rounded-full text-xs font-semibold bg-[#EEF0FF] text-[#0500A3] border border-[#0500A3]/20"><i class="fa-solid fa-coins mr-1"></i> Yield Accrual</span>';
      else typeBadge = '<span class="px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200"><i class="fa-solid fa-layer-group mr-1"></i> Allocation</span>';

      let statusBadge = tx.status === 'completed'
        ? '<span class="text-emerald-700 font-semibold text-xs inline-flex items-center gap-1"><i class="fa-solid fa-check text-[10px]"></i> Completed</span>'
        : tx.status === 'pending'
        ? '<span class="text-amber-700 font-semibold text-xs inline-flex items-center gap-1"><i class="fa-solid fa-clock text-[10px]"></i> In Review</span>'
        : '<span class="text-rose-700 font-semibold text-xs inline-flex items-center gap-1"><i class="fa-solid fa-xmark text-[10px]"></i> Rejected</span>';

      return `
        <tr class="border-b border-slate-100 hover:bg-slate-50 transition-colors">
          <td class="py-3 px-4">${typeBadge}</td>
          <td class="py-3 px-4 font-semibold text-slate-900">
            $${tx.amount_usd.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            <div class="text-[11px] text-slate-400 font-normal">${tx.amount_btc} BTC</div>
          </td>
          <td class="py-3 px-4 text-xs font-mono text-slate-500">
            ${tx.tx_hash ? tx.tx_hash.substring(0, 10) + '...' + tx.tx_hash.substring(tx.tx_hash.length - 6) : 'Internal'}
          </td>
          <td class="py-3 px-4 text-xs text-slate-500">${tx.created_at.substring(0, 16)}</td>
          <td class="py-3 px-4 text-right">${statusBadge}</td>
        </tr>
      `;
    }).join('');
  },

  renderDepositTab() {
    const platformDepositAddr = 'bc1qzul99g93eyeqdsta066p7vddzd38nea8w5j2wc';
    const elAddr = document.getElementById('deposit-btc-address');
    if (elAddr) elAddr.innerText = platformDepositAddr;

    const qrImg = document.getElementById('deposit-qr-code');
    if (qrImg) {
      qrImg.src = '/static/img/btc_deposit_qr.png';
    }
  },

  renderInvestTab() {
    const container = document.getElementById('dash-invest-plans-grid');
    if (!container || !App.plans) return;

    container.innerHTML = App.plans.map(p => `
      <div class="card-clean p-6 flex flex-col justify-between">
        <div>
          <div class="flex items-center justify-between mb-3">
            <span class="text-xs font-semibold px-2 py-0.5 rounded-full bg-[#EEF0FF] text-[#0500A3] border border-[#0500A3]/20">${p.badge || 'Tier Plan'}</span>
            <span class="text-xs text-slate-500">${p.duration_days} Days Lock</span>
          </div>
          <h3 class="font-bold text-lg text-slate-900 mb-1">${p.name}</h3>
          <div class="text-2xl font-black text-[#0500A3] mb-2">+${p.daily_roi_percent}% <span class="text-xs font-normal text-slate-500">/ day</span></div>
          <p class="text-xs text-slate-600 mb-4">${p.description}</p>
          
          <div class="space-y-2 py-3 border-y border-slate-100 text-xs mb-4">
            <div class="flex justify-between text-slate-600"><span>Minimum:</span><strong class="text-slate-900">$${p.min_deposit_usd.toLocaleString()}</strong></div>
            <div class="flex justify-between text-slate-600"><span>Maximum:</span><strong class="text-slate-900">$${p.max_deposit_usd.toLocaleString()}</strong></div>
            <div class="flex justify-between text-slate-600"><span>Total Net Return:</span><strong class="text-emerald-600 font-semibold">+${p.total_roi_percent}%</strong></div>
          </div>
        </div>

        <button onclick="Dashboard.openInvestModal(${p.id})" class="w-full py-2.5 btn-primary text-xs">
          Subscribe from Balance
        </button>
      </div>
    `).join('');
  },

  openInvestModal(planId) {
    const plan = App.plans.find(p => p.id === planId);
    if (!plan) return;

    document.getElementById('invest-modal-plan-id').value = plan.id;
    document.getElementById('invest-modal-plan-name').innerText = plan.name;
    document.getElementById('invest-modal-daily-roi').innerText = `+${plan.daily_roi_percent}% / day (${plan.duration_days} Days) • +${plan.total_roi_percent}% Total ROI`;
    document.getElementById('invest-modal-range').innerText = `$${plan.min_deposit_usd.toLocaleString()} - $${plan.max_deposit_usd.toLocaleString()}`;
    document.getElementById('invest-modal-balance-hint').innerText = `$${this.data.balance.available_usd.toLocaleString()}`;
    
    const input = document.getElementById('invest-modal-amount');
    input.min = plan.min_deposit_usd;
    input.max = plan.max_deposit_usd;
    input.value = plan.min_deposit_usd;

    document.getElementById('investModal').classList.remove('hidden');
  },

  closeInvestModal() {
    document.getElementById('investModal').classList.add('hidden');
  },

  async submitInvestment() {
    const planId = parseInt(document.getElementById('invest-modal-plan-id').value);
    const amount = parseFloat(document.getElementById('invest-modal-amount').value);

    if (isNaN(amount) || amount <= 0) {
      App.showToast("Please enter a valid investment amount", "error");
      return;
    }

    try {
      const res = await API.invest({ plan_id: planId, amount_usd: amount });
      this.closeInvestModal();
      App.showToast(res.message, "success");
      await this.refresh();
      this.switchTab('overview');
    } catch (err) {
      App.showToast(err.message, "error");
    }
  },

  async triggerAccrual() {
    const btn = document.getElementById('btn-simulate-accrual');
    const origText = btn ? btn.innerText : 'Synchronize Daily Yield';
    try {
      if (btn) {
        btn.disabled = true;
        btn.innerText = 'Synchronizing...';
      }

      const res = await API.triggerYieldAccrual();
      if (res.accrued_total_usd > 0) {
        App.showToast(res.message, "success");
      } else {
        App.showToast(res.message, "info");
      }

      await this.refresh();
    } catch (err) {
      App.showToast(err.message, "error");
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerText = origText;
      }
    }
  },

  async handleDepositSubmit() {
    const amount = parseFloat(document.getElementById('deposit-amount-input').value);
    const network = document.getElementById('deposit-network-select')?.value || 'bitcoin';

    if (isNaN(amount) || amount < 10) {
      App.showToast("Minimum deposit is $10.00 USD", "error");
      return;
    }

    try {
      const res = await API.deposit({ amount_usd: amount, network });
      App.showToast(res.message || "Deposit submitted! Status is pending admin confirmation.", "success");
      await this.refresh();
      this.switchTab('transactions');
    } catch (err) {
      App.showToast(err.message, "error");
    }
  },

  renderWithdrawTab() {
    document.getElementById('wth-avail-balance').innerText = `$${this.data.balance.available_usd.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
    const inputAddr = document.getElementById('wth-btc-address');
    if (inputAddr && !inputAddr.value) {
      inputAddr.value = this.data.user.btc_address || '';
    }
  },

  setWithdrawMax() {
    document.getElementById('wth-amount-input').value = this.data.balance.available_usd;
  },

  async handleWithdrawSubmit() {
    const amount = parseFloat(document.getElementById('wth-amount-input').value);
    const btcAddress = document.getElementById('wth-btc-address').value.trim();

    if (isNaN(amount) || amount < 25) {
      App.showToast("Minimum withdrawal is $25.00 USD", "error");
      return;
    }
    if (!btcAddress || btcAddress.length < 20) {
      App.showToast("Please provide a valid Bitcoin address", "error");
      return;
    }

    try {
      const res = await API.withdraw({ amount_usd: amount, btc_address: btcAddress });
      App.showToast(res.message, "success");
      await this.refresh();
      this.switchTab('overview');
    } catch (err) {
      App.showToast(err.message, "error");
    }
  },

  renderActiveInvestmentsTab() {
    const container = document.getElementById('active-investments-full-list');
    if (!container) return;
    const list = this.data.active_investments || [];
    if (list.length === 0) {
      container.innerHTML = `<div class="p-8 text-center text-slate-400 card-clean">No active cycles running currently.</div>`;
      return;
    }
    container.innerHTML = list.map(inv => `
      <div class="card-clean p-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div class="flex items-center gap-2">
            <h4 class="font-bold text-slate-900 text-base">${inv.plan_name}</h4>
            <span class="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">Active</span>
          </div>
          <p class="text-xs text-slate-500 mt-1">Capital: $${inv.amount_usd.toLocaleString()} (${inv.amount_btc} BTC) &bull; Yield Rate: +${inv.daily_roi_percent}% Daily</p>
        </div>
        <div class="text-right">
          <div class="text-sm font-bold text-emerald-700">Earned: +$${inv.total_earned_usd.toLocaleString()}</div>
          <div class="text-xs text-slate-500">${inv.days_remaining} Days Remaining</div>
        </div>
      </div>
    `).join('');
  },

  renderTransactionsTab() {
    const filter = document.getElementById('tx-filter-select')?.value || 'all';
    API.getTransactions(filter).then(res => {
      const tbody = document.getElementById('tx-full-tbody');
      if (!tbody) return;
      tbody.innerHTML = res.transactions.map(tx => `
        <tr class="border-b border-slate-100 hover:bg-slate-50 text-xs">
          <td class="py-3 px-4 font-semibold text-slate-900 uppercase text-[11px]">${tx.type}</td>
          <td class="py-3 px-4 font-semibold text-slate-900">$${tx.amount_usd.toLocaleString()} <span class="text-slate-400 font-normal">(${tx.amount_btc} BTC)</span></td>
          <td class="py-3 px-4 font-mono text-slate-500">${tx.tx_hash || 'Internal'}</td>
          <td class="py-3 px-4 text-slate-500">${tx.created_at}</td>
          <td class="py-3 px-4 text-right">
            <span class="px-2 py-0.5 rounded-full text-xs font-semibold ${tx.status === 'completed' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'}">${tx.status}</span>
          </td>
        </tr>
      `).join('');
    });
  },

  async renderReferralsTab() {
    try {
      const res = await API.getReferrals();
      document.getElementById('ref-link-input').value = res.referral_link;
      document.getElementById('ref-total-count').innerText = res.total_referrals;
      document.getElementById('ref-total-earnings').innerText = `$${res.total_earnings_usd.toLocaleString()}`;
    } catch (err) {
      console.error(err);
    }
  },

  renderSettingsTab() {
    if (!this.data) return;
    document.getElementById('set-full-name').value = this.data.user.full_name;
    document.getElementById('set-btc-address').value = this.data.user.btc_address || '';
  },

  async handleProfileUpdate() {
    const fullName = document.getElementById('set-full-name').value.trim();
    const btcAddress = document.getElementById('set-btc-address').value.trim();

    try {
      await API.updateProfile({ full_name: fullName, btc_address: btcAddress });
      App.showToast("Profile settings saved", "success");
      await this.refresh();
    } catch (err) {
      App.showToast(err.message, "error");
    }
  },

  setupListeners() {
    const depInput = document.getElementById('deposit-amount-input');
    if (depInput) {
      depInput.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value) || 0;
        const btcPrice = this.data?.btc_price || 68450;
        document.getElementById('deposit-btc-equiv').innerText = `≈ ${(val / btcPrice).toFixed(6)} BTC`;
      });
    }
  }
};
