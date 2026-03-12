import React, { createContext, useContext, useMemo, useState } from 'react';

export type OnboardingStep =
  | 'home'
  | 'addWorkout'
  | 'analytics'
  | 'healthConnect'
  | null;

type OnboardingContextValue = {
  step: OnboardingStep;
  isActive: boolean;
  begin: (step?: Exclude<OnboardingStep, null>, force?: boolean) => void;
  setStep: (step: OnboardingStep) => void;
  nextStep: () => void;
  skipOnboarding: () => void;
};

const OnboardingContext = createContext<OnboardingContextValue | undefined>(undefined);

export default function OnboardingProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [step, setStep] = useState<OnboardingStep>(null);

  const begin = (initialStep: Exclude<OnboardingStep, null> = 'home', _force?: boolean) => {
    setStep(initialStep);
  };

  const nextStep = () => {
    setStep((prev) => {
      if (prev === 'home') return 'addWorkout';
      if (prev === 'addWorkout') return 'analytics';
      if (prev === 'analytics') return 'healthConnect';
      return null;
    });
  };

  const skipOnboarding = () => {
    setStep(null);
  };

  const value = useMemo(
    () => ({
      step,
      isActive: step !== null,
      begin,
      setStep,
      nextStep,
      skipOnboarding,
    }),
    [step]
  );

  return (
    <OnboardingContext.Provider value={value}>
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding() {
  const ctx = useContext(OnboardingContext);
  if (!ctx) {
    throw new Error('useOnboarding must be used inside OnboardingProvider');
  }
  return ctx;
}