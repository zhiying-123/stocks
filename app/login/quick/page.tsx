import Link from "next/link";
import { loginAsQuickUser } from "./actions";

type PageProps = {
  searchParams?: Promise<{ error?: string }>;
};

function errorText(error?: string) {
  if (!error) return "";
  if (error === "missing-user") {
    return "Quick login users are not ready yet. Run: npm run quick:setup-users";
  }
  if (error === "invalid-user-type") {
    return "Invalid quick login option.";
  }
  if (error === "server-error") {
    return "Quick login failed on server. Check Vercel logs and ensure DATABASE_URL and quick users are configured in production.";
  }
  return "Unable to sign in with quick login.";
}

export default async function QuickLoginPage({ searchParams }: PageProps) {
  const params = searchParams ? await searchParams : {};
  const message = errorText(params?.error);
  const emailDomain = (process.env.QUICK_LOGIN_EMAIL_DOMAIN || "hstocks.local").toLowerCase();
  const poolSize = Number(process.env.QUICK_LOGIN_POOL_SIZE || 20);
  const defaultPassword = process.env.QUICK_LOGIN_USER_PASSWORD || "quick12345";

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8f9fb]">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-100 rounded-full blur-3xl opacity-20" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-emerald-100 rounded-full blur-3xl opacity-20" />
      </div>

      <div className="relative w-full max-w-md mx-4">
        <Link
          href="/login"
          className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 mb-6 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          <span>Back to Sign In</span>
        </Link>

        <div className="bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden">
          <div className="bg-linear-to-br from-gray-900 via-gray-800 to-gray-900 px-8 py-8">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-lg bg-white/10 backdrop-blur-sm flex items-center justify-center">
                <span className="text-white font-bold text-sm">H</span>
              </div>
              <h1 className="text-2xl font-bold text-white tracking-tight">Quick Login</h1>
            </div>
            <p className="text-sm text-gray-300">Choose an account profile and sign in instantly</p>
          </div>

          <div className="p-8 space-y-4">
            {message && (
              <div className="mb-6 flex items-center gap-2 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl">
                <p className="text-sm text-amber-700">{message}</p>
              </div>
            )}

            <p className="text-xs text-gray-500 px-1">
              One-click login creates a temporary isolated account from a rotating pool template.
            </p>

            <form action={loginAsQuickUser}>
              <input type="hidden" name="userType" value="new" />
              <button
                type="submit"
                className="w-full rounded-xl border border-gray-200 px-4 py-4 text-left hover:bg-gray-50 hover:border-gray-300 transition-all"
              >
                <p className="text-lg font-bold text-gray-900">New User</p>
                <p className="mt-1 text-sm text-gray-500">Zero watchlist and fresh starting state</p>
              </button>
            </form>

            <form action={loginAsQuickUser}>
              <input type="hidden" name="userType" value="intermediate" />
              <button
                type="submit"
                className="w-full rounded-xl border border-gray-200 px-4 py-4 text-left hover:bg-gray-50 hover:border-gray-300 transition-all"
              >
                <p className="text-lg font-bold text-gray-900">Intermediate User</p>
                <p className="mt-1 text-sm text-gray-500">Preloaded stock and polymarket watchlists</p>
              </button>
            </form>

            <details className="rounded-xl border border-gray-200 bg-gray-50 p-4">
              <summary className="cursor-pointer text-sm font-semibold text-gray-800">
                Show pool account pattern for normal sign in
              </summary>
              <div className="mt-3 space-y-2 text-sm text-gray-700">
                <p>New pool: <span className="font-medium">quick.new.1 ... quick.new.{poolSize}@{emailDomain}</span></p>
                <p>Intermediate pool: <span className="font-medium">quick.intermediate.1 ... quick.intermediate.{poolSize}@{emailDomain}</span></p>
                <p>Default password: <span className="font-medium">{defaultPassword}</span></p>
              </div>
            </details>
          </div>
        </div>
      </div>
    </div>
  );
}
