
////////////la patitas son p2 in
import React, { useState } from "react";
import data from "./datos.json";
import "./diagram.css";

export default function RackDiagram() {
  const {
    racks,
    routers,
    fortinet,
    mikrotik,
    servidores,
    ups,
    sw,
    qnap,
    cables,
    linea_tension
  } = data;

  const [hoverCable, setHoverCable] = useState(null);
  const [hoverInfo, setHoverInfo] = useState(null);
const [selectedDevice, setSelectedDevice] = useState(null);

  // ---------------------------
  // POSICIÓN UPS — SIEMPRE ABAJO
  // ---------------------------
  function getUpsCoords(upsItem, index, rack) {
    const bottomPadding = 20;
    const upsWidth = 80;
    const upsHeight = 60;

    const sepX = 20;
    const sepY = 10;

    const columna = index % 2;
    const fila = Math.floor(index / 2);

    const rackInnerWidth = 260 - 40;
    const totalWidthUPS = upsWidth * 2 + sepX;

    const offsetX = (rackInnerWidth - totalWidthUPS) / 2;

    const x =
      rack.posX +
      20 +
      offsetX +
      columna * (upsWidth + sepX);

    const y =
      rack.posY +
      rack.height -
      bottomPadding -
      upsHeight -
      fila * (upsHeight + sepY);

    return { x, y };
  }



function getLadoMismoServidor(origen, destino, wOrigen, wDestino) {
  const centroOrigen = origen.x + wOrigen / 2;
  const centroDestino = destino.x + wDestino / 2;

  // Si destino está a la derecha → usar derecha
  // Si destino está a la izquierda → usar izquierda
  return centroDestino > centroOrigen ? "derecha" : "izquierda";
}

  // ---------------------------
  // Equipos (SW agregado)
  // ---------------------------
  const equipos = [
    ...routers,
    ...fortinet,
    ...mikrotik,
    ...servidores,
    ...sw,               // ⬅️ SW agregado
    ...ups,
    ...qnap,
    ...linea_tension
  ]
    .filter((e) => e.rack_id !== null)
    .map((e) => ({ ...e }));

  // ---------------------------
  // Asignar SLOT a equipos normales
  // ---------------------------
  const equiposConSlot = racks.flatMap((rack) => {
    const eqRack = equipos
      .filter((e) => e.rack_id === rack.id)
      // -------- Ahora priorizamos por campo "orden" si existe, luego prioridad, luego id
      .sort((a, b) => {
        const ao = a.orden ?? 9999;
        const bo = b.orden ?? 9999;
        if (ao !== bo) return ao - bo;
        const ap = a.prioridad ?? 100;
        const bp = b.prioridad ?? 100;
        if (ap !== bp) return ap - bp;
        return (a.id || 0) - (b.id || 0);
      });

    return eqRack.map((e, index) => ({
      ...e,
      slot: index + 1,
    }));
  });

  // ---------------------------
  // RACK POSITIONS
  // ---------------------------
  const RACK_WIDTH = 260;
  const RACK_BIG_HEIGHT = 650;
  const RACK_SMALL_HEIGHT = RACK_BIG_HEIGHT * 0.4;

  const COLS = 3;
  const GAP_X = 120;
  const GAP_Y = 80;

  const rackRows = [];
  for (let i = 0; i < racks.length; i += COLS) {
    rackRows.push(racks.slice(i, i + COLS));
  }

  const rackPositions = [];

  rackRows.forEach((row, rowIndex) => {
    const rowWidth =
      row.length * RACK_WIDTH +
      (row.length - 1) * GAP_X;

    const offsetX = (1800 - rowWidth) / 2;

    row.forEach((rack, colIndex) => {
      const x = offsetX + colIndex * (RACK_WIDTH + GAP_X);

      const height =
        rack.tamanio === "chico"
          ? RACK_SMALL_HEIGHT
          : RACK_BIG_HEIGHT;

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
  // Coordenadas de equipos NO UPS
  // ---------------------------
  const getCoords = (equipo) => {
    const rack = rackPositions.find((r) => r.id === equipo.rack_id);
    if (!rack) return { x: 0, y: 0 };
    return {
      x: rack.posX + 8,
      y: rack.posY + 40 + (equipo.slot - 1) * 32,
    };
  };

  // ---------------------------
  // Coordenadas UPS
  // ---------------------------
  const upsPositions = rackPositions.flatMap((rack) => {
    const upsDeRack = equiposConSlot.filter(
      (e) => e.tipo === "ups" && e.rack_id === rack.id
    );

    return upsDeRack.map((upsItem, index) => {
      const { x, y } = getUpsCoords(upsItem, index, rack);
      return {
        ...upsItem,
        x,
        y,
        isUPS: true,
      };
    });
  });

  // ---------------------------
  // Equipos finales
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
  // CABLE COLORS
  // ============================================================
  function getCableColor(cable) {
    const o = cable.origen_tipo?.toLowerCase();
    const d = cable.destino_tipo?.toLowerCase();

    if (o === "linea_tension" || d === "linea_tension") return "#cd840eff";
    if (o === "ups" || d === "ups") return "#ff9900";
    if (o === "qnap" || d === "qnap") return "#00c3ff";
    if (o === "sw" || d === "sw") return "#00ff62";

    return cable.color || "#ffffff";
  }

  // ============================================================
  // OFFSET DE CABLES (existente: por color/origen)
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
    if (!cableOffsets[key]) cableOffsets[key] = {};

    const color = getCableColor(cable);

    if (cableOffsets[key][color] !== undefined) {
      cable.offset = cableOffsets[key][color];
    } else {
      const count = Object.keys(cableOffsets[key]).length;
      const newOffset = count * 15;
      cableOffsets[key][color] = newOffset;
      cable.offset = newOffset;
    }
  });

  // ============================================================
  // NUEVA LÓGICA: AGRUPAR CABLES POR DESTINO u ORIGEN (reglas pedidas)
  // - Si hay >1 cable con mismo destino -> grupo por destino
  // - Else si hay >1 cable con mismo origen -> grupo por origen
  // - Si comparte ambos (dest y origin con distintos grupos) -> PRIORIDAD DESTINO
  // Cada grupo recibe un "nivel" para separar verticalmente.
  // ============================================================

  // Mapas de conteo
  const originMap = {}; // origen_id -> [cables]
  const destMap = {}; // destino_id -> [cables]

  cables.forEach((c) => {
    const oId = c.origen_id ?? "__null";
    const dId = c.destino_id ?? "__null";

    if (!originMap[oId]) originMap[oId] = [];
    originMap[oId].push(c);

    if (!destMap[dId]) destMap[dId] = [];
    destMap[dId].push(c);
  });

  // Determinar groupKey para cada cable
  // groupKey examples: "dest-2", "orig-5", "unique-<id>"
  const cableGroupKey = {};
  cables.forEach((c) => {
    const oId = c.origen_id ?? "__null";
    const dId = c.destino_id ?? "__null";

    const hasSameDest = (destMap[dId] && destMap[dId].length > 1);
    const hasSameOrigin = (originMap[oId] && originMap[oId].length > 1);

    if (hasSameDest) {
      // prioridad destino si ambos true también
      cableGroupKey[c.id] = `dest-${dId}`;
    } else if (hasSameOrigin) {
      cableGroupKey[c.id] = `orig-${oId}`;
    } else {
      cableGroupKey[c.id] = `unique-${c.id}`;
    }
  });

  // Asignar niveles a cada groupKey (orden estable)
  const groupKeyList = Array.from(
    new Set(Object.values(cableGroupKey))
  );

  const groupLevel = {};
  groupKeyList.forEach((gk, idx) => {
    groupLevel[gk] = idx; // nivel 0,1,2...
  });

  // Parámetros de separación entre grupos
  const GROUP_SPACING = 40; // px vertical entre grupos
  const BASE_SAFE_Y = 720; // base que ya usabas

  // ============================================================
  // Función auxiliar para obtener cables "misma lane" (mantuvimos)
  // ============================================================
  function getCablesSameLane(cable, all) {
    return all.filter((c) => {
      const sameOrigin =
        c.origen_tipo === cable.origen_tipo &&
        c.origen_id === cable.origen_id;

      const sameOffset = c.offset === cable.offset;

      return sameOrigin && sameOffset;
    });
  }

  // ============================================================
  // RENDER
  // ============================================================
  return (
    <div className="diagram-wrapper">
      {/* PANEL A LA IZQUIERDA */}
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
      <svg
        width="1800"
        height="1400"
        className="diagram-svg"
        onMouseMove={(e) => {
          if (hoverInfo) {
            let x = e.clientX + 25;
            let y = e.clientY + 25;

            const maxX = window.innerWidth - 250;
            if (x > maxX) x = e.clientX - 250;

            setHoverInfo({ x, y });
          }
        }}
      >
        {/* RACKS */}
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
           <g
  key={eq.id}
  className={`equipo equipo-${eq.tipo}`}
  onClick={() => {
    // Si clickeo el mismo aparato → deseleccionar
    if (selectedDevice?.id === eq.id && selectedDevice?.tipo === eq.tipo) {
      setSelectedDevice(null);
    } else {
      setSelectedDevice({ id: eq.id, tipo: eq.tipo });
    }
  }}
  style={{ cursor: "pointer" }}
>
  <rect
    className="equipo-rect"
    x={eq.x}
    y={eq.y}
    width={width}
    height={height}
    rx={eq.tipo === "ups" ? 10 : 4}
    stroke={selectedDevice?.id === eq.id && selectedDevice?.tipo === eq.tipo ? "#00eaff" : undefined}
    strokeWidth={selectedDevice?.id === eq.id && selectedDevice?.tipo === eq.tipo ? 3 : 1}
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
       {cables
  .filter(c => {
    if (!selectedDevice) return true;

    const isOrigin = (c.origen_id === selectedDevice.id && c.origen_tipo === selectedDevice.tipo);
    const isDest = (c.destino_id === selectedDevice.id && c.destino_tipo === selectedDevice.tipo);

    return isOrigin || isDest;
  })

  // **** FILTRAR CABLES QUE APUNTAN A RACKS ****
  .filter(
    (c) =>
      String(c.origen_tipo).toLowerCase() !== "rack" &&
      String(c.destino_tipo).toLowerCase() !== "rack"
  )

  .map((cable) => {
    const o = cable.origen_tipo?.toLowerCase();
    const d = cable.destino_tipo?.toLowerCase();

    const origen = equiposGlobal.find(
      (e) => e.tipo === o && e.id === cable.origen_id
    );
    const destino = equiposGlobal.find(
      (e) => e.tipo === d && e.id === cable.destino_id
    );

    if (!origen || !destino) return null;

    // Anchos reales
    const wOrigen = origen.isUPS ? 80 : 240;
    const wDestino = destino.isUPS ? 80 : 240;

    // ===========================================
    // FUNCIÓN NUEVA PARA MISMO SERVIDOR
    // ===========================================
    function getLadoMismoServidor(origen, destino, wOrigen, wDestino) {
      const centroOrigen = origen.x + wOrigen / 2;
      const centroDestino = destino.x + wDestino / 2;
      return centroDestino > centroOrigen ? "derecha" : "izquierda";
    }

    // ===========================================
    // NUEVO SISTEMA DE RUTEO ORTOGONAL
    // ===========================================

// --- Reemplazar computeCablePath por esta versión ---
function computeCablePath(origen, destino, wOrigen, wDestino) {
  const mismoRack = origen.rack_id === destino.rack_id;
  const origenEsUPS = origen.tipo === "ups";
  const destinoEsUPS = destino.tipo === "ups";

  // centros para decidir izquierda/derecha
  const centroOrigen = origen.x + wOrigen / 2;
  const centroDestino = destino.x + wDestino / 2;

  // por defecto: si origen está a la izquierda -> salir por derecha
  let salirPorDerecha = centroOrigen < centroDestino;

  // si es el mismo equipo, mantener la lógica local
  if (origen.id === destino.id && origen.tipo === destino.tipo) {
    salirPorDerecha = (origen.x + wOrigen / 2) < (destino.x + wDestino / 2);
  }

  // -----------------------
  // Puntos de salida (origen)
  // -----------------------
  const p1 = {
    x: salirPorDerecha ? origen.x + wOrigen : origen.x,
    y: origen.y + (origen.isUPS ? 30 : 14)
  };

  const offsetSalida = origenEsUPS ? 45 : 20;
  const p1_out = {
    x: salirPorDerecha ? p1.x + offsetSalida : p1.x - offsetSalida,
    y: p1.y
  };

  // -----------------------
  // Puntos de entrada (destino) y patita p2_in
  // -----------------------
  let p2, p2_in;
  const offsetEntrada = destinoEsUPS ? 45 : 20;

  if (mismoRack) {
    // para mismo rack: la patita de entrada se calcula en función de salirPorDerecha
    // (la patita del destino debe apuntar hacia afuera del rack)
    p2 = {
      x: salirPorDerecha ? destino.x + wDestino : destino.x,
      y: destino.y + (destino.isUPS ? 30 : 14)
    };
    // patita del destino: extender hacia afuera (no hacia el interior)
    p2_in = {
      x: salirPorDerecha ? p2.x + offsetEntrada : p2.x - offsetEntrada,
      y: p2.y
    };
  } else {
    // distinto rack: queremos que el cable entre por el borde más lógico:
    if (salirPorDerecha) {
      // origen a la izquierda del destino -> entrada por izquierda del destino
      p2 = {
        x: destino.x,
        y: destino.y + (destino.isUPS ? 30 : 14)
      };
      // patita: salir hacia afuera desde la izquierda (hacia la izquierda)
      p2_in = {
        x: p2.x - offsetEntrada,
        y: p2.y
      };
    } else {
      // origen a la derecha del destino -> entrada por derecha del destino
      p2 = {
        x: destino.x + wDestino,
        y: destino.y + (destino.isUPS ? 30 : 14)
      };
      // patita: salir hacia afuera desde la derecha (hacia la derecha)
      p2_in = {
        x: p2.x + offsetEntrada,
        y: p2.y
      };
    }
  }

  // -----------------------
  // CASO ESPECIAL: destino está POR DEBAJO del punto de salida
  // → bajar directo (sin volver a entrar al rack), luego girar horizontal y entrar.
  // Esto evita la "reentrada" y la panza innecesaria.
  // -----------------------
  if (p2_in.y > p1_out.y + 2) {
    // distancia vertical antes de girar (pequeño margin para que no pegue en el rect)
    const verticalMargin = 12;
    const midY = p2_in.y - verticalMargin;

    return `
      M ${p1.x} ${p1.y}
      L ${p1_out.x} ${p1_out.y}
      L ${p1_out.x} ${midY}
      L ${p2_in.x} ${midY}
      L ${p2_in.x} ${p2_in.y}
      L ${p2.x} ${p2.y}
    `;
  }

  // -----------------------
  // Si no es el caso "destino abajo", usamos la lógica previa para calcular midY
  // evitando panzas: mismoRack -> recto o curva suave; distintoRack -> subir/curvar según distancia
  // -----------------------
  let midY;
  const diffY = Math.abs(p1_out.y - p2_in.y);

  if (mismoRack) {
    if (diffY < 25) {
      midY = p1_out.y; // recto
    } else {
      midY = (p1_out.y + p2_in.y) / 2; // curvita suave
    }
  } else {
    // distinto rack: decidir si subir o bajar un poco según separación horizontal
    const dx = Math.abs(p1_out.x - p2_in.x);

    if (dx < 200) {
      // racks relativamente cercanos → pequeña compensación hacia arriba
      midY = Math.min(p1_out.y, p2_in.y) - 20;
    } else {
      // racks lejanos → curva más marcada hacia arriba para evitar cruces
      midY = Math.min(p1_out.y, p2_in.y) - 60;
    }
  }

  // pequeñas compensaciones por UPS
  if (origenEsUPS && !destinoEsUPS) midY += 20;
  if (destinoEsUPS && !origenEsUPS) midY -= 20;
  if (origenEsUPS && destinoEsUPS) midY += 40;

  // -----------------------
  // Construir path ortogonal (caso general)
  // -----------------------
  return `
    M ${p1.x} ${p1.y}
    L ${p1_out.x} ${p1_out.y}
    L ${p1_out.x} ${midY}
    L ${p2_in.x} ${midY}
    L ${p2_in.x} ${p2_in.y}
    L ${p2.x} ${p2.y}
  `;
}

    // CALCULAR PATH FINAL
    const path = computeCablePath(origen, destino, wOrigen, wDestino);

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
        />
        {/* zona hover grande */}
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

      {/* TOOLTIP */}
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
