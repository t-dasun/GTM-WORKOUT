import AuthRoleForm from '@/components/AuthRoleForm'

export default function AthleteAuthPage() {
  return (
    <AuthRoleForm
      role="athlete"
      title="Athlete login"
      subtitle="Access your workouts, customize schedule days, and log sessions quickly from mobile or desktop."
    />
  )
}
