import { initializeApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import {
  browserLocalPersistence,
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
  sendPasswordResetEmail,
  setPersistence,
  signInWithEmailAndPassword,
  signOut,
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  getFirestore,
  onSnapshot,
  runTransaction,
  writeBatch,
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";
import firebaseConfig from "./firebase-config.js";

const state = {
  students: [],
  view: "overview",
  formMode: "create",
  editingStudent: null,
  editingSubject: null,
  user: null,
  unsubscribeStudents: null,
};

const LEGACY_STORAGE_KEY = "campus.student-records.v1";
const byId = (id) => document.getElementById(id);
const formDialog = byId("form-dialog");
const detailDialog = byId("detail-dialog");
const studentForm = byId("student-form");
const authScreen = byId("auth-screen");
const appShell = document.querySelector(".app-shell");
const authForm = byId("auth-form");
let authMode = "login";
let auth;
let database;

function initials(name) {
  return name.split(/\s+/).slice(0, 2).map((part) => part[0] || "").join("").toUpperCase();
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]);
}

function formatPercent(value) {
  return `${Number(value || 0).toFixed(1)}%`;
}

function normalizeName(value) {
  return String(value).trim().replace(/\s+/g, " ").replace(/\b\p{L}/gu, (letter) => letter.toLocaleUpperCase());
}

function studentDocumentId(name) {
  return encodeURIComponent(normalizeName(name).toLocaleLowerCase());
}

function studentCollection(user = state.user) {
  return collection(database, "users", user.uid, "students");
}

function studentReference(name, user = state.user) {
  return doc(database, "users", user.uid, "students", studentDocumentId(name));
}

function buildStudent(name, subjects) {
  const cleanedSubjects = subjects.map((subject) => ({
    name: normalizeName(subject.name),
    total: Number(subject.total),
    obtained: Number(subject.obtained),
    percentage: Number(subject.total) ? Number(subject.obtained) / Number(subject.total) * 100 : 0,
  }));
  const total = cleanedSubjects.reduce((sum, subject) => sum + subject.total, 0);
  const obtained = cleanedSubjects.reduce((sum, subject) => sum + subject.obtained, 0);
  return {
    name: normalizeName(name),
    subjects: cleanedSubjects,
    percentage: total ? obtained / total * 100 : 0,
    subject_count: cleanedSubjects.length,
  };
}

function loadStudents() {
  try {
    const stored = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (stored === null) return [];
    const parsed = JSON.parse(stored);
    if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.students)) {
      throw new Error("The saved student data has an unsupported format.");
    }
    return parsed.students.map((student) => {
      if (!student || typeof student.name !== "string" || !Array.isArray(student.subjects)) {
        throw new Error("The saved student data is invalid.");
      }
      const subjects = student.subjects.map((subject) => {
        if (!subject || typeof subject.name !== "string") {
          throw new Error("The saved subject data is invalid.");
        }
        const total = Number(subject.total);
        const obtained = Number(subject.obtained);
        if (
          !Number.isInteger(total) || total < 1 ||
          !Number.isInteger(obtained) || obtained < 0 || obtained > total
        ) {
          throw new Error("The saved subject marks are invalid.");
        }
        return { name: subject.name, total, obtained };
      });
      return buildStudent(student.name, subjects);
    });
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error("Saved student data could not be read. Browser storage may be damaged.");
    }
    if (error instanceof DOMException && error.name === "SecurityError") {
      throw new Error("Browser storage is blocked. Enable local storage for this page.");
    }
    throw error;
  }
}

function toast(message, isError = false) {
  const item = document.createElement("div");
  item.className = `toast${isError ? " error" : ""}`;
  item.textContent = message;
  byId("toast-region").append(item);
  window.setTimeout(() => item.remove(), 3500);
}

function setView(view) {
  state.view = view;
  document.querySelectorAll(".view-panel").forEach((panel) => panel.classList.add("hidden"));
  byId(`${view}-view`).classList.remove("hidden");
  document.querySelectorAll(".nav-link").forEach((button) => {
    button.classList.toggle("active", button.dataset.view === view);
  });
  const labels = { overview: "Overview", students: "Students", performance: "Performance" };
  byId("breadcrumb-current").textContent = labels[view];
  if (view === "students") renderStudentsTable();
  if (view === "performance") renderPerformance();
}

function rowMarkup(student) {
  const name = escapeHtml(student.name);
  const score = Math.max(0, Math.min(100, Number(student.percentage) || 0));
  const status = score >= 50;
  const detailName = encodeURIComponent(student.name);
  return `<tr>
    <td><div class="student-cell"><span class="avatar student-avatar">${escapeHtml(initials(student.name))}</span><span><strong>${name}</strong><small>${student.subject_count} ${student.subject_count === 1 ? "subject" : "subjects"} recorded</small></span></div></td>
    <td><span class="subject-count">${student.subject_count} ${student.subject_count === 1 ? "subject" : "subjects"}</span></td>
    <td class="score-cell"><div class="score-line"><strong>${formatPercent(score)}</strong><span class="score-track"><i class="score-fill${status ? "" : " low"}" style="width:${score}%"></i></span></div></td>
    <td><span class="status-badge${status ? "" : " support"}">${status ? "On track" : "Needs support"}</span></td>
    <td><button class="row-action" data-detail="${detailName}" aria-label="View ${name} details">···</button></td>
  </tr>`;
}

function renderOverview() {
  const students = state.students;
  const subjectCount = students.reduce((sum, student) => sum + student.subject_count, 0);
  const totalMarks = students.reduce((sum, student) => sum + student.subjects.reduce((subjectSum, subject) => subjectSum + subject.total, 0), 0);
  const obtainedMarks = students.reduce((sum, student) => sum + student.subjects.reduce((subjectSum, subject) => subjectSum + subject.obtained, 0), 0);
  const average = totalMarks ? obtainedMarks / totalMarks * 100 : 0;
  const top = students.reduce((best, student) => !best || student.percentage > best.percentage ? student : best, null);

  byId("stat-students").textContent = students.length;
  byId("stat-subjects").textContent = subjectCount;
  byId("stat-average").textContent = average.toFixed(1);
  byId("stat-top-student").textContent = top?.name || "—";
  byId("stat-top-score").textContent = top ? `${formatPercent(top.percentage)} overall score` : "Add records to get started";
  byId("stat-student-note").textContent = `${students.length} ${students.length === 1 ? "student" : "students"} on your roster`;
  byId("nav-count").textContent = students.length;
  byId("overview-empty").classList.toggle("hidden", students.length > 0);
  byId("overview-table").classList.toggle("hidden", students.length === 0);
  byId("overview-table").innerHTML = students.slice(0, 5).map(rowMarkup).join("");
}

function renderStudentsTable() {
  const query = byId("student-search").value.trim().toLocaleLowerCase();
  const status = byId("status-filter").value;
  const sort = byId("sort-select").value;
  const filtered = state.students.filter((student) => {
    const matchesName = student.name.toLocaleLowerCase().includes(query);
    const matchesStatus = status === "all" || (status === "on-track" ? student.percentage >= 50 : student.percentage < 50);
    return matchesName && matchesStatus;
  });
  if (sort === "score-desc") filtered.sort((a, b) => b.percentage - a.percentage || a.name.localeCompare(b.name));
  else if (sort === "score-asc") filtered.sort((a, b) => a.percentage - b.percentage || a.name.localeCompare(b.name));
  else filtered.sort((a, b) => a.name.localeCompare(b.name));

  byId("students-table").innerHTML = filtered.map(rowMarkup).join("");
  byId("students-empty").classList.toggle("hidden", filtered.length > 0);
  byId("students-table").classList.toggle("hidden", filtered.length === 0);
  byId("student-result-count").textContent = `Showing ${filtered.length} of ${state.students.length} ${state.students.length === 1 ? "student" : "students"}`;
  byId("students-empty-title").textContent = query || status !== "all" ? "No matching students" : "No students found";
  byId("students-empty-copy").textContent = query || status !== "all" ? "Try changing your search or filter." : "Add a student to start building your class roster.";
}

function renderPerformance() {
  const students = [...state.students].sort((a, b) => b.percentage - a.percentage || a.name.localeCompare(b.name));
  const totalMarks = students.reduce((sum, student) => sum + student.subjects.reduce((inner, subject) => inner + subject.total, 0), 0);
  const obtainedMarks = students.reduce((sum, student) => sum + student.subjects.reduce((inner, subject) => inner + subject.obtained, 0), 0);
  byId("performance-average").textContent = (totalMarks ? obtainedMarks / totalMarks * 100 : 0).toFixed(1);
  byId("on-track-count").textContent = students.filter((student) => student.percentage >= 50).length;
  byId("support-count").textContent = students.filter((student) => student.percentage < 50).length;
  byId("performance-student-count").textContent = students.length;
  byId("chart-empty").classList.toggle("hidden", students.length > 0);
  byId("performance-chart").classList.toggle("hidden", students.length === 0);
  byId("performance-chart").innerHTML = students.map((student) => {
    const percentage = Math.max(0, Math.min(100, Number(student.percentage) || 0));
    return `<div class="chart-row"><span class="chart-name">${escapeHtml(student.name)}</span><span class="chart-track"><i class="chart-fill" style="width:${percentage}%"></i></span><span class="chart-value">${formatPercent(percentage)}</span></div>`;
  }).join("");
}

function refreshStudents(students) {
  state.students = students;
  renderOverview();
  if (state.view === "students") renderStudentsTable();
  if (state.view === "performance") renderPerformance();
}

async function syncStudentsOnce() {
  const snapshot = await getDocs(studentCollection());
  refreshStudents(snapshot.docs.map((entry) => buildStudent(
    entry.data().name,
    Array.isArray(entry.data().subjects) ? entry.data().subjects : [],
  )).sort((a, b) => a.name.localeCompare(b.name)));
}

function showAuthError(message) {
  const error = byId("auth-error");
  error.textContent = message;
  error.classList.remove("hidden");
}

function firebaseErrorMessage(error) {
  const messages = {
    "auth/email-already-in-use": "An account with this email already exists. Sign in instead.",
    "auth/invalid-email": "Enter a valid email address.",
    "auth/invalid-credential": "Email or password is incorrect.",
    "auth/weak-password": "Choose a stronger password with at least 8 characters.",
    "auth/too-many-requests": "Too many attempts. Wait a little and try again.",
    "auth/network-request-failed": "Network connection failed. Check your internet and try again.",
    "auth/operation-not-allowed": "Email/password sign-in is not enabled for this Firebase project.",
    "auth/unauthorized-domain": "This website address is not authorized in Firebase Authentication settings.",
    "permission-denied": "Firestore denied access. Check that the provided Firestore security rules are installed.",
    "unavailable": "Could not connect to Firebase. Check your internet connection and try again.",
  };
  return messages[error.code] || error.message || "Firebase could not complete the request.";
}

function setAuthMode(mode) {
  authMode = mode;
  const signup = mode === "signup";
  byId("auth-title").innerHTML = signup
    ? 'Create your account<span class="heading-dot">.</span>'
    : 'Welcome back<span class="heading-dot">.</span>';
  byId("auth-description").textContent = signup
    ? "Create an account to keep your student records synced."
    : "Sign in to access your student records.";
  byId("auth-submit").textContent = signup ? "Create account" : "Sign in";
  byId("account-password").autocomplete = signup ? "new-password" : "current-password";
  byId("switch-copy").textContent = signup ? "Already have an account?" : "New to Campus?";
  byId("switch-mode").textContent = signup ? "Sign in" : "Create an account";
  byId("reset-password").classList.toggle("hidden", signup);
  byId("auth-error").classList.add("hidden");
}

async function importLegacyRecords(user) {
  let legacyStudents;
  try {
    legacyStudents = loadStudents();
  } catch (error) {
    showAuthError(error.message);
    return;
  }
  if (!legacyStudents.length) return;

  const promptedKey = `campus.import-prompted.${user.uid}`;
  try {
    if (localStorage.getItem(promptedKey)) return;
  } catch {
    toast("Browser storage is unavailable; existing local records were not imported.", true);
    return;
  }
  const existing = await getDocs(studentCollection(user));
  if (existing.empty) {
    const shouldImport = window.confirm(
      `Import ${legacyStudents.length} student record(s) saved in this browser into ${user.email}? The local copy will remain here.`,
    );
    if (shouldImport) {
      for (let start = 0; start < legacyStudents.length; start += 450) {
        const batch = writeBatch(database);
        legacyStudents.slice(start, start + 450).forEach((student) => {
          batch.set(studentReference(student.name, user), {
            name: student.name,
            subjects: student.subjects.map(({ name, total, obtained }) => ({ name, total, obtained })),
          });
        });
        await batch.commit();
      }
    }
  }
  try {
    localStorage.setItem(promptedKey, "true");
  } catch {
    toast("Your cloud account works, but this browser cannot remember the local import choice.", true);
  }
}

async function writeStudentRecord(payload) {
  const studentName = normalizeName(payload.name);
  const subjectName = normalizeName(payload.subject);
  const total = Number(payload.total);
  const obtained = Number(payload.obtained);

  if (state.formMode === "create") {
    if (!studentName) throw new Error("Student name is required.");
    if (!subjectName) throw new Error("Subject name is required.");
    const reference = studentReference(studentName);
    await runTransaction(database, async (transaction) => {
      const current = await transaction.get(reference);
      if (current.exists()) throw new Error(`${studentName} already exists in your account.`);
      transaction.set(reference, {
        name: studentName,
        subjects: [{ name: subjectName, total, obtained }],
      });
    });
    return `${studentName} was added to your account.`;
  }

  const student = state.editingStudent;
  const reference = studentReference(student.name);
  let successMessage;
  await runTransaction(database, async (transaction) => {
    const current = await transaction.get(reference);
    if (!current.exists()) throw new Error("This student record no longer exists.");
    const record = current.data();
    const subjects = Array.isArray(record.subjects) ? record.subjects : [];
    if (state.formMode === "subject") {
      if (subjects.some((subject) => subject.name.toLocaleLowerCase() === subjectName.toLocaleLowerCase())) {
        throw new Error("That subject already exists for this student.");
      }
      subjects.push({ name: subjectName, total, obtained });
      successMessage = `${subjectName} was added for ${student.name}.`;
    } else {
      const subjectIndex = subjects.findIndex((entry) => entry.name === state.editingSubject.name);
      if (subjectIndex < 0) throw new Error("This subject no longer exists.");
      subjects[subjectIndex] = { ...subjects[subjectIndex], total, obtained };
      successMessage = `${state.editingSubject.name} marks were updated.`;
    }
    transaction.update(reference, { subjects });
  });
  return successMessage;
}

function openStudentForm(mode, student = null, subject = null) {
  state.formMode = mode;
  state.editingStudent = student;
  state.editingSubject = subject;
  studentForm.reset();
  byId("form-error").classList.add("hidden");
  byId("name-field").classList.toggle("hidden", mode !== "create");
  byId("student-name").disabled = mode !== "create";
  byId("student-name").value = student?.name || "";
  byId("subject-name").value = subject?.name || "";
  byId("total-marks").value = subject?.total ?? "";
  byId("obtained-marks").value = subject?.obtained ?? "";

  let labels;
  if (mode === "create") {
    labels = ["NEW RECORD", "Add a student", "Create a profile and enter their first subject.", "Save student"];
  } else if (mode === "subject") {
    labels = ["NEW SUBJECT", `Add a subject for ${student.name}`, "Enter the subject and marks to extend this student’s record.", "Save subject"];
  } else {
    labels = ["UPDATE MARKS", `Edit ${subject.name}`, `Update ${student.name}’s marks for ${subject.name}.`, "Save changes"];
  }
  byId("form-eyebrow").textContent = labels[0];
  byId("form-title").textContent = labels[1];
  byId("form-description").textContent = labels[2];
  byId("form-submit").textContent = labels[3];
  detailDialog.close();
  formDialog.showModal();
  const focusTarget = mode === "create" ? byId("student-name") : byId("subject-name");
  window.setTimeout(() => focusTarget.focus(), 0);
}

function renderDetail(student) {
  const score = Math.max(0, Math.min(100, Number(student.percentage) || 0));
  const name = escapeHtml(student.name);
  const subjects = student.subjects.length
    ? student.subjects.map((subject) => `<div class="detail-subject"><div><strong>${escapeHtml(subject.name)}</strong><small>${subject.obtained} of ${subject.total} marks · ${formatPercent(subject.percentage)}</small></div><button class="subject-edit" data-edit-subject="${encodeURIComponent(subject.name)}">Edit marks</button></div>`).join("")
    : `<div class="empty-state"><strong>No subjects yet</strong><p>Add a subject to start tracking marks.</p></div>`;
  byId("detail-content").innerHTML = `
    <div class="dialog-heading"><div><div class="eyebrow">STUDENT PROFILE</div><div class="detail-heading"><span class="detail-person"><span class="avatar detail-avatar">${escapeHtml(initials(student.name))}</span><span><h2>${name}</h2><p>${student.subject_count} recorded ${student.subject_count === 1 ? "subject" : "subjects"}</p></span></span></div></div><button class="dialog-close" data-close-detail aria-label="Close dialog">×</button></div>
    <div class="detail-score"><div class="detail-score-row"><span>Overall performance</span><strong>${formatPercent(score)}</strong></div><span class="score-track" style="display:block;width:100%;height:7px"><i class="score-fill${score >= 50 ? "" : " low"}" style="display:block;width:${score}%;height:100%"></i></span></div>
    <div class="panel-heading" style="padding:0"><div><h2>Subjects &amp; marks</h2><p>Update marks or add another subject</p></div></div>
    <div class="detail-subject-list">${subjects}</div>
    <div class="detail-actions"><button class="button button-primary" data-add-subject>Add subject</button><button class="button button-danger" data-delete-student>Delete student</button></div>`;
  detailDialog.showModal();
}

function findStudent(name) {
  return state.students.find((student) => student.name === name);
}

async function deleteStudent(student) {
  if (!window.confirm(`Delete ${student.name} and all of their subjects? This cannot be undone.`)) return;
  try {
    await deleteDoc(studentReference(student.name));
    detailDialog.close();
    toast(`${student.name} was deleted.`);
  } catch (error) {
    toast(error.message, true);
  }
}

studentForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const payload = {
    name: byId("student-name").value.trim(),
    subject: byId("subject-name").value.trim(),
    total: byId("total-marks").value,
    obtained: byId("obtained-marks").value,
  };
  const button = byId("form-submit");
  button.disabled = true;
  byId("form-error").classList.add("hidden");
  try {
    const total = Number(payload.total);
    const obtained = Number(payload.obtained);
    if (state.formMode === "create" && !normalizeName(payload.name)) throw new Error("Student name is required.");
    if (state.formMode !== "edit" && !normalizeName(payload.subject)) throw new Error("Subject name is required.");
    if (payload.total === "" || payload.obtained === "" || !Number.isInteger(Number(payload.total)) || !Number.isInteger(Number(payload.obtained))) {
      throw new Error("Enter whole numbers for total and obtained marks.");
    }
    if (total < 1) throw new Error("Total marks must be greater than zero.");
    if (obtained < 0) throw new Error("Obtained marks cannot be negative.");
    if (obtained > total) throw new Error("Obtained marks cannot be greater than total marks.");

    const successMessage = await writeStudentRecord(payload);
    formDialog.close();
    if (state.formMode !== "create") {
      await syncStudentsOnce();
      const updated = findStudent(state.editingStudent.name);
      if (updated) renderDetail(updated);
    }
    toast(successMessage);
  } catch (error) {
    byId("form-error").textContent = firebaseErrorMessage(error);
    byId("form-error").classList.remove("hidden");
  } finally {
    button.disabled = false;
  }
});

document.addEventListener("click", async (event) => {
  const target = event.target.closest("button");
  if (!target) return;
  if (target.dataset.view) setView(target.dataset.view);
  if (target.dataset.navigate) setView(target.dataset.navigate);
  if (target.hasAttribute("data-open-add")) openStudentForm("create");
  if (target.id === "top-add-button") openStudentForm("create");
  if (target.id === "logout-button") {
    try {
      await signOut(auth);
    } catch (error) {
      toast(firebaseErrorMessage(error), true);
    }
  }
  if (target.id === "export-button") {
    const header = ["Student", "Subject", "Obtained", "Total", "Percentage"];
    const rows = state.students.flatMap((student) => student.subjects.length
      ? student.subjects.map((subject) => [student.name, subject.name, subject.obtained, subject.total, formatPercent(subject.percentage)])
      : [[student.name, "", "", "", formatPercent(student.percentage)]]);
    const csv = [header, ...rows].map((row) => row.map((field) => `"${String(field).replace(/"/g, '""')}"`).join(",")).join("\r\n");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    link.download = "student-performance.csv";
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(link.href), 0);
    toast("Your student report has been exported.");
  }
  if (target.dataset.detail) {
    const student = findStudent(decodeURIComponent(target.dataset.detail));
    if (student) renderDetail(student);
  }
  if (target.hasAttribute("data-close-dialog")) formDialog.close();
  if (target.hasAttribute("data-close-detail")) detailDialog.close();
  if (target.hasAttribute("data-add-subject")) {
    const student = findStudent(byId("detail-content").querySelector("h2")?.textContent);
    if (student) openStudentForm("subject", student);
  }
  if (target.hasAttribute("data-edit-subject")) {
    const studentName = byId("detail-content").querySelector("h2")?.textContent;
    const student = findStudent(studentName);
    const subjectName = decodeURIComponent(target.dataset.editSubject);
    const subject = student?.subjects.find((entry) => entry.name === subjectName);
    if (student && subject) openStudentForm("edit", student, subject);
  }
  if (target.hasAttribute("data-delete-student")) {
    const studentName = byId("detail-content").querySelector("h2")?.textContent;
    const student = findStudent(studentName);
    if (student) deleteStudent(student);
  }
  if (target.id === "clear-filters") {
    byId("student-search").value = "";
    byId("status-filter").value = "all";
    byId("sort-select").value = "name";
    renderStudentsTable();
  }
});

["student-search", "status-filter", "sort-select"].forEach((id) => {
  byId(id).addEventListener(id === "student-search" ? "input" : "change", renderStudentsTable);
});

[formDialog, detailDialog].forEach((dialog) => {
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });
});

byId("today-label").textContent = new Intl.DateTimeFormat(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" }).format(new Date());
byId("switch-mode").addEventListener("click", () => {
  setAuthMode(authMode === "login" ? "signup" : "login");
});

authForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  byId("auth-error").classList.add("hidden");
  const button = byId("auth-submit");
  button.disabled = true;
  const email = byId("account-email").value.trim();
  const password = byId("account-password").value;
  try {
    if (authMode === "signup") {
      await createUserWithEmailAndPassword(auth, email, password);
    } else {
      await signInWithEmailAndPassword(auth, email, password);
    }
  } catch (error) {
    showAuthError(firebaseErrorMessage(error));
  } finally {
    button.disabled = false;
  }
});

byId("reset-password").addEventListener("click", async () => {
  const email = byId("account-email").value.trim();
  if (!email) {
    showAuthError("Enter your email address first, then choose password reset.");
    byId("account-email").focus();
    return;
  }
  try {
    await sendPasswordResetEmail(auth, email);
    showAuthError("Password reset email sent. Check your inbox.");
  } catch (error) {
    showAuthError(firebaseErrorMessage(error));
  }
});

async function initializeFirebase() {
  const requiredConfig = ["apiKey", "authDomain", "projectId", "appId"];
  const missingConfig = requiredConfig.some((key) => (
    typeof firebaseConfig[key] !== "string" ||
    !firebaseConfig[key].trim() ||
    firebaseConfig[key].startsWith("REPLACE_WITH_")
  ));
  if (missingConfig) {
    showAuthError("Add your Firebase web app settings in static/firebase-config.js, then reload.");
    byId("auth-submit").disabled = true;
    return;
  }

  try {
    const firebaseApp = initializeApp(firebaseConfig);
    auth = getAuth(firebaseApp);
    database = getFirestore(firebaseApp);
    await setPersistence(auth, browserLocalPersistence);
    onAuthStateChanged(auth, async (user) => {
      if (state.unsubscribeStudents) {
        state.unsubscribeStudents();
        state.unsubscribeStudents = null;
      }
      state.user = user;
      if (!user) {
        refreshStudents([]);
        authScreen.classList.remove("hidden");
        appShell.classList.add("hidden");
        return;
      }

      authScreen.classList.add("hidden");
      appShell.classList.remove("hidden");
      byId("account-email-label").textContent = user.email || "Signed in";
      byId("account-avatar").textContent = (user.email || "?").slice(0, 2).toUpperCase();
      try {
        await importLegacyRecords(user);
        if (state.user?.uid !== user.uid) return;
        state.unsubscribeStudents = onSnapshot(
          studentCollection(user),
          (snapshot) => {
            try {
              const students = snapshot.docs.map((entry) => {
                const record = entry.data();
                if (typeof record.name !== "string" || !Array.isArray(record.subjects)) {
                  throw new Error("A saved student record has invalid data.");
                }
                return buildStudent(record.name, record.subjects);
              }).sort((a, b) => a.name.localeCompare(b.name));
              refreshStudents(students);
            } catch (error) {
              toast(error.message, true);
            }
          },
          (error) => toast(firebaseErrorMessage(error), true),
        );
      } catch (error) {
        toast(firebaseErrorMessage(error), true);
      }
    }, (error) => showAuthError(firebaseErrorMessage(error)));
  } catch (error) {
    showAuthError(firebaseErrorMessage(error));
    byId("auth-submit").disabled = true;
  }
}

setAuthMode("login");
appShell.classList.add("hidden");
initializeFirebase();
