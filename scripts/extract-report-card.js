const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(
  path.join(__dirname, '../src/app/dashboard/admin/reports/page.tsx'),
  'utf8'
);
const lines = source.split('\n');

const start = lines.findIndex((l) => l.startsWith('interface Student {'));
const end = lines.findIndex((l) => l.startsWith('export default function ReportsPage'));

const chunk = lines.slice(start, end).join('\n');
const header = `'use client';\n\nimport React from 'react';\n\n`;
const footer = `\nexport {\n  ReportCard,\n  getClassLevel,\n  normalizeReportGrades,\n  isSeniorSecondaryClass,\n};\nexport type { Student, Grade, AcademicTerm, ReportCardProps };\n`;

fs.mkdirSync(path.join(__dirname, '../src/components/reports'), { recursive: true });
fs.writeFileSync(
  path.join(__dirname, '../src/components/reports/report-card.tsx'),
  header + chunk.replace(/^interface /gm, 'export interface ').replace(/^const ReportCard/gm, 'export const ReportCard') + footer
);
console.log('Extracted report-card.tsx');
