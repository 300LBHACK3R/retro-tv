import { sanitizeProfiles, type Profile, type Pin } from "./profiles";
import { isThemeId, getThemeById, THEMES } from "./themes";
import type { ThemeId } from "./types";

export const FREE_PROFILE_LIMIT = 5;
export const MEMBER_PROFILE_LIMIT = 10;
export const THEME_PRICE_CENTS = 300;
export const MEMBERSHIP_PLANS = [
  { id: "monthly", label: "Monthly", amount: 499, months: 1, interval: "month", intervalCount: 1, renewal: "every month" },
  { id: "six-month", label: "6 months", amount: 2499, months: 6, interval: "month", intervalCount: 6, renewal: "every 6 months" },
  { id: "annual", label: "Yearly", amount: 4499, months: 12, interval: "year", intervalCount: 1, renewal: "every year" },
] as const;
export type MembershipPlanId = (typeof MEMBERSHIP_PLANS)[number]["id"];
export function isMembershipPlanId(value: unknown): value is MembershipPlanId {
  return MEMBERSHIP_PLANS.some(plan => plan.id === value);
}
export type Household = {
  profiles: Profile[];
  pin: Pin | null;
  library: Record<string, { favouriteChannels: string[]; watchlist: string[] }>;
  showMemberBadge: boolean;
};
export type AccountView = {
  enabled: boolean;
  user: { id: string; email: string } | null;
  ownedThemeIds: ThemeId[];
  // Purchases are separate from the effective access list above, which also
  // includes free themes and time-limited membership access.
  purchasedThemeIds: ThemeId[];
  member: boolean;
  profileLimit: number;
  household: Household | null;
  revision: number;
  commerce: {
    enabled: boolean;
    themePrice: string;
    membershipPlans: { id: MembershipPlanId; price: string }[];
  };
};
export const EMPTY_ACCOUNT: AccountView = {
  enabled: false,
  user: null,
  ownedThemeIds: [],
  purchasedThemeIds: [],
  member: false,
  profileLimit: FREE_PROFILE_LIMIT,
  household: null,
  revision: 0,
  commerce: { enabled: false, themePrice: "C$3", membershipPlans: [] },
};
export function allowedThemeIds(
  owned: readonly ThemeId[],
  member: boolean,
): ThemeId[] {
  return THEMES.filter(
    (theme) => !theme.isPremium || member || owned.includes(theme.id),
  ).map((theme) => theme.id);
}
export function validPassword(value: unknown): value is string {
  return typeof value === "string" && value.length >= 12 && value.length <= 128;
}
export function validEmail(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length <= 254 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
  );
}
export function sanitizeHousehold(value: unknown): Household | null {
  if (!value || typeof value !== "object") return null;
  const source = value as Record<string, unknown>;
  if (
    !Array.isArray(source.profiles) ||
    source.profiles.length > MEMBER_PROFILE_LIMIT
  )
    return null;
  const profiles = sanitizeProfiles(source.profiles, MEMBER_PROFILE_LIMIT);
  const pin = source.pin as Partial<Pin> | null;
  if (
    pin &&
    (typeof pin.salt !== "string" ||
      typeof pin.hash !== "string" ||
      !/^[a-f0-9]{32}$/.test(pin.salt) ||
      !/^[a-f0-9]{64}$/.test(pin.hash))
  )
    return null;
  const ids = (input: unknown) =>
    Array.isArray(input)
      ? [
          ...new Set(
            input.filter(
              (id): id is string =>
                typeof id === "string" && id.length > 0 && id.length <= 240,
            ),
          ),
        ].slice(0, 500)
      : [];
  const library: Household["library"] = {};
  const saved =
    source.library && typeof source.library === "object"
      ? (source.library as Household["library"])
      : {};
  for (const profile of profiles) {
    const data = saved[profile.id];
    library[profile.id] = {
      favouriteChannels: ids(data?.favouriteChannels),
      watchlist: ids(data?.watchlist),
    };
  }
  return {
    profiles,
    pin: pin ? { salt: pin.salt!, hash: pin.hash! } : null,
    library,
    showMemberBadge: source.showMemberBadge === true,
  };
}
export function validateHouseholdAccess(
  next: Household,
  previous: Household | null,
  allowed: readonly ThemeId[],
  limit: number,
  enforceThemes: boolean,
): string | null {
  const existingIds = new Set(previous?.profiles.map((profile) => profile.id));
  if (
    next.profiles.length > limit &&
    next.profiles.some((profile) => !existingIds.has(profile.id))
  )
    return `Your plan supports ${limit} profiles. Existing extra profiles are kept when membership ends.`;
  for (const profile of next.profiles) {
    if (
      profile.theme &&
      (!isThemeId(profile.theme) ||
        (enforceThemes &&
          getThemeById(profile.theme).isPremium &&
          !allowed.includes(profile.theme)))
    ) {
      // Keep an old preference on expiry; only changing to a locked theme is rejected.
      if (
        previous?.profiles.find((item) => item.id === profile.id)?.theme !==
        profile.theme
      )
        return "This theme needs a purchase or an active membership.";
    }
  }
  return null;
}
