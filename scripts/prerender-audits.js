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

// ─── Variant pools ──────────────────────────────────────────────────────────
// For each category, 5 alternate versions of the fallback issues/impact/fixes
// block, each leading with a different angle (GBP/local pack, content pages,
// schema, reviews/trust, category-specific fifth angle). Used ONLY when a firm
// has no researched entry in firm-data.js. Each variant is a function of
// (name, city, catLabel, stats) so two firms assigned the same variant index
// still read differently — the sentences are woven with real per-firm fields,
// not swapped synonyms. Ranges vary within the same honest bounds the original
// single-version copy used; no new numbers are invented beyond that pattern.
const VARIANT_POOLS = {
  'venue': [
    // 0 — Google Business Profile / local pack
    (name, city, catLabel, stats) => ({
      issues: [
        { label: 'Google Business Profile',  value: 'Unverified or missing',     status: 'critical' },
        { label: 'Event-type landing pages', value: 'Not present',               status: 'critical' },
        { label: 'Review volume',            value: 'Below local competitors',   status: 'warning'  },
        { label: 'Schema markup (Event)',     value: 'Not implemented',           status: 'warning'  },
      ],
      impact: {
        intro: `${name} is competing for bookings in ${city} against venues with a claimed, fully optimized Google Business Profile. An unverified listing means Google can't confirm hours, photos, or service area — and unclaimed listings rank behind claimed ones by default.`,
        volume: '750+', volumeNote: `Monthly local searches for event venues in the ${city} area`,
        leads: '12–22', leadsNote: 'Estimated booking inquiries lost to page 1 competitors monthly',
        timeline: '25–55 days', timelineNote: 'Estimated time to page 1 after GBP verification and category setup',
      },
      fixes: [
        { letter: 'A', title: 'Claim and fully verify Google Business Profile',
          body: `Verification is the single highest-leverage action available to ${name}. An unclaimed or unverified profile is effectively invisible in the local pack regardless of how good the venue itself is.` },
        { letter: 'B', title: 'Build event-type landing pages',
          body: 'Dedicated pages for weddings, quinceañeras, corporate events, and birthdays each target distinct search intent and capture long-tail demand a single homepage cannot.' },
        { letter: 'C', title: 'Request and respond to reviews systematically',
          body: `Review count and recency are ranking factors in the local pack. A steady stream of new reviews, with responses, signals an active, trustworthy business to both Google and prospective clients in ${city}.` },
      ],
    }),
    // 1 — dedicated content / landing pages
    (name, city, catLabel, stats) => ({
      issues: [
        { label: 'Event-type landing pages', value: 'Not present',               status: 'critical' },
        { label: 'Schema markup (Event)',     value: 'Not implemented',           status: 'critical' },
        { label: 'Google Business Profile',  value: 'Incomplete or unverified',  status: 'warning'  },
        { label: 'Photo gallery content',    value: 'Thin or absent',            status: 'warning'  },
      ],
      impact: {
        intro: `${name} operates a single generic page where competitors run dedicated pages for each event type. Google rewards specificity — a page built for "quinceañera venue ${city}" will outrank a homepage that only mentions quinceañeras in passing.`,
        volume: '850+', volumeNote: `Monthly local searches across event types in ${city}`,
        leads: '15–25', leadsNote: 'Estimated booking inquiries lost to competitors with event-specific pages',
        timeline: '30–60 days', timelineNote: 'Estimated time to page 1 once event-type pages are live and indexed',
      },
      fixes: [
        { letter: 'A', title: 'Build dedicated pages for each event type',
          body: 'Weddings, quinceañeras, corporate events, and birthdays should each have their own page with specific copy, photos, and capacity details — not a shared paragraph on the homepage.' },
        { letter: 'B', title: 'Implement Event + LocalBusiness schema',
          body: `Structured data tells Google exactly what ${name} offers, where, and for what occasions. Without it, the venue is read as a generic business rather than an event space.` },
        { letter: 'C', title: 'Claim and complete Google Business Profile',
          body: 'Full category selection, service area, and photo uploads round out the local signals that support the new landing pages.' },
      ],
    }),
    // 2 — schema markup
    (name, city, catLabel, stats) => ({
      issues: [
        { label: 'Schema markup (Event)',     value: 'Not implemented',           status: 'critical' },
        { label: 'Google Business Profile',  value: 'Unverified or missing',     status: 'critical' },
        { label: 'Event-type landing pages', value: 'Not present',               status: 'warning'  },
        { label: 'Photo gallery content',    value: 'Thin or absent',            status: 'warning'  },
      ],
      impact: {
        intro: `Without Event schema, Google has no structured way to know ${name} hosts weddings, quinceañeras, or corporate events — it can only guess from unstructured text. That guess usually loses to a competitor's clearly marked-up listing in ${city}.`,
        volume: '700+', volumeNote: `Monthly local searches for event venues serving ${city}`,
        leads: '12–20', leadsNote: 'Estimated booking inquiries lost monthly to structured-data competitors',
        timeline: '30–50 days', timelineNote: 'Estimated time to page 1 once schema and GBP verification are live',
      },
      fixes: [
        { letter: 'A', title: 'Implement Event + LocalBusiness schema',
          body: 'Structured markup is read directly by Google\'s indexing algorithm. It is often the fastest technical fix available and requires no new content to be written.' },
        { letter: 'B', title: 'Claim and verify Google Business Profile',
          body: 'Verified ownership with the correct category and service area is the second-fastest lever, working alongside schema rather than in place of it.' },
        { letter: 'C', title: 'Add event-type landing pages',
          body: `Once the technical foundation is in place, dedicated pages per event type give ${name}'s schema and search crawlers real content to reinforce it.` },
      ],
    }),
    // 3 — reviews / trust
    (name, city, catLabel, stats) => ({
      issues: [
        { label: 'Review volume',            value: 'Below local competitors',   status: 'critical' },
        { label: 'Google Business Profile',  value: 'Incomplete',                status: 'critical' },
        { label: 'Event-type landing pages', value: 'Not present',               status: 'warning'  },
        { label: 'Photo gallery content',    value: 'Thin or absent',            status: 'warning'  },
      ],
      impact: {
        intro: `Couples and event planners in ${city} compare review counts before they compare price. A venue with fewer, older reviews reads as a riskier booking than one with a steady, recent volume — regardless of ${name}'s actual event quality.`,
        volume: '800+', volumeNote: `Monthly local searches for event venues in ${city}`,
        leads: '14–24', leadsNote: 'Estimated booking inquiries lost to venues with stronger review signals',
        timeline: '30–55 days', timelineNote: 'Estimated time to see local pack movement after a sustained review push',
      },
      fixes: [
        { letter: 'A', title: 'Run a systematic post-event review request process',
          body: 'A simple follow-up message after every booked event, sent while the experience is fresh, is the most reliable way to close a review gap without paid incentives.' },
        { letter: 'B', title: 'Complete and verify Google Business Profile',
          body: `Category accuracy, photo count, and service area completeness compound with review volume to determine local pack position for ${name}.` },
        { letter: 'C', title: 'Build event-type landing pages',
          body: 'Dedicated pages give new reviews and photos a specific place to attach to, reinforcing both the review signal and search relevance together.' },
      ],
    }),
    // 4 — photo / video content
    (name, city, catLabel, stats) => ({
      issues: [
        { label: 'Photo gallery content',    value: 'Thin or absent',            status: 'critical' },
        { label: 'Event-type landing pages', value: 'Not present',               status: 'critical' },
        { label: 'Google Business Profile',  value: 'Unverified or missing',     status: 'warning'  },
        { label: 'Schema markup (Event)',     value: 'Not implemented',           status: 'warning'  },
      ],
      impact: {
        intro: `Event venues sell an experience before they sell a room. A thin photo gallery gives ${city} shoppers nothing to compare against venues showing 50+ real event photos, and it is often the deciding factor once two venues are otherwise similar to ${name}.`,
        volume: '800+', volumeNote: `Monthly local searches for event venues in the ${city} area`,
        leads: '15–25', leadsNote: 'Estimated booking inquiries lost to venues with richer visual content',
        timeline: '30–60 days', timelineNote: 'Estimated time to page 1 once visual content and structured pages are live',
      },
      fixes: [
        { letter: 'A', title: 'Build out a full photo and video gallery',
          body: `Real event photos, organized by event type, are both a conversion driver and search content. ${name} should aim for volume and variety, not a handful of staged shots.` },
        { letter: 'B', title: 'Build event-type landing pages around that content',
          body: 'Each event-type page gives the new photo and video content a home optimized for the exact searches prospective clients run.' },
        { letter: 'C', title: 'Claim Google Business Profile and add photos there too',
          body: 'The same visual content should populate GBP directly — photo count and freshness are direct local pack ranking factors.' },
      ],
    }),
  ],

  'medical': [
    // 0 — procedure pages
    (name, city, catLabel, stats) => ({
      issues: [
        { label: 'Procedure landing pages',  value: 'Not present',               status: 'critical' },
        { label: 'Spanish-language content', value: 'Absent',                    status: 'critical' },
        { label: 'Medical schema markup',    value: 'Not implemented',           status: 'warning'  },
        { label: 'Before/after content',     value: 'Missing or thin',           status: 'warning'  },
      ],
      impact: {
        intro: `Patients researching a specific procedure search for that procedure by name, not for ${name} generically. Without a dedicated page per procedure, the clinic can't rank for the exact terms patients in ${city} are typing.`,
        volume: '1,100+', volumeNote: `Monthly searches for procedures offered by clinics in ${city}`,
        leads: '18–35', leadsNote: 'Estimated patient inquiries lost to clinics with procedure-specific pages',
        timeline: '40–80 days', timelineNote: 'Estimated time to page 1 once procedure pages are built and indexed',
      },
      fixes: [
        { letter: 'A', title: 'Build a dedicated landing page per procedure',
          body: `Each procedure ${name} offers should have its own page with pricing context, recovery information, and location details — not a shared paragraph on a services page.` },
        { letter: 'B', title: 'Add Spanish-language versions of each page',
          body: 'Bilingual content roughly doubles the addressable search volume in most of this market and is often the highest-ROI content investment available.' },
        { letter: 'C', title: 'Implement MedicalBusiness + Physician schema',
          body: 'Schema tells Google the specific procedures, doctors, and specializations on record, moving the clinic out of the generic-business bucket in search results.' },
      ],
    }),
    // 1 — Spanish-language content
    (name, city, catLabel, stats) => ({
      issues: [
        { label: 'Spanish-language content', value: 'Absent',                    status: 'critical' },
        { label: 'Procedure landing pages',  value: 'Not present',               status: 'critical' },
        { label: 'Before/after content',     value: 'Missing or thin',           status: 'warning'  },
        { label: 'Medical schema markup',    value: 'Not implemented',           status: 'warning'  },
      ],
      impact: {
        intro: `A significant share of medical tourism and local search volume in ${city} happens in Spanish. An English-only site is invisible to every one of those searches, regardless of how strong ${name}'s English-language content is.`,
        volume: '1,200+', volumeNote: 'Monthly searches for procedures in this specialty and region, EN + ES combined',
        leads: '20–40', leadsNote: 'Patient inquiries lost to bilingual clinics monthly',
        timeline: '45–90 days', timelineNote: 'Estimated time to page 1 with bilingual content and schema',
      },
      fixes: [
        { letter: 'A', title: 'Build full Spanish-language site content',
          body: `Not a machine-translated layer — genuine Spanish-language pages for each procedure ${name} offers, written for how patients actually search.` },
        { letter: 'B', title: 'Build procedure-specific landing pages in both languages',
          body: 'Each procedure needs its own page in English and Spanish, targeting the specific terms patients use in each language.' },
        { letter: 'C', title: 'Add before/after content and patient testimonials',
          body: 'Medical tourism decisions are driven heavily by social proof — verified outcomes and testimonials in both languages increase conversion and time-on-page.' },
      ],
    }),
    // 2 — schema
    (name, city, catLabel, stats) => ({
      issues: [
        { label: 'Medical schema markup',    value: 'Not implemented',           status: 'critical' },
        { label: 'Procedure landing pages',  value: 'Not present',               status: 'critical' },
        { label: 'Spanish-language content', value: 'Absent',                    status: 'warning'  },
        { label: 'Before/after content',     value: 'Missing or thin',           status: 'warning'  },
      ],
      impact: {
        intro: `Without MedicalBusiness and Physician schema, Google treats ${name} as a generic local business rather than a medical provider — which means it competes for generic terms instead of the specific procedure searches near ${city} that actually convert.`,
        volume: '1,050+', volumeNote: `Monthly searches for procedures in this specialty near ${city}`,
        leads: '16–30', leadsNote: 'Estimated patient inquiries lost monthly to schema-marked-up competitors',
        timeline: '35–70 days', timelineNote: 'Estimated time to page 1 after schema implementation and procedure pages go live',
      },
      fixes: [
        { letter: 'A', title: 'Implement MedicalBusiness + Physician schema',
          body: 'This is a technical fix with no new content required — it tells Google the clinic\'s specializations, doctors, and procedures directly.' },
        { letter: 'B', title: 'Build procedure landing pages to reinforce the schema',
          body: `Schema and content work together — a page for each procedure ${name} performs gives the structured data something specific to point to.` },
        { letter: 'C', title: 'Add Spanish-language content',
          body: 'Once the technical foundation is in place, bilingual versions of the highest-volume procedure pages capture the largest remaining audience.' },
      ],
    }),
    // 3 — before/after & testimonials
    (name, city, catLabel, stats) => ({
      issues: [
        { label: 'Before/after content',     value: 'Missing or thin',           status: 'critical' },
        { label: 'Procedure landing pages',  value: 'Not present',               status: 'critical' },
        { label: 'Spanish-language content', value: 'Absent',                    status: 'warning'  },
        { label: 'Medical schema markup',    value: 'Not implemented',           status: 'warning'  },
      ],
      impact: {
        intro: `Medical tourism patients evaluate outcomes before they evaluate price. With little to no before/after content or verified testimonials on the site, ${name} is asking patients in ${city} to book on trust alone against competitors who show their results.`,
        volume: '1,150+', volumeNote: 'Monthly searches for procedures in this specialty and region',
        leads: '20–38', leadsNote: 'Estimated patient inquiries lost to clinics with visible outcome evidence',
        timeline: '40–75 days', timelineNote: 'Estimated time to page 1 with outcome content, schema, and procedure pages',
      },
      fixes: [
        { letter: 'A', title: 'Build a structured before/after and testimonial section',
          body: 'Verified patient outcomes, organized by procedure, are the single biggest conversion lever for medical tourism decisions.' },
        { letter: 'B', title: 'Pair outcome content with procedure-specific pages',
          body: `Each procedure page ${name} builds should include its own outcome evidence, not a single shared testimonials page.` },
        { letter: 'C', title: 'Implement MedicalBusiness + Physician schema',
          body: 'Schema markup reinforces the new content by telling Google exactly which procedures and outcomes are being described.' },
      ],
    }),
    // 4 — Google Business Profile / local presence
    (name, city, catLabel, stats) => ({
      issues: [
        { label: 'Google Business Profile',  value: 'Incomplete or unverified',  status: 'critical' },
        { label: 'Procedure landing pages',  value: 'Not present',               status: 'critical' },
        { label: 'Spanish-language content', value: 'Absent',                    status: 'warning'  },
        { label: 'Before/after content',     value: 'Missing or thin',           status: 'warning'  },
      ],
      impact: {
        intro: `Local map pack placement drives a large share of "near me" procedure searches in ${city}. An incomplete or unverified Google Business Profile keeps ${name} out of that placement regardless of how strong the website itself is.`,
        volume: '1,000+', volumeNote: `Monthly "near me" and local searches for procedures in ${city}`,
        leads: '16–28', leadsNote: 'Estimated patient inquiries lost to clinics with a fully optimized local listing',
        timeline: '30–60 days', timelineNote: 'Estimated time to map pack visibility after GBP verification and category setup',
      },
      fixes: [
        { letter: 'A', title: 'Claim, verify, and fully complete Google Business Profile',
          body: 'Correct categories, service list, hours, and photo volume are the fastest path to local map pack visibility for procedure-based searches.' },
        { letter: 'B', title: 'Build procedure landing pages to support the listing',
          body: `GBP posts and services should link to dedicated procedure pages on the site, giving ${name} something specific to rank once the listing is optimized.` },
        { letter: 'C', title: 'Add Spanish-language content',
          body: 'Bilingual coverage extends the value of the newly optimized local listing to the full addressable market.' },
      ],
    }),
  ],

  'immigration': [
    // 0 — bilingual content
    (name, city, catLabel, stats) => ({
      issues: [
        { label: 'Bilingual content (ES/EN)', value: 'Not present',              status: 'critical' },
        { label: 'Visa-type landing pages',   value: 'Not present',              status: 'critical' },
        { label: 'Attorney schema markup',    value: 'Not implemented',          status: 'warning'  },
        { label: 'Google Business Profile',   value: 'Incomplete',               status: 'warning'  },
      ],
      impact: {
        intro: `Immigration clients in ${city} search in both English and Spanish, often at moments of urgent need. An English-only site is invisible to half the addressable market before ${name}'s actual qualifications ever come into play.`,
        volume: '550+', volumeNote: `Monthly searches for immigration attorneys in ${city}, EN + ES combined`,
        leads: '9–18', leadsNote: 'Estimated client inquiries lost monthly to bilingual firms',
        timeline: '30–55 days', timelineNote: 'Estimated time to page 1 once bilingual content is live and indexed',
      },
      fixes: [
        { letter: 'A', title: 'Build full Spanish-language site content',
          body: `Genuine Spanish-language pages, not a machine-translated layer, for every visa type and process ${name} handles.` },
        { letter: 'B', title: 'Create visa-type landing pages in both languages',
          body: 'Family petitions, work visas, asylum, DACA, and citizenship each need their own page in each language, targeting the specific stage of the process clients are in.' },
        { letter: 'C', title: 'Implement LegalService + Attorney schema',
          body: 'Attorney schema establishes legal authority in Google\'s eyes and compounds with the new bilingual content once it is live.' },
      ],
    }),
    // 1 — visa-type pages
    (name, city, catLabel, stats) => ({
      issues: [
        { label: 'Visa-type landing pages',   value: 'Not present',              status: 'critical' },
        { label: 'Bilingual content (ES/EN)', value: 'Not present',              status: 'critical' },
        { label: 'Attorney schema markup',    value: 'Not implemented',          status: 'warning'  },
        { label: 'Google Business Profile',   value: 'Incomplete',               status: 'warning'  },
      ],
      impact: {
        intro: `A client searching "asylum attorney ${city}" and a client searching "work visa lawyer ${city}" are looking for very different help. One generic page cannot rank for both — ${name} needs a page built for each.`,
        volume: '620+', volumeNote: `Monthly searches for immigration attorneys and specific visa types in ${city}`,
        leads: '10–20', leadsNote: 'Estimated client inquiries lost monthly to firms with visa-specific pages',
        timeline: '30–60 days', timelineNote: 'Estimated time to page 1 once visa-type pages are indexed',
      },
      fixes: [
        { letter: 'A', title: 'Build a landing page for each visa type and process',
          body: 'Family petitions, work visas, asylum, DACA, and citizenship each capture distinct intent and should never share a single page.' },
        { letter: 'B', title: 'Add bilingual versions of each page',
          body: 'Spanish-language versions of the new visa-type pages roughly double the addressable search volume for the same content investment.' },
        { letter: 'C', title: 'Implement LegalService + Attorney schema',
          body: `Schema markup tells Google exactly which visa categories ${name} handles and where, reinforcing the new page structure.` },
      ],
    }),
    // 2 — schema
    (name, city, catLabel, stats) => ({
      issues: [
        { label: 'Attorney schema markup',    value: 'Not implemented',          status: 'critical' },
        { label: 'Visa-type landing pages',   value: 'Not present',              status: 'critical' },
        { label: 'Bilingual content (ES/EN)', value: 'Not present',              status: 'warning'  },
        { label: 'Google Business Profile',   value: 'Incomplete',               status: 'warning'  },
      ],
      impact: {
        intro: `Without Attorney and LegalService schema, Google has no structured signal that ${name} is a licensed immigration practice rather than a generic local business — a gap that shows up directly in how the firm ranks against marked-up competitors in ${city}.`,
        volume: '600+', volumeNote: `Monthly searches for immigration attorneys in ${city}`,
        leads: '10–18', leadsNote: 'Estimated client inquiries lost monthly to schema-marked-up firms',
        timeline: '25–50 days', timelineNote: 'Estimated time to page 1 after schema implementation',
      },
      fixes: [
        { letter: 'A', title: 'Implement LegalService + Attorney schema',
          body: 'A purely technical fix — no new content required — that tells Google the firm\'s practice areas, jurisdiction, and attorney credentials directly.' },
        { letter: 'B', title: 'Build visa-type landing pages to reinforce it',
          body: `Schema and content compound — a page per visa type gives the new structured data something specific to point to for ${name}.` },
        { letter: 'C', title: 'Add bilingual content',
          body: 'Spanish-language versions of the new pages extend the value of the schema and content work to the full addressable market.' },
      ],
    }),
    // 3 — Google Business Profile / local presence
    (name, city, catLabel, stats) => ({
      issues: [
        { label: 'Google Business Profile',   value: 'Incomplete',               status: 'critical' },
        { label: 'Visa-type landing pages',   value: 'Not present',              status: 'critical' },
        { label: 'Bilingual content (ES/EN)', value: 'Not present',              status: 'warning'  },
        { label: 'Attorney schema markup',    value: 'Not implemented',          status: 'warning'  },
      ],
      impact: {
        intro: `A significant share of immigration searches in ${city} happen in the map pack — "immigration lawyer near me." An incomplete Google Business Profile keeps ${name} out of that placement regardless of the firm's actual track record.`,
        volume: '580+', volumeNote: `Monthly local and "near me" searches for immigration attorneys in ${city}`,
        leads: '9–17', leadsNote: 'Estimated client inquiries lost to firms with a fully optimized local listing',
        timeline: '25–50 days', timelineNote: 'Estimated time to map pack visibility after GBP completion',
      },
      fixes: [
        { letter: 'A', title: 'Fully complete and verify Google Business Profile',
          body: 'Correct categories, languages spoken, service area, and photo volume are the fastest path to local pack visibility.' },
        { letter: 'B', title: 'Build visa-type landing pages linked from the listing',
          body: `GBP posts and services should point to dedicated visa-type pages on the site, giving ${name} something specific to rank.` },
        { letter: 'C', title: 'Add bilingual content',
          body: 'Listing the firm as Spanish-speaking on GBP and backing it with real bilingual content on-site compounds both signals together.' },
      ],
    }),
    // 4 — reviews / trust
    (name, city, catLabel, stats) => ({
      issues: [
        { label: 'Client review volume',      value: 'Below local competitors',  status: 'critical' },
        { label: 'Visa-type landing pages',   value: 'Not present',              status: 'critical' },
        { label: 'Bilingual content (ES/EN)', value: 'Not present',              status: 'warning'  },
        { label: 'Attorney schema markup',    value: 'Not implemented',          status: 'warning'  },
      ],
      impact: {
        intro: `Immigration clients in ${city} are making a high-stakes decision and lean heavily on reviews from people who went through the same process. A thin review count reads as risk for ${name}, even when the firm's actual results are strong.`,
        volume: '600+', volumeNote: `Monthly searches for immigration attorneys in ${city}`,
        leads: '10–19', leadsNote: 'Estimated client inquiries lost to firms with stronger review signals',
        timeline: '30–55 days', timelineNote: 'Estimated time to see movement after a sustained, bilingual review request process',
      },
      fixes: [
        { letter: 'A', title: 'Run a systematic bilingual review request process',
          body: `A simple follow-up in the client's preferred language after a case milestone is the most reliable way for ${name} to build review volume without incentives.` },
        { letter: 'B', title: 'Build visa-type landing pages for new reviews to reinforce',
          body: 'Reviews tied to specific visa types on specific pages reinforce both trust and search relevance for that exact search term.' },
        { letter: 'C', title: 'Implement LegalService + Attorney schema',
          body: 'Schema markup surfaces review and rating data more prominently in search results once review volume is built.' },
      ],
    }),
  ],

  'personal-injury': [
    // 0 — practice area pages
    (name, city, catLabel, stats) => ({
      issues: [
        { label: 'Practice area pages',   value: 'Missing or generic',   status: 'critical' },
        { label: 'Accident type content', value: 'Not present',          status: 'critical' },
        { label: 'LegalService schema',   value: 'Not implemented',      status: 'warning'  },
        { label: 'Local geo pages',       value: 'Not present',          status: 'warning'  },
      ],
      impact: {
        intro: `A client searching right after a car accident and a client searching after a slip and fall are looking for different reassurance. One generic practice page can't speak to both — ${name} needs a page built for each accident type in ${city}.`,
        volume: '380+', volumeNote: `Monthly searches for personal injury attorneys in ${city}`,
        leads: '7–14', leadsNote: 'Estimated case inquiries lost monthly to firms with accident-specific pages',
        timeline: '25–45 days', timelineNote: 'Estimated time to page 1 once accident-type pages are indexed',
      },
      fixes: [
        { letter: 'A', title: 'Build a landing page for each accident type',
          body: 'Car accidents, truck accidents, slip and fall, and wrongful death each capture distinct high-intent searches that a shared page cannot rank for individually.' },
        { letter: 'B', title: 'Implement LegalService + Attorney schema',
          body: `Schema tells Google exactly which practice areas ${name} covers and where, reinforcing the new page structure.` },
        { letter: 'C', title: 'Add local geo pages for the service area',
          body: 'Neighborhood and county-specific pages targeting "[city] personal injury attorney" capture long-tail volume a homepage cannot rank for.' },
      ],
    }),
    // 1 — schema
    (name, city, catLabel, stats) => ({
      issues: [
        { label: 'LegalService schema',   value: 'Not implemented',      status: 'critical' },
        { label: 'Practice area pages',   value: 'Missing or generic',   status: 'critical' },
        { label: 'Accident type content', value: 'Not present',          status: 'warning'  },
        { label: 'Local geo pages',       value: 'Not present',          status: 'warning'  },
      ],
      impact: {
        intro: `Without LegalService and Attorney schema, Google reads ${name} as a generic local business rather than a personal injury practice — a distinction that matters when ${city} clients search for representation within hours of an accident.`,
        volume: '400+', volumeNote: `Monthly searches for personal injury attorneys in ${city}`,
        leads: '8–15', leadsNote: 'Estimated case inquiries lost monthly to schema-marked-up competitors',
        timeline: '20–40 days', timelineNote: 'Estimated time to page 1 after schema implementation',
      },
      fixes: [
        { letter: 'A', title: 'Implement LegalService + Attorney schema',
          body: 'A technical fix requiring no new content — it establishes practice areas, jurisdiction, and attorney credentials directly to Google.' },
        { letter: 'B', title: 'Build practice area landing pages to reinforce it',
          body: `Schema and content compound — dedicated pages for each accident type give the new structured data something specific to point to for ${name}.` },
        { letter: 'C', title: 'Add local geo pages',
          body: 'Once the technical and content foundation is in place, city- and county-specific pages capture the remaining long-tail search volume.' },
      ],
    }),
    // 2 — accident-type content
    (name, city, catLabel, stats) => ({
      issues: [
        { label: 'Accident type content', value: 'Not present',          status: 'critical' },
        { label: 'Practice area pages',   value: 'Missing or generic',   status: 'critical' },
        { label: 'Local geo pages',       value: 'Not present',          status: 'warning'  },
        { label: 'LegalService schema',   value: 'Not implemented',      status: 'warning'  },
      ],
      impact: {
        intro: `PI clients search immediately after an accident, usually within hours, using specific terms tied to what happened to them. If ${name} has no content addressing "truck accident lawyer" or "slip and fall attorney" specifically, those ${city} searches go straight to whoever does.`,
        volume: '420+', volumeNote: `Monthly searches for personal injury attorneys and specific accident types in ${city}`,
        leads: '8–16', leadsNote: 'Estimated case inquiries lost monthly to firms with accident-specific content',
        timeline: '25–45 days', timelineNote: 'Estimated time to page 1 once accident-type content is live',
      },
      fixes: [
        { letter: 'A', title: 'Build detailed content for each accident type',
          body: 'Car accidents, truck accidents, motorcycle accidents, and slip and fall each need enough dedicated content to rank for the specific terms clients search under stress.' },
        { letter: 'B', title: 'Add local geo pages targeting the service area',
          body: `Pairing accident-type content with city and county pages lets ${name} capture combined searches like "[city] truck accident attorney."` },
        { letter: 'C', title: 'Implement LegalService + Attorney schema',
          body: 'Schema reinforces the new content by giving Google a structured signal for each practice area and location covered.' },
      ],
    }),
    // 3 — local geo pages
    (name, city, catLabel, stats) => ({
      issues: [
        { label: 'Local geo pages',       value: 'Not present',          status: 'critical' },
        { label: 'Practice area pages',   value: 'Missing or generic',   status: 'critical' },
        { label: 'Accident type content', value: 'Not present',          status: 'warning'  },
        { label: 'LegalService schema',   value: 'Not implemented',      status: 'warning'  },
      ],
      impact: {
        intro: `${name} serves more than one community around ${city}, but the site has no pages targeting those specific areas. Clients searching "[neighborhood] personal injury attorney" have no reason to find a homepage that never mentions where they live.`,
        volume: '400+', volumeNote: `Monthly searches for personal injury attorneys across the ${city} service area`,
        leads: '8–15', leadsNote: 'Estimated case inquiries lost monthly to firms with local geo pages',
        timeline: '30–50 days', timelineNote: 'Estimated time to page 1 once geo pages are built and indexed',
      },
      fixes: [
        { letter: 'A', title: 'Build geo-specific pages for the full service area',
          body: 'Neighborhood and county-specific pages capture long-tail local searches that a single homepage, however well-optimized, cannot rank for individually.' },
        { letter: 'B', title: 'Pair geo pages with accident-type content',
          body: `Combined pages like "[city] truck accident lawyer" capture the highest-intent searches available to ${name}.` },
        { letter: 'C', title: 'Implement LegalService + Attorney schema',
          body: 'Schema with a defined service area reinforces the new geo pages and speeds up local ranking for each one.' },
      ],
    }),
    // 4 — case results / reviews
    (name, city, catLabel, stats) => ({
      issues: [
        { label: 'Case result content',   value: 'Missing',              status: 'critical' },
        { label: 'Practice area pages',   value: 'Missing or generic',   status: 'critical' },
        { label: 'Accident type content', value: 'Not present',          status: 'warning'  },
        { label: 'Local geo pages',       value: 'Not present',          status: 'warning'  },
      ],
      impact: {
        intro: `PI clients in ${city} compare track records before they call. Without visible case results or settlement history, ${name} is asking prospective clients to trust the firm on reputation alone against competitors who publish their wins.`,
        volume: '400+', volumeNote: `Monthly searches for personal injury attorneys in ${city}`,
        leads: '8–15', leadsNote: 'Estimated case inquiries lost to firms with visible case results',
        timeline: '25–45 days', timelineNote: 'Estimated time to see movement once results content and practice pages are live',
      },
      fixes: [
        { letter: 'A', title: 'Publish case results and settlement history',
          body: 'A structured results page, organized by accident type, is one of the strongest trust and conversion signals available to a PI firm.' },
        { letter: 'B', title: 'Build practice area pages to house that content',
          body: `Each accident type page ${name} builds should include its own relevant case results, not a single shared results page.` },
        { letter: 'C', title: 'Implement LegalService + Attorney schema',
          body: 'Schema reinforces the new content structure and helps Google associate specific results with specific practice areas.' },
      ],
    }),
  ],

  'criminal-defense': [
    // 0 — charge-type pages
    (name, city, catLabel, stats) => ({
      issues: [
        { label: 'DUI/charge-type pages',      value: 'Not present', status: 'critical' },
        { label: 'Local jurisdiction content', value: 'Absent',      status: 'critical' },
        { label: 'Attorney bio schema',        value: 'Not implemented', status: 'warning' },
        { label: 'Case result content',        value: 'Missing',    status: 'warning' },
      ],
      impact: {
        intro: `A client searching "DUI attorney ${city}" and one searching "felony defense lawyer ${city}" need different reassurance at different moments. One generic criminal law page cannot rank for both — ${name} needs a page built for each charge type.`,
        volume: '280+', volumeNote: `Monthly searches for criminal defense attorneys in ${city}`,
        leads: '5–11', leadsNote: 'Estimated case inquiries lost monthly to firms with charge-specific pages',
        timeline: '25–55 days', timelineNote: 'Estimated time to page 1 once charge-type pages are indexed',
      },
      fixes: [
        { letter: 'A', title: 'Build a page for each charge type',
          body: 'DUI, drug offenses, felonies, and federal charges each need their own page, establishing the firm as a specialist rather than a generalist.' },
        { letter: 'B', title: 'Add local jurisdiction content',
          body: `Court-specific and county-specific content helps ${name} rank for the exact combination of charge and location clients search under pressure.` },
        { letter: 'C', title: 'Implement Attorney + LegalService schema',
          body: 'Schema with bar number, specialization, and jurisdiction coverage is the fastest technical path from page 2 to page 1.' },
      ],
    }),
    // 1 — jurisdiction content
    (name, city, catLabel, stats) => ({
      issues: [
        { label: 'Local jurisdiction content', value: 'Absent',      status: 'critical' },
        { label: 'DUI/charge-type pages',      value: 'Not present', status: 'critical' },
        { label: 'Attorney bio schema',        value: 'Not implemented', status: 'warning' },
        { label: 'Case result content',        value: 'Missing',    status: 'warning' },
      ],
      impact: {
        intro: `Criminal defense is a local business at the county and court level, not just the city level. With no content naming the specific courts and jurisdictions ${name} practices in, the firm can't rank for the jurisdiction-specific searches ${city} clients actually run.`,
        volume: '300+', volumeNote: `Monthly searches for criminal defense attorneys in ${city} and surrounding jurisdictions`,
        leads: '6–12', leadsNote: 'Estimated case inquiries lost monthly to firms with jurisdiction-specific content',
        timeline: '30–55 days', timelineNote: 'Estimated time to page 1 once jurisdiction content is live',
      },
      fixes: [
        { letter: 'A', title: 'Build content naming specific courts and jurisdictions',
          body: 'Clients search by county and court name as often as by city. Content naming those specifics directly captures searches a generic city page misses.' },
        { letter: 'B', title: 'Pair jurisdiction content with charge-type pages',
          body: `Combined pages like "[county] DUI attorney" capture the highest-intent searches available to ${name}.` },
        { letter: 'C', title: 'Implement Attorney + LegalService schema',
          body: 'Schema with defined jurisdiction coverage reinforces the new content and speeds up local ranking for each area named.' },
      ],
    }),
    // 2 — attorney bio / schema
    (name, city, catLabel, stats) => ({
      issues: [
        { label: 'Attorney bio schema',        value: 'Not implemented', status: 'critical' },
        { label: 'DUI/charge-type pages',      value: 'Not present',    status: 'critical' },
        { label: 'Local jurisdiction content', value: 'Absent',         status: 'warning'  },
        { label: 'Case result content',        value: 'Missing',       status: 'warning'  },
      ],
      impact: {
        intro: `Thin or unmarked attorney bios are a common weakness in criminal defense sites. Without Attorney schema, Google can't associate ${name}'s experience and credentials with the firm's ranking — even when that experience is substantial.`,
        volume: '300+', volumeNote: `Monthly searches for criminal defense attorneys in ${city}`,
        leads: '6–12', leadsNote: 'Estimated case inquiries lost monthly to schema-marked-up competitors',
        timeline: '25–50 days', timelineNote: 'Estimated time to page 1 after schema and bio content go live',
      },
      fixes: [
        { letter: 'A', title: 'Add a full attorney bio with credentials',
          body: 'Experience, case history, bar admissions, and any trial record should be laid out in detail — thin bios are a common ranking and trust weakness.' },
        { letter: 'B', title: 'Implement Attorney + LegalService schema',
          body: `Schema markup surfaces ${name}'s credentials directly in search results, building trust before the click.` },
        { letter: 'C', title: 'Build charge-type landing pages',
          body: 'Pages for DUI, drug offenses, felonies, and federal charges give the newly marked-up attorney credentials specific practice areas to reinforce.' },
      ],
    }),
    // 3 — case results
    (name, city, catLabel, stats) => ({
      issues: [
        { label: 'Case result content',        value: 'Missing',      status: 'critical' },
        { label: 'DUI/charge-type pages',      value: 'Not present', status: 'critical' },
        { label: 'Local jurisdiction content', value: 'Absent',      status: 'warning'  },
        { label: 'Attorney bio schema',        value: 'Not implemented', status: 'warning' },
      ],
      impact: {
        intro: `Clients facing charges compare track records before they call, especially for anything beyond a first-time DUI. Without visible case results, ${name} is asking clients in ${city} to trust the firm on reputation alone against competitors who publish outcomes.`,
        volume: '300+', volumeNote: `Monthly searches for criminal defense attorneys in ${city}`,
        leads: '6–12', leadsNote: 'Estimated case inquiries lost to firms with visible case results',
        timeline: '30–55 days', timelineNote: 'Estimated time to see movement once results content and charge pages are live',
      },
      fixes: [
        { letter: 'A', title: 'Publish case results, organized by charge type',
          body: 'A structured results page — dismissals, reduced charges, acquittals — is one of the strongest trust signals available to a defense firm, where permitted by bar rules.' },
        { letter: 'B', title: 'Build charge-type pages to house that content',
          body: `Each charge-type page ${name} builds should include its own relevant results, not a single shared page.` },
        { letter: 'C', title: 'Implement Attorney + LegalService schema',
          body: 'Schema reinforces the new content and helps Google associate specific results with specific charge types and jurisdictions.' },
      ],
    }),
    // 4 — reviews / trust
    (name, city, catLabel, stats) => ({
      issues: [
        { label: 'Client review volume',       value: 'Below local competitors', status: 'critical' },
        { label: 'DUI/charge-type pages',      value: 'Not present',            status: 'critical' },
        { label: 'Local jurisdiction content', value: 'Absent',                 status: 'warning'  },
        { label: 'Attorney bio schema',        value: 'Not implemented',        status: 'warning'  },
      ],
      impact: {
        intro: `Criminal defense clients in ${city} are searching at an urgent, high-stakes moment and lean hard on reviews from people who went through the same situation. A thin review count reads as risk for ${name}, regardless of the firm's actual results.`,
        volume: '300+', volumeNote: `Monthly searches for criminal defense attorneys in ${city}`,
        leads: '6–12', leadsNote: 'Estimated case inquiries lost to firms with stronger review signals',
        timeline: '30–60 days', timelineNote: 'Estimated time to see movement after a sustained review request process',
      },
      fixes: [
        { letter: 'A', title: 'Run a systematic post-case review request process',
          body: `A simple, well-timed follow-up after a case resolves is the most reliable way for ${name} to build review volume, where permitted by bar rules.` },
        { letter: 'B', title: 'Build charge-type pages for reviews to reinforce',
          body: 'Reviews tied to specific charge types on specific pages reinforce both trust and search relevance for that exact search term.' },
        { letter: 'C', title: 'Implement Attorney + LegalService schema',
          body: 'Schema markup surfaces review and rating data more prominently in search results once review volume grows.' },
      ],
    }),
  ],

  'family-law': [
    // 0 — practice area pages
    (name, city, catLabel, stats) => ({
      issues: [
        { label: 'Divorce/custody pages',      value: 'Not present', status: 'critical' },
        { label: 'County-specific content',    value: 'Absent',      status: 'critical' },
        { label: 'LegalService schema',        value: 'Not implemented', status: 'warning' },
        { label: 'Attorney authority content', value: 'Thin',        status: 'warning' },
      ],
      impact: {
        intro: `A client searching for divorce help and one searching for a custody dispute are in different situations. One generic family law page cannot speak to both — ${name} needs a page built for each in ${city}.`,
        volume: '320+', volumeNote: `Monthly searches for family law attorneys in ${city}`,
        leads: '6–13', leadsNote: 'Estimated client inquiries lost monthly to firms with practice-specific pages',
        timeline: '35–65 days', timelineNote: 'Estimated time to page 1 once practice area pages are indexed',
      },
      fixes: [
        { letter: 'A', title: 'Build practice area landing pages',
          body: 'Divorce, child custody, CPS defense, and property division each target a distinct client in a distinct legal and emotional situation.' },
        { letter: 'B', title: 'Add county-specific content',
          body: `Pages targeting "[county] divorce attorney" capture the local demand a generic firm page for ${name} cannot rank for.` },
        { letter: 'C', title: 'Implement LegalService + Attorney schema',
          body: 'Schema establishes the firm\'s authority, jurisdiction, and attorneys, and is the fastest technical path from page 2 to page 1.' },
      ],
    }),
    // 1 — county-specific content
    (name, city, catLabel, stats) => ({
      issues: [
        { label: 'County-specific content',    value: 'Absent',      status: 'critical' },
        { label: 'Divorce/custody pages',      value: 'Not present', status: 'critical' },
        { label: 'Attorney authority content', value: 'Thin',        status: 'warning' },
        { label: 'LegalService schema',        value: 'Not implemented', status: 'warning' },
      ],
      impact: {
        intro: `Family law is decided at the county level, and clients search accordingly. With no content naming the specific counties ${name} practices in, the firm can't rank for "[county] custody lawyer" style searches near ${city} that make up much of the volume.`,
        volume: '340+', volumeNote: `Monthly searches for family law attorneys across ${city} and nearby counties`,
        leads: '7–14', leadsNote: 'Estimated client inquiries lost monthly to firms with county-specific content',
        timeline: '40–60 days', timelineNote: 'Estimated time to page 1 once county content is live',
      },
      fixes: [
        { letter: 'A', title: 'Build county-specific landing pages',
          body: 'Pages naming each county served, paired with local court references, capture searches a citywide homepage misses entirely.' },
        { letter: 'B', title: 'Pair county pages with practice area content',
          body: `Combined pages like "[county] divorce attorney" capture the highest-intent searches available to ${name}.` },
        { letter: 'C', title: 'Implement LegalService + Attorney schema',
          body: 'Schema with defined jurisdiction coverage reinforces the new county content and speeds up local ranking.' },
      ],
    }),
    // 2 — attorney authority content
    (name, city, catLabel, stats) => ({
      issues: [
        { label: 'Attorney authority content', value: 'Thin',        status: 'critical' },
        { label: 'Divorce/custody pages',      value: 'Not present', status: 'critical' },
        { label: 'County-specific content',    value: 'Absent',      status: 'warning' },
        { label: 'LegalService schema',        value: 'Not implemented', status: 'warning' },
      ],
      impact: {
        intro: `Family law clients in ${city} are choosing someone to trust with a divorce or a custody case — a decision driven heavily by perceived experience. A thin attorney bio undersells whatever track record ${name} actually has.`,
        volume: '330+', volumeNote: `Monthly searches for family law attorneys in ${city}`,
        leads: '6–13', leadsNote: 'Estimated client inquiries lost to firms with stronger authority content',
        timeline: '35–60 days', timelineNote: 'Estimated time to see movement once bio and practice content are live',
      },
      fixes: [
        { letter: 'A', title: 'Build a detailed attorney authority page',
          body: 'Experience, case types handled, mediation training, and any relevant credentials should be laid out in full, not summarized in a sentence.' },
        { letter: 'B', title: 'Build practice area pages to support it',
          body: `Each practice area page ${name} builds should link back to the strengthened attorney bio to reinforce trust at the point of decision.` },
        { letter: 'C', title: 'Implement LegalService + Attorney schema',
          body: 'Schema markup surfaces the new authority content more prominently in search results.' },
      ],
    }),
    // 3 — schema
    (name, city, catLabel, stats) => ({
      issues: [
        { label: 'LegalService schema',        value: 'Not implemented', status: 'critical' },
        { label: 'Divorce/custody pages',      value: 'Not present',    status: 'critical' },
        { label: 'County-specific content',    value: 'Absent',         status: 'warning'  },
        { label: 'Attorney authority content', value: 'Thin',           status: 'warning'  },
      ],
      impact: {
        intro: `Without LegalService and Attorney schema, Google has no structured signal that ${name} practices family law specifically, rather than law in general — a gap that shows up directly in rankings against marked-up ${city} competitors.`,
        volume: '350+', volumeNote: `Monthly searches for family law attorneys in ${city}`,
        leads: '7–14', leadsNote: 'Estimated client inquiries lost monthly to schema-marked-up firms',
        timeline: '30–50 days', timelineNote: 'Estimated time to page 1 after schema implementation',
      },
      fixes: [
        { letter: 'A', title: 'Implement LegalService + Attorney schema',
          body: 'A technical fix requiring no new content — it tells Google the firm\'s practice areas, jurisdiction, and attorneys directly.' },
        { letter: 'B', title: 'Build practice area pages to reinforce it',
          body: `Schema and content compound — dedicated pages for divorce and custody give the new structured data something specific to point to for ${name}.` },
        { letter: 'C', title: 'Add county-specific content',
          body: 'Once the technical and content foundation is in place, county pages capture the remaining local long-tail volume.' },
      ],
    }),
    // 4 — reviews / trust
    (name, city, catLabel, stats) => ({
      issues: [
        { label: 'Client review volume',    value: 'Below local competitors', status: 'critical' },
        { label: 'Divorce/custody pages',   value: 'Not present',            status: 'critical' },
        { label: 'County-specific content', value: 'Absent',                 status: 'warning'  },
        { label: 'LegalService schema',     value: 'Not implemented',        status: 'warning'  },
      ],
      impact: {
        intro: `Family law clients in ${city} lean heavily on reviews from people who went through a similar divorce or custody situation. A thin review count reads as risk during an already stressful decision, regardless of ${name}'s actual outcomes.`,
        volume: '340+', volumeNote: `Monthly searches for family law attorneys in ${city}`,
        leads: '7–13', leadsNote: 'Estimated client inquiries lost to firms with stronger review signals',
        timeline: '35–60 days', timelineNote: 'Estimated time to see movement after a sustained review request process',
      },
      fixes: [
        { letter: 'A', title: 'Run a systematic post-case review request process',
          body: `A simple follow-up after a case resolves is the most reliable way for ${name} to build review volume without incentives.` },
        { letter: 'B', title: 'Build practice area pages for reviews to reinforce',
          body: 'Reviews tied to specific practice areas on specific pages reinforce both trust and search relevance for that exact term.' },
        { letter: 'C', title: 'Implement LegalService + Attorney schema',
          body: 'Schema markup surfaces review and rating data more prominently in search results once review volume grows.' },
      ],
    }),
  ],

  'fire-protection': [
    // 0 — service-type pages
    (name, city, catLabel, stats) => ({
      issues: [
        { label: 'Service-type landing pages', value: 'Not present',      status: 'critical' },
        { label: 'Certifications content',     value: 'Missing or thin', status: 'critical' },
        { label: 'LocalBusiness schema',       value: 'Not implemented', status: 'warning' },
        { label: 'Google Business Profile',    value: 'Incomplete',      status: 'warning' },
      ],
      impact: {
        intro: `A facility manager searching "sprinkler installation ${city}" and one searching "fire alarm inspection ${city}" need different reassurance. One generic services page cannot rank for both — ${name} needs a page built for each service type.`,
        volume: '180+', volumeNote: `Monthly searches for fire protection services in ${city}`,
        leads: '4–11', leadsNote: 'Estimated project inquiries lost monthly to competitors with service-specific pages',
        timeline: '25–45 days', timelineNote: 'Estimated time to page 1 once service pages are indexed',
      },
      fixes: [
        { letter: 'A', title: 'Build a page for each service type',
          body: 'Sprinkler installation, fire alarm systems, suppression systems, and inspections each target the specific search terms buyers use.' },
        { letter: 'B', title: 'Add certification and compliance content',
          body: `NICET certifications, state license numbers, and code compliance references build trust before ${name} ever gets the call.` },
        { letter: 'C', title: 'Implement LocalBusiness + Service schema',
          body: 'Schema tells Google exactly what services are offered and the service area, speeding the path to local map pack presence.' },
      ],
    }),
    // 1 — schema
    (name, city, catLabel, stats) => ({
      issues: [
        { label: 'LocalBusiness schema',       value: 'Not implemented', status: 'critical' },
        { label: 'Service-type landing pages', value: 'Not present',     status: 'critical' },
        { label: 'Certifications content',     value: 'Missing or thin', status: 'warning' },
        { label: 'Google Business Profile',    value: 'Incomplete',      status: 'warning' },
      ],
      impact: {
        intro: `Without LocalBusiness schema, Google has no structured signal for what ${name} services, where, or under what certifications — a gap that keeps the company out of the map pack results ${city} buyers check first.`,
        volume: '200+', volumeNote: `Monthly searches for fire protection services in ${city}`,
        leads: '5–12', leadsNote: 'Estimated project inquiries lost monthly to schema-marked-up competitors',
        timeline: '20–40 days', timelineNote: 'Estimated time to page 1 after schema implementation',
      },
      fixes: [
        { letter: 'A', title: 'Implement LocalBusiness + Service schema',
          body: 'A technical fix requiring no new content — it tells Google the service area, categories, and certifications directly.' },
        { letter: 'B', title: 'Build service-type pages to reinforce it',
          body: `Schema and content compound — a page per service gives the new structured data something specific to point to for ${name}.` },
        { letter: 'C', title: 'Add certification content',
          body: 'NICET and license details layered onto the new pages build the trust signals buyers evaluate before calling.' },
      ],
    }),
    // 2 — certifications
    (name, city, catLabel, stats) => ({
      issues: [
        { label: 'Certifications content',     value: 'Missing or thin', status: 'critical' },
        { label: 'Service-type landing pages', value: 'Not present',     status: 'critical' },
        { label: 'LocalBusiness schema',       value: 'Not implemented', status: 'warning' },
        { label: 'Google Business Profile',    value: 'Incomplete',      status: 'warning' },
      ],
      impact: {
        intro: `Fire protection buyers in ${city} check certifications before they call — NICET status, state license numbers, and code compliance. With little to no certification content visible, ${name} is asking buyers to take that on faith against competitors who show it upfront.`,
        volume: '190+', volumeNote: `Monthly searches for fire protection services in ${city}`,
        leads: '5–11', leadsNote: 'Estimated project inquiries lost to competitors with visible certifications',
        timeline: '25–45 days', timelineNote: 'Estimated time to see movement once certification content is live',
      },
      fixes: [
        { letter: 'A', title: 'Publish certification and licensing details',
          body: 'NICET certifications, state license numbers, and code references should be visible on the site, not just in a filing cabinet.' },
        { letter: 'B', title: 'Build service-type pages to house that content',
          body: `Each service page ${name} builds should reference the relevant certifications for that service.` },
        { letter: 'C', title: 'Implement LocalBusiness schema',
          body: 'Schema markup reinforces the certification content by giving Google a structured signal for services and credentials together.' },
      ],
    }),
    // 3 — Google Business Profile
    (name, city, catLabel, stats) => ({
      issues: [
        { label: 'Google Business Profile',    value: 'Incomplete',      status: 'critical' },
        { label: 'Service-type landing pages', value: 'Not present',     status: 'critical' },
        { label: 'Certifications content',     value: 'Missing or thin', status: 'warning' },
        { label: 'LocalBusiness schema',       value: 'Not implemented', status: 'warning' },
      ],
      impact: {
        intro: `Fire protection contracts are frequently won through the map pack, especially for smaller commercial buyers searching "near me" in ${city}. An incomplete Google Business Profile keeps ${name} out of that placement regardless of the work quality behind it.`,
        volume: '200+', volumeNote: `Monthly local and "near me" searches for fire protection services near ${city}`,
        leads: '5–12', leadsNote: 'Estimated project inquiries lost to competitors with a fully optimized listing',
        timeline: '20–40 days', timelineNote: 'Estimated time to map pack visibility after GBP completion',
      },
      fixes: [
        { letter: 'A', title: 'Fully complete and verify Google Business Profile',
          body: 'Correct categories, service area, hours, and photo volume are the fastest path to local map pack visibility.' },
        { letter: 'B', title: 'Build service-type pages linked from the listing',
          body: `GBP services and posts should point to dedicated pages on the site, giving ${name} something specific to rank.` },
        { letter: 'C', title: 'Add certification content',
          body: 'Certifications referenced on both GBP and the linked service pages reinforce trust at every touchpoint.' },
      ],
    }),
    // 4 — reviews / trust
    (name, city, catLabel, stats) => ({
      issues: [
        { label: 'Client review volume',       value: 'Below local competitors', status: 'critical' },
        { label: 'Service-type landing pages', value: 'Not present',            status: 'critical' },
        { label: 'Certifications content',     value: 'Missing or thin',        status: 'warning' },
        { label: 'LocalBusiness schema',       value: 'Not implemented',        status: 'warning' },
      ],
      impact: {
        intro: `Commercial buyers in ${city} compare review counts and certifications before requesting a bid. A thin review count puts ${name} at a disadvantage against competitors bidding on the same jobs with a longer visible track record.`,
        volume: '190+', volumeNote: `Monthly searches for fire protection services in ${city}`,
        leads: '5–11', leadsNote: 'Estimated project inquiries lost to competitors with stronger review signals',
        timeline: '25–45 days', timelineNote: 'Estimated time to see movement after a sustained review request process',
      },
      fixes: [
        { letter: 'A', title: 'Run a systematic post-project review request process',
          body: `A simple follow-up after project completion is the most reliable way for ${name} to build review volume over time.` },
        { letter: 'B', title: 'Build service-type pages for reviews to reinforce',
          body: 'Reviews tied to specific service types reinforce both trust and search relevance for that exact search term.' },
        { letter: 'C', title: 'Implement LocalBusiness schema',
          body: 'Schema markup surfaces review and rating data more prominently once review volume is built.' },
      ],
    }),
  ],

  'generator-service': [
    // 0 — brand / service pages
    (name, city, catLabel, stats) => ({
      issues: [
        { label: 'Service-type landing pages', value: 'Not present',      status: 'critical' },
        { label: 'Brand/model content',        value: 'Missing or thin', status: 'critical' },
        { label: 'LocalBusiness schema',       value: 'Not implemented', status: 'warning' },
        { label: 'Google Business Profile',    value: 'Incomplete',      status: 'warning' },
      ],
      impact: {
        intro: `A homeowner searching "Generac repair ${city}" and one searching "generator installation ${city}" need different content. One generic services page cannot rank for both — ${name} needs a page built for each brand and service type.`,
        volume: '130+', volumeNote: `Monthly searches for generator service in ${city}`,
        leads: '3–9', leadsNote: 'Estimated service calls lost monthly to competitors with brand-specific pages',
        timeline: '25–45 days', timelineNote: 'Estimated time to page 1 once brand and service pages are indexed',
      },
      fixes: [
        { letter: 'A', title: 'Build brand and service-type landing pages',
          body: 'Pages for each generator brand serviced (Generac, Kohler, Briggs & Stratton) and each service type capture the highest-intent service searches.' },
        { letter: 'B', title: 'Implement LocalBusiness schema',
          body: `Schema with service area, hours, and emergency availability tells Google ${name} is a local service provider.` },
        { letter: 'C', title: 'Optimize Google Business Profile for emergency searches',
          body: 'A verified GBP with "Open 24 hours," correct categories, and service area drives emergency call capture.' },
      ],
    }),
    // 1 — schema
    (name, city, catLabel, stats) => ({
      issues: [
        { label: 'LocalBusiness schema',       value: 'Not implemented', status: 'critical' },
        { label: 'Service-type landing pages', value: 'Not present',     status: 'critical' },
        { label: 'Brand/model content',        value: 'Missing or thin', status: 'warning' },
        { label: 'Google Business Profile',    value: 'Incomplete',      status: 'warning' },
      ],
      impact: {
        intro: `Without LocalBusiness schema, Google has no structured signal that ${name} offers emergency generator service in ${city} — a gap that matters most when a searcher needs help immediately, not eventually.`,
        volume: '150+', volumeNote: `Monthly searches for generator service in ${city}`,
        leads: '4–10', leadsNote: 'Estimated service calls lost monthly to schema-marked-up competitors',
        timeline: '20–40 days', timelineNote: 'Estimated time to map pack visibility after schema implementation',
      },
      fixes: [
        { letter: 'A', title: 'Implement LocalBusiness schema',
          body: 'A technical fix requiring no new content — it tells Google the service area, hours, and emergency availability directly.' },
        { letter: 'B', title: 'Build brand and service-type pages to reinforce it',
          body: `Schema and content compound — a page per brand and service gives the new structured data something specific to point to for ${name}.` },
        { letter: 'C', title: 'Optimize Google Business Profile for emergency searches',
          body: 'A verified, fully categorized GBP is the primary driver of emergency call capture once the technical foundation is in place.' },
      ],
    }),
    // 2 — Google Business Profile / emergency
    (name, city, catLabel, stats) => ({
      issues: [
        { label: 'Google Business Profile',    value: 'Incomplete',      status: 'critical' },
        { label: 'Service-type landing pages', value: 'Not present',     status: 'critical' },
        { label: 'Brand/model content',        value: 'Missing or thin', status: 'warning' },
        { label: 'LocalBusiness schema',       value: 'Not implemented', status: 'warning' },
      ],
      impact: {
        intro: `Generator failures are emergencies, and emergency searches convert almost entirely through the map pack. An incomplete Google Business Profile keeps ${name} out of that placement in ${city} exactly when the call would otherwise be an easy win.`,
        volume: '150+', volumeNote: `Monthly local and emergency searches for generator service near ${city}`,
        leads: '4–10', leadsNote: 'Estimated emergency service calls lost to competitors with an optimized listing',
        timeline: '15–35 days', timelineNote: 'Estimated time to map pack visibility after GBP completion',
      },
      fixes: [
        { letter: 'A', title: 'Optimize Google Business Profile for emergency searches',
          body: 'A verified GBP with "Open 24 hours," correct categories, and service area set is the primary driver of emergency call capture.' },
        { letter: 'B', title: 'Build service-type pages linked from the listing',
          body: `GBP services should point to dedicated pages on the site, giving ${name} something specific to rank for planned (non-emergency) searches too.` },
        { letter: 'C', title: 'Add brand/model content',
          body: 'Naming the specific generator brands serviced builds trust and captures brand-specific search volume.' },
      ],
    }),
    // 3 — reviews / trust
    (name, city, catLabel, stats) => ({
      issues: [
        { label: 'Client review volume',       value: 'Below local competitors', status: 'critical' },
        { label: 'Service-type landing pages', value: 'Not present',            status: 'critical' },
        { label: 'Brand/model content',        value: 'Missing or thin',        status: 'warning' },
        { label: 'LocalBusiness schema',       value: 'Not implemented',        status: 'warning' },
      ],
      impact: {
        intro: `Homeowners in ${city} choosing an emergency generator technician lean hard on reviews, often while the power is actually out. A thin review count is a real disadvantage for ${name} in that moment, regardless of the work quality behind it.`,
        volume: '140+', volumeNote: `Monthly searches for generator service in ${city}`,
        leads: '4–9', leadsNote: 'Estimated service calls lost to competitors with stronger review signals',
        timeline: '20–40 days', timelineNote: 'Estimated time to see movement after a sustained review request process',
      },
      fixes: [
        { letter: 'A', title: 'Run a systematic post-service review request process',
          body: `A simple follow-up after every completed job is the most reliable way for ${name} to build review volume over time.` },
        { letter: 'B', title: 'Build service-type pages for reviews to reinforce',
          body: 'Reviews tied to specific services (installation, maintenance, repair) reinforce both trust and search relevance for that term.' },
        { letter: 'C', title: 'Implement LocalBusiness schema',
          body: 'Schema markup surfaces review and rating data more prominently once review volume is built.' },
      ],
    }),
    // 4 — brand/model content
    (name, city, catLabel, stats) => ({
      issues: [
        { label: 'Brand/model content',        value: 'Missing or thin', status: 'critical' },
        { label: 'Service-type landing pages', value: 'Not present',     status: 'critical' },
        { label: 'Google Business Profile',    value: 'Incomplete',      status: 'warning' },
        { label: 'LocalBusiness schema',       value: 'Not implemented', status: 'warning' },
      ],
      impact: {
        intro: `Owners searching for generator service usually search by brand first — "Kohler repair," "Generac maintenance." With no brand-specific content, ${name} misses that first, highest-intent step in the ${city} search regardless of which brands the company actually services.`,
        volume: '150+', volumeNote: `Monthly brand-specific searches for generator service in ${city}`,
        leads: '4–10', leadsNote: 'Estimated service calls lost to competitors with brand-specific pages',
        timeline: '25–45 days', timelineNote: 'Estimated time to page 1 once brand content is live',
      },
      fixes: [
        { letter: 'A', title: 'Build content for each generator brand serviced',
          body: 'Generac, Kohler, and Briggs & Stratton each deserve their own page, capturing the brand-first way most owners search.' },
        { letter: 'B', title: 'Pair brand pages with service-type pages',
          body: `Combined pages like "Generac maintenance ${city}" capture the highest-intent searches available to ${name}.` },
        { letter: 'C', title: 'Optimize Google Business Profile',
          body: 'Listing serviced brands directly on GBP reinforces the new content and supports both planned and emergency searches.' },
      ],
    }),
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

// ─── Deterministic hashing (NO Math.random / Date.now — stable across runs) ───
function hashSlug(str) {
  let sum = 0;
  for (let i = 0; i < str.length; i++) sum += str.charCodeAt(i);
  return sum;
}

// ─── Unique per-firm meta description (used for <meta name="description">,
// og:description, twitter:description, and JSON-LD description — same string
// in all four so they stay consistent, but unique across all 443 pages) ──────
const META_ANGLES = [
  'missing schema markup and thin service pages explain most of the gap',
  'a weak Google Business Profile is the fastest lever to close',
  'content depth trails page 1 competitors by a wide margin',
  'structured data and dedicated service pages are both absent',
  'review volume and listing completeness lag page 1 rivals',
  'local pack visibility is weak relative to nearby competitors',
];
const META_FILLERS = [
  ' Full findings are below.',
  ' The complete breakdown is below.',
  ' See what a page 1 competitor has that this site does not.',
];

function composeMetaDescription(firmName, city, catLabel, hashVal) {
  const catLower = catLabel.toLowerCase();
  const angle = META_ANGLES[hashVal % META_ANGLES.length];
  let desc = `${firmName} in ${city} ranks page 2+ for ${catLower} searches — ${angle}.`;
  if (desc.length < 120) {
    const filler = META_FILLERS[hashVal % META_FILLERS.length];
    desc = desc + filler;
  }
  if (desc.length > 158) {
    let cut = desc.slice(0, 155);
    const lastSpace = cut.lastIndexOf(' ');
    if (lastSpace > 80) cut = cut.slice(0, lastSpace);
    cut = cut.replace(/[.,;:—-]+$/, '');
    desc = cut + '.';
  }
  return desc;
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
  const locDisplay = titleCase(loc);
  const hashVal    = hashSlug(slug);

  const primaryFinding = (firmEntry && firmEntry.primaryFinding) || desc ||
    'This business is currently ranked page 2 or lower for its primary search terms. The digital infrastructure does not reflect the quality of the business or the volume of demand in its market.';

  // Unique, consistent meta description for ALL pages (real-data and fallback
  // alike) — composed from name + city + category + a hash-assigned angle, so
  // it never collides with another firm's description the way a shared
  // generic sentence could.
  const metaDescription = composeMetaDescription(firmName, locDisplay, catLabel, hashVal);

  const searchQ = firmEntry && firmEntry.searchQuery ? firmEntry.searchQuery : '';

  let issues, impact, fixes;
  if (firmEntry) {
    // Real researched data — untouched.
    issues = firmEntry.issues;
    impact = firmEntry.impact;
    fixes  = firmEntry.fixes;
  } else {
    // Pure category fallback — pick a deterministic variant (hash of the
    // firm slug, no Math.random/Date.now) and weave in real per-firm fields
    // so two firms landing on the same variant index still read differently.
    const poolCat = VARIANT_POOLS[cat] ? cat : 'personal-injury';
    const pool = VARIANT_POOLS[poolCat];
    const variantIdx = hashVal % pool.length;
    const variant = pool[variantIdx](firmName, locDisplay, catLabel, stats);
    issues = variant.issues;
    impact = variant.impact;
    fixes  = variant.fixes;
  }

  const badgeDisplay = badge || (catLabel.includes('Law') || catLabel === 'Immigration Law' ? 'Law Firm' : catLabel);

  // Render issues rows
  const issuesHtml = issues.map(issue => {
    const isCritical = issue.status === 'critical';
    const badgeClass = isCritical
      ? 'bg-red-500/10 text-red-400 border border-red-500/20'
      : 'bg-surface-2 text-ink-dim border border-line';
    return `
      <div class="flex justify-between items-center py-4 border-b border-line">
        <span class="text-sm text-ink font-body">${escapeHtml(issue.label)}</span>
        <span class="text-[10px] font-bold tracking-wide uppercase px-2.5 py-1 ${badgeClass}">${escapeHtml(issue.value)}</span>
      </div>`
  }).join('');

  // Render fix cards
  const fixesHtml = fixes.map(fix => `
    <div class="bg-surface border border-line p-8">
      <div class="flex items-start gap-6">
        <span class="font-serif italic text-3xl text-gold shrink-0">${escapeHtml(fix.letter)}</span>
        <div>
          <h3 class="text-sm font-semibold text-ink mb-3">${escapeHtml(fix.title)}</h3>
          <p class="text-sm text-ink-dim leading-relaxed">${escapeHtml(fix.body)}</p>
        </div>
      </div>
    </div>`
  ).join('');

  return `<!DOCTYPE html>
<html class="dark" lang="en">
<head>
<meta charset="utf-8"/>
<meta content="width=device-width, initial-scale=1.0" name="viewport"/>
<title>Visibility Audit | ${escapeHtml(firmName)} | Entropia Ventures</title>
<meta name="description" content="${escapeHtml(metaDescription)}"/>
<link rel="canonical" href="${canonUrl}"/>
<meta property="og:title" content="${escapeHtml(firmName)} Visibility Audit | Entropia Ventures"/>
<meta property="og:description" content="${escapeHtml(metaDescription)}"/>
<meta property="og:url" content="${canonUrl}"/>
<meta property="og:site_name" content="Entropia Ventures"/>
<meta property="og:type" content="article"/>
<meta name="twitter:card" content="summary_large_image"/>
<meta name="twitter:description" content="${escapeHtml(metaDescription)}"/>
<meta property="og:image" content="https://entropia.ventures/assets/media/hero-poster.jpg"/>
<meta name="twitter:image" content="https://entropia.ventures/assets/media/hero-poster.jpg"/>
<link rel="icon" href="/favicon.svg" type="image/svg+xml"/>
<link rel="apple-touch-icon" href="/apple-touch-icon.png"/>
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
<link rel="preconnect" href="https://cdn.tailwindcss.com"/>
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "${escapeHtml(firmName)} Visibility Audit",
  "description": "${escapeHtml(metaDescription)}",
  "url": "${canonUrl}",
  "publisher": {
    "@type": "Organization",
    "name": "Entropia Ventures",
    "url": "https://entropia.ventures"
  }
}
</script>
<link href="https://fonts.googleapis.com/css2?family=Noto+Serif:ital,wght@0,400;0,700;1,400;1,700&family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet"/>
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet"/>
<script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script>
<script id="tailwind-config">
tailwind.config = {
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        "base": "#050f0b",
        "base-deep": "#00130d",
        "surface": "#0a1a13",
        "surface-2": "#10231a",
        "line": "#1d332a",
        "ink": "#f9f9f8",
        "ink-dim": "#9fb3aa",
        "ink-faint": "#8fa39a",
        "gold": "#C9A84C",
        "gold-bright": "#ffe08f",
        "gold-dim": "#8a7434"
      },
      fontFamily: {
        serif: ["Noto Serif", "serif"],
        sans: ["Inter", "sans-serif"]
      }
    }
  }
}
</script>
<style>
  body { font-family: 'Inter', sans-serif; }
  .material-symbols-outlined { font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24; }
  .btn-primary {
    display: inline-flex; align-items: center; justify-content: center; gap: 0.5rem;
    background: #C9A84C; color: #00130d;
    text-transform: uppercase; letter-spacing: 0.15em; font-size: 11px; font-weight: 500;
    padding: 0.9rem 1.75rem;
    transition: background 0.2s ease, transform 0.1s ease;
  }
  .btn-primary:hover { background: #ffe08f; }
  .btn-primary:active { transform: scale(0.95); }
  #mobile-menu { transition: opacity 0.25s ease; }
  #mobile-menu.is-open { display: flex !important; }
</style>
</head>
<body class="bg-base text-ink font-sans selection:bg-gold/30">

<!-- Nav -->
<nav class="fixed top-0 inset-x-0 z-50 bg-base/80 backdrop-blur-xl border-b border-line">
  <div class="max-w-7xl mx-auto flex items-center justify-between px-8 py-4">
    <a href="/" class="font-serif italic text-2xl text-ink tracking-tight">ENTROPIA</a>
    <div class="hidden md:flex items-center gap-10">
      <a href="/services" class="text-[11px] uppercase tracking-[0.2em] font-medium text-ink-dim hover:text-gold-bright transition-colors">The System</a>
      <a href="/process" class="text-[11px] uppercase tracking-[0.2em] font-medium text-ink-dim hover:text-gold-bright transition-colors">How It Works</a>
      <a href="/audits/" class="text-[11px] uppercase tracking-[0.2em] font-medium text-gold-bright transition-colors">Audits</a>
      <a href="/blog/" class="text-[11px] uppercase tracking-[0.2em] font-medium text-ink-dim hover:text-gold-bright transition-colors">Blog</a>
    </div>
    <div class="hidden md:block">
      <a href="/contact" class="btn-primary">Get your free audit</a>
    </div>
    <button id="menu-toggle" class="md:hidden text-ink" aria-label="Open menu" aria-expanded="false" aria-controls="mobile-menu">
      <span class="material-symbols-outlined text-3xl">menu</span>
    </button>
  </div>
</nav>

<!-- Mobile menu overlay -->
<div id="mobile-menu" class="fixed inset-0 z-[60] bg-base-deep hidden flex-col" role="dialog" aria-modal="true">
  <div class="flex items-center justify-between px-8 py-4 border-b border-line">
    <a href="/" class="font-serif italic text-2xl text-ink">ENTROPIA</a>
    <button id="menu-close" class="text-ink" aria-label="Close menu">
      <span class="material-symbols-outlined text-3xl">close</span>
    </button>
  </div>
  <div class="flex flex-col items-start gap-8 px-8 py-16">
    <a href="/services" class="mobile-link text-3xl font-serif text-ink hover:text-gold-bright transition-colors">The System</a>
    <a href="/process" class="mobile-link text-3xl font-serif text-ink hover:text-gold-bright transition-colors">How It Works</a>
    <a href="/audits/" class="mobile-link text-3xl font-serif text-gold-bright transition-colors">Audits</a>
    <a href="/blog/" class="mobile-link text-3xl font-serif text-ink hover:text-gold-bright transition-colors">Blog</a>
    <a href="/contact" class="mobile-link btn-primary mt-4">Get your free audit</a>
  </div>
</div>

<main class="pt-28 pb-32">

  <!-- Breadcrumb -->
  <div class="px-8 md:px-12 max-w-screen-xl mx-auto mb-12">
    <div class="flex items-center gap-2 text-[10px] font-semibold tracking-widest uppercase text-ink-faint">
      <a href="/audits/" class="hover:text-gold-bright transition-colors">Audit Registry</a>
      <span class="opacity-40">—</span>
      <span class="text-ink-dim">${escapeHtml(catLabel)}</span>
    </div>
  </div>

  <!-- Hero -->
  <header class="px-8 md:px-12 max-w-screen-xl mx-auto mb-16">
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-12 items-end">
      <div class="lg:col-span-8">
        <div class="flex items-center gap-3 mb-8">
          <div class="w-2 h-2 rounded-full bg-gold pulse-dot"></div>
          <span class="text-[10px] font-bold tracking-[0.25em] uppercase text-ink-faint">Visibility Audit · ${escapeHtml(catLabel)}</span>
        </div>
        <h1 class="text-5xl md:text-7xl font-serif italic text-ink leading-tight mb-4">${escapeHtml(firmName)}.</h1>
        <p class="text-base text-ink-dim font-light tracking-wide mb-6">${escapeHtml(locDisplay)}</p>
        <p class="text-lg text-ink-dim leading-relaxed max-w-2xl font-light">${escapeHtml(primaryFinding)}</p>
      </div>
      <div class="lg:col-span-4 border-l border-line pl-8 flex flex-col gap-6">
        <div>
          <span class="block font-serif text-4xl text-gold">${stats.effectiveGap}%</span>
          <span class="block text-[10px] uppercase tracking-[0.15em] text-ink-faint font-semibold mt-1">Visibility Gap</span>
        </div>
        <div>
          <span class="block font-serif italic text-lg text-gold">${escapeHtml(pid)}</span>
          <span class="block text-[10px] uppercase tracking-[0.15em] text-ink-faint font-semibold mt-1">Matter ID</span>
        </div>
        <div>
          <span class="block font-serif text-lg text-gold">April 2026</span>
          <span class="block text-[10px] uppercase tracking-[0.15em] text-ink-faint font-semibold mt-1">Audit Date</span>
        </div>
      </div>
    </div>
  </header>

  <!-- Stats Grid -->
  <section class="px-8 md:px-12 max-w-screen-xl mx-auto mb-24">
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <div class="bg-surface border border-line p-8 flex flex-col justify-between h-48">
        <p class="text-[10px] font-bold tracking-widest uppercase text-ink-faint">Visibility Gap</p>
        <div>
          <span class="text-4xl font-serif text-red-400">${stats.effectiveGap}%</span>
        </div>
        <p class="text-[10px] uppercase tracking-widest font-semibold text-red-400">${escapeHtml(stats.gapSeverity)}</p>
      </div>
      <div class="bg-surface border border-line p-8 flex flex-col justify-between h-48">
        <p class="text-[10px] font-bold tracking-widest uppercase text-ink-faint">Google Position</p>
        <div>
          <span class="text-4xl font-serif text-gold">${escapeHtml(stats.position)}</span>
        </div>
        <p class="text-[10px] uppercase tracking-widest font-semibold text-ink-faint">${searchQ ? `&quot;${escapeHtml(searchQ)}&quot;` : 'Organic Search'}</p>
      </div>
      <div class="bg-surface border border-line p-8 flex flex-col justify-between h-48">
        <p class="text-[10px] font-bold tracking-widest uppercase text-ink-faint">Content Score</p>
        <div>
          <span class="text-4xl font-serif text-gold">${stats.contentScore}</span>
          <span class="text-lg font-serif text-ink-dim">/100</span>
        </div>
        <p class="text-[10px] uppercase tracking-widest font-semibold text-ink-faint">${escapeHtml(stats.contentLabel)}</p>
      </div>
      <div class="bg-surface border border-line p-8 flex flex-col justify-between h-48">
        <p class="text-[10px] font-bold tracking-widest uppercase text-ink-faint">Schema Markup</p>
        <div>
          <span class="text-2xl font-serif italic text-gold">${escapeHtml(stats.schemaStatus)}</span>
        </div>
        <p class="text-[10px] uppercase tracking-widest font-semibold text-ink-faint">${escapeHtml(stats.schemaLabel)}</p>
      </div>
    </div>
  </section>

  <!-- Section 01: Primary Finding -->
  <section class="px-8 md:px-12 max-w-screen-xl mx-auto mb-32">
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-16">
      <div class="lg:col-span-1">
        <p class="font-serif italic text-4xl mb-4 text-ink-faint">01 —</p>
        <h2 class="text-[11px] tracking-[0.3em] uppercase font-bold mb-6 text-gold">Primary Finding</h2>
        <p class="text-ink-dim text-sm leading-relaxed mb-8">${escapeHtml(primaryFinding)}</p>
        <div class="w-10 h-0.5 bg-gold"></div>
      </div>
      <div class="lg:col-span-2">
        <div class="mb-6">
          <div class="flex justify-between items-end mb-2">
            <span class="text-[10px] font-bold tracking-widest uppercase text-ink-faint">Visibility Gap</span>
            <span class="font-serif text-2xl text-gold">${stats.effectiveGap}%</span>
          </div>
          <div class="w-full h-2 bg-surface-2">
            <div class="h-full bg-gold" style="width:${stats.effectiveGap}%"></div>
          </div>
        </div>
        <div class="space-y-0 mt-10">
          ${issuesHtml}
        </div>
      </div>
    </div>
  </section>

  <!-- Section 02: Revenue Impact -->
  <section class="bg-base-deep py-24 mb-32">
    <div class="px-8 md:px-12 max-w-screen-xl mx-auto">
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-16 items-start">
        <div>
          <p class="font-serif italic text-4xl mb-4 text-ink-faint">02 —</p>
          <h2 class="text-[11px] tracking-[0.3em] uppercase font-bold mb-6 text-gold">Revenue Impact</h2>
          <p class="text-ink-dim text-sm leading-relaxed">${escapeHtml(impact.intro)}</p>
        </div>
        <div class="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div class="bg-surface border border-line p-8">
            <p class="text-[10px] font-bold tracking-widest uppercase text-ink-faint mb-4">Monthly Search Volume</p>
            <p class="font-serif text-3xl text-gold mb-2">${escapeHtml(impact.volume)}</p>
            <p class="text-xs text-ink-dim leading-relaxed">${escapeHtml(impact.volumeNote)}</p>
          </div>
          <div class="bg-surface border border-line p-8">
            <p class="text-[10px] font-bold tracking-widest uppercase text-ink-faint mb-4">Leads Lost Monthly</p>
            <p class="font-serif text-3xl text-gold mb-2">${escapeHtml(impact.leads)}</p>
            <p class="text-xs text-ink-dim leading-relaxed">${escapeHtml(impact.leadsNote)}</p>
          </div>
          <div class="bg-surface border border-line p-8">
            <p class="text-[10px] font-bold tracking-widest uppercase text-ink-faint mb-4">Top Competitor</p>
            <p class="font-serif text-xl italic text-gold mb-2">Page 1 incumbents</p>
            <p class="text-xs text-ink-dim leading-relaxed">Firms currently capturing this organic demand with structured content and schema</p>
          </div>
          <div class="bg-surface border border-line p-8">
            <p class="text-[10px] font-bold tracking-widest uppercase text-ink-faint mb-4">Gap Closeable In</p>
            <p class="font-serif text-3xl text-gold mb-2">${escapeHtml(impact.timeline)}</p>
            <p class="text-xs text-ink-dim leading-relaxed">${escapeHtml(impact.timelineNote)}</p>
          </div>
        </div>
      </div>
    </div>
  </section>

  <!-- Section 03: Infrastructure Fixes -->
  <section class="px-8 md:px-12 max-w-screen-xl mx-auto mb-32">
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-16 items-start">
      <div class="lg:sticky lg:top-32">
        <p class="font-serif italic text-4xl mb-4 text-ink-faint">03 —</p>
        <h2 class="text-[11px] tracking-[0.3em] uppercase font-bold mb-6 text-gold">Infrastructure Fixes</h2>
        <div class="bg-surface border border-gold/40 p-8">
          <p class="font-serif italic text-lg text-ink mb-3">Actionable Protocol</p>
          <p class="text-xs text-ink-dim leading-relaxed">These structural changes are the highest-leverage path to page 1. Most can be implemented within 30 days.</p>
        </div>
      </div>
      <div class="lg:col-span-2 space-y-10">
        ${fixesHtml}
      </div>
    </div>
  </section>

  <!-- CTA band -->
  <div class="bg-base-deep border-t border-line">
    <div class="max-w-screen-xl mx-auto px-8 md:px-12 py-10 flex flex-col md:flex-row justify-between items-center gap-6">
      <div>
        <p class="text-[10px] font-bold tracking-widest uppercase text-ink-faint">Ready to close this gap?</p>
        <p class="font-serif italic text-lg text-ink mt-1">Start with a conversation — the findings above are yours either way.</p>
      </div>
      <a href="/contact" class="btn-primary flex items-center gap-3 shrink-0">
        Request Full Engagement →
      </a>
    </div>
  </div>

</main>

<!-- Footer -->
<footer class="bg-base-deep border-t border-line" style="padding-bottom:80px;">
  <div class="max-w-7xl mx-auto px-8 py-16 grid grid-cols-1 md:grid-cols-3 gap-12">
    <div>
      <a href="/" class="font-serif italic text-2xl text-ink">ENTROPIA</a>
      <p class="mt-4 text-ink-dim text-sm leading-relaxed max-w-xs">We help service businesses turn leads into revenue.</p>
    </div>
    <div class="flex flex-col gap-3">
      <a href="/services" class="text-[11px] uppercase tracking-[0.2em] font-medium text-ink-dim hover:text-gold-bright transition-colors">The System</a>
      <a href="/process" class="text-[11px] uppercase tracking-[0.2em] font-medium text-ink-dim hover:text-gold-bright transition-colors">How It Works</a>
      <a href="/audits/" class="text-[11px] uppercase tracking-[0.2em] font-medium text-ink-dim hover:text-gold-bright transition-colors">Audits</a>
      <a href="/blog/" class="text-[11px] uppercase tracking-[0.2em] font-medium text-ink-dim hover:text-gold-bright transition-colors">Blog</a>
      <a href="/contact" class="text-[11px] uppercase tracking-[0.2em] font-medium text-ink-dim hover:text-gold-bright transition-colors">Contact</a>
    </div>
    <div class="flex flex-col gap-3 md:items-end">
      <a href="https://linkedin.com/company/entropia-ventures" target="_blank" rel="noopener" class="text-[11px] uppercase tracking-[0.2em] font-medium text-ink-dim hover:text-gold-bright transition-colors">LinkedIn</a>
      <p class="text-ink-faint text-xs mt-6 md:mt-auto">© 2026 Entropia Ventures</p>
    </div>
  </div>
</footer>

<script>
(function () {
  var toggle = document.getElementById('menu-toggle');
  var closeBtn = document.getElementById('menu-close');
  var menu = document.getElementById('mobile-menu');
  function openMenu() {
    menu.classList.remove('hidden');
    menu.classList.add('is-open', 'flex');
    toggle.setAttribute('aria-expanded', 'true');
    document.body.style.overflow = 'hidden';
  }
  function closeMenu() {
    menu.classList.add('hidden');
    menu.classList.remove('is-open', 'flex');
    toggle.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
  }
  if (toggle && closeBtn && menu) {
    toggle.addEventListener('click', openMenu);
    closeBtn.addEventListener('click', closeMenu);
    menu.querySelectorAll('a').forEach(function (a) { a.addEventListener('click', closeMenu); });
  }
})();
</script>
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

Entropia Ventures publishes free public visibility audits showing where law firms and local SMBs rank on Google, what digital infrastructure is missing, and how to fix it. No public pricing — contact for a quote.

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

- [Services](https://entropia.ventures/services.html) — Full-stack SEO and content infrastructure for law firms and local SMBs.
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

  // llms.txt: SKIPPED. llms.txt was rewritten separately with the current
  // lead-conversion positioning (no public pricing) and is already committed —
  // the Audit Registry / Audit Categories sections in that file are identical to
  // what buildLlmsTxt() below would produce, so there is nothing new to regenerate
  // here. Do not overwrite it. If audit categories ever change, update llms.txt's
  // Audit Categories section by hand (or re-enable buildLlmsTxt() below — its
  // positioning copy has been kept in sync with the no-pricing rule, but re-verify
  // it against the live llms.txt before turning this write back on).
  console.log('[prerender] Skipping llms.txt write (committed file already current).');

  console.log('[prerender] Done.');
}

main();
