-- CreateEnum
CREATE TYPE "Subject" AS ENUM ('CODING', 'MATH');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('CONFIRMED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SessionKind" AS ENUM ('PARENT', 'ADMIN');

-- CreateEnum
CREATE TYPE "AuthTokenPurpose" AS ENUM ('VERIFY_EMAIL', 'RESET_PASSWORD');

-- CreateEnum
CREATE TYPE "OutboxKind" AS ENUM ('BOOKING_CONFIRMED_PARENT', 'BOOKING_CONFIRMED_MENTOR', 'BOOKING_CANCELLED_PARENT', 'BOOKING_CANCELLED_MENTOR', 'VERIFY_EMAIL', 'RESET_PASSWORD', 'ACCOUNT_EXISTS');

-- CreateTable
CREATE TABLE "Mentor" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "timezone" TEXT NOT NULL,
    "bio" TEXT NOT NULL,
    "shiftLabel" TEXT NOT NULL,
    "maxDailyTrials" INTEGER NOT NULL DEFAULT 2,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Mentor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AvailabilityRule" (
    "id" UUID NOT NULL,
    "mentorId" UUID NOT NULL,
    "weekday" INTEGER NOT NULL,
    "startMinute" INTEGER NOT NULL,
    "endMinute" INTEGER NOT NULL,

    CONSTRAINT "AvailabilityRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Parent" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "timezone" TEXT NOT NULL,
    "passwordHash" TEXT,
    "emailVerifiedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Parent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminUser" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "kind" "SessionKind" NOT NULL,
    "parentId" UUID,
    "adminId" UUID,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthToken" (
    "id" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "purpose" "AuthTokenPurpose" NOT NULL,
    "parentId" UUID NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "usedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuthToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Booking" (
    "id" UUID NOT NULL,
    "reference" TEXT NOT NULL,
    "parentId" UUID NOT NULL,
    "mentorId" UUID NOT NULL,
    "childName" TEXT NOT NULL,
    "childGrade" INTEGER NOT NULL,
    "subject" "Subject" NOT NULL,
    "startUtc" TIMESTAMPTZ(3) NOT NULL,
    "endUtc" TIMESTAMPTZ(3) NOT NULL,
    "mentorLocalDate" DATE NOT NULL,
    "parentTimezone" TEXT NOT NULL,
    "mentorTimezone" TEXT NOT NULL,
    "meetingUrl" TEXT NOT NULL,
    "status" "BookingStatus" NOT NULL DEFAULT 'CONFIRMED',
    "cancelledAt" TIMESTAMPTZ(3),
    "cancelledBy" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Booking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutboxMessage" (
    "id" UUID NOT NULL,
    "kind" "OutboxKind" NOT NULL,
    "toEmail" TEXT NOT NULL,
    "bookingId" UUID,
    "timezone" TEXT,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OutboxMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Mentor_email_key" ON "Mentor"("email");

-- CreateIndex
CREATE INDEX "AvailabilityRule_mentorId_idx" ON "AvailabilityRule"("mentorId");

-- CreateIndex
CREATE UNIQUE INDEX "Parent_email_key" ON "Parent"("email");

-- CreateIndex
CREATE UNIQUE INDEX "AdminUser_email_key" ON "AdminUser"("email");

-- CreateIndex
CREATE INDEX "Session_parentId_idx" ON "Session"("parentId");

-- CreateIndex
CREATE INDEX "Session_adminId_idx" ON "Session"("adminId");

-- CreateIndex
CREATE UNIQUE INDEX "AuthToken_tokenHash_key" ON "AuthToken"("tokenHash");

-- CreateIndex
CREATE INDEX "AuthToken_parentId_purpose_idx" ON "AuthToken"("parentId", "purpose");

-- CreateIndex
CREATE UNIQUE INDEX "Booking_reference_key" ON "Booking"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "Booking_idempotencyKey_key" ON "Booking"("idempotencyKey");

-- CreateIndex
CREATE INDEX "Booking_startUtc_idx" ON "Booking"("startUtc");

-- CreateIndex
CREATE INDEX "Booking_parentId_status_idx" ON "Booking"("parentId", "status");

-- CreateIndex
CREATE INDEX "Booking_mentorId_startUtc_idx" ON "Booking"("mentorId", "startUtc");

-- CreateIndex
CREATE INDEX "OutboxMessage_createdAt_idx" ON "OutboxMessage"("createdAt");

-- AddForeignKey
ALTER TABLE "AvailabilityRule" ADD CONSTRAINT "AvailabilityRule_mentorId_fkey" FOREIGN KEY ("mentorId") REFERENCES "Mentor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Parent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "AdminUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthToken" ADD CONSTRAINT "AuthToken_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Parent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Parent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_mentorId_fkey" FOREIGN KEY ("mentorId") REFERENCES "Mentor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutboxMessage" ADD CONSTRAINT "OutboxMessage_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;
