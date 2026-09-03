/*
 * Services page interactive demo — data.
 * Source of truth: ~/work/entropia-ventures/specs/2026-09-02-services-demo-copy.md
 * (post R1-R10 build rulings). All visitor-facing copy here is verbatim from
 * that doc. No network calls, no dependencies — plain data on window.EV_DEMO.
 */
(function () {
  'use strict';

  var rail = [
    {
      n: '01',
      heading: 'Capture. Every lead lands in one place.',
      replaces: '“Did anyone see that form from Tuesday?”'
    },
    {
      n: '02',
      heading: 'Respond. In seconds, every time.',
      replaces: 'the voicemail nobody checks until Thursday.'
    },
    {
      n: '03',
      heading: 'Qualify. A few useful questions.',
      replaces: 'driving forty minutes to quote a job that was never real.'
    },
    {
      n: '04',
      heading: 'Route. A named owner, every time.',
      replaces: '“I thought you were handling that one.”'
    },
    {
      n: '05',
      heading: 'Book. A real slot on a real calendar.',
      replaces: 'three days of phone tag to schedule one estimate.'
    },
    {
      n: '06',
      heading: 'Follow up. Politely. Relentlessly.',
      replaces: 'the quote you meant to chase and never did.'
    },
    {
      n: '07',
      heading: 'Track. One board, the whole truth.',
      replaces: 'finding out a lead died three weeks after it happened.'
    },
    {
      n: '08',
      heading: 'Improve. One leak at a time, every month.',
      replaces: '“marketing feels like it’s working… I think?”'
    }
  ];

  var shared = {
    setup: {
      eyebrow: 'Try it yourself',
      tradeLabel: 'Pick a trade',
      sourceLabel: 'Pick how the lead came in',
      nameLabel: 'Your name',
      namePlaceholder: 'Miguel',
      startButton: 'Start the demo',
      helper: 'Play the customer. Watch the dashboard respond live.',
      simulationNote: 'Simulation. No messages are sent.',
      companyLabel: 'Your business name'
    },
    timer: {
      label: 'Time to first reply'
    },
    buttons: {
      notNow: 'Not now',
      audit: 'Get your free audit',
      again: 'Run it again as a different trade'
    },
    endings: {
      booked: {
        lines: [
          'That’s the whole thing, start to finish.',
          'It runs the same way on every lead, day or night.'
        ],
        usually: ['Voicemail', 'Callback Thursday', 'Already hired someone'],
        withSystem: ['Replied in 0:07', 'Booked {slot}', '{teamMember} closed it Fri']
      },
      followUp: {
        lines: [
          'This lead almost went quiet.',
          'A follow-up brought it back.'
        ],
        usually: ['Went quiet', 'No follow-up sent', 'Lead assumed dead'],
        withSystem: ['Automatic follow-up', 'Lead replied Day 9', 'Booked after follow-up']
      },
      nurture: {
        lines: [
          'Not every lead is a fit today.',
          'The system still keeps it on file for later.'
        ],
        usually: ['Chased anyway', 'Wasted a site visit', 'No record kept'],
        withSystem: ['Flagged as low fit', 'No {resource} time spent', 'Kept on file for later']
      }
    },
    noJsIntro: 'Here’s how one lead moves through the system, start to finish.',
    activity: {
      s01: ['4:12 pm · Lead captured from {sourceLabel}', '4:12 pm · Text consent recorded'],
      s02: ['4:12 pm · Replied in 0:07'],
      s03: ['4:13 pm · Scored against {shortName} rules'],
      s03Qualified: 'Qualified',
      s03Weak: 'Low fit',
      weak: ['4:13 pm · Low fit · nurture sequence scheduled', 'Day 30 · Check-in text scheduled'],
      s04: [
        '4:13 pm · Alert sent to {teamMember}’s phone',
        '4:21 pm · No reply from {teamFirstName} · escalated to {owner}',
        '4:22 pm · {owner} acknowledged'
      ],
      s05: ['4:24 pm · Booked {slot}', 'Reminder scheduled {reminderTime}'],
      s06: [
        'Day 2, 10:00 am · Follow-up 1 sent',
        'Day 5, 3:00 pm · Follow-up 2 sent',
        'Day 9 · Lead replied · booking reopened'
      ],
      s07: [
        '{slot} · Visit completed · {teamMember} moved card to {milestoneCol}',
        '{nextDay} · {teamMember} marked Won'
      ],
      s08: ['Month end · Report sent to {owner}'],
      handoff: '{teamMember} took over the thread'
    },
    queue: [
      { text: 'New · Website form · Ana P.' },
      { text: 'New · Instagram DM · Luis O.' },
      { text: 'New · Missed call · Kim T.' }
    ],
    tabs: {
      customer: 'Customer',
      dashboard: 'Your dashboard'
    },
    alerts: {
      app: 'LEAD SYSTEM',
      time: 'now',
      newLeadTitle: 'New lead — {firstName}',
      newLeadBody: '{serviceAnswer} · {areaAnswer}. Tap to claim.',
      unclaimedTitle: 'Unclaimed lead',
      unclaimedBody: '{teamMember} hasn’t replied · escalated to {owner}.'
    }
  };

  var sources = {
    'missed-call': {
      id: 'missed-call',
      label: 'Missed call',
      leadCardSource: 'Source: Missed call',
      consentLine: 'OK to text ✓',
      openingLine: 'Sorry we missed your call — what can we help with?'
    },
    'website-form': {
      id: 'website-form',
      label: 'Website form',
      leadCardSource: 'Source: Website form',
      consentLine: 'Email + text consent ✓',
      openingLine: 'Thanks for the form — what can we help with?'
    },
    'google-business': {
      id: 'google-business',
      label: 'Google Business message',
      leadCardSource: 'Source: Google Business Profile',
      consentLine: 'OK to text ✓',
      openingLine: 'Thanks for messaging us on Google — how can we help?'
    },
    'instagram-dm': {
      id: 'instagram-dm',
      label: 'Facebook/Instagram DM',
      leadCardSource: 'Source: Instagram DM',
      consentLine: 'OK to text ✓',
      openingLine: 'Thanks for the DM — what can we help with?'
    }
  };

  var trades = {
    landscaping: {
      id: 'landscaping',
      label: 'Landscaping / lawn care',
      company: 'Hill Country Lawn & Landscape',
      owner: 'Danny',
      teamMember: 'Rosa M.',
      areaLabel: 'Plano + 20 mi',
      questions: [
        {
          text: 'What do you need done?',
          answers: [
            { text: 'Regular mowing', weak: false, ack: 'Got it — mowing crew has openings this week.', label: 'Service: lawn care' },
            { text: 'New landscape design', weak: false, ack: 'Design visits book fast — good timing.', label: 'Service: landscape design' },
            { text: 'Just checking prices', weak: false, ack: 'Good to know — we’ll walk through options when we connect.', label: 'Service: price inquiry' }
          ]
        },
        {
          text: 'Where’s the property?',
          answers: [
            { text: 'In Plano', weak: false, ack: 'Good — that’s right in our territory.', label: 'Area: in territory' },
            { text: 'Just outside Plano', weak: false, ack: 'We can usually reach that area too.', label: 'Area: nearby, usually covered' },
            { text: 'Not in the area', weak: true, ack: 'Thanks for letting us know your location.', label: 'Area: outside territory' }
          ]
        },
        {
          text: 'When do you want this done?',
          answers: [
            { text: 'This week', weak: false, ack: 'This week works — we’ll get you scheduled.', label: 'Timeline: this week' },
            { text: 'This month', weak: false, ack: 'This month works fine for our crew.', label: 'Timeline: this month' },
            { text: 'Just researching for now', weak: false, ack: 'No rush — happy to answer questions.', label: 'Timeline: researching' }
          ]
        }
      ],
      slotType: 'Site visit',
      slots: ['Thu 10:30am', 'Fri 2:00pm', 'Mon 9:00am'],
      bookedConfirmation: 'You’re set for Thu 10:30am — a reminder text goes out day of.',
      followUp: [
        { timing: 'Day 2, 10:00 am', text: 'Still want a lawn quote? Happy to set a time.' },
        { timing: 'Day 5, 3:00 pm', text: 'No rush — just say the word when ready.' },
        { timing: 'Day 9, 11:00 am', text: 'Closing this out for now. Text us anytime.' }
      ],
      pipelineColumns: ['New', 'Contacted', 'Quoted', 'Booked', 'Job scheduled', 'Won'],
      reportLine: 'Lawn care leads mostly stall between the quote and the follow-up call.',
      nurtureLine: 'Outside our service area for now — we’ll keep you in mind if that changes.',
      resourceLabel: 'crew',
      shortName: 'landscaping',
      nurtureStamp: 'Low fit · routed to nurture · no crew time spent',
      humanLine: 'Hi {name}, Rosa here. See you {day}, I’ll text when I’m on my way.'
    },

    roofing: {
      id: 'roofing',
      label: 'Roofing / remodeling',
      company: 'Lone Star Roofing & Remodel',
      owner: 'Chris',
      teamMember: 'Marcus T.',
      areaLabel: 'San Antonio metro',
      questions: [
        {
          text: 'What’s the project?',
          answers: [
            { text: 'Storm damage', weak: false, ack: 'Got it — we’ll get eyes on it fast.', label: 'Project: storm damage' },
            { text: 'Full re-roof', weak: false, ack: 'Noted — full re-roofs need a site look.', label: 'Project: full re-roof' },
            { text: 'Just gathering ideas for now', weak: false, ack: 'Good — we’ll share some options when we connect.', label: 'Project: early research' }
          ]
        },
        {
          text: 'Where’s the property?',
          answers: [
            { text: 'San Antonio', weak: false, ack: 'Good — right in our service area.', label: 'Area: in territory' },
            { text: 'Just outside San Antonio', weak: false, ack: 'We can usually cover that area too.', label: 'Area: nearby, usually covered' },
            { text: 'Somewhere else in Texas', weak: true, ack: 'Thanks for sharing your location.', label: 'Area: outside territory' }
          ]
        },
        {
          text: 'How soon do you need this?',
          answers: [
            { text: 'Right away — there’s active damage', weak: false, ack: 'Understood — we’ll treat this as urgent.', label: 'Timeline: urgent' },
            { text: 'Within a few weeks', weak: false, ack: 'That timeline works well for our crew.', label: 'Timeline: within weeks' },
            { text: 'Just planning ahead', weak: false, ack: 'Good to know — no rush on our end.', label: 'Timeline: planning ahead' }
          ]
        }
      ],
      slotType: 'Roof inspection',
      slots: ['Tue 9:00am', 'Wed 1:00pm', 'Thu 4:00pm'],
      bookedConfirmation: 'You’re set for Tue 9:00am — Marcus will call before arriving.',
      followUp: [
        { timing: 'Day 2, 9:00 am', text: 'Still need that roof looked at? We can fit you in.' },
        { timing: 'Day 4, 2:00 pm', text: 'Happy to schedule whenever works for you.' },
        { timing: 'Day 8, 10:00 am', text: 'Closing this out for now — reach out anytime.' }
      ],
      pipelineColumns: ['New', 'Contacted', 'Inspected', 'Quoted', 'Booked', 'Won'],
      reportLine: 'Roofing leads usually leak between the inspection and the signed estimate.',
      nurtureLine: 'Outside our service area for now — we’ll keep you in mind if that changes.',
      resourceLabel: 'crew',
      shortName: 'roofing',
      nurtureStamp: 'Low fit · routed to nurture · no crew time spent',
      humanLine: 'Hi {name}, Marcus here. See you {day} — I’ll call before I head over.'
    },

    law: {
      id: 'law',
      label: 'Law firm (immigration + personal injury)',
      company: 'Rivera Law Group',
      owner: 'Elena',
      teamMember: 'David K.',
      areaLabel: 'Harris County',
      questions: [
        {
          text: 'What’s the situation?',
          answers: [
            { text: 'Immigration matter', weak: false, ack: 'Got it — we’ll match you with the right attorney.', label: 'Matter: immigration' },
            { text: 'Personal injury case', weak: false, ack: 'Noted — we’ll review your case details.', label: 'Matter: personal injury' },
            { text: 'Not sure yet', weak: false, ack: 'No problem — the consultation will sort that out.', label: 'Matter: needs guidance' }
          ]
        },
        {
          text: 'Where did this happen or where do you live?',
          answers: [
            { text: 'Harris County', weak: false, ack: 'Good — that’s within our service area.', label: 'Area: in territory' },
            { text: 'Nearby county', weak: false, ack: 'We can usually take cases from there too.', label: 'Area: nearby, usually covered' },
            { text: 'Outside our area', weak: false, ack: 'Thanks for letting us know.', label: 'Area: outside territory' }
          ]
        },
        {
          text: 'How soon do you need to talk to someone?',
          answers: [
            { text: 'This week', weak: false, ack: 'We’ll get a consultation set up quickly.', label: 'Timeline: this week' },
            { text: 'Within a month', weak: false, ack: 'That timeline works for our intake team.', label: 'Timeline: within a month' },
            { text: 'Just gathering information', weak: true, ack: 'No problem — happy to answer questions first.', label: 'Timeline: information only' }
          ]
        }
      ],
      slotType: 'Consultation call',
      slots: ['Mon 11:00am', 'Wed 3:00pm', 'Fri 9:30am'],
      bookedConfirmation: 'You’re set for Mon 11:00am. This is a consultation, not legal advice.',
      followUp: [
        { timing: 'Day 2, 10:00 am', text: 'Still want to schedule your consultation? We have openings.' },
        { timing: 'Day 5, 1:00 pm', text: 'Happy to set a time whenever works for you.' },
        { timing: 'Day 9, 11:00 am', text: 'Closing this out for now — reach out anytime.' }
      ],
      pipelineColumns: ['New', 'Contacted', 'Consultation booked', 'Retained', 'Won'],
      reportLine: 'Immigration and injury leads mostly stall waiting on the consultation booking.',
      nurtureLine: 'Just gathering information for now — we’ll follow up when you’re ready to talk.',
      resourceLabel: 'attorney',
      shortName: 'law firm',
      nurtureStamp: 'Low fit · routed to nurture · no attorney time spent',
      humanLine: 'Hi {name}, David here. See you {day} for your consultation.'
    },

    hvac: {
      id: 'hvac',
      label: 'HVAC / plumbing',
      company: 'Alamo Air & Plumbing',
      owner: 'Tony',
      teamMember: 'Priya N.',
      areaLabel: 'Austin + 15 mi',
      questions: [
        {
          text: 'What’s going on?',
          answers: [
            { text: 'AC or heat isn’t working', weak: false, ack: 'Got it — we’ll treat this as urgent.', label: 'Service: urgent repair' },
            { text: 'Looking at a new system', weak: false, ack: 'Noted — new systems need a site visit.', label: 'Service: new system' },
            { text: 'Just curious what’s out there', weak: false, ack: 'Good — we’ll walk through options when we connect.', label: 'Service: browsing options' }
          ]
        },
        {
          text: 'Where’s the property?',
          answers: [
            { text: 'Austin', weak: false, ack: 'Good — right in our service area.', label: 'Area: in territory' },
            { text: 'Just outside Austin', weak: false, ack: 'We can usually reach that area too.', label: 'Area: nearby, usually covered' },
            { text: 'Somewhere else nearby', weak: false, ack: 'Thanks for sharing your location.', label: 'Area: outside territory' }
          ]
        },
        {
          text: 'How soon do you need this?',
          answers: [
            { text: 'Today or tomorrow', weak: false, ack: 'We’ll get someone out right away.', label: 'Timeline: urgent' },
            { text: 'This week', weak: false, ack: 'That timeline works well for our team.', label: 'Timeline: this week' },
            { text: 'Just planning ahead', weak: true, ack: 'Good to know — no rush on our end.', label: 'Timeline: planning ahead' }
          ]
        }
      ],
      slotType: 'Service call',
      slots: ['Today 3:00pm', 'Tomorrow 9:00am', 'Tomorrow 1:00pm'],
      bookedConfirmation: 'You’re set for today 3:00pm — Priya will text before arriving.',
      followUp: [
        { timing: 'Day 1, 4:00 pm', text: 'Still need that system looked at? We can fit you in.' },
        { timing: 'Day 3, 10:00 am', text: 'Happy to schedule whenever works best for you.' },
        { timing: 'Day 7, 2:00 pm', text: 'Closing this out for now — reach out anytime.' }
      ],
      pipelineColumns: ['New', 'Contacted', 'Diagnosed', 'Quoted', 'Booked', 'Won'],
      reportLine: 'HVAC leads usually leak between the diagnosis and the scheduled repair.',
      nurtureLine: 'Just planning ahead for now — we’ll follow up when you’re ready.',
      resourceLabel: 'technician',
      shortName: 'HVAC',
      nurtureStamp: 'Low fit · routed to nurture · no technician time spent',
      humanLine: 'Hi {name}, Priya here. See you {day} — I’ll text when I’m on my way.'
    },

    dentist: {
      id: 'dentist',
      label: 'Dentist',
      company: 'Bluebonnet Family Dental',
      owner: 'Amit',
      teamMember: 'Jenny L.',
      areaLabel: 'North Dallas',
      questions: [
        {
          text: 'What brings you in?',
          answers: [
            { text: 'Regular cleaning', weak: false, ack: 'Got it — cleanings book up fast.', label: 'Reason: cleaning' },
            { text: 'Tooth pain or a concern', weak: false, ack: 'Noted — we’ll get you seen soon.', label: 'Reason: specific concern' },
            { text: 'Just comparing dentists nearby', weak: true, ack: 'Thanks — we’ll send some information over.', label: 'Reason: comparing offices' }
          ]
        },
        {
          text: 'Do you have dental insurance?',
          answers: [
            { text: 'Yes', weak: false, ack: 'Good — we’ll have that ready for your visit.', label: 'Insurance: on file' },
            { text: 'No', weak: false, ack: 'No problem — we can go over options.', label: 'Insurance: none, options offered' },
            { text: 'Not sure', weak: false, ack: 'That’s fine — we’ll help you check.', label: 'Insurance: needs verification' }
          ]
        },
        {
          text: 'How soon would you like an appointment?',
          answers: [
            { text: 'This week', weak: false, ack: 'This week works — we’ll get you scheduled.', label: 'Timeline: this week' },
            { text: 'This month', weak: false, ack: 'This month works fine for our office.', label: 'Timeline: this month' },
            { text: 'Just exploring for now', weak: false, ack: 'No rush — happy to answer questions first.', label: 'Timeline: exploring' }
          ]
        }
      ],
      slotType: 'New patient appointment',
      slots: ['Tue 10:00am', 'Thu 2:30pm', 'Fri 9:00am'],
      bookedConfirmation: 'You’re set for Tue 10:00am — a reminder text goes out the day before.',
      followUp: [
        { timing: 'Day 2, 9:00 am', text: 'Still want to book your appointment? We have openings.' },
        { timing: 'Day 5, 1:00 pm', text: 'Happy to find a time that works for you.' },
        { timing: 'Day 9, 11:00 am', text: 'Closing this out for now — reach out anytime.' }
      ],
      pipelineColumns: ['New', 'Contacted', 'Insurance checked', 'Booked', 'Seen', 'Won'],
      reportLine: 'New patient leads mostly stall between first contact and booking the appointment.',
      nurtureLine: 'Just comparing offices for now — we’ll follow up before your next cleaning is due.',
      resourceLabel: 'chair',
      shortName: 'dental',
      nurtureStamp: 'Low fit · routed to nurture · no chair time spent',
      humanLine: 'Hi {name}, Jenny here. See you {day} — reply here if anything changes.'
    }
  };

  window.EV_DEMO = {
    trades: trades,
    sources: sources,
    shared: shared,
    rail: rail
  };
})();
