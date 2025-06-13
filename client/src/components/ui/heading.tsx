import { cn } from "@/lib/utils";

interface HeadingProps {
  children: React.ReactNode;
  className?: string;
  as?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
}

export function Heading({ 
  children, 
  className, 
  as: Component = 'h1'
}: HeadingProps) {
  return (
    <Component 
      className={cn(
        "font-heading font-bold text-gray-900",
        className
      )}
    >
      {children}
    </Component>
  );
}
