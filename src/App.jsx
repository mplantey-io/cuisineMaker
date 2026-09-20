import React, { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

// ---------------------------------------------------------------------------
// Catalogue unifié — tout objet est placé librement (x, y, angle) dans une
// pièce, quel que soit son type. "band" ne sert plus qu'au rendu (opacité,
// hauteur de pose) — il n'y a plus de notion de mur porteur.
// ---------------------------------------------------------------------------
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
  { id: "door", name: "Porte", group: "Ouvertures", band: "opening", symbol: "door", color: "#eef3f6", height: 200, yOffset: 0, depthMin: 8, depthMax: 8, depthStep: 0, defaultDepth: 8, widthMin: 60, widthMax: 100, widthStep: 5, defaultWidth: 80 },
  { id: "double-door", name: "Porte double", group: "Ouvertures", band: "opening", symbol: "doubledoor", color: "#eef3f6", height: 200, yOffset: 0, depthMin: 8, depthMax: 8, depthStep: 0, defaultDepth: 8, widthMin: 100, widthMax: 180, widthStep: 10, defaultWidth: 140 },
  { id: "window", name: "Fenêtre", group: "Ouvertures", band: "opening", symbol: "window", color: "#eef3f6", height: 120, yOffset: 90, depthMin: 8, depthMax: 8, depthStep: 0, defaultDepth: 8, widthMin: 40, widthMax: 180, widthStep: 10, defaultWidth: 100 },
  { id: "bay-window", name: "Baie vitrée", group: "Ouvertures", band: "opening", symbol: "bay", color: "#cfe8f0", height: 220, yOffset: 0, depthMin: 8, depthMax: 8, depthStep: 0, defaultDepth: 8, widthMin: 120, widthMax: 300, widthStep: 10, defaultWidth: 180 },
  { id: "shower-screen", name: "Paroi de douche", group: "Ouvertures", band: "opening", symbol: "glasswall", color: "#cfe8f0", height: 200, yOffset: 0, depthMin: 6, depthMax: 6, depthStep: 0, defaultDepth: 6, widthMin: 70, widthMax: 140, widthStep: 10, defaultWidth: 90 },
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
  { id: "chair", name: "Chaise", group: "Séjour / Chambre", band: "floor", symbol: null, color: "#7c9473", height: 45, yOffset: 0, depthMin: 45, depthMax: 45, depthStep: 0, defaultDepth: 45, widthMin: 45, widthMax: 45, widthStep: 0, defaultWidth: 45 },
  { id: "bed", name: "Lit", group: "Séjour / Chambre", band: "floor", symbol: "bed", color: "#8a7f9e", height: 45, yOffset: 0, depthMin: 190, depthMax: 200, depthStep: 10, defaultDepth: 200, widthMin: 90, widthMax: 180, widthStep: 10, defaultWidth: 140 },
  { id: "nightstand", name: "Chevet", group: "Séjour / Chambre", band: "floor", symbol: null, color: "#8a7f9e", height: 50, yOffset: 0, depthMin: 35, depthMax: 40, depthStep: 5, defaultDepth: 38, widthMin: 35, widthMax: 45, widthStep: 5, defaultWidth: 40 },
  { id: "wardrobe", name: "Armoire", group: "Séjour / Chambre", band: "floor", symbol: null, color: "#5a6b7a", height: 200, yOffset: 0, depthMin: 55, depthMax: 60, depthStep: 5, defaultDepth: 58, widthMin: 80, widthMax: 200, widthStep: 10, defaultWidth: 120 },
  { id: "dresser", name: "Commode", group: "Séjour / Chambre", band: "floor", symbol: null, color: "#5a6b7a", height: 85, yOffset: 0, depthMin: 45, depthMax: 50, depthStep: 5, defaultDepth: 48, widthMin: 80, widthMax: 140, widthStep: 10, defaultWidth: 100 },
  { id: "buffet", name: "Buffet", group: "Séjour / Chambre", band: "floor", symbol: null, color: "#5a6b7a", height: 85, yOffset: 0, depthMin: 45, depthMax: 50, depthStep: 5, defaultDepth: 48, widthMin: 120, widthMax: 200, widthStep: 10, defaultWidth: 160 },
  { id: "desk", name: "Bureau", group: "Séjour / Chambre", band: "floor", symbol: null, color: "#6a8caf", height: 75, yOffset: 0, depthMin: 60, depthMax: 70, depthStep: 5, defaultDepth: 65, widthMin: 100, widthMax: 160, widthStep: 10, defaultWidth: 120 },
  { id: "tv", name: "Télévision", group: "Séjour / Chambre", band: "wall", symbol: null, color: "#20242b", height: 55, yOffset: 100, depthMin: 6, depthMax: 6, depthStep: 0, defaultDepth: 6, widthMin: 80, widthMax: 160, widthStep: 10, defaultWidth: 110 },
  { id: "worktop", name: "Plan de travail", group: "Cuisine — Meubles", band: "floor", symbol: null, color: "#c9a26a", height: 4, yOffset: 85, depthMin: 40, depthMax: 90, depthStep: 5, defaultDepth: 60, widthMin: 60, widthMax: 300, widthStep: 10, defaultWidth: 200, roundable: true },
];
const catalogById = Object.fromEntries(CATALOG.map((c) => [c.id, c]));
const GROUPS = ["Cuisine — Meubles", "Cuisine — Électroménager", "Réseaux", "Ouvertures", "Salle de bain", "Séjour / Chambre"];

const DEFAULT_VERTICES = [
  { x: 280, y: -140 }, { x: 460, y: -140 }, { x: 460, y: 320 },
  { x: 0, y: 320 }, { x: 0, y: 0 }, { x: 280, y: 0 },
];

// Revêtement de sol par défaut d'une pièce — "none" = pas de motif (sol blanc uni).
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
    // Chevrons entrelacés (2 lames horizontales + 1 lame verticale par tuile,
    // pavage exact sans trou ni recouvrement) — évoque le motif bâton rompu.
    case "parquet-batonrompu": {
      const w = size;
      return {
        tileWidth: 3 * w, tileHeight: 2 * w, background: colorAlt,
        rects: [
          { x: 0, y: 0, w: 2 * w, h: w, fill: color },
          { x: 2 * w, y: 0, w: w, h: 2 * w, fill: color },
          { x: 0, y: w, w: 2 * w, h: w, fill: color },
        ],
        lines: [{ x1: 0, y1: w, x2: 2 * w, y2: w }, { x1: 2 * w, y1: 0, x2: 2 * w, y2: 2 * w }],
      };
    }
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
// --- texture canvas (3D) construite à partir de la même géométrie que le SVG ---
function buildFloorTexture(floor) {
  const geo = getFloorPatternGeometry(floor);
  if (!geo || typeof document === "undefined") return null;
  const scale = 6; // px par cm
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
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  if ("colorSpace" in texture) texture.colorSpace = THREE.SRGBColorSpace;
  texture.center.set(0.5, 0.5);
  texture.rotation = ((floor.rotation || 0) * Math.PI) / 180;
  texture.repeat.set(1 / (geo.tileWidth / 100), 1 / (geo.tileHeight / 100));
  texture.needsUpdate = true;
  return texture;
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
  const entry = catalogById[item.catalogId];
  if (!entry) return null;
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
function hexToRgb01(hex) {
  const n = parseInt(hex.replace("#", ""), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

// ---------------------------------------------------------------------------
// Export 3D — GLTF minimal (boîtes positionnées/rotées) de la pièce active
// ---------------------------------------------------------------------------
function exportGLTF(items) {
  const chunks = [];
  let byteOffset = 0;
  const bufferViews = [], accessors = [], meshes = [], nodes = [], materials = [];
  const materialIndexByColor = {};

  items.forEach((item, i) => {
    const wM = item.width / 100, hM = item.catalogEntry.height / 100, dM = item.depth / 100;
    const { positions, normals, indices } = buildBoxArrays(wM, hM, dM);

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

    const color = item.catalogEntry.color;
    if (!(color in materialIndexByColor)) {
      materials.push({ name: item.catalogEntry.name, pbrMetallicRoughness: { baseColorFactor: [...hexToRgb01(color), 1], metallicFactor: 0.05, roughnessFactor: 0.8 } });
      materialIndexByColor[color] = materials.length - 1;
    }
    meshes.push({ name: `${item.catalogEntry.name}_${i}`, primitives: [{ attributes: { POSITION: posAcc, NORMAL: normAcc }, indices: idxAcc, material: materialIndexByColor[color] }] });

    const half = item.angleRad / 2;
    nodes.push({ name: `${item.catalogEntry.name}_${i}`, mesh: meshes.length - 1, translation: [item.centerX / 100, item.catalogEntry.yOffset / 100, item.centerY / 100], rotation: [0, Math.sin(half), 0, Math.cos(half)] });
  });

  const totalLength = chunks.reduce((s, c) => s + c.length, 0);
  const bin = new Uint8Array(totalLength);
  let off = 0;
  chunks.forEach((c) => { bin.set(c, off); off += c.length; });
  let binaryStr = "";
  for (let i = 0; i < bin.length; i++) binaryStr += String.fromCharCode(bin[i]);
  const base64 = btoa(binaryStr);

  const gltf = {
    asset: { version: "2.0", generator: "kitchen-designer-prototype" },
    scene: 0, scenes: [{ nodes: nodes.map((_, i) => i) }],
    nodes, meshes, materials,
    buffers: [{ byteLength: totalLength, uri: `data:application/octet-stream;base64,${base64}` }],
    bufferViews, accessors,
  };
  const blob = new Blob([JSON.stringify(gltf, null, 2)], { type: "model/gltf+json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `piece_${timestamp()}.gltf`;
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
    const floorFill = floor ? `url(#${patternId})` : "#fff";
    if (floor) defs += buildFloorPatternDefString(patternId, floor);

    body += `<text x="${padOut}" y="${cursorY + 20}" font-family="monospace" font-size="16" font-weight="bold" fill="#111">${room.name} — ${area} m²</text>`;
    body += `<polygon points="${room.vertices.map((v) => { const p = tr(v); return `${p.x},${p.y}`; }).join(" ")}" fill="${floorFill}" stroke="#111" stroke-width="6" stroke-linejoin="round"/>`;

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
  const [tab, setTab] = useState("room");
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

    scene.add(new THREE.AmbientLight(0xffffff, 0.8));
    const dir = new THREE.DirectionalLight(0xffffff, 0.75);
    dir.position.set(3, 5, 2);
    scene.add(dir);

    const group = new THREE.Group();
    const roomGroup = new THREE.Group();
    scene.add(group); scene.add(roomGroup);

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

    three.current = { scene, camera, renderer, group, roomGroup, target, spherical, updateCamera };
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
    t.roomGroup.clear();
    const hM = activeRoom.height / 100;
    const shapePts = activeRoom.vertices.map((v) => new THREE.Vector2(v.x / 100, -(v.y / 100)));
    const shape = new THREE.Shape(shapePts);
    const floorGeo = new THREE.ShapeGeometry(shape);
    floorGeo.rotateX(-Math.PI / 2);
    const floorTexture = buildFloorTexture(activeRoom.floor || DEFAULT_FLOOR);
    const floorMat = floorTexture
      ? new THREE.MeshStandardMaterial({ map: floorTexture, roughness: 1, side: THREE.DoubleSide })
      : new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, side: THREE.DoubleSide });
    t.roomGroup.add(new THREE.Mesh(floorGeo, floorMat));

    const wallMat = new THREE.LineBasicMaterial({ color: 0x1f6f93, transparent: true, opacity: 0.7 });
    activeRoom.vertices.forEach((A, i) => {
      const B = activeRoom.vertices[(i + 1) % activeRoom.vertices.length];
      const pts = [
        new THREE.Vector3(A.x / 100, 0, A.y / 100), new THREE.Vector3(B.x / 100, 0, B.y / 100),
        new THREE.Vector3(B.x / 100, hM, B.y / 100), new THREE.Vector3(A.x / 100, hM, A.y / 100),
        new THREE.Vector3(A.x / 100, 0, A.y / 100),
      ];
      t.roomGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), wallMat));
    });

    const xs = activeRoom.vertices.map((v) => v.x), ys = activeRoom.vertices.map((v) => v.y);
    const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
    t.target.set((minX + maxX) / 2 / 100, hM / 3, (minY + maxY) / 2 / 100);
    t.spherical.radius = Math.max(maxX - minX, maxY - minY, 100) / 100 * 1.6 + 1;
    t.updateCamera();
  }, [activeRoom, show3D]);

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
    t.group.children.forEach((c) => { c.geometry?.dispose(); c.material?.dispose(); });
    t.group.clear();
    roomItemsComputed.forEach((item) => {
      const wM = item.width / 100, hM = item.catalogEntry.height / 100, dM = item.depth / 100;
      const geo = new THREE.BoxGeometry(wM, hM, dM);
      const mat = new THREE.MeshStandardMaterial({ color: item.catalogEntry.color, roughness: 0.8, metalness: 0.05 });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.rotation.y = item.angleRad;
      mesh.position.set(item.centerX / 100, item.catalogEntry.yOffset / 100 + hM / 2, item.centerY / 100);
      t.group.add(mesh);
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
      const e = catalogById[it.catalogId];
      return { ...it, width: Math.min(e.widthMax, Math.max(e.widthMin, w)) };
    }));
  }
  function updateItemDepth(id, d) {
    setItems((its) => its.map((it) => {
      if (it.uid !== id) return it;
      const e = catalogById[it.catalogId];
      return { ...it, depth: Math.min(e.depthMax, Math.max(e.depthMin, d)) };
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
        .viewer3d-wrap > div { width:100%; height:100%; cursor:grab; touch-action:none; }
        .dim-text { font-family:'IBM Plex Mono',monospace; fill:#1f6f93; }
        .footer-hint { font-family:'IBM Plex Mono',monospace; font-size:10px; color:#6b7789; padding:8px 12px; border-bottom:1px solid #d7dde3; }
        .empty { color:#8b96a3; font-size:12px; padding:20px 0; text-align:center; }
        .radii-grid { display:grid; grid-template-columns:1fr 1fr; gap:6px; }
        .radii-grid label { grid-column:1 / -1; }

        @media (max-width: 860px) {
          .app { min-height: 100vh; height: auto; }
          .body { flex-direction: column; }
          .project-bar { padding: 8px 12px; }
          .autosave-hint { display: none; }
          .sidebar, .sidebar-right { width: 100%; max-height: 42vh; min-height: 0; overflow: hidden; border: none; border-bottom: 1px solid #d7dde3; }
          .header { padding: 10px 12px; }
          .header h1 { font-size: 13px; }
          .header .sub { font-size: 10px; }
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
        <div>
          <h1>Atelier Appartement</h1>
          <div className="sub">prototype paramétrique — v1.0 · plusieurs pièces, placement libre, 3D à la demande</div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input ref={fileInputRef} type="file" accept="application/json" style={{ display: "none" }} onChange={handleImportFile} />
          <button className="btn" onClick={triggerImport}>Importer un projet</button>
          <button className="btn" onClick={resetAll}>Réinitialiser</button>
          <button className="btn" onClick={handleExportProject}>Exporter projet (JSON)</button>
          <button className="btn" onClick={() => exportMaterialsCSV(rooms, items)} disabled={items.length === 0}>Liste de matériel (CSV)</button>
          <button className="btn" onClick={() => exportFloorPlanSVG(rooms, items)}>Plan pro (SVG)</button>
          <button className="btn primary" onClick={() => exportGLTF(roomItemsComputed)} disabled={roomItemsComputed.length === 0}>Export 3D (GLTF)</button>
        </div>
      </div>

      <div className="project-bar">
        <label>Projet</label>
        <select className="select" value={activeProjectId} onChange={(e) => switchProject(e.target.value)}>
          {Object.values(projects).sort((a, b) => a.name.localeCompare(b.name)).map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <button className="btn" onClick={createNewProject}>+ Nouveau</button>
        <button className="btn" onClick={renameActiveProject}>Renommer</button>
        <button className="btn" onClick={deleteActiveProject} disabled={Object.keys(projects).length <= 1}>Supprimer</button>
        <span className="autosave-hint">Enregistré automatiquement dans ce navigateur</span>
      </div>
      {importError && <div className="warning" style={{ margin: "8px 18px 0" }}>{importError}</div>}

      <div className="body">
        <div className="sidebar">
          <div className="tabs">
            <button className={`tab ${tab === "room" ? "active" : ""}`} onClick={() => setTab("room")}>Pièce</button>
            <button className={`tab ${tab === "catalog" ? "active" : ""}`} onClick={() => setTab("catalog")}>Catalogue</button>
          </div>

          {tab === "room" && activeRoom && (
            <div className="panel">
              <div className="section-label">Pièce active</div>
              <div className="room-row">
                <select className="select" value={activeRoomId} onChange={(e) => setActiveRoomId(e.target.value)}>
                  {rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </div>
              <div className="row-actions" style={{ marginTop: -4, marginBottom: 14 }}>
                <button className="btn" onClick={addRoom}>+ Nouvelle pièce</button>
                <button className="btn" onClick={renameRoom}>Renommer</button>
                <button className="btn" onClick={deleteRoom} disabled={rooms.length <= 1}>Supprimer</button>
              </div>

              <div className="field">
                <label>Hauteur sous plafond (cm)</label>
                <input type="number" value={activeRoom.height} onChange={(e) => updateRoomHeight(Number(e.target.value) || 0)} />
              </div>
              <div className="field"><label>Surface</label><div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 13 }}>{roomArea} m²</div></div>

              <div className="section-label">Revêtement de sol</div>
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

              <div className="section-label">Sommets du polygone</div>
              {activeRoom.vertices.map((v, i) => (
                <div className="vertex-row" key={i}>
                  <span className="vlabel">P{i + 1}</span>
                  <input type="number" value={v.x} onChange={(e) => updateVertex(i, "x", Number(e.target.value) || 0)} />
                  <input type="number" value={v.y} onChange={(e) => updateVertex(i, "y", Number(e.target.value) || 0)} />
                  <button className="btn" onClick={() => removeVertex(i)} disabled={activeRoom.vertices.length <= 3}>×</button>
                </div>
              ))}
              <button className="btn" style={{ width: "100%", marginTop: 4 }} onClick={addVertex}>+ Ajouter un sommet</button>
            </div>
          )}

          {tab === "catalog" && (
            <div className="panel">
              {GROUPS.map((g) => (
                <div key={g}>
                  <div className="section-label">{g}</div>
                  {CATALOG.filter((c) => c.group === g).map((c) => (
                    <div className="catalog-item" key={c.id}>
                      <div className="swatch" style={{ background: c.color }} />
                      <div className="meta">
                        <div className="name">{c.name}</div>
                        <div className="dims">{c.widthMin === c.widthMax ? `${c.defaultWidth}` : `${c.widthMin}–${c.widthMax}`}×{c.depthMin === c.depthMax ? `${c.defaultDepth}` : `${c.depthMin}–${c.depthMax}`} cm</div>
                      </div>
                      <button className="btn" onClick={() => addItem(c.id)}>+</button>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="main">
          <div className="footer-hint">Points ambre = sommets de la pièce · murs = cliquer pour éditer la longueur, glisser pour déplacer · objets = glisser librement, ou saisir les coordonnées dans la liste à droite</div>
          <div className="editor2d-wrap" ref={wrapRef}>
            <svg ref={svgRef} viewBox={`${bounds.minX} ${bounds.minY} ${bounds.w} ${bounds.h}`} width="100%" height="100%" preserveAspectRatio="xMidYMid meet" style={{ touchAction: "none" }}
              onPointerDown={() => { setSelectedWallIndex(null); setWallEditIndex(null); }}>
              <defs>
                <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
                  <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#e3e7ec" strokeWidth="0.5" />
                </pattern>
                {activeRoom && <FloorPatternDef id="floorpat-active" floor={activeRoom.floor || DEFAULT_FLOOR} />}
              </defs>
              <rect x={bounds.minX} y={bounds.minY} width={bounds.w} height={bounds.h} fill="#ffffff" />
              {activeRoom && (
                <polygon
                  points={polyPoints}
                  fill={activeRoom.floor && activeRoom.floor.type !== "none" ? "url(#floorpat-active)" : "url(#grid)"}
                  stroke="none"
                />
              )}
              {activeRoom && <text x={centroid.x} y={centroid.y} textAnchor="middle" className="dim-text" fontSize="14" fontWeight="600">{roomArea} m²</text>}

              {edges.map((w, i) => {
                const midX = (w.A.x + w.B.x) / 2, midY = (w.A.y + w.B.y) / 2;
                const lx = midX + w.normal.x * 14, ly = midY + w.normal.y * 14;
                const wallSelected = selectedWallIndex === i;
                return (
                  <g key={i} onPointerDown={(e) => onWallDown(i, e)} style={{ cursor: "pointer" }}>
                    {/* zone de clic élargie, invisible, plus facile à viser que le trait fin */}
                    <line x1={w.A.x} y1={w.A.y} x2={w.B.x} y2={w.B.y} stroke="transparent" strokeWidth={16} vectorEffect="non-scaling-stroke" />
                    <line x1={w.A.x} y1={w.A.y} x2={w.B.x} y2={w.B.y} stroke={wallSelected ? "#e2711d" : "#1f6f93"} strokeWidth={wallSelected ? 3 : 1.4} vectorEffect="non-scaling-stroke" pointerEvents="none" />
                    {wallEditIndex !== i && (
                      <text x={lx} y={ly} textAnchor="middle" className="dim-text" fontSize={wallSelected ? 8.5 : 7} fontWeight={wallSelected ? 700 : 400} pointerEvents="none">{w.length}</text>
                    )}
                  </g>
                );
              })}

              {roomItemsComputed.map((item) => {
                const selected = selectedUid === item.uid;
                const band = item.catalogEntry.band;
                if (item.catalogEntry.roundable) {
                  const d = roundedRectPathD(item.x, item.y, item.width, item.depth, item.u, item.v, item.radii);
                  return (
                    <g key={item.uid} onPointerDown={(e) => onItemDown(item, e)} style={{ cursor: "grab" }}>
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
                  <g key={item.uid} onPointerDown={(e) => onItemDown(item, e)} style={{ cursor: "grab" }}>
                    {selected && <polygon points={pts} fill="none" stroke="#e2711d" strokeWidth={8} strokeOpacity={0.4} vectorEffect="non-scaling-stroke" />}
                    <polygon points={pts} fill={item.catalogEntry.color} opacity={opacity} stroke={stroke} strokeWidth={selected ? 2.6 : 0.7} strokeDasharray={dash} vectorEffect="non-scaling-stroke" />
                    <SymbolShapes item={item} />
                  </g>
                );
              })}

              {activeRoom && activeRoom.vertices.map((v, i) => (
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
            <button className="btn" onClick={() => setShow3D((v) => !v)}>{show3D ? "Masquer la 3D" : "Afficher la 3D"}</button>
          </div>
          {show3D && <div className="viewer3d-wrap"><div ref={containerRef} /></div>}
        </div>

        <div className="sidebar-right">
          <div className="tabs"><div className="tab active" style={{ cursor: "default" }}>Objets — {activeRoom?.name}</div></div>
          <div className="panel">
            {roomItemsComputed.length === 0 && <div className="empty">Aucun objet dans cette pièce. Ajoute-en depuis le catalogue à gauche.</div>}
            {roomItemsComputed.map((item) => {
              const e = item.catalogEntry;
              const raw = items.find((it) => it.uid === item.uid);
              return (
                <div key={item.uid} className={`layout-row ${selectedUid === item.uid ? "selected" : ""}`} onClick={() => setSelectedUid(item.uid)}>
                  <div className="top">
                    <span className="name">{e.name}</span>
                    <span className="w">{item.width}×{item.depth} cm</span>
                  </div>
                  <div className="field" style={{ margin: "8px 0 0" }}>
                    <label>Position X / Y (cm)</label>
                    <div style={{ display: "flex", gap: 4 }}>
                      <input type="number" value={raw.x} onClick={(ev) => ev.stopPropagation()} onChange={(ev) => updateItem(item.uid, { x: Number(ev.target.value) || 0 })} />
                      <input type="number" value={raw.y} onClick={(ev) => ev.stopPropagation()} onChange={(ev) => updateItem(item.uid, { y: Number(ev.target.value) || 0 })} />
                    </div>
                  </div>
                  {e.widthMin !== e.widthMax && (
                    <div className="field" style={{ margin: "6px 0 0" }}>
                      <label>Largeur : {item.width} cm</label>
                      <input type="range" min={e.widthMin} max={e.widthMax} step={e.widthStep} value={item.width}
                        onChange={(ev) => updateItemWidth(item.uid, Number(ev.target.value))} onClick={(ev) => ev.stopPropagation()} />
                    </div>
                  )}
                  {e.depthMin !== e.depthMax && (
                    <div className="field" style={{ margin: "6px 0 0" }}>
                      <label>Profondeur : {item.depth} cm</label>
                      <input type="range" min={e.depthMin} max={e.depthMax} step={e.depthStep} value={item.depth}
                        onChange={(ev) => updateItemDepth(item.uid, Number(ev.target.value))} onClick={(ev) => ev.stopPropagation()} />
                    </div>
                  )}
                  <div className="field" style={{ margin: "8px 0 0" }}>
                    <label>Angle (°)</label>
                    <input type="number" value={raw.angleDeg} onClick={(ev) => ev.stopPropagation()} onChange={(ev) => updateItem(item.uid, { angleDeg: Number(ev.target.value) || 0 })} />
                  </div>
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
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
