// ============================================================
// Gate 4 Copy Arsenal — console recovery script
// Paste this into browser DevTools console on any page of the app.
// It reads the gate4 output from IndexedDB, extracts raw_output from
// sub-agent + lead log entries, parses the JSON, merges everything
// into gateOutput.data, and saves back.
// ============================================================

(async () => {
  const DB_NAME = 'pawen-command-center';

  function openDB() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  function stripFences(s) {
    if (!s) return '';
    let t = s.trim();
    t = t.replace(/^```(?:json)?\s*/i, '');
    t = t.replace(/```\s*$/i, '');
    return t.trim();
  }

  function tryParse(s) {
    const cleaned = stripFences(s);
    try { return JSON.parse(cleaned); } catch {}
    // Try to extract first balanced {...} block
    const start = cleaned.indexOf('{');
    if (start < 0) return null;
    let depth = 0, inStr = false, esc = false;
    for (let i = start; i < cleaned.length; i++) {
      const c = cleaned[i];
      if (inStr) {
        if (esc) { esc = false; continue; }
        if (c === '\\') { esc = true; continue; }
        if (c === '"') inStr = false;
        continue;
      }
      if (c === '"') { inStr = true; continue; }
      if (c === '{') depth++;
      else if (c === '}') {
        depth--;
        if (depth === 0) {
          try { return JSON.parse(cleaned.slice(start, i + 1)); } catch { return null; }
        }
      }
    }
    // Truncated — try to repair by closing open braces/brackets
    let repair = cleaned.slice(start);
    // Strip trailing partial line
    const lastComma = Math.max(repair.lastIndexOf(','), repair.lastIndexOf('}'), repair.lastIndexOf(']'));
    if (lastComma > 0) repair = repair.slice(0, lastComma + 1).replace(/,\s*$/, '');
    let openB = 0, openBr = 0;
    inStr = false; esc = false;
    for (const c of repair) {
      if (inStr) {
        if (esc) { esc = false; continue; }
        if (c === '\\') { esc = true; continue; }
        if (c === '"') inStr = false;
        continue;
      }
      if (c === '"') inStr = true;
      else if (c === '{') openB++;
      else if (c === '}') openB--;
      else if (c === '[') openBr++;
      else if (c === ']') openBr--;
    }
    if (inStr) repair += '"';
    while (openBr-- > 0) repair += ']';
    while (openB-- > 0) repair += '}';
    try { return JSON.parse(repair); } catch { return null; }
  }

  const db = await openDB();
  const tx = db.transaction(['gateOutputs', 'projects'], 'readwrite');
  const goStore = tx.objectStore('gateOutputs');
  const all = await new Promise((res, rej) => {
    const r = goStore.getAll();
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });

  const gate4Outputs = all.filter(g => g.gateId === 'gate4');
  if (gate4Outputs.length === 0) { console.error('❌ No gate4 output found'); return; }
  gate4Outputs.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
  const output = gate4Outputs[0];
  console.log('✅ Found gate4 output for project', output.projectId, 'updated', output.updatedAt);

  const log = output.generationLog || [];
  console.log(`📋 Log has ${log.length} entries`);

  // Collect all parseable JSONs: prefer lead (most merged), else merge sub-agents
  const merged = {};
  let leadParsed = null;

  for (const entry of log) {
    if (!entry.raw_output) continue;
    const parsed = tryParse(entry.raw_output);
    if (!parsed || typeof parsed !== 'object') continue;
    if (entry.agent === 'lead') {
      leadParsed = parsed;
      console.log('  ✓ lead parsed, keys:', Object.keys(parsed));
    } else if (entry.agent === 'sub-agent') {
      console.log(`  ✓ sub-agent parsed, keys:`, Object.keys(parsed));
      for (const [k, v] of Object.entries(parsed)) {
        if (merged[k] === undefined) merged[k] = v;
      }
    }
  }

  // Final data: lead as base (best merge), fill gaps from sub-agents
  const finalData = { ...merged };
  if (leadParsed) {
    for (const [k, v] of Object.entries(leadParsed)) {
      if (v !== null && v !== undefined) finalData[k] = v;
    }
  }

  console.log('🎯 Recovered keys:', Object.keys(finalData));
  console.log('🎯 Recovered data preview:', finalData);

  output.data = finalData;
  output.status = 'approved';
  output.updatedAt = new Date().toISOString();
  await new Promise((res, rej) => {
    const r = goStore.put(output);
    r.onsuccess = () => res();
    r.onerror = () => rej(r.error);
  });

  // Unlock next gate
  const projStore = tx.objectStore('projects');
  const project = await new Promise((res, rej) => {
    const r = projStore.get(output.projectId);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
  if (project) {
    project.gateStatuses = project.gateStatuses || {};
    project.gateStatuses.gate4 = 'approved';
    if (project.gateStatuses.gate5 === 'locked' || !project.gateStatuses.gate5) {
      project.gateStatuses.gate5 = 'available';
    }
    project.updatedAt = new Date().toISOString();
    await new Promise((res, rej) => {
      const r = projStore.put(project);
      r.onsuccess = () => res();
      r.onerror = () => rej(r.error);
    });
    console.log('✅ Project updated — gate4 approved, gate5 unlocked');
  }

  await new Promise(res => { tx.oncomplete = res; });
  console.log('✅ DONE. Refresh the page and go to Gate 4. Then proceed to Gate 5.');
})();
