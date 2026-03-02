// H-Stocks Investment Platform Routes Configuration
export interface InvestmentRouteConfig {
    path: string;
    label: string;
    icon: string;
    description?: string;
    color?: string;
    gradient?: string;
}

// Investment Platform Navigation Routes (only existing pages)
export const investmentRoutes: InvestmentRouteConfig[] = [
    {
        path: "/h_stocks",
        label: "Overview",
        icon: "📊",
        description: "Market overview and quick stats",
        color: "blue",
        gradient: "from-blue-500 to-cyan-500"
    },
    {
        path: "/h_stocks/stocks",
        label: "Stock Market",
        icon: "💹",
        description: "Browse and trade stocks",
        color: "green",
        gradient: "from-green-500 to-emerald-500"
    },
    {
        path: "/h_stocks/my-stocks",
        label: "My Stocks",
        icon: "📦",
        description: "View your purchased stocks",
        color: "purple",
        gradient: "from-purple-500 to-pink-500"
    },
    {
        path: "/h_stocks/portfolio",
        label: "Portfolio",
        icon: "📈",
        description: "Analyze your investment performance",
        color: "indigo",
        gradient: "from-indigo-500 to-purple-500"
    },
    {
        path: "/h_stocks/alerts",
        label: "Price Alerts",
        icon: "🔔",
        description: "Manage price notifications",
        color: "orange",
        gradient: "from-orange-500 to-red-500"
    },
    {
        path: "/h_stocks/wallet",
        label: "Wallet",
        icon: "💰",
        description: "Manage your cash balance",
        color: "amber",
        gradient: "from-amber-500 to-orange-500"
    },
];

export const investmentRouteConfig: Record<string, InvestmentRouteConfig> = investmentRoutes.reduce((acc, route) => {
    acc[route.path] = route;
    return acc;
}, {} as Record<string, InvestmentRouteConfig>);
