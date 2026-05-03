import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";

const inputBase =
  "block w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm transition-all duration-200 ease-out " +
  "read-only:cursor-wait read-only:border-slate-200/80 read-only:bg-slate-50 read-only:text-slate-500 " +
  "hover:border-blue-300 hover:shadow-md hover:shadow-blue-100/40 " +
  "focus:-translate-y-0.5 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-500/15";

const textareaBase = `${inputBase} min-h-[130px] resize-y`;

function Field({ id, label, children }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <label
          htmlFor={id}
          className="block text-sm font-semibold tracking-tight text-slate-700"
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
      className="space-y-5 rounded-2xl border border-slate-200/80 bg-gradient-to-b from-white to-slate-50/40 p-5 shadow-sm shadow-slate-200/40 sm:p-6"
      aria-labelledby={titleId}
    >
      <div className="border-b border-slate-100 pb-2">
        <h3
          id={titleId}
          className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500"
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

      alert("Company updated ✅");
      navigate("/admin");
    } catch (err) {
      console.log(err);
      alert("Update failed");
    }
  };

  const editableFieldClass = loading
    ? ""
    : "border-blue-200/70 bg-blue-50/30 ring-1 ring-inset ring-blue-100/80";

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
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-slate-100/60 to-blue-50/30">
      <Navbar />

      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        <div className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white/95 shadow-xl shadow-slate-200/70 backdrop-blur-sm">
          <div className="border-b border-slate-100 bg-gradient-to-r from-blue-50/80 via-slate-50 to-blue-50/30 px-6 py-7 sm:px-8">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">
              Admin
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 sm:text-[1.8rem]">
              Edit company
            </h2>
            <p className="mt-2 max-w-2xl text-sm text-slate-600">
              Review and update company details before saving changes.
            </p>
            {loading && (
              <p className="mt-2 max-w-xl text-sm text-slate-600">
                Loading saved details…
              </p>
            )}
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
                    className={`${inputBase} ${
                      loading ? "cursor-wait" : editableFieldClass
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

            <div className="flex flex-col gap-3 border-t border-slate-100 pt-7 sm:flex-row sm:items-center sm:justify-end sm:gap-4">
              <button
                type="button"
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-400 hover:bg-slate-50 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 sm:order-none sm:w-auto sm:min-w-[140px]"
                onClick={() => navigate("/admin")}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="group relative w-full overflow-hidden rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-600/30 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-blue-600/35 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 active:translate-y-0 disabled:pointer-events-none disabled:opacity-50 sm:w-auto sm:min-w-[220px]"
              >
                <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
                <span className="relative inline-flex items-center justify-center gap-2">
                  Save and update
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
