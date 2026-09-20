const textFields = ["twelfthStream", "counselorGroup", "githubUrl", "linkedinUrl"];
export function extraProfileState(user = {}) {
  return { tenthPercentage: user.tenthPercentage ?? "", twelfthPercentage: user.twelfthPercentage ?? "",
    ...Object.fromEntries(textFields.map(key => [key, user[key] || ""])),
    semesterCgpa: user.semesterCgpa || [], projects: user.projects || [] };
}
export function profileExtrasPayload(form) {
  return { tenthPercentage: form.tenthPercentage === "" ? null : form.tenthPercentage,
    twelfthPercentage: form.twelfthPercentage === "" ? null : form.twelfthPercentage,
    ...Object.fromEntries(textFields.map(key => [key, form[key] || ""])),
    semesterCgpa: form.semesterCgpa || [], projects: form.projects || [] };
}
