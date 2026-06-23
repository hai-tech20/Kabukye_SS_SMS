const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../src/components/reports/report-card.tsx');
let content = fs.readFileSync(filePath, 'utf8');

content = content
  .replace(/^export const ReportCardOfficialHeader/gm, 'const ReportCardOfficialHeader')
  .replace(/^export const ReportCardTemplateStudentInfo/gm, 'const ReportCardTemplateStudentInfo')
  .replace(/^export const ReportCardTemplateFooter/gm, 'const ReportCardTemplateFooter')
  .replace(/^export const ReportCardOfficialGradingScale/gm, 'const ReportCardOfficialGradingScale')
  .replace(/^export interface ReportCardOLevelProps/gm, 'interface ReportCardOLevelProps')
  .replace(/^export const ReportCardOLevel/gm, 'const ReportCardOLevel')
  .replace(/^export interface ReportCardS1S2Props/gm, 'interface ReportCardS1S2Props')
  .replace(/^export const ReportCardS1S2/gm, 'const ReportCardS1S2')
  .replace(/^export interface ReportCardS3S4Props/gm, 'interface ReportCardS3S4Props')
  .replace(/^export const ReportCardS3S4/gm, 'const ReportCardS3S4')
  .replace(/^export interface ReportCardS5S6Props/gm, 'interface ReportCardS5S6Props')
  .replace(/^export const ReportCardS5S6/gm, 'const ReportCardS5S6')
  .replace(/^const isSeniorSecondaryClass/gm, 'export const isSeniorSecondaryClass')
  .replace(/^const getClassLevel/gm, 'export const getClassLevel')
  .replace(/^const normalizeReportGrades/gm, 'export const normalizeReportGrades')
  .replace(/\nexport \{\n  ReportCard,\n  getClassLevel,\n  normalizeReportGrades,\n  isSeniorSecondaryClass,\n};\nexport type \{ Student, Grade, AcademicTerm, ReportCardProps \};\n?$/, '\n');

fs.writeFileSync(filePath, content);
console.log('Fixed report-card exports');
