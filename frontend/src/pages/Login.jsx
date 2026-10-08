import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { getErrorMessage } from "../api/axios";
import GoogleAuthButton from "../components/GoogleAuthButton";
import { Spinner } from "../components/Spinner";
import { useAuth } from "../context/AuthContext";
import { isValidEmail } from "../utils/format";

export default function Login() {
  const { login, isAuthenticated, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!loading && isAuthenticated) {
    return <Navigate to={location.state?.from || "/"} replace />;
  }

  const validate = () => {
    const next = {};
    if (!email.trim()) next.email = "Email is required.";
    else if (!isValidEmail(email.trim())) next.email = "Please enter a valid email address.";
    if (!password) next.password = "Password is required.";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = async (e) => {
    e.preventDefault();
    setServerError("");
    if (!validate()) return;
    setSubmitting(true);
    try {
      await login(email.trim(), password);
      navigate(location.state?.from || "/", { replace: true });
    } catch (err) {
      setServerError(getErrorMessage(err, "Login failed. Please try again."));
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass = (hasError) =>
    `w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 ${
      hasError
        ? "border-red-300 focus:border-red-500 focus:ring-red-100"
        : "border-slate-300 focus:border-brand-500 focus:ring-brand-100"
    }`;

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-brand-100 via-slate-100 to-indigo-200 px-4">
      {/* decorative blurred blobs */}
      <div aria-hidden className="pointer-events-none absolute -left-24 -top-24 h-80 w-80 rounded-full bg-brand-300/40 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute -bottom-24 -right-24 h-80 w-80 rounded-full bg-indigo-300/40 blur-3xl" />

      <div className="relative w-full max-w-md animate-fade-in-up">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-brand-600 to-indigo-600 text-white shadow-lg">
            <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-slate-800">Welcome back</h1>
          <p className="mt-1 text-sm text-slate-500">Sign in to your TaskFlow account</p>
        </div>

        <form
          onSubmit={submit}
          className="rounded-2xl border border-white/60 bg-white/90 p-6 shadow-xl backdrop-blur"
          noValidate
        >
          {serverError && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {serverError}
            </div>
          )}

          <GoogleAuthButton onError={setServerError} />

          <label className="mb-1 block text-sm font-medium text-slate-700">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
            className={inputClass(errors.email)}
          />
          {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email}</p>}

          <label className="mb-1 mt-4 block text-sm font-medium text-slate-700">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            autoComplete="current-password"
            className={inputClass(errors.password)}
          />
          {errors.password && <p className="mt-1 text-xs text-red-600">{errors.password}</p>}

          <button type="submit" disabled={submitting} className="btn-primary mt-6 w-full py-2.5">
            {submitting && <Spinner className="h-4 w-4" />}
            Sign In
          </button>

          <p className="mt-4 text-center text-sm text-slate-500">
            Don't have an account?{" "}
            <Link to="/register" className="font-medium text-brand-600 hover:underline">
              Create one
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
