import React, { useState, useEffect, useMemo } from "react";
import {
  Plus,
  Trash2,
  ChevronLeft,
  ChevronRight,
  X,
  Check,
  Sparkles,
  BookOpen,
  BarChart3,
  Calendar,
  Settings,
  Download,
  Upload,
  Printer,
  Heart,
  Share2,
  Coffee,
} from "lucide-react";

// =====================================================================
// CONFIG — edit these to set your own URLs / share text
// =====================================================================
const CONFIG = {
  // Buy Me a Coffee / Ko-fi / PayPal.me link.
  // Leave empty to hide the donation card entirely.
  // Examples: 'https://buymeacoffee.com/yourname', 'https://ko-fi.com/yourname'
  donateUrl: "https://buymeacoffee.com/firsttastes",

  // The URL where the app is hosted (used for sharing).
  // If left empty, the share button uses the current page URL.
  appUrl: "",

  // What gets shared when someone taps "Recommend to a friend"
  shareTitle: "First Tastes — a free weaning tracker",
  shareText:
    "I've been using this free, ad-free weaning tracker. No subscription, no account, no ads. Made for UK parents. Thought you'd like it:",
};

// =====================================================================
// localStorage wrapper — works in any browser (replaces Claude artifact storage)
// =====================================================================
const Store = {
  get: async (key) => {
    try {
      const v = localStorage.getItem(key);
      return v != null ? { value: v } : null;
    } catch (e) {
      return null;
    }
  },
  set: async (key, value) => {
    try {
      localStorage.setItem(key, value);
      return { value };
    } catch (e) {
      return null;
    }
  },
  delete: async (key) => {
    try {
      localStorage.removeItem(key);
      return { deleted: true };
    } catch (e) {
      return null;
    }
  },
  list: async (prefix) => {
    try {
      const keys = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(prefix)) keys.push(k);
      }
      return { keys };
    } catch (e) {
      return { keys: [] };
    }
  },
};

// =====================================================================
// SCHEMA VERSIONING & MIGRATIONS
// Each meal record is stamped with the schema version when it was saved.
// When the app loads existing data, it runs migrations to bring older
// records up to the current schema. This means we can change data shapes
// in future without breaking old data.
//
// HOW TO ADD A MIGRATION (when you change the data shape):
// 1. Bump CURRENT_SCHEMA_VERSION below
// 2. Add a new migrator function for the new version
// 3. Test with old data still in localStorage to confirm it migrates cleanly
// =====================================================================
const CURRENT_SCHEMA_VERSION = 1;

// Each migrator transforms a meal from version (key - 1) to version (key)
// Currently empty — first version. Future entries example:
//   2: (meal) => ({ ...meal, newField: 'default value' }),
//   3: (meal) => ({ ...meal, foods: meal.foods.map(f => ({ ...f, newProp: null })) }),
const MIGRATIONS = {
  // 2: (meal) => ({ ...meal, someNewField: null }),
};

function migrateMeal(meal) {
  // Defensive: if not an object, return a safe empty meal
  if (!meal || typeof meal !== "object") return null;
  let m = { ...meal };
  // Default to version 1 if no version stamp (legacy records before versioning was added)
  let v = typeof m.schemaVersion === "number" ? m.schemaVersion : 1;
  // Run each migration in order until we reach current
  while (v < CURRENT_SCHEMA_VERSION) {
    const next = v + 1;
    const fn = MIGRATIONS[next];
    if (typeof fn === "function") {
      try {
        m = fn(m);
      } catch (e) {
        console.warn("Migration failed for v" + next, e);
        break;
      }
    }
    v = next;
  }
  m.schemaVersion = CURRENT_SCHEMA_VERSION;
  return m;
}

// =====================================================================
// SAFE READERS — defensive accessors so missing fields never crash the UI.
// Use these instead of accessing fields directly when reading from storage.
// =====================================================================
function safeMeal(raw) {
  // Run through migration first so old records get upgraded
  const m = migrateMeal(raw);
  if (!m) return null;
  return {
    id: m.id || `meal:${m.timestamp || Date.now()}`,
    timestamp: typeof m.timestamp === "number" ? m.timestamp : Date.now(),
    mealType: typeof m.mealType === "string" ? m.mealType : "meal",
    foods: Array.isArray(m.foods) ? m.foods.map(safeFood).filter(Boolean) : [],
    notes: typeof m.notes === "string" ? m.notes : "",
    schemaVersion: CURRENT_SCHEMA_VERSION,
  };
}

function safeFood(raw) {
  if (!raw || typeof raw !== "object") return null;
  return {
    name: typeof raw.name === "string" ? raw.name : "unknown",
    group: typeof raw.group === "string" && raw.group ? raw.group : "other",
    iron: raw.iron === true,
    allergens: Array.isArray(raw.allergens)
      ? raw.allergens.filter((a) => typeof a === "string")
      : [],
    texture: typeof raw.texture === "string" ? raw.texture : "mashed",
    isNew: raw.isNew === true,
    acceptance: ["loved", "tried", "refused"].includes(raw.acceptance)
      ? raw.acceptance
      : null,
  };
}

// ============================================================
// FOOD DATABASE — auto-tags group, iron, allergens, texture
// ============================================================
const FOOD_DB = {
  // ============== GRAINS & STARCHES ==============
  oats: { group: "grain", iron: false, allergens: [], texture: "puree" },
  porridge: { group: "grain", iron: false, allergens: [], texture: "puree" },
  "porridge oats": {
    group: "grain",
    iron: false,
    allergens: [],
    texture: "puree",
  },
  "ready brek": { group: "grain", iron: true, allergens: [], texture: "puree" },
  rice: { group: "grain", iron: false, allergens: [], texture: "mashed" },
  "baby rice": { group: "grain", iron: true, allergens: [], texture: "puree" },
  "brown rice": {
    group: "grain",
    iron: true,
    allergens: [],
    texture: "mashed",
  },
  pasta: {
    group: "grain",
    iron: false,
    allergens: ["wheat"],
    texture: "finger",
  },
  spaghetti: {
    group: "grain",
    iron: false,
    allergens: ["wheat"],
    texture: "finger",
  },
  macaroni: {
    group: "grain",
    iron: false,
    allergens: ["wheat"],
    texture: "finger",
  },
  penne: {
    group: "grain",
    iron: false,
    allergens: ["wheat"],
    texture: "finger",
  },
  fusilli: {
    group: "grain",
    iron: false,
    allergens: ["wheat"],
    texture: "finger",
  },
  orzo: {
    group: "grain",
    iron: false,
    allergens: ["wheat"],
    texture: "mashed",
  },
  noodles: {
    group: "grain",
    iron: false,
    allergens: ["wheat"],
    texture: "finger",
  },
  "rice noodles": {
    group: "grain",
    iron: false,
    allergens: [],
    texture: "finger",
  },
  bread: {
    group: "grain",
    iron: false,
    allergens: ["wheat"],
    texture: "finger",
  },
  toast: {
    group: "grain",
    iron: false,
    allergens: ["wheat"],
    texture: "finger",
  },
  sourdough: {
    group: "grain",
    iron: false,
    allergens: ["wheat"],
    texture: "finger",
  },
  pitta: {
    group: "grain",
    iron: false,
    allergens: ["wheat"],
    texture: "finger",
  },
  wrap: {
    group: "grain",
    iron: false,
    allergens: ["wheat"],
    texture: "finger",
  },
  tortilla: {
    group: "grain",
    iron: false,
    allergens: ["wheat"],
    texture: "finger",
  },
  crumpet: {
    group: "grain",
    iron: false,
    allergens: ["wheat"],
    texture: "finger",
  },
  "english muffin": {
    group: "grain",
    iron: false,
    allergens: ["wheat"],
    texture: "finger",
  },
  "fortified cereal": {
    group: "grain",
    iron: true,
    allergens: ["wheat"],
    texture: "puree",
  },
  weetabix: {
    group: "grain",
    iron: true,
    allergens: ["wheat"],
    texture: "mashed",
  },
  shreddies: {
    group: "grain",
    iron: true,
    allergens: ["wheat"],
    texture: "mashed",
  },
  cheerios: {
    group: "grain",
    iron: true,
    allergens: ["wheat"],
    texture: "finger",
  },
  "rice cakes": {
    group: "grain",
    iron: false,
    allergens: [],
    texture: "finger",
  },
  oatcakes: { group: "grain", iron: false, allergens: [], texture: "finger" },
  crackers: {
    group: "grain",
    iron: false,
    allergens: ["wheat"],
    texture: "finger",
  },
  breadsticks: {
    group: "grain",
    iron: false,
    allergens: ["wheat"],
    texture: "finger",
  },
  quinoa: { group: "grain", iron: true, allergens: [], texture: "mashed" },
  couscous: {
    group: "grain",
    iron: false,
    allergens: ["wheat"],
    texture: "mashed",
  },
  barley: {
    group: "grain",
    iron: true,
    allergens: ["wheat"],
    texture: "mashed",
  },
  "bulgur wheat": {
    group: "grain",
    iron: true,
    allergens: ["wheat"],
    texture: "mashed",
  },
  polenta: { group: "grain", iron: false, allergens: [], texture: "mashed" },
  pancake: {
    group: "grain",
    iron: false,
    allergens: ["wheat", "egg", "dairy"],
    texture: "finger",
  },

  // ============== MEAT & POULTRY ==============
  chicken: { group: "protein", iron: true, allergens: [], texture: "mashed" },
  "chicken breast": {
    group: "protein",
    iron: true,
    allergens: [],
    texture: "mashed",
  },
  "chicken thigh": {
    group: "protein",
    iron: true,
    allergens: [],
    texture: "mashed",
  },
  "roast chicken": {
    group: "protein",
    iron: true,
    allergens: [],
    texture: "mashed",
  },
  beef: { group: "protein", iron: true, allergens: [], texture: "mashed" },
  "beef mince": {
    group: "protein",
    iron: true,
    allergens: [],
    texture: "mashed",
  },
  steak: { group: "protein", iron: true, allergens: [], texture: "mashed" },
  lamb: { group: "protein", iron: true, allergens: [], texture: "mashed" },
  "lamb mince": {
    group: "protein",
    iron: true,
    allergens: [],
    texture: "mashed",
  },
  pork: { group: "protein", iron: true, allergens: [], texture: "mashed" },
  "pork mince": {
    group: "protein",
    iron: true,
    allergens: [],
    texture: "mashed",
  },
  turkey: { group: "protein", iron: true, allergens: [], texture: "mashed" },
  "turkey mince": {
    group: "protein",
    iron: true,
    allergens: [],
    texture: "mashed",
  },
  liver: { group: "protein", iron: true, allergens: [], texture: "mashed" },
  gammon: { group: "protein", iron: true, allergens: [], texture: "mashed" },

  // ============== FISH ==============
  salmon: {
    group: "protein",
    iron: true,
    allergens: ["fish"],
    texture: "mashed",
  },
  cod: {
    group: "protein",
    iron: false,
    allergens: ["fish"],
    texture: "mashed",
  },
  haddock: {
    group: "protein",
    iron: false,
    allergens: ["fish"],
    texture: "mashed",
  },
  pollock: {
    group: "protein",
    iron: false,
    allergens: ["fish"],
    texture: "mashed",
  },
  tuna: {
    group: "protein",
    iron: true,
    allergens: ["fish"],
    texture: "mashed",
  },
  sardines: {
    group: "protein",
    iron: true,
    allergens: ["fish"],
    texture: "mashed",
  },
  mackerel: {
    group: "protein",
    iron: true,
    allergens: ["fish"],
    texture: "mashed",
  },
  trout: {
    group: "protein",
    iron: true,
    allergens: ["fish"],
    texture: "mashed",
  },
  fish: {
    group: "protein",
    iron: true,
    allergens: ["fish"],
    texture: "mashed",
  },
  "fish fingers": {
    group: "protein",
    iron: false,
    allergens: ["fish", "wheat"],
    texture: "finger",
  },
  "fish pie": {
    group: "protein",
    iron: true,
    allergens: ["fish", "dairy"],
    texture: "mashed",
  },
  prawns: {
    group: "protein",
    iron: true,
    allergens: ["shellfish"],
    texture: "finger",
  },

  // ============== PLANT PROTEINS ==============
  lentils: { group: "protein", iron: true, allergens: [], texture: "mashed" },
  "red lentils": {
    group: "protein",
    iron: true,
    allergens: [],
    texture: "mashed",
  },
  "green lentils": {
    group: "protein",
    iron: true,
    allergens: [],
    texture: "mashed",
  },
  "puy lentils": {
    group: "protein",
    iron: true,
    allergens: [],
    texture: "mashed",
  },
  chickpeas: { group: "protein", iron: true, allergens: [], texture: "mashed" },
  hummus: {
    group: "protein",
    iron: true,
    allergens: ["sesame"],
    texture: "puree",
  },
  beans: { group: "protein", iron: true, allergens: [], texture: "mashed" },
  "baked beans": {
    group: "protein",
    iron: true,
    allergens: [],
    texture: "mashed",
  },
  "black beans": {
    group: "protein",
    iron: true,
    allergens: [],
    texture: "mashed",
  },
  "kidney beans": {
    group: "protein",
    iron: true,
    allergens: [],
    texture: "mashed",
  },
  "butter beans": {
    group: "protein",
    iron: true,
    allergens: [],
    texture: "mashed",
  },
  "cannellini beans": {
    group: "protein",
    iron: true,
    allergens: [],
    texture: "mashed",
  },
  tofu: { group: "protein", iron: true, allergens: ["soy"], texture: "finger" },
  tempeh: {
    group: "protein",
    iron: true,
    allergens: ["soy"],
    texture: "finger",
  },
  edamame: {
    group: "protein",
    iron: true,
    allergens: ["soy"],
    texture: "mashed",
  },
  egg: { group: "protein", iron: true, allergens: ["egg"], texture: "mashed" },
  eggs: { group: "protein", iron: true, allergens: ["egg"], texture: "mashed" },
  "scrambled egg": {
    group: "protein",
    iron: true,
    allergens: ["egg"],
    texture: "mashed",
  },
  "scrambled eggs": {
    group: "protein",
    iron: true,
    allergens: ["egg"],
    texture: "mashed",
  },
  "boiled egg": {
    group: "protein",
    iron: true,
    allergens: ["egg"],
    texture: "mashed",
  },
  omelette: {
    group: "protein",
    iron: true,
    allergens: ["egg", "dairy"],
    texture: "finger",
  },
  frittata: {
    group: "protein",
    iron: true,
    allergens: ["egg", "dairy"],
    texture: "finger",
  },

  // ============== DAIRY ==============
  yogurt: {
    group: "dairy",
    iron: false,
    allergens: ["dairy"],
    texture: "puree",
  },
  yoghurt: {
    group: "dairy",
    iron: false,
    allergens: ["dairy"],
    texture: "puree",
  },
  "greek yogurt": {
    group: "dairy",
    iron: false,
    allergens: ["dairy"],
    texture: "puree",
  },
  "natural yogurt": {
    group: "dairy",
    iron: false,
    allergens: ["dairy"],
    texture: "puree",
  },
  "whole milk yogurt": {
    group: "dairy",
    iron: false,
    allergens: ["dairy"],
    texture: "puree",
  },
  cheese: {
    group: "dairy",
    iron: false,
    allergens: ["dairy"],
    texture: "finger",
  },
  cheddar: {
    group: "dairy",
    iron: false,
    allergens: ["dairy"],
    texture: "finger",
  },
  "cottage cheese": {
    group: "dairy",
    iron: false,
    allergens: ["dairy"],
    texture: "puree",
  },
  "cream cheese": {
    group: "dairy",
    iron: false,
    allergens: ["dairy"],
    texture: "puree",
  },
  mozzarella: {
    group: "dairy",
    iron: false,
    allergens: ["dairy"],
    texture: "finger",
  },
  ricotta: {
    group: "dairy",
    iron: false,
    allergens: ["dairy"],
    texture: "puree",
  },
  feta: {
    group: "dairy",
    iron: false,
    allergens: ["dairy"],
    texture: "finger",
  },
  parmesan: {
    group: "dairy",
    iron: false,
    allergens: ["dairy"],
    texture: "finger",
  },
  milk: { group: "dairy", iron: false, allergens: ["dairy"], texture: "puree" },
  "whole milk": {
    group: "dairy",
    iron: false,
    allergens: ["dairy"],
    texture: "puree",
  },

  // ============== FRUITS ==============
  banana: { group: "fruit", iron: false, allergens: [], texture: "mashed" },
  apple: { group: "fruit", iron: false, allergens: [], texture: "puree" },
  "apple sauce": {
    group: "fruit",
    iron: false,
    allergens: [],
    texture: "puree",
  },
  pear: { group: "fruit", iron: false, allergens: [], texture: "puree" },
  berries: { group: "fruit", iron: false, allergens: [], texture: "mashed" },
  blueberries: {
    group: "fruit",
    iron: false,
    allergens: [],
    texture: "mashed",
  },
  strawberries: {
    group: "fruit",
    iron: false,
    allergens: [],
    texture: "mashed",
  },
  raspberries: { group: "fruit", iron: true, allergens: [], texture: "mashed" },
  blackberries: {
    group: "fruit",
    iron: false,
    allergens: [],
    texture: "mashed",
  },
  mango: { group: "fruit", iron: false, allergens: [], texture: "mashed" },
  avocado: { group: "fat", iron: false, allergens: [], texture: "mashed" },
  peach: { group: "fruit", iron: false, allergens: [], texture: "mashed" },
  nectarine: { group: "fruit", iron: false, allergens: [], texture: "mashed" },
  apricot: { group: "fruit", iron: true, allergens: [], texture: "mashed" },
  "dried apricot": {
    group: "fruit",
    iron: true,
    allergens: [],
    texture: "mashed",
  },
  plum: { group: "fruit", iron: false, allergens: [], texture: "mashed" },
  kiwi: { group: "fruit", iron: false, allergens: [], texture: "mashed" },
  orange: { group: "fruit", iron: false, allergens: [], texture: "mashed" },
  satsuma: { group: "fruit", iron: false, allergens: [], texture: "mashed" },
  clementine: { group: "fruit", iron: false, allergens: [], texture: "mashed" },
  melon: { group: "fruit", iron: false, allergens: [], texture: "finger" },
  watermelon: { group: "fruit", iron: false, allergens: [], texture: "finger" },
  cantaloupe: { group: "fruit", iron: false, allergens: [], texture: "finger" },
  grapes: { group: "fruit", iron: false, allergens: [], texture: "finger" },
  raisins: { group: "fruit", iron: true, allergens: [], texture: "finger" },
  sultanas: { group: "fruit", iron: true, allergens: [], texture: "finger" },
  dates: { group: "fruit", iron: true, allergens: [], texture: "mashed" },
  figs: { group: "fruit", iron: true, allergens: [], texture: "mashed" },
  cherries: { group: "fruit", iron: false, allergens: [], texture: "mashed" },
  pineapple: { group: "fruit", iron: false, allergens: [], texture: "finger" },
  papaya: { group: "fruit", iron: false, allergens: [], texture: "mashed" },
  pomegranate: {
    group: "fruit",
    iron: false,
    allergens: [],
    texture: "mashed",
  },
  lemon: { group: "fruit", iron: false, allergens: [], texture: "mashed" },
  lime: { group: "fruit", iron: false, allergens: [], texture: "mashed" },
  gooseberries: {
    group: "fruit",
    iron: false,
    allergens: [],
    texture: "mashed",
  },
  rhubarb: { group: "fruit", iron: false, allergens: [], texture: "mashed" },

  // ============== VEGETABLES ==============
  "sweet potato": {
    group: "veg",
    iron: false,
    allergens: [],
    texture: "mashed",
  },
  potato: { group: "veg", iron: false, allergens: [], texture: "mashed" },
  "mashed potato": {
    group: "veg",
    iron: false,
    allergens: ["dairy"],
    texture: "mashed",
  },
  "jacket potato": {
    group: "veg",
    iron: false,
    allergens: [],
    texture: "mashed",
  },
  "new potatoes": {
    group: "veg",
    iron: false,
    allergens: [],
    texture: "mashed",
  },
  carrot: { group: "veg", iron: false, allergens: [], texture: "mashed" },
  broccoli: { group: "veg", iron: false, allergens: [], texture: "finger" },
  "tenderstem broccoli": {
    group: "veg",
    iron: false,
    allergens: [],
    texture: "finger",
  },
  cauliflower: { group: "veg", iron: false, allergens: [], texture: "mashed" },
  spinach: { group: "veg", iron: true, allergens: [], texture: "puree" },
  kale: { group: "veg", iron: true, allergens: [], texture: "puree" },
  "spring greens": {
    group: "veg",
    iron: true,
    allergens: [],
    texture: "puree",
  },
  cabbage: { group: "veg", iron: false, allergens: [], texture: "mashed" },
  "savoy cabbage": {
    group: "veg",
    iron: false,
    allergens: [],
    texture: "mashed",
  },
  "red cabbage": {
    group: "veg",
    iron: false,
    allergens: [],
    texture: "mashed",
  },
  "pak choi": { group: "veg", iron: true, allergens: [], texture: "mashed" },
  lettuce: { group: "veg", iron: false, allergens: [], texture: "finger" },
  rocket: { group: "veg", iron: true, allergens: [], texture: "finger" },
  peas: { group: "veg", iron: true, allergens: [], texture: "mashed" },
  mangetout: { group: "veg", iron: true, allergens: [], texture: "finger" },
  "sugar snap peas": {
    group: "veg",
    iron: true,
    allergens: [],
    texture: "finger",
  },
  "green beans": {
    group: "veg",
    iron: false,
    allergens: [],
    texture: "mashed",
  },
  "runner beans": {
    group: "veg",
    iron: false,
    allergens: [],
    texture: "mashed",
  },
  courgette: { group: "veg", iron: false, allergens: [], texture: "mashed" },
  zucchini: { group: "veg", iron: false, allergens: [], texture: "mashed" },
  aubergine: { group: "veg", iron: false, allergens: [], texture: "mashed" },
  "butternut squash": {
    group: "veg",
    iron: false,
    allergens: [],
    texture: "mashed",
  },
  pumpkin: { group: "veg", iron: false, allergens: [], texture: "mashed" },
  parsnip: { group: "veg", iron: false, allergens: [], texture: "mashed" },
  swede: { group: "veg", iron: false, allergens: [], texture: "mashed" },
  turnip: { group: "veg", iron: false, allergens: [], texture: "mashed" },
  celeriac: { group: "veg", iron: false, allergens: [], texture: "mashed" },
  cucumber: { group: "veg", iron: false, allergens: [], texture: "finger" },
  tomato: { group: "veg", iron: false, allergens: [], texture: "mashed" },
  "cherry tomatoes": {
    group: "veg",
    iron: false,
    allergens: [],
    texture: "finger",
  },
  beetroot: { group: "veg", iron: true, allergens: [], texture: "mashed" },
  "red pepper": { group: "veg", iron: false, allergens: [], texture: "finger" },
  "yellow pepper": {
    group: "veg",
    iron: false,
    allergens: [],
    texture: "finger",
  },
  "green pepper": {
    group: "veg",
    iron: false,
    allergens: [],
    texture: "finger",
  },
  mushroom: { group: "veg", iron: false, allergens: [], texture: "mashed" },
  onion: { group: "veg", iron: false, allergens: [], texture: "mashed" },
  leek: { group: "veg", iron: false, allergens: [], texture: "mashed" },
  garlic: { group: "veg", iron: false, allergens: [], texture: "puree" },
  celery: { group: "veg", iron: false, allergens: [], texture: "mashed" },
  asparagus: { group: "veg", iron: false, allergens: [], texture: "finger" },
  sweetcorn: { group: "veg", iron: false, allergens: [], texture: "finger" },
  "corn on the cob": {
    group: "veg",
    iron: false,
    allergens: [],
    texture: "finger",
  },
  "brussels sprouts": {
    group: "veg",
    iron: true,
    allergens: [],
    texture: "mashed",
  },
  fennel: { group: "veg", iron: false, allergens: [], texture: "mashed" },
  artichoke: { group: "veg", iron: false, allergens: [], texture: "mashed" },
  olives: { group: "veg", iron: false, allergens: [], texture: "finger" },

  // ============== FATS, NUTS & SEEDS ==============
  "peanut butter": {
    group: "fat",
    iron: false,
    allergens: ["peanut"],
    texture: "puree",
  },
  "smooth peanut butter": {
    group: "fat",
    iron: false,
    allergens: ["peanut"],
    texture: "puree",
  },
  "almond butter": {
    group: "fat",
    iron: false,
    allergens: ["tree nut"],
    texture: "puree",
  },
  "cashew butter": {
    group: "fat",
    iron: false,
    allergens: ["tree nut"],
    texture: "puree",
  },
  tahini: { group: "fat", iron: true, allergens: ["sesame"], texture: "puree" },
  "olive oil": { group: "fat", iron: false, allergens: [], texture: "puree" },
  butter: { group: "fat", iron: false, allergens: ["dairy"], texture: "puree" },
  "unsalted butter": {
    group: "fat",
    iron: false,
    allergens: ["dairy"],
    texture: "puree",
  },
  coconut: { group: "fat", iron: false, allergens: [], texture: "mashed" },
  "coconut milk": {
    group: "fat",
    iron: false,
    allergens: [],
    texture: "puree",
  },
  "coconut yogurt": {
    group: "dairy",
    iron: false,
    allergens: [],
    texture: "puree",
  },
  "chia seeds": { group: "fat", iron: true, allergens: [], texture: "puree" },
  flaxseed: { group: "fat", iron: true, allergens: [], texture: "puree" },
  "hemp seeds": { group: "fat", iron: true, allergens: [], texture: "puree" },
  "sunflower seed butter": {
    group: "fat",
    iron: true,
    allergens: [],
    texture: "puree",
  },

  // ============== UK BABY POUCHES & BRANDS ==============
  "ella's kitchen pouch": {
    group: "other",
    iron: false,
    allergens: [],
    texture: "puree",
  },
  "ellas kitchen pouch": {
    group: "other",
    iron: false,
    allergens: [],
    texture: "puree",
  },
  "organix pouch": {
    group: "other",
    iron: false,
    allergens: [],
    texture: "puree",
  },
  "piccolo pouch": {
    group: "other",
    iron: false,
    allergens: [],
    texture: "puree",
  },
  "heinz pouch": {
    group: "other",
    iron: false,
    allergens: [],
    texture: "puree",
  },
  "aldi mamia pouch": {
    group: "other",
    iron: false,
    allergens: [],
    texture: "puree",
  },
  "baby pouch": {
    group: "other",
    iron: false,
    allergens: [],
    texture: "puree",
  },
  "fruit pouch": {
    group: "fruit",
    iron: false,
    allergens: [],
    texture: "puree",
  },
  "organix carrot sticks": {
    group: "grain",
    iron: false,
    allergens: [],
    texture: "finger",
  },
  "organix puffs": {
    group: "grain",
    iron: false,
    allergens: [],
    texture: "finger",
  },
  "organix rice cakes": {
    group: "grain",
    iron: false,
    allergens: [],
    texture: "finger",
  },
  "kiddylicious wafers": {
    group: "grain",
    iron: false,
    allergens: [],
    texture: "finger",
  },
  "baby corn puffs": {
    group: "grain",
    iron: false,
    allergens: [],
    texture: "finger",
  },
  "baby biscuits": {
    group: "grain",
    iron: false,
    allergens: ["wheat"],
    texture: "finger",
  },
  rusks: {
    group: "grain",
    iron: true,
    allergens: ["wheat"],
    texture: "finger",
  },

  // ============== COMPOSITE / PREPARED MEALS ==============
  "shepherds pie": {
    group: "protein",
    iron: true,
    allergens: ["dairy"],
    texture: "mashed",
  },
  "shepherd's pie": {
    group: "protein",
    iron: true,
    allergens: ["dairy"],
    texture: "mashed",
  },
  "cottage pie": {
    group: "protein",
    iron: true,
    allergens: ["dairy"],
    texture: "mashed",
  },
  "mac and cheese": {
    group: "grain",
    iron: false,
    allergens: ["wheat", "dairy"],
    texture: "mashed",
  },
  "macaroni cheese": {
    group: "grain",
    iron: false,
    allergens: ["wheat", "dairy"],
    texture: "mashed",
  },
  "cauliflower cheese": {
    group: "veg",
    iron: false,
    allergens: ["dairy"],
    texture: "mashed",
  },
  dahl: { group: "protein", iron: true, allergens: [], texture: "mashed" },
  dal: { group: "protein", iron: true, allergens: [], texture: "mashed" },
  "lentil dahl": {
    group: "protein",
    iron: true,
    allergens: [],
    texture: "mashed",
  },
  curry: { group: "protein", iron: true, allergens: [], texture: "mashed" },
  "chicken curry": {
    group: "protein",
    iron: true,
    allergens: [],
    texture: "mashed",
  },
  risotto: {
    group: "grain",
    iron: false,
    allergens: ["dairy"],
    texture: "mashed",
  },
  "pasta sauce": { group: "veg", iron: false, allergens: [], texture: "puree" },
  "tomato sauce": {
    group: "veg",
    iron: false,
    allergens: [],
    texture: "puree",
  },
  bolognese: { group: "protein", iron: true, allergens: [], texture: "mashed" },
  lasagne: {
    group: "protein",
    iron: true,
    allergens: ["wheat", "dairy"],
    texture: "mashed",
  },
  stew: { group: "protein", iron: true, allergens: [], texture: "mashed" },
  "beef stew": {
    group: "protein",
    iron: true,
    allergens: [],
    texture: "mashed",
  },
  casserole: { group: "protein", iron: true, allergens: [], texture: "mashed" },
  soup: { group: "veg", iron: false, allergens: [], texture: "puree" },
  "vegetable soup": {
    group: "veg",
    iron: false,
    allergens: [],
    texture: "puree",
  },
  "chicken soup": {
    group: "protein",
    iron: true,
    allergens: [],
    texture: "puree",
  },
  "tomato soup": { group: "veg", iron: false, allergens: [], texture: "puree" },
  "porridge with banana": {
    group: "grain",
    iron: false,
    allergens: [],
    texture: "puree",
  },
  "porridge with berries": {
    group: "grain",
    iron: false,
    allergens: [],
    texture: "mashed",
  },
  "porridge with peanut butter": {
    group: "grain",
    iron: false,
    allergens: ["peanut"],
    texture: "puree",
  },
  "avocado on toast": {
    group: "fat",
    iron: false,
    allergens: ["wheat"],
    texture: "finger",
  },
  "eggs on toast": {
    group: "protein",
    iron: true,
    allergens: ["egg", "wheat"],
    texture: "finger",
  },
  "beans on toast": {
    group: "protein",
    iron: true,
    allergens: ["wheat"],
    texture: "finger",
  },
  "cheese on toast": {
    group: "dairy",
    iron: false,
    allergens: ["wheat", "dairy"],
    texture: "finger",
  },
  "french toast": {
    group: "grain",
    iron: false,
    allergens: ["wheat", "egg", "dairy"],
    texture: "finger",
  },
  pancakes: {
    group: "grain",
    iron: false,
    allergens: ["wheat", "egg", "dairy"],
    texture: "finger",
  },
  "baby pancake": {
    group: "grain",
    iron: false,
    allergens: ["wheat", "egg", "dairy"],
    texture: "finger",
  },
  muffin: {
    group: "grain",
    iron: false,
    allergens: ["wheat", "egg", "dairy"],
    texture: "finger",
  },
  "banana bread": {
    group: "grain",
    iron: false,
    allergens: ["wheat", "egg", "dairy"],
    texture: "finger",
  },
  meatballs: { group: "protein", iron: true, allergens: [], texture: "finger" },
  "fish cakes": {
    group: "protein",
    iron: false,
    allergens: ["fish", "wheat"],
    texture: "finger",
  },
};

const ALL_ALLERGENS = [
  "egg",
  "dairy",
  "peanut",
  "tree nut",
  "soy",
  "wheat",
  "fish",
  "shellfish",
  "sesame",
];

const GROUP_META = {
  protein: { label: "Protein", color: "#B85042" },
  grain: { label: "Grain", color: "#C8884D" },
  fruit: { label: "Fruit", color: "#7B9E5A" },
  veg: { label: "Veg", color: "#5C8A6E" },
  dairy: { label: "Dairy", color: "#D4A574" },
  fat: { label: "Fat", color: "#A67C52" },
  other: { label: "Other", color: "#8B8680" },
};

// Lookup with fuzzy fallback
function lookupFood(name) {
  const key = name.toLowerCase().trim();
  // Exact match
  if (FOOD_DB[key]) return FOOD_DB[key];
  // Plural/singular
  if (FOOD_DB[key + "s"]) return FOOD_DB[key + "s"];
  if (key.endsWith("s") && FOOD_DB[key.slice(0, -1)])
    return FOOD_DB[key.slice(0, -1)];
  // Word-boundary match: prefer keys where a whole word matches
  const words = key.split(/\s+/);
  for (const w of words) {
    if (w.length >= 3 && FOOD_DB[w]) return FOOD_DB[w];
  }
  // Reverse word-boundary: typed word is a whole word in a key
  for (const k of Object.keys(FOOD_DB)) {
    const kWords = k.split(/\s+/);
    if (kWords.includes(key)) return FOOD_DB[k];
  }
  // Last resort: substring (less reliable, but better than nothing)
  for (const k of Object.keys(FOOD_DB)) {
    if (key.includes(k) || k.includes(key)) return FOOD_DB[k];
  }
  return { group: "other", iron: false, allergens: [], texture: "mashed" };
}

// Local date string YYYY-MM-DD (NOT UTC, so it matches what the user sees on their calendar)
function localDateStr(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// ============================================================
// APP
// ============================================================
export default function WeaningTracker() {
  const [meals, setMeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState("today"); // today | log | insights | plan
  const [showLogForm, setShowLogForm] = useState(false);
  const [selectedDate, setSelectedDate] = useState(() => localDateStr());
  const [debugInfo, setDebugInfo] = useState({ status: "init", message: "" });
  const [babyAge, setBabyAge] = useState(6); // months
  const [approach, setApproach] = useState("both"); // puree | blw | both

  // Load meals from storage
  useEffect(() => {
    (async () => {
      try {
        const result = await Store.list("meal:");
        const keys = result?.keys || [];
        const loaded = [];
        for (const key of keys) {
          try {
            const r = await Store.get(key);
            if (r?.value) {
              const parsed = JSON.parse(r.value);
              const safe = safeMeal(parsed);
              if (safe) loaded.push(safe);
            }
          } catch (e) {
            /* skip individual corrupt records, don't break the whole load */
          }
        }
        loaded.sort((a, b) => b.timestamp - a.timestamp);
        setMeals(loaded);
        // Load baby age
        try {
          const ageResult = await Store.get("settings:babyAge");
          if (ageResult?.value) setBabyAge(parseInt(ageResult.value, 10) || 6);
        } catch (e) {
          /* default to 6 */
        }
        // Load approach
        try {
          const approachResult = await Store.get("settings:approach");
          if (
            approachResult?.value &&
            ["puree", "blw", "both"].includes(approachResult.value)
          ) {
            setApproach(approachResult.value);
          }
        } catch (e) {
          /* default to both */
        }
        setDebugInfo({
          status: "loaded",
          message: `${loaded.length} meal(s) from storage`,
        });
      } catch (e) {
        setDebugInfo({
          status: "load-error",
          message: String(e?.message || e),
        });
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const saveMeal = async (meal) => {
    // Stamp the schema version so future migrations can target this record correctly
    const stamped = { ...meal, schemaVersion: CURRENT_SCHEMA_VERSION };
    // Optimistic update FIRST so the meal appears regardless of storage outcome
    setMeals((prev) =>
      [stamped, ...prev].sort((a, b) => b.timestamp - a.timestamp)
    );
    setSelectedDate(stamped.date);
    setView("today");
    // Then attempt to persist
    try {
      const result = await Store.set(
        `meal:${stamped.id}`,
        JSON.stringify(stamped)
      );
      if (result) {
        setDebugInfo({
          status: "saved",
          message: `Saved meal on ${stamped.date}`,
        });
      } else {
        setDebugInfo({
          status: "save-failed",
          message: "Storage returned null",
        });
      }
    } catch (e) {
      setDebugInfo({ status: "save-error", message: String(e?.message || e) });
    }
  };

  const deleteMeal = async (id) => {
    // Optimistic update first
    setMeals((prev) => prev.filter((m) => m.id !== id));
    try {
      await Store.delete(`meal:${id}`);
    } catch (e) {
      console.error("delete error", e);
    }
  };

  const updateBabyAge = async (age) => {
    setBabyAge(age);
    try {
      await Store.set("settings:babyAge", String(age));
    } catch (e) {
      /* ignore */
    }
  };

  const updateApproach = async (a) => {
    setApproach(a);
    try {
      await Store.set("settings:approach", a);
    } catch (e) {
      /* ignore */
    }
  };

  // Foods seen before (for "new food" detection)
  const seenFoods = useMemo(() => {
    const s = new Set();
    meals.forEach((m) =>
      m.foods.forEach((f) => s.add(f.name.toLowerCase().trim()))
    );
    return s;
  }, [meals]);

  return (
    <div
      className="min-h-screen bg-[#F5EFE6] text-[#2D2A26]"
      style={{ fontFamily: "'Fraunces', Georgia, serif" }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,300;9..144,400;9..144,500;9..144,600;9..144,700&family=Inter:wght@400;500;600&display=swap');
        body { font-family: 'Fraunces', Georgia, serif; }
        .body-text { font-family: 'Inter', system-ui, sans-serif; }
        .grain-bg {
          background-image:
            radial-gradient(circle at 1px 1px, rgba(45,42,38,0.04) 1px, transparent 0);
          background-size: 24px 24px;
        }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        .fade-up { animation: fadeUp 0.4s ease-out forwards; }
      `}</style>

      <div className="grain-bg min-h-screen">
        {/* Header */}
        <header className="px-5 pt-8 pb-4 max-w-2xl mx-auto">
          <div className="flex items-baseline justify-between">
            <div>
              <p className="body-text text-[10px] uppercase tracking-[0.25em] text-[#8B8680] mb-1">
                A weaning journal
              </p>
              <h1
                className="text-4xl font-medium tracking-tight"
                style={{ fontStyle: "italic" }}
              >
                First Tastes
              </h1>
            </div>
            <Sparkles size={20} className="text-[#B85042]" />
          </div>
          <div className="mt-6 h-px bg-[#2D2A26] opacity-10" />
        </header>

        {/* Nav */}
        <nav className="px-5 max-w-2xl mx-auto mb-6">
          <div className="flex gap-1 body-text text-xs overflow-x-auto -mx-5 px-5">
            {[
              { id: "today", label: "Today", icon: Calendar },
              { id: "log", label: "History", icon: BookOpen },
              { id: "insights", label: "Insights", icon: BarChart3 },
              { id: "support", label: "Support", icon: Heart },
              { id: "settings", label: "Settings", icon: Settings },
            ].map((t) => {
              const Icon = t.icon;
              return (
                <button
                  key={t.id}
                  onClick={() => {
                    setView(t.id);
                    if (t.id === "today") setSelectedDate(localDateStr());
                  }}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-full transition-all flex-shrink-0 ${
                    view === t.id
                      ? "bg-[#2D2A26] text-[#F5EFE6]"
                      : "text-[#8B8680] hover:text-[#2D2A26]"
                  }`}
                >
                  <Icon size={13} />
                  <span className="uppercase tracking-wider font-medium">
                    {t.label}
                  </span>
                </button>
              );
            })}
          </div>
        </nav>

        {/* Main */}
        <main className="px-5 max-w-2xl mx-auto pb-32">
          {loading ? (
            <div className="text-center py-20 body-text text-sm text-[#8B8680]">
              Loading…
            </div>
          ) : view === "today" ? (
            <TodayView
              meals={meals}
              selectedDate={selectedDate}
              setSelectedDate={setSelectedDate}
              onDelete={deleteMeal}
            />
          ) : view === "log" ? (
            <HistoryView meals={meals} onDelete={deleteMeal} />
          ) : view === "support" ? (
            <SupportView />
          ) : view === "settings" ? (
            <SettingsView
              meals={meals}
              babyAge={babyAge}
              onAgeChange={updateBabyAge}
              approach={approach}
              onApproachChange={updateApproach}
              onImported={() => window.location.reload()}
            />
          ) : (
            <InsightsView meals={meals} />
          )}
        </main>

        {/* Floating add button — hidden when modal open */}
        {!showLogForm && (
          <button
            onClick={() => setShowLogForm(true)}
            className="fixed bottom-6 right-6 left-6 max-w-2xl mx-auto bg-[#2D2A26] text-[#F5EFE6] py-4 px-6 rounded-full shadow-2xl flex items-center justify-center gap-2 body-text font-medium text-sm uppercase tracking-wider hover:bg-[#B85042] transition-colors"
            style={{ width: "calc(100% - 3rem)" }}
          >
            <Plus size={16} />
            Log a meal
          </button>
        )}

        {/* Log form modal */}
        {showLogForm && (
          <LogMealForm
            onClose={() => setShowLogForm(false)}
            onSave={saveMeal}
            seenFoods={seenFoods}
          />
        )}
      </div>
    </div>
  );
}

// ============================================================
// LOG MEAL FORM
// ============================================================
function LogMealForm({ onClose, onSave, seenFoods }) {
  const [mealType, setMealType] = useState(() => {
    const h = new Date().getHours();
    if (h < 10) return "breakfast";
    if (h < 14) return "lunch";
    if (h < 17) return "snack";
    return "dinner";
  });
  const [foodInput, setFoodInput] = useState("");
  const [foods, setFoods] = useState([]);
  const [texture, setTexture] = useState("mashed");
  const [notes, setNotes] = useState("");
  const [date, setDate] = useState(() => localDateStr());

  const suggestions = useMemo(() => {
    if (!foodInput.trim()) return [];
    const q = foodInput.toLowerCase().trim();
    // Score: prefix match > word-start match > substring match
    const scored = Object.keys(FOOD_DB)
      .filter((k) => k.includes(q) && !foods.some((f) => f.name === k))
      .map((k) => {
        let score = 0;
        if (k.startsWith(q)) score = 100; // prefix match
        else if (k.split(" ").some((w) => w.startsWith(q)))
          score = 50; // word-start in compound
        else score = 10; // substring
        // Tiebreak: shorter strings first (more specific)
        return { k, score: score - k.length * 0.1 };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 7)
      .map((s) => s.k);
    return scored;
  }, [foodInput, foods]);

  const addFood = (name) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const data = lookupFood(trimmed);
    setFoods((prev) => [
      ...prev,
      {
        name: trimmed,
        ...data,
        isNew: !seenFoods.has(trimmed.toLowerCase()),
        acceptance: null,
      },
    ]);
    setFoodInput("");
  };

  const removeFood = (i) =>
    setFoods((prev) => prev.filter((_, idx) => idx !== i));
  const setFoodAcceptance = (i, level) =>
    setFoods((prev) =>
      prev.map((f, idx) =>
        idx === i
          ? { ...f, acceptance: f.acceptance === level ? null : level }
          : f
      )
    );

  const [errorMsg, setErrorMsg] = useState("");

  const handleSubmit = () => {
    // Auto-add any pending text in the food input
    let finalFoods = foods;
    if (foodInput.trim()) {
      const trimmed = foodInput.trim();
      const data = lookupFood(trimmed);
      finalFoods = [
        ...foods,
        {
          name: trimmed,
          ...data,
          isNew: !seenFoods.has(trimmed.toLowerCase()),
        },
      ];
    }
    if (finalFoods.length === 0) {
      setErrorMsg("Add at least one food before saving.");
      return;
    }
    const today = localDateStr();
    const timestamp =
      date === today ? Date.now() : new Date(date + "T12:00:00").getTime();
    const meal = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      timestamp,
      date,
      mealType,
      foods: finalFoods,
      texture,
      notes: notes.trim(),
    };
    onSave(meal);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 fade-up"
      style={{ background: "#F5EFE6" }}
    >
      <div className="h-full w-full max-w-2xl mx-auto flex flex-col">
        {/* Modal header */}
        <div className="bg-[#F5EFE6] px-6 pt-6 pb-4 border-b border-[#2D2A26]/10 flex items-center justify-between flex-shrink-0">
          <h2 className="text-2xl" style={{ fontStyle: "italic" }}>
            Log a meal
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-[#2D2A26]/5 rounded-full"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable form area */}
        <div
          className="flex-1 overflow-y-auto p-6 pb-24 space-y-6 body-text"
          style={{ background: "#F5EFE6" }}
        >
          {/* Date + meal type */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] uppercase tracking-[0.2em] text-[#8B8680] mb-2">
                Date
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-white border border-[#2D2A26]/15 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#2D2A26]"
              />
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-[0.2em] text-[#8B8680] mb-2">
                Meal
              </label>
              <select
                value={mealType}
                onChange={(e) => setMealType(e.target.value)}
                className="w-full bg-white border border-[#2D2A26]/15 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#2D2A26]"
              >
                <option value="breakfast">Breakfast</option>
                <option value="lunch">Lunch</option>
                <option value="dinner">Dinner</option>
                <option value="snack">Snack</option>
              </select>
            </div>
          </div>

          {/* Foods */}
          <div>
            <label className="block text-[10px] uppercase tracking-[0.2em] text-[#8B8680] mb-2">
              Foods offered
            </label>
            <div className="relative">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={foodInput}
                  onChange={(e) => setFoodInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addFood(foodInput);
                    }
                  }}
                  placeholder="Banana, porridge, etc."
                  className="flex-1 bg-white border border-[#2D2A26]/15 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#2D2A26]"
                />
                <button
                  type="button"
                  onClick={() => addFood(foodInput)}
                  disabled={!foodInput.trim()}
                  className="px-4 bg-[#B85042] text-white rounded-xl text-xs font-semibold uppercase tracking-wider disabled:opacity-30"
                >
                  Add
                </button>
              </div>
              {suggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-[#2D2A26]/15 rounded-xl shadow-lg z-10 overflow-hidden">
                  {suggestions.map((s) => (
                    <button
                      key={s}
                      onClick={() => addFood(s)}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-[#F5EFE6] capitalize"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <p className="text-[10px] text-[#8B8680] mt-1.5">
              Tap Add (or hit Enter) for each food. Optionally tap Loved / Tried
              / Refused for each.
            </p>

            {/* Food chips with optional acceptance ratings */}
            {foods.length > 0 && (
              <div className="mt-3 space-y-2">
                {foods.map((f, i) => {
                  const ratings = [
                    { id: "loved", label: "Loved", emoji: "😋" },
                    { id: "tried", label: "Tried", emoji: "🙂" },
                    { id: "refused", label: "Refused", emoji: "😣" },
                  ];
                  return (
                    <div
                      key={i}
                      className="bg-white border border-[#2D2A26]/15 rounded-xl p-2.5"
                    >
                      {/* Row 1: name + badges + remove */}
                      <div className="flex items-center gap-1.5 mb-2">
                        <span
                          className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                          style={{ background: GROUP_META[f.group].color }}
                        />
                        <span className="capitalize font-medium text-sm flex-1 truncate">
                          {f.name}
                        </span>
                        {f.isNew && (
                          <span className="text-[9px] uppercase tracking-wider text-[#B85042] font-semibold">
                            new
                          </span>
                        )}
                        {f.iron && (
                          <span
                            className="text-[9px] text-[#8B8680]"
                            title="iron"
                          >
                            Fe
                          </span>
                        )}
                        <button
                          onClick={() => removeFood(i)}
                          className="w-6 h-6 rounded-full hover:bg-[#2D2A26]/10 flex items-center justify-center flex-shrink-0"
                          aria-label="Remove food"
                        >
                          <X size={12} />
                        </button>
                      </div>
                      {/* Row 2: optional acceptance rating */}
                      <div className="flex gap-1.5">
                        {ratings.map((r) => (
                          <button
                            key={r.id}
                            onClick={() => setFoodAcceptance(i, r.id)}
                            className={`flex-1 py-1.5 px-1 rounded-lg text-[11px] font-medium flex items-center justify-center gap-1 transition-all ${
                              f.acceptance === r.id
                                ? "bg-[#2D2A26] text-[#F5EFE6]"
                                : "bg-[#F5EFE6] text-[#8B8680] hover:bg-[#2D2A26]/5"
                            }`}
                          >
                            <span>{r.emoji}</span>
                            <span>{r.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Texture */}
          <div>
            <label className="block text-[10px] uppercase tracking-[0.2em] text-[#8B8680] mb-2">
              Texture
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: "finger", label: "Finger food" },
                { id: "mashed", label: "Mashed" },
                { id: "both", label: "Both" },
              ].map((o) => (
                <button
                  key={o.id}
                  onClick={() => setTexture(o.id)}
                  className={`py-2.5 px-2 rounded-xl text-xs font-medium transition-all ${
                    texture === o.id
                      ? "bg-[#2D2A26] text-[#F5EFE6]"
                      : "bg-white border border-[#2D2A26]/15 text-[#2D2A26]"
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-[10px] uppercase tracking-[0.2em] text-[#8B8680] mb-2">
              Notes (optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Teething, fed by Dad, etc."
              className="w-full bg-white border border-[#2D2A26]/15 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#2D2A26] resize-none"
            />
          </div>

          {/* Submit */}
          {errorMsg && (
            <div className="bg-[#B85042]/10 border border-[#B85042]/30 text-[#B85042] text-xs rounded-xl px-3 py-2.5">
              {errorMsg}
            </div>
          )}
          <button
            onClick={handleSubmit}
            className="w-full bg-[#2D2A26] text-[#F5EFE6] py-3.5 rounded-xl font-medium text-sm uppercase tracking-wider hover:bg-[#B85042] transition-colors"
          >
            Save meal
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// TODAY VIEW
// ============================================================
function TodayView({ meals, selectedDate, setSelectedDate, onDelete }) {
  const dayMeals = meals.filter((m) => m.date === selectedDate);

  const todaysFoods = dayMeals.flatMap((m) => m.foods);
  const groups = todaysFoods.reduce((acc, f) => {
    acc[f.group] = (acc[f.group] || 0) + 1;
    return acc;
  }, {});

  const shiftDate = (delta) => {
    const d = new Date(selectedDate + "T12:00:00");
    d.setDate(d.getDate() + delta);
    setSelectedDate(localDateStr(d));
  };

  const dateLabel = useMemo(() => {
    const d = new Date(selectedDate + "T12:00:00");
    const today = localDateStr();
    const yest = new Date();
    yest.setDate(yest.getDate() - 1);
    if (selectedDate === today) return "Today";
    if (selectedDate === localDateStr(yest)) return "Yesterday";
    return d.toLocaleDateString("en-GB", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
  }, [selectedDate]);

  return (
    <div className="fade-up">
      {/* Date stepper */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={() => shiftDate(-1)}
          className="p-2 hover:bg-[#2D2A26]/5 rounded-full"
        >
          <ChevronLeft size={18} />
        </button>
        <div className="text-center">
          <p className="body-text text-[10px] uppercase tracking-[0.25em] text-[#8B8680]">
            Viewing
          </p>
          <h2 className="text-2xl" style={{ fontStyle: "italic" }}>
            {dateLabel}
          </h2>
        </div>
        <button
          onClick={() => shiftDate(1)}
          disabled={selectedDate >= localDateStr()}
          className="p-2 hover:bg-[#2D2A26]/5 rounded-full disabled:opacity-20"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      {/* Quick stats */}
      {dayMeals.length > 0 && (
        <div className="bg-white rounded-2xl p-5 mb-5 border border-[#2D2A26]/8">
          <div className="grid grid-cols-3 gap-4 body-text text-center">
            <div>
              <p
                className="text-3xl font-medium"
                style={{ fontFamily: "Fraunces" }}
              >
                {dayMeals.length}
              </p>
              <p className="text-[10px] uppercase tracking-[0.2em] text-[#8B8680] mt-1">
                Meals
              </p>
            </div>
            <div>
              <p
                className="text-3xl font-medium"
                style={{ fontFamily: "Fraunces" }}
              >
                {new Set(todaysFoods.map((f) => f.name)).size}
              </p>
              <p className="text-[10px] uppercase tracking-[0.2em] text-[#8B8680] mt-1">
                Foods
              </p>
            </div>
            <div>
              <p
                className="text-3xl font-medium"
                style={{ fontFamily: "Fraunces" }}
              >
                {Object.keys(groups).length}
              </p>
              <p className="text-[10px] uppercase tracking-[0.2em] text-[#8B8680] mt-1">
                Groups
              </p>
            </div>
          </div>

          {/* Group bar */}
          {Object.keys(groups).length > 0 && (
            <div className="mt-4 flex h-1.5 rounded-full overflow-hidden">
              {Object.entries(groups).map(([g, c]) => (
                <div
                  key={g}
                  style={{
                    width: `${(c / todaysFoods.length) * 100}%`,
                    background: GROUP_META[g].color,
                  }}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Meal list */}
      {dayMeals.length === 0 ? (
        <div className="text-center py-16 body-text">
          <p className="text-sm text-[#8B8680]">
            No meals logged for this day.
          </p>
          <p className="text-xs text-[#8B8680] mt-1">
            Tap the button below to add one.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {dayMeals.map((m) => (
            <MealCard key={m.id} meal={m} onDelete={onDelete} />
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================
// MEAL CARD
// ============================================================
function MealCard({ meal, onDelete }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const time = new Date(meal.timestamp).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const textureLabel =
    { finger: "Finger food", mashed: "Mashed", both: "Finger & mashed" }[
      meal.texture
    ] || meal.texture;

  return (
    <article className="bg-white rounded-2xl p-5 border border-[#2D2A26]/8 fade-up">
      <header className="flex items-start justify-between mb-3">
        <div>
          <p className="body-text text-[10px] uppercase tracking-[0.25em] text-[#B85042] font-semibold">
            {meal.mealType}
          </p>
          <p className="body-text text-xs text-[#8B8680] mt-0.5">{time}</p>
        </div>
        <button
          onClick={() => {
            if (confirmDelete) {
              onDelete(meal.id);
            } else {
              setConfirmDelete(true);
              // Auto-reset after 3 seconds if user doesn't confirm
              setTimeout(() => setConfirmDelete(false), 3000);
            }
          }}
          className={`px-2 py-1.5 rounded-full transition-colors body-text text-[10px] font-semibold uppercase tracking-wider flex items-center gap-1 ${
            confirmDelete
              ? "bg-[#B85042] text-white"
              : "hover:bg-[#2D2A26]/5 text-[#8B8680]"
          }`}
        >
          {confirmDelete ? (
            <>
              <Check size={12} strokeWidth={3} />
              <span>Confirm</span>
            </>
          ) : (
            <Trash2 size={14} />
          )}
        </button>
      </header>

      <div className="flex flex-wrap gap-1.5 mb-3">
        {meal.foods.map((f, i) => {
          const emoji =
            f.acceptance === "loved"
              ? "😋"
              : f.acceptance === "tried"
              ? "🙂"
              : f.acceptance === "refused"
              ? "😣"
              : null;
          return (
            <span
              key={i}
              className="body-text inline-flex items-center gap-1 bg-[#F5EFE6] px-2.5 py-1 rounded-full text-xs capitalize"
            >
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ background: GROUP_META[f.group].color }}
              />
              {f.name}
              {emoji && (
                <span className="text-[11px] ml-0.5" title={f.acceptance}>
                  {emoji}
                </span>
              )}
              {f.isNew && (
                <span className="text-[9px] uppercase tracking-wider text-[#B85042] font-bold ml-0.5">
                  new
                </span>
              )}
            </span>
          );
        })}
      </div>

      <div className="body-text flex items-center gap-3 text-xs text-[#8B8680]">
        <span>{textureLabel}</span>
        {meal.foods.some((f) => f.iron) && (
          <>
            <span className="w-1 h-1 rounded-full bg-[#8B8680]" />
            <span className="text-[#7B9E5A] font-medium">Iron ✓</span>
          </>
        )}
      </div>

      {meal.notes && (
        <p className="body-text text-xs text-[#2D2A26]/70 mt-3 pt-3 border-t border-[#2D2A26]/8 italic">
          {meal.notes}
        </p>
      )}
    </article>
  );
}

// ============================================================
// HISTORY VIEW
// ============================================================
function HistoryView({ meals, onDelete }) {
  const grouped = useMemo(() => {
    const g = {};
    meals.forEach((m) => {
      if (!g[m.date]) g[m.date] = [];
      g[m.date].push(m);
    });
    return g;
  }, [meals]);

  const dates = Object.keys(grouped).sort().reverse();

  if (meals.length === 0) {
    return (
      <div className="text-center py-16 body-text">
        <p className="text-sm text-[#8B8680]">No meals logged yet.</p>
      </div>
    );
  }

  return (
    <div className="fade-up space-y-6">
      {dates.map((date) => {
        const d = new Date(date + "T12:00:00");
        const today = localDateStr();
        const label =
          date === today
            ? "Today"
            : d.toLocaleDateString("en-GB", {
                weekday: "long",
                day: "numeric",
                month: "long",
              });
        return (
          <section key={date}>
            <h3 className="text-lg mb-3 py-2" style={{ fontStyle: "italic" }}>
              {label}
            </h3>
            <div className="space-y-3">
              {grouped[date].map((m) => (
                <MealCard key={m.id} meal={m} onDelete={onDelete} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

// ============================================================
// INSIGHTS VIEW
// ============================================================
function InsightsView({ meals }) {
  const last7 = useMemo(() => {
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return meals.filter((m) => m.timestamp >= cutoff);
  }, [meals]);

  const allFoods = last7.flatMap((m) => m.foods);
  const uniqueFoods = new Set(allFoods.map((f) => f.name.toLowerCase()));

  // Food frequency with per-occurrence acceptance ratings (chronological)
  const foodFrequency = useMemo(() => {
    const counts = {};
    // Sort meals by timestamp ascending so dots appear in order they happened
    const sortedMeals = [...meals].sort((a, b) => a.timestamp - b.timestamp);
    sortedMeals.forEach((m) =>
      m.foods.forEach((f) => {
        const k = f.name.toLowerCase();
        if (!counts[k])
          counts[k] = { count: 0, name: f.name, group: f.group, ratings: [] };
        counts[k].count += 1;
        counts[k].ratings.push(f.acceptance || null); // null for unrated
      })
    );
    return Object.values(counts).sort((a, b) => b.count - a.count);
  }, [meals]);

  // Group balance
  const groupCounts = allFoods.reduce((acc, f) => {
    acc[f.group] = (acc[f.group] || 0) + 1;
    return acc;
  }, {});

  // Allergens introduced (all-time)
  const allergensIntroduced = new Set();
  meals.forEach((m) =>
    m.foods.forEach((f) =>
      f.allergens.forEach((a) => allergensIntroduced.add(a))
    )
  );

  // Acceptance patterns (all-time)
  const acceptanceByFood = useMemo(() => {
    const map = {};
    meals.forEach((m) =>
      m.foods.forEach((f) => {
        if (!f.acceptance) return;
        const k = f.name.toLowerCase();
        if (!map[k])
          map[k] = {
            name: f.name,
            group: f.group,
            loved: 0,
            tried: 0,
            refused: 0,
            total: 0,
          };
        map[k][f.acceptance] = (map[k][f.acceptance] || 0) + 1;
        map[k].total += 1;
      })
    );
    return Object.values(map).sort((a, b) => b.total - a.total);
  }, [meals]);

  const totalRated = acceptanceByFood.reduce((s, f) => s + f.total, 0);
  const totalLoved = acceptanceByFood.reduce((s, f) => s + f.loved, 0);
  const totalTried = acceptanceByFood.reduce((s, f) => s + f.tried, 0);
  const totalRefused = acceptanceByFood.reduce((s, f) => s + f.refused, 0);

  // Days since last iron-rich meal
  const lastIron = meals.find((m) => m.foods.some((f) => f.iron));
  const daysSinceIron = lastIron
    ? Math.floor((Date.now() - lastIron.timestamp) / (24 * 60 * 60 * 1000))
    : null;

  if (meals.length === 0) {
    return (
      <div className="text-center py-16 body-text">
        <p className="text-sm text-[#8B8680]">
          Log a few meals to see insights.
        </p>
      </div>
    );
  }

  return (
    <div className="fade-up space-y-5">
      <div>
        <p className="body-text text-[10px] uppercase tracking-[0.25em] text-[#8B8680] mb-1">
          Past 7 days
        </p>
        <h2 className="text-3xl" style={{ fontStyle: "italic" }}>
          The picture so far
        </h2>
      </div>

      {/* Top stats */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard value={uniqueFoods.size} label="Unique foods" />
        <StatCard value={last7.length} label="Meals logged" />
      </div>

      {/* Iron */}
      <div className="bg-white rounded-2xl p-5 border border-[#2D2A26]/8">
        <div className="flex items-center justify-between">
          <div>
            <p className="body-text text-[10px] uppercase tracking-[0.25em] text-[#8B8680]">
              Iron
            </p>
            <p className="text-xl mt-1" style={{ fontStyle: "italic" }}>
              {daysSinceIron === null
                ? "No iron-rich meals yet"
                : daysSinceIron === 0
                ? "Today ✓"
                : `${daysSinceIron} day${daysSinceIron === 1 ? "" : "s"} ago`}
            </p>
          </div>
          <div
            className={`text-3xl ${
              daysSinceIron !== null && daysSinceIron <= 1
                ? "text-[#7B9E5A]"
                : "text-[#C8884D]"
            }`}
          >
            Fe
          </div>
        </div>
        <p className="body-text text-xs text-[#8B8680] mt-2">
          From 6 months, aim for iron-rich foods most days — meat, fish, eggs,
          lentils, fortified cereal, dark greens.
        </p>
      </div>

      {/* Group balance */}
      {Object.keys(groupCounts).length > 0 && (
        <div className="bg-white rounded-2xl p-5 border border-[#2D2A26]/8">
          <p className="body-text text-[10px] uppercase tracking-[0.25em] text-[#8B8680] mb-3">
            Food group balance · 7 days
          </p>
          <div className="flex h-3 rounded-full overflow-hidden mb-3">
            {Object.entries(groupCounts).map(([g, c]) => (
              <div
                key={g}
                style={{
                  width: `${(c / allFoods.length) * 100}%`,
                  background: GROUP_META[g].color,
                }}
                title={`${GROUP_META[g].label}: ${c}`}
              />
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2 body-text text-xs">
            {Object.entries(groupCounts)
              .sort((a, b) => b[1] - a[1])
              .map(([g, c]) => (
                <div key={g} className="flex items-center gap-2">
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ background: GROUP_META[g].color }}
                  />
                  <span>{GROUP_META[g].label}</span>
                  <span className="text-[#8B8680] ml-auto">{c}</span>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Allergens checklist */}
      <div className="bg-white rounded-2xl p-5 border border-[#2D2A26]/8">
        <p className="body-text text-[10px] uppercase tracking-[0.25em] text-[#8B8680] mb-3">
          Allergens · all time
        </p>
        <div className="space-y-1.5">
          {ALL_ALLERGENS.map((a) => {
            // Count exposures
            let count = 0;
            meals.forEach((m) =>
              m.foods.forEach((f) => {
                if (f.allergens.includes(a)) count += 1;
              })
            );
            const done = count > 0;
            return (
              <div
                key={a}
                className={`body-text flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm capitalize ${
                  done ? "bg-[#7B9E5A]/10" : "bg-[#F5EFE6]"
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 ${
                    done
                      ? "bg-[#5C8A6E] text-white"
                      : "border-2 border-[#2D2A26]/20"
                  }`}
                >
                  {done && <Check size={12} strokeWidth={3} />}
                </div>
                <span
                  className={`flex-1 ${
                    done ? "text-[#2D2A26]" : "text-[#8B8680]"
                  }`}
                >
                  {a}
                </span>
                <span
                  className={`body-text text-xs ${
                    done ? "text-[#5C8A6E] font-semibold" : "text-[#8B8680]"
                  }`}
                >
                  {count === 0 ? "Not yet" : `${count}× offered`}
                </span>
              </div>
            );
          })}
        </div>
        <p className="body-text text-xs text-[#8B8680] mt-3">
          The NHS recommends introducing each of the 9 common allergens early
          and often, one at a time, ideally before 12 months. Each allergen
          usually needs several exposures.
        </p>
      </div>

      {/* Food frequency with acceptance dots */}
      {foodFrequency.length > 0 && (
        <div className="bg-white rounded-2xl p-5 border border-[#2D2A26]/8">
          <p className="body-text text-[10px] uppercase tracking-[0.25em] text-[#8B8680] mb-1">
            Food frequency · all time
          </p>
          <p className="body-text text-[11px] text-[#8B8680] mb-4">
            Each dot is one time the food was offered. Colour shows how it went.
          </p>

          {/* Summary tiles — only shown if there are any ratings */}
          {totalRated > 0 && (
            <div className="grid grid-cols-3 gap-2 mb-4">
              <div className="text-center bg-[#F5EFE6] rounded-xl py-3">
                <span
                  className="inline-block w-2.5 h-2.5 rounded-full mb-1.5"
                  style={{ background: "#7B9E5A" }}
                />
                <p
                  className="text-xl font-medium"
                  style={{ fontFamily: "Fraunces" }}
                >
                  {totalLoved}
                </p>
                <p className="text-[9px] uppercase tracking-wider text-[#8B8680] mt-0.5">
                  Loved
                </p>
              </div>
              <div className="text-center bg-[#F5EFE6] rounded-xl py-3">
                <span
                  className="inline-block w-2.5 h-2.5 rounded-full mb-1.5"
                  style={{ background: "#C8884D" }}
                />
                <p
                  className="text-xl font-medium"
                  style={{ fontFamily: "Fraunces" }}
                >
                  {totalTried}
                </p>
                <p className="text-[9px] uppercase tracking-wider text-[#8B8680] mt-0.5">
                  Tried
                </p>
              </div>
              <div className="text-center bg-[#F5EFE6] rounded-xl py-3">
                <span
                  className="inline-block w-2.5 h-2.5 rounded-full mb-1.5"
                  style={{ background: "#B85042" }}
                />
                <p
                  className="text-xl font-medium"
                  style={{ fontFamily: "Fraunces" }}
                >
                  {totalRefused}
                </p>
                <p className="text-[9px] uppercase tracking-wider text-[#8B8680] mt-0.5">
                  Refused
                </p>
              </div>
            </div>
          )}

          {/* Legend — only shown if there are any ratings */}
          {totalRated > 0 && (
            <div className="flex flex-wrap items-center gap-3 mb-3 body-text text-[10px] text-[#8B8680]">
              <span className="flex items-center gap-1">
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ background: "#7B9E5A" }}
                />{" "}
                Loved
              </span>
              <span className="flex items-center gap-1">
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ background: "#C8884D" }}
                />{" "}
                Tried
              </span>
              <span className="flex items-center gap-1">
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ background: "#B85042" }}
                />{" "}
                Refused
              </span>
              <span className="flex items-center gap-1">
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ background: "#D4CFC7" }}
                />{" "}
                Not rated
              </span>
            </div>
          )}

          {/* Per-food rows with one dot per offer */}
          <div className="space-y-2">
            {foodFrequency.map((f) => (
              <div
                key={f.name}
                className="body-text flex items-center gap-2.5 text-xs"
              >
                <span
                  className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                  style={{ background: GROUP_META[f.group].color }}
                />
                <span className="capitalize w-24 flex-shrink-0 truncate">
                  {f.name}
                </span>
                <div className="flex-1 flex flex-wrap items-center gap-1">
                  {f.ratings.map((r, idx) => {
                    const colour =
                      r === "loved"
                        ? "#7B9E5A"
                        : r === "tried"
                        ? "#C8884D"
                        : r === "refused"
                        ? "#B85042"
                        : "#D4CFC7"; // unrated grey
                    const title = r
                      ? r.charAt(0).toUpperCase() + r.slice(1)
                      : "Not rated";
                    return (
                      <span
                        key={idx}
                        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                        style={{ background: colour }}
                        title={title}
                      />
                    );
                  })}
                </div>
                <span className="text-[#8B8680] w-8 text-right font-medium">
                  {f.count}×
                </span>
              </div>
            ))}
          </div>

          {totalRated > 0 && (
            <p className="body-text text-xs text-[#8B8680] mt-3">
              Babies often need to try a food 8-10 times before accepting it.
              Don't give up after one or two refusals — try again in a few days.
            </p>
          )}
        </div>
      )}

      {/* Quick review table */}
      <div className="bg-white rounded-2xl border border-[#2D2A26]/8 overflow-hidden">
        <div className="px-5 pt-5 pb-3">
          <p className="body-text text-[10px] uppercase tracking-[0.25em] text-[#8B8680]">
            Quick review
          </p>
          <p className="text-lg mt-0.5" style={{ fontStyle: "italic" }}>
            All logged meals
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full body-text text-xs">
            <thead className="bg-[#F5EFE6] text-[#8B8680]">
              <tr>
                <th className="text-left px-3 py-2 uppercase tracking-wider text-[10px] font-semibold whitespace-nowrap">
                  Date
                </th>
                <th className="text-left px-3 py-2 uppercase tracking-wider text-[10px] font-semibold whitespace-nowrap">
                  Meal
                </th>
                <th className="text-left px-3 py-2 uppercase tracking-wider text-[10px] font-semibold">
                  Foods
                </th>
                <th className="text-left px-3 py-2 uppercase tracking-wider text-[10px] font-semibold whitespace-nowrap">
                  Texture
                </th>
                <th className="text-left px-3 py-2 uppercase tracking-wider text-[10px] font-semibold whitespace-nowrap">
                  Groups
                </th>
                <th className="text-center px-3 py-2 uppercase tracking-wider text-[10px] font-semibold">
                  Iron
                </th>
                <th className="text-left px-3 py-2 uppercase tracking-wider text-[10px] font-semibold">
                  Allergens
                </th>
                <th className="text-left px-3 py-2 uppercase tracking-wider text-[10px] font-semibold">
                  Notes
                </th>
              </tr>
            </thead>
            <tbody>
              {meals.map((m) => {
                const dateStr = new Date(
                  m.date + "T12:00:00"
                ).toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "short",
                });
                const groups = [
                  ...new Set(m.foods.map((f) => GROUP_META[f.group].label)),
                ].join(", ");
                const allergens = [
                  ...new Set(m.foods.flatMap((f) => f.allergens)),
                ].join(", ");
                const hasIron = m.foods.some((f) => f.iron);
                const textureLabel =
                  { finger: "Finger", mashed: "Mashed", both: "Both" }[
                    m.texture
                  ] || "—";
                return (
                  <tr key={m.id} className="border-t border-[#2D2A26]/5">
                    <td className="px-3 py-2.5 whitespace-nowrap text-[#8B8680]">
                      {dateStr}
                    </td>
                    <td className="px-3 py-2.5 capitalize whitespace-nowrap">
                      {m.mealType}
                    </td>
                    <td className="px-3 py-2.5 capitalize">
                      {m.foods.map((f, i) => {
                        const dotColour =
                          f.acceptance === "loved"
                            ? "#7B9E5A"
                            : f.acceptance === "tried"
                            ? "#C8884D"
                            : f.acceptance === "refused"
                            ? "#B85042"
                            : null;
                        return (
                          <span key={i}>
                            {i > 0 && ", "}
                            {f.name}
                            {dotColour && (
                              <span
                                className="inline-block w-1.5 h-1.5 rounded-full ml-1 align-middle"
                                style={{ background: dotColour }}
                                title={f.acceptance}
                              />
                            )}
                          </span>
                        );
                      })}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      {textureLabel}
                    </td>
                    <td className="px-3 py-2.5 text-[#8B8680] whitespace-nowrap">
                      {groups}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      {hasIron ? (
                        <span className="text-[#7B9E5A] font-semibold">✓</span>
                      ) : (
                        <span className="text-[#8B8680]">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 capitalize text-[#8B8680]">
                      {allergens || "—"}
                    </td>
                    <td className="px-3 py-2.5 text-[#8B8680] italic">
                      {m.notes || "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {meals.length === 0 && (
          <p className="body-text text-xs text-[#8B8680] text-center py-6">
            No meals to review yet.
          </p>
        )}
      </div>
    </div>
  );
}

function StatCard({ value, label }) {
  return (
    <div className="bg-white rounded-2xl p-5 border border-[#2D2A26]/8">
      <p
        className="text-4xl font-medium"
        style={{ fontFamily: "Fraunces", fontStyle: "italic" }}
      >
        {value}
      </p>
      <p className="body-text text-[10px] uppercase tracking-[0.2em] text-[#8B8680] mt-1">
        {label}
      </p>
    </div>
  );
}

// ============================================================
// SUPPORT VIEW — share with friends, buy me a coffee
// ============================================================
function SupportView() {
  const [shareMessage, setShareMessage] = useState("");

  const shareApp = async () => {
    const url =
      CONFIG.appUrl ||
      (typeof window !== "undefined" ? window.location.href : "");
    const shareData = {
      title: CONFIG.shareTitle,
      text: CONFIG.shareText,
      url,
    };
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share(shareData);
        setShareMessage("Thanks for sharing!");
        setTimeout(() => setShareMessage(""), 3000);
        return;
      } catch (e) {
        if (e?.name === "AbortError") return;
      }
    }
    const fullText = `${CONFIG.shareText} ${url}`;
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(fullText);
        setShareMessage("Link copied to clipboard. Paste it to a friend.");
        setTimeout(() => setShareMessage(""), 4000);
        return;
      } catch (e) {
        /* fall through */
      }
    }
    setShareMessage(`Copy this link: ${url}`);
  };

  const coffeeConfigured =
    CONFIG.donateUrl && !CONFIG.donateUrl.includes("REPLACE-ME");

  return (
    <div className="fade-up space-y-5">
      <div>
        <p className="body-text text-[10px] uppercase tracking-[0.25em] text-[#8B8680] mb-1">
          Support
        </p>
        <h2 className="text-3xl" style={{ fontStyle: "italic" }}>
          If this has helped
        </h2>
        <p className="body-text text-sm text-[#8B8680] mt-2 leading-relaxed">
          This app is free and ad-free. It exists because a parent built it. Two
          small ways to help it keep going:
        </p>
      </div>

      {/* Recommend to a friend */}
      <div className="bg-white rounded-2xl p-5 border border-[#2D2A26]/8 body-text">
        <p className="text-[10px] uppercase tracking-[0.25em] text-[#8B8680] mb-1">
          Spread the word
        </p>
        <h3 className="text-lg mb-3" style={{ fontStyle: "italic" }}>
          Recommend to a friend
        </h3>
        <p className="text-xs text-[#8B8680] leading-relaxed mb-4">
          Know another parent doing weaning? This app spreads through word of
          mouth — no marketing budget, no ads. If it's been useful to you, the
          kindest thing you can do is mention it to someone else.
        </p>
        <button
          onClick={shareApp}
          className="w-full bg-[#2D2A26] text-[#F5EFE6] py-3 rounded-xl text-xs uppercase tracking-wider font-medium flex items-center justify-center gap-2 hover:bg-[#B85042] transition-colors"
        >
          <Share2 size={13} />
          Share
        </button>
        {shareMessage && (
          <p className="text-xs text-[#2D2A26] mt-3 text-center italic">
            {shareMessage}
          </p>
        )}
      </div>

      {/* Buy me a coffee */}
      {coffeeConfigured ? (
        (() => {
          const isKofi = CONFIG.donateUrl.includes("ko-fi.com");
          const buttonStyle = isKofi
            ? "bg-[#13C3FF] text-white" // Ko-fi blue
            : "bg-[#FFDD00] text-[#2D2A26]"; // Buy Me a Coffee yellow
          const buttonLabel = isKofi ? "Support on Ko-fi" : "Buy me a coffee";
          return (
            <div className="bg-white rounded-2xl p-5 border border-[#2D2A26]/8 body-text">
              <p className="text-[10px] uppercase tracking-[0.25em] text-[#8B8680] mb-1">
                Donations
              </p>
              <h3
                className="text-lg mb-3 flex items-center gap-2"
                style={{ fontStyle: "italic" }}
              >
                {isKofi ? "Support the app" : "Buy me a coffee"}
                <Heart size={14} className="text-[#B85042]" />
              </h3>
              <p className="text-xs text-[#8B8680] leading-relaxed mb-4">
                This app is free and always will be. If it's saved you time or
                made your weaning journey a little easier, a small tip helps
                cover hosting and keeps it going.
              </p>
              <a
                href={CONFIG.donateUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={`block w-full ${buttonStyle} py-3 rounded-xl text-xs uppercase tracking-wider font-semibold flex items-center justify-center gap-2 hover:opacity-90 transition-opacity`}
              >
                <Coffee size={13} />
                {buttonLabel}
              </a>
            </div>
          );
        })()
      ) : (
        <div className="bg-white/60 rounded-2xl p-5 border border-dashed border-[#2D2A26]/15 body-text">
          <p className="text-[10px] uppercase tracking-[0.25em] text-[#8B8680] mb-1">
            Donations
          </p>
          <h3 className="text-lg mb-2" style={{ fontStyle: "italic" }}>
            Donations not yet set up
          </h3>
          <p className="text-xs text-[#8B8680] leading-relaxed">
            The maker hasn't yet linked a donation page. If you want to support,
            sharing the app with another parent is just as helpful.
          </p>
        </div>
      )}

      {/* About / footer */}
      <div className="text-center pt-2">
        <p className="text-[10px] text-[#8B8680] leading-relaxed px-4">
          Thank you for using First Tastes.
        </p>
      </div>
    </div>
  );
}

// ============================================================
// SETTINGS VIEW — export/import data, reset
// ============================================================
function SettingsView({
  meals,
  babyAge,
  onAgeChange,
  approach,
  onApproachChange,
  onImported,
}) {
  const [importMessage, setImportMessage] = useState("");
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const exportData = () => {
    const data = {};
    // Gather all relevant localStorage keys
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (
        k &&
        (k.startsWith("meal:") ||
          k.startsWith("settings:") ||
          k.startsWith("plan:"))
      ) {
        data[k] = localStorage.getItem(k);
      }
    }
    const payload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      mealCount: meals.length,
      data,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `weaning-tracker-${localDateStr()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const generatePrintSummary = (downloadOnly = false) => {
    // Build a summary from the meals and open in a new window for printing
    const now = new Date();
    const dateRange = (() => {
      if (meals.length === 0) return "No meals logged";
      const sorted = [...meals].sort((a, b) => a.timestamp - b.timestamp);
      const first = new Date(sorted[0].timestamp).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });
      const last = new Date(
        sorted[sorted.length - 1].timestamp
      ).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });
      return first === last ? first : `${first} – ${last}`;
    })();

    // Foods and frequency
    const foodCounts = {};
    meals.forEach((m) =>
      m.foods.forEach((f) => {
        const k = f.name.toLowerCase();
        if (!foodCounts[k])
          foodCounts[k] = {
            name: f.name,
            group: f.group,
            iron: f.iron,
            count: 0,
            allergens: f.allergens,
            loved: 0,
            tried: 0,
            refused: 0,
          };
        foodCounts[k].count += 1;
        if (f.acceptance === "loved") foodCounts[k].loved += 1;
        else if (f.acceptance === "tried") foodCounts[k].tried += 1;
        else if (f.acceptance === "refused") foodCounts[k].refused += 1;
      })
    );
    const foodsSorted = Object.values(foodCounts).sort(
      (a, b) => b.count - a.count
    );

    // Allergens introduced
    const allergenCounts = {};
    ALL_ALLERGENS.forEach((a) => (allergenCounts[a] = 0));
    meals.forEach((m) =>
      m.foods.forEach((f) =>
        f.allergens.forEach((a) => {
          if (a in allergenCounts) allergenCounts[a] += 1;
        })
      )
    );

    // Group balance
    const groupCounts = {};
    meals.forEach((m) =>
      m.foods.forEach((f) => {
        groupCounts[f.group] = (groupCounts[f.group] || 0) + 1;
      })
    );
    const totalFoodInstances = Object.values(groupCounts).reduce(
      (a, b) => a + b,
      0
    );

    // Iron meals frequency
    const ironMeals = meals.filter((m) => m.foods.some((f) => f.iron)).length;
    const ironPct = meals.length
      ? Math.round((ironMeals / meals.length) * 100)
      : 0;

    // Recent meals (last 7 days)
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const recentMeals = meals
      .filter((m) => m.timestamp >= sevenDaysAgo)
      .sort((a, b) => b.timestamp - a.timestamp);

    const escapeHtml = (s) =>
      String(s).replace(
        /[&<>"']/g,
        (c) =>
          ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;",
          }[c])
      );

    const ageLabel =
      babyAge >= 12
        ? "12+ months"
        : babyAge >= 9
        ? "9–12 months"
        : babyAge >= 7
        ? "7–9 months"
        : "6–7 months";
    const approachLabel =
      approach === "puree"
        ? "Spoon-fed (purees)"
        : approach === "blw"
        ? "Baby-led weaning"
        : "Mix of spoon-fed and BLW";

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>Weaning summary — ${escapeHtml(now.toLocaleDateString("en-GB"))}</title>
<style>
  @page { size: A4; margin: 1.5cm; }
  body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #2D2A26; line-height: 1.4; max-width: 210mm; margin: 0 auto; padding: 1cm; }
  h1 { font-size: 22pt; margin: 0 0 4pt; font-weight: 600; }
  h2 { font-size: 13pt; margin: 18pt 0 6pt; font-weight: 600; border-bottom: 1px solid #ccc; padding-bottom: 3pt; }
  .subtitle { color: #666; font-size: 10pt; margin-bottom: 16pt; }
  .meta-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10pt; margin-bottom: 16pt; }
  .meta-cell { background: #f5efe6; padding: 8pt 10pt; border-radius: 4pt; }
  .meta-label { font-size: 8pt; text-transform: uppercase; letter-spacing: 0.05em; color: #888; }
  .meta-value { font-size: 13pt; font-weight: 600; margin-top: 2pt; }
  table { width: 100%; border-collapse: collapse; font-size: 9.5pt; margin-bottom: 8pt; }
  th, td { text-align: left; padding: 4pt 6pt; border-bottom: 1px solid #eee; }
  th { background: #f5efe6; font-weight: 600; font-size: 8pt; text-transform: uppercase; letter-spacing: 0.04em; color: #555; }
  .check { color: #5C8A6E; font-weight: bold; }
  .miss { color: #999; }
  .group-row { display: flex; align-items: center; gap: 8pt; margin-bottom: 4pt; font-size: 10pt; }
  .group-bar { flex: 1; height: 6pt; background: #f5efe6; border-radius: 3pt; overflow: hidden; }
  .group-fill { height: 100%; background: #7B9E5A; }
  .footer { margin-top: 24pt; font-size: 8.5pt; color: #888; border-top: 1px solid #eee; padding-top: 10pt; }
  .small { font-size: 9pt; color: #666; }
  .pill { display: inline-block; padding: 2pt 8pt; background: #f5efe6; border-radius: 12pt; font-size: 8.5pt; margin: 0 3pt 3pt 0; }
  .pill.iron { background: #e8f0e0; color: #4a6b3a; }
  @media print { body { padding: 0; } .no-print { display: none; } }
  .print-btn { background: #2D2A26; color: white; padding: 10pt 20pt; border: none; border-radius: 4pt; font-size: 11pt; cursor: pointer; margin: 10pt 0; }
</style>
</head>
<body>
  <button class="print-btn no-print" onclick="window.print()">Print or save as PDF</button>

  <h1>Weaning summary</h1>
  <p class="subtitle">A record of foods introduced. Useful for health visitor reviews or to file with your baby's red book. Prepared on ${escapeHtml(
    now.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
    })
  )}.</p>

  <div class="meta-grid">
    <div class="meta-cell">
      <div class="meta-label">Baby's age</div>
      <div class="meta-value">${escapeHtml(ageLabel)}</div>
    </div>
    <div class="meta-cell">
      <div class="meta-label">Approach</div>
      <div class="meta-value" style="font-size:11pt">${escapeHtml(
        approachLabel
      )}</div>
    </div>
    <div class="meta-cell">
      <div class="meta-label">Period</div>
      <div class="meta-value" style="font-size:9pt">${escapeHtml(
        dateRange
      )}</div>
    </div>
  </div>

  <h2>At a glance</h2>
  <div class="meta-grid">
    <div class="meta-cell">
      <div class="meta-label">Meals logged</div>
      <div class="meta-value">${meals.length}</div>
    </div>
    <div class="meta-cell">
      <div class="meta-label">Unique foods tried</div>
      <div class="meta-value">${foodsSorted.length}</div>
    </div>
    <div class="meta-cell">
      <div class="meta-label">Iron-rich meals</div>
      <div class="meta-value">${ironMeals} <span style="font-size:9pt;color:#888">(${ironPct}%)</span></div>
    </div>
  </div>

  <h2>Allergens introduced</h2>
  <p class="small">UK NHS guidance suggests introducing the 9 common allergens early and often, ideally before 12 months. Repeated exposures help build tolerance.</p>
  <table>
    <thead>
      <tr>
        <th>Allergen</th>
        <th>Status</th>
        <th>Times offered</th>
      </tr>
    </thead>
    <tbody>
      ${ALL_ALLERGENS.map(
        (a) => `
        <tr>
          <td style="text-transform:capitalize">${escapeHtml(a)}</td>
          <td>${
            allergenCounts[a] > 0
              ? '<span class="check">✓ Introduced</span>'
              : '<span class="miss">Not yet</span>'
          }</td>
          <td>${allergenCounts[a]}</td>
        </tr>
      `
      ).join("")}
    </tbody>
  </table>

  <h2>Food group balance</h2>
  <p class="small">Variety across food groups supports nutrition and reduces fussy eating.</p>
  ${Object.entries(GROUP_META)
    .filter(([g]) => groupCounts[g])
    .map(([g, meta]) => {
      const c = groupCounts[g] || 0;
      const pct = totalFoodInstances
        ? Math.round((c / totalFoodInstances) * 100)
        : 0;
      return `
      <div class="group-row">
        <div style="width: 70pt;">${escapeHtml(meta.label)}</div>
        <div class="group-bar"><div class="group-fill" style="width:${pct}%; background:${
        meta.color
      }"></div></div>
        <div style="width: 60pt; text-align: right; color:#666">${c} times (${pct}%)</div>
      </div>
    `;
    })
    .join("")}

  <h2>Foods tried</h2>
  <p class="small">All foods offered, in order of frequency.</p>
  <table>
    <thead>
      <tr>
        <th>Food</th>
        <th>Times offered</th>
        <th>Acceptance</th>
        <th>Iron source</th>
        <th>Allergens</th>
      </tr>
    </thead>
    <tbody>
      ${foodsSorted
        .map((f) => {
          const ratedCount = f.loved + f.tried + f.refused;
          let acceptCell = '<span class="miss">—</span>';
          if (ratedCount > 0) {
            const parts = [];
            if (f.loved)
              parts.push(
                `<span style="color:#5C8A6E">${f.loved}× loved</span>`
              );
            if (f.tried)
              parts.push(
                `<span style="color:#C8884D">${f.tried}× tried</span>`
              );
            if (f.refused)
              parts.push(
                `<span style="color:#B85042">${f.refused}× refused</span>`
              );
            acceptCell = parts.join(", ");
          }
          return `
        <tr>
          <td style="text-transform:capitalize">${escapeHtml(f.name)}</td>
          <td>${f.count}</td>
          <td style="font-size:9pt">${acceptCell}</td>
          <td>${
            f.iron
              ? '<span class="check">Yes</span>'
              : '<span class="miss">—</span>'
          }</td>
          <td style="text-transform:capitalize">${
            (f.allergens || []).join(", ") || '<span class="miss">—</span>'
          }</td>
        </tr>
      `;
        })
        .join("")}
    </tbody>
  </table>

  ${
    recentMeals.length > 0
      ? `
    <h2>Last 7 days</h2>
    <table>
      <thead>
        <tr>
          <th>Date</th>
          <th>Meal</th>
          <th>Foods</th>
          <th>Notes</th>
        </tr>
      </thead>
      <tbody>
        ${recentMeals
          .map((m) => {
            const d = new Date(m.timestamp).toLocaleDateString("en-GB", {
              day: "numeric",
              month: "short",
            });
            return `
            <tr>
              <td>${escapeHtml(d)}</td>
              <td style="text-transform:capitalize">${escapeHtml(
                m.mealType
              )}</td>
              <td style="text-transform:capitalize">${m.foods
                .map((f) => escapeHtml(f.name))
                .join(", ")}</td>
              <td style="color:#888;font-style:italic">${escapeHtml(
                m.notes || ""
              )}</td>
            </tr>
          `;
          })
          .join("")}
      </tbody>
    </table>
  `
      : ""
  }

  <div class="footer">
    <p><strong>About this summary.</strong> This is a personal record generated from a weaning tracker app. It is not medical advice. For advice on your individual baby, please speak to your health visitor or GP. UK weaning guidance is available from NHS Start4Life (nhs.uk/start4life).</p>
    <p>Generated ${escapeHtml(now.toLocaleString("en-GB"))}</p>
  </div>
</body>
</html>`;

    // Use a Blob to avoid popup-blocker issues with window.open + document.write.
    // Most browsers (especially mobile) block popup windows that try to inject HTML,
    // but they reliably allow Blob URLs opened via an anchor tag click.
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    if (downloadOnly) {
      // Force a download — works regardless of popup blockers
      a.download = `weaning-summary-${localDateStr()}.html`;
    } else {
      // Try opening in a new tab (more useful — they can print directly)
      a.target = "_blank";
      a.rel = "noopener noreferrer";
    }
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    // Clean up the object URL after a delay
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  };

  const handleImport = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const payload = JSON.parse(e.target.result);
        if (!payload.data || typeof payload.data !== "object") {
          setImportMessage("That file doesn't look like a valid backup.");
          return;
        }
        // Restore each key
        Object.entries(payload.data).forEach(([k, v]) => {
          localStorage.setItem(k, v);
        });
        setImportMessage(
          `Imported ${payload.mealCount || "?"} meals. Reloading…`
        );
        setTimeout(onImported, 800);
      } catch (err) {
        setImportMessage("Could not read that file: " + err.message);
      }
    };
    reader.readAsText(file);
  };

  const resetAll = () => {
    // Clear only our keys, not unrelated localStorage data
    const toRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (
        k &&
        (k.startsWith("meal:") ||
          k.startsWith("settings:") ||
          k.startsWith("plan:"))
      ) {
        toRemove.push(k);
      }
    }
    toRemove.forEach((k) => localStorage.removeItem(k));
    onImported(); // reload
  };

  return (
    <div className="fade-up space-y-5">
      <div>
        <p className="body-text text-[10px] uppercase tracking-[0.25em] text-[#8B8680] mb-1">
          Settings
        </p>
        <h2 className="text-3xl" style={{ fontStyle: "italic" }}>
          Your preferences &amp; data
        </h2>
      </div>

      {/* Stats */}
      <div className="bg-white rounded-2xl p-5 border border-[#2D2A26]/8 body-text text-center">
        <p
          className="text-4xl font-medium"
          style={{ fontFamily: "Fraunces", fontStyle: "italic" }}
        >
          {meals.length}
        </p>
        <p className="text-[10px] uppercase tracking-[0.2em] text-[#8B8680] mt-1">
          Meals logged
        </p>
      </div>

      {/* Baby's age */}
      <div className="bg-white rounded-2xl p-5 border border-[#2D2A26]/8 body-text">
        <p className="text-[10px] uppercase tracking-[0.25em] text-[#8B8680] mb-1">
          Baby's age
        </p>
        <h3 className="text-lg mb-3" style={{ fontStyle: "italic" }}>
          How old is your baby?
        </h3>
        <div className="grid grid-cols-4 gap-1.5">
          {[
            { value: 6, label: "6–7m" },
            { value: 7, label: "7–9m" },
            { value: 9, label: "9–12m" },
            { value: 12, label: "12m+" },
          ].map((o) => (
            <button
              key={o.value}
              onClick={() => onAgeChange(o.value)}
              className={`py-2.5 px-1 rounded-lg text-xs font-medium transition-all ${
                babyAge === o.value
                  ? "bg-[#2D2A26] text-[#F5EFE6]"
                  : "bg-[#F5EFE6] text-[#2D2A26]"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
        <p className="text-[10px] text-[#8B8680] mt-3 leading-relaxed">
          Used to label your printable summary. Doesn't change how the app
          works.
        </p>
      </div>

      {/* Approach */}
      <div className="bg-white rounded-2xl p-5 border border-[#2D2A26]/8 body-text">
        <p className="text-[10px] uppercase tracking-[0.25em] text-[#8B8680] mb-1">
          Your approach
        </p>
        <h3 className="text-lg mb-3" style={{ fontStyle: "italic" }}>
          How are you weaning?
        </h3>
        <div className="grid grid-cols-3 gap-1.5">
          {[
            { value: "puree", label: "Spoon-fed" },
            { value: "blw", label: "BLW" },
            { value: "both", label: "Mix of both" },
          ].map((o) => (
            <button
              key={o.value}
              onClick={() => onApproachChange(o.value)}
              className={`py-2.5 px-1 rounded-lg text-xs font-medium transition-all ${
                approach === o.value
                  ? "bg-[#2D2A26] text-[#F5EFE6]"
                  : "bg-[#F5EFE6] text-[#2D2A26]"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
        <p className="text-[10px] text-[#8B8680] mt-3 leading-relaxed">
          Recorded on your printable summary. The NHS notes there's no right or
          wrong way — most parents do a mix.
        </p>
      </div>

      {/* Backup */}
      <div className="bg-white rounded-2xl p-5 border border-[#2D2A26]/8 body-text">
        <p className="text-[10px] uppercase tracking-[0.25em] text-[#8B8680] mb-1">
          Backup
        </p>
        <h3 className="text-lg mb-3" style={{ fontStyle: "italic" }}>
          Export your data
        </h3>
        <p className="text-xs text-[#8B8680] leading-relaxed mb-4">
          Download a JSON file with all your logged meals and settings. Save it
          somewhere safe (cloud storage, email to yourself, etc) — you can
          restore it later or move it to another device.
        </p>
        <button
          onClick={exportData}
          className="w-full bg-[#2D2A26] text-[#F5EFE6] py-3 rounded-xl text-xs uppercase tracking-wider font-medium flex items-center justify-center gap-2 hover:bg-[#B85042] transition-colors"
        >
          <Download size={13} />
          Download backup file
        </button>
      </div>

      {/* Print summary for health visitor */}
      <div className="bg-white rounded-2xl p-5 border border-[#2D2A26]/8 body-text">
        <p className="text-[10px] uppercase tracking-[0.25em] text-[#8B8680] mb-1">
          For your health visitor
        </p>
        <h3 className="text-lg mb-3" style={{ fontStyle: "italic" }}>
          Summary report
        </h3>
        <p className="text-xs text-[#8B8680] leading-relaxed mb-4">
          A clean, one-page summary of foods introduced, allergens covered, and
          food group balance. Useful at health visitor reviews, GP appointments,
          or to keep with your baby's red book.
        </p>
        <div className="space-y-2">
          <button
            onClick={() => generatePrintSummary(false)}
            disabled={meals.length === 0}
            className="w-full bg-[#2D2A26] text-[#F5EFE6] py-3 rounded-xl text-xs uppercase tracking-wider font-medium flex items-center justify-center gap-2 hover:bg-[#B85042] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Printer size={13} />
            Open in new tab
          </button>
          <button
            onClick={() => generatePrintSummary(true)}
            disabled={meals.length === 0}
            className="w-full bg-white border border-[#2D2A26]/15 py-3 rounded-xl text-xs uppercase tracking-wider font-medium flex items-center justify-center gap-2 hover:bg-[#2D2A26]/5 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Download size={13} />
            Download as file
          </button>
        </div>
        <p className="text-[10px] text-[#8B8680] mt-3 leading-relaxed">
          {meals.length === 0
            ? "Log a meal first to generate a summary."
            : 'On phones, "Open in new tab" then use your browser\'s share/print menu to save as PDF. If that doesn\'t work, "Download as file" saves an HTML file you can open and print.'}
        </p>
      </div>

      {/* Restore */}
      <div className="bg-white rounded-2xl p-5 border border-[#2D2A26]/8 body-text">
        <p className="text-[10px] uppercase tracking-[0.25em] text-[#8B8680] mb-1">
          Restore
        </p>
        <h3 className="text-lg mb-3" style={{ fontStyle: "italic" }}>
          Import a backup
        </h3>
        <p className="text-xs text-[#8B8680] leading-relaxed mb-4">
          Upload a previously-exported JSON file to restore your meals and
          settings. <strong>This will replace any current data.</strong>
        </p>
        <label className="block">
          <input
            type="file"
            accept="application/json"
            onChange={handleImport}
            className="hidden"
          />
          <span className="block w-full bg-white border border-[#2D2A26]/15 py-3 rounded-xl text-xs uppercase tracking-wider font-medium flex items-center justify-center gap-2 hover:bg-[#2D2A26]/5 cursor-pointer">
            <Upload size={13} />
            Choose backup file
          </span>
        </label>
        {importMessage && (
          <p className="text-xs text-[#2D2A26] mt-3 text-center italic">
            {importMessage}
          </p>
        )}
      </div>

      {/* Reset */}
      <div className="bg-white rounded-2xl p-5 border border-[#B85042]/30 body-text">
        <p className="text-[10px] uppercase tracking-[0.25em] text-[#B85042] mb-1">
          Danger zone
        </p>
        <h3 className="text-lg mb-3" style={{ fontStyle: "italic" }}>
          Reset everything
        </h3>
        <p className="text-xs text-[#8B8680] leading-relaxed mb-4">
          Delete all logged meals, settings, and plans. This cannot be undone —
          export a backup first if you might want them back.
        </p>
        {!showResetConfirm ? (
          <button
            onClick={() => setShowResetConfirm(true)}
            className="w-full bg-white border border-[#B85042]/30 text-[#B85042] py-3 rounded-xl text-xs uppercase tracking-wider font-medium hover:bg-[#B85042]/5 transition-colors"
          >
            Reset all data
          </button>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-center text-[#B85042] font-semibold">
              Are you sure?
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setShowResetConfirm(false)}
                className="bg-white border border-[#2D2A26]/15 py-3 rounded-xl text-xs uppercase tracking-wider font-medium"
              >
                Cancel
              </button>
              <button
                onClick={resetAll}
                className="bg-[#B85042] text-white py-3 rounded-xl text-xs uppercase tracking-wider font-medium"
              >
                Yes, delete all
              </button>
            </div>
          </div>
        )}
      </div>

      {/* About */}
      <div className="bg-white/60 rounded-2xl p-5 border border-[#2D2A26]/10 body-text">
        <p className="text-[10px] uppercase tracking-[0.25em] text-[#8B8680] mb-1">
          About
        </p>
        <h3 className="text-lg mb-2" style={{ fontStyle: "italic" }}>
          First Tastes
        </h3>
        <p className="text-xs text-[#8B8680] leading-relaxed mb-2">
          A free, ad-free weaning tracker for UK parents. No accounts, no
          subscriptions, no data leaves your device.
        </p>
        <p className="text-xs text-[#8B8680] leading-relaxed mb-2">
          This app helps you keep a record. It doesn't give medical advice. For
          weaning guidance, please see{" "}
          <a
            href="https://www.nhs.uk/start4life/weaning/"
            target="_blank"
            rel="noopener noreferrer"
            className="underline text-[#2D2A26]"
          >
            NHS Start4Life
          </a>{" "}
          or speak to your health visitor or GP.
        </p>
        <p className="text-xs text-[#8B8680] leading-relaxed">
          Your data lives only on this device. Use the backup options above if
          it matters to you.
        </p>
      </div>
    </div>
  );
}
