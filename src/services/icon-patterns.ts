export const ICON_PATTERNS: Record<string, string[]> = {
  // Navigation
  overflow: ["overflow", "more", "options", "menu", "dots", "kabob", "meatball"],
  back: ["back", "navigate_up", "arrow_back", "return", "nav_back"],
  close: ["close", "dismiss", "cancel", "ic_close", "btn_close"],
  home: ["home", "nav_home", "ic_home"],

  // Actions
  search: ["search", "find", "magnify", "ic_search"],
  settings: ["settings", "gear", "config", "preferences", "ic_settings"],
  share: ["share", "ic_share", "btn_share"],
  edit: ["edit", "pencil", "ic_edit", "btn_edit"],
  delete: ["delete", "trash", "remove", "ic_delete"],
  add: ["add", "plus", "create", "ic_add", "fab"],

  // Media
  play: ["play", "ic_play", "btn_play"],
  pause: ["pause", "ic_pause"],
  refresh: ["refresh", "reload", "sync", "ic_refresh"],

  // Social
  favorite: ["favorite", "heart", "like", "star", "ic_favorite"],
  bookmark: ["bookmark", "save", "ic_bookmark"],
  notification: ["notification", "bell", "ic_notification", "ic_notify"],

  // Misc
  filter: ["filter", "ic_filter", "btn_filter"],
  sort: ["sort", "ic_sort", "btn_sort"],
  download: ["download", "ic_download"],
  upload: ["upload", "ic_upload"],
  profile: ["profile", "account", "avatar", "user", "ic_profile"],
  hamburger: ["hamburger", "drawer", "nav_drawer", "ic_menu"],
};

/**
 * Match a user query to icon resourceId patterns.
 * Returns array of patterns to search for, or null if no match.
 */
export function matchIconPattern(query: string): string[] | null {
  const lowerQuery = query.toLowerCase();

  // Check each icon category
  for (const [category, patterns] of Object.entries(ICON_PATTERNS)) {
    // Match if query contains the category name or any pattern
    if (lowerQuery.includes(category) || patterns.some((p) => lowerQuery.includes(p))) {
      return patterns;
    }
  }

  return null;
}

/**
 * Check if a resourceId matches any of the given patterns.
 */
export function matchesResourceId(resourceId: string, patterns: string[]): boolean {
  const lowerId = resourceId.toLowerCase();
  return patterns.some((pattern) => lowerId.includes(pattern));
}
