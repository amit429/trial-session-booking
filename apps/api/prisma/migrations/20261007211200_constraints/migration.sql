-- Integrity rules Prisma can't express (Technical Design §6.2).
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "Booking"
  ADD CONSTRAINT booking_time_valid  CHECK ("endUtc" > "startUtc"),
  ADD CONSTRAINT booking_grade_valid CHECK ("childGrade" BETWEEN 1 AND 12),
  ADD CONSTRAINT booking_no_overlap_per_mentor
    EXCLUDE USING gist ("mentorId" WITH =, tstzrange("startUtc", "endUtc", '[)') WITH &&)
    WHERE (status = 'CONFIRMED');

CREATE INDEX booking_mentor_day_confirmed
  ON "Booking" ("mentorId", "mentorLocalDate") WHERE status = 'CONFIRMED';

ALTER TABLE "AvailabilityRule"
  ADD CONSTRAINT rule_weekday CHECK (weekday BETWEEN 1 AND 7),
  ADD CONSTRAINT rule_bounds  CHECK ("startMinute" >= 0 AND "startMinute" < "endMinute" AND "endMinute" <= 1440);

ALTER TABLE "Session"
  ADD CONSTRAINT session_subject CHECK (
    (kind = 'PARENT' AND "parentId" IS NOT NULL AND "adminId" IS NULL) OR
    (kind = 'ADMIN'  AND "adminId"  IS NOT NULL AND "parentId" IS NULL));
