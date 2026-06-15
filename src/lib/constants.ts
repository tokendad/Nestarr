/**
 * Application constants
 */

export const APP_NAME = "Nestarr";
export const APP_REPOSITORY_URL = "https://github.com/tokendad/Nestarr";

export const STORAGE_KEYS = {
  USER_EMAIL: "Nestarr_user_email",
  CURRENT_USER: "Nestarr_currentUser",
  THEME: "Nestarr_theme",
  LOCALE_CONFIG: "Nestarr_locale_config",
  ITEM_COLUMNS: "Nestarr_itemColumns",
  CUSTOM_FIELDS_TEMPLATE: "Nestarr_CustomFieldsTemplate",
  PRINT_PREFERENCES: "nestarr_print_preferences",
} as const;

const LEGACY_STORAGE_KEYS = {
  USER_EMAIL: "NesVentory_user_email",
  CURRENT_USER: "NesVentory_currentUser",
  THEME: "NesVentory_theme",
  LOCALE_CONFIG: "NesVentory_locale_config",
  ITEM_COLUMNS: "NesVentory_itemColumns",
  CUSTOM_FIELDS_TEMPLATE: "NesVentory_CustomFieldsTemplate",
  PRINT_PREFERENCES: "nesventory_print_preferences",
} as const;

const STORAGE_KEY_MIGRATIONS = [
  [LEGACY_STORAGE_KEYS.USER_EMAIL, STORAGE_KEYS.USER_EMAIL],
  [LEGACY_STORAGE_KEYS.CURRENT_USER, STORAGE_KEYS.CURRENT_USER],
  [LEGACY_STORAGE_KEYS.THEME, STORAGE_KEYS.THEME],
  [LEGACY_STORAGE_KEYS.LOCALE_CONFIG, STORAGE_KEYS.LOCALE_CONFIG],
  [LEGACY_STORAGE_KEYS.ITEM_COLUMNS, STORAGE_KEYS.ITEM_COLUMNS],
  [LEGACY_STORAGE_KEYS.CUSTOM_FIELDS_TEMPLATE, STORAGE_KEYS.CUSTOM_FIELDS_TEMPLATE],
  [LEGACY_STORAGE_KEYS.PRINT_PREFERENCES, STORAGE_KEYS.PRINT_PREFERENCES],
] as const;

const MIGRATION_DONE_KEY = "Nestarr_migrated";

export function migrateLegacyBrowserStorage(): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  if (localStorage.getItem(MIGRATION_DONE_KEY) !== null) return;

  for (const [legacyKey, newKey] of STORAGE_KEY_MIGRATIONS) {
    try {
      const legacyValue = localStorage.getItem(legacyKey);
      if (legacyValue === null) continue;

      if (localStorage.getItem(newKey) === null) {
        localStorage.setItem(newKey, legacyValue);
      }
      localStorage.removeItem(legacyKey);
    } catch (error) {
      console.warn(`Failed to migrate browser storage key ${legacyKey}:`, error);
    }
  }

  try {
    localStorage.setItem(MIGRATION_DONE_KEY, "1");
  } catch {
    // Non-fatal — migration will re-run on next load but is idempotent
  }
}

export const PHOTO_TYPES = {
  DEFAULT: "default",
  DATA_TAG: "data_tag",
  RECEIPT: "receipt",
  WARRANTY: "warranty",
  OPTIONAL: "optional",
  PROFILE: "profile",
} as const;

export const DOCUMENT_TYPES = {
  MANUAL: "manual",
  ATTACHMENT: "attachment",
} as const;

export const ALLOWED_PHOTO_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
];

export const ALLOWED_DOCUMENT_MIME_TYPES = [
  "application/pdf",
  "text/plain",
];

export const ALLOWED_PHOTO_EXTENSIONS = [".jpg", ".jpeg", ".png", ".gif", ".webp"];

export const ALLOWED_DOCUMENT_EXTENSIONS = [".pdf", ".txt"];

// Relationship types for Living items
export const RELATIONSHIP_TYPES = {
  // Family relationships
  SELF: "self",
  SPOUSE: "spouse",
  PARTNER: "partner",
  MOTHER: "mother",
  FATHER: "father",
  SISTER: "sister",
  BROTHER: "brother",
  DAUGHTER: "daughter",
  SON: "son",
  GRANDMOTHER: "grandmother",
  GRANDFATHER: "grandfather",
  AUNT: "aunt",
  UNCLE: "uncle",
  COUSIN: "cousin",
  NIECE: "niece",
  NEPHEW: "nephew",
  // Other living things
  PET: "pet",
  PLANT: "plant",
  OTHER: "other",
} as const;

// Human-readable labels for relationship types
export const RELATIONSHIP_LABELS: Record<string, string> = {
  self: "Self (Me)",
  spouse: "Spouse",
  partner: "Partner",
  mother: "Mother",
  father: "Father",
  sister: "Sister",
  brother: "Brother",
  daughter: "Daughter",
  son: "Son",
  grandmother: "Grandmother",
  grandfather: "Grandfather",
  aunt: "Aunt",
  uncle: "Uncle",
  cousin: "Cousin",
  niece: "Niece",
  nephew: "Nephew",
  pet: "Pet",
  plant: "Plant",
  other: "Other",
};

// Living tag name constant
export const LIVING_TAG_NAME = "Living";

export const RETAILERS = [
  "7-Eleven",
  "Abercrombie & Fitch",
  "Academy Sports + Outdoors",
  "Ace Hardware",
  "Ahold Delhaize USA",
  "Albertsons Companies",
  "Aldi",
  "Alimentation Couche-Tard (Circle K)",
  "Amazon",
  "American Eagle Outfitters",
  "Apple Stores / iTunes",
  "Asbury Automotive Group",
  "AutoNation",
  "AutoZone",
  "BJ's Wholesale Club",
  "Barnes & Noble",
  "Bass Pro Shops",
  "Bath & Body Works",
  "Belk",
  "Best Buy",
  "Burlington Stores",
  "Camping World",
  "Capri Holdings (Michael Kors)",
  "CarMax",
  "Casey’s General Stores",
  "Chevron",
  "Chewy",
  "Costco Wholesale",
  "Crate & Barrel",
  "CVS Health",
  "Dick's Sporting Goods",
  "Dillard’s",
  "Dollar General",
  "Dollar Tree",
  "Exxon Mobil",
  "Fanatics",
  "Five Below",
  "Foot Locker",
  "GameStop",
  "Gap Inc.",
  "Giant Eagle",
  "Group 1 Automotive",
  "Guitar Center",
  "H-E-B",
  "Harbor Freight Tools",
  "Hobby Lobby",
  "Hy-Vee",
  "IKEA",
  "Kohl’s",
  "Levi Strauss & Co.",
  "Lithia Motors",
  "Love’s Travel Stops",
  "Lowe’s Companies",
  "Lululemon Athletica",
  "Macy's",
  "Meijer",
  "Menards",
  "Michaels",
  "Neiman Marcus",
  "Nordstrom",
  "O'Reilly Auto Parts",
  "Office Depot",
  "Overstock (Bed Bath & Beyond)",
  "Penske Automotive Group",
  "Petco",
  "PetSmart",
  "Pilot Flying J",
  "Pottery Barn",
  "Publix Super Markets",
  "QuikTrip",
  "Qurate Retail Group (QVC/HSN)",
  "RH (Restoration Hardware)",
  "Rite Aid",
  "Ross Stores",
  "Save-A-Lot",
  "Sephora",
  "Shell",
  "Sherwin-Williams",
  "Sonic Automotive",
  "Speedway",
  "Sprouts Farmers Market",
  "Staples",
  "Stater Bros. Markets",
  "TJX Companies",
  "Tapestry (Coach/Kate Spade)",
  "Target",
  "The Home Depot",
  "The Kroger Co.",
  "Tractor Supply Co.",
  "Ulta Beauty",
  "Victoria's Secret & Co.",
  "Wakefern Food Corp.",
  "Walgreens Boots Alliance",
  "Walmart",
  "Wawa",
  "Wayfair",
  "Wegmans Food Market",
  "West Elm",
  "Williams-Sonoma",
  "WinCo Foods",
];

export const BRANDS = [
  "Adidas",
  "Apple",
  "Ashley Furniture",
  "BMW",
  "BYD",
  "Bandai Namco",
  "Barbie",
  "Bernhardt Furniture",
  "Bosch",
  "Burberry",
  "Cartier",
  "Caterpillar",
  "Chanel",
  "Clinique",
  "Coca-Cola",
  "Craftsman",
  "Danone",
  "DeWalt",
  "Dell",
  "Dior",
  "Dove",
  "Dyson",
  "Electrolux",
  "Estée Lauder",
  "Ethan Allen",
  "Ferrari",
  "Fisher-Price",
  "Ford",
  "Frigidaire",
  "Funko",
  "General Mills",
  "General Motors",
  "Gucci",
  "H&M",
  "HNI Corporation",
  "HP",
  "Haier",
  "Hasbro",
  "Herman Miller",
  "Hermès",
  "Hershey’s",
  "Hilti",
  "Honda",
  "Hot Wheels",
  "IKEA",
  "Intel",
  "John Deere",
  "Kellogg’s",
  "KitchenAid",
  "Kraft Heinz",
  "L'Oréal",
  "LG Electronics",
  "La-Z-Boy",
  "Lancôme",
  "Levi’s",
  "Louis Vuitton",
  "Lululemon",
  "MGA Entertainment",
  "Makita",
  "Mars",
  "Mattel",
  "Maytag",
  "Mercedes-Benz",
  "Miele",
  "Milwaukee Tool",
  "Mondelez",
  "Nestlé",
  "Neutrogena",
  "Nike",
  "Nintendo",
  "Panasonic",
  "PepsiCo",
  "Porsche",
  "Prada",
  "Procter & Gamble",
  "Ralph Lauren",
  "Revlon",
  "Roche Bobois",
  "Rolex",
  "Ryobi",
  "Saint Laurent",
  "Samsung",
  "SharkNinja",
  "Shiseido",
  "Snap-on",
  "Sony",
  "Spin Master",
  "Stanley Black & Decker",
  "Steelcase",
  "Tesla",
  "The LEGO Group",
  "The North Face",
  "Toyota",
  "Under Armour",
  "Unilever",
  "Uniqlo",
  "Whirlpool",
  "Williams-Sonoma",
  "Xiaomi",
  "Zara",
];
