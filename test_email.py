"""
MineVest Capital — Email Dispatch Test Utility
Usage:
    python test_email.py recipient@example.com
"""

import sys
import os
from backend.email_service import send_verification_email, generate_verification_code

if __name__ == "__main__":
    recipient = sys.argv[1] if len(sys.argv) > 1 else "ayomide4354@gmail.com"
    code = generate_verification_code()
    print(f"\n[Testing Email Dispatch to: {recipient}]")
    success = send_verification_email(recipient, "Valued Investor", code)
    if success:
        print("[SUCCESS] Check your inbox (or spam folder) for the verification email!\n")
    else:
        print("[FAILED] Email could not be dispatched. Check your SMTP settings in .env.\n")

