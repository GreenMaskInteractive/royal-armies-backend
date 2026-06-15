// unit-data.js
const unitDatabase = {
  "PHYS_INFANTRY": {
    "Recruit Shieldman (A)": {
      tier: 1, branch: "A", baseProv: 233, gold: 350, tec: 15, type: "PHYS_INF",
      stats: {
        app: { hp: 114, str: 11, upc: 3 },
        std: { hp: 132, str: 11, upc: 6 },
        vet: { hp: 150, str: 12, upc: 9 }
      }
    },
    "Shield Sergeant (A)": {
      tier: 2, branch: "A", baseProv: 233, gold: 2100, tec: 25, type: "PHYS_INF",
      stats: {
        std: { hp: 141, str: 13, upc: 5 },
        vet: { hp: 161, str: 14, upc: 9 },
        mst: { hp: 181, str: 15, upc: 13 }
      }
    },
    "Vanguard Axeman (B)": {
      tier: 3, branch: "B", baseProv: 182, gold: 1850, tec: 22, type: "PHYS_INF",
      stats: {
        std: { hp: 118, str: 22, upc: 8 },
        vet: { hp: 127, str: 25, upc: 13 },
        mst: { hp: 136, str: 27, upc: 18 }
      }
    },
    "Bulwark Guard (A)": {
      tier: 4, branch: "A", baseProv: 233, gold: 13120, tec: 45, type: "PHYS_INF",
      stats: {
        std: { hp: 208, str: 22, upc: 12 },
        vet: { hp: 226, str: 23, upc: 18 },
        mst: { hp: 244, str: 24, upc: 24 },
        leg: { hp: 262, str: 25, upc: 30 }
      }
    },
    "Breach Soldier (B)": {
      tier: 5, branch: "B", baseProv: 182, gold: 11200, tec: 38, type: "PHYS_INF",
      stats: {
        std: { hp: 164, str: 38, upc: 17 },
        vet: { hp: 177, str: 41, upc: 24 },
        mst: { hp: 189, str: 43, upc: 31 },
        leg: { hp: 202, str: 44, upc: 38 }
      }
    },
    "Citadel Guardian (A)": {
      tier: 6, branch: "A", baseProv: 233, gold: 55210, tec: 75, type: "PHYS_INF",
      stats: {
        std: { hp: 268, str: 52, upc: 23 },
        vet: { hp: 283, str: 53, upc: 31 },
        mst: { hp: 291, str: 53, upc: 39 },
        leg: { hp: 306, str: 54, upc: 47 },
        elt: { hp: 315, str: 54, upc: 55 }
      }
    },
    "Frontline Breaker (B)": {
      tier: 7, branch: "B", baseProv: 182, gold: 44800, tec: 65, type: "PHYS_INF",
      stats: {
        std: { hp: 212, str: 58, upc: 30 },
        vet: { hp: 226, str: 60, upc: 37 },
        mst: { hp: 238, str: 62, upc: 44 },
        leg: { hp: 254, str: 63, upc: 51 },
        elt: { hp: 266, str: 64, upc: 58 }
      }
    }
  },
  "PHYS_CAVALRY": {
    "Squire Rider (A)": {
      tier: 1, branch: "A", baseProv: 153, gold: 315, tec: 15, type: "PHYS_CAV", special: "DOUBLE_STRIKE",
      stats: {
        app: { hp: 92, str: 12, upc: 3 },
        std: { hp: 110, str: 12, upc: 6 },
        vet: { hp: 128, str: 13, upc: 9 }
      }
    },
    "Royal Lancer (B)": {
      tier: 2, branch: "B", baseProv: 153, gold: 4850, tec: 18, type: "PHYS_CAV", special: "DOUBLE_STRIKE",
      stats: {
        std: { hp: 119, str: 25, upc: 10 },
        vet: { hp: 132, str: 30, upc: 14 },
        mst: { hp: 144, str: 34, upc: 18 }
      }
    },
    "Dread Knight (B)": {
      tier: 4, branch: "B", baseProv: 153, gold: 36800, tec: 35, type: "PHYS_CAV", special: "DOUBLE_STRIKE",
      stats: {
        std: { hp: 182, str: 42, upc: 20 },
        vet: { hp: 198, str: 45, upc: 25 },
        mst: { hp: 214, str: 48, upc: 30 }
      }
    }
  },
  "PHYS_ARTILLERY": {
    "Levy Archer (B)": {
      tier: 1, branch: "B", baseProv: 115, gold: 240, tec: 12, type: "PHYS_ART",
      stats: {
        app: { hp: 82, rng: 22, ml: 6, upc: 3 },
        std: { hp: 96, rng: 23, ml: 7, upc: 7 },
        vet: { hp: 112, rng: 24, ml: 8, upc: 11 }
      }
    },
    "Longbowman (B)": {
      tier: 2, branch: "B", baseProv: 115, gold: 1220, tec: 18, type: "PHYS_ART",
      stats: {
        std: { hp: 103, rng: 28, ml: 9, upc: 9 },
        vet: { hp: 119, rng: 31, ml: 10, upc: 13 },
        mst: { hp: 134, rng: 33, ml: 11, upc: 17 }
      }
    },
    "Sylvan Sniper (B)": {
      tier: 4, branch: "B", baseProv: 115, gold: 18600, tec: 32, type: "PHYS_ART",
      stats: {
        std: { hp: 158, rng: 36, ml: 12, upc: 16 },
        vet: { hp: 177, rng: 39, ml: 14, upc: 21 },
        mst: { hp: 196, rng: 41, ml: 15, upc: 26 }
      }
    }
  },
  "PHYS_BEASTS": {
    "Wild Wolf (A)": {
      tier: 1, branch: "A", baseProv: 108, gold: 290, tec: 15, type: "PHYS_BST",
      stats: {
        app: { hp: 78, str: 7, upc: 3 },
        std: { hp: 93, str: 7, upc: 7 },
        vet: { hp: 108, str: 8, upc: 11 }
      }
    },
    "Trained Wolf (A-1)": {
      tier: 2, branch: "A1", baseProv: 108, gold: 1640, tec: 18, type: "PHYS_BST",
      stats: {
        std: { hp: 114, str: 9, upc: 9 },
        vet: { hp: 122, str: 10, upc: 13 },
        mst: { hp: 131, str: 11, upc: 17 }
      }
    },
    "War-Howler (A-2)": {
      tier: 3, branch: "A2", baseProv: 108, gold: 1980, tec: 22, type: "PHYS_BST",
      stats: {
        std: { hp: 108, str: 18, upc: 13 },
        vet: { hp: 117, str: 21, upc: 17 },
        mst: { hp: 126, str: 23, upc: 22 }
      }
    },
    "Steeljaw (A-1)": {
      tier: 4, branch: "A1", baseProv: 92, gold: 11800, tec: 32, type: "PHYS_BST",
      stats: {
        std: { hp: 140, str: 14, upc: 16 },
        vet: { hp: 146, str: 15, upc: 20 },
        mst: { hp: 152, str: 16, upc: 24 },
        leg: { hp: 159, str: 18, upc: 28 }
      }
    },
    "Vollgrim (A-2)": {
      tier: 5, branch: "A2", baseProv: 108, gold: 10200, tec: 35, type: "PHYS_BST",
      stats: {
        std: { hp: 124, str: 24, upc: 22 },
        vet: { hp: 131, str: 26, upc: 27 },
        mst: { hp: 139, str: 29, upc: 31 },
        leg: { hp: 146, str: 31, upc: 36 }
      }
    }
  },
  "MAGIC_INFANTRY": {
    "Acolyte (A)": {
      tier: 1, branch: "A", baseProv: 263, gold: 450, tec: 15, type: "MAG_INF",
      stats: {
        app: { hp: 98, str: 13, upc: 5 },
        std: { hp: 115, str: 13, upc: 8 },
        vet: { hp: 132, str: 14, upc: 11 }
      }
    },
    "Warder (A)": {
      tier: 2, branch: "A", baseProv: 263, gold: 2600, tec: 28, type: "MAG_INF",
      stats: {
        std: { hp: 123, str: 16, upc: 8 },
        vet: { hp: 142, str: 17, upc: 14 },
        mst: { hp: 161, str: 18, upc: 20 }
      }
    },
    "Spellblade (B)": {
      tier: 3, branch: "B", baseProv: 217, gold: 1950, tec: 24, type: "MAG_INF",
      stats: {
        std: { hp: 124, str: 32, upc: 12 },
        vet: { hp: 140, str: 33, upc: 21 },
        mst: { hp: 156, str: 35, upc: 30 }
      }
    },
    "Arcane Sentinel (A)": {
      tier: 4, branch: "A", baseProv: 263, gold: 18400, tec: 48, type: "MAG_INF",
      stats: {
        std: { hp: 188, str: 26, upc: 18 },
        vet: { hp: 205, str: 27, upc: 24 },
        mst: { hp: 222, str: 28, upc: 30 },
        leg: { hp: 238, str: 30, upc: 36 }
      }
    },
    "Void Reaver (B)": {
      tier: 5, branch: "B", baseProv: 217, gold: 14200, tec: 42, type: "MAG_INF",
      stats: {
        std: { hp: 172, str: 42, upc: 25 },
        vet: { hp: 187, str: 44, upc: 34 },
        mst: { hp: 201, str: 46, upc: 43 },
        leg: { hp: 216, str: 48, upc: 52 }
      }
    },
    "Eldritch Titan (A)": {
      tier: 6, branch: "A", baseProv: 263, gold: 62400, tec: 85, type: "MAG_INF",
      stats: {
        std: { hp: 254, str: 49, upc: 32 },
        vet: { hp: 266, str: 51, upc: 42 },
        mst: { hp: 277, str: 53, upc: 52 },
        leg: { hp: 288, str: 54, upc: 62 },
        elt: { hp: 299, str: 56, upc: 72 }
      }
    },
    "Arcane Executioner (B)": {
      tier: 7, branch: "B", baseProv: 217, gold: 59400, tec: 75, type: "MAG_INF",
      stats: {
        std: { hp: 224, str: 50, upc: 40 },
        vet: { hp: 235, str: 55, upc: 50 },
        mst: { hp: 246, str: 59, upc: 60 },
        leg: { hp: 255, str: 62, upc: 70 },
        elt: { hp: 265, str: 64, upc: 80 }
      }
    }
  },
  "MAGIC_CAVALRY": {
    "Neophyte (A)": {
      tier: 1, branch: "A", baseProv: 153, gold: 520, tec: 18, type: "MAG_CAV", special: "DOUBLE_STRIKE",
      stats: {
        app: { hp: 92, str: 13, upc: 4 },
        std: { hp: 110, str: 14, upc: 7 },
        vet: { hp: 128, str: 15, upc: 11 }
      }
    },
    "Aether Lancer (B)": {
      tier: 3, branch: "B", baseProv: 153, gold: 5400, tec: 25, type: "MAG_CAV", special: "DOUBLE_STRIKE",
      stats: {
        std: { hp: 119, str: 24, upc: 12 },
        vet: { hp: 134, str: 28, upc: 21 },
        mst: { hp: 144, str: 32, upc: 30 }
      }
    },
    "Celestial Harbinger (B)": {
      tier: 7, branch: "B", baseProv: 153, gold: 42600, tec: 48, type: "MAG_CAV", special: "DOUBLE_STRIKE",
      stats: {
        std: { hp: 182, str: 42, upc: 30 },
        vet: { hp: 198, str: 47, upc: 45 },
        mst: { hp: 214, str: 52, upc: 60 }
      }
    }
  },
  "MAGIC_ARTILLERY": {
    "Runefire Ballista (B)": {
      tier: 1, branch: "B", baseProv: 115, gold: 280, tec: 15, type: "MAG_ART",
      stats: {
        app: { hp: 64, rng: 38, ml: 6, upc: 4 },
        std: { hp: 74, rng: 44, ml: 7, upc: 8 },
        vet: { hp: 86, rng: 52, ml: 8, upc: 12 }
      }
    },
    "Stellar Mortar (B)": {
      tier: 3, branch: "B", baseProv: 115, gold: 1550, tec: 22, type: "MAG_ART",
      stats: {
        std: { hp: 94, rng: 62, ml: 9, upc: 10 },
        vet: { hp: 110, rng: 72, ml: 10, upc: 16 },
        mst: { hp: 125, rng: 84, ml: 11, upc: 22 }
      }
    },
    "Eldritch Siege Engine (B)": {
      tier: 7, branch: "B", baseProv: 115, gold: 22400, tec: 35, type: "MAG_ART",
      stats: {
        std: { hp: 145, rng: 98, ml: 12, upc: 18 },
        vet: { hp: 162, rng: 112, ml: 13, upc: 25 },
        mst: { hp: 178, rng: 128, ml: 14, upc: 32 }
      }
    }
  },
  "MAGIC_BEASTS": {
    "Hatchling Imp (A)": {
      tier: 1, branch: "A", baseProv: 108, gold: 310, tec: 15, type: "MAG_BST",
      stats: {
        app: { hp: 88, str: 9, upc: 4 },
        std: { hp: 104, str: 10, upc: 8 },
        vet: { hp: 120, str: 11, upc: 12 }
      }
    },
    "Lizard Dragon (A)": {
      tier: 3, branch: "A", baseProv: 108, gold: 1720, tec: 25, type: "MAG_BST",
      stats: {
        std: { hp: 111, str: 13, upc: 10 },
        vet: { hp: 130, str: 14, upc: 16 },
        mst: { hp: 148, str: 15, upc: 22 }
      }
    },
    "Spiked Komogon (A)": {
      tier: 4, branch: "A", baseProv: 108, gold: 4850, tec: 32, type: "MAG_BST",
      stats: {
        std: { hp: 155, str: 16, upc: 16 },
        vet: { hp: 170, str: 17, upc: 24 },
        mst: { hp: 184, str: 19, upc: 32 }
      }
    },
    "Armored Drake (A)": {
      tier: 5, branch: "A", baseProv: 108, gold: 22400, tec: 48, type: "MAG_BST",
      stats: {
        std: { hp: 196, str: 22, upc: 22 },
        vet: { hp: 211, str: 24, upc: 27 },
        mst: { hp: 227, str: 26, upc: 32 },
        leg: { hp: 242, str: 28, upc: 36 }
      }
    },
    "Shadow Sparker (B)": {
      tier: 6, branch: "B", baseProv: 108, gold: 18600, tec: 38, type: "MAG_BST",
      stats: {
        std: { hp: 172, str: 38, upc: 28 },
        vet: { hp: 185, str: 41, upc: 34 },
        mst: { hp: 198, str: 44, upc: 39 },
        leg: { hp: 211, str: 48, upc: 44 }
      }
    }
  }
};