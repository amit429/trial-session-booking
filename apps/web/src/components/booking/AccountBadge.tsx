import type { AccountStatus } from "@shared";
import { Badge } from "@/components/ui/badge";

/** Guest / Pending / Verified parent account. */
export function AccountBadge({ status }: { status: AccountStatus }) {
  if (status === "VERIFIED") return <Badge variant="success" dot>Verified</Badge>;
  if (status === "PENDING") return <Badge variant="warning" dot>Pending</Badge>;
  return <Badge>Guest</Badge>;
}
