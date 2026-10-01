import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { NotificationDTO } from "@/lib/api/notifications";
import NotificationsPage from "./page";

/**
 * Délégation RDV (sous-lot 4) — l'écran est générique (titre/corps fournis par le
 * backend, lien dès que meta.eventId existe) : les nouveaux types s'affichent sans
 * rendu dédié. Ce test le prouve pour les trois cas, dont le délégant sans accès.
 */
const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

const base = { organizationId: "o", userId: "u", readAt: null, createdAt: "2099-01-05T09:30:00.000Z" };
const items = [
  { ...base, id: "n1", type: "APPOINTMENT_DELEGATED", title: "Rendez-vous délégué : RDV client",
    body: "Alice Agent vous a délégué ce rendez-vous", meta: { eventId: "e1" } },
  { ...base, id: "n2", type: "APPOINTMENT_DELEGATION_SENT", title: "Délégation transmise : RDV client",
    body: "Votre délégation à Bruno Agent a bien été transmise", meta: null },
  { ...base, id: "n3", type: "APPOINTMENT_REFUSED", title: "Délégation refusée : RDV client",
    body: "Bruno Agent a refusé la délégation — le rendez-vous vous revient", meta: { eventId: "e1" } },
] as NotificationDTO[];

vi.mock("@/lib/api/notifications", () => ({
  listNotifications: vi.fn(async () => ({ items, total: 3, unreadCount: 3 })),
  markAllNotificationsAsRead: vi.fn(),
  markNotificationAsRead: vi.fn(async () => ({})),
}));
vi.mock("@/lib/auth/AuthContext", () => ({
  useAuth: () => ({ authedFetch: (fn: (t: string) => unknown) => Promise.resolve().then(() => fn("tok")) }),
}));

describe("notifications — délégation RDV", () => {
  it("affiche les trois notifications, lien vers le RDV seulement si meta.eventId", async () => {
    render(<NotificationsPage />);
    const delegated = await screen.findByText("Rendez-vous délégué : RDV client");
    expect(delegated).toHaveTextContent("→ voir l'événement");
    expect(screen.getByText("Alice Agent vous a délégué ce rendez-vous")).toBeInTheDocument();

    const sent = screen.getByText("Délégation transmise : RDV client");
    expect(sent).not.toHaveTextContent("voir l'événement");

    const refused = screen.getByText("Délégation refusée : RDV client");
    expect(refused).toHaveTextContent("→ voir l'événement");

    fireEvent.click(delegated);
    await waitFor(() => expect(push).toHaveBeenCalledWith("/calendar-pro?eventId=e1"));
  });
});
