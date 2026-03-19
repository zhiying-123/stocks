// Platform Routes Configuration
export interface RouteConfig {
    path: string;
    label: string;
    icon: string;
    description?: string;
}

// Stocks Module Routes
export const stocksRoutes: RouteConfig[] = [
    {
        path: "/h_stocks",
        label: "Overview",
        icon: "📊",
        description: "Market overview"
    },
    {
        path: "/h_stocks/stocks",
        label: "Stock Market",
        icon: "💹",
        description: "Browse and trade stocks"
    },
    {
        path: "/h_stocks/my-stocks",
        label: "My Stocks",
        icon: "💼",
        description: "View your purchased stocks"
    },
    {
        path: "/h_stocks/portfolio",
        label: "Portfolio",
        icon: "📈",
        description: "Analyze performance"
    }
];

// Polymarket Module Routes
export const polymarketRoutes: RouteConfig[] = [
    {
        path: "/polymarket/overview",
        label: "Overview",
        icon: "📊",
        description: "Portfolio overview"
    },
    {
        path: "/polymarket",
        label: "Markets",
        icon: "🎯",
        description: "Browse prediction markets"
    },
    {
        path: "/polymarket/my-positions",
        label: "My Positions",
        icon: "📋",
        description: "View your positions"
    },
    {
        path: "/polymarket/analytics",
        label: "Analytics",
        icon: "📊",
        description: "Market analytics"
    }
];

// Shared Routes
export const sharedRoutes: RouteConfig[] = [
    {
        path: "/wallet",
        label: "Wallet",
        icon: "💳",
        description: "Manage your balance"
    },
    {
        path: "/alerts",
        label: "Alerts",
        icon: "🔔",
        description: "Manage reminders"
    },
    {
        path: "/profile",
        label: "Profile",
        icon: "👤",
        description: "Your account settings"
    }
];

export interface ModuleConfig {
    key: string;
    label: string;
    icon: string;
    routes: RouteConfig[];
}

export const modules: ModuleConfig[] = [
    {
        key: "stocks",
        label: "Stocks",
        icon: "📈",
        routes: stocksRoutes
    },
    {
        key: "polymarket",
        label: "Polymarket",
        icon: "🎲",
        routes: polymarketRoutes
    }
];
