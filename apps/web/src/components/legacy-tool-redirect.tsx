import { Navigate, useLocation } from 'react-router'

export function LegacyToolRedirect() {
  const { search, hash } = useLocation()
  return <Navigate to={`/tools/url-qrcode${search}${hash}`} replace />
}
