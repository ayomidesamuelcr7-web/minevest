import os
import smtplib
import secrets
import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime, timedelta
from dotenv import load_dotenv

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
load_dotenv(os.path.join(BASE_DIR, ".env"))

logger = logging.getLogger("minevest.email")

SMTP_HOST = os.getenv("SMTP_HOST", "").strip()
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "").strip()
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "").strip()
SMTP_FROM = os.getenv("SMTP_FROM", "noreply@minevest.capital").strip()

def generate_verification_code() -> str:
    """Generates a secure 6-digit numeric verification code."""
    return f"{secrets.randbelow(900000) + 100000}"

def get_link_email_template(link: str, full_name: str) -> str:
    """Returns an institutional-grade dark/cobalt HTML email template with direct activation button."""
    return f"""
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Activate Your MineVest Account</title>
      <style>
        body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #F8FAFC; margin: 0; padding: 0; }}
        .container {{ max-width: 540px; margin: 40px auto; background-color: #FFFFFF; border-radius: 16px; border: 1px solid #E2E8F0; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05); }}
        .header {{ background-color: #0500A3; padding: 32px 24px; text-align: center; }}
        .header h1 {{ color: #FFFFFF; margin: 0; font-size: 22px; font-weight: 700; letter-spacing: -0.5px; }}
        .header p {{ color: #C7D2FE; margin: 6px 0 0 0; font-size: 13px; }}
        .content {{ padding: 36px 32px; color: #1E293B; }}
        .content h2 {{ font-size: 18px; margin-top: 0; color: #0F172A; }}
        .content p {{ font-size: 14px; line-height: 1.6; color: #475569; }}
        .btn-box {{ margin: 32px 0; text-align: center; }}
        .btn-confirm {{ display: inline-block; background-color: #0500A3; color: #FFFFFF !important; text-decoration: none; padding: 14px 32px; border-radius: 10px; font-size: 14px; font-weight: 600; letter-spacing: 0.2px; }}
        .link-url {{ font-family: monospace; font-size: 11px; color: #64748B; word-break: break-all; margin-top: 16px; background: #F1F5F9; padding: 10px; border-radius: 6px; }}
        .security-note {{ background-color: #F8FAFC; border-radius: 8px; padding: 12px 16px; font-size: 12px; color: #64748B; margin-top: 24px; border: 1px solid #E2E8F0; }}
        .footer {{ background-color: #F8FAFC; border-top: 1px solid #E2E8F0; padding: 20px; text-align: center; font-size: 11px; color: #94A3B8; }}
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>MineVest Capital</h1>
          <p>Institutional Bitcoin Yield & Digital Asset Infrastructure</p>
        </div>
        <div class="content">
          <h2>Activate Your Account</h2>
          <p>Hello <strong>{full_name}</strong>,</p>
          <p>Thank you for creating an account with MineVest Capital. To complete your activation and access your client dashboard, please click the button below:</p>
          
          <div class="btn-box">
            <a href="{link}" class="btn-confirm" target="_blank">Confirm & Activate Account</a>
          </div>

          <p style="font-size: 12px; color: #64748B;">Or copy and paste this link into your browser:</p>
          <div class="link-url">{link}</div>

          <div class="security-note">
            🔒 <strong>Security Warning:</strong> This confirmation link expires in 24 hours. Never forward this email to anyone.
          </div>
        </div>
        <div class="footer">
          &copy; 2026 MineVest Capital Management Ltd. All rights reserved.<br>
          Authorized Institutional Custody & Asset Management Protocol.
        </div>
      </div>
    </body>
    </html>
    """

def send_confirmation_link_email(email: str, full_name: str, link: str) -> bool:
    """Sends a direct confirmation link email via SMTP if configured, or logs to console."""
    load_dotenv(os.path.join(BASE_DIR, ".env"), override=True)
    smtp_host = os.getenv("SMTP_HOST", "").strip()
    smtp_port = int(os.getenv("SMTP_PORT", "587"))
    smtp_user = os.getenv("SMTP_USER", "").strip()
    smtp_pass = os.getenv("SMTP_PASSWORD", "").strip()
    smtp_from = os.getenv("SMTP_FROM", "").strip() or smtp_user or "noreply@minevest.capital"

    subject = "Confirm Your Email - MineVest Capital Account Activation"

    if smtp_host and smtp_user and smtp_pass:
        try:
            msg = MIMEMultipart("alternative")
            msg["Subject"] = subject
            msg["From"] = f"MineVest Capital <{smtp_from}>"
            msg["To"] = email

            html_content = get_link_email_template(link, full_name)
            msg.attach(MIMEText(html_content, "html"))

            with smtplib.SMTP(smtp_host, smtp_port, timeout=12) as server:
                server.starttls()
                server.login(smtp_user, smtp_pass)
                server.sendmail(smtp_from, [email], msg.as_string())

            print(f"[Email Service] REAL CONFIRMATION LINK DISPATCHED to {email} via SMTP ({smtp_host})")
            return True
        except Exception as e:
            print(f"[Email Service] SMTP error sending confirmation link to {email}: {e}")
            return False

    print("=" * 65)
    print(f" [CONFIRMATION LINK DISPATCH] ")
    print(f" Recipient:  {full_name} <{email}>")
    print(f" Link:       {link}")
    print(f" Status:     To send to actual email inbox, configure SMTP in .env")
    print("=" * 65)
    return False

def get_email_template(code: str, full_name: str) -> str:
    """Returns an institutional-grade dark/cobalt HTML email template."""
    return f"""
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Verify Your MineVest Account</title>
      <style>
        body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #F8FAFC; margin: 0; padding: 0; }}
        .container {{ max-width: 540px; margin: 40px auto; background-color: #FFFFFF; border-radius: 16px; border: 1px solid #E2E8F0; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05); }}
        .header {{ background-color: #0500A3; padding: 32px 24px; text-align: center; }}
        .header h1 {{ color: #FFFFFF; margin: 0; font-size: 22px; font-weight: 700; letter-spacing: -0.5px; }}
        .header p {{ color: #C7D2FE; margin: 6px 0 0 0; font-size: 13px; }}
        .content {{ padding: 36px 32px; color: #1E293B; }}
        .content h2 {{ font-size: 18px; margin-top: 0; color: #0F172A; }}
        .content p {{ font-size: 14px; line-height: 1.6; color: #475569; }}
        .code-box {{ margin: 28px 0; background: #EEF0FF; border: 1.5px dashed #0500A3; border-radius: 12px; padding: 20px; text-align: center; }}
        .code-value {{ font-family: 'Courier New', monospace; font-size: 36px; font-weight: 800; letter-spacing: 10px; color: #0500A3; margin: 0; }}
        .code-hint {{ font-size: 12px; color: #64748B; margin-top: 8px; }}
        .security-note {{ background-color: #F1F5F9; border-radius: 8px; padding: 12px 16px; font-size: 12px; color: #64748B; margin-top: 24px; }}
        .footer {{ background-color: #F8FAFC; border-top: 1px solid #E2E8F0; padding: 20px; text-align: center; font-size: 11px; color: #94A3B8; }}
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>MineVest Capital</h1>
          <p>Institutional Bitcoin Yield & Digital Asset Infrastructure</p>
        </div>
        <div class="content">
          <h2>Email Verification Required</h2>
          <p>Hello <strong>{full_name}</strong>,</p>
          <p>Thank you for initiating your registration with MineVest Capital. To complete your account activation and access your client dashboard, please enter the one-time verification code below:</p>
          
          <div class="code-box">
            <div class="code-value">{code}</div>
            <div class="code-hint">This code expires in 15 minutes</div>
          </div>

          <p>If you did not initiate this request, no further action is required. Your security and digital assets remain safeguarded with BitGo multi-sig custody.</p>
          
          <div class="security-note">
            🔒 <strong>Security Warning:</strong> Never share this code with anyone. MineVest staff will never ask for your verification code.
          </div>
        </div>
        <div class="footer">
          &copy; 2026 MineVest Capital Management Ltd. All rights reserved.<br>
          Authorized Institutional Custody & Asset Management Protocol.
        </div>
      </div>
    </body>
    </html>
    """

def send_verification_email(email: str, full_name: str, code: str) -> bool:
    """
    Sends the confirmation code email.
    If SMTP credentials are provided in .env, dispatches real email via SMTP.
    Otherwise, logs to server console.
    """
    # Reload environment to pick up any changes in .env immediately
    load_dotenv(os.path.join(BASE_DIR, ".env"), override=True)
    smtp_host = os.getenv("SMTP_HOST", "").strip()
    smtp_port = int(os.getenv("SMTP_PORT", "587"))
    smtp_user = os.getenv("SMTP_USER", "").strip()
    smtp_pass = os.getenv("SMTP_PASSWORD", "").strip()
    smtp_from = os.getenv("SMTP_FROM", "").strip() or smtp_user or "noreply@minevest.capital"

    subject = f"Verify Your Account: {code} is your MineVest confirmation code"

    if smtp_host and smtp_user and smtp_pass:
        try:
            msg = MIMEMultipart("alternative")
            msg["Subject"] = subject
            msg["From"] = f"MineVest Capital <{smtp_from}>"
            msg["To"] = email

            html_content = get_email_template(code, full_name)
            msg.attach(MIMEText(html_content, "html"))

            with smtplib.SMTP(smtp_host, smtp_port, timeout=12) as server:
                server.starttls()
                server.login(smtp_user, smtp_pass)
                server.sendmail(smtp_from, [email], msg.as_string())

            print(f"[Email Service] REAL EMAIL DISPATCHED to {email} via SMTP ({smtp_host})")
            return True
        except Exception as e:
            print(f"[Email Service] SMTP error sending to {email}: {e}")

    # Fallback to console print if SMTP is not configured
    print("=" * 65)
    print(f" [EMAIL VERIFICATION DISPATCH] ")
    print(f" Recipient:  {full_name} <{email}>")
    print(f" OTP Code:   >>> {code} <<<")
    print(f" Status:     To send to actual email inbox, configure SMTP in .env")
    print("=" * 65)
    return True

