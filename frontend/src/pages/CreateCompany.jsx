import { useState } from "react";
import { useNavigate } from "react-router-dom";
import API from "../api/axios";
import Navbar from "../components/Navbar";

const inputBase =
  "block w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 shadow-sm transition duration-150 " +
  "focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20";

const textareaBase =
  `${inputBase} min-h-[120px] resize-y`;

function Field({ id, label, children }) {
  return (
    <div>
      <label
        htmlFor={id}
        className="mb-2 block text-sm font-medium text-gray-700"
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
      className="space-y-4"
      aria-labelledby={titleId}
    >
      <div className="border-b border-gray-100 pb-1">
        <h3
          id={titleId}
          className="text-xs font-semibold uppercase tracking-wide text-gray-500"
        >
          {title}
        </h3>
      </div>
      <div className="space-y-4 pt-1">{children}</div>
    </section>
  );
}

function CreateCompany() {
  const navigate = useNavigate();

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
      await API.post("/company", {
        ...form,
        allowedBranches: allowedBranches.split(","),
      });

      alert("Company created ✅");
      navigate("/admin");
    } catch (err) {
      console.log(err);
      alert("Error creating company");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100">
      <Navbar />

      <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        <div className="overflow-hidden rounded-2xl border border-gray-200/80 bg-white shadow-lg shadow-gray-200/60">
          <div className="border-b border-gray-100 bg-gray-50/80 px-6 py-6 sm:px-8">
            <h2 className="text-xl font-semibold tracking-tight text-gray-900 sm:text-2xl">
              Create company
            </h2>
          </div>

          <form onSubmit={handleCreate} className="space-y-8 px-6 py-8 sm:px-8">
            <Section id="company-role" title="Company & role">
              <Field id="companyName" label="Company name">
                <input
                  id="companyName"
                  required
                  type="text"
                  autoComplete="organization"
                  className={inputBase}
                  value={form.companyName}
                  onChange={update("companyName")}
                />
              </Field>

              <Field id="role" label="Role / designation">
                <input
                  id="role"
                  required
                  type="text"
                  placeholder="Role"
                  className={inputBase}
                  value={form.role}
                  onChange={update("role")}
                />
              </Field>
            </Section>

            <Section id="compensation" title="Compensation">
              <Field id="ctc" label="CTC / stipend">
                <input
                  id="ctc"
                  required
                  type="number"
                  min="0"
                  step="any"
                  placeholder="Amount"
                  className={inputBase}
                  value={form.ctc}
                  onChange={update("ctc")}
                />
              </Field>
            </Section>

            <Section id="eligibility" title="Eligibility criteria">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field id="minCgpa" label="Minimum CGPA">
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
                </Field>

                <Field
                  id="maxBacklogsAllowed"
                  label="Maximum backlogs allowed"
                >
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
                </Field>
              </div>

              <Field id="allowedBranches" label="Allowed branches">
                <input
                  id="allowedBranches"
                  required
                  type="text"
                  placeholder="CSE, IT, ECE"
                  className={inputBase}
                  value={form.allowedBranches}
                  onChange={update("allowedBranches")}
                />
              </Field>
            </Section>

            <Section id="description-section" title="Description">
              <Field id="description" label="Description">
                <textarea
                  id="description"
                  required
                  placeholder="Details"
                  className={textareaBase}
                  value={form.description}
                  onChange={update("description")}
                />
              </Field>
            </Section>

            <div className="border-t border-gray-100 pt-8">
              <button
                type="submit"
                className="w-full rounded-lg bg-blue-600 px-4 py-3.5 text-sm font-semibold text-white shadow-md shadow-blue-600/25 transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 sm:w-auto sm:min-w-[200px] sm:px-8"
              >
                Create company
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default CreateCompany;
