import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { emailOTP } from "better-auth/plugins";
import { prisma } from "@/lib/prisma";
import { sendPasswordResetOtp } from "@/lib/resend";

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  emailAndPassword: {
    enabled: true,
    // Self-serve signup is available at /signup (src/actions/signup.ts),
    // which creates the account and its store together in one step.
  },
  plugins: [
    // Emails a one-time code; used by the Settings password-change flow
    // (type "forget-password") and doubles as account recovery.
    emailOTP({
      disableSignUp: true,
      async sendVerificationOTP({ email, otp }) {
        await sendPasswordResetOtp(email, otp);
      },
    }),
    nextCookies(), // MUST stay last
  ],
});
