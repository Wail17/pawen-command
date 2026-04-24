// ============================================================
// PAWEN — Gate Output Export (MD + PDF)
// Employees → PDF (printable), AI → Markdown (structured)
// Only exports the `data` payload, not review/congruence/log.
// ============================================================

import type { GateOutput, GateId, Project } from '@/lib/types';
import { getGateLabel } from '@/lib/store/project-utils';

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function humanize(key: string): string {
  return key
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, c => c.toUpperCase());
}

function renderValue(value: unknown, depth: number): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);

  if (Array.isArray(value)) {
    if (value.length === 0) return '_(empty)_';

    // Array of primitives — bullet list
    if (value.every(v => typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean')) {
      return value.map(v => `- ${v}`).join('\n');
    }

    // Array of objects — numbered sections
    return value
      .map((item, i) => {
        if (isPlainObject(item)) {
          const title =
            (item.name as string) ||
            (item.title as string) ||
            (item.label as string) ||
            (item.headline as string) ||
            (item.hook as string) ||
            (item.id as string) ||
            `Item ${i + 1}`;
          const heading = '#'.repeat(Math.min(depth + 2, 6));
          return `${heading} ${title}\n\n${renderObject(item, depth + 1)}`;
        }
        return `- ${renderValue(item, depth + 1)}`;
      })
      .join('\n\n');
  }

  if (isPlainObject(value)) {
    return renderObject(value, depth);
  }

  return String(value);
}

function renderObject(obj: Record<string, unknown>, depth: number): string {
  const lines: string[] = [];

  for (const [key, value] of Object.entries(obj)) {
    if (value === null || value === undefined) continue;
    if (key.startsWith('_')) continue; // skip internals like _key

    const label = humanize(key);

    if (isPlainObject(value)) {
      const heading = '#'.repeat(Math.min(depth + 2, 6));
      lines.push(`${heading} ${label}\n\n${renderObject(value, depth + 1)}`);
    } else if (Array.isArray(value)) {
      const heading = '#'.repeat(Math.min(depth + 2, 6));
      lines.push(`${heading} ${label}\n\n${renderValue(value, depth)}`);
    } else {
      const rendered = renderValue(value, depth);
      if (rendered.includes('\n') || rendered.length > 120) {
        lines.push(`**${label}:**\n\n${rendered}`);
      } else {
        lines.push(`**${label}:** ${rendered}`);
      }
    }
  }

  return lines.join('\n\n');
}

export function buildGateMarkdown(
  project: Project,
  gateId: GateId,
  output: GateOutput,
): string {
  const header = `# ${getGateLabel(gateId)}

**Project:** ${project.name}
**Market:** ${project.targetMarket} (${project.targetLanguage})
**Generated:** ${new Date(output.updatedAt).toLocaleString()}

---

`;

  // If data has a single top-level key wrapping everything, unwrap it for nicer output
  let data = output.data;
  const topKeys = Object.keys(data);
  if (topKeys.length === 1 && isPlainObject(data[topKeys[0]])) {
    data = data[topKeys[0]] as Record<string, unknown>;
  }

  const body = renderObject(data, 0);
  return header + body + '\n';
}

function safeFilename(s: string): string {
  return s.replace(/[^a-z0-9_-]+/gi, '_').replace(/_+/g, '_').slice(0, 60);
}

export function downloadMarkdown(project: Project, gateId: GateId, output: GateOutput): void {
  const md = buildGateMarkdown(project, gateId, output);
  const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${safeFilename(project.name)}_${gateId}.md`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function markdownToHtml(md: string): string {
  // Minimal MD → HTML for print. Handles the subset our generator produces.
  const lines = md.split('\n');
  const out: string[] = [];
  let inList = false;

  const closeList = () => {
    if (inList) {
      out.push('</ul>');
      inList = false;
    }
  };

  const inlineFmt = (s: string) =>
    s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\*([^*]+)\*/g, '<em>$1</em>')
      .replace(/`([^`]+)`/g, '<code>$1</code>');

  for (const line of lines) {
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      closeList();
      const lvl = h[1].length;
      out.push(`<h${lvl}>${inlineFmt(h[2])}</h${lvl}>`);
      continue;
    }
    if (line.startsWith('- ')) {
      if (!inList) {
        out.push('<ul>');
        inList = true;
      }
      out.push(`<li>${inlineFmt(line.slice(2))}</li>`);
      continue;
    }
    if (line.trim() === '---') {
      closeList();
      out.push('<hr/>');
      continue;
    }
    if (line.trim() === '') {
      closeList();
      continue;
    }
    closeList();
    out.push(`<p>${inlineFmt(line)}</p>`);
  }
  closeList();
  return out.join('\n');
}

export function exportGateAsPDF(
  project: Project,
  gateId: GateId,
  output: GateOutput,
): void {
  const md = buildGateMarkdown(project, gateId, output);
  const htmlBody = markdownToHtml(md);

  const doc = `<!doctype html>
<html lang="${project.targetLanguage}">
<head>
<meta charset="utf-8"/>
<title>${project.name} — ${getGateLabel(gateId)}</title>
<style>
  @page { margin: 2cm 1.8cm; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
    color: #111; line-height: 1.55; font-size: 11pt;
    max-width: 760px; margin: 0 auto;
  }
  h1 { font-size: 22pt; margin: 0 0 0.4em; border-bottom: 2px solid #111; padding-bottom: 6pt; }
  h2 { font-size: 16pt; margin: 1.4em 0 0.4em; color: #111; }
  h3 { font-size: 13pt; margin: 1.1em 0 0.3em; color: #222; }
  h4 { font-size: 11.5pt; margin: 0.9em 0 0.3em; color: #333; }
  h5, h6 { font-size: 11pt; margin: 0.7em 0 0.2em; color: #444; }
  p { margin: 0.35em 0 0.7em; }
  ul { margin: 0.3em 0 0.8em 1.2em; padding: 0; }
  li { margin: 0.15em 0; }
  strong { color: #000; }
  hr { border: none; border-top: 1px solid #ccc; margin: 1.2em 0; }
  code { background: #f3f3f3; padding: 1px 5px; border-radius: 3px; font-size: 0.9em; }
  @media print {
    h2, h3 { break-after: avoid; }
    li, p { break-inside: avoid; }
  }
</style>
</head>
<body>
${htmlBody}
<script>
  window.addEventListener('load', () => { setTimeout(() => window.print(), 200); });
</script>
</body>
</html>`;

  const w = window.open('', '_blank');
  if (!w) {
    alert('Pop-up blocked — autorise les pop-ups pour exporter en PDF.');
    return;
  }
  w.document.open();
  w.document.write(doc);
  w.document.close();
}
