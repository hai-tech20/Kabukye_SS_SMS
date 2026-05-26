# UACE A-Level Grading System Implementation

## Overview

This implementation adds UACE (Uganda Advanced Certificate of Education) grading and total points calculation for S5/S6 students. It converts percentage marks (0-100) into UNEB letter grades (A–F/O) and calculates UACE points based on subject type.

## What Was Added

### 3 New Migration Files in `migrations/`:

1. **add_uace_columns.sql**
   - Adds `uace_points` and `subject_type` columns to `sms.grades`
   - Adds `total_uace_points` column to `sms.students`
   - **Run this first**

2. **uace_grading_functions.sql**
   - Creates 3 helper functions:
     - `sms.score_to_grade(score)` — Converts percentage (0-100) to letter grade (A/B/C/D/E/O/F)
     - `sms.grade_to_points(grade, subject_type)` — Maps grade to UACE points based on subject type
     - `sms.infer_subject_type(subject_name)` — Auto-detects subject type from name
   - Creates main procedure: `sms.calculate_s5_s6_uace_grades(academic_year, term)`
   - **Run this second**

3. **UACE_EXECUTION_GUIDE.sql**
   - Shows how to call the procedure and verify results
   - Contains example queries for checking results
   - **Run this when you want to apply grading to data**

## Grade Boundaries (Input: final_score percentage)

```
A: 80-100
B: 70-79
C: 60-69
D: 50-59
E: 40-49
O: 30-39
F: 0-29
```

## UACE Points Mapping

### Principal Subjects (A-level main subjects)
```
A → 6 points
B → 5 points
C → 4 points
D → 3 points
E → 2 points
O → 1 point
F → 0 points
```

### Subsidiary Subjects & General Paper
```
A-E → 1 point each
F   → 0 points
```

### Total UACE Points
Sum of **best 3 principal subjects only** (subsidiaries and GP are not included in total)

## How It Works

### Step 1: Prepare Database Schema
Run the first migration to add the required columns:
```sql
-- Run in your database
\i migrations/add_uace_columns.sql
```

### Step 2: Install Functions
Run the second migration to create helper functions and the main procedure:
```sql
-- Run in your database
\i migrations/uace_grading_functions.sql
```

### Step 3: Apply to Data
For each academic year/term combination where you have MOT+EOT final scores, call:
```sql
CALL sms.calculate_s5_s6_uace_grades(2026, 1);  -- Year 2026, Term 1
```

This procedure will:
1. Convert `final_score` (percentage) → letter grade (A-F)
2. Auto-detect `subject_type` (principal/subsidiary/general_paper) from subject name
3. Calculate `uace_points` based on grade and subject type
4. Sum best 3 principal subjects → store in `students.total_uace_points`

### Step 4: Verify Results
Run the verification queries in `UACE_EXECUTION_GUIDE.sql` to inspect results:
```sql
-- View student summaries with UACE points
SELECT admission_number, full_name, subject_combination, total_uace_points
FROM sms.students
WHERE subject_combination IS NOT NULL
ORDER BY full_name;

-- View grade breakdown
SELECT st.full_name, subj.subject_name, g.grade, g.uace_points, g.final_score
FROM sms.students st
JOIN sms.grades g ON g.student_id = st.id
JOIN sms.subjects subj ON subj.id = g.subject_id
WHERE st.subject_combination IS NOT NULL
  AND g.academic_year = 2026
  AND g.term = 1
ORDER BY st.full_name, subj.subject_name;
```

## Subject Type Auto-Detection

The system infers subject type from subject name:
- **general_paper** ← name contains "General Paper" or "GP"
- **subsidiary** ← name contains "Sub-" or "Subsidiary"
- **principal** ← everything else (default)

If auto-detection doesn't work, manually update:
```sql
UPDATE sms.grades
SET subject_type = 'subsidiary'
WHERE subject_id = [SUBJECT_ID]
  AND academic_year = 2026
  AND term = 1;
```

## Data Flow

```
MOT score (0-100)  ─┐
                     ├─→ final_score = (MOT × 40%) + (EOT × 60%)
EOT score (0-100)  ─┘
                     ↓
              final_score (percentage)
                     ↓
              sms.score_to_grade()
                     ↓
              Letter Grade (A-F/O)
                     ↓
         sms.grade_to_points() + subject_type
                     ↓
              UACE Points (0-6 or 0-1)
                     ↓
           Sum of Best 3 Principal Subjects
                     ↓
           students.total_uace_points
```

## Quick Start Example

```sql
-- 1. Add columns
\i migrations/add_uace_columns.sql

-- 2. Add functions
\i migrations/uace_grading_functions.sql

-- 3. Calculate grades for Year 2026, Term 1
CALL sms.calculate_s5_s6_uace_grades(2026, 1);

-- 4. View results
SELECT admission_number, full_name, total_uace_points
FROM sms.students
WHERE subject_combination IS NOT NULL
ORDER BY full_name;
```

## Testing Scenario

If you want to test with the example from the Python script:
- Student takes: Subject 1 (88, 76, 54), Subject 2 (90, 86, 82), Subject 3 (72, 68), Sub-Math (65), GP (70)
- Expected grades: B, A, C, Pass, Pass
- Expected points: 5 + 6 + 4 = **15 total** (from best 3 principal subjects)
- Note: Python script showed 17, but that included subsidiary+GP; SQL only includes best 3 principals per UACE rules.

## Important Notes

- **S5/S6 Only**: Procedure only processes students with non-null `subject_combination`
- **Idempotent**: Can run multiple times; it recalculates from `final_score` each time
- **Schema**: All tables in `sms` schema (not public)
- **No Data Loss**: Existing data is overwritten only in `grade`, `uace_points`, `subject_type`, `total_uace_points` columns

## Files Created

```
migrations/
├── add_uace_columns.sql              # Schema changes
├── uace_grading_functions.sql        # Functions and main procedure
└── UACE_EXECUTION_GUIDE.sql          # Examples and verification queries
```

## Troubleshooting

**Error: "subject_type cannot be determined"**
- Subject names don't match expected patterns
- Solution: Manually set `subject_type` in UPDATE queries

**Query returns no results**
- Verify S5/S6 students have `subject_combination` filled in
- Verify grades exist for the academic_year and term

**Total UACE points is 0**
- Check that at least 3 principal subjects have grades entered
- Verify `final_score` is populated (not NULL)
- Verify grades are not F9 (which maps to 0 points)
