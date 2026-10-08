import type { ReactNode } from "react";
import { PublicLayout } from "@/components/layout";
import { Card, CardContent } from "@/components/ui/card";

export function AuthCard({
  icon,
  title,
  description,
  children,
  footer
}: {
  icon?: ReactNode;
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <PublicLayout narrow>
      <div className="mx-auto max-w-[400px] pt-6">
        <Card>
          <CardContent className="flex flex-col gap-[18px] p-7">
            <div className="flex flex-col gap-2">
              {icon && (
                <div className="grid size-11 place-items-center rounded-full bg-brand-soft text-brand-text [&_svg]:size-5">{icon}</div>
              )}
              <h1 className="text-2xl font-semibold">{title}</h1>
              {description && <p className="text-muted-foreground">{description}</p>}
            </div>
            {children}
          </CardContent>
        </Card>
        {footer && <p className="mt-4 text-center text-[13px] text-muted-foreground">{footer}</p>}
      </div>
    </PublicLayout>
  );
}
