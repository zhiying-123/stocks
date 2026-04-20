// Trading Platform - Home Page
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

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
  const role = String(user?.role || "").toLowerCase();

  if (isLoggedIn && (role === "staff" || role === "admin")) {
    redirect("/admin/ops");
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 bg-linear-to-b from-gray-50 to-white -z-10" />
        <div className="absolute inset-0 bg-grid-pattern opacity-5 -z-10" />

        {/* Hero Content */}
        <div className="max-w-7xl mx-auto px-6 py-24 md:py-32">
          <div className="text-center">
            {/* Logo */}
            <div className="flex justify-center mb-8">
              <div className="text-7xl animate-bounce-slow">🐱</div>
            </div>

            {/* Heading */}
            <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6 tracking-tight">
              Trade Smarter,<br />
              Win Bigger
            </h1>

            <p className="text-xl text-gray-600 mb-12 max-w-2xl mx-auto">
              One unified platform for stock trading and prediction markets.
              <br />
              Powered by real-time data and advanced analytics.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              {isLoggedIn ? (
                <>
                  <Link
                    href="/h_stocks"
                    className="px-8 py-4 bg-gray-900 text-white font-semibold rounded-lg hover:bg-gray-800 transition-all shadow-lg hover:shadow-xl w-full sm:w-auto"
                  >
                    Go to Stocks
                  </Link>
                  <Link
                    href="/polymarket"
                    className="px-8 py-4 bg-white text-gray-900 font-semibold rounded-lg border-2 border-gray-900 hover:bg-gray-50 transition-all w-full sm:w-auto"
                  >
                    Go to Polymarket
                  </Link>
                </>
              ) : (
                <>
                  <Link
                    href="/login"
                    className="px-8 py-4 bg-gray-900 text-white font-semibold rounded-lg hover:bg-gray-800 transition-all shadow-lg hover:shadow-xl w-full sm:w-auto"
                  >
                    Get Started
                  </Link>
                  <Link
                    href="/login"
                    className="px-8 py-4 bg-white text-gray-900 font-semibold rounded-lg border-2 border-gray-900 hover:bg-gray-50 transition-all w-full sm:w-auto"
                  >
                    Sign In
                  </Link>
                </>
              )}
            </div>

            {/* Stats */}
            <div className="mt-20 grid grid-cols-3 gap-8 max-w-3xl mx-auto">
              <div className="text-center">
                <div className="text-3xl font-bold text-gray-900">5000+</div>
                <div className="text-sm text-gray-600 mt-1">Stocks</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-gray-900">Real-time</div>
                <div className="text-sm text-gray-600 mt-1">Data</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-gray-900">24/7</div>
                <div className="text-sm text-gray-600 mt-1">Trading</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Two Powerful Platforms, One Wallet
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Seamlessly trade across stocks and prediction markets with a unified balance
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {/* Stocks Module */}
            <div className="bg-white rounded-2xl p-8 border-2 border-gray-200 hover:border-gray-900 transition-all group">
              <div className="text-5xl mb-6">📈</div>
              <h3 className="text-2xl font-bold text-gray-900 mb-4">Stock Market</h3>
              <p className="text-gray-600 mb-6 leading-relaxed">
                Trade thousands of stocks with real-time quotes, advanced analytics,
                and portfolio tracking. Monitor your investments with price alerts
                and comprehensive performance metrics.
              </p>
              <ul className="space-y-3 mb-8">
                <li className="flex items-center gap-3 text-sm text-gray-700">
                  <span className="text-lg">✓</span>
                  <span>Real-time stock prices</span>
                </li>
                <li className="flex items-center gap-3 text-sm text-gray-700">
                  <span className="text-lg">✓</span>
                  <span>Portfolio analytics</span>
                </li>
                <li className="flex items-center gap-3 text-sm text-gray-700">
                  <span className="text-lg">✓</span>
                  <span>Price alerts & notifications</span>
                </li>
                <li className="flex items-center gap-3 text-sm text-gray-700">
                  <span className="text-lg">✓</span>
                  <span>Performance tracking</span>
                </li>
              </ul>
            </div>

            {/* Polymarket Module */}
            <div className="bg-white rounded-2xl p-8 border-2 border-gray-200 hover:border-gray-900 transition-all group">
              <div className="text-5xl mb-6">🎲</div>
              <h3 className="text-2xl font-bold text-gray-900 mb-4">Prediction Markets</h3>
              <p className="text-gray-600 mb-6 leading-relaxed">
                Trade on real-world events and earn profits from your predictions.
                Access diverse markets covering politics, sports, crypto, and more.
                Make informed decisions with comprehensive market analytics.
              </p>
              <ul className="space-y-3 mb-8">
                <li className="flex items-center gap-3 text-sm text-gray-700">
                  <span className="text-lg">✓</span>
                  <span>Diverse prediction markets</span>
                </li>
                <li className="flex items-center gap-3 text-sm text-gray-700">
                  <span className="text-lg">✓</span>
                  <span>Real-time odds tracking</span>
                </li>
                <li className="flex items-center gap-3 text-sm text-gray-700">
                  <span className="text-lg">✓</span>
                  <span>Position management</span>
                </li>
                <li className="flex items-center gap-3 text-sm text-gray-700">
                  <span className="text-lg">✓</span>
                  <span>Market analytics</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* How It Works */}
      <div className="py-24">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              How It Works
            </h2>
            <p className="text-lg text-gray-600">
              Get started in minutes
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 bg-gray-900 rounded-full flex items-center justify-center text-white text-xl font-bold">
                1
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Create Account</h3>
              <p className="text-gray-600 text-sm">
                Sign up with your email and verify your account
              </p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 bg-gray-900 rounded-full flex items-center justify-center text-white text-xl font-bold">
                2
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Fund Wallet</h3>
              <p className="text-gray-600 text-sm">
                Add funds to your unified wallet for trading
              </p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 bg-gray-900 rounded-full flex items-center justify-center text-white text-xl font-bold">
                3
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Start Trading</h3>
              <p className="text-gray-600 text-sm">
                Trade stocks and predictions with ease
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="py-24 bg-gray-900 text-white">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">
            Ready to Start Trading?
          </h2>
          <p className="text-lg text-gray-300 mb-8">
            Join thousands of traders who trust our platform
          </p>
          <Link
            href="/login"
            className="inline-block px-8 py-4 bg-white text-gray-900 font-semibold rounded-lg hover:bg-gray-100 transition-all shadow-lg"
          >
            Get Started Now
          </Link>
        </div>
      </div>

      {/* Footer */}
      <div className="py-12 border-t border-gray-200">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="text-2xl">🐱</span>
              <span className="font-bold text-gray-900">Trading Platform</span>
            </div>
            <p className="text-sm text-gray-600">
              © 2026 Trading Platform. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
