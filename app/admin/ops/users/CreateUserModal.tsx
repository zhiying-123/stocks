"use client";

import { useEffect, useState } from "react";

type CreateUserModalProps = {
  loginEmail: string;
  action: (formData: FormData) => void | Promise<void>;
};

export default function CreateUserModal({ loginEmail, action }: CreateUserModalProps) {
  const [open, setOpen] = useState(false);
  const [notifyTarget, setNotifyTarget] = useState<"login" | "custom">("login");

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-medium text-emerald-700 transition hover:bg-emerald-100"
      >
        Create User
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/35 p-4 backdrop-blur-sm">
          <div className="w-full max-w-3xl rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Create User</h3>
                <p className="mt-1 text-sm text-slate-600">Create account, then send account details by email.</p>
              </div>

              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 transition hover:bg-slate-50"
              >
                Close
              </button>
            </div>

            <form action={action} className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Name</label>
                <input
                  type="text"
                  name="name"
                  placeholder="User full name"
                  required
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-slate-400"
                />
              </div>

              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">User Email</label>
                <input
                  type="email"
                  name="userEmail"
                  placeholder="new.user@example.com"
                  required
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-slate-400"
                />
              </div>

              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Password</label>
                <input
                  type="text"
                  name="password"
                  placeholder="At least 6 characters"
                  required
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-slate-400"
                />
              </div>

              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Notification Email Target</label>
                <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="notifyTarget"
                      value="login"
                      checked={notifyTarget === "login"}
                      onChange={() => setNotifyTarget("login")}
                    />
                    Send to login Gmail: <span className="font-medium">{loginEmail || "(not found)"}</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="notifyTarget"
                      value="custom"
                      checked={notifyTarget === "custom"}
                      onChange={() => setNotifyTarget("custom")}
                    />
                    Send to custom email
                  </label>
                  <input
                    type="email"
                    name="customNotifyEmail"
                    placeholder="custom.receiver@gmail.com"
                    disabled={notifyTarget !== "custom"}
                    required={notifyTarget === "custom"}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-slate-400 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Role</label>
                <select
                  name="role"
                  defaultValue="member"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-slate-400"
                >
                  <option value="member">Member</option>
                  <option value="staff">Staff</option>
                </select>
              </div>

              <div className="flex items-end gap-2">
                <button
                  type="submit"
                  className="inline-flex items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-medium text-emerald-700 transition hover:bg-emerald-100"
                >
                  Create User + Send Email
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
