// Minimal single-page PDF writer (Helvetica, WinAnsi). Used to create the seeded demo
// documents so downloads are real PDFs without adding a PDF library dependency.
function makePdf(title, lines) {
  const esc = (s) => String(s).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
  const body = [
    'BT /F2 18 Tf 56 780 Td (' + esc(title) + ') Tj ET',
    'BT /F1 11 Tf 56 750 Td 16 TL',
    ...lines.map((l, i) => (i ? 'T* ' : '') + '(' + esc(l) + ') Tj'),
    'ET',
  ].join('\n');
  const content = Buffer.from(body, 'latin1');
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>',
  ];
  const chunks = [Buffer.from('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n', 'latin1')];
  const offsets = [];
  let pos = chunks[0].length;
  const push = (buf) => { chunks.push(buf); pos += buf.length; };
  objects.forEach((o, i) => { offsets.push(pos); push(Buffer.from(`${i + 1} 0 obj\n${o}\nendobj\n`, 'latin1')); });
  offsets.push(pos);
  push(Buffer.concat([Buffer.from(`6 0 obj\n<< /Length ${content.length} >>\nstream\n`, 'latin1'), content, Buffer.from('\nendstream\nendobj\n', 'latin1')]));
  const xrefPos = pos;
  const xref = ['xref', '0 7', '0000000000 65535 f ', ...offsets.map((o) => String(o).padStart(10, '0') + ' 00000 n ')].join('\n');
  push(Buffer.from(`${xref}\ntrailer\n<< /Size 7 /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF\n`, 'latin1'));
  return Buffer.concat(chunks);
}

module.exports = { makePdf };
