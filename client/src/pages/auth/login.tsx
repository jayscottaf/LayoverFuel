import { useState } from "react";
import { useLocation, Link } from "wouter";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Eye, EyeOff, Loader2, FlaskConical } from "lucide-react";
import { useAuth } from "@/context/auth-context";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

const loginSchema = z.object({
  email: z.string().email({ message: "Enter a valid email" }),
  password: z.string().min(1, { message: "Password is required" }),
});

type LoginFormValues = z.infer<typeof loginSchema>;

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
    <div className="min-h-screen bg-black flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-8">

        {/* Logo */}
        <div className="text-center">
          <h1 className="text-3xl font-bold text-white tracking-tight">Layover Fuel</h1>
          <p className="text-gray-400 mt-1 text-sm">Your travel fitness companion</p>
        </div>

        {/* Card */}
        <div className="bg-gray-900 rounded-3xl p-6 space-y-5 border border-gray-800">
          <div>
            <h2 className="text-xl font-semibold text-white">Welcome back</h2>
            <p className="text-sm text-gray-400 mt-0.5">Sign in to your account</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
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
                  autoComplete="current-password"
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

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              {isSubmitting ? <><Loader2 className="h-4 w-4 animate-spin" /> Signing in...</> : "Sign in"}
            </button>
          </form>

          {import.meta.env.DEV && (
            <>
              <div className="flex items-center gap-3 mt-1">
                <div className="flex-1 h-px bg-gray-800" />
                <span className="text-xs text-gray-600">dev only</span>
                <div className="flex-1 h-px bg-gray-800" />
              </div>
              <button
                type="button"
                onClick={devLogin}
                disabled={isSubmitting}
                className="w-full flex items-center justify-center gap-2 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-gray-400 hover:text-gray-200 text-sm font-medium py-2.5 rounded-xl transition-colors border border-gray-700"
              >
                <FlaskConical className="h-3.5 w-3.5" />
                Skip login (dev)
              </button>
            </>
          )}
        </div>

        <p className="text-center text-sm text-gray-500">
          Don't have an account?{" "}
          <Link href="/auth/register">
            <a className="text-indigo-400 hover:text-indigo-300 font-medium transition-colors">Create one</a>
          </Link>
        </p>
      </div>
    </div>
  );
}
