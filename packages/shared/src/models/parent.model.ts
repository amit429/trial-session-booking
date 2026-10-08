export type AccountStatus = "GUEST" | "PENDING" | "VERIFIED";

export type ParentDto = { id: string; name: string; email: string; timezone: string; status: AccountStatus };
