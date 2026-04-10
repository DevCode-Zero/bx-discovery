/* ─── STATE ─────────────────────────────────────────────────────────────────── */
const answers = Array.from({length:5}, () => ({selections:[], text:''}));
const qMeta = [
  {theme:'Vision + Mission + Winning Definition', short:'Business Vision (12–36 months)'},
  {theme:'Annual Objective / Growth Target', short:'Primary Goal This Year'},
  {theme:'Execution Thesis — Key Growth Levers', short:'Key Growth Levers (2–3)'},
  {theme:'Customer & Market Focus', short:'Target Customers & Markets'},
  {theme:'Current Reality — Performance Constraints', short:'What Is Blocking Growth'},
];
const timeLeft = ['~10 min remaining','~8 min remaining','~6 min remaining','~3 min remaining','~1 min remaining'];
let currentQ = 0;
let recognition = null;
let profile = {name:'',email:'',company:'',industry:'',stage:'',role:''};
let geoData = null;

const MIC_SVG = `<svg class="mic-svg" viewBox="0 0 24 24"><rect x="9" y="2" width="6" height="11" rx="3"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>`;
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;

/* ─── GEO LOOKUP (cached per session) ───────────────────────────────────────── */
(async function tryGeo() {
  const cached = sessionStorage.getItem('geoData');
  if (cached) {
    geoData = JSON.parse(cached);
    document.getElementById('geoText').textContent = `${geoData.city}, ${geoData.country}`;
    document.getElementById('geoBadge').classList.add('visible');
    return;
  }
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 3000);
    const r = await fetch('https://ipapi.co/json/', {signal: ctrl.signal});
    clearTimeout(timer);
    if (!r.ok) return;
    const d = await r.json();
    if (d.city && d.country_name) {
      geoData = {city: d.city, region: d.region, country: d.country_name, timezone: d.timezone};
      sessionStorage.setItem('geoData', JSON.stringify(geoData));
      document.getElementById('geoText').textContent = `${d.city}, ${d.country_name}`;
      document.getElementById('geoBadge').classList.add('visible');
    }
  } catch(e) { /* silently skip */ }
})();

/* ─── PROFILE ────────────────────────────────────────────────────────────────── */
function onProfileSelect() {
  const hasSelection = document.getElementById('pIndustry').value || document.getElementById('pStage').value;
  ['nameReq','emailReq','companyReq','industryReq','stageReq'].forEach(id => {
    document.getElementById(id).style.display = hasSelection ? 'inline' : 'none';
  });
  ['nameOpt','emailOpt','companyOpt'].forEach(id => {
    document.getElementById(id).style.display = hasSelection ? 'none' : 'inline';
  });
  document.getElementById('profileNote').style.display = hasSelection ? 'none' : 'block';
  document.getElementById('profileNoteRequired').style.display = hasSelection ? 'block' : 'none';
}

function toggleProfile() {
  document.getElementById('profilePanel').classList.toggle('open');
}

function saveProfile() {
  const industry = document.getElementById('pIndustry').value;
  const stage = document.getElementById('pStage').value;
  const hasSelection = industry || stage;
  const name = document.getElementById('pName').value.trim();
  const email = document.getElementById('pEmail').value.trim();
  const company = document.getElementById('pCompany').value.trim();
  if (hasSelection && (!name || !email || !company)) {
    alert('Please fill in your name, work email, and company name to apply personalisation.');
    return;
  }
  profile = { name, email, company, industry, stage, role: document.getElementById('pRole').value };
  const badge = document.getElementById('profileSavedBadge');
  badge.style.display = 'inline';
  setTimeout(() => { badge.style.display = 'none'; }, 2500);
  if (hasSelection) document.getElementById('profileTeaser').style.display = 'none';
}

/* ─── PROGRESS ───────────────────────────────────────────────────────────────── */
function updateProgress(q) {
  document.querySelectorAll('.step-dot').forEach((d,i) => {
    d.classList.remove('done','active');
    if (i < q) d.classList.add('done');
    else if (i === q) d.classList.add('active');
  });
  document.getElementById('progressLabel').textContent = q < 5
    ? `Question ${q+1} of 5 · ${timeLeft[q]}`
    : 'Complete';
}

/* ─── PILLS ──────────────────────────────────────────────────────────────────── */
document.querySelectorAll('.options-grid').forEach(grid => {
  const isMulti = grid.dataset.multi === 'true';
  const max = parseInt(grid.dataset.max) || 99;
  const qIdx = parseInt(grid.dataset.q);
  grid.querySelectorAll('.option-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      const val = pill.dataset.value;
      if (!isMulti) {
        grid.querySelectorAll('.option-pill').forEach(p => p.classList.remove('selected'));
        answers[qIdx].selections = [val];
        pill.classList.add('selected');
      } else {
        if (pill.classList.contains('selected')) {
          pill.classList.remove('selected');
          answers[qIdx].selections = answers[qIdx].selections.filter(v => v !== val);
        } else if (grid.querySelectorAll('.option-pill.selected').length < max) {
          pill.classList.add('selected');
          answers[qIdx].selections.push(val);
        }
      }
    });
  });
});

document.querySelectorAll('.response-input').forEach((ta,i) => {
  ta.addEventListener('input', () => { answers[i].text = ta.value; });
});

/* ─── NAVIGATION ─────────────────────────────────────────────────────────────── */
function hideAllScreens() {
  document.getElementById('workshopScreen').style.display = 'none';
  document.getElementById('workshopScreen').classList.remove('active');
  document.getElementById('summaryScreen').classList.remove('active');
  document.getElementById('leadScreen').classList.remove('active');
}

function showCard(idx) {
  hideAllScreens();
  document.getElementById('questionArea').style.display = '';
  document.querySelectorAll('.question-card').forEach(c => c.classList.remove('active'));
  const card = document.querySelector(`.question-card[data-q="${idx}"]`);
  if (card) { void card.offsetWidth; card.classList.add('active'); }
  currentQ = idx;
  updateProgress(idx);
  window.scrollTo({top:0, behavior:'smooth'});
}

function nextQ(idx) { if (idx < 4) showCard(idx+1); }
function prevQ(idx) { if (idx > 0) showCard(idx-1); }

/* ─── SUMMARY ────────────────────────────────────────────────────────────────── */
function showSummary() {
  document.querySelectorAll('.response-input').forEach((ta,i) => { answers[i].text = ta.value; });
  hideAllScreens();
  document.getElementById('questionArea').style.display = 'none';
  updateProgress(5);
  const cards = document.getElementById('summaryCards');
  cards.innerHTML = '';
  answers.forEach((ans,i) => {
    const combined = [...ans.selections, ...(ans.text.trim() ? [ans.text.trim()] : [])];
    const content = combined.length
      ? combined.map(v => `<span class="sc-tag">${v}</span>`).join('')
      : '<span class="sc-empty">No response recorded</span>';
    cards.innerHTML += `<div class="summary-card"><div class="sc-label">${qMeta[i].short}</div><div class="sc-answers">${content}</div></div>`;
  });
  document.getElementById('summaryScreen').classList.add('active');
  window.scrollTo({top:0, behavior:'smooth'});
}

/* ─── WORKSHOP GENERATION — calls /api/generate (server holds the API key) ───── */
async function generateWorkshop() {
  document.getElementById('summaryScreen').classList.remove('active');
  const wsScreen = document.getElementById('workshopScreen');
  wsScreen.style.display = '';
  wsScreen.classList.add('active');
  window.scrollTo({top:0, behavior:'smooth'});

  const profileCtx = (profile.industry || profile.stage || profile.role)
    ? `\nEXECUTIVE PROFILE: Industry: ${profile.industry||'not specified'} | Stage: ${profile.stage||'not specified'} | Role: ${profile.role||'not specified'}${profile.name ? ' | Name: '+profile.name : ''}`
    : '';
  const geoCtx = geoData ? `\nLOCATION CONTEXT: ${geoData.city}, ${geoData.country}` : '';

  const brief = answers.map((a,i) => {
    const combined = [...a.selections, ...(a.text.trim() ? [a.text.trim()] : [])].join('; ');
    return `${qMeta[i].theme}:\n${combined || 'Not specified'}`;
  }).join('\n\n');

  const prompt = `You are a world-class business strategy facilitator and executive coach at BX Consulting — a firm that uses responsible AI to deliver exceptional consulting outcomes. Based on this executive pre-discovery interview, design a detailed, executive-calibre half-day discovery workshop.
${profileCtx}${geoCtx}

EXECUTIVE INTERVIEW RESULTS:
${brief}

Design the workshop with these exact sections — be specific, punchy, and connect everything directly to what this executive said. No generic filler. No consulting clichés.

## 1. WORKSHOP TITLE & PURPOSE
Give it a memorable, specific title (not "Discovery Workshop"). Write 2 sharp sentences on exactly what this session exists to accomplish for this executive.

## 2. PRE-WORK (Before the Room)
List 3–4 specific things participants must prepare and bring — make each item directly relevant to their stated constraints and goals.

## 3. HALF-DAY AGENDA
Include precise timings. Build 4 focused modules tied to their answers:
- 08:30 — Opening: Strategic Stakes & Context (30 min)
- Module 1: Winning Definition — Where We Play & How We Win
- Module 2: Growth Mechanics — Testing the Thesis Against Reality
- Module 3: Customer Value & Market Sequencing
- Module 4: Constraint Breakdown — The Honest Blockers Session
- Closing: Decisions, Owners, Committed Dates

## 4. KEY PROVOCATIONS
Write 5 sharp, uncomfortable questions the facilitator should ask in the room — each one specific to what this executive shared. Make them confrontational in a constructive way.

## 5. WORKSHOP OUTPUTS
List exactly what physical or digital outputs the room must produce before everyone leaves.

## 6. FACILITATION WATCH-OUTS
3 specific dynamics to watch for, based on what this executive revealed — name the risks, tensions, or avoidance patterns to manage.

Use **bold** for key terms. Keep every section tight and actionable. This goes to a C-suite audience.`;

  const output = document.getElementById('workshopOutput');
  output.innerHTML = '<div class="loading-state">Building your workshop plan <div class="dots"><span></span><span></span><span></span></div></div>';

  try {
    // ✅ Calls your own server — API key never exposed to the browser
    const resp = await fetch('/api/generate', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ prompt })
    });

    if (!resp.ok) {
      const errData = await resp.json().catch(() => ({}));
      throw new Error(errData.error || `Server error: HTTP ${resp.status}`);
    }

    const data = await resp.json();
    const text = data.content?.map(b => b.text || '').join('') || 'No content returned.';
    renderWorkshop(text);
    document.getElementById('outputActions').style.display = 'flex';
  } catch (err) {
    output.innerHTML = `<p style="color:var(--danger);font-weight:500;">
      ⚠ Could not generate workshop plan.<br>
      <span style="font-size:12px;font-weight:400;">${err.message}</span><br><br>
      <span style="font-size:12px;color:var(--muted);">
        If this persists, please contact support.
      </span>
    </p>`;
  }
}

/* ─── RENDER MARKDOWN-LIKE OUTPUT ────────────────────────────────────────────── */
function renderWorkshop(md) {
  const el = document.getElementById('workshopOutput');
  let html = md
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/^[-•] (.+)$/gm, '<li>$1</li>')
    .replace(/\n\n+/g, '</p><p>')
    .replace(/\n(?!<)/g, '<br>');
  el.innerHTML = '<p>' + html + '</p>';
}

/* ─── COPY TO CLIPBOARD ──────────────────────────────────────────────────────── */
function copyWorkshop() {
  const text = document.getElementById('workshopOutput').innerText;
  navigator.clipboard.writeText(text).then(() => {
    const btn = document.querySelector('.action-btn.primary');
    const orig = btn.textContent;
    btn.textContent = '✓ Copied';
    setTimeout(() => btn.textContent = orig, 2500);
  }).catch(() => alert('Copy failed — please select and copy manually.'));
}

/* ─── EDIT ANSWERS ───────────────────────────────────────────────────────────── */
function editAnswers() {
  hideAllScreens();
  document.getElementById('questionArea').style.display = '';
  document.getElementById('updateNotice').style.display = 'none';
  showCard(0);
}

/* ─── LEAD CAPTURE ───────────────────────────────────────────────────────────── */
function showLeadCapture() {
  document.getElementById('workshopScreen').classList.remove('active');
  document.getElementById('workshopScreen').style.display = 'none';
  document.getElementById('leadScreen').classList.add('active');
  if (profile.name) document.getElementById('lFirst').value = profile.name;
  if (profile.email) document.getElementById('lEmail').value = profile.email;
  if (profile.company) document.getElementById('lCompany').value = profile.company;
  window.scrollTo({top:0, behavior:'smooth'});
}

function backToWorkshop() {
  document.getElementById('leadScreen').classList.remove('active');
  document.getElementById('workshopScreen').style.display = '';
  document.getElementById('workshopScreen').classList.add('active');
  window.scrollTo({top:0, behavior:'smooth'});
}

function submitLead() {
  const first = document.getElementById('lFirst').value.trim();
  const email = document.getElementById('lEmail').value.trim();
  const company = document.getElementById('lCompany').value.trim();
  if (!first || !email || !company) {
    alert('Please fill in your first name, work email, and company name to continue.');
    return;
  }
  const leadData = {
    timestamp: new Date().toISOString(),
    firstName: first,
    lastName: document.getElementById('lLast').value.trim(),
    email, company,
    website: document.getElementById('lUrl').value.trim(),
    note: document.getElementById('lNote').value.trim(),
    profile, geoData,
    answers: answers.map((a,i) => ({
      question: qMeta[i].short,
      selections: a.selections,
      freeText: a.text
    }))
  };
  console.log('Lead captured:', JSON.stringify(leadData, null, 2));
  document.getElementById('leadForm').style.display = 'none';
  document.getElementById('leadSuccess').style.display = 'block';
  document.getElementById('updateNotice').style.display = 'block';
}

/* ─── RESTART ────────────────────────────────────────────────────────────────── */
function restartInterview() {
  answers.forEach(a => { a.selections = []; a.text = ''; });
  document.querySelectorAll('.option-pill').forEach(p => p.classList.remove('selected'));
  document.querySelectorAll('.response-input').forEach(ta => ta.value = '');
  document.getElementById('outputActions').style.display = 'none';
  document.getElementById('updateNotice').style.display = 'none';
  document.getElementById('leadForm').style.display = 'block';
  document.getElementById('leadSuccess').style.display = 'none';
  showCard(0);
}

/* ─── VOICE INPUT ────────────────────────────────────────────────────────────── */
function toggleVoice(btn, qIdx) {
  if (!SR) { document.getElementById(`voiceStatus${qIdx}`).textContent = 'Voice not supported (try Chrome or Edge)'; return; }
  if (btn.classList.contains('recording')) { recognition?.stop(); return; }
  recognition?.abort();
  const status = document.getElementById(`voiceStatus${qIdx}`);
  const textarea = document.querySelectorAll('.response-input')[qIdx];
  recognition = new SR();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = 'en-US';
  let finalText = textarea.value;
  recognition.onstart = () => {
    btn.classList.add('recording');
    btn.innerHTML = `${MIC_SVG} Stop recording`;
    status.textContent = '● Recording…';
  };
  recognition.onresult = (e) => {
    let interim = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      if (e.results[i].isFinal) finalText += e.results[i][0].transcript + ' ';
      else interim = e.results[i][0].transcript;
    }
    textarea.value = finalText + interim;
    answers[qIdx].text = textarea.value;
  };
  recognition.onerror = (e) => {
    btn.classList.remove('recording');
    btn.innerHTML = `${MIC_SVG} Speak response`;
    status.textContent = e.error === 'not-allowed'
      ? 'Microphone access denied — check browser permissions'
      : `Error: ${e.error}`;
  };
  recognition.onend = () => {
    btn.classList.remove('recording');
    btn.innerHTML = `${MIC_SVG} Speak response`;
    status.textContent = answers[qIdx].text.trim() ? '✓ Transcribed successfully' : '';
  };
  recognition.start();
}

/* ─── INIT ───────────────────────────────────────────────────────────────────── */
updateProgress(0);

/* ─── ADMIN LOGIN ────────────────────────────────────────────────────────────── */
function sendPrompt(message) {
  console.log('sendPrompt called with:', message);
  window.location.href = '/discovery';
}
