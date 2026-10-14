"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { getClientEnv } from "@/lib/env";
import type { UserProfile, AccountRole } from "@/types";

interface SignupData {
  email: string;
  password: string;
  role: AccountRole;
  fullName: string;
  displayName: string;
  companyName?: string;
  businessCategory?: string;
}

interface AuthContextType {
  user: UserProfile | null;
  role: AccountRole | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string; role?: AccountRole }>;
  signup: (data: SignupData) => Promise<{ success: boolean; error?: string; role?: AccountRole }>;
  logout: () => Promise<void>;
  updateProfile: (data: Partial<UserProfile>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  role: null,
  isLoading: true,
  login: async () => ({ success: false }),
  signup: async () => ({ success: false }),
  logout: async () => {},
  updateProfile: async () => {},
});

// Seed accounts for instant local verification
const SEED_USERS_REGISTRY: Record<string, { profile: UserProfile; passwordHash: string }> = {
  "client@prismora.ai": {
    passwordHash: "client123",
    profile: {
      id: "usr-client-001",
      email: "client@prismora.ai",
      role: "client",
      full_name: "Sarah Chen",
      display_name: "Velvet Luxe Agency",
      handle: "velvetluxe",
      company_name: "Velvet Luxe Studio",
      business_category: "Food & Beverage",
      bio: "Prestige food & beverage brand commissioning next-gen commercials.",
      website_url: "https://velvetluxe.co",
      created_at: "2026-10-01T10:00:00Z",
    },
  },
  "creator1@prismora.ai": {
    passwordHash: "creator123",
    profile: {
      id: "usr-freelancer-elena-01",
      email: "creator1@prismora.ai",
      role: "freelancer",
      full_name: "Elena Rostova",
      display_name: "Aetheris Studios",
      handle: "aetheris",
      avatar_url: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
      bio: "Cinematic AI video director specializing in photorealistic commercial executions.",
      website_url: "https://aetheris.art",
      skills: ["Cinematic Direction", "Prompt Engineering", "Color Grading"],
      primary_ai_tools: ["runway_gen3", "flux_1", "comfy_ui"],
      created_at: "2026-10-01T10:00:00Z",
    },
  },
  "creator@prismora.ai": {
    passwordHash: "creator123",
    profile: {
      id: "usr-freelancer-elena-01",
      email: "creator@prismora.ai",
      role: "freelancer",
      full_name: "Elena Rostova",
      display_name: "Aetheris Studios",
      handle: "aetheris",
      avatar_url: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
      bio: "Cinematic AI video director specializing in photorealistic commercial executions.",
      website_url: "https://aetheris.art",
      skills: ["Cinematic Direction", "Prompt Engineering", "Color Grading"],
      primary_ai_tools: ["runway_gen3", "flux_1", "comfy_ui"],
      created_at: "2026-10-01T10:00:00Z",
    },
  },
  "creator2@prismora.ai": {
    passwordHash: "creator123",
    profile: {
      id: "usr-freelancer-marcus-02",
      email: "creator2@prismora.ai",
      role: "freelancer",
      full_name: "Marcus Vance",
      display_name: "Horizon AI Films",
      handle: "horizonfilms",
      avatar_url: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80",
      bio: "Gourmet food & beverage macro motion simulation specialist.",
      website_url: "https://horizonfilms.ai",
      skills: ["Macro Fluid Simulation", "ComfyUI Pipeline Architecture"],
      primary_ai_tools: ["kling_ai", "comfy_ui"],
      created_at: "2026-10-02T10:00:00Z",
    },
  },
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  // Helper to get local registry
  function getRegistry(): Record<string, { profile: UserProfile; passwordHash: string }> {
    try {
      const stored = localStorage.getItem("prismora_users_registry");
      if (stored) {
        return { ...SEED_USERS_REGISTRY, ...JSON.parse(stored) };
      }
    } catch {
      // Fallback to seed registry
    }
    return { ...SEED_USERS_REGISTRY };
  }

  function saveToRegistry(email: string, profile: UserProfile, passwordHash: string) {
    try {
      const current = getRegistry();
      current[email.toLowerCase()] = { profile, passwordHash };
      localStorage.setItem("prismora_users_registry", JSON.stringify(current));
    } catch {
      // Ignore
    }
  }

  useEffect(() => {
    async function initAuth() {
      setIsLoading(true);
      const env = getClientEnv();

      // 1. If Supabase is configured, check real session
      if (env.isConfigured) {
        try {
          const supabase = createClient() as any;
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.user) {
            const { data: profile } = await supabase
              .from("profiles")
              .select("*")
              .eq("id", session.user.id)
              .maybeSingle();

            if (profile) {
              const loadedUser: UserProfile = {
                id: profile.id,
                email: session.user.email || "",
                role: (profile.account_type || profile.role || "client") as AccountRole,
                full_name: profile.full_name || "User",
                display_name: profile.display_name || "User",
                handle: profile.handle || "user",
                avatar_url: profile.avatar_url,
                company_name: profile.company_name,
                business_category: profile.business_category,
                bio: profile.bio,
                website_url: profile.website_url,
                skills: profile.skills,
                primary_ai_tools: profile.primary_ai_tools,
                created_at: profile.created_at,
              };
              setUser(loadedUser);
              localStorage.setItem("prismora_current_user", JSON.stringify(loadedUser));
              setIsLoading(false);
              return;
            }
          }
        } catch {
          // Continue to local session check
        }
      }

      // 2. Check local current user session
      try {
        const saved = localStorage.getItem("prismora_current_user");
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed && parsed.id && parsed.role) {
            setUser(parsed);
            setIsLoading(false);
            return;
          }
        }
      } catch {
        localStorage.removeItem("prismora_current_user");
      }

      setUser(null);
      setIsLoading(false);
    }

    initAuth();
  }, []);

  async function login(email: string, password: string) {
    setIsLoading(true);
    const env = getClientEnv();
    const cleanEmail = email.trim().toLowerCase();

    // A. Real Supabase Auth if configured
    if (env.isConfigured) {
      try {
        const supabase = createClient() as any;
        const { data, error } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        });

        if (error) {
          setIsLoading(false);
          return { success: false, error: error.message };
        }

        if (data.user) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", data.user.id)
            .maybeSingle();

          const role = ((profile?.account_type || profile?.role || "client") as AccountRole);
          const loggedUser: UserProfile = {
            id: data.user.id,
            email: data.user.email || cleanEmail,
            role,
            full_name: profile?.full_name || "User",
            display_name: profile?.display_name || "User",
            handle: profile?.handle || "user",
            avatar_url: profile?.avatar_url,
            company_name: profile?.company_name,
            business_category: profile?.business_category,
            bio: profile?.bio,
            website_url: profile?.website_url,
            skills: profile?.skills,
            primary_ai_tools: profile?.primary_ai_tools,
            created_at: profile?.created_at || new Date().toISOString(),
          };

          setUser(loggedUser);
          localStorage.setItem("prismora_current_user", JSON.stringify(loggedUser));
          setIsLoading(false);
          return { success: true, role: loggedUser.role };
        }
      } catch (err: any) {
        // Fall back to registry
      }
    }

    // B. Authoritative Registry lookup
    const registry = getRegistry();
    const record = registry[cleanEmail];

    if (record) {
      // Password check
      if (record.passwordHash && record.passwordHash !== password) {
        setIsLoading(false);
        return { success: false, error: "Incorrect password. Please try again." };
      }

      setUser(record.profile);
      localStorage.setItem("prismora_current_user", JSON.stringify(record.profile));
      setIsLoading(false);
      return { success: true, role: record.profile.role };
    }

    // If not found in registry and not configured in Supabase
    setIsLoading(false);
    return {
      success: false,
      error: "Account not found with this email. Please register or check your credentials.",
    };
  }

  async function signup(data: SignupData) {
    setIsLoading(true);
    const env = getClientEnv();
    const cleanEmail = data.email.trim().toLowerCase();

    // Guaranteed valid UUID for database and cross-account compatibility
    const newUserId =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `00000000-0000-4000-8000-${Date.now().toString(16).padStart(12, "0")}`;

    // A. Real Supabase Auth if configured
    if (env.isConfigured) {
      try {
        const supabase = createClient() as any;
        const { data: authData, error } = await supabase.auth.signUp({
          email: cleanEmail,
          password: data.password,
          options: {
            data: {
              full_name: data.fullName,
              display_name: data.displayName,
              role: data.role,
            },
          },
        });

        if (error) {
          setIsLoading(false);
          return { success: false, error: error.message };
        }

        if (authData.user) {
          const authId = authData.user.id;
          await supabase.from("profiles").upsert({
            id: authId,
            role: data.role as any,
            account_type: data.role,
            full_name: data.fullName,
            display_name: data.displayName,
            handle: data.displayName.toLowerCase().replace(/[^a-z0-9]/g, "_"),
            company_name: data.companyName,
            business_category: data.businessCategory || "Advertising & Commercials",
          });

          // Ensure creator profile is initialized for freelancers
          if (data.role === "freelancer") {
            await supabase.from("creator_profiles").upsert({
              id: authId,
              tagline: "Verified AI Content Creator",
              specializations: ["cinematic_video"],
              primary_ai_tools: ["runway_gen3", "flux_1"],
              starting_rate_cents: 45000,
              currency: "USD",
              verification_status: "verified",
              is_available: true,
            });
          }

          const profileUser: UserProfile = {
            id: authId,
            email: cleanEmail,
            role: data.role,
            full_name: data.fullName,
            display_name: data.displayName,
            handle: data.displayName.toLowerCase().replace(/[^a-z0-9]/g, "_"),
            company_name: data.companyName,
            business_category: data.businessCategory || "Advertising & Commercials",
            created_at: new Date().toISOString(),
          };

          setUser(profileUser);
          localStorage.setItem("prismora_current_user", JSON.stringify(profileUser));
          saveToRegistry(cleanEmail, profileUser, data.password);
          setIsLoading(false);
          return { success: true, role: data.role };
        }
      } catch {
        // Fall back to local registry
      }
    }

    // B. Local Authoritative Creation
    const newProfile: UserProfile = {
      id: newUserId,
      email: cleanEmail,
      role: data.role,
      full_name: data.fullName,
      display_name: data.displayName,
      handle: data.displayName.toLowerCase().replace(/[^a-z0-9]/g, "_"),
      company_name: data.companyName,
      business_category: data.businessCategory || "Advertising & Commercials",
      created_at: new Date().toISOString(),
    };

    saveToRegistry(cleanEmail, newProfile, data.password);
    setUser(newProfile);
    localStorage.setItem("prismora_current_user", JSON.stringify(newProfile));
    setIsLoading(false);
    return { success: true, role: data.role };
  }

  async function logout() {
    setIsLoading(true);
    const env = getClientEnv();
    if (env.isConfigured) {
      try {
        const supabase = createClient() as any;
        await supabase.auth.signOut();
      } catch {
        // Ignore
      }
    }

    // Wipe session
    setUser(null);
    localStorage.removeItem("prismora_current_user");
    setIsLoading(false);
    router.push("/login");
  }

  async function updateProfile(updated: Partial<UserProfile>) {
    if (!user) return;
    const merged = { ...user, ...updated };
    setUser(merged);
    localStorage.setItem("prismora_current_user", JSON.stringify(merged));

    // Update in local registry
    try {
      const reg = getRegistry();
      if (reg[user.email.toLowerCase()]) {
        reg[user.email.toLowerCase()].profile = merged;
        localStorage.setItem("prismora_users_registry", JSON.stringify(reg));
      }
    } catch {
      // Ignore
    }

    // Update in Supabase if live
    const env = getClientEnv();
    if (env.isConfigured) {
      try {
        const supabase = createClient() as any;
        await supabase.from("profiles").update(updated).eq("id", user.id);
      } catch {
        // Ignore in fallback
      }
    }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        role: user?.role || null,
        isLoading,
        login,
        signup,
        logout,
        updateProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
