// Academic Calendar Utility Functions

// Term definitions for 2025
export const ACADEMIC_TERMS_2025 = [
  {
    name: 'Term I',
    startDate: new Date('2025-02-03'), // Monday, 3rd February 2025
    endDate: new Date('2025-05-02'),   // Friday, 2nd May 2025
    days: 89
  },
  {
    name: 'Term II',
    startDate: new Date('2025-05-26'), // Monday, 26th May 2025
    endDate: new Date('2025-08-22'),  // Friday, 22nd August 2025
    days: 89
  },
  {
    name: 'Term III',
    startDate: new Date('2025-09-15'), // Monday, 15th September 2025
    endDate: new Date('2025-12-05'),  // Friday, 5th December 2025
    days: 82
  }
];

// Term definitions for 2026
export const ACADEMIC_TERMS_2026 = [
  {
    name: 'Term I',
    startDate: new Date('2026-02-02'), // Monday, 2nd February 2026
    endDate: new Date('2026-05-01'),   // Friday, 1st May 2026
    days: 89
  },
  {
    name: 'Term II',
    startDate: new Date('2026-05-25'), // Monday, 25th May 2026
    endDate: new Date('2026-08-21'),  // Friday, 21st August 2026
    days: 89
  },
  {
    name: 'Term III',
    startDate: new Date('2026-09-14'), // Monday, 14th September 2026
    endDate: new Date('2026-12-04'),  // Friday, 4th December 2026
    days: 82
  }
];

// Term definitions for 2027
export const ACADEMIC_TERMS_2027 = [
  {
    name: 'Term I',
    startDate: new Date('2027-02-01'), // Monday, 1st February 2027
    endDate: new Date('2027-04-30'),   // Friday, 30th April 2027
    days: 88
  },
  {
    name: 'Term II',
    startDate: new Date('2027-05-24'), // Monday, 24th May 2027
    endDate: new Date('2027-08-20'),  // Friday, 20th August 2027
    days: 89
  },
  {
    name: 'Term III',
    startDate: new Date('2027-09-13'), // Monday, 13th September 2027
    endDate: new Date('2027-12-03'),  // Friday, 3rd December 2027
    days: 82
  }
];

// Get current academic year and term
export function getCurrentAcademicYear() {
  const now = new Date();
  const year = now.getFullYear();
  
  // Academic year runs from January to December, not February-based
  // If we're in January, we're still in the current academic year
  return year;
}

// Get current term based on today's date
export function getCurrentTerm() {
  const now = new Date();
  const currentYear = getCurrentAcademicYear();
  
  // Find which term we're currently in
  const currentYearTerms = getAcademicTerms(currentYear);
  for (const term of currentYearTerms) {
    if (now >= term.startDate && now <= term.endDate) {
      return {
        ...term,
        academicYear: currentYear
      };
    }
  }
  
  // If we're between terms, return the next term
  for (let i = 0; i < currentYearTerms.length; i++) {
    if (now < currentYearTerms[i].startDate) {
      return {
        ...currentYearTerms[i],
        academicYear: currentYear
      };
    }
  }
  
  // Default to first term of current year
  return {
    ...currentYearTerms[0],
    academicYear: currentYear
  };
}

// Get all terms for a given academic year
export function getAcademicTerms(year: number) {
  switch (year) {
    case 2025:
      return ACADEMIC_TERMS_2025;
    case 2026:
      return ACADEMIC_TERMS_2026;
    case 2027:
      return ACADEMIC_TERMS_2027;
    default:
      // For future years, return a template structure
      return [
        {
          name: 'Term I',
          startDate: new Date(`${year}-02-01`),
          endDate: new Date(`${year}-05-01`),
          days: 89
        },
        {
          name: 'Term II',
          startDate: new Date(`${year}-05-25`),
          endDate: new Date(`${year}-08-20`),
          days: 89
        },
        {
          name: 'Term III',
          startDate: new Date(`${year}-09-15`),
          endDate: new Date(`${year}-12-05`),
          days: 82
        }
      ];
  }
}
