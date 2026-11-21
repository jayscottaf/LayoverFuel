import { useState } from "react";
import { useLocation, Link } from "wouter";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Eye, EyeOff, Loader2, FlaskConical } from "lucide-react";
import { useAuth } from "@/context/auth-context";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, apiUrl } from "@/lib/queryClient";

const loginSchema = z.object({
  email: z.string().email({ message: "Enter a valid email" }),
  password: z.string().min(1, { message: "Password is required" }),
});

type LoginFormValues = z.infer<typeof loginSchema>;

function GoogleLogo() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.75h3.57c2.08-1.92 3.28-4.74 3.28-8.07z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.75c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.15-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
      <path fill="#FBBC05" d="M5.85 14.12a6.61 6.61 0 0 1 0-4.24V7.05H2.18a11 11 0 0 0 0 9.9l3.67-2.83z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.05l3.67 2.83C6.71 7.31 9.14 5.38 12 5.38z" />
    </svg>
  );
}

export default function Login() {
  const { login, checkAuth } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
    mode: "onBlur",
  });

  const devLogin = async () => {
    setIsSubmitting(true);
    try {
      const res = await apiRequest("POST", "/api/auth/dev-login", {});
      if (res.ok) {
        await checkAuth();
        navigate("/");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const onSubmit = async (data: LoginFormValues) => {
    setIsSubmitting(true);
    try {
      const success = await login(data.email, data.password);
      if (success) {
        navigate("/");
      } else {
        toast({ title: "Login failed", description: "Invalid email or password.", variant: "destructive" });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-8">

        {/* Logo */}
        <div className="text-center">
          <h1 className="text-3xl font-bold text-foreground tracking-tight">LayoverFuel</h1>
          <p className="text-muted-foreground mt-1 text-sm">Eat well wherever travel takes you</p>
        </div>

        {/* Card */}
        <div className="bg-card rounded-[22px] p-6 space-y-5">
          <div>
            <h2 className="text-xl font-semibold text-foreground">Welcome back</h2>
            <p className="text-sm text-muted-foreground mt-0.5">Sign in to your account</p>
          </div>

          <a
            href={apiUrl("/api/auth/google")}
            className="w-full flex items-center justify-center gap-2.5 border border-border bg-white hover:bg-gray-100 text-gray-900 font-medium py-3 rounded-full transition-colors"
          >
            <GoogleLogo />
            Continue with Google
          </a>

          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-secondary" />
            <span className="text-xs text-muted-foreground">or</span>
            <div className="flex-1 h-px bg-secondary" />
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* Email */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-muted-foreground">Email</label>
              <input
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                className="w-full bg-secondary text-foreground text-sm rounded-xl px-4 py-3 border border-border focus:outline-none focus:border-primary placeholder:text-muted-foreground transition-colors"
                {...register("email")}
              />
              {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-muted-foreground">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="w-full bg-secondary text-foreground text-sm rounded-xl px-4 py-3 pr-11 border border-border focus:outline-none focus:border-primary placeholder:text-muted-foreground transition-colors"
                  {...register("password")}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(p => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-muted-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed text-primary-foreground font-semibold py-3 rounded-full transition-colors flex items-center justify-center gap-2"
            >
              {isSubmitting ? <><Loader2 className="h-4 w-4 animate-spin" /> Signing in...</> : "Sign in"}
            </button>
          </form>

          {import.meta.env.DEV && (
            <>
              <div className="flex items-center gap-3 mt-1">
                <div className="flex-1 h-px bg-secondary" />
                <span className="text-xs text-muted-foreground">dev only</span>
                <div className="flex-1 h-px bg-secondary" />
              </div>
              <button
                type="button"
                onClick={devLogin}
                disabled={isSubmitting}
                className="w-full flex items-center justify-center gap-2 bg-secondary hover:bg-accent disabled:opacity-50 text-muted-foreground hover:text-muted-foreground text-sm font-medium py-2.5 rounded-xl transition-colors border border-border"
              >
                <FlaskConical className="h-3.5 w-3.5" />
                Skip login (dev)
              </button>
            </>
          )}
        </div>

        <p className="text-center text-sm text-muted-foreground">
          Don't have an account?{" "}
          <Link href="/auth/register" className="text-primary hover:text-primary font-medium transition-colors">
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
}
