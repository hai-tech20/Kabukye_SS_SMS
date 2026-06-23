const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../src/app/dashboard/admin/reports/page.tsx');
const lines = fs.readFileSync(filePath, 'utf8').split('\n');
const importEnd = lines.findIndex((l) => l.includes("from '@/components/reports/report-card'"));
const exportDefault = lines.findIndex((l) => l.startsWith('export default function ReportsPage'));

const cleaned = [
  ...lines.slice(0, importEnd + 1),
  '',
  ...lines.slice(exportDefault),
].join('\n');

fs.writeFileSync(filePath, cleaned);
console.log('Cleaned admin reports page');
