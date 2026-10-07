import { createBrowserRouter, Navigate } from "react-router-dom";
import { PublicLayout } from "./components/SiteHeader";
import { EmptyState } from "./components/ui/empty";
import { Button } from "./components/ui/button";
import { Link } from "react-router-dom";
import { Compass } from "lucide-react";
import { BookPage } from "./features/booking/BookPage";
import { BookingPage } from "./features/booking-view/BookingPage";
import { LoginPage } from "./features/account/LoginPage";
import { MyBookingsPage } from "./features/account/MyBookingsPage";
import { ForgotPasswordPage, ResetPasswordPage } from "./features/account/PasswordPages";
import { SignupPage } from "./features/account/SignupPage";
import { VerifyEmailPage } from "./features/account/VerifyEmailPage";
import { DevOutboxPage } from "./features/dev/DevOutboxPage";
import { RequireParent } from "./components/Guards";

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
  { path: "/book", element: <BookPage /> },
  { path: "/booking/:reference", element: <BookingPage /> },
  { path: "/signup", element: <SignupPage /> },
  { path: "/login", element: <LoginPage /> },
  { path: "/verify-email", element: <VerifyEmailPage /> },
  { path: "/forgot-password", element: <ForgotPasswordPage /> },
  { path: "/reset-password", element: <ResetPasswordPage /> },
  { path: "/my-bookings", element: <RequireParent><MyBookingsPage /></RequireParent> },
  { path: "/dev/outbox", element: <DevOutboxPage /> },
  { path: "*", element: <NotFound /> }
]);
