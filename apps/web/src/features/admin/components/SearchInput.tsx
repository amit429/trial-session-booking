import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

export function SearchInput({
  value,
  onChange,
  label,
  placeholder
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
  placeholder: string;
}) {
  return (
    <div className="relative min-w-[220px] max-w-[340px] flex-1">
      <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
      <Input aria-label={label} placeholder={placeholder} className="pl-8" value={value} onChange={e => onChange(e.target.value)} />
    </div>
  );
}
