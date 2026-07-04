"use client";

import { useCallback, useEffect, useState } from "react";
import type { CheckoutProduct } from "@/components/CheckoutModal";
import { useToast } from "@/components/Toast";
import type { AiModelId } from "@/lib/ai-models";
import {
  addInvoice,
  cancelSubscription,
  getPlanDef,
  subscribeTo,
  useSubscription,
  type BillingCycle,
  type CardInfo,
  type PlanId,
} from "@/lib/billing";
import { CREDITS_WALL_EVENT, getPack, purchasePack } from "@/lib/credits";
import type { TFunc } from "@/lib/i18n";
import { playSound } from "@/lib/sound";

interface UseBillingFlowArgs {
  selectedModel: AiModelId;
  onSelectModel: (id: AiModelId) => void;
  t: TFunc;
}

export function useBillingFlow({ selectedModel, onSelectModel, t }: UseBillingFlowArgs) {
  const toast = useToast();
  const subscription = useSubscription();
  const [billingOpen, setBillingOpen] = useState(false);
  const [pricingOpen, setPricingOpen] = useState(false);
  const [checkout, setCheckout] = useState<CheckoutProduct | null>(null);
  const [quotaWallOpen, setQuotaWallOpen] = useState(false);
  const [creditsWall, setCreditsWall] = useState<number | null>(null);

  useEffect(() => {
    const onWall = (e: Event) => {
      setCreditsWall((e as CustomEvent<{ need: number }>).detail?.need ?? 0);
    };
    window.addEventListener(CREDITS_WALL_EVENT, onWall);
    return () => window.removeEventListener(CREDITS_WALL_EVENT, onWall);
  }, []);

  const openPricing = useCallback(() => {
    setBillingOpen(false);
    setPricingOpen(true);
  }, []);

  const openQuotaWall = useCallback(() => {
    setQuotaWallOpen(true);
  }, []);

  const openCreditsWall = useCallback((need: number) => {
    setCreditsWall(need);
  }, []);

  const closeQuotaWall = useCallback(() => {
    setQuotaWallOpen(false);
    setCreditsWall(null);
  }, []);

  const handleCheckout = useCallback((plan: PlanId, cycle: BillingCycle) => {
    setPricingOpen(false);
    setCheckout({ kind: "plan", plan, cycle });
  }, []);

  const handleBuyPack = useCallback((packId: string) => {
    setPricingOpen(false);
    setCheckout({ kind: "pack", packId });
  }, []);

  const handleCheckoutConfirmed = useCallback((card: CardInfo) => {
    if (!checkout) return;

    if (checkout.kind === "pack") {
      const grant = purchasePack(checkout.packId);
      const pack = getPack(checkout.packId);
      if (grant && pack) {
        addInvoice({
          id: grant.id,
          date: grant.grantedAt,
          planId: subscription.plan,
          cycle: "monthly",
          amount: pack.price,
          status: "paid",
          kind: "pack",
          credits: pack.credits,
        });
        playSound("achievement");
        toast.success(`✨ ${t("checkout.packSuccessDesc", { credits: pack.credits })}`);
      }
      return;
    }

    subscribeTo(checkout.plan, checkout.cycle, card);
    playSound("achievement");
    toast.success(`🎉 ${t("checkout.successDesc", { plan: t(getPlanDef(checkout.plan).nameKey) })}`);
  }, [checkout, subscription.plan, t, toast]);

  const handleDowngradeFree = useCallback(() => {
    cancelSubscription();
    setPricingOpen(false);
    toast.info(t("billing.cancelled"));
  }, [t, toast]);

  const handleSwitchFlash = useCallback(() => {
    onSelectModel("deepseek-v4-flash");
    closeQuotaWall();
  }, [closeQuotaWall, onSelectModel]);

  const handleTopUp = useCallback(() => {
    closeQuotaWall();
    openPricing();
  }, [closeQuotaWall, openPricing]);

  return {
    subscription,
    billingOpen,
    setBillingOpen,
    pricingOpen,
    setPricingOpen,
    checkout,
    setCheckout,
    quotaWallOpen,
    creditsWall,
    openPricing,
    openQuotaWall,
    openCreditsWall,
    closeQuotaWall,
    handleCheckout,
    handleBuyPack,
    handleCheckoutConfirmed,
    handleDowngradeFree,
    handleSwitchFlash,
    handleTopUp,
    canFallbackFlash: selectedModel !== "deepseek-v4-flash",
    handleBillingCancelled: () => toast.info(t("billing.cancelled")),
  };
}
