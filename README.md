This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Quick Login

Use the multi-account quick login page:

- `/login/quick`

Before using it, prepare quick login users:

```bash
npm run quick:setup-users
```

This command creates:

- a pooled `New User` template set (`quick.new.1` to `quick.new.20` by default)
- a pooled `Intermediate User` template set (`quick.intermediate.1` to `quick.intermediate.20` by default)

Quick login behavior:

- one-click login rotates through the pool templates (round-robin style)
- each click creates a separate temporary account and signs in with that account
- users do not share watchlist/portfolio state with each other

Optional environment variables:

- `QUICK_LOGIN_USER_PASSWORD`
- `QUICK_LOGIN_POLYMARKET_IDS` (comma-separated market condition IDs fallback)
- `QUICK_LOGIN_POOL_SIZE` (default: 20)
- `QUICK_LOGIN_EMAIL_DOMAIN` (default: `hstocks.local`)

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
