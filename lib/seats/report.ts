import type { DepartureSeat, SeatStatus, SeatLayoutSpecialCell, SeatLayoutTemplate } from '@/types';

export type SeatReportReservation = {
  id: string;
  reservationCode?: string | null;
  customerName?: string | null;
  customerEmail?: string | null;
  customerPhone?: string | null;
  customerDocument?: string | null;
  people?: number | null;
  amountTotal?: number | null;
  currency?: string | null;
  status?: string | null;
  paymentMethod?: string | null;
};

export type SeatReportInput = {
  packageTitle: string;
  date: string;
  templateName?: string | null;
  busType?: string | null;
  seats: DepartureSeat[];
  reservationsById: Record<string, SeatReportReservation | null>;
  template?: SeatLayoutTemplate | null;
};

const STATUS_LABELS: Record<string, string> = {
  available: 'Disponible',
  held: 'En proceso',
  reserved: 'Reservada',
  paid: 'Pagada',
  blocked: 'Bloqueada',
  disabled: 'No disponible',
};

const STATUS_COLORS: Record<string, { bg: string; border: string; text: string; badge: string }> = {
  available: { bg: '#FFFFFF', border: '#D9E8F7', text: '#334E71', badge: '#F6FAFD' },
  held: { bg: '#FFF8EA', border: '#F2D089', text: '#B7791F', badge: '#FFF8EA' },
  reserved: { bg: '#FFF3DB', border: '#F4C77A', text: '#9A6B11', badge: '#FFF3DB' },
  paid: { bg: '#1E6B4F', border: '#2E7D5F', text: '#FFFFFF', badge: '#D1FAE5' },
  blocked: { bg: '#FFF4F7', border: '#F2C7D3', text: '#C24162', badge: '#FFF4F7' },
  disabled: { bg: '#F6FAFD', border: '#E0E8EF', text: '#7B8EA5', badge: '#F1F5F9' },
};

const CATEGORY_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  cocheCama: { bg: '#FFF8EC', border: '#F6D6A8', text: '#B95D03' },
  panoramicos: { bg: '#F0FDFF', border: '#A6DDE7', text: '#117C93' },
  cafeteras: { bg: '#F3EEFF', border: '#D9C8FF', text: '#6D28D9' },
};

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatMoney(amount?: number | null, currency?: string | null) {
  if (!amount) return '—';
  const normalized = String(currency || 'ARS').toUpperCase();
  const prefix = normalized === 'USD' ? 'US$' : normalized === 'EUR' ? 'EUR ' : '$';
  const value = Number(amount) / 100;
  return `${prefix}${value.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(date: string) {
  if (!date) return '—';
  try {
    return new Date(`${date}T12:00:00`).toLocaleDateString('es-AR', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return date;
  }
}

function getRowLetter(index: number) {
  let current = index;
  let label = '';
  do {
    label = String.fromCharCode(65 + (current % 26)) + label;
    current = Math.floor(current / 26) - 1;
  } while (current >= 0);
  return label;
}

function specialCellLabel(cell: SeatLayoutSpecialCell, compact?: boolean) {
  if (cell.label && cell.label.trim()) return cell.label.trim();
  if (cell.type === 'driver') return compact ? 'C' : 'Chofer';
  if (cell.type === 'wc') return compact ? 'B' : 'Baño';
  if (cell.type === 'stairs') return compact ? 'E' : 'Esc';
  return '';
}

function specialTone(type: SeatLayoutSpecialCell['type']) {
  if (type === 'driver') return { bg: '#FFF8EC', border: '#F8D7A5', text: '#CA7A03' };
  if (type === 'wc') return { bg: '#F4F8FF', border: '#BFD6FF', text: '#336FF4' };
  if (type === 'stairs') return { bg: '#F8F5FF', border: '#D8C9FF', text: '#8155F6' };
  return { bg: '#F8FBFE', border: '#D6E1EC', text: '#70839E' };
}

function renderFloorGrid(
  seats: DepartureSeat[],
  floor: number,
  templateCols: number,
  aisleCols: number[],
  specialCells: SeatLayoutSpecialCell[] = []
) {
  const floorSeats = seats.filter((s) => Number(s.floor ?? 0) === floor);
  const floorSpecial = specialCells.filter((c) => Number(c.floor ?? 0) === floor);
  if (floorSeats.length === 0 && floorSpecial.length === 0) return '';

  const allRows = floorSeats.map((s) => Number(s.row ?? 0));
  const specialRows = floorSpecial.map((s) => Number(s.row ?? 0));
  const maxRow = Math.max(...allRows, ...specialRows, 0);

  const seatByPos = new Map(floorSeats.map((s) => [`${s.row}-${s.col}`, s]));
  const specialByPos = new Map(floorSpecial.map((c) => [`${c.row}-${c.col}`, c]));

  const sortedAisleCols = [...aisleCols].filter((value) => value > 0 && value < templateCols).sort((a, b) => a - b);
  const displayColumns: Array<{ kind: 'cell'; col: number } | { kind: 'aisle'; key: string }> = [];
  for (let col = 0; col < templateCols; col += 1) {
    displayColumns.push({ kind: 'cell', col });
    if (sortedAisleCols.includes(col + 1)) {
      displayColumns.push({ kind: 'aisle', key: `aisle-${col}` });
    }
  }

  const rows: string[] = [];
  for (let row = 0; row <= maxRow; row += 1) {
    const cells: string[] = [];
    for (const item of displayColumns) {
      if (item.kind === 'aisle') {
        cells.push('<td class="cell aisle"><div class="aisle-line"></div></td>');
        continue;
      }
      const key = `${row}-${item.col}`;
      const special = specialByPos.get(key);
      if (special) {
        const tone = specialTone(special.type);
        const label = specialCellLabel(special);
        cells.push(
          `<td class="cell"><div class="special" style="background:${tone.bg};border-color:${tone.border};color:${tone.text}">${escapeHtml(label)}</div></td>`
        );
        continue;
      }
      const seat = seatByPos.get(key);
      if (!seat) {
        cells.push('<td class="cell empty"></td>');
        continue;
      }
      const statusColors = STATUS_COLORS[String(seat.status)] ?? STATUS_COLORS.available;
      const categoryColors = seat.category ? CATEGORY_COLORS[seat.category] : null;
      const isOccupied = ['reserved', 'paid', 'held'].includes(String(seat.status));
      const bgColor = categoryColors?.bg ?? statusColors.bg;
      const borderColor = categoryColors?.border ?? statusColors.border;
      const textColor = categoryColors?.text ?? statusColors.text;
      const categoryShortLabel = seat.category === 'cocheCama' ? 'CA' : seat.category === 'panoramicos' ? 'PA' : seat.category === 'cafeteras' ? 'CF' : '';
      cells.push(
        `<td class="cell"><div class="seat${isOccupied ? ' occupied' : ''}" style="background:${bgColor};border-color:${borderColor};color:${textColor}">
          ${categoryShortLabel ? `<span class="cat">${categoryShortLabel}</span>` : ''}
          <span class="num">${escapeHtml(seat.label)}</span>
        </div></td>`
      );
    }
    rows.push(`<tr>${cells.join('')}</tr>`);
  }

  const rowLabels = Array.from({ length: maxRow + 1 }, (_, i) => getRowLetter(i))
    .map((letter) => `<div class="row-label">${letter}</div>`)
    .join('');

  return `
    <div class="floor">
      <div class="floor-title">${floor === 0 ? 'Planta baja' : `Piso ${floor + 1}`}</div>
      <div class="front-indicator">
        <div class="label">Frente</div>
        <svg class="curve" viewBox="0 0 220 18" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M10 15C60 5 160 5 210 15" stroke="#BFD8EE" stroke-width="2" stroke-linecap="round" />
        </svg>
      </div>
      <div class="seatmap-wrap">
        <div class="row-labels">${rowLabels}</div>
        <div class="seatmap">
          <div class="seatmap-inner">
            <div class="driver-area"></div>
            <table class="grid"><tbody>${rows.join('')}</tbody></table>
          </div>
        </div>
      </div>
    </div>
  `;
}

export function buildSeatReportHtml(input: SeatReportInput): string {
  const { packageTitle, date, templateName, busType, seats, reservationsById, template } = input;

  const counts = seats.reduce<Record<string, number>>((acc, seat) => {
    const key = String(seat.status ?? 'available');
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});

  const total = seats.length;
  const ocupadas = (counts.reserved ?? 0) + (counts.paid ?? 0) + (counts.held ?? 0);
  const vendibles = total - (counts.disabled ?? 0);
  const ocupacion = vendibles > 0 ? Math.round((ocupadas / vendibles) * 100) : 0;

  const floors = Array.from(new Set(seats.map((s) => Number(s.floor ?? 0)))).sort((a, b) => a - b);
  const maxRow = seats.length > 0 ? Math.max(...seats.map((s) => Number(s.row ?? 0))) : 0;
  const templateCols = Math.max(1, Number(template?.cols ?? seats[0]?.col ?? 4) + 1);
  const aisleColsList = Array.isArray(template?.aisleCols) ? template.aisleCols : [];
  const specialCells = Array.isArray(template?.specialCells) ? template.specialCells : [];

  const gridsHtml = floors.map((floor) => renderFloorGrid(seats, floor, templateCols, aisleColsList, specialCells)).join('');

  const occupiedSeats = seats
    .filter((s) => ['reserved', 'paid', 'held'].includes(String(s.status)))
    .sort((a, b) => String(a.label).localeCompare(String(b.label), 'es', { numeric: true }));

  const rowsHtml = occupiedSeats
    .map((seat) => {
      const reserva = seat.reservationId ? reservationsById[String(seat.reservationId)] : null;
      const statusLabel = STATUS_LABELS[String(seat.status)] ?? seat.status;
      const colors = STATUS_COLORS[String(seat.status)] ?? STATUS_COLORS.available;
      return `
        <tr>
          <td class="strong">${escapeHtml(seat.label)}</td>
          <td><span class="badge" style="background:${colors.badge};color:${colors.text};border-color:${colors.border}">${escapeHtml(statusLabel)}</span></td>
          <td>${escapeHtml(reserva?.reservationCode || seat.reservationId || '—')}</td>
          <td>${escapeHtml(reserva?.customerName || '—')}</td>
          <td>${escapeHtml(reserva?.customerDocument || '—')}</td>
          <td>${escapeHtml(reserva?.customerPhone || '—')}</td>
          <td>${escapeHtml(reserva?.customerEmail || '—')}</td>
          <td class="center">${escapeHtml(String(reserva?.people ?? '—'))}</td>
          <td class="right">${escapeHtml(formatMoney(reserva?.amountTotal, reserva?.currency))}</td>
        </tr>
      `;
    })
    .join('');

  const legendHtml = Object.entries(STATUS_LABELS)
    .map(([key, label]) => {
      const colors = STATUS_COLORS[key];
      return `<span class="legend-item"><i style="background:${colors.bg};border-color:${colors.border}"></i>${escapeHtml(label)} (${counts[key] ?? 0})</span>`;
    })
    .join('');

  const usedCategories = [...new Set(seats.map((s) => s.category).filter(Boolean))];
  const categoryHtml = usedCategories
    .map((code) => {
      const c = String(code);
      const colors = CATEGORY_COLORS[c];
      const label = c === 'cocheCama' ? 'CA' : c === 'panoramicos' ? 'PA' : c === 'cafeteras' ? 'CF' : '';
      if (!label || !colors) return '';
      return `<span class="category-badge" style="background:${colors.bg};color:${colors.text};border-color:${colors.border}">${label}</span>`;
    })
    .join(' ');

  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8" />
<title>Taquilla - ${escapeHtml(packageTitle)} - ${escapeHtml(date)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #0F172A; margin: 24px; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  .muted { color: #64748B; font-size: 12px; }
  .header { border-bottom: 2px solid #0F172A; padding-bottom: 12px; margin-bottom: 16px; }
  .summary { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 16px; }
  .kpi { border: 1px solid #E2E8F0; border-radius: 8px; padding: 8px 12px; min-width: 110px; }
  .kpi b { display: block; font-size: 18px; }
  .kpi span { font-size: 10px; text-transform: uppercase; letter-spacing: .08em; color: #64748B; }
  .legend { display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: 16px; font-size: 11px; align-items: center; }
  .legend-item { display: inline-flex; align-items: center; gap: 6px; }
  .legend-item i { width: 12px; height: 12px; border-radius: 3px; border: 1px solid; display: inline-block; }
  .floors { display: flex; flex-wrap: wrap; gap: 24px; margin-bottom: 20px; }
  .floor-title { font-size: 11px; text-transform: uppercase; letter-spacing: .1em; color: #64748B; margin-bottom: 6px; }
  .seatmap-wrap { display: inline-flex; align-items: flex-start; gap: 6px; }
  .seatmap { border-radius: 16px; border: 1.5px solid #D5E3F0; background: #FFFFFF; padding: 8px; box-shadow: 0 10px 24px rgba(18,89,150,0.08); }
  .seatmap-inner { border-radius: 12px; border: 1px solid #DCE8F4; background: linear-gradient(180deg, #FFFFFF 0%, #F7FBFF 100%); padding: 6px 4px 4px; }
  .driver-area { height: 22px; margin: 0 auto 8px; width: 78%; border-radius: 999px; border: 1px solid #C8D6E4; background: linear-gradient(180deg, #E5EAF0 0%, #FAFCFE 100%); }
  .row-labels { display: flex; flex-direction: column; gap: 4px; margin-right: 6px; }
  .row-label { width: 20px; height: 40px; display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 900; color: #118CA7; }
  .grid { border-collapse: separate; border-spacing: 4px; }
  .cell { padding: 0; width: 40px; height: 40px; vertical-align: middle; text-align: center; }
  .cell.empty { width: 40px; height: 40px; }
  .cell.aisle { width: 14px; padding: 0; }
  .aisle-line { width: 6px; height: 40px; background: #E0EAF4; border-radius: 999px; margin: 0 auto; }
  .seat { width: 40px; height: 40px; border: 1.5px solid; border-radius: 8px; display: inline-flex; flex-direction: column; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; position: relative; }
  .seat .cat { font-size: 7px; font-weight: 800; letter-spacing: 0.06em; line-height: 1; margin-bottom: 1px; }
  .seat .num { font-size: 11px; font-weight: 700; line-height: 1; }
  .seat.occupied { box-shadow: inset 0 0 0 2px rgba(0,0,0,0.06); }
  .special { width: 40px; height: 40px; border: 1.5px solid; border-radius: 8px; display: inline-flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 700; }
  .front-indicator { text-align: center; margin-bottom: 8px; }
  .front-indicator .label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .12em; color: #7C95AE; }
  .front-indicator .curve { width: 220px; height: 18px; margin: 2px auto 0; }
  .category-badge { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 10px; font-weight: 600; border: 1px solid; margin-right: 6px; }
  h2 { font-size: 14px; margin: 20px 0 8px; }
  table.list { width: 100%; border-collapse: collapse; font-size: 11px; }
  table.list th { text-align: left; background: #F1F5F9; padding: 6px; border-bottom: 1px solid #CBD5E1; font-size: 10px; text-transform: uppercase; letter-spacing: .05em; }
  table.list td { padding: 6px; border-bottom: 1px solid #E2E8F0; }
  table.list td.strong { font-weight: 700; }
  table.list td.center { text-align: center; }
  table.list td.right { text-align: right; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 10px; font-weight: 600; border: 1px solid; }
  .empty-note { font-size: 12px; color: #64748B; padding: 12px 0; }
  @media print { body { margin: 12mm; } .floors, table.list { page-break-inside: auto; } tr { page-break-inside: avoid; } }
</style>
</head>
<body>
  <div class="header">
    <h1>Taquilla · ${escapeHtml(packageTitle)}</h1>
    <div class="muted">
      Salida: ${escapeHtml(formatDate(date))}
      ${templateName ? ` · Plantilla: ${escapeHtml(templateName)}` : ''}
      ${busType ? ` · ${escapeHtml(busType)}` : ''}
    </div>
    <div class="muted">Generado el ${escapeHtml(new Date().toLocaleString('es-AR'))}</div>
  </div>

  <div class="summary">
    <div class="kpi"><span>Butacas</span><b>${total}</b></div>
    <div class="kpi"><span>Ocupadas</span><b>${ocupadas}</b></div>
    <div class="kpi"><span>Disponibles</span><b>${counts.available ?? 0}</b></div>
    <div class="kpi"><span>Bloqueadas</span><b>${counts.blocked ?? 0}</b></div>
    <div class="kpi"><span>Ocupación</span><b>${ocupacion}%</b></div>
  </div>

  <div class="legend">
    ${legendHtml}
    ${categoryHtml ? `<span class="legend-item" style="margin-left:12px;font-weight:700;color:#334E71">Categorías:</span>${categoryHtml}</span>` : ''}
  </div>

  <div class="floors">${gridsHtml}</div>

  <h2>Butacas ocupadas (${occupiedSeats.length})</h2>
  ${
    occupiedSeats.length === 0
      ? '<div class="empty-note">No hay butacas ocupadas para esta salida.</div>'
      : `<table class="list">
          <thead>
            <tr>
              <th>Butaca</th><th>Estado</th><th>Reserva</th><th>Pasajero</th>
              <th>Documento</th><th>Teléfono</th><th>Email</th><th class="center">Pax</th><th class="right">Monto</th>
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
        </table>`
  }
</body>
</html>`;
}
