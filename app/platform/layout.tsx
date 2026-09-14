import { PlatformAuthProvider } from "@/lib/auth/PlatformAuthContext";

/** Racine de tout `/platform/*` — fournit PlatformAuthContext aux deux groupes de
 * routes (public : /platform/login ; protégé : le reste). Jamais AuthContext ici. */
export default function PlatformRootLayout({ children }: LayoutProps<"/platform">) {
  return <PlatformAuthProvider>{children}</PlatformAuthProvider>;
}
