'use client';

import React from 'react';

export interface Student {
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

export interface Grade {
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

export interface AcademicTerm {
  end_date?: string;
  next_term_start_date?: string;
}

export interface ReportCardProps {
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

export const isSeniorSecondaryClass = (className: string) => /^(S5|S6)/i.test(className || '');
const isJuniorSecondaryClass = (className: string) => /^(S1|S2)/i.test(className || '');
const isLowerSecondaryClass = (className: string) => /^(S3|S4)/i.test(className || '');

export const getClassLevel = (className: string): 'S1-S2' | 'S3-S4' | 'S5-S6' => {
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

export const normalizeReportGrades = (grades: any[]): Grade[] => {
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
      finalScore = Math.round((motScore * 20 / 100) + (eotScore * 80 / 100));
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
        <img
          src="/media/badge.png"
          alt="School Badge"
          width={72}
          height={72}
          className="object-contain"
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            target.onerror = null;
            target.style.display = 'none';
          }}
        />
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
      <img
        src={student.photo_url || '/silhouette.png'}
        alt="Student Photo"
        width={72}
        height={96}
        className="w-[72px] h-24 object-cover border border-gray-800"
        style={{ objectFit: 'cover' }}
        onError={(e) => {
          const target = e.target as HTMLImageElement;
          target.onerror = null;
          target.src = '/silhouette.png';
        }}
      />
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

const S1_S2_FIXED_SUBJECTS = [
  'Mathematics',
  'History & Political Education',
  'English',
  'Geography',
  'Physics',
  'Biology',
  'Chemistry',
  'Physical Education',
  'Entrepreneurship',
  'Kiswahili',
];

const S3_S4_FIXED_SUBJECTS = [
  'Mathematics',
  'History & Political Education',
  'English',
  'Geography',
  'Physics',
  'Biology',
  'Chemistry',
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
  fixedSubjects?: string[];
  optionalCount?: number;
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
    fixedSubjects = S1_S2_FIXED_SUBJECTS,
    optionalCount = 2,
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

  const allSubjects = [...fixedSubjects];
  
  const optionalToAdd = optionalSubjects?.slice(0, optionalCount) || [];
  optionalToAdd.forEach((opt) => allSubjects.push(opt.name));
  
  while (allSubjects.length < fixedSubjects.length + optionalCount) {
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
            <th className="border border-gray-800 px-1 py-0.5 text-center font-bold">MOT [20%]</th>
            <th className="border border-gray-800 px-1 py-0.5 text-center font-bold">EOT [80%]</th>
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
  <ReportCardOLevel {...props} fixedSubjects={S1_S2_FIXED_SUBJECTS} optionalCount={3} />
);

interface ReportCardS3S4Props extends ReportCardProps {
  optionalSubjects?: Array<{ id: string; name: string }>;
}

const ReportCardS3S4: React.FC<ReportCardS3S4Props> = (props) => (
  <ReportCardOLevel {...props} fixedSubjects={S3_S4_FIXED_SUBJECTS} optionalCount={2} showResult />
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

export const ReportCard: React.FC<ReportCardProps> = (props) => {
  const classLevel = getClassLevel(props.student.class);
  
  const { optionalSubjects, assignedSubjects } = props;
  
  let content;
  switch (classLevel) {
    case 'S1-S2':
      content = <ReportCardS1S2 {...props} optionalSubjects={optionalSubjects} />;
      break;
    case 'S3-S4':
      content = <ReportCardS3S4 {...props} optionalSubjects={optionalSubjects} />;
      break;
    case 'S5-S6':
      content = <ReportCardS5S6 {...props} assignedSubjects={assignedSubjects} />;
      break;
    default:
      content = <ReportCardS1S2 {...props} optionalSubjects={optionalSubjects} />;
  }

  return (
    <div className="w-full max-w-[210mm] mx-auto bg-white p-[5mm]">
      {content}
    </div>
  );
};

