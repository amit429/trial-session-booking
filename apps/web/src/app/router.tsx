import { Compass } from "lucide-react";
import { lazy, Suspense, type ComponentType, type ReactNode } from "react";
import { createBrowserRouter, Link, Navigate } from "react-router-dom";
import { RequireAdmin, RequireParent } from "@/components/guards/route-guards";
import { PublicLayout } from "@/components/layout/SiteHeader";
import { FormCardSkeleton, PublicPageSkeleton } from "@/components/feedback/skeletons";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/feedback/EmptyState";

/** Route-level code splitting: each page loads on demand behind a page-shaped skeleton. */
const page = <M,>(load: () => Promise<M>, name: keyof M) =>
  lazy(() => load().then(m => ({ default: m[name] as unknown as ComponentType })));

const BookPage = page(() => import("@/features/booking/pages/BookPage"), "BookPage");
const BookingPage = page(() => import("@/features/manage-booking/pages/BookingPage"), "BookingPage");
const SignupPage = page(() => import("@/features/auth/pages/SignupPage"), "SignupPage");
const LoginPage = page(() => import("@/features/auth/pages/LoginPage"), "LoginPage");
const VerifyEmailPage = page(() => import("@/features/auth/pages/VerifyEmailPage"), "VerifyEmailPage");
const ForgotPasswordPage = page(() => import("@/features/auth/pages/PasswordPages"), "ForgotPasswordPage");
const ResetPasswordPage = page(() => import("@/features/auth/pages/PasswordPages"), "ResetPasswordPage");
const MyBookingsPage = page(() => import("@/features/my-bookings/pages/MyBookingsPage"), "MyBookingsPage");
const DevOutboxPage = page(() => import("@/features/dev/pages/DevOutboxPage"), "DevOutboxPage");
const AdminLayout = page(() => import("@/features/admin/components/AdminLayout"), "AdminLayout");
const AdminLoginPage = page(() => import("@/features/admin/pages/admin-pages"), "AdminLoginPage");
const DashboardPage = page(() => import("@/features/admin/pages/admin-pages"), "DashboardPage");
const BookingsPage = page(() => import("@/features/admin/pages/admin-pages"), "BookingsPage");
const ParentsPage = page(() => import("@/features/admin/pages/admin-pages"), "ParentsPage");
const ParentDetailPage = page(() => import("@/features/admin/pages/admin-pages"), "ParentDetailPage");
const MentorsPage = page(() => import("@/features/admin/pages/admin-pages"), "MentorsPage");
const MentorDetailPage = page(() => import("@/features/admin/pages/admin-pages"), "MentorDetailPage");
const OutboxPage = page(() => import("@/features/admin/pages/admin-pages"), "OutboxPage");
const AdminBookingPage = page(() => import("@/features/admin/pages/BookingDetailPage"), "AdminBookingPage");

const pub = (node: ReactNode) => <Suspense fallback={<PublicPageSkeleton />}>{node}</Suspense>;
const form = (node: ReactNode) => <Suspense fallback={<PublicLayout narrow><FormCardSkeleton /></PublicLayout>}>{node}</Suspense>;

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
  { path: "/book", element: pub(<BookPage />) },
  { path: "/booking/:reference", element: pub(<BookingPage />) },
  { path: "/signup", element: form(<SignupPage />) },
  { path: "/login", element: form(<LoginPage />) },
  { path: "/verify-email", element: form(<VerifyEmailPage />) },
  { path: "/forgot-password", element: form(<ForgotPasswordPage />) },
  { path: "/reset-password", element: form(<ResetPasswordPage />) },
  { path: "/my-bookings", element: <RequireParent>{pub(<MyBookingsPage />)}</RequireParent> },
  { path: "/dev/outbox", element: pub(<DevOutboxPage />) },
  { path: "/admin/login", element: form(<AdminLoginPage />) },
  {
    path: "/admin",
    element: <RequireAdmin />,
    children: [{
      element: pub(<AdminLayout />),
      children: [
        { index: true, element: <DashboardPage /> },
        { path: "bookings", element: <BookingsPage /> },
        { path: "bookings/:reference", element: <AdminBookingPage /> },
        { path: "parents", element: <ParentsPage /> },
        { path: "parents/:id", element: <ParentDetailPage /> },
        { path: "mentors", element: <MentorsPage /> },
        { path: "mentors/:id", element: <MentorDetailPage /> },
        { path: "outbox", element: <OutboxPage /> }
      ]
    }]
  },
  { path: "*", element: <NotFound /> }
]);
