"use client";

import { apiServiceDefault } from "@/services/api/api-service";
import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  User,
  Users,
  CreditCard,
  LogOut,
  ChevronRight,
  Edit2,
  Trash2,
  Bell,
  Globe,
  Clock,
  ShieldCheck,
  ArrowLeft,
  Download
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Tab = "account" | "users" | "subscription" | "billing-history" | "logout";

interface Subscription {
  plan: string;
  status: string;
  current_period_end: string;
  cancel_at_period_end: boolean;
}

interface UserProfile {
  id: string;
  name: string;
  email: string;
  subscription?: Subscription | null;
  plan?: string; // Legacy fallback
}

const PLAN_PRICE_IDS: Record<string, string> = {
  free: "price_1SpLlfB7l4Z4dfAwJoBZ5cXE",
  entry: "price_1Sq9lCB7l4Z4dfAwbon53vpu",
  pro: "price_1Sr9LhBDn5DFVH5ZCwMgpsqh",
};

const PLAN_ORDER: Record<string, number> = {
  free: 0,
  entry: 1,
  pro: 2,
  custom: 3,
};

function formatDate(dateString: string) {
  if (!dateString) return "";
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}

function AccountPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  
  // Initialize activeTab from URL parameter or default to "account"
  const [activeTab, setActiveTab] = useState<Tab>(() => {
    if (tabParam === "subscription" || tabParam === "billing-history") {
      return tabParam;
    }
    return "account";
  });
  const [user, setUser] = useState<UserProfile | null>(null);
  const [profileCount, setProfileCount] = useState<number>(0);

  // Update activeTab when URL parameter changes
  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab === "subscription" || tab === "billing-history") {
      setActiveTab(tab);
    } else if (tab === null) {
      // If tab param is removed, default back to account
      setActiveTab("account");
    }
  }, [searchParams]);

  useEffect(() => {
    // Initial load from localStorage for faster UI
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch (e) {
        console.error("Failed to parse user", e);
      }
    }

    // Fetch actual user profile to get latest subscription data
    const fetchUserProfile = async () => {
      try {
        const res = await apiServiceDefault.get<UserProfile>("/auth/me");
        if (res) {
          setUser(res);
          localStorage.setItem("user", JSON.stringify(res));
        }
      } catch (err) {
        console.error("Failed to fetch user profile", err);
      }
    };

    // Fetch actual profile count
    const fetchProfileCount = async () => {
      try {
        const res = await apiServiceDefault.get("profiles/list");
        const profiles = (res as any)?.profiles || (res as any)?.data?.profiles || res || [];
        setProfileCount(Array.isArray(profiles) ? profiles.length : 0);
      } catch (err) {
        console.error("Failed to fetch profiles for count", err);
      }
    };

    fetchUserProfile();
    fetchProfileCount();
  }, []);

  const handleLogout = () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("userToken");
      localStorage.removeItem("user");
      localStorage.removeItem("authMethod");
      localStorage.removeItem("selectedProfileId");
      localStorage.removeItem("selectedProfileIgId");
      sessionStorage.removeItem("resumeVideoProcessor");
      sessionStorage.removeItem("resumeVideoProcessorOpen");
      sessionStorage.removeItem("resumeVideoProcessorState");
      sessionStorage.removeItem("resumeModalDone");
      document.cookie = "userToken=; expires=Thu, 01 Jan 1970 00:00:01 GMT; path=/;";
      window.dispatchEvent(new CustomEvent("ig:cleared"));
    }
    router.replace("/");
  };

  const SidebarItem = ({ id, icon: Icon, label, danger }: { id: Tab, icon: any, label: string, danger?: boolean }) => (
    <button
      onClick={() => {
        if (id === "logout") {
          handleLogout();
        } else {
          setActiveTab(id);
          // Update URL to reflect the active tab (except for account which is default)
          if (id === "subscription" || id === "billing-history") {
            router.push(`/account?tab=${id}`, { scroll: false });
          } else {
            router.push("/account", { scroll: false });
          }
        }
      }}
      className={cn(
        "w-full flex items-center gap-3 px-4 py-2.5 text-[13px] font-medium transition-all duration-200 rounded-lg group",
        (activeTab === id || (id === "subscription" && activeTab === "billing-history")) && !danger
          ? "bg-[#F0F7FF] text-[#006ADC]"
          : "text-[#4B5563] hover:bg-[#F9FAFB]",
        danger && "text-[#EF4444] hover:bg-[#FEF2F2] mt-auto"
      )}
    >
      <Icon className={cn("w-4 h-4", (activeTab === id || (id === "subscription" && activeTab === "billing-history")) && !danger ? "text-[#006ADC]" : "text-[#9CA3AF] group-hover:text-[#4B5563]", danger && "text-[#F87171] group-hover:text-[#EF4444]")} />
      <span>{label}</span>
    </button>
  );

  return (
    <div className="flex min-h-screen bg-white font-sans antialiased text-[#1F2937]">
      {/* Sidebar */}
      <aside className="w-64 border-r border-[#E5E7EB] flex flex-col p-4 sticky top-0 h-screen bg-white">
        <Link href="/" className="mb-8 flex items-center gap-2 px-2 hover:opacity-80 transition-opacity">
          <img src="/logo.png" alt="Publefy Logo" className="w-24 h-auto" />
        </Link>

        <nav className="space-y-0.5 flex-1">
          <SidebarItem id="account" icon={User} label="Account Settings" />
          <SidebarItem id="users" icon={Users} label="Users" />
          <SidebarItem id="subscription" icon={CreditCard} label="Subscription" />
        </nav>

        <div className="pt-4 border-t border-[#F3F4F6]">
          <SidebarItem id="logout" icon={LogOut} label="Log out" danger />
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto px-12 py-10 max-w-4xl">
        {activeTab === "account" && <AccountSettings user={user} profileCount={profileCount} />}
        {activeTab === "users" && <UsersManagement user={user} />}
        {activeTab === "subscription" && <SubscriptionSettings onShowBilling={() => setActiveTab("billing-history")} user={user} />}
        {activeTab === "billing-history" && <BillingHistory onBack={() => setActiveTab("subscription")} user={user} />}
      </main>
    </div>
  );
}

function AccountSettings({ user, profileCount }: { user: any, profileCount: number }) {
  return (
    <div className="max-w-[720px] mx-auto space-y-10 animate-in fade-in duration-500">
      <header>
        <h1 className="text-[28px] font-semibold text-[#111827]">Account Settings</h1>
      </header>

      {/* Section: Personal Info */}
      <section className="space-y-4">
        <h2 className="text-[13px] font-bold text-[#6B7280] uppercase tracking-wider">Personal Information & Security</h2>
        <div className="border-t border-[#E5E7EB]">
          <SettingsRow label="Username" value={user?.name || "Member"} buttonText="Edit" />
          <SettingsRow label="Email" value={user?.email || "No email provided"} buttonText="Change" />
          <SettingsRow label="Change Password" value="" buttonText="Change" />
        </div>
      </section>

      {/* Section: Preferences */}
      <section className="space-y-4 pt-4">
        <h2 className="text-[13px] font-bold text-[#6B7280] uppercase tracking-wider">Preferences</h2>
        <div className="border-t border-[#E5E7EB]">
          <SettingsRow label="Time Zone" value="America/New_York" buttonText="Edit" />
          <SettingsRow label="First Day of the Week" value="Sunday" buttonText="Edit" />
        </div>
      </section>

      {/* Danger Zone */}
      <section className="space-y-4 pt-10">
        <h2 className="text-[13px] font-bold text-[#DC2626] uppercase tracking-wider">Leave Publefy</h2>
        <div className="border-t border-[#E5E7EB] pt-6 flex items-center justify-between">
          <p className="text-[#DC2626] text-[13px] font-medium">Deleting your Publefy account will remove all your data on Publefy</p>
          <Button variant="outline" size="sm" className="border-[#E5E7EB] text-[#374151] font-semibold text-xs h-8 px-4 rounded hover:bg-slate-50">
            Delete Account
          </Button>
        </div>
      </section>
    </div>
  );
}

function SettingsRow({ label, value, buttonText }: { label: string, value: any, buttonText: string }) {
  return (
    <div className="flex items-center justify-between py-5 border-b border-[#F3F4F6]">
      <div className="space-y-0.5">
        <p className="text-[13px] font-medium text-[#374151]">{label}</p>
        {value && <div className="text-[13px] text-[#6B7280]">{value}</div>}
      </div>
      <Button variant="outline" size="sm" className="border-[#E5E7EB] text-[#374151] font-semibold text-xs h-8 px-4 rounded hover:bg-slate-50">
        {buttonText}
      </Button>
    </div>
  );
}

function UsersManagement({ user }: { user: any }) {
  return (
    <div className="max-w-[720px] mx-auto space-y-8 animate-in fade-in duration-500">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-[28px] font-semibold text-[#111827]">Users</h1>
          <p className="text-[#4B5563] text-[13px] mt-1">Add users to help manage your social media.</p>
        </div>
      </header>

      <div className="border-t border-[#E5E7EB]">
        <table className="w-full text-left">
          <thead>
            <tr className="text-[11px] font-bold text-[#9CA3AF] uppercase tracking-wider">
              <th className="py-4 font-bold">Name</th>
              <th className="py-4 font-bold">Last Signed In</th>
              <th className="py-4 font-bold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y border-t border-[#E5E7EB]">
            <tr className="text-[13px]">
              <td className="py-5">
                <div className="font-semibold text-[#111827]">{user?.name || "Nikita"}</div>
                <div className="text-[#6B7280]">{user?.email || "nclark@junziteclisolutions.com"}</div>
              </td>
              <td className="py-5 text-[#4B5563]">9 days ago</td>
              <td className="py-5 text-[#6B7280] font-medium">Account Owner (You)</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SubscriptionSettings({ onShowBilling, user }: { onShowBilling: () => void, user: UserProfile | null }) {
  const currentPlan = (user?.subscription?.plan || user?.plan || "free").toLowerCase();

  const [portalError, setPortalError] = useState<string | null>(null);

  const handlePortalSession = async () => {
    setPortalError(null);
    try {
      const response: any = await apiServiceDefault.post("/billing/create-portal-session", {});
      if (response?.url) {
        // Open Stripe billing portal in a new tab as requested
        window.open(response.url, "_blank");
      }
    } catch (error: any) {
      console.error("Failed to create portal session", error);
      const errorMessage = error?.response?.data?.error || error?.message || "Unable to access billing portal";
      
      // Check if user needs to subscribe first
      if (errorMessage.includes("customer") || errorMessage.includes("subscribe") || error?.response?.status === 400) {
        setPortalError("Please subscribe to a plan first to access billing details and payment methods.");
      } else {
        setPortalError("Unable to access billing portal. Please try again later.");
      }
    }
  };

  const [isBillingModalOpen, setIsBillingModalOpen] = useState(false);

  const handleUpgrade = async (planName: string, priceId: string) => {
    try {
      const response: any = await apiServiceDefault.post("/billing/create-checkout-session", {
        plan: planName.toLowerCase(),
        priceId: priceId
      });
      if (response?.url) {
        window.location.href = response.url;
      }
    } catch (error) {
      console.error(`Failed to create checkout session for ${planName}`, error);
    }
  };

  return (
    <div className="max-w-[680px] mx-auto space-y-16 animate-in fade-in duration-500">
      <header className="pt-4">
        <h1 className="text-3xl font-light tracking-tight text-[#0A0A0A]">Subscription</h1>
      </header>

      {/* Cancellation Notice "Window" */}
      {user?.subscription?.cancel_at_period_end && (
        <div className="bg-[#FEF2F2]/40 border-l-2 border-[#EF4444] rounded-sm p-5 flex items-start gap-4">
          <Clock className="w-4 h-4 text-[#DC2626] mt-0.5 flex-shrink-0" />
          <div className="space-y-1">
            <h3 className="text-sm font-medium text-[#991B1B]">Cancellation Scheduled</h3>
            <p className="text-sm text-[#7F1D1D] leading-relaxed">
              Your <span className="font-medium">{currentPlan}</span> plan remains active until <span className="font-medium">{formatDate(user.subscription.current_period_end)}</span>. 
              After this date, you will be moved to the Free plan.
            </p>
          </div>
        </div>
      )}

      {/* Section: Available Plans */}
      <section className="space-y-6">
        <h2 className="text-xs font-medium text-[#737373] uppercase tracking-[0.15em]">Available Plans</h2>
        <div className="space-y-2">
          <PlanRow
            name="Free"
            price="$0/mo"
            isCurrent={currentPlan === "free"}
            currentPlan={currentPlan}
            onUpgrade={() => { }}
          />
          <PlanRow
            name="Entry"
            price="$19/mo"
            priceId={PLAN_PRICE_IDS.entry}
            isCurrent={currentPlan === "entry"}
            currentPlan={currentPlan}
            onUpgrade={handleUpgrade}
          />
          {/* Pro and Custom plans kept in DOM but hidden in UI */}
          <div className="hidden">
            <PlanRow
              name="Pro"
              price="$99/mo"
              priceId={PLAN_PRICE_IDS.pro}
              isCurrent={currentPlan === "pro"}
              currentPlan={currentPlan}
              onUpgrade={handleUpgrade}
            />
            <PlanRow
              name="Custom"
              price="Talk to Sales"
              isCurrent={currentPlan === "custom"}
              currentPlan={currentPlan}
              onUpgrade={(name) => window.open("https://calendar.app.google/PPFeknvdixs6ANhw7", "_blank")}
            />
          </div>
        </div>
      </section>

      {/* Section: Billing */}
      <section className="space-y-6 pt-4 border-t border-[#F5F5F5]">
        <h2 className="text-xs font-medium text-[#737373] uppercase tracking-[0.15em]">Billing</h2>
        <div className="space-y-3">
          <div className="group border border-[#F0F0F0] rounded-md p-6 flex items-center justify-between bg-white hover:border-[#E5E5E5] transition-all duration-200">
            <div className="space-y-0.5">
              <h3 className="text-base font-normal text-[#1A1A1A]">Payment & Billing History</h3>
              <p className="text-sm text-[#737373]">
                {user?.subscription?.stripe_customer_id 
                  ? "Update your payment method and download receipts."
                  : "Subscribe to a plan to manage your billing and payment methods."}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              disabled={!user?.subscription?.stripe_customer_id}
              className={cn(
                "border-[#E5E5E5] text-[#4A4A4A] font-normal text-sm h-9 px-5 rounded-md transition-colors",
                user?.subscription?.stripe_customer_id
                  ? "hover:border-[#D4D4D4] hover:bg-[#FAFAFA]"
                  : "opacity-50 cursor-not-allowed"
              )}
              onClick={handlePortalSession}
            >
              Details
            </Button>
          </div>
          {portalError && (
            <div className="bg-[#FEF2F2]/40 border-l-2 border-[#EF4444] rounded-sm p-4 text-sm text-[#7F1D1D]">
              {portalError}
            </div>
          )}
        </div>
      </section>

      <Dialog open={isBillingModalOpen} onOpenChange={setIsBillingModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-0 border-none bg-white rounded-xl shadow-2xl">
          <div className="p-8">
            <DialogHeader className="mb-8">
              <DialogTitle className="text-2xl font-bold text-[#111827]">Payment & Billing History</DialogTitle>
            </DialogHeader>

            <div className="space-y-10">
              {/* Section: Payment Method */}
              <section className="space-y-4">
                <h2 className="text-[13px] font-bold text-[#6B7280] uppercase tracking-wider">Payment Method</h2>
                <div className="border-t border-[#E5E7EB]">
                  <SettingsRow label="Billing Email" value={user?.email || "nclark@junziteclisolutions.com"} buttonText="Edit" />
                </div>
              </section>

              {/* Section: Billing History */}
              <section className="space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-[13px] font-bold text-[#6B7280] uppercase tracking-wider">Billing History</h2>
                  <div className="flex items-center gap-2">
                    <span className="text-[12px] text-[#6B7280]">Receive receipts by email</span>
                    <Switch defaultChecked className="scale-75" />
                  </div>
                </div>

                <div className="overflow-x-auto -mx-2">
                  <table className="w-full text-left min-w-[500px]">
                    <thead>
                      <tr className="text-[11px] font-bold text-[#9CA3AF] uppercase tracking-wider border-b border-[#E5E7EB]">
                        <th className="py-3 px-2 font-bold">Date</th>
                        <th className="py-3 px-2 font-bold">Amount</th>
                        <th className="py-3 px-2 font-bold">Status</th>
                        <th className="py-3 px-2 font-bold text-right">Receipt</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#F3F4F6]">
                      {[
                        { date: "Jan 16, 2026", amount: "$19.00", status: "Paid" },
                        { date: "Dec 16, 2025", amount: "$19.00", status: "Paid" },
                        { date: "Nov 16, 2025", amount: "$19.00", status: "Paid" },
                      ].map((item, idx) => (
                        <tr key={idx} className="text-[13px] text-[#4B5563] group hover:bg-slate-50 transition-colors">
                          <td className="py-4 px-2 whitespace-nowrap font-medium text-[#111827]">{item.date}</td>
                          <td className="py-4 px-2 whitespace-nowrap">{item.amount}</td>
                          <td className="py-4 px-2">
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                              {item.status}
                            </span>
                          </td>
                          <td className="py-4 px-2 text-right">
                            <button className="text-[#006ADC] hover:text-[#0052a3] font-medium flex items-center gap-1 ml-auto transition-colors">
                              <Download className="w-3.5 h-3.5" />
                              PDF
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              <div className="pt-4 flex justify-end">
                <Button
                  onClick={() => setIsBillingModalOpen(false)}
                  className="bg-[#2D5A27] hover:bg-[#24481f] text-white px-8"
                >
                  Close
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PlanRow({
  name,
  price,
  priceId,
  isCurrent,
  currentPlan,
  onUpgrade
}: {
  name: string,
  price: string,
  priceId?: string,
  isCurrent: boolean,
  currentPlan: string,
  onUpgrade: (plan: string, priceId: string) => void
}) {
  const planKey = name.toLowerCase();
  const currentPlanIndex = PLAN_ORDER[currentPlan] ?? 0;
  const planIndex = PLAN_ORDER[planKey] ?? 0;

  const isUpgrade = planIndex > currentPlanIndex;
  const isDowngrade = planIndex < currentPlanIndex;

  let buttonText = "Upgrade";
  if (isCurrent) buttonText = "Current Plan";
  else if (isDowngrade) buttonText = "Downgrade";

  return (
    <div className={cn(
      "border border-[#F0F0F0] rounded-md p-6 flex items-center justify-between bg-white transition-all duration-200",
      isCurrent && "border-[#0A0A0A] bg-[#FAFAFA]",
      !isCurrent && "hover:border-[#E5E5E5] hover:shadow-[0_1px_3px_rgba(0,0,0,0.04)]"
    )}>
      <div className="space-y-0.5">
        <h3 className="text-lg font-normal text-[#0A0A0A] tracking-tight">{name}</h3>
        <p className="text-sm text-[#737373] font-light">{price}</p>
      </div>
      <Button
        disabled={isCurrent}
        onClick={() => !isCurrent && onUpgrade(name, priceId || "")}
        className={cn(
          "text-sm font-normal h-9 px-6 rounded-md transition-all duration-200",
          isCurrent
            ? "bg-[#0A0A0A] text-white opacity-40 cursor-not-allowed"
            : isUpgrade
              ? "bg-[#0A0A0A] text-white hover:bg-[#1A1A1A]"
              : "bg-white border border-[#E5E5E5] text-[#737373] hover:border-[#D4D4D4] hover:bg-[#FAFAFA]"
        )}
      >
        {buttonText}
      </Button>
    </div>
  );
}

function BillingHistory({ onBack, user }: { onBack: () => void, user: any }) {
  const history = [
    { date: "Apr 16, 2025", method: "mastercard **** **** **** 7224 Expiration: 7/2030", amount: "47.81 USD", status: "Succeeded" },
    { date: "Mar 16, 2025", method: "mastercard **** **** **** 7224 Expiration: 7/2030", amount: "47.81 USD", status: "Succeeded" },
    { date: "Mar 3, 2025", method: "mastercard **** **** **** 7224 Expiration: 7/2030", amount: "9.86 USD", status: "Succeeded" },
    { date: "Feb 16, 2025", method: "mastercard **** **** **** 7224 Expiration: 7/2030", amount: "26.56 USD", status: "Succeeded" },
    { date: "Jan 12, 2025", method: "mastercard **** **** **** 7224 Expiration: 7/2030", amount: "47.81 USD", status: "Succeeded" },
    { date: "Dec 12, 2024", method: "mastercard **** **** **** 7224 Expiration: 7/2030", amount: "47.81 USD", status: "Succeeded" },
  ];

  return (
    <div className="max-w-[720px] mx-auto space-y-8 animate-in fade-in slide-in-from-left-4 duration-500">
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-[#006ADC] text-[13px] font-medium hover:underline mb-2"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Subscription
      </button>

      <header>
        <h1 className="text-[28px] font-semibold text-[#111827]">Payment & Billing History</h1>
      </header>

      {/* Section: Payment Method */}
      <section className="space-y-4 pt-4">
        <h2 className="text-[13px] font-bold text-[#6B7280] uppercase tracking-wider">Payment Method</h2>
        <div className="border-t border-[#E5E7EB]">
          <SettingsRow label="Billing Email" value={user?.email || "nclark@junziteclisolutions.com"} buttonText="Edit" />
        </div>
      </section>

      {/* Section: Billing History */}
      <section className="space-y-6 pt-4">
        <h2 className="text-[13px] font-bold text-[#6B7280] uppercase tracking-wider">Billing History</h2>

        <div className="flex items-center justify-between py-4 border-t border-[#E5E7EB]">
          <span className="text-[13px] font-medium text-[#374151]">Receive future receipts by email</span>
          <Switch defaultChecked />
        </div>

        <div className="overflow-hidden">
          <table className="w-full text-left">
            <thead>
              <tr className="text-[11px] font-bold text-[#9CA3AF] uppercase tracking-wider border-b border-[#E5E7EB]">
                <th className="py-3 font-bold">Date</th>
                <th className="py-3 font-bold">Payment Method</th>
                <th className="py-3 font-bold">Amount</th>
                <th className="py-3 font-bold">Status</th>
                <th className="py-3 font-bold text-center">Receipt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F3F4F6]">
              {history.map((item, idx) => (
                <tr key={idx} className="text-[13px] text-[#4B5563]">
                  <td className="py-6 align-top whitespace-nowrap">{item.date}</td>
                  <td className="py-6 align-top max-w-[200px] leading-relaxed">{item.method}</td>
                  <td className="py-6 align-top whitespace-nowrap">{item.amount}</td>
                  <td className="py-6 align-top font-medium text-[#111827]">{item.status}</td>
                  <td className="py-6 align-top text-center">
                    <Button variant="outline" size="sm" className="border-[#E5E7EB] text-[#374151] font-semibold text-xs h-8 px-4 rounded hover:bg-slate-50">
                      Download
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

export default function AccountPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen bg-white font-sans antialiased text-[#1F2937]">
        <aside className="w-64 border-r border-[#E5E7EB] flex flex-col p-4 sticky top-0 h-screen bg-white">
          <Link href="/" className="mb-8 flex items-center gap-2 px-2 hover:opacity-80 transition-opacity">
            <img src="/logo.png" alt="Publefy Logo" className="w-24 h-auto" />
          </Link>
        </aside>
        <main className="flex-1 overflow-y-auto px-12 py-10 max-w-4xl">
          <div className="max-w-[720px] mx-auto space-y-10">
            <div className="animate-pulse">
              <div className="h-8 bg-gray-200 rounded w-48 mb-4"></div>
              <div className="h-4 bg-gray-200 rounded w-64"></div>
            </div>
          </div>
        </main>
      </div>
    }>
      <AccountPageContent />
    </Suspense>
  );
}

