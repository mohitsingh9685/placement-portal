import { useState } from "react";
import { useNavigate } from "react-router-dom";
import API from "../api/axios";
import Navbar from "../components/Navbar";

const inputBase =
  "block w-full rounded-xl border border-slate-200 bg-white pl-11 pr-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm transition-all duration-200 " +
  "focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:shadow-md";

const textareaBase =
  `${inputBase} min-h-[132px] resize-y`;

const sectionCard =
  "rounded-2xl border border-slate-200/80 bg-slate-50/55 p-5 sm:p-6";

function Field({ id, label, children }) {
  return (
    <div className="space-y-2">
      <label
        htmlFor={id}
        className="block text-sm font-medium text-slate-700"
      >
        {label}
      </label>
      {children}
    </div>
  );
}

function Section({ id, title, children }) {
  const titleId = `section-${id}`;
  return (
    <section
      className={`${sectionCard} space-y-5`}
      aria-labelledby={titleId}
    >
      <div className="border-b border-slate-200 pb-3">
        <h3
          id={titleId}
          className="text-sm font-semibold uppercase tracking-wide text-slate-500"
        >
          {title}
        </h3>
      </div>
      <div className="space-y-4 pt-0.5">{children}</div>
    </section>
  );
}

function InputIcon({ children }) {
  return (
    <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
      {children}
    </span>
  );
}

function IconBuilding() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 21h18" />
      <path d="M5 21V7l7-4 7 4v14" />
      <path d="M9 9h.01M15 9h.01M9 13h.01M15 13h.01" />
    </svg>
  );
}

function IconRole() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M8 7h8" />
      <path d="M7 21h10" />
      <path d="M5 7a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2z" />
    </svg>
  );
}

function IconCurrency() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 3v18" />
      <path d="M17 7a4 4 0 0 0-4-2H9a3 3 0 0 0 0 6h6a3 3 0 0 1 0 6h-4a4 4 0 0 1-4-2" />
    </svg>
  );
}

function IconCgpa() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 3l2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.8-5.2 2.8 1-5.8L3.6 9l5.8-.8z" />
    </svg>
  );
}

function IconBacklog() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 6h16M4 12h10M4 18h7" />
    </svg>
  );
}

function IconBranch() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M6 3v12a4 4 0 0 0 4 4h8" />
      <circle cx="6" cy="3" r="2" />
      <circle cx="18" cy="19" r="2" />
      <path d="M10 11h8a4 4 0 0 1 0 8" />
    </svg>
  );
}

function IconDescription() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z" />
      <path d="M8 9h8M8 13h8M8 17h5" />
    </svg>
  );
}

function CreateCompany() {
  const navigate = useNavigate();
  const [compensationType, setCompensationType] = useState("ctc");
  const [jdFile, setJDFile] = useState(null);
  const [uploadingJD, setUploadingJD] = useState(false);

  const [form, setForm] = useState({
    companyName: "",
    role: "",
    ctc: "",
    minCgpa: "",
    allowedBranches: "",
    maxBacklogsAllowed: "",
    description: "",
  });

  const update = (field) => (e) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const handleCreate = async (e) => {
    e.preventDefault();

    const {
      companyName,
      role,
      ctc,
      minCgpa,
      allowedBranches,
      maxBacklogsAllowed,
      description,
    } = form;

    if (
      !companyName ||
      !role ||
      !ctc ||
      !minCgpa ||
      !allowedBranches ||
      !maxBacklogsAllowed ||
      !description
    ) {
      alert("All fields are required");
      return;
    }

    try {
      const companyRes = await API.post("/company", {
        ...form,
        allowedBranches: allowedBranches.split(","),
      });

      const createdCompany = companyRes.data?.company || companyRes.data;

      // OPTIONAL JD UPLOAD
      if (jdFile && createdCompany?._id) {
        try {
          setUploadingJD(true);

          const formData = new FormData();

          formData.append("jd", jdFile);

          await API.post(
            `/v1/upload/jd/${createdCompany._id}`,
            formData,
            {
              headers: {
                "Content-Type": "multipart/form-data",
              },
            }
          );
        } catch (uploadError) {
          console.error(uploadError);
          alert(uploadError.response?.data?.message || "Company created but JD upload failed");
        } finally {
          setUploadingJD(false);
        }
      }

      alert("Company created ✅");
      navigate("/admin");
    } catch (err) {
      console.log(err);
      alert("Error creating company");
    }
  };

  return (
    <div className="premium-shell min-h-screen bg-gradient-to-b from-slate-100 via-slate-50 to-white">
      <Navbar />

      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        <div className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-xl shadow-slate-200/60 animate-[fadeInUp_.45s_ease-out]">
          <div className="border-b border-slate-200 bg-gradient-to-r from-slate-900 to-slate-800 px-6 py-6 text-white sm:px-8">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-200/90">
              Admin Panel
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
              Create company
            </h2>
            <p className="mt-1 text-sm text-slate-200">
              Fill in company details and eligibility criteria.
            </p>
          </div>

          <form onSubmit={handleCreate} className="space-y-6 px-6 py-7 sm:space-y-7 sm:px-8 sm:py-8">
            <Section id="basic-info" title="Basic info">
              <div className="grid gap-4 md:grid-cols-2">
                <Field id="companyName" label="Company name">
                  <div className="relative">
                    <InputIcon>
                      <IconBuilding />
                    </InputIcon>
                    <input
                      id="companyName"
                      required
                      type="text"
                      autoComplete="organization"
                      className={inputBase}
                      value={form.companyName}
                      onChange={update("companyName")}
                    />
                  </div>
                </Field>

                <Field id="role" label="Role / designation">
                  <div className="relative">
                    <InputIcon>
                      <IconRole />
                    </InputIcon>
                    <input
                      id="role"
                      required
                      type="text"
                      placeholder="Role"
                      className={inputBase}
                      value={form.role}
                      onChange={update("role")}
                    />
                  </div>
                </Field>
              </div>

              <Field id="ctc" label={compensationType === "ctc" ? "CTC (per annum)" : "Stipend (per month)"}>
                <div className="space-y-3">
                  <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
                    <button
                      type="button"
                      onClick={() => setCompensationType("ctc")}
                      className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition ${compensationType === "ctc"
                          ? "bg-blue-600 text-white shadow"
                          : "text-slate-600 hover:bg-slate-100"
                        }`}
                    >
                      CTC / annum
                    </button>
                    <button
                      type="button"
                      onClick={() => setCompensationType("stipend")}
                      className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition ${compensationType === "stipend"
                          ? "bg-blue-600 text-white shadow"
                          : "text-slate-600 hover:bg-slate-100"
                        }`}
                    >
                      Stipend / month
                    </button>
                  </div>

                  <div className="relative">
                    <InputIcon>
                      <IconCurrency />
                    </InputIcon>
                    <input
                      id="ctc"
                      required
                      type="number"
                      min="0"
                      step="any"
                      placeholder={compensationType === "ctc" ? "e.g. 1200000" : "e.g. 25000"}
                      className={inputBase}
                      value={form.ctc}
                      onChange={update("ctc")}
                    />
                  </div>
                </div>
              </Field>
            </Section>

            <Section id="eligibility" title="Eligibility">
              <div className="grid gap-4 md:grid-cols-2">
                <Field id="minCgpa" label="Minimum CGPA">
                  <div className="relative">
                    <InputIcon>
                      <IconCgpa />
                    </InputIcon>
                    <input
                      id="minCgpa"
                      required
                      type="number"
                      min="0"
                      max="10"
                      step="0.01"
                      placeholder="7.0"
                      className={inputBase}
                      value={form.minCgpa}
                      onChange={update("minCgpa")}
                    />
                  </div>
                </Field>

                <Field
                  id="maxBacklogsAllowed"
                  label="Maximum backlogs allowed"
                >
                  <div className="relative">
                    <InputIcon>
                      <IconBacklog />
                    </InputIcon>
                    <input
                      id="maxBacklogsAllowed"
                      required
                      type="number"
                      min="0"
                      placeholder="0"
                      className={inputBase}
                      value={form.maxBacklogsAllowed}
                      onChange={update("maxBacklogsAllowed")}
                    />
                  </div>
                </Field>
              </div>

              <Field id="allowedBranches" label="Allowed branches">
                <div className="relative">
                  <InputIcon>
                    <IconBranch />
                  </InputIcon>
                  <input
                    id="allowedBranches"
                    required
                    type="text"
                    placeholder="CSE, IT, ECE"
                    className={inputBase}
                    value={form.allowedBranches}
                    onChange={update("allowedBranches")}
                  />
                </div>
              </Field>
            </Section>

            <Section id="jd-upload" title="Job Description (Optional)">
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700">
                    Upload JD File
                  </label>

                  <p className="mt-1 text-xs text-slate-500">
                    PDF, DOC or DOCX • Max 10MB
                  </p>
                </div>

                <input
                  type="file"
                  accept=".pdf,.doc,.docx"
                  onChange={(e) => setJDFile(e.target.files?.[0] || null)}
                  className="block w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm file:mr-4 file:rounded-lg file:border-0 file:bg-blue-50 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-blue-700 hover:file:bg-blue-100"
                />

                {jdFile && (
                  <p className="text-sm text-emerald-600">
                    Selected file: {jdFile.name}
                  </p>
                )}
              </div>
            </Section>

            <Section id="description-section" title="Description">
              <div className="relative">
                <InputIcon>
                  <IconDescription />
                </InputIcon>
                <textarea
                  id="description"
                  required
                  placeholder="Details"
                  className={textareaBase}
                  value={form.description}
                  onChange={update("description")}
                />
              </div>
            </Section>

            <div className="flex items-center justify-end border-t border-slate-200 pt-6">
              <button
                type="submit"
                className="group w-full rounded-xl bg-blue-600 px-5 py-3.5 text-sm font-semibold text-white shadow-lg shadow-blue-600/25 transition-all duration-200 hover:-translate-y-0.5 hover:bg-blue-700 hover:shadow-xl hover:shadow-blue-600/30 focus:outline-none focus:ring-4 focus:ring-blue-500/25 sm:w-auto sm:min-w-[220px]"
              >
                <span className="inline-flex items-center gap-2">
                  {uploadingJD ? "Uploading JD..." : "Create company"}
                  <svg
                    viewBox="0 0 24 24"
                    className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M5 12h14" />
                    <path d="m13 6 6 6-6 6" />
                  </svg>
                </span>
              </button>
            </div>
          </form>
        </div>
      </div>
      <style>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}

export default CreateCompany;
