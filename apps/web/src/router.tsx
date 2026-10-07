import { createBrowserRouter, Navigate } from "react-router-dom";
import { PublicLayout } from "./components/SiteHeader";
import { EmptyState } from "./components/ui/empty";
import { Button } from "./components/ui/button";
import { Link } from "react-router-dom";
import { Compass } from "lucide-react";

function NotFound() {
  return (
    <PublicLayout narrow>
      <EmptyState icon={<Compass />} title="We couldn't find that page">
        <Button asChild variant="brand"><Link to="/book">Book a free trial</Link></Button>
      </EmptyState>
    </PublicLayout>
  );
}

export const router = createBrowserRouter([
  { path: "/", element: <Navigate to="/book" replace /> },
  { path: "/book", element: <PublicLayout><p className="text-muted-foreground">Booking is on its way.</p></PublicLayout> },
  { path: "*", element: <NotFound /> }
]);
