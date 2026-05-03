import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";

const inputBase =
  "block w-full rounded-lg border border-gray-300 bg-gray-50/80 px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 shadow-sm transition duration-150 " +
  "read-only:bg-gray-50 read-only:text-gray-500 " +
  "focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20";

const textareaBase = `${inputBase} min-h-[120px] resize-y`;

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

function Section({ sectionId, title, children }) {
  const titleId = `section-${sectionId}`;
  return (
    <section className="space-y-4" aria-labelledby={titleId}>
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

const EditCompany = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);

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
        const res = await fetch(`http://localhost:8000/api/company/${id}`, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        });
        const dataJson = await res.json();
        const data = dataJson.company || dataJson;
        console.log("Fetched company:", data);

        if (!cancelled) {
          setFormData({
            companyName: data.companyName ?? "",
            role: data.role ?? "",
            ctc: data.ctc ?? "",
            minCgpa: data.minCgpa ?? "",
            branches: Array.isArray(data.allowedBranches)
              ? data.allowedBranches.join(", ")
              : data.allowedBranches ?? "",
            maxBacklogs: data.maxBacklogs ?? "",
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

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      await fetch(`http://localhost:8000/api/company/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({
          ...formData,
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

  const inputProps = loading
    ? {
        readOnly: true,
        className: `${inputBase} cursor-wait`,
        "aria-busy": true,
      }
    : {
        className: inputBase,
      };

  const textareaProps = loading
    ? {
        readOnly: true,
        className: `${textareaBase} cursor-wait`,
        "aria-busy": true,
      }
    : {
        className: textareaBase,
      };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100">
      <Navbar />

      <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        <div className="overflow-hidden rounded-2xl border border-gray-200/80 bg-white shadow-lg shadow-gray-200/60">
          <div className="border-b border-gray-100 bg-gray-50/80 px-6 py-6 sm:px-8">
            <p className="text-xs font-medium uppercase tracking-wide text-blue-600">
              Admin
            </p>
            <h2 className="mt-1 text-xl font-semibold tracking-tight text-gray-900 sm:text-2xl">
              Edit company
            </h2>
            {loading ? (
              <p className="mt-2 max-w-xl text-sm text-gray-600">
                Loading saved details…
              </p>
            ) : null}
          </div>

          <form onSubmit={handleSubmit} className="space-y-8 px-6 py-8 sm:px-8">
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
                />
              </Field>
            </Section>

            <Section sectionId="compensation" title="Compensation">
              <Field id="ctc" label="CTC / stipend">
                <input
                  id="ctc"
                  name="ctc"
                  required
                  type="text"
                  inputMode="decimal"
                  placeholder="Amount"
                  {...inputProps}
                  value={formData.ctc}
                  onChange={handleChange}
                />
              </Field>
            </Section>

            <Section sectionId="eligibility" title="Eligibility criteria">
              <div className="grid gap-4 sm:grid-cols-2">
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
                />
              </Field>
            </Section>

            <div className="flex flex-col gap-3 border-t border-gray-100 pt-8 sm:flex-row sm:justify-end sm:gap-4">
              <button
                type="button"
                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 sm:order-none sm:w-auto sm:min-w-[140px]"
                onClick={() => navigate("/admin")}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-md shadow-blue-600/25 transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 sm:w-auto sm:min-w-[200px]"
              >
                Update company
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default EditCompany;
