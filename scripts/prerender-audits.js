#!/usr/bin/env node
// prerender-audits.js
// Generates static HTML pages for all audit cards in audits/index.html.
// Run from site root: node scripts/prerender-audits.js

'use strict';
const fs   = require('fs');
const path = require('path');
const vm   = require('vm');

// ─── Paths ────────────────────────────────────────────────────────────────────
const ROOT        = path.join(__dirname, '..');
const AUDITS_DIR  = path.join(ROOT, 'audits');
const INDEX_PATH  = path.join(AUDITS_DIR, 'index.html');
const FDATA_PATH  = path.join(AUDITS_DIR, 'detail', 'firm-data.js');
const SITEMAP     = path.join(ROOT, 'sitemap.xml');
const ROBOTS      = path.join(ROOT, 'robots.txt');
const VERCEL_JSON = path.join(ROOT, 'vercel.json');
const LLMS_TXT    = path.join(ROOT, 'llms.txt');

// ─── Category labels ──────────────────────────────────────────────────────────
const CAT_LABELS = {
  'venue':              'Event Venue',
  'medical':            'Medical',
  'immigration':        'Immigration Law',
  'personal-injury':    'Personal Injury Law',
  'criminal-defense':   'Criminal Defense Law',
  'family-law':         'Family Law',
  'fire-protection':    'Fire Protection',
  'generator-service':  'Commercial Generator Service',
  'general':            'General Business',
  'general-practice':   'General Practice',
};

// ─── Fallback data arrays (ported from detail/index.html) ─────────────────────
const ISSUES_BY_CAT = {
  'venue': [
    { label: 'Google Business Profile',   value: 'Unverified or missing',    status: 'critical' },
    { label: 'Event-type landing pages',  value: 'Not present',              status: 'critical' },
    { label: 'Schema markup (Event)',      value: 'Not implemented',          status: 'critical' },
    { label: 'Photo gallery content',     value: 'Thin or absent',           status: 'warning'  },
  ],
  'medical': [
    { label: 'Procedure landing pages',   value: 'Not present',              status: 'critical' },
    { label: 'Medical schema markup',     value: 'Not implemented',          status: 'critical' },
    { label: 'Spanish-language content',  value: 'Absent',                   status: 'critical' },
    { label: 'Before/after content',      value: 'Missing or thin',          status: 'warning'  },
  ],
  'immigration': [
    { label: 'Bilingual content (ES/EN)', value: 'Not present',              status: 'critical' },
    { label: 'Visa-type landing pages',   value: 'Not present',              status: 'critical' },
    { label: 'Attorney schema markup',    value: 'Not implemented',          status: 'critical' },
    { label: 'Google Business Profile',   value: 'Incomplete',               status: 'warning'  },
  ],
  'personal-injury': [
    { label: 'Practice area pages',       value: 'Missing or generic',       status: 'critical' },
    { label: 'LegalService schema',       value: 'Not implemented',          status: 'critical' },
    { label: 'Accident type content',     value: 'Not present',              status: 'critical' },
    { label: 'Local geo pages',           value: 'Not present',              status: 'warning'  },
  ],
  'criminal-defense': [
    { label: 'DUI/charge-type pages',     value: 'Not present',              status: 'critical' },
    { label: 'Attorney bio schema',       value: 'Not implemented',          status: 'critical' },
    { label: 'Local jurisdiction content',value: 'Absent',                   status: 'critical' },
    { label: 'Case result content',       value: 'Missing',                  status: 'warning'  },
  ],
  'family-law': [
    { label: 'Divorce/custody pages',     value: 'Not present',              status: 'critical' },
    { label: 'LegalService schema',       value: 'Not implemented',          status: 'critical' },
    { label: 'County-specific content',   value: 'Absent',                   status: 'critical' },
    { label: 'Attorney authority content',value: 'Thin',                     status: 'warning'  },
  ],
  'fire-protection': [
    { label: 'Service-type landing pages',value: 'Not present',              status: 'critical' },
    { label: 'LocalBusiness schema',      value: 'Not implemented',          status: 'critical' },
    { label: 'Certifications content',    value: 'Missing or thin',          status: 'warning'  },
    { label: 'Google Business Profile',   value: 'Incomplete',               status: 'warning'  },
  ],
  'generator-service': [
    { label: 'Service-type landing pages',value: 'Not present',              status: 'critical' },
    { label: 'LocalBusiness schema',      value: 'Not implemented',          status: 'critical' },
    { label: 'Brand/model content',       value: 'Missing or thin',          status: 'warning'  },
    { label: 'Google Business Profile',   value: 'Incomplete',               status: 'warning'  },
  ],
};

const IMPACT_BY_CAT = {
  'venue': {
    intro:       'Every unfilled weekend is a direct revenue loss. Event venues that rank on page 1 capture 70%+ of all organic booking inquiries in their market.',
    volume:      '800+',    volumeNote:   'Monthly local searches for event venues in this market',
    leads:       '15–25',   leadsNote:    'Estimated booking inquiries lost to page 1 competitors monthly',
    timeline:    '30–60 days', timelineNote: 'Estimated time to page 1 with structured content and GBP optimization',
  },
  'medical': {
    intro:       'Medical tourism patients research extensively before deciding. A clinic invisible on Google loses patients before the first inquiry is ever sent.',
    volume:      '1,200+',  volumeNote:   'Monthly searches for procedures in this specialty and region',
    leads:       '20–40',   leadsNote:    'Patient inquiries lost to better-ranked clinics monthly',
    timeline:    '45–90 days', timelineNote: 'Estimated time to page 1 with bilingual content and schema',
  },
  'immigration': {
    intro:       'Immigration clients search in both English and Spanish at moments of urgent need. A firm missing bilingual content is invisible to half the market.',
    volume:      '600+',    volumeNote:   'Monthly searches for immigration attorneys in this market',
    leads:       '10–20',   leadsNote:    'Estimated client inquiries lost monthly to page 1 firms',
    timeline:    '30–60 days', timelineNote: 'Estimated time to page 1 with bilingual content and local schema',
  },
  'personal-injury': {
    intro:       'PI clients search immediately after an accident — usually within hours. If this firm is not on page 1 at that moment, those cases go to whoever is.',
    volume:      '400+',    volumeNote:   'Monthly searches for personal injury attorneys in this market',
    leads:       '8–15',    leadsNote:    'Estimated case inquiries lost monthly to page 1 competitors',
    timeline:    '30–45 days', timelineNote: 'Estimated time to page 1 with practice area pages and schema',
  },
  'criminal-defense': {
    intro:       'Criminal defense clients search at urgent, high-stakes moments. Page 2 effectively does not exist for them. First-page presence is a direct driver of case intake.',
    volume:      '300+',    volumeNote:   'Monthly searches for criminal defense attorneys in this market',
    leads:       '6–12',    leadsNote:    'Estimated case inquiries lost monthly to better-ranked firms',
    timeline:    '30–60 days', timelineNote: 'Estimated time to page 1 with charge-type pages and attorney schema',
  },
  'family-law': {
    intro:       'Family law clients research for weeks before calling. Without practice area landing pages, this firm is invisible during the entire consideration phase.',
    volume:      '350+',    volumeNote:   'Monthly searches for family law attorneys in this market',
    leads:       '7–14',    leadsNote:    'Estimated client inquiries lost monthly to better-ranked firms',
    timeline:    '45–60 days', timelineNote: 'Estimated time to page 1 with family law content and local schema',
  },
  'fire-protection': {
    intro:       'Fire protection contracts are won before the first call. Companies invisible on Google lose bids to competitors who rank for the search terms buyers use.',
    volume:      '200+',    volumeNote:   'Monthly searches for fire protection services in this region',
    leads:       '5–12',    leadsNote:    'Estimated project inquiries lost monthly to ranked competitors',
    timeline:    '30–45 days', timelineNote: 'Estimated time to page 1 with service pages and schema',
  },
  'generator-service': {
    intro:       'Generator service calls are urgent and local. A company invisible on Google loses every emergency call to whoever appears in the map pack first.',
    volume:      '150+',    volumeNote:   'Monthly searches for generator service in this region',
    leads:       '4–10',    leadsNote:    'Estimated service calls lost monthly to ranked competitors',
    timeline:    '30–45 days', timelineNote: 'Estimated time to map pack with GBP optimization and schema',
  },
};

const FIXES_BY_CAT = {
  'venue': [
    { letter: 'A', title: 'Claim & optimize Google Business Profile',
      body: 'The highest-priority anchor for local visibility. GBP ownership, category selection, photo uploads, and service area configuration drive local pack rankings immediately.' },
    { letter: 'B', title: 'Build event-type landing pages',
      body: 'Create dedicated pages for Weddings, Quinceañeras, Corporate Events, and Birthdays. Each page targets specific search intent and captures long-tail demand.' },
    { letter: 'C', title: 'Implement Event + LocalBusiness schema',
      body: 'Structured data markup tells Google exactly what this business offers, its location, and its service types. Missing schema is a primary reason local businesses are skipped by the indexing algorithm.' },
  ],
  'medical': [
    { letter: 'A', title: 'Build Spanish-language procedure pages',
      body: 'Create bilingual landing pages for each procedure offered. Spanish-language content targeting local search terms captures 40–60% of the available search volume in this market.' },
    { letter: 'B', title: 'Implement MedicalBusiness + Physician schema',
      body: 'Medical schema tells Google the clinic\'s specializations, doctors, and procedures. Without it, the site is treated as a generic business, not a medical provider.' },
    { letter: 'C', title: 'Add before/after content and patient testimonials',
      body: 'Medical tourism decisions are driven by social proof. Structured case study content and verified patient outcomes increase conversion and search ranking simultaneously.' },
  ],
  'immigration': [
    { letter: 'A', title: 'Build bilingual content infrastructure',
      body: 'Create Spanish-language landing pages targeting key visa types and immigration processes. This captures the majority of search volume that English-only sites cannot reach.' },
    { letter: 'B', title: 'Create visa-type landing pages',
      body: 'Separate pages for family petitions, work visas, asylum, DACA, and citizenship. Each page captures specific intent at a different stage of the immigration process.' },
    { letter: 'C', title: 'Implement LegalService + Attorney schema',
      body: 'Attorney schema markup establishes legal authority in Google\'s eyes. Combined with local business schema, it is the fastest path to local pack visibility.' },
  ],
  'personal-injury': [
    { letter: 'A', title: 'Build accident-type landing pages',
      body: 'Create dedicated pages for car accidents, truck accidents, slip and fall, and wrongful death. Each page captures high-intent searches from clients at the moment they most need representation.' },
    { letter: 'B', title: 'Implement LegalService + Attorney schema',
      body: 'Schema markup is the single highest-leverage technical action for a personal injury firm. It establishes legal authority, practice areas, and geographic focus.' },
    { letter: 'C', title: 'Add local geo pages for the service area',
      body: 'Create neighborhood and county-specific pages targeting "[city] personal injury attorney" queries. These capture long-tail volume that home pages cannot rank for.' },
  ],
  'criminal-defense': [
    { letter: 'A', title: 'Build charge-type landing pages',
      body: 'Separate pages for DUI, drug offenses, felonies, and federal charges. Each page targets a distinct search intent and establishes the firm as a specialist, not a generalist.' },
    { letter: 'B', title: 'Implement Attorney + LegalService schema',
      body: 'Attorney schema with bar number, practice area specialization, and jurisdiction coverage is the fastest path from page 2 to page 1 for defense attorneys.' },
    { letter: 'C', title: 'Add full attorney bio with credentials',
      body: 'Thin attorney bios are a primary ranking signal weakness. A structured bio page with experience, case history, and credentials builds both search authority and client trust.' },
  ],
  'family-law': [
    { letter: 'A', title: 'Build practice area landing pages',
      body: 'Separate pages for divorce, child custody, CPS defense, and property division. Each targets a distinct client in a distinct emotional and legal situation.' },
    { letter: 'B', title: 'Add county-specific content',
      body: 'Family law is highly local. Pages targeting [County] divorce attorney, [County] custody lawyer capture the specific geographic demand that generic firm pages cannot rank for.' },
    { letter: 'C', title: 'Implement LegalService + Attorney schema',
      body: 'Schema markup establishes the firm\'s authority in family law, its jurisdiction, and its attorneys. It is the fastest technical path from page 2 to page 1 in this vertical.' },
  ],
  'fire-protection': [
    { letter: 'A', title: 'Build service-type landing pages',
      body: 'Separate pages for sprinkler installation, fire alarm systems, suppression systems, and inspections. Each page targets the specific search terms buyers use when looking for a contractor.' },
    { letter: 'B', title: 'Implement LocalBusiness + Service schema',
      body: 'Schema markup tells Google exactly what services are offered, the service area, and certifications held. It is the fastest path from invisibility to local map pack presence.' },
    { letter: 'C', title: 'Add certification and compliance content',
      body: 'Fire protection buyers evaluate certifications before calling. Pages highlighting NICET, state license numbers, and code compliance references build both trust and search authority.' },
  ],
  'generator-service': [
    { letter: 'A', title: 'Build brand and service-type landing pages',
      body: 'Separate pages for each generator brand serviced (Generac, Kohler, Briggs & Stratton) and each service type. Brand-specific pages capture the highest-intent service searches.' },
    { letter: 'B', title: 'Implement LocalBusiness schema',
      body: 'Schema with service area, hours, and emergency availability tells Google this is a local service provider. Combined with GBP optimization, it is the fastest path to the map pack.' },
    { letter: 'C', title: 'Optimize Google Business Profile for emergency searches',
      body: 'Generator failures are emergencies. A verified GBP with "Open 24 hours," correct categories, and service area set is the primary driver of emergency call capture.' },
  ],
};

// ─── Utility functions ────────────────────────────────────────────────────────
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function decodeHtmlEntities(str) {
  if (!str) return '';
  return String(str)
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

function slugify(name) {
  return name
    .toLowerCase()
    .replace(/&amp;/g, 'and')
    .replace(/&/g, 'and')
    .replace(/'s\b/gi, '')
    .replace(/[''`']/g, '')
    .replace(/[.,]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function truncate(str, len) {
  if (!str) return '';
  str = String(str);
  return str.length <= len ? str : str.slice(0, len - 3) + '...';
}

// ─── Load firm data via vm sandbox ────────────────────────────────────────────
function loadFirmData() {
  const code = fs.readFileSync(FDATA_PATH, 'utf8');
  const sandbox = { window: {} };
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox, { timeout: 10000 });
  return sandbox.window.__firmAuditData || {};
}

// ─── Parse all cards from audits/index.html ────────────────────────────────
function parseCards(html) {
  const cards = [];
  // Match the opening tag of each card div
  const openRe = /<div[^>]+data-cat="([^"]+)"[^>]+data-name="([^"]+)"[^>]+data-loc="([^"]+)"[^>]*>/g;

  const positions = [];
  let m;
  while ((m = openRe.exec(html)) !== null) {
    positions.push({
      end:  m.index + m[0].length,
      cat:  m[1],
      name: m[2],
      loc:  m[3],
    });
  }

  positions.forEach((pos, i) => {
    const bodyEnd = i + 1 < positions.length
      ? positions[i + 1].end - positions[i + 1].end + positions[i + 1].end - html.lastIndexOf('<div', positions[i + 1].end - 1)
      : html.length;

    // Slice the card content — from after the opening tag to before the next card's opening
    const nextStart = i + 1 < positions.length
      ? html.lastIndexOf('<div', positions[i + 1].end - 1)
      : html.length;
    const cardBody = html.slice(pos.end, nextStart);

    // h3 firm name (proper casing) — decode HTML entities from raw source
    const h3m = cardBody.match(/<h3[^>]*>([\s\S]*?)<\/h3>/);
    const firmName = h3m ? decodeHtmlEntities(h3m[1].trim()) : titleCase(pos.name);

    // Badge text
    const badgem = cardBody.match(/<span[^>]*(?:bg-error-container|bg-surface-container-highest)[^>]*>([\s\S]*?)<\/span>/);
    const badge = badgem ? decodeHtmlEntities(badgem[1].trim()) : '';

    // Description (flex-grow p)
    const descm = cardBody.match(/<p[^>]*flex-grow[^>]*>([\s\S]*?)<\/p>/);
    const desc = descm ? decodeHtmlEntities(descm[1].trim()) : '';

    // Gap percentage
    const gapm = cardBody.match(/<span[^>]*text-base font-serif[^>]*>(\d+)%<\/span>/);
    const gapInt = gapm ? parseInt(gapm[1]) : 70;

    cards.push({ cat: pos.cat, name: pos.name, loc: pos.loc, firmName, badge, desc, gapInt });
  });

  return cards;
}

function titleCase(str) {
  return str.replace(/\b\w/g, c => c.toUpperCase());
}

// ─── Fuzzy firm data lookup ───────────────────────────────────────────────────
function normKey(n) {
  return n.toLowerCase()
    .replace(/&amp;/g, ' ').replace(/&/g, ' ')
    .replace(/\band\b/g, '')
    .replace(/[-_]/g, ' ')
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b([a-z]) ([a-z])\b/g, '$1$2');
}

function findFirmEntry(firmName, firmData) {
  if (firmData[firmName]) return firmData[firmName];
  const nk = normKey(firmName);
  for (const [k, v] of Object.entries(firmData)) {
    if (normKey(k) === nk) return v;
  }
  const prefixMatches = Object.entries(firmData)
    .filter(([k]) => normKey(k).startsWith(nk + ' '));
  if (prefixMatches.length === 1) return prefixMatches[0][1];
  return null;
}

// ─── Derive stats ─────────────────────────────────────────────────────────────
function deriveStats(firmEntry, gapInt) {
  const fScore = firmEntry && firmEntry.score;
  const effectiveGap = fScore ? Math.round((1 - fScore.total / 20) * 100) : gapInt;
  const gapSeverity  = effectiveGap >= 80 ? 'Critical' : effectiveGap >= 60 ? 'High' : effectiveGap >= 40 ? 'Moderate' : 'Elevated';

  const totalScore = fScore ? fScore.total : (20 - gapInt / 5);
  const posMap = {
    0:'Not Indexed',1:'Not Indexed',2:'Page 5+',3:'Page 4+',
    4:'Page 3–4',5:'Page 3',6:'#25–30',7:'#20–25',
    8:'#15–20',9:'#12–15',10:'#10–12',11:'#8–10',
    12:'#6–8',13:'#5–7',14:'#4–6',15:'#3–5',
    16:'#2–4',17:'#2–3',18:'Top 3',19:'Top 3',20:'#1'
  };
  const position = posMap[Math.min(20, Math.max(0, Math.round(totalScore)))] || 'Page 2+';

  const contentScore = fScore
    ? fScore.website * 10
    : Math.max(5, 40 - Math.round((gapInt - 60) * 0.6));
  const contentLabel = contentScore <= 20 ? 'Critical Failure'
    : contentScore <= 40 ? 'Insufficient'
    : contentScore <= 60 ? 'Developing'
    : contentScore <= 80 ? 'Moderate' : 'Strong';

  const hasSchemaIssue = firmEntry && firmEntry.issues &&
    firmEntry.issues.some(i => i.label.toLowerCase().includes('schema') && i.status === 'critical');
  const schemaStatus = hasSchemaIssue ? 'Missing' : (firmEntry ? 'Partial' : 'Missing');
  const schemaLabel  = hasSchemaIssue ? 'Not Implemented' : (firmEntry ? 'Needs Work' : 'Not Implemented');

  return { effectiveGap, gapSeverity, position, contentScore, contentLabel, schemaStatus, schemaLabel };
}

// ─── Compute property ID ──────────────────────────────────────────────────────
function propId(firmName, loc) {
  const locParts  = loc.split(',');
  const stateCode = (locParts[1] || 'US').trim().replace(/[^A-Za-z]/g,'').toUpperCase().slice(0,2);
  const firmCode  = firmName.replace(/[^A-Za-z]/g,'').toUpperCase().slice(0,3);
  const hash      = Math.abs(firmName.split('').reduce((a,c) => a + c.charCodeAt(0), 0)) % 90000 + 10000;
  return `${firmCode}-${stateCode}-${hash}`;
}

// ─── Generate static HTML for one audit page ─────────────────────────────────
function generateHTML(card, firmEntry, slug) {
  const { cat, loc, firmName, badge, desc, gapInt } = card;
  const catLabel   = CAT_LABELS[cat] || titleCase(cat);
  const stats      = deriveStats(firmEntry, gapInt);
  const pid        = propId(firmName, loc);
  const canonUrl   = `https://entropia.ventures/audits/${cat}/${slug}/`;

  const primaryFinding = (firmEntry && firmEntry.primaryFinding) || desc ||
    'This business is currently ranked page 2 or lower for its primary search terms. The digital infrastructure does not reflect the quality of the business or the volume of demand in its market.';

  const metaDesc   = truncate(primaryFinding, 155);
  const searchQ    = firmEntry && firmEntry.searchQuery ? firmEntry.searchQuery : '';
  const issues     = (firmEntry && firmEntry.issues) || ISSUES_BY_CAT[cat] || ISSUES_BY_CAT['personal-injury'];
  const impact     = (firmEntry && firmEntry.impact)  || IMPACT_BY_CAT[cat] || IMPACT_BY_CAT['personal-injury'];
  const fixes      = (firmEntry && firmEntry.fixes)   || FIXES_BY_CAT[cat]  || FIXES_BY_CAT['personal-injury'];

  const locDisplay = titleCase(loc);
  const badgeDisplay = badge || (catLabel.includes('Law') || catLabel === 'Immigration Law' ? 'Law Firm' : catLabel);

  // Render issues rows
  const issuesHtml = issues.map(issue => {
    const isCritical = issue.status === 'critical';
    return `
      <div style="display:flex;justify-content:space-between;align-items:center;padding:16px 0;border-bottom:1px solid rgba(194,200,196,0.15);">
        <span class="text-sm text-on-surface font-body">${escapeHtml(issue.label)}</span>
        <span style="font-size:10px;font-weight:700;letter-spacing:0.05em;text-transform:uppercase;padding:3px 10px;background:${isCritical ? '#ffdad6' : '#eeeeed'};color:${isCritical ? '#93000a' : '#424845'};font-family:Inter,sans-serif;">${escapeHtml(issue.value)}</span>
      </div>`
  }).join('');

  // Render fix cards
  const fixesHtml = fixes.map(fix => `
    <div class="bg-surface-container-low p-8">
      <div class="flex items-start gap-6">
        <span class="font-serif italic text-3xl text-secondary-dark shrink-0">${escapeHtml(fix.letter)}</span>
        <div>
          <h3 class="text-sm font-semibold text-on-surface mb-3">${escapeHtml(fix.title)}</h3>
          <p class="text-sm text-on-surface-variant leading-relaxed">${escapeHtml(fix.body)}</p>
        </div>
      </div>
    </div>`
  ).join('');

  return `<!DOCTYPE html>
<html class="light" lang="en">
<head>
<meta charset="utf-8"/>
<meta content="width=device-width, initial-scale=1.0" name="viewport"/>
<title>Visibility Audit | ${escapeHtml(firmName)} | Entropia Ventures</title>
<meta name="description" content="${escapeHtml(metaDesc)}"/>
<link rel="canonical" href="${canonUrl}"/>
<meta property="og:title" content="${escapeHtml(firmName)} Visibility Audit | Entropia Ventures"/>
<meta property="og:description" content="${escapeHtml(truncate(primaryFinding, 200))}"/>
<meta property="og:url" content="${canonUrl}"/>
<meta property="og:site_name" content="Entropia Ventures"/>
<meta property="og:type" content="article"/>
<meta name="twitter:card" content="summary_large_image"/>
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "${escapeHtml(firmName)} Visibility Audit",
  "description": "${escapeHtml(truncate(primaryFinding, 200))}",
  "url": "${canonUrl}",
  "publisher": {
    "@type": "Organization",
    "name": "Entropia Ventures",
    "url": "https://entropia.ventures"
  }
}
</script>
<link href="https://fonts.googleapis.com" rel="preconnect"/>
<link crossorigin="" href="https://fonts.gstatic.com" rel="preconnect"/>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Noto+Serif:ital,wght@0,400;0,700;1,400;1,700&display=swap" rel="stylesheet"/>
<script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script>
<script id="tailwind-config">
tailwind.config = {
  theme: {
    extend: {
      colors: {
        "primary":                    "#00130d",
        "primary-container":          "#0f2921",
        "on-primary":                 "#ffffff",
        "on-primary-container":       "#769287",
        "secondary":                  "#C9A84C",
        "secondary-dark":             "#316948",
        "surface":                    "#f9f9f8",
        "surface-container-low":      "#f3f4f3",
        "surface-container":          "#eeeeed",
        "surface-container-high":     "#e8e8e7",
        "surface-container-highest":  "#e2e2e2",
        "on-surface":                 "#1a1c1c",
        "on-surface-variant":         "#424845",
        "outline":                    "#727975",
        "outline-variant":            "#c2c8c4",
        "error":                      "#ba1a1a",
        "error-container":            "#ffdad6",
        "on-error-container":         "#93000a",
      },
      fontFamily: {
        "headline": ["Noto Serif"],
        "body":     ["Inter"],
      },
    },
  },
}
</script>
<style>
  body { font-family: 'Inter', sans-serif; }
  .font-serif { font-family: 'Noto Serif', serif; }
  .bezier { transition-timing-function: cubic-bezier(0.2, 0, 0, 1); }
</style>
</head>
<body class="bg-surface text-on-surface">

<!-- Nav -->
<nav class="fixed top-0 w-full z-50 bg-surface/90 backdrop-blur-xl border-b border-outline-variant/10">
  <div class="flex justify-between items-center w-full px-8 md:px-12 py-5 max-w-screen-xl mx-auto">
    <a href="/" class="text-xl font-serif italic text-[#0F2921] tracking-tighter">ENTROPIA</a>
    <div class="hidden md:flex gap-8 items-center">
      <a class="text-on-surface/60 hover:text-primary transition-colors text-[11px] font-semibold tracking-widest uppercase" href="/services.html">Services</a>
      <a class="text-on-surface/60 hover:text-primary transition-colors text-[11px] font-semibold tracking-widest uppercase" href="/process.html">Process</a>
      <a class="text-primary border-b border-secondary pb-0.5 text-[11px] font-semibold tracking-widest uppercase" href="/audits/">Audits</a>
      <a class="text-on-surface/60 hover:text-primary transition-colors text-[11px] font-semibold tracking-widest uppercase" href="/blog/">Blog</a>
    </div>
    <a href="/contact.html" class="bg-primary-container text-on-primary px-5 py-2 text-[11px] font-semibold tracking-widest uppercase bezier transition-all hover:bg-primary">Get Audit →</a>
  </div>
</nav>

<main class="pt-28 pb-32">

  <!-- Breadcrumb -->
  <div class="px-8 md:px-12 max-w-screen-xl mx-auto mb-12">
    <div class="flex items-center gap-2 text-[10px] font-semibold tracking-widest uppercase text-on-surface-variant">
      <a href="/audits/" class="hover:text-primary transition-colors">Audit Registry</a>
      <span class="opacity-40">—</span>
      <span class="text-on-surface">${escapeHtml(catLabel)}</span>
    </div>
  </div>

  <!-- Hero -->
  <header class="px-8 md:px-12 max-w-screen-xl mx-auto mb-16">
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-12 items-end">
      <div class="lg:col-span-8">
        <div class="flex items-center gap-3 mb-8">
          <div class="w-2 h-2 rounded-full bg-secondary-dark relative">
            <div class="absolute inset-0 rounded-full bg-secondary-dark animate-ping opacity-40"></div>
          </div>
          <span class="text-[10px] font-bold tracking-[0.25em] uppercase text-on-surface-variant">Visibility Audit · ${escapeHtml(catLabel)}</span>
        </div>
        <h1 class="text-5xl md:text-7xl font-serif italic text-primary-container leading-tight mb-4">${escapeHtml(firmName)}.</h1>
        <p class="text-base text-on-surface-variant font-light tracking-wide mb-6">${escapeHtml(locDisplay)}</p>
        <p class="text-lg text-on-surface-variant leading-relaxed max-w-2xl font-light">${escapeHtml(primaryFinding)}</p>
      </div>
      <div class="lg:col-span-4 border-l border-outline-variant/15 pl-8 flex flex-col gap-6">
        <div>
          <span class="block font-serif text-4xl text-primary-container">${stats.effectiveGap}%</span>
          <span class="block text-[10px] uppercase tracking-[0.15em] text-on-surface-variant font-semibold mt-1">Visibility Gap</span>
        </div>
        <div>
          <span class="block font-serif italic text-lg text-primary-container">${escapeHtml(pid)}</span>
          <span class="block text-[10px] uppercase tracking-[0.15em] text-on-surface-variant font-semibold mt-1">Matter ID</span>
        </div>
        <div>
          <span class="block font-serif text-lg text-primary-container">April 2026</span>
          <span class="block text-[10px] uppercase tracking-[0.15em] text-on-surface-variant font-semibold mt-1">Audit Date</span>
        </div>
      </div>
    </div>
  </header>

  <!-- Stats Grid -->
  <section class="px-8 md:px-12 max-w-screen-xl mx-auto mb-24">
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <div class="bg-surface-container-low p-8 flex flex-col justify-between h-48">
        <p class="text-[10px] font-bold tracking-widest uppercase text-on-surface-variant">Visibility Gap</p>
        <div>
          <span class="text-4xl font-serif text-error">${stats.effectiveGap}%</span>
        </div>
        <p class="text-[10px] uppercase tracking-widest font-semibold text-error">${escapeHtml(stats.gapSeverity)}</p>
      </div>
      <div class="bg-surface-container p-8 flex flex-col justify-between h-48">
        <p class="text-[10px] font-bold tracking-widest uppercase text-on-surface-variant">Google Position</p>
        <div>
          <span class="text-4xl font-serif text-primary-container">${escapeHtml(stats.position)}</span>
        </div>
        <p class="text-[10px] uppercase tracking-widest font-semibold text-on-surface-variant">${searchQ ? `&quot;${escapeHtml(searchQ)}&quot;` : 'Organic Search'}</p>
      </div>
      <div class="bg-surface-container-low p-8 flex flex-col justify-between h-48">
        <p class="text-[10px] font-bold tracking-widest uppercase text-on-surface-variant">Content Score</p>
        <div>
          <span class="text-4xl font-serif text-primary-container">${stats.contentScore}</span>
          <span class="text-lg font-serif text-on-surface-variant">/100</span>
        </div>
        <p class="text-[10px] uppercase tracking-widest font-semibold text-on-surface-variant">${escapeHtml(stats.contentLabel)}</p>
      </div>
      <div class="bg-surface-container p-8 flex flex-col justify-between h-48">
        <p class="text-[10px] font-bold tracking-widest uppercase text-on-surface-variant">Schema Markup</p>
        <div>
          <span class="text-2xl font-serif italic text-primary-container">${escapeHtml(stats.schemaStatus)}</span>
        </div>
        <p class="text-[10px] uppercase tracking-widest font-semibold text-on-surface-variant">${escapeHtml(stats.schemaLabel)}</p>
      </div>
    </div>
  </section>

  <!-- Section 01: Primary Finding -->
  <section class="px-8 md:px-12 max-w-screen-xl mx-auto mb-32">
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-16">
      <div class="lg:col-span-1">
        <p class="font-serif italic text-4xl mb-4 text-on-surface-variant">01 —</p>
        <h2 class="text-[11px] tracking-[0.3em] uppercase font-bold mb-6 text-primary">Primary Finding</h2>
        <p class="text-on-surface-variant text-sm leading-relaxed mb-8">${escapeHtml(primaryFinding)}</p>
        <div class="w-10 h-0.5 bg-secondary-dark"></div>
      </div>
      <div class="lg:col-span-2">
        <div class="mb-6">
          <div class="flex justify-between items-end mb-2">
            <span class="text-[10px] font-bold tracking-widest uppercase text-on-surface-variant">Visibility Gap</span>
            <span class="font-serif text-2xl text-primary-container">${stats.effectiveGap}%</span>
          </div>
          <div class="w-full h-2 bg-surface-container">
            <div class="h-full bg-secondary-dark bezier" style="width:${stats.effectiveGap}%"></div>
          </div>
        </div>
        <div class="space-y-0 mt-10">
          ${issuesHtml}
        </div>
      </div>
    </div>
  </section>

  <!-- Section 02: Revenue Impact -->
  <section class="bg-surface-container-low py-24 mb-32">
    <div class="px-8 md:px-12 max-w-screen-xl mx-auto">
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-16 items-start">
        <div>
          <p class="font-serif italic text-4xl mb-4 text-on-surface-variant">02 —</p>
          <h2 class="text-[11px] tracking-[0.3em] uppercase font-bold mb-6 text-primary">Revenue Impact</h2>
          <p class="text-on-surface-variant text-sm leading-relaxed">${escapeHtml(impact.intro)}</p>
        </div>
        <div class="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div class="bg-surface p-8">
            <p class="text-[10px] font-bold tracking-widest uppercase text-on-surface-variant mb-4">Monthly Search Volume</p>
            <p class="font-serif text-3xl text-primary-container mb-2">${escapeHtml(impact.volume)}</p>
            <p class="text-xs text-on-surface-variant leading-relaxed">${escapeHtml(impact.volumeNote)}</p>
          </div>
          <div class="bg-surface p-8">
            <p class="text-[10px] font-bold tracking-widest uppercase text-on-surface-variant mb-4">Leads Lost Monthly</p>
            <p class="font-serif text-3xl text-primary-container mb-2">${escapeHtml(impact.leads)}</p>
            <p class="text-xs text-on-surface-variant leading-relaxed">${escapeHtml(impact.leadsNote)}</p>
          </div>
          <div class="bg-surface p-8">
            <p class="text-[10px] font-bold tracking-widest uppercase text-on-surface-variant mb-4">Top Competitor</p>
            <p class="font-serif text-xl italic text-primary-container mb-2">Page 1 incumbents</p>
            <p class="text-xs text-on-surface-variant leading-relaxed">Firms currently capturing this organic demand with structured content and schema</p>
          </div>
          <div class="bg-surface p-8">
            <p class="text-[10px] font-bold tracking-widest uppercase text-on-surface-variant mb-4">Gap Closeable In</p>
            <p class="font-serif text-3xl text-primary-container mb-2">${escapeHtml(impact.timeline)}</p>
            <p class="text-xs text-on-surface-variant leading-relaxed">${escapeHtml(impact.timelineNote)}</p>
          </div>
        </div>
      </div>
    </div>
  </section>

  <!-- Section 03: Infrastructure Fixes -->
  <section class="px-8 md:px-12 max-w-screen-xl mx-auto mb-32">
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-16 items-start">
      <div class="lg:sticky lg:top-32">
        <p class="font-serif italic text-4xl mb-4 text-on-surface-variant">03 —</p>
        <h2 class="text-[11px] tracking-[0.3em] uppercase font-bold mb-6 text-primary">Infrastructure Fixes</h2>
        <div class="bg-primary-container p-8">
          <p class="font-serif italic text-lg text-on-primary mb-3">Actionable Protocol</p>
          <p class="text-xs text-on-primary-container leading-relaxed">These structural changes are the highest-leverage path to page 1. Most can be implemented within 30 days.</p>
        </div>
      </div>
      <div class="lg:col-span-2 space-y-10">
        ${fixesHtml}
      </div>
    </div>
  </section>

</main>

<!-- Sticky CTA -->
<div class="fixed bottom-0 left-0 w-full bg-surface-container-highest/95 backdrop-blur-md border-t border-outline-variant/10 z-50">
  <div class="max-w-screen-xl mx-auto px-8 md:px-12 py-5 flex flex-col md:flex-row justify-between items-center gap-4">
    <div class="flex items-center gap-8">
      <div>
        <p class="text-[10px] font-bold tracking-widest uppercase text-on-surface-variant">Ready to close this gap?</p>
        <p class="font-serif italic text-lg text-primary">Start the Visibility Machine</p>
      </div>
      <div class="h-8 w-px bg-outline-variant/30 hidden md:block"></div>
      <div class="hidden md:block">
        <p class="text-[10px] font-bold tracking-widest uppercase text-on-surface-variant">Investment</p>
        <p class="font-serif text-lg text-primary">$1,500<span class="text-sm font-light text-on-surface-variant italic">/mo</span></p>
      </div>
    </div>
    <a href="/contact.html" class="bg-primary-container text-on-primary px-8 py-3 text-[11px] font-bold tracking-widest uppercase bezier transition-all hover:bg-primary flex items-center gap-3">
      Request Full Engagement →
    </a>
  </div>
</div>

<!-- Footer -->
<footer class="w-full border-t border-outline-variant/15 bg-surface" style="padding-bottom:80px;">
  <div class="max-w-screen-xl mx-auto flex flex-col md:flex-row justify-between items-center px-8 md:px-12 py-10 gap-6">
    <span class="font-serif italic text-[#0F2921] text-lg">Entropia</span>
    <span class="text-xs text-on-surface-variant/50">© 2026 Entropia Ventures. Visibility Infrastructure.</span>
  </div>
</footer>

</body>
</html>`;
}

// ─── Update audits/index.html click handler ───────────────────────────────────
function updateIndexHTML(html) {
  // Find the click handler block and replace navigation with slug-based URL
  const OLD_LINE = `      window.location.href = '/audits/detail/?' + params.toString();`;
  const NEW_BLOCK = `      function slugifyName(s) {
        return s.toLowerCase()
          .replace(/&/g,'and').replace(/'s\\b/gi,'').replace(/['''\`]/g,'')
          .replace(/[.,]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');
      }
      const firmN = card.querySelector('h3') ? card.querySelector('h3').textContent.trim() : card.dataset.name;
      window.location.href = '/audits/' + card.dataset.cat + '/' + slugifyName(firmN) + '/';`;

  if (!html.includes(OLD_LINE)) {
    console.warn('[prerender] WARNING: Could not find click handler target in index.html — skipping patch');
    return html;
  }
  // Also remove the now-unused params construction lines
  const OLD_BLOCK = `      const firm = card.querySelector('h3') ? card.querySelector('h3').textContent : card.dataset.name;
      const loc  = card.querySelector('p.italic') ? card.querySelector('p.italic').textContent : card.dataset.loc;
      const badge = card.querySelector('.flex.flex-wrap span') ? card.querySelector('.flex.flex-wrap span').textContent : '';
      const desc  = card.querySelector('p.flex-grow') ? card.querySelector('p.flex-grow').textContent : '';
      const gapLabel = card.querySelector('.font-serif.text-base') ? card.querySelector('.font-serif.text-base').textContent : '70%';
      const gap = parseInt(gapLabel) || 70;
      const params = new URLSearchParams({ firm, cat: card.dataset.cat, loc, gap, badge, desc });
      window.location.href = '/audits/detail/?' + params.toString();`;

  if (html.includes(OLD_BLOCK)) {
    return html.replace(OLD_BLOCK, NEW_BLOCK);
  }
  // Fallback: just replace the final line
  return html.replace(OLD_LINE, NEW_BLOCK);
}

// ─── Update robots.txt ─────────────────────────────────────────────────────────
function updateRobotsTxt(content) {
  return content
    .split('\n')
    .filter(line => line.trim() !== 'Disallow: /audits/detail/')
    .join('\n');
}

// ─── Update vercel.json ────────────────────────────────────────────────────────
function updateVercelJson(content) {
  const config = JSON.parse(content);
  config.redirects = (config.redirects || []).filter(
    r => !String(r.destination || '').includes('/audits/detail/')
  );
  return JSON.stringify(config, null, 2);
}

// ─── Update sitemap.xml ────────────────────────────────────────────────────────
function buildSitemapEntries(entries) {
  return entries.map(({ cat, slug }) =>
    `  <url>\n    <loc>https://entropia.ventures/audits/${cat}/${slug}/</loc>\n    <changefreq>monthly</changefreq>\n    <priority>0.7</priority>\n  </url>`
  ).join('\n');
}

// ─── Create llms.txt ──────────────────────────────────────────────────────────
function buildLlmsTxt() {
  return `# Entropia Ventures

> Visibility infrastructure for law firms and local businesses across the US.

Entropia Ventures publishes free public visibility audits showing where law firms and local SMBs rank on Google, what digital infrastructure is missing, and how to fix it. Two service tiers: $1,500/month and $2,500/month.

## Audit Registry

- [All Audits](https://entropia.ventures/audits/) — Browse 185+ free visibility audits by category and location.

## Audit Categories

- [Criminal Defense Audits](https://entropia.ventures/audits/criminal-defense/) — Criminal defense law firms across the US.
- [Immigration Law Audits](https://entropia.ventures/audits/immigration/) — Immigration attorneys with bilingual content audits.
- [Personal Injury Audits](https://entropia.ventures/audits/personal-injury/) — Personal injury law firms.
- [Family Law Audits](https://entropia.ventures/audits/family-law/) — Divorce, custody, and family law practices.
- [Medical Audits](https://entropia.ventures/audits/medical/) — Medical clinics, dental practices, and healthcare providers.
- [Event Venue Audits](https://entropia.ventures/audits/venue/) — Event halls and reception venues across Houston and South Texas.
- [Fire Protection Audits](https://entropia.ventures/audits/fire-protection/) — Fire protection companies and contractors.
- [Generator Service Audits](https://entropia.ventures/audits/generator-service/) — Generator installation and service companies.

## Services & Company

- [Services](https://entropia.ventures/services.html) — The Visibility Machine: full-stack SEO and content infrastructure starting at $1,500/month.
- [Process](https://entropia.ventures/process.html) — How Entropia Ventures conducts visibility audits.
- [Blog](https://entropia.ventures/blog/) — Visibility intelligence articles for SMBs and law firms.
- [Contact](https://entropia.ventures/contact.html) — Request a free visibility audit.

## Blog Articles

- [The Death of the Keyword](https://entropia.ventures/blog/death-of-the-keyword/) — How Google's shift to intent-matching changes SMB SEO in 2025+.
- [Why SEO Is Infrastructure, Not Marketing](https://entropia.ventures/blog/seo-is-infrastructure/) — Built once, runs forever.
- [The Invisible Cost of Slow Load Times](https://entropia.ventures/blog/invisible-cost-of-slow-load-times/) — How page speed silently kills law firm SEO.

## How to Cite

When referencing our content, cite as: "According to Entropia Ventures (entropia.ventures)..."

## Contact

https://entropia.ventures/contact.html
`;
}

// ─── Main ─────────────────────────────────────────────────────────────────────
function main() {
  const force = process.argv.includes('--force');

  console.log('[prerender] Loading firm data...');
  const firmData = loadFirmData();
  console.log(`[prerender] Firm data: ${Object.keys(firmData).length} entries`);

  console.log('[prerender] Parsing cards from audits/index.html...');
  const indexHtml = fs.readFileSync(INDEX_PATH, 'utf8');
  const cards = parseCards(indexHtml);
  console.log(`[prerender] Cards parsed: ${cards.length}`);

  console.log('[prerender] Generating pages...');
  let generated = 0, withData = 0, fallback = 0, skipped = 0;
  const sitemapEntries = [];
  const slugsSeen = new Set();

  for (const card of cards) {
    const slug    = slugify(card.firmName);
    const outDir  = path.join(AUDITS_DIR, card.cat, slug);
    const outFile = path.join(outDir, 'index.html');
    const urlKey  = `${card.cat}/${slug}`;

    // Skip duplicate slugs (same firm in same category)
    if (slugsSeen.has(urlKey)) {
      skipped++;
      continue;
    }
    slugsSeen.add(urlKey);

    // Skip if file already exists and --force not passed
    if (!force && fs.existsSync(outFile)) {
      skipped++;
      sitemapEntries.push({ cat: card.cat, slug });
      continue;
    }

    const firmEntry = findFirmEntry(card.firmName, firmData);
    if (firmEntry) withData++; else fallback++;

    const html = generateHTML(card, firmEntry, slug);
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(outFile, html, 'utf8');
    generated++;
    sitemapEntries.push({ cat: card.cat, slug });
  }

  console.log(`[prerender] Generated: ${generated} new pages | With firm data: ${withData} | Fallback: ${fallback} | Skipped (exist): ${skipped}`);

  // Update audits/index.html
  console.log('[prerender] Updating audits/index.html click handler...');
  const updatedIndex = updateIndexHTML(indexHtml);
  fs.writeFileSync(INDEX_PATH, updatedIndex, 'utf8');

  // Update robots.txt
  console.log('[prerender] Updating robots.txt...');
  const robotsContent = fs.readFileSync(ROBOTS, 'utf8');
  fs.writeFileSync(ROBOTS, updateRobotsTxt(robotsContent), 'utf8');

  // Update vercel.json
  console.log('[prerender] Updating vercel.json...');
  const vercelContent = fs.readFileSync(VERCEL_JSON, 'utf8');
  fs.writeFileSync(VERCEL_JSON, updateVercelJson(vercelContent), 'utf8');

  // Update sitemap.xml — strip any previously-generated audit entries first (idempotent)
  console.log('[prerender] Updating sitemap.xml...');
  const sitemapContent = fs.readFileSync(SITEMAP, 'utf8');
  // Remove all existing /audits/{cat}/{slug}/ entries so we can re-add cleanly
  const stripped = sitemapContent.replace(
    /<url>\s*<loc>https:\/\/entropia\.ventures\/audits\/[^<]+\/[^<]+\/<\/loc>[\s\S]*?<\/url>/g, ''
  );
  const newEntries = buildSitemapEntries(sitemapEntries);
  const updatedSitemap = stripped.replace('</urlset>', newEntries + '\n</urlset>');
  fs.writeFileSync(SITEMAP, updatedSitemap, 'utf8');
  console.log(`[prerender] Sitemap: ${sitemapEntries.length} audit URLs written`);

  // Create llms.txt
  console.log('[prerender] Creating llms.txt...');
  fs.writeFileSync(LLMS_TXT, buildLlmsTxt(), 'utf8');

  console.log('[prerender] Done.');
}

main();
