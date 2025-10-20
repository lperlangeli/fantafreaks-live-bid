import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Role = 'P' | 'D' | 'C' | 'A';

interface RoleBadgeProps {
  role: Role;
  className?: string;
}

const roleConfig = {
  P: { label: 'P', color: 'bg-role-p' },
  D: { label: 'D', color: 'bg-role-d' },
  C: { label: 'C', color: 'bg-role-c' },
  A: { label: 'A', color: 'bg-role-a' },
};

export function RoleBadge({ role, className }: RoleBadgeProps) {
  const config = roleConfig[role];
  
  return (
    <Badge 
      className={cn(
        "w-6 h-6 rounded-full flex items-center justify-center p-0 font-bold text-white border-0",
        config.color,
        className
      )}
    >
      {config.label}
    </Badge>
  );
}
