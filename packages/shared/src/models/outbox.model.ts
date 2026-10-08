export type OutboxDto = {
  id: string;
  kind: string;
  toEmail: string;
  subject: string;
  body: string;
  bookingReference: string | null;
  createdAt: string;
};
