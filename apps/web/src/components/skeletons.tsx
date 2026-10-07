import { Card, CardContent, Skeleton } from "./ui/card";

/** Page-shaped placeholders. Each mirrors the layout it stands in for, so nothing jumps when data arrives. */

export const Busy = ({ children, label = "Loading" }: { children: React.ReactNode; label?: string }) => (
  <div aria-busy="true" aria-label={label}>{children}</div>
);

export function PageHeaderSkeleton({ action }: { action?: boolean }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-col gap-2"><Skeleton className="h-7 w-48" /><Skeleton className="h-4 w-80 max-w-full" /></div>
      {action && <Skeleton className="h-9 w-32" />}
    </div>
  );
}

export function StatsSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
      {[0, 1, 2, 3].map(i => (
        <Card key={i} className="flex flex-col gap-2.5 px-5 py-[18px]"><Skeleton className="h-4 w-24" /><Skeleton className="h-8 w-16" /><Skeleton className="h-3 w-32" /></Card>
      ))}
    </div>
  );
}

export function ChartSkeleton() {
  const heights = [30, 55, 20, 70, 85, 25, 40, 22, 60, 35, 18, 45, 28, 50];
  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-2"><Skeleton className="h-5 w-44" /><Skeleton className="h-3.5 w-72 max-w-full" /></div>
        <div className="flex h-[200px] items-end gap-3 px-6">{heights.map((h, i) => <Skeleton key={i} className="flex-1 rounded-sm" style={{ height: `${h}%` } as React.CSSProperties} />)}</div>
      </CardContent>
    </Card>
  );
}

export function CardGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(270px,1fr))] gap-3.5">
      {Array.from({ length: count }, (_, i) => (
        <Card key={i}>
          <CardContent className="flex flex-col gap-4">
            <div className="flex items-center gap-3"><Skeleton className="size-9 rounded-full" /><div className="flex flex-1 flex-col gap-1.5"><Skeleton className="h-4 w-32" /><Skeleton className="h-3 w-44" /></div></div>
            <div className="flex flex-col gap-2"><Skeleton className="h-3.5 w-full" /><Skeleton className="h-1.5 w-full rounded-full" /></div>
            <div className="flex items-center justify-between"><Skeleton className="h-3.5 w-36" /><Skeleton className="h-8 w-20" /></div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function ListSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <Card>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 border-b border-border px-5 py-4 last:border-b-0">
          <Skeleton className="h-[58px] w-[52px] rounded-lg" />
          <div className="flex flex-col gap-2"><Skeleton className="h-4 w-48" /><Skeleton className="h-3.5 w-64 max-w-full" /><Skeleton className="h-3.5 w-28" /></div>
          <Skeleton className="h-8 w-16" />
        </div>
      ))}
    </Card>
  );
}

export function MessagesSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex flex-col gap-2.5 rounded-xl border border-border bg-card px-4 py-3.5">
          <div className="flex justify-between"><Skeleton className="h-[22px] w-44" /><Skeleton className="h-3.5 w-40" /></div>
          <Skeleton className="h-4 w-60" /><Skeleton className="h-3.5 w-full" /><Skeleton className="h-3.5 w-3/4" />
        </div>
      ))}
    </div>
  );
}

export function FormCardSkeleton({ fields = 2 }: { fields?: number }) {
  return (
    <div className="mx-auto max-w-[400px] pt-6">
      <Card>
        <CardContent className="flex flex-col gap-[18px] p-7">
          <div className="flex flex-col gap-2"><Skeleton className="h-7 w-40" /><Skeleton className="h-4 w-64" /></div>
          {Array.from({ length: fields }, (_, i) => <div key={i} className="flex flex-col gap-2"><Skeleton className="h-4 w-20" /><Skeleton className="h-9" /></div>)}
          <Skeleton className="h-9" />
        </CardContent>
      </Card>
    </div>
  );
}

/** The booking card (details | calendar | times) while slots load. */
export function BookerSkeleton() {
  return (
    <div className="grid min-h-[540px] overflow-hidden rounded-2xl border border-border bg-card shadow-md max-[960px]:grid-cols-1 min-[961px]:grid-cols-[300px_minmax(0,1fr)_284px]">
      <div className="flex flex-col gap-3 p-6">
        <div className="flex">{[0, 1, 2, 3, 4].map(i => <Skeleton key={i} className="-ml-2 size-9 rounded-full first:ml-0" />)}</div>
        <Skeleton className="mt-2 h-6 w-48" /><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-4/5" />
        <div className="mt-4 flex flex-col gap-3">{[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-4 w-44" />)}</div>
      </div>
      <div className="flex flex-col gap-4 border-border p-6 max-[960px]:border-t min-[961px]:border-l">
        <div className="flex justify-between"><Skeleton className="h-5 w-32" /><Skeleton className="h-8 w-[72px]" /></div>
        <div className="grid grid-cols-7 gap-1.5">{Array.from({ length: 35 }, (_, i) => <Skeleton key={i} className="aspect-square max-h-[58px] rounded-[9px]" />)}</div>
      </div>
      <div className="flex flex-col gap-2 border-border p-6 max-[960px]:border-t min-[961px]:border-l">
        <div className="mb-2 flex justify-between"><Skeleton className="h-5 w-20" /><Skeleton className="h-8 w-24" /></div>
        {Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="h-[42px] rounded-[9px]" />)}
      </div>
    </div>
  );
}

/** Generic public page while its code loads. */
export function PublicPageSkeleton() {
  return (
    <>
      <div className="h-[61px] border-b border-border bg-background px-4"><div className="mx-auto flex h-full max-w-[1100px] items-center justify-between"><Skeleton className="h-7 w-32" /><Skeleton className="h-8 w-40" /></div></div>
      <div className="mx-auto max-w-[1100px] px-4 pt-8"><BookerSkeleton /></div>
    </>
  );
}

/** Admin content area while a page's code loads. */
export function AdminContentSkeleton() {
  return (
    <>
      <div className="flex h-14 items-center border-b border-border px-5"><Skeleton className="h-4 w-40" /></div>
      <div className="flex flex-col gap-5 p-4 md:p-6"><PageHeaderSkeleton /><StatsSkeleton /><ChartSkeleton /></div>
    </>
  );
}
