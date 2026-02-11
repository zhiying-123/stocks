// H-Stocks Investment Platform Routes Configuration
export interface InvestmentRouteConfig {
    path: string;
    label: string;
    icon: string;
    description?: string;
}

// Investment Platform Navigation Routes (only existing pages)
export const investmentRoutes: InvestmentRouteConfig[] = [
    {
        path: "/h_stocks/stocks",
        label: "Stock Market",
        icon: "💹",
        description: "Browse and trade stocks"
    },
    {
        path: "/h_stocks",
        label: "Overview",
        icon: "📊",
        description: "Market overview and quick stats"
    },
    {
        path: "/h_stocks/my-stocks",
        label: "My Stocks",
        icon: "📦",
        description: "View your purchased stocks"
    },
    {
        path: "/h_stocks/wallet",
        label: "Wallet",
        icon: "💰",
        description: "Manage your cash balance"
    },
];

export const investmentRouteConfig: Record<string, InvestmentRouteConfig> = investmentRoutes.reduce((acc, route) => {
    acc[route.path] = route;
    return acc;
}, {} as Record<string, InvestmentRouteConfig>);
