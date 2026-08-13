import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

export async function generateQuarterlyPDF(title: string, tenantName: string, dateRange: string, markdownContent: string): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  let page = pdfDoc.addPage([595.28, 841.89]); // A4 dimensions in points

  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const { width, height } = page.getSize();
  const margin = 50;
  let yPos = height - margin;

  // Header Banner Background
  page.drawRectangle({
    x: 0,
    y: height - 100,
    width: width,
    height: 100,
    color: rgb(0.14, 0.38, 0.92), // Vibrant Royal Blue (#2563eb)
  });

  // Title Text
  page.drawText(tenantName.toUpperCase(), {
    x: margin,
    y: height - 40,
    size: 12,
    font: boldFont,
    color: rgb(0.8, 0.9, 1),
  });

  page.drawText(title, {
    x: margin,
    y: height - 70,
    size: 20,
    font: boldFont,
    color: rgb(1, 1, 1),
  });

  yPos = height - 130;

  // Date Range Badge
  page.drawText(`Date Range: ${dateRange}`, {
    x: margin,
    y: yPos,
    size: 10,
    font: boldFont,
    color: rgb(0.4, 0.4, 0.5),
  });

  yPos -= 25;

  // Horizontal divider line
  page.drawLine({
    start: { x: margin, y: yPos },
    end: { x: width - margin, y: yPos },
    thickness: 1,
    color: rgb(0.85, 0.85, 0.9),
  });

  yPos -= 25;

  // Render Markdown Content line by line
  const lines = markdownContent.split('\n');

  for (const line of lines) {
    if (yPos < margin + 40) {
      page = pdfDoc.addPage([595.28, 841.89]);
      yPos = height - margin;
    }

    const trimmed = line.trim();
    if (!trimmed) {
      yPos -= 10;
      continue;
    }

    if (trimmed.startsWith('# ')) {
      yPos -= 10;
      page.drawText(trimmed.replace('# ', ''), {
        x: margin,
        y: yPos,
        size: 16,
        font: boldFont,
        color: rgb(0.1, 0.15, 0.3),
      });
      yPos -= 22;
    } else if (trimmed.startsWith('## ')) {
      yPos -= 8;
      page.drawText(trimmed.replace('## ', ''), {
        x: margin,
        y: yPos,
        size: 14,
        font: boldFont,
        color: rgb(0.15, 0.35, 0.8),
      });
      yPos -= 18;
    } else if (trimmed.startsWith('### ')) {
      yPos -= 6;
      page.drawText(trimmed.replace('### ', ''), {
        x: margin,
        y: yPos,
        size: 12,
        font: boldFont,
        color: rgb(0.2, 0.2, 0.3),
      });
      yPos -= 16;
    } else if (trimmed.startsWith('- ')) {
      page.drawText(`•  ${trimmed.replace('- ', '')}`, {
        x: margin + 10,
        y: yPos,
        size: 10,
        font: font,
        color: rgb(0.25, 0.25, 0.3),
      });
      yPos -= 14;
    } else {
      // Regular text wrapping simulation
      const maxCharsPerLine = 80;
      let text = trimmed.replace(/\*\*/g, '');
      while (text.length > 0) {
        const chunk = text.substring(0, maxCharsPerLine);
        text = text.substring(maxCharsPerLine);

        page.drawText(chunk, {
          x: margin,
          y: yPos,
          size: 10,
          font: font,
          color: rgb(0.2, 0.2, 0.2),
        });
        yPos -= 14;

        if (yPos < margin + 40) {
          page = pdfDoc.addPage([595.28, 841.89]);
          yPos = height - margin;
        }
      }
    }
  }

  // Footer on last page
  page.drawText(`Generated on ${new Date().toLocaleDateString()} via Report Management SaaS PWA`, {
    x: margin,
    y: 20,
    size: 8,
    font: font,
    color: rgb(0.6, 0.6, 0.6),
  });

  return await pdfDoc.save();
}
