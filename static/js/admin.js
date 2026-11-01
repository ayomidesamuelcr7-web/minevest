/**
 * Minimalist Clean Admin Back-Office Logic
 * Color scheme: #0500A3 & Pure White
 */
const Admin = {
  overviewData: null,
  users: [],
  withdrawals: [],
  deposits: [],

  async init() {
    await this.refresh();
  },

  async refresh() {
    try {
      this.overviewData = await API.getAdminOverview();
      this.renderOverview();
      await this.loadDeposits();
      await this.loadWithdrawals();
      await this.loadUsers();
    } catch (err) {
      console.error("Admin refresh error:", err);
      App.showToast("Failed to load administrative data", "error");
    }
  },

  renderOverview() {
    if (!this.overviewData) return;
    const o = this.overviewData;
    document.getElementById('adm-total-users').innerText = o.total_users;
    document.getElementById('adm-total-balances').innerText = `$${o.total_investor_balances_usd.toLocaleString()}`;
    document.getElementById('adm-total-deposits').innerText = `$${o.total_deposits_usd.toLocaleString()}`;
    document.getElementById('adm-total-withdrawals').innerText = `$${o.total_withdrawals_usd.toLocaleString()}`;
    document.getElementById('adm-pending-wth-count').innerText = o.pending_withdrawals_count;
    const depCountEl = document.getElementById('adm-pending-dep-count');
    if (depCountEl) depCountEl.innerText = o.pending_deposits_count || 0;
  },

  async loadUsers() {
    try {
      const res = await API.getAdminUsers();
      this.users = res.users;
      const tbody = document.getElementById('adm-users-tbody');
      if (!tbody) return;

      tbody.innerHTML = this.users.map(u => `
        <tr class="border-b border-slate-100 hover:bg-slate-50 text-xs">
          <td class="py-3 px-4 font-mono text-slate-400">#${u.id}</td>
          <td class="py-3 px-4 font-semibold text-slate-900">${u.full_name} <div class="text-[10px] text-slate-400 font-normal">${u.email}</div></td>
          <td class="py-3 px-4">
            <span class="px-2 py-0.5 rounded-full font-medium ${u.role === 'admin' ? 'bg-[#EEF0FF] text-[#0500A3] border border-[#0500A3]/20' : 'bg-slate-100 text-slate-700'}">${u.role}</span>
          </td>
          <td class="py-3 px-4 font-semibold text-slate-900">$${u.balance_usd.toLocaleString()} <span class="text-slate-400 text-[10px]">(${u.balance_btc} BTC)</span></td>
          <td class="py-3 px-4 font-mono text-slate-500">${u.btc_address ? u.btc_address.substring(0, 10) + '...' : 'Not set'}</td>
          <td class="py-3 px-4 text-right">
            <button onclick="Admin.openAdjustBalanceModal(${u.id}, '${u.full_name}', ${u.balance_usd})" class="px-3 py-1 bg-white hover:bg-slate-50 text-[#0500A3] border border-[#0500A3]/40 rounded-lg font-semibold transition-colors">
              Adjust Balance
            </button>
          </td>
        </tr>
      `).join('');
    } catch (err) {
      console.error(err);
    }
  },

  async loadWithdrawals() {
    try {
      const res = await API.getAdminWithdrawals();
      this.withdrawals = res.withdrawals;
      const tbody = document.getElementById('adm-withdrawals-tbody');
      if (!tbody) return;

      if (this.withdrawals.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center py-6 text-slate-400">No withdrawal requests found.</td></tr>`;
        return;
      }

      tbody.innerHTML = this.withdrawals.map(w => `
        <tr class="border-b border-slate-100 hover:bg-slate-50 text-xs">
          <td class="py-3 px-4 font-semibold text-slate-900">${w.full_name} <div class="text-[10px] text-slate-400">${w.email}</div></td>
          <td class="py-3 px-4 font-bold text-slate-900">$${w.amount_usd.toLocaleString()} <span class="text-slate-400 text-[10px]">(${w.amount_btc} BTC)</span></td>
          <td class="py-3 px-4 font-mono text-slate-500">${w.destination_address || 'bc1q...'}</td>
          <td class="py-3 px-4">
            <span class="px-2 py-0.5 rounded-full font-semibold ${w.status === 'completed' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : w.status === 'pending' ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-rose-50 text-rose-700 border border-rose-200'}">${w.status}</span>
          </td>
          <td class="py-3 px-4 text-slate-500">${w.created_at.substring(0, 16)}</td>
          <td class="py-3 px-4 text-right space-x-2">
            ${w.status === 'pending' ? `
              <button onclick="Admin.actionWithdrawal(${w.id}, 'approve')" class="px-3 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg font-semibold">Approve</button>
              <button onclick="Admin.actionWithdrawal(${w.id}, 'reject')" class="px-3 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg font-semibold">Reject</button>
            ` : `<span class="text-slate-400">Processed</span>`}
          </td>
        </tr>
      `).join('');
    } catch (err) {
      console.error(err);
    }
  },

  openAdjustBalanceModal(userId, name, currentBalance) {
    document.getElementById('adm-adj-user-id').value = userId;
    document.getElementById('adm-adj-user-name').innerText = name;
    document.getElementById('adm-adj-current').innerText = `$${currentBalance.toLocaleString()}`;
    document.getElementById('adm-adj-amount').value = 5000;
    document.getElementById('adminBalanceModal').classList.remove('hidden');
  },

  closeAdjustBalanceModal() {
    document.getElementById('adminBalanceModal').classList.add('hidden');
  },

  async submitAdjustBalance() {
    const userId = document.getElementById('adm-adj-user-id').value;
    const amount = parseFloat(document.getElementById('adm-adj-amount').value);
    const action = document.getElementById('adm-adj-action').value;

    if (isNaN(amount) || amount < 0) {
      App.showToast("Please enter a valid amount", "error");
      return;
    }

    try {
      await API.adjustUserBalance(userId, { amount_usd: amount, amount_btc: 0, action });
      this.closeAdjustBalanceModal();
      App.showToast("User balance updated", "success");
      await this.refresh();
    } catch (err) {
      App.showToast(err.message, "error");
    }
  },

  async actionWithdrawal(txId, action) {
    if (!confirm(`Are you sure you want to ${action} this withdrawal?`)) return;

    try {
      await API.processWithdrawal(txId, action);
      App.showToast(`Withdrawal ${action}d successfully`, "success");
      await this.refresh();
    } catch (err) {
      App.showToast(err.message, "error");
    }
  },

  async loadDeposits() {
    try {
      const res = await API.getAdminDeposits();
      this.deposits = res.deposits;
      const tbody = document.getElementById('adm-deposits-tbody');
      const badge = document.getElementById('adm-pending-dep-badge');
      
      const pendingCount = this.deposits.filter(d => d.status === 'pending').length;
      if (badge) badge.innerText = `${pendingCount} Pending`;

      if (!tbody) return;

      if (this.deposits.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="text-center py-6 text-slate-400">No deposit records found.</td></tr>`;
        return;
      }

      tbody.innerHTML = this.deposits.map(d => `
        <tr class="border-b border-slate-100 hover:bg-slate-50 text-xs">
          <td class="py-3 px-4 font-semibold text-slate-900">
            ${d.full_name} 
            <div class="text-[10px] text-slate-400 font-normal">${d.email}</div>
          </td>
          <td class="py-3 px-4 font-bold text-slate-900">
            $${d.amount_usd.toLocaleString()} 
            <span class="text-slate-400 text-[10px] font-normal">(${d.amount_btc} BTC)</span>
          </td>
          <td class="py-3 px-4 font-mono text-[11px] text-[#0500A3] select-all">
            ${d.destination_address || 'Platform Vault'}
          </td>
          <td class="py-3 px-4 font-mono text-slate-500 text-[11px]">
            ${d.tx_hash ? d.tx_hash.substring(0, 10) + '...' + d.tx_hash.substring(d.tx_hash.length - 6) : 'N/A'}
          </td>
          <td class="py-3 px-4">
            <span class="px-2 py-0.5 rounded-full font-semibold ${
              d.status === 'completed' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
              d.status === 'pending' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
              'bg-rose-50 text-rose-700 border border-rose-200'
            }">${d.status}</span>
          </td>
          <td class="py-3 px-4 text-slate-500 text-[11px]">${d.created_at.substring(0, 16)}</td>
          <td class="py-3 px-4 text-right space-x-2">
            ${d.status === 'pending' ? `
              <button onclick="Admin.actionDeposit(${d.id}, 'approve')" class="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold shadow-xs transition-colors">
                <i class="fa-solid fa-check mr-1"></i>Confirm Deposit
              </button>
              <button onclick="Admin.actionDeposit(${d.id}, 'reject')" class="px-3 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg font-semibold transition-colors">
                Reject
              </button>
            ` : `<span class="text-slate-400 text-[11px]">${d.status === 'completed' ? '✓ Credited' : 'Rejected'}</span>`}
          </td>
        </tr>
      `).join('');
    } catch (err) {
      console.error(err);
    }
  },

  async actionDeposit(txId, action) {
    const actionLabel = action === 'approve' ? 'confirm and credit' : 'reject';
    if (!confirm(`Are you sure you want to ${actionLabel} this deposit?`)) return;

    try {
      const res = await API.processDeposit(txId, action);
      App.showToast(res.message || `Deposit ${action}d successfully`, "success");
      await this.refresh();
    } catch (err) {
      App.showToast(err.message, "error");
    }
  }
};
