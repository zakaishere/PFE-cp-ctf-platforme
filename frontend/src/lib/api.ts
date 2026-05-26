import { logger } from "@/lib/logger";

export function getApiBaseUrl(): string {
  if (typeof window === "undefined") {
    return process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8080";
  }
  // Derive from current hostname so LAN access (e.g. http://192.168.x.x:3000) works
  // without needing to change .env — backend is always on the same machine, port 8080
  return `${window.location.protocol}//${window.location.hostname}:8080`;
}

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("autograde_token");
}

export function setToken(token: string) {
  localStorage.setItem("autograde_token", token);
}

export function clearToken() {
  localStorage.removeItem("autograde_token");
}

// ── Structured error ────────────────────────────────────────────────────────

export interface ApiErrorBody {
  status:      number;
  code:        string;
  message:     string;
  fieldErrors?: Record<string, string>;
  path?:       string;
  timestamp?:  string;
}

export class ApiException extends Error {
  status:       number;
  code:         string;
  fieldErrors?: Record<string, string>;

  constructor(err: ApiErrorBody) {
    super(err.message);
    this.name        = "ApiException";
    this.status      = err.status;
    this.code        = err.code;
    this.fieldErrors = err.fieldErrors;
  }

  isValidationError() { return this.status === 400 && !!this.fieldErrors; }
  isNotFound()        { return this.status === 404; }
  isConflict()        { return this.status === 409; }
  isServerError()     { return this.status >= 500; }
  isAuthError()       { return this.status === 401; }
  isForbidden()       { return this.status === 403; }
}

// ── Core client ─────────────────────────────────────────────────────────────

async function apiClient<T>(
  endpoint: string,
  options: RequestInit = {},
  config?: { silentErrors?: boolean }
): Promise<T> {
  const token  = getToken();
  const method = options.method ?? "GET";
  const url    = `${getApiBaseUrl()}${endpoint}`;
  const start  = Date.now();

  logger.debug("API", `→ ${method} ${endpoint}`);

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(url, { cache: "no-store", ...options, headers });
  const duration = Date.now() - start;
  logger.api(method, endpoint, res.status, duration);

  // ── Success ────────────────────────────────────────────────────────────
  if (res.ok) {
    if (res.status === 204) return undefined as T;
    const text = await res.text();
    if (!text) return {} as T;
    const data = JSON.parse(text);
    logger.debug("API", `← ${method} ${endpoint} OK`);
    return data as T;
  }

  // ── Parse error body ───────────────────────────────────────────────────
  let errBody: ApiErrorBody;
  try {
    const raw = await res.json();
    errBody = {
      status:     raw.status      ?? res.status,
      code:       raw.code        ?? "ERROR",
      message:    raw.message     ?? raw.error ?? `Request failed with status ${res.status}`,
      fieldErrors:raw.fieldErrors ?? undefined,
      path:       raw.path        ?? endpoint,
      timestamp:  raw.timestamp   ?? new Date().toISOString(),
    };
  } catch {
    errBody = {
      status:    res.status,
      code:      "PARSE_ERROR",
      message:   `Server error ${res.status}: ${res.statusText}`,
      path:      endpoint,
      timestamp: new Date().toISOString(),
    };
  }

  logger.error("API", `← ${method} ${endpoint} [${errBody.status}] ${errBody.code}: ${errBody.message}`, errBody);

  if (!config?.silentErrors) {
    showErrorToast(errBody);
  }

  throw new ApiException(errBody);
}

// ── Toast helper (lazy import avoids circular dep) ───────────────────────────

function showErrorToast(err: ApiErrorBody) {
  // Dynamic import so Toast.tsx can import from api.ts without circular refs
  import("@/components/ui/PSPToast").then(({ toast }) => {
    switch (err.status) {
      case 400:
        if (err.fieldErrors) return; // inline field errors — no toast
        toast.warning("Action not allowed", err.message);
        break;
      case 401:
        toast.error("Session expired", "Please sign in again to continue.");
        setTimeout(() => { if (typeof window !== "undefined") window.location.href = "/login"; }, 2000);
        break;
      case 403:
        toast.error("Access denied", err.message || "You don't have permission to do that.");
        break;
      case 404:
        toast.warning("Not found", err.message);
        break;
      case 409:
        toast.warning("Conflict", err.message);
        break;
      default:
        toast.error("Something went wrong", "We're having trouble completing your request. Please try again.");
    }
  }).catch(() => { /* toast unavailable — silently skip */ });
}

// --- Auth ---

export interface RegisterStudentRequest {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  apogeeNumber: string;
  divisionId?: string;
  semesterId?: string;
}

export interface RegisterTeacherRequest {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  specialty: string | null;
  department: string | null;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  role: string;
  userId: string;
  email: string;
  firstName: string;
}

export const registerStudent = (data: RegisterStudentRequest) =>
  apiClient<{ message: string }>("/api/auth/register/student", { method: "POST", body: JSON.stringify(data) });

export const registerTeacher = (data: RegisterTeacherRequest) =>
  apiClient<{ message: string }>("/api/auth/register/teacher", { method: "POST", body: JSON.stringify(data) });

export const login = (data: LoginRequest) =>
  apiClient<LoginResponse>("/api/auth/login", { method: "POST", body: JSON.stringify(data) });

// --- Email Verification ---

export const verifyEmail = (email: string, otpCode: string) =>
  apiClient<{ message: string }>("/api/auth/verify-email", { method: "POST", body: JSON.stringify({ email, otpCode }) });

export const resendVerification = (email: string) =>
  apiClient<{ message: string }>("/api/auth/resend-verification", { method: "POST", body: JSON.stringify({ email }) });

// --- Forgot Password ---

export const forgotPassword = (email: string) =>
  apiClient<{ message: string }>("/api/auth/forgot-password", { method: "POST", body: JSON.stringify({ email }) });

export const resetPassword = (email: string, otpCode: string, newPassword: string) =>
  apiClient<{ message: string }>("/api/auth/reset-password", { method: "POST", body: JSON.stringify({ email, otpCode, newPassword }) });

// --- Admin ---

export interface PendingTeacher {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  department: string | null;
  specialty: string | null;
}

export const getPendingTeachers = () =>
  apiClient<PendingTeacher[]>("/api/admin/pending-teachers", { method: "GET" });

export const activateTeacher = (id: string) =>
  apiClient<{ message: string }>(`/api/admin/teachers/${id}/activate`, { method: "PUT" });

export const rejectTeacher = (id: string) =>
  apiClient<{ message: string }>(`/api/admin/teachers/${id}/reject`, { method: "DELETE" });

// --- Submissions ---

export interface SubmissionRequest {
  studentId: string;
  problemId: string;
  assessmentId?: string;
  sourceCode: string;
  language: string;
  accessCode?: string;
  runOnly?: boolean;
}

export interface SubmissionResponse {
  submissionId: string;
  status: string;
  message: string;
}

export const submitCode = (data: SubmissionRequest) =>
  apiClient<SubmissionResponse>("/api/submissions", { method: "POST", body: JSON.stringify(data) });

// --- Anti-Cheat ---

export interface CheatLogRequest {
  studentId: string;
  assessmentId: string;
  violationType: string;
}

export const logCheatEvent = (data: CheatLogRequest) =>
  apiClient<{ message: string }>("/api/exams/cheat-logs", { method: "POST", body: JSON.stringify(data) });

// --- Leaderboard ---

export interface LeaderboardEntry {
  studentId: string;
  firstName: string;
  lastName: string;
  totalPoints: number;
}

export const getLeaderboard = () =>
  apiClient<LeaderboardEntry[]>("/api/leaderboard", { method: "GET" });

// --- Assessments ---

export interface CreateAssessmentRequest {
  title: string;
  description: string;
  moduleId: string;
  visibilityMode?: string;
  scheduledStartTime?: string; // ISO string
  durationMinutes?: number;
  strictAccessCode?: string;
  deadline?: string; // ISO string
  maxAttempts?: number;
  isPenaltyEnabled?: boolean;
}

export const createLiveExam = (data: CreateAssessmentRequest) =>
  apiClient<{ message: string; assessmentId: string }>("/api/assessments/exams", { method: "POST", body: JSON.stringify(data) });

export const createOpenTP = (data: CreateAssessmentRequest) =>
  apiClient<{ message: string; assessmentId: string }>("/api/assessments/tps", { method: "POST", body: JSON.stringify(data) });

export const addProblemToAssessment = (assessmentId: string, problemId: string) =>
  apiClient<{ message: string }>(`/api/assessments/${assessmentId}/problems/${problemId}`, { method: "POST" });

export const getAssessments = () =>
  apiClient<any[]>("/api/assessments", { method: "GET" });

export const getAssessmentStudentView = (assessmentId: string) =>
  apiClient<any>(`/api/assessments/${assessmentId}/student-view`, { method: "GET" });

// --- Problems ---

export interface TestCaseRequest {
  inputData: string;
  expectedOutput: string;
  isHidden: boolean;
}

export interface CreateProblemRequest {
  title: string;
  description: string;
  difficultyLevel: string;
  isPublic: boolean;
  timeLimitMs?: number;
  memoryLimitMb?: number;
  testCases: TestCaseRequest[];
  tags?: string[];
  category?: string;
  hints?: string[];
}

export interface UpdateProblemRequest {
  title?: string;
  description?: string;
  difficultyLevel?: string;
  isPublic?: boolean;
  timeLimitMs?: number;
  memoryLimitMb?: number;
  testCases?: TestCaseRequest[];
  tags?: string[];
  category?: string;
  hints?: string[];
}

export const createProblem = (data: CreateProblemRequest) =>
  apiClient<{ message: string; problemId: string }>("/api/problems", { method: "POST", body: JSON.stringify(data) });

export const updateProblem = (id: string, data: UpdateProblemRequest) =>
  apiClient<{ message: string; problemId: string }>(`/api/problems/${id}`, { method: "PUT", body: JSON.stringify(data) });

export const deleteProblem = (id: string) =>
  apiClient<{ message: string }>(`/api/problems/${id}`, { method: "DELETE" });

export const toggleProblemVisibility = (id: string, isPublic: boolean) =>
  apiClient<{ message: string; isPublic: boolean }>(`/api/problems/${id}/visibility`, { method: "PATCH", body: JSON.stringify({ isPublic }) });

export const getAllProblems = () =>
  apiClient<any[]>("/api/problems", { method: "GET" });

export interface PagedProblemsResponse {
  content: any[];
  totalPages: number;
  totalElements: number;
  number: number;
  size: number;
}

export const getProblemsPage = (page: number, size: number) =>
  apiClient<any>(`/api/problems?page=${page}&size=${size}`, { method: "GET" });

export const getProblem = (problemId: string) =>
  apiClient<any>(`/api/problems/${problemId}`, { method: "GET" });

// --- Problem Detail (practice arena) ---

export interface VisibleTestCaseDTO {
  id: string;
  input: string;
  expectedOutput: string;
}

export interface ProblemDetailDTO {
  problemId:           string;
  title:               string;
  description:         string;
  difficulty:          "EASY" | "MEDIUM" | "HARD";
  timeLimitMs:         number;
  memoryLimitMb:       number;
  solvedByCurrentUser: boolean;
  visibleTestCases:    VisibleTestCaseDTO[];
  hiddenTestCaseCount: number;
  tags:                string[];
  totalSubmissions:    number;
  acceptedSubmissions: number;
  acceptanceRate:      number;
  authorName:          string;
  category?:           string;
  hints?:              string[];
}

export interface MySubmissionDTO {
  id:          string;
  status:      string;
  language:    string;
  score:       number;
  timeMs:      number;
  memoryKb:    number;
  submittedAt: string;
  submittedAgo: string;
}

export const getProblemDetail = (problemId: string) =>
  apiClient<ProblemDetailDTO>(`/api/problems/${problemId}`, { method: "GET" });

export const getMySubmissions = (problemId: string) =>
  apiClient<MySubmissionDTO[]>(`/api/problems/${problemId}/my-submissions`, { method: "GET" });

export const getSubmissionCode = (submissionId: string) =>
  apiClient<{ code: string; language: string }>(`/api/submissions/${submissionId}/code`, { method: "GET" });

// --- Problem Run (stateless, visible test cases only) ---

// Legacy run types kept for any existing references
export interface RunCaseResult {
  testCaseId: string;
  input: string;
  expectedOutput: string;
  actualOutput: string;
  passed: boolean;
  status: string; // PASS | FAIL | TIME_OUT | ERROR
  timeMs: number;
}
export interface RunResponse { results: RunCaseResult[]; }

// Enhanced run response (v2) — matches new backend RunResultDTO
export interface RunTestCaseResult {
  index:           number;
  passed:          boolean;
  verdict:         string; // ACCEPTED | WRONG_ANSWER | TIME_LIMIT_EXCEEDED | RUNTIME_ERROR | MEMORY_LIMIT_EXCEEDED
  input?:          string;
  expectedOutput?: string;
  actualOutput?:   string;
  timeMs:          number;
  isHidden:        boolean;
}

export interface RunResult {
  status:        'ALL_PASSED' | 'FAILED' | 'COMPILATION_ERROR';
  results:       RunTestCaseResult[];
  stoppedAt?:    number;   // 1-based index of first failure; absent when ALL_PASSED
  totalCases:    number;
  failReason?:   string;
  compileError?: string;
}

export const runCode = (problemId: string, data: { sourceCode: string; language: string }) =>
  apiClient<RunResult>(`/api/problems/${problemId}/run`, {
    method: "POST",
    body: JSON.stringify({ sourceCode: data.sourceCode, language: data.language }),
  });

// --- Student Problems Browse (paginated + infinite scroll) ---

export interface ProblemBrowseDTO {
  problemId: string;
  title: string;
  difficulty: 'EASY' | 'MEDIUM' | 'HARD';
  passRate: number;
  submissionCount: number;
  points: number;
  solvedByCurrentUser: boolean;
  authorName: string;
}

export interface ProblemBrowsePage {
  content: ProblemBrowseDTO[];
  totalElements: number;
  totalPages: number;
  number: number;
  last: boolean;
}

export const fetchProblemsPage = (params: {
  page: number;
  size?: number;
  search?: string;
  difficulty?: string;
}) => {
  const query = new URLSearchParams({ page: String(params.page), size: String(params.size ?? 20) });
  if (params.search)     query.append("search", params.search);
  if (params.difficulty) query.append("difficulty", params.difficulty);
  return apiClient<ProblemBrowsePage>(`/api/problems?${query}`, { method: "GET" });
};

// --- Academic Hierarchy (public) ---

export interface AcademicOption {
  id: string;
  name: string;
}

export const getDepartments = () =>
  apiClient<AcademicOption[]>("/api/academic/departments", { method: "GET" });

export const getDivisions = () =>
  apiClient<AcademicOption[]>("/api/academic/divisions", { method: "GET" });

export const getDivisionsByDepartment = (deptId: string) =>
  apiClient<AcademicOption[]>(`/api/academic/departments/${deptId}/divisions`, { method: "GET" });

export const getSemesters = () =>
  apiClient<AcademicOption[]>("/api/academic/semesters", { method: "GET" });

// --- Student Profile ---

export interface StudentProfile {
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  apogeeNumber: string;
  totalPoints: number;
  profileComplete: boolean;
  divisionId?: string;
  divisionName?: string;
  semesterId?: string;
  semesterName?: string;
  cohortId?: string;
  cohortLabel?: string;
}

export const getStudentProfile = () =>
  apiClient<StudentProfile>("/api/students/me/profile", { method: "GET" });

export const updateStudentProfile = (data: { divisionId?: string; semesterId?: string }) =>
  apiClient<{ message: string }>("/api/students/me/profile", { method: "PATCH", body: JSON.stringify(data) });

// --- New E2E Assessment Lifecycle Features ---

export const getExamSubmissions = (examId: string, studentId?: string) => {
  const url = studentId ? `/api/teacher/exams/${examId}/submissions?studentId=${studentId}` : `/api/teacher/exams/${examId}/submissions`;
  return apiClient<any>(url, { method: "GET" });
};

export const closeLiveExam = (examId: string) =>
  apiClient<{ message: string }>(`/api/teacher/exams/${examId}/close`, { method: "POST" });

export const overridePenalty = (submissionId: string, data: { penaltyValue: number; reason: string }) =>
  apiClient<{ message: string }>(`/api/teacher/submissions/${submissionId}/penalty`, { method: "POST", body: JSON.stringify(data) });

export const joinExamAccess = (examId: string, accessCode: string) =>
  apiClient<{ message: string }>(`/api/assessments/${examId}/access`, { method: "POST", body: JSON.stringify({ accessCode }) });

export const getStudentExamResults = (examId: string) =>
  apiClient<{ finalGrade: number; examId: string }>(`/api/students/me/exams/${examId}/results`, { method: "GET" });

// --- Competitions ---

export interface CreateCompetitionRequest {
  title: string;
  description: string;
  mode: "SOLO" | "TEAM";
  minTeamSize?: number;
  maxTeamSize?: number;
  accessType: "REQUEST_BASED" | "OPEN";
  scheduledStartTime: string;
  durationMinutes: number;
}

export const getCompetitions = (status?: string) =>
  apiClient<any[]>(`/api/competitions${status ? `?status=${status}` : ""}`, { method: "GET" });

export const getCompetitionDetail = (id: string) =>
  apiClient<any>(`/api/competitions/${id}`, { method: "GET" });

export const createCompetition = (data: CreateCompetitionRequest) =>
  apiClient<{ message: string; competitionId: string }>("/api/competitions", { method: "POST", body: JSON.stringify(data) });

export const publishCompetition = (id: string) =>
  apiClient<{ message: string }>(`/api/competitions/${id}/publish`, { method: "PUT" });

export const attachCompetitionProblem = (competitionId: string, problemId: string, points?: number) =>
  apiClient<{ message: string; assignedPoints: number }>(`/api/competitions/${competitionId}/problems/${problemId}`, {
    method: "POST",
    body: JSON.stringify(points !== undefined ? { points } : {}),
  });

export const detachCompetitionProblem = (competitionId: string, problemId: string) =>
  apiClient<{ message: string }>(`/api/competitions/${competitionId}/problems/${problemId}`, { method: "DELETE" });

export const registerForCompetition = (id: string) =>
  apiClient<{ message: string }>(`/api/competitions/${id}/register`, { method: "POST" });

export const requestToJoinCompetition = (competitionId: string, message?: string) =>
  apiClient<any>(`/api/join-requests/competitions/${competitionId}`, { method: "POST", body: JSON.stringify({ message }) });

export const getCompetitionScoreboard = (id: string) =>
  apiClient<any[]>(`/api/competitions/${id}/scoreboard`, { method: "GET" });

export const getCompetitionLobby = (id: string) =>
  apiClient<any>(`/api/competitions/${id}/lobby`, { method: "GET" });

export const getMyCompetitionTeam = (id: string) =>
  apiClient<any>(`/api/competitions/${id}/my-team`, { method: "GET" });

export const createCompetitionTeam = (id: string, teamName: string) =>
  apiClient<any>(`/api/competitions/${id}/teams`, { method: "POST", body: JSON.stringify({ teamName }) });

export const joinCompetitionTeam = (id: string, inviteCode: string) =>
  apiClient<any>(`/api/competitions/${id}/teams/join`, { method: "POST", body: JSON.stringify({ inviteCode }) });

export const leaveCompetitionTeam = (id: string) =>
  apiClient<any>(`/api/competitions/${id}/teams/leave`, { method: "DELETE" });

export const reorderCompetitionProblems = (id: string, problemIds: string[]) =>
  apiClient<{ message: string }>(`/api/competitions/${id}/problems/reorder`, { method: "PUT", body: JSON.stringify({ problemIds }) });

export const patchCompetitionProblem = (id: string, problemId: string, data: { maxPoints?: number }) =>
  apiClient<{ message: string }>(`/api/competitions/${id}/problems/${problemId}`, { method: "PATCH", body: JSON.stringify(data) });

export const patchCompetitionPenalty = (id: string, data: { penaltyEnabled: boolean; penaltyMinutes: number }) =>
  apiClient<{ message: string }>(`/api/competitions/${id}/penalty`, { method: "PATCH", body: JSON.stringify(data) });

export const patchCompetitionSettings = (id: string, data: { title?: string; description?: string; durationMinutes?: number }) =>
  apiClient<{ message: string }>(`/api/competitions/${id}/settings`, { method: "PATCH", body: JSON.stringify(data) });

export const reorderAssessmentProblems = (id: string, problemIds: string[]) =>
  apiClient<{ message: string }>(`/api/assessments/${id}/problems/reorder`, { method: "PUT", body: JSON.stringify({ problemIds }) });

export const patchAssessmentProblem = (id: string, problemId: string, data: { points?: number }) =>
  apiClient<{ message: string }>(`/api/assessments/${id}/problems/${problemId}`, { method: "PATCH", body: JSON.stringify(data) });

export const removeAssessmentProblem = (id: string, problemId: string) =>
  apiClient<{ message: string }>(`/api/assessments/${id}/problems/${problemId}`, { method: "DELETE" });

export const patchAssessmentSettings = (id: string, data: {
  title?: string; description?: string;
  durationMinutes?: number; isPenaltyEnabled?: boolean; scheduledStartTime?: string;
  deadline?: string; maxAttemptsAllowed?: number;
}) => apiClient<{ message: string }>(`/api/assessments/${id}/settings`, { method: "PATCH", body: JSON.stringify(data) });

export const getAssessmentDetail = (id: string) =>
  apiClient<any>(`/api/assessments/${id}/student-view`, { method: "GET" });

// --- Join Requests ---

export const requestToJoinAssessment = (assessmentId: string, message?: string) =>
  apiClient<any>(`/api/join-requests/assessments/${assessmentId}`, { method: "POST", body: JSON.stringify({ message }) });

export const getAssessmentJoinRequests = (assessmentId: string, status = "PENDING", page = 0, size = 20) =>
  apiClient<any>(`/api/join-requests/assessments/${assessmentId}?status=${status}&page=${page}&size=${size}`, { method: "GET" });

export const getCompetitionJoinRequests = (competitionId: string, status = "PENDING", page = 0, size = 20) =>
  apiClient<any>(`/api/join-requests/competitions/${competitionId}?status=${status}&page=${page}&size=${size}`, { method: "GET" });

export const approveJoinRequest = (requestId: string) =>
  apiClient<any>(`/api/join-requests/${requestId}/approve`, { method: "PUT" });

export const rejectJoinRequest = (requestId: string, reason?: string) =>
  apiClient<any>(`/api/join-requests/${requestId}/reject`, { method: "PUT", body: JSON.stringify({ reason }) });

export const bulkApproveAssessmentRequests = (assessmentId: string, requestIds: string[]) =>
  apiClient<any>(`/api/join-requests/assessments/${assessmentId}/bulk-approve`, { method: "PUT", body: JSON.stringify({ requestIds }) });

export const bulkApproveCompetitionRequests = (competitionId: string, requestIds: string[]) =>
  apiClient<any>(`/api/join-requests/competitions/${competitionId}/bulk-approve`, { method: "PUT", body: JSON.stringify({ requestIds }) });

// --- Exam Room ---

export interface ExamRoomVisibleTestCase {
  id: string;
  input: string;
  expectedOutput: string;
}

export interface ExamProblemDTO {
  problemId: string;
  label: string;
  title: string;
  difficulty: "EASY" | "MEDIUM" | "HARD";
  timeLimitMs: number;
  memoryLimitMb: number;
  description: string;
  points: number;
  visibleTestCases: ExamRoomVisibleTestCase[];
  hiddenTestCaseCount: number;
  solvedByCurrentUser: boolean;
}

export interface ExamRoomDTO {
  assessmentId: string;
  title: string;
  remainingSeconds: number;
  isEnded: boolean;
  problems: ExamProblemDTO[];
}

export const getExamRoom = (assessmentId: string) =>
  apiClient<ExamRoomDTO>(`/api/assessments/${assessmentId}/exam-room`, { method: "GET" });

// --- Teacher module picker ---

export interface ModuleOption {
  id: string;
  name: string;
}

export const getMyModules = () =>
  apiClient<ModuleOption[]>("/api/assessments/my-modules", { method: "GET" });

// --- Competition Anti-Cheat ---

export const reportCompetitionViolation = (
  competitionId: string,
  data: { type: string; timestamp: string; details?: string }
) =>
  apiClient<void>(`/api/competitions/${competitionId}/violations`, {
    method: "POST",
    body: JSON.stringify(data),
  }, { silentErrors: true });

// --- Competition Arena ---

export interface ArenaVisibleTestCase {
  testCaseId: string;
  input: string;
  expectedOutput: string;
}

export interface ArenaProblem {
  problemId: string;
  label: string;
  title: string;
  description: string;
  difficultyLevel: "EASY" | "MEDIUM" | "HARD";
  points: number;
  timeLimitMs: number;
  memoryLimitMb: number;
  visibleTestCases: ArenaVisibleTestCase[];
  hiddenTestCaseCount: number;
  solveStatus: "UNSOLVED" | "ATTEMPTED" | "SOLVED";
  attempts: number;
  score?: number;
}

export interface ArenaTeamMember {
  studentId: string;
  firstName: string;
  lastName: string;
  joinedAt: string;
}

export interface ArenaTeam {
  teamId: string;
  teamName: string;
  inviteCode: string;
  captainId: string;
  members: ArenaTeamMember[];
  currentSize: number;
  maxSize: number;
}

export interface ArenaDTO {
  competitionId: string;
  title: string;
  mode: "SOLO" | "TEAM";
  endTime: string;
  remainingSeconds: number;
  penaltyEnabled: boolean;
  penaltyMinutes?: number;
  problems: ArenaProblem[];
  myTeam?: ArenaTeam;
}

export const getCompetitionArena = (id: string) =>
  apiClient<ArenaDTO>(`/api/competitions/${id}/arena`, { method: "GET" });

export const submitToCompetition = (
  competitionId: string,
  data: { problemId: string; sourceCode: string; language: string }
) =>
  apiClient<{ submissionId: string; message: string }>(
    `/api/competitions/${competitionId}/submit`,
    { method: "POST", body: JSON.stringify(data) }
  );

export const getCompetitionTeamActivity = (id: string, limit = 20) =>
  apiClient<any[]>(`/api/competitions/${id}/team-activity?limit=${limit}`, {
    method: "GET",
  });

// --- Problem picker (teacher) ---

export interface ProblemPickerItem {
  problemId: string;
  title: string;
  difficulty: "EASY" | "MEDIUM" | "HARD";
  isPublic: boolean;
}

export const getProblemsPicker = () =>
  apiClient<ProblemPickerItem[]>("/api/problems/picker", { method: "GET" });

// ── CTF ──────────────────────────────────────────────────────────────────────

export interface CTFHintDTO {
  id: string;
  cost: number;
  text: string | null;
}

export interface CTFChallengeDTO {
  id: string;
  title: string;
  description: string;
  category: string;
  difficulty: "EASY" | "MEDIUM" | "HARD";
  basePoints: number;
  currentPoints: number;
  flagFormat: string;
  requiresInstance: boolean;
  dockerImage: string | null;
  dockerExposedPort: number | null;
  connectionType: "HTTP" | "TCP" | null;
  downloadableFileUrl: string | null;
  downloadableFileName: string | null;
  hints: CTFHintDTO[];
  maxAttempts: number | null; // null = unlimited
  isActive: boolean;
  createdAt: string;
  solvedByMe: boolean;
  solveCount: number;
  myUnlockedHints: string[];
  myAttempts: number;
  hasActiveInstance: boolean;
}

export interface CTFSubmitResponse {
  correct: boolean;
  message: string;
  pointsAwarded: number | null;
  attemptsUsed: number;
  maxAttempts: number | null; // null = unlimited
}

export interface CTFSubmission {
  id: string;
  challengeId: string;
  userId: string;
  submittedValue: string;
  isCorrect: boolean;
  attemptNumber: number;
  submittedAt: string;
  ipAddress: string | null;
  userAgent: string | null;
}

export interface CTFInstanceResponse {
  instanceId:       string;
  connectionType:   "HTTP" | "TCP" | null;
  connectionString: string | null;
  accessUrl:        string | null;   // legacy alias for HTTP connectionString
  expiresAt:        string;
  status:           string;          // STARTING | RUNNING | FAILED | EXPIRED | STOPPED
  message:          string | null;
  renewalCount:     number;
}

export interface CTFInstanceWebSocketMessage {
  instanceId:       string;
  status:           "RUNNING" | "FAILED" | "EXPIRED";
  connectionType?:  "HTTP" | "TCP";
  connectionString?: string;
  accessUrl?:       string;
  expiresAt?:       string;
  renewalCount?:    number;
  error?:           string;
}

export interface CTFResourceConfig {
  id: number;
  maxConcurrentInstances: number;
  maxInstancesPerUser: number;
  maxInstanceDurationMinutes: number;
  containerMemoryLimitMb: number;
  containerCpuPercent: number;
  cleanupIntervalSeconds: number;
  updatedBy: string | null;
  updatedAt: string | null;
}

export const getCTFChallenges = (category?: string, difficulty?: string) => {
  const params = new URLSearchParams();
  if (category) params.set("category", category);
  if (difficulty) params.set("difficulty", difficulty);
  const qs = params.toString();
  return apiClient<CTFChallengeDTO[]>(`/api/ctf/challenges${qs ? "?" + qs : ""}`, { method: "GET" });
};

export const getCTFChallenge = (id: string) =>
  apiClient<CTFChallengeDTO>(`/api/ctf/challenges/${id}`, { method: "GET" });

export const submitCTFFlag = (challengeId: string, flag: string) =>
  apiClient<CTFSubmitResponse>(`/api/ctf/challenges/${challengeId}/submit`, {
    method: "POST",
    body: JSON.stringify({ flag }),
  }, { silentErrors: true });

export const getMyCTFSubmissions = (challengeId: string) =>
  apiClient<CTFSubmission[]>(`/api/ctf/challenges/${challengeId}/my-submissions`, { method: "GET" });

export const unlockCTFHint = (
  challengeId: string,
  hintId: string,
  opts?: { competitionId?: string; teamId?: string },
) => {
  const qs = new URLSearchParams();
  if (opts?.competitionId) qs.set("competitionId", opts.competitionId);
  if (opts?.teamId)        qs.set("teamId",        opts.teamId);
  const query = qs.toString() ? `?${qs}` : "";
  return apiClient<{ id: string; cost: number; text: string }>(
    `/api/ctf/challenges/${challengeId}/hints/${hintId}/unlock${query}`,
    { method: "POST" },
  );
};

export const getCtfInstanceStatus = (challengeId: string, teamId?: string) => {
  const qs = new URLSearchParams({ challengeId });
  if (teamId) qs.set("teamId", teamId);
  return apiClient<CTFInstanceResponse | null>(
    `/api/ctf/instances/status?${qs}`,
    { method: "GET" },
    { silentErrors: true }
  );
};

export const startCTFInstance = (
  challengeId: string,
  opts?: { competitionId?: string; teamId?: string }
) =>
  apiClient<CTFInstanceResponse>(`/api/ctf/instances/start`, {
    method: "POST",
    body: JSON.stringify({ challengeId, ...opts }),
  });

export const renewCTFInstance = (_challengeId: string, instanceId: string) =>
  apiClient<CTFInstanceResponse>(`/api/ctf/instances/${instanceId}/renew`, { method: "POST" });

export const stopCTFInstance = (_challengeId: string, instanceId: string) =>
  apiClient<void>(`/api/ctf/instances/${instanceId}`, { method: "DELETE" });

export const getCTFAdminConfig = () =>
  apiClient<CTFResourceConfig>("/api/ctf/admin/config", { method: "GET" });

export const updateCTFAdminConfig = (data: Partial<CTFResourceConfig>) =>
  apiClient<CTFResourceConfig>("/api/ctf/admin/config", {
    method: "PUT",
    body: JSON.stringify(data),
  });

// ── Teacher CTF management ───────────────────────────────────────────────────

export interface CTFHintRequest {
  cost: number;
  text: string;
}

export interface CTFChallengeCreateRequest {
  title:              string;
  description:        string;
  category:           string;
  difficulty:         string;
  basePoints:         number;
  flagType?:          "STATIC" | "DYNAMIC";
  plainFlag?:         string;
  flagFormat?:        string;
  requiresInstance?:  boolean;
  dockerImage?:       string;
  dockerExposedPort?: number;
  containerEnvVars?:  string;
  dockerFlagEnv?:     string;
  connectionType?:    "HTTP" | "TCP";
  dockerEnvVars?:     Record<string, string>;
  dockerMemoryMb?:    number;
  dockerCpuPercent?:  number;
  dockerPidsLimit?:   number;
  downloadableFileUrl?:  string;
  downloadableFileName?: string;
  maxAttempts?:       number;
  isActive?:          boolean;
  hints?:             CTFHintRequest[];
}

export interface CTFChallengeUpdateRequest {
  title?:             string;
  description?:       string;
  category?:          string;
  difficulty?:        string;
  basePoints?:        number;
  flagType?:          "STATIC" | "DYNAMIC";
  plainFlag?:         string;
  flagFormat?:        string;
  requiresInstance?:  boolean;
  dockerImage?:       string;
  dockerExposedPort?: number;
  containerEnvVars?:  string;
  dockerFlagEnv?:     string;
  connectionType?:    "HTTP" | "TCP";
  dockerEnvVars?:     Record<string, string>;
  dockerMemoryMb?:    number;
  dockerCpuPercent?:  number;
  dockerPidsLimit?:   number;
  downloadableFileUrl?:  string;
  downloadableFileName?: string;
  maxAttempts?:       number;
  isActive?:          boolean;
  hints?:             CTFHintRequest[];
}

export interface CTFChallengeResponse {
  id:                  string;
  title:               string;
  description:         string;
  category:            string;
  difficulty:          string;
  basePoints:          number;
  flagType:            "STATIC" | "DYNAMIC";
  flagFormat:          string;
  requiresInstance:    boolean;
  dockerImage:         string | null;
  dockerExposedPort:   number | null;
  containerEnvVars:    string | null;
  dockerFlagEnv:       string | null;
  connectionType:      "HTTP" | "TCP" | null;
  dockerEnvVars:       Record<string, string> | null;
  dockerMemoryMb:      number | null;
  dockerCpuPercent:    number | null;
  dockerPidsLimit:     number | null;
  downloadableFileUrl: string | null;
  downloadableFileName: string | null;
  hints:               { id: string; cost: number; text: string }[];
  maxAttempts:         number | null; // null = unlimited
  isActive:            boolean;
  authorId:            string;
  createdAt:           string;
  updatedAt:           string;
  solveCount:          number;
  attemptCount:        number;
}

export interface CTFChallengeDetailResponse extends CTFChallengeResponse {
  recentSolves: {
    userId:          string;
    userDisplayName: string;
    solvedAt:        string;
    pointsAwarded:   number;
  }[];
  recentSubmissions: {
    id:                   string;
    userId:               string;
    userDisplayName:      string;
    correct:              boolean;
    submittedValueMasked: string;
    submittedAt:          string;
  }[];
}

export const getTeacherCTFChallenges = (
  category?: string,
  difficulty?: string,
  status?: string,
) => {
  const params = new URLSearchParams();
  if (category)   params.set("category",   category);
  if (difficulty) params.set("difficulty", difficulty);
  if (status)     params.set("status",     status);
  const qs = params.toString();
  return apiClient<CTFChallengeResponse[]>(
    `/api/teacher/ctf/challenges${qs ? "?" + qs : ""}`,
    { method: "GET" },
  );
};

export const getTeacherCTFChallenge = (id: string) =>
  apiClient<CTFChallengeDetailResponse>(`/api/teacher/ctf/challenges/${id}`, { method: "GET" });

export const createTeacherCTFChallenge = (data: CTFChallengeCreateRequest) =>
  apiClient<CTFChallengeResponse>("/api/teacher/ctf/challenges", {
    method: "POST",
    body: JSON.stringify(data),
  });

export const updateTeacherCTFChallenge = (id: string, data: CTFChallengeUpdateRequest) =>
  apiClient<CTFChallengeResponse>(`/api/teacher/ctf/challenges/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });

export const toggleTeacherCTFChallenge = (id: string) =>
  apiClient<CTFChallengeResponse>(`/api/teacher/ctf/challenges/${id}/toggle-active`, {
    method: "PATCH",
  });

export const deleteTeacherCTFChallenge = (id: string) =>
  apiClient<{ message: string }>(`/api/teacher/ctf/challenges/${id}`, { method: "DELETE" });

// ── CTF Competitions ──────────────────────────────────────────────────────────

export type CTFCompetitionStatus = "UPCOMING" | "ACTIVE" | "PAUSED" | "FROZEN" | "ENDED";

export interface CTFCompetitionDTO {
  id:           string;
  title:        string;
  description:  string | null;
  startTime:    string | null;
  endTime:      string | null;
  computedEndTime: string | null;   // effective end for DURATION mode
  maxTeamSize:  number;
  minTeamSize:  number;
  scoringMode:  "STATIC" | "DYNAMIC";
  visibility:   "PUBLIC" | "ACCESS_CODE" | "INVITE_ONLY";
  bannerUrl:    string | null;
  coverImageUrl: string | null;
  active:       boolean;
  started:      boolean;
  ended:        boolean;
  // Timing mode
  timingMode:      "SCHEDULED" | "DURATION" | "MANUAL" | "REGISTRATION";
  durationHours:   number | null;   // stored as total minutes despite the name
  manuallyStarted: boolean;
  manuallyEnded:   boolean;
  // Status-aware fields
  status:           CTFCompetitionStatus;
  isPaused:         boolean;
  isFrozen:         boolean;
  pausedAt:         string | null;
  frozenAt:         string | null;
  registrationOpen: boolean;
  canEnterArena:    boolean;
  myTeam:           CTFTeamResponse | null;
}

export interface CTFCompetitionStatusPayload {
  id:               string;
  status:           CTFCompetitionStatus;
  startTime:        string | null;
  endTime:          string | null;
  myTeamId:         string | null;
  canEnterArena:    boolean;
  registrationOpen: boolean;
  participantCount: number;
  teamCount:        number;
  isPaused:         boolean;
  isFrozen:         boolean;
  pausedAt:         string | null;
  frozenAt:         string | null;
}

export interface CTFChallengeListResponse {
  status:          CTFCompetitionStatus;
  message:         string | null;
  challenges:      CTFCompetitionChallengeDTO[];
  categoryCounts:  Record<string, number> | null;
}

export interface CTFTeamMemberDTO {
  userId:             string;
  displayName:        string;
  role:               "CAPTAIN" | "MEMBER";
  joinedAt:           string;
  solveCount?:        number;
  pointsContributed?: number;
}

export interface CTFTeamResponse {
  id:            string;
  competitionId: string;
  name:          string;
  inviteCode:    string;
  avatarColor:   string;
  captainId:     string;
  members:       CTFTeamMemberDTO[];
  solveCount:    number;
  totalPoints:   number;
}

export interface CTFChallengeSolverDTO {
  teamId:    string;
  teamName:  string;
  avatarColor: string;
  solvedAt:  string;
}

export interface CTFTeamSolveEntryDTO {
  challengeId:    string;
  challengeTitle: string;
  category:       string;
  currentPoints:  number;
  solvedAt:       string;
}

export interface CTFTeamProfileDTO {
  id:           string;
  competitionId: string;
  name:         string;
  avatarColor:  string;
  captainId:    string;
  rank:         number;
  totalPoints:  number;
  solveCount:   number;
  members:      CTFTeamMemberDTO[];
  solves:       CTFTeamSolveEntryDTO[];
}

export interface CTFScoreboardEntryDTO {
  rank:         number;
  teamId:       string;
  teamName:     string;
  avatarColor:  string;
  totalPoints:  number;
  solveCount:   number;
  membersCount: number;
  lastSolveAt:  string | null;
}

export interface CTFScoreTimelineDTO {
  teams: {
    teamId:      string;
    teamName:    string;
    accentColor: string;
    points:      { time: string; score: number }[];
  }[];
  competitionStart: string | null;
  competitionEnd:   string | null;
}

export interface CTFFeedEventDTO {
  competitionId:  string;
  teamId:         string;
  teamName:       string;
  avatarColor:    string;
  challengeId:    string;
  challengeTitle: string;
  pointsAwarded:  number;
  solvedAt:       string;
}

export interface CTFCompetitionChallengeDTO {
  id:                  string;
  title:               string;
  description:         string;
  category:            string;
  difficulty:          "EASY" | "MEDIUM" | "HARD";
  basePoints:          number;
  currentPoints?:      number;
  flagFormat:          string;
  flagType?:           "STATIC" | "DYNAMIC";
  requiresInstance:    boolean;
  dockerImage?:        string | null;
  dockerExposedPort?:  number | null;
  connectionType?:     "HTTP" | "TCP" | null;
  dockerFlagEnv?:      string | null;
  dockerEnvVars?:      Record<string, string> | null;
  dockerMemoryMb?:     number | null;
  dockerCpuPercent?:   number | null;
  dockerPidsLimit?:    number | null;
  downloadableFileUrl: string | null;
  downloadableFileName:string | null;
  hints:               CTFHintDTO[];
  maxAttempts:         number | null; // null = unlimited
  isActive:            boolean;
  isHidden?:           boolean | null;
  solveCount:          number;
  solvedByMe:          boolean;
}

export interface CTFCompetitionSubmitResponse {
  correct:          boolean;
  message:          string;
  pointsAwarded:    number | null;
  newRank:          number | null;
  attemptsUsed:     number;
  attemptsRemaining: number | null; // null = unlimited
  lockedOut:        boolean;
}

export interface CTFAttemptDTO {
  id:            string;
  submittedAt:   string; // ISO-8601
  correct:       boolean;
  flagMasked:    string;
  attemptNumber: number;
}

export const getMyCtfAttempts = (competitionId: string, challengeId: string) =>
  apiClient<CTFAttemptDTO[]>(
    `/api/ctf/competitions/${competitionId}/challenges/${challengeId}/my-attempts`,
    { method: "GET" },
    { silentErrors: true },
  );

export const getCtfCompetitions = () =>
  apiClient<CTFCompetitionDTO[]>("/api/ctf/competitions", { method: "GET" });

export const joinCtfByAccessCode = (accessCode: string) =>
  apiClient<CTFCompetitionDTO>("/api/ctf/competitions/join", {
    method: "POST",
    body: JSON.stringify({ accessCode }),
  }, { silentErrors: true });

export const getCtfCompetition = (id: string) =>
  apiClient<CTFCompetitionDTO>(`/api/ctf/competitions/${id}`, { method: "GET" });

/**
 * Returns the state-aware challenge list. Shape depends on competition status:
 *   UPCOMING → empty challenges + categoryCounts (for locked previews)
 *   ACTIVE / FROZEN / PAUSED / ENDED → full challenge list
 */
export const getCtfCompetitionChallenges = (competitionId: string) =>
  apiClient<CTFChallengeListResponse>(`/api/ctf/competitions/${competitionId}/challenges`, { method: "GET" });

export const getCtfCompetitionStatus = (competitionId: string) =>
  apiClient<CTFCompetitionStatusPayload>(`/api/ctf/competitions/${competitionId}/status`, { method: "GET" }, { silentErrors: true });

// ── CTF Notifications ────────────────────────────────────────────────────────

export type CTFNotificationType =
  | "COMPETITION_STARTED"
  | "COMPETITION_PAUSED"
  | "COMPETITION_RESUMED"
  | "COMPETITION_ENDING_SOON"
  | "COMPETITION_ENDED"
  | "NEW_CHALLENGE"
  | "CHALLENGE_UPDATED"
  | "HINT_ADDED"
  | "SCOREBOARD_FROZEN"
  | "SCOREBOARD_UNFROZEN"
  | "TEAM_DISQUALIFIED"
  | "CUSTOM";

export interface CTFNotificationDTO {
  id:             string;
  competitionId:  string | null;
  type:           CTFNotificationType;
  title:          string;
  body:           string | null;
  metadata:       Record<string, unknown> | null;
  sentAt:         string;
}

export const getCtfNotifications = (competitionId: string) =>
  apiClient<CTFNotificationDTO[]>(`/api/ctf/competitions/${competitionId}/notifications`, { method: "GET" }, { silentErrors: true });

export const broadcastTeacherCtfMessage = (competitionId: string, title: string, body: string) =>
  apiClient<CTFNotificationDTO>(
    `/api/teacher/ctf/competitions/${competitionId}/notify`,
    { method: "POST", body: JSON.stringify({ title, body }) },
  );

export const getChallengeSolvers = (competitionId: string, challengeId: string) =>
  apiClient<CTFChallengeSolverDTO[]>(
    `/api/ctf/competitions/${competitionId}/challenges/${challengeId}/solvers`,
    { method: "GET" },
  );

export const getCtfTeamProfile = (competitionId: string, teamId: string) =>
  apiClient<CTFTeamProfileDTO>(
    `/api/ctf/competitions/${competitionId}/teams/${teamId}/profile`,
    { method: "GET" },
  );

export const getCtfScoreboard = (competitionId: string) =>
  apiClient<CTFScoreboardEntryDTO[]>(`/api/ctf/competitions/${competitionId}/scoreboard`, { method: "GET" });

/** Admin/teacher only — always returns live data, ignores freeze timestamp. */
export const getCtfScoreboardLive = (competitionId: string) =>
  apiClient<CTFScoreboardEntryDTO[]>(`/api/ctf/admin/competitions/${competitionId}/scoreboard/live`, { method: "GET" });

export const getCtfScoreboardGraph = (competitionId: string, topN = 10) =>
  apiClient<CTFScoreTimelineDTO>(
    `/api/ctf/competitions/${competitionId}/scoreboard/graph?topN=${topN}`,
    { method: "GET" },
  );

export const getCtfFeed = (competitionId: string) =>
  apiClient<CTFFeedEventDTO[]>(`/api/ctf/competitions/${competitionId}/feed`, { method: "GET" });

export const submitCtfCompetitionFlag = (competitionId: string, challengeId: string, flag: string) =>
  apiClient<CTFCompetitionSubmitResponse>(
    `/api/ctf/competitions/${competitionId}/challenges/${challengeId}/submit`,
    { method: "POST", body: JSON.stringify({ flag }) },
    { silentErrors: true }
  );

export const getCtfMyTeam = (competitionId: string) =>
  apiClient<CTFTeamResponse | null>(`/api/ctf/competitions/${competitionId}/teams/mine`,
    { method: "GET" }, { silentErrors: true });

export const createCtfTeam = (competitionId: string, data: { name: string; avatarColor?: string }) =>
  apiClient<CTFTeamResponse>(`/api/ctf/competitions/${competitionId}/teams`, {
    method: "POST",
    body: JSON.stringify(data),
  });

export const joinCtfTeam = (competitionId: string, inviteCode: string) =>
  apiClient<CTFTeamResponse>(`/api/ctf/competitions/${competitionId}/teams/join`, {
    method: "POST",
    body: JSON.stringify({ inviteCode }),
  });

export const leaveCtfTeam = (competitionId: string) =>
  apiClient<void>(`/api/ctf/competitions/${competitionId}/teams/mine/leave`, { method: "DELETE" });

export const kickCtfTeamMember = (competitionId: string, targetUserId: string) =>
  apiClient<void>(`/api/ctf/competitions/${competitionId}/teams/mine/kick/${targetUserId}`, { method: "DELETE" });

export const transferCtfCaptaincy = (competitionId: string, newCaptainId: string) =>
  apiClient<CTFTeamResponse>(`/api/ctf/competitions/${competitionId}/teams/mine/transfer`, {
    method: "POST",
    body: JSON.stringify({ newCaptainId }),
  });

// ── Teacher: CTF Competition management ──────────────────────────────────────

export interface CTFCompetitionCreateRequest {
  title:              string;
  description?:       string;
  timingMode?:        "SCHEDULED" | "DURATION" | "MANUAL" | "REGISTRATION";
  startTime?:         string;   // ISO local datetime — not required for MANUAL/REGISTRATION
  endTime?:           string;   // not required for DURATION, MANUAL, or REGISTRATION
  durationHours?:     number;   // total minutes for DURATION/REGISTRATION mode (despite the name)
  registrationOpen?:  boolean;
  maxTeamSize?:       number;
  minTeamSize?:       number;
  scoringMode?:       "STATIC" | "DYNAMIC";
  dynamicMinPoints?:  number;
  dynamicDecayFactor?: number;
  visibility?:        "PUBLIC" | "ACCESS_CODE" | "INVITE_ONLY";
  accessCode?:        string;
  bannerUrl?:         string;
}

export type CTFCompetitionUpdateRequest = Partial<CTFCompetitionCreateRequest> & {
  isActive?: boolean;
};

export const listTeacherCtfCompetitions = () =>
  apiClient<CTFCompetitionDTO[]>("/api/teacher/ctf/competitions", { method: "GET" });

export const getTeacherCtfCompetition = (id: string) =>
  apiClient<CTFCompetitionDTO>(`/api/teacher/ctf/competitions/${id}`, { method: "GET" });

export const createTeacherCtfCompetition = (data: CTFCompetitionCreateRequest) =>
  apiClient<CTFCompetitionDTO>("/api/teacher/ctf/competitions", {
    method: "POST",
    body: JSON.stringify(data),
  });

export const updateTeacherCtfCompetition = (id: string, data: CTFCompetitionUpdateRequest) =>
  apiClient<CTFCompetitionDTO>(`/api/teacher/ctf/competitions/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });

export async function uploadCtfCoverImage(
  id: string,
  file: File,
): Promise<{ coverImageUrl: string }> {
  const base = getApiBaseUrl();
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  const fd = new FormData();
  fd.append("image", file);
  const res = await fetch(`${base}/api/teacher/ctf/competitions/${id}/cover`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: fd,
  });
  if (!res.ok) {
    const msg = await res.text().catch(() => "Upload failed");
    throw new Error(msg);
  }
  return res.json();
}

// ── Teacher: lifecycle controls ──────────────────────────────────────────────

export const pauseTeacherCtfCompetition = (id: string) =>
  apiClient<CTFCompetitionDTO>(`/api/teacher/ctf/competitions/${id}/pause`, { method: "POST" });

export const resumeTeacherCtfCompetition = (id: string) =>
  apiClient<CTFCompetitionDTO>(`/api/teacher/ctf/competitions/${id}/resume`, { method: "POST" });

export const freezeTeacherCtfCompetition = (id: string) =>
  apiClient<CTFCompetitionDTO>(`/api/teacher/ctf/competitions/${id}/freeze`, { method: "POST" });

export const unfreezeTeacherCtfCompetition = (id: string) =>
  apiClient<CTFCompetitionDTO>(`/api/teacher/ctf/competitions/${id}/unfreeze`, { method: "POST" });

export const startManualCtfCompetition = (id: string) =>
  apiClient<CTFCompetitionDTO>(`/api/teacher/ctf/competitions/${id}/start`, { method: "POST" });

export const endTeacherCtfCompetition = (id: string) =>
  apiClient<CTFCompetitionDTO>(`/api/teacher/ctf/competitions/${id}/end`, { method: "POST" });

// ── Teacher: per-competition challenge management ────────────────────────────

/** Teacher CTF challenge create — narrower than the legacy {@link CTFChallengeCreateRequest}. */
export interface TeacherCtfChallengeCreateRequest {
  title:                string;
  description:          string;
  category:             string;
  difficulty:           "EASY" | "MEDIUM" | "HARD";
  basePoints:           number;
  flagType?:            "STATIC" | "DYNAMIC";
  plainFlag?:           string;
  flagFormat?:          string;
  requiresInstance?:    boolean;
  dockerImage?:         string;
  dockerExposedPort?:   number;
  containerEnvVars?:    string;
  dockerFlagEnv?:       string;
  connectionType?:      "HTTP" | "TCP";
  dockerEnvVars?:       Record<string, string>;
  dockerMemoryMb?:      number;
  dockerCpuPercent?:    number;
  dockerPidsLimit?:     number;
  downloadableFileUrl?: string;
  downloadableFileName?:string;
  maxAttempts?:         number | null; // null = unlimited; 0 also treated as unlimited by backend
  isActive?:            boolean;
  hints?:               { cost: number; text: string }[];
}

export type TeacherCtfChallengeUpdateRequest = Partial<Omit<TeacherCtfChallengeCreateRequest, "plainFlag">>;

export const getTeacherCtfCompetitionChallenges = (competitionId: string) =>
  apiClient<CTFCompetitionChallengeDTO[]>(
    `/api/teacher/ctf/competitions/${competitionId}/challenges`,
    { method: "GET" },
  );

export const addTeacherCtfChallenge = (competitionId: string, data: TeacherCtfChallengeCreateRequest) =>
  apiClient<CTFCompetitionChallengeDTO>(`/api/teacher/ctf/competitions/${competitionId}/challenges`, {
    method: "POST",
    body: JSON.stringify(data),
  });

export const updateTeacherCtfChallenge = (
  competitionId: string, challengeId: string, data: TeacherCtfChallengeUpdateRequest,
) =>
  apiClient<CTFCompetitionChallengeDTO>(
    `/api/teacher/ctf/competitions/${competitionId}/challenges/${challengeId}`,
    { method: "PUT", body: JSON.stringify(data) },
  );

export const rotateTeacherCtfChallengeFlag = (
  competitionId: string, challengeId: string, newFlag: string,
) =>
  apiClient<CTFCompetitionChallengeDTO>(
    `/api/teacher/ctf/competitions/${competitionId}/challenges/${challengeId}/flag`,
    { method: "PATCH", body: JSON.stringify({ newFlag }) },
  );

export const revealTeacherCtfChallenge = (competitionId: string, challengeId: string) =>
  apiClient<CTFCompetitionChallengeDTO>(
    `/api/teacher/ctf/competitions/${competitionId}/challenges/${challengeId}/reveal`,
    { method: "POST" },
  );

export const hideTeacherCtfChallenge = (competitionId: string, challengeId: string) =>
  apiClient<CTFCompetitionChallengeDTO>(
    `/api/teacher/ctf/competitions/${competitionId}/challenges/${challengeId}/hide`,
    { method: "POST" },
  );

export const addTeacherCtfHint = (
  competitionId: string, challengeId: string, hint: { cost: number; text: string },
) =>
  apiClient<CTFCompetitionChallengeDTO>(
    `/api/teacher/ctf/competitions/${competitionId}/challenges/${challengeId}/hints`,
    { method: "POST", body: JSON.stringify(hint) },
  );

export const deleteTeacherCtfHint = (
  competitionId: string, challengeId: string, hintId: string,
) =>
  apiClient<CTFCompetitionChallengeDTO>(
    `/api/teacher/ctf/competitions/${competitionId}/challenges/${challengeId}/hints/${hintId}`,
    { method: "DELETE" },
  );

// ── Teacher: challenge library ────────────────────────────────────────────────

export interface CTFLibraryChallengeDTO {
  id:                  string;
  title:               string;
  description:         string;
  category:            string;
  difficulty:          "EASY" | "MEDIUM" | "HARD";
  basePoints:          number;
  flagType?:           "STATIC" | "DYNAMIC";
  flagFormat:          string;
  requiresInstance:    boolean;
  dockerImage?:        string | null;
  dockerExposedPort?:  number | null;
  connectionType?:     "HTTP" | "TCP" | null;
  dockerFlagEnv?:      string | null;
  dockerEnvVars?:      Record<string, string> | null;
  dockerMemoryMb?:     number | null;
  dockerCpuPercent?:   number | null;
  dockerPidsLimit?:    number | null;
  downloadableFileUrl: string | null;
  hints:               CTFHintDTO[];
  maxAttempts:         number | null; // null = unlimited
  buildStatus?:        string | null;
  builtImageTag?:      string | null;
  useCount:            number;
  createdAt:           string;
}

export const getCtfLibrary = () =>
  apiClient<CTFLibraryChallengeDTO[]>("/api/teacher/ctf/library", { method: "GET" });

export const createCtfLibraryChallenge = (data: TeacherCtfChallengeCreateRequest) =>
  apiClient<CTFLibraryChallengeDTO>("/api/teacher/ctf/library", {
    method: "POST",
    body: JSON.stringify(data),
  });

export const updateCtfLibraryChallenge = (id: string, data: TeacherCtfChallengeCreateRequest) =>
  apiClient<CTFLibraryChallengeDTO>(`/api/teacher/ctf/library/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });

export const addLibraryChallengeToCompetition = (libraryId: string, competitionId: string) =>
  apiClient<CTFCompetitionChallengeDTO>(`/api/teacher/ctf/library/${libraryId}/add-to/${competitionId}`, {
    method: "POST",
  });

export const deleteCtfLibraryChallenge = (libraryId: string) =>
  apiClient<void>(`/api/teacher/ctf/library/${libraryId}`, { method: "DELETE" });

// ── Teacher: management dashboard reads ──────────────────────────────────────

export interface CTFTeacherOverviewDTO {
  competitionId: string;
  title: string;
  status: CTFCompetitionStatus;
  startTime: string;
  endTime: string;
  pausedAt: string | null;
  frozenAt: string | null;
  isPaused: boolean;
  isFrozen: boolean;
  teamCount: number;
  participantCount: number;
  solveCount: number;
  attemptCount: number;
  cheatCount: number;
  challengeCount: number;
  hiddenChallengeCount: number;
  recentEvents: {
    type: "SOLVE" | "CHEAT" | "NEW_TEAM";
    at: string;
    teamName: string;
    avatarColor: string;
    detail: string;
    points: number | null;
  }[];
}

export interface CTFTeacherTeamDTO {
  id: string;
  name: string;
  avatarColor: string;
  captainId: string | null;
  captainName: string | null;
  members: CTFTeamMemberDTO[];
  totalPoints: number;
  solveCount: number;
  lastSolveAt: string | null;
  createdAt: string;
  isDisqualified: boolean;
  disqualifiedAt: string | null;
  disqualifiedReason: string | null;
}

export interface CTFTeacherSubmissionDTO {
  id: string;
  teamId: string;
  teamName: string;
  avatarColor: string;
  challengeId: string;
  challengeTitle: string;
  challengeCategory: string | null;
  solvedByUserId: string | null;
  solvedByName: string;
  pointsAwarded: number;
  correct: boolean;
  cheatFlagged: boolean;
  submittedValue: string | null;
  at: string;
}

export interface CTFTeacherCheatDTO {
  id: string;
  competitionId: string;
  challengeId: string;
  challengeTitle: string;
  challengeCategory: string | null;
  submittingTeamId: string;
  submittingTeamName: string;
  submittingTeamAccentColor: string | null;
  submittingUserId: string | null;
  submittingUserName: string | null;
  submittingUserEmail: string | null;
  sourceTeamId: string;
  sourceTeamName: string;
  sourceTeamAccentColor: string | null;
  submittedValue: string;
  detectedAt: string;
  dismissed: boolean;
  dismissedByUsername: string | null;
  submittingTeamDisqualified: boolean;
}

export const getTeacherCtfOverview = (id: string) =>
  apiClient<CTFTeacherOverviewDTO>(`/api/teacher/ctf/competitions/${id}/overview`, { method: "GET" });

export const getTeacherCtfTeams = (id: string) =>
  apiClient<CTFTeacherTeamDTO[]>(`/api/teacher/ctf/competitions/${id}/teams`, { method: "GET" });

export const getTeacherCtfSubmissions = (id: string, limit = 200) =>
  apiClient<CTFTeacherSubmissionDTO[]>(
    `/api/teacher/ctf/competitions/${id}/submissions?limit=${limit}`, { method: "GET" });

export const getTeacherCtfCheats = (id: string) =>
  apiClient<CTFTeacherCheatDTO[]>(`/api/teacher/ctf/competitions/${id}/cheats`, { method: "GET" });

export const dismissTeacherCtfCheat = (id: string, cheatId: string) =>
  apiClient<CTFTeacherCheatDTO>(
    `/api/teacher/ctf/competitions/${id}/cheats/${cheatId}/dismiss`, { method: "POST" });

export const disqualifyTeacherCtfTeam = (id: string, teamId: string, reason?: string) =>
  apiClient<CTFTeacherTeamDTO>(
    `/api/teacher/ctf/competitions/${id}/teams/${teamId}/disqualify`,
    { method: "POST", body: JSON.stringify({ reason: reason ?? null }) },
  );

/** Triggers a CSV download of the competition's cheat events log. */
export async function downloadTeacherCtfCheatsExport(id: string): Promise<void> {
  const token = getToken();
  const res = await fetch(`${getApiBaseUrl()}/api/teacher/ctf/competitions/${id}/cheats/export`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error(`Export failed: ${res.status}`);
  const blob = await res.blob();
  const cd = res.headers.get("content-disposition") ?? "";
  const m = cd.match(/filename="?([^"]+)"?/);
  const filename = m?.[1] ?? `cheats-${id}.csv`;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

/** Triggers a CSV download of the competition's scoreboard + submissions log. */
export async function downloadTeacherCtfExport(id: string): Promise<void> {
  const token = getToken();
  const res = await fetch(`${getApiBaseUrl()}/api/teacher/ctf/competitions/${id}/export`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error(`Export failed: ${res.status}`);
  const blob = await res.blob();
  const cd = res.headers.get("content-disposition") ?? "";
  const m = cd.match(/filename="?([^"]+)"?/);
  const filename = m?.[1] ?? `ctf-export-${id}.csv`;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

// ── Challenge build / packaging ───────────────────────────────────────────────

export interface CTFChallengeBuildDTO {
  id: string;
  challengeId: string;
  sourceType: "ZIP" | "REGISTRY";
  zipOriginalName: string | null;
  registryUrl: string | null;
  builtImageTag: string | null;
  buildStatus: "PENDING" | "BUILDING" | "READY" | "FAILED" | "PULLING" | "OUTDATED";
  buildLog: string | null;
  buildStartedAt: string | null;
  buildFinishedAt: string | null;
  imageSizeMb: number | null;
  version: number;
  errorMessage: string | null;
}

export interface CTFBuildWebSocketMessage {
  buildId: string;
  challengeId: string;
  status: "BUILDING" | "PULLING" | "READY" | "FAILED";
  imageTag: string | null;
  imageSizeMb: number | null;
  error: string | null;
  /** TCP port auto-detected from the image's EXPOSE instruction. */
  detectedPort?: number | null;
}

export const uploadCTFChallengeZip = (
  _competitionId: string,
  challengeId: string,
  file: File,
  onProgress?: (pct: number) => void,
): Promise<{ buildId: string; status: string; message: string }> => {
  const token = getToken();
  const form = new FormData();
  form.append("file", file);
  const url = `${getApiBaseUrl()}/api/teacher/ctf/challenges/${challengeId}/upload`;

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);

    if (onProgress) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
      };
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try { resolve(JSON.parse(xhr.responseText)); }
        catch { reject(new Error("Invalid server response")); }
      } else {
        let message = `Upload failed: ${xhr.status}`;
        try {
          const raw = JSON.parse(xhr.responseText);
          message = raw.message ?? raw.error ?? message;
        } catch { /* ignore */ }
        reject(new Error(message));
      }
    };

    xhr.onerror = () => reject(new Error("Network error during upload."));
    xhr.send(form);
  });
};

export const setCTFChallengeRegistry = (challengeId: string, registryUrl: string) =>
  apiClient<{ buildId: string; status: string; message: string }>(
    `/api/teacher/ctf/challenges/${challengeId}/registry`,
    { method: "POST", body: JSON.stringify({ registryUrl }) },
  );

export const getCTFChallengeBuildStatus = (challengeId: string) =>
  apiClient<CTFChallengeBuildDTO>(
    `/api/teacher/ctf/challenges/${challengeId}/build-status`,
    { method: "GET" },
  );

export const getCTFChallengeBuildLog = (challengeId: string) =>
  apiClient<string>(`/api/teacher/ctf/challenges/${challengeId}/build-log`, { method: "GET" });
