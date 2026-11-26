// Leitura e gravação do local da loja (uma linha só no banco).
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { storeSettings } from "@/db/schema";
import { DEFAULT_RADIUS, type StoreLocation } from "./location";

const ROW_ID = 1;

export async function getStoreSettings(): Promise<StoreLocation> {
  const [row] = await db.select().from(storeSettings).where(eq(storeSettings.id, ROW_ID)).limit(1);
  return row ?? { latitude: null, longitude: null, radiusMeters: DEFAULT_RADIUS, networks: [] };
}

export async function saveStoreSettings(values: Partial<StoreLocation>, userId: string) {
  const data = { ...values, updatedAt: new Date(), updatedById: userId };
  await db
    .insert(storeSettings)
    .values({ id: ROW_ID, ...data })
    .onConflictDoUpdate({ target: storeSettings.id, set: data });
}
