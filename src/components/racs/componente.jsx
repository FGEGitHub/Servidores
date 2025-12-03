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
  // AGRUPAR CABLES POR DESTINO u ORIGEN (tu lógica previa)
  // ============================================================
  const originMap = {};
  const destMap = {};

  cables.forEach((c) => {
    const oId = c.origen_id ?? "__null";
    const dId = c.destino_id ?? "__null";

    if (!originMap[oId]) originMap[oId] = [];
    originMap[oId].push(c);

    if (!destMap[dId]) destMap[dId] = [];
    destMap[dId].push(c);
  });

  const cableGroupKey = {};
  cables.forEach((c) => {
    const oId = c.origen_id ?? "__null";
    const dId = c.destino_id ?? "__null";

    const hasSameDest = (destMap[dId] && destMap[dId].length > 1);
    const hasSameOrigin = (originMap[oId] && originMap[oId].length > 1);

    if (hasSameDest) {
      cableGroupKey[c.id] = `dest-${dId}`;
    } else if (hasSameOrigin) {
      cableGroupKey[c.id] = `orig-${oId}`;
    } else {
      cableGroupKey[c.id] = `unique-${c.id}`;
    }
  });

  const groupKeyList = Array.from(
    new Set(Object.values(cableGroupKey))
  );

  const groupLevel = {};
  groupKeyList.forEach((gk, idx) => {
    groupLevel[gk] = idx;
  });

  const GROUP_SPACING = 40;
  const BASE_SAFE_Y = 720;

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
  // --- NUEVA LÓGICA: PUERTOS (SMALL SQUARES) POR ORIGEN -------
  // Para cada cable determinamos si sale por la derecha o por la izquierda
  // comparando centros (centro del destino vs centro del origen).
  // Luego agrupamos los puertos por equipo origen y por lado.
  // ============================================================
  const portsMap = {}; // key = `${tipo}-${id}` -> [{side:'derecha'|'izquierda', cableId}, ...]

  cables.forEach((c) => {
    const oTipo = String(c.origen_tipo).toLowerCase();
    const dTipo = String(c.destino_tipo).toLowerCase();

    const origenEq = equiposGlobal.find(e => e.tipo === oTipo && e.id === c.origen_id);
    const destinoEq = equiposGlobal.find(e => e.tipo === dTipo && e.id === c.destino_id);

    if (!origenEq || !destinoEq) return;

    const wOrigen = origenEq.isUPS ? 80 : 240;
    const wDestino = destinoEq.isUPS ? 80 : 240;

    const centroOrigen = origenEq.x + wOrigen / 2;
    const centroDestino = destinoEq.x + wDestino / 2;

    const side = centroDestino > centroOrigen ? "derecha" : "izquierda";

    const key = `${oTipo}-${c.origen_id}`;
    if (!portsMap[key]) portsMap[key] = [];
    portsMap[key].push({ side, cableId: c.id });
  });

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

  // Buscar puertos para este equipo
  const key = `${eq.tipo}-${eq.id}`;
  const ports = portsMap[key] || [];

  // separar por lado
  const portsLeft = ports.filter(p => p.side === "izquierda");
  const portsRight = ports.filter(p => p.side === "derecha");

  // parámetros visuales de puertos
  const portSize = 6;
  const portGap = 4;            // espacio entre puertos apilados
  const portYOffsetStart = 6;   // desde el top del rect

  return (
    <g
      key={eq.id}
      className={`equipo equipo-${eq.tipo}`}
      onClick={() => {
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

      {/* -------------------------------------- */}
      {/*   PUERTOS IZQUIERDA - CON CENTRADO     */}
      {/* -------------------------------------- */}
      {(() => {
        const total = portsLeft.length;
        return portsLeft.map((p, idx) => {

          const px = eq.x + 2; // dentro del rectángulo

          // si es 1 solo → centrado verticalmente
          const py = total === 1
            ? eq.y + height / 2 - portSize / 2
            : eq.y + portYOffsetStart + idx * (portSize + portGap);

          return (
            <rect
              key={`port-left-${p.cableId}`}
              x={px}
              y={py}
              width={portSize}
              height={portSize}
              rx="1"
              ry="1"
              fill="#222"
              stroke="#fff"
              strokeWidth="1"
              onMouseEnter={(e) => {
                const cable = cables.find(c => c.id === p.cableId);
                setHoverInfo({ x: e.clientX + 12, y: e.clientY + 12 });
                setHoverCable({ main: cable, group: [cable] });
              }}
              onMouseLeave={() => {
                setHoverInfo(null);
                setHoverCable(null);
              }}
            />
          );
        });
      })()}

      {/* -------------------------------------- */}
      {/*   PUERTOS DERECHA - CON CENTRADO       */}
      {/* -------------------------------------- */}
      {(() => {
        const total = portsRight.length;
        return portsRight.map((p, idx) => {

          const px = eq.x + width - portSize - 2; // dentro del rectángulo

          // si es 1 solo → centrado verticalmente
          const py = total === 1
            ? eq.y + height / 2 - portSize / 2
            : eq.y + portYOffsetStart + idx * (portSize + portGap);

          return (
            <rect
              key={`port-right-${p.cableId}`}
              x={px}
              y={py}
              width={portSize}
              height={portSize}
              rx="1"
              ry="1"
              fill="#222"
              stroke="#fff"
              strokeWidth="1"
              onMouseEnter={(e) => {
                const cable = cables.find(c => c.id === p.cableId);
                setHoverInfo({ x: e.clientX + 12, y: e.clientY + 12 });
                setHoverCable({ main: cable, group: [cable] });
              }}
              onMouseLeave={() => {
                setHoverInfo(null);
                setHoverCable(null);
              }}
            />
          );
        });
      })()}

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

            const wOrigen = origen.isUPS ? 80 : 240;
            const wDestino = destino.isUPS ? 80 : 240;

            function getLadoMismoServidor(origen, destino, wOrigen, wDestino) {
              const centroOrigen = origen.x + wOrigen / 2;
              const centroDestino = destino.x + wDestino / 2;
              return centroDestino > centroOrigen ? "derecha" : "izquierda";
            }

            function computeCablePath(origen, destino, wOrigen, wDestino) {
              const mismoRack = origen.rack_id === destino.rack_id;
              const origenEsUPS = origen.tipo === "ups";
              const destinoEsUPS = destino.tipo === "ups";

              const centroOrigen = origen.x + wOrigen / 2;
              const centroDestino = destino.x + wDestino / 2;

              let salirPorDerecha = centroOrigen < centroDestino;

              if (origen.id === destino.id && origen.tipo === destino.tipo) {
                salirPorDerecha = (origen.x + wOrigen / 2) < (destino.x + wDestino / 2);
              }

              const p1 = {
                x: salirPorDerecha ? origen.x + wOrigen : origen.x,
                y: origen.y + (origen.isUPS ? 30 : 14)
              };

              const offsetSalida = origenEsUPS ? 45 : 20;
              const p1_out = {
                x: salirPorDerecha ? p1.x + offsetSalida : p1.x - offsetSalida,
                y: p1.y
              };

              let p2, p2_in;
              const offsetEntrada = destinoEsUPS ? 45 : 20;

              if (mismoRack) {
                p2 = {
                  x: salirPorDerecha ? destino.x + wDestino : destino.x,
                  y: destino.y + (destino.isUPS ? 30 : 14)
                };
                p2_in = {
                  x: salirPorDerecha ? p2.x + offsetEntrada : p2.x - offsetEntrada,
                  y: p2.y
                };
              } else {
                if (salirPorDerecha) {
                  p2 = {
                    x: destino.x,
                    y: destino.y + (destino.isUPS ? 30 : 14)
                  };
                  p2_in = {
                    x: p2.x - offsetEntrada,
                    y: p2.y
                  };
                } else {
                  p2 = {
                    x: destino.x + wDestino,
                    y: destino.y + (destino.isUPS ? 30 : 14)
                  };
                  p2_in = {
                    x: p2.x + offsetEntrada,
                    y: p2.y
                  };
                }
              }

              if (p2_in.y > p1_out.y + 2) {
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

              let midY;
              const diffY = Math.abs(p1_out.y - p2_in.y);

              if (mismoRack) {
                if (diffY < 25) {
                  midY = p1_out.y;
                } else {
                  midY = (p1_out.y + p2_in.y) / 2;
                }
              } else {
                const dx = Math.abs(p1_out.x - p2_in.x);

                if (dx < 200) {
                  midY = Math.min(p1_out.y, p2_in.y) - 20;
                } else {
                  midY = Math.min(p1_out.y, p2_in.y) - 60;
                }
              }

              if (origenEsUPS && !destinoEsUPS) midY += 20;
              if (destinoEsUPS && !origenEsUPS) midY -= 20;
              if (origenEsUPS && destinoEsUPS) midY += 40;

              return `
                M ${p1.x} ${p1.y}
                L ${p1_out.x} ${p1_out.y}
                L ${p1_out.x} ${midY}
                L ${p2_in.x} ${midY}
                L ${p2_in.x} ${p2_in.y}
                L ${p2.x} ${p2.y}
              `;
            }

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
