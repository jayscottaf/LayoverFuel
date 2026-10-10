import { apiRequest, queryClient } from "./queryClient";
import { queueItem, syncQueue, getQueueItem, getAllItems, cancelQueuedNutrition } from "./offline-queue";
import { nutritionInputSchema, type NutritionInput } from "@shared/nutrition";

export type NutritionSaveResult = { queued: boolean; id: number | string };
export async function invalidateNutrition(): Promise<void> {
  await queryClient.invalidateQueries({ predicate: query =>
    ["/api/dashboard", "/api/logs/nutrition", "/api/travel-plan", "/api/stats", "/api/tdee/adaptive"]
      .some(path => String(query.queryKey[0]).startsWith(path)),
  });
}
export async function saveNutrition(input: NutritionInput): Promise<NutritionSaveResult> {
  const data = nutritionInputSchema.parse({ ...input, clientRequestId: input.clientRequestId ?? crypto.randomUUID() });
  const id = await queueItem("nutrition", data);
  if (navigator.onLine) await syncQueue();
  const item = await getQueueItem(id);
  await invalidateNutrition();
  if (item?.status === "synced" && item.savedId) return { queued: false, id: item.savedId };
  return { queued: true, id };
}
export async function undoNutrition(result: NutritionSaveResult): Promise<void> {
  if (typeof result.id === "string") await cancelQueuedNutrition(result.id);
  else {
    const queued = (await getAllItems()).find(item => item.savedId === result.id);
    if (queued) await cancelQueuedNutrition(queued.id);
    else await apiRequest("DELETE", `/api/logs/nutrition/${result.id}`);
  }
  await invalidateNutrition();
}
