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
  school_pay_code?: string;
}

interface Grade {
  student_id: string;
  subject: string;
  mot: number;
  eot: number;
  final_score: number;
  grade: string;
  descriptor: string;
  teacher?: string;
  points?: number;
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
}

const getClassLevel = (className: string): 'S1-S2' | 'S3-S4' | 'S5-S6' => {
  if (className === 'S1' || className === 'S2') return 'S1-S2';
  if (className === 'S3' || className === 'S4') return 'S3-S4';
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
    default: return '';
  }
};

const ReportCardHeader: React.FC<{ student: Student; term: string; year: string }> = ({ student, term, year }) => (
  <div className="mb-4">
    <div className="flex items-start justify-between border-b-4 border-blue-900 pb-3 mb-3">
      <div className="flex-shrink-0">
        <Image src="/media/badge.png" alt="School Badge" width={100} height={100} className="object-contain" />
      </div>
      <div className="text-center flex-1 px-3">
        <h1 className="text-2xl font-black text-blue-900 mb-1 uppercase tracking-wider">Kabukye Secondary School</h1>
        <p className="text-xs font-medium text-gray-700 mb-0.5">P.O.Box 117, Kamuli. Tel: 0702755397 / 0770535212</p>
        <p className="text-xs font-medium text-gray-700 mb-0.5">Email: kabukyesecondaryschool@gmail.com</p>
        <p className="text-xs font-bold text-gray-800 italic">&quot;HOLISTIC EDUCATION, DESCIPLINE AND HARDWORK&quot;</p>
      </div>
      <div className="w-24" />
    </div>
    
    <div className="text-center mb-4">
      <h2 className="text-lg font-bold text-black uppercase">End of Term Academic Report Card</h2>
    </div>
    
    <div className="flex items-center gap-6 mb-4">
      <div className="flex-shrink-0">
        {student.photo_url && student.photo_url.length > 0 ? (
          <Image 
            src={student.photo_url} 
            alt={student.full_name} 
            width={120}
            height={120}
            className="w-30 h-30 object-cover border-3 border-gray-300"
          />
        ) : (
          <div className="w-30 h-30 bg-gray-200 border-3 border-gray-300 flex items-center justify-center">
            <svg className="w-16 h-16 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
            </svg>
          </div>
        )}
      </div>
      
      <div className="flex-1">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <span className="font-bold text-black text-xs">NAME: </span>
            <span className="text-black text-xs">{student.full_name}</span>
          </div>
          <div>
            <span className="font-bold text-black text-xs">STREAM: </span>
            <span className="text-black text-xs">{student.stream}</span>
          </div>
          <div>
            <span className="font-bold text-black text-xs">GENDER: </span>
            <span className="text-black text-xs">{student.gender}</span>
          </div>
          <div>
            <span className="font-bold text-black text-xs">TERM: </span>
            <span className="text-black text-xs">{term}</span>
          </div>
          <div>
            <span className="font-bold text-black text-xs">CLASS: </span>
            <span className="text-black text-xs">{student.class} {student.stream}</span>
          </div>
          <div>
            <span className="font-bold text-black text-xs">YEAR: </span>
            <span className="text-black text-xs">{year}</span>
          </div>
          <div>
            <span className="font-bold text-black text-xs">Student ID: </span>
            <span className="text-black text-xs">{student.school_pay_code || '-'}</span>
          </div>
          {(student.class === 'S5' || student.class === 'S6') && student.subject_combination && (
            <div>
              <span className="font-bold text-black text-xs">Combination(for s5 and s6): </span>
              <span className="text-black text-xs">{student.subject_combination}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  </div>
);

const GradingScale: React.FC = () => (
  <div className="mb-3">
    <table className="w-full border-collapse border border-gray-800 text-xs">
      <tbody>
        <tr>
          <td className="border border-gray-800 px-2 py-1 text-center font-bold text-black bg-gray-100" colSpan={5}>GRADING SCHEME</td>
        </tr>
        <tr>
          <td className="border border-gray-800 px-2 py-1 text-center font-bold text-black">A</td>
          <td className="border border-gray-800 px-2 py-1 text-center font-bold text-black">B</td>
          <td className="border border-gray-800 px-2 py-1 text-center font-bold text-black">C</td>
          <td className="border border-gray-800 px-2 py-1 text-center font-bold text-black">D</td>
          <td className="border border-gray-800 px-2 py-1 text-center font-bold text-black">E</td>
        </tr>
        <tr>
          <td className="border border-gray-800 px-2 py-1 text-center text-black">Exceptional</td>
          <td className="border border-gray-800 px-2 py-1 text-center text-black">Outstanding</td>
          <td className="border border-gray-800 px-2 py-1 text-center text-black">Satisfactory</td>
          <td className="border border-gray-800 px-2 py-1 text-center text-black">Basic</td>
          <td className="border border-gray-800 px-2 py-1 text-center text-black">Elementary</td>
        </tr>
        <tr>
          <td className="border border-gray-800 px-2 py-1 text-center text-black">80-100</td>
          <td className="border border-gray-800 px-2 py-1 text-center text-black">70-79</td>
          <td className="border border-gray-800 px-2 py-1 text-center text-black">50-69</td>
          <td className="border border-gray-800 px-2 py-1 text-center text-black">35-49</td>
          <td className="border border-gray-800 px-2 py-1 text-center text-black">00-34</td>
        </tr>
      </tbody>
    </table>
  </div>
);

const ReportCardSignatures: React.FC<{ classTeacher: string; headTeacher: string; academicTerm?: AcademicTerm }> = ({ classTeacher, headTeacher, academicTerm }) => (
  <div>
    <div className="mb-3">
      <p className="font-bold text-black text-xs">CLASS TEACHER: {classTeacher}</p>
    </div>
    
    <table className="w-full border-collapse border border-gray-800 mb-3 text-xs">
      <tbody>
        <tr>
          <td className="border border-gray-800 px-2 py-1 text-left text-black w-1/2">Class Teacher&apos;s comment</td>
          <td className="border border-gray-800 px-2 py-2 text-left text-black w-1/2"></td>
        </tr>
        <tr>
          <td className="border border-gray-800 px-2 py-1 text-left text-black">Headteacher&apos;s comment</td>
          <td className="border border-gray-800 px-2 py-2 text-left text-black"></td>
        </tr>
      </tbody>
    </table>
    
    <div className="flex justify-between items-center">
      <p className="text-black text-xs">Date of issue: {academicTerm?.end_date || ''}</p>
      <p className="text-black text-xs">Next Term Begins: {academicTerm?.next_term_start_date || ''}</p>
    </div>
  </div>
);

const ReportCardS1S2: React.FC<ReportCardProps> = (props) => {
  const { student, grades, term, year, classTeacher, headTeacher, academicTerm, positionInClass, positionInStream, totalStudentsInClass, totalStudentsInStream } = props;
  const totalScore = grades.reduce((sum, g) => sum + (g.final_score || 0), 0);
  const averageScore = grades.length > 0 ? Math.round(totalScore / grades.length) : 0;

  return (
    <div className="bg-white border border-gray-400 p-4" style={{ pageBreakInside: 'avoid' }}>
      <ReportCardHeader student={student} term={term} year={year} />
      
      <table className="w-full border-collapse border border-gray-800 mb-4 text-xs">
        <thead>
          <tr className="bg-gray-100">
            <th className="border border-gray-800 px-1.5 py-1 text-left font-bold text-black">SUBJECT</th>
            <th className="border border-gray-800 px-1.5 py-1 text-center font-bold text-black">MOT [40%]</th>
            <th className="border border-gray-800 px-1.5 py-1 text-center font-bold text-black">EOT [60%]</th>
            <th className="border border-gray-800 px-1.5 py-1 text-center font-bold text-black">Final score</th>
            <th className="border border-gray-800 px-1.5 py-1 text-center font-bold text-black">Grade</th>
            <th className="border border-gray-800 px-1.5 py-1 text-center font-bold text-black">Descriptor</th>
            <th className="border border-gray-800 px-1.5 py-1 text-center font-bold text-black">Teacher</th>
          </tr>
        </thead>
        <tbody>
          {grades.map((grade, index) => (
            <tr key={index}>
              <td className="border border-gray-800 px-1.5 py-1 text-black">{grade.subject}</td>
              <td className="border border-gray-800 px-1.5 py-1 text-center text-black">{grade.mot || ''}</td>
              <td className="border border-gray-800 px-1.5 py-1 text-center text-black">{grade.eot || ''}</td>
              <td className="border border-gray-800 px-1.5 py-1 text-center font-bold text-black">{grade.final_score || ''}</td>
              <td className="border border-gray-800 px-1.5 py-1 text-center font-bold text-black">{getGradeFromScore(grade.final_score || 0)}</td>
              <td className="border border-gray-800 px-1.5 py-1 text-center text-black">{getDescriptorFromGrade(getGradeFromScore(grade.final_score || 0))}</td>
              <td className="border border-gray-800 px-1.5 py-1 text-center text-black">{grade.teacher || ''}</td>
            </tr>
          ))}
          <tr>
            <td className="border border-gray-800 px-1.5 py-1 text-black"></td>
            <td className="border border-gray-800 px-1.5 py-1 text-center text-black"></td>
            <td className="border border-gray-800 px-1.5 py-1 text-center text-black"></td>
            <td className="border border-gray-800 px-1.5 py-1 text-center font-bold text-black"></td>
            <td className="border border-gray-800 px-1.5 py-1 text-center font-bold text-black"></td>
            <td className="border border-gray-800 px-1.5 py-1 text-center text-black"></td>
            <td className="border border-gray-800 px-1.5 py-1 text-center text-black"></td>
          </tr>
          <tr className="bg-gray-100 font-bold">
            <td className="border border-gray-800 px-1.5 py-1 text-black">Overall % average score</td>
            <td className="border border-gray-800 px-1.5 py-1 text-center text-black"></td>
            <td className="border border-gray-800 px-1.5 py-1 text-center text-black"></td>
            <td className="border border-gray-800 px-1.5 py-1 text-center text-black">{averageScore}%</td>
            <td className="border border-gray-800 px-1.5 py-1 text-center text-black"></td>
            <td className="border border-gray-800 px-1.5 py-1 text-center text-black"></td>
            <td className="border border-gray-800 px-1.5 py-1 text-center text-black"></td>
          </tr>
        </tbody>
      </table>
      
      <div className="flex justify-start gap-4 mb-4">
        <p className="text-black text-xs">Position in class: {positionInClass || ''} out of {totalStudentsInClass || ''}</p>
        <p className="text-black text-xs">position in stream: {positionInStream || ''} out of {totalStudentsInStream || ''}</p>
      </div>
      
      <GradingScale />
      <ReportCardSignatures classTeacher={classTeacher} headTeacher={headTeacher} academicTerm={academicTerm} />
    </div>
  );
};

const ReportCardS3S4: React.FC<ReportCardProps> = (props) => {
  const { student, grades, term, year, classTeacher, headTeacher, academicTerm, positionInClass, positionInStream, totalStudentsInClass, totalStudentsInStream } = props;
  const totalScore = grades.reduce((sum, g) => sum + (g.final_score || 0), 0);
  const averageScore = grades.length > 0 ? Math.round(totalScore / grades.length) : 0;

  return (
    <div className="bg-white border border-gray-400 p-4" style={{ pageBreakInside: 'avoid' }}>
      <ReportCardHeader student={student} term={term} year={year} />
      
      <div className="text-center mb-6">
        <h2 className="text-2xl font-normal text-black">FOR S3 AND S4</h2>
      </div>
      
      <table className="w-full border-collapse border border-gray-800 mb-4 text-xs">
        <thead>
          <tr className="bg-gray-100">
            <th className="border border-gray-800 px-1.5 py-1 text-left font-bold text-black">SUBJECT</th>
            <th className="border border-gray-800 px-1.5 py-1 text-center font-bold text-black">MOT [40%]</th>
            <th className="border border-gray-800 px-1.5 py-1 text-center font-bold text-black">EOT [60%]</th>
            <th className="border border-gray-800 px-1.5 py-1 text-center font-bold text-black">Final score</th>
            <th className="border border-gray-800 px-1.5 py-1 text-center font-bold text-black">Grade</th>
            <th className="border border-gray-800 px-1.5 py-1 text-center font-bold text-black">Descriptor</th>
            <th className="border border-gray-800 px-1.5 py-1 text-center font-bold text-black">Teacher</th>
          </tr>
        </thead>
        <tbody>
          {grades.map((grade, index) => (
            <tr key={index}>
              <td className="border border-gray-800 px-1.5 py-1 text-black">{grade.subject}</td>
              <td className="border border-gray-800 px-1.5 py-1 text-center text-black">{grade.mot || ''}</td>
              <td className="border border-gray-800 px-1.5 py-1 text-center text-black">{grade.eot || ''}</td>
              <td className="border border-gray-800 px-1.5 py-1 text-center font-bold text-black">{grade.final_score || ''}</td>
              <td className="border border-gray-800 px-1.5 py-1 text-center font-bold text-black">{getGradeFromScore(grade.final_score || 0)}</td>
              <td className="border border-gray-800 px-1.5 py-1 text-center text-black">{getDescriptorFromGrade(getGradeFromScore(grade.final_score || 0))}</td>
              <td className="border border-gray-800 px-1.5 py-1 text-center text-black">{grade.teacher || ''}</td>
            </tr>
          ))}
          <tr>
            <td className="border border-gray-800 px-1.5 py-1 text-black"></td>
            <td className="border border-gray-800 px-1.5 py-1 text-center text-black"></td>
            <td className="border border-gray-800 px-1.5 py-1 text-center text-black"></td>
            <td className="border border-gray-800 px-1.5 py-1 text-center font-bold text-black"></td>
            <td className="border border-gray-800 px-1.5 py-1 text-center font-bold text-black"></td>
            <td className="border border-gray-800 px-1.5 py-1 text-center text-black"></td>
            <td className="border border-gray-800 px-1.5 py-1 text-center text-black"></td>
          </tr>
          <tr>
            <td className="border border-gray-800 px-1.5 py-1 text-black"></td>
            <td className="border border-gray-800 px-1.5 py-1 text-center text-black"></td>
            <td className="border border-gray-800 px-1.5 py-1 text-center text-black"></td>
            <td className="border border-gray-800 px-1.5 py-1 text-center font-bold text-black"></td>
            <td className="border border-gray-800 px-1.5 py-1 text-center font-bold text-black"></td>
            <td className="border border-gray-800 px-1.5 py-1 text-center text-black"></td>
            <td className="border border-gray-800 px-1.5 py-1 text-center text-black"></td>
          </tr>
          <tr className="bg-gray-100 font-bold">
            <td className="border border-gray-800 px-1.5 py-1 text-black">Overall % average score</td>
            <td className="border border-gray-800 px-1.5 py-1 text-center text-black"></td>
            <td className="border border-gray-800 px-1.5 py-1 text-center text-black"></td>
            <td className="border border-gray-800 px-1.5 py-1 text-center text-black">{averageScore}%</td>
            <td className="border border-gray-800 px-1.5 py-1 text-center text-black"></td>
            <td className="border border-gray-800 px-1.5 py-1 text-center text-black"></td>
            <td className="border border-gray-800 px-1.5 py-1 text-center text-black"></td>
          </tr>
        </tbody>
      </table>
      
      <div className="flex justify-start gap-1 mb-4">
        <p className="text-black text-xs">Position in class: {positionInClass || ''} out of {totalStudentsInClass || ''}</p>
        <p className="text-black text-xs">position in stream: {positionInStream || ''} out of {totalStudentsInStream || ''}</p>
      </div>
      
      <p className="text-black text-xs mb-4">Result: </p>
      
      <GradingScale />
      <ReportCardSignatures classTeacher={classTeacher} headTeacher={headTeacher} academicTerm={academicTerm} />
    </div>
  );
};

const ReportCardS5S6: React.FC<ReportCardProps> = (props) => {
  const { student, grades, term, year, classTeacher, headTeacher, academicTerm } = props;
  const totalPoints = grades.reduce((sum, g) => sum + (g.points || 0), 0);

  return (
    <div className="bg-white border border-gray-400 p-4" style={{ pageBreakInside: 'avoid' }}>
      <ReportCardHeader student={student} term={term} year={year} />
      
      <div className="text-center mb-6">
        <h2 className="text-2xl font-normal text-black">FOR S5 AND S6</h2>
      </div>
      
      <table className="w-full border-collapse border border-gray-800 mb-4 text-xs">
        <thead>
          <tr className="bg-gray-100">
            <th className="border border-gray-800 px-1.5 py-1 text-left font-bold text-black">SUBJECT</th>
            <th className="border border-gray-800 px-1.5 py-1 text-center font-bold text-black">MOT [40%]</th>
            <th className="border border-gray-800 px-1.5 py-1 text-center font-bold text-black">EOT [60%]</th>
            <th className="border border-gray-800 px-1.5 py-1 text-center font-bold text-black">Final score</th>
            <th className="border border-gray-800 px-1.5 py-1 text-center font-bold text-black">Grade</th>
            <th className="border border-gray-800 px-1.5 py-1 text-center font-bold text-black">Descriptor</th>
            <th className="border border-gray-800 px-1.5 py-1 text-center font-bold text-black">Teacher</th>
          </tr>
        </thead>
        <tbody>
          {grades.map((grade, index) => (
            <tr key={index}>
              <td className="border border-gray-800 px-1.5 py-1 text-black">{grade.subject}</td>
              <td className="border border-gray-800 px-1.5 py-1 text-center text-black">{grade.mot || ''}</td>
              <td className="border border-gray-800 px-1.5 py-1 text-center text-black">{grade.eot || ''}</td>
              <td className="border border-gray-800 px-1.5 py-1 text-center font-bold text-black">{grade.final_score || ''}</td>
              <td className="border border-gray-800 px-1.5 py-1 text-center font-bold text-black">{getGradeFromScore(grade.final_score || 0)}</td>
              <td className="border border-gray-800 px-1.5 py-1 text-center text-black">{getDescriptorFromGrade(getGradeFromScore(grade.final_score || 0))}</td>
              <td className="border border-gray-800 px-1.5 py-1 text-center text-black">{grade.teacher || ''}</td>
            </tr>
          ))}
          <tr>
            <td className="border border-gray-800 px-1.5 py-1 text-black"></td>
            <td className="border border-gray-800 px-1.5 py-1 text-center text-black"></td>
            <td className="border border-gray-800 px-1.5 py-1 text-center text-black"></td>
            <td className="border border-gray-800 px-1.5 py-1 text-center font-bold text-black"></td>
            <td className="border border-gray-800 px-1.5 py-1 text-center font-bold text-black"></td>
            <td className="border border-gray-800 px-1.5 py-1 text-center text-black"></td>
            <td className="border border-gray-800 px-1.5 py-1 text-center text-black"></td>
          </tr>
          <tr>
            <td className="border border-gray-800 px-1.5 py-1 text-black"></td>
            <td className="border border-gray-800 px-1.5 py-1 text-center text-black"></td>
            <td className="border border-gray-800 px-1.5 py-1 text-center text-black"></td>
            <td className="border border-gray-800 px-1.5 py-1 text-center font-bold text-black"></td>
            <td className="border border-gray-800 px-1.5 py-1 text-center font-bold text-black"></td>
            <td className="border border-gray-800 px-1.5 py-1 text-center text-black"></td>
            <td className="border border-gray-800 px-1.5 py-1 text-center text-black"></td>
          </tr>
          <tr>
            <td className="border border-gray-800 px-1.5 py-1 text-black">General Paper</td>
            <td className="border border-gray-800 px-1.5 py-1 text-center text-black"></td>
            <td className="border border-gray-800 px-1.5 py-1 text-center text-black"></td>
            <td className="border border-gray-800 px-1.5 py-1 text-center font-bold text-black"></td>
            <td className="border border-gray-800 px-1.5 py-1 text-center font-bold text-black"></td>
            <td className="border border-gray-800 px-1.5 py-1 text-center text-black"></td>
            <td className="border border-gray-800 px-1.5 py-1 text-center text-black"></td>
          </tr>
          <tr>
            <td className="border border-gray-800 px-1.5 py-1 text-black">Sub ICT or Sub Math</td>
            <td className="border border-gray-800 px-1.5 py-1 text-center text-black"></td>
            <td className="border border-gray-800 px-1.5 py-1 text-center text-black"></td>
            <td className="border border-gray-800 px-1.5 py-1 text-center font-bold text-black"></td>
            <td className="border border-gray-800 px-1.5 py-1 text-center font-bold text-black"></td>
            <td className="border border-gray-800 px-1.5 py-1 text-center text-black"></td>
            <td className="border border-gray-800 px-1.5 py-1 text-center text-black"></td>
          </tr>
          <tr className="bg-gray-100 font-bold">
            <td className="border border-gray-800 px-1.5 py-1 text-black">Total Points: {totalPoints || ''}</td>
            <td className="border border-gray-800 px-1.5 py-1 text-center text-black"></td>
            <td className="border border-gray-800 px-1.5 py-1 text-center text-black"></td>
            <td className="border border-gray-800 px-1.5 py-1 text-center text-black"></td>
            <td className="border border-gray-800 px-1.5 py-1 text-center text-black"></td>
            <td className="border border-gray-800 px-1.5 py-1 text-center text-black"></td>
            <td className="border border-gray-800 px-1.5 py-1 text-center text-black"></td>
          </tr>
        </tbody>
      </table>
      
      <GradingScale />
      <ReportCardSignatures classTeacher={classTeacher} headTeacher={headTeacher} academicTerm={academicTerm} />
    </div>
  );
};

const ReportCard: React.FC<ReportCardProps> = (props) => {
  const classLevel = getClassLevel(props.student.class);
  
  switch (classLevel) {
    case 'S1-S2':
      return <ReportCardS1S2 {...props} />;
    case 'S3-S4':
      return <ReportCardS3S4 {...props} />;
    case 'S5-S6':
      return <ReportCardS5S6 {...props} />;
    default:
      return <ReportCardS1S2 {...props} />;
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

  useEffect(() => {
    fetchClassesAndStreams();
  }, []);

  const fetchClassesAndStreams = async () => {
    try {
      const response = await fetch('/api/classes');
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
          const response = await fetch(`/api/students/${student.id}/class-teacher`);
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

  const fetchReportData = async () => {
    if (!selectedStream) return;
    
    try {
      setLoading(true);
      
      if (selectedClass === 'ALL' && selectedStream === 'ALL') {
        const studentsResponse = await fetch('/api/students');
        const studentsResult = await studentsResponse.json();
        
        if (studentsResponse.ok) {
          const transformedStudents = (studentsResult.data || []).map((student: any) => ({
            ...student,
            class: student.classes?.name || student.class_id || 'Unknown',
            stream: student.streams?.name || student.stream_id || 'Unknown'
          }));
          setStudents(transformedStudents);
          fetchClassTeachers(transformedStudents);
        }

        const gradesResponse = await fetch(`/api/reports?term=${selectedTerm}&year=${selectedYear}`);
        const gradesResult = await gradesResponse.json();
        
        if (gradesResponse.ok) {
          setGrades(gradesResult.data?.grades || []);
        }
      } else {
        const params = new URLSearchParams();
        if (selectedClass !== 'ALL') {
          params.append('class_id', selectedClass.toLowerCase());
        }
        if (selectedStream !== 'ALL') {
          params.append('stream_id', selectedStream);
        }
        
        const studentsResponse = await fetch(`/api/students?${params.toString()}`);
        const studentsResult = await studentsResponse.json();
        
        if (studentsResponse.ok) {
          const transformedStudents = (studentsResult.data || []).map((student: any) => ({
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
        if (selectedClass !== 'ALL') gradesParams.append('class', selectedClass);
        if (selectedStream !== 'ALL') gradesParams.append('stream', selectedStream);
        
        const gradesResponse = await fetch(`/api/reports?${gradesParams.toString()}`);
        const gradesResult = await gradesResponse.json();
        
        if (gradesResponse.ok) {
          setGrades(gradesResult.data?.grades || []);
        }
      }
    } catch (error) {
      console.error('Error fetching report data:', error);
    } finally {
      setLoading(false);
    }
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

  return (
    <div className="h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex overflow-hidden">
      <style jsx>{`
        @media print {
          .no-print {
            display: none !important;
          }
          body {
            margin: 0;
            padding: 0;
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
                  onClick={() => window.print()}
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
                            {(student.class === 'S5' || student.class === 'S6') && student.subject_combination && (
                              <span className="ml-2 text-blue-600">({student.subject_combination})</span>
                            )}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => window.print()}
                        className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center text-sm"
                      >
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
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

          <div className="print-only">
            {students.map((student) => (
              <div key={student.id} className="mb-8">
                <ReportCard
                  student={student}
                  grades={grades.filter(g => g.student_id === student.id)}
                  term={selectedTerm}
                  year={selectedYear}
                  classTeacher={classTeachers[`${student.class}-${student.stream}`] || 'Not Assigned'}
                  headTeacher="Mr. ISABIRYE SALEH"
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
