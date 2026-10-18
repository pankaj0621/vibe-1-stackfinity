"use client";

import { useCallback, useEffect, useState, FormEvent } from "react";
import Link from "next/link";
import { Activity, Car, Clock3, History, KeyRound, RefreshCw, Search, ShieldCheck, UserCheck, UserCog, UserRoundX, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { StatusPill } from "@/components/ui/status-pill";
import { useDashboardUser } from "@/components/layout/dashboard-user-context";
import type { SessionUser } from "@/types/domain.types";
import { notifyLiveUpdate, useLiveRefresh } from "@/lib/hooks/use-live-refresh";
import { fetchApi, getApiErrorMessage } from "@/lib/api/client";

interface AdminAccount {
  id: string;
  name: string;
  email: string;
  role: "admin" | "rider" | "student" | "employee";
  createdAt?: string;
  isDisabled?: boolean;
}

interface AdminOverview {
  vehicle: { status: "free" | "held" | "active"; currentRequestId?: string | null; currentTripId?: string | null };
  users: AdminAccount[];
  recentRequests: Array<{ id: string; from: string; to: string; time: string; day: string; status: string; seats: number; filerName: string; createdAt?: string }>;
  counts: { users: number; riders: number; students: number; employees: number; admins: number; disabled: number; requests: number; pending: number; clashes: number; completedTrips: number };
}

const tileStyle = "rounded-[22px] border border-[#E7D9C1] bg-white p-5 shadow-[0_12px_32px_rgba(55,40,18,0.05)]";

export function AdminDashboard({ adminId }: { adminId: string }) {
  const currentUser = useDashboardUser();
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [accountForm, setAccountForm] = useState({ name: "", email: "", password: "", role: "student" });
  const [accountMessage, setAccountMessage] = useState("");
  const [accountSaving, setAccountSaving] = useState(false);
  const [userSearch, setUserSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: "", email: "", role: "student" as AdminAccount["role"] });
  const [resetPassword, setResetPassword] = useState("");
  const [manageMessage, setManageMessage] = useState("");
  const [manageMessageError, setManageMessageError] = useState(false);
  const [manageSaving, setManageSaving] = useState(false);

  const loadOverview = useCallback(async (showSpinner = false) => {
    if (showSpinner) setLoading(true);
    setError("");
    try {
      const json = await fetchApi<AdminOverview>("/api/admin/overview", { cache: "no-store" }, "load admin overview");
      if (!json.data) throw new Error("The server returned no admin overview data. Refresh and try again.");
      setOverview(json.data);
    } catch (loadError) {
      setError(getApiErrorMessage(loadError, "Could not load admin overview."));
    } finally {
      if (showSpinner) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadOverview(true);
  }, [loadOverview]);

  useLiveRefresh(() => loadOverview(false), 5000);

  const createAccount = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAccountSaving(true);
    setAccountMessage("");
    try {
      const json = await fetchApi<SessionUser>("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(accountForm),
      }, "create account");
      notifyLiveUpdate();
      setAccountMessage(json.data
        ? `Created ${json.data.role} account for ${json.data.email}. Share the password securely.`
        : "Account created successfully. Refresh the list if it does not appear yet.");
      setAccountForm({ name: "", email: "", password: "", role: "student" });
      await loadOverview();
    } catch (saveError) {
      setAccountMessage(getApiErrorMessage(saveError, "Could not create account."));
    } finally {
      setAccountSaving(false);
    }
  };

  const beginEditing = (user: AdminAccount) => {
    setEditingId(user.id);
    setEditForm({ name: user.name, email: user.email, role: user.role });
    setResetPassword("");
    setManageMessage("");
    setManageMessageError(false);
  };

  const updateAccount = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingId) return;
    setManageSaving(true);
    setManageMessage("");
    setManageMessageError(false);
    try {
      const json = await fetchApi<SessionUser & { isDisabled: boolean; sessionsRevoked: boolean }>(`/api/admin/users/${encodeURIComponent(editingId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      }, "update account details");
      notifyLiveUpdate();
      setManageMessage("Account details and access updated.");
      await loadOverview();
      if (json.data?.sessionsRevoked && editingId === adminId) window.location.assign("/login");
    } catch (saveError) {
      setManageMessage(getApiErrorMessage(saveError, "Could not update account."));
      setManageMessageError(true);
    } finally {
      setManageSaving(false);
    }
  };

  const changePassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingId) return;
    setManageSaving(true);
    setManageMessage("");
    setManageMessageError(false);
    try {
      await fetchApi<SessionUser & { isDisabled: boolean; sessionsRevoked: boolean }>(`/api/admin/users/${encodeURIComponent(editingId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: resetPassword }),
      }, "reset account password");
      notifyLiveUpdate();
      setResetPassword("");
      setManageMessage("Password reset. All existing sessions for this account have been signed out.");
      if (editingId === adminId) {
        window.location.assign("/login");
        return;
      }
      await loadOverview();
    } catch (saveError) {
      setManageMessage(getApiErrorMessage(saveError, "Could not reset the password."));
      setManageMessageError(true);
    } finally {
      setManageSaving(false);
    }
  };

  const toggleAccountAccess = async (user: AdminAccount) => {
    const isDisabling = !user.isDisabled;
    if (isDisabling && !window.confirm(`Disable sign-in for ${user.name}? Their trip and booking history will remain available.`)) return;
    setEditingId(user.id);
    setEditForm({ name: user.name, email: user.email, role: user.role });
    setResetPassword("");
    setManageSaving(true);
    setManageMessage("");
    setManageMessageError(false);
    try {
      await fetchApi(`/api/admin/users/${encodeURIComponent(user.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isDisabled: isDisabling }),
      }, "change account access");
      notifyLiveUpdate();
      setManageMessage(isDisabling ? "Account disabled. Existing sessions were signed out." : "Account re-enabled.");
      await loadOverview();
    } catch (saveError) {
      setManageMessage(getApiErrorMessage(saveError, "Could not change account access."));
      setManageMessageError(true);
    } finally {
      setManageSaving(false);
    }
  };

  const visibleUsers = (overview?.users ?? []).filter((user) => {
    const query = userSearch.trim().toLowerCase();
    return !query || `${user.name} ${user.email} ${user.role} ${user.isDisabled ? "disabled" : "active"}`.toLowerCase().includes(query);
  });

  return (
    <div className="mx-auto max-w-[1240px] px-4 pb-28 pt-6 sm:px-6 lg:px-10 lg:pb-16">
      <section className="relative overflow-hidden rounded-[28px] bg-ink p-6 text-white shadow-soft sm:p-8">
        <div className="absolute -right-10 -top-14 h-48 w-48 rounded-full bg-sun/20 blur-3xl" />
        <div className="relative flex flex-wrap items-start justify-between gap-5">
          <div>
            <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-sun">
              <ShieldCheck size={15} /> Admin control room
            </div>
            <h2 className="mt-3 font-display text-3xl sm:text-4xl">Welcome, {currentUser.name}</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-white/65">
              Full account and role control, password resets, every booking, live tracking, and Toto dispatch.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadOverview(true)}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm font-semibold transition hover:bg-white/15 disabled:opacity-60"
          >
            <RefreshCw size={15} className={loading ? "animate-spin" : ""} /> Refresh
          </button>
        </div>
        <div className="relative mt-6 flex flex-wrap gap-3">
          <Link href="/rider" className="inline-flex items-center gap-2 rounded-xl bg-sun px-4 py-3 text-sm font-bold text-ink transition hover:bg-sun-200">
            <Car size={17} /> Open dispatch console
          </Link>
          <Link href="/history" className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/15">
            <History size={17} /> Full trip history
          </Link>
          <Link href="/request" className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/15">
            <Users size={17} /> Passenger requests
          </Link>
          <Link href="/track" className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/15">
            <Activity size={17} /> Live tracking
          </Link>
        </div>
      </section>

      {error && <div role="alert" className="mt-5 rounded-2xl border border-coral/30 bg-coral/10 px-4 py-3 text-sm text-ink">{error}</div>}

      <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Fleet summary">
        <div className={tileStyle}>
          <div className="flex items-center justify-between text-ink-500"><span className="text-sm font-semibold">Vehicle status</span><Car size={18} /></div>
          <div className="mt-4 flex items-center gap-3"><span className="font-display text-2xl text-ink">Toto #1</span>{overview && <StatusPill status={overview.vehicle.status} />}</div>
          <p className="mt-2 text-xs text-ink-500">{overview?.vehicle.currentTripId ? `Active trip ${overview.vehicle.currentTripId}` : overview?.vehicle.currentRequestId ? `Held for ${overview.vehicle.currentRequestId}` : "No active trip or reservation"}</p>
        </div>
        <MetricTile icon={Users} label="Registered people" value={overview?.counts.users} detail={overview ? `${overview.counts.students} students · ${overview.counts.employees} employees · ${overview.counts.riders} riders` : "Loading accounts"} />
        <MetricTile icon={Clock3} label="Waiting requests" value={overview?.counts.pending} detail={overview ? `${overview.counts.clashes} time clashes · ${overview.counts.requests} total requests` : "Loading requests"} />
        <MetricTile icon={Activity} label="Completed trips" value={overview?.counts.completedTrips} detail={overview ? `${overview.counts.admins} admin account${overview.counts.admins === 1 ? "" : "s"} · ${overview.counts.disabled} disabled` : "Loading trips"} />
      </section>

      <section className="mt-6 grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <div className={tileStyle}>
          <div className="flex items-center justify-between gap-3">
            <div><h3 className="font-display text-xl text-ink">People and access</h3><p className="mt-1 text-xs text-ink-500">Edit identity and role, reset passwords, or disable and restore sign-in.</p></div>
            <span className="rounded-full bg-sun-100 px-3 py-1 text-xs font-bold text-[#8A5B00]">{overview?.users.length ?? "—"} accounts</span>
          </div>
          <form onSubmit={createAccount} className="mt-4 rounded-2xl bg-[#FFF9EE] p-4">
            <h4 className="text-sm font-bold text-ink">Create an account</h4>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <input required minLength={2} maxLength={100} value={accountForm.name} onChange={(event) => setAccountForm((form) => ({ ...form, name: event.target.value }))} placeholder="Full name" aria-label="Full name" className="min-w-0 rounded-xl border border-[#E7D9C1] bg-white px-3 py-2.5 text-sm text-ink outline-none focus:border-sun" />
              <input required type="email" value={accountForm.email} onChange={(event) => setAccountForm((form) => ({ ...form, email: event.target.value }))} placeholder="Email address" aria-label="Email address" className="min-w-0 rounded-xl border border-[#E7D9C1] bg-white px-3 py-2.5 text-sm text-ink outline-none focus:border-sun" />
              <input required minLength={12} maxLength={128} type="password" value={accountForm.password} onChange={(event) => setAccountForm((form) => ({ ...form, password: event.target.value }))} placeholder="Initial password (12+ chars)" aria-label="Initial password" className="min-w-0 rounded-xl border border-[#E7D9C1] bg-white px-3 py-2.5 text-sm text-ink outline-none focus:border-sun" />
              <select value={accountForm.role} onChange={(event) => setAccountForm((form) => ({ ...form, role: event.target.value }))} aria-label="Account role" className="rounded-xl border border-[#E7D9C1] bg-white px-3 py-2.5 text-sm text-ink outline-none focus:border-sun">
                <option value="student">Student</option><option value="employee">Employee</option><option value="rider">Rider</option><option value="admin">Admin</option>
              </select>
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <p aria-live="polite" className={`text-xs ${accountMessage.toLowerCase().startsWith("created") ? "text-emerald-700" : "text-coral"}`}>{accountMessage}</p>
              <button type="submit" disabled={accountSaving} className="rounded-xl bg-ink px-4 py-2.5 text-xs font-bold text-white transition hover:bg-ink-700 disabled:opacity-50">{accountSaving ? "Creating…" : "Create account"}</button>
            </div>
          </form>
          <label className="mt-4 flex items-center gap-2 rounded-xl border border-[#E7D9C1] bg-white px-3 py-2.5 text-ink-500">
            <Search size={16} />
            <input value={userSearch} onChange={(event) => setUserSearch(event.target.value)} placeholder="Search by name, email, role, or access status" aria-label="Search accounts" className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink-500/70" />
          </label>
          <div className="mt-3 max-h-[660px] space-y-2 overflow-y-auto pr-1">
            {visibleUsers.map((user) => {
              const isEditing = editingId === user.id;
              return (
                <article key={user.id} className={`rounded-2xl border p-3.5 ${user.isDisabled ? "border-amber-200 bg-amber-50/60" : "border-[#F0E6D5] bg-white"}`}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="truncate text-sm font-semibold text-ink">{user.name}</span>
                        {user.id === adminId && <span className="rounded-full bg-ink px-2 py-0.5 text-[9px] font-bold uppercase text-sun">You</span>}
                        {user.isDisabled && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[9px] font-bold uppercase text-amber-800">Sign-in disabled</span>}
                      </div>
                      <div className="mt-1 truncate text-xs text-ink-500">{user.email}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${user.role === "admin" ? "bg-ink text-sun" : "bg-[#F3EEE4] text-ink-600"}`}>{user.role}</span>
                      <button type="button" onClick={() => { if (isEditing) { setEditingId(null); setResetPassword(""); setManageMessage(""); } else beginEditing(user); }} className="inline-flex items-center gap-1.5 rounded-lg border border-[#E7D9C1] bg-white px-2.5 py-2 text-xs font-semibold text-ink transition hover:bg-[#FFF9EE]">
                        {isEditing ? "Close" : <><UserCog size={14} /> Manage</>}
                      </button>
                    </div>
                  </div>
                  {isEditing && (
                    <div className="mt-4 space-y-3 border-t border-[#E7D9C1] pt-4">
                      <form onSubmit={updateAccount} className="grid gap-2 sm:grid-cols-2">
                        <input required minLength={2} maxLength={100} value={editForm.name} onChange={(event) => setEditForm((form) => ({ ...form, name: event.target.value }))} aria-label={`Name for ${user.email}`} placeholder="Full name" className="min-w-0 rounded-xl border border-[#E7D9C1] bg-white px-3 py-2.5 text-sm text-ink outline-none focus:border-sun" />
                        <input required type="email" value={editForm.email} onChange={(event) => setEditForm((form) => ({ ...form, email: event.target.value }))} aria-label={`Email for ${user.email}`} placeholder="Email address" className="min-w-0 rounded-xl border border-[#E7D9C1] bg-white px-3 py-2.5 text-sm text-ink outline-none focus:border-sun" />
                        <select value={editForm.role} disabled={user.id === adminId} onChange={(event) => setEditForm((form) => ({ ...form, role: event.target.value as AdminAccount["role"] }))} aria-label={`Role for ${user.email}`} className="rounded-xl border border-[#E7D9C1] bg-white px-3 py-2.5 text-sm text-ink outline-none focus:border-sun disabled:cursor-not-allowed disabled:bg-[#F3EEE4]">
                          <option value="student">Student</option><option value="employee">Employee</option><option value="rider">Rider</option><option value="admin">Admin</option>
                        </select>
                        <button type="submit" disabled={manageSaving} className="inline-flex items-center justify-center gap-2 rounded-xl bg-ink px-3 py-2.5 text-sm font-bold text-white transition hover:bg-ink-700 disabled:opacity-50"><UserCog size={15} /> Save profile and role</button>
                      </form>
                      <form onSubmit={changePassword} className="flex flex-wrap items-end gap-2 rounded-xl bg-[#FFF9EE] p-3">
                        <label className="min-w-[220px] flex-1 text-xs font-semibold text-ink-600">Set a new password
                          <input required minLength={12} maxLength={128} type="password" value={resetPassword} onChange={(event) => setResetPassword(event.target.value)} placeholder="At least 12 characters" autoComplete="new-password" className="mt-1.5 w-full rounded-xl border border-[#E7D9C1] bg-white px-3 py-2.5 text-sm text-ink outline-none focus:border-sun" />
                        </label>
                        <button type="submit" disabled={manageSaving} className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#D8C7A8] bg-white px-3 py-2.5 text-sm font-bold text-ink transition hover:bg-[#F3EEE4] disabled:opacity-50"><KeyRound size={15} /> Reset password</button>
                      </form>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p aria-live="polite" className={`min-h-5 text-xs ${manageMessageError ? "text-coral" : "text-teal-700"}`}>{manageMessage}</p>
                        <button type="button" disabled={manageSaving || user.id === adminId} onClick={() => void toggleAccountAccess(user)} className="inline-flex items-center gap-1.5 rounded-xl border border-[#E7D9C1] bg-white px-3 py-2 text-xs font-bold text-ink transition hover:bg-[#FFF9EE] disabled:cursor-not-allowed disabled:opacity-40" title={user.id === adminId ? "You cannot disable your own administrator account" : undefined}>
                          {user.isDisabled ? <><UserCheck size={14} /> Restore sign-in</> : <><UserRoundX size={14} /> Disable sign-in</>}
                        </button>
                      </div>
                    </div>
                  )}
                </article>
              );
            })}
            {!loading && visibleUsers.length === 0 && <p className="py-6 text-sm text-ink-500">{overview?.users.length ? "No accounts match this search." : "No accounts have been registered yet."}</p>}
            {loading && <p className="py-6 text-sm text-ink-500">Loading account directory…</p>}
          </div>
        </div>

        <div className={tileStyle}>
          <div className="flex items-center justify-between gap-3"><div><h3 className="font-display text-xl text-ink">Latest ride requests</h3><p className="mt-1 text-xs text-ink-500">Recent activity across all roles</p></div><Link href="/rider" className="text-xs font-bold text-[#8A5B00] hover:underline">Open queue</Link></div>
          <div className="mt-4 space-y-3">
            {overview?.recentRequests.map((request) => (
              <div key={request.id} className="rounded-2xl bg-[#FFF9EE] p-3.5">
                <div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="text-sm font-bold text-ink">{request.from} → {request.to}</div><div className="mt-1 truncate text-xs text-ink-500">{request.filerName} · {request.time} · {request.seats} seat{request.seats === 1 ? "" : "s"}</div></div><span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-[10px] font-bold uppercase text-ink-600">{request.status}</span></div>
              </div>
            ))}
            {!loading && overview?.recentRequests.length === 0 && <p className="py-6 text-sm text-ink-500">No ride requests yet.</p>}
            {loading && <p className="py-6 text-sm text-ink-500">Loading ride activity…</p>}
          </div>
        </div>
      </section>
    </div>
  );
}

function MetricTile({ icon: Icon, label, value, detail }: { icon: LucideIcon; label: string; value?: number; detail: string }) {
  return (
    <div className={tileStyle}>
      <div className="flex items-center justify-between text-ink-500"><span className="text-sm font-semibold">{label}</span><Icon size={18} /></div>
      <div className="mt-4 font-display text-3xl text-ink">{value ?? "—"}</div>
      <p className="mt-2 text-xs leading-5 text-ink-500">{detail}</p>
    </div>
  );
}
