import { Card, CardContent, Separator, Skeleton } from "@/components/ui/card";

/** Shaped like the confirmation card, so nothing jumps when the booking loads. */
export function BookingSkeleton() {
  return (
    <div className="mx-auto flex max-w-[600px] flex-col gap-4" aria-busy="true" aria-label="Loading booking">
      <Card className="shadow-md">
        <CardContent className="flex flex-col gap-6 p-7">
          <div className="flex flex-col items-center gap-3">
            <Skeleton className="size-[52px] rounded-full" />
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>
          <Separator />
          <div className="flex flex-col gap-[18px]">
            {[0, 1, 2, 3, 4].map(i => (
              <div key={i} className="grid grid-cols-[110px_minmax(0,1fr)] gap-4">
                <Skeleton className="h-4 w-16" />
                <div className="flex flex-col gap-1.5">
                  <Skeleton className="h-4 w-3/4" />
                  {i === 1 && <Skeleton className="h-4 w-1/2" />}
                </div>
              </div>
            ))}
          </div>
          <Separator />
          <div className="flex gap-2">
            <Skeleton className="h-9 w-40" />
            <Skeleton className="h-9 w-44" />
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="flex flex-col gap-2 py-[18px]">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-9" />
        </CardContent>
      </Card>
    </div>
  );
}
