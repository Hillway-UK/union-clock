import { LoadingSpinner } from "@/components/ui/loading-spinner";
import OrganizationLogo from "@/components/OrganizationLogo";
import { cn } from "@/lib/utils";

interface BrandedLoadingScreenProps {
  message?: string;
  type?: 'default' | 'location' | 'photo' | 'verification';
  showLogo?: boolean;
  organizationLogoUrl?: string | null;
  className?: string;
}

export default function BrandedLoadingScreen({
  message = "Getting everything ready...",
  type = 'default',
  showLogo = true,
  organizationLogoUrl,
  className
}: BrandedLoadingScreenProps) {
  return (
    <div className={cn(
      "min-h-screen bg-background flex flex-col items-center justify-center p-6 animate-fade-in",
      className
    )}>
      {showLogo && (
        <div className="mb-8">
          <OrganizationLogo 
            organizationLogoUrl={organizationLogoUrl}
            size="large"
            className="justify-center"
          />
        </div>
      )}
      
      <LoadingSpinner 
        type={type}
        message={message}
        className="mt-4"
      />
    </div>
  );
}
