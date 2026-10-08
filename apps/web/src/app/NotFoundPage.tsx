import { Compass } from "lucide-react";
import { Link } from "react-router-dom";
import { EmptyState } from "@/components/feedback/EmptyState";
import { PublicLayout } from "@/components/layout";
import { Button } from "@/components/ui/button";

export function NotFoundPage() {
  return (
    <PublicLayout narrow>
      <EmptyState icon={<Compass />} title="We couldn't find that page">
        <Button asChild variant="brand">
          <Link to="/">Go to the home page</Link>
        </Button>
      </EmptyState>
    </PublicLayout>
  );
}
