import type {
  AdCategory,
  AdPlacement,
  BroadcastItem,
  Channel,
  CommercialBreakMode,
  CommercialStrategy,
  MediaItem,
  ScheduleMode,
  Weekday,
} from "./types";

type BuildScheduleOptions = {
  channel?: Channel;
  now?: Date;
  availableAds?: MediaItem[];
};

type CommercialCursor = {
  index: number;
  breakIndex: number;
  sourceOffsets: Record<string, number>;
};

type CommercialPickContext = {
  channel?: Channel;
  now: Date;
  placement: AdPlacement;
};

type ProgramBlockPlan = {
  slotLengthSeconds: number;
  breakpoints: number[];
  breakDurations: number[];
  fillEndOfSlot: boolean;
};

const DAY_SECONDS = 24 * 60 * 60;
const DEFAULT_MUSIC_BREAK_SECONDS = 90;
const MAX_RETURNED_SCHEDULE_ITEMS = 4000;
const MAX_COMMERCIAL_SEGMENTS_PER_BLOCK = 80;
const MUSIC_VIDEOS_BETWEEN_BREAKS = 4;

const DEFAULT_AD_PLACEMENTS: AdPlacement[] = [
  "mid-roll",
  "between-programs",
  "post-roll",
  "filler",
];

const WEEKDAYS: Weekday[] = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

function getToday(now: Date): Weekday {
  return WEEKDAYS[now.getDay()] ?? "sunday";
}

function getDateSeed(now: Date): string {
  return now.toISOString().slice(0, 10);
}

function hashString(value: string): number {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function createSeededRandom(seed: string): () => number {
  let state = hashString(seed) || 1;

  return () => {
    state += 0x6d2b79f5;

    let result = state;
    result = Math.imul(result ^ (result >>> 15), result | 1);
    result ^= result + Math.imul(result ^ (result >>> 7), result | 61);

    return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
  };
}

function seededShuffle<T>(items: T[], seed: string): T[] {
  const result = [...items];
  const random = createSeededRandom(seed);

  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    const current = result[index];
    const swap = result[swapIndex];

    if (current === undefined || swap === undefined) {
      continue;
    }

    result[index] = swap;
    result[swapIndex] = current;
  }

  return result;
}

function isProgram(item: MediaItem): boolean {
  return (
    item.type === "show" ||
    item.type === "movie" ||
    item.type === "music" ||
    item.type === "music-video"
  );
}

function isShowOrMovie(item: MediaItem): boolean {
  return item.type === "show" || item.type === "movie";
}

function isMusicVideo(item: MediaItem): boolean {
  return item.type === "music" || item.type === "music-video";
}

function isAd(item: MediaItem): boolean {
  return item.type === "commercial" || item.type === "bumper";
}

function hasPlayableDuration(item: MediaItem): boolean {
  return (
    typeof item.file === "string" &&
    item.file.trim().length > 0 &&
    Number.isFinite(Number(item.duration)) &&
    Number(item.duration) > 0
  );
}

function getSafeDuration(item: Pick<MediaItem, "duration">): number {
  const duration = Math.floor(Number(item.duration));

  return Number.isFinite(duration) && duration > 0 ? duration : 1;
}

function getScheduleDurationForItems(items: BroadcastItem[]): number {
  return items.reduce((sum, item) => sum + getSafeDuration(item), 0);
}

function getScheduleMode(channel?: Channel): ScheduleMode {
  return channel?.scheduleMode ?? "ordered";
}

function getBreakMode(channel?: Channel): CommercialBreakMode {
  return channel?.commercialBreakMode ?? "none";
}

function getCommercialStrategy(
  item: MediaItem | undefined,
  channel?: Channel,
): CommercialStrategy {
  return (
    item?.commercialStrategy ??
    channel?.adPolicy?.strategy ??
    channel?.commercialStrategy ??
    "best-fit"
  );
}

function canAirToday(item: MediaItem, now: Date): boolean {
  if (!item.airDays || item.airDays.length === 0) {
    return true;
  }

  return item.airDays.includes(getToday(now));
}

function canAdAirToday(item: MediaItem, now: Date): boolean {
  if (item.adDays && item.adDays.length > 0) {
    return item.adDays.includes(getToday(now));
  }

  return canAirToday(item, now);
}

function parseClockTime(value: string | undefined): number {
  if (!value) {
    return Number.POSITIVE_INFINITY;
  }

  const match = value.trim().match(/^(\d{1,2}):(\d{2})$/);

  if (!match) {
    return Number.POSITIVE_INFINITY;
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);

  if (
    !Number.isFinite(hours) ||
    !Number.isFinite(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return Number.POSITIVE_INFINITY;
  }

  return hours * 60 + minutes;
}

function parseAirStartTime(value: string | undefined): number {
  return parseClockTime(value);
}

function hasFixedAirStartTime(item: MediaItem): boolean {
  return Number.isFinite(parseAirStartTime(item.airStartTime));
}

function getLocalMinuteOfDay(now: Date): number {
  return now.getHours() * 60 + now.getMinutes();
}

function isWithinClockWindow(
  startTime: string | undefined,
  endTime: string | undefined,
  now: Date,
): boolean {
  const start = parseClockTime(startTime);
  const end = parseClockTime(endTime);

  if (!Number.isFinite(start) && !Number.isFinite(end)) {
    return true;
  }

  const current = getLocalMinuteOfDay(now);

  if (Number.isFinite(start) && !Number.isFinite(end)) {
    return current >= start;
  }

  if (!Number.isFinite(start) && Number.isFinite(end)) {
    return current <= end;
  }

  if (start === end) {
    return true;
  }

  if (start < end) {
    return current >= start && current <= end;
  }

  return current >= start || current <= end;
}

function getUtcDayOffsetForLocalAirStart(
  airStartTime: string | undefined,
  now: Date,
): number | null {
  const minutesSinceLocalMidnight = parseAirStartTime(airStartTime);

  if (!Number.isFinite(minutesSinceLocalMidnight)) {
    return null;
  }

  const hours = Math.floor(minutesSinceLocalMidnight / 60);
  const minutes = minutesSinceLocalMidnight % 60;

  const localAirDate = new Date(now);
  localAirDate.setHours(hours, minutes, 0, 0);

  const utcMidnightMs = Date.UTC(
    localAirDate.getUTCFullYear(),
    localAirDate.getUTCMonth(),
    localAirDate.getUTCDate(),
    0,
    0,
    0,
    0,
  );

  const offsetSeconds = Math.floor(
    (localAirDate.getTime() - utcMidnightMs) / 1000,
  );

  return ((offsetSeconds % DAY_SECONDS) + DAY_SECONDS) % DAY_SECONDS;
}

function sortByAirStartTime(items: MediaItem[]): MediaItem[] {
  return [...items].sort((a, b) => {
    const aTime = parseAirStartTime(a.airStartTime);
    const bTime = parseAirStartTime(b.airStartTime);

    if (aTime !== bTime) {
      return aTime - bTime;
    }

    return a.title.localeCompare(b.title, undefined, {
      numeric: true,
      sensitivity: "base",
    });
  });
}

function normalizeCategory(value: unknown): AdCategory | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_\s]/g, "")
    .replace(/\s+/g, "-");

  return normalized || undefined;
}

function getAdCategories(item: MediaItem): AdCategory[] {
  const categories = [
    ...(Array.isArray(item.adCategories) ? item.adCategories : []),
    item.commercialCategory,
  ]
    .map(normalizeCategory)
    .filter((category): category is AdCategory => Boolean(category));

  return Array.from(new Set(categories.length > 0 ? categories : ["general"]));
}

function isAdPlacementAllowed(
  item: MediaItem,
  context: CommercialPickContext,
): boolean {
  const policy = context.channel?.adPolicy;

  if (policy?.enabled === false) {
    return false;
  }

  const channelPlacements =
    policy?.placements && policy.placements.length > 0
      ? policy.placements
      : DEFAULT_AD_PLACEMENTS;

  if (!channelPlacements.includes(context.placement)) {
    return false;
  }

  if (!item.adPlacements || item.adPlacements.length === 0) {
    return true;
  }

  return item.adPlacements.includes(context.placement);
}

function isAdTargetAllowed(item: MediaItem, channel?: Channel): boolean {
  if (!channel) {
    return false;
  }

  if (channel.adPolicy?.enabled === false) {
    return false;
  }

  const targets = Array.isArray(item.adChannelIds) ? item.adChannelIds : [];

  if (targets.length === 0) {
    return false;
  }

  const channelIds = new Set([
    String(channel.id),
    String(channel.number ?? channel.id),
  ]);

  if (targets.some((target) => String(target) === "all")) {
    return channel.adPolicy?.allowGlobalAds === true;
  }

  const targetsThisChannel = targets.some((target) =>
    channelIds.has(String(target)),
  );

  if (!targetsThisChannel) {
    return false;
  }

  return channel.adPolicy?.allowChannelTargetedAds !== false;
}

function isAdCategoryAllowed(item: MediaItem, channel?: Channel): boolean {
  const allowedCategories = channel?.adPolicy?.allowedCategories;

  if (!allowedCategories || allowedCategories.length === 0) {
    return true;
  }

  const allowedSet = new Set(
    allowedCategories
      .map(normalizeCategory)
      .filter((category): category is AdCategory => Boolean(category)),
  );

  if (allowedSet.size === 0) {
    return true;
  }

  return getAdCategories(item).some((category) => allowedSet.has(category));
}

function canAdRunInContext(
  item: MediaItem,
  context: CommercialPickContext,
): boolean {
  return (
    isAd(item) &&
    hasPlayableDuration(item) &&
    canAdAirToday(item, context.now) &&
    isWithinClockWindow(item.adStartTime, item.adEndTime, context.now) &&
    isAdPlacementAllowed(item, context) &&
    isAdTargetAllowed(item, context.channel) &&
    isAdCategoryAllowed(item, context.channel)
  );
}

function sortAdPool(items: MediaItem[]): MediaItem[] {
  return [...items].sort((a, b) => {
    const priorityDifference =
      Math.floor(Number(b.adPriority) || 0) -
      Math.floor(Number(a.adPriority) || 0);

    if (priorityDifference !== 0) {
      return priorityDifference;
    }

    const durationDifference = getSafeDuration(a) - getSafeDuration(b);

    if (durationDifference !== 0) {
      return durationDifference;
    }

    return a.title.localeCompare(b.title, undefined, {
      numeric: true,
      sensitivity: "base",
    });
  });
}

function dedupeMediaById(items: MediaItem[]): MediaItem[] {
  const map = new Map<string, MediaItem>();

  for (const item of items) {
    if (!map.has(item.id)) {
      map.set(item.id, item);
    }
  }

  return Array.from(map.values());
}

function createAdPool(
  channelMedia: MediaItem[],
  availableAds: MediaItem[] | undefined,
  channel: Channel | undefined,
  now: Date,
): MediaItem[] {
  if (!channel || channel.adPolicy?.enabled === false) {
    return [];
  }

  const directAds = channelMedia.filter(isAd);
  const globalAds = Array.isArray(availableAds) ? availableAds.filter(isAd) : [];

  const context: CommercialPickContext = {
    channel,
    now,
    placement: "mid-roll",
  };

  return sortAdPool(
    dedupeMediaById([...directAds, ...globalAds]).filter((item) =>
      canAdRunInContext(item, context),
    ),
  );
}

function createCommercialCursor(): CommercialCursor {
  return {
    index: 0,
    breakIndex: 0,
    sourceOffsets: {},
  };
}

function createAdCampaignKey(item: MediaItem): string {
  return (
    item.campaignName?.trim() ||
    item.advertiserName?.trim() ||
    item.engagementKey?.trim() ||
    item.id
  );
}

function createCommercialContext(
  channel: Channel | undefined,
  now: Date,
  placement: AdPlacement,
): CommercialPickContext {
  return {
    channel,
    now,
    placement,
  };
}

function getRotatedPool(items: MediaItem[], cursor: CommercialCursor): MediaItem[] {
  if (items.length === 0) {
    return [];
  }

  const start = cursor.index % items.length;

  return [...items.slice(start), ...items.slice(0, start)];
}

function pickCommercial(
  ads: MediaItem[],
  targetSeconds: number,
  cursor: CommercialCursor,
  strategy: CommercialStrategy,
  context: CommercialPickContext,
): MediaItem | undefined {
  const eligible = getRotatedPool(ads, cursor).filter((item) =>
    canAdRunInContext(item, context),
  );

  if (eligible.length === 0) {
    return undefined;
  }

  if (strategy === "sequential") {
    return eligible[0];
  }

  if (strategy === "random") {
    const seed = `${targetSeconds}:${cursor.index}:${eligible
      .map((item) => item.id)
      .join("|")}`;
    const random = createSeededRandom(seed);
    const index = Math.floor(random() * eligible.length);

    return eligible[index] ?? eligible[0];
  }

  const target = Math.max(1, Math.floor(targetSeconds));
  const exactOrUnder = eligible
    .filter((item) => getSafeDuration(item) <= target)
    .sort((a, b) => getSafeDuration(b) - getSafeDuration(a))[0];

  return exactOrUnder ?? eligible[0];
}

function createProgramSegment(
  item: MediaItem,
  sourceStart: number,
  duration: number,
  label: string,
): BroadcastItem {
  const safeStart = Math.max(0, Math.floor(sourceStart));
  const safeDuration = Math.max(1, Math.floor(duration));
  const sourceEnd = safeStart + safeDuration;

  return {
    ...item,
    id: `${item.id}:program:${safeStart}:${sourceEnd}`,
    parentMediaId: item.id,
    sourceStart: safeStart,
    sourceEnd,
    sourceTitle: item.title,
    duration: safeDuration,
    title: item.title,
    segmentLabel: undefined,
    isVirtualSegment: true,
    hiddenFromGuide: false,
    guideDuration: getSafeDuration(item),
  };
}

function createCommercialSegment(
  item: MediaItem,
  requestedDuration: number,
  cursor: CommercialCursor,
  placement: AdPlacement,
  breakIndex: number,
): BroadcastItem {
  const sourceDuration = getSafeDuration(item);
  const segmentDuration = Math.max(
    1,
    Math.min(Math.floor(requestedDuration), sourceDuration),
  );

  const shouldSlice = segmentDuration < sourceDuration;
  const maxStart = Math.max(0, sourceDuration - segmentDuration);
  const previousOffset = cursor.sourceOffsets[item.id] ?? 0;
  const sourceStart = shouldSlice && maxStart > 0 ? previousOffset % (maxStart + 1) : 0;
  const sourceEnd = sourceStart + segmentDuration;

  cursor.sourceOffsets[item.id] = sourceEnd >= sourceDuration ? 0 : sourceEnd;

  return {
    ...item,
    id: `${item.id}:ad:${placement}:${breakIndex}:${cursor.index}:${sourceStart}:${sourceEnd}`,
    parentMediaId: item.id,
    sourceStart,
    sourceEnd,
    sourceTitle: item.title,
    duration: segmentDuration,
    title: item.title,
    segmentLabel: undefined,
    isVirtualSegment: shouldSlice,
    hiddenFromGuide: true,
    adPlacement: placement,
    adBreakIndex: breakIndex,
    adCampaignKey: createAdCampaignKey(item),
  };
}

function fillCommercialDuration(
  ads: MediaItem[],
  targetSeconds: number,
  cursor: CommercialCursor,
  strategy: CommercialStrategy,
  context: CommercialPickContext,
): BroadcastItem[] {
  const target = Math.max(0, Math.floor(targetSeconds));

  if (ads.length === 0 || target <= 0) {
    return [];
  }

  const result: BroadcastItem[] = [];
  let remaining = target;
  let guard = 0;
  const breakIndex = cursor.breakIndex;

  while (remaining > 0 && guard < MAX_COMMERCIAL_SEGMENTS_PER_BLOCK) {
    const selected = pickCommercial(ads, remaining, cursor, strategy, context);

    if (!selected) {
      break;
    }

    const duration = Math.min(getSafeDuration(selected), remaining);

    if (duration <= 0) {
      break;
    }

    result.push(
      createCommercialSegment(
        selected,
        duration,
        cursor,
        context.placement,
        breakIndex,
      ),
    );

    cursor.index += 1;
    remaining -= duration;
    guard += 1;
  }

  if (result.length > 0) {
    cursor.breakIndex += 1;
  }

  return result;
}

function normalizeBreakpoints(item: MediaItem): number[] {
  const duration = getSafeDuration(item);
  const saved = Array.isArray(item.breakpoints) ? item.breakpoints : [];

  return Array.from(
    new Set(
      saved
        .map((value) => Math.floor(Number(value)))
        .filter(
          (value) =>
            Number.isFinite(value) &&
            value > 0 &&
            value < duration,
        ),
    ),
  ).sort((a, b) => a - b);
}

function normalizeBreakDurations(
  item: MediaItem,
  count: number,
): number[] {
  const saved = Array.isArray(item.breakDurations)
    ? item.breakDurations
        .map((value) => Math.floor(Number(value)))
        .filter((value) => Number.isFinite(value) && value > 0)
    : [];

  // Ad block lengths are positional. Missing entries stay missing.
  return saved.slice(0, Math.max(0, count));
}

function getExplicitSlotLength(item: MediaItem): number {
  const duration = getSafeDuration(item);
  const itemSlot = Math.floor(Number(item.slotLengthSeconds));

  return Number.isFinite(itemSlot) && itemSlot > duration ? itemSlot : 0;
}

function getProgramBlockPlan(item: MediaItem): ProgramBlockPlan {
  const duration = getSafeDuration(item);
  const explicitSlot = getExplicitSlotLength(item);
  const breakpoints = normalizeBreakpoints(item);

  return {
    slotLengthSeconds: explicitSlot > duration ? explicitSlot : 0,
    breakpoints,
    breakDurations: normalizeBreakDurations(item, breakpoints.length),
    fillEndOfSlot: Boolean(
      item.fillSlotWithCommercials && explicitSlot > duration,
    ),
  };
}

function buildProgramBlock(
  item: MediaItem,
  ads: MediaItem[],
  channel: Channel | undefined,
  now: Date,
  cursor: CommercialCursor,
): BroadcastItem[] {
  if (!isShowOrMovie(item)) {
    return [item];
  }

  const plan = getProgramBlockPlan(item);
  const duration = getSafeDuration(item);
  const hasManualBreaks = plan.breakpoints.some(
    (_, index) => (plan.breakDurations[index] ?? 0) > 0,
  );

  if ((!hasManualBreaks && !plan.fillEndOfSlot) || ads.length === 0) {
    return [item];
  }

  const strategy = getCommercialStrategy(item, channel);
  const points = [0, ...plan.breakpoints, duration];
  const schedule: BroadcastItem[] = [];

  for (let index = 0; index < points.length - 1; index += 1) {
    const start = points[index] ?? 0;
    const end = points[index + 1] ?? duration;
    const segmentDuration = end - start;

    if (segmentDuration <= 0) {
      continue;
    }

    const isLastSegment = index === points.length - 2;

    schedule.push(
      createProgramSegment(item, start, segmentDuration, `Segment ${index + 1}`),
    );

    if (!isLastSegment) {
      const requestedBreakDuration = plan.breakDurations[index] ?? 0;

      if (requestedBreakDuration > 0) {
        schedule.push(
          ...fillCommercialDuration(
            ads,
            requestedBreakDuration,
            cursor,
            strategy,
            createCommercialContext(channel, now, "mid-roll"),
          ),
        );
      }
    }
  }

  const currentBlockDuration = getScheduleDurationForItems(schedule);
  const remainingSlotSeconds = Math.max(
    0,
    plan.slotLengthSeconds - currentBlockDuration,
  );

  if (plan.fillEndOfSlot && remainingSlotSeconds > 0) {
    schedule.push(
      ...fillCommercialDuration(
        ads,
        remainingSlotSeconds,
        cursor,
        strategy,
        createCommercialContext(channel, now, "filler"),
      ),
    );
  }

  const finalBlockDuration = getScheduleDurationForItems(schedule);

  return schedule.length > 0
    ? schedule.map((scheduleItem) => ({
        ...scheduleItem,
        guideDuration: finalBlockDuration,
      }))
    : [item];
}

function buildMusicBreak(
  ads: MediaItem[],
  channel: Channel | undefined,
  now: Date,
  cursor: CommercialCursor,
): BroadcastItem[] {
  if (ads.length === 0 || getBreakMode(channel) === "none") {
    return [];
  }

  return fillCommercialDuration(
    ads,
    DEFAULT_MUSIC_BREAK_SECONDS,
    cursor,
    channel?.commercialStrategy ?? channel?.adPolicy?.strategy ?? "best-fit",
    createCommercialContext(channel, now, "between-programs"),
  );
}

function buildRotatingSchedule(
  programs: MediaItem[],
  ads: MediaItem[],
  channel: Channel | undefined,
  now: Date,
): BroadcastItem[] {
  const schedule: BroadcastItem[] = [];
  const cursor = createCommercialCursor();
  let musicRun = 0;

  for (const item of programs) {
    if (schedule.length >= MAX_RETURNED_SCHEDULE_ITEMS) {
      break;
    }

    if (isMusicVideo(item)) {
      schedule.push(item);
      musicRun += 1;

      if (musicRun >= MUSIC_VIDEOS_BETWEEN_BREAKS) {
        schedule.push(...buildMusicBreak(ads, channel, now, cursor));
        musicRun = 0;
      }

      continue;
    }

    musicRun = 0;
    schedule.push(...buildProgramBlock(item, ads, channel, now, cursor));
  }

  return schedule.slice(0, MAX_RETURNED_SCHEDULE_ITEMS);
}

function createTimedSlice(
  item: BroadcastItem,
  sourceOffset: number,
  duration: number,
  dayStartSecond: number,
): BroadcastItem {
  const itemDuration = getSafeDuration(item);
  const safeOffset = Math.max(0, Math.floor(sourceOffset));
  const safeDuration = Math.max(1, Math.min(Math.floor(duration), itemDuration));
  const baseSourceStart = Math.max(0, Math.floor(item.sourceStart ?? 0));
  const sourceStart = baseSourceStart + safeOffset;
  const sourceEnd = sourceStart + safeDuration;
  const isFullItem = safeOffset === 0 && safeDuration >= itemDuration;

  if (isFullItem) {
    return {
      ...item,
      id: `${item.id}:fixed-day:${dayStartSecond}`,
      duration: safeDuration,
    };
  }

  return {
    ...item,
    id: `${item.id}:fixed-day:${dayStartSecond}:${sourceStart}:${sourceEnd}`,
    parentMediaId: item.parentMediaId ?? item.id,
    sourceStart,
    sourceEnd,
    sourceTitle: item.sourceTitle ?? item.title,
    duration: safeDuration,
    segmentLabel: item.segmentLabel ?? "Timed Fill",
    isVirtualSegment: true,
  };
}

function appendFillerForDuration(
  schedule: BroadcastItem[],
  fillerSchedule: BroadcastItem[],
  targetDuration: number,
  cursor: { index: number; offsetInsideItem: number },
  dayCursorSecond: number,
): number {
  const target = Math.max(0, Math.floor(targetDuration));

  if (target <= 0 || fillerSchedule.length === 0) {
    return 0;
  }

  let remaining = target;
  let appended = 0;
  let guard = 0;

  while (
    remaining > 0 &&
    fillerSchedule.length > 0 &&
    guard < MAX_RETURNED_SCHEDULE_ITEMS &&
    schedule.length < MAX_RETURNED_SCHEDULE_ITEMS
  ) {
    const item = fillerSchedule[cursor.index % fillerSchedule.length];

    if (!item) {
      break;
    }

    const itemDuration = getSafeDuration(item);
    const available = Math.max(1, itemDuration - cursor.offsetInsideItem);
    const sliceDuration = Math.min(available, remaining);

    schedule.push(
      createTimedSlice(
        item,
        cursor.offsetInsideItem,
        sliceDuration,
        dayCursorSecond + appended,
      ),
    );

    remaining -= sliceDuration;
    appended += sliceDuration;

    if (cursor.offsetInsideItem + sliceDuration >= itemDuration) {
      cursor.index = (cursor.index + 1) % fillerSchedule.length;
      cursor.offsetInsideItem = 0;
    } else {
      cursor.offsetInsideItem += sliceDuration;
    }

    guard += 1;
  }

  return appended;
}

function buildFixedAirTimeSchedule(
  fixedPrograms: MediaItem[],
  rotatingPrograms: MediaItem[],
  ads: MediaItem[],
  channel: Channel | undefined,
  now: Date,
  scheduleMode: ScheduleMode,
): BroadcastItem[] {
  const fixedBlocks = fixedPrograms
    .map((item) => {
      const startSecond = getUtcDayOffsetForLocalAirStart(item.airStartTime, now);

      if (startSecond === null) {
        return null;
      }

      const schedule = buildRotatingSchedule([item], ads, channel, now);

      return {
        startSecond,
        schedule,
        duration: getScheduleDurationForItems(schedule),
      };
    })
    .filter(
      (
        block,
      ): block is {
        startSecond: number;
        schedule: BroadcastItem[];
        duration: number;
      } => Boolean(block && block.schedule.length > 0 && block.duration > 0),
    )
    .sort((a, b) => a.startSecond - b.startSecond);

  const fillerBase =
    rotatingPrograms.length > 0
      ? rotatingPrograms
      : fixedPrograms.filter((item) => !hasFixedAirStartTime(item));

  const fillerPrograms =
    scheduleMode === "daily-random"
      ? seededShuffle(
          fillerBase,
          `${channel?.randomSeed ?? channel?.id ?? "channel"}:${getDateSeed(
            now,
          )}:fixed-filler`,
        )
      : fillerBase;

  const fillerSchedule = buildRotatingSchedule(
    fillerPrograms,
    ads,
    channel,
    now,
  );

  if (fixedBlocks.length === 0) {
    return fillerSchedule;
  }

  if (fillerSchedule.length === 0) {
    return fixedBlocks
      .flatMap((block) => block.schedule)
      .slice(0, MAX_RETURNED_SCHEDULE_ITEMS);
  }

  const schedule: BroadcastItem[] = [];
  const fillerCursor = {
    index: 0,
    offsetInsideItem: 0,
  };
  let dayCursorSecond = 0;

  for (const block of fixedBlocks) {
    if (schedule.length >= MAX_RETURNED_SCHEDULE_ITEMS) {
      break;
    }

    if (dayCursorSecond < block.startSecond) {
      dayCursorSecond += appendFillerForDuration(
        schedule,
        fillerSchedule,
        block.startSecond - dayCursorSecond,
        fillerCursor,
        dayCursorSecond,
      );
    }

    if (dayCursorSecond > block.startSecond) {
      continue;
    }

    for (const item of block.schedule) {
      if (schedule.length >= MAX_RETURNED_SCHEDULE_ITEMS) {
        break;
      }

      schedule.push({
        ...item,
        id: `${item.id}:fixed:${block.startSecond}:${dayCursorSecond}`,
      });

      dayCursorSecond += getSafeDuration(item);
    }
  }

  if (
    dayCursorSecond < DAY_SECONDS &&
    schedule.length < MAX_RETURNED_SCHEDULE_ITEMS
  ) {
    appendFillerForDuration(
      schedule,
      fillerSchedule,
      DAY_SECONDS - dayCursorSecond,
      fillerCursor,
      dayCursorSecond,
    );
  }

  return schedule.slice(0, MAX_RETURNED_SCHEDULE_ITEMS);
}

export function buildSchedule(
  media: MediaItem[],
  options: BuildScheduleOptions = {},
): BroadcastItem[] {
  const now = options.now ?? new Date();
  const channel = options.channel;

  const playableChannelMedia = media
    .filter(hasPlayableDuration)
    .filter((item) => canAirToday(item, now));

  if (playableChannelMedia.length === 0) {
    return [];
  }

  const programs = playableChannelMedia.filter(isProgram);

  if (programs.length === 0) {
    return [];
  }

  const scheduleMode = getScheduleMode(channel);
  const ads = createAdPool(playableChannelMedia, options.availableAds, channel, now);

  const fixedPrograms = programs.filter(hasFixedAirStartTime);
  const rotatingPrograms = programs.filter((item) => !hasFixedAirStartTime(item));
  const sortedRotatingPrograms = sortByAirStartTime(rotatingPrograms);

  const orderedRotatingPrograms =
    scheduleMode === "daily-random"
      ? seededShuffle(
          sortedRotatingPrograms,
          `${channel?.randomSeed ?? channel?.id ?? "channel"}:${getDateSeed(
            now,
          )}:programs`,
        )
      : sortedRotatingPrograms;

  if (fixedPrograms.length > 0) {
    const fixedSchedule = buildFixedAirTimeSchedule(
      sortByAirStartTime(fixedPrograms),
      orderedRotatingPrograms,
      ads,
      channel,
      now,
      scheduleMode,
    );

    if (fixedSchedule.length > 0) {
      return fixedSchedule;
    }
  }

  return buildRotatingSchedule(
    orderedRotatingPrograms.length > 0
      ? orderedRotatingPrograms
      : sortByAirStartTime(programs),
    ads,
    channel,
    now,
  );
}

export function getScheduleDuration(schedule: BroadcastItem[]): number {
  return getScheduleDurationForItems(schedule);
}
