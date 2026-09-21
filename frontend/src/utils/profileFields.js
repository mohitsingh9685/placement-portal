const textFields = ["twelfthStream", "diplomaBranch", "diplomaCollege", "counselorGroup", "githubUrl", "linkedinUrl"];
export function extraProfileState(user = {}) {
  return { tenthPercentage: user.tenthPercentage ?? "", twelfthPercentage: user.twelfthPercentage ?? "",
    entryQualification: user.entryQualification || "TWELFTH", diplomaPercentage: user.diplomaPercentage ?? "", diplomaPassingYear: user.diplomaPassingYear ?? "",
    ...Object.fromEntries(textFields.map(key => [key, user[key] || ""])),
    semesterCgpa: user.semesterCgpa || [], projects: user.projects || [] };
}
export function profileExtrasPayload(form) {
  const diploma = form.entryQualification === "DIPLOMA";
  return { tenthPercentage: form.tenthPercentage === "" ? null : form.tenthPercentage,
    ...Object.fromEntries(textFields.map(key => [key, form[key] || ""])),
    entryQualification: form.entryQualification || "TWELFTH",
    twelfthPercentage: diploma || form.twelfthPercentage === "" ? null : form.twelfthPercentage,
    twelfthStream: diploma ? "" : form.twelfthStream || "",
    diplomaPercentage: !diploma || form.diplomaPercentage === "" ? null : form.diplomaPercentage,
    diplomaPassingYear: !diploma || form.diplomaPassingYear === "" ? null : form.diplomaPassingYear,
    diplomaBranch: diploma ? form.diplomaBranch || "" : "", diplomaCollege: diploma ? form.diplomaCollege || "" : "",
    semesterCgpa: form.semesterCgpa || [], projects: form.projects || [] };
}
