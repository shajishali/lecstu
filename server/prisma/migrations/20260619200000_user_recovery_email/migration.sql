-- Optional personal email for password reset delivery (e.g. Gmail when @stu.kln.ac.lk blocks external senders)
ALTER TABLE "users" ADD COLUMN "recoveryEmail" TEXT;

CREATE INDEX "users_recoveryEmail_idx" ON "users"("recoveryEmail");
