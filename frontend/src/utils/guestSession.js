const GUEST_APPLICATIONS_KEY = "guestApplications";

export function isGuestUser(user) {
  return Boolean(user?.isGuest);
}

export function createGuestUser() {
  return {
    id: "guest",
    name: "Guest Student",
    email: "guest@placement-portal.demo",
    role: "student",
    profileCompleted: true,
    isGuest: true,
    // A complete sample profile lets visitors explore every application flow.
    cgpa: 8,
    branch: "CSE",
    activeBacklogs: 1,
    hasActiveBacklog: true,
    totalBacklogs: 1,
  };
}

export function getGuestApplications() {
  try {
    const stored = sessionStorage.getItem(GUEST_APPLICATIONS_KEY);
    const applications = stored ? JSON.parse(stored) : [];
    return Array.isArray(applications) ? applications : [];
  } catch {
    return [];
  }
}

function saveGuestApplications(applications) {
  sessionStorage.setItem(GUEST_APPLICATIONS_KEY, JSON.stringify(applications));
}

export function addGuestApplication(company) {
  const applications = getGuestApplications();

  if (applications.some((application) => application.company?._id === company._id)) {
    return applications;
  }

  const updated = [
    {
      _id: `guest-${company._id}`,
      company,
      status: "APPLIED",
      appliedAt: new Date().toISOString(),
    },
    ...applications,
  ];

  saveGuestApplications(updated);
  return updated;
}

export function removeGuestApplication(applicationId) {
  const updated = getGuestApplications().filter(
    (application) => application._id !== applicationId,
  );
  saveGuestApplications(updated);
  return updated;
}

export function clearGuestSession() {
  sessionStorage.removeItem(GUEST_APPLICATIONS_KEY);
}
