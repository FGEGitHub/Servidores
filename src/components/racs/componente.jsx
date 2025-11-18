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
  } = data;

  const [hoverCable, setHoverCable] = useState(null);

  // ---------------------------
  // POSICIÓN UPS SIEMPRE ABAJO
  // ---------------------------
  function getUpsCoords(upsItem, index, rack) {
    const rackHeight = 600;
    const bottomPadding = 20;

    const columna = index % 2;
    const fila = Math.floor(index / 2);

    const upsHeight = 60;
    const separacionVertical = 10;

    const yBase =
      rack.posY +
      rackHeight -
      bottomPadding -
      upsHeight -
      fila * (upsHeight + separacionVertical);

    return {
      x: rack.posX + 20 + columna * 130,
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
  const rackPositions = racks.map((rack, index) => ({
    ...rack,
    posX: 80 + index * 350,
    posY: 40,
  }));

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

  return (
    <>
      <svg width="1800" height="1200" className="diagram-svg">
        {/* RACKS */}
        {rackPositions.map((rack) => (
          <g key={rack.id} className="rack">
            <rect
              className="rack-rect"
              x={rack.posX}
              y={rack.posY}
              width="260"
              height="600"
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

        {/* CABLES CURVOS CON TOOLTIP */}
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

  const safeY = Math.max(p1.y + 80, p2.y + 80, 720);

  const path = `
    M ${p1.x} ${p1.y}
    L ${p1_out.x} ${p1_out.y}
    L ${p1_out.x} ${safeY}
    L ${p2_in.x} ${safeY}
    L ${p2_in.x} ${p2_in.y}
    L ${p2.x} ${p2.y}
  `;

  return (
    <g
      key={cable.id}
      onMouseEnter={() => setHoverCable(cable)}
      onMouseLeave={() => setHoverCable(null)}
    >
      {/* Cable visible */}
      <path
        d={path}
        stroke={cable.color}
        strokeWidth="3"
        fill="none"
        style={{
          filter:
            hoverCable?.id === cable.id
              ? "drop-shadow(0px 0px 4px white)"
              : "none",
          cursor: "pointer",
        }}
      />

      {/* Área invisible más grande para facilitar hover */}
      <path
        d={path}
        stroke="transparent"
        strokeWidth="10"
        fill="none"
      />
    </g>
  );
})}
      </svg>

      {/* TOOLTIP FIJO */}
      {hoverCable && (
        <div
          style={{
            position: "fixed",
            left: 20,
            top: 20,
            padding: "8px 12px",
            background: "black",
            color: "white",
            borderRadius: 8,
            fontSize: 14,
            pointerEvents: "none",
            opacity: 0.9,
          }}
        >
          {hoverCable.label}
        </div>
      )}

      <div
        style={{ marginBottom: "30px", padding: "15px", fontFamily: "monospace" }}
      >
        <h3>Conexiones (ordenadas)</h3>
        <ul>
          {[...cables]
            .sort((a, b) => a.label.localeCompare(b.label))
            .map((c) => (
              <li key={c.id}>{c.label}</li>
            ))}
        </ul>
      </div>
    </>
  );
}
