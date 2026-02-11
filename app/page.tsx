// H-Stocks Investment Platform - Home Page
import Link from "next/link";
import { cookies } from "next/headers";
import { stockRoutes } from "./routes";
import LoginLink from "./components/LoginLink";
import LogoutButton from "./logout/LogoutButton";

export const dynamic = 'force-dynamic';

// ==================== Get User Info ====================
async function getUserInfo() {
  const cookieStore = await cookies();
  const isLoggedIn = cookieStore.get("auth")?.value === "true";
  const userCookie = cookieStore.get("user")?.value;
  const user = userCookie ? JSON.parse(userCookie) : null;
  return { isLoggedIn, user };
}

// ==================== Home Page ====================
export default async function HomePage() {
  const { isLoggedIn, user } = await getUserInfo();

  return (
    <div className="min-h-screen bg-[#f8f9fb]">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white border-b border-gray-200/60 shadow-sm">
        <div className="max-w-7xl mx-auto px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-gray-900 flex items-center justify-center shadow-md">
                <span className="text-white font-bold text-lg">H</span>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 tracking-tight">H-Stocks</h1>
                <p className="text-xs text-gray-500 font-medium">Investment Platform</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              {isLoggedIn ? (
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-3 px-4 py-2 rounded-full bg-gray-50 border border-gray-200">
                    <span className="text-sm font-medium text-gray-600">{user?.name || user?.email}</span>
                    <div className="w-8 h-8 rounded-full bg-gray-900 flex items-center justify-center text-white text-xs font-bold">
                      {(user?.name || user?.email || 'U').charAt(0).toUpperCase()}
                    </div>
                  </div>
                  <LogoutButton />
                </div>
              ) : (
                <LoginLink />
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Hero Banner */}
      <div className="relative bg-linear-to-br from-gray-900 via-gray-800 to-gray-900 border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-8 py-16 md:py-20">
          <div className="relative">
            {/* Decorative elements */}
            <div className="absolute top-0 right-0 w-80 h-80 bg-white/3 rounded-full -translate-y-1/2 translate-x-1/3 -z-10" />
            <div className="absolute bottom-0 left-1/3 w-60 h-60 bg-white/2 rounded-full translate-y-1/2 -z-10" />

            <div className="relative text-center">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 mb-6">
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-xs text-emerald-400 font-medium">Live Market Data</span>
              </div>

              <h2 className="text-4xl md:text-5xl font-bold text-white mb-4 tracking-tight">
                Welcome to H-Stocks
              </h2>
              <p className="text-lg text-gray-400 max-w-2xl mx-auto mb-8">
                Your gateway to intelligent stock trading and portfolio management.
                {isLoggedIn ? ' Start trading now!' : ' Login to start trading and manage your investments.'}
              </p>

              {!isLoggedIn && (
                <Link
                  href="/login"
                  className="inline-flex items-center gap-2 px-8 py-3.5 bg-white text-gray-900 text-sm font-semibold rounded-xl hover:bg-gray-100 transition-all shadow-lg"
                >
                  Get Started
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-8 py-12">
        {/* Features Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {stockRoutes.map((route) => {
            const isRestricted = route.requiresAuth && !isLoggedIn;

            return (
              <div key={route.path} className="relative group">
                <Link
                  href={isRestricted ? '/login' : route.path}
                  className={`block h-full ${isRestricted ? 'cursor-pointer' : ''}`}
                >
                  <div className={`
                                        bg-white rounded-2xl p-8 border border-gray-200 
                                        transition-all duration-300 h-full
                                        ${isRestricted
                      ? 'opacity-75 hover:opacity-90'
                      : 'hover:shadow-lg hover:border-gray-300 group-hover:-translate-y-1'
                    }
                                    `}>
                    {/* Icon */}
                    <div className={`
                                            w-16 h-16 rounded-xl flex items-center justify-center mb-5
                                            ${route.color === 'blue' && 'bg-blue-50'}
                                            ${route.color === 'green' && 'bg-green-50'}
                                            ${route.color === 'purple' && 'bg-purple-50'}
                                            ${route.color === 'amber' && 'bg-amber-50'}
                                            ${isRestricted && 'opacity-50'}
                                        `}>
                      <span className="text-3xl">{route.icon}</span>
                    </div>

                    {/* Content */}
                    <div className="mb-4">
                      <h3 className={`
                                                text-lg font-semibold mb-2
                                                ${route.color === 'blue' && 'text-blue-900'}
                                                ${route.color === 'green' && 'text-green-900'}
                                                ${route.color === 'purple' && 'text-purple-900'}
                                                ${route.color === 'amber' && 'text-amber-900'}
                                            `}>
                        {route.label}
                      </h3>
                      <p className="text-sm text-gray-600 leading-relaxed">
                        {route.description}
                      </p>
                    </div>

                    {/* Lock Badge for Restricted Routes */}
                    {isRestricted && (
                      <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 px-3 py-1.5 rounded-lg">
                        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                        </svg>
                        <span className="font-medium">Login Required</span>
                      </div>
                    )}

                    {/* Arrow Indicator */}
                    {!isRestricted && (
                      <div className="flex items-center gap-2 text-sm text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity">
                        <span>Explore</span>
                        <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    )}
                  </div>
                </Link>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
