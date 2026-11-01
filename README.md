# MineVest Capital — Bitcoin Investment & Yield Platform

An institutional-grade, full-stack Bitcoin investment and automated daily yield platform built with **FastAPI**, **SQLite**, and a responsive dark-fintech **Tailwind CSS** single-page architecture.

---

## 🌟 Key Features

### 1. Public Marketing Portal
- **Real-Time Bitcoin Market Feed**: Live BTC/USD price ticker, 24h range, 24h high/low, and auto-updating indicators.
- **Tiered Investment Plans**:
  - **Starter Tier**: 20.0% Daily ROI (10 Days) &bull; **200% Total ROI** — $100 to $2,500
  - **Mining Pro Tier**: 20.0% Daily ROI (15 Days) &bull; **300% Total ROI** — $2,500 to $10,000 *(Recommended)*
  - **Institutional Tier**: 20.0% Daily ROI (20 Days) &bull; **400% Total ROI** — $10,000 to $50,000
  - **Whale Alpha Tier**: 20.0% Daily ROI (25 Days) &bull; **500% Total ROI** — $50,000 to $500,000
- **Interactive Real-Time ROI Profit Calculator**: Dynamic amount slider, quick preset chips, daily profits projection, and maturity payout calculation.
- **Live Blockchain Activity Ledger**: Real-time simulated & confirmed transactions stream showing recent deposits and withdrawals with masked addresses and TXIDs.
- **Proof of Reserves & Institutional Security**: BitGo cold storage multi-sig custody, ISO/IEC 27001 data center compliance, and $125M contingency reserve fund.
- **Multi-Tier Affiliate Program**: 7% Tier 1, 3% Tier 2, and 1% Tier 3 commission matrix.
- **FAQ Accordion & Customer Trust Badges**.

### 2. Investor Portal (Client Dashboard)
- **Portfolio Overview**: Total portfolio valuation, available liquid balance, active invested capital, and total yield accrued.
- **Interactive Chart**: Portfolio growth trajectory chart using Chart.js.
- **Active Plans Progress**: Visual progress bars and countdown timers to maturity for active subscriptions.
- **1-Click Daily Yield Simulator**: Simulate a 24-hour cycle to accrue and credit daily ROI earnings with confetti and live balance update.
- **Deposit Bitcoin Flow**: Choose between Native SegWit (Bech32), Lightning Network, or USDT-TRC20, with live QR code generation and 1-Click test deposit simulation.
- **Investment Store**: Activate any tier plan directly with available balance.
- **Instant Withdrawals**: Submit withdrawal requests to any external Bitcoin address with fee estimation and balance validation.
- **Full Transaction Ledger**: Search and filter by deposits, investments, yield profits, and withdrawals.
- **Affiliate Center**: Personalized referral links and real-time commission stats.
- **Account & Security Settings**: Manage legal name, default BTC payout address, and view KYC verification status.

### 3. Administrative Back-Office Console
- **Platform Analytics**: Total active investors, cumulative balances, total deposits, and total withdrawals.
- **Withdrawal Queue**: Authorization queue with **One-Click Approve or Reject** for pending withdrawals.
- **User Management**: View all registered investors and execute manual balance adjustments (credit or set balance).

---

## 🔑 Pre-Configured Demo Credentials

For immediate exploration and testing, 1-Click login buttons are available directly in the Login Modal:

| Role | Email | Password | Permissions |
| :--- | :--- | :--- | :--- |
| **Master Administrator** | `ayomide4354@gmail.com` | `admin123` (or 1-Click Google Sign In) | Master admin back-office, deposit confirmation queue, user management, withdrawal approval |

---

## 🚀 How to Run the Platform

### Option A: Using the Launcher Script (Windows)
Double-click `run.bat` or run:
```cmd
run.bat
```

### Option B: Using Python directly
```powershell
python minevest.py
```
Then open your browser at:
**[http://127.0.0.1:8000](http://127.0.0.1:8000)**

---

## 📁 Project Structure

```
minvest/
├── backend/
│   ├── auth.py          # Session token generator and signature verifier
│   ├── crypto_api.py    # Live Bitcoin pricing engine & conversion helpers
│   └── database.py      # SQLite database schema, connections, and seed records
├── static/
│   ├── css/
│   │   └── styles.css   # Dark fintech luxury styles, glassmorphism, glowing badges
│   └── js/
│       ├── admin.js      # Back-office admin portal logic
│       ├── api.js        # REST API client with bearer token handling
│       ├── app.js        # Central SPA routing, landing page, and authentication
│       ├── calculator.js # Interactive real-time ROI calculator
│       └── dashboard.js  # Investor dashboard components and actions
├── templates/
│   └── index.html       # Responsive unified Single-Page App front-end
├── minevest.db          # SQLite database storage (auto-initialized)
├── minevest.py          # Main FastAPI web server & REST endpoints
├── requirements.txt     # Python dependencies
├── run.bat              # Windows batch launcher
└── README.md            # Documentation
```
