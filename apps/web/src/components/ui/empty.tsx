import type { ReactNode } from "react";

export function EmptyState({ icon, title, children }: { icon: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2.5 px-4 py-10 text-center">
      <div className="grid size-11 place-items-center rounded-xl bg-muted text-muted-foreground [&_svg]:size-5">{icon}</div>
      <p className="font-semibold">{title}</p>
      {children}
    </div>
  );
}
