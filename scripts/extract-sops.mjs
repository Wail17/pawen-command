import mammoth from 'mammoth';
import fs from 'fs';
import path from 'path';

const FILES = [
  // NATIVE
  ['native', 'C:/Users/wailk/Downloads/NATIVE/Phase 1_ Before you write a single word.docx'],
  ['native', 'C:/Users/wailk/Downloads/NATIVE/Phase 2_ Story Elements.docx'],
  ['native', 'C:/Users/wailk/Downloads/NATIVE/Phase 3_ Reader\'s Psychology.docx'],
  ['native', 'C:/Users/wailk/Downloads/NATIVE/Phase 4_ Hooks & Close.docx'],
  ['native', 'C:/Users/wailk/Downloads/NATIVE/Phase 5_ Native Image Psychology.docx'],
  ['native', 'C:/Users/wailk/Downloads/NATIVE/Bonus_ AI Prompts to generate winning native ads fast.docx'],
  ['native', 'C:/Users/wailk/Downloads/NATIVE/cellumove-image-prompts-brief.docx'],
  ['native', 'C:/Users/wailk/Downloads/NATIVE/(NEW) Running Case Study_ The Doctor Ad.docx'],
  // ZAK static
  ['zak', 'C:/Users/wailk/Downloads/DOC-ZAK-PROMPT/ZAK_PROMPT_Image_Ads.docx'],
  ['zak', 'C:/Users/wailk/Downloads/DOC-ZAK-PROMPT/ZAK_PROMPT_Image_Ads_US_vs_Others.docx'],
  ['zak', 'C:/Users/wailk/Downloads/DOC-ZAK-PROMPT/ZAK_PROMPT_Visual_Inspiration.docx'],
  ['zak', 'C:/Users/wailk/Downloads/DOC-ZAK-PROMPT/ZAK_DOC_Research_to_Image_Ads_SOP.docx'],
  ['zak', 'C:/Users/wailk/Downloads/DOC-ZAK-PROMPT/ZAK_PROMPT_Hook_Generator.pdf'],
  ['zak', 'C:/Users/wailk/Downloads/DOC-ZAK-PROMPT/ZAK_PROMPT_Ad_Concepts_Scripts.docx'],
  // EVOLVE static
  ['evolve', 'C:/Users/wailk/Downloads/Prompt-Doc-Evolve/EVOLVE_PROMPT_Static_Ads.docx'],
  ['evolve', 'C:/Users/wailk/Downloads/Prompt-Doc-Evolve/EVOLVE_PROMPT_Master_All_Prompts.docx'],
];

const OUT = 'C:/Users/wailk/AUTOMATISATION-IA/pawen-command-center/tmp-sops';
fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(path.join(OUT, 'native'), { recursive: true });
fs.mkdirSync(path.join(OUT, 'zak'), { recursive: true });
fs.mkdirSync(path.join(OUT, 'evolve'), { recursive: true });

for (const [bucket, f] of FILES) {
  if (!f.endsWith('.docx')) { console.log('SKIP (not docx)', f); continue; }
  try {
    const r = await mammoth.extractRawText({ path: f });
    const name = path.basename(f).replace(/\.docx$/, '').replace(/[^a-zA-Z0-9]+/g, '_') + '.txt';
    const out = path.join(OUT, bucket, name);
    fs.writeFileSync(out, r.value);
    console.log('OK', bucket, name, r.value.length, 'chars');
  } catch (e) {
    console.log('ERR', f, e.message);
  }
}
