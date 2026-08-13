import { Document, HeadingLevel, Packer, Paragraph, TextRun } from 'docx';

export async function generateQuarterlyDocx(title: string, tenantName: string, dateRange: string, markdownContent: string): Promise<Buffer> {
  const paragraphs: Paragraph[] = [
    new Paragraph({
      text: tenantName.toUpperCase(),
      heading: HeadingLevel.HEADING_3,
    }),
    new Paragraph({
      text: title,
      heading: HeadingLevel.TITLE,
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: `Period: ${dateRange}`,
          italics: true,
          color: '666666',
        }),
      ],
    }),
    new Paragraph({ text: '' }), // Spacing
  ];

  const lines = markdownContent.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (trimmed.startsWith('# ')) {
      paragraphs.push(
        new Paragraph({
          text: trimmed.replace('# ', ''),
          heading: HeadingLevel.HEADING_1,
        })
      );
    } else if (trimmed.startsWith('## ')) {
      paragraphs.push(
        new Paragraph({
          text: trimmed.replace('## ', ''),
          heading: HeadingLevel.HEADING_2,
        })
      );
    } else if (trimmed.startsWith('### ')) {
      paragraphs.push(
        new Paragraph({
          text: trimmed.replace('### ', ''),
          heading: HeadingLevel.HEADING_3,
        })
      );
    } else if (trimmed.startsWith('- ')) {
      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `• ${trimmed.replace('- ', '')}`,
            }),
          ],
        })
      );
    } else {
      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: trimmed.replace(/\*\*/g, ''),
            }),
          ],
        })
      );
    }
  }

  const doc = new Document({
    sections: [
      {
        properties: {},
        children: paragraphs,
      },
    ],
  });

  return await Packer.toBuffer(doc);
}
