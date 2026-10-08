import { Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { copyToClipboard } from "@/lib/clipboard";

/** Read-only value with a copy button (class links, manage links). */
export function CopyField({ value, display, label }: { value: string; display?: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5 rounded-md border border-border bg-muted py-1 pl-2.5 pr-1">
      <span className="min-w-0 flex-1 truncate font-mono text-xs">{display ?? value}</span>
      <Button variant="ghost" size="icon-sm" aria-label={`Copy ${label}`} onClick={() => copyToClipboard(value, label)}>
        <Copy />
      </Button>
    </div>
  );
}
