import type { ParentDto } from "./parent.model";

export type AdminDto = { id: string; name: string; email: string };
export type MeResponse = { parent: ParentDto | null; admin: AdminDto | null };
export type ParentLoginResponse = { parent: ParentDto };
export type AdminLoginResponse = { admin: AdminDto };
export type MessageResponse = { message: string };
