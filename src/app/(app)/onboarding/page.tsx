import { OnboardingClient } from "@/components/app/onboarding-client";

export default function OnboardingPage() {
  return <OnboardingClient refreshKey={crypto.randomUUID()} />;
}
