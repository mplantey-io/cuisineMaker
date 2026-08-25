import React, { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

// ---------------------------------------------------------------------------
// Catalogue de modules paramétriques (dimensions en cm)
// band: "floor" (au sol) | "wall" (suspendu) | "opening" (porte/fenêtre/baie)
// insetFixture: posé/encastré sur un meuble existant (évier, plaque) —
//   n'entre pas dans les contrôles de chevauchement ni de largeur du mur.
// ---------------------------------------------------------------------------
const CATALOG = [
  { id: "base-cabinet", name: "Meuble bas", group: "Meubles", band: "floor", symbol: null, color: "#3b6ea5", depthMin: 60, depthMax: 60, depthStep: 0, defaultDepth: 60, height: 85, widthMin: 30, widthMax: 120, widthStep: 5, defaultWidth: 60, yOffset: 0 },
  { id: "drawer-unit", name: "Bloc tiroirs", group: "Meubles", band: "floor", symbol: null, color: "#4a7fb5", depthMin: 60, depthMax: 60, depthStep: 0, defaultDepth: 60, height: 85, widthMin: 30, widthMax: 90, widthStep: 5, defaultWidth: 45, yOffset: 0 },
  { id: "corner-base", name: "Meuble d'angle bas", group: "Meubles", band: "floor", symbol: null, color: "#355d82", depthMin: 60, depthMax: 60, depthStep: 0, defaultDepth: 60, height: 85, widthMin: 90, widthMax: 90, widthStep: 0, defaultWidth: 90, yOffset: 0 },
  { id: "tall-cabinet", name: "Colonne", group: "Meubles", band: "floor", symbol: null, color: "#2f4d6b", depthMin: 60, depthMax: 60, depthStep: 0, defaultDepth: 60, height: 200, widthMin: 30, widthMax: 60, widthStep: 5, defaultWidth: 45, yOffset: 0 },
  { id: "wall-cabinet", name: "Meuble haut", group: "Meubles", band: "wall", symbol: null, color: "#6a8caf", depthMin: 35, depthMax: 35, depthStep: 0, defaultDepth: 35, height: 70, widthMin: 30, widthMax: 100, widthStep: 5, defaultWidth: 60, yOffset: 140 },
  { id: "sink", name: "Évier", group: "Électroménager", band: "floor", symbol: "sink", insetFixture: true, color: "#dfe8ee", depthMin: 50, depthMax: 60, depthStep: 5, defaultDepth: 55, height: 10, widthMin: 50, widthMax: 120, widthStep: 5, defaultWidth: 80, yOffset: 78 },
  { id: "stove", name: "Plaque à induction", group: "Électroménager", band: "floor", symbol: "stove", insetFixture: true, color: "#20242b", depthMin: 50, depthMax: 65, depthStep: 5, defaultDepth: 55, height: 8, widthMin: 30, widthMax: 90, widthStep: 30, defaultWidth: 60, yOffset: 80 },
  { id: "fridge", name: "Réfrigérateur", group: "Électroménager", band: "floor", symbol: "fridge", color: "#e7edf1", depthMin: 50, depthMax: 60, depthStep: 5, defaultDepth: 60, height: 190, widthMin: 60, widthMax: 90, widthStep: 5, defaultWidth: 60, yOffset: 0 },
  { id: "dishwasher", name: "Lave-vaisselle", group: "Électroménager", band: "floor", symbol: "dishwasher", color: "#4a7fb5", depthMin: 60, depthMax: 60, depthStep: 0, defaultDepth: 60, height: 85, widthMin: 60, widthMax: 60, widthStep: 0, defaultWidth: 60, yOffset: 0 },
  { id: "door", name: "Porte", group: "Ouvertures", band: "opening", symbol: "door", color: "#eef3f6", depthMin: 8, depthMax: 8, depthStep: 0, defaultDepth: 8, height: 200, widthMin: 60, widthMax: 100, widthStep: 5, defaultWidth: 80, yOffset: 0 },
  { id: "window", name: "Fenêtre", group: "Ouvertures", band: "opening", symbol: "window", color: "#eef3f6", depthMin: 8, depthMax: 8, depthStep: 0, defaultDepth: 8, height: 120, widthMin: 40, widthMax: 180, widthStep: 10, defaultWidth: 100, yOffset: 90 },
  { id: "bay-window", name: "Baie vitrée", group: "Ouvertures", band: "opening", symbol: "bay", color: "#cfe8f0", depthMin: 8, depthMax: 8, depthStep: 0, defaultDepth: 8, height: 220, widthMin: 120, widthMax: 300, widthStep: 10, defaultWidth: 180, yOffset: 0 },
];
const catalogById = Object.fromEntries(CATALOG.map((c) => [c.id, c]));
const GROUPS = ["Meubles", "Électroménager", "Ouvertures"];
const BAND_LABEL = { floor: "Bas / électroménager", wall: "Haut", opening: "Ouvertures" };

const DEFAULT_VERTICES = [
  { x: 280, y: -140 }, { x: 460, y: -140 }, { x: 460, y: 320 },
  { x: 0, y: 320 }, { x: 0, y: 0 }, { x: 280, y: 0 },
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

function polygonOrientation(vertices) {
  let s = 0;
  for (let i = 0; i < vertices.length; i++) {
    const a = vertices[i], b = vertices[(i + 1) % vertices.length];
    s += a.x * b.y - b.x * a.y;
  }
  return s >= 0 ? 1 : -1;
}
function wallGeom(A, B, orient) {
  const dx = B.x - A.x, dy = B.y - A.y;
  const length = Math.hypot(dx, dy) || 1;
  const dir = { x: dx / length, y: dy / length };
  const normal = orient > 0 ? { x: -dir.y, y: dir.x } : { x: dir.y, y: -dir.x };
  return { A, B, dir, normal, length: Math.round(length) };
}

function shoelaceAreaM2(vertices) {
  let sum = 0;
  for (let i = 0; i < vertices.length; i++) {
    const a = vertices[i], b = vertices[(i + 1) % vertices.length];
    sum += a.x * b.y - b.x * a.y;
  }
  return Math.round((Math.abs(sum) / 2 / 10000) * 100) / 100;
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
    case "door": {
      const hinge = L(-w / 2, 0), tip = L(-w / 2, w * 0.9), other = L(w / 2, 0);
      shapes.push({ type: "line", x1: hinge.x, y1: hinge.y, x2: tip.x, y2: tip.y });
      shapes.push({ type: "arc", x1: tip.x, y1: tip.y, x2: other.x, y2: other.y, r: w, rot: angleDeg });
      break;
    }
    case "window": {
      [-1.5, 1.5].forEach((ly) => {
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
// Export 3D — GLTF minimal (boîtes positionnées/rotées, à embellir ensuite)
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
  a.href = url; a.download = `cuisine_${timestamp()}.gltf`;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// Export plan pro — SVG vectoriel, cotes + symboles, imprimable / éditable
// ---------------------------------------------------------------------------
function exportFloorPlanSVG(vertices, walls, items, roomArea, roomHeight) {
  const xs = vertices.map((v) => v.x), ys = vertices.map((v) => v.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const padOut = 120;
  const w = maxX - minX + padOut * 2;
  const h = maxY - minY + padOut * 2 + 80;
  const ox = -minX + padOut, oy = -minY + padOut;
  const tr = (p) => ({ x: p.x + ox, y: p.y + oy });

  let body = "";
  body += `<polygon points="${vertices.map((v) => { const p = tr(v); return `${p.x},${p.y}`; }).join(" ")}" fill="#fff" stroke="#111" stroke-width="6" stroke-linejoin="round"/>`;

  walls.forEach((wl) => {
    const A = tr(wl.A), B = tr(wl.B);
    const mx = (A.x + B.x) / 2, my = (A.y + B.y) / 2;
    const lx = mx + wl.normal.x * 22, ly = my + wl.normal.y * 22;
    body += `<text x="${lx}" y="${ly}" font-family="monospace" font-size="11" text-anchor="middle" fill="#111">${(wl.length / 100).toFixed(2)} m</text>`;
  });

  items.forEach((item) => {
    const isWall = item.catalogEntry.band === "wall";
    const isOpening = item.catalogEntry.band === "opening";
    const isWorktop = item.catalogEntry.band === "worktop";
    const shiftedItem = { ...item, centerX: item.centerX + ox, centerY: item.centerY + oy };
    if (isWorktop) {
      const d = roundedRectPathD(shiftedItem.centerX, shiftedItem.centerY, item.width, item.depth, item.u, item.v, item.radii);
      body += `<path d="${d}" fill="#e8dcc8" stroke="#111" stroke-width="1.2"/>`;
    } else {
      const corners = item.corners.map((c) => tr(c));
      const fill = isOpening ? "#fff" : isWall ? "none" : "#f4f6f8";
      body += `<polygon points="${corners.map((c) => `${c.x},${c.y}`).join(" ")}" fill="${fill}" stroke="#111" stroke-width="${isWall ? 0.8 : 1.2}" ${isWall ? 'stroke-dasharray="4,3"' : ""}/>`;
    }
    getSymbolShapes(shiftedItem).forEach((s) => { body += buildShapeElement(s); });
    if (item.width > 25 && !isOpening) {
      const c = tr({ x: item.centerX, y: item.centerY });
      body += `<text x="${c.x}" y="${c.y + 3}" font-family="monospace" font-size="8" text-anchor="middle" fill="#111">${item.catalogEntry.name}</text>`;
    }
  });

  const centroid = tr({ x: (minX + maxX) / 2, y: (minY + maxY) / 2 });
  body += `<text x="${centroid.x}" y="${centroid.y}" font-family="monospace" font-size="20" text-anchor="middle" fill="#111" font-weight="bold">${roomArea} m²</text>`;

  const now = new Date();
  body += `<g transform="translate(${padOut},${h - 60})">
    <line x1="0" y1="0" x2="${w - padOut * 2}" y2="0" stroke="#111" stroke-width="1"/>
    <text x="0" y="20" font-family="monospace" font-size="13" fill="#111" font-weight="bold">Cuisine — plan d'implantation</text>
    <text x="0" y="38" font-family="monospace" font-size="10" fill="#555">Cotes en mètres · hauteur sous plafond ${(roomHeight / 100).toFixed(2)} m · ${now.toLocaleDateString("fr-FR")} · document de travail, non contractuel</text>
  </g>`;

  const svg = `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">\n<rect x="0" y="0" width="${w}" height="${h}" fill="#ffffff"/>\n${body}\n</svg>`;

  const blob = new Blob([svg], { type: "image/svg+xml" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `plan_cuisine_${timestamp()}.svg`;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// Liste de matériel — CSV regroupé par article identique, prêt à chiffrer
// (colonnes prix unitaire / total laissées vides pour le devis)
// ---------------------------------------------------------------------------
function materialsCategory(catalogEntry) {
  if (catalogEntry.band === "worktop") return "Plan de travail";
  if (catalogEntry.band === "opening") return "Ouverture";
  if (catalogEntry.symbol && catalogEntry.band === "floor" && catalogEntry.name !== "Meuble bas") return "Électroménager";
  if (catalogEntry.band === "wall") return "Meuble haut";
  return "Meuble bas / rangement";
}
function csvCell(value) {
  const s = String(value ?? "");
  return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function exportMaterialsCSV(items) {
  const groups = {};
  const order = ["Meuble bas / rangement", "Meuble haut", "Électroménager", "Plan de travail", "Ouverture"];
  items.forEach((item) => {
    const category = materialsCategory(item.catalogEntry);
    const isWorktop = category === "Plan de travail";
    const key = `${category}|${item.catalogEntry.name}|${item.width}|${item.depth}|${item.catalogEntry.height}`;
    if (!groups[key]) {
      groups[key] = { category, name: item.catalogEntry.name, width: item.width, depth: item.depth, height: item.catalogEntry.height, qty: 0, isWorktop, locations: [] };
    }
    groups[key].qty += 1;
    if (!isWorktop && item.wallIndex != null) {
      const label = `Mur ${item.wallIndex + 1}`;
      if (!groups[key].locations.includes(label)) groups[key].locations.push(label);
    }
  });

  const rows = [["Catégorie", "Désignation", "Largeur (cm)", "Profondeur (cm)", "Hauteur (cm)", "Quantité", "Surface unitaire (m²)", "Emplacement", "Prix unitaire (€)", "Prix total (€)"]];
  Object.values(groups)
    .sort((a, b) => order.indexOf(a.category) - order.indexOf(b.category) || a.name.localeCompare(b.name))
    .forEach((g) => {
      const surface = g.isWorktop ? ((g.width * g.depth) / 10000).toFixed(2) : "";
      const location = g.isWorktop ? "Libre (îlot / extension)" : g.locations.join(", ");
      rows.push([g.category, g.name, g.width, g.depth, g.height, g.qty, surface, location, "", ""]);
    });

  const csv = rows.map((r) => r.map(csvCell).join(";")).join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
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
  const data = { format: "atelier-cuisine", version: 1, savedAt: new Date().toISOString(), ...state };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `cuisine_projet_${timestamp()}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// Persistance locale (localStorage) — plusieurs projets, chargement auto
// ---------------------------------------------------------------------------
const LS_PROJECTS = "atelier-cuisine-projects-v1";
const LS_ACTIVE = "atelier-cuisine-active-v1";

function makeBlankProject(name) {
  return {
    id: uid(), name, savedAt: new Date().toISOString(),
    vertices: DEFAULT_VERTICES, roomHeight: 240, placements: [], worktops: [], wallFlips: {},
  };
}
function loadStore() {
  try {
    const raw = localStorage.getItem(LS_PROJECTS);
    const projects = raw ? JSON.parse(raw) : {};
    const activeId = localStorage.getItem(LS_ACTIVE);
    return { projects, activeId };
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
    let list = projects && typeof projects === "object" ? projects : {};
    let active = activeId && list[activeId] ? list[activeId] : null;
    if (!active) {
      const ids = Object.keys(list);
      if (ids.length > 0) {
        active = list[ids[0]];
      } else {
        active = makeBlankProject("Cuisine 1");
        list = { ...list, [active.id]: active };
        persistProjects(list);
      }
    }
    persistActive(active.id);
    return { projects: list, project: active };
  });

  const [projects, setProjects] = useState(initData.projects);
  const [activeProjectId, setActiveProjectId] = useState(initData.project.id);
  const [vertices, setVertices] = useState(initData.project.vertices);
  const [roomHeight, setRoomHeight] = useState(initData.project.roomHeight);
  const [placements, setPlacements] = useState(initData.project.placements);
  const [worktops, setWorktops] = useState(initData.project.worktops);
  const [wallFlips, setWallFlips] = useState(initData.project.wallFlips);
  const [selectedUid, setSelectedUid] = useState(null);
  const [selectedWorktopUid, setSelectedWorktopUid] = useState(null);
  const [activeWallIndex, setActiveWallIndex] = useState(0);
  const [tab, setTab] = useState("room");
  const [rightTab, setRightTab] = useState("layout");
  const [importError, setImportError] = useState("");

  const containerRef = useRef(null);
  const svgRef = useRef(null);
  const three = useRef(null);
  const dragRef = useRef(null);
  const moduleDragRef = useRef(null);
  const worktopDragRef = useRef(null);
  const fileInputRef = useRef(null);
  const saveTimeoutRef = useRef(null);

  const walls = useMemo(() => {
    const orient = polygonOrientation(vertices);
    return vertices.map((A, i) => ({ index: i, ...wallGeom(A, vertices[(i + 1) % vertices.length], orient) }));
  }, [vertices]);
  const roomArea = useMemo(() => shoelaceAreaM2(vertices), [vertices]);

  const bandTotals = useMemo(() => {
    const t = {};
    placements.forEach((p) => {
      const entry = catalogById[p.catalogId];
      if (entry.insetFixture) return;
      const key = `${p.wallIndex}|${entry.band}`;
      t[key] = (t[key] || 0) + p.width;
    });
    return t;
  }, [placements]);

  const layout = useMemo(() => {
    return placements.map((p) => {
      const wallIndex = Math.min(p.wallIndex, walls.length - 1);
      const wall = walls[wallIndex];
      const entry = catalogById[p.catalogId];
      const flip = wallFlips[wallIndex] ? -1 : 1;
      const depth = p.depth ?? entry.defaultDepth;
      const centerAlong = p.offset + p.width / 2;
      const baseX = wall.A.x + wall.dir.x * centerAlong;
      const baseY = wall.A.y + wall.dir.y * centerAlong;
      const standoff = p.standoff || 0;
      const pushDist = depth / 2 + standoff;
      const centerX = baseX + wall.normal.x * flip * pushDist;
      const centerY = baseY + wall.normal.y * flip * pushDist;
      const halfW = p.width / 2, halfD = depth / 2;
      const u = wall.dir, v = { x: wall.normal.x * flip, y: wall.normal.y * flip };
      const corners = [
        { x: centerX - u.x * halfW - v.x * halfD, y: centerY - u.y * halfW - v.y * halfD },
        { x: centerX + u.x * halfW - v.x * halfD, y: centerY + u.y * halfW - v.y * halfD },
        { x: centerX + u.x * halfW + v.x * halfD, y: centerY + u.y * halfW + v.y * halfD },
        { x: centerX - u.x * halfW + v.x * halfD, y: centerY - u.y * halfW + v.y * halfD },
      ];
      const angleRad = -Math.atan2(wall.dir.y, wall.dir.x);
      return { ...p, standoff, depth, wallIndex, catalogEntry: entry, wall, centerX, centerY, corners, angleRad, u, v };
    });
  }, [placements, walls, wallFlips]);

  const worktopItems = useMemo(() => worktops.map((w) => {
    const rad = (w.angleDeg * Math.PI) / 180;
    const u = { x: Math.cos(rad), y: Math.sin(rad) };
    const v = { x: -Math.sin(rad), y: Math.cos(rad) };
    const halfW = w.width / 2, halfD = w.depth / 2;
    const corners = [
      { x: w.x - u.x * halfW - v.x * halfD, y: w.y - u.y * halfW - v.y * halfD },
      { x: w.x + u.x * halfW - v.x * halfD, y: w.y + u.y * halfW - v.y * halfD },
      { x: w.x + u.x * halfW + v.x * halfD, y: w.y + u.y * halfW + v.y * halfD },
      { x: w.x - u.x * halfW + v.x * halfD, y: w.y - u.y * halfW + v.y * halfD },
    ];
    return { ...w, u, v, corners, angleRad: -rad };
  }), [worktops]);

  const worktopAsSolids = useMemo(() => worktopItems.map((w) => ({
    uid: w.uid, width: w.width, depth: w.depth, radii: w.radii || [0, 0, 0, 0],
    catalogEntry: { name: "Plan de travail", color: "#c9a26a", depth: w.depth, height: 4, yOffset: 85, band: "worktop", symbol: null },
    centerX: w.x, centerY: w.y, corners: w.corners, angleRad: w.angleRad, u: w.u, v: w.v,
  })), [worktopItems]);

  const allSolids = useMemo(() => [...layout, ...worktopAsSolids], [layout, worktopAsSolids]);

  const overlapFlags = useMemo(() => {
    const flags = {};
    const byGroup = {};
    layout.filter((item) => !item.catalogEntry.insetFixture).forEach((item) => {
      const key = `${item.wallIndex}|${item.catalogEntry.band}`;
      (byGroup[key] = byGroup[key] || []).push(item);
    });
    Object.values(byGroup).forEach((group) => {
      for (let i = 0; i < group.length; i++) {
        for (let j = i + 1; j < group.length; j++) {
          const a = group[i], b = group[j];
          const alongOverlap = a.offset < b.offset + b.width && b.offset < a.offset + a.width;
          const depthOverlap = a.standoff < b.standoff + b.depth && b.standoff < a.standoff + a.depth;
          if (alongOverlap && depthOverlap) { flags[a.uid] = true; flags[b.uid] = true; }
        }
      }
    });
    return flags;
  }, [layout]);

  const bounds = useMemo(() => {
    const xs = vertices.map((v) => v.x), ys = vertices.map((v) => v.y);
    const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
    const p = 45;
    return { minX: minX - p, minY: minY - p, w: maxX - minX + 2 * p, h: maxY - minY + 2 * p };
  }, [vertices]);
  const centroid = useMemo(() => ({
    x: vertices.reduce((s, v) => s + v.x, 0) / vertices.length,
    y: vertices.reduce((s, v) => s + v.y, 0) / vertices.length,
  }), [vertices]);
  const polyPoints = vertices.map((v) => `${v.x},${v.y}`).join(" ");

  // --- init three.js (une seule fois) ---
  useEffect(() => {
    const container = containerRef.current;
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
      if (pointers.size === 1) {
        drag.active = true; drag.x = e.clientX; drag.y = e.clientY;
      } else if (pointers.size === 2) {
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
        if (pinchDist != null && dist > 0) {
          spherical.radius = Math.min(25, Math.max(1.5, spherical.radius * (pinchDist / dist)));
        }
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
      } else {
        drag.active = false;
      }
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
      const box = entry.contentRect;
      applySize(box.width, box.height);
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
      container.removeChild(renderer.domElement);
    };
  }, []);

  // --- reconstruire la pièce (sol + murs) quand le polygone change ---
  useEffect(() => {
    const t = three.current;
    if (!t) return;
    t.roomGroup.clear();
    const hM = roomHeight / 100;
    const shapePts = vertices.map((v) => new THREE.Vector2(v.x / 100, -(v.y / 100)));
    const shape = new THREE.Shape(shapePts);
    const floorGeo = new THREE.ShapeGeometry(shape);
    floorGeo.rotateX(-Math.PI / 2);
    t.roomGroup.add(new THREE.Mesh(floorGeo, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, side: THREE.DoubleSide })));

    const wallMat = new THREE.LineBasicMaterial({ color: 0x1f6f93, transparent: true, opacity: 0.7 });
    vertices.forEach((A, i) => {
      const B = vertices[(i + 1) % vertices.length];
      const pts = [
        new THREE.Vector3(A.x / 100, 0, A.y / 100), new THREE.Vector3(B.x / 100, 0, B.y / 100),
        new THREE.Vector3(B.x / 100, hM, B.y / 100), new THREE.Vector3(A.x / 100, hM, A.y / 100),
        new THREE.Vector3(A.x / 100, 0, A.y / 100),
      ];
      t.roomGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), wallMat));
    });

    const xs = vertices.map((v) => v.x), ys = vertices.map((v) => v.y);
    const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
    t.target.set((minX + maxX) / 2 / 100, hM / 3, (minY + maxY) / 2 / 100);
    t.spherical.radius = Math.max(maxX - minX, maxY - minY, 100) / 100 * 1.6 + 1;
    t.updateCamera();
  }, [vertices, roomHeight]);

  // --- reconstruire les solides (meubles + plans de travail) ---
  useEffect(() => {
    const t = three.current;
    if (!t) return;
    t.group.children.forEach((c) => { c.geometry?.dispose(); c.material?.dispose(); });
    t.group.clear();
    allSolids.forEach((item) => {
      const wM = item.width / 100, hM = item.catalogEntry.height / 100, dM = item.depth / 100;
      const geo = new THREE.BoxGeometry(wM, hM, dM);
      const mat = new THREE.MeshStandardMaterial({ color: item.catalogEntry.color, roughness: 0.8, metalness: 0.05 });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.rotation.y = item.angleRad;
      mesh.position.set(item.centerX / 100, item.catalogEntry.yOffset / 100 + hM / 2, item.centerY / 100);
      t.group.add(mesh);
    });
    t.updateCamera();
  }, [allSolids]);

  // --- édition du polygone ---
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
    setVertices((vs) => vs.map((v, idx) => (idx === dragRef.current ? snapped : v)));
  }
  function onVertexUp() {
    dragRef.current = null;
    window.removeEventListener("pointermove", onVertexMove);
    window.removeEventListener("pointerup", onVertexUp);
  }
  function addVertex() { setVertices((vs) => [...vs, { x: vs[vs.length - 1].x + 40, y: vs[vs.length - 1].y }]); }
  function removeVertex(i) { setVertices((vs) => (vs.length > 3 ? vs.filter((_, idx) => idx !== i) : vs)); }
  function updateVertex(i, axis, val) { setVertices((vs) => vs.map((v, idx) => (idx === i ? { ...v, [axis]: val } : v))); }

  // --- glisser un module le long de son mur ---
  function onModuleDown(item, e) {
    e.stopPropagation(); e.preventDefault();
    setSelectedUid(item.uid);
    moduleDragRef.current = { uid: item.uid, wall: item.wall, width: item.width };
    window.addEventListener("pointermove", onModuleMove);
    window.addEventListener("pointerup", onModuleUp);
  }
  function onModuleMove(e) {
    const d = moduleDragRef.current;
    if (!d) return;
    const p = clientToSvgPoint(e);
    if (!p) return;
    const proj = (p.x - d.wall.A.x) * d.wall.dir.x + (p.y - d.wall.A.y) * d.wall.dir.y;
    const newOffset = Math.max(0, Math.round(proj - d.width / 2));
    setPlacements((ps) => ps.map((pl) => (pl.uid === d.uid ? { ...pl, offset: newOffset } : pl)));
  }
  function onModuleUp() {
    moduleDragRef.current = null;
    window.removeEventListener("pointermove", onModuleMove);
    window.removeEventListener("pointerup", onModuleUp);
  }

  // --- glisser un plan de travail librement ---
  function onWorktopDown(item, e) {
    e.stopPropagation(); e.preventDefault();
    setSelectedWorktopUid(item.uid);
    const p = clientToSvgPoint(e);
    worktopDragRef.current = { uid: item.uid, startX: item.x, startY: item.y, pointerStart: p };
    window.addEventListener("pointermove", onWorktopMove);
    window.addEventListener("pointerup", onWorktopUp);
  }
  function onWorktopMove(e) {
    const d = worktopDragRef.current;
    if (!d) return;
    const p = clientToSvgPoint(e);
    if (!p) return;
    const dx = p.x - d.pointerStart.x, dy = p.y - d.pointerStart.y;
    updateWorktop(d.uid, { x: Math.round((d.startX + dx) / 5) * 5, y: Math.round((d.startY + dy) / 5) * 5 });
  }
  function onWorktopUp() {
    worktopDragRef.current = null;
    window.removeEventListener("pointermove", onWorktopMove);
    window.removeEventListener("pointerup", onWorktopUp);
  }

  // --- actions modules ---
  function addModule(catalogId) {
    const entry = catalogById[catalogId];
    const id = uid();
    let defaultOffset = 0;
    if (!entry.insetFixture) {
      const sameGroup = placements.filter((p) => p.wallIndex === activeWallIndex && catalogById[p.catalogId].band === entry.band);
      defaultOffset = sameGroup.length ? Math.max(...sameGroup.map((p) => p.offset + p.width)) : 0;
    }
    setPlacements((p) => [...p, { uid: id, catalogId, width: entry.defaultWidth, depth: entry.defaultDepth, wallIndex: activeWallIndex, offset: defaultOffset, standoff: 0 }]);
    setSelectedUid(id);
    setRightTab("layout");
  }
  function updateWidth(id, w) {
    setPlacements((p) => p.map((it) => {
      if (it.uid !== id) return it;
      const e = catalogById[it.catalogId];
      return { ...it, width: Math.min(e.widthMax, Math.max(e.widthMin, w)) };
    }));
  }
  function updateDepth(id, d) {
    setPlacements((p) => p.map((it) => {
      if (it.uid !== id) return it;
      const e = catalogById[it.catalogId];
      return { ...it, depth: Math.min(e.depthMax, Math.max(e.depthMin, d)) };
    }));
  }
  function updateOffset(id, val) { setPlacements((ps) => ps.map((p) => (p.uid === id ? { ...p, offset: Math.max(0, Math.round(val)) } : p))); }
  function updateStandoff(id, val) { setPlacements((ps) => ps.map((p) => (p.uid === id ? { ...p, standoff: Math.max(0, Math.round(val)) } : p))); }
  function removeModule(id) { setPlacements((p) => p.filter((it) => it.uid !== id)); if (selectedUid === id) setSelectedUid(null); }
  function reassignWall(id, newWallIndex) { setPlacements((ps) => ps.map((p) => (p.uid === id ? { ...p, wallIndex: newWallIndex, offset: 0, standoff: 0 } : p))); }

  // --- actions plans de travail ---
  function addWorktop() {
    const id = uid();
    setWorktops((ws) => [...ws, { uid: id, x: centroid.x, y: centroid.y, width: 200, depth: 60, angleDeg: 0, radii: [0, 0, 0, 0] }]);
    setSelectedWorktopUid(id);
    setRightTab("worktop");
  }
  function updateWorktop(id, patch) { setWorktops((ws) => ws.map((w) => (w.uid === id ? { ...w, ...patch } : w))); }
  function updateWorktopRadius(id, idx, val) {
    setWorktops((ws) => ws.map((w) => {
      if (w.uid !== id) return w;
      const radii = [...(w.radii || [0, 0, 0, 0])];
      radii[idx] = Math.max(0, Number(val) || 0);
      return { ...w, radii };
    }));
  }
  function removeWorktop(id) { setWorktops((ws) => ws.filter((w) => w.uid !== id)); if (selectedWorktopUid === id) setSelectedWorktopUid(null); }

  function resetAll() {
    setVertices(DEFAULT_VERTICES); setRoomHeight(240); setPlacements([]); setWorktops([]);
    setWallFlips({}); setActiveWallIndex(0); setSelectedUid(null); setSelectedWorktopUid(null);
  }

  // --- sauvegarde automatique locale (anti-rebond) du projet actif ---
  useEffect(() => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      setProjects((prev) => {
        const existing = prev[activeProjectId];
        if (!existing) return prev;
        const updated = { ...prev, [activeProjectId]: { ...existing, vertices, roomHeight, placements, worktops, wallFlips, savedAt: new Date().toISOString() } };
        persistProjects(updated);
        return updated;
      });
    }, 500);
    return () => clearTimeout(saveTimeoutRef.current);
  }, [vertices, roomHeight, placements, worktops, wallFlips, activeProjectId]);

  // --- gestion multi-projets ---
  function loadProjectState(p) {
    setVertices(p.vertices); setRoomHeight(p.roomHeight); setPlacements(p.placements);
    setWorktops(p.worktops); setWallFlips(p.wallFlips);
    setActiveWallIndex(0); setSelectedUid(null); setSelectedWorktopUid(null);
  }
  function switchProject(id) {
    const p = projects[id];
    if (!p || id === activeProjectId) return;
    setActiveProjectId(id);
    loadProjectState(p);
    persistActive(id);
  }
  function createNewProject() {
    const suggested = `Cuisine ${Object.keys(projects).length + 1}`;
    const name = (typeof window !== "undefined" ? window.prompt("Nom du nouveau projet", suggested) : suggested) || suggested;
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
    exportProjectJSON({ name: projects[activeProjectId]?.name, vertices, roomHeight, placements, worktops, wallFlips });
  }
  function triggerImport() { setImportError(""); fileInputRef.current?.click(); }
  function handleImportFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (!Array.isArray(data.vertices) || data.vertices.length < 3) throw new Error("bad-vertices");
        const suggested = data.name || file.name.replace(/\.json$/i, "") || "Projet importé";
        const name = window.prompt("Nom du projet importé", suggested) || suggested;
        const p = {
          id: uid(), name, savedAt: new Date().toISOString(),
          vertices: data.vertices,
          roomHeight: typeof data.roomHeight === "number" ? data.roomHeight : 240,
          placements: Array.isArray(data.placements) ? data.placements : [],
          worktops: Array.isArray(data.worktops) ? data.worktops : [],
          wallFlips: data.wallFlips && typeof data.wallFlips === "object" ? data.wallFlips : {},
        };
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

  return (
    <div className="app">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600&display=swap');
        * { box-sizing: border-box; }
        .app { font-family: 'IBM Plex Sans', sans-serif; background:#eef1f4; color:#1d2733; display:flex; flex-direction:column; height:100%; min-height:760px; }
        .header { display:flex; align-items:center; justify-content:space-between; padding:14px 18px; border-bottom:1px solid #d7dde3; background:#ffffff; flex-wrap:wrap; gap:8px; }
        .header h1 { font-size:15px; letter-spacing:.04em; text-transform:uppercase; font-weight:600; margin:0; color:#1d2733; }
        .header .sub { font-family:'IBM Plex Mono',monospace; font-size:11px; color:#1f6f93; margin-top:2px; }
        .project-bar { display:flex; align-items:center; gap:8px; padding:8px 18px; background:#f7f9fa; border-bottom:1px solid #d7dde3; flex-wrap:wrap; }
        .project-bar label { font-family:'IBM Plex Mono',monospace; font-size:10px; text-transform:uppercase; letter-spacing:.05em; color:#6b7789; }
        .project-bar .select { width:auto; min-width:160px; }
        .autosave-hint { font-family:'IBM Plex Mono',monospace; font-size:10px; color:#8b96a3; margin-left:auto; }
        .btn { font-family:'IBM Plex Mono',monospace; font-size:12px; background:#f3f5f7; color:#1d2733; border:1px solid #c7d0d9; padding:7px 10px; border-radius:3px; cursor:pointer; }
        .btn:hover { border-color:#1f6f93; color:#1f6f93; }
        .btn:disabled { opacity:.4; cursor:default; }
        .btn.primary { background:#e2711d; color:#fff; border-color:#e2711d; font-weight:600; }
        .btn.primary:hover { background:#c95f13; border-color:#c95f13; color:#fff; }
        .body { display:flex; flex:1; min-height:0; }
        .sidebar { width:310px; border-right:1px solid #d7dde3; background:#ffffff; display:flex; flex-direction:column; }
        .sidebar-right { width:310px; border-left:1px solid #d7dde3; background:#ffffff; display:flex; flex-direction:column; }
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
        .vertex-row { display:flex; align-items:center; gap:6px; margin-bottom:6px; }
        .vertex-row .vlabel { width:26px; font-family:'IBM Plex Mono',monospace; font-size:10px; color:#6b7789; }
        .vertex-row input { width:100%; background:#ffffff; border:1px solid #c7d0d9; color:#1d2733; padding:5px 6px; border-radius:3px; font-family:'IBM Plex Mono',monospace; font-size:11px; }
        .wall-row { display:flex; align-items:center; justify-content:space-between; border:1px solid #d7dde3; border-radius:4px; padding:8px 10px; margin-bottom:6px; cursor:pointer; }
        .wall-row.active { border-color:#e2711d; background:#fff1e2; }
        .wname { font-size:12px; }
        .wlen { font-family:'IBM Plex Mono',monospace; font-size:10px; color:#6b7789; margin-top:2px; }
        .catalog-item { border:1px solid #d7dde3; border-radius:4px; padding:10px; margin-bottom:8px; display:flex; align-items:center; gap:10px; }
        .swatch { width:14px; height:14px; border-radius:2px; flex-shrink:0; border:1px solid #b9c2cc; }
        .catalog-item .meta { flex:1; }
        .catalog-item .name { font-size:12px; font-weight:500; }
        .catalog-item .dims { font-family:'IBM Plex Mono',monospace; font-size:10px; color:#6b7789; margin-top:2px; }
        .group-header { font-family:'IBM Plex Mono',monospace; font-size:10px; text-transform:uppercase; letter-spacing:.05em; color:#1f6f93; margin-bottom:8px; }
        .layout-row { border:1px solid #d7dde3; border-radius:4px; padding:8px 10px; margin-bottom:6px; cursor:pointer; }
        .layout-row.selected { border-color:#e2711d; background:#fff1e2; }
        .layout-row .top { display:flex; justify-content:space-between; align-items:center; }
        .layout-row .name { font-size:12px; }
        .layout-row .w { font-family:'IBM Plex Mono',monospace; font-size:11px; color:#1f6f93; }
        .row-actions { display:flex; gap:4px; margin-top:8px; align-items:center; flex-wrap:wrap; }
        .row-actions button { font-size:11px; padding:3px 7px; }
        .warning { background:#fdeaea; border:1px solid #d64545; color:#8a2020; font-family:'IBM Plex Mono',monospace; font-size:11px; padding:6px 8px; border-radius:3px; margin-bottom:8px; }
        .main { flex:1; display:flex; flex-direction:column; min-width:0; background:#ffffff; }
        .editor2d-wrap { flex:1; min-height:280px; border-bottom:1px solid #d7dde3; padding:6px; }
        .viewer3d-wrap { height:320px; }
        .viewer3d-wrap > div { width:100%; height:100%; cursor:grab; touch-action:none; }
        .dim-text { font-family:'IBM Plex Mono',monospace; fill:#1f6f93; }
        .footer-hint { font-family:'IBM Plex Mono',monospace; font-size:10px; color:#6b7789; padding:8px 12px; border-bottom:1px solid #d7dde3; }
        .empty { color:#8b96a3; font-size:12px; padding:20px 0; text-align:center; }
        .radii-grid { display:grid; grid-template-columns:1fr 1fr; gap:6px; }
        .radii-grid label { grid-column:1 / -1; }

        @media (max-width: 860px) {
          .project-bar { padding: 8px 12px; }
          .autosave-hint { display: none; }
          .app { min-height: 100vh; height: auto; }
          .body { flex-direction: column; }
          .sidebar { width: 100%; max-height: 42vh; min-height: 0; overflow: hidden; border-right: none; border-bottom: 1px solid #d7dde3; }
          .sidebar-right { width: 100%; max-height: 42vh; min-height: 0; overflow: hidden; border-left: none; border-top: 1px solid #d7dde3; }
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
          <h1>Atelier Cuisine</h1>
          <div className="sub">prototype paramétrique — v0.6 · thème clair, projet réimportable</div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input ref={fileInputRef} type="file" accept="application/json" style={{ display: "none" }} onChange={handleImportFile} />
          <button className="btn" onClick={triggerImport}>Importer un projet</button>
          <button className="btn" onClick={resetAll}>Réinitialiser</button>
          <button className="btn" onClick={handleExportProject}>Exporter projet (JSON)</button>
          <button className="btn" onClick={() => exportMaterialsCSV(allSolids)} disabled={allSolids.length === 0}>Liste de matériel (CSV)</button>
          <button className="btn" onClick={() => exportFloorPlanSVG(vertices, walls, allSolids, roomArea, roomHeight)}>Plan pro (SVG)</button>
          <button className="btn primary" onClick={() => exportGLTF(allSolids)} disabled={allSolids.length === 0}>Export 3D (GLTF)</button>
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

          {tab === "room" && (
            <div className="panel">
              <div className="field">
                <label>Hauteur sous plafond (cm)</label>
                <input type="number" value={roomHeight} onChange={(e) => setRoomHeight(Number(e.target.value) || 0)} />
              </div>
              <div className="field"><label>Surface</label><div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 13 }}>{roomArea} m²</div></div>

              <div className="section-label">Sommets du polygone</div>
              {vertices.map((v, i) => (
                <div className="vertex-row" key={i}>
                  <span className="vlabel">P{i + 1}</span>
                  <input type="number" value={v.x} onChange={(e) => updateVertex(i, "x", Number(e.target.value) || 0)} />
                  <input type="number" value={v.y} onChange={(e) => updateVertex(i, "y", Number(e.target.value) || 0)} />
                  <button className="btn" onClick={() => removeVertex(i)} disabled={vertices.length <= 3}>×</button>
                </div>
              ))}
              <button className="btn" style={{ width: "100%", marginTop: 4 }} onClick={addVertex}>+ Ajouter un sommet</button>

              <div className="section-label" style={{ marginTop: 16 }}>Murs</div>
              {walls.map((w) => {
                const floorT = bandTotals[`${w.index}|floor`] || 0;
                const wallT = bandTotals[`${w.index}|wall`] || 0;
                const over = floorT > w.length || wallT > w.length;
                return (
                  <div key={w.index} className={`wall-row ${activeWallIndex === w.index ? "active" : ""}`} onClick={() => setActiveWallIndex(w.index)}>
                    <div>
                      <div className="wname">Mur {w.index + 1}</div>
                      <div className="wlen" style={over ? { color: "#c23434" } : undefined}>{w.length} cm{over ? " — dépassement" : ""}</div>
                    </div>
                    <button className="btn" onClick={(e) => { e.stopPropagation(); setWallFlips((f) => ({ ...f, [w.index]: !f[w.index] })); }}>Retourner</button>
                  </div>
                );
              })}
            </div>
          )}

          {tab === "catalog" && (
            <div className="panel">
              <div className="field">
                <label>Mur actif (les ajouts s'y placent)</label>
                <select className="select" value={activeWallIndex} onChange={(e) => setActiveWallIndex(Number(e.target.value))}>
                  {walls.map((w) => <option key={w.index} value={w.index}>Mur {w.index + 1} ({w.length} cm)</option>)}
                </select>
              </div>
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
                      <button className="btn" onClick={() => addModule(c.id)}>+</button>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}

        </div>

        <div className="sidebar-right">
          <div className="tabs">
            <button className={`tab ${rightTab === "layout" ? "active" : ""}`} onClick={() => setRightTab("layout")}>Disposition</button>
            <button className={`tab ${rightTab === "worktop" ? "active" : ""}`} onClick={() => setRightTab("worktop")}>Plans</button>
          </div>

          {rightTab === "layout" && (
            <div className="panel">
              {placements.length === 0 && <div className="empty">Aucun élément. Ajoute-en depuis le catalogue.</div>}
              {walls.map((w) => {
                const bands = ["floor", "wall", "opening"];
                const groups = bands.map((b) => ({ b, items: layout.filter((it) => it.wallIndex === w.index && it.catalogEntry.band === b) })).filter((g) => g.items.length);
                if (groups.length === 0) return null;
                return (
                  <div key={w.index} style={{ marginBottom: 18 }}>
                    <div className="section-label">Mur {w.index + 1}</div>
                    {groups.map(({ b, items }) => {
                      const total = bandTotals[`${w.index}|${b}`] || 0;
                      const over = b !== "opening" && total > w.length;
                      return (
                        <div key={b} style={{ marginBottom: 10 }}>
                          <div className="group-header">{BAND_LABEL[b]}{b !== "opening" ? ` — ${total}/${w.length} cm` : ""}</div>
                          {over && <div className="warning">Dépassement sur ce mur</div>}
                          {items.map((item) => {
                            const e = item.catalogEntry;
                            const bad = overlapFlags[item.uid];
                            return (
                              <div key={item.uid} className={`layout-row ${selectedUid === item.uid ? "selected" : ""}`} onClick={() => setSelectedUid(item.uid)}>
                                <div className="top">
                                  <span className="name">{e.name}{bad ? " ⚠" : ""}</span>
                                  <span className="w">{item.width}×{item.depth} cm</span>
                                </div>
                                {e.widthMin !== e.widthMax && (
                                  <div className="field" style={{ margin: "6px 0 0" }}>
                                    <label>Largeur : {item.width} cm</label>
                                    <input type="range" min={e.widthMin} max={e.widthMax} step={e.widthStep} value={item.width}
                                      onChange={(ev) => updateWidth(item.uid, Number(ev.target.value))} onClick={(ev) => ev.stopPropagation()} />
                                  </div>
                                )}
                                {e.depthMin !== e.depthMax && (
                                  <div className="field" style={{ margin: "6px 0 0" }}>
                                    <label>Profondeur : {item.depth} cm</label>
                                    <input type="range" min={e.depthMin} max={e.depthMax} step={e.depthStep} value={item.depth}
                                      onChange={(ev) => updateDepth(item.uid, Number(ev.target.value))} onClick={(ev) => ev.stopPropagation()} />
                                  </div>
                                )}
                                <div className="field" style={{ margin: "8px 0 0" }}>
                                  <label>Position depuis le début du mur (cm)</label>
                                  <div style={{ display: "flex", gap: 4 }}>
                                    <button className="btn" onClick={(ev) => { ev.stopPropagation(); updateOffset(item.uid, item.offset - 5); }}>−5</button>
                                    <input type="number" value={item.offset} onClick={(ev) => ev.stopPropagation()} onChange={(ev) => updateOffset(item.uid, Number(ev.target.value) || 0)} />
                                    <button className="btn" onClick={(ev) => { ev.stopPropagation(); updateOffset(item.uid, item.offset + 5); }}>+5</button>
                                  </div>
                                </div>
                                {b !== "opening" && (
                                  <div className="field" style={{ margin: "8px 0 0" }}>
                                    <label>Distance du mur (cm)</label>
                                    <div style={{ display: "flex", gap: 4 }}>
                                      <button className="btn" onClick={(ev) => { ev.stopPropagation(); updateStandoff(item.uid, item.standoff - 5); }}>−5</button>
                                      <input type="number" value={item.standoff} onClick={(ev) => ev.stopPropagation()} onChange={(ev) => updateStandoff(item.uid, Number(ev.target.value) || 0)} />
                                      <button className="btn" onClick={(ev) => { ev.stopPropagation(); updateStandoff(item.uid, item.standoff + 5); }}>+5</button>
                                    </div>
                                    <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
                                      <button className="btn" onClick={(ev) => { ev.stopPropagation(); updateStandoff(item.uid, 0); }}>Contre le mur</button>
                                      <button className="btn" onClick={(ev) => { ev.stopPropagation(); updateStandoff(item.uid, 60); }}>60 cm</button>
                                    </div>
                                  </div>
                                )}
                                <div className="row-actions">
                                  <select className="select small" value={item.wallIndex} onClick={(ev) => ev.stopPropagation()} onChange={(ev) => reassignWall(item.uid, Number(ev.target.value))}>
                                    {walls.map((w2) => <option key={w2.index} value={w2.index}>Mur {w2.index + 1}</option>)}
                                  </select>
                                  <button className="btn" onClick={(ev) => { ev.stopPropagation(); removeModule(item.uid); }}>Suppr.</button>
                                </div>
                                {bad && <div className="warning" style={{ marginTop: 6 }}>Chevauche un autre élément de ce groupe</div>}
                              </div>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}

          {rightTab === "worktop" && (
            <div className="panel">
              <button className="btn" style={{ width: "100%", marginBottom: 12 }} onClick={addWorktop}>+ Ajouter un plan de travail</button>
              {worktops.length === 0 && <div className="empty">Aucun plan de travail. Il se place n'importe où dans la pièce, indépendamment des meubles — utile pour un îlot ou une extension de plan.</div>}
              {worktopItems.map((item) => (
                <div key={item.uid} className={`layout-row ${selectedWorktopUid === item.uid ? "selected" : ""}`} onClick={() => setSelectedWorktopUid(item.uid)}>
                  <div className="top"><span className="name">Plan de travail</span><span className="w">{item.width}×{item.depth} cm</span></div>
                  <div className="field" style={{ margin: "8px 0 0" }}>
                    <label>Position X / Y (cm)</label>
                    <div style={{ display: "flex", gap: 4 }}>
                      <input type="number" value={item.x} onClick={(ev) => ev.stopPropagation()} onChange={(ev) => updateWorktop(item.uid, { x: Number(ev.target.value) || 0 })} />
                      <input type="number" value={item.y} onClick={(ev) => ev.stopPropagation()} onChange={(ev) => updateWorktop(item.uid, { y: Number(ev.target.value) || 0 })} />
                    </div>
                  </div>
                  <div className="field" style={{ margin: "8px 0 0" }}>
                    <label>Largeur / Profondeur (cm)</label>
                    <div style={{ display: "flex", gap: 4 }}>
                      <input type="number" value={item.width} onClick={(ev) => ev.stopPropagation()} onChange={(ev) => updateWorktop(item.uid, { width: Math.max(10, Number(ev.target.value) || 10) })} />
                      <input type="number" value={item.depth} onClick={(ev) => ev.stopPropagation()} onChange={(ev) => updateWorktop(item.uid, { depth: Math.max(10, Number(ev.target.value) || 10) })} />
                    </div>
                  </div>
                  <div className="field" style={{ margin: "8px 0 0" }}>
                    <label>Angle (°)</label>
                    <input type="number" value={item.angleDeg} onClick={(ev) => ev.stopPropagation()} onChange={(ev) => updateWorktop(item.uid, { angleDeg: Number(ev.target.value) || 0 })} />
                  </div>
                  <div className="field radii-grid" style={{ margin: "8px 0 0" }}>
                    <label>Rayon des coins (cm) — 0 = angle vif</label>
                    {[0, 1, 2, 3].map((idx) => (
                      <input key={idx} type="number" value={(item.radii || [0, 0, 0, 0])[idx]} placeholder={`Coin ${idx + 1}`}
                        onClick={(ev) => ev.stopPropagation()} onChange={(ev) => updateWorktopRadius(item.uid, idx, ev.target.value)} />
                    ))}
                  </div>
                  <div className="row-actions">
                    <button className="btn" onClick={(ev) => { ev.stopPropagation(); removeWorktop(item.uid); }}>Supprimer</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="main">
          <div className="footer-hint">Points ambre = sommets · meubles = glisser le long du mur · plans de travail = glisser librement</div>
          <div className="editor2d-wrap">
            <svg ref={svgRef} viewBox={`${bounds.minX} ${bounds.minY} ${bounds.w} ${bounds.h}`} width="100%" height="100%" preserveAspectRatio="xMidYMid meet" style={{ touchAction: "none" }}>
              <defs>
                <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
                  <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#e3e7ec" strokeWidth="0.5" />
                </pattern>
              </defs>
              <rect x={bounds.minX} y={bounds.minY} width={bounds.w} height={bounds.h} fill="#ffffff" />
              <polygon points={polyPoints} fill="url(#grid)" stroke="none" />
              <text x={centroid.x} y={centroid.y} textAnchor="middle" className="dim-text" fontSize="14" fontWeight="600">{roomArea} m²</text>

              {walls.map((w) => {
                const floorT = bandTotals[`${w.index}|floor`] || 0;
                const wallT = bandTotals[`${w.index}|wall`] || 0;
                const over = floorT > w.length || wallT > w.length;
                const isActive = activeWallIndex === w.index;
                const midX = (w.A.x + w.B.x) / 2, midY = (w.A.y + w.B.y) / 2;
                const lx = midX + w.normal.x * 14, ly = midY + w.normal.y * 14;
                return (
                  <g key={w.index}>
                    <line x1={w.A.x} y1={w.A.y} x2={w.B.x} y2={w.B.y}
                      stroke={over ? "#d64545" : isActive ? "#e2711d" : "#1f6f93"}
                      strokeWidth={isActive ? 2.4 : 1.4} vectorEffect="non-scaling-stroke"
                      style={{ cursor: "pointer" }}
                      onPointerDown={(e) => { e.stopPropagation(); setActiveWallIndex(w.index); }} />
                    <text x={lx} y={ly} textAnchor="middle" className="dim-text" fontSize="7">{w.length}</text>
                  </g>
                );
              })}

              {layout.map((item) => {
                const bad = overlapFlags[item.uid];
                const selected = selectedUid === item.uid;
                const band = item.catalogEntry.band;
                const opacity = selected ? 1 : band === "wall" ? 0.35 : band === "opening" ? 0.6 : 0.9;
                const dash = band === "wall" && !selected ? "4,3" : undefined;
                const stroke = selected ? "#e2711d" : bad ? "#d64545" : "#1d2733";
                const pts = item.corners.map((c) => `${c.x},${c.y}`).join(" ");
                return (
                  <g key={item.uid} onPointerDown={(e) => onModuleDown(item, e)} style={{ cursor: "grab" }}>
                    {selected && (
                      <polygon points={pts} fill="none" stroke="#e2711d" strokeWidth={8} strokeOpacity={0.4} vectorEffect="non-scaling-stroke" />
                    )}
                    <polygon points={pts}
                      fill={item.catalogEntry.color} opacity={opacity}
                      stroke={stroke} strokeWidth={selected ? 2.6 : bad ? 1.6 : 0.7}
                      strokeDasharray={dash} vectorEffect="non-scaling-stroke" />
                    <SymbolShapes item={item} />
                  </g>
                );
              })}

              {worktopItems.map((item) => {
                const selected = selectedWorktopUid === item.uid;
                const d = roundedRectPathD(item.x, item.y, item.width, item.depth, item.u, item.v, item.radii);
                return (
                  <g key={item.uid} onPointerDown={(e) => onWorktopDown(item, e)} style={{ cursor: "move" }}>
                    {selected && <path d={d} fill="none" stroke="#e2711d" strokeWidth={8} strokeOpacity={0.4} vectorEffect="non-scaling-stroke" />}
                    <path d={d}
                      fill="#c9a26a" opacity={selected ? 0.9 : 0.6}
                      stroke={selected ? "#e2711d" : "#8a6a3d"} strokeWidth={selected ? 2.6 : 0.8}
                      vectorEffect="non-scaling-stroke" />
                  </g>
                );
              })}

              {vertices.map((v, i) => (
                <g key={i}>
                  <circle cx={v.x} cy={v.y} r={16} fill="transparent" style={{ cursor: "grab" }} onPointerDown={(e) => onVertexDown(i, e)} />
                  <circle cx={v.x} cy={v.y} r={7} fill="#ffffff" stroke="#e2711d" strokeWidth={2} vectorEffect="non-scaling-stroke" pointerEvents="none" />
                </g>
              ))}
            </svg>
          </div>
          <div className="section-label" style={{ padding: "8px 12px", borderBottom: "1px solid #d7dde3" }}>Vue 3D — glisser pour orbiter, molette pour zoomer</div>
          <div className="viewer3d-wrap"><div ref={containerRef} /></div>
        </div>
      </div>
    </div>
  );
}
