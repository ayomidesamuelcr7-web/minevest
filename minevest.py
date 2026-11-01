import os
import secrets
from datetime import datetime, timedelta
from typing import Optional, List
from fastapi import FastAPI, Depends, HTTPException, Header, status
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse, RedirectResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from backend.database import get_db, init_db, hash_password, verify_password, generate_referral_code
from backend.auth import create_access_token, verify_token
from backend.crypto_api import get_live_btc_data, usd_to_btc, btc_to_usd
from backend.email_service import send_verification_email, generate_verification_code, send_confirmation_link_email

# Initialize database on startup
init_db()

app = FastAPI(title="MineVest Crypto Capital", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
STATIC_DIR = os.path.join(BASE_DIR, "static")
TEMPLATES_DIR = os.path.join(BASE_DIR, "templates")

# Mount static files
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

# Models
class RegisterRequest(BaseModel):
    full_name: str
    email: str
    password: str
    referral_code: Optional[str] = ""
    btc_address: Optional[str] = ""

class ConfirmLinkRequest(BaseModel):
    email: Optional[str] = ""
    token: Optional[str] = ""

class ResendLinkRequest(BaseModel):
    email: str

class LoginRequest(BaseModel):
    email: str
    password: str

class OAuthLoginRequest(BaseModel):
    email: str
    full_name: Optional[str] = "Investor"
    provider: Optional[str] = "google"

class InvestRequest(BaseModel):
    plan_id: int
    amount_usd: float

class DepositRequest(BaseModel):
    amount_usd: float
    network: Optional[str] = "bitcoin"
    simulate_instant: Optional[bool] = False

class WithdrawRequest(BaseModel):
    amount_usd: float
    btc_address: str
    notes: Optional[str] = ""

class AdjustBalanceRequest(BaseModel):
    amount_usd: float
    amount_btc: float
    action: str # "add" or "set"

class ProfileUpdateRequest(BaseModel):
    full_name: Optional[str] = None
    btc_address: Optional[str] = None
    kyc_status: Optional[str] = None

# Helper dependency to authenticate requests
def get_current_user(authorization: Optional[str] = Header(None)):
    if not authorization:
        raise HTTPException(status_code=401, detail="Authentication token required")
    token = authorization.replace("Bearer ", "").strip()
    payload = verify_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired session token")
    
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM users WHERE id = ?", (payload["user_id"],))
    user = cursor.fetchone()
    conn.close()
    if not user:
        raise HTTPException(status_code=404, detail="User account not found")
    return dict(user)

def get_admin_user(current_user: dict = Depends(get_current_user)):
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Administrative access required")
    return current_user

# --- Public API Routes ---

@app.get("/api/public/stats")
def get_public_stats():
    btc_info = get_live_btc_data()
    return {
        "btc": btc_info,
        "platform": {
            "aum_usd": "$482,910,400",
            "total_investors": "148,290",
            "active_miners": "24,810",
            "total_paid_out_usd": "$164,750,210",
            "cold_reserve_btc": "4,180 BTC",
            "uptime_percent": "99.99%",
            "insurance_fund_usd": "$125,000,000",
            "average_daily_yield": "20.0%"
        }
    }

@app.get("/api/public/plans")
def get_plans():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM investment_plans WHERE is_active = 1 ORDER BY min_deposit_usd ASC")
    rows = cursor.fetchall()
    conn.close()
    
    plans = []
    btc_price = get_live_btc_data()["price_usd"]
    for row in rows:
        plan = dict(row)
        plan["features_list"] = [f.strip() for f in plan["features"].split(";") if f.strip()]
        plan["min_deposit_btc"] = round(plan["min_deposit_usd"] / btc_price, 6)
        plan["max_deposit_btc"] = round(plan["max_deposit_usd"] / btc_price, 6)
        plan["total_roi_percent"] = round(plan["daily_roi_percent"] * plan["duration_days"], 2)
        plans.append(plan)
    return {"plans": plans}

@app.get("/api/public/live-transactions")
def get_live_transactions():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT t.*, u.full_name 
        FROM transactions t 
        JOIN users u ON t.user_id = u.id 
        ORDER BY t.created_at DESC LIMIT 12
    """)
    rows = cursor.fetchall()
    conn.close()
    
    real_txs = []
    for r in rows:
        d = dict(r)
        # mask name for privacy: e.g. "Alexander Vance" -> "A. Vance"
        names = d["full_name"].split()
        masked_name = f"{names[0][0]}. {names[-1]}" if len(names) > 1 else names[0]
        real_txs.append({
            "id": d["id"],
            "user": masked_name,
            "type": d["type"],
            "amount_usd": d["amount_usd"],
            "amount_btc": d["amount_btc"],
            "tx_hash": d["tx_hash"][:10] + "..." + d["tx_hash"][-6:] if d["tx_hash"] else "0x" + secrets.token_hex(8),
            "status": d["status"],
            "time_ago": "Recent",
            "created_at": d["created_at"]
        })
    return {"transactions": real_txs}

# --- Authentication Routes ---

@app.get("/confirm")
def confirm_email_get(email: str, token: str):
    email_clean = email.strip().lower()
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT id, verification_code FROM users WHERE email = ?", (email_clean,))
    user = cursor.fetchone()
    if not user or user.get("verification_code") != token:
        conn.close()
        return RedirectResponse(url="/#error=invalid_token", status_code=302)
    cursor.execute("UPDATE users SET is_verified = 1 WHERE email = ?", (email_clean,))
    conn.commit()
    conn.close()
    return RedirectResponse(url="/#confirmed", status_code=302)

@app.post("/api/auth/register")
def register_user(req: RegisterRequest):
    email_clean = req.email.strip().lower()
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT id, is_verified, verification_code FROM users WHERE email = ?", (email_clean,))
    existing_user = cursor.fetchone()

    token = secrets.token_urlsafe(32)
    direct_link = f"http://127.0.0.1:8000/confirm?email={email_clean}&token={token}"
    rate_limit_exceeded = False

    if existing_user:
        if existing_user.get("is_verified", 1) == 1:
            conn.close()
            raise HTTPException(status_code=400, detail="This email is already registered and verified. Please sign in.")
        
        # If unverified, update verification token and send fresh link
        cursor.execute("UPDATE users SET verification_code = ? WHERE email = ?", (token, email_clean))
        conn.commit()
        conn.close()

        send_confirmation_link_email(email_clean, req.full_name.strip(), direct_link)

        return {
            "requires_email_link": True,
            "email": email_clean,
            "rate_limit_exceeded": False,
            "direct_activation_link": direct_link,
            "message": f"Confirmation link sent to {email_clean}! Please check your email to activate your account.",
            "user": {
                "email": email_clean,
                "full_name": req.full_name.strip(),
                "role": "investor"
            }
        }

    # Dispatch confirmation email via institutional email service
    send_confirmation_link_email(email_clean, req.full_name.strip(), direct_link)

    pwd_hash = hash_password(req.password)
    ref_code = generate_referral_code()
    generated_btc_address = req.btc_address.strip() or f"bc1q{secrets.token_hex(18)}"

    cursor.execute("""
        INSERT INTO users (email, full_name, password_hash, role, btc_address, balance_usd, balance_btc, referral_code, referred_by, kyc_status, is_verified, verification_code)
        VALUES (?, ?, ?, 'investor', ?, 0.0, 0.0, ?, ?, 'verified', 0, ?)
    """, (email_clean, req.full_name.strip(), pwd_hash, generated_btc_address, ref_code, req.referral_code.strip(), token))
    conn.commit()
    conn.close()

    return {
        "requires_email_link": True,
        "email": email_clean,
        "rate_limit_exceeded": False,
        "direct_activation_link": direct_link,
        "message": f"Confirmation link sent to {email_clean}! Please check your inbox and click the link to activate your account.",
        "user": {
            "email": email_clean,
            "full_name": req.full_name.strip(),
            "role": "investor"
        }
    }

@app.post("/api/auth/confirm-email-link")
def confirm_email_link(req: ConfirmLinkRequest):
    email = req.email.strip().lower()
    conn = get_db()
    cursor = conn.cursor()
    if email:
        cursor.execute("UPDATE users SET is_verified = 1 WHERE email = ?", (email,))
        conn.commit()
    conn.close()
    return {"success": True, "message": "Email confirmed successfully"}

@app.post("/api/auth/resend-link")
def resend_confirmation_link(req: ResendLinkRequest):
    email_clean = req.email.strip().lower()
    if not email_clean:
        raise HTTPException(status_code=400, detail="Email is required")
    
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT id, full_name, verification_code FROM users WHERE email = ?", (email_clean,))
    user = cursor.fetchone()
    
    token = secrets.token_urlsafe(32)
    if user:
        token = user.get("verification_code") or token
        cursor.execute("UPDATE users SET verification_code = ? WHERE email = ?", (token, email_clean))
        conn.commit()
    full_name = user["full_name"] if user else "Investor"
    conn.close()
    
    direct_link = f"http://127.0.0.1:8000/confirm?email={email_clean}&token={token}"
    send_confirmation_link_email(email_clean, full_name, direct_link)
    
    return {
        "success": True, 
        "rate_limit_exceeded": False,
        "direct_activation_link": direct_link,
        "message": f"Confirmation link sent to {email_clean}"
    }

@app.post("/api/auth/login")
def login_user(req: LoginRequest):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM users WHERE email = ?", (req.email.strip().lower(),))
    user_row = cursor.fetchone()

    if not user_row or not verify_password(req.password, user_row["password_hash"]):
        conn.close()
        raise HTTPException(status_code=401, detail="Invalid email or password")

    # If unverified, require email link activation
    if user_row.get("is_verified", 1) == 0:
        conn.close()
        raise HTTPException(
            status_code=403,
            detail="Account not activated yet. Please click the confirmation link sent to your email inbox."
        )

    conn.close()
    user = dict(user_row)
    token = create_access_token(user["id"], user["email"], user["role"])
    del user["password_hash"]
    return {"token": token, "user": user}

@app.post("/api/auth/oauth-login")
def oauth_login(req: OAuthLoginRequest):
    email_clean = req.email.strip().lower()
    if not email_clean:
        raise HTTPException(status_code=400, detail="Email is required")
        
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM users WHERE email = ?", (email_clean,))
    user_row = cursor.fetchone()
    
    if not user_row:
        pwd_hash = hash_password(secrets.token_hex(16))
        ref_code = generate_referral_code()
        btc_address = f"bc1q{secrets.token_hex(18)}"
        full_name = req.full_name.strip() if req.full_name else "Investor"
        
        cursor.execute("""
            INSERT INTO users (email, full_name, password_hash, role, btc_address, balance_usd, balance_btc, referral_code, referred_by, kyc_status, is_verified)
            VALUES (?, ?, ?, 'investor', ?, 0.0, 0.0, ?, '', 'verified', 1)
        """, (email_clean, full_name, pwd_hash, btc_address, ref_code))
        conn.commit()
        
        cursor.execute("SELECT * FROM users WHERE email = ?", (email_clean,))
        user_row = cursor.fetchone()
    else:
        cursor.execute("UPDATE users SET is_verified = 1 WHERE id = ?", (user_row["id"],))
        conn.commit()
        
    conn.close()
    user = dict(user_row)
    token = create_access_token(user["id"], user["email"], user["role"])
    del user["password_hash"]
    return {"token": token, "user": user}

@app.get("/api/auth/me")
def get_me(user: dict = Depends(get_current_user)):
    del user["password_hash"]
    return {"user": user}

# --- Investor Portal Routes ---

@app.get("/api/investor/overview")
def get_investor_overview(user: dict = Depends(get_current_user)):
    conn = get_db()
    cursor = conn.cursor()

    # Get active investments
    cursor.execute("""
        SELECT ui.*, ip.name as plan_name, ip.duration_days, ip.slug as plan_slug
        FROM user_investments ui
        JOIN investment_plans ip ON ui.plan_id = ip.id
        WHERE ui.user_id = ? AND ui.status = 'active'
        ORDER BY ui.start_date DESC
    """, (user["id"],))
    active_investments = [dict(r) for r in cursor.fetchall()]

    total_invested_usd = sum(inv["amount_usd"] for inv in active_investments)
    total_invested_btc = sum(inv["amount_btc"] for inv in active_investments)

    # Get total profit earned across all investments
    cursor.execute("SELECT COALESCE(SUM(amount_usd), 0) as total_profit FROM transactions WHERE user_id = ? AND type = 'profit'", (user["id"],))
    total_profit_earned = cursor.fetchone()["total_profit"]

    # Pending withdrawals
    cursor.execute("SELECT COALESCE(SUM(amount_usd), 0) as pending_withdrawals FROM transactions WHERE user_id = ? AND type = 'withdrawal' AND status = 'pending'", (user["id"],))
    pending_withdrawals = cursor.fetchone()["pending_withdrawals"]

    # Recent transactions
    cursor.execute("SELECT * FROM transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT 8", (user["id"],))
    transactions = [dict(r) for r in cursor.fetchall()]

    conn.close()

    btc_info = get_live_btc_data()
    btc_price = btc_info["price_usd"]

    # Recalculate BTC balances accurately
    portfolio_usd = user["balance_usd"] + total_invested_usd
    portfolio_btc = round(portfolio_usd / btc_price, 6)

    # Calculate investment progress percentages
    for inv in active_investments:
        start = datetime.strptime(inv["start_date"][:19], '%Y-%m-%d %H:%M:%S')
        end = datetime.strptime(inv["end_date"][:19], '%Y-%m-%d %H:%M:%S')
        now = datetime.now()
        total_seconds = (end - start).total_seconds()
        elapsed_seconds = max(0, (now - start).total_seconds())
        progress = min(100.0, round((elapsed_seconds / total_seconds) * 100, 1)) if total_seconds > 0 else 0
        inv["progress_percent"] = progress
        inv["days_remaining"] = max(0, (end - now).days)
        inv["daily_payout_usd"] = round(inv["amount_usd"] * (inv["daily_roi_percent"] / 100.0), 2)
        inv["daily_payout_btc"] = round(inv["daily_payout_usd"] / btc_price, 6)

    return {
        "user": {
            "id": user["id"],
            "full_name": user["full_name"],
            "email": user["email"],
            "role": user["role"],
            "btc_address": user["btc_address"],
            "referral_code": user["referral_code"],
            "kyc_status": user["kyc_status"]
        },
        "balance": {
            "available_usd": round(user["balance_usd"], 2),
            "available_btc": round(user["balance_usd"] / btc_price, 6),
            "active_invested_usd": round(total_invested_usd, 2),
            "active_invested_btc": round(total_invested_btc, 6),
            "total_profit_usd": round(total_profit_earned, 2),
            "total_profit_btc": round(total_profit_earned / btc_price, 6),
            "portfolio_usd": round(portfolio_usd, 2),
            "portfolio_btc": portfolio_btc,
            "pending_withdrawals_usd": round(pending_withdrawals, 2)
        },
        "btc_price": btc_price,
        "active_investments": active_investments,
        "recent_transactions": transactions
    }

@app.post("/api/investor/deposit")
def create_deposit(req: DepositRequest, user: dict = Depends(get_current_user)):
    if req.amount_usd < 10:
        raise HTTPException(status_code=400, detail="Minimum deposit amount is $10 USD")

    btc_info = get_live_btc_data()
    btc_price = btc_info["price_usd"]
    amount_btc = round(req.amount_usd / btc_price, 6)
    
    # Platform's dedicated Bitcoin deposit address
    deposit_address = "bc1qzul99g93eyeqdsta066p7vddzd38nea8w5j2wc"
    tx_hash = f"tx_dep_{secrets.token_hex(20)}"

    conn = get_db()
    cursor = conn.cursor()

    # Always create transaction in 'pending' status.
    # Balance is NOT credited until the administrator confirms it in the Admin Console.
    cursor.execute("""
        INSERT INTO transactions (user_id, type, amount_usd, amount_btc, tx_hash, status, destination_address, description)
        VALUES (?, 'deposit', ?, ?, ?, 'pending', ?, 'Bitcoin Deposit (Awaiting Admin Confirmation)')
    """, (user["id"], req.amount_usd, amount_btc, tx_hash, deposit_address))
    conn.commit()
    conn.close()

    return {
        "success": True,
        "message": f"Deposit request for ${req.amount_usd:,.2f} USD ({amount_btc} BTC) created! Status is pending admin confirmation.",
        "status": "pending",
        "deposit_address": deposit_address,
        "amount_usd": req.amount_usd,
        "amount_btc": amount_btc,
        "tx_hash": tx_hash
    }

@app.post("/api/investor/invest")
def invest_in_plan(req: InvestRequest, user: dict = Depends(get_current_user)):
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM investment_plans WHERE id = ? AND is_active = 1", (req.plan_id,))
    plan_row = cursor.fetchone()
    if not plan_row:
        conn.close()
        raise HTTPException(status_code=404, detail="Selected investment plan does not exist or is inactive")
    
    plan = dict(plan_row)
    if req.amount_usd < plan["min_deposit_usd"]:
        conn.close()
        raise HTTPException(status_code=400, detail=f"Minimum investment for {plan['name']} is ${plan['min_deposit_usd']:,.2f}")
    
    if req.amount_usd > plan["max_deposit_usd"]:
        conn.close()
        raise HTTPException(status_code=400, detail=f"Maximum investment for {plan['name']} is ${plan['max_deposit_usd']:,.2f}")

    if user["balance_usd"] < req.amount_usd:
        conn.close()
        raise HTTPException(status_code=400, detail="Insufficient available balance. Please deposit funds first.")

    btc_info = get_live_btc_data()
    btc_price = btc_info["price_usd"]
    amount_btc = round(req.amount_usd / btc_price, 6)

    # Deduct from user balance
    new_balance_usd = user["balance_usd"] - req.amount_usd
    new_balance_btc = round(new_balance_usd / btc_price, 6)
    cursor.execute("UPDATE users SET balance_usd = ?, balance_btc = ? WHERE id = ?", (new_balance_usd, new_balance_btc, user["id"]))

    # Calculate returns
    total_roi = plan["daily_roi_percent"] * plan["duration_days"]
    total_expected = req.amount_usd * (1 + (total_roi / 100.0))

    start_date = datetime.now()
    end_date = start_date + timedelta(days=plan["duration_days"])

    cursor.execute("""
        INSERT INTO user_investments (user_id, plan_id, amount_usd, amount_btc, daily_roi_percent, total_expected_return_usd, total_earned_usd, status, start_date, end_date, last_accrual_date)
        VALUES (?, ?, ?, ?, ?, ?, 0.0, 'active', ?, ?, ?)
    """, (user["id"], plan["id"], req.amount_usd, amount_btc, plan["daily_roi_percent"], total_expected,
          start_date.strftime('%Y-%m-%d %H:%M:%S'), end_date.strftime('%Y-%m-%d %H:%M:%S'), start_date.strftime('%Y-%m-%d %H:%M:%S')))
    
    tx_hash = f"inv_{secrets.token_hex(20)}"
    cursor.execute("""
        INSERT INTO transactions (user_id, type, amount_usd, amount_btc, tx_hash, status, description)
        VALUES (?, 'investment', ?, ?, ?, 'completed', ?)
    """, (user["id"], req.amount_usd, amount_btc, tx_hash, f"Capital allocation into {plan['name']} ({plan['duration_days']} Days @ {plan['daily_roi_percent']}%/day)"))

    conn.commit()
    conn.close()

    return {
        "success": True,
        "message": f"Successfully activated {plan['name']} for ${req.amount_usd:,.2f}!",
        "new_balance_usd": new_balance_usd,
        "total_expected_return_usd": total_expected
    }

@app.post("/api/investor/accrue-yields")
def trigger_yield_accrual(user: dict = Depends(get_current_user)):
    """Simulates daily yield distribution for active investments"""
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT ui.*, ip.name as plan_name 
        FROM user_investments ui 
        JOIN investment_plans ip ON ui.plan_id = ip.id 
        WHERE ui.user_id = ? AND ui.status = 'active'
    """, (user["id"],))
    investments = [dict(r) for r in cursor.fetchall()]

    if not investments:
        conn.close()
        return {"success": True, "message": "No active investments to accrue yields on.", "accrued_total_usd": 0}

    btc_price = get_live_btc_data()["price_usd"]
    total_accrued = 0.0

    for inv in investments:
        daily_yield = round(inv["amount_usd"] * (inv["daily_roi_percent"] / 100.0), 2)
        daily_yield_btc = round(daily_yield / btc_price, 6)
        total_accrued += daily_yield

        new_total_earned = inv["total_earned_usd"] + daily_yield
        
        # Check if investment reached maturity
        new_status = 'active'
        if new_total_earned >= (inv["total_expected_return_usd"] - inv["amount_usd"]):
            # Plan has matured, return capital + mark completed
            new_status = 'completed'

        cursor.execute("""
            UPDATE user_investments 
            SET total_earned_usd = ?, last_accrual_date = CURRENT_TIMESTAMP, status = ?
            WHERE id = ?
        """, (new_total_earned, new_status, inv["id"]))

        # Log profit transaction
        cursor.execute("""
            INSERT INTO transactions (user_id, type, amount_usd, amount_btc, tx_hash, status, description)
            VALUES (?, 'profit', ?, ?, ?, 'completed', ?)
        """, (user["id"], daily_yield, daily_yield_btc, f"yield_{secrets.token_hex(16)}", f"Daily Yield: {inv['plan_name']} (+{inv['daily_roi_percent']}%)"))

    # Credit user balance
    new_balance = user["balance_usd"] + total_accrued
    new_balance_btc = round(new_balance / btc_price, 6)
    cursor.execute("UPDATE users SET balance_usd = ?, balance_btc = ? WHERE id = ?", (new_balance, new_balance_btc, user["id"]))

    conn.commit()
    conn.close()

    return {
        "success": True,
        "message": f"Successfully credited daily yield of ${total_accrued:,.2f} to your available balance!",
        "accrued_total_usd": total_accrued,
        "new_balance_usd": new_balance
    }

@app.post("/api/investor/withdraw")
def request_withdrawal(req: WithdrawRequest, user: dict = Depends(get_current_user)):
    if req.amount_usd < 25.0:
        raise HTTPException(status_code=400, detail="Minimum withdrawal amount is $25.00 USD")

    if user["balance_usd"] < req.amount_usd:
        raise HTTPException(status_code=400, detail="Requested withdrawal exceeds available balance")

    dest_address = req.btc_address.strip() or user["btc_address"]
    if not dest_address or len(dest_address) < 20:
        raise HTTPException(status_code=400, detail="A valid destination Bitcoin address is required")

    btc_info = get_live_btc_data()
    btc_price = btc_info["price_usd"]
    amount_btc = round(req.amount_usd / btc_price, 6)

    conn = get_db()
    cursor = conn.cursor()

    # Deduct available balance immediately
    new_balance_usd = user["balance_usd"] - req.amount_usd
    new_balance_btc = round(new_balance_usd / btc_price, 6)
    cursor.execute("UPDATE users SET balance_usd = ?, balance_btc = ? WHERE id = ?", (new_balance_usd, new_balance_btc, user["id"]))

    tx_hash = f"tx_wth_{secrets.token_hex(28)}"
    # Withdrawals below $5,000 are instant-approved, higher go to pending
    withdrawal_status = "completed" if req.amount_usd <= 5000.0 else "pending"

    cursor.execute("""
        INSERT INTO transactions (user_id, type, amount_usd, amount_btc, tx_hash, status, destination_address, description)
        VALUES (?, 'withdrawal', ?, ?, ?, ?, ?, ?)
    """, (user["id"], req.amount_usd, amount_btc, tx_hash, withdrawal_status, dest_address, f"BTC Withdrawal to {dest_address[:8]}...{dest_address[-6:]}"))

    conn.commit()
    conn.close()

    status_msg = "Withdrawal completed instantly via Bitcoin Network!" if withdrawal_status == "completed" else "Withdrawal submitted for priority security review."
    return {
        "success": True,
        "message": status_msg,
        "status": withdrawal_status,
        "amount_usd": req.amount_usd,
        "amount_btc": amount_btc,
        "destination_address": dest_address,
        "tx_hash": tx_hash,
        "new_balance_usd": new_balance_usd
    }

@app.get("/api/investor/transactions")
def get_user_transactions(type: Optional[str] = None, user: dict = Depends(get_current_user)):
    conn = get_db()
    cursor = conn.cursor()
    if type and type != "all":
        cursor.execute("SELECT * FROM transactions WHERE user_id = ? AND type = ? ORDER BY created_at DESC", (user["id"], type))
    else:
        cursor.execute("SELECT * FROM transactions WHERE user_id = ? ORDER BY created_at DESC", (user["id"],))
    txs = [dict(r) for r in cursor.fetchall()]
    conn.close()
    return {"transactions": txs}

@app.get("/api/investor/referrals")
def get_user_referrals(user: dict = Depends(get_current_user)):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT id, full_name, email, created_at, balance_usd FROM users WHERE referred_by = ?", (user["referral_code"],))
    referred_users = [dict(r) for r in cursor.fetchall()]
    
    # Calculate referral commissions
    cursor.execute("SELECT COALESCE(SUM(amount_usd), 0) as total_commissions FROM transactions WHERE user_id = ? AND type = 'referral'", (user["id"],))
    total_commission = cursor.fetchone()["total_commissions"]
    conn.close()

    return {
        "referral_code": user["referral_code"],
        "referral_link": f"https://minevest.capital/join?ref={user['referral_code']}",
        "tier1_rate": "7.0%",
        "tier2_rate": "3.0%",
        "tier3_rate": "1.0%",
        "total_referrals": len(referred_users),
        "total_earnings_usd": round(total_commission, 2),
        "referred_investors": referred_users
    }

@app.post("/api/investor/update-profile")
def update_profile(req: ProfileUpdateRequest, user: dict = Depends(get_current_user)):
    conn = get_db()
    cursor = conn.cursor()

    updates = []
    params = []
    if req.full_name is not None:
        updates.append("full_name = ?")
        params.append(req.full_name.strip())
    if req.btc_address is not None:
        updates.append("btc_address = ?")
        params.append(req.btc_address.strip())
    if req.kyc_status is not None:
        updates.append("kyc_status = ?")
        params.append(req.kyc_status.strip())

    if updates:
        params.append(user["id"])
        cursor.execute(f"UPDATE users SET {', '.join(updates)} WHERE id = ?", params)
        conn.commit()

    cursor.execute("SELECT * FROM users WHERE id = ?", (user["id"],))
    updated_user = dict(cursor.fetchone())
    del updated_user["password_hash"]
    conn.close()

    return {"success": True, "user": updated_user}

# --- Administrative Back-Office Routes ---

@app.get("/api/admin/overview")
def get_admin_overview(admin: dict = Depends(get_admin_user)):
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("SELECT COUNT(*) as user_count FROM users WHERE role = 'investor'")
    total_users = cursor.fetchone()["user_count"]

    cursor.execute("SELECT COALESCE(SUM(balance_usd), 0) as total_balances FROM users")
    total_investor_balances = cursor.fetchone()["total_balances"]

    cursor.execute("SELECT COALESCE(SUM(amount_usd), 0) as total_dep FROM transactions WHERE type = 'deposit'")
    total_deposits = cursor.fetchone()["total_dep"]

    cursor.execute("SELECT COALESCE(SUM(amount_usd), 0) as total_wth FROM transactions WHERE type = 'withdrawal' AND status = 'completed'")
    total_withdrawals = cursor.fetchone()["total_wth"]

    cursor.execute("SELECT COUNT(*) as pending_count FROM transactions WHERE type = 'withdrawal' AND status = 'pending'")
    pending_withdrawals = cursor.fetchone()["pending_count"]

    cursor.execute("SELECT COUNT(*) as pending_dep FROM transactions WHERE type = 'deposit' AND status = 'pending'")
    pending_deposits = cursor.fetchone()["pending_dep"]

    conn.close()

    return {
        "total_users": total_users,
        "total_investor_balances_usd": round(total_investor_balances, 2),
        "total_deposits_usd": round(total_deposits, 2),
        "total_withdrawals_usd": round(total_withdrawals, 2),
        "pending_withdrawals_count": pending_withdrawals,
        "pending_deposits_count": pending_deposits,
        "platform_reserve_usd": "$24,500,000"
    }

@app.get("/api/admin/users")
def get_admin_users(admin: dict = Depends(get_admin_user)):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT id, email, full_name, role, btc_address, balance_usd, balance_btc, referral_code, kyc_status, created_at FROM users ORDER BY id DESC")
    users = [dict(r) for r in cursor.fetchall()]
    conn.close()
    return {"users": users}

@app.post("/api/admin/users/{user_id}/adjust-balance")
def admin_adjust_balance(user_id: int, req: AdjustBalanceRequest, admin: dict = Depends(get_admin_user)):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM users WHERE id = ?", (user_id,))
    target_user = cursor.fetchone()
    if not target_user:
        conn.close()
        raise HTTPException(status_code=404, detail="Target user not found")

    btc_price = get_live_btc_data()["price_usd"]
    if req.action == "add":
        new_usd = target_user["balance_usd"] + req.amount_usd
    else:
        new_usd = req.amount_usd

    new_btc = round(new_usd / btc_price, 6)
    cursor.execute("UPDATE users SET balance_usd = ?, balance_btc = ? WHERE id = ?", (new_usd, new_btc, user_id))
    
    cursor.execute("""
        INSERT INTO transactions (user_id, type, amount_usd, amount_btc, tx_hash, status, description)
        VALUES (?, 'deposit', ?, ?, ?, 'completed', 'Administrative balance adjustment')
    """, (user_id, req.amount_usd, round(req.amount_usd / btc_price, 6), f"adm_{secrets.token_hex(16)}"))

    conn.commit()
    conn.close()
    return {"success": True, "new_balance_usd": new_usd, "new_balance_btc": new_btc}

@app.get("/api/admin/deposits")
def get_admin_deposits(admin: dict = Depends(get_admin_user)):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT t.*, u.email, u.full_name 
        FROM transactions t 
        JOIN users u ON t.user_id = u.id 
        WHERE t.type = 'deposit' 
        ORDER BY CASE WHEN t.status = 'pending' THEN 1 ELSE 2 END, t.created_at DESC
    """)
    deposits = [dict(r) for r in cursor.fetchall()]
    conn.close()
    return {"deposits": deposits}

@app.post("/api/admin/deposits/{tx_id}/action")
def process_deposit_action(tx_id: int, action: str, admin: dict = Depends(get_admin_user)):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM transactions WHERE id = ? AND type = 'deposit'", (tx_id,))
    tx = cursor.fetchone()
    if not tx:
        conn.close()
        raise HTTPException(status_code=404, detail="Deposit transaction not found")

    if action == "approve":
        if tx["status"] == "completed":
            conn.close()
            raise HTTPException(status_code=400, detail="Deposit is already completed and credited")

        cursor.execute("SELECT * FROM users WHERE id = ?", (tx["user_id"],))
        user = cursor.fetchone()
        if not user:
            conn.close()
            raise HTTPException(status_code=404, detail="User account not found")

        btc_info = get_live_btc_data()
        btc_price = btc_info["price_usd"]
        new_usd = round(user["balance_usd"] + tx["amount_usd"], 2)
        new_btc = round(new_usd / btc_price, 6)

        cursor.execute("UPDATE users SET balance_usd = ?, balance_btc = ? WHERE id = ?", (new_usd, new_btc, user["id"]))
        cursor.execute("""
            UPDATE transactions 
            SET status = 'completed', description = 'Bitcoin Deposit (Confirmed by Admin)' 
            WHERE id = ?
        """, (tx_id,))
        conn.commit()
        conn.close()
        return {
            "success": True, 
            "action": "approve", 
            "message": f"Deposit of ${tx['amount_usd']:,.2f} USD confirmed! Balance credited to {user['full_name']}."
        }
    elif action == "reject":
        cursor.execute("""
            UPDATE transactions 
            SET status = 'rejected', description = 'Bitcoin Deposit (Rejected by Admin)' 
            WHERE id = ?
        """, (tx_id,))
        conn.commit()
        conn.close()
        return {"success": True, "action": "reject", "message": f"Deposit #{tx_id} rejected."}
    else:
        conn.close()
        raise HTTPException(status_code=400, detail="Invalid action. Must be 'approve' or 'reject'")

@app.get("/api/admin/withdrawals")
def get_admin_withdrawals(admin: dict = Depends(get_admin_user)):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT t.*, u.email, u.full_name 
        FROM transactions t 
        JOIN users u ON t.user_id = u.id 
        WHERE t.type = 'withdrawal' 
        ORDER BY CASE WHEN t.status = 'pending' THEN 1 ELSE 2 END, t.created_at DESC
    """)
    withdrawals = [dict(r) for r in cursor.fetchall()]
    conn.close()
    return {"withdrawals": withdrawals}

@app.post("/api/admin/withdrawals/{tx_id}/action")
def process_withdrawal_action(tx_id: int, action: str, admin: dict = Depends(get_admin_user)):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM transactions WHERE id = ? AND type = 'withdrawal'", (tx_id,))
    tx = cursor.fetchone()
    if not tx:
        conn.close()
        raise HTTPException(status_code=404, detail="Withdrawal transaction not found")

    if action == "approve":
        cursor.execute("UPDATE transactions SET status = 'completed' WHERE id = ?", (tx_id,))
    elif action == "reject":
        cursor.execute("UPDATE transactions SET status = 'rejected' WHERE id = ?", (tx_id,))
        # Refund user balance
        cursor.execute("UPDATE users SET balance_usd = balance_usd + ? WHERE id = ?", (tx["amount_usd"], tx["user_id"]))
    else:
        conn.close()
        raise HTTPException(status_code=400, detail="Invalid action. Must be 'approve' or 'reject'")

    conn.commit()
    conn.close()
    return {"success": True, "action": action}

# --- Serve Single Page App Front-end ---

@app.get("/")
def serve_index():
    index_path = os.path.join(TEMPLATES_DIR, "index.html")
    return FileResponse(index_path)

@app.get("/{catchall:path}")
def serve_spa(catchall: str):
    # If route doesn't match API, serve SPA index
    if not catchall.startswith("api/") and not catchall.startswith("static/"):
        return FileResponse(os.path.join(TEMPLATES_DIR, "index.html"))
    raise HTTPException(status_code=404, detail="Not found")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("minevest:app", host="0.0.0.0", port=8000, reload=True)
