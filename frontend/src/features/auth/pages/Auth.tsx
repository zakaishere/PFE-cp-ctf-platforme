"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, CheckCircle2, RefreshCw, ArrowLeft, Loader2, Trophy, Code2, Shield } from "lucide-react";
import { useAuth } from "@/features/auth/contexts/AuthContext";
import { Alert } from "@/components/ui/PSPAlert";
import { CyberBackground } from "@/components/ui/CyberBackground";
import { APP_NAME } from "@/lib/brand";
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
      {error && (
        <div key={error} className="alert-shake" style={{ marginBottom: 14 }}>
          <Alert variant="error" message={error} compact onDismiss={() => setError("")} />
        </div>
      )}
      <FInput label="Email address" type="email" placeholder="you@university.ma" error={errors.email?.message} {...register("email")} />
      <FInput label="Password" type="password" placeholder="Enter your password" error={errors.password?.message} {...register("password")} />
      <a onClick={onForgot} style={{ display: "block", textAlign: "right", fontSize: 12, color: "var(--brand)", marginBottom: 16, cursor: "pointer" }}>Forgot password?</a>
      <div className="auth-submit"><FBtn loading={loading} type="submit">Sign In</FBtn></div>
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
      {error && <div style={{ marginBottom: 8 }}><Alert variant="error" message={error} compact onDismiss={() => setError("")} /></div>}
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

      {error && <div style={{ marginBottom: 14 }}><Alert variant="error" message={error} compact onDismiss={() => setError("")} /></div>}

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
          <div style={{ marginBottom: 14 }}>
            <Alert
              variant="info"
              title="Pending approval"
              message="Teacher accounts require administrator approval before you can log in."
            />
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
          {error && <div style={{ marginBottom: 8 }}><Alert variant="error" message={error} compact onDismiss={() => setError("")} /></div>}
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
          {error && <div style={{ marginBottom: 8 }}><Alert variant="error" message={error} compact onDismiss={() => setError("")} /></div>}
          <FBtn loading={loading} type="submit">Reset Password</FBtn>
        </form>
      )}
    </div>
  );
}

/* ── PAGE ── */
const FEATURES = [
  { icon: <Trophy size={14} />, text: "ICPC-style CP competitions & live exams" },
  { icon: <Code2 size={14} />,  text: "Real-time judge with 6 languages" },
  { icon: <Shield size={14} />, text: "CTF challenges & security labs" },
];

export default function AuthPage() {
  const [mode, setMode] = useState<Mode>("login");

  const heading =
    mode === "login" ? "Welcome back" : mode === "register" ? "Create your account" : null;
  const subheading =
    mode === "login" ? `Sign in to your ${APP_NAME} account` : mode === "register" ? `Join ${APP_NAME}` : null;

  return (
    <div className="auth-shell">
      {/* ── LEFT — Branding panel ── */}
      <div className="auth-left">
        <CyberBackground hexCount={10} />
        <div className="auth-left-grid auth-grid-drift" />
        <div className="auth-glow auth-glow-1" />
        <div className="auth-glow auth-glow-2" />

        <Link href="/" className="auth-logo slide-up" style={{ animationDelay: "0ms" }}>
          <img src="/algora-logo-full.png" alt={APP_NAME} className="auth-logo-img auth-logo-breathe" />
        </Link>

        <div className="auth-pitch">
          <h1 className="slide-up" style={{ animationDelay: "80ms" }}>
            Compete, code<br />
            and <span>level up</span><br />
            — all in one place.
          </h1>
          <p className="slide-up" style={{ animationDelay: "160ms" }}>
            Sign in to access competitions, exams, CTF challenges,
            and track your progress in real time.
          </p>
          {FEATURES.map(({ icon, text }, i) => (
            <div key={text} className="auth-feature slide-up" style={{ animationDelay: `${220 + i * 60}ms` }}>
              <div className="auth-feature-icon">{icon}</div>
              <span>{text}</span>
            </div>
          ))}
        </div>

        <p className="auth-credit slide-up" style={{ animationDelay: "420ms" }}>Built for iCODE Club · FST Tétouan</p>
      </div>

      {/* ── RIGHT — Form panel ── */}
      <div className="auth-right">
        <div className="auth-form-wrap auth-slide-in-right" style={{ maxWidth: mode === "register" ? 480 : 380 }}>
          {mode === "forgot" ? (
            <ForgotFlow onBack={() => setMode("login")} />
          ) : (
            <>
              <div style={{ marginBottom: 28 }}>
                <div style={{ fontSize: 24, fontWeight: 800, color: "var(--ink)", letterSpacing: "-0.5px", marginBottom: 6 }}>
                  {heading}
                </div>
                <div style={{ fontSize: 14, color: "var(--ink-2)" }}>{subheading}</div>
              </div>

              {mode === "login"
                ? <LoginForm onForgot={() => setMode("forgot")} onRegister={() => setMode("register")} />
                : <RegisterForm onLogin={() => setMode("login")} />
              }
            </>
          )}
        </div>
      </div>

      <style jsx>{`
        .auth-shell {
          min-height: 100vh;
          display: grid;
          grid-template-columns: 440px 1fr;
          background: var(--bg);
        }
        .auth-left {
          position: relative;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          padding: 40px 44px;
          overflow: hidden;
          background: linear-gradient(135deg, var(--bg-2) 0%, var(--bg) 60%, var(--bg-2) 100%);
          border-right: 1px solid var(--line);
        }
        .auth-left-grid {
          position: absolute; inset: 0;
          background-image: radial-gradient(circle, var(--accent-dim) 1px, transparent 1px);
          background-size: 28px 28px;
          pointer-events: none;
        }
        .auth-glow {
          position: absolute; border-radius: 50%; pointer-events: none;
          background: radial-gradient(circle, var(--accent-dim) 0%, transparent 70%);
        }
        .auth-glow-1 { width: 380px; height: 380px; top: -100px; left: -100px; }
        .auth-glow-2 { width: 280px; height: 280px; bottom: 40px; right: -60px; }
        .auth-logo {
          position: relative; z-index: 1;
          display: flex; align-items: center; justify-content: center; gap: 10px;
          color: var(--ink); font-weight: 700; font-size: 16px; text-decoration: none;
        }
        .auth-logo-img {
          width: 130px; object-fit: contain;
          filter: drop-shadow(0 0 20px var(--accent-glow));
        }
        .auth-pitch { position: relative; z-index: 1; }
        .auth-pitch h1 {
          font-size: 32px; font-weight: 800; color: var(--ink);
          line-height: 1.18; letter-spacing: -0.5px; margin: 0 0 14px;
        }
        .auth-pitch h1 span { color: var(--accent); }
        .auth-pitch p {
          font-size: 14px; color: var(--ink-2); line-height: 1.6;
          margin: 0 0 28px; max-width: 320px;
        }
        .auth-feature {
          display: flex; align-items: center; gap: 10px; margin-bottom: 12px;
          font-size: 13px; color: var(--ink-2);
        }
        .auth-feature-icon {
          width: 24px; height: 24px; border-radius: 6px; flex-shrink: 0;
          background: var(--accent-dim); border: 1px solid var(--line-2);
          display: flex; align-items: center; justify-content: center;
          color: var(--accent);
        }
        .auth-credit {
          position: relative; z-index: 1;
          font-size: 12px; color: var(--ink-3);
          font-family: var(--font-mono), monospace;
          margin: 0;
        }
        .auth-right {
          display: flex; align-items: center; justify-content: center;
          padding: 40px 32px;
        }
        .auth-form-wrap { width: 100%; }

        @media (max-width: 900px) {
          .auth-shell { grid-template-columns: 1fr; }
          .auth-left { padding: 28px 28px 24px; }
          .auth-pitch h1 { font-size: 24px; }
          .auth-pitch p { margin-bottom: 18px; }
          .auth-feature { display: none; }
          .auth-credit { display: none; }
        }
      `}</style>
    </div>
  );
}
