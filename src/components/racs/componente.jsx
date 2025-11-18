import React, { useState } from "react";
import data from "./datos.json";
import "./diagram.css";

export default function RackDiagram() {
  const {
    racks,
    routers,
    fortinet,
    mikrotik,
    ups,
    servidores,
    qnap,
    cables,
    linea_tension
  } = data;

  const [hoverCable, setHoverCable] = useState(null);
const [hoverInfo, setHoverInfo] = useState(null);
  // ---------------------------
  // POSICIÓN UPS SIEMPRE ABAJO
  // ---------------------------
function getUpsCoords(upsItem, index, rack) {
  const bottomPadding = 20;

  const upsHeight = 60;
  const separacionVertical = 10;

  const yBase =
    rack.posY +
    rack.height -
    bottomPadding -
    upsHeight -
    index * (upsHeight + separacionVertical);

  return {
    x: rack.posX + 20,
    y: yBase,
  };
}

  // ---------------------------
  // Equipos ordenados por slot
  // ---------------------------
const equipos = [
  ...routers,
  ...fortinet,
  ...mikrotik,
  ...ups,
  ...servidores,
  ...qnap,
  ...linea_tension   // ⬅️ nuevo
]
    .filter((e) => e.rack_id !== null)
    .map((e) => ({ ...e }));

  const equiposConSlot = racks.flatMap((rack) => {
    const eqRack = equipos
      .filter((e) => e.rack_id === rack.id)
      .sort((a, b) => (a.prioridad ?? 100) - (b.prioridad ?? 100));

    return eqRack.map((e, index) => ({
      ...e,
      slot: index + 1,
    }));
  });

  // ---------------------------
  // Rack positions
  // ---------------------------
 const racksPerRow = 3;     // <= 3 racks por fila
const rackWidth = 350;     // separación horizontal
const rackHeight = 700;    // separación vertical (rack + espacio)
const RACK_WIDTH = 260;
const RACK_BIG_HEIGHT = 600;
const RACK_SMALL_HEIGHT = RACK_BIG_HEIGHT * 0.4;

const COLS = 3;           // número fijo de columnas
const GAP_X = 120;        // separación horizontal
const GAP_Y = 80;         // separación vertical

// agrupar racks en filas de 3
const rackRows = [];
for (let i = 0; i < racks.length; i += COLS) {
  rackRows.push(racks.slice(i, i + COLS));
}

const rackPositions = [];

rackRows.forEach((row, rowIndex) => {
  // ancho total ocupado por la fila
  const rowWidth =
    row.length * RACK_WIDTH + (row.length - 1) * GAP_X;

  // centrar la fila en un SVG de 1800px
  const offsetX = (1800 - rowWidth) / 2;

  row.forEach((rack, colIndex) => {
    const x = offsetX + colIndex * (RACK_WIDTH + GAP_X);

    // tamaño dinámico
    const height =
      rack.tamanio === "chico"
        ? RACK_SMALL_HEIGHT
        : RACK_BIG_HEIGHT;

    // posición vertical
    const y = 40 + rowIndex * (RACK_BIG_HEIGHT + GAP_Y);

    rackPositions.push({
      ...rack,
      posX: x,
      posY: y,
      height,
    });
  });
});


  // ---------------------------
  // Equipos normales
  // ---------------------------
const getCoords = (equipo) => {
  const rack = rackPositions.find((r) => r.id === equipo.rack_id);

  return {
    x: rack.posX + 20,
    y: rack.posY + 40 + (equipo.slot - 1) * 32,
  };
};

  // ---------------------------
  // UPS con posiciones reales
  // ---------------------------
  const upsPositions = rackPositions.flatMap((rack) => {
    const upsDeRack = equiposConSlot.filter(
      (e) => e.tipo === "ups" && e.rack_id === rack.id
    );

    return upsDeRack.map((upsItem, index) => {
      const { x, y } = getUpsCoords(upsItem, index, rack);
      return {
        ...upsItem,
        tipo: "ups",
        x,
        y,
        isUPS: true,
      };
    });
  });

  // ---------------------------
  // Equipos globales
  // ---------------------------
  const equiposGlobal = [
    ...equiposConSlot
      .filter((e) => e.tipo !== "ups")
      .map((e) => ({
        ...e,
        ...getCoords(e),
        isUPS: false,
      })),
    ...upsPositions,
  ];

  // ============================================================
  // AGRUPAR CABLES POR ORIGEN Y ASIGNAR OFFSET
  // ============================================================
  const cableGroups = {};
  cables.forEach((c) => {
    const key = `${c.origen_tipo}-${c.origen_id}`;
    if (!cableGroups[key]) cableGroups[key] = [];
    cableGroups[key].push(c);
  });

 const cableOffsets = {};

cables.forEach((cable) => {
  const key = `${cable.origen_tipo}-${cable.origen_id}`;

  if (!cableOffsets[key]) {
    cableOffsets[key] = {};
  }

  const color = getCableColor(cable);;

  // Si el color ya tiene offset asignado, se usa el mismo (se superponen)
  if (cableOffsets[key][color] !== undefined) {
    cable.offset = cableOffsets[key][color];
  } else {
    // Nuevo color → siguiente carril
    const countColors = Object.keys(cableOffsets[key]).length;
    const newOffset = countColors * 15; // distancia entre colores
    cableOffsets[key][color] = newOffset;
    cable.offset = newOffset;
  }
});
  Object.entries(cableGroups).forEach(([key, group]) => {
    group.forEach((cable, index) => {
      cableOffsets[cable.id] = index * 20;
    });
  });

  // ============================================================
  // FUNCIÓN DE CURVA (BÉZIER SUAVE)
  // ============================================================
  const curvedPath = (p1, p2, offsetX, safeY) => {
    const midX1 = p1.x + offsetX;
    const midX2 = p2.x - offsetX;

    return `
      M ${p1.x} ${p1.y}
      C ${midX1} ${p1.y}, ${midX1} ${safeY}, ${midX1} ${safeY}
      C ${midX1} ${safeY}, ${midX2} ${safeY}, ${midX2} ${safeY}
      C ${midX2} ${safeY}, ${midX2} ${p2.y}, ${p2.x} ${p2.y}
    `;
  };
function getCableColor(cable) {
  const o = cable.origen_tipo?.toLowerCase();
  const d = cable.destino_tipo?.toLowerCase();
  const key = `${o}-${d}`;

  return cableColorsMap[key] || cableColorsMap.default;
}
function getCableColor(cable) {
  const o = cable.origen_tipo?.toLowerCase();
  const d = cable.destino_tipo?.toLowerCase();

  // PRIORIDAD 1 — Línea de tensión → NEGRO
  if (o === "linea_tension" || d === "linea_tension") return "#cd840eff";

  // PRIORIDAD 2 — UPS → NARANJA
  if (o === "ups" || d === "ups") return "#ff9900";

  // PRIORIDAD 3 — QNAP → CIAN
  if (o === "qnap" || d === "qnap") return "#00c3ff";

  // Si el cable trae un color específico
  if (cable.color) return cable.color;

  // Fallback → blanco
  return "#ffffff";
}




function getCablesSameLane(cable, allCables) {
  return allCables.filter(c => {
    // mismo equipo de origen
    const sameOrigin = 
      c.origen_tipo === cable.origen_tipo &&
      c.origen_id === cable.origen_id;

    // mismo carril (offset igual)
    const sameOffset = c.offset === cable.offset;

    return sameOrigin && sameOffset;
  });
}





return (
  <div className="diagram-wrapper">
    {/* PANEL A LA IZQUIERDA (o abajo en mobile) */}
    <div className="conexiones-panel">
      <h3>Conexiones</h3>
      <ul style={{ paddingLeft: 16 }}>
        {[...cables]
          .sort((a, b) => a.label.localeCompare(b.label))
          .map((c) => (
            <li key={c.id}>{c.label}</li>
          ))}
      </ul>
    </div>

    {/* SVG PRINCIPAL */}
    <svg width="1800" height="1400" className="diagram-svg"   
    onMouseMove={(e) => {
    if (hoverInfo) {
      let newX = e.clientX + 25;
      let newY = e.clientY + 25;

      const maxX = window.innerWidth - 250;

      if (newX > maxX) newX = e.clientX - 250;

      setHoverInfo({ x: newX, y: newY });
    }
  }}>
      {/* RACKS */}
      {racks.map(() => {}) /* tus racks ya los tenés, solo ilustración */}

      {rackPositions.map((rack) => (
        <g key={rack.id} className="rack">
          <rect
            className="rack-rect"
            x={rack.posX}
            y={rack.posY}
            width={260}
            height={rack.height}
            rx="14"
          />
          <text
            className="rack-title"
            x={rack.posX + 130}
            y={rack.posY + 25}
          >
            {rack.nombre}
          </text>
        </g>
      ))}

      {/* EQUIPOS */}
      {equiposGlobal.map((eq) => {
        const width = eq.tipo === "ups" ? 80 : 240;
        const height = eq.tipo === "ups" ? 60 : 28;

        return (
          <g key={eq.id} className={`equipo equipo-${eq.tipo}`}>
            <rect
              className="equipo-rect"
              x={eq.x}
              y={eq.y}
              width={width}
              height={height}
              rx={eq.tipo === "ups" ? 10 : 4}
            />

            <text
              className="equipo-label"
              x={eq.x + width / 2}
              y={eq.y + height / 2 + 4}
            >
              {eq.nombre}
            </text>
          </g>
        );
      })}

      {/* CABLES */}
      {cables.map((cable) => {
        const origenTipo = cable.origen_tipo?.toLowerCase();
        const destinoTipo = cable.destino_tipo?.toLowerCase();

        const origen = equiposGlobal.find(
          (e) => e.tipo === origenTipo && e.id === cable.origen_id
        );
        const destino = equiposGlobal.find(
          (e) => e.tipo === destinoTipo && e.id === cable.destino_id
        );

        if (!origen || !destino) return null;

        const offsetLateral = 18;
        const offsetVertical = 8;

        const p1 = {
          x: origen.isUPS ? origen.x + 80 : origen.x + 240,
          y: origen.y + offsetVertical,
        };

        const p1_out = {
          x: p1.x + offsetLateral,
          y: p1.y,
        };

        const p2 = {
          x: destino.isUPS ? destino.x : destino.x,
          y: destino.y + offsetVertical,
        };

        const p2_in = {
          x: p2.x - offsetLateral,
          y: p2.y,
        };

        const safeY =
          Math.max(p1.y + 80, p2.y + 80, 720) + cable.offset;

        const path = `
          M ${p1.x} ${p1.y}
          L ${p1_out.x} ${p1_out.y}
          L ${p1_out.x} ${safeY}
          L ${p2_in.x} ${safeY}
          L ${p2_in.x} ${p2_in.y}
          L ${p2.x} ${p2.y}
        `;

        const sameLane = getCablesSameLane(cable, cables);

        return (
          <g
            key={cable.id}
           onMouseEnter={(e) => {
  setHoverCable({ main: cable, group: sameLane });

  setHoverInfo({
    x: e.clientX + 20,
    y: e.clientY + 20,
  });
}}
            onMouseLeave={() => {
  setHoverCable(null);
  setHoverInfo(null);
}}
          >
            <path
              d={path}
              stroke={getCableColor(cable)}
              strokeWidth="3"
              fill="none"
              className={hoverCable?.main?.id === cable.id ? "cable-hover" : ""}
            />
            <path
              d={path}
              stroke="transparent"
              strokeWidth="10"
              fill="none"
              className={hoverCable?.main?.id === cable.id ? "cable-hover" : ""}
            />
          </g>
        );
      })}

      {/* TOOLTIP SOBRE CABLE */}
   
    </svg>
    {hoverCable && hoverInfo && (
  <div
    style={{
      position: "fixed",
      left: hoverInfo.x,
      top: hoverInfo.y,
      background: "black",
      color: "white",
      padding: "10px 14px",
      borderRadius: "8px",
      zIndex: 9999,
      pointerEvents: "none",
      opacity: 0.9,
      whiteSpace: "nowrap",
      boxShadow: "0 0 10px rgba(255,255,255,0.4)",
    }}
  >
    {hoverCable.group.length > 1 ? (
      <>
        <strong>{hoverCable.group.length} cables:</strong>
        <ul style={{ margin: 0, paddingLeft: 16 }}>
          {hoverCable.group.map((c) => (
            <li key={c.id}>{c.label}</li>
          ))}
        </ul>
      </>
    ) : (
      hoverCable.main.label
    )}
  </div>
)}
  </div>
);
}
