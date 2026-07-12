// 簡易ログイン認証 (スタッフ共有パスワード方式)
//
// - 環境変数 APP_PASSWORD が設定されている場合のみ認証が有効になる
// - ログイン成功で署名付きトークンを HttpOnly Cookie に保存する
// - トークンは「有効期限.HMAC-SHA256署名」の形式で、改ざんを検出できる
// - middleware (Edge) でも動くよう Web Crypto API のみを使用する

export const AUTH_COOKIE = "jsl_auth";
export const TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30日

export function isAuthEnabled(): boolean {
  return Boolean(process.env.APP_PASSWORD);
}

// 署名鍵: AUTH_SECRET があれば優先、なければ APP_PASSWORD から導出
export function getAuthSecret(): string {
  return process.env.AUTH_SECRET || `jsl:${process.env.APP_PASSWORD ?? ""}`;
}

async function hmacHex(value: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(value));
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function createToken(secret: string): Promise<string> {
  const expiry = Date.now() + TOKEN_TTL_MS;
  return `${expiry}.${await hmacHex(String(expiry), secret)}`;
}

export async function verifyToken(
  token: string | undefined,
  secret: string
): Promise<boolean> {
  if (!token) return false;
  const [expiryStr, signature] = token.split(".");
  if (!expiryStr || !signature) return false;
  const expiry = Number(expiryStr);
  if (!Number.isFinite(expiry) || expiry < Date.now()) return false;
  const expected = await hmacHex(expiryStr, secret);
  return timingSafeEqual(signature, expected);
}

// タイミング攻撃対策の定数時間比較
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
