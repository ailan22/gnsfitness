import type { ReactNode } from 'react'

export default function MemberWorkspace({ name, personal, children }: { name: string; personal: ReactNode; children: ReactNode }) {
  return <>
    <div className="member-workspace member-workspace-unified">
      <header className="member-workspace-identity">
        <div className="member-identity-heading">
          <img src="/gns-logo-transparent.png" alt="" className="member-identity-logo" />
          <div><p className="eyebrow">Datos personales</p><h2>{name}</h2></div>
        </div>
        {personal}
      </header>
      <div className="member-workspace-content">{children}</div>
    </div>
    <p className="member-workspace-signature">GYM NATURE SOUL</p>
  </>
}
