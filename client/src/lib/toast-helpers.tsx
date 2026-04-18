import { toast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";

interface ErrorToastOptions {
  title?: string;
  description?: string;
  onRetry?: () => void;
  retryLabel?: string;
}

export function errorToast({
  title = "Something went wrong",
  description,
  onRetry,
  retryLabel = "Retry",
}: ErrorToastOptions) {
  return toast({
    title,
    description,
    variant: "destructive",
    action: onRetry ? (
      <ToastAction altText={retryLabel} onClick={onRetry}>
        {retryLabel}
      </ToastAction>
    ) : undefined,
  });
}
