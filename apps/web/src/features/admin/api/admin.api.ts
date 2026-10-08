import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  AdminBookingDetailDto,
  AdminBookingDto,
  AdminDashboardDto,
  AdminLoginResponse,
  AdminMentorDto,
  AdminParentDetailDto,
  AdminParentRowDto,
  MentorScheduleDto,
  OutboxDto,
  Paged
} from "@shared";
import { api } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { setSession } from "@/lib/session";

export type BookingFilters = { scope: string; status: string; mentorId: string; q: string };

export const useAdminLogin = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { email: string; password: string }) => api.post<AdminLoginResponse>("/auth/admin/login", body),
    onSuccess: r => setSession(qc, { admin: r.admin })
  });
};

export const useDashboard = () =>
  useQuery({ queryKey: queryKeys.admin.dashboard, queryFn: () => api.get<AdminDashboardDto>("/admin/dashboard", { days: 14 }) });

export const useUpcomingBookings = (limit: number) =>
  useQuery({
    queryKey: queryKeys.admin.bookings({ next: limit }),
    queryFn: () => api.get<Paged<AdminBookingDto>>("/admin/bookings", { scope: "upcoming", status: "CONFIRMED", pageSize: limit })
  });

export const useAdminBookings = (f: BookingFilters) =>
  useQuery({
    queryKey: queryKeys.admin.bookings(f),
    queryFn: () => api.get<Paged<AdminBookingDto>>("/admin/bookings", { ...f, pageSize: 100 }),
    placeholderData: keepPreviousData
  });

export const useAdminBooking = (reference: string | null) =>
  useQuery({
    queryKey: queryKeys.admin.booking(reference ?? ""),
    queryFn: () => api.get<AdminBookingDetailDto>(`/admin/bookings/${reference}`),
    enabled: !!reference,
    retry: false
  });

export const useAdminParents = (q: string) =>
  useQuery({
    queryKey: queryKeys.admin.parents(q),
    queryFn: () => api.get<Paged<AdminParentRowDto>>("/admin/parents", { q, pageSize: 100 }),
    placeholderData: keepPreviousData
  });

export const useAdminParent = (id: string) =>
  useQuery({ queryKey: queryKeys.admin.parent(id), queryFn: () => api.get<AdminParentDetailDto>(`/admin/parents/${id}`) });

export const useAdminMentors = () =>
  useQuery({ queryKey: queryKeys.admin.mentors, queryFn: () => api.get<AdminMentorDto[]>("/admin/mentors") });

export const useMentorSchedule = (id: string) =>
  useQuery({
    queryKey: queryKeys.admin.mentorSchedule(id),
    queryFn: () => api.get<MentorScheduleDto>(`/admin/mentors/${id}/schedule`, { days: 14 })
  });

export const useAdminOutbox = () =>
  useQuery({ queryKey: queryKeys.admin.outbox, queryFn: () => api.get<Paged<OutboxDto>>("/admin/outbox", { pageSize: 80 }) });

/** Cancel on a parent's behalf; refreshes every admin view and the public slots. */
export const useAdminCancelBooking = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (reference: string) => api.post<AdminBookingDto>(`/admin/bookings/${reference}/cancel`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.admin.all });
      qc.invalidateQueries({ queryKey: queryKeys.slots.all });
    }
  });
};
