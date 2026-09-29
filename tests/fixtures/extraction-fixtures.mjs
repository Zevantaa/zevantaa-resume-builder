import { gunzipSync } from "node:zlib";
import { readFileSync } from "node:fs";

export const legacyDocFixture = () => gunzipSync(Buffer.from(
  readFileSync(new URL("./legacy-doc-generic.doc.gz.b64", import.meta.url), "utf8").replace(/\s/g, ""),
  "base64",
));

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function zip(entries) {
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const [filename, contents] of entries) {
    const name = Buffer.from(filename);
    const body = Buffer.from(contents);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt32LE(crc32(body), 14);
    local.writeUInt32LE(body.length, 18);
    local.writeUInt32LE(body.length, 22);
    local.writeUInt16LE(name.length, 26);
    locals.push(local, name, body);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt32LE(crc32(body), 16);
    central.writeUInt32LE(body.length, 20);
    central.writeUInt32LE(body.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(offset, 42);
    centrals.push(central, name);
    offset += local.length + name.length + body.length;
  }
  const directory = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, directory, end]);
}

const xml = (text) => text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
const paragraph = (text) => `<w:p><w:r><w:t>${xml(text)}</w:t></w:r></w:p>`;

export function docxFixture({ paragraphs = [], tableRows = [], malformed = false, macro = false } = {}) {
  const table = tableRows.length ? `<w:tbl>${tableRows.map((row) =>
    `<w:tr>${row.map((cell) => `<w:tc>${paragraph(cell)}</w:tc>`).join("")}</w:tr>`).join("")}</w:tbl>` : "";
  const document = malformed ? "<w:document><w:body><w:p>broken" :
    `<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${paragraphs.map(paragraph).join("")}${table}</w:body></w:document>`;
  const entries = [
    ["[Content_Types].xml", `<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`],
    ["_rels/.rels", `<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`],
    ["word/document.xml", document],
  ];
  if (macro) entries.push(["word/vbaProject.bin", "synthetic macro marker; never executed"]);
  return zip(entries);
}

export function pdfFixture(pages, { imageOnly = false, encrypted = false } = {}) {
  const objects = [];
  const add = (body) => { objects.push(body); return objects.length; };
  const catalogId = add("");
  const pagesId = add("");
  const fontId = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  const imageId = imageOnly ? add("<< /Type /XObject /Subtype /Image /Width 1 /Height 1 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /ASCIIHexDecode /Length 7 >>\nstream\nFFFFFF>\nendstream") : null;
  const encryptId = encrypted ? add(`<< /Filter /Standard /V 1 /R 2 /Length 40 /O <${"00".repeat(32)}> /U <${"00".repeat(32)}> /P -4 >>`) : null;
  const pageIds = [];
  for (const text of pages) {
    const escaped = text.replaceAll("\\", "\\\\").replaceAll("(", "\\(").replaceAll(")", "\\)");
    const commands = imageOnly ? "q 1 0 0 1 72 720 cm /Im1 Do Q" : `BT /F1 12 Tf 72 720 Td (${escaped}) Tj ET`;
    const streamId = add(`<< /Length ${Buffer.byteLength(commands)} >>\nstream\n${commands}\nendstream`);
    const pageId = add(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${fontId} 0 R >> ${imageId ? `/XObject << /Im1 ${imageId} 0 R >>` : ""} >> /Contents ${streamId} 0 R >>`);
    pageIds.push(pageId);
  }
  objects[catalogId - 1] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`;
  objects[pagesId - 1] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`;
  let content = "%PDF-1.4\n";
  const offsets = [0];
  for (const [index, body] of objects.entries()) {
    offsets.push(Buffer.byteLength(content));
    content += `${index + 1} 0 obj\n${body}\nendobj\n`;
  }
  const startXref = Buffer.byteLength(content);
  content += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  content += offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("");
  content += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R ${encryptId ? `/Encrypt ${encryptId} 0 R /ID [<${"00".repeat(16)}> <${"00".repeat(16)}>]` : ""} >>\nstartxref\n${startXref}\n%%EOF`;
  return Buffer.from(content);
}
