import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { getErrorMessage } from "../api/axios";
import { AvatarGrid } from "../components/AvatarPickerModal";
import GoogleAuthButton from "../components/GoogleAuthButton";
import { Spinner } from "../components/Spinner";
import { useAuth } from "../context/AuthContext";
import { isValidEmail } from "../utils/format";

export default function Register() {
  const { register, isAuthenticated, loading } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [avatar, setAvatar] = useState(null);
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!loading && isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const validate = () => {
    const next = {};
    if (!form.name.trim()) next.name = "Name is required.";
    else if (form.name.trim().length < 2) next.name = "Name must be at least 2 characters.";
    if (!form.email.trim()) next.email = "Email is required.";
    else if (!isValidEmail(form.email.trim())) next.email = "Please enter a valid email address.";
    if (!form.password) next.password = "Password is required.";
    else if (form.password.length < 6) next.password = "Password must be at least 6 characters.";
    if (form.confirmPassword !== form.password) next.confirmPassword = "Passwords do not match.";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = async (e) => {
    e.preventDefault();
    setServerError("");
    if (!validate()) return;
    setSubmitting(true);
    try {
      await register(form.name.trim(), form.email.trim(), form.password, avatar);
      navigate("/", { replace: true });
    } catch (err) {
      setServerError(getErrorMessage(err, "Registration failed. Please try again."));
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

  const field = (key, label, type, placeholder, autoComplete) => (
    <div className="mt-4 first:mt-0">
      <label className="mb-1 block text-sm font-medium text-slate-700">{label}</label>
      <input
        type={type}
        value={form[key]}
        onChange={set(key)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className={inputClass(errors[key])}
      />
      {errors[key] && <p className="mt-1 text-xs text-red-600">{errors[key]}</p>}
    </div>
  );

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-brand-100 via-slate-100 to-indigo-200 px-4 py-8">
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
          <h1 className="text-2xl font-bold text-slate-800">Create your account</h1>
          <p className="mt-1 text-sm text-slate-500">Start organizing tasks with your team</p>
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

          <GoogleAuthButton onError={setServerError} dividerText="or sign up with email" />

          {field("name", "Name", "text", "Jane Doe", "name")}
          {field("email", "Email", "email", "you@example.com", "email")}
          {field("password", "Password", "password", "At least 6 characters", "new-password")}
          {field("confirmPassword", "Confirm Password", "password", "Repeat your password", "new-password")}

          <div className="mt-5">
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Choose your avatar <span className="font-normal text-slate-400">(optional)</span>
            </label>
            <AvatarGrid selected={avatar} onSelect={setAvatar} />
          </div>

          <button type="submit" disabled={submitting} className="btn-primary mt-6 w-full py-2.5">
            {submitting && <Spinner className="h-4 w-4" />}
            Create Account
          </button>

          <p className="mt-4 text-center text-sm text-slate-500">
            Already have an account?{" "}
            <Link to="/login" className="font-medium text-brand-600 hover:underline">
              Sign in
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
