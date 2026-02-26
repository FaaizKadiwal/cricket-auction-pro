import { jsPDF } from 'jspdf';

// ─── Types ───────────────────────────────────────────────────────────────────

interface PdfRuleItem { text: string; hl?: boolean }
interface PdfRuleSection { title: string; hl?: boolean; items: PdfRuleItem[] }

// ─── Layout constants (mm, A4) ───────────────────────────────────────────────

const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN  = 15;
const CONTENT_W = PAGE_W - MARGIN * 2;
const BOTTOM    = PAGE_H - MARGIN;
const LINE_H    = 4.2;   // line height for body text
const ITEM_PAD  = 3;     // vertical padding inside each rule item
const NUM_W     = 10;    // space reserved for the number column

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Strip emoji / pictographic characters that jsPDF cannot render. */
function stripEmoji(text: string): string {
  return text
    .replace(/[\u{1F000}-\u{1FFFF}]/gu, '')
    .replace(/[\u{2600}-\u{27BF}]/gu, '')
    .replace(/[\u{FE00}-\u{FE0F}\u{200D}]/gu, '')
    .replace(/[\u2700-\u27BF]/g, '')
    .replace(/[\u2600-\u26FF]/g, '')
    .replace(/\u2705|\u2611|\u2714|\u2716|\u274C|\u274E/g, '')
    .trim();
}

// ─── Public API ──────────────────────────────────────────────────────────────

export function downloadRulesPdf(
  tournamentName: string,
  subtitle: string,
  sections: PdfRuleSection[],
  filename: string,
): void {
  const pdf = new jsPDF('p', 'mm', 'a4');
  let y = MARGIN;

  /** Add a new page and reset cursor if not enough room. */
  const ensureSpace = (needed: number): void => {
    if (y + needed > BOTTOM) {
      pdf.addPage();
      y = MARGIN;
    }
  };

  // ── Title ────────────────────────────────────────────────────────────────
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(22);
  pdf.setTextColor(20, 20, 20);
  pdf.text('OFFICIAL AUCTION RULES', PAGE_W / 2, y + 8, { align: 'center' });
  y += 14;

  // ── Tournament name ──────────────────────────────────────────────────────
  pdf.setFontSize(13);
  pdf.setTextColor(0, 136, 204);
  pdf.text(tournamentName, PAGE_W / 2, y + 5, { align: 'center' });
  y += 10;

  // ── Subtitle ─────────────────────────────────────────────────────────────
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  pdf.setTextColor(100, 100, 100);
  const subLines = pdf.splitTextToSize(subtitle, CONTENT_W - 20);
  pdf.text(subLines, PAGE_W / 2, y + 3, { align: 'center' });
  y += subLines.length * 3.8 + 6;

  // ── Divider ──────────────────────────────────────────────────────────────
  pdf.setDrawColor(200, 200, 200);
  pdf.setLineWidth(0.3);
  pdf.line(MARGIN, y, PAGE_W - MARGIN, y);
  y += 8;

  // ── Sections ─────────────────────────────────────────────────────────────
  for (const section of sections) {
    const title = stripEmoji(section.title);

    // Measure first item so we can keep title + first item together
    const firstItemLines = section.items.length > 0
      ? pdf.splitTextToSize(section.items[0].text, CONTENT_W - NUM_W - 4) as string[]
      : [];
    const firstItemH = firstItemLines.length * LINE_H + ITEM_PAD * 2;
    ensureSpace(10 + firstItemH);

    // Section title
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(12);
    if (section.hl) {
      pdf.setTextColor(190, 120, 0); // warning-ish orange
    } else {
      pdf.setTextColor(0, 90, 170);  // accent blue
    }
    pdf.text(title.toUpperCase(), MARGIN, y + 5);

    // Title underline accent
    const titleW = pdf.getTextWidth(title.toUpperCase());
    pdf.setDrawColor(section.hl ? 210 : 0, section.hl ? 150 : 120, section.hl ? 30 : 200);
    pdf.setLineWidth(0.6);
    pdf.line(MARGIN, y + 7, MARGIN + titleW, y + 7);
    y += 12;

    // Items
    for (let i = 0; i < section.items.length; i++) {
      const item = section.items[i];
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(9.5);
      const textLines = pdf.splitTextToSize(item.text, CONTENT_W - NUM_W - 4) as string[];
      const blockH = textLines.length * LINE_H + ITEM_PAD * 2;

      ensureSpace(blockH);

      // Highlighted item background
      if (item.hl) {
        pdf.setFillColor(255, 248, 232);
        pdf.setDrawColor(230, 190, 100);
        pdf.setLineWidth(0.2);
        pdf.roundedRect(MARGIN, y, CONTENT_W, blockH, 1.5, 1.5, 'FD');
      } else {
        // Subtle border for regular items
        pdf.setFillColor(250, 250, 252);
        pdf.setDrawColor(225, 225, 230);
        pdf.setLineWidth(0.15);
        pdf.roundedRect(MARGIN, y, CONTENT_W, blockH, 1.5, 1.5, 'FD');
      }

      // Number
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(9.5);
      if (item.hl) {
        pdf.setTextColor(180, 110, 0);
      } else {
        pdf.setTextColor(0, 90, 170);
      }
      pdf.text(`${i + 1}.`, MARGIN + 3, y + ITEM_PAD + LINE_H - 0.5);

      // Body text
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(30, 30, 30);
      for (let l = 0; l < textLines.length; l++) {
        pdf.text(textLines[l], MARGIN + NUM_W + 2, y + ITEM_PAD + LINE_H * (l + 1) - 0.5);
      }

      y += blockH + 1.2;
    }

    y += 4; // gap between sections
  }

  // ── Footer on last page ────────────────────────────────────────────────
  pdf.setFont('helvetica', 'italic');
  pdf.setFontSize(8);
  pdf.setTextColor(150, 150, 150);
  pdf.text(
    `Generated from Cricket Auction Pro — ${new Date().toLocaleDateString()}`,
    PAGE_W / 2,
    PAGE_H - 8,
    { align: 'center' },
  );

  pdf.save(filename);
}
