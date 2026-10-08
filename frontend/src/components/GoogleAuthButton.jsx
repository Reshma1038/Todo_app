import { GoogleLogin } from "@react-oauth/google";
import { useNavigate } from "react-router-dom";
import { getErrorMessage } from "../api/axios";
import { useAuth } from "../context/AuthContext";

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

/** Multicolor Google "G" logo. */
const GoogleLogo = () => (
  <svg className="h-5 w-5" viewBox="0 0 48 48">
    <path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3l5.7-5.7C34.5 6.1 29.5 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.6-.4-3.9z" />
    <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3l5.7-5.7C34.5 6.1 29.5 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
    <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
    <path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C41 35.4 44 30.2 44 24c0-1.3-.1-2.6-.4-3.9z" />
  </svg>
);

/**
 * "Continue with Google" — always visible on the auth pages.
 * When VITE_GOOGLE_CLIENT_ID is configured, the official Google flow runs;
 * otherwise the button explains what needs to be configured.
 */
export default function GoogleAuthButton({ onError, dividerText = "or continue with email" }) {
  const { loginWithGoogle } = useAuth();
  const navigate = useNavigate();

  const handleSuccess = async (credentialResponse) => {
    try {
      await loginWithGoogle(credentialResponse.credential);
      navigate("/", { replace: true });
    } catch (err) {
      onError(getErrorMessage(err, "Google sign-in failed. Please try again."));
    }
  };

  const notConfigured = () =>
    onError(
      "Google sign-in isn't configured yet — set VITE_GOOGLE_CLIENT_ID (frontend .env) and GOOGLE_CLIENT_ID (backend .env), then restart both."
    );

  return (
    <div>
      {CLIENT_ID ? (
        <div className="flex justify-center overflow-hidden rounded-lg [&>div]:w-full">
          <GoogleLogin
            onSuccess={handleSuccess}
            onError={() => onError("Google sign-in was cancelled or failed.")}
            text="continue_with"
            shape="rectangular"
            size="large"
            width="360"
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={notConfigured}
          className="flex w-full items-center justify-center gap-3 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
        >
          <GoogleLogo />
          Continue with Google
        </button>
      )}

      <div className="my-4 flex items-center gap-3">
        <div className="h-px flex-1 bg-slate-200" />
        <span className="text-xs font-medium uppercase tracking-wide text-slate-400">
          {dividerText}
        </span>
        <div className="h-px flex-1 bg-slate-200" />
      </div>
    </div>
  );
}
