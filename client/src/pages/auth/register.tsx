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
    <div className="min-h-screen bg-black flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-sm space-y-8">

        {/* Logo */}
        <div className="text-center">
          <h1 className="text-3xl font-bold text-white tracking-tight">Layover Fuel</h1>
          <p className="text-gray-400 mt-1 text-sm">Your travel fitness companion</p>
        </div>

        {/* Card */}
        <div className="bg-gray-900 rounded-3xl p-6 space-y-5 border border-gray-800">
          <div>
            <h2 className="text-xl font-semibold text-white">Create account</h2>
            <p className="text-sm text-gray-400 mt-0.5">Get started for free</p>
          </div>

          <a
            href={apiUrl("/api/auth/google")}
            className="w-full flex items-center justify-center gap-2.5 bg-white hover:bg-gray-100 text-gray-900 font-medium py-3 rounded-xl transition-colors"
          >
            <GoogleLogo />
            Continue with Google
          </a>

          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-gray-800" />
            <span className="text-xs text-gray-600">or</span>
            <div className="flex-1 h-px bg-gray-800" />
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* Name */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-300">Name</label>
              <input
                type="text"
                autoComplete="name"
                placeholder="Jason"
                className="w-full bg-gray-800 text-white text-sm rounded-xl px-4 py-3 border border-gray-700 focus:outline-none focus:border-indigo-500 placeholder-gray-500 transition-colors"
                {...register("name")}
              />
              {errors.name && <p className="text-xs text-red-400">{errors.name.message}</p>}
            </div>

            {/* Email */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-300">Email</label>
              <input
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                className="w-full bg-gray-800 text-white text-sm rounded-xl px-4 py-3 border border-gray-700 focus:outline-none focus:border-indigo-500 placeholder-gray-500 transition-colors"
                {...register("email")}
              />
              {errors.email && <p className="text-xs text-red-400">{errors.email.message}</p>}
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-300">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder="••••••••"
                  className="w-full bg-gray-800 text-white text-sm rounded-xl px-4 py-3 pr-11 border border-gray-700 focus:outline-none focus:border-indigo-500 placeholder-gray-500 transition-colors"
                  {...register("password")}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(p => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.password && <p className="text-xs text-red-400">{errors.password.message}</p>}
            </div>

            {/* Confirm Password */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-300">Confirm password</label>
              <div className="relative">
                <input
                  type={showConfirm ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder="••••••••"
                  className="w-full bg-gray-800 text-white text-sm rounded-xl px-4 py-3 pr-11 border border-gray-700 focus:outline-none focus:border-indigo-500 placeholder-gray-500 transition-colors"
                  {...register("confirmPassword")}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(p => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                >
                  {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.confirmPassword && <p className="text-xs text-red-400">{errors.confirmPassword.message}</p>}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2 mt-2"
            >
              {isSubmitting ? <><Loader2 className="h-4 w-4 animate-spin" /> Creating account...</> : "Create account"}
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-gray-500">
          Already have an account?{" "}
          <Link href="/auth/login">
            <a className="text-indigo-400 hover:text-indigo-300 font-medium transition-colors">Sign in</a>
          </Link>
        </p>
      </div>
    </div>
  );
}
