CREATE TABLE "registration_verification_tokens" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "verifiedAt" TIMESTAMP(3),
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "registration_verification_tokens_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "registration_verification_tokens_email_idx" ON "registration_verification_tokens"("email");
CREATE INDEX "registration_verification_tokens_expiresAt_idx" ON "registration_verification_tokens"("expiresAt");
