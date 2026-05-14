import logging
import smtplib
from email.message import EmailMessage

from app.core.config import settings

logger = logging.getLogger("email_service")

SMTP_TIMEOUT_SECONDS = 10


class EmailService:
    def send_otp_email(self, *, to_email: str, otp_code: str, purpose: str) -> None:
        if not settings.SMTP_HOST or not settings.SMTP_USERNAME or not settings.SMTP_PASSWORD:
            logger.info("[DEV OTP] Email: %s | Purpose: %s | OTP: %s", to_email, purpose, otp_code)
            return

        subject = "Your verification code"

        if purpose == "register":
            title = "Verify your account"
        elif purpose == "login":
            title = "Confirm your login"
        else:
            title = "Verification code"

        body = f"""
        {title}

        Your OTP code is: {otp_code}

        This code will expire in 10 minutes.

        If you did not request this, please ignore this email.
        """

        message = EmailMessage()
        message["Subject"] = subject
        message["From"] = f"{settings.SMTP_FROM_NAME} <{settings.SMTP_FROM_EMAIL}>"
        message["To"] = to_email
        message.set_content(body)

        try:
            with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=SMTP_TIMEOUT_SECONDS) as server:
                server.starttls()
                server.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
                server.send_message(message)
        except Exception as exc:
            logger.error(
                "SMTP delivery failed for %s — falling back to console. Error: %s",
                to_email,
                exc,
            )
            logger.info("[FALLBACK OTP] Email: %s | Purpose: %s | OTP: %s", to_email, purpose, otp_code)