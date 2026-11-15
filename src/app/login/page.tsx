import { googleEnabled } from "@/auth";
import { AuthForm } from "@/components/AuthForm";

export default function LoginPage() {
  return <AuthForm mode="login" googleEnabled={googleEnabled} />;
}
