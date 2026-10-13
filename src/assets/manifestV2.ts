// Hatchfield asset pack v2 (raster PBR + polished 2D art). Paths are served from public/.
// The binaries are NOT in git yet: the GitHub connector only commits text. Unzip the Drive pack
// (hatchfield_assets_v2.zip -> pack/) into public/assets/v2/ to use it. Each WebP also has a PNG twin (same name, .png).
// Until then use the SVG set in ./manifest.ts as a fallback.

export type PbrMap = "albedo" | "normal" | "roughness" | "ao";
export type PbrSize = "1024" | "512";
export interface PbrSet {
  roughness: number;
  metalness: number;
  repeatMeters: number;
  maps: Record<PbrMap, Record<PbrSize, string>>;
}

export const PBR_V2: Record<string, PbrSet> = {
  "tarmac": {
    "roughness": 0.85,
    "metalness": 0,
    "repeatMeters": 4,
    "maps": {
      "albedo": {
        "1024": "/assets/v2/textures/tarmac_albedo_1024.webp",
        "512": "/assets/v2/textures/tarmac_albedo_512.webp"
      },
      "normal": {
        "1024": "/assets/v2/textures/tarmac_normal_1024.webp",
        "512": "/assets/v2/textures/tarmac_normal_512.webp"
      },
      "roughness": {
        "1024": "/assets/v2/textures/tarmac_roughness_1024.webp",
        "512": "/assets/v2/textures/tarmac_roughness_512.webp"
      },
      "ao": {
        "1024": "/assets/v2/textures/tarmac_ao_1024.webp",
        "512": "/assets/v2/textures/tarmac_ao_512.webp"
      }
    }
  },
  "concrete_apron": {
    "roughness": 0.85,
    "metalness": 0,
    "repeatMeters": 8,
    "maps": {
      "albedo": {
        "1024": "/assets/v2/textures/concrete_apron_albedo_1024.webp",
        "512": "/assets/v2/textures/concrete_apron_albedo_512.webp"
      },
      "normal": {
        "1024": "/assets/v2/textures/concrete_apron_normal_1024.webp",
        "512": "/assets/v2/textures/concrete_apron_normal_512.webp"
      },
      "roughness": {
        "1024": "/assets/v2/textures/concrete_apron_roughness_1024.webp",
        "512": "/assets/v2/textures/concrete_apron_roughness_512.webp"
      },
      "ao": {
        "1024": "/assets/v2/textures/concrete_apron_ao_1024.webp",
        "512": "/assets/v2/textures/concrete_apron_ao_512.webp"
      }
    }
  },
  "grass": {
    "roughness": 0.92,
    "metalness": 0,
    "repeatMeters": 3,
    "maps": {
      "albedo": {
        "1024": "/assets/v2/textures/grass_albedo_1024.webp",
        "512": "/assets/v2/textures/grass_albedo_512.webp"
      },
      "normal": {
        "1024": "/assets/v2/textures/grass_normal_1024.webp",
        "512": "/assets/v2/textures/grass_normal_512.webp"
      },
      "roughness": {
        "1024": "/assets/v2/textures/grass_roughness_1024.webp",
        "512": "/assets/v2/textures/grass_roughness_512.webp"
      },
      "ao": {
        "1024": "/assets/v2/textures/grass_ao_1024.webp",
        "512": "/assets/v2/textures/grass_ao_512.webp"
      }
    }
  },
  "runway": {
    "roughness": 0.8,
    "metalness": 0,
    "repeatMeters": 30,
    "maps": {
      "albedo": {
        "1024": "/assets/v2/textures/runway_albedo_1024.webp",
        "512": "/assets/v2/textures/runway_albedo_512.webp"
      },
      "normal": {
        "1024": "/assets/v2/textures/runway_normal_1024.webp",
        "512": "/assets/v2/textures/runway_normal_512.webp"
      },
      "roughness": {
        "1024": "/assets/v2/textures/runway_roughness_1024.webp",
        "512": "/assets/v2/textures/runway_roughness_512.webp"
      },
      "ao": {
        "1024": "/assets/v2/textures/runway_ao_1024.webp",
        "512": "/assets/v2/textures/runway_ao_512.webp"
      }
    }
  },
  "terminal_glass": {
    "roughness": 0.08,
    "metalness": 0.6,
    "repeatMeters": 6,
    "maps": {
      "albedo": {
        "1024": "/assets/v2/textures/terminal_glass_albedo_1024.webp",
        "512": "/assets/v2/textures/terminal_glass_albedo_512.webp"
      },
      "normal": {
        "1024": "/assets/v2/textures/terminal_glass_normal_1024.webp",
        "512": "/assets/v2/textures/terminal_glass_normal_512.webp"
      },
      "roughness": {
        "1024": "/assets/v2/textures/terminal_glass_roughness_1024.webp",
        "512": "/assets/v2/textures/terminal_glass_roughness_512.webp"
      },
      "ao": {
        "1024": "/assets/v2/textures/terminal_glass_ao_1024.webp",
        "512": "/assets/v2/textures/terminal_glass_ao_512.webp"
      }
    }
  },
  "carpet": {
    "roughness": 0.96,
    "metalness": 0,
    "repeatMeters": 2,
    "maps": {
      "albedo": {
        "1024": "/assets/v2/textures/carpet_albedo_1024.webp",
        "512": "/assets/v2/textures/carpet_albedo_512.webp"
      },
      "normal": {
        "1024": "/assets/v2/textures/carpet_normal_1024.webp",
        "512": "/assets/v2/textures/carpet_normal_512.webp"
      },
      "roughness": {
        "1024": "/assets/v2/textures/carpet_roughness_1024.webp",
        "512": "/assets/v2/textures/carpet_roughness_512.webp"
      },
      "ao": {
        "1024": "/assets/v2/textures/carpet_ao_1024.webp",
        "512": "/assets/v2/textures/carpet_ao_512.webp"
      }
    }
  },
  "terrazzo": {
    "roughness": 0.33,
    "metalness": 0,
    "repeatMeters": 2,
    "maps": {
      "albedo": {
        "1024": "/assets/v2/textures/terrazzo_albedo_1024.webp",
        "512": "/assets/v2/textures/terrazzo_albedo_512.webp"
      },
      "normal": {
        "1024": "/assets/v2/textures/terrazzo_normal_1024.webp",
        "512": "/assets/v2/textures/terrazzo_normal_512.webp"
      },
      "roughness": {
        "1024": "/assets/v2/textures/terrazzo_roughness_1024.webp",
        "512": "/assets/v2/textures/terrazzo_roughness_512.webp"
      },
      "ao": {
        "1024": "/assets/v2/textures/terrazzo_ao_1024.webp",
        "512": "/assets/v2/textures/terrazzo_ao_512.webp"
      }
    }
  }
};

/** 512x256 wayfinding signs, key = `${type}_${style}`, style yellow_black | white_grey. */
export const SIGNS_V2: Record<string, string> = {
  "checkin_yellow_black": "/assets/v2/signage/sign_checkin_yellow_black.webp",
  "checkin_white_grey": "/assets/v2/signage/sign_checkin_white_grey.webp",
  "security_yellow_black": "/assets/v2/signage/sign_security_yellow_black.webp",
  "security_white_grey": "/assets/v2/signage/sign_security_white_grey.webp",
  "gates_yellow_black": "/assets/v2/signage/sign_gates_yellow_black.webp",
  "gates_white_grey": "/assets/v2/signage/sign_gates_white_grey.webp",
  "baggage_reclaim_yellow_black": "/assets/v2/signage/sign_baggage_reclaim_yellow_black.webp",
  "baggage_reclaim_white_grey": "/assets/v2/signage/sign_baggage_reclaim_white_grey.webp",
  "shops_yellow_black": "/assets/v2/signage/sign_shops_yellow_black.webp",
  "shops_white_grey": "/assets/v2/signage/sign_shops_white_grey.webp",
  "food_yellow_black": "/assets/v2/signage/sign_food_yellow_black.webp",
  "food_white_grey": "/assets/v2/signage/sign_food_white_grey.webp",
  "restrooms_yellow_black": "/assets/v2/signage/sign_restrooms_yellow_black.webp",
  "restrooms_white_grey": "/assets/v2/signage/sign_restrooms_white_grey.webp",
  "lost_bag_yellow_black": "/assets/v2/signage/sign_lost_bag_yellow_black.webp",
  "lost_bag_white_grey": "/assets/v2/signage/sign_lost_bag_white_grey.webp"
};

/** 256x256 yellow-on-black pictograms. */
export const PICTOGRAMS_V2: Record<string, string> = {
  "checkin": "/assets/v2/signage/pictogram_checkin.webp",
  "security": "/assets/v2/signage/pictogram_security.webp",
  "gates": "/assets/v2/signage/pictogram_gates.webp",
  "baggage_reclaim": "/assets/v2/signage/pictogram_baggage_reclaim.webp",
  "shops": "/assets/v2/signage/pictogram_shops.webp",
  "food": "/assets/v2/signage/pictogram_food.webp",
  "restrooms": "/assets/v2/signage/pictogram_restrooms.webp",
  "lost_bag": "/assets/v2/signage/pictogram_lost_bag.webp"
};

/** 512x512 shop logos (placeholders). */
export const LOGOS_V2: Record<string, string> = {
  "skybrew": "/assets/v2/logos/skybrew.webp",
  "jetburger": "/assets/v2/logos/jetburger.webp",
  "duty_free": "/assets/v2/logos/duty_free.webp",
  "newsstand": "/assets/v2/logos/newsstand.webp",
  "gadget_gate": "/assets/v2/logos/gadget_gate.webp",
  "noodle_bar": "/assets/v2/logos/noodle_bar.webp"
};

/** 1024x1024 tail fin art; colours live in /assets/liveries/liveries.json. */
export const TAILS_V2: Record<string, string> = {
  "aurora": "/assets/v2/liveries/aurora_tail.webp",
  "coralis": "/assets/v2/liveries/coralis_tail.webp",
  "nordwind": "/assets/v2/liveries/nordwind_tail.webp",
  "siamsky": "/assets/v2/liveries/siamsky_tail.webp",
  "pacifica": "/assets/v2/liveries/pacifica_tail.webp",
  "redtail": "/assets/v2/liveries/redtail_tail.webp",
  "meridian": "/assets/v2/liveries/meridian_tail.webp",
  "hatch_cargo": "/assets/v2/liveries/hatch_cargo_tail.webp"
};

/** 256x256 passenger thought bubbles. */
export const BUBBLES_V2: Record<string, string> = {
  "burger": "/assets/v2/bubbles/burger.webp",
  "coffee": "/assets/v2/bubbles/coffee.webp",
  "bag": "/assets/v2/bubbles/bag.webp",
  "angry": "/assets/v2/bubbles/angry.webp",
  "happy": "/assets/v2/bubbles/happy.webp"
};

export const V2_ROOT = "/assets/v2/";

export function allV2Paths(): string[] {
  const out: string[] = [];
  for (const s of Object.values(PBR_V2)) for (const m of Object.values(s.maps)) out.push(...Object.values(m));
  for (const g of [SIGNS_V2, PICTOGRAMS_V2, LOGOS_V2, TAILS_V2, BUBBLES_V2]) out.push(...Object.values(g));
  return out;
}

/** PNG twin of a WebP path, for browsers or tools without WebP. */
export const pngOf = (p: string): string => p.replace(/\.webp$/, ".png");
