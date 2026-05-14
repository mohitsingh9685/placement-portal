import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import API from "../api/axios";

const inputBase =
  "block w-full rounded-xl border border-white/10 bg-slate-950/45 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 shadow-sm shadow-black/20 transition-all duration-300 ease-out " +
  "read-only:cursor-wait read-only:border-white/10 read-only:bg-slate-900/55 read-only:text-slate-500 " +
  "hover:-translate-y-0.5 hover:border-cyan-300/45 hover:bg-slate-950/60 hover:shadow-lg hover:shadow-cyan-500/10 " +
  "focus:-translate-y-0.5 focus:border-cyan-300/80 focus:bg-slate-950/70 focus:outline-none focus:ring-4 focus:ring-cyan-400/15";

const textareaBase = `${inputBase} min-h-[130px] resize-y`;

function Field({ id, label, children }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <label
          htmlFor={id}
          className="block text-sm font-semibold tracking-tight text-slate-200"
        >
          {label}
        </label>
      </div>
      {children}
    </div>
  );
}

function Section({ sectionId, title, children }) {
  const titleId = `section-${sectionId}`;
  return (
    <section
      className="premium-card group space-y-5 rounded-2xl p-5 transition-all duration-300 hover:-translate-y-1 hover:border-cyan-300/35 hover:shadow-2xl hover:shadow-cyan-950/35 sm:p-6"
      aria-labelledby={titleId}
    >
      <div className="border-b border-white/10 pb-2">
        <h3
          id={titleId}
          className="bg-gradient-to-r from-cyan-200 via-indigo-200 to-pink-200 bg-clip-text text-xs font-semibold uppercase tracking-[0.16em] text-transparent"
        >
          {title}
        </h3>
      </div>
      <div className="space-y-5 pt-1">{children}</div>
    </section>
  );
}

const EditCompany = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [compensationUnit, setCompensationUnit] = useState("per-annum");
  const [jdFile, setJDFile] = useState(null);
  const [uploadingJD, setUploadingJD] = useState(false);

  const [formData, setFormData] = useState({
    companyName: "",
    role: "",
    ctc: "",
    minCgpa: "",
    branches: "",
    maxBacklogs: "",
    description: "",
  });

  useEffect(() => {
    let cancelled = false;

    const fetchCompany = async () => {
      setLoading(true);
      try {
        const res = await fetch(`http://localhost:9000/api/company/${id}`, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        });
        const dataJson = await res.json();
        const data = dataJson.company || dataJson;
        console.log("Fetched company:", data);

        if (!cancelled) {
          const ctcValue = data.ctc ?? "";
          const inferredCompensationUnit =
            typeof ctcValue === "string" &&
              /(month|monthly|\/month|per month)/i.test(ctcValue)
              ? "per-month"
              : "per-annum";

          setCompensationUnit(inferredCompensationUnit);
          setFormData({
            companyName: data.companyName ?? "",
            role: data.role ?? "",
            ctc: ctcValue,
            minCgpa: data.minCgpa ?? "",
            branches: Array.isArray(data.allowedBranches)
              ? data.allowedBranches.join(", ")
              : data.allowedBranches ?? "",
            maxBacklogs: data.maxBacklogsAllowed ?? "",
            description: data.description ?? "",
          });
          setJDFile(null);
        }
      } catch (err) {
        console.log(err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchCompany();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleFocus = (e) => {
    if (!loading) {
      e.target.select();
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      await fetch(`http://localhost:9000/api/company/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({
          ...formData,
          maxBacklogsAllowed: Number(formData.maxBacklogs),
          allowedBranches: formData.branches
            .split(",")
            .map((b) => b.trim().toUpperCase())
            .filter(Boolean),
        }),
      });

      // OPTIONAL JD UPDATE
      if (jdFile) {
        try {
          setUploadingJD(true);

          const formDataObj = new FormData();

          formDataObj.append("jd", jdFile);

          await API.post(
            `/v1/upload/jd/${id}`,
            formDataObj,
            {
              headers: {
                "Content-Type": "multipart/form-data",
              },
            }
          );
        } catch (uploadError) {
          console.error(uploadError);
          alert("Company updated but JD upload failed");
        } finally {
          setUploadingJD(false);
        }
      }

      alert("Company updated ✅");
      navigate("/admin");
    } catch (err) {
      console.log(err);
      alert("Update failed");
    }
  };

  const editableFieldClass = loading
    ? ""
    : "border-cyan-300/35 bg-cyan-950/15 ring-1 ring-inset ring-cyan-300/15";

  const inputProps = loading
    ? {
      readOnly: true,
      className: `${inputBase} cursor-wait`,
      "aria-busy": true,
    }
    : {
      className: `${inputBase} ${editableFieldClass}`,
    };

  const textareaProps = loading
    ? {
      readOnly: true,
      className: `${textareaBase} cursor-wait`,
      "aria-busy": true,
    }
    : {
      className: `${textareaBase} ${editableFieldClass}`,
    };

  return (
    <div className="premium-shell min-h-screen bg-gradient-to-b from-slate-50 via-slate-100/60 to-blue-50/30">
      <Navbar />

      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        <div className="premium-glow-border premium-panel overflow-hidden rounded-3xl border border-white/10 bg-slate-950/55 shadow-2xl shadow-black/40 backdrop-blur-2xl">
          <div className="relative overflow-hidden border-b border-white/10 px-6 py-7 sm:px-8">
            <div className="absolute inset-0 bg-[linear-gradient(120deg,rgba(34,211,238,0.16),transparent_36%,rgba(168,85,247,0.18)),radial-gradient(circle_at_85%_0%,rgba(236,72,153,0.18),transparent_34rem)]" />
            <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-cyan-300/70 to-transparent" />
            <div className="relative grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-200/90">
                  Admin Console
                </p>
                <h2 className="mt-2 bg-gradient-to-r from-white via-cyan-100 to-violet-200 bg-clip-text text-3xl font-bold tracking-tight text-transparent sm:text-4xl">
                  Edit company
                </h2>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
                  Refine company details, eligibility, compensation, and JD assets with the same premium admin workspace.
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 shadow-lg shadow-black/20">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                  Status
                </p>
                <p className="mt-1 text-sm font-semibold text-cyan-100">
                  {loading ? "Syncing details..." : "Ready to update"}
                </p>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-7 px-6 py-8 sm:px-8 sm:py-9">
            <Section sectionId="company-role" title="Company & role">
              <Field id="companyName" label="Company name">
                <input
                  id="companyName"
                  name="companyName"
                  required
                  type="text"
                  autoComplete="organization"
                  {...inputProps}
                  value={formData.companyName}
                  onChange={handleChange}
                  onFocus={handleFocus}
                />
              </Field>

              <Field id="role" label="Role / designation">
                <input
                  id="role"
                  name="role"
                  required
                  type="text"
                  placeholder="Role"
                  {...inputProps}
                  value={formData.role}
                  onChange={handleChange}
                  onFocus={handleFocus}
                />
              </Field>
            </Section>

            <Section sectionId="compensation" title="Compensation">
              <Field id="ctc" label="CTC / stipend">
                <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_200px]">
                  <input
                    id="ctc"
                    name="ctc"
                    required
                    type="text"
                    inputMode="decimal"
                    placeholder={
                      compensationUnit === "per-month"
                        ? "Stipend amount"
                        : "Annual CTC amount"
                    }
                    {...inputProps}
                    value={formData.ctc}
                    onChange={handleChange}
                    onFocus={handleFocus}
                  />
                  <select
                    value={compensationUnit}
                    onChange={(e) => setCompensationUnit(e.target.value)}
                    disabled={loading}
                    className={`${inputBase} ${loading ? "cursor-wait" : editableFieldClass
                      }`}
                    aria-label="Compensation unit"
                  >
                    <option value="per-annum">CTC (per annum)</option>
                    <option value="per-month">Stipend (per month)</option>
                  </select>
                </div>
              </Field>
            </Section>

            <Section sectionId="eligibility" title="Eligibility criteria">
              <div className="grid gap-5 sm:grid-cols-2">
                <Field id="minCgpa" label="Minimum CGPA">
                  <input
                    id="minCgpa"
                    name="minCgpa"
                    required
                    type="text"
                    inputMode="decimal"
                    placeholder="e.g. 7.0"
                    {...inputProps}
                    value={formData.minCgpa}
                    onChange={handleChange}
                    onFocus={handleFocus}
                  />
                </Field>

                <Field id="maxBacklogs" label="Maximum backlogs allowed">
                  <input
                    id="maxBacklogs"
                    name="maxBacklogs"
                    required
                    type="text"
                    inputMode="numeric"
                    placeholder="0"
                    {...inputProps}
                    value={formData.maxBacklogs}
                    onChange={handleChange}
                    onFocus={handleFocus}
                  />
                </Field>
              </div>

              <Field id="branches" label="Allowed branches">
                <input
                  id="branches"
                  name="branches"
                  required
                  type="text"
                  placeholder="CSE, IT, ECE — comma-separated"
                  {...inputProps}
                  value={formData.branches}
                  onChange={handleChange}
                  onFocus={handleFocus}
                />
              </Field>
            </Section>

            <Section sectionId="jd-upload" title="Job Description (Optional)">
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-slate-200">
                    Upload / Replace JD File
                  </label>

                  <p className="mt-1 text-xs text-slate-400">
                    PDF, DOC or DOCX • Max 10MB
                  </p>
                </div>

                <input
                  type="file"
                  accept=".pdf,.doc,.docx"
                  onChange={(e) => setJDFile(e.target.files?.[0] || null)}
                  className="block w-full rounded-xl border border-white/10 bg-slate-950/45 px-4 py-3 text-sm text-slate-300 shadow-sm file:mr-4 file:rounded-lg file:border-0 file:bg-cyan-400/15 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-cyan-100 hover:file:bg-cyan-400/25"
                />

                {jdFile ? (
                  <p className="text-sm text-emerald-600">
                    Selected file: {jdFile.name}
                  </p>
                ) : (
                  <p className="text-xs text-slate-400">
                    Leave empty to keep existing JD.
                  </p>
                )}
              </div>
            </Section>

            <Section sectionId="description-section" title="Description">
              <Field id="description" label="Description">
                <textarea
                  id="description"
                  name="description"
                  required
                  placeholder="Posting details"
                  {...textareaProps}
                  value={formData.description}
                  onChange={handleChange}
                  onFocus={handleFocus}
                />
              </Field>
            </Section>

            <div className="flex flex-col gap-3 border-t border-white/10 pt-7 sm:flex-row sm:items-center sm:justify-end sm:gap-4">
              <button
                type="button"
                className="w-full rounded-xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm font-semibold text-slate-200 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/[0.1] hover:shadow-lg hover:shadow-black/25 focus:outline-none focus:ring-2 focus:ring-cyan-300/50 sm:order-none sm:w-auto sm:min-w-[140px]"
                onClick={() => navigate("/admin")}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="group relative w-full overflow-hidden rounded-xl bg-gradient-to-r from-cyan-500 via-indigo-500 to-fuchsia-500 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-cyan-500/25 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-indigo-500/35 focus:outline-none focus:ring-2 focus:ring-cyan-300/70 active:translate-y-0 disabled:pointer-events-none disabled:opacity-50 sm:w-auto sm:min-w-[220px]"
              >
                <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
                <span className="relative inline-flex items-center justify-center gap-2">
                  {uploadingJD ? "Uploading JD..." : "Save and update"}
                </span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default EditCompany;
