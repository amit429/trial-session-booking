import { Compass } from "lucide-react";
import { lazy, Suspense, type ComponentType, type ReactNode } from "react";
import { createBrowserRouter, Link } from "react-router-dom";
import { FormCardSkeleton, PublicPageSkeleton } from "@/components/feedback/skeletons";
import { EmptyState } from "@/components/feedback/EmptyState";
import { RequireAdmin, RequireParent } from "@/components/guards/route-guards";
import { PublicLayout } from "@/components/layout";
import { Button } from "@/components/ui/button";

/** Route-level code splitting: each page loads on demand behind a page-shaped skeleton. */
const page = <M,>(load: () => Promise<M>, name: keyof M) => lazy(() => load().then(m => ({ default: m[name] as unknown as ComponentType })));

const LandingPage = page(() => import("@/features/landing"), "LandingPage");
const BookPage = page(() => import("@/features/booking"), "BookPage");
const BookingPage = page(() => import("@/features/manage-booking"), "BookingPage");
const MyBookingsPage = page(() => import("@/features/my-bookings"), "MyBookingsPage");
const SignupPage = page(() => import("@/features/auth/pages/SignupPage"), "SignupPage");
const LoginPage = page(() => import("@/features/auth/pages/LoginPage"), "LoginPage");
const VerifyEmailPage = page(() => import("@/features/auth/pages/VerifyEmailPage"), "VerifyEmailPage");
const ForgotPasswordPage = page(() => import("@/features/auth/pages/ForgotPasswordPage"), "ForgotPasswordPage");
const ResetPasswordPage = page(() => import("@/features/auth/pages/ResetPasswordPage"), "ResetPasswordPage");
const DevOutboxPage = page(() => import("@/features/dev"), "DevOutboxPage");
const AdminLayout = page(() => import("@/features/admin/components/AdminLayout"), "AdminLayout");
const AdminLoginPage = page(() => import("@/features/admin/pages/AdminLoginPage"), "AdminLoginPage");
const DashboardPage = page(() => import("@/features/admin/pages/DashboardPage"), "DashboardPage");
const BookingsPage = page(() => import("@/features/admin/pages/BookingsPage"), "BookingsPage");
const BookingDetailPage = page(() => import("@/features/admin/pages/BookingDetailPage"), "BookingDetailPage");
const ParentsPage = page(() => import("@/features/admin/pages/ParentsPage"), "ParentsPage");
const ParentDetailPage = page(() => import("@/features/admin/pages/ParentDetailPage"), "ParentDetailPage");
const MentorsPage = page(() => import("@/features/admin/pages/MentorsPage"), "MentorsPage");
const MentorDetailPage = page(() => import("@/features/admin/pages/MentorDetailPage"), "MentorDetailPage");
const OutboxPage = page(() => import("@/features/admin/pages/OutboxPage"), "OutboxPage");

const withPageSkeleton = (node: ReactNode) => <Suspense fallback={<PublicPageSkeleton />}>{node}</Suspense>;
const withFormSkeleton = (node: ReactNode) => <Suspense fallback={<PublicLayout narrow><FormCardSkeleton /></PublicLayout>}>{node}</Suspense>;

function NotFound() {
  return (
    <PublicLayout narrow>
      <EmptyState icon={<Compass />} title="We couldn't find that page">
        <Button asChild variant="brand"><Link to="/">Go to the home page</Link></Button>
      </EmptyState>
    </PublicLayout>
  );
}

export const router = createBrowserRouter([
  { path: "/", element: withPageSkeleton(<LandingPage />) },
  { path: "/book", element: withPageSkeleton(<BookPage />) },
  { path: "/booking/:reference", element: withPageSkeleton(<BookingPage />) },
  { path: "/my-bookings", element: <RequireParent>{withPageSkeleton(<MyBookingsPage />)}</RequireParent> },
  { path: "/signup", element: withFormSkeleton(<SignupPage />) },
  { path: "/login", element: withFormSkeleton(<LoginPage />) },
  { path: "/verify-email", element: withFormSkeleton(<VerifyEmailPage />) },
  { path: "/forgot-password", element: withFormSkeleton(<ForgotPasswordPage />) },
  { path: "/reset-password", element: withFormSkeleton(<ResetPasswordPage />) },
  { path: "/dev/outbox", element: withPageSkeleton(<DevOutboxPage />) },
  { path: "/admin/login", element: withFormSkeleton(<AdminLoginPage />) },
  {
    path: "/admin",
    element: <RequireAdmin />,
    children: [
      {
        element: withPageSkeleton(<AdminLayout />),
        children: [
          { index: true, element: <DashboardPage /> },
          { path: "bookings", element: <BookingsPage /> },
          { path: "bookings/:reference", element: <BookingDetailPage /> },
          { path: "parents", element: <ParentsPage /> },
          { path: "parents/:id", element: <ParentDetailPage /> },
          { path: "mentors", element: <MentorsPage /> },
          { path: "mentors/:id", element: <MentorDetailPage /> },
          { path: "outbox", element: <OutboxPage /> }
        ]
      }
    ]
  },
  { path: "*", element: <NotFound /> }
]);
