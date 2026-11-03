const base64Url = (value: object) => btoa(JSON.stringify(value)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

/** An access token (unsigned: nothing in the browser checks the signature) that runs out `seconds` from now. */
export function tokenExpiringIn(seconds: number, subject = "1"): string {
  const expires = Math.floor(Date.now() / 1000) + seconds;
  return `${base64Url({ alg: "HS256", typ: "JWT" })}.${base64Url({ sub: subject, exp: expires })}.signature`;
}
