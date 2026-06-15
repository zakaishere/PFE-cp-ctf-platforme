"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, CheckCircle2, RefreshCw, ArrowLeft, Loader2 } from "lucide-react";
import { useAuth } from "@/features/auth/contexts/AuthContext";
import { APP_NAME, APP_MARK } from "@/lib/brand";
import {
  registerStudent, registerTeacher, forgotPassword, resetPassword,
  verifyEmail, resendVerification,
  type RegisterStudentRequest, type RegisterTeacherRequest, type LoginRequest,
} from "@/lib/api";

/* ── SCHEMAS ── */
const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1, "Password is required"),
});
const studentSchema = z.object({
  firstName: z.string().min(1, "Required"),
  lastName: z.string().min(1, "Required"),
  email: z.string().email(),
  password: z.string().min(6, "Min 6 characters"),
  apogeeNumber: z.string().min(1, "Required"),
});
const teacherSchema = z.object({
  firstName: z.string().min(1, "Required"),
  lastName: z.string().min(1, "Required"),
  email: z.string().email(),
  password: z.string().min(6, "Min 6 characters"),
  specialty: z.string().optional(),
  department: z.string().optional(),
});
const forgotEmailSchema = z.object({ email: z.string().email() });
const otpSchema = z.object({ code: z.string().length(6, "Must be 6 digits") });
const newPassSchema = z.object({
  password: z.string().min(6),
  confirm: z.string().min(6),
}).refine((d) => d.password === d.confirm, { message: "Passwords don't match", path: ["confirm"] });

type Mode = "login" | "register" | "forgot";

/* ── SHARED INPUT ── */
function FInput({ label, type = "text", placeholder, error, style, ...props }: any) {
  const [show, setShow] = useState(false);
  const isPass = type === "password";
  return (
    <div className="form-field">
      <label className="label">{label}</label>
      <div style={{ position: "relative" }}>
        <input
          type={isPass && show ? "text" : type}
          placeholder={placeholder}
          className={`input${error ? " error" : ""}`}
          style={isPass ? { paddingRight: 36, ...style } : style}
          {...props}
        />
        {isPass && (
          <button type="button" onClick={() => setShow(!show)}
            style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)" }}>
            {show ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        )}
      </div>
      {error && <div className="field-error">{error}</div>}
    </div>
  );
}

function FBtn({ children, loading, ...props }: any) {
  return (
    <button
      className="btn btn-primary btn-block"
      style={{ height: 36 }}
      disabled={loading}
      {...props}
    >
      {loading ? <Loader2 size={14} className="animate-spin" /> : children}
    </button>
  );
}

/* ── LOGIN ── */
function LoginForm({ onForgot, onRegister }: { onForgot: () => void; onRegister: () => void }) {
  const { login } = useAuth();
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { register, handleSubmit, formState: { errors } } = useForm({ resolver: zodResolver(loginSchema), defaultValues: { email: "", password: "" } });

  const onSubmit = async (v: any) => {
    setError(""); setLoading(true);
    try {
      const res = await login(v as LoginRequest);
      if (res.role === "STUDENT") router.push("/dashboard");
      else if (res.role === "TEACHER") router.push("/teacher");
      else if (res.role === "ADMIN") router.push("/admin");
      else router.push("/dashboard");
    } catch (e: any) { setError(e.message || "Login failed"); }
    finally { setLoading(false); }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      {error && <div style={{ background: "var(--red-light)", border: "1px solid #ff8f73", color: "#bf2600", borderRadius: 3, padding: "8px 12px", fontSize: 12, marginBottom: 14 }}>{error}</div>}
      <FInput label="Email address" type="email" placeholder="you@university.ma" error={errors.email?.message} {...register("email")} />
      <FInput label="Password" type="password" placeholder="Enter your password" error={errors.password?.message} {...register("password")} />
      <a onClick={onForgot} style={{ display: "block", textAlign: "right", fontSize: 12, color: "var(--brand)", marginBottom: 16, cursor: "pointer" }}>Forgot password?</a>
      <FBtn loading={loading} type="submit">Sign In</FBtn>
      <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "20px 0", color: "var(--text-muted)", fontSize: 12 }}>
        <div style={{ flex: 1, borderTop: "1px solid var(--border)" }} /> or <div style={{ flex: 1, borderTop: "1px solid var(--border)" }} />
      </div>
      <div style={{ textAlign: "center", fontSize: 13, color: "var(--text-muted)" }}>
        Don&apos;t have an account?{" "}
        <a onClick={onRegister} style={{ color: "var(--brand)", cursor: "pointer", fontWeight: 500 }}>Create one</a>
      </div>
    </form>
  );
}

/* ── OTP VERIFY ── */
function EmailVerifyStep({ email, role, onBack }: { email: string; role: "student" | "teacher"; onBack: () => void }) {
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const { register, handleSubmit, formState: { errors } } = useForm({ resolver: zodResolver(z.object({ otpCode: z.string().length(6) })), defaultValues: { otpCode: "" } });

  if (done) return (
    <div style={{ textAlign: "center", padding: "24px 0" }}>
      <div style={{ width: 56, height: 56, background: "var(--green-light)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" }}>
        <CheckCircle2 size={28} color="#00875a" />
      </div>
      <div style={{ fontSize: 14, color: "var(--text-primary)", fontWeight: 600, marginBottom: 8 }}>Email verified!</div>
      <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 20 }}>
        {role === "teacher" ? "Your account is pending admin approval. You'll be notified once activated." : "You can now sign in."}
      </div>
      <button onClick={onBack} style={{ color: "var(--brand)", background: "none", border: "none", cursor: "pointer", fontSize: 13, display: "flex", alignItems: "center", gap: 4, margin: "0 auto" }}>
        <ArrowLeft size={13} /> Back to Sign In
      </button>
    </div>
  );

  return (
    <form onSubmit={handleSubmit(async (v: any) => {
      setError(""); setLoading(true);
      try { await verifyEmail(email, v.otpCode); setDone(true); }
      catch (e: any) { setError(e.message || "Invalid code"); }
      finally { setLoading(false); }
    })}>
      <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 16 }}>
        We sent a 6-digit code to <strong style={{ color: "var(--text-primary)" }}>{email}</strong>.
      </div>
      <FInput label="Verification Code" placeholder="000000" maxLength={6} style={{ textAlign: "center", letterSpacing: "0.4em", fontFamily: "monospace", fontSize: 18 }} error={errors.otpCode?.message} {...register("otpCode")} />
      {error && <div style={{ fontSize: 11, color: "#de350b", marginBottom: 8 }}>{error}</div>}
      <FBtn loading={loading} type="submit">Verify Email</FBtn>
      <button type="button" onClick={async () => { setResending(true); try { await resendVerification(email); } finally { setResending(false); } }}
        style={{ width: "100%", background: "none", border: "none", color: "var(--text-muted)", fontSize: 12, cursor: "pointer", marginTop: 12, display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
        <RefreshCw size={12} className={resending ? "animate-spin" : ""} />
        {resending ? "Resending…" : "Resend code"}
      </button>
    </form>
  );
}

/* ── REGISTER ── */
function RegisterForm({ onLogin }: { onLogin: () => void }) {
  const [roleTab, setRoleTab] = useState<"student" | "teacher">("student");
  const [verifyEmail2, setVerifyEmail2] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const studentForm = useForm({ resolver: zodResolver(studentSchema), defaultValues: { firstName: "", lastName: "", email: "", password: "", apogeeNumber: "" } });
  const teacherForm = useForm({ resolver: zodResolver(teacherSchema), defaultValues: { firstName: "", lastName: "", email: "", password: "", specialty: "", department: "" } });

  if (verifyEmail2) return <EmailVerifyStep email={verifyEmail2} role={roleTab} onBack={() => setVerifyEmail2(null)} />;

  return (
    <div>
      {/* Role tabs */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", border: "1px solid var(--border)", borderRadius: 3, marginBottom: 20, overflow: "hidden" }}>
        {(["student", "teacher"] as const).map((r) => (
          <button key={r} type="button" onClick={() => setRoleTab(r)}
            style={{ padding: 10, textAlign: "center", fontSize: 13, fontWeight: 600, cursor: "pointer", color: roleTab === r ? "white" : "#5e6c84", background: roleTab === r ? "var(--brand)" : "var(--bg-primary)", border: "none", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
            {r === "student" ? "Student" : "Teacher"}
          </button>
        ))}
      </div>

      {error && <div style={{ background: "var(--red-light)", border: "1px solid #ff8f73", color: "#bf2600", borderRadius: 3, padding: "8px 12px", fontSize: 12, marginBottom: 14 }}>{error}</div>}

      {roleTab === "student" ? (
        <form onSubmit={studentForm.handleSubmit(async (v) => {
          setError(""); setLoading(true);
          try {
            const res = await registerStudent(v as RegisterStudentRequest);
            if (res.message?.toLowerCase().includes("bypass")) { onLogin(); } else { setVerifyEmail2(v.email); }
          }
          catch (e: any) { setError(e.message || "Registration failed"); }
          finally { setLoading(false); }
        })}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <FInput label="First Name" placeholder="Ali" error={studentForm.formState.errors.firstName?.message} {...studentForm.register("firstName")} />
            <FInput label="Last Name" placeholder="Benali" error={studentForm.formState.errors.lastName?.message} {...studentForm.register("lastName")} />
          </div>
          <FInput label="University Email" type="email" placeholder="ali@university.ma" error={studentForm.formState.errors.email?.message} {...studentForm.register("email")} />
          <FInput label="Apogee Number" placeholder="e.g. 20210001" error={studentForm.formState.errors.apogeeNumber?.message} {...studentForm.register("apogeeNumber")} />
          <FInput label="Password" type="password" placeholder="Min. 6 characters" error={studentForm.formState.errors.password?.message} {...studentForm.register("password")} />
          <FBtn loading={loading} type="submit">Create Student Account</FBtn>
        </form>
      ) : (
        <form onSubmit={teacherForm.handleSubmit(async (v) => {
          setError(""); setLoading(true);
          try {
            const res = await registerTeacher({ ...v, specialty: v.specialty || null, department: v.department || null } as RegisterTeacherRequest);
            if (res.message?.toLowerCase().includes("bypass")) { onLogin(); } else { setVerifyEmail2(v.email); }
          }
          catch (e: any) { setError(e.message || "Registration failed"); }
          finally { setLoading(false); }
        })}>
          <div style={{ background: "#deebff", border: "1px solid #4c9aff", borderRadius: 3, padding: "10px 12px", fontSize: 12, color: "#0747a6", marginBottom: 14 }}>
            Teacher accounts require administrator approval before you can log in.
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <FInput label="First Name" placeholder="Sara" error={teacherForm.formState.errors.firstName?.message} {...teacherForm.register("firstName")} />
            <FInput label="Last Name" placeholder="Idrissi" error={teacherForm.formState.errors.lastName?.message} {...teacherForm.register("lastName")} />
          </div>
          <FInput label="Email" type="email" placeholder="sara@university.ma" error={teacherForm.formState.errors.email?.message} {...teacherForm.register("email")} />
          <FInput label="Password" type="password" placeholder="Min. 6 characters" error={teacherForm.formState.errors.password?.message} {...teacherForm.register("password")} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <FInput label="Specialty" placeholder="Algorithms" {...teacherForm.register("specialty")} />
            <FInput label="Department" placeholder="Computer Science" {...teacherForm.register("department")} />
          </div>
          <FBtn loading={loading} type="submit">Create Teacher Account</FBtn>
        </form>
      )}
      <div style={{ textAlign: "center", fontSize: 13, color: "var(--text-muted)", marginTop: 16 }}>
        Already have an account?{" "}
        <a onClick={onLogin} style={{ color: "var(--brand)", cursor: "pointer", fontWeight: 500 }}>Sign in</a>
      </div>
    </div>
  );
}

/* ── FORGOT PASSWORD ── */
function ForgotFlow({ onBack }: { onBack: () => void }) {
  const [step, setStep] = useState<"email" | "otp" | "pass" | "done">("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const emailForm = useForm({ resolver: zodResolver(forgotEmailSchema), defaultValues: { email: "" } });
  const otpForm = useForm({ resolver: zodResolver(otpSchema), defaultValues: { code: "" } });
  const passForm = useForm({ resolver: zodResolver(newPassSchema), defaultValues: { password: "", confirm: "" } });

  if (step === "done") return (
    <div style={{ textAlign: "center", padding: "24px 0" }}>
      <div style={{ width: 56, height: 56, background: "var(--green-light)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" }}>
        <CheckCircle2 size={28} color="#00875a" />
      </div>
      <div style={{ fontSize: 14, color: "var(--text-primary)", fontWeight: 600, marginBottom: 8 }}>Password reset!</div>
      <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 20 }}>You can now sign in with your new password.</div>
      <button onClick={onBack} style={{ color: "var(--brand)", background: "none", border: "none", cursor: "pointer", fontSize: 13, display: "flex", alignItems: "center", gap: 4, margin: "0 auto" }}>
        <ArrowLeft size={13} /> Back to Sign In
      </button>
    </div>
  );

  return (
    <div>
      <button onClick={onBack} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 13, color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer", marginBottom: 16 }}>
        <ArrowLeft size={13} /> Back to Sign In
      </button>
      {step === "email" && (
        <form onSubmit={emailForm.handleSubmit(async (v) => {
          setError(""); setLoading(true);
          try { await forgotPassword(v.email); setEmail(v.email); setStep("otp"); }
          catch (e: any) { setError(e.message || "Failed"); }
          finally { setLoading(false); }
        })}>
          <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 16 }}>Enter your email to receive a reset code.</div>
          <FInput label="Email" type="email" placeholder="you@university.ma" error={emailForm.formState.errors.email?.message} {...emailForm.register("email")} />
          {error && <div style={{ fontSize: 11, color: "#de350b", marginBottom: 8 }}>{error}</div>}
          <FBtn loading={loading} type="submit">Send Reset Code</FBtn>
        </form>
      )}
      {step === "otp" && (
        <form onSubmit={otpForm.handleSubmit(async (v) => { setOtp(v.code); setStep("pass"); })}>
          <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 16 }}>Code sent to <strong>{email}</strong>.</div>
          <FInput label="6-Digit Code" placeholder="000000" maxLength={6} style={{ textAlign: "center", letterSpacing: "0.4em", fontFamily: "monospace", fontSize: 18 }} error={otpForm.formState.errors.code?.message} {...otpForm.register("code")} />
          <FBtn type="submit">Verify Code</FBtn>
        </form>
      )}
      {step === "pass" && (
        <form onSubmit={passForm.handleSubmit(async (v) => {
          setError(""); setLoading(true);
          try { await resetPassword(email, otp, v.password); setStep("done"); }
          catch (e: any) { setError(e.message || "Failed"); }
          finally { setLoading(false); }
        })}>
          <FInput label="New Password" type="password" placeholder="Min. 6 characters" error={passForm.formState.errors.password?.message} {...passForm.register("password")} />
          <FInput label="Confirm Password" type="password" placeholder="Same as above" error={passForm.formState.errors.confirm?.message} {...passForm.register("confirm")} />
          {error && <div style={{ fontSize: 11, color: "#de350b", marginBottom: 8 }}>{error}</div>}
          <FBtn loading={loading} type="submit">Reset Password</FBtn>
        </form>
      )}
    </div>
  );
}

/* ── PAGE ── */
export default function AuthPage() {
  const [mode, setMode] = useState<Mode>("login");

  return (
    <div style={{ background: "var(--bg)", color: "var(--text-primary)", minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      {/* Top bar */}
      <div style={{ background: "var(--bg-2)", height: "var(--nav-h, 62px)", display: "flex", alignItems: "center", padding: "0 24px", borderBottom: "1px solid var(--line)" }}>
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: 10, color: "var(--ink)", fontWeight: 700, fontSize: 16, textDecoration: "none" }}>
          <div style={{ width: 30, height: 30, background: "linear-gradient(150deg, var(--brand), #9db0ff)", borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center", color: "#0a0e18", fontFamily: "var(--font-mono), monospace", fontWeight: 700, fontSize: 13 }}>{APP_MARK}</div>
          {APP_NAME}
        </Link>
      </div>

      {/* Card */}
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 16px" }}>
        <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--r)", width: "100%", maxWidth: mode === "register" ? 480 : 400, padding: 32 }}>
          {mode === "forgot" ? (
            <ForgotFlow onBack={() => setMode("login")} />
          ) : (
            <>
              <div style={{ textAlign: "center", marginBottom: 24 }}>
                <div style={{ width: 48, height: 48, background: "linear-gradient(150deg, var(--brand), #9db0ff)", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px", color: "#0a0e18", fontFamily: "var(--font-mono), monospace", fontWeight: 700, fontSize: 22 }}>{APP_MARK}</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)" }}>
                  {mode === "login" ? "Welcome back" : "Create your account"}
                </div>
                <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>
                  {mode === "login" ? `Sign in to your ${APP_NAME} account` : `Join ${APP_NAME}`}
                </div>
              </div>

              {mode === "login"
                ? <LoginForm onForgot={() => setMode("forgot")} onRegister={() => setMode("register")} />
                : <RegisterForm onLogin={() => setMode("login")} />
              }
            </>
          )}
        </div>
      </div>
    </div>
  );
}
