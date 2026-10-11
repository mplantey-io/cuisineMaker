import React, { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

// ---------------------------------------------------------------------------
// Catalogue unifié — tout objet est placé librement (x, y, angle) dans une
// pièce, quel que soit son type. "band" ne sert plus qu'au rendu (opacité,
// hauteur de pose) — il n'y a plus de notion de mur porteur.
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// Volumes réalistes — un meuble peut être décrit par plusieurs boîtes ("parts"),
// en cm dans le repère de l'objet : x = largeur (centre), z = profondeur (centre,
// +z = façade), y = hauteur depuis la base de l'objet (bas de la boîte).
// Sans "parts", l'objet reste une simple boîte (comportement historique).
// ---------------------------------------------------------------------------
const MB = { plinth: 5, setback: 8, facadeT: 1.8, gap: 0.4 };
const MB_BODY = "#ece7dd", MB_PLINTH = "#3a3d42", MB_HANDLE = "#b9bcc0", MB_APPLI = "#25282d";
function mbBox(x, y, z, w, h, d, color, alpha) { return alpha == null ? { x, y, z, w, h, d, color } : { x, y, z, w, h, d, color, alpha }; }
// Ouvertures (repère de l'objet : x = largeur, z = épaisseur du mur, y depuis le bas de l'ouverture).
// Cadre + vantail(s) ou vitrage ; les vitrages sont transparents (alpha).
const OP_FRAME = "#f1ece3", OP_LEAF = "#d8c3a3", OP_METAL = "#b8bcc2", OP_GLASS = "#bfe3f2";
function doorParts(w, d, h) {
  const t = Math.min(4, w / 10);
  return [
    mbBox(-(w - t) / 2, 0, 0, t, h, d, OP_FRAME), mbBox((w - t) / 2, 0, 0, t, h, d, OP_FRAME),
    mbBox(0, h - t, 0, Math.max(1, w - 2 * t), t, d, OP_FRAME),
    mbBox(0, 0, 0, Math.max(1, w - 2 * t), h - t, 3.5, OP_LEAF),
    mbBox(w / 2 - t - 8, 98, 2.6, 12, 2, 2.4, OP_METAL),
  ];
}
function doubleDoorParts(w, d, h) {
  const t = Math.min(4, w / 10), lw = Math.max(1, (w - 2 * t - 0.4) / 2);
  return [
    mbBox(-(w - t) / 2, 0, 0, t, h, d, OP_FRAME), mbBox((w - t) / 2, 0, 0, t, h, d, OP_FRAME),
    mbBox(0, h - t, 0, Math.max(1, w - 2 * t), t, d, OP_FRAME),
    mbBox(-(lw + 0.4) / 2, 0, 0, lw, h - t, 3.5, OP_LEAF), mbBox((lw + 0.4) / 2, 0, 0, lw, h - t, 3.5, OP_LEAF),
    mbBox(-6, 98, 2.6, 2, 12, 2.4, OP_METAL), mbBox(6, 98, 2.6, 2, 12, 2.4, OP_METAL),
  ];
}
function windowParts(w, d, h) {
  const t = Math.min(4, w / 8, h / 8), parts = [
    mbBox(-(w - t) / 2, 0, 0, t, h, d, OP_FRAME), mbBox((w - t) / 2, 0, 0, t, h, d, OP_FRAME),
    mbBox(0, 0, 0, Math.max(1, w - 2 * t), t, d, OP_FRAME), mbBox(0, h - t, 0, Math.max(1, w - 2 * t), t, d, OP_FRAME),
    mbBox(0, t, 0, Math.max(1, w - 2 * t), Math.max(1, h - 2 * t), 0.8, OP_GLASS, 0.35),
  ];
  if (w >= 120) parts.push(mbBox(0, t, 0, 3, Math.max(1, h - 2 * t), 3, OP_FRAME));
  return parts;
}
function bayParts(w, d, h) {
  const n = Math.max(2, Math.round(w / 90)), rail = 6, post = 5, parts = [
    mbBox(0, 0, 0, w, rail, d, OP_FRAME), mbBox(0, h - rail, 0, w, rail, d, OP_FRAME),
  ];
  for (let k = 0; k <= n; k++) {
    const x = Math.min(w / 2 - post / 2, Math.max(-w / 2 + post / 2, -w / 2 + (k * w) / n));
    parts.push(mbBox(x, rail, 0, post, h - 2 * rail, d, OP_FRAME));
  }
  for (let i = 0; i < n; i++) parts.push(mbBox(-w / 2 + ((i + 0.5) * w) / n, rail, 0, Math.max(1, w / n - post), h - 2 * rail, 0.8, OP_GLASS, 0.35));
  return parts;
}
function glassScreenParts(w, d, h) {
  return [
    mbBox(0, 1, 0, Math.max(1, w - 1), h - 2, 0.8, OP_GLASS, 0.35),
    mbBox(0, 0, 0, w, 2, 2, OP_METAL), mbBox(0, h - 2, 0, w, 2, 2, OP_METAL),
  ];
}
// Chaise : assise, quatre pieds, dossier (deux montants + panneau). Le dossier est côté -z (le devant de la chaise regarde +z).
function chairParts(w, d, color) {
  const leg = Math.min(3.5, w / 6), seatH = 45, seatT = 3, backH = 45, legColor = "#4d5b49";
  const lx = w / 2 - leg / 2, lz = d / 2 - leg / 2;
  const parts = [];
  [[-lx, -lz], [lx, -lz], [-lx, lz], [lx, lz]].forEach(([x, z]) => parts.push(mbBox(x, 0, z, leg, seatH - seatT, leg, legColor)));
  parts.push(mbBox(0, seatH - seatT, 0, w, seatT, d, color));
  [-lx, lx].forEach((x) => parts.push(mbBox(x, seatH, -lz, leg, backH, leg, legColor)));
  parts.push(mbBox(0, seatH + backH * 0.3, -d / 2 + 1.25, Math.max(1, w - 2 * leg), backH * 0.6, 2.5, color));
  return parts;
}

// Façades d'une travée. rows = poids de hauteur de chaque façade, du bas vers le haut
// (négatif = appareil encastré : sombre, sans poignée) ; cols = nombre de vantaux.
// handle : "h" (barre horizontale, tiroirs) ou "v" (barre verticale, portes) ; low = poignée côté bas.
function mbFronts({ x0, w, zFront, y0, h, color, rows, cols = 1, handle, low = false }) {
  const t = MB.facadeT, g = MB.gap, out = [];
  const kind = handle || (rows.length > 1 ? "h" : "v");
  const fw = (w - g * (cols + 1)) / cols;
  const total = rows.reduce((s, r) => s + Math.abs(r), 0);
  const avail = h - g * (rows.length + 1);
  let y = y0 + g;
  rows.forEach((r) => {
    const fh = (avail * Math.abs(r)) / total;
    for (let c = 0; c < cols; c++) {
      const fx = x0 - w / 2 + g + fw / 2 + c * (fw + g);
      out.push(mbBox(fx, y, zFront - t / 2, fw, fh, t, r < 0 ? MB_APPLI : color));
      if (r > 0) {
        if (kind === "h") out.push(mbBox(fx, low ? y + 3 : y + fh - 4, zFront + 0.75, Math.min(fw * 0.7, 40), 1.2, 1.5, MB_HANDLE));
        else {
          const hh = Math.min(fh * 0.4, 30);
          const hx = cols > 1 ? fx + (c < cols / 2 ? 1 : -1) * (fw / 2 - 3) : fx + fw / 2 - 3;
          out.push(mbBox(hx, low ? y + 3 : y + fh - hh - 4, zFront + 0.75, 1.2, hh, 1.5, MB_HANDLE));
        }
      }
    }
    y += fh + g;
  });
  return out;
}
// Caisson rectangulaire : socle en retrait (si plinth > 0) + caisson + façades.
function mbUnit({ w, d, plinth = MB.plinth, bodyH, color, rows = [1], cols = 1, handle, low }) {
  const t = MB.facadeT, parts = [];
  if (plinth > 0) parts.push(mbBox(0, 0, -MB.setback / 2, w - 0.4, plinth, d - MB.setback, MB_PLINTH));
  parts.push(mbBox(0, plinth, -t / 2, w, bodyH, d - t, MB_BODY));
  return parts.concat(mbFronts({ x0: 0, w, zFront: d / 2, y0: plinth, h: bodyH, color, rows, cols, handle, low }));
}
// Caisson d'angle en L : une branche le long du mur du fond (profondeur "leg"), une le long du mur
// de gauche (largeur "leg"). Le carré w-leg × d-leg à l'avant-droite reste vide.
function mbCornerL({ w, d, leg, plinth = MB.plinth, bodyH, color, handle, low }) {
  const t = MB.facadeT, parts = [];
  const zA = -d / 2 + leg, xB = -w / 2 + leg;
  const xA = (xB + w / 2) / 2, wA = w - leg;
  if (plinth > 0) {
    parts.push(mbBox(xA, 0, -d / 2 + (leg - MB.setback) / 2, wA - 0.2, plinth, leg - MB.setback, MB_PLINTH));
    parts.push(mbBox(-w / 2 + leg / 2, 0, -MB.setback / 2, leg, plinth, d - MB.setback, MB_PLINTH));
  }
  parts.push(mbBox(xA, plinth, -d / 2 + leg / 2, wA, bodyH, leg, MB_BODY));
  parts.push(mbBox(-w / 2 + leg / 2, plinth, -t / 2, leg, bodyH, d - t, MB_BODY));
  return parts
    .concat(mbFronts({ x0: xA, w: wA, zFront: zA + t, y0: plinth, h: bodyH, color, rows: [1], handle, low }))
    .concat(mbFronts({ x0: -w / 2 + leg / 2, w: leg, zFront: d / 2, y0: plinth, h: bodyH, color, rows: [1], handle, low }));
}
// Étagère ouverte : fond, deux montants et trois tablettes.
function mbOpenShelf({ w, d, h, color }) {
  const parts = [mbBox(0, 0, -d / 2 + 0.8, w, h, 1.6, MB_BODY), mbBox(-w / 2 + 0.9, 0, 0, 1.8, h, d, MB_BODY), mbBox(w / 2 - 0.9, 0, 0, 1.8, h, d, MB_BODY)];
  [0, (h - 1.8) / 2, h - 1.8].forEach((y) => parts.push(mbBox(0, y, 0, w - 3.6, 1.8, d, color)));
  return parts;
}

const MB_BAS_BODY = 82.8, MB_COL_BODY = 207;
const MB_BAS_H = MB.plinth + MB_BAS_BODY, MB_COL_H = MB.plinth + MB_COL_BODY;
const G_BAS = "Mobalpa — Bas", G_HAUT = "Mobalpa — Hauts", G_COL = "Mobalpa — Colonnes", G_FIN = "Mobalpa — Plans & finitions";
const C_BAS = "#c9c3b6", C_HAUT = "#d6d1c6", C_COL = "#b5ad9f";
const N_SRC = "Cote publiée dans le catalogue Mobalpa 2024 (détail des prix, p. 192).";
const N_EST = "Largeurs estimées sur la grille standard : Mobalpa ne publie pas la grille complète des modules.";

function mbEntry(o) {
  return {
    id: o.id, name: o.name, group: o.group, band: o.band, symbol: null, color: o.color, height: o.height, yOffset: o.yOffset || 0,
    depthMin: o.dMin ?? o.d, depthMax: o.dMax ?? o.d, depthStep: o.dStep || 0, defaultDepth: o.d,
    widthMin: o.wMin, widthMax: o.wMax, widthStep: o.wStep || 0, defaultWidth: o.wDef,
    roundable: o.roundable, parts: o.parts, note: o.note,
  };
}
const MOBALPA_CATALOG = [
  // --- Bas : caisson 82,8 + socle 5, profondeur 60 (plan de travail en sus, voir "Plans & finitions") ---
  mbEntry({ id: "mb-bas-1p", name: "Bas 1 porte", group: G_BAS, band: "floor", color: C_BAS, height: MB_BAS_H, d: 60, wMin: 30, wMax: 60, wStep: 10, wDef: 60,
    parts: (w, d) => mbUnit({ w, d, bodyH: MB_BAS_BODY, color: C_BAS }), note: `60 × 60 × 82,8 cm (1 porte, 2 étagères). ${N_SRC} Autres largeurs : ${N_EST}` }),
  mbEntry({ id: "mb-bas-2p", name: "Bas 2 portes", group: G_BAS, band: "floor", color: C_BAS, height: MB_BAS_H, d: 60, wMin: 80, wMax: 120, wStep: 10, wDef: 90,
    parts: (w, d) => mbUnit({ w, d, bodyH: MB_BAS_BODY, color: C_BAS, cols: 2 }), note: N_EST }),
  mbEntry({ id: "mb-bas-3t", name: "Bas 2 tiroirs + casserolier", group: G_BAS, band: "floor", color: C_BAS, height: MB_BAS_H, d: 60, wMin: 60, wMax: 120, wStep: 30, wDef: 90,
    parts: (w, d) => mbUnit({ w, d, bodyH: MB_BAS_BODY, color: C_BAS, rows: [1, 1, 2] }), note: `90 et 120 × 60 × 82,8 cm (2 tiroirs + 1 coulissant). ${N_SRC}` }),
  mbEntry({ id: "mb-bas-casserolier", name: "Casserolier 3 tiroirs", group: G_BAS, band: "floor", color: C_BAS, height: MB_BAS_H, d: 60, wMin: 40, wMax: 80, wStep: 10, wDef: 60,
    parts: (w, d) => mbUnit({ w, d, bodyH: MB_BAS_BODY, color: C_BAS, rows: [1, 1, 1] }), note: N_EST }),
  mbEntry({ id: "mb-bas-evier", name: "Bas sous évier", group: G_BAS, band: "floor", color: C_BAS, height: MB_BAS_H, d: 60, wMin: 60, wMax: 120, wStep: 10, wDef: 80,
    parts: (w, d) => mbUnit({ w, d, bodyH: MB_BAS_BODY, color: C_BAS, cols: w >= 80 ? 2 : 1 }), note: `60 × 60 × 82,8 cm avec poubelle coulissante, fond réduit. ${N_SRC} Autres largeurs : ${N_EST}` }),
  mbEntry({ id: "mb-bas-poubelle", name: "Bas poubelles coulissant", group: G_BAS, band: "floor", color: C_BAS, height: MB_BAS_H, d: 60, wMin: 30, wMax: 60, wStep: 10, wDef: 40,
    parts: (w, d) => mbUnit({ w, d, bodyH: MB_BAS_BODY, color: C_BAS, rows: [1, 2] }), note: N_EST }),
  mbEntry({ id: "mb-bas-epices", name: "Coulissant à épices", group: G_BAS, band: "floor", color: C_BAS, height: MB_BAS_H, d: 60, wMin: 15, wMax: 30, wStep: 5, wDef: 20,
    parts: (w, d) => mbUnit({ w, d, bodyH: MB_BAS_BODY, color: C_BAS }), note: N_EST }),
  mbEntry({ id: "mb-bas-lv", name: "Bas lave-vaisselle intégrable", group: G_BAS, band: "floor", color: C_BAS, height: MB_BAS_H, d: 60, wMin: 60, wMax: 60, wDef: 60,
    parts: (w, d) => mbUnit({ w, d, bodyH: MB_BAS_BODY, color: C_BAS }), note: `Porte d'appareil intégré 60 × 79,7 cm. ${N_SRC}` }),
  mbEntry({ id: "mb-bas-four", name: "Bas four encastrable + tiroir", group: G_BAS, band: "floor", color: C_BAS, height: MB_BAS_H, d: 60, wMin: 60, wMax: 60, wDef: 60,
    parts: (w, d) => mbUnit({ w, d, bodyH: MB_BAS_BODY, color: C_BAS, rows: [1, -2] }), note: "Proportions estimées (tiroir bas, niche four au-dessus)." }),
  mbEntry({ id: "mb-bas-angle", name: "Bas d'angle en L", group: G_BAS, band: "floor", color: C_BAS, height: MB_BAS_H, d: 90, wMin: 90, wMax: 90, wDef: 90,
    parts: (w, d) => mbCornerL({ w, d, leg: 60, bodyH: MB_BAS_BODY, color: C_BAS }), note: "Hauteur 82,8 cm publiée ; emprise 90 × 90 (branches de 60) estimée. Le plan 2D affiche le carré d'emprise." }),
  // --- Hauts : alignés en haut à 220 cm, profondeur 36 ---
  mbEntry({ id: "mb-haut-abattant", name: "Haut abattant", group: G_HAUT, band: "wall", color: C_HAUT, height: 41.4, yOffset: 220 - 41.4, d: 36, wMin: 60, wMax: 120, wStep: 10, wDef: 120,
    parts: (w, d) => mbUnit({ w, d, plinth: 0, bodyH: 41.4, color: C_HAUT, handle: "h", low: true }), note: `120 × 36 × 41,4 cm, porte relevable, fond en retrait. ${N_SRC} Autres largeurs : ${N_EST}` }),
  mbEntry({ id: "mb-haut-2p", name: "Haut 2 portes", group: G_HAUT, band: "wall", color: C_HAUT, height: 70, yOffset: 150, d: 36, wMin: 60, wMax: 120, wStep: 10, wDef: 80,
    parts: (w, d) => mbUnit({ w, d, plinth: 0, bodyH: 70, color: C_HAUT, cols: w >= 70 ? 2 : 1, low: true }), note: `Hauteur 70 cm estimée (sommet à 220 cm, hauteur max. de tablette citée par Mobalpa). ${N_EST}` }),
  mbEntry({ id: "mb-haut-1p", name: "Haut 1 porte", group: G_HAUT, band: "wall", color: C_HAUT, height: 70, yOffset: 150, d: 36, wMin: 30, wMax: 60, wStep: 10, wDef: 40,
    parts: (w, d) => mbUnit({ w, d, plinth: 0, bodyH: 70, color: C_HAUT, low: true }), note: `Hauteur 70 cm estimée. ${N_EST}` }),
  mbEntry({ id: "mb-haut-ouvert", name: "Étagère ouverte", group: G_HAUT, band: "wall", color: C_HAUT, height: 35, yOffset: 185, d: 30, wMin: 30, wMax: 90, wStep: 10, wDef: 60,
    parts: (w, d) => mbOpenShelf({ w, d, h: 35, color: C_HAUT }), note: "Dimensions estimées." }),
  mbEntry({ id: "mb-haut-angle", name: "Haut d'angle en L", group: G_HAUT, band: "wall", color: C_HAUT, height: 70, yOffset: 150, d: 60, wMin: 60, wMax: 60, wDef: 60,
    parts: (w, d) => mbCornerL({ w, d, leg: 36, plinth: 0, bodyH: 70, color: C_HAUT, low: true }), note: "Dimensions estimées (branches de 36)." }),
  mbEntry({ id: "mb-fileur-haut", name: "Fileur haut", group: G_HAUT, band: "wall", color: C_HAUT, height: 41.4, yOffset: 220 - 41.4, d: 36, wMin: 5, wMax: 5, wDef: 5, note: `5 × 41,4 cm. ${N_SRC}` }),
  // --- Colonnes : caisson 207 + socle 5, profondeur 60 ---
  mbEntry({ id: "mb-col-2p", name: "Colonne 2 portes", group: G_COL, band: "floor", color: C_COL, height: MB_COL_H, d: 60, wMin: 30, wMax: 60, wStep: 10, wDef: 60,
    parts: (w, d) => mbUnit({ w, d, bodyH: MB_COL_BODY, color: C_COL, rows: [3, 2], handle: "v" }), note: `60 × 60 × 207 cm (rangement 5 étagères, ou intégration électroménager, capacité 203,3 cm). ${N_SRC} Autres largeurs : ${N_EST}` }),
  mbEntry({ id: "mb-col-four", name: "Colonne four + micro-ondes (niche 98,5)", group: G_COL, band: "floor", color: C_COL, height: MB_COL_H, d: 60, wMin: 60, wMax: 60, wDef: 60,
    parts: (w, d) => mbUnit({ w, d, bodyH: MB_COL_BODY, color: C_COL, rows: [35, -98.5, 68] }), note: `Colonne 60 × 60 × 207 cm pour appareils encastrés de 98,5 cm. ${N_SRC} Répartition des façades estimée.` }),
  mbEntry({ id: "mb-col-frigo", name: "Colonne réfrigérateur intégrable", group: G_COL, band: "floor", color: C_COL, height: MB_COL_H, d: 60, wMin: 60, wMax: 60, wDef: 60,
    parts: (w, d) => mbUnit({ w, d, bodyH: MB_COL_BODY, color: C_COL, rows: [80, 98, 25] }), note: "Niche de 178 cm usuelle, estimée." }),
  mbEntry({ id: "mb-col-etroite", name: "Colonne étroite coulissante", group: G_COL, band: "floor", color: C_COL, height: MB_COL_H, d: 60, wMin: 15, wMax: 45, wStep: 5, wDef: 30,
    parts: (w, d) => mbUnit({ w, d, bodyH: MB_COL_BODY, color: C_COL, handle: "v" }), note: N_EST }),
  // --- Plans de travail et finitions ---
  mbEntry({ id: "mb-pdt-39", name: "Plan de travail stratifié ép. 3,9", group: G_FIN, band: "floor", color: "#d9d6cf", height: 3.9, yOffset: MB_BAS_H, d: 60, dMin: 60, dMax: 90, dStep: 5, wMin: 100, wMax: 300, wStep: 10, wDef: 180, roundable: true,
    note: `Stratifié 3,9 cm (180 × 90 cm publié). ${N_SRC} Posé sur caisson + socle (87,8 cm) : dessus à 91,7 cm.` }),
  mbEntry({ id: "mb-pdt-18", name: "Plan de travail ép. 1,8 (gorge)", group: G_FIN, band: "floor", color: "#d9d6cf", height: 1.8, yOffset: MB_BAS_H, d: 60.5, wMin: 100, wMax: 300, wStep: 10, wDef: 270, roundable: true,
    note: `Plan à gorge 1,8 cm (277 × 60,5 et 156,5 × 60,5 cm publiés). ${N_SRC}` }),
  mbEntry({ id: "mb-joue", name: "Joue de finition bas", group: G_FIN, band: "floor", color: C_BAS, height: 90.3, d: 60.5, wMin: 1.8, wMax: 1.8, wDef: 1.8, note: `Joue 60,5 × 90,3 cm, ép. 1,8 cm. ${N_SRC}` }),
];

const CATALOG = [
  // --- Cuisine — Meubles ---
  { id: "base-cabinet", name: "Meuble bas", group: "Cuisine — Meubles", band: "floor", symbol: null, color: "#3b6ea5", height: 85, yOffset: 0, depthMin: 60, depthMax: 60, depthStep: 0, defaultDepth: 60, widthMin: 30, widthMax: 120, widthStep: 5, defaultWidth: 60 },
  { id: "drawer-unit", name: "Bloc tiroirs", group: "Cuisine — Meubles", band: "floor", symbol: null, color: "#4a7fb5", height: 85, yOffset: 0, depthMin: 60, depthMax: 60, depthStep: 0, defaultDepth: 60, widthMin: 30, widthMax: 90, widthStep: 5, defaultWidth: 45 },
  { id: "corner-base", name: "Meuble d'angle bas", group: "Cuisine — Meubles", band: "floor", symbol: null, color: "#355d82", height: 85, yOffset: 0, depthMin: 60, depthMax: 60, depthStep: 0, defaultDepth: 60, widthMin: 90, widthMax: 90, widthStep: 0, defaultWidth: 90 },
  { id: "tall-cabinet", name: "Colonne", group: "Cuisine — Meubles", band: "floor", symbol: null, color: "#2f4d6b", height: 200, yOffset: 0, depthMin: 60, depthMax: 60, depthStep: 0, defaultDepth: 60, widthMin: 30, widthMax: 60, widthStep: 5, defaultWidth: 45 },
  { id: "wall-cabinet", name: "Meuble haut", group: "Cuisine — Meubles", band: "wall", symbol: null, color: "#6a8caf", height: 70, yOffset: 140, depthMin: 35, depthMax: 35, depthStep: 0, defaultDepth: 35, widthMin: 30, widthMax: 100, widthStep: 5, defaultWidth: 60 },
  // --- Cuisine — Électroménager ---
  { id: "sink", name: "Évier", group: "Cuisine — Électroménager", band: "floor", symbol: "sink", color: "#dfe8ee", height: 10, yOffset: 78, depthMin: 50, depthMax: 60, depthStep: 5, defaultDepth: 55, widthMin: 50, widthMax: 120, widthStep: 5, defaultWidth: 80 },
  { id: "stove", name: "Plaque à induction", group: "Cuisine — Électroménager", band: "floor", symbol: "stove", color: "#20242b", height: 8, yOffset: 80, depthMin: 50, depthMax: 65, depthStep: 5, defaultDepth: 55, widthMin: 30, widthMax: 90, widthStep: 30, defaultWidth: 60 },
  { id: "fridge", name: "Réfrigérateur", group: "Cuisine — Électroménager", band: "floor", symbol: "fridge", color: "#e7edf1", height: 190, yOffset: 0, depthMin: 50, depthMax: 60, depthStep: 5, defaultDepth: 60, widthMin: 60, widthMax: 90, widthStep: 5, defaultWidth: 60 },
  { id: "dishwasher", name: "Lave-vaisselle", group: "Cuisine — Électroménager", band: "floor", symbol: "dishwasher", color: "#4a7fb5", height: 85, yOffset: 0, depthMin: 60, depthMax: 60, depthStep: 0, defaultDepth: 60, widthMin: 60, widthMax: 60, widthStep: 0, defaultWidth: 60 },
  // --- Réseaux ---
  { id: "water-point", name: "Point d'eau", group: "Réseaux", band: "floor", symbol: "water", color: "#4a90b8", height: 5, yOffset: 60, depthMin: 10, depthMax: 10, depthStep: 0, defaultDepth: 10, widthMin: 10, widthMax: 10, widthStep: 0, defaultWidth: 10 },
  // --- Ouvertures ---
  { id: "door", name: "Porte", group: "Ouvertures", band: "opening", symbol: "door", parts: (w, d) => doorParts(w, d, 200), color: "#eef3f6", height: 200, yOffset: 0, depthMin: 8, depthMax: 8, depthStep: 0, defaultDepth: 8, widthMin: 60, widthMax: 100, widthStep: 5, defaultWidth: 80 },
  { id: "double-door", name: "Porte double", group: "Ouvertures", band: "opening", symbol: "doubledoor", parts: (w, d) => doubleDoorParts(w, d, 200), color: "#eef3f6", height: 200, yOffset: 0, depthMin: 8, depthMax: 8, depthStep: 0, defaultDepth: 8, widthMin: 100, widthMax: 180, widthStep: 10, defaultWidth: 140 },
  { id: "window", name: "Fenêtre", group: "Ouvertures", band: "opening", symbol: "window", parts: (w, d) => windowParts(w, d, 120), color: "#eef3f6", height: 120, yOffset: 90, depthMin: 8, depthMax: 8, depthStep: 0, defaultDepth: 8, widthMin: 40, widthMax: 180, widthStep: 10, defaultWidth: 100 },
  { id: "bay-window", name: "Baie vitrée", group: "Ouvertures", band: "opening", symbol: "bay", parts: (w, d) => bayParts(w, d, 220), color: "#cfe8f0", height: 220, yOffset: 0, depthMin: 8, depthMax: 8, depthStep: 0, defaultDepth: 8, widthMin: 120, widthMax: 300, widthStep: 10, defaultWidth: 180 },
  { id: "shower-screen", name: "Paroi de douche", group: "Ouvertures", band: "opening", symbol: "glasswall", parts: (w, d) => glassScreenParts(w, d, 200), color: "#cfe8f0", height: 200, yOffset: 0, depthMin: 6, depthMax: 6, depthStep: 0, defaultDepth: 6, widthMin: 70, widthMax: 140, widthStep: 10, defaultWidth: 90 },
  // --- Salle de bain ---
  { id: "bathtub", name: "Baignoire", group: "Salle de bain", band: "floor", symbol: "bathtub", color: "#dfe8ee", height: 55, yOffset: 0, depthMin: 70, depthMax: 80, depthStep: 5, defaultDepth: 70, widthMin: 150, widthMax: 180, widthStep: 10, defaultWidth: 170 },
  { id: "shower-tray", name: "Bac de douche", group: "Salle de bain", band: "floor", symbol: "showertray", color: "#dfe8ee", height: 5, yOffset: 0, depthMin: 80, depthMax: 100, depthStep: 10, defaultDepth: 90, widthMin: 80, widthMax: 100, widthStep: 10, defaultWidth: 90 },
  { id: "toilet", name: "WC", group: "Salle de bain", band: "floor", symbol: "toilet", color: "#eef3f6", height: 40, yOffset: 0, depthMin: 40, depthMax: 45, depthStep: 5, defaultDepth: 42, widthMin: 35, widthMax: 40, widthStep: 5, defaultWidth: 38 },
  { id: "vanity", name: "Meuble vasque", group: "Salle de bain", band: "floor", symbol: "sink", color: "#dfe8ee", height: 85, yOffset: 0, depthMin: 45, depthMax: 55, depthStep: 5, defaultDepth: 50, widthMin: 60, widthMax: 120, widthStep: 10, defaultWidth: 80 },
  // --- Séjour / Chambre ---
  { id: "sofa", name: "Canapé", group: "Séjour / Chambre", band: "floor", symbol: "sofa", color: "#7c9473", height: 85, yOffset: 0, depthMin: 85, depthMax: 95, depthStep: 5, defaultDepth: 90, widthMin: 140, widthMax: 280, widthStep: 10, defaultWidth: 200 },
  { id: "armchair", name: "Fauteuil", group: "Séjour / Chambre", band: "floor", symbol: null, color: "#7c9473", height: 85, yOffset: 0, depthMin: 80, depthMax: 80, depthStep: 0, defaultDepth: 80, widthMin: 75, widthMax: 90, widthStep: 5, defaultWidth: 80 },
  { id: "coffee-table", name: "Table basse", group: "Séjour / Chambre", band: "floor", symbol: null, color: "#b98a52", height: 40, yOffset: 0, depthMin: 60, depthMax: 90, depthStep: 10, defaultDepth: 80, widthMin: 90, widthMax: 120, widthStep: 10, defaultWidth: 100, roundable: true },
  { id: "table", name: "Table", group: "Séjour / Chambre", band: "floor", symbol: null, color: "#b98a52", height: 75, yOffset: 0, depthMin: 70, depthMax: 100, depthStep: 10, defaultDepth: 80, widthMin: 100, widthMax: 220, widthStep: 10, defaultWidth: 140, roundable: true },
  { id: "chair", name: "Chaise", group: "Séjour / Chambre", band: "floor", symbol: "chair", color: "#7c9473", height: 90, yOffset: 0, parts: (w, d) => chairParts(w, d, "#7c9473"), depthMin: 45, depthMax: 45, depthStep: 0, defaultDepth: 45, widthMin: 45, widthMax: 45, widthStep: 0, defaultWidth: 45 },
  { id: "bed", name: "Lit", group: "Séjour / Chambre", band: "floor", symbol: "bed", color: "#8a7f9e", height: 45, yOffset: 0, depthMin: 190, depthMax: 200, depthStep: 10, defaultDepth: 200, widthMin: 90, widthMax: 180, widthStep: 10, defaultWidth: 140 },
  { id: "nightstand", name: "Chevet", group: "Séjour / Chambre", band: "floor", symbol: null, color: "#8a7f9e", height: 50, yOffset: 0, depthMin: 35, depthMax: 40, depthStep: 5, defaultDepth: 38, widthMin: 35, widthMax: 45, widthStep: 5, defaultWidth: 40 },
  { id: "wardrobe", name: "Armoire", group: "Séjour / Chambre", band: "floor", symbol: null, color: "#5a6b7a", height: 200, yOffset: 0, depthMin: 55, depthMax: 60, depthStep: 5, defaultDepth: 58, widthMin: 80, widthMax: 200, widthStep: 10, defaultWidth: 120 },
  { id: "dresser", name: "Commode", group: "Séjour / Chambre", band: "floor", symbol: null, color: "#5a6b7a", height: 85, yOffset: 0, depthMin: 45, depthMax: 50, depthStep: 5, defaultDepth: 48, widthMin: 80, widthMax: 140, widthStep: 10, defaultWidth: 100 },
  { id: "buffet", name: "Buffet", group: "Séjour / Chambre", band: "floor", symbol: null, color: "#5a6b7a", height: 85, yOffset: 0, depthMin: 45, depthMax: 50, depthStep: 5, defaultDepth: 48, widthMin: 120, widthMax: 200, widthStep: 10, defaultWidth: 160 },
  { id: "desk", name: "Bureau", group: "Séjour / Chambre", band: "floor", symbol: null, color: "#6a8caf", height: 75, yOffset: 0, depthMin: 60, depthMax: 70, depthStep: 5, defaultDepth: 65, widthMin: 100, widthMax: 160, widthStep: 10, defaultWidth: 120 },
  { id: "tv", name: "Télévision", group: "Séjour / Chambre", band: "wall", symbol: null, color: "#20242b", height: 55, yOffset: 100, depthMin: 6, depthMax: 6, depthStep: 0, defaultDepth: 6, widthMin: 80, widthMax: 160, widthStep: 10, defaultWidth: 110 },
  { id: "worktop", name: "Plan de travail", group: "Cuisine — Meubles", band: "floor", symbol: null, color: "#c9a26a", height: 4, yOffset: 85, depthMin: 40, depthMax: 90, depthStep: 5, defaultDepth: 60, widthMin: 60, widthMax: 300, widthStep: 10, defaultWidth: 200, roundable: true },
  { id: "banquette", name: "Banquette", group: "Cuisine — Meubles", band: "floor", symbol: null, color: "#6f8fa8", height: 45, yOffset: 0, depthMin: 40, depthMax: 60, depthStep: 5, defaultDepth: 50, widthMin: 60, widthMax: 300, widthStep: 10, defaultWidth: 150, roundable: true },
  ...MOBALPA_CATALOG,
];
const catalogById = Object.fromEntries(CATALOG.map((c) => [c.id, c]));
const GROUPS = ["Cuisine — Meubles", "Cuisine — Électroménager", G_BAS, G_HAUT, G_COL, G_FIN, "Réseaux", "Ouvertures", "Salle de bain", "Séjour / Chambre"];
const PLAN_GROUPS = ["Ouvertures", "Réseaux"];
const FURNITURE_GROUPS = GROUPS.filter((g) => !PLAN_GROUPS.includes(g));
const isPlanEntry = (entry) => PLAN_GROUPS.includes(entry.group);

const DEFAULT_VERTICES = [
  { x: 280, y: -140 }, { x: 460, y: -140 }, { x: 460, y: 320 },
  { x: 0, y: 320 }, { x: 0, y: 0 }, { x: 280, y: 0 },
];

// Revêtement de sol par défaut d'une pièce — "none" = pas de motif (sol blanc uni).
const DEFAULT_WALL = "#ece6dc";
const DEFAULT_FLOOR = { type: "none", size: 15, size2: 90, color: "#d9c39a", colorAlt: "#c9ad7a", rotation: 0 };
const FLOOR_TYPES = [
  { id: "none", name: "Aucun (sol uni)" },
  { id: "parquet-droit", name: "Parquet — lames droites" },
  { id: "parquet-batonrompu", name: "Parquet — bâton rompu" },
  { id: "carrelage-quadrillage", name: "Carrelage — quadrillage" },
  { id: "carrelage-damier", name: "Carrelage — damier" },
  { id: "carrelage-hexagone", name: "Carrelage — hexagones" },
];

// ---------------------------------------------------------------------------
// Helpers génériques
// ---------------------------------------------------------------------------
function pad2(n) { return String(n).padStart(2, "0"); }
function timestamp() {
  const d = new Date();
  return `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}_${pad2(d.getHours())}${pad2(d.getMinutes())}`;
}
function uid() { return Math.random().toString(36).slice(2) + Date.now().toString(36); }

function shoelaceAreaM2(vertices) {
  let sum = 0;
  for (let i = 0; i < vertices.length; i++) {
    const a = vertices[i], b = vertices[(i + 1) % vertices.length];
    sum += a.x * b.y - b.x * a.y;
  }
  return Math.round((Math.abs(sum) / 2 / 10000) * 100) / 100;
}
// Segments d'une pièce, uniquement pour l'affichage des cotes — plus aucune
// logique de placement n'en dépend (les objets ne sont plus rattachés aux murs).
function roomEdges(vertices) {
  return vertices.map((A, i) => {
    const B = vertices[(i + 1) % vertices.length];
    const normal = { x: (B.y - A.y), y: -(B.x - A.x) };
    const len = Math.hypot(normal.x, normal.y) || 1;
    return { A, B, normal: { x: normal.x / len, y: normal.y / len }, length: Math.round(Math.hypot(B.x - A.x, B.y - A.y)) };
  });
}

// ---------------------------------------------------------------------------
// Motifs de sol — chaque motif est une tuile répétée (rectangles + polygones),
// exprimée dans un repère local en cm, réutilisée pour le rendu SVG à l'écran,
// l'export "plan pro" et la texture appliquée en 3D.
// ---------------------------------------------------------------------------
function hexPoints(cx, cy, s) {
  const k = s * 0.8660254; // s * sqrt(3)/2
  return [[cx, cy - s], [cx + k, cy - s / 2], [cx + k, cy + s / 2], [cx, cy + s], [cx - k, cy + s / 2], [cx - k, cy - s / 2]];
}
function getFloorPatternGeometry(floor) {
  if (!floor || floor.type === "none") return null;
  const size = Math.max(2, floor.size || 15);
  const color = floor.color || DEFAULT_FLOOR.color;
  const colorAlt = floor.colorAlt || DEFAULT_FLOOR.colorAlt;
  switch (floor.type) {
    case "parquet-droit": {
      const w = size, l = Math.max(size * 1.5, floor.size2 || size * 6);
      return {
        tileWidth: l, tileHeight: w * 2, background: colorAlt,
        rects: [{ x: 0, y: 0, w: l, h: w, fill: color }, { x: 0, y: w, w: l, h: w, fill: color }],
        lines: [{ x1: 0, y1: w, x2: l, y2: w }, { x1: l / 2, y1: w, x2: l / 2, y2: 2 * w }],
      };
    }
    // Le bâton rompu (chaque lame perpendiculaire à la précédente, en zigzag
    // continu) n'est pas généré ici : voir generateHerringbonePlanks ci-dessous
    // — ce motif n'a pas de petite tuile rectangulaire qui se répète tel quel,
    // il est généré lame par lame sur toute la surface de la pièce.
    case "carrelage-quadrillage": {
      const t = size, j = Math.max(0.4, size * 0.05);
      return { tileWidth: t, tileHeight: t, background: colorAlt, rects: [{ x: j, y: j, w: t - 2 * j, h: t - 2 * j, fill: color }], lines: [] };
    }
    case "carrelage-damier": {
      const t = size;
      return {
        tileWidth: 2 * t, tileHeight: 2 * t, background: color,
        rects: [{ x: t, y: 0, w: t, h: t, fill: colorAlt }, { x: 0, y: t, w: t, h: t, fill: colorAlt }],
        lines: [],
      };
    }
    case "carrelage-hexagone": {
      const s = size / 1.6;
      const w = s * 1.7320508, h = s * 3;
      const centers = [[w / 2, s], [0, 2.5 * s], [w, 2.5 * s], [0, -0.5 * s], [w, -0.5 * s]];
      return { tileWidth: w, tileHeight: h, background: colorAlt, polygons: centers.map((c) => ({ points: hexPoints(c[0], c[1], s), fill: color })) };
    }
    default: return null;
  }
}
// --- bâton rompu : génère les lames une à une pour couvrir un rectangle donné
// (le vrai motif n'a pas de petite tuile qui se répète en grille axée x/y —
// chaque lame est perpendiculaire à la précédente et forme un zigzag continu ;
// construction vérifiée : la chaîne (l,l) avance en alternant H/V par pas de
// (l-w,w)/(w,l-w), et les chaînes voisines sont décalées de (-w,w)) ---
function generateHerringbonePlanks(w, l, minX, minY, maxX, maxY) {
  const pad = l * 1.5;
  const bx0 = minX - pad, by0 = minY - pad, bx1 = maxX + pad, by1 = maxY + pad;
  const span = (bx1 - bx0) + (by1 - by0);
  const kCount = Math.min(400, Math.ceil(span / w) + 3);
  const steps = Math.min(400, Math.ceil((2 * span) / Math.max(1, l - w)) + 8);
  const planks = [];
  for (let k = -kCount; k <= kCount; k++) {
    let x = bx0 - w * k, y = by0 + w * k;
    let horizontal = true;
    for (let i = 0; i < steps; i++) {
      const rw = horizontal ? l : w, rh = horizontal ? w : l;
      if (x < bx1 && x + rw > bx0 && y < by1 && y + rh > by0) planks.push({ x, y, w: rw, h: rh });
      if (horizontal) { x += l - w; y += w; } else { x += w; y += l - w; }
      horizontal = !horizontal;
    }
  }
  return planks;
}
function FloorPatternDef({ id, floor }) {
  const geo = useMemo(() => getFloorPatternGeometry(floor), [floor]);
  if (!geo) return null;
  const strokeW = Math.max(0.2, (floor.size || 15) * 0.02);
  return (
    <pattern id={id} patternUnits="userSpaceOnUse" width={geo.tileWidth} height={geo.tileHeight} patternTransform={`rotate(${floor.rotation || 0})`}>
      <rect x={0} y={0} width={geo.tileWidth} height={geo.tileHeight} fill={geo.background} />
      {(geo.rects || []).map((r, i) => <rect key={`r${i}`} x={r.x} y={r.y} width={r.w} height={r.h} fill={r.fill} stroke="rgba(0,0,0,0.22)" strokeWidth={strokeW} />)}
      {(geo.polygons || []).map((p, i) => <polygon key={`p${i}`} points={p.points.map((pt) => pt.join(",")).join(" ")} fill={p.fill} stroke="rgba(0,0,0,0.22)" strokeWidth={strokeW} />)}
      {(geo.lines || []).map((l, i) => <line key={`l${i}`} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} stroke="rgba(0,0,0,0.22)" strokeWidth={strokeW} />)}
    </pattern>
  );
}
// --- rendu du bâton rompu, pièce active (2D) : lames générées sur le
// rectangle englobant puis découpées à la forme exacte de la pièce ---
function HerringboneFloor({ floor, bounds, vertices, clipId }) {
  const w = Math.max(2, floor.size || 15), l = Math.max(w * 1.5, w * 6);
  const planks = useMemo(
    () => generateHerringbonePlanks(w, l, bounds.minX, bounds.minY, bounds.minX + bounds.w, bounds.minY + bounds.h),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [w, l, bounds.minX, bounds.minY, bounds.w, bounds.h]
  );
  const cx = bounds.minX + bounds.w / 2, cy = bounds.minY + bounds.h / 2;
  const strokeW = Math.max(0.2, w * 0.05);
  return (
    <g clipPath={`url(#${clipId})`}>
      <polygon points={vertices.map((v) => `${v.x},${v.y}`).join(" ")} fill={floor.colorAlt || DEFAULT_FLOOR.colorAlt} />
      <g transform={`rotate(${floor.rotation || 0} ${cx} ${cy})`}>
        {planks.map((p, i) => (
          <rect key={i} x={p.x} y={p.y} width={p.w} height={p.h} fill={floor.color || DEFAULT_FLOOR.color} stroke="rgba(0,0,0,0.22)" strokeWidth={strokeW} />
        ))}
      </g>
    </g>
  );
}
function buildHerringboneSVGString(floor, clipId, vertices, minX, minY, maxX, maxY) {
  const w = Math.max(2, floor.size || 15), l = Math.max(w * 1.5, w * 6);
  const planks = generateHerringbonePlanks(w, l, minX, minY, maxX, maxY);
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
  const strokeW = Math.max(0.2, w * 0.05);
  const color = floor.color || DEFAULT_FLOOR.color, colorAlt = floor.colorAlt || DEFAULT_FLOOR.colorAlt;
  const clipDef = `<clipPath id="${clipId}"><polygon points="${vertices.map((v) => `${v.x},${v.y}`).join(" ")}"/></clipPath>`;
  const bg = `<polygon points="${vertices.map((v) => `${v.x},${v.y}`).join(" ")}" fill="${colorAlt}"/>`;
  const planksSvg = planks.map((p) => `<rect x="${p.x.toFixed(1)}" y="${p.y.toFixed(1)}" width="${p.w.toFixed(1)}" height="${p.h.toFixed(1)}" fill="${color}" stroke="rgba(0,0,0,0.22)" stroke-width="${strokeW}"/>`).join("");
  const body = `<g clip-path="url(#${clipId})">${bg}<g transform="rotate(${floor.rotation || 0} ${cx} ${cy})">${planksSvg}</g></g>`;
  return { clipDef, body };
}
// --- texture canvas (3D) construite à partir de la même géométrie que le SVG ---
function finalizeFloorTexture(canvas, tileWidthCm, tileHeightCm, rotationDeg) {
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  if ("colorSpace" in texture) texture.colorSpace = THREE.SRGBColorSpace;
  texture.center.set(0.5, 0.5);
  texture.rotation = ((rotationDeg || 0) * Math.PI) / 180;
  texture.repeat.set(1 / (tileWidthCm / 100), 1 / (tileHeightCm / 100));
  texture.needsUpdate = true;
  return texture;
}
function buildFloorTexture(floor) {
  if (!floor || floor.type === "none" || typeof document === "undefined") return null;
  const scale = 6; // px par cm
  if (floor.type === "parquet-batonrompu") {
    // Pas de petite tuile ici (voir generateHerringbonePlanks) : on génère les
    // lames sur une zone virtuelle assez grande pour paraître continue une
    // fois répétée en 3D (léger raccord invisible au zoom d'une vue d'ensemble).
    const w = Math.max(2, floor.size || 15), l = Math.max(w * 1.5, w * 6);
    const tile = l * 4;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = Math.max(1, Math.round(tile * scale));
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = floor.colorAlt || DEFAULT_FLOOR.colorAlt;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = floor.color || DEFAULT_FLOOR.color;
    ctx.strokeStyle = "rgba(0,0,0,0.22)";
    ctx.lineWidth = Math.max(1, w * 0.05 * scale);
    generateHerringbonePlanks(w, l, 0, 0, tile, tile).forEach((p) => {
      ctx.fillRect(p.x * scale, p.y * scale, p.w * scale, p.h * scale);
      ctx.strokeRect(p.x * scale, p.y * scale, p.w * scale, p.h * scale);
    });
    return finalizeFloorTexture(canvas, tile, tile, 0); // rotation déjà "bakée" dans les lames générées à plat ici
  }
  const geo = getFloorPatternGeometry(floor);
  if (!geo) return null;
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(geo.tileWidth * scale));
  canvas.height = Math.max(1, Math.round(geo.tileHeight * scale));
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = geo.background;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = "rgba(0,0,0,0.22)";
  ctx.lineWidth = Math.max(1, (floor.size || 15) * 0.02 * scale);
  (geo.rects || []).forEach((r) => { ctx.fillStyle = r.fill; ctx.fillRect(r.x * scale, r.y * scale, r.w * scale, r.h * scale); ctx.strokeRect(r.x * scale, r.y * scale, r.w * scale, r.h * scale); });
  (geo.polygons || []).forEach((p) => {
    ctx.fillStyle = p.fill;
    ctx.beginPath();
    p.points.forEach(([x, y], i) => { if (i === 0) ctx.moveTo(x * scale, y * scale); else ctx.lineTo(x * scale, y * scale); });
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  });
  (geo.lines || []).forEach((l) => { ctx.beginPath(); ctx.moveTo(l.x1 * scale, l.y1 * scale); ctx.lineTo(l.x2 * scale, l.y2 * scale); ctx.stroke(); });
  return finalizeFloorTexture(canvas, geo.tileWidth, geo.tileHeight, floor.rotation);
}
function buildFloorPatternDefString(id, floor) {
  const geo = getFloorPatternGeometry(floor);
  if (!geo) return "";
  const strokeW = Math.max(0.2, (floor.size || 15) * 0.02);
  const rectsSvg = (geo.rects || []).map((r) => `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" fill="${r.fill}" stroke="rgba(0,0,0,0.22)" stroke-width="${strokeW}"/>`).join("");
  const polysSvg = (geo.polygons || []).map((p) => `<polygon points="${p.points.map((pt) => pt.join(",")).join(" ")}" fill="${p.fill}" stroke="rgba(0,0,0,0.22)" stroke-width="${strokeW}"/>`).join("");
  const linesSvg = (geo.lines || []).map((l) => `<line x1="${l.x1}" y1="${l.y1}" x2="${l.x2}" y2="${l.y2}" stroke="rgba(0,0,0,0.22)" stroke-width="${strokeW}"/>`).join("");
  return `<pattern id="${id}" patternUnits="userSpaceOnUse" width="${geo.tileWidth}" height="${geo.tileHeight}" patternTransform="rotate(${floor.rotation || 0})"><rect width="${geo.tileWidth}" height="${geo.tileHeight}" fill="${geo.background}"/>${rectsSvg}${polysSvg}${linesSvg}</pattern>`;
}
// --- géométrie d'un objet à partir de x, y, angle (tout est libre) ---
function computeItemGeometry(item) {
  let entry = catalogById[item.catalogId];
  if (!entry) return null;
  // Plateau réglé en hauteur (table) : on décale le plateau et on lui ajoute des pieds.
  if (typeof item.topHeight === "number" && isWorktop(entry)) entry = { ...entry, yOffset: Math.max(0, item.topHeight - entry.height), withLegs: true };
  const rad = ((item.angleDeg || 0) * Math.PI) / 180;
  const u = { x: Math.cos(rad), y: Math.sin(rad) };
  const v = { x: -Math.sin(rad), y: Math.cos(rad) };
  const width = item.width ?? entry.defaultWidth;
  const depth = item.depth ?? entry.defaultDepth;
  const halfW = width / 2, halfD = depth / 2;
  const corners = [
    { x: item.x - u.x * halfW - v.x * halfD, y: item.y - u.y * halfW - v.y * halfD },
    { x: item.x + u.x * halfW - v.x * halfD, y: item.y + u.y * halfW - v.y * halfD },
    { x: item.x + u.x * halfW + v.x * halfD, y: item.y + u.y * halfW + v.y * halfD },
    { x: item.x - u.x * halfW + v.x * halfD, y: item.y - u.y * halfW + v.y * halfD },
  ];
  return { ...item, catalogEntry: entry, width, depth, centerX: item.x, centerY: item.y, corners, u, v, angleRad: -rad };
}

// --- chemin d'un rectangle à coins arrondis (par coin), en repère local u/v ---
function roundedRectPathD(cx, cy, width, depth, u, v, radii) {
  const halfW = width / 2, halfD = depth / 2;
  const r = (radii || [0, 0, 0, 0]).map((ri) => Math.max(0, Math.min(ri, halfW, halfD)));
  const [r0, r1, r2, r3] = r;
  const L = (lx, ly) => ({ x: cx + u.x * lx + v.x * ly, y: cy + u.y * lx + v.y * ly });
  const pt = (p) => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
  let d = `M ${pt(L(-halfW + r0, -halfD))} `;
  d += `L ${pt(L(halfW - r1, -halfD))} `;
  if (r1 > 0) d += `A ${r1} ${r1} 0 0 1 ${pt(L(halfW, -halfD + r1))} `;
  d += `L ${pt(L(halfW, halfD - r2))} `;
  if (r2 > 0) d += `A ${r2} ${r2} 0 0 1 ${pt(L(halfW - r2, halfD))} `;
  d += `L ${pt(L(-halfW + r3, halfD))} `;
  if (r3 > 0) d += `A ${r3} ${r3} 0 0 1 ${pt(L(-halfW, halfD - r3))} `;
  d += `L ${pt(L(-halfW, -halfD + r0))} `;
  if (r0 > 0) d += `A ${r0} ${r0} 0 0 1 ${pt(L(-halfW + r0, -halfD))} `;
  d += "Z";
  return d;
}

// --- symboles standard : géométrie pure, réutilisée à l'écran et à l'export ---
function getSymbolShapes(item) {
  const { u, v, centerX: cx, centerY: cy, width: w, depth: d, catalogEntry: e } = item;
  const L = (lx, ly) => ({ x: cx + u.x * lx + v.x * ly, y: cy + u.y * lx + v.y * ly });
  const angleDeg = (Math.atan2(u.y, u.x) * 180) / Math.PI;
  const shapes = [];
  switch (e.symbol) {
    case "sink": {
      const bw = w - 16, bd = d - 20;
      shapes.push({ type: "polygon", points: [L(-bw / 2, -bd / 2), L(bw / 2, -bd / 2), L(bw / 2, bd / 2), L(-bw / 2, bd / 2)] });
      const tap = L(0, -(d / 2 - 8));
      shapes.push({ type: "circle", cx: tap.x, cy: tap.y, r: 3 });
      break;
    }
    case "chair": {
      // dossier : deux traits côté arrière (-v)
      const bx = Math.max(1, w / 2 - 3);
      [-d / 2 + 3, -d / 2 + 6.5].forEach((ly) => {
        const p1 = L(-bx, ly), p2 = L(bx, ly);
        shapes.push({ type: "line", x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y });
      });
      break;
    }
    case "stove": {
      const r = Math.min(w, d) * 0.13;
      [[-w / 4, -d / 4], [w / 4, -d / 4], [-w / 4, d / 4], [w / 4, d / 4]].forEach(([lx, ly]) => {
        const p = L(lx, ly);
        shapes.push({ type: "circle", cx: p.x, cy: p.y, r });
      });
      break;
    }
    case "fridge": {
      const r = Math.min(w, d) / 2 - 6;
      [0, 60, 120].forEach((deg) => {
        const rad = (deg * Math.PI) / 180;
        const p1 = L(-r * Math.cos(rad), -r * Math.sin(rad));
        const p2 = L(r * Math.cos(rad), r * Math.sin(rad));
        shapes.push({ type: "line", x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y });
      });
      break;
    }
    case "dishwasher": {
      [-d / 4, 0, d / 4].forEach((ly) => {
        const p1 = L(-(w / 2 - 8), ly), p2 = L(w / 2 - 8, ly);
        shapes.push({ type: "line", x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y });
      });
      break;
    }
    case "water": {
      const r = Math.min(w, d) * 0.28;
      const c = L(0, 0);
      shapes.push({ type: "circle", cx: c.x, cy: c.y, r });
      const p1 = L(-w / 2, 0), p2 = L(w / 2, 0), p3 = L(0, -d / 2), p4 = L(0, d / 2);
      shapes.push({ type: "line", x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y });
      shapes.push({ type: "line", x1: p3.x, y1: p3.y, x2: p4.x, y2: p4.y });
      break;
    }
    case "door": {
      const hinge = L(-w / 2, 0), tip = L(-w / 2, w * 0.9), other = L(w / 2, 0);
      shapes.push({ type: "line", x1: hinge.x, y1: hinge.y, x2: tip.x, y2: tip.y });
      shapes.push({ type: "arc", x1: tip.x, y1: tip.y, x2: other.x, y2: other.y, r: w, rot: angleDeg });
      break;
    }
    case "doubledoor": {
      const half = w / 4;
      const hingeL = L(-w / 2, 0), tipL = L(-w / 2, half * 0.9), midL = L(0, 0);
      shapes.push({ type: "line", x1: hingeL.x, y1: hingeL.y, x2: tipL.x, y2: tipL.y });
      shapes.push({ type: "arc", x1: tipL.x, y1: tipL.y, x2: midL.x, y2: midL.y, r: half, rot: angleDeg });
      const hingeR = L(w / 2, 0), tipR = L(w / 2, half * 0.9), midR = L(0, 0);
      shapes.push({ type: "line", x1: hingeR.x, y1: hingeR.y, x2: tipR.x, y2: tipR.y });
      shapes.push({ type: "arc", x1: midR.x, y1: midR.y, x2: tipR.x, y2: tipR.y, r: half, rot: angleDeg });
      break;
    }
    case "window": {
      [-1.5, 1.5].forEach((ly) => {
        const p1 = L(-w / 2, ly), p2 = L(w / 2, ly);
        shapes.push({ type: "line", x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y });
      });
      break;
    }
    case "glasswall": {
      [-1.2, 1.2].forEach((ly) => {
        const p1 = L(-w / 2, ly), p2 = L(w / 2, ly);
        shapes.push({ type: "line", x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y });
      });
      break;
    }
    case "bay": {
      [-1.5, 1.5].forEach((ly) => {
        const p1 = L(-w / 2, ly), p2 = L(w / 2, ly);
        shapes.push({ type: "line", x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y });
      });
      const mid = L(0, 0), armTip = L(w * 0.18, 0), arrowA = L(w * 0.1, -6), arrowB = L(w * 0.1, 6);
      shapes.push({ type: "line", x1: mid.x, y1: mid.y, x2: armTip.x, y2: armTip.y });
      shapes.push({ type: "line", x1: armTip.x, y1: armTip.y, x2: arrowA.x, y2: arrowA.y });
      shapes.push({ type: "line", x1: armTip.x, y1: armTip.y, x2: arrowB.x, y2: arrowB.y });
      break;
    }
    case "bathtub": {
      const bw = w - 10, bd = d - 10;
      shapes.push({ type: "polygon", points: [L(-bw / 2, -bd / 2), L(bw / 2, -bd / 2), L(bw / 2, bd / 2), L(-bw / 2, bd / 2)] });
      const drain = L(w / 2 - 14, 0);
      shapes.push({ type: "circle", cx: drain.x, cy: drain.y, r: 4 });
      break;
    }
    case "showertray": {
      const p1 = L(-w / 2 + 6, -d / 2 + 6), p2 = L(w / 2 - 6, d / 2 - 6);
      const p3 = L(w / 2 - 6, -d / 2 + 6), p4 = L(-w / 2 + 6, d / 2 - 6);
      shapes.push({ type: "line", x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y });
      shapes.push({ type: "line", x1: p3.x, y1: p3.y, x2: p4.x, y2: p4.y });
      const c = L(0, 0);
      shapes.push({ type: "circle", cx: c.x, cy: c.y, r: 4 });
      break;
    }
    case "toilet": {
      const tank = [L(-w / 2 + 4, -d / 2), L(w / 2 - 4, -d / 2), L(w / 2 - 4, -d / 2 + 8), L(-w / 2 + 4, -d / 2 + 8)];
      shapes.push({ type: "polygon", points: tank });
      const bowl = L(0, d * 0.15);
      shapes.push({ type: "circle", cx: bowl.x, cy: bowl.y, r: Math.min(w, d) * 0.32 });
      break;
    }
    case "sofa": {
      const back1 = L(-w / 2, -d / 2), back2 = L(w / 2, -d / 2);
      shapes.push({ type: "line", x1: back1.x, y1: back1.y, x2: back2.x, y2: back2.y });
      [-w / 6, w / 6].forEach((lx) => {
        const p1 = L(lx, -d / 2 + 6), p2 = L(lx, d / 2 - 4);
        shapes.push({ type: "line", x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y });
      });
      break;
    }
    case "bed": {
      const pillowW = w * 0.35, pillowH = Math.min(24, d * 0.25);
      const left = [L(-w / 2 + 6, -d / 2 + 6), L(-w / 2 + 6 + pillowW, -d / 2 + 6), L(-w / 2 + 6 + pillowW, -d / 2 + 6 + pillowH), L(-w / 2 + 6, -d / 2 + 6 + pillowH)];
      const right = [L(w / 2 - 6 - pillowW, -d / 2 + 6), L(w / 2 - 6, -d / 2 + 6), L(w / 2 - 6, -d / 2 + 6 + pillowH), L(w / 2 - 6 - pillowW, -d / 2 + 6 + pillowH)];
      shapes.push({ type: "polygon", points: left });
      shapes.push({ type: "polygon", points: right });
      const fold1 = L(-w / 2, -d / 2 + pillowH + 16), fold2 = L(w / 2, -d / 2 + pillowH + 16);
      shapes.push({ type: "line", x1: fold1.x, y1: fold1.y, x2: fold2.x, y2: fold2.y });
      break;
    }
    default: break;
  }
  return shapes;
}

function SymbolShapes({ item }) {
  return getSymbolShapes(item).map((s, i) => {
    if (s.type === "polygon") return <polygon key={i} points={s.points.map((p) => `${p.x},${p.y}`).join(" ")} fill="none" stroke="#1d2733" strokeWidth={0.7} vectorEffect="non-scaling-stroke" />;
    if (s.type === "circle") return <circle key={i} cx={s.cx} cy={s.cy} r={s.r} fill="none" stroke="#1d2733" strokeWidth={0.7} vectorEffect="non-scaling-stroke" />;
    if (s.type === "line") return <line key={i} x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} stroke="#1d2733" strokeWidth={0.8} vectorEffect="non-scaling-stroke" />;
    if (s.type === "arc") return <path key={i} d={`M ${s.x1} ${s.y1} A ${s.r} ${s.r} ${s.rot} 0 1 ${s.x2} ${s.y2}`} fill="none" stroke="#1d2733" strokeWidth={0.6} strokeDasharray="2,2" vectorEffect="non-scaling-stroke" />;
    return null;
  });
}

function buildShapeElement(s) {
  if (s.type === "polygon") return `<polygon points="${s.points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ")}" fill="none" stroke="#111" stroke-width="1"/>`;
  if (s.type === "circle") return `<circle cx="${s.cx.toFixed(1)}" cy="${s.cy.toFixed(1)}" r="${s.r.toFixed(1)}" fill="none" stroke="#111" stroke-width="1"/>`;
  if (s.type === "line") return `<line x1="${s.x1.toFixed(1)}" y1="${s.y1.toFixed(1)}" x2="${s.x2.toFixed(1)}" y2="${s.y2.toFixed(1)}" stroke="#111" stroke-width="1"/>`;
  if (s.type === "arc") return `<path d="M ${s.x1.toFixed(1)} ${s.y1.toFixed(1)} A ${s.r.toFixed(1)} ${s.r.toFixed(1)} ${s.rot.toFixed(1)} 0 1 ${s.x2.toFixed(1)} ${s.y2.toFixed(1)}" fill="none" stroke="#111" stroke-width="0.8" stroke-dasharray="2,2"/>`;
  return "";
}

function buildBoxArrays(w, h, d) {
  const x = w / 2, y = h, z = d / 2;
  const positions = new Float32Array([
    x, 0, -z, x, 0, z, x, y, z, x, y, -z,
    -x, 0, z, -x, 0, -z, -x, y, -z, -x, y, z,
    -x, y, -z, x, y, -z, x, y, z, -x, y, z,
    -x, 0, z, x, 0, z, x, 0, -z, -x, 0, -z,
    -x, 0, z, x, 0, z, x, y, z, -x, y, z,
    x, 0, -z, -x, 0, -z, -x, y, -z, x, y, -z,
  ]);
  const normals = new Float32Array([
    1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0,
    -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0,
    0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0,
    0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0,
    0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1,
    0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1,
  ]);
  const indices = new Uint16Array([
    0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7, 8, 9, 10, 8, 10, 11,
    12, 13, 14, 12, 14, 15, 16, 17, 18, 16, 18, 19, 20, 21, 22, 20, 22, 23,
  ]);
  return { positions, normals, indices };
}
// --- Évier et plaque de cuisson : ils traversent toujours le plan de travail qui les porte ---
// Le plan est découpé (trou de l'empreinte), l'évier s'enfonce dans une cuve, la plaque est encastrée.
// Tout est calculé dans le repère local de l'objet : x = largeur (u), z = profondeur (v).
const isWorktop = (e) => e.id === "worktop" || e.id.startsWith("mb-pdt");
const isCutout = (e) => e.id === "sink" || e.id === "stove";
const SINK_DEPTH = 18;
function toLocal(obj, p) {
  const dx = p.x - obj.centerX, dy = p.y - obj.centerY;
  return { x: dx * obj.u.x + dy * obj.u.y, z: dx * obj.v.x + dy * obj.v.y };
}
function aabbLocal(obj, pts) {
  const cs = pts.map((p) => toLocal(obj, p));
  return { x0: Math.min(...cs.map((c) => c.x)), x1: Math.max(...cs.map((c) => c.x)), z0: Math.min(...cs.map((c) => c.z)), z1: Math.max(...cs.map((c) => c.z)) };
}
// Retire le rectangle h du rectangle r ; renvoie r lui-même s'ils ne se touchent pas.
function subtractRect(r, h) {
  const ix0 = Math.max(r.x0, h.x0), ix1 = Math.min(r.x1, h.x1), iz0 = Math.max(r.z0, h.z0), iz1 = Math.min(r.z1, h.z1);
  if (ix0 >= ix1 || iz0 >= iz1) return [r];
  const out = [];
  if (r.x0 < ix0) out.push({ x0: r.x0, x1: ix0, z0: r.z0, z1: r.z1 });
  if (ix1 < r.x1) out.push({ x0: ix1, x1: r.x1, z0: r.z0, z1: r.z1 });
  if (r.z0 < iz0) out.push({ x0: ix0, x1: ix1, z0: r.z0, z1: iz0 });
  if (iz1 < r.z1) out.push({ x0: ix0, x1: ix1, z0: iz1, z1: r.z1 });
  return out;
}
// Plan de travail qui porte l'évier / la plaque : celui dont l'emprise contient le centre de l'objet.
function hostWorktop(f, all) {
  let best = null;
  all.forEach((o) => {
    if (!isWorktop(o.catalogEntry)) return;
    const c = toLocal(o, { x: f.centerX, y: f.centerY });
    if (Math.abs(c.x) > o.width / 2 || Math.abs(c.z) > o.depth / 2) return;
    const top = o.catalogEntry.yOffset + o.catalogEntry.height;
    if (!best || top > best.top) best = { item: o, top, thick: o.catalogEntry.height };
  });
  return best;
}
function worktopBoxes(item, all) {
  const e = item.catalogEntry;
  let rects = [{ x0: -item.width / 2, x1: item.width / 2, z0: -item.depth / 2, z1: item.depth / 2 }];
  all.forEach((f) => {
    if (!isCutout(f.catalogEntry)) return;
    const host = hostWorktop(f, all);
    if (!host || host.item.uid !== item.uid) return;
    const hole = aabbLocal(item, f.corners);
    rects = rects.flatMap((r) => subtractRect(r, hole));
  });
  const boxes = rects.map((r) => mbBox((r.x0 + r.x1) / 2, 0, (r.z0 + r.z1) / 2, r.x1 - r.x0, e.height, r.z1 - r.z0, e.color));
  if (e.withLegs && e.yOffset > 1) {
    const inset = Math.min(6, item.width / 4, item.depth / 4), lw = 5;
    [-1, 1].forEach((sx) => [-1, 1].forEach((sz) => boxes.push(
      mbBox(sx * (item.width / 2 - inset), -e.yOffset, sz * (item.depth / 2 - inset), lw, e.yOffset, lw, e.color))));
  }
  return boxes;
}
function cutoutBoxes(item, all) {
  const e = item.catalogEntry, w = item.width, d = item.depth;
  const host = hostWorktop(item, all);
  const top = (host ? host.top : e.yOffset + e.height) - e.yOffset; // surface du plan, dans le repère de l'objet
  const thick = host ? host.thick : 4;
  if (e.id === "sink") {
    const steel = "#c9d1d9", inner = "#9aa6b2", tapC = "#aeb7c0";
    const rim = Math.min(2.5, w / 4, d / 4), t = 0.8, bw = w - 2 * rim, bd = d - 2 * rim, yB = top - SINK_DEPTH;
    return [
      // cadre : traverse le plan de travail sur toute son épaisseur et dépasse de 0,6 cm
      mbBox(0, top - thick, -(d - rim) / 2, w, thick + 0.6, rim, steel),
      mbBox(0, top - thick, (d - rim) / 2, w, thick + 0.6, rim, steel),
      mbBox(-(w - rim) / 2, top - thick, 0, rim, thick + 0.6, bd, steel),
      mbBox((w - rim) / 2, top - thick, 0, rim, thick + 0.6, bd, steel),
      // cuve : fond et quatre parois
      mbBox(0, yB, 0, bw, t, bd, inner),
      mbBox(0, yB, -(bd - t) / 2, bw, SINK_DEPTH, t, inner),
      mbBox(0, yB, (bd - t) / 2, bw, SINK_DEPTH, t, inner),
      mbBox(-(bw - t) / 2, yB, 0, t, SINK_DEPTH, bd - 2 * t, inner),
      mbBox((bw - t) / 2, yB, 0, t, SINK_DEPTH, bd - 2 * t, inner),
      // robinet : colonne + bec
      mbBox(0, top + 0.6, -d / 2 + rim / 2, 3, 20, 3, tapC),
      mbBox(0, top + 0.6 + 18, -d / 2 + rim / 2 + 6, 2, 2, 12, tapC),
    ];
  }
  const zs = Math.min(w, d) * 0.3;
  return [
    mbBox(0, top - 6, 0, w - 2, 6, d - 2, "#3a3f48"), // corps encastré, il traverse le plan
    mbBox(0, top, 0, w, 0.6, d, "#15181d"), // vitre
    ...[[-w / 4, -d / 4], [w / 4, -d / 4], [-w / 4, d / 4], [w / 4, d / 4]].map(([x, z]) => mbBox(x, top + 0.6, z, zs, 0.1, zs, "#4a505a")),
  ];
}
// Creuse la cuve de l'évier dans les caissons situés dessous (sinon elle resterait cachée dans le meuble).
function carveSinkCavities(item, boxes, all) {
  const e = item.catalogEntry;
  let out = boxes;
  all.forEach((f) => {
    if (f.catalogEntry.id !== "sink" || f.uid === item.uid) return;
    const host = hostWorktop(f, all);
    if (!host) return;
    const rim = Math.min(2.5, f.width / 4, f.depth / 4);
    const a = aabbLocal(item, f.corners);
    const cav = { x0: a.x0 + rim, x1: a.x1 - rim, z0: a.z0 + rim, z1: a.z1 - rim };
    if (cav.x0 >= cav.x1 || cav.z0 >= cav.z1) return;
    const yFloor = host.top - SINK_DEPTH;
    out = out.flatMap((b) => {
      if (b.w <= 5 || b.h <= 5 || b.d <= 5) return [b]; // façades, poignées, socle : on n'y touche pas
      const bot = e.yOffset + b.y, top = bot + b.h;
      if (bot >= host.top - 0.1) return [b]; // au-dessus du plan (meubles hauts) : rien à creuser
      const r = { x0: b.x - b.w / 2, x1: b.x + b.w / 2, z0: b.z - b.d / 2, z1: b.z + b.d / 2 };
      const pieces = subtractRect(r, cav);
      if (pieces.length === 1 && pieces[0] === r) return [b];
      const res = [];
      if (bot < yFloor) res.push({ ...b, h: Math.min(top, yFloor) - bot });
      const upBot = Math.max(bot, yFloor);
      if (top > upBot) pieces.forEach((p) => res.push(mbBox((p.x0 + p.x1) / 2, upBot - e.yOffset, (p.z0 + p.z1) / 2, p.x1 - p.x0, top - upBot, p.z1 - p.z0, b.color)));
      return res;
    });
  });
  return out;
}
// --- Murs 3D : pleins et colorés, visibles seulement de l'intérieur de la pièce (face arrière non
// dessinée) et percés là où une porte, une fenêtre ou une baie est posée sur le mur. ---
const isWallOpening = (e) => e.band === "opening" && e.id !== "shower-screen";
function pointInPoly(p, verts) {
  let inside = false;
  for (let i = 0, j = verts.length - 1; i < verts.length; j = i++) {
    const a = verts[i], b = verts[j];
    if ((a.y > p.y) !== (b.y > p.y) && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}
function buildWallMeshes(room, openings, wallColor) {
  const H = room.height, verts = room.vertices, meshes = [];
  const mat = new THREE.MeshStandardMaterial({ color: wallColor, roughness: 0.95, metalness: 0 });
  const edgeMat = new THREE.LineBasicMaterial({ color: 0x3a4654 });
  verts.forEach((A, i) => {
    const B = verts[(i + 1) % verts.length];
    const L = Math.hypot(B.x - A.x, B.y - A.y);
    if (L < 1) return;
    const dir = { x: (B.x - A.x) / L, y: (B.y - A.y) / L };
    // normale intérieure : celle des deux côtés du mur qui pointe dans la pièce
    let n = { x: -dir.y, y: dir.x }, flipped = false;
    if (!pointInPoly({ x: (A.x + B.x) / 2 + n.x * 3, y: (A.y + B.y) / 2 + n.y * 3 }, verts)) { n = { x: -n.x, y: -n.y }; flipped = true; }
    // repère du mur : x = abscisse le long du mur, z = hauteur
    let rects = [{ x0: 0, x1: L, z0: 0, z1: H }];
    openings.forEach((o) => {
      const rel = { x: o.centerX - A.x, y: o.centerY - A.y };
      const along = rel.x * dir.x + rel.y * dir.y, perp = Math.abs(rel.x * n.x + rel.y * n.y);
      if (perp > 20 || Math.abs(o.u.x * dir.x + o.u.y * dir.y) < 0.9 || along < 0 || along > L) return;
      const e = o.catalogEntry;
      const hole = { x0: Math.max(0, along - o.width / 2), x1: Math.min(L, along + o.width / 2), z0: Math.max(0, e.yOffset), z1: Math.min(H, e.yOffset + e.height) };
      rects = rects.flatMap((r) => subtractRect(r, hole));
    });
    const pos = [], nor = [];
    const Pt = (u, v) => [(A.x + dir.x * u) / 100, v / 100, (A.y + dir.y * u) / 100];
    rects.forEach((r) => {
      const p0 = Pt(r.x0, r.z0), p1 = Pt(r.x1, r.z0), p2 = Pt(r.x1, r.z1), p3 = Pt(r.x0, r.z1);
      (flipped ? [p0, p2, p1, p0, p3, p2] : [p0, p1, p2, p0, p2, p3]).forEach((p) => { pos.push(...p); nor.push(n.x, 0, n.y); });
    });
    if (!pos.length) return;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
    const mesh = new THREE.Mesh(geo, mat);
    mesh.receiveShadow = true;
    mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo), edgeMat));
    meshes.push(mesh);
  });
  return meshes;
}
// Boîtes (repère de l'objet) d'un objet placé : ses "parts" si le catalogue en définit, sinon une boîte unique.
// `all` = les objets de la pièce (pour percer les plans de travail et creuser les caissons sous un évier).
function itemBoxes(item, all = []) {
  const e = item.catalogEntry;
  if (isWorktop(e)) return worktopBoxes(item, all);
  if (isCutout(e)) return cutoutBoxes(item, all);
  const boxes = e.parts ? e.parts(item.width, item.depth) : [mbBox(0, 0, 0, item.width, e.height, item.depth, e.color)];
  return carveSinkCavities(item, boxes, all);
}
function hexToRgb01(hex) {
  const n = parseInt(hex.replace("#", ""), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

// ---------------------------------------------------------------------------
// Export 3D — GLTF minimal (boîtes positionnées/rotées) de la pièce active
// ---------------------------------------------------------------------------
function exportGLTF(items, format = "gltf") {
  const chunks = [];
  let byteOffset = 0;
  const bufferViews = [], accessors = [], meshes = [], nodes = [], materials = [];
  const materialIndexByColor = {};

  items.forEach((item, i) => {
    const primitives = [];
    itemBoxes(item, items).forEach((box) => {
    const { positions, normals, indices } = buildBoxArrays(box.w / 100, box.h / 100, box.d / 100);
    for (let v = 0; v < positions.length; v += 3) { positions[v] += box.x / 100; positions[v + 1] += box.y / 100; positions[v + 2] += box.z / 100; }

    const posBytes = new Uint8Array(positions.buffer);
    bufferViews.push({ buffer: 0, byteOffset, byteLength: posBytes.length, target: 34962 });
    const posViewIdx = bufferViews.length - 1; byteOffset += posBytes.length; chunks.push(posBytes);

    const normBytes = new Uint8Array(normals.buffer);
    bufferViews.push({ buffer: 0, byteOffset, byteLength: normBytes.length, target: 34962 });
    const normViewIdx = bufferViews.length - 1; byteOffset += normBytes.length; chunks.push(normBytes);

    const idxBytes = new Uint8Array(indices.buffer);
    bufferViews.push({ buffer: 0, byteOffset, byteLength: idxBytes.length, target: 34963 });
    const idxViewIdx = bufferViews.length - 1; byteOffset += idxBytes.length; chunks.push(idxBytes);

    let minP = [Infinity, Infinity, Infinity], maxP = [-Infinity, -Infinity, -Infinity];
    for (let v = 0; v < positions.length; v += 3) {
      for (let k = 0; k < 3; k++) { minP[k] = Math.min(minP[k], positions[v + k]); maxP[k] = Math.max(maxP[k], positions[v + k]); }
    }
    accessors.push({ bufferView: posViewIdx, componentType: 5126, count: positions.length / 3, type: "VEC3", min: minP, max: maxP });
    const posAcc = accessors.length - 1;
    accessors.push({ bufferView: normViewIdx, componentType: 5126, count: normals.length / 3, type: "VEC3" });
    const normAcc = accessors.length - 1;
    accessors.push({ bufferView: idxViewIdx, componentType: 5123, count: indices.length, type: "SCALAR" });
    const idxAcc = accessors.length - 1;

    const color = box.alpha != null ? `${box.color}|${box.alpha}` : box.color;
    if (!(color in materialIndexByColor)) {
      materials.push({
        name: item.catalogEntry.name,
        pbrMetallicRoughness: { baseColorFactor: [...hexToRgb01(box.color), box.alpha ?? 1], metallicFactor: 0.05, roughnessFactor: 0.8 },
        ...(box.alpha != null ? { alphaMode: "BLEND", doubleSided: true } : {}),
      });
      materialIndexByColor[color] = materials.length - 1;
    }
    primitives.push({ attributes: { POSITION: posAcc, NORMAL: normAcc }, indices: idxAcc, material: materialIndexByColor[color] });
    });
    meshes.push({ name: `${item.catalogEntry.name}_${i}`, primitives });

    const half = item.angleRad / 2;
    nodes.push({ name: `${item.catalogEntry.name}_${i}`, mesh: meshes.length - 1, translation: [item.centerX / 100, item.catalogEntry.yOffset / 100, item.centerY / 100], rotation: [0, Math.sin(half), 0, Math.cos(half)] });
  });

  const totalLength = chunks.reduce((s, c) => s + c.length, 0);
  const bin = new Uint8Array(totalLength);
  let off = 0;
  chunks.forEach((c) => { bin.set(c, off); off += c.length; });
  const gltfBase = {
    asset: { version: "2.0", generator: "kitchen-designer-prototype" },
    scene: 0, scenes: [{ nodes: nodes.map((_, i) => i) }],
    nodes, meshes, materials,
    bufferViews, accessors,
  };
  let blob, ext;
  if (format === "glb") {
    // GLB : en-tête (12 octets) + bloc JSON + bloc binaire, chaque bloc aligné sur 4 octets
    const json = new TextEncoder().encode(JSON.stringify({ ...gltfBase, buffers: [{ byteLength: totalLength }] }));
    const jsonLen = json.length + ((4 - (json.length % 4)) % 4);
    const binLen = totalLength + ((4 - (totalLength % 4)) % 4);
    const glb = new Uint8Array(12 + 8 + jsonLen + 8 + binLen);
    const dv = new DataView(glb.buffer);
    dv.setUint32(0, 0x46546c67, true); dv.setUint32(4, 2, true); dv.setUint32(8, glb.length, true);
    dv.setUint32(12, jsonLen, true); dv.setUint32(16, 0x4e4f534a, true);
    glb.set(json, 20); glb.fill(0x20, 20 + json.length, 20 + jsonLen);
    const binStart = 20 + jsonLen;
    dv.setUint32(binStart, binLen, true); dv.setUint32(binStart + 4, 0x004e4942, true);
    glb.set(bin, binStart + 8);
    blob = new Blob([glb], { type: "model/gltf-binary" }); ext = "glb";
  } else {
    let binaryStr = "";
    for (let i = 0; i < bin.length; i++) binaryStr += String.fromCharCode(bin[i]);
    const gltf = { ...gltfBase, buffers: [{ byteLength: totalLength, uri: `data:application/octet-stream;base64,${btoa(binaryStr)}` }] };
    blob = new Blob([JSON.stringify(gltf, null, 2)], { type: "model/gltf+json" }); ext = "gltf";
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `piece_${timestamp()}.${ext}`;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// Export plan pro — SVG vectoriel, toutes les pièces empilées, cotes + symboles
// ---------------------------------------------------------------------------
function exportFloorPlanSVG(rooms, items) {
  const perRoom = rooms.map((room) => {
    const xs = room.vertices.map((v) => v.x), ys = room.vertices.map((v) => v.y);
    const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
    const roomItems = items.filter((it) => it.roomId === room.id).map(computeItemGeometry).filter(Boolean);
    return { room, minX, maxX, minY, maxY, w: maxX - minX, h: maxY - minY, items: roomItems, area: shoelaceAreaM2(room.vertices) };
  });

  const padOut = 120, gapBetweenRooms = 100, titleHeight = 60;
  const totalWidth = Math.max(...perRoom.map((r) => r.w)) + padOut * 2;
  const totalHeight = perRoom.reduce((s, r) => s + r.h + titleHeight + gapBetweenRooms, 0) + padOut;

  let defs = "";
  let body = "";
  let cursorY = padOut;
  perRoom.forEach(({ room, minX, minY, w, h, items: roomItems, area }, roomIdx) => {
    const ox = -minX + padOut, oy = -minY + cursorY + titleHeight;
    const tr = (p) => ({ x: p.x + ox, y: p.y + oy });

    const floor = room.floor && room.floor.type !== "none" ? room.floor : null;
    const patternId = `floorpat-${roomIdx}`;
    const trVerts = room.vertices.map((v) => tr(v));
    const trXs = trVerts.map((v) => v.x), trYs = trVerts.map((v) => v.y);

    body += `<text x="${padOut}" y="${cursorY + 20}" font-family="monospace" font-size="16" font-weight="bold" fill="#111">${room.name} — ${area} m²</text>`;
    if (floor && floor.type === "parquet-batonrompu") {
      const hb = buildHerringboneSVGString(floor, `floorclip-${roomIdx}`, trVerts, Math.min(...trXs), Math.min(...trYs), Math.max(...trXs), Math.max(...trYs));
      defs += hb.clipDef;
      body += hb.body;
      body += `<polygon points="${trVerts.map((p) => `${p.x},${p.y}`).join(" ")}" fill="none" stroke="#111" stroke-width="6" stroke-linejoin="round"/>`;
    } else {
      const floorFill = floor ? `url(#${patternId})` : "#fff";
      if (floor) defs += buildFloorPatternDefString(patternId, floor);
      body += `<polygon points="${trVerts.map((p) => `${p.x},${p.y}`).join(" ")}" fill="${floorFill}" stroke="#111" stroke-width="6" stroke-linejoin="round"/>`;
    }

    roomEdges(room.vertices).forEach((wl) => {
      const A = tr(wl.A), B = tr(wl.B);
      const mx = (A.x + B.x) / 2, my = (A.y + B.y) / 2;
      const lx = mx + wl.normal.x * 22, ly = my + wl.normal.y * 22;
      body += `<text x="${lx}" y="${ly}" font-family="monospace" font-size="11" text-anchor="middle" fill="#111">${(wl.length / 100).toFixed(2)} m</text>`;
    });

    roomItems.forEach((item) => {
      const isWall = item.catalogEntry.band === "wall";
      const isOpening = item.catalogEntry.band === "opening";
      const shifted = { ...item, centerX: item.centerX + ox, centerY: item.centerY + oy };
      if (item.catalogEntry.roundable) {
        const d = roundedRectPathD(shifted.centerX, shifted.centerY, item.width, item.depth, item.u, item.v, item.radii);
        body += `<path d="${d}" fill="${item.catalogEntry.color}" fill-opacity="0.55" stroke="#111" stroke-width="1.2"/>`;
      } else {
        const corners = item.corners.map((c) => tr(c));
        const fill = isOpening ? "#fff" : isWall ? "none" : item.catalogEntry.color;
        const fillOpacity = isOpening || isWall ? 1 : 0.35;
        body += `<polygon points="${corners.map((c) => `${c.x},${c.y}`).join(" ")}" fill="${fill}" fill-opacity="${fillOpacity}" stroke="#111" stroke-width="${isWall ? 0.8 : 1.2}" ${isWall ? 'stroke-dasharray="4,3"' : ""}/>`;
      }
      getSymbolShapes(shifted).forEach((s) => { body += buildShapeElement(s); });
      if (item.width > 25) {
        const c = tr({ x: item.centerX, y: item.centerY });
        body += `<text x="${c.x}" y="${c.y + 3}" font-family="monospace" font-size="8" text-anchor="middle" fill="#111">${item.catalogEntry.name}</text>`;
      }
    });

    cursorY += h + titleHeight + gapBetweenRooms;
  });

  const now = new Date();
  body += `<text x="${padOut}" y="${totalHeight - 20}" font-family="monospace" font-size="10" fill="#555">Cotes en mètres · ${now.toLocaleDateString("fr-FR")} · document de travail, non contractuel</text>`;

  const svg = `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalWidth} ${totalHeight}" width="${totalWidth}" height="${totalHeight}">\n<defs>${defs}</defs>\n<rect x="0" y="0" width="${totalWidth}" height="${totalHeight}" fill="#ffffff"/>\n${body}\n</svg>`;

  const blob = new Blob([svg], { type: "image/svg+xml" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `plan_appartement_${timestamp()}.svg`;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// Liste de matériel — CSV regroupé par article identique, toutes pièces confondues
// ---------------------------------------------------------------------------
function csvCell(value) {
  const s = String(value ?? "");
  return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function exportMaterialsCSV(rooms, items) {
  const roomNameById = Object.fromEntries(rooms.map((r) => [r.id, r.name]));
  const groups = {};
  const order = GROUPS;
  items.forEach((item) => {
    const entry = catalogById[item.catalogId];
    if (!entry) return;
    const width = item.width ?? entry.defaultWidth, depth = item.depth ?? entry.defaultDepth;
    const key = `${entry.group}|${entry.name}|${width}|${depth}|${entry.height}`;
    if (!groups[key]) {
      groups[key] = { category: entry.group, name: entry.name, width, depth, height: entry.height, qty: 0, roundable: !!entry.roundable, rooms: [] };
    }
    groups[key].qty += 1;
    const roomName = roomNameById[item.roomId] || "?";
    if (!groups[key].rooms.includes(roomName)) groups[key].rooms.push(roomName);
  });

  const rows = [["Catégorie", "Désignation", "Largeur (cm)", "Profondeur (cm)", "Hauteur (cm)", "Quantité", "Surface unitaire (m²)", "Pièce(s)", "Prix unitaire (€)", "Prix total (€)"]];
  Object.values(groups)
    .sort((a, b) => order.indexOf(a.category) - order.indexOf(b.category) || a.name.localeCompare(b.name))
    .forEach((g) => {
      const surface = g.roundable ? ((g.width * g.depth) / 10000).toFixed(2) : "";
      rows.push([g.category, g.name, g.width, g.depth, g.height, g.qty, surface, g.rooms.join(", "), "", ""]);
    });

  const csv = rows.map((r) => r.map(csvCell).join(";")).join("\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `liste_materiel_${timestamp()}.csv`;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// Export / import de projet — JSON réimportable pour partager un design
// ---------------------------------------------------------------------------
function exportProjectJSON(state) {
  const data = { format: "atelier-cuisine", version: 2, savedAt: new Date().toISOString(), ...state };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `projet_${timestamp()}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// Persistance locale (localStorage) — plusieurs projets, chargement auto
// ---------------------------------------------------------------------------
const LS_PROJECTS = "atelier-cuisine-projects-v2";
const LS_ACTIVE = "atelier-cuisine-active-v2";
// Anciennes clés (v1 : une seule pièce, meubles rattachés aux murs) — utilisées
// une seule fois pour récupérer les projets existants si le v2 est vide.
const LS_PROJECTS_LEGACY = "atelier-cuisine-projects-v1";
const LS_ACTIVE_LEGACY = "atelier-cuisine-active-v1";

function makeBlankProject(name) {
  const roomId = uid();
  return {
    id: uid(), name, savedAt: new Date().toISOString(),
    rooms: [{ id: roomId, name: "Cuisine", vertices: DEFAULT_VERTICES, height: 240, floor: { ...DEFAULT_FLOOR } }],
    items: [],
  };
}

// --- migration de l'ancien format (v1 : une seule pièce, meubles rattachés
// aux murs) vers le nouveau (v2 : plusieurs pièces, tout en coordonnées libres) ---
function legacyWallGeom(A, B, orient) {
  const dx = B.x - A.x, dy = B.y - A.y;
  const length = Math.hypot(dx, dy) || 1;
  const dir = { x: dx / length, y: dy / length };
  const normal = orient > 0 ? { x: -dir.y, y: dir.x } : { x: dir.y, y: -dir.x };
  return { A, B, dir, normal };
}
function legacyOrientation(vertices) {
  let s = 0;
  for (let i = 0; i < vertices.length; i++) {
    const a = vertices[i], b = vertices[(i + 1) % vertices.length];
    s += a.x * b.y - b.x * a.y;
  }
  return s >= 0 ? 1 : -1;
}
function migrateLegacyProject(p) {
  const vertices = Array.isArray(p.vertices) && p.vertices.length >= 3 ? p.vertices : DEFAULT_VERTICES;
  const roomId = uid();
  const room = { id: roomId, name: "Cuisine", vertices, height: typeof p.roomHeight === "number" ? p.roomHeight : 240, floor: { ...DEFAULT_FLOOR } };
  const items = [];
  const orient = legacyOrientation(vertices);
  const walls = vertices.map((A, i) => legacyWallGeom(A, vertices[(i + 1) % vertices.length], orient));
  (Array.isArray(p.placements) ? p.placements : []).forEach((pl) => {
    const wall = walls[Math.min(pl.wallIndex || 0, walls.length - 1)];
    const entry = catalogById[pl.catalogId];
    if (!wall || !entry) return;
    const depth = pl.depth ?? entry.defaultDepth;
    const width = pl.width ?? entry.defaultWidth;
    const flip = p.wallFlips && p.wallFlips[pl.wallIndex] ? -1 : 1;
    const centerAlong = (pl.offset || 0) + width / 2;
    const baseX = wall.A.x + wall.dir.x * centerAlong;
    const baseY = wall.A.y + wall.dir.y * centerAlong;
    const pushDist = depth / 2 + (pl.standoff || 0);
    const x = baseX + wall.normal.x * flip * pushDist;
    const y = baseY + wall.normal.y * flip * pushDist;
    const angleDeg = (Math.atan2(wall.dir.y, wall.dir.x) * 180) / Math.PI;
    items.push({ uid: pl.uid || uid(), catalogId: pl.catalogId, roomId, x, y, width, depth, angleDeg, radii: [0, 0, 0, 0] });
  });
  (Array.isArray(p.freeItems) ? p.freeItems : Array.isArray(p.worktops) ? p.worktops : []).forEach((fi) => {
    const catalogId = fi.typeId || "worktop"; // "worktop" existait déjà comme id de catalogue
    if (!catalogById[catalogId]) return;
    items.push({ uid: fi.uid || uid(), catalogId, roomId, x: fi.x || 0, y: fi.y || 0, width: fi.width, depth: fi.depth, angleDeg: fi.angleDeg || 0, radii: fi.radii || [0, 0, 0, 0] });
  });
  return { id: p.id || uid(), name: p.name || "Cuisine", savedAt: p.savedAt || new Date().toISOString(), rooms: [room], items };
}
// Garantit une forme de projet toujours valide, migrant l'ancien format au passage.
function normalizeProject(p) {
  if (!p || typeof p !== "object") return makeBlankProject("Cuisine");
  if (Array.isArray(p.rooms) && Array.isArray(p.items)) {
    const rooms = p.rooms.map((r) => ({
      id: r.id || uid(),
      name: r.name || "Pièce",
      vertices: Array.isArray(r.vertices) && r.vertices.length >= 3 ? r.vertices : DEFAULT_VERTICES,
      height: typeof r.height === "number" ? r.height : 240,
      floor: r.floor && typeof r.floor === "object" ? { ...DEFAULT_FLOOR, ...r.floor } : { ...DEFAULT_FLOOR },
      wallColor: typeof r.wallColor === "string" ? r.wallColor : DEFAULT_WALL,
    }));
    const finalRooms = rooms.length ? rooms : [{ id: uid(), name: "Cuisine", vertices: DEFAULT_VERTICES, height: 240, floor: { ...DEFAULT_FLOOR } }];
    const roomIds = new Set(finalRooms.map((r) => r.id));
    const fallbackRoomId = finalRooms[0].id;
    const items = p.items
      .filter((it) => catalogById[it.catalogId])
      .map((it) => ({
        uid: it.uid || uid(),
        catalogId: it.catalogId,
        roomId: roomIds.has(it.roomId) ? it.roomId : fallbackRoomId,
        x: typeof it.x === "number" ? it.x : 0,
        y: typeof it.y === "number" ? it.y : 0,
        width: typeof it.width === "number" ? it.width : catalogById[it.catalogId].defaultWidth,
        depth: typeof it.depth === "number" ? it.depth : catalogById[it.catalogId].defaultDepth,
        angleDeg: typeof it.angleDeg === "number" ? it.angleDeg : 0,
        radii: Array.isArray(it.radii) ? it.radii : [0, 0, 0, 0],
        ...(typeof it.topHeight === "number" ? { topHeight: it.topHeight } : {}),
      }));
    return { id: p.id || uid(), name: p.name || "Projet", savedAt: p.savedAt || new Date().toISOString(), rooms: finalRooms, items };
  }
  return migrateLegacyProject(p);
}
function loadStore() {
  try {
    const raw = localStorage.getItem(LS_PROJECTS);
    if (raw) {
      const projects = JSON.parse(raw);
      const activeId = localStorage.getItem(LS_ACTIVE);
      return { projects, activeId };
    }
    // Rien sous la clé v2 : on récupère une éventuelle sauvegarde v1 (ancien
    // format, une seule pièce) et on la migre une fois pour toutes.
    const legacyRaw = localStorage.getItem(LS_PROJECTS_LEGACY);
    if (legacyRaw) {
      const legacyProjects = JSON.parse(legacyRaw);
      const projects = {};
      Object.keys(legacyProjects || {}).forEach((id) => {
        const migrated = normalizeProject(legacyProjects[id]);
        projects[migrated.id] = migrated;
      });
      const legacyActiveId = localStorage.getItem(LS_ACTIVE_LEGACY);
      const activeId = projects[legacyActiveId] ? legacyActiveId : Object.keys(projects)[0] || null;
      persistProjects(projects);
      if (activeId) persistActive(activeId);
      return { projects, activeId };
    }
    return { projects: {}, activeId: null };
  } catch {
    return { projects: {}, activeId: null };
  }
}
function persistProjects(projects) {
  try { localStorage.setItem(LS_PROJECTS, JSON.stringify(projects)); } catch { /* stockage indisponible, tant pis */ }
}
function persistActive(id) {
  try { localStorage.setItem(LS_ACTIVE, id); } catch { /* stockage indisponible, tant pis */ }
}

// ---------------------------------------------------------------------------
// Composant principal
// ---------------------------------------------------------------------------
// Champ numérique pour une dimension libre (décimales acceptées, au dixième de cm). Garde le texte tapé
// tant que le champ a le focus, pour pouvoir l'effacer et le retaper sans que la valeur saute.
function DimInput({ value, onCommit }) {
  const [text, setText] = useState("");
  const [focused, setFocused] = useState(false);
  return (
    <input
      type="number" inputMode="decimal" step="any" min="1"
      value={focused ? text : value}
      onFocus={(ev) => { setText(String(value)); setFocused(true); ev.target.select(); }}
      onBlur={() => setFocused(false)}
      onClick={(ev) => ev.stopPropagation()}
      onChange={(ev) => {
        setText(ev.target.value);
        const n = parseFloat(ev.target.value);
        if (Number.isFinite(n) && n >= 1) onCommit(Math.round(n * 10) / 10);
      }}
    />
  );
}

export default function KitchenDesigner() {
  const [initData] = useState(() => {
    const { projects, activeId } = loadStore();
    const rawList = projects && typeof projects === "object" ? projects : {};
    let list = Object.fromEntries(Object.entries(rawList).map(([id, p]) => [id, { ...normalizeProject(p), id }]));
    let active = activeId && list[activeId] ? list[activeId] : null;
    if (!active) {
      const ids = Object.keys(list);
      if (ids.length > 0) {
        active = list[ids[0]];
      } else {
        active = makeBlankProject("Appartement");
        list = { ...list, [active.id]: active };
      }
    }
    persistProjects(list);
    persistActive(active.id);
    return { projects: list, project: active };
  });

  const [projects, setProjects] = useState(initData.projects);
  const [activeProjectId, setActiveProjectId] = useState(initData.project.id);
  const [rooms, setRooms] = useState(initData.project.rooms);
  const [items, setItems] = useState(initData.project.items);
  const [activeRoomId, setActiveRoomId] = useState(initData.project.rooms[0].id);
  const [selectedUid, setSelectedUid] = useState(null);
  const [selectedWallIndex, setSelectedWallIndex] = useState(null);
  const [wallEditIndex, setWallEditIndex] = useState(null);
  const [wallEditPos, setWallEditPos] = useState(null);
  const [mode, setMode] = useState("plan"); // "plan" (murs, ouvertures) | "meubles"
  const [catalogQuery, setCatalogQuery] = useState("");
  const [show3D, setShow3D] = useState(false);
  const [importError, setImportError] = useState("");

  const containerRef = useRef(null);
  const svgRef = useRef(null);
  const wrapRef = useRef(null);
  const three = useRef(null);
  const dragRef = useRef(null);
  const itemDragRef = useRef(null);
  const wallDragRef = useRef(null);
  const wallEditCancelRef = useRef(false);
  const fileInputRef = useRef(null);
  const saveTimeoutRef = useRef(null);

  const activeRoom = useMemo(() => rooms.find((r) => r.id === activeRoomId) || rooms[0], [rooms, activeRoomId]);
  const roomArea = useMemo(() => (activeRoom ? shoelaceAreaM2(activeRoom.vertices) : 0), [activeRoom]);
  const edges = useMemo(() => (activeRoom ? roomEdges(activeRoom.vertices) : []), [activeRoom]);

  const roomItems = useMemo(() => items.filter((it) => it.roomId === activeRoomId), [items, activeRoomId]);
  const roomItemsComputed = useMemo(() => roomItems.map(computeItemGeometry).filter(Boolean), [roomItems]);
  const visibleItems = useMemo(() => roomItemsComputed.filter((it) => isPlanEntry(it.catalogEntry) === (mode === "plan")), [roomItemsComputed, mode]);

  const bounds = useMemo(() => {
    if (!activeRoom) return { minX: 0, minY: 0, w: 400, h: 400 };
    const xs = activeRoom.vertices.map((v) => v.x), ys = activeRoom.vertices.map((v) => v.y);
    const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
    const p = 45;
    return { minX: minX - p, minY: minY - p, w: maxX - minX + 2 * p, h: maxY - minY + 2 * p };
  }, [activeRoom]);
  const centroid = useMemo(() => {
    if (!activeRoom) return { x: 0, y: 0 };
    return {
      x: activeRoom.vertices.reduce((s, v) => s + v.x, 0) / activeRoom.vertices.length,
      y: activeRoom.vertices.reduce((s, v) => s + v.y, 0) / activeRoom.vertices.length,
    };
  }, [activeRoom]);
  const polyPoints = activeRoom ? activeRoom.vertices.map((v) => `${v.x},${v.y}`).join(" ") : "";

  // --- vue 3D : montée/démontée uniquement quand affichée ---
  useEffect(() => {
    if (!show3D) return;
    const container = containerRef.current;
    if (!container) return;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xeef1f4);
    const camera = new THREE.PerspectiveCamera(45, (container.clientWidth || 4) / (container.clientHeight || 3), 0.05, 100);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(renderer.domElement);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    scene.add(new THREE.HemisphereLight(0xffffff, 0xb9b3a8, 1.5));
    const dir = new THREE.DirectionalLight(0xffffff, 1.0);
    dir.position.set(3, 5, 2);
    dir.castShadow = true;
    dir.shadow.mapSize.set(2048, 2048);
    dir.shadow.bias = -0.0004; dir.shadow.normalBias = 0.02;
    scene.add(dir); scene.add(dir.target);

    const group = new THREE.Group();
    const roomGroup = new THREE.Group();
    const wallGroup = new THREE.Group();
    scene.add(group); scene.add(roomGroup); scene.add(wallGroup);

    const spherical = { radius: 6, theta: Math.PI / 4, phi: Math.PI / 3 };
    const target = new THREE.Vector3(2, 0.8, 1);
    const drag = { active: false, x: 0, y: 0 };
    const pointers = new Map();
    let pinchDist = null;

    function updateCamera() {
      camera.position.set(
        target.x + spherical.radius * Math.sin(spherical.phi) * Math.sin(spherical.theta),
        target.y + spherical.radius * Math.cos(spherical.phi),
        target.z + spherical.radius * Math.sin(spherical.phi) * Math.cos(spherical.theta)
      );
      camera.lookAt(target);
      renderer.render(scene, camera);
    }
    function onDown(e) {
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 1) { drag.active = true; drag.x = e.clientX; drag.y = e.clientY; }
      else if (pointers.size === 2) {
        drag.active = false;
        const [p1, p2] = [...pointers.values()];
        pinchDist = Math.hypot(p1.x - p2.x, p1.y - p2.y);
      }
    }
    function onMove(e) {
      if (pointers.has(e.pointerId)) pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 2) {
        const [p1, p2] = [...pointers.values()];
        const dist = Math.hypot(p1.x - p2.x, p1.y - p2.y);
        if (pinchDist != null && dist > 0) spherical.radius = Math.min(25, Math.max(1.5, spherical.radius * (pinchDist / dist)));
        pinchDist = dist;
        updateCamera();
        return;
      }
      if (!drag.active) return;
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      drag.x = e.clientX; drag.y = e.clientY;
      spherical.theta -= dx * 0.006;
      spherical.phi = Math.min(Math.PI - 0.1, Math.max(0.15, spherical.phi - dy * 0.006));
      updateCamera();
    }
    function onUp(e) {
      pointers.delete(e.pointerId);
      pinchDist = null;
      if (pointers.size === 1) {
        const [remaining] = [...pointers.values()];
        drag.active = true; drag.x = remaining.x; drag.y = remaining.y;
      } else drag.active = false;
    }
    function onWheel(e) { e.preventDefault(); spherical.radius = Math.min(25, Math.max(1.5, spherical.radius * (1 + e.deltaY * 0.001))); updateCamera(); }
    function applySize(w, h) {
      if (!w || !h) return;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      updateCamera();
    }
    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      applySize(entry.contentRect.width, entry.contentRect.height);
    });
    resizeObserver.observe(container);

    renderer.domElement.style.touchAction = "none";
    renderer.domElement.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    renderer.domElement.addEventListener("wheel", onWheel, { passive: false });

    three.current = { scene, camera, renderer, group, roomGroup, wallGroup, dir, target, spherical, updateCamera };
    applySize(container.clientWidth, container.clientHeight);
    updateCamera();

    return () => {
      renderer.domElement.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      resizeObserver.disconnect();
      renderer.dispose();
      if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement);
      three.current = null;
    };
  }, [show3D]);

  // --- reconstruire la pièce (sol + murs) affichée en 3D ---
  useEffect(() => {
    const t = three.current;
    if (!t || !activeRoom) return;
    t.roomGroup.traverse((c) => { c.geometry?.dispose(); c.material?.map?.dispose(); c.material?.dispose(); });
    t.roomGroup.clear();
    const hM = activeRoom.height / 100;
    const shapePts = activeRoom.vertices.map((v) => new THREE.Vector2(v.x / 100, -(v.y / 100)));
    const shape = new THREE.Shape(shapePts);
    const floorGeo = new THREE.ShapeGeometry(shape);
    floorGeo.rotateX(-Math.PI / 2);
    const floorCfg = activeRoom.floor || DEFAULT_FLOOR;
    const floorTexture = buildFloorTexture(floorCfg);
    const floorMat = floorTexture
      ? new THREE.MeshStandardMaterial({ map: floorTexture, roughness: 1, side: THREE.DoubleSide })
      : new THREE.MeshStandardMaterial({ color: floorCfg.color || DEFAULT_FLOOR.color, roughness: 1, side: THREE.DoubleSide });
    const floorMesh = new THREE.Mesh(floorGeo, floorMat);
    floorMesh.receiveShadow = true;
    t.roomGroup.add(floorMesh);

    const xs = activeRoom.vertices.map((v) => v.x), ys = activeRoom.vertices.map((v) => v.y);
    const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
    t.target.set((minX + maxX) / 2 / 100, hM / 3, (minY + maxY) / 2 / 100);
    t.spherical.radius = Math.max(maxX - minX, maxY - minY, 100) / 100 * 1.6 + 1;
    // lumière et ombres cadrées sur la pièce
    const cx = (minX + maxX) / 200, cz = (minY + maxY) / 200, span = Math.hypot(maxX - minX, maxY - minY) / 100;
    t.dir.position.set(cx + span * 0.5, hM + span * 0.9, cz + span * 0.35);
    t.dir.target.position.set(cx, 0, cz);
    const sc = t.dir.shadow.camera;
    sc.left = -span * 0.7; sc.right = span * 0.7; sc.top = span * 0.7; sc.bottom = -span * 0.7;
    sc.near = 0.1; sc.far = span * 4 + hM * 2;
    sc.updateProjectionMatrix();
    t.updateCamera();
  }, [activeRoom, show3D]);

  // --- murs 3D : pleins, colorés, vus de l'intérieur, percés aux portes et fenêtres ---
  useEffect(() => {
    const t = three.current;
    if (!t || !activeRoom) return;
    t.wallGroup.traverse((c) => { c.geometry?.dispose(); c.material?.dispose(); });
    t.wallGroup.clear();
    const openings = roomItemsComputed.filter((it) => isWallOpening(it.catalogEntry));
    buildWallMeshes(activeRoom, openings, activeRoom.wallColor || DEFAULT_WALL).forEach((m) => t.wallGroup.add(m));
    t.updateCamera();
  }, [activeRoom, roomItemsComputed, show3D]);

  // --- la sélection/édition de mur ne concerne que la pièce affichée ---
  useEffect(() => { setSelectedWallIndex(null); setWallEditIndex(null); }, [activeRoomId]);

  // --- position écran du champ d'édition de longueur (recalculée hors rendu,
  // une fois le DOM à jour, pour ne pas lire les refs pendant le rendu) ---
  useEffect(() => {
    if (wallEditIndex == null) { setWallEditPos(null); return; }
    const w = edges[wallEditIndex];
    const wrapEl = wrapRef.current;
    if (!w || !wrapEl) { setWallEditPos(null); return; }
    const midX = (w.A.x + w.B.x) / 2, midY = (w.A.y + w.B.y) / 2;
    const screenPt = svgPointToScreen({ x: midX + w.normal.x * 14, y: midY + w.normal.y * 14 });
    const wrapRect = wrapEl.getBoundingClientRect();
    setWallEditPos(screenPt ? { left: screenPt.x - wrapRect.left, top: screenPt.y - wrapRect.top } : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wallEditIndex, edges]);

  // --- reconstruire les objets 3D de la pièce active ---
  useEffect(() => {
    const t = three.current;
    if (!t) return;
    t.group.traverse((c) => { c.geometry?.dispose(); c.material?.dispose(); });
    t.group.clear();
    const edgeMat = new THREE.LineBasicMaterial({ color: 0x2f3844 });
    roomItemsComputed.forEach((item) => {
      const holder = new THREE.Group();
      holder.rotation.y = item.angleRad;
      holder.position.set(item.centerX / 100, item.catalogEntry.yOffset / 100, item.centerY / 100);
      itemBoxes(item, roomItemsComputed).forEach((b) => {
        const glass = b.alpha != null;
        const mesh = new THREE.Mesh(
          new THREE.BoxGeometry(b.w / 100, b.h / 100, b.d / 100),
          new THREE.MeshStandardMaterial({ color: b.color, roughness: glass ? 0.2 : 0.8, metalness: 0.05, transparent: glass, opacity: glass ? b.alpha : 1, depthWrite: !glass }),
        );
        mesh.position.set(b.x / 100, (b.y + b.h / 2) / 100, b.z / 100);
        mesh.castShadow = !glass; mesh.receiveShadow = true;
        if (Math.min(b.w, b.h, b.d) >= 0.5) mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry), edgeMat));
        holder.add(mesh);
      });
      t.group.add(holder);
    });
    t.updateCamera();
  }, [roomItemsComputed, show3D]);

  // --- édition du polygone de la pièce active ---
  function clientToSvgPoint(e) {
    const svg = svgRef.current;
    if (!svg) return null;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return null;
    const p = pt.matrixTransform(ctm.inverse());
    return { x: p.x, y: p.y };
  }
  // --- inverse de clientToSvgPoint : point du repère pièce (cm) -> pixels écran,
  // utilisé pour positionner le champ d'édition de longueur au-dessus du SVG ---
  function svgPointToScreen(pt) {
    const svg = svgRef.current;
    if (!svg || !pt) return null;
    const spt = svg.createSVGPoint();
    spt.x = pt.x; spt.y = pt.y;
    const ctm = svg.getScreenCTM();
    if (!ctm) return null;
    return spt.matrixTransform(ctm);
  }
  function onVertexDown(i, e) {
    e.stopPropagation(); e.preventDefault();
    dragRef.current = i;
    window.addEventListener("pointermove", onVertexMove);
    window.addEventListener("pointerup", onVertexUp);
  }
  function onVertexMove(e) {
    if (dragRef.current == null) return;
    const p = clientToSvgPoint(e);
    if (!p) return;
    const snapped = { x: Math.round(p.x / 5) * 5, y: Math.round(p.y / 5) * 5 };
    setRooms((rs) => rs.map((r) => (r.id !== activeRoomId ? r : { ...r, vertices: r.vertices.map((v, idx) => (idx === dragRef.current ? snapped : v)) })));
  }
  function onVertexUp() {
    dragRef.current = null;
    window.removeEventListener("pointermove", onVertexMove);
    window.removeEventListener("pointerup", onVertexUp);
  }
  function addVertex() {
    setRooms((rs) => rs.map((r) => (r.id !== activeRoomId ? r : { ...r, vertices: [...r.vertices, { x: r.vertices[r.vertices.length - 1].x + 40, y: r.vertices[r.vertices.length - 1].y }] })));
  }
  function removeVertex(i) {
    setRooms((rs) => rs.map((r) => (r.id !== activeRoomId || r.vertices.length <= 3 ? r : { ...r, vertices: r.vertices.filter((_, idx) => idx !== i) })));
  }
  function updateVertex(i, axis, val) {
    setRooms((rs) => rs.map((r) => (r.id !== activeRoomId ? r : { ...r, vertices: r.vertices.map((v, idx) => (idx === i ? { ...v, [axis]: val } : v)) })));
  }
  function updateRoomHeight(val) {
    setRooms((rs) => rs.map((r) => (r.id === activeRoomId ? { ...r, height: val } : r)));
  }
  function updateRoomWallColor(color) {
    setRooms((rs) => rs.map((r) => (r.id === activeRoomId ? { ...r, wallColor: color } : r)));
  }
  function updateRoomFloor(patch) {
    setRooms((rs) => rs.map((r) => (r.id === activeRoomId ? { ...r, floor: { ...(r.floor || DEFAULT_FLOOR), ...patch } } : r)));
  }

  // --- murs (segments du polygone) : clic = édition directe de la longueur,
  // glisser = déplace le mur entier perpendiculairement (pousse/tire la pièce) ---
  function onWallDown(i, e) {
    e.stopPropagation(); e.preventDefault();
    if (!activeRoom) return;
    const p = clientToSvgPoint(e);
    if (!p) return;
    wallDragRef.current = { index: i, pointerStart: p, startVerts: activeRoom.vertices.map((v) => ({ ...v })), moved: false };
    setSelectedWallIndex(i);
    setWallEditIndex(null);
    window.addEventListener("pointermove", onWallMove);
    window.addEventListener("pointerup", onWallUp);
  }
  function onWallMove(e) {
    const d = wallDragRef.current;
    if (!d) return;
    const p = clientToSvgPoint(e);
    if (!p) return;
    const dx = p.x - d.pointerStart.x, dy = p.y - d.pointerStart.y;
    if (!d.moved && Math.hypot(dx, dy) < 3) return; // tolérance avant de considérer que c'est un glisser
    d.moved = true;
    const wall = roomEdges(d.startVerts)[d.index];
    const dist = dx * wall.normal.x + dy * wall.normal.y;
    const snapped = Math.round(dist / 5) * 5;
    const iA = d.index, iB = (d.index + 1) % d.startVerts.length;
    const move = (v, idx) => (idx === iA || idx === iB ? { x: v.x + wall.normal.x * snapped, y: v.y + wall.normal.y * snapped } : v);
    setRooms((rs) => rs.map((r) => (r.id !== activeRoomId ? r : { ...r, vertices: d.startVerts.map(move) })));
  }
  function onWallUp() {
    const d = wallDragRef.current;
    wallDragRef.current = null;
    window.removeEventListener("pointermove", onWallMove);
    window.removeEventListener("pointerup", onWallUp);
    if (d && !d.moved) setWallEditIndex(d.index); // simple clic (pas de glisser) -> édition de la longueur
  }
  function updateWallLength(i, newLenCm) {
    setRooms((rs) => rs.map((r) => {
      if (r.id !== activeRoomId) return r;
      const verts = r.vertices;
      const iA = i, iB = (i + 1) % verts.length;
      const A = verts[iA], B = verts[iB];
      const len = Math.hypot(B.x - A.x, B.y - A.y) || 1;
      const ux = (B.x - A.x) / len, uy = (B.y - A.y) / len;
      const newB = { x: A.x + ux * newLenCm, y: A.y + uy * newLenCm };
      return { ...r, vertices: verts.map((v, idx) => (idx === iB ? newB : v)) };
    }));
  }
  function commitWallEdit(i, rawValue) {
    const n = Math.round(Number(rawValue));
    if (Number.isFinite(n) && n > 0) updateWallLength(i, n);
    setWallEditIndex(null);
  }

  // --- gestion des pièces ---
  function addRoom() {
    const name = window.prompt("Nom de la nouvelle pièce", `Pièce ${rooms.length + 1}`) || `Pièce ${rooms.length + 1}`;
    const r = { id: uid(), name, vertices: DEFAULT_VERTICES, height: 240, floor: { ...DEFAULT_FLOOR } };
    setRooms((rs) => [...rs, r]);
    setActiveRoomId(r.id);
  }
  function renameRoom() {
    if (!activeRoom) return;
    const name = window.prompt("Renommer la pièce", activeRoom.name);
    if (!name) return;
    setRooms((rs) => rs.map((r) => (r.id === activeRoomId ? { ...r, name } : r)));
  }
  function deleteRoom() {
    if (rooms.length <= 1) return;
    if (!window.confirm(`Supprimer "${activeRoom.name}" et tous ses objets ? Cette action est irréversible.`)) return;
    const remaining = rooms.filter((r) => r.id !== activeRoomId);
    setRooms(remaining);
    setItems((its) => its.filter((it) => it.roomId !== activeRoomId));
    setActiveRoomId(remaining[0].id);
  }

  // --- gestion des objets (tout est libre : x, y, angle) ---
  function addItem(catalogId) {
    const entry = catalogById[catalogId];
    if (!entry || !activeRoom) return;
    const id = uid();
    setItems((its) => [...its, { uid: id, catalogId, roomId: activeRoomId, x: centroid.x, y: centroid.y, width: entry.defaultWidth, depth: entry.defaultDepth, angleDeg: 0, radii: [0, 0, 0, 0] }]);
    setSelectedUid(id);
  }
  function updateItem(id, patch) { setItems((its) => its.map((it) => (it.uid === id ? { ...it, ...patch } : it))); }
  function updateItemWidth(id, w) {
    setItems((its) => its.map((it) => {
      if (it.uid !== id) return it;
      return { ...it, width: Math.max(1, w) }; // dimension libre (pas de plage ni de pas imposés)
    }));
  }
  function updateItemDepth(id, d) {
    setItems((its) => its.map((it) => {
      if (it.uid !== id) return it;
      return { ...it, depth: Math.max(1, d) };
    }));
  }
  function updateItemRadius(id, idx, val) {
    setItems((its) => its.map((it) => {
      if (it.uid !== id) return it;
      const radii = [...(it.radii || [0, 0, 0, 0])];
      radii[idx] = Math.max(0, Number(val) || 0);
      return { ...it, radii };
    }));
  }
  function duplicateItem(id) {
    setItems((its) => {
      const src = its.find((it) => it.uid === id);
      if (!src) return its;
      return [...its, { ...src, uid: uid(), x: src.x + 30, y: src.y + 30 }];
    });
  }
  function removeItem(id) { setItems((its) => its.filter((it) => it.uid !== id)); if (selectedUid === id) setSelectedUid(null); }
  function reassignRoom(id, newRoomId) { setItems((its) => its.map((it) => (it.uid === id ? { ...it, roomId: newRoomId } : it))); }

  // --- glisser un objet librement (x et y) ---
  function onItemDown(item, e) {
    e.stopPropagation(); e.preventDefault();
    setSelectedUid(item.uid);
    const p = clientToSvgPoint(e);
    itemDragRef.current = { uid: item.uid, startX: item.x, startY: item.y, pointerStart: p };
    window.addEventListener("pointermove", onItemMove);
    window.addEventListener("pointerup", onItemUp);
  }
  function onItemMove(e) {
    const d = itemDragRef.current;
    if (!d) return;
    const p = clientToSvgPoint(e);
    if (!p) return;
    const dx = p.x - d.pointerStart.x, dy = p.y - d.pointerStart.y;
    updateItem(d.uid, { x: Math.round((d.startX + dx) / 5) * 5, y: Math.round((d.startY + dy) / 5) * 5 });
  }
  function onItemUp() {
    itemDragRef.current = null;
    window.removeEventListener("pointermove", onItemMove);
    window.removeEventListener("pointerup", onItemUp);
  }

  function resetAll() {
    const blank = makeBlankProject(projects[activeProjectId]?.name || "Appartement");
    setRooms(blank.rooms); setItems(blank.items);
    setActiveRoomId(blank.rooms[0].id); setSelectedUid(null);
  }

  // --- sauvegarde automatique locale (anti-rebond) du projet actif ---
  useEffect(() => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      setProjects((prev) => {
        const existing = prev[activeProjectId];
        if (!existing) return prev;
        const updated = { ...prev, [activeProjectId]: { ...existing, rooms, items, savedAt: new Date().toISOString() } };
        persistProjects(updated);
        return updated;
      });
    }, 500);
    return () => clearTimeout(saveTimeoutRef.current);
  }, [rooms, items, activeProjectId]);

  // --- gestion multi-projets ---
  function loadProjectState(raw) {
    const p = normalizeProject(raw);
    setRooms(p.rooms); setItems(p.items);
    setActiveRoomId(p.rooms[0].id); setSelectedUid(null);
  }
  function switchProject(id) {
    const p = projects[id];
    if (!p || id === activeProjectId) return;
    setActiveProjectId(id);
    loadProjectState(p);
    persistActive(id);
  }
  function createNewProject() {
    const suggested = `Appartement ${Object.keys(projects).length + 1}`;
    const name = window.prompt("Nom du nouveau projet", suggested) || suggested;
    const p = makeBlankProject(name);
    const updated = { ...projects, [p.id]: p };
    setProjects(updated);
    persistProjects(updated);
    setActiveProjectId(p.id);
    loadProjectState(p);
    persistActive(p.id);
  }
  function renameActiveProject() {
    const current = projects[activeProjectId];
    const name = window.prompt("Renommer le projet", current?.name || "");
    if (!name) return;
    setProjects((prev) => {
      const updated = { ...prev, [activeProjectId]: { ...prev[activeProjectId], name } };
      persistProjects(updated);
      return updated;
    });
  }
  function deleteActiveProject() {
    const ids = Object.keys(projects);
    if (ids.length <= 1) return;
    if (!window.confirm(`Supprimer "${projects[activeProjectId]?.name}" ? Cette action est irréversible.`)) return;
    const updated = { ...projects };
    delete updated[activeProjectId];
    setProjects(updated);
    persistProjects(updated);
    const nextId = Object.keys(updated)[0];
    setActiveProjectId(nextId);
    loadProjectState(updated[nextId]);
    persistActive(nextId);
  }

  // --- export / import du projet complet ---
  function handleExportProject() {
    exportProjectJSON({ name: projects[activeProjectId]?.name, rooms, items });
  }
  function triggerImport() { setImportError(""); fileInputRef.current?.click(); }
  function handleImportFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        const normalized = normalizeProject(data);
        if (!normalized.rooms.length) throw new Error("bad-project");
        const suggested = data.name || file.name.replace(/\.json$/i, "") || "Projet importé";
        const name = window.prompt("Nom du projet importé", suggested) || suggested;
        const p = { ...normalized, id: uid(), name, savedAt: new Date().toISOString() };
        const updated = { ...projects, [p.id]: p };
        setProjects(updated);
        persistProjects(updated);
        setActiveProjectId(p.id);
        loadProjectState(p);
        persistActive(p.id);
        setImportError("");
      } catch (err) {
        setImportError("Fichier illisible : ce n'est pas un projet Atelier Cuisine valide.");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  // --- étapes : "plan" = murs, portes, fenêtres, réseaux ; "meubles" = tout le reste ---
  function switchMode(m) {
    setMode(m);
    if (m === "3d") setShow3D(true);
    setSelectedUid(null); setSelectedWallIndex(null); setWallEditIndex(null);
  }
  // Image de la vue 3D telle qu'affichée (caméra courante) : rendu puis lecture immédiate du canvas.
  function exportView3DPNG() {
    const t = three.current;
    if (!t) return;
    t.renderer.render(t.scene, t.camera);
    t.renderer.domElement.toBlob((blob) => {
      if (!blob) return;
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `vue3d_${timestamp()}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    }, "image/png");
  }
  function closeMenu(e) {
    const d = e.currentTarget.closest("details");
    if (d) d.open = false;
  }
  useEffect(() => {
    if (selectedUid) document.getElementById(`row-${selectedUid}`)?.scrollIntoView({ block: "nearest" });
  }, [selectedUid]);
  const catalogQ = catalogQuery.trim().toLowerCase();
  const renderCatalogRow = (c) => (
    <div className="catalog-item compact" key={c.id} title={c.note} onClick={() => addItem(c.id)}>
      <div className="swatch" style={{ background: c.color }} />
      <div className="meta">
        <div className="name">{c.name}</div>
        <div className="dims">{c.defaultWidth}×{c.defaultDepth} cm par défaut</div>
      </div>
      <span className="add">+</span>
    </div>
  );

  const selectedEntry = selectedUid ? catalogById[items.find((it) => it.uid === selectedUid)?.catalogId] : null;

  return (
    <div className="app">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600&display=swap');
        * { box-sizing: border-box; }
        .app { font-family: 'IBM Plex Sans', sans-serif; background:#eef1f4; color:#1d2733; display:flex; flex-direction:column; height:100%; min-height:760px; }
        .header { display:flex; align-items:center; justify-content:space-between; padding:14px 18px; border-bottom:1px solid #d7dde3; background:#ffffff; flex-wrap:wrap; gap:8px; }
        .header h1 { font-size:15px; letter-spacing:.04em; text-transform:uppercase; font-weight:600; margin:0; color:#1d2733; }
        .header .sub { font-family:'IBM Plex Mono',monospace; font-size:11px; color:#1f6f93; margin-top:2px; }
        .btn { font-family:'IBM Plex Mono',monospace; font-size:12px; background:#f3f5f7; color:#1d2733; border:1px solid #c7d0d9; padding:7px 10px; border-radius:3px; cursor:pointer; }
        .btn:hover { border-color:#1f6f93; color:#1f6f93; }
        .btn:disabled { opacity:.4; cursor:default; }
        .btn.primary { background:#e2711d; color:#fff; border-color:#e2711d; font-weight:600; }
        .btn.primary:hover { background:#c95f13; border-color:#c95f13; color:#fff; }
        .project-bar { display:flex; align-items:center; gap:8px; padding:8px 18px; background:#f7f9fa; border-bottom:1px solid #d7dde3; flex-wrap:wrap; }
        .project-bar label { font-family:'IBM Plex Mono',monospace; font-size:10px; text-transform:uppercase; letter-spacing:.05em; color:#6b7789; }
        .project-bar .select { width:auto; min-width:160px; }
        .autosave-hint { font-family:'IBM Plex Mono',monospace; font-size:10px; color:#8b96a3; margin-left:auto; }
        .body { display:flex; flex:1; min-height:0; }
        .sidebar, .sidebar-right { width:310px; background:#ffffff; display:flex; flex-direction:column; }
        .sidebar { border-right:1px solid #d7dde3; }
        .sidebar-right { border-left:1px solid #d7dde3; }
        .tabs { display:flex; border-bottom:1px solid #d7dde3; }
        .tab { flex:1; padding:10px 0; text-align:center; font-family:'IBM Plex Mono',monospace; font-size:10.5px; letter-spacing:.02em; text-transform:uppercase; background:none; border:none; color:#6b7789; cursor:pointer; border-bottom:2px solid transparent; }
        .tab.active { color:#1f6f93; border-bottom-color:#1f6f93; }
        .panel { padding:16px; overflow-y:auto; flex:1; min-height:0; }
        .field { margin-bottom:14px; }
        .field label { display:block; font-family:'IBM Plex Mono',monospace; font-size:10px; text-transform:uppercase; letter-spacing:.05em; color:#6b7789; margin-bottom:5px; }
        .field input[type=number], .select { width:100%; background:#ffffff; border:1px solid #c7d0d9; color:#1d2733; padding:7px 8px; border-radius:3px; font-family:'IBM Plex Mono',monospace; font-size:12px; }
        .select.small { padding:4px 6px; font-size:11px; width:auto; }
        input[type=range] { width:100%; accent-color:#e2711d; }
        .section-label { font-family:'IBM Plex Mono',monospace; font-size:10px; text-transform:uppercase; letter-spacing:.06em; color:#1f6f93; padding:8px 0; }
        .room-row { display:flex; align-items:center; gap:6px; margin-bottom:10px; }
        .vertex-row { display:flex; align-items:center; gap:6px; margin-bottom:6px; }
        .vertex-row .vlabel { width:26px; font-family:'IBM Plex Mono',monospace; font-size:10px; color:#6b7789; }
        .vertex-row input { width:100%; background:#ffffff; border:1px solid #c7d0d9; color:#1d2733; padding:5px 6px; border-radius:3px; font-family:'IBM Plex Mono',monospace; font-size:11px; }
        .catalog-item { border:1px solid #d7dde3; border-radius:4px; padding:10px; margin-bottom:8px; display:flex; align-items:center; gap:10px; }
        .swatch { width:14px; height:14px; border-radius:2px; flex-shrink:0; border:1px solid #b9c2cc; }
        .catalog-item .meta { flex:1; }
        .catalog-item .name { font-size:12px; font-weight:500; }
        .catalog-item .dims { font-family:'IBM Plex Mono',monospace; font-size:10px; color:#6b7789; margin-top:2px; }
        .layout-row { border:1px solid #d7dde3; border-radius:4px; padding:8px 10px; margin-bottom:6px; cursor:pointer; }
        .layout-row.selected { border-color:#e2711d; background:#fff1e2; }
        .layout-row .top { display:flex; justify-content:space-between; align-items:center; }
        .layout-row .name { font-size:12px; }
        .layout-row .w { font-family:'IBM Plex Mono',monospace; font-size:11px; color:#1f6f93; }
        .row-actions { display:flex; gap:4px; margin-top:8px; align-items:center; flex-wrap:wrap; }
        .row-actions button { font-size:11px; padding:3px 7px; }
        .warning { background:#fdeaea; border:1px solid #d64545; color:#8a2020; font-family:'IBM Plex Mono',monospace; font-size:11px; padding:6px 8px; border-radius:3px; margin-bottom:8px; }
        .main { flex:1; display:flex; flex-direction:column; min-width:0; background:#ffffff; }
        .editor2d-wrap { position:relative; flex:1; min-height:280px; border-bottom:1px solid #d7dde3; padding:6px; }
        .wall-edit-input { position:absolute; transform:translate(-50%,-50%); width:64px; font-family:'IBM Plex Mono',monospace; font-size:12px; text-align:center; padding:3px 4px; border:1.5px solid #e2711d; border-radius:3px; background:#fff; color:#1d2733; z-index:5; }
        .viewer3d-bar { display:flex; align-items:center; justify-content:space-between; padding:8px 12px; border-bottom:1px solid #d7dde3; }
        .viewer3d-wrap { height:320px; }
        .body.is3d .sidebar, .body.is3d .sidebar-right, .body.is3d .editor2d-wrap, .body.is3d .footer-hint { display:none; }
        .body.is3d .main { min-height:0; }
        .body.is3d .viewer3d-wrap { position:relative; flex:1; height:calc(100vh - 130px); min-height:60vh; }
        @media (max-width: 860px) { .body.is3d .viewer3d-wrap { height:calc(100vh - 230px); } }
        .body.is3d .viewer3d-wrap > div { position:absolute; inset:0; height:auto; }
        .viewer3d-wrap > div { width:100%; height:100%; cursor:grab; touch-action:none; }
        .dim-text { font-family:'IBM Plex Mono',monospace; fill:#1f6f93; }
        .footer-hint { font-family:'IBM Plex Mono',monospace; font-size:10px; color:#6b7789; padding:8px 12px; border-bottom:1px solid #d7dde3; }
        .empty { color:#8b96a3; font-size:12px; padding:20px 0; text-align:center; }
        .radii-grid { display:grid; grid-template-columns:1fr 1fr; gap:6px; }
        .radii-grid label { grid-column:1 / -1; }

        .header { gap:12px; padding:10px 18px; position:relative; }
        .header .select { width:auto; min-width:140px; max-width:220px; padding:6px 8px; }
        .header-right { display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
        .steps { display:flex; gap:4px; background:#eef1f4; padding:3px; border-radius:6px; }
        .step { font-family:'IBM Plex Mono',monospace; font-size:12px; border:none; background:none; padding:7px 16px; border-radius:4px; cursor:pointer; color:#6b7789; }
        .step b { display:inline-block; width:18px; height:18px; line-height:18px; border-radius:50%; background:#c7d0d9; color:#fff; font-size:11px; text-align:center; margin-right:6px; }
        .step.active { background:#ffffff; color:#1d2733; font-weight:600; box-shadow:0 1px 2px rgba(0,0,0,.14); }
        .step.active b { background:#e2711d; }
        .menu { position:relative; }
        .menu > summary { list-style:none; }
        .menu > summary::-webkit-details-marker { display:none; }
        .menu-list { position:absolute; right:0; top:calc(100% + 4px); background:#ffffff; border:1px solid #c7d0d9; border-radius:4px; box-shadow:0 6px 18px rgba(0,0,0,.14); z-index:20; min-width:210px; display:flex; flex-direction:column; padding:4px; }
        .menu-list button { text-align:left; border:none; background:none; padding:8px 10px; font-family:'IBM Plex Mono',monospace; font-size:12px; cursor:pointer; border-radius:3px; color:#1d2733; }
        .menu-list button:hover:not(:disabled) { background:#eef1f4; color:#1f6f93; }
        .menu-list button:disabled { opacity:.4; cursor:default; }
        .menu-list hr { border:none; border-top:1px solid #e3e7ec; margin:4px 0; width:100%; }
        .menu-note { font-family:'IBM Plex Mono',monospace; font-size:10px; color:#8b96a3; padding:6px 10px 4px; }
        .panel-title { padding:11px 16px; font-family:'IBM Plex Mono',monospace; font-size:10.5px; letter-spacing:.04em; text-transform:uppercase; color:#1f6f93; border-bottom:1px solid #d7dde3; }
        .sub-label { font-family:'IBM Plex Mono',monospace; font-size:10px; color:#8b96a3; margin:8px 0 4px; }
        .field-row { display:flex; gap:10px; }
        .field-row > .field { flex:1; margin-bottom:6px; }
        .stat { font-family:'IBM Plex Mono',monospace; font-size:13px; padding:7px 0; }
        .fold { border-top:1px solid #e3e7ec; margin-top:12px; }
        .fold > summary { cursor:pointer; padding:10px 0; font-family:'IBM Plex Mono',monospace; font-size:10px; text-transform:uppercase; letter-spacing:.06em; color:#1f6f93; display:flex; align-items:center; gap:6px; }
        .fold[open] > summary { padding-bottom:8px; }
        .fold .count { font-size:10px; color:#8b96a3; background:#eef1f4; border-radius:8px; padding:1px 7px; }
        .search { width:100%; box-sizing:border-box; background:#ffffff; border:1px solid #c7d0d9; padding:8px 10px; border-radius:3px; font-family:'IBM Plex Mono',monospace; font-size:12px; margin-bottom:4px; }
        .catalog-item.compact { padding:6px 8px; margin-bottom:4px; gap:8px; cursor:pointer; }
        .catalog-item.compact:hover { border-color:#1f6f93; background:#f5fafc; }
        .catalog-item .add { color:#1f6f93; font-family:'IBM Plex Mono',monospace; font-size:16px; line-height:1; padding:0 4px; }
        .next-btn { width:100%; margin-top:18px; padding:10px; }
        .layout-row .top { cursor:pointer; }
        @media (max-width: 860px) {
          .app { min-height: 100vh; height: auto; }
          .body { flex-direction: column; }
          .project-bar { padding: 8px 12px; }
          .autosave-hint { display: none; }
          .sidebar, .sidebar-right { width: 100%; max-height: 42vh; min-height: 0; overflow: hidden; border: none; border-bottom: 1px solid #d7dde3; }
          .header { padding: 10px 12px; }
          .header h1 { font-size: 13px; }
          .header .sub { font-size: 10px; }
          .header { gap: 8px; }
          .steps { order: 3; width: 100%; }
          .step { flex: 1; }
          .menu { position: static; }
          .menu-list { left: 12px; right: 12px; top: auto; margin-top: 4px; }
          .btn { font-size: 11px; padding: 6px 8px; }
          .editor2d-wrap { min-height: 260px; }
          .viewer3d-wrap { height: 260px; }
          .field input[type=number], .vertex-row input, .select { font-size: 16px; }
        }
        @media (max-width: 480px) {
          .tabs { overflow-x: auto; -webkit-overflow-scrolling: touch; }
          .tab { flex: 0 0 auto; padding: 10px 16px; }
        }
      `}</style>

      <div className="header">
        <h1>Atelier Appartement</h1>
        <div className="steps">
          <button className={`step ${mode === "plan" ? "active" : ""}`} onClick={() => switchMode("plan")}><b>1</b>Plan</button>
          <button className={`step ${mode === "meubles" ? "active" : ""}`} onClick={() => switchMode("meubles")}><b>2</b>Meubles</button>
          <button className={`step ${mode === "3d" ? "active" : ""}`} onClick={() => switchMode("3d")}><b>3</b>3D</button>
        </div>
        <div className="header-right">
          <input ref={fileInputRef} type="file" accept="application/json" style={{ display: "none" }} onChange={handleImportFile} />
          <select className="select" value={activeProjectId} onChange={(e) => switchProject(e.target.value)}>
            {Object.values(projects).sort((a, b) => a.name.localeCompare(b.name)).map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <details className="menu">
            <summary className="btn">Projet ▾</summary>
            <div className="menu-list" onClick={closeMenu}>
              <button onClick={createNewProject}>Nouveau projet</button>
              <button onClick={renameActiveProject}>Renommer</button>
              <button onClick={deleteActiveProject} disabled={Object.keys(projects).length <= 1}>Supprimer</button>
              <hr />
              <button onClick={triggerImport}>Importer (JSON)</button>
              <button onClick={handleExportProject}>Exporter (JSON)</button>
              <hr />
              <button onClick={() => { if (window.confirm("Réinitialiser le projet actif ? Les pièces et objets seront effacés.")) resetAll(); }}>Réinitialiser</button>
              <div className="menu-note">Enregistré automatiquement dans ce navigateur</div>
            </div>
          </details>
          <details className="menu">
            <summary className="btn primary">Exporter ▾</summary>
            <div className="menu-list" onClick={closeMenu}>
              <button onClick={() => exportFloorPlanSVG(rooms, items)}>Plan pro (SVG)</button>
              <button onClick={() => exportMaterialsCSV(rooms, items)} disabled={items.length === 0}>Liste de matériel (CSV)</button>
              <button onClick={() => exportGLTF(roomItemsComputed, "glb")} disabled={roomItemsComputed.length === 0}>Modèle 3D (GLB)</button>
              <button onClick={exportView3DPNG} disabled={!show3D}>Vue 3D en cours (PNG)</button>
              <button onClick={() => exportGLTF(roomItemsComputed)} disabled={roomItemsComputed.length === 0}>Modèle 3D (GLTF)</button>
            </div>
          </details>
        </div>
      </div>
      {importError && <div className="warning" style={{ margin: "8px 18px 0" }}>{importError}</div>}

      <div className={`body ${mode === "3d" ? "is3d" : ""}`}>
        <div className="sidebar">
          <div className="panel">
            <div className="section-label">Pièce</div>
            <div className="room-row">
              <select className="select" value={activeRoomId} onChange={(e) => setActiveRoomId(e.target.value)}>
                {rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>
            {mode === "plan" && activeRoom && (
              <>
                <div className="row-actions" style={{ marginTop: -4 }}>
                  <button className="btn" onClick={addRoom}>+ Nouvelle pièce</button>
                  <button className="btn" onClick={renameRoom}>Renommer</button>
                  <button className="btn" onClick={deleteRoom} disabled={rooms.length <= 1}>Supprimer</button>
                </div>
                <div className="field-row" style={{ marginTop: 12 }}>
                  <div className="field">
                    <label>Hauteur (cm)</label>
                    <input type="number" value={activeRoom.height} onChange={(e) => updateRoomHeight(Number(e.target.value) || 0)} />
                  </div>
                  <div className="field"><label>Surface</label><div className="stat">{roomArea} m²</div></div>
                </div>
                <div className="field-row">
                  <div className="field">
                    <label>Couleur des murs</label>
                    <input type="color" value={activeRoom.wallColor || DEFAULT_WALL} onChange={(e) => updateRoomWallColor(e.target.value)} style={{ width: "100%", height: 32, padding: 2, border: "1px solid #c7d0d9", borderRadius: 3 }} />
                  </div>
                  {(activeRoom.floor || DEFAULT_FLOOR).type === "none" && (
                    <div className="field">
                      <label>Couleur du sol</label>
                      <input type="color" value={(activeRoom.floor || DEFAULT_FLOOR).color} onChange={(e) => updateRoomFloor({ color: e.target.value })} style={{ width: "100%", height: 32, padding: 2, border: "1px solid #c7d0d9", borderRadius: 3 }} />
                    </div>
                  )}
                </div>

                <div className="section-label">Ajouter une ouverture</div>
                {PLAN_GROUPS.map((g) => (
                  <div key={g}>
                    <div className="sub-label">{g}</div>
                    {CATALOG.filter((c) => c.group === g).map(renderCatalogRow)}
                  </div>
                ))}

                <details className="fold">
                  <summary>Murs — coordonnées des sommets</summary>
              {activeRoom.vertices.map((v, i) => (
                <div className="vertex-row" key={i}>
                  <span className="vlabel">P{i + 1}</span>
                  <input type="number" value={v.x} onChange={(e) => updateVertex(i, "x", Number(e.target.value) || 0)} />
                  <input type="number" value={v.y} onChange={(e) => updateVertex(i, "y", Number(e.target.value) || 0)} />
                  <button className="btn" onClick={() => removeVertex(i)} disabled={activeRoom.vertices.length <= 3}>×</button>
                </div>
              ))}
              <button className="btn" style={{ width: "100%", marginTop: 4 }} onClick={addVertex}>+ Ajouter un sommet</button>
                </details>
                <details className="fold">
                  <summary>Revêtement de sol</summary>
              <div className="field">
                <label>Motif</label>
                <select className="select" value={(activeRoom.floor || DEFAULT_FLOOR).type} onChange={(e) => updateRoomFloor({ type: e.target.value })}>
                  {FLOOR_TYPES.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
              </div>
              {(activeRoom.floor || DEFAULT_FLOOR).type !== "none" && (
                <>
                  <div className="field">
                    <label>{(activeRoom.floor.type || "").startsWith("parquet") ? "Largeur des lames (cm)" : "Taille du carreau (cm)"}</label>
                    <input type="number" min={2} max={120} value={activeRoom.floor.size}
                      onChange={(e) => updateRoomFloor({ size: Math.max(2, Number(e.target.value) || 2) })} />
                  </div>
                  {activeRoom.floor.type === "parquet-droit" && (
                    <div className="field">
                      <label>Longueur des lames (cm)</label>
                      <input type="number" min={activeRoom.floor.size * 1.5} max={300} value={activeRoom.floor.size2}
                        onChange={(e) => updateRoomFloor({ size2: Math.max(activeRoom.floor.size * 1.5, Number(e.target.value) || 0) })} />
                    </div>
                  )}
                  <div className="field">
                    <label>Couleur principale</label>
                    <input type="color" value={activeRoom.floor.color} onChange={(e) => updateRoomFloor({ color: e.target.value })} style={{ width: "100%", height: 32, padding: 2, border: "1px solid #c7d0d9", borderRadius: 3 }} />
                  </div>
                  <div className="field">
                    <label>{activeRoom.floor.type === "carrelage-quadrillage" ? "Couleur des joints" : "Couleur secondaire"}</label>
                    <input type="color" value={activeRoom.floor.colorAlt} onChange={(e) => updateRoomFloor({ colorAlt: e.target.value })} style={{ width: "100%", height: 32, padding: 2, border: "1px solid #c7d0d9", borderRadius: 3 }} />
                  </div>
                  <div className="field">
                    <label>Orientation du motif : {activeRoom.floor.rotation}°</label>
                    <input type="range" min={0} max={165} step={15} value={activeRoom.floor.rotation} onChange={(e) => updateRoomFloor({ rotation: Number(e.target.value) })} />
                  </div>
                </>
              )}
                </details>
                <button className="btn primary next-btn" onClick={() => switchMode("meubles")}>Passer aux meubles →</button>
              </>
            )}
            {mode === "meubles" && (
              <>
                <input className="search" type="search" placeholder="Rechercher un meuble…" value={catalogQuery} onChange={(e) => setCatalogQuery(e.target.value)} />
                {FURNITURE_GROUPS.map((g) => {
                  const entries = CATALOG.filter((c) => c.group === g && (!catalogQ || c.name.toLowerCase().includes(catalogQ)));
                  if (entries.length === 0) return null;
                  return (
                    <details className="fold" key={g} open={catalogQ ? true : g === FURNITURE_GROUPS[0]}>
                      <summary>{g} <span className="count">{entries.length}</span></summary>
                      {entries.map(renderCatalogRow)}
                    </details>
                  );
                })}
                <button className="btn next-btn" onClick={() => switchMode("plan")}>← Modifier le plan</button>
              </>
            )}
          </div>
        </div>

        <div className="main">
          <div className="footer-hint">{mode === "plan" ? "Plan : glisse les points ambre pour déplacer un sommet · clique un mur pour éditer sa longueur · place portes et fenêtres depuis la liste de gauche" : "Meubles : glisse un meuble pour le placer · sélectionne-le pour régler ses dimensions à droite · murs et ouvertures verrouillés (étape 1 pour les modifier)"}</div>
          <div className="editor2d-wrap" ref={wrapRef}>
            <svg ref={svgRef} viewBox={`${bounds.minX} ${bounds.minY} ${bounds.w} ${bounds.h}`} width="100%" height="100%" preserveAspectRatio="xMidYMid meet" style={{ touchAction: "none" }}
              onPointerDown={() => { setSelectedUid(null); setSelectedWallIndex(null); setWallEditIndex(null); }}>
              <defs>
                <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
                  <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#e3e7ec" strokeWidth="0.5" />
                </pattern>
                {activeRoom && <FloorPatternDef id="floorpat-active" floor={activeRoom.floor || DEFAULT_FLOOR} />}
                {activeRoom && <clipPath id="floorclip-active"><polygon points={polyPoints} /></clipPath>}
              </defs>
              <rect x={bounds.minX} y={bounds.minY} width={bounds.w} height={bounds.h} fill="#ffffff" />
              {activeRoom && (activeRoom.floor || DEFAULT_FLOOR).type === "parquet-batonrompu" ? (
                <HerringboneFloor floor={activeRoom.floor} bounds={bounds} vertices={activeRoom.vertices} clipId="floorclip-active" />
              ) : (
                activeRoom && (
                  <polygon
                    points={polyPoints}
                    fill={activeRoom.floor && activeRoom.floor.type !== "none" ? "url(#floorpat-active)" : "url(#grid)"}
                    stroke="none"
                  />
                )
              )}
              {activeRoom && <text x={centroid.x} y={centroid.y} textAnchor="middle" className="dim-text" fontSize="14" fontWeight="600">{roomArea} m²</text>}

              {edges.map((w, i) => {
                const midX = (w.A.x + w.B.x) / 2, midY = (w.A.y + w.B.y) / 2;
                const lx = midX + w.normal.x * 14, ly = midY + w.normal.y * 14;
                const wallSelected = selectedWallIndex === i;
                return (
                  <g key={i} onPointerDown={mode === "plan" ? (e) => onWallDown(i, e) : undefined} style={{ cursor: mode === "plan" ? "pointer" : "default", pointerEvents: mode === "plan" ? undefined : "none" }}>
                    {/* zone de clic élargie, invisible, plus facile à viser que le trait fin */}
                    <line x1={w.A.x} y1={w.A.y} x2={w.B.x} y2={w.B.y} stroke="transparent" strokeWidth={16} vectorEffect="non-scaling-stroke" />
                    <line x1={w.A.x} y1={w.A.y} x2={w.B.x} y2={w.B.y} stroke={wallSelected ? "#e2711d" : mode === "plan" ? "#1f6f93" : "#4b5b6e"} strokeWidth={wallSelected ? 3 : mode === "plan" ? 1.4 : 2.4} vectorEffect="non-scaling-stroke" pointerEvents="none" />
                    {wallEditIndex !== i && (
                      <text x={lx} y={ly} textAnchor="middle" className="dim-text" fontSize={wallSelected ? 8.5 : 7} fontWeight={wallSelected ? 700 : 400} pointerEvents="none">{w.length}</text>
                    )}
                  </g>
                );
              })}

              {roomItemsComputed.map((item) => {
                const selected = selectedUid === item.uid;
                const band = item.catalogEntry.band;
                const locked = isPlanEntry(item.catalogEntry) !== (mode === "plan");
                if (item.catalogEntry.roundable) {
                  const d = roundedRectPathD(item.x, item.y, item.width, item.depth, item.u, item.v, item.radii);
                  return (
                    <g key={item.uid} onPointerDown={locked ? undefined : (e) => onItemDown(item, e)} style={{ cursor: locked ? "default" : "grab", pointerEvents: locked ? "none" : undefined }} opacity={locked && mode === "plan" ? 0.25 : undefined}>
                      {selected && <path d={d} fill="none" stroke="#e2711d" strokeWidth={8} strokeOpacity={0.4} vectorEffect="non-scaling-stroke" />}
                      <path d={d} fill={item.catalogEntry.color} opacity={selected ? 0.95 : 0.65} stroke={selected ? "#e2711d" : "#1d2733"} strokeWidth={selected ? 2.6 : 0.7} vectorEffect="non-scaling-stroke" />
                    </g>
                  );
                }
                const opacity = selected ? 1 : band === "wall" ? 0.35 : band === "opening" ? 0.6 : 0.9;
                const dash = band === "wall" && !selected ? "4,3" : undefined;
                const stroke = selected ? "#e2711d" : "#1d2733";
                const pts = item.corners.map((c) => `${c.x},${c.y}`).join(" ");
                return (
                  <g key={item.uid} onPointerDown={locked ? undefined : (e) => onItemDown(item, e)} style={{ cursor: locked ? "default" : "grab", pointerEvents: locked ? "none" : undefined }} opacity={locked && mode === "plan" ? 0.25 : undefined}>
                    {selected && <polygon points={pts} fill="none" stroke="#e2711d" strokeWidth={8} strokeOpacity={0.4} vectorEffect="non-scaling-stroke" />}
                    <polygon points={pts} fill={item.catalogEntry.color} opacity={opacity} stroke={stroke} strokeWidth={selected ? 2.6 : 0.7} strokeDasharray={dash} vectorEffect="non-scaling-stroke" />
                    <SymbolShapes item={item} />
                  </g>
                );
              })}

              {activeRoom && mode === "plan" && activeRoom.vertices.map((v, i) => (
                <g key={i}>
                  <circle cx={v.x} cy={v.y} r={16} fill="transparent" style={{ cursor: "grab" }} onPointerDown={(e) => onVertexDown(i, e)} />
                  <circle cx={v.x} cy={v.y} r={7} fill="#ffffff" stroke="#e2711d" strokeWidth={2} vectorEffect="non-scaling-stroke" pointerEvents="none" />
                </g>
              ))}
            </svg>
            {wallEditIndex != null && edges[wallEditIndex] && wallEditPos && (
              <input
                key={wallEditIndex}
                type="number"
                className="wall-edit-input"
                style={{ left: wallEditPos.left, top: wallEditPos.top }}
                autoFocus
                defaultValue={Math.round(edges[wallEditIndex].length)}
                onFocus={(e) => e.target.select()}
                onKeyDown={(e) => {
                  if (e.key === "Enter") e.target.blur();
                  else if (e.key === "Escape") { wallEditCancelRef.current = true; e.target.blur(); }
                }}
                onBlur={(e) => {
                  if (wallEditCancelRef.current) { wallEditCancelRef.current = false; setWallEditIndex(null); return; }
                  commitWallEdit(wallEditIndex, e.target.value);
                }}
              />
            )}
          </div>
          <div className="viewer3d-bar">
            <div className="section-label" style={{ padding: 0 }}>{show3D ? "Vue 3D — glisser pour orbiter, molette/pincer pour zoomer" : "Vue 3D masquée"}</div>
            {mode === "3d"
              ? <button className="btn primary" onClick={exportView3DPNG}>Exporter la vue (PNG)</button>
              : <button className="btn" onClick={() => setShow3D((v) => !v)}>{show3D ? "Masquer la 3D" : "Afficher la 3D"}</button>}
          </div>
          {show3D && <div className="viewer3d-wrap"><div ref={containerRef} /></div>}
        </div>

        <div className="sidebar-right">
          <div className="panel-title">{mode === "plan" ? "Ouvertures" : "Meubles"} — {activeRoom?.name}</div>
          <div className="panel">
            {visibleItems.length === 0 && (
              <div className="empty">{mode === "plan" ? "Aucune porte ni fenêtre. Ajoutes-en depuis la liste de gauche." : "Aucun meuble dans cette pièce. Choisis-en un dans le catalogue à gauche."}</div>
            )}
            {visibleItems.map((item) => {
              const e = item.catalogEntry;
              const raw = items.find((it) => it.uid === item.uid);
              const open = selectedUid === item.uid;
              return (
                <div key={item.uid} id={`row-${item.uid}`} className={`layout-row ${open ? "selected" : ""}`} onClick={() => setSelectedUid(item.uid)}>
                  <div className="top">
                    <span className="name">{e.name}</span>
                    <span className="w">{item.width}×{item.depth} cm</span>
                  </div>
                  {open && (
                    <>
                  <div className="field" style={{ margin: "8px 0 0" }}>
                    <label>Position X / Y (cm)</label>
                    <div style={{ display: "flex", gap: 4 }}>
                      <input type="number" value={raw.x} onClick={(ev) => ev.stopPropagation()} onChange={(ev) => updateItem(item.uid, { x: Number(ev.target.value) || 0 })} />
                      <input type="number" value={raw.y} onClick={(ev) => ev.stopPropagation()} onChange={(ev) => updateItem(item.uid, { y: Number(ev.target.value) || 0 })} />
                    </div>
                  </div>
                  <div className="field" style={{ margin: "8px 0 0" }}>
                    <label>Largeur / Profondeur (cm) — saisie libre</label>
                    <div style={{ display: "flex", gap: 4 }}>
                      <DimInput value={item.width} onCommit={(n) => updateItemWidth(item.uid, n)} />
                      <DimInput value={item.depth} onCommit={(n) => updateItemDepth(item.uid, n)} />
                    </div>
                  </div>
                  <div className="field" style={{ margin: "8px 0 0" }}>
                    <label>Angle (°)</label>
                    <input type="number" value={raw.angleDeg} onClick={(ev) => ev.stopPropagation()} onChange={(ev) => updateItem(item.uid, { angleDeg: Number(ev.target.value) || 0 })} />
                  </div>
                  {isWorktop(e) && (
                    <div className="field" style={{ margin: "8px 0 0" }}>
                      <label>Hauteur du dessus (cm) — 75 pour une table, pieds ajoutés</label>
                      <div style={{ display: "flex", gap: 4 }}>
                        <DimInput value={item.catalogEntry.yOffset + item.catalogEntry.height} onCommit={(n) => updateItem(item.uid, { topHeight: Math.max(e.height, n) })} />
                        <button className="btn" onClick={(ev) => { ev.stopPropagation(); updateItem(item.uid, { topHeight: 75 }); }}>Table</button>
                        <button className="btn" disabled={typeof raw.topHeight !== "number"} onClick={(ev) => { ev.stopPropagation(); updateItem(item.uid, { topHeight: undefined }); }}>Standard</button>
                      </div>
                    </div>
                  )}
                  {e.roundable && (
                    <div className="field radii-grid" style={{ margin: "8px 0 0" }}>
                      <label>Rayon des coins (cm) — pousse les 4 au max pour approcher un rond</label>
                      {[0, 1, 2, 3].map((idx) => (
                        <input key={idx} type="number" value={(raw.radii || [0, 0, 0, 0])[idx]} placeholder={`Coin ${idx + 1}`}
                          onClick={(ev) => ev.stopPropagation()} onChange={(ev) => updateItemRadius(item.uid, idx, ev.target.value)} />
                      ))}
                    </div>
                  )}
                  <div className="row-actions">
                    {rooms.length > 1 && (
                      <select className="select small" value={raw.roomId} onClick={(ev) => ev.stopPropagation()} onChange={(ev) => reassignRoom(item.uid, ev.target.value)}>
                        {rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                      </select>
                    )}
                    <button className="btn" onClick={(ev) => { ev.stopPropagation(); duplicateItem(item.uid); }}>Dupliquer</button>
                    <button className="btn" onClick={(ev) => { ev.stopPropagation(); removeItem(item.uid); }}>Supprimer</button>
                  </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
