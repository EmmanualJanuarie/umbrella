/**
 * Portfolio mode intentionally has no live API dependency. It is enabled at
 * build time so a public demo cannot accidentally attempt to use production
 * sessions, customer data, object storage, or credentials.
 */
export const isPortfolioDemo = import.meta.env.VITE_PORTFOLIO_DEMO === "true";
