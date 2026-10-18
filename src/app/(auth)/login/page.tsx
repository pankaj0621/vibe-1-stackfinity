"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Car,
  Lock,
  Mail,
  GraduationCap,
  Briefcase,
  User as UserIcon,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { SessionUser } from "@/types/domain.types";
import { fetchApi, getApiErrorMessage } from "@/lib/api/client";
import { getRoleHome } from "@/lib/auth/role-home";

export default function LoginPage() {
  const router = useRouter();
  const { showToast } = useToast();

  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [regRole, setRegRole] = useState<"student" | "employee">("student");

  const [loading, setLoading] = useState(false);
  const authAttemptStarted = useRef(false);

  useEffect(() => {
    const requestedMode = new URLSearchParams(window.location.search).get("mode");
    if (requestedMode === "signup") setAuthMode("register");

    let isCurrent = true;
    void fetchApi<SessionUser | null>("/api/auth/me", { cache: "no-store" }, "check your session")
      .then((json) => {
        if (isCurrent && !authAttemptStarted.current && json.data) {
          router.replace(getRoleHome(json.data.role));
        }
      })
      .catch((error) => {
        if (isCurrent && !authAttemptStarted.current) {
          showToast({ title: "Session Check Failed", message: getApiErrorMessage(error, "Could not check your sign-in status."), tone: "coral" });
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [router, showToast]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    authAttemptStarted.current = true;
    setLoading(true);

    try {
      const data = await fetchApi<SessionUser>("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          password,
        }),
      }, "sign in");
      if (data.success && data.data) {
        showToast({
          title: "Signed In",
          message: `Welcome, ${data.data.name}! Verified role: ${data.data.role.toUpperCase()}`,
          tone: "teal",
        });
        router.replace(getRoleHome(data.data.role));
      }
    } catch (error) {
      showToast({
        title: "Login Failed",
        message: getApiErrorMessage(error, "Could not sign in. Please try again."),
        tone: "coral",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    authAttemptStarted.current = true;
    setLoading(true);

    try {
      const data = await fetchApi<SessionUser>("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          password,
          role: regRole,
        }),
      }, "create your account");
      if (data.success && data.data) {
        showToast({
          title: "Account Created",
          message: `Welcome to Lawazia, ${data.data.name}! You are registered as ${data.data.role.toUpperCase()}.`,
          tone: "teal",
        });
        router.replace(getRoleHome(data.data.role));
      }
    } catch (error) {
      showToast({
        title: "Registration Failed",
        message: getApiErrorMessage(error, "Could not create the account. Please try again."),
        tone: "coral",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <Link href="/" className="inline-flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-ink text-sun shadow-soft">
              <Car size={24} />
            </div>
            <div className="text-left">
              <div className="font-display text-[22px] leading-none text-ink">Lawazia</div>
              <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-ink-500">
                Campus Transit
              </div>
            </div>
          </Link>
          <h2 className="mt-6 font-display text-[28px] text-ink">Campus Mobility Access</h2>
          <p className="mt-2 text-[13px] text-ink-600">
            Secure authentication for Students, Employees, and Authorized Riders.
          </p>
        </div>

          <Card className="p-6 sm:p-8">
            {/* Auth Mode Toggle */}
            <div className="mb-5 flex rounded-xl bg-ink-100 p-1">
              <button
                type="button"
                onClick={() => setAuthMode("login")}
                className={`flex-1 rounded-lg py-1.5 text-center text-[12px] font-semibold transition ${
                  authMode === "login"
                    ? "bg-white text-ink shadow-sm"
                    : "text-ink-600 hover:text-ink"
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => setAuthMode("register")}
                className={`flex-1 rounded-lg py-1.5 text-center text-[12px] font-semibold transition ${
                  authMode === "register"
                    ? "bg-white text-ink shadow-sm"
                    : "text-ink-600 hover:text-ink"
                }`}
              >
                Register
              </button>
            </div>

            {authMode === "login" ? (
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-600">
                    <Mail size={13} /> Email Address
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@campus.edu"
                    className="field"
                    required
                  />
                </div>

                <div>
                  <label className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-600">
                    <Lock size={13} /> Password
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="field"
                    required
                  />
                </div>

                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  className="mt-2 w-full"
                  loading={loading}
                >
                  Sign In
                </Button>
              </form>
            ) : (
              <form onSubmit={handleRegister} className="space-y-4">
                <div>
                  <label className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-600">
                    <UserIcon size={13} /> Full Name
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Ananya Sharma"
                    className="field"
                    required
                  />
                </div>

                <div>
                  <label className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-600">
                    <Mail size={13} /> Campus Email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="ananya@student.campus"
                    className="field"
                    required
                  />
                </div>

                <div>
                  <label className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-600">
                    <Lock size={13} /> Password
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    className="field"
                    minLength={6}
                    required
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-ink-600">
                    Account Role
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setRegRole("student")}
                      className={`flex items-center justify-center gap-2 rounded-xl border p-2.5 text-[12px] font-semibold transition ${
                        regRole === "student"
                          ? "border-teal bg-teal-50 text-teal"
                          : "border-[#E5D5BA] bg-white text-ink-600 hover:border-sun"
                      }`}
                    >
                      <GraduationCap size={16} /> Student
                    </button>
                    <button
                      type="button"
                      onClick={() => setRegRole("employee")}
                      className={`flex items-center justify-center gap-2 rounded-xl border p-2.5 text-[12px] font-semibold transition ${
                        regRole === "employee"
                          ? "border-grape bg-[#5E2B97]/10 text-grape"
                          : "border-[#E5D5BA] bg-white text-ink-600 hover:border-sun"
                      }`}
                    >
                      <Briefcase size={16} /> Employee
                    </button>
                  </div>
                </div>

                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  className="mt-2 w-full"
                  loading={loading}
                >
                  Create Account
                </Button>
              </form>
            )}
          </Card>

      </div>
    </div>
  );
}
