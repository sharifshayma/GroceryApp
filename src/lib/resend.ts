import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

// Account-level password reset OTP, used by the better-auth emailOTP plugin
// (src/lib/auth-server.ts). No throw on missing config — the caller/UI still
// completes the reset flow; the OTP just doesn't reach the user's inbox.
export async function sendPasswordResetOtp(email: string, otp: string): Promise<void> {
  if (!resend) {
    console.warn("RESEND_API_KEY not set — skipping password reset OTP email");
    return;
  }
  const from = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";
  try {
    await resend.emails.send({
      from,
      to: email,
      subject: "Your password reset code",
      html: `
        <div style="font-family:sans-serif">
          <h2>Reset your password</h2>
          <p>Use this code to reset your password:</p>
          <p style="font-size:28px;font-weight:800;letter-spacing:4px">${otp}</p>
          <p style="color:#666">This code expires shortly. If you didn't request this, you can ignore this email.</p>
        </div>
      `,
    });
  } catch (err) {
    console.error("Failed to send password reset OTP email", err);
  }
}
