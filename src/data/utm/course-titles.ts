const COURSE_TITLES: Readonly<Record<string, string>> = {
  CSC110Y5: "Foundations of Computer Science 1",
  CSC111H5: "Foundations of Computer Science 2",
  ISP100H5: "Writing for University and Beyond",
  UTM020H5: "LAUNCH: Science, Mathematics and Psychology",
};

export function resolveCourseTitle(courseCode: string, exportedTitle: string): string {
  const normalizedCode = courseCode.trim().toUpperCase();
  const normalizedExportedTitle = exportedTitle.trim();

  return (COURSE_TITLES[normalizedCode] ?? normalizedExportedTitle) || normalizedCode;
}
