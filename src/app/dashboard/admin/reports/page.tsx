'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { getCurrentTerm } from '@/lib/academic-calendar';
import AdminSidebar from '@/components/sidebar/AdminSidebar';

interface Student {
  id: string;
  full_name: string;
  class: string;
  stream: string;
  gender: string;
  photo_url?: string;
  subject_combination?: string;
  schoolpay_code?: string;
  total_uace_points?: number;
}

interface Grade {
  student_id: string;
  subject_id?: string;
  subject: string;
  mot: number;
  eot: number;
  final_score: number;
  grade: string;
  descriptor: string;
  teacher?: string;
  points?: number;
  uace_points?: number;
}

interface AcademicTerm {
  end_date?: string;
  next_term_start_date?: string;
}

interface ReportCardProps {
  student: Student;
  grades: Grade[];
  term: string;
  year: string;
  classTeacher: string;
  headTeacher: string;
  academicTerm?: AcademicTerm;
  positionInClass?: number;
  positionInStream?: number;
  totalStudentsInClass?: number;
  totalStudentsInStream?: number;
  optionalSubjects?: Array<{ id: string; name: string }>;
  assignedSubjects?: Array<{ id: string; subject_id?: string; name: string; subject_type: string }>;
  classTeacherComment?: string;
  headTeacherComment?: string;
}

const isSeniorSecondaryClass = (className: string) => /^(S5|S6)/i.test(className || '');
const isJuniorSecondaryClass = (className: string) => /^(S1|S2)/i.test(className || '');
const isLowerSecondaryClass = (className: string) => /^(S3|S4)/i.test(className || '');

const getClassLevel = (className: string): 'S1-S2' | 'S3-S4' | 'S5-S6' => {
  if (isJuniorSecondaryClass(className)) return 'S1-S2';
  if (isLowerSecondaryClass(className)) return 'S3-S4';
  return 'S5-S6';
};

const getGradeFromScore = (score: number): string => {
  if (score >= 80) return 'A';
  if (score >= 70) return 'B';
  if (score >= 50) return 'C';
  if (score >= 35) return 'D';
  return 'E';
};

const getDescriptorFromGrade = (grade: string): string => {
  switch (grade) {
    case 'A': return 'Exceptional';
    case 'B': return 'Outstanding';
    case 'C': return 'Satisfactory';
    case 'D': return 'Basic';
    case 'E': return 'Elementary';
    case 'O': return 'Ordinary';
    case 'F': return 'Fail';
    default: return '';
  }
};

const getUacePointsFromGrade = (grade: string | undefined, subjectName?: string): number => {
  if (!grade) return 0;
  const normalized = grade.toUpperCase();
  const isSubsidiary = (subjectName || '').toLowerCase().includes('general paper') || (subjectName || '').toLowerCase().includes('sub ict') || (subjectName || '').toLowerCase().includes('sub mathematics') || (subjectName || '').toLowerCase().includes('sub math');
  switch (normalized) {
    case 'D1': return isSubsidiary ? 1 : 6;
    case 'D2': return isSubsidiary ? 1 : 5;
    case 'C3': return isSubsidiary ? 1 : 4;
    case 'C4': return isSubsidiary ? 1 : 4;
    case 'C5': return isSubsidiary ? 1 : 3;
    case 'C6': return isSubsidiary ? 1 : 3;
    case 'P7': return isSubsidiary ? 0 : 2;
    case 'P8': return isSubsidiary ? 0 : 1;
    case 'F9': return 0;
    case 'A': return 6;
    case 'B': return 5;
    case 'C': return 4;
    case 'D': return 3;
    case 'E': return 2;
    case 'O': return 1;
    case 'F': return 0;
    default: return 0;
  }
};

const isSubsidiarySubjectName = (subjectName: string): boolean => {
  const lower = subjectName.toLowerCase();
  return lower.includes('general paper') || lower.includes('sub ict') || lower.includes('sub mathematics') || lower.includes('sub math');
};

const normalizeReportGrades = (grades: any[]): Grade[] => {
  return grades.map((g: any) => {
    const subjectName = g.subject || g.subjects?.name || '';
    const classId = g.class_id?.toString().toLowerCase() || '';
    const isSubsidiary = isSubsidiarySubjectName(subjectName);
    const isALevel = classId.includes('s5') || classId.includes('s6') || isSubsidiary;
    
    // Get scores from all possible fields
    let motScore = g.mot ?? g.mot_score ?? null;
    let eotScore = g.eot ?? g.eot_score ?? null;
    let finalScore = g.final_score ?? g.score ?? null;
    let gradeLabel = g.grade ?? null;
    let descriptor = g.descriptor ?? g.remarks ?? null;
    let points = g.points ?? g.uace_points ?? null;
    let uacePoints = g.uace_points ?? g.points ?? null;

    // Calculate final score if not present but MOT and EOT are present
    if ((finalScore === null || finalScore === undefined) && 
        (motScore !== null && motScore !== undefined) && 
        (eotScore !== null && eotScore !== undefined)) {
      finalScore = Math.round((motScore * 40 / 100) + (eotScore * 60 / 100));
    }

    // Calculate grade and descriptor if not present but final score exists
if ((!gradeLabel || !descriptor) && (finalScore !== null && finalScore !== undefined || motScore !== null && motScore !== undefined)) {
      const score = finalScore ?? motScore ?? 0;
      gradeLabel = getGradeFromScore(score);
      descriptor = getDescriptorFromGrade(gradeLabel);
      if (isALevel && isSubsidiary) {
        const subsidiaryPoints = getUacePointsFromGrade(gradeLabel, subjectName);
        gradeLabel = subsidiaryPoints > 0 ? 'O' : 'F';
        descriptor = getDescriptorFromGrade(gradeLabel);
        points = subsidiaryPoints;
        uacePoints = subsidiaryPoints;
      }
    }

    // Calculate points for A-Level if not present
    if (isALevel && (points === null || points === undefined) && gradeLabel) {
      if (isSubsidiary) {
        const subsidiaryPoints = getUacePointsFromGrade(gradeLabel, subjectName);
        points = subsidiaryPoints;
        uacePoints = subsidiaryPoints;
      } else {
        switch (gradeLabel.toUpperCase()) {
          case 'D1': points = 1; uacePoints = 6; break;
          case 'D2': points = 2; uacePoints = 5; break;
          case 'C3': points = 3; uacePoints = 4; break;
          case 'C4': points = 4; uacePoints = 4; break;
          case 'C5': points = 5; uacePoints = 3; break;
          case 'C6': points = 6; uacePoints = 3; break;
          case 'P7': points = 7; uacePoints = 2; break;
          case 'P8': points = 8; uacePoints = 1; break;
          case 'F9': points = 9; uacePoints = 0; break;
          case 'A': points = 6; uacePoints = 6; break;
          case 'B': points = 5; uacePoints = 5; break;
          case 'C': points = 4; uacePoints = 4; break;
          case 'D': points = 3; uacePoints = 3; break;
          case 'E': points = 2; uacePoints = 2; break;
          case 'O': points = 1; uacePoints = 1; break;
          default: points = 0; uacePoints = 0;
        }
      }
    }

    if (isALevel && isSubsidiary) {
      const subsidiaryPoints = uacePoints ?? points ?? 0;
      gradeLabel = subsidiaryPoints > 0 ? 'O' : 'F';
      descriptor = getDescriptorFromGrade(gradeLabel);
      points = subsidiaryPoints;
      uacePoints = subsidiaryPoints;
    }

    return {
      student_id: g.student_id,
      subject_id: g.subject_id,
      subject: subjectName,
      mot: motScore,
      eot: eotScore,
      final_score: finalScore,
      grade: gradeLabel,
      descriptor: descriptor,
      teacher: g.teacher || g.teachers?.full_name || '',
      points: points,
      uace_points: uacePoints
    };
  });
};

// Ordinal helper (available to ReportCard components)
const ordinal = (n: number | undefined) => {
  if (!n || n <= 0) return '';
  const s = ['th','st','nd','rd'];
  const v = n % 100;
  return n + (s[(v-20)%10] || s[v] || s[0]);
};

/** Official Word-template header (black & white, centered) */
const ReportCardOfficialHeader: React.FC = () => (
  <div className="mb-3 font-serif text-black">
    <div className="flex items-start gap-3">
      <div className="flex-shrink-0">
        <Image src="/media/badge.png" alt="School Badge" width={72} height={72} className="object-contain" />
      </div>
      <div className="flex-1 text-center">
        <h1 className="text-xl font-bold uppercase tracking-wide">Kabukye Secondary School</h1>
        <p className="text-xs mt-0.5">P.O.Box 117, KAMULI. TEL: 0702755397 / 0770535212</p>
        <p className="text-xs">Email: kabukyesecondaryschool@gmail.com</p>
        <p className="text-xs font-semibold mt-1 uppercase">
          Motto: &apos;Holistic Education, Discipline and Hardwork&apos;
        </p>
        <p className="text-sm font-bold mt-2 underline uppercase">End of Term Academic Report Card</p>
      </div>
      <div className="w-[72px] flex-shrink-0" />
    </div>
  </div>
);

/** Student block matching the official template (photo + two columns) */
const ReportCardTemplateStudentInfo: React.FC<{
  student: Student;
  term: string;
  year: string;
  showCombination?: boolean;
}> = ({ student, term, year, showCombination }) => (
  <div className="flex gap-3 mb-3 font-serif text-xs text-black">
    <div className="flex-shrink-0">
      {student.photo_url ? (
        <Image
          src={student.photo_url}
          alt={student.full_name}
          width={72}
          height={96}
          className="w-[72px] h-24 object-cover border border-gray-800"
        />
      ) : (
        <div className="w-[72px] h-24 border border-gray-800 bg-gray-100 flex items-center justify-center">
          <svg className="w-10 h-10 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
          </svg>
        </div>
      )}
    </div>
    <div className="flex-1 grid grid-cols-2 gap-x-6 gap-y-1">
      <div>
        <span className="font-bold">NAME: </span>
        <span className="uppercase">{student.full_name}</span>
      </div>
      <div>
        <span className="font-bold">STREAM: </span>
        <span>{student.stream}</span>
      </div>
      <div>
        <span className="font-bold">GENDER: </span>
        <span>{student.gender}</span>
      </div>
      <div>
        <span className="font-bold">TERM: </span>
        <span>{term}</span>
      </div>
      <div>
        <span className="font-bold">CLASS: </span>
        <span>{student.class}</span>
      </div>
      <div>
        <span className="font-bold">YEAR: </span>
        <span>{year}</span>
      </div>
      <div>
        <span className="font-bold">Student ID: </span>
        <span>{student.schoolpay_code || '—'}</span>
      </div>
      {showCombination && (
        <div>
          <span className="font-bold">Combination: </span>
          <span>{student.subject_combination || '—'}</span>
        </div>
      )}
    </div>
  </div>
);

/** Footer block matching the official template */
const ReportCardTemplateFooter: React.FC<{
  classTeacher: string;
  academicTerm?: AcademicTerm;
  classTeacherComment?: string;
  headTeacherComment?: string;
}> = ({ classTeacher, academicTerm, classTeacherComment, headTeacherComment }) => (
  <div className="mt-4 font-serif text-xs text-black">
    <p className="font-bold mb-2">CLASS TEACHER: {classTeacher}</p>
    <table className="w-full border-collapse border border-gray-800 mb-3">
      <tbody>
        <tr>
          <td className="border border-gray-800 px-2 py-2 font-bold w-1/3 align-top">Class Teacher&apos;s comment</td>
          <td className="border border-gray-800 px-2 py-2 min-h-[2.5rem]">{classTeacherComment || ''}</td>
        </tr>
        <tr>
          <td className="border border-gray-800 px-2 py-2 font-bold align-top">Headteacher&apos;s comment</td>
          <td className="border border-gray-800 px-2 py-2 min-h-[2.5rem]">{headTeacherComment || ''}</td>
        </tr>
      </tbody>
    </table>
    <div className="flex justify-between">
      <span>
        <span className="font-bold">Date of issue: </span>
        {academicTerm?.end_date || '_______________'}
      </span>
      <span>
        <span className="font-bold">Next Term Begins: </span>
        {academicTerm?.next_term_start_date || '_______________'}
      </span>
    </div>
  </div>
);

const O_LEVEL_FIXED_SUBJECTS = [
  'Mathematics',
  'History & Political Education',
  'English',
  'Geography',
  'Physics',
  'Biology',
  'Chemistry',
  'Physical Education',
  'Religious Education (CRE/IRE)',
  'Entrepreneurship',
  'Kiswahili',
];

const ReportCardOfficialGradingScale: React.FC = () => (
  <table className="w-full border-collapse border border-gray-800 text-[10px] mb-2 font-serif">
    <tbody>
      <tr>
        <td className="border border-gray-800 px-1 py-0.5 font-bold w-[22%]">GRADING SCHEME</td>
        <td className="border border-gray-800 px-1 py-0.5 text-center font-bold">A</td>
        <td className="border border-gray-800 px-1 py-0.5 text-center font-bold">B</td>
        <td className="border border-gray-800 px-1 py-0.5 text-center font-bold">C</td>
        <td className="border border-gray-800 px-1 py-0.5 text-center font-bold">D</td>
        <td className="border border-gray-800 px-1 py-0.5 text-center font-bold">E</td>
      </tr>
      <tr>
        <td className="border border-gray-800 px-1 py-0.5" />
        <td className="border border-gray-800 px-1 py-0.5 text-center">Exceptional</td>
        <td className="border border-gray-800 px-1 py-0.5 text-center">Outstanding</td>
        <td className="border border-gray-800 px-1 py-0.5 text-center">Satisfactory</td>
        <td className="border border-gray-800 px-1 py-0.5 text-center">Basic</td>
        <td className="border border-gray-800 px-1 py-0.5 text-center">Elementary</td>
      </tr>
      <tr>
        <td className="border border-gray-800 px-1 py-0.5" />
        <td className="border border-gray-800 px-1 py-0.5 text-center">80-100</td>
        <td className="border border-gray-800 px-1 py-0.5 text-center">70-79</td>
        <td className="border border-gray-800 px-1 py-0.5 text-center">50-69</td>
        <td className="border border-gray-800 px-1 py-0.5 text-center">35-49</td>
        <td className="border border-gray-800 px-1 py-0.5 text-center">00-34</td>
      </tr>
    </tbody>
  </table>
);

const getOLevelResult = (averageScore: number): string => {
  if (averageScore >= 50) return 'Promoted';
  if (averageScore >= 40) return 'Promoted on trial';
  return 'Repeat';
};

interface ReportCardOLevelProps extends ReportCardProps {
  optionalSubjects?: Array<{ id: string; name: string }>;
  showResult?: boolean;
}

const ReportCardOLevel: React.FC<ReportCardOLevelProps> = (props) => {
  const {
    student,
    grades,
    term,
    year,
    classTeacher,
    academicTerm,
    positionInClass,
    positionInStream,
    totalStudentsInClass,
    totalStudentsInStream,
    optionalSubjects,
    classTeacherComment,
    headTeacherComment,
    showResult,
  } = props;

  const gradesMap = new Map<string, Grade>();
  
  // Helper function to normalize subject names
  const normalizeSubject = (name: string) => {
    return name
      .toLowerCase()
      .replace(/&/g, 'and')
      .replace(/\s+/g, ' ')
      .trim();
  };

  grades.forEach((grade) => {
    gradesMap.set(grade.subject, grade);
    gradesMap.set(grade.subject.toLowerCase(), grade);
    gradesMap.set(normalizeSubject(grade.subject), grade);
  });

  const findGrade = (subjectName: string) => {
    if (!subjectName) return undefined;
    const direct = gradesMap.get(subjectName);
    if (direct) return direct;
    const lower = subjectName.toLowerCase();
    const grade = gradesMap.get(lower);
    if (grade) return grade;
    const normalized = normalizeSubject(subjectName);
    const normalizedGrade = gradesMap.get(normalized);
    if (normalizedGrade) return normalizedGrade;
    // Fallback: search for partial matches
    for (const [key, value] of gradesMap.entries()) {
      if (key.toLowerCase().includes(lower) || lower.includes(key.toLowerCase())) {
        return value;
      }
    }
    return undefined;
  };

  const allSubjects = [...O_LEVEL_FIXED_SUBJECTS];
  
  // Add optional subjects, ensuring we add up to 2
  const optionalToAdd = optionalSubjects?.slice(0, 2) || [];
  optionalToAdd.forEach((opt) => allSubjects.push(opt.name));
  
  // Pad with empty strings if we have fewer than 2 optional subjects
  while (allSubjects.length < O_LEVEL_FIXED_SUBJECTS.length + 2) {
    allSubjects.push('');
  }

  const gradeRows = allSubjects.map((subject) => ({
    name: subject,
    grade: findGrade(subject)
  }));

  const extraGrades = grades
    .filter((g) => {
      const normalizedGradeSubject = normalizeSubject(g.subject);
      return !gradeRows.some((row) => normalizeSubject(row.name) === normalizedGradeSubject);
    })
    .map((g) => ({ name: g.subject || 'Unknown Subject', grade: g }));

  const rowsToRender = [...gradeRows, ...extraGrades];

  const totalScore = grades.reduce((sum, g) => sum + (g.final_score || 0), 0);
  const averageScore = grades.length > 0 ? Math.round(totalScore / grades.length) : 0;

  return (
    <div
      className="bg-white p-3 report-card report-card-olevel report-card-print max-w-[210mm] mx-auto font-serif text-black"
      style={{ pageBreakInside: 'avoid' }}
    >
      <ReportCardOfficialHeader />
      <ReportCardTemplateStudentInfo student={student} term={term} year={year} />

      <table className="w-full border-collapse border border-gray-800 mb-1 text-[10px] rc-table">
        <thead>
          <tr>
            <th className="border border-gray-800 px-1 py-0.5 text-left font-bold">SUBJECT</th>
            <th className="border border-gray-800 px-1 py-0.5 text-center font-bold">MOT [40%]</th>
            <th className="border border-gray-800 px-1 py-0.5 text-center font-bold">EOT [60%]</th>
            <th className="border border-gray-800 px-1 py-0.5 text-center font-bold">Final score</th>
            <th className="border border-gray-800 px-1 py-0.5 text-center font-bold">Grade</th>
            <th className="border border-gray-800 px-1 py-0.5 text-center font-bold">Descriptor</th>
            <th className="border border-gray-800 px-1 py-0.5 text-center font-bold">Teacher</th>
          </tr>
        </thead>
        <tbody>
          {rowsToRender.map((row, index) => (
            <tr key={index}>
              <td className="border border-gray-800 px-1 py-0.5">{row.name}</td>
              <td className="border border-gray-800 px-1 py-0.5 text-center">{row.grade?.mot ?? ''}</td>
              <td className="border border-gray-800 px-1 py-0.5 text-center">{row.grade?.eot ?? ''}</td>
              <td className="border border-gray-800 px-1 py-0.5 text-center">{row.grade?.final_score ?? ''}</td>
              <td className="border border-gray-800 px-1 py-0.5 text-center font-bold">{row.grade?.grade ?? ''}</td>
              <td className="border border-gray-800 px-1 py-0.5 text-center">{row.grade?.descriptor ?? ''}</td>
              <td className="border border-gray-800 px-1 py-0.5 text-center">{row.grade?.teacher ?? ''}</td>
            </tr>
          ))}
          <tr className="font-bold">
            <td className="border border-gray-800 px-1 py-0.5">Overall % average score</td>
            <td className="border border-gray-800 px-1 py-0.5" />
            <td className="border border-gray-800 px-1 py-0.5" />
            <td className="border border-gray-800 px-1 py-0.5 text-center">{averageScore}%</td>
            <td className="border border-gray-800 px-1 py-0.5" colSpan={3} />
          </tr>
        </tbody>
      </table>

      <p className="text-[10px] mb-0.5">
        Position in class: {ordinal(positionInClass)} out of {totalStudentsInClass || '—'} &nbsp;&nbsp;
        position in stream: {ordinal(positionInStream)} out of {totalStudentsInStream || '—'}
      </p>
      {showResult && (
        <p className="text-[10px] font-bold mb-1">Result: {getOLevelResult(averageScore)}</p>
      )}

      <ReportCardOfficialGradingScale />
      <ReportCardTemplateFooter
        classTeacher={classTeacher}
        academicTerm={academicTerm}
        classTeacherComment={classTeacherComment}
        headTeacherComment={headTeacherComment}
      />
    </div>
  );
};

interface ReportCardS1S2Props extends ReportCardProps {
  optionalSubjects?: Array<{ id: string; name: string }>;
}

const ReportCardS1S2: React.FC<ReportCardS1S2Props> = (props) => (
  <ReportCardOLevel {...props} />
);

interface ReportCardS3S4Props extends ReportCardProps {
  optionalSubjects?: Array<{ id: string; name: string }>;
}

const ReportCardS3S4: React.FC<ReportCardS3S4Props> = (props) => (
  <ReportCardOLevel {...props} showResult />
);

interface ReportCardS5S6Props extends ReportCardProps {
  assignedSubjects?: Array<{ id: string; name: string; subject_type: string }>;
}

const getSeniorSecondaryComments = (totalPoints: number) => {
  if (totalPoints >= 16) {
    return { classTeacherComment: 'Very good performance', headTeacherComment: 'Excellent performance' };
  }
  if (totalPoints >= 10) {
    return { classTeacherComment: 'Promising results', headTeacherComment: 'Quite good performance' };
  }
  if (totalPoints >= 6) {
    return { classTeacherComment: 'More effort is needed', headTeacherComment: 'Can do better than this' };
  }
  if (totalPoints >= 1) {
    return { classTeacherComment: 'Improve on the weak areas', headTeacherComment: 'Work harder' };
  }
  return { classTeacherComment: 'Needs assessment', headTeacherComment: 'Needs assessment' };
};

const ReportCardS5S6: React.FC<ReportCardS5S6Props> = (props) => {
  const {
    student,
    grades,
    term,
    year,
    classTeacher,
    academicTerm,
    assignedSubjects,
    classTeacherComment,
    headTeacherComment,
  } = props;

  const gradesMap = new Map<string, Grade>();
  
  // Helper function to normalize subject names
  const normalizeSubject = (name: string) => {
    return name
      .toLowerCase()
      .replace(/&/g, 'and')
      .replace(/\s+/g, ' ')
      .trim();
  };

  grades.forEach((grade) => {
    gradesMap.set(grade.subject, grade);
    gradesMap.set(grade.subject.toLowerCase(), grade);
    gradesMap.set(normalizeSubject(grade.subject), grade);
    if (grade.subject_id) {
      gradesMap.set(grade.subject_id, grade);
    }
  });

  const findGrade = (subjectName: string, subjectId?: string) => {
    if (subjectId) {
      const byId = gradesMap.get(subjectId);
      if (byId) return byId;
    }
    if (!subjectName) return undefined;
    const direct = gradesMap.get(subjectName);
    if (direct) return direct;
    const lower = subjectName.toLowerCase();
    const grade = gradesMap.get(lower);
    if (grade) return grade;
    const normalized = normalizeSubject(subjectName);
    const normalizedGrade = gradesMap.get(normalized);
    if (normalizedGrade) return normalizedGrade;
    // Fallback: search for partial matches
    for (const [key, value] of gradesMap.entries()) {
      if (key.toLowerCase().includes(lower) || lower.includes(key.toLowerCase())) {
        return value;
      }
    }
    return undefined;
  };

  const subjectsToShow = assignedSubjects || [];

  const subjectRows = subjectsToShow.length > 0
    ? subjectsToShow.map((subject) => {
        const subjectId = (subject as any).subject_id || subject.id;
        let gradeMatch = findGrade(subject.name, subjectId);
        if (!gradeMatch && subjectId) {
          gradeMatch = grades.find((g) => g.subject_id === subjectId);
        }
        if (!gradeMatch && subject.name) {
          gradeMatch = grades.find((g) => normalizeSubject(g.subject) === normalizeSubject(subject.name));
        }

        return {
          name: subject.name || (subject as any).subject_id || 'Unknown Subject',
          grade: gradeMatch,
          type: subject.subject_type,
          subject_id: subjectId
        };
      })
    : grades.map((g) => ({
        name: g.subject,
        grade: g,
        type: 'unknown',
        subject_id: g.subject_id
      }));

  const extraGrades = subjectsToShow.length > 0
    ? grades.filter((g) => !subjectRows.some((row) => {
        if (row.subject_id && g.subject_id) return row.subject_id === g.subject_id;
        return normalizeSubject(row.name) === normalizeSubject(g.subject);
      }))
      .map((g) => ({
        name: g.subject,
        grade: g,
        type: 'extra',
        subject_id: g.subject_id
      }))
    : [];

  const rowsToRender = subjectRows.length > 0 ? [...subjectRows, ...extraGrades] : grades.map((g) => ({
    name: g.subject,
    grade: g,
    type: 'unknown',
    subject_id: g.subject_id
  }));

  const totalPoints = rowsToRender.reduce((sum, row) => {
    const pointsValue = row.grade?.uace_points ?? row.grade?.points ?? getUacePointsFromGrade(row.grade?.grade, row.name);
    return sum + (typeof pointsValue === 'number' ? pointsValue : 0);
  }, 0);

  const fallbackComments = getSeniorSecondaryComments(totalPoints);
  const shouldOverrideGenericNeedsAssessment = totalPoints > 0 &&
    (classTeacherComment?.trim() === 'Needs assessment' || headTeacherComment?.trim() === 'Needs assessment');

  const resolvedClassTeacherComment = shouldOverrideGenericNeedsAssessment
    ? fallbackComments.classTeacherComment
    : (classTeacherComment || fallbackComments.classTeacherComment);
  const resolvedHeadTeacherComment = shouldOverrideGenericNeedsAssessment
    ? fallbackComments.headTeacherComment
    : (headTeacherComment || fallbackComments.headTeacherComment);

  return (
    <div
      className="bg-white p-3 report-card report-card-s5s6 report-card-print font-serif text-black max-w-[210mm] mx-auto"
      style={{ pageBreakInside: 'avoid' }}
    >
      <ReportCardOfficialHeader />
      <ReportCardTemplateStudentInfo
        student={student}
        term={term}
        year={year}
        showCombination
      />

      <table className="w-full border-collapse border border-gray-800 mb-1 text-xs">
        <thead>
          <tr>
            <th className="border border-gray-800 px-1.5 py-1 text-left font-bold">SUBJECT</th>
            <th className="border border-gray-800 px-1.5 py-1 text-center font-bold">MOT [40%]</th>
            <th className="border border-gray-800 px-1.5 py-1 text-center font-bold">EOT [60%]</th>
            <th className="border border-gray-800 px-1.5 py-1 text-center font-bold">Final score</th>
            <th className="border border-gray-800 px-1.5 py-1 text-center font-bold">Grade</th>
            <th className="border border-gray-800 px-1.5 py-1 text-center font-bold">Points</th>
            <th className="border border-gray-800 px-1.5 py-1 text-center font-bold">Teacher</th>
          </tr>
        </thead>
        <tbody>
          {rowsToRender.map((row, index) => (
            <tr key={index}>
              <td className="border border-gray-800 px-1.5 py-1">{row.name}</td>
              <td className="border border-gray-800 px-1.5 py-1 text-center">{row.grade?.mot ?? ''}</td>
              <td className="border border-gray-800 px-1.5 py-1 text-center">{row.grade?.eot ?? ''}</td>
              <td className="border border-gray-800 px-1.5 py-1 text-center">{row.grade?.final_score ?? ''}</td>
              <td className="border border-gray-800 px-1.5 py-1 text-center font-bold">{row.grade?.grade ?? ''}</td>
              <td className="border border-gray-800 px-1.5 py-1 text-center">{row.grade?.uace_points ?? row.grade?.points ?? getUacePointsFromGrade(row.grade?.grade, row.name)}</td>
              <td className="border border-gray-800 px-1.5 py-1 text-center">{row.grade?.teacher ?? ''}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <p className="text-xs font-bold mt-1 mb-4">Total Points; {totalPoints}</p>

      <ReportCardTemplateFooter
        classTeacher={classTeacher}
        academicTerm={academicTerm}
        classTeacherComment={resolvedClassTeacherComment}
        headTeacherComment={resolvedHeadTeacherComment}
      />
    </div>
  );
};

const ReportCard: React.FC<ReportCardProps> = (props) => {
  const classLevel = getClassLevel(props.student.class);
  
  const { optionalSubjects, assignedSubjects } = props;
  
  switch (classLevel) {
    case 'S1-S2':
      return <ReportCardS1S2 {...props} optionalSubjects={optionalSubjects} />;
    case 'S3-S4':
      return <ReportCardS3S4 {...props} optionalSubjects={optionalSubjects} />;
    case 'S5-S6':
      return <ReportCardS5S6 {...props} assignedSubjects={assignedSubjects} />;
    default:
      return <ReportCardS1S2 {...props} optionalSubjects={optionalSubjects} />;
  }
};

export default function ReportsPage() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [students, setStudents] = useState<Student[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedTerm, setSelectedTerm] = useState('1');
  const [selectedYear, setSelectedYear] = useState(getCurrentTerm().academicYear.toString());
  const [selectedClass, setSelectedClass] = useState('ALL');
  const [selectedStream, setSelectedStream] = useState('ALL');
  const [isPublished, setIsPublished] = useState(false);
  const [classTeachers, setClassTeachers] = useState<{ [key: string]: string }>({});
  const [classes, setClasses] = useState<any[]>([]);
  const [allStreams, setAllStreams] = useState<any[]>([]);
  const [streams, setStreams] = useState<any[]>([]);
  const [previewStudent, setPreviewStudent] = useState<Student | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [previewOptionalSubjects, setPreviewOptionalSubjects] = useState<Array<{ id: string; name: string }>>([]);
  const [previewAssignedSubjects, setPreviewAssignedSubjects] = useState<Array<{ id: string; name: string; subject_type: string }>>([]);
  const [previewComments, setPreviewComments] = useState<{ class_teacher_comment?: string; head_teacher_comment?: string } | null>(null);
  const [previewAcademicTerm, setPreviewAcademicTerm] = useState<AcademicTerm | null>(null);
  const [printAllReports, setPrintAllReports] = useState(false);

  useEffect(() => {
    fetchClassesAndStreams();
  }, []);

  const fetchClassesAndStreams = async () => {
    try {
      const response = await fetchWithRetry('/api/classes');
      const result = await response.json();
      if (result.data) {
        setClasses(result.data.classes || []);
        setAllStreams(result.data.streams || []);
        setStreams(result.data.streams || []);
      }
    } catch (error) {
      console.error('Error fetching classes and streams:', error);
    }
  };

  const fetchClassTeachers = async (studentList: Student[]) => {
    const teacherMap: { [key: string]: string } = {};
    
    for (const student of studentList) {
      const key = `${student.class}-${student.stream}`;
      if (!teacherMap[key]) {
        try {
          const response = await fetchWithRetry(`/api/students/${student.id}/class-teacher`);
          if (response.ok) {
            const result = await response.json();
            teacherMap[key] = result.data || 'Not Assigned';
          } else {
            teacherMap[key] = 'Not Assigned';
          }
        } catch (error) {
          console.error('Error fetching class teacher:', error);
          teacherMap[key] = 'Not Assigned';
        }
      }
    }
    
    setClassTeachers(teacherMap);
  };

  const updateFilteredStreams = (classId: string) => {
    if (classId === 'ALL') {
      setStreams(allStreams);
      setSelectedStream('ALL');
      return;
    }

    const selectedClassObj = classes.find((cls: any) => cls.name === classId);
    const classIdValue = selectedClassObj?.id;

    if (classIdValue) {
      const classStreams = allStreams.filter((stream: any) => stream.class_id === classIdValue);
      setStreams(classStreams);
      setSelectedStream('ALL');
    }
  };

  useEffect(() => {
    if (selectedClass) {
      updateFilteredStreams(selectedClass);
    }
  }, [selectedClass, allStreams]);

  useEffect(() => {
    if (selectedTerm && selectedYear && selectedClass && selectedStream) {
      fetchReportData();
    }
  }, [selectedTerm, selectedYear, selectedClass, selectedStream]);

  // Fetch optional/assigned subjects when preview student changes
  useEffect(() => {
    if (!previewStudent) {
      setPreviewOptionalSubjects([]);
      setPreviewAssignedSubjects([]);
      return;
    }

    const fetchSubjectData = async () => {
      try {
        const classLevel = getClassLevel(previewStudent.class);
        
        if (classLevel === 'S1-S2' || classLevel === 'S3-S4') {
          // Fetch optional subjects for S1-S4
          const response = await fetchWithRetry(`/api/student-optional-subjects?student_id=${previewStudent.id}`);
          if (response.ok) {
            const result = await response.json();
            const optionalSubjects = (result.data || []).map((item: any) => ({
              id: item.id,
              name: item.subjects?.name || ''
            }));
            setPreviewOptionalSubjects(optionalSubjects);
          }
        } else if (classLevel === 'S5-S6') {
          // Fetch assigned subjects for S5-S6
          const response = await fetchWithRetry(`/api/student-subjects?student_id=${previewStudent.id}`);
          if (response.ok) {
            const result = await response.json();
            const assignedSubjects = (result.data || []).map((item: any) => ({
              id: item.id,
              subject_id: item.subject_id,
              name: item.subjects?.name || '',
              subject_type: item.subject_type || item.subjects?.subject_type || ''
            }));
            setPreviewAssignedSubjects(assignedSubjects);
          }
        }

        // Fetch comments and term dates for the preview
        const reportResponse = await fetchWithRetry(`/api/report?student_id=${previewStudent.id}&term=${selectedTerm}&year=${selectedYear}`);
        if (reportResponse.ok) {
          const reportResult = await reportResponse.json();
          const comments = reportResult.data?.comments || {};
          setPreviewComments({
            class_teacher_comment: comments.class_teacher_comment || comments.class_teacher_comment_text || comments.class_teacher || comments.class_teacher_comments || '',
            head_teacher_comment: comments.head_teacher_comment || comments.head_teacher_comment_text || comments.head_teacher || comments.head_teacher_comments || ''
          });
        } else {
          setPreviewComments(null);
        }

        const academicResponse = await fetchWithRetry('/api/academic/overview');
        if (academicResponse.ok) {
          const overview = await academicResponse.json();
          const yearItem = (overview.academic_years || []).find((y: any) => y.year_label === selectedYear);
          const currentTermNumber = Number(selectedTerm);
          if (yearItem) {
            const currentTerm = (overview.terms || []).find((t: any) => Number(t.term_number) === currentTermNumber && t.year_id === yearItem.id);
            let nextTermStart = '';

            if (currentTerm) {
              const nextTerm = (overview.terms || []).find((t: any) => Number(t.term_number) === currentTermNumber + 1 && t.year_id === yearItem.id)
                || (currentTermNumber === 3 ? (overview.terms || []).find((t: any) => Number(t.term_number) === 1 && overview.academic_years?.find((y: any) => y.id === t.year_id)?.year_label === String(Number(selectedYear) + 1)) : null);

              nextTermStart = nextTerm?.start_date || '';
              setPreviewAcademicTerm({
                end_date: currentTerm.end_date,
                next_term_start_date: nextTermStart
              });
            } else {
              setPreviewAcademicTerm(null);
            }
          } else {
            setPreviewAcademicTerm(null);
          }
        } else {
          setPreviewAcademicTerm(null);
        }
      } catch (error) {
        console.error('Error fetching subject data:', error);
      }
    };

    fetchSubjectData();
  }, [previewStudent, selectedTerm, selectedYear]);

  const fetchReportData = async () => {
    if (!selectedStream) return;
    
    try {
      setLoading(true);
      
      let transformedStudents: Student[] = [];
      
      if (selectedClass === 'ALL' && selectedStream === 'ALL') {
        const studentsResponse = await fetchWithRetry('/api/students');
        const studentsResult = await studentsResponse.json();
        
        if (studentsResponse.ok) {
          transformedStudents = (studentsResult.data || []).map((student: any) => ({
            ...student,
            class: student.classes?.name || student.class_id || 'Unknown',
            stream: student.streams?.name || student.stream_id || 'Unknown'
          }));
          setStudents(transformedStudents);
          fetchClassTeachers(transformedStudents);
        }

        const gradesResponse = await fetchWithRetry(`/api/reports?term=${selectedTerm}&year=${selectedYear}`);
        const gradesResult = await gradesResponse.json();
        
        if (gradesResponse.ok) {
          const normalized = normalizeReportGrades(gradesResult.data?.grades || []);
          setGrades(normalized);
          setIsPublished(Boolean(gradesResult.data?.is_published));

          // Merge totals (if provided) into student objects so previews display total points and comments
          const totals = gradesResult.data?.totals || {};
          if (Object.keys(totals).length > 0) {
            const merged = transformedStudents.map((st: any) => ({
              ...st,
              total_uace_points: st.total_uace_points ?? (totals[st.id]?.total_points ?? st.total_uace_points),
              auto_class_teacher_comment: totals[st.id]?.class_teacher_comment,
              auto_head_teacher_comment: totals[st.id]?.head_teacher_comment
            }));
            setStudents(merged);
            computePositions(merged, normalized);
          } else {
            computePositions(transformedStudents, normalized);
          }
        }
      } else {
        const params = new URLSearchParams();
        if (selectedClass !== 'ALL') {
          params.append('class_id', selectedClass.toLowerCase());
        }
        if (selectedStream !== 'ALL') {
          params.append('stream_id', selectedStream);
        }
        
        const studentsResponse = await fetchWithRetry(`/api/students?${params.toString()}`);
        const studentsResult = await studentsResponse.json();
        
        if (studentsResponse.ok) {
          transformedStudents = (studentsResult.data || []).map((student: any) => ({
            ...student,
            class: student.classes?.name || student.class_id?.toUpperCase() || selectedClass,
            stream: student.streams?.name || student.stream_id?.split('-').pop()?.toUpperCase() || selectedStream
          }));
          setStudents(transformedStudents);
          fetchClassTeachers(transformedStudents);
        }

        const gradesParams = new URLSearchParams();
        gradesParams.append('term', selectedTerm);
        gradesParams.append('year', selectedYear);
        if (selectedClass !== 'ALL') gradesParams.append('class_id', selectedClass.toLowerCase());
        if (selectedStream !== 'ALL') gradesParams.append('stream_id', selectedStream);
        
        const gradesResponse = await fetchWithRetry(`/api/reports?${gradesParams.toString()}`);
        const gradesResult = await gradesResponse.json();
        
        if (gradesResponse.ok) {
          const normalized = normalizeReportGrades(gradesResult.data?.grades || []);
          setGrades(normalized);
          setIsPublished(Boolean(gradesResult.data?.is_published));

          const totals = gradesResult.data?.totals || {};
          const merged = transformedStudents.map((st: any) => ({
            ...st,
            total_uace_points: st.total_uace_points ?? (totals[st.id]?.total_points ?? st.total_uace_points),
            auto_class_teacher_comment: totals[st.id]?.class_teacher_comment,
            auto_head_teacher_comment: totals[st.id]?.head_teacher_comment
          }));
          setStudents(merged);
          computePositions(merged, normalized);
        }
      }
    } catch (error) {
      console.error('Error fetching report data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Helpers for computing positions

  const computePositions = (studentList: Student[], gradeList: Grade[]) => {
    // Build maps for class and stream groups
    const byClass: { [key: string]: string[] } = {};
    const byStream: { [key: string]: string[] } = {};

    // compute metrics per student
    const metrics: { [studentId: string]: { avg: number; points: number } } = {};

    for (const s of studentList) {
      byClass[s.class] = byClass[s.class] || [];
      byClass[s.class].push(s.id);
      const streamKey = `${s.class}-${s.stream}`;
      byStream[streamKey] = byStream[streamKey] || [];
      byStream[streamKey].push(s.id);
    }

    // aggregate grades
    const gradeMap: { [id: string]: Grade[] } = {};
    for (const g of gradeList) {
      gradeMap[g.student_id] = gradeMap[g.student_id] || [];
      gradeMap[g.student_id].push(g);
    }

    for (const s of studentList) {
      const g = gradeMap[s.id] || [];
      const totalScore = g.reduce((sum, x) => sum + (x.final_score || 0), 0);
      const avg = g.length > 0 ? Math.round(totalScore / g.length) : 0;
      const totalPoints = g.reduce((sum, x) => sum + (x.uace_points ?? x.points ?? 0), 0);
      metrics[s.id] = { avg, points: totalPoints };
    }

    // For each class, sort and assign positions depending on class level
    const classPositions: { [id: string]: number } = {};
    const streamPositions: { [id: string]: number } = {};

    const getClassLevelKey = (clsName: string) => clsName?.toUpperCase();

    for (const cls of Object.keys(byClass)) {
      const ids = byClass[cls];
      // decide ranking metric: S5/S6 -> points, else avg
      const usePoints = isSeniorSecondaryClass(cls);
      const sorted = [...ids].sort((a, b) => {
        const ma = metrics[a] || { avg: 0, points: 0 };
        const mb = metrics[b] || { avg: 0, points: 0 };
        const va = usePoints ? ma.points : ma.avg;
        const vb = usePoints ? mb.points : mb.avg;
        return vb - va; // descending
      });
      sorted.forEach((studentId, idx) => {
        classPositions[studentId] = idx + 1;
      });
    }

    for (const streamKey of Object.keys(byStream)) {
      const ids = byStream[streamKey];
      // stream's class is left part
      const cls = streamKey.split('-')[0];
      const usePoints = isSeniorSecondaryClass(cls);
      const sorted = [...ids].sort((a, b) => {
        const ma = metrics[a] || { avg: 0, points: 0 };
        const mb = metrics[b] || { avg: 0, points: 0 };
        const va = usePoints ? ma.points : ma.avg;
        const vb = usePoints ? mb.points : mb.avg;
        return vb - va;
      });
      sorted.forEach((studentId, idx) => {
        streamPositions[studentId] = idx + 1;
      });
    }

    // attach positions to students in-place by extending student objects
    const updated = studentList.map(s => ({ ...s, _positionInClass: classPositions[s.id] || undefined, _positionInStream: streamPositions[s.id] || undefined }));
    setStudents(updated);

    // store helper maps on window for preview lookup (simple approach)
    (window as any).__report_positions = {
      classPositions,
      streamPositions,
      totals: {
        byClass: Object.fromEntries(Object.entries(byClass).map(([k, v]) => [k, v.length])),
        byStream: Object.fromEntries(Object.entries(byStream).map(([k, v]) => [k, v.length]))
      }
    };
  };

  const handlePublishResults = async () => {
    if (selectedClass === 'ALL') {
      alert('Please select a specific class to publish results.');
      return;
    }

    if (!confirm(`Are you sure you want to ${isPublished ? 're-publish' : 'publish'} results for ${selectedClass} ${selectedStream === 'ALL' ? 'all streams' : selectedStream}?`)) {
      return;
    }

    try {
      setLoading(true);
      const response = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          academic_year: selectedYear,
          term: selectedTerm,
          class_id: selectedClass.toLowerCase(),
          stream_id: selectedStream === 'ALL' ? undefined : selectedStream,
          published_by: 'admin'
        })
      });

      const result = await response.json();
      
      if (response.ok) {
        setIsPublished(true);
        alert('Results published successfully!');
        fetchReportData();
      } else {
        alert('Failed to publish results: ' + (result.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error publishing results:', error);
      alert('Error publishing results');
    } finally {
      setLoading(false);
    }
  };

  const handlePrintReport = (student: Student) => {
    // Ensure we use the latest merged student object (with totals/comments)
    const current = students.find(s => s.id === student.id) || student;
    setPreviewStudent(current);
    setShowPreview(true);
  };

  const handlePrintFromPreview = () => {
    // Don't close the preview! We need the report card to be in the DOM when we print
    window.print();
  };

  const handlePrintAll = () => {
    setPrintAllReports(true);
    setTimeout(() => {
      window.print();
      setTimeout(() => {
        setPrintAllReports(false);
      }, 500);
    }, 100);
  };

  const handleClosePreview = () => {
    setShowPreview(false);
    setPreviewStudent(null);
  };

  return (
    <div className="h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex overflow-hidden">
      <style>{`
        @media print {
          .no-print {
            display: none !important;
          }
          body {
            margin: 0;
            padding: 0;
            background: white;
          }
          .bg-white {
            background-color: white !important;
          }
          .fixed {
            position: static !important;
          }
          .bg-black {
            background-color: white !important;
          }
          .inset-0 {
            position: static !important;
          }
          @page {
            margin: 5mm;
            size: A4 portrait;
          }
          body {
            margin: 0 !important;
            padding: 0 !important;
          }
          .report-card-print {
            width: 100% !important;
            max-width: 100% !important;
            padding: 3mm !important;
            border: none !important;
            box-shadow: none !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            font-size: 9px !important;
            line-height: 1.15 !important;
          }
          .report-card-print * {
            font-size: inherit !important;
          }
          .report-card-print .rc-table th,
          .report-card-print .rc-table td {
            padding: 1px 2px !important;
            font-size: 8px !important;
          }
          .report-card-print img {
            max-height: 68px !important;
            width: auto !important;
          }
        }
        @media screen {
          .print-only {
            display: none;
          }
        }
      `}</style>
      <AdminSidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />

      <div className={`flex-1 h-full overflow-y-auto transition-all duration-300 pt-16 lg:pt-0 ${
        sidebarOpen ? 'lg:ml-64' : 'lg:ml-20'
      }`}>
        <div className="p-4 lg:p-8">
          <div className="mb-8 text-center no-print">
            <h1 className="text-4xl font-bold text-black mb-2">Report Cards Management</h1>
            <p className="text-black">Generate and manage student academic reports</p>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6 mb-6 no-print">
            <div className="mb-6">
              <h2 className="text-xl font-bold text-black mb-4 flex items-center">
                <svg className="w-5 h-5 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                </svg>
                Academic Filters
              </h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-semibold text-black mb-2">Academic Year</label>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-gray-900"
                >
                  <option value="2024">2024</option>
                  <option value="2025">2025</option>
                  <option value="2026">2026</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-black mb-2">Term</label>
                <select
                  value={selectedTerm}
                  onChange={(e) => setSelectedTerm(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-gray-900"
                >
                  <option value="1">Term I</option>
                  <option value="2">Term II</option>
                  <option value="3">Term III</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-black mb-2">Class</label>
                <select
                  value={selectedClass}
                  onChange={(e) => setSelectedClass(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-gray-900"
                >
                  <option value="ALL">ALL CLASSES</option>
                  {classes.map((cls) => (
                    <option key={cls.id} value={cls.name}>{cls.name}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-black mb-2">Stream</label>
                <select
                  value={selectedStream}
                  onChange={(e) => setSelectedStream(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-gray-900"
                >
                  <option value="ALL">ALL STREAMS</option>
                  {streams.map((stream) => (
                    <option key={stream.id} value={stream.id}>{stream.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6 mb-6 no-print">
            <div className="flex justify-between items-center flex-wrap gap-4">
              <div>
                <h2 className="text-xl font-bold text-black">
                  {selectedClass === 'ALL' && selectedStream === 'ALL' 
                    ? 'ALL CLASSES - ALL STREAMS' 
                    : `${selectedClass} ${streams.find(s => s.id === selectedStream)?.name || ''} - Term ${selectedTerm}, ${selectedYear}`
                  }
                </h2>
                <p className="text-black mt-1">{students.length} students found</p>
                {isPublished && (
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800 mt-2">
                    <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    Published
                  </span>
                )}
              </div>
              <div className="flex space-x-3 flex-wrap">
                <button
                  onClick={handlePrintAll}
                  className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center shadow-md font-bold"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                  </svg>
                  Print All Reports
                </button>
                {selectedClass !== 'ALL' && (
                  <button
                    onClick={handlePublishResults}
                    className={`px-6 py-2 rounded-lg transition-colors flex items-center shadow-md font-bold ${
                      isPublished 
                        ? 'bg-amber-500 text-white hover:bg-amber-600' 
                        : 'bg-green-600 text-white hover:bg-green-700'
                    }`}
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {isPublished ? 'Re-publish Results' : 'Publish Results'}
                  </button>
                )}
                {selectedClass === 'ALL' && (
                  <div className="text-sm text-gray-600 mt-2">
                    Select a specific class before publishing. The publish button appears after you choose a class.
                  </div>
                )}
              </div>
            </div>
          </div>

          {loading && (
            <div className="flex justify-center items-center py-12 no-print">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
              <span className="ml-3 text-black">Loading report data...</span>
            </div>
          )}

          {!loading && students.length > 0 && (
            <div className="bg-white rounded-xl shadow-lg overflow-hidden no-print">
              <div className="px-6 py-4 bg-gradient-to-r from-blue-600 to-indigo-600">
                <h3 className="text-lg font-bold text-white">Students List</h3>
              </div>
              <div className="divide-y divide-gray-200">
                {students.map((student) => (
                  <div key={student.id} className="px-6 py-4 hover:bg-gray-50 transition-colors">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center">
                        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center mr-4">
                          <span className="text-blue-900 font-bold text-sm">
                            {student.full_name.split(' ').map(n => n[0]).join('').toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <h4 className="font-semibold text-black">{student.full_name}</h4>
                          <p className="text-sm text-black">
                            {student.class} - {student.stream}
                            {isSeniorSecondaryClass(student.class) && student.subject_combination && (
                              <span className="ml-2 text-blue-600">({student.subject_combination})</span>
                            )}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => handlePrintReport(student)}
                        className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center text-sm"
                      >
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                        </svg>
                        Print Report
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!loading && students.length === 0 && (
            <div className="bg-white rounded-xl shadow-lg p-12 text-center no-print">
              <svg className="w-16 h-16 text-black mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <h3 className="text-lg font-medium text-black mb-2">No Students Found</h3>
              <p className="text-black">No students found for the selected class and stream combination.</p>
            </div>
          )}

          {/* Print All Reports Section */}
          {printAllReports && (
            <div className="print-only">
              {students.map((student) => {
                const classLevel = getClassLevel(student.class);
                let optionalSubjectsForStudent: Array<{ id: string; name: string }> = [];
                let assignedSubjectsForStudent: Array<{ id: string; subject_id?: string; name: string; subject_type: string }> = [];
                
                if (classLevel === 'S1-S2' || classLevel === 'S3-S4') {
                  optionalSubjectsForStudent = previewOptionalSubjects;
                } else {
                  assignedSubjectsForStudent = previewAssignedSubjects;
                }

                return (
                  <ReportCard
                    key={student.id}
                    student={student}
                    grades={grades.filter(g => g.student_id === student.id)}
                    term={selectedTerm}
                    year={selectedYear}
                    classTeacher={classTeachers[`${student.class}-${student.stream}`] || 'Not Assigned'}
                    headTeacher="Mr. ISABIRYE SALEH"
                    classTeacherComment={(student as any)?.auto_class_teacher_comment || ''}
                    headTeacherComment={(student as any)?.auto_head_teacher_comment || ''}
                    academicTerm={previewAcademicTerm || undefined}
                    optionalSubjects={optionalSubjectsForStudent}
                    assignedSubjects={assignedSubjectsForStudent}
                    positionInClass={(student as any)?._positionInClass}
                    positionInStream={(student as any)?._positionInStream}
                    totalStudentsInClass={(window as any).__report_positions?.totals?.byClass?.[student.class]}
                    totalStudentsInStream={(window as any).__report_positions?.totals?.byStream?.[`${student.class}-${student.stream}`]}
                  />
                );
              })}
            </div>
          )}

          {showPreview && previewStudent && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-lg shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-indigo-600 border-b border-gray-200 p-4 flex justify-between items-center no-print">
                  <h3 className="text-lg font-bold text-white">Report Card - {previewStudent.full_name}</h3>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handlePrintFromPreview()}
                      className="bg-white text-blue-600 px-4 py-2 rounded-lg hover:bg-blue-50 transition-colors flex items-center font-semibold"
                    >
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                      </svg>
                      Print Now
                    </button>
                    <button
                      onClick={handleClosePreview}
                      className="bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 transition-colors font-semibold"
                    >
                      Close
                    </button>
                  </div>
                </div>
                <div className="p-4">
                  <ReportCard
                    student={previewStudent}
                    grades={grades.filter(g => g.student_id === previewStudent.id)}
                    term={selectedTerm}
                    year={selectedYear}
                    classTeacher={classTeachers[`${previewStudent.class}-${previewStudent.stream}`] || 'Not Assigned'}
                    headTeacher="Mr. ISABIRYE SALEH"
                    classTeacherComment={previewComments?.class_teacher_comment || (previewStudent as any)?.auto_class_teacher_comment || ''}
                    headTeacherComment={previewComments?.head_teacher_comment || (previewStudent as any)?.auto_head_teacher_comment || ''}
                    academicTerm={previewAcademicTerm || undefined}
                    optionalSubjects={previewOptionalSubjects}
                    assignedSubjects={previewAssignedSubjects}
                    positionInClass={(previewStudent as any)?._positionInClass || (window as any).__report_positions?.classPositions?.[previewStudent.id]}
                    positionInStream={(previewStudent as any)?._positionInStream || (window as any).__report_positions?.streamPositions?.[previewStudent.id]}
                    totalStudentsInClass={(window as any).__report_positions?.totals?.byClass?.[previewStudent.class]}
                    totalStudentsInStream={(window as any).__report_positions?.totals?.byStream?.[`${previewStudent.class}-${previewStudent.stream}`]}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
