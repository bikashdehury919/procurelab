// Demo seed. All companies and people are fictional. Dates are relative to today,
// so open RFPs stay open and closed RFPs stay closed whenever you run it.
const fs = require('fs');
const path = require('path');
const db = require('./db');
const store = require('./store');
const { makePdf } = require('./pdf');
const { UPLOAD_DIR, DEMO_PASSWORD } = require('./config');

const days = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
const hoursAgo = (h) => new Date(Date.now() - h * 3600000).toISOString();

const SEED = {
  NL: {
    vendors: [
      ['CloudTech Solutions', 'Amsterdam', ['cloud', 'devops'], 4.7, ['ISO 27001', 'AWS Advanced Partner'], 'Sanne de Vries'],
      ['DataSphere', 'Utrecht', ['data', 'cloud'], 4.5, ['ISO 27001', 'SOC 2'], 'Joris Bakker'],
      ['DigitalWorks', 'Rotterdam', ['devops', 'support'], 4.2, ['ISO 9001'], 'Femke Visser'],
      ['NextGen IT', 'Eindhoven', ['security', 'network'], 4.4, ['ISO 27001'], 'Pieter van Dijk'],
      ['CloudPro', 'Den Haag', ['cloud', 'support'], 3.9, ['ITIL'], 'Noor Hendriks'],
    ],
    projects: [
      { name: 'Cloud Migration 2027', description: 'Move 40 on-premise workloads to the public cloud with zero data loss.', budget: 450000, start: -20, end: 300, owner: 'Lotte Jansen', status: 'active',
        requirements: [['AWS Migration', 'must'], ['Database Migration', 'must'], ['Security Assessment', 'must'], ['DevOps Setup', 'should'], ['24/7 Support', 'could']],
        rfps: [
          { title: 'Cloud Migration RFP', req: [0, 1, 2, 3], invite: [0, 1, 2], deadline: 25, files: ['cloud_requirements.pdf', 'security_requirements.pdf'],
            proposals: [[0, 95000, 6, 50], [1, 110000, 5, 30], [2, 90000, 8, 20, true]] },
          { title: 'Security Assessment RFP', req: [2], invite: [3, 0], deadline: 14, files: ['security_scope.pdf'], proposals: [[3, 38000, 2, 10]] },
        ] },
      { name: 'Data Platform Modernisation', description: 'Replace the legacy data warehouse with a governed data platform.', budget: 320000, start: 30, end: 400, owner: 'Ahmed el Amrani', status: 'planning',
        requirements: [['Data Lake Design', 'must'], ['ETL Pipelines', 'must'], ['BI Dashboards', 'should']],
        rfps: [{ title: 'Data Platform RFP', req: [0, 1], invite: [1], deadline: -4, files: ['data_platform_scope.pdf'], proposals: [] }] },
    ],
  },
  BE: {
    vendors: [
      ['Flanders Data Group', 'Gent', ['data', 'cloud'], 4.3, ['ISO 27001'], 'Wout Peeters'],
      ['Brabant Secure', 'Leuven', ['security'], 4.6, ['ISO 27001', 'SOC 2'], 'Elke Maes'],
      ['CloudPro Benelux', 'Antwerpen', ['cloud', 'support'], 4.0, ['ITIL', 'Azure Expert MSP'], 'Tom Claes'],
    ],
    projects: [
      { name: 'ERP Hosting Renewal', description: 'Renew hosting, backup and service desk for the ERP platform.', budget: 280000, start: -40, end: 330, owner: 'Lien Janssens', status: 'active',
        requirements: [['Managed Hosting', 'must'], ['Backup and Recovery', 'must'], ['Service Desk', 'should']],
        rfps: [
          { title: 'ERP Hosting RFP', req: [0, 1, 2], invite: [0, 2], deadline: 16, files: ['erp_hosting_scope.pdf'], proposals: [[2, 132000, 4, 26]] },
          { title: 'Backup Audit RFP', req: [1], invite: [1], deadline: -2, files: [], proposals: [] },
        ] },
    ],
  },
  DK: {
    vendors: [
      ['Øresund Data ApS', 'København', ['data', 'cloud'], 4.4, ['ISO 27001'], 'Mads Nielsen'],
      ['Jylland DevOps A/S', 'Aarhus', ['devops', 'cloud'], 4.1, ['ISO 9001'], 'Line Sørensen'],
      ['Fyn Secure ApS', 'Odense', ['security'], 3.8, ['ISO 27001'], 'Kasper Holm'],
    ],
    projects: [
      { name: 'Datacenter Exit 2027', description: 'Exit the municipal datacenter and move to managed cloud.', budget: 3200000, start: -10, end: 420, owner: 'Ida Mortensen', status: 'active',
        requirements: [['Cloud Landing Zone', 'must'], ['Workload Migration', 'must'], ['Security Monitoring', 'should']],
        rfps: [
          { title: 'Datacenter Exit RFP', req: [0, 1], invite: [0, 1], deadline: 20, files: ['datacenter_exit_scope.pdf'], proposals: [[1, 1450000, 9, 30]] },
          { title: 'Security Monitoring RFP', req: [2], invite: [2], deadline: -5, files: [], proposals: [] },
        ] },
    ],
  },
  DE: {
    vendors: [
      ['Hanse Cloud GmbH', 'Hamburg', ['cloud', 'devops'], 4.5, ['ISO 27001', 'C5'], 'Jonas Becker'],
      ['Rhein Data GmbH', 'Köln', ['data'], 4.2, ['ISO 9001'], 'Miriam Schulz'],
      ['Isar Security GmbH', 'München', ['security', 'network'], 4.6, ['ISO 27001', 'BSI IT-Grundschutz'], 'Felix Huber'],
    ],
    projects: [
      { name: 'Zero Trust Rollout', description: 'Introduce zero-trust network access for 2,000 employees.', budget: 610000, start: -30, end: 360, owner: 'Katharina Wolf', status: 'active',
        requirements: [['Identity Provider Integration', 'must'], ['Network Segmentation', 'must'], ['Endpoint Compliance', 'should']],
        rfps: [
          { title: 'Zero Trust RFP', req: [0, 1, 2], invite: [0, 2], deadline: 12, files: ['zero_trust_scope.pdf'], proposals: [[2, 240000, 7, 26]] },
          { title: 'Network Audit RFP', req: [1], invite: [2], deadline: -3, files: [], proposals: [] },
        ] },
    ],
  },
};

function writePdf(name, title, lines, ownerType, ownerId) {
  const buf = makePdf(title, lines);
  const storedName = `seed-${ownerType}-${ownerId}-${name}`;
  fs.writeFileSync(path.join(UPLOAD_DIR, storedName), buf);
  return store.registerFile({ originalName: name, storedName, size: buf.length, mime: 'application/pdf', ownerType, ownerId, uploadedBy: 'seed' });
}

function seed() {
  db.reset();
  const pw = DEMO_PASSWORD;
  store.createUser({ email: 'admin@procurelab.test', name: 'Eva Admin', role: 'admin', market: 'NL', password: pw });
  store.createUser({ email: 'buyer@procurelab.test', name: 'Lotte Jansen', role: 'buyer', market: 'NL', password: pw });
  store.createUser({ email: 'locked@procurelab.test', name: 'Locked User', role: 'buyer', market: 'NL', password: pw, active: false });

  for (const [market, data] of Object.entries(SEED)) {
    const vendors = data.vendors.map(([name, city, expertise, rating, certifications, contact]) =>
      store.createVendor({ market, name, city, expertise, rating, certifications, contact, contactEmail: `${contact.split(' ')[0].toLowerCase()}@example.test` }, { silent: true }));
    // Vendor login for each market = first vendor of that market.
    store.createUser({ email: `vendor.${market.toLowerCase()}@procurelab.test`, name: data.vendors[0][5], role: 'vendor', market, vendorId: vendors[0].id, password: pw });

    for (const pd of data.projects) {
      const p = store.createProject({ market, name: pd.name, description: pd.description, budget: pd.budget, startDate: days(pd.start), endDate: days(pd.end), owner: pd.owner, status: pd.status }, { at: hoursAgo(200) });
      const reqs = pd.requirements.map(([name, priority]) => store.createRequirement(p.id, { name, priority }));
      for (const rd of pd.rfps) {
        const rfp = store.createRfp(p.id, { title: rd.title, requirementIds: rd.req.map((i) => reqs[i].id), vendorIds: rd.invite.map((i) => vendors[i].id), deadline: days(rd.deadline) }, { at: hoursAgo(120) });
        for (const f of rd.files) writePdf(f, `${rd.title}: ${f.replace('.pdf', '').replace(/_/g, ' ')}`, [`Project: ${p.name}`, `Deadline: ${rfp.deadline}`, '', 'Scope:', ...rd.req.map((i) => `- ${reqs[i].name} (${reqs[i].priority})`), '', 'This is a fictional demo document.'], 'rfp', rfp.id);
        for (const [vi, price, months, hrs, noDocument] of rd.proposals) {
          const x = store.createProposal(rfp.id, vendors[vi].id, { priceNet: price, deliveryMonths: months, note: `Delivery in ${months} months with a dedicated team.` }, { at: hoursAgo(hrs) });
          if (!noDocument) writePdf(`proposal_${vendors[vi].name.toLowerCase().replace(/[^a-z0-9]+/g, '_')}.pdf`, `Proposal: ${vendors[vi].name}`, [`RFP: ${rfp.title}`, `Price excl. VAT: ${price}`, `Delivery: ${months} months`, '', 'This is a fictional demo document.'], 'proposal', x.id);
        }
      }
    }
  }
  db.save();
}

module.exports = { seed };
