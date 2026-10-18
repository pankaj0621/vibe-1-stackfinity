import type { ToastMessage } from "@/components/ui/toast";

const STORAGE_KEY = "lawazia:pending-auth-success-toast";
const MAX_AGE_MS = 30_000;

interface PendingAuthToast {
  targetPath: string;
  title: string;
  message: string;
  expiresAt: number;
}

export function queueAuthSuccessToast(
  toast: Pick<ToastMessage, "title" | "message">,
  targetPath: string
): void {
  try {
    const pending: PendingAuthToast = {
      ...toast,
      targetPath,
      expiresAt: Date.now() + MAX_AGE_MS,
    };
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(pending));
  } catch {
    // Authentication and navigation must still succeed when browser storage is unavailable.
  }
}

export function consumeAuthSuccessToast(targetPath: string): ToastMessage | null {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    window.sessionStorage.removeItem(STORAGE_KEY);

    const pending = JSON.parse(raw) as Partial<PendingAuthToast>;
    if (
      pending.targetPath !== targetPath ||
      typeof pending.expiresAt !== "number" ||
      pending.expiresAt < Date.now() ||
      typeof pending.title !== "string" ||
      typeof pending.message !== "string"
    ) {
      return null;
    }

    return { title: pending.title, message: pending.message, tone: "teal" };
  } catch {
    try {
      window.sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore unavailable browser storage.
    }
    return null;
  }
}
