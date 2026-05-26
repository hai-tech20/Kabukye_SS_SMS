from pathlib import Path

root = Path(r'c:\Users\pc\Desktop\kabukye_ss_sms')

# 1. Fix studentQuery assignment in reports route
path = root / 'src' / 'app' / 'api' / 'reports' / 'route.ts'
text = path.read_text(encoding='utf-8')
old = "    const studentQuery = supabaseAdmin\n      .from('students')\n      .select('id')\n      .eq('class_id', class_id);\n\n    if (stream_id) {\n      studentQuery.eq('stream_id', stream_id);\n    }\n"
new = "    let studentQuery = supabaseAdmin\n      .from('students')\n      .select('id')\n      .eq('class_id', class_id);\n\n    if (stream_id) {\n      studentQuery = studentQuery.eq('stream_id', stream_id);\n    }\n"
if old not in text:
    raise SystemExit('Student query block not found in reports route')
text = text.replace(old, new, 1)
path.write_text(text, encoding='utf-8')
print('Updated reports route studentQuery assignment')

# 2. Update admin report page
path = root / 'src' / 'app' / 'dashboard' / 'admin' / 'reports' / 'page.tsx'
text = path.read_text(encoding='utf-8')
find = "if (gradesResponse.ok) {\n          setGrades(normalizeReportGrades(gradesResult.data?.grades || []));\n        }\n"
replace = "if (gradesResponse.ok) {\n          setGrades(normalizeReportGrades(gradesResult.data?.grades || []));\n          setIsPublished(Boolean(gradesResult.data?.is_published));\n        }\n"
for i in range(2):
    if find not in text:
        raise SystemExit(f'Expected publish state block occurrence {i+1} not found')
    text = text.replace(find, replace, 1)

find = "          <tr>\n            <td colSpan={7} className=\"border border-gray-800 px-1.5 py-1 text-black text-xs\">Position in class: {positionInClass || ''} out of {totalStudentsInClass || ''} position in stream: {positionInStream || ''} out of {totalStudentsInStream || ''}</td>\n          </tr>\n        </tbody>\n      </table>\n"
replace = "          <tr>\n            <td colSpan={7} className=\"border border-gray-800 px-1.5 py-1 text-black text-xs\">Position in class: {positionInClass || ''} out of {totalStudentsInClass || ''} position in stream: {positionInStream || ''} out of {totalStudentsInStream || ''}</td>\n          </tr>\n          <tr>\n            <td colSpan={7} className=\"border border-gray-800 px-1.5 py-1 text-black text-xs font-semibold\">This report is final. Term {term} is now closed and students are promoted to the next class.</td>\n          </tr>\n        </tbody>\n      </table>\n"
for i in range(2):
    if find not in text:
        raise SystemExit(f'Expected position row occurrence {i+1} not found')
    text = text.replace(find, replace, 1)

find = "          <tr className=\"bg-gray-100 font-bold\">\n            <td className=\"border border-gray-800 px-1.5 py-1 text-black\">Total Points: {totalPoints || '0'}<\/td>\n            <td className=\"border border-gray-800 px-1.5 py-1 text-center text-black\"></td>\n            <td className=\"border border-gray-800 px-1.5 py-1 text-center text-black\"></td>\n            <td className=\"border border-gray-800 px-1.5 py-1 text-center text-black\"></td>\n            <td className=\"border border-gray-800 px-1.5 py-1 text-center text-black\"></td>\n            <td className=\"border border-gray-800 px-1.5 py-1 text-center text-black\"></td>\n            <td className=\"border border-gray-800 px-1.5 py-1 text-center text-black\"></td>\n          </tr>\n        </tbody>\n      </table>\n"
replace = "          <tr className=\"bg-gray-100 font-bold\">\n            <td className=\"border border-gray-800 px-1.5 py-1 text-black\">Total Points: {totalPoints || '0'}<\/td>\n            <td className=\"border border-gray-800 px-1.5 py-1 text-center text-black\"></td>\n            <td className=\"border border-gray-800 px-1.5 py-1 text-center text-black\"></td>\n            <td className=\"border border-gray-800 px-1.5 py-1 text-center text-black\"></td>\n            <td className=\"border border-gray-800 px-1.5 py-1 text-center text-black\"></td>\n            <td className=\"border border-gray-800 px-1.5 py-1 text-center text-black\"></td>\n            <td className=\"border border-gray-800 px-1.5 py-1 text-center text-black\"></td>\n          </tr>\n          <tr>\n            <td colSpan={7} className=\"border border-gray-800 px-1.5 py-1 text-black text-xs font-semibold\">This report is final. Term {term} is now closed and students are promoted to the next class.</td>\n          </tr>\n        </tbody>\n      </table>\n"
if find not in text:
    raise SystemExit('Could not find S5-S6 total points block for status row insertion')
text = text.replace(find, replace, 1)

path.write_text(text, encoding='utf-8')
print('Updated admin reports page for published state and status rows')
