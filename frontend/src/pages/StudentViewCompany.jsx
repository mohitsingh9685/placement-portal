import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import Navbar from "../components/Navbar";
import API from "../api/axios";
import { isGuestUser } from "../utils/guestSession";

const cardClass =
  "rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-lg shadow-slate-200/50";

const labelClass =
  "text-xs font-semibold uppercase tracking-[0.16em] text-slate-500";

const valueClass =
  "mt-2 text-base font-medium text-slate-900";

const StudentViewCompany = () => {
  const { id } = useParams();

  const navigate = useNavigate();
  const isGuest = isGuestUser(JSON.parse(localStorage.getItem("user") || "null"));

  const [loading, setLoading] =
    useState(true);

  const [company, setCompany] =
    useState(null);

  useEffect(() => {
    const fetchCompany = async () => {
      try {
        setLoading(true);

        const res = await API.get(
          isGuest ? `/company/guest/${id}` : `/company/${id}`
        );

        setCompany(
          res.data.company || res.data
        );
      } catch (error) {
        console.log(error);

        alert(
          "Failed to fetch company"
        );
      } finally {
        setLoading(false);
      }
    };

    fetchCompany();
  }, [id]);

  const handleViewJD = async () => {
    try {
      const res = await API.get(
        isGuest ? `/v1/upload/jd/guest/view/${id}` : `/v1/upload/jd/view/${id}`
      );

      const signedUrl =
        res.data?.signedUrl;

      if (!signedUrl) {
        alert("JD not found");
        return;
      }

      window.open(signedUrl, "_blank");
    } catch (error) {
      console.log(error);

      alert("Failed to open JD");
    }
  };

  if (loading) {
    return (
      <div className="premium-shell min-h-screen bg-slate-50">
        <Navbar />

        <div className="mx-auto max-w-5xl px-4 py-10">
          <div className={cardClass}>
            <p className="text-sm text-slate-500">
              Loading company details...
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!company) {
    return (
      <div className="premium-shell min-h-screen bg-slate-50">
        <Navbar />

        <div className="mx-auto max-w-5xl px-4 py-10">
          <div className={cardClass}>
            <p className="text-sm text-red-500">
              Company not found
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="premium-shell min-h-screen bg-gradient-to-b from-slate-50 via-slate-100/60 to-blue-50/30">
      <Navbar />

      <div className="mx-auto max-w-5xl px-4 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">
              Company Details
            </p>

            <h1 className="mt-2 text-3xl font-bold text-slate-900">
              {company.companyName}
            </h1>

            <p className="mt-2 text-slate-600">
              {company.role}
            </p>
          </div>

          <button
            onClick={() =>
              navigate(-1)
            }
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
          >
            Back
          </button>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <div className={cardClass}>
            <p className={labelClass}>
              CTC / Stipend
            </p>

            <p className={valueClass}>
              {company.ctc || "N/A"}
            </p>
          </div>

          <div className={cardClass}>
            <p className={labelClass}>
              Minimum CGPA
            </p>

            <p className={valueClass}>
              {company.minCgpa || "N/A"}
            </p>
          </div>

          <div className={cardClass}>
            <p className={labelClass}>
              Maximum Backlogs
            </p>

            <p className={valueClass}>
              {company.maxBacklogsAllowed ??
                "N/A"}
            </p>
          </div>

          <div className={cardClass}>
            <p className={labelClass}>
              Allowed Branches
            </p>

            <p className={valueClass}>
              {Array.isArray(
                company.allowedBranches
              )
                ? company.allowedBranches.join(
                    ", "
                  )
                : "N/A"}
            </p>
          </div>
        </div>

        <div className={`${cardClass} mt-6`}>
          <p className={labelClass}>
            Description
          </p>

          <p className="mt-3 whitespace-pre-wrap leading-7 text-slate-700">
            {company.description ||
              "No description provided"}
          </p>
        </div>

        <div className={`${cardClass} mt-6`}>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className={labelClass}>
                Job Description
              </p>

              <p className="mt-2 text-sm text-slate-600">
                View official JD uploaded
                by admin
              </p>
            </div>

            {company?.jobDescription
              ?.key ? (
              <button
                type="button"
                onClick={handleViewJD}
                className="rounded-xl bg-[#0a66c2] px-5 py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-[#084d96]"
              >
                View JD
              </button>
            ) : (
              <p className="text-sm text-slate-400">
                No JD uploaded
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudentViewCompany;
