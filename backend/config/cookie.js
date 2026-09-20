export const ACCESS_TOKEN_MAX_AGE = 15 * 60 * 1000;
export const REFRESH_TOKEN_MAX_AGE = 7 * 24 * 60 * 60 * 1000;
export const getCookieOptions = (maxAge) => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
  path: "/",
  ...(maxAge ? { maxAge } : {}),
});
export function setAuthCookies(res, { accessToken, refreshToken }) {
  if (refreshToken) res.cookie("refreshToken", refreshToken, getCookieOptions(REFRESH_TOKEN_MAX_AGE));
  res.cookie("accessToken", accessToken, getCookieOptions(ACCESS_TOKEN_MAX_AGE));
}
export function clearAuthCookies(res) {
  for (const name of ["accessToken", "refreshToken"]) res.clearCookie(name, getCookieOptions());
}
