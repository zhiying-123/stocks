"use client";

import { useEffect, useState } from "react";

type EditUserModalProps = {
  userId: number;
  defaultName: string;
  defaultEmail: string;
  defaultRole: string;
  returnPath: string;
  action: (formData: FormData) => void | Promise<void>;
};

export default function EditUserModal({
  userId,
  defaultName,
  defaultEmail,
  defaultRole,
  returnPath,
  action,
}: EditUserModalProps) {
  const [open, setOpen] = useState(false);

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
        className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 transition hover:bg-emerald-100"
      >
        Edit Details
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/35 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Edit User</h3>
                <p className="mt-1 text-sm text-slate-600">Update user profile details.</p>
              </div>

              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 transition hover:bg-slate-50"
              >
                Close
              </button>
            </div>

            <form action={action} className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <input type="hidden" name="userId" value={userId} />
              <input type="hidden" name="returnPath" value={returnPath} />

              <div className="md:col-span-2">
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Name</label>
                <input
                  type="text"
                  name="name"
                  defaultValue={defaultName}
                  required
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-slate-400"
                />
              </div>

              <div className="md:col-span-2">
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Email</label>
                <input
                  type="email"
                  name="email"
                  defaultValue={defaultEmail}
                  required
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-slate-400"
                />
              </div>

              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Role</label>
                <select
                  name="role"
                  defaultValue={defaultRole}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-slate-400"
                >
                  <option value="member">Member</option>
                  <option value="staff">Staff</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              <div className="flex items-end justify-end">
                <button
                  type="submit"
                  className="inline-flex items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-medium text-emerald-700 transition hover:bg-emerald-100"
                >
                  Save Details
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
