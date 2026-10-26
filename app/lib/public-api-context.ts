import {
  buildTagConfigFromColor,
  DEFAULT_CATEGORY_CONFIGS,
  type CategoryTagConfig,
} from "@/app/lib/category-tags";
import { postToGoogle } from "@/app/lib/server";
import {
  DEFAULT_WATCH_SITUATION,
  normalizeWatchSituation,
  type WatchSituationConfig,
  WATCH_SETTING_KEY,
} from "@/app/lib/watch-situation";

const TAG_SETTING_KEY = "category_tags";
const CONTEXT_TTL_MS = 60 * 1000;

type PublicApiContext = {
  tagConfigs: CategoryTagConfig[];
  watchSituation: WatchSituationConfig;
  fetchedAt: number;
};

let cachedContext: PublicApiContext | null = null;

async function loadSetting(key: string) {
  const result = await postToGoogle(
    { action: "getSiteSetting", key },
    2,
  );
  if (
    result.ok &&
    result.setting &&
    typeof result.setting === "object" &&
    "value" in result.setting
  ) {
    return (result.setting as { value?: unknown }).value;
  }
  return null;
}

export async function getPublicApiContext() {
  if (
    cachedContext &&
    Date.now() - cachedContext.fetchedAt < CONTEXT_TTL_MS
  ) {
    return cachedContext;
  }

  const [watchResult, tagsResult] = await Promise.allSettled([
    loadSetting(WATCH_SETTING_KEY),
    loadSetting(TAG_SETTING_KEY),
  ]);

  const watchValue =
    watchResult.status === "fulfilled" &&
    watchResult.value &&
    typeof watchResult.value === "object"
      ? normalizeWatchSituation(
          watchResult.value as Partial<WatchSituationConfig>,
        )
      : { ...DEFAULT_WATCH_SITUATION };

  const rawTags =
    tagsResult.status === "fulfilled" && Array.isArray(tagsResult.value)
      ? tagsResult.value
      : DEFAULT_CATEGORY_CONFIGS;
  const tagConfigs = rawTags
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null;
      const item = entry as Partial<CategoryTagConfig>;
      const name = String(item.name || "").trim();
      return name
        ? buildTagConfigFromColor(name, item.color, item.icon)
        : null;
    })
    .filter((entry): entry is CategoryTagConfig => Boolean(entry));

  cachedContext = {
    watchSituation: watchValue,
    tagConfigs:
      tagConfigs.length > 0 ? tagConfigs : [...DEFAULT_CATEGORY_CONFIGS],
    fetchedAt: Date.now(),
  };
  return cachedContext;
}
