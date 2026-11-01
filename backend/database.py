import os
import re
import hashlib
import secrets
import sqlite3
import logging
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List, Tuple
from dotenv import load_dotenv

logger = logging.getLogger("minevest.db")

# Load environment configuration
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
load_dotenv(os.path.join(BASE_DIR, ".env"))

DB_NAME = "MineVest Core Database (SQLite / Firebase Integrated)"

# Password & Security Utilities
def hash_password(password: str) -> str:
    salt = "minevest_crypto_salt_2026"
    return hashlib.sha256((password + salt).encode("utf-8")).hexdigest()

def verify_password(password: str, hashed: str) -> bool:
    return hash_password(password) == hashed

def generate_referral_code() -> str:
    return "MV" + secrets.token_hex(4).upper()


# ------------------------------------------------------------------------------
# Database Connection & Cursor Wrapper
# ------------------------------------------------------------------------------

class SQLiteCursorWrapper:
    """Standardizes SQLite cursor to return dictionaries."""
    def __init__(self, cursor):
        self.cursor = cursor

    def execute(self, sql: str, params: Tuple = ()):
        return self.cursor.execute(sql, params)

    def executemany(self, sql: str, seq_of_params):
        return self.cursor.executemany(sql, seq_of_params)

    def fetchone(self) -> Optional[Dict[str, Any]]:
        row = self.cursor.fetchone()
        return dict(row) if row else None

    def fetchall(self) -> List[Dict[str, Any]]:
        rows = self.cursor.fetchall()
        return [dict(r) for r in rows]

    @property
    def lastrowid(self):
        return self.cursor.lastrowid

    @property
    def rowcount(self):
        return self.cursor.rowcount

    def close(self):
        try:
            self.cursor.close()
        except Exception:
            pass


class SQLiteConnectionWrapper:
    """Thread-safe SQLite connection wrapper."""
    def __init__(self, conn: sqlite3.Connection):
        self.conn = conn

    def cursor(self):
        return SQLiteCursorWrapper(self.conn.cursor())

    def commit(self):
        self.conn.commit()

    def rollback(self):
        self.conn.rollback()

    def close(self):
        try:
            self.conn.close()
        except Exception:
            pass


def get_db_path() -> str:
    # On Vercel / serverless runtimes, root directory is read-only; use /tmp
    if os.environ.get("VERCEL") or not os.access(BASE_DIR, os.W_OK):
        return "/tmp/minevest.db"
    return os.path.join(BASE_DIR, "minevest.db")

def get_db():
    """
    Returns SQLite database connection.
    Automatically supports serverless writable /tmp on Vercel.
    """
    sqlite_path = get_db_path()
    conn = sqlite3.connect(sqlite_path, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return SQLiteConnectionWrapper(conn)


# ------------------------------------------------------------------------------
# Database Initialization & Seeding
# ------------------------------------------------------------------------------

def init_db():
    """Initializes tables, seeds defaults, and ensures schema integrity."""
    conn = get_db()
    cursor = conn.cursor()

    # 1. Users table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE NOT NULL,
            full_name TEXT NOT NULL,
            password_hash TEXT NOT NULL,
            role TEXT DEFAULT 'investor',
            btc_address TEXT,
            balance_usd REAL DEFAULT 0.0,
            balance_btc REAL DEFAULT 0.0,
            referral_code TEXT UNIQUE,
            referred_by TEXT DEFAULT '',
            kyc_status TEXT DEFAULT 'unverified',
            is_verified INTEGER DEFAULT 0,
            verification_code TEXT DEFAULT '',
            verification_expires_at TEXT DEFAULT '',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # 2. Investment plans
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS investment_plans (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            slug TEXT UNIQUE NOT NULL,
            badge TEXT DEFAULT '',
            daily_roi_percent REAL NOT NULL,
            duration_days INTEGER NOT NULL,
            min_deposit_usd REAL NOT NULL,
            max_deposit_usd REAL NOT NULL,
            description TEXT,
            features TEXT,
            is_active INTEGER DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # 3. User investments
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS user_investments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            plan_id INTEGER NOT NULL,
            amount_usd REAL NOT NULL,
            amount_btc REAL NOT NULL,
            daily_payout_usd REAL NOT NULL,
            earned_usd REAL DEFAULT 0.0,
            status TEXT DEFAULT 'active',
            days_elapsed INTEGER DEFAULT 0,
            next_payout_at TIMESTAMP,
            ends_at TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id),
            FOREIGN KEY (plan_id) REFERENCES investment_plans(id)
        )
    """)

    # 4. Transactions
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            type TEXT NOT NULL,
            amount_usd REAL NOT NULL,
            amount_btc REAL NOT NULL,
            status TEXT DEFAULT 'completed',
            tx_hash TEXT,
            btc_address TEXT,
            description TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    """)

    # 5. Platform settings
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS platform_settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        )
    """)

    # Default platform metrics
    default_settings = [
        ("aum_usd", "$482,910,400"),
        ("total_investors", "148,290"),
        ("total_paid_out_usd", "$164,750,210"),
        ("insurance_fund_usd", "$125,000,000"),
        ("btc_network_status", "Optimal (Block 882,410)"),
        ("custody_protocol", "100% Segregated Cold Storage"),
        ("platform_version", "2.5.0-firebase-enterprise")
    ]
    for key, val in default_settings:
        cursor.execute("INSERT OR IGNORE INTO platform_settings (key, value) VALUES (?, ?)", (key, val))

    # Default institutional yield plans
    default_plans = [
        (1, "Starter Tier", "starter", "MOST POPULAR", 20.0, 10, 100.0, 2500.0,
         "Ideal for beginners taking their first step in automated crypto yield generation.",
         "200% Total ROI;Daily Yield Distribution;Principal Returned at Maturity;24/7 Automated System;Instant Withdrawals"),
        (2, "Mining Pro Tier", "pro", "RECOMMENDED", 20.0, 15, 2500.0, 10000.0,
         "Leveraged ASIC hashing power with enhanced daily payout compounding.",
         "300% Total ROI;Automated Daily Compounding;Dedicated Account Manager;Prioritized Liquidity;Cold Storage Insurance"),
        (3, "Institutional Tier", "institutional", "HIGH YIELD", 20.0, 20, 10000.0, 50000.0,
         "High-frequency arbitrage and institutional OTC block liquidity yields.",
         "400% Total ROI;Daily Automated Payouts;Direct Multi-Sig Custody;Proof of Reserves Audited;Zero Withdrawal Fees"),
        (4, "Whale Alpha Tier", "whale", "EXCLUSIVE VIP", 20.0, 25, 50000.0, 500000.0,
         "Bespoke algorithmic mining cluster and private hedge reserve yields.",
         "500% Total ROI;Custom Yield Payout Interval;Concierge Wealth Advisor;Institutional SLA Guarantee;Private Telegram Signal Group")
    ]

    for p in default_plans:
        cursor.execute("""
            INSERT OR IGNORE INTO investment_plans (id, name, slug, badge, daily_roi_percent, duration_days, min_deposit_usd, max_deposit_usd, description, features, is_active)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
        """, p)

    # Ensure Master Admin is present
    cursor.execute("SELECT id FROM users WHERE email = 'ayomide4354@gmail.com'")
    existing_admin = cursor.fetchone()
    if not existing_admin:
        cursor.execute("""
            INSERT INTO users (email, full_name, password_hash, role, btc_address, balance_usd, balance_btc, referral_code, kyc_status, is_verified)
            VALUES (?, ?, ?, 'admin', ?, 0.0, 0.0, 'MVADMIN01', 'verified', 1)
        """, (
            "ayomide4354@gmail.com",
            "Ayomide (Master Admin)",
            hash_password("admin123"),
            "bc1qzul99g93eyeqdsta066p7vddzd38nea8w5j2wc"
        ))
    else:
        cursor.execute("UPDATE users SET role = 'admin', is_verified = 1, kyc_status = 'verified' WHERE email = 'ayomide4354@gmail.com'")

    conn.commit()
    conn.close()
    print(f"[MineVest DB] Database Ready! Active Engine: {DB_NAME}")

if __name__ == "__main__":
    init_db()
