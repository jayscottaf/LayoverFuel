/** The single location field shared by the daily plan and nearby meal search. */
export const PLAN_LOCATION_INPUT_ID = "plan-context-location";

export function focusPlanLocation() {
  const input = document.getElementById(PLAN_LOCATION_INPUT_ID);
  if (!input) return;
  input.scrollIntoView({ block: "center" });
  input.focus({ preventScroll: true });
}
