# ACADEMIC YEAR & TERM MANAGEMENT - EXECUTION GUIDE

## 🎯 OVERVIEW
This guide will help you set up a complete multi-role authentication system with Academic Year & Term Management including automatic student promotion.

## 📋 EXECUTION ORDER (CRITICAL)

### **Step 1: Create User Roles Table**
```bash
# Run this first to create the user_roles table and RLS setup
psql -d your_database -f migrations/create_user_roles.sql
```

**What this does:**
- Creates `auth.user_roles` table for proper role management
- Sets up RLS policies for role management
- Creates helper functions for role checking
- Automatically assigns roles to existing users
- Supports admin, teacher, and student roles

### **Step 2: Academic Year Management Setup**
```bash
# Run this after user_roles is created
psql -d your_database -f migrations/academic_year_management.sql
```

**What this does:**
- Adds `next_class_id` to classes table for progression
- Adds `status` column to students table
- Creates academic_years, terms, student_history, timetables tables
- Sets up automatic promotion stored procedure
- Creates RLS policies for admin-only access
- Inserts initial academic years and terms

## 🔐 AUTHENTICATION SYSTEM

### **Multi-Role Support:**
- **Admin** - Full system access, can promote students
- **Teacher** - Can manage grades, classes, subjects
- **Student** - Can view own grades, reports

### **Role Assignment:**
1. **Automatic** - Based on user metadata during signup
2. **Manual** - Can be assigned via sms.user_roles table
3. **Existing Users** - Automatically migrated from teachers table

### **RLS Security:**
- **Academic Management** - Admins only (via sms.user_roles)
- **Student Data** - Role-based access
- **Promotion Functions** - Admins only
- **Grade Access** - Teachers and students (own data)

## 🎛️ ADMIN DASHBOARD FEATURES

### **Academic Management Page:**
- **URL**: `/dashboard/admin/academic-management`
- **Navigation**: Added to admin sidebar
- **Features**:
  - Current academic year/term display
  - Academic year management
  - Term date configuration
  - Automatic promotion trigger
  - Timetable management (ready for file upload)

### **Safety Features:**
- **Date Validation** - Cannot promote before Term 3 ends
- **Atomic Transaction** - All or nothing promotion
- **Historical Archive** - Complete student data preservation
- **Role-Based Access** - Only admins can promote

## 🚀 PROMOTION SYSTEM

### **Automatic Promotion Process:**
1. **Safety Check** - Verify Term 3 is completed
2. **Archive Data** - Save student data to history table
3. **Promote Students** - S1→S2→S3→S4→S5→S6
4. **Graduate S6** - Set status to 'Alumni'
5. **Advance Year** - Activate next academic year
6. **Reset Terms** - Set up new term structure

### **Class Progression Chain:**
```
S1 → S2 → S3 → S4 → S5 → S6 → Alumni
```

## 📊 NEW TABLES CREATED

### **Core Tables:**
- `sms.user_roles` - User role management (in sms schema)
- `sms.academic_years` - Academic year tracking
- `sms.terms` - Term dates and status
- `sms.student_history` - Historical archive
- `sms.timetables` - File storage for timetables

### **Enhanced Tables:**
- `sms.classes` - Added `next_class_id` for progression
- `sms.students` - Added `status` for tracking

## 🔧 HELPER FUNCTIONS

### **Academic Functions:**
- `sms.get_current_academic_info()` - Current year/term info
- `sms.can_promote()` - Check if promotion is allowed
- `sms.promote_all_students()` - Execute promotion

### **Auth Functions:**
- `sms.has_role(role_name)` - Check user role
- `sms.get_user_roles()` - Get all user roles

## 🎯 EXPECTED BEHAVIOR

### **After Setup:**
1. **Admin Login** - Full access to academic management
2. **Teacher Login** - Access to classes and grades
3. **Student Login** - Access to own reports
4. **Promotion** - Safe, atomic student advancement

### **Dashboard Features:**
- **Current Status Display** - Shows active year/term
- **Term Configuration** - Interactive date management
- **Promotion Safety** - Date validation and warnings
- **Historical Tracking** - Complete student archive

## 🛠️ TROUBLESHOOTING

### **Common Issues:**
1. **"user_roles does not exist"** - Run create_user_roles.sql first
2. **"Permission denied"** - Check RLS policies and user roles
3. **"Function not found"** - Ensure all migrations completed
4. **"No current academic year"** - Check academic_years table

### **Verification Steps:**
```sql
-- Check if user_roles exists
SELECT * FROM sms.user_roles;

-- Check academic years
SELECT * FROM sms.academic_years WHERE is_current = true;

-- Check class progression
SELECT id, name, next_class_id FROM sms.classes ORDER BY name;

-- Test role function
SELECT sms.has_role('admin');
```

## 🎉 NEXT STEPS

### **After Migration:**
1. **Test Login** - Verify all roles work correctly
2. **Configure Terms** - Set your academic calendar dates
3. **Test Promotion** - Verify safety checks work
4. **Add Navigation** - Ensure academic management is accessible

### **Future Enhancements:**
- **Timetable Upload** - File storage integration
- **Grade-Based Promotion** - Academic requirements
- **Student Reports** - Enhanced historical viewing
- **Teacher Assignments** - Class teacher management

Your **complete multi-role academic management system** is now ready for implementation!
