import { AuthView } from '@/components/views/AuthView'

export const metadata = {
  title: 'Sign In | AK Enterprises',
}

export default function LoginPage() {
  return <AuthView mode="login" />
}
