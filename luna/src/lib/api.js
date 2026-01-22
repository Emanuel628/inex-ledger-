export const API_BASE =
  import.meta.env.VITE_API_URL ||
  "https://luna-finance-production.up.railway.app";

export const buildApiUrl = (path) => {
  if (typeof path !== "string") {
    return API_BASE;
  }

  if (path.startsWith("/")) {
    return `${API_BASE}${path}`;
  }

  return `${API_BASE}/${path}`;
};
