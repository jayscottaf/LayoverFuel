import { useState } from "react";
import { useLocation, Link } from "wouter";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { apiRequest, apiUrl } from "@/lib/queryClient";
import { useAuth } from "@/context/auth-context";
import { useToast } from "@/hooks/use-toast";

const registerSchema = z.object({
  name: z.string().min(1, { message: "Name is required" }),
  email: z.string().email({ message: "Enter a valid email" }),
  password: z.string().min(6, { message: "At least 6 characters" }),
  confirmPassword: z.string().min(6, { message: "At least 6 characters" }),
}).refine(d => d.password === d.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type RegisterFormValues = z.infer<typeof registerSchema>;

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

export default function Register() {
  const { login } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: "", email: "", password: "", confirmPassword: "" },
    mode: "onBlur",
  });

  const onSubmit = async (data: RegisterFormValues) => {
    setIsSubmitting(true);
    try {
      const res = await apiRequest("POST", "/api/auth/register", {
        name: data.name,
        email: data.email,
        password: data.password,
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Registration failed");
      }
      await login(data.email, data.password);
      toast({ title: "Welcome to Layover Fuel!", description: "Your account is ready." });
      navigate("/");
    } catch (error) {
      toast({
        title: "Registration failed",
        description: error instanceof Error ? error.message : "Something went wrong.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-sm space-y-8">

        {/* Logo */}
        <div className="text-center">
          <h1 className="text-3xl font-bold text-foreground tracking-tight">LayoverFuel</h1>
          <p className="text-muted-foreground mt-1 text-sm">Eat well wherever travel takes you</p>
        </div>

        {/* Card */}
        <div className="bg-card rounded-[22px] p-6 space-y-5">
          <div>
            <h2 className="text-xl font-semibold text-foreground">Create account</h2>
            <p className="text-sm text-muted-foreground mt-0.5">Get started for free</p>
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
            {/* Name */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-muted-foreground">Name</label>
              <input
                type="text"
                autoComplete="name"
                placeholder="Jason"
                className="w-full bg-secondary text-foreground text-sm rounded-xl px-4 py-3 border border-border focus:outline-none focus:border-primary placeholder:text-muted-foreground transition-colors"
                {...register("name")}
              />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>

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
                  autoComplete="new-password"
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

            {/* Confirm Password */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-muted-foreground">Confirm password</label>
              <div className="relative">
                <input
                  type={showConfirm ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder="••••••••"
                  className="w-full bg-secondary text-foreground text-sm rounded-xl px-4 py-3 pr-11 border border-border focus:outline-none focus:border-primary placeholder:text-muted-foreground transition-colors"
                  {...register("confirmPassword")}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(p => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-muted-foreground transition-colors"
                >
                  {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.confirmPassword && <p className="text-xs text-destructive">{errors.confirmPassword.message}</p>}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed text-primary-foreground font-semibold py-3 rounded-full transition-colors flex items-center justify-center gap-2 mt-2"
            >
              {isSubmitting ? <><Loader2 className="h-4 w-4 animate-spin" /> Creating account...</> : "Create account"}
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link href="/auth/login" className="text-primary hover:text-primary font-medium transition-colors">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
