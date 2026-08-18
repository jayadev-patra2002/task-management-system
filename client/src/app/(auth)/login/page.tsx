// src/app/page.tsx
import { Suspense } from "react";
import LoginCard from "@/components/auth/login-card";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginCard />
    </Suspense>
  );
}