// H-Stocks Platform Routes Configuration
export interface RouteConfig {
    path: string;
    label: string;
    icon: string;
    description?: string;
    color?: string;
    requiresAuth?: boolean;
}

// Main Stock Platform Routes
export const stockRoutes: RouteConfig[] = [
    {
        path: "/h_stocks/stocks",
        label: "Stock Market",
        icon: "💹",
        description: "Browse stocks, check real-time prices, and explore investment opportunities",
        color: "green",
        requiresAuth: false
    },
    {
        path: "/h_stocks",
        label: "Market Overview",
        icon: "📊",
        description: "View market trends, portfolio summary, and watchlist at a glance",
        color: "blue",
        requiresAuth: true
    },

    {
        path: "/h_stocks/my-stocks",
        label: "My Portfolio",
        icon: "📦",
        description: "Manage your stock holdings, track performance, and sell shares",
        color: "purple",
        requiresAuth: true
    },
    {
        path: "/h_stocks/portfolio",
        label: "Portfolio Analytics",
        icon: "📈",
        description: "Detailed analysis of your investments with charts and risk metrics",
        color: "indigo",
        requiresAuth: true
    },
    {
        path: "/h_stocks/wallet",
        label: "Wallet",
        icon: "💰",
        description: "Check your balance, deposit funds, and manage transactions",
        color: "amber",
        requiresAuth: true
    }
];

// Route lookup for quick access
export const stockRouteConfig: Record<string, RouteConfig> = stockRoutes.reduce((acc, route) => {
    acc[route.path] = route;
    return acc;
}, {} as Record<string, RouteConfig>);

// Helper function to check if route requires authentication
export function requiresAuth(path: string): boolean {
    const route = stockRoutes.find(r => path.startsWith(r.path));
    return route?.requiresAuth ?? false;
}
