let accountId: number | null = null;
export const getActiveAccountId = () => accountId;
export function setActiveAccountId(id: number | null) {
  accountId = id;
  if (typeof window !== "undefined") window.dispatchEvent(new Event("account-changed"));
}
