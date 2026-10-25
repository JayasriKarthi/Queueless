import { hasFeature, planFor, getPlan } from '../config/plans';
import { useTenant } from './useTenant';

// useFeature('tvDisplay') -> { enabled, plan, requiredPlan }
export function useFeature(feature, business) {
  const { business: tenant } = useTenant();
  const b = business ?? tenant;
  const planId = b?.plan ?? 'free';
  return { enabled: hasFeature(planId, feature), plan: getPlan(planId), requiredPlan: planFor(feature) };
}
