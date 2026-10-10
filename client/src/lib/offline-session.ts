const KEY = "layoverfuel-offline-session";
type OfflineAccount = { id: number; isOnboardingComplete: boolean };

export function rememberOfflineAccount(account: OfflineAccount) {
  const marker = JSON.stringify({ version: 1, ...account });
  localStorage.setItem(KEY, marker);
  sessionStorage.setItem(KEY, marker);
  localStorage.setItem("layoverfuel-active-account", String(account.id));
}

export function readOfflineAccount(): OfflineAccount | null {
  if (localStorage.getItem("layoverfuel-pending-logout")) return null;
  try {
    const raw = localStorage.getItem(KEY) ?? sessionStorage.getItem(KEY);
    if (!raw) return null;
    const account = JSON.parse(raw);
    if (account.version !== undefined && account.version !== 1) return null;
    if (!Number.isSafeInteger(account.id) || account.id <= 0 ||
      localStorage.getItem("layoverfuel-active-account") !== String(account.id)) return null;
    return { id: account.id, isOnboardingComplete: account.isOnboardingComplete === true };
  } catch { return null; }
}

export function forgetOfflineAccount() {
  localStorage.removeItem(KEY);
  sessionStorage.removeItem(KEY);
  localStorage.removeItem("layoverfuel-active-account");
}
