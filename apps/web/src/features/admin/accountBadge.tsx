import { Badge } from "@/components/ui/badge";

export function AccountBadge({ status }: { status: string }) {
  if (status === "VERIFIED") return <Badge variant="success" dot>Verified</Badge>;
  if (status === "PENDING") return <Badge variant="warning" dot>Pending</Badge>;
  return <Badge>Guest</Badge>;
}
