/**
 * Minimalist Clean Investment ROI Calculator
 */
const Calculator = {
  plans: [],
  selectedPlan: null,
  btcPrice: 68450.00,
  amount: 2500,

  init(plans, btcPrice) {
    this.plans = plans || [];
    this.btcPrice = btcPrice || 68450.00;
    
    if (this.plans.length > 0) {
      this.selectedPlan = this.plans.find(p => p.slug === 'pro') || this.plans[0];
      this.amount = this.selectedPlan.min_deposit_usd || 1000;
    }

    this.renderPlanSelector();
    this.setupListeners();
    this.updateCalculation();
  },

  renderPlanSelector() {
    const container = document.getElementById('calc-plan-options');
    if (!container) return;

    container.innerHTML = this.plans.map(p => {
      const isSelected = this.selectedPlan && this.selectedPlan.id === p.id;
      return `
        <button type="button" 
          onclick="Calculator.selectPlan(${p.id})" 
          class="text-left p-4 rounded-xl border transition-all ${
            isSelected 
              ? 'bg-[#EEF0FF] border-[#0500A3] ring-2 ring-[#0500A3]/20 shadow-sm' 
              : 'bg-white border-slate-200 hover:border-slate-300'
          }">
          <div class="font-bold text-sm ${isSelected ? 'text-[#0500A3]' : 'text-slate-900'}">${p.name}</div>
          <div class="text-xs text-slate-500 mt-0.5 font-medium">${p.daily_roi_percent}% Daily &bull; ${p.duration_days} Days</div>
        </button>
      `;
    }).join('');
  },

  selectPlan(planId) {
    this.selectedPlan = this.plans.find(p => p.id === planId);
    if (this.selectedPlan) {
      const slider = document.getElementById('calc-amount-slider');
      const input = document.getElementById('calc-amount-input');
      if (slider) {
        slider.min = this.selectedPlan.min_deposit_usd;
        slider.max = this.selectedPlan.max_deposit_usd;
        if (this.amount < this.selectedPlan.min_deposit_usd || this.amount > this.selectedPlan.max_deposit_usd) {
          this.amount = this.selectedPlan.min_deposit_usd;
        }
        slider.value = this.amount;
      }
      if (input) {
        input.value = this.amount;
      }
    }
    this.renderPlanSelector();
    this.updateCalculation();
  },

  setupListeners() {
    const slider = document.getElementById('calc-amount-slider');
    const input = document.getElementById('calc-amount-input');

    if (slider) {
      slider.addEventListener('input', (e) => {
        this.amount = parseFloat(e.target.value) || 0;
        if (input) input.value = this.amount;
        this.updateCalculation();
      });
    }

    if (input) {
      input.addEventListener('input', (e) => {
        let val = parseFloat(e.target.value) || 0;
        this.amount = val;
        if (slider) slider.value = val;
        this.updateCalculation();
      });
    }
  },

  setPreset(amount) {
    if (!this.selectedPlan) return;
    this.amount = Math.min(Math.max(amount, this.selectedPlan.min_deposit_usd), this.selectedPlan.max_deposit_usd);
    const slider = document.getElementById('calc-amount-slider');
    const input = document.getElementById('calc-amount-input');
    if (slider) slider.value = this.amount;
    if (input) input.value = this.amount;
    this.updateCalculation();
  },

  updateCalculation() {
    if (!this.selectedPlan) return;

    const dailyPercent = this.selectedPlan.daily_roi_percent;
    const durationDays = this.selectedPlan.duration_days;
    const depositUsd = this.amount;

    const dailyProfitUsd = depositUsd * (dailyPercent / 100);
    const totalProfitUsd = dailyProfitUsd * durationDays;
    const totalReturnUsd = depositUsd + totalProfitUsd;
    const totalRoiPercent = (dailyPercent * durationDays).toFixed(1);

    const btcPrice = this.btcPrice || 68450.00;
    const depositBtc = (depositUsd / btcPrice).toFixed(6);
    const dailyProfitBtc = (dailyProfitUsd / btcPrice).toFixed(6);
    const totalProfitBtc = (totalProfitUsd / btcPrice).toFixed(6);
    const totalReturnBtc = (totalReturnUsd / btcPrice).toFixed(6);

    const maturityDate = new Date();
    maturityDate.setDate(maturityDate.getDate() + durationDays);
    const maturityStr = maturityDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

    // Update DOM
    const elDailyUsd = document.getElementById('calc-res-daily-usd');
    const elDailyBtc = document.getElementById('calc-res-daily-btc');
    const elTotalProfitUsd = document.getElementById('calc-res-profit-usd');
    const elTotalProfitBtc = document.getElementById('calc-res-profit-btc');
    const elTotalReturnUsd = document.getElementById('calc-res-total-usd');
    const elTotalReturnBtc = document.getElementById('calc-res-total-btc');
    const elRoiPercent = document.getElementById('calc-res-roi-badge');
    const elMaturity = document.getElementById('calc-res-maturity');
    const elDepositBtcHint = document.getElementById('calc-deposit-btc-hint');

    if (elDailyUsd) elDailyUsd.innerText = `$${dailyProfitUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    if (elDailyBtc) elDailyBtc.innerText = `≈ ${dailyProfitBtc} BTC`;
    if (elTotalProfitUsd) elTotalProfitUsd.innerText = `+$${totalProfitUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    if (elTotalProfitBtc) elTotalProfitBtc.innerText = `≈ ${totalProfitBtc} BTC`;
    if (elTotalReturnUsd) elTotalReturnUsd.innerText = `$${totalReturnUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    if (elTotalReturnBtc) elTotalReturnBtc.innerText = `≈ ${totalReturnBtc} BTC`;
    if (elRoiPercent) elRoiPercent.innerText = `+${totalRoiPercent}% Total ROI`;
    if (elMaturity) elMaturity.innerText = maturityStr;
    if (elDepositBtcHint) elDepositBtcHint.innerText = `≈ ${depositBtc} BTC`;
  }
};
